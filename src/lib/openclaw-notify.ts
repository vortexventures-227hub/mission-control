import { runOpenClaw } from './command'
import { logger } from './logger'

const log = logger.child({ module: 'openclaw-notify' })

export interface NotifyOptions {
  target?: string  // Telegram chat ID, defaults to main Axis chat
  channel?: string // defaults to 'telegram'
  silent?: boolean
  timeoutMs?: number
}

const DEFAULT_TARGET = '955793338' // Main Axis chat

/**
 * Send a message to the OpenClaw main session via Telegram.
 * This notifies Axis who can delegate tasks to other agents.
 */
export async function notifyOpenClaw(
  message: string,
  options: NotifyOptions = {}
): Promise<{ success: boolean; error?: string }> {
  const {
    target = DEFAULT_TARGET,
    channel = 'telegram',
    silent = false,
    timeoutMs = 15000
  } = options

  try {
    const args = [
      'message',
      'send',
      '--channel', channel,
      '--target', target,
      '--message', message
    ]

    if (silent) {
      args.push('--silent')
    }

    log.info(`Sending notification to OpenClaw: ${message.slice(0, 100)}...`)
    
    const result = await runOpenClaw(args, { timeoutMs })
    
    log.info('OpenClaw notification sent successfully')
    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Failed to notify OpenClaw: ${errorMessage}`)
    return { success: false, error: errorMessage }
  }
}

/**
 * Format a research request message for Axis.
 */
export function formatResearchRequest(params: {
  url: string
  notes?: string
  taskId: number | bigint
  jobId: string
}): string {
  const lines = [
    `🔬 **Research Request from Mission Control**`,
    ``,
    `**URL:** ${params.url}`,
  ]

  if (params.notes) {
    lines.push(`**Notes:** ${params.notes}`)
  }

  lines.push(
    ``,
    `**Task ID:** ${params.taskId}`,
    `**Job ID:** ${params.jobId}`,
    ``,
    `Delegate to Mr. Blanc for research and summarization.`
  )

  return lines.join('\n')
}
