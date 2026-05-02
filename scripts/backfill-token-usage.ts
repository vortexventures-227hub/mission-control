#!/usr/bin/env npx ts-node

/**
 * Backfill token_usage from claude_sessions
 *
 * Reads all rows from claude_sessions and inserts/updates corresponding records
 * into token_usage. Uses INSERT ... ON CONFLICT DO UPDATE so it's idempotent —
 * existing session_ids are updated rather than duplicated.
 *
 * Run: npx ts-node scripts/backfill-token-usage.ts
 * Or:  node --loader ts-node/esm scripts/backfill-token-usage.ts
 */

import { getDatabase } from '../src/lib/db'

function extractAgentName(sessionId: string): string {
  const trimmed = sessionId.trim()
  if (!trimmed) return 'unknown'
  const [agent] = trimmed.split(':')
  return agent?.trim() || 'unknown'
}

function isoToUnixEpoch(iso: string | null): number {
  if (!iso) return Math.floor(Date.now() / 1000)
  try {
    return Math.floor(new Date(iso).getTime() / 1000)
  } catch {
    return Math.floor(Date.now() / 1000)
  }
}

async function main() {
  const db = getDatabase()

  const rows = db.prepare(`
    SELECT
      session_id,
      model,
      input_tokens,
      output_tokens,
      estimated_cost,
      first_message_at,
      scanned_at
    FROM claude_sessions
  `).all() as Array<{
    session_id: string
    model: string | null
    input_tokens: number
    output_tokens: number
    estimated_cost: number | null
    first_message_at: string | null
    scanned_at: number
  }>

  if (rows.length === 0) {
    console.log('No sessions found in claude_sessions. Nothing to do.')
    return
  }

  const insert = db.prepare(`
    INSERT INTO token_usage (
      model, session_id, input_tokens, output_tokens,
      cost_usd, agent_name, workspace_id, task_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET
      model = excluded.model,
      input_tokens = excluded.input_tokens,
      output_tokens = excluded.output_tokens,
      cost_usd = excluded.cost_usd,
      agent_name = excluded.agent_name,
      created_at = excluded.created_at
  `)

  let inserted = 0
  let skipped = 0

  db.transaction(() => {
    for (const row of rows) {
      const result = insert.run(
        row.model ?? 'unknown',
        row.session_id,
        row.input_tokens ?? 0,
        row.output_tokens ?? 0,
        row.estimated_cost ?? null,
        extractAgentName(row.session_id),
        1,            // workspace_id
        null,         // task_id
        isoToUnixEpoch(row.first_message_at) || row.scanned_at,
      )

      if (result.changes === 0) {
        skipped++
      } else {
        inserted++
      }
    }
  })()

  console.log(`Backfill complete: ${inserted} rows inserted, ${skipped} skipped (already existed)`)
  console.log(`Total sessions processed: ${rows.length}`)
}

main().catch(err => {
  console.error('Backfill failed:', err)
  process.exit(1)
})
