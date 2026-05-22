import { createHash } from 'crypto'
import { readFileSync } from 'fs'
import { join } from 'path'
import type Database from 'better-sqlite3'

export type Migration = {
  id: string
  up: (db: Database.Database) => void
}

// Plugin hook: extensions can register additional migrations without modifying this file.
const extraMigrations: Migration[] = []
export function registerMigrations(newMigrations: Migration[]): void {
  extraMigrations.push(...newMigrations)
}

const migrations: Migration[] = [
  {
    id: '001_init',
    up: (db) => {
      const schemaPath = join(process.cwd(), 'src', 'lib', 'schema.sql')
      const schema = readFileSync(schemaPath, 'utf8')
      const statements = schema.split(';').filter((stmt) => stmt.trim())
      db.transaction(() => {
        for (const statement of statements) {
          db.exec(statement.trim())
        }
      })()
    }
  },
  {
    id: '002_quality_reviews',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS quality_reviews (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id INTEGER NOT NULL,
          reviewer TEXT NOT NULL,
          status TEXT NOT NULL,
          notes TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_quality_reviews_task_id ON quality_reviews(task_id);
        CREATE INDEX IF NOT EXISTS idx_quality_reviews_reviewer ON quality_reviews(reviewer);
      `)
    }
  },
  {
    id: '003_quality_review_status_backfill',
    up: (db) => {
      // Convert existing review tasks to quality_review to enforce the gate
      db.exec(`
        UPDATE tasks
        SET status = 'quality_review'
        WHERE status = 'review';
      `)
    }
  },
  {
    id: '004_messages',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          conversation_id TEXT NOT NULL,
          from_agent TEXT NOT NULL,
          to_agent TEXT,
          content TEXT NOT NULL,
          message_type TEXT DEFAULT 'text',
          metadata TEXT,
          read_at INTEGER,
          created_at INTEGER DEFAULT (unixepoch())
        )
      `)
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at)
      `)
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_messages_agents ON messages(from_agent, to_agent)
      `)
    }
  },
  {
    id: '005_users',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          display_name TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'operator',
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          last_login_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS user_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          token TEXT NOT NULL UNIQUE,
          user_id INTEGER NOT NULL,
          expires_at INTEGER NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          ip_address TEXT,
          user_agent TEXT,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
        CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token);
        CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
      `)
    }
  },
  {
    id: '006_workflow_templates',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS workflow_templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          model TEXT NOT NULL DEFAULT 'sonnet',
          task_prompt TEXT NOT NULL,
          timeout_seconds INTEGER NOT NULL DEFAULT 300,
          agent_role TEXT,
          tags TEXT,
          created_by TEXT NOT NULL DEFAULT 'system',
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          last_used_at INTEGER,
          use_count INTEGER NOT NULL DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_workflow_templates_name ON workflow_templates(name);
        CREATE INDEX IF NOT EXISTS idx_workflow_templates_created_by ON workflow_templates(created_by);
      `)
    }
  },
  {
    id: '007_audit_log',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          action TEXT NOT NULL,
          actor TEXT NOT NULL,
          actor_id INTEGER,
          target_type TEXT,
          target_id INTEGER,
          detail TEXT,
          ip_address TEXT,
          user_agent TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );

        CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
        CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor);
        CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
      `)
    }
  },
  {
    id: '008_webhooks',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS webhooks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          url TEXT NOT NULL,
          secret TEXT,
          events TEXT NOT NULL DEFAULT '["*"]',
          enabled INTEGER NOT NULL DEFAULT 1,
          last_fired_at INTEGER,
          last_status INTEGER,
          created_by TEXT NOT NULL DEFAULT 'system',
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );

        CREATE TABLE IF NOT EXISTS webhook_deliveries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          webhook_id INTEGER NOT NULL,
          event_type TEXT NOT NULL,
          payload TEXT NOT NULL,
          status_code INTEGER,
          response_body TEXT,
          error TEXT,
          duration_ms INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
        CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_at ON webhook_deliveries(created_at);
        CREATE INDEX IF NOT EXISTS idx_webhooks_enabled ON webhooks(enabled);
      `)
    }
  },
  {
    id: '009_pipelines',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS workflow_pipelines (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          steps TEXT NOT NULL DEFAULT '[]',
          created_by TEXT NOT NULL DEFAULT 'system',
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          use_count INTEGER NOT NULL DEFAULT 0,
          last_used_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS pipeline_runs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pipeline_id INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          current_step INTEGER NOT NULL DEFAULT 0,
          steps_snapshot TEXT NOT NULL DEFAULT '[]',
          started_at INTEGER,
          completed_at INTEGER,
          triggered_by TEXT NOT NULL DEFAULT 'system',
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          FOREIGN KEY (pipeline_id) REFERENCES workflow_pipelines(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_pipeline_runs_pipeline_id ON pipeline_runs(pipeline_id);
        CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status ON pipeline_runs(status);
        CREATE INDEX IF NOT EXISTS idx_workflow_pipelines_name ON workflow_pipelines(name);
      `)
    }
  },
  {
    id: '010_settings',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          description TEXT,
          category TEXT NOT NULL DEFAULT 'general',
          updated_by TEXT,
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );

        CREATE INDEX IF NOT EXISTS idx_settings_category ON settings(category);
      `)
    }
  },
  {
    id: '011_alert_rules',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS alert_rules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          enabled INTEGER NOT NULL DEFAULT 1,
          entity_type TEXT NOT NULL,
          condition_field TEXT NOT NULL,
          condition_operator TEXT NOT NULL,
          condition_value TEXT NOT NULL,
          action_type TEXT NOT NULL DEFAULT 'notification',
          action_config TEXT NOT NULL DEFAULT '{}',
          cooldown_minutes INTEGER NOT NULL DEFAULT 60,
          last_triggered_at INTEGER,
          trigger_count INTEGER NOT NULL DEFAULT 0,
          created_by TEXT NOT NULL DEFAULT 'system',
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );

        CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules(enabled);
        CREATE INDEX IF NOT EXISTS idx_alert_rules_entity_type ON alert_rules(entity_type);
      `)
    }
  },
  {
    id: '012_super_admin_tenants',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS tenants (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          slug TEXT NOT NULL UNIQUE,
          display_name TEXT NOT NULL,
          linux_user TEXT NOT NULL UNIQUE,
          plan_tier TEXT NOT NULL DEFAULT 'standard',
          status TEXT NOT NULL DEFAULT 'pending',
          openclaw_home TEXT NOT NULL,
          workspace_root TEXT NOT NULL,
          gateway_port INTEGER,
          dashboard_port INTEGER,
          config TEXT NOT NULL DEFAULT '{}',
          created_by TEXT NOT NULL DEFAULT 'system',
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );

        CREATE TABLE IF NOT EXISTS provision_jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tenant_id INTEGER NOT NULL,
          job_type TEXT NOT NULL DEFAULT 'bootstrap',
          status TEXT NOT NULL DEFAULT 'queued',
          dry_run INTEGER NOT NULL DEFAULT 1,
          requested_by TEXT NOT NULL DEFAULT 'system',
          approved_by TEXT,
          runner_host TEXT,
          idempotency_key TEXT,
          request_json TEXT NOT NULL DEFAULT '{}',
          plan_json TEXT NOT NULL DEFAULT '[]',
          result_json TEXT,
          error_text TEXT,
          started_at INTEGER,
          completed_at INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS provision_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          job_id INTEGER NOT NULL,
          level TEXT NOT NULL DEFAULT 'info',
          step_key TEXT,
          message TEXT NOT NULL,
          data TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          FOREIGN KEY (job_id) REFERENCES provision_jobs(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
        CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
        CREATE INDEX IF NOT EXISTS idx_provision_jobs_tenant_id ON provision_jobs(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_provision_jobs_status ON provision_jobs(status);
        CREATE INDEX IF NOT EXISTS idx_provision_jobs_created_at ON provision_jobs(created_at);
        CREATE INDEX IF NOT EXISTS idx_provision_events_job_id ON provision_events(job_id);
        CREATE INDEX IF NOT EXISTS idx_provision_events_created_at ON provision_events(created_at);
      `)
    }
  },
  {
    id: '013_tenant_owner_gateway',
    up: (db) => {
      // Check if tenants table exists (may not on fresh installs without super-admin)
      const hasTenants = (db.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='tenants'`
      ).get() as any)
      if (!hasTenants) return

      const columns = db.prepare(`PRAGMA table_info(tenants)`).all() as Array<{ name: string }>
      const hasOwnerGateway = columns.some((c) => c.name === 'owner_gateway')
      if (!hasOwnerGateway) {
        db.exec(`ALTER TABLE tenants ADD COLUMN owner_gateway TEXT`)
      }

      const defaultGatewayName =
        String(process.env.MC_DEFAULT_OWNER_GATEWAY || process.env.MC_DEFAULT_GATEWAY_NAME || 'primary').trim() ||
        'primary'

      // Check if gateways table exists (created lazily by gateways API, not in migrations)
      const hasGateways = (db.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='gateways'`
      ).get() as any)

      if (hasGateways) {
        db.prepare(`
          UPDATE tenants
          SET owner_gateway = COALESCE(
            (SELECT name FROM gateways ORDER BY is_primary DESC, id ASC LIMIT 1),
            ?
          )
          WHERE owner_gateway IS NULL OR trim(owner_gateway) = ''
        `).run(defaultGatewayName)
      } else {
        db.prepare(`
          UPDATE tenants
          SET owner_gateway = ?
          WHERE owner_gateway IS NULL OR trim(owner_gateway) = ''
        `).run(defaultGatewayName)
      }

      db.exec(`CREATE INDEX IF NOT EXISTS idx_tenants_owner_gateway ON tenants(owner_gateway)`)
    }
  },
  {
    id: '014_auth_google_approvals',
    up: (db) => {
      const userCols = db.prepare(`PRAGMA table_info(users)`).all() as Array<{ name: string }>
      const has = (name: string) => userCols.some((c) => c.name === name)

      if (!has('provider')) db.exec(`ALTER TABLE users ADD COLUMN provider TEXT NOT NULL DEFAULT 'local'`)
      if (!has('provider_user_id')) db.exec(`ALTER TABLE users ADD COLUMN provider_user_id TEXT`)
      if (!has('email')) db.exec(`ALTER TABLE users ADD COLUMN email TEXT`)
      if (!has('avatar_url')) db.exec(`ALTER TABLE users ADD COLUMN avatar_url TEXT`)
      if (!has('is_approved')) db.exec(`ALTER TABLE users ADD COLUMN is_approved INTEGER NOT NULL DEFAULT 1`)
      if (!has('approved_by')) db.exec(`ALTER TABLE users ADD COLUMN approved_by TEXT`)
      if (!has('approved_at')) db.exec(`ALTER TABLE users ADD COLUMN approved_at INTEGER`)

      db.exec(`
        UPDATE users
        SET provider = COALESCE(NULLIF(provider, ''), 'local'),
            is_approved = COALESCE(is_approved, 1)
      `)

      db.exec(`
        CREATE TABLE IF NOT EXISTS access_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          provider TEXT NOT NULL DEFAULT 'google',
          email TEXT NOT NULL,
          provider_user_id TEXT,
          display_name TEXT,
          avatar_url TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          requested_at INTEGER NOT NULL DEFAULT (unixepoch()),
          last_attempt_at INTEGER NOT NULL DEFAULT (unixepoch()),
          attempt_count INTEGER NOT NULL DEFAULT 1,
          reviewed_by TEXT,
          reviewed_at INTEGER,
          review_note TEXT,
          approved_user_id INTEGER,
          FOREIGN KEY (approved_user_id) REFERENCES users(id) ON DELETE SET NULL
        )
      `)

      db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_access_requests_email_provider ON access_requests(email, provider)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`)
    }
  },
  {
    id: '015_missing_indexes',
    up: (db) => {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at);
        CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read ON notifications(recipient, read_at);
        CREATE INDEX IF NOT EXISTS idx_activities_actor ON activities(actor);
        CREATE INDEX IF NOT EXISTS idx_activities_entity ON activities(entity_type, entity_id);
        CREATE INDEX IF NOT EXISTS idx_messages_read_at ON messages(read_at);
      `)
    }
  },
  {
    id: '016_direct_connections',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS direct_connections (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
          tool_name TEXT NOT NULL,
          tool_version TEXT,
          connection_id TEXT NOT NULL UNIQUE,
          status TEXT NOT NULL DEFAULT 'connected',
          last_heartbeat INTEGER,
          metadata TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_direct_connections_agent_id ON direct_connections(agent_id);
        CREATE INDEX IF NOT EXISTS idx_direct_connections_connection_id ON direct_connections(connection_id);
        CREATE INDEX IF NOT EXISTS idx_direct_connections_status ON direct_connections(status);
      `)
    }
  },
  {
    id: '017_github_sync',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS github_syncs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          repo TEXT NOT NULL,
          last_synced_at INTEGER NOT NULL DEFAULT (unixepoch()),
          issue_count INTEGER NOT NULL DEFAULT 0,
          sync_direction TEXT NOT NULL DEFAULT 'inbound',
          status TEXT NOT NULL DEFAULT 'success',
          error TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_github_syncs_repo ON github_syncs(repo);
        CREATE INDEX IF NOT EXISTS idx_github_syncs_created_at ON github_syncs(created_at);
      `)
    }
  },
  {
    id: '018_token_usage',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS token_usage (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          model TEXT NOT NULL,
          session_id TEXT NOT NULL,
          input_tokens INTEGER NOT NULL DEFAULT 0,
          output_tokens INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_token_usage_session_id ON token_usage(session_id);
        CREATE INDEX IF NOT EXISTS idx_token_usage_created_at ON token_usage(created_at);
        CREATE INDEX IF NOT EXISTS idx_token_usage_model ON token_usage(model);
      `)
    }
  },
  {
    id: '019_webhook_retry',
    up: (db) => {
      // Add retry columns to webhook_deliveries
      const deliveryCols = db.prepare(`PRAGMA table_info(webhook_deliveries)`).all() as Array<{ name: string }>
      const hasCol = (name: string) => deliveryCols.some((c) => c.name === name)

      if (!hasCol('attempt')) db.exec(`ALTER TABLE webhook_deliveries ADD COLUMN attempt INTEGER NOT NULL DEFAULT 0`)
      if (!hasCol('next_retry_at')) db.exec(`ALTER TABLE webhook_deliveries ADD COLUMN next_retry_at INTEGER`)
      if (!hasCol('is_retry')) db.exec(`ALTER TABLE webhook_deliveries ADD COLUMN is_retry INTEGER NOT NULL DEFAULT 0`)
      if (!hasCol('parent_delivery_id')) db.exec(`ALTER TABLE webhook_deliveries ADD COLUMN parent_delivery_id INTEGER`)

      // Add circuit breaker column to webhooks
      const webhookCols = db.prepare(`PRAGMA table_info(webhooks)`).all() as Array<{ name: string }>
      if (!webhookCols.some((c) => c.name === 'consecutive_failures')) {
        db.exec(`ALTER TABLE webhooks ADD COLUMN consecutive_failures INTEGER NOT NULL DEFAULT 0`)
      }

      // Partial index for retry queue processing
      db.exec(`CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_retry ON webhook_deliveries(next_retry_at) WHERE next_retry_at IS NOT NULL`)
    }
  },
  {
    id: '020_claude_sessions',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS claude_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL UNIQUE,
          project_slug TEXT NOT NULL,
          project_path TEXT,
          model TEXT,
          git_branch TEXT,
          user_messages INTEGER NOT NULL DEFAULT 0,
          assistant_messages INTEGER NOT NULL DEFAULT 0,
          tool_uses INTEGER NOT NULL DEFAULT 0,
          input_tokens INTEGER NOT NULL DEFAULT 0,
          output_tokens INTEGER NOT NULL DEFAULT 0,
          estimated_cost REAL NOT NULL DEFAULT 0,
          first_message_at TEXT,
          last_message_at TEXT,
          last_user_prompt TEXT,
          is_active INTEGER NOT NULL DEFAULT 0,
          scanned_at INTEGER NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        )
      `)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_claude_sessions_active ON claude_sessions(is_active) WHERE is_active = 1`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_claude_sessions_project ON claude_sessions(project_slug)`)
    }
  },
  {
    id: '021_workspace_isolation_phase1',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS workspaces (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          slug TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
      `)

      db.prepare(`
        INSERT OR IGNORE INTO workspaces (id, slug, name, created_at, updated_at)
        VALUES (1, 'default', 'Default Workspace', unixepoch(), unixepoch())
      `).run()

      const addWorkspaceIdColumn = (table: string) => {
        const tableExists = db
          .prepare(`SELECT 1 as ok FROM sqlite_master WHERE type = 'table' AND name = ?`)
          .get(table) as { ok?: number } | undefined
        if (!tableExists?.ok) return

        const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
        if (!cols.some((c) => c.name === 'workspace_id')) {
          db.exec(`ALTER TABLE ${table} ADD COLUMN workspace_id INTEGER NOT NULL DEFAULT 1`)
        }
        db.exec(`UPDATE ${table} SET workspace_id = COALESCE(workspace_id, 1)`)
      }

      const scopedTables = [
        'users',
        'user_sessions',
        'tasks',
        'agents',
        'comments',
        'activities',
        'notifications',
        'quality_reviews',
        'standup_reports',
      ]

      for (const table of scopedTables) {
        addWorkspaceIdColumn(table)
      }

      db.exec(`CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces(slug)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_users_workspace_id ON users(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_user_sessions_workspace_id ON user_sessions(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_workspace_id ON tasks(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_agents_workspace_id ON agents(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_comments_workspace_id ON comments(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_activities_workspace_id ON activities(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_notifications_workspace_id ON notifications(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_quality_reviews_workspace_id ON quality_reviews(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_standup_reports_workspace_id ON standup_reports(workspace_id)`)
    }
  },
  {
    id: '022_workspace_isolation_phase2',
    up: (db) => {
      const addWorkspaceIdColumn = (table: string) => {
        const tableExists = db
          .prepare(`SELECT 1 as ok FROM sqlite_master WHERE type = 'table' AND name = ?`)
          .get(table) as { ok?: number } | undefined
        if (!tableExists?.ok) return

        const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
        if (!cols.some((c) => c.name === 'workspace_id')) {
          db.exec(`ALTER TABLE ${table} ADD COLUMN workspace_id INTEGER NOT NULL DEFAULT 1`)
        }
        db.exec(`UPDATE ${table} SET workspace_id = COALESCE(workspace_id, 1)`)
      }

      const scopedTables = [
        'messages',
        'alert_rules',
        'direct_connections',
        'github_syncs',
        'workflow_pipelines',
        'pipeline_runs',
      ]

      for (const table of scopedTables) {
        addWorkspaceIdColumn(table)
      }

      db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_workspace_id ON messages(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_alert_rules_workspace_id ON alert_rules(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_direct_connections_workspace_id ON direct_connections(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_github_syncs_workspace_id ON github_syncs(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_workflow_pipelines_workspace_id ON workflow_pipelines(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_pipeline_runs_workspace_id ON pipeline_runs(workspace_id)`)
    }
  },
  {
    id: '023_workspace_isolation_phase3',
    up: (db) => {
      const addWorkspaceIdColumn = (table: string) => {
        const tableExists = db
          .prepare(`SELECT 1 as ok FROM sqlite_master WHERE type = 'table' AND name = ?`)
          .get(table) as { ok?: number } | undefined
        if (!tableExists?.ok) return

        const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
        if (!cols.some((c) => c.name === 'workspace_id')) {
          db.exec(`ALTER TABLE ${table} ADD COLUMN workspace_id INTEGER NOT NULL DEFAULT 1`)
        }
        db.exec(`UPDATE ${table} SET workspace_id = COALESCE(workspace_id, 1)`)
      }

      const scopedTables = [
        'workflow_templates',
        'webhooks',
        'webhook_deliveries',
        'token_usage',
      ]

      for (const table of scopedTables) {
        addWorkspaceIdColumn(table)
      }

      db.exec(`CREATE INDEX IF NOT EXISTS idx_workflow_templates_workspace_id ON workflow_templates(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_webhooks_workspace_id ON webhooks(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_workspace_id ON webhook_deliveries(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_token_usage_workspace_id ON token_usage(workspace_id)`)
    }
  },
  {
    id: '024_projects_support',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          name TEXT NOT NULL,
          slug TEXT NOT NULL,
          description TEXT,
          ticket_prefix TEXT NOT NULL,
          ticket_counter INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'active',
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(workspace_id, slug),
          UNIQUE(workspace_id, ticket_prefix)
        )
      `)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_projects_workspace_status ON projects(workspace_id, status)`)

      const taskCols = db.prepare(`PRAGMA table_info(tasks)`).all() as Array<{ name: string }>
      if (!taskCols.some((c) => c.name === 'project_id')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN project_id INTEGER`)
      }
      if (!taskCols.some((c) => c.name === 'project_ticket_no')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN project_ticket_no INTEGER`)
      }
      db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_workspace_project ON tasks(workspace_id, project_id)`)

      const workspaceRows = db.prepare(`SELECT id FROM workspaces ORDER BY id ASC`).all() as Array<{ id: number }>
      const ensureDefaultProject = db.prepare(`
        INSERT OR IGNORE INTO projects (workspace_id, name, slug, description, ticket_prefix, ticket_counter, status, created_at, updated_at)
        VALUES (?, 'General', 'general', 'Default project for uncategorized tasks', 'TASK', 0, 'active', unixepoch(), unixepoch())
      `)
      const getDefaultProject = db.prepare(`
        SELECT id, ticket_counter FROM projects
        WHERE workspace_id = ? AND slug = 'general'
        LIMIT 1
      `)
      const setTaskProject = db.prepare(`
        UPDATE tasks SET project_id = ?
        WHERE workspace_id = ? AND (project_id IS NULL OR project_id = 0)
      `)
      const listProjectTasks = db.prepare(`
        SELECT id FROM tasks
        WHERE workspace_id = ? AND project_id = ?
        ORDER BY created_at ASC, id ASC
      `)
      const setTaskNo = db.prepare(`UPDATE tasks SET project_ticket_no = ? WHERE id = ?`)
      const setProjectCounter = db.prepare(`UPDATE projects SET ticket_counter = ?, updated_at = unixepoch() WHERE id = ?`)

      for (const workspace of workspaceRows) {
        ensureDefaultProject.run(workspace.id)
        const defaultProject = getDefaultProject.get(workspace.id) as { id: number; ticket_counter: number } | undefined
        if (!defaultProject) continue

        setTaskProject.run(defaultProject.id, workspace.id)

        const projectRows = db.prepare(`
          SELECT id FROM projects
          WHERE workspace_id = ?
          ORDER BY id ASC
        `).all(workspace.id) as Array<{ id: number }>

        for (const project of projectRows) {
          const tasks = listProjectTasks.all(workspace.id, project.id) as Array<{ id: number }>
          let counter = 0
          for (const task of tasks) {
            counter += 1
            setTaskNo.run(counter, task.id)
          }
          setProjectCounter.run(counter, project.id)
        }
      }
    }
  },
  {
    id: '025_token_usage_task_attribution',
    up: (db) => {
      const hasTokenUsageTable = db
        .prepare(`SELECT 1 as ok FROM sqlite_master WHERE type = 'table' AND name = 'token_usage'`)
        .get() as { ok?: number } | undefined

      if (!hasTokenUsageTable?.ok) return

      const cols = db.prepare(`PRAGMA table_info(token_usage)`).all() as Array<{ name: string }>
      const hasCol = (name: string) => cols.some((c) => c.name === name)

      if (!hasCol('task_id')) {
        db.exec(`ALTER TABLE token_usage ADD COLUMN task_id INTEGER`)
      }

      db.exec(`CREATE INDEX IF NOT EXISTS idx_token_usage_task_id ON token_usage(task_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_token_usage_workspace_task_time ON token_usage(workspace_id, task_id, created_at)`)
    }
  },
  {
    id: '026_task_outcome_tracking',
    up: (db) => {
      const hasTasks = db
        .prepare(`SELECT 1 as ok FROM sqlite_master WHERE type = 'table' AND name = 'tasks'`)
        .get() as { ok?: number } | undefined
      if (!hasTasks?.ok) return

      const taskCols = db.prepare(`PRAGMA table_info(tasks)`).all() as Array<{ name: string }>
      const hasCol = (name: string) => taskCols.some((c) => c.name === name)

      if (!hasCol('outcome')) db.exec(`ALTER TABLE tasks ADD COLUMN outcome TEXT`)
      if (!hasCol('error_message')) db.exec(`ALTER TABLE tasks ADD COLUMN error_message TEXT`)
      if (!hasCol('resolution')) db.exec(`ALTER TABLE tasks ADD COLUMN resolution TEXT`)
      if (!hasCol('feedback_rating')) db.exec(`ALTER TABLE tasks ADD COLUMN feedback_rating INTEGER`)
      if (!hasCol('feedback_notes')) db.exec(`ALTER TABLE tasks ADD COLUMN feedback_notes TEXT`)
      if (!hasCol('retry_count')) db.exec(`ALTER TABLE tasks ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0`)
      if (!hasCol('completed_at')) db.exec(`ALTER TABLE tasks ADD COLUMN completed_at INTEGER`)

      db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_outcome ON tasks(outcome)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(completed_at)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_workspace_outcome ON tasks(workspace_id, outcome, completed_at)`)
    }
  },
  {
    id: '027_enhanced_projects',
    up: (db) => {
      const hasProjects = db
        .prepare(`SELECT 1 as ok FROM sqlite_master WHERE type = 'table' AND name = 'projects'`)
        .get() as { ok?: number } | undefined
      if (!hasProjects?.ok) return

      const cols = db.prepare(`PRAGMA table_info(projects)`).all() as Array<{ name: string }>
      const hasCol = (name: string) => cols.some((c) => c.name === name)

      if (!hasCol('github_repo')) db.exec(`ALTER TABLE projects ADD COLUMN github_repo TEXT`)
      if (!hasCol('deadline')) db.exec(`ALTER TABLE projects ADD COLUMN deadline INTEGER`)
      if (!hasCol('color')) db.exec(`ALTER TABLE projects ADD COLUMN color TEXT`)
      if (!hasCol('metadata')) db.exec(`ALTER TABLE projects ADD COLUMN metadata TEXT`)

      db.exec(`
        CREATE TABLE IF NOT EXISTS project_agent_assignments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER NOT NULL,
          agent_name TEXT NOT NULL,
          role TEXT DEFAULT 'member',
          assigned_at INTEGER NOT NULL DEFAULT (unixepoch()),
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          UNIQUE(project_id, agent_name)
        );
        CREATE INDEX IF NOT EXISTS idx_paa_project ON project_agent_assignments(project_id);
        CREATE INDEX IF NOT EXISTS idx_paa_agent ON project_agent_assignments(agent_name);
      `)
    }
  },
  {
    id: '028_github_sync_v2',
    up: (db) => {
      // Tasks: promote GitHub fields from metadata JSON to proper columns
      const taskCols = db.prepare(`PRAGMA table_info(tasks)`).all() as Array<{ name: string }>
      const hasTaskCol = (name: string) => taskCols.some((c) => c.name === name)

      if (!hasTaskCol('github_issue_number')) db.exec(`ALTER TABLE tasks ADD COLUMN github_issue_number INTEGER`)
      if (!hasTaskCol('github_repo')) db.exec(`ALTER TABLE tasks ADD COLUMN github_repo TEXT`)
      if (!hasTaskCol('github_synced_at')) db.exec(`ALTER TABLE tasks ADD COLUMN github_synced_at INTEGER`)
      if (!hasTaskCol('github_branch')) db.exec(`ALTER TABLE tasks ADD COLUMN github_branch TEXT`)
      if (!hasTaskCol('github_pr_number')) db.exec(`ALTER TABLE tasks ADD COLUMN github_pr_number INTEGER`)
      if (!hasTaskCol('github_pr_state')) db.exec(`ALTER TABLE tasks ADD COLUMN github_pr_state TEXT`)

      // Unique index for dedup (partial — only rows with issue numbers)
      db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_github_issue
          ON tasks(workspace_id, github_repo, github_issue_number)
          WHERE github_issue_number IS NOT NULL
      `)

      // Projects: sync control columns
      const projCols = db.prepare(`PRAGMA table_info(projects)`).all() as Array<{ name: string }>
      const hasProjCol = (name: string) => projCols.some((c) => c.name === name)

      if (!hasProjCol('github_sync_enabled')) db.exec(`ALTER TABLE projects ADD COLUMN github_sync_enabled INTEGER NOT NULL DEFAULT 0`)
      if (!hasProjCol('github_labels_initialized')) db.exec(`ALTER TABLE projects ADD COLUMN github_labels_initialized INTEGER NOT NULL DEFAULT 0`)
      if (!hasProjCol('github_default_branch')) db.exec(`ALTER TABLE projects ADD COLUMN github_default_branch TEXT DEFAULT 'main'`)

      // Enhanced sync history columns
      const syncCols = db.prepare(`PRAGMA table_info(github_syncs)`).all() as Array<{ name: string }>
      const hasSyncCol = (name: string) => syncCols.some((c) => c.name === name)

      if (!hasSyncCol('project_id')) db.exec(`ALTER TABLE github_syncs ADD COLUMN project_id INTEGER`)
      if (!hasSyncCol('changes_pushed')) db.exec(`ALTER TABLE github_syncs ADD COLUMN changes_pushed INTEGER NOT NULL DEFAULT 0`)
      if (!hasSyncCol('changes_pulled')) db.exec(`ALTER TABLE github_syncs ADD COLUMN changes_pulled INTEGER NOT NULL DEFAULT 0`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_github_syncs_project ON github_syncs(project_id)`)

      // Data migration: copy existing metadata JSON values into new columns
      db.exec(`
        UPDATE tasks
        SET github_repo = json_extract(metadata, '$.github_repo'),
            github_issue_number = json_extract(metadata, '$.github_issue_number'),
            github_synced_at = CAST(strftime('%s', json_extract(metadata, '$.github_synced_at')) AS INTEGER)
        WHERE json_extract(metadata, '$.github_repo') IS NOT NULL
          AND github_repo IS NULL
      `)
    }
  },
  {
    id: '029_link_workspaces_to_tenants',
    up: (db) => {
      const hasWorkspaces = db
        .prepare(`SELECT 1 as ok FROM sqlite_master WHERE type = 'table' AND name = 'workspaces'`)
        .get() as { ok?: number } | undefined
      if (!hasWorkspaces?.ok) return

      const hasTenants = db
        .prepare(`SELECT 1 as ok FROM sqlite_master WHERE type = 'table' AND name = 'tenants'`)
        .get() as { ok?: number } | undefined
      if (!hasTenants?.ok) return

      const workspaceCols = db.prepare(`PRAGMA table_info(workspaces)`).all() as Array<{ name: string }>
      const hasWorkspaceTenantId = workspaceCols.some((c) => c.name === 'tenant_id')
      if (!hasWorkspaceTenantId) {
        db.exec(`ALTER TABLE workspaces ADD COLUMN tenant_id INTEGER`)
      }

      const tenantCount = (db.prepare(`SELECT COUNT(*) as c FROM tenants`).get() as { c: number } | undefined)?.c || 0
      let defaultTenantId: number
      if (tenantCount > 0) {
        const existing = db.prepare(`
          SELECT id
          FROM tenants
          ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, id ASC
          LIMIT 1
        `).get() as { id: number } | undefined
        if (!existing?.id) throw new Error('Failed to resolve default tenant')
        defaultTenantId = existing.id
      } else {
        const rawHost = String(process.env.MC_HOSTNAME || 'default').trim().toLowerCase()
        const slug = rawHost.replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'default'
        const linuxUser = (String(process.env.USER || 'local').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-') || 'local').slice(0, 30)
        const home = String(process.env.HOME || '/tmp').trim() || '/tmp'
        const insert = db.prepare(`
          INSERT INTO tenants (slug, display_name, linux_user, plan_tier, status, openclaw_home, workspace_root, config, created_by, owner_gateway)
          VALUES (?, ?, ?, 'standard', 'active', ?, ?, '{}', 'system', ?)
        `).run(
          slug,
          'Local Owner',
          linuxUser,
          `${home}/.openclaw`,
          `${home}/workspace`,
          process.env.MC_DEFAULT_OWNER_GATEWAY || process.env.MC_DEFAULT_GATEWAY_NAME || 'primary'
        )
        defaultTenantId = Number(insert.lastInsertRowid)
      }

      db.prepare(`UPDATE workspaces SET tenant_id = ? WHERE tenant_id IS NULL`).run(defaultTenantId)

      // Ensure session rows can carry tenant context derived from workspace.
      const sessionCols = db.prepare(`PRAGMA table_info(user_sessions)`).all() as Array<{ name: string }>
      if (!sessionCols.some((c) => c.name === 'tenant_id')) {
        db.exec(`ALTER TABLE user_sessions ADD COLUMN tenant_id INTEGER`)
      }
      db.exec(`
        UPDATE user_sessions
        SET tenant_id = (
          SELECT w.tenant_id
          FROM users u
          JOIN workspaces w ON w.id = COALESCE(user_sessions.workspace_id, u.workspace_id, 1)
          WHERE u.id = user_sessions.user_id
          LIMIT 1
        )
        WHERE tenant_id IS NULL
      `)
      db.prepare(`UPDATE user_sessions SET tenant_id = ? WHERE tenant_id IS NULL`).run(defaultTenantId)

      const workspaceFk = db.prepare(`PRAGMA foreign_key_list(workspaces)`).all() as Array<{ table: string; from: string; to: string }>
      const hasTenantFk = workspaceFk.some((fk) => fk.table === 'tenants' && fk.from === 'tenant_id' && fk.to === 'id')
      const tenantCol = (db.prepare(`PRAGMA table_info(workspaces)`).all() as Array<{ name: string; notnull: number }>).find((c) => c.name === 'tenant_id')
      const tenantColNotNull = tenantCol?.notnull === 1

      if (!hasTenantFk || !tenantColNotNull) {
        db.exec(`ALTER TABLE workspaces RENAME TO workspaces__legacy`)
        db.exec(`
          CREATE TABLE workspaces (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            tenant_id INTEGER NOT NULL,
            created_at INTEGER NOT NULL DEFAULT (unixepoch()),
            updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
          )
        `)
        db.prepare(`
          INSERT INTO workspaces (id, slug, name, tenant_id, created_at, updated_at)
          SELECT id, slug, name, COALESCE(tenant_id, ?), created_at, updated_at
          FROM workspaces__legacy
        `).run(defaultTenantId)
        db.exec(`DROP TABLE workspaces__legacy`)
      }

      db.exec(`CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces(slug)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_workspaces_tenant_id ON workspaces(tenant_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_user_sessions_tenant_id ON user_sessions(tenant_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_user_sessions_workspace_tenant ON user_sessions(workspace_id, tenant_id)`)
    }
  },
  {
    id: '032_adapter_configs',
    up(db: Database.Database) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS adapter_configs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL,
          framework TEXT NOT NULL,
          config TEXT DEFAULT '{}',
          enabled INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
        )
      `)
      db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_adapter_configs_workspace_framework ON adapter_configs(workspace_id, framework)`)
    }
  },
  {
    id: '033_skills',
    up(db: Database.Database) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS skills (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          source TEXT NOT NULL,
          path TEXT NOT NULL,
          description TEXT,
          content_hash TEXT,
          registry_slug TEXT,
          registry_version TEXT,
          security_status TEXT DEFAULT 'unchecked',
          installed_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(source, name)
        )
      `)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(name)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_skills_source ON skills(source)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_skills_registry_slug ON skills(registry_slug)`)
    }
  },
  {
    id: '034_agents_source',
    up(db: Database.Database) {
      const cols = db.prepare(`PRAGMA table_info(agents)`).all() as Array<{ name: string }>
      if (!cols.some(c => c.name === 'source')) {
        db.exec(`ALTER TABLE agents ADD COLUMN source TEXT DEFAULT 'manual'`)
      }
      if (!cols.some(c => c.name === 'content_hash')) {
        db.exec(`ALTER TABLE agents ADD COLUMN content_hash TEXT`)
      }
      if (!cols.some(c => c.name === 'workspace_path')) {
        db.exec(`ALTER TABLE agents ADD COLUMN workspace_path TEXT`)
      }
      db.exec(`CREATE INDEX IF NOT EXISTS idx_agents_source ON agents(source)`)
    }
  },
  {
    id: '035_api_keys_v2',
    up(db: Database.Database) {
      // Previous migrations (027/030) may have created an api_keys table with a different schema.
      // Drop and recreate with the full user-scoped schema.
      const existing = db
        .prepare(`SELECT 1 as ok FROM sqlite_master WHERE type = 'table' AND name = 'api_keys'`)
        .get() as { ok?: number } | undefined

      if (existing?.ok) {
        db.exec(`DROP TABLE api_keys`)
      }

      db.exec(`
        CREATE TABLE api_keys (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          label TEXT NOT NULL,
          key_prefix TEXT NOT NULL,
          key_hash TEXT NOT NULL UNIQUE,
          role TEXT NOT NULL DEFAULT 'viewer',
          scopes TEXT,
          expires_at INTEGER,
          last_used_at INTEGER,
          last_used_ip TEXT,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          tenant_id INTEGER NOT NULL DEFAULT 1,
          is_revoked INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        )
      `)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_api_keys_workspace_id ON api_keys(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix)`)
    }
  },
  {
    id: '036_recurring_tasks_index',
    up(db: Database.Database) {
      // Index to efficiently find recurring task templates
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_tasks_recurring
        ON tasks(workspace_id)
        WHERE json_extract(metadata, '$.recurrence.enabled') = 1
      `)
    }
  },
  {
    id: '037_security_audit',
    up(db: Database.Database) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS security_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_type TEXT NOT NULL,
          severity TEXT NOT NULL DEFAULT 'info',
          source TEXT,
          agent_name TEXT,
          detail TEXT,
          ip_address TEXT,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          tenant_id INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        )
      `)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_security_events_agent_name ON security_events(agent_name)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_security_events_workspace_id ON security_events(workspace_id)`)

      db.exec(`
        CREATE TABLE IF NOT EXISTS agent_trust_scores (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          agent_name TEXT NOT NULL,
          trust_score REAL NOT NULL DEFAULT 1.0,
          auth_failures INTEGER NOT NULL DEFAULT 0,
          injection_attempts INTEGER NOT NULL DEFAULT 0,
          rate_limit_hits INTEGER NOT NULL DEFAULT 0,
          secret_exposures INTEGER NOT NULL DEFAULT 0,
          successful_tasks INTEGER NOT NULL DEFAULT 0,
          failed_tasks INTEGER NOT NULL DEFAULT 0,
          last_anomaly_at INTEGER,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(agent_name, workspace_id)
        )
      `)

      db.exec(`
        CREATE TABLE IF NOT EXISTS mcp_call_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          agent_name TEXT,
          mcp_server TEXT,
          tool_name TEXT,
          success INTEGER NOT NULL DEFAULT 1,
          duration_ms INTEGER,
          error TEXT,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        )
      `)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_mcp_call_log_agent_name ON mcp_call_log(agent_name)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_mcp_call_log_created_at ON mcp_call_log(created_at)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_mcp_call_log_tool_name ON mcp_call_log(tool_name)`)
    }
  },
  {
    id: '038_agent_evals',
    up(db: Database.Database) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS eval_runs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          agent_name TEXT NOT NULL,
          eval_layer TEXT NOT NULL,
          score REAL,
          passed INTEGER,
          detail TEXT,
          golden_dataset_id INTEGER,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        )
      `)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_eval_runs_agent_name ON eval_runs(agent_name)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_eval_runs_eval_layer ON eval_runs(eval_layer)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_eval_runs_created_at ON eval_runs(created_at)`)

      db.exec(`
        CREATE TABLE IF NOT EXISTS eval_golden_sets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          entries TEXT NOT NULL DEFAULT '[]',
          created_by TEXT,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(name, workspace_id)
        )
      `)

      db.exec(`
        CREATE TABLE IF NOT EXISTS eval_traces (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          agent_name TEXT NOT NULL,
          task_id INTEGER,
          trace TEXT NOT NULL DEFAULT '[]',
          convergence_score REAL,
          total_steps INTEGER,
          optimal_steps INTEGER,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        )
      `)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_eval_traces_agent_name ON eval_traces(agent_name)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_eval_traces_task_id ON eval_traces(task_id)`)
    }
  },
  {
    id: '039_session_costs',
    up(db: Database.Database) {
      const columns = db.prepare(`PRAGMA table_info(token_usage)`).all() as Array<{ name: string }>
      const existing = new Set(columns.map((c) => c.name))

      if (!existing.has('cost_usd')) {
        db.exec(`ALTER TABLE token_usage ADD COLUMN cost_usd REAL`)
      }
      if (!existing.has('agent_name')) {
        db.exec(`ALTER TABLE token_usage ADD COLUMN agent_name TEXT`)
      }
      if (!existing.has('task_id')) {
        db.exec(`ALTER TABLE token_usage ADD COLUMN task_id INTEGER`)
      }
    }
  },
  {
    id: '040_agent_api_keys',
    up(db: Database.Database) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS agent_api_keys (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          agent_id INTEGER NOT NULL,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          name TEXT NOT NULL,
          key_hash TEXT NOT NULL,
          key_prefix TEXT NOT NULL,
          scopes TEXT NOT NULL DEFAULT '[]',
          expires_at INTEGER,
          revoked_at INTEGER,
          last_used_at INTEGER,
          created_by TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(workspace_id, key_hash)
        )
      `)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_agent_api_keys_agent_id ON agent_api_keys(agent_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_agent_api_keys_workspace_id ON agent_api_keys(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_agent_api_keys_expires_at ON agent_api_keys(expires_at)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_agent_api_keys_revoked_at ON agent_api_keys(revoked_at)`)
    }
  },
  {
    id: '041_gateway_health_logs',
    up(db: Database.Database) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS gateway_health_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          gateway_id INTEGER NOT NULL,
          status TEXT NOT NULL,
          latency INTEGER,
          probed_at INTEGER NOT NULL DEFAULT (unixepoch()),
          error TEXT
        )
      `)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_gateway_health_logs_gateway_id ON gateway_health_logs(gateway_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_gateway_health_logs_probed_at ON gateway_health_logs(probed_at)`)
    }
  },
  {
    id: '042_agent_hidden',
    up(db: Database.Database) {
      db.exec(`ALTER TABLE agents ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0`)
    }
  },
  {
    id: '043_hash_session_tokens',
    up(db: Database.Database) {
      // Migrate existing plaintext session tokens to SHA-256 hashes.
      // After this migration, session tokens are stored as hashes — raw tokens
      // are only returned to the client on creation. Existing sessions will be
      // invalidated (users need to re-login).
      const rows = db.prepare('SELECT id, token FROM user_sessions').all() as Array<{ id: number; token: string }>
      const update = db.prepare('UPDATE user_sessions SET token = ? WHERE id = ?')
      for (const row of rows) {
        const hashed = createHash('sha256').update(row.token).digest('hex')
        update.run(hashed, row.id)
      }
    }
  },
  {
    id: '044_spawn_history',
    up(db: Database.Database) {
      db.exec([
        `CREATE TABLE IF NOT EXISTS spawn_history (`,
        `  id INTEGER PRIMARY KEY AUTOINCREMENT,`,
        `  agent_id INTEGER,`,
        `  agent_name TEXT NOT NULL,`,
        `  spawn_type TEXT NOT NULL DEFAULT 'claude-code',`,
        `  session_id TEXT,`,
        `  trigger TEXT,`,
        `  status TEXT NOT NULL DEFAULT 'started',`,
        `  exit_code INTEGER,`,
        `  error TEXT,`,
        `  duration_ms INTEGER,`,
        `  workspace_id INTEGER NOT NULL DEFAULT 1,`,
        `  created_at INTEGER NOT NULL DEFAULT (unixepoch()),`,
        `  finished_at INTEGER,`,
        `  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL`,
        `)`,
      ].join('\n'))
      db.exec(`CREATE INDEX IF NOT EXISTS idx_spawn_history_agent ON spawn_history(agent_name)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_spawn_history_created ON spawn_history(created_at)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_spawn_history_status ON spawn_history(status)`)
    }
  },
  {
    id: '045_task_dispatch_attempts',
    up(db: Database.Database) {
      const cols = db.prepare(`PRAGMA table_info(tasks)`).all() as Array<{ name: string }>
      if (!cols.some(c => c.name === 'dispatch_attempts')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN dispatch_attempts INTEGER NOT NULL DEFAULT 0`)
      }
      db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_stale_inprogress ON tasks(status, updated_at) WHERE status = 'in_progress'`)
    }
  },
  {
    id: '046_agent_runs',
    up(db: Database.Database) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS runs (
          id TEXT PRIMARY KEY,
          agent_id TEXT NOT NULL,
          agent_name TEXT,
          model TEXT,
          provider TEXT,
          runtime TEXT DEFAULT 'mission-control',
          runtime_version TEXT,
          trigger_type TEXT,
          parent_run_id TEXT,
          task_id TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          outcome TEXT,
          started_at TEXT NOT NULL,
          ended_at TEXT,
          duration_ms INTEGER,
          steps TEXT DEFAULT '[]',
          tools_available TEXT DEFAULT '[]',
          cost_input_tokens INTEGER DEFAULT 0,
          cost_output_tokens INTEGER DEFAULT 0,
          cost_cache_read_tokens INTEGER,
          cost_cache_write_tokens INTEGER,
          cost_usd REAL,
          cost_model TEXT,
          run_hash TEXT,
          parent_run_hash TEXT,
          lineage TEXT DEFAULT '[]',
          model_version TEXT,
          config_hash TEXT,
          provenance_runtime TEXT,
          signed_by TEXT,
          signature TEXT,
          provenance_created_at TEXT,
          eval_task_type TEXT,
          eval_layer TEXT,
          eval_pass INTEGER,
          eval_score REAL,
          eval_detail TEXT,
          eval_metrics TEXT,
          eval_benchmark_id TEXT,
          error TEXT,
          git_branch TEXT,
          git_commit TEXT,
          workspace_id INTEGER DEFAULT 1,
          tags TEXT DEFAULT '[]',
          metadata TEXT DEFAULT '{}',
          spawn_history_id INTEGER,
          created_at INTEGER DEFAULT (unixepoch())
        )
      `)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_runs_agent_id ON runs(agent_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs(created_at)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_runs_workspace ON runs(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_runs_run_hash ON runs(run_hash)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_runs_task_id ON runs(task_id)`)
    }
  },
  {
    id: '047_agent_working_memory',
    up(db: Database.Database) {
      const cols = db.prepare(`PRAGMA table_info(agents)`).all() as Array<{ name: string }>
      if (!cols.some(c => c.name === 'working_memory')) {
        db.exec(`ALTER TABLE agents ADD COLUMN working_memory TEXT DEFAULT ''`)
      }
    }
  },
  {
    id: '048_memory_fts',
    up(db: Database.Database) {
      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
          path,
          title,
          content,
          tokenize='porter unicode61'
        )
      `)
      db.exec(`
        CREATE TABLE IF NOT EXISTS memory_fts_meta (
          key TEXT PRIMARY KEY,
          value TEXT
        )
      `)
    }
  },
  {
    id: '049_agent_runtime_type',
    up(db: Database.Database) {
      db.exec(`ALTER TABLE agents ADD COLUMN runtime_type TEXT DEFAULT NULL`)
    }
  },
  {
    id: '050_mcp_call_receipt_signing',
    up(db: Database.Database) {
      // Add Ed25519 receipt signing columns to the MCP audit log.
      // payload_hash: SHA-256 of the canonical JSON payload at write time
      // signature: Ed25519 signature (hex) over the canonical payload
      // public_key: base64-encoded Ed25519 public key for offline verification
      db.exec(`ALTER TABLE mcp_call_log ADD COLUMN payload_hash TEXT DEFAULT NULL`)
      db.exec(`ALTER TABLE mcp_call_log ADD COLUMN signature TEXT DEFAULT NULL`)
      db.exec(`ALTER TABLE mcp_call_log ADD COLUMN public_key TEXT DEFAULT NULL`)
    }
  },
  {
    id: '051_expenses_subscriptions',
    up(db: Database.Database) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          amount REAL NOT NULL,
          currency TEXT NOT NULL DEFAULT 'USD',
          category TEXT NOT NULL,
          description TEXT NOT NULL,
          vendor TEXT,
          source TEXT DEFAULT 'manual',
          agent_id TEXT,
          expense_date INTEGER NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
          is_recurring INTEGER DEFAULT 0,
          recurrence TEXT
        )
      `)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_expenses_workspace_id ON expenses(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses(expense_date)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category)`)
      db.exec(`
        CREATE TABLE IF NOT EXISTS subscriptions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          name TEXT NOT NULL,
          vendor TEXT NOT NULL,
          amount REAL NOT NULL,
          currency TEXT NOT NULL DEFAULT 'USD',
          billing_cycle TEXT NOT NULL,
          category TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          next_billing_date INTEGER,
          notes TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
        )
      `)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_subscriptions_workspace_id ON subscriptions(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)`)
      // Seed known VV subscriptions
      const now = Date.now()
      const nextMonth = now + 30 * 24 * 60 * 60 * 1000
      const seedSubs = [
        { name: 'Anthropic Max', vendor: 'Anthropic', amount: 100, billing_cycle: 'monthly', category: 'ai_api', notes: 'Claude Sonnet 4.6 primary model — 2 subscriptions' },
        { name: 'OpenAI Plus', vendor: 'OpenAI', amount: 20, billing_cycle: 'monthly', category: 'ai_api', notes: 'TTS, Whisper, image generation' },
        { name: 'MiniMax API', vendor: 'MiniMax', amount: 0, billing_cycle: 'monthly', category: 'ai_api', notes: 'Pay-as-you-go — AppFactory coding agents' },
      ]
      const insertSub = db.prepare(`INSERT OR IGNORE INTO subscriptions (name, vendor, amount, currency, billing_cycle, category, status, next_billing_date, notes, created_at, updated_at) VALUES (?, ?, ?, 'USD', ?, ?, 'active', ?, ?, ?, ?)`)
      for (const s of seedSubs) {
        insertSub.run(s.name, s.vendor, s.amount, s.billing_cycle, s.category, nextMonth, s.notes, now, now)
      }
    }
  },
  {
    id: '052_token_usage_unique_session',
    up(db: Database.Database) {
      // Add unique constraint on session_id to prevent duplicate rows from session scanner
      // Also add cost_usd and agent_name columns if missing (added in earlier migration patch)
      const cols = db.prepare('PRAGMA table_info(token_usage)').all() as Array<{ name: string }>
      const hasCol = (name: string) => cols.some((c) => c.name === name)
      if (!hasCol('cost_usd')) db.exec(`ALTER TABLE token_usage ADD COLUMN cost_usd REAL`)
      if (!hasCol('agent_name')) db.exec(`ALTER TABLE token_usage ADD COLUMN agent_name TEXT`)
      if (!hasCol('workspace_id')) db.exec(`ALTER TABLE token_usage ADD COLUMN workspace_id INTEGER NOT NULL DEFAULT 1`)
      if (!hasCol('task_id')) db.exec(`ALTER TABLE token_usage ADD COLUMN task_id INTEGER`)
      // Dedup existing rows before adding unique index
      db.exec(`
        DELETE FROM token_usage
        WHERE id NOT IN (
          SELECT MAX(id) FROM token_usage GROUP BY session_id
        )
      `)
      // Add unique index — enables ON CONFLICT DO UPDATE in session scanner forward sync
      db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_token_usage_session_unique ON token_usage(session_id)`)
    }
  },
  {
    id: '053_blackwire_group_chat_v0',
    up(db: Database.Database) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS group_chat_rooms (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          slug TEXT NOT NULL,
          name TEXT NOT NULL,
          kind TEXT NOT NULL CHECK(kind IN ('command', 'project', 'agent_dm', 'system')),
          project_key TEXT,
          pinned_finish_line TEXT,
          pinned_owner TEXT,
          pinned_blocker TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(workspace_id, slug)
        );

        CREATE TABLE IF NOT EXISTS group_chat_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          room_id INTEGER NOT NULL,
          sender_type TEXT NOT NULL CHECK(sender_type IN ('human', 'agent', 'system')),
          sender_id TEXT NOT NULL,
          body TEXT NOT NULL,
          message_type TEXT NOT NULL DEFAULT 'normal' CHECK(message_type IN ('normal', 'task_event', 'decision_receipt', 'attachment', 'alert')),
          parent_message_id INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          FOREIGN KEY(room_id) REFERENCES group_chat_rooms(id) ON DELETE CASCADE,
          FOREIGN KEY(parent_message_id) REFERENCES group_chat_messages(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS group_chat_message_delivery_state (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          message_id INTEGER NOT NULL,
          recipient_type TEXT NOT NULL CHECK(recipient_type IN ('human', 'agent', 'room')),
          recipient_id TEXT NOT NULL,
          state TEXT NOT NULL CHECK(state IN ('sent', 'delivered', 'seen')),
          state_at INTEGER NOT NULL DEFAULT (unixepoch()),
          evidence TEXT,
          FOREIGN KEY(message_id) REFERENCES group_chat_messages(id) ON DELETE CASCADE,
          UNIQUE(workspace_id, message_id, recipient_type, recipient_id)
        );

        CREATE TABLE IF NOT EXISTS group_chat_assignment_tracker_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          room_id INTEGER NOT NULL,
          source_message_id INTEGER,
          title TEXT NOT NULL,
          description TEXT,
          assignee_agent_id TEXT,
          status TEXT NOT NULL DEFAULT 'created' CHECK(status IN ('created', 'accepted', 'working', 'blocked', 'done')),
          priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('normal', 'priority', 'blocker', 'approval_needed')),
          evidence TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          FOREIGN KEY(room_id) REFERENCES group_chat_rooms(id) ON DELETE CASCADE,
          FOREIGN KEY(source_message_id) REFERENCES group_chat_messages(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS group_chat_decision_receipts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          room_id INTEGER NOT NULL,
          source_message_id INTEGER,
          decision TEXT NOT NULL,
          approved_by TEXT NOT NULL,
          approval_tier TEXT NOT NULL CHECK(approval_tier IN ('none', 'mission_control', 'chris_explicit')),
          evidence TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          FOREIGN KEY(room_id) REFERENCES group_chat_rooms(id) ON DELETE CASCADE,
          FOREIGN KEY(source_message_id) REFERENCES group_chat_messages(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS group_chat_agent_profile_cards (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          agent_id TEXT NOT NULL,
          display_name TEXT NOT NULL,
          role TEXT NOT NULL,
          runtime_type TEXT NOT NULL CHECK(runtime_type IN ('hermes', 'openclaw', 'david_runtime', 'claude_code', 'human', 'other')),
          model TEXT,
          status TEXT NOT NULL DEFAULT 'unknown' CHECK(status IN ('online_proven', 'offline', 'queued', 'blocked', 'unknown')),
          current_assignment TEXT,
          last_proof TEXT,
          capabilities_summary TEXT,
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(workspace_id, agent_id)
        );

        CREATE TABLE IF NOT EXISTS group_chat_queued_alerts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          room_id INTEGER NOT NULL,
          target_agent_id TEXT NOT NULL,
          source_message_id INTEGER,
          reason TEXT NOT NULL,
          alert_state TEXT NOT NULL DEFAULT 'queued' CHECK(alert_state IN ('queued', 'alert_sent', 'delivered', 'blocked')),
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          FOREIGN KEY(room_id) REFERENCES group_chat_rooms(id) ON DELETE CASCADE,
          FOREIGN KEY(source_message_id) REFERENCES group_chat_messages(id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_group_chat_rooms_workspace ON group_chat_rooms(workspace_id, slug);
        CREATE INDEX IF NOT EXISTS idx_group_chat_messages_room ON group_chat_messages(workspace_id, room_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_group_chat_delivery_message ON group_chat_message_delivery_state(workspace_id, message_id);
        CREATE INDEX IF NOT EXISTS idx_group_chat_assignments_room ON group_chat_assignment_tracker_items(workspace_id, room_id, status);
        CREATE INDEX IF NOT EXISTS idx_group_chat_receipts_room ON group_chat_decision_receipts(workspace_id, room_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_group_chat_agent_cards_status ON group_chat_agent_profile_cards(workspace_id, status);
        CREATE INDEX IF NOT EXISTS idx_group_chat_queued_alerts_state ON group_chat_queued_alerts(workspace_id, alert_state);
      `)

      const now = Math.floor(Date.now() / 1000)
      const rooms = [
        {
          slug: 'command',
          name: 'Command',
          kind: 'command',
          finish: 'Mission Control becomes the ground-zero source of truth for Blackwire Ops.',
          owner: 'Chris + Herm + Koda',
          blocker: 'No fake green. Empty metrics must say Not Instrumented Yet.'
        },
        {
          slug: 'blackwire-ops',
          name: 'Blackwire Ops',
          kind: 'project',
          finish: 'Replace user-facing Mailman with Mission Control group chat v0.',
          owner: 'Chris / Herm / Koda',
          blocker: 'Must prove sent / delivered / seen plus @mention task creation.'
        },
        {
          slug: 'dm-koda',
          name: 'DM: Koda',
          kind: 'agent_dm',
          finish: 'Direct Koda communication without mailbox drift.',
          owner: 'Koda',
          blocker: 'Queued if Koda is offline.'
        },
        {
          slug: 'dm-herm',
          name: 'DM: Herm',
          kind: 'agent_dm',
          finish: 'Direct Herm communication for truth/verification packets.',
          owner: 'Herm',
          blocker: 'Queued if Herm is offline.'
        }
      ]
      const insertRoom = db.prepare(`
        INSERT OR IGNORE INTO group_chat_rooms (
          workspace_id, slug, name, kind, project_key, pinned_finish_line,
          pinned_owner, pinned_blocker, created_at, updated_at
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const room of rooms) {
        insertRoom.run(room.slug, room.name, room.kind, room.slug, room.finish, room.owner, room.blocker, now, now)
      }

      const profiles = [
        ['chris', 'Chris', 'Owner / decision authority', 'human', null, 'online_proven', 'Mission Control acceptance and explicit approvals', 'User is active in current thread', 'Approves public/risky actions and evaluates daily-driver usability.'],
        ['koda', 'Koda', 'Implementation owner', 'other', 'GPT-5.5', 'online_proven', 'Group chat v0 implementation', 'Active Codex lane in VVKodaOps', 'Code, architecture, fixtures, APIs, UI, receipts.'],
        ['herm', 'Herm', 'Truth contract / verification owner', 'hermes', null, 'online_proven', 'Mission Control truth contract and acceptance gates', 'Herm packet received 2026-05-01', 'Prevents fake green and owns source-of-truth semantics.'],
        ['patch', 'Patch', 'UI/product design coordination', 'other', null, 'unknown', 'Premium command-center UI guidance only', 'Trust scope limited by Chris until restored', 'Design flow coordination; not runtime truth owner.'],
        ['neon-forge', 'Neon Forge', 'QA / false-green checks', 'other', null, 'queued', 'Fixture-driven QA after first slice', 'Outputs should be receipts, not chat noise', 'Visual sanity, proof gates, failure cases.']
      ]
      const insertProfile = db.prepare(`
        INSERT OR IGNORE INTO group_chat_agent_profile_cards (
          workspace_id, agent_id, display_name, role, runtime_type, model, status,
          current_assignment, last_proof, capabilities_summary, updated_at
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const profile of profiles) insertProfile.run(...profile, now)

      const blackwireRoom = db.prepare(`SELECT id FROM group_chat_rooms WHERE workspace_id = 1 AND slug = 'blackwire-ops'`).get() as { id: number } | undefined
      if (blackwireRoom) {
        const existing = db.prepare(`SELECT COUNT(*) as count FROM group_chat_messages WHERE workspace_id = 1 AND room_id = ?`).get(blackwireRoom.id) as { count: number }
        if (existing.count === 0) {
          const result = db.prepare(`
            INSERT INTO group_chat_messages (workspace_id, room_id, sender_type, sender_id, body, message_type, created_at)
            VALUES (1, ?, 'system', 'mission-control', ?, 'normal', ?)
          `).run(
            blackwireRoom.id,
            'Blackwire Ops room initialized from Herm contract. Demo goal: sent/delivered/seen, @mention task, decision receipt, offline queue.',
            now
          )
          const messageId = Number(result.lastInsertRowid)
          const delivery = db.prepare(`
            INSERT OR REPLACE INTO group_chat_message_delivery_state (
              workspace_id, message_id, recipient_type, recipient_id, state, state_at, evidence
            ) VALUES (1, ?, ?, ?, ?, ?, ?)
          `)
          delivery.run(messageId, 'room', 'blackwire-ops', 'sent', now, 'seeded fixture')
          delivery.run(messageId, 'human', 'chris', 'seen', now, 'seeded fixture')
          delivery.run(messageId, 'agent', 'koda', 'delivered', now, 'seeded fixture')
        }
      }
    }
  },
  {
    id: '054_mission_control_security_command_v0',
    up(db: Database.Database) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS mission_control_security_systems (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          system_key TEXT NOT NULL,
          label TEXT NOT NULL,
          posture TEXT NOT NULL DEFAULT 'not_instrumented' CHECK(posture IN ('green', 'watch', 'blocked', 'not_instrumented')),
          owner_agent_id TEXT NOT NULL,
          last_audit_at INTEGER,
          last_dependency_scan_at INTEGER,
          last_secret_scan_at INTEGER,
          last_auth_review_at INTEGER,
          last_path_drift_check_at INTEGER,
          evidence_path TEXT,
          next_action TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(workspace_id, system_key)
        );

        CREATE TABLE IF NOT EXISTS mission_control_security_findings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          system_key TEXT NOT NULL,
          title TEXT NOT NULL,
          severity TEXT NOT NULL CHECK(severity IN ('critical', 'high', 'medium', 'low', 'info')),
          status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'triage', 'accepted_risk', 'fixing', 'needs_verification', 'resolved', 'superseded')),
          owner_agent_id TEXT NOT NULL,
          evidence_path TEXT,
          next_action TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );

        CREATE INDEX IF NOT EXISTS idx_mc_security_systems_workspace ON mission_control_security_systems(workspace_id, posture);
        CREATE INDEX IF NOT EXISTS idx_mc_security_findings_workspace ON mission_control_security_findings(workspace_id, system_key, status, severity);
      `)

      const now = Math.floor(Date.now() / 1000)
      const systems = [
        {
          key: 'mission-control',
          label: 'Mission Control Runtime',
          posture: 'watch',
          owner: 'koda',
          audit: now,
          dep: null,
          secret: null,
          auth: now,
          path: now,
          evidence: '/Users/vortexventures/Desktop/Vortex Ventures/VVKodaOps/Dispatch_Outbox/2026-05-02_0553_MISSION_CONTROL_SLICE_009_KODA_CLOSEOUT.md',
          action: 'Reclaim port 3000 safely, then rerun authenticated API/UI proof from canonical repo.'
        },
        {
          key: 'blackwire-ops',
          label: 'Blackwire Ops Coordination',
          posture: 'watch',
          owner: 'herm',
          audit: now,
          dep: null,
          secret: null,
          auth: null,
          path: now,
          evidence: '/Users/vortexventures/Desktop/Vortex Ventures/VVKodaOps/HANDOFF.md',
          action: 'Keep tracker/receipts evidence-gated; no green without proof.'
        },
        {
          key: 'david-runtime',
          label: 'David Runtime',
          posture: 'not_instrumented',
          owner: 'herm',
          audit: null,
          dep: null,
          secret: null,
          auth: null,
          path: null,
          evidence: '/Users/vortexventures/Desktop/Vortex Ventures/VVMaterialSolutionsOps/runtime/david-agent',
          action: 'Wire David proof into Mission Control after runtime owner accepts the adapter contract.'
        },
        {
          key: 'mailbox-bridge',
          label: 'Mailbox / Agent Alerts',
          posture: 'watch',
          owner: 'koda',
          audit: now,
          dep: null,
          secret: null,
          auth: null,
          path: now,
          evidence: '/Users/vortexventures/Desktop/Vortex Ventures/VVKodaOps/Dispatch_Outbox',
          action: 'Replace receipt-only mailbox drift with Mission Control queued-alert delivery.'
        }
      ]
      const insertSystem = db.prepare(`
        INSERT OR IGNORE INTO mission_control_security_systems (
          workspace_id, system_key, label, posture, owner_agent_id,
          last_audit_at, last_dependency_scan_at, last_secret_scan_at,
          last_auth_review_at, last_path_drift_check_at, evidence_path,
          next_action, created_at, updated_at
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const system of systems) {
        insertSystem.run(
          system.key,
          system.label,
          system.posture,
          system.owner,
          system.audit,
          system.dep,
          system.secret,
          system.auth,
          system.path,
          system.evidence,
          system.action,
          now,
          now
        )
      }

      const findings = [
        {
          system: 'mission-control',
          title: 'Port 3000 is owned by non-canonical runtime processes',
          severity: 'high',
          status: 'needs_verification',
          owner: 'koda',
          evidence: '/Users/vortexventures/Desktop/Vortex Ventures/VVKodaOps/Dispatch_Outbox/2026-05-02_0553_MISSION_CONTROL_SLICE_009_KODA_CLOSEOUT.md',
          action: 'Approve a safe stop/restart plan before canonical port 3000 proof.'
        },
        {
          system: 'mission-control',
          title: 'Security command hooks exist as MVP surface, not full automated audit runtime',
          severity: 'medium',
          status: 'triage',
          owner: 'koda',
          evidence: '/Users/vortexventures/Desktop/Vortex Ventures/VVKodaOps/Dispatch_Inbox/2026-05-02_0929_MISSION_CONTROL_SLICE_015_SECURITY_AND_REMAINING_MVP.md',
          action: 'Keep missing scans labeled Not Instrumented Yet until adapters land.'
        },
        {
          system: 'david-runtime',
          title: 'David runtime proof is not yet wired into Mission Control',
          severity: 'medium',
          status: 'triage',
          owner: 'herm',
          evidence: '/Users/vortexventures/Desktop/Vortex Ventures/VVMaterialSolutionsOps/runtime/david-agent',
          action: 'Create a read-only David runtime adapter before claiming shared Mission Control visibility.'
        }
      ]
      const insertFinding = db.prepare(`
        INSERT INTO mission_control_security_findings (
          workspace_id, system_key, title, severity, status, owner_agent_id,
          evidence_path, next_action, created_at, updated_at
        )
        SELECT 1, ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE NOT EXISTS (
          SELECT 1 FROM mission_control_security_findings
          WHERE workspace_id = 1 AND system_key = ? AND title = ?
        )
      `)
      for (const finding of findings) {
        insertFinding.run(
          finding.system,
          finding.title,
          finding.severity,
          finding.status,
          finding.owner,
          finding.evidence,
          finding.action,
          now,
          now,
          finding.system,
          finding.title
        )
      }
    }
  },
  {
    id: '055_mission_control_asset_library_v0',
    up(db: Database.Database) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS mission_control_asset_library_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          asset_key TEXT NOT NULL,
          title TEXT NOT NULL,
          asset_type TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'evidence_missing' CHECK(status IN ('verified', 'evidence_missing', 'draft', 'blocked')),
          owner_project TEXT NOT NULL,
          evidence_path TEXT,
          source_url TEXT,
          next_action TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(workspace_id, asset_key)
        );
        CREATE INDEX IF NOT EXISTS idx_mc_asset_library_workspace ON mission_control_asset_library_items(workspace_id, status, asset_type);
      `)

      const now = Math.floor(Date.now() / 1000)
      const assets = [
        {
          key: 'mission-control-local-mvp-proof',
          title: 'Mission Control local MVP proof receipt',
          type: 'receipt',
          status: 'verified',
          project: 'Mission Control',
          evidence: '/Users/vortexventures/Desktop/Vortex Ventures/VVHermsOps/Dispatch_Inbox/2026-05-02_HERM_MISSION_CONTROL_MVP_PROOF_RECEIPT_0854.md',
          source: null,
          action: 'Use as the local Command Truth / Blackwire / evidence-gated Done proof baseline until production deploy proof exists.'
        },
        {
          key: 'marketing-command-center-proof',
          title: 'Marketing Command Center local proof receipt',
          type: 'receipt',
          status: 'verified',
          project: 'Mission Control / Marketing',
          evidence: '/Users/vortexventures/Desktop/Vortex Ventures/VVHermsOps/Dispatch_Inbox/mission_control_continuity_runs/2026-05-02_1145_mission_control_marketing_surface_index_slice.md',
          source: null,
          action: 'Keep external sends/posts/spend blocked; use receipt as read-only local surface proof.'
        },
        {
          key: 'security-command-center-proof',
          title: 'Security Command Center DB-backed local proof receipt',
          type: 'receipt',
          status: 'verified',
          project: 'Mission Control / Security',
          evidence: '/Users/vortexventures/Desktop/Vortex Ventures/VVHermsOps/Dispatch_Inbox/mission_control_continuity_runs/2026-05-02_1047_mission_control_security_command_runtime_slice.md',
          source: null,
          action: 'Use as MVP security surface proof only; daily audit hooks remain Not Instrumented Yet until wired.'
        },
        {
          key: 'design-visual-receipts',
          title: 'Design Studio visual receipt shelf',
          type: 'screenshot',
          status: 'evidence_missing',
          project: 'Mission Control / Design',
          evidence: null,
          source: null,
          action: 'Attach browser/screenshot visual QA receipts before approving design claims.'
        },
        {
          key: 'vortex-owned-assets-index',
          title: 'Vortex-owned apps/docs/products index',
          type: 'inventory',
          status: 'draft',
          project: 'Asset Library',
          evidence: null,
          source: null,
          action: 'Promote only assets with canonical file/source evidence; leave unproven inventory as Evidence Missing.'
        }
      ]
      const insertAsset = db.prepare(`
        INSERT INTO mission_control_asset_library_items (
          workspace_id, asset_key, title, asset_type, status, owner_project,
          evidence_path, source_url, next_action, created_at, updated_at
        )
        SELECT 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE NOT EXISTS (
          SELECT 1 FROM mission_control_asset_library_items
          WHERE workspace_id = 1 AND asset_key = ?
        )
      `)
      for (const asset of assets) {
        insertAsset.run(
          asset.key,
          asset.title,
          asset.type,
          asset.status,
          asset.project,
          asset.evidence,
          asset.source,
          asset.action,
          now,
          now,
          asset.key
        )
      }
    }
  },
  {
    id: '056_mission_control_brainstorm_wall_v0',
    up(db: Database.Database) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS mission_control_brainstorm_ideas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          idea_key TEXT NOT NULL,
          title TEXT NOT NULL,
          lane TEXT NOT NULL DEFAULT 'future' CHECK(lane IN ('active_mvp', 'future', 'hypothesis', 'parking_lot', 'promotion_gate')),
          status TEXT NOT NULL DEFAULT 'evidence_missing' CHECK(status IN ('researched', 'evidence_missing', 'draft', 'blocked', 'approved_for_promotion')),
          owner_project TEXT NOT NULL,
          evidence_path TEXT,
          next_action TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(workspace_id, idea_key)
        );
        CREATE INDEX IF NOT EXISTS idx_mc_brainstorm_workspace ON mission_control_brainstorm_ideas(workspace_id, status, lane);
      `)

      const now = Math.floor(Date.now() / 1000)
      const ideas = [
        {
          key: 'blackwire-room-demo',
          title: 'Blackwire room → task board → approval → receipt → evidence-gated Done demo',
          lane: 'active_mvp',
          status: 'researched',
          project: 'Mission Control',
          evidence: '/Users/vortexventures/Desktop/Vortex Ventures/VVHermsOps/Dispatch_Inbox/2026-05-02_HERM_MISSION_CONTROL_MVP_PROOF_RECEIPT_0854.md',
          action: 'Keep as the visible MVP anchor until production deploy and canonical port ownership are proven.'
        },
        {
          key: 'research-karpathia-mirofish-lab',
          title: 'Research Command Center with Karpathia Auto-Research and MiroFish Simulation Lab',
          lane: 'hypothesis',
          status: 'draft',
          project: 'Research Command Center',
          evidence: '/Users/vortexventures/Desktop/Vortex Ventures/VVHermsOps/Dispatch_Inbox/2026-05-02_MISSION_CONTROL_RESEARCH_KARPATHIA_MIROFISH_DESIGN_CONTRACT.md',
          action: 'Keep paid simulations approval-gated; wire source/citation receipts before claiming live research automation.'
        },
        {
          key: 'trading-operations-cockpit',
          title: 'Trading Operations cockpit for Polymarket and approved markets',
          lane: 'future',
          status: 'blocked',
          project: 'Trading Operations',
          evidence: '/Users/vortexventures/Desktop/Vortex Ventures/VVHermsOps/Dispatch_Inbox/2026-05-02_MISSION_CONTROL_TRADING_OPERATIONS_CONTRACT.md',
          action: 'Keep read-only with no orders, wallet/account mutation, API-key use, fake positions, fills, or P&L.'
        },
        {
          key: 'vortex-owned-asset-discovery',
          title: 'Broad Vortex-owned app/PDF/product/website asset discovery',
          lane: 'future',
          status: 'evidence_missing',
          project: 'Asset Library',
          evidence: null,
          action: 'Research and attach evidence before any idea becomes an Asset Library verified item.'
        },
        {
          key: 'mission-control-mobile-daily-driver',
          title: 'Mission Control mobile daily-driver polish',
          lane: 'parking_lot',
          status: 'evidence_missing',
          project: 'Mission Control / Design',
          evidence: null,
          action: 'Collect browser/mobile screenshots and UX acceptance notes before promotion.'
        }
      ]
      const insertIdea = db.prepare(`
        INSERT INTO mission_control_brainstorm_ideas (
          workspace_id, idea_key, title, lane, status, owner_project,
          evidence_path, next_action, created_at, updated_at
        )
        SELECT 1, ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE NOT EXISTS (
          SELECT 1 FROM mission_control_brainstorm_ideas
          WHERE workspace_id = 1 AND idea_key = ?
        )
      `)
      for (const idea of ideas) {
        insertIdea.run(
          idea.key,
          idea.title,
          idea.lane,
          idea.status,
          idea.project,
          idea.evidence,
          idea.action,
          now,
          now,
          idea.key
        )
      }
    }
  },
  {
    id: '057_mission_control_brain_memory_v0',
    up(db: Database.Database) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS mission_control_brain_memory_layers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          layer_key TEXT NOT NULL,
          label TEXT NOT NULL,
          layer_type TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'evidence_missing' CHECK(status IN ('present_only', 'refreshing', 'queried_manually', 'runtime_backed', 'operationally_adopted', 'isolated', 'evidence_missing', 'blocked')),
          domain TEXT NOT NULL,
          evidence_path TEXT,
          runtime_adoption TEXT NOT NULL DEFAULT 'not_adopted',
          next_action TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(workspace_id, layer_key)
        );
        CREATE INDEX IF NOT EXISTS idx_mc_brain_memory_layers_workspace ON mission_control_brain_memory_layers(workspace_id, status, layer_type);

        CREATE TABLE IF NOT EXISTS mission_control_brain_memory_correction_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          request_key TEXT NOT NULL,
          title TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'staged' CHECK(status IN ('staged', 'approved', 'applied', 'rejected', 'blocked')),
          domain TEXT NOT NULL,
          evidence_path TEXT,
          requested_change TEXT NOT NULL,
          next_action TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(workspace_id, request_key)
        );
        CREATE INDEX IF NOT EXISTS idx_mc_brain_memory_corrections_workspace ON mission_control_brain_memory_correction_requests(workspace_id, status, domain);
      `)

      const now = Math.floor(Date.now() / 1000)
      const layers = [
        {
          key: 'graphify-internal',
          label: 'Graphify internal project graph',
          type: 'graphify',
          status: 'queried_manually',
          domain: 'Vortex / Blackwire',
          evidence: '/Users/vortexventures/Desktop/Vortex Ventures/VVHermsOps/Dispatch_Inbox/2026-05-02_MISSION_CONTROL_RESEARCH_KARPATHIA_MIROFISH_DESIGN_CONTRACT.md',
          adoption: 'manual_query_only',
          action: 'Keep writes blocked unless an approved ingestion/correction receipt exists.'
        },
        {
          key: 'gbrain-internal',
          label: 'gBrain internal memory layer',
          type: 'gbrain',
          status: 'present_only',
          domain: 'Vortex / Blackwire',
          evidence: null,
          adoption: 'not_adopted_by_runtime',
          action: 'Document storage, freshness, read path, and runtime adoption proof before claiming operational use.'
        },
        {
          key: 'receipts-derived-facts',
          label: 'Receipts-derived fact layer',
          type: 'receipts',
          status: 'runtime_backed',
          domain: 'Mission Control',
          evidence: '/Users/vortexventures/Desktop/Vortex Ventures/VVHermsOps/Dispatch_Inbox/2026-05-02_HERM_MISSION_CONTROL_MVP_PROOF_RECEIPT_0854.md',
          adoption: 'mission_control_surfaces_read_receipts_as_evidence',
          action: 'Continue promoting only receipt-backed facts into command surfaces.'
        },
        {
          key: 'david-msnj-brain',
          label: 'David Material Solutions-only memory boundary',
          type: 'david_brain',
          status: 'isolated',
          domain: 'Material Solutions / David',
          evidence: '/Users/vortexventures/Desktop/Vortex Ventures/VVHermsOps/Dispatch_Inbox/2026-05-02_MISSION_CONTROL_MARKETING_COMMAND_CENTER_CONTRACT.md',
          adoption: 'isolated_boundary_visible',
          action: 'Do not mix David/customer memory with Vortex, Blackwire, trading, or internal project memory.'
        },
        {
          key: 'candidate-memory-tools',
          label: 'Candidate memory tools / screenshots',
          type: 'candidate_tool',
          status: 'evidence_missing',
          domain: 'Tooling candidates',
          evidence: null,
          adoption: 'not_adopted',
          action: 'Verify repo/link/security boundaries before adding any candidate as a memory layer.'
        }
      ]
      const insertLayer = db.prepare(`
        INSERT INTO mission_control_brain_memory_layers (
          workspace_id, layer_key, label, layer_type, status, domain,
          evidence_path, runtime_adoption, next_action, created_at, updated_at
        )
        SELECT 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE NOT EXISTS (
          SELECT 1 FROM mission_control_brain_memory_layers
          WHERE workspace_id = 1 AND layer_key = ?
        )
      `)
      for (const layer of layers) {
        insertLayer.run(
          layer.key,
          layer.label,
          layer.type,
          layer.status,
          layer.domain,
          layer.evidence,
          layer.adoption,
          layer.action,
          now,
          now,
          layer.key
        )
      }

      const corrections = [
        {
          key: 'false-green-finish-line-standard',
          title: 'False-green / finish-line correction queue',
          status: 'staged',
          domain: 'Mission Control',
          evidence: '/Users/vortexventures/Desktop/Vortex Ventures/VVHermsOps/Dispatch_Inbox/2026-05-02_HERM_MISSION_CONTROL_MVP_PROOF_RECEIPT_0854.md',
          change: 'Keep done status evidence-gated and label missing integrations Not Instrumented Yet / Evidence Missing.',
          action: 'Review before any approved Graphify/gBrain correction write; do not auto-write from this surface.'
        }
      ]
      const insertCorrection = db.prepare(`
        INSERT INTO mission_control_brain_memory_correction_requests (
          workspace_id, request_key, title, status, domain, evidence_path,
          requested_change, next_action, created_at, updated_at
        )
        SELECT 1, ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE NOT EXISTS (
          SELECT 1 FROM mission_control_brain_memory_correction_requests
          WHERE workspace_id = 1 AND request_key = ?
        )
      `)
      for (const correction of corrections) {
        insertCorrection.run(
          correction.key,
          correction.title,
          correction.status,
          correction.domain,
          correction.evidence,
          correction.change,
          correction.action,
          now,
          now,
          correction.key
        )
      }
    }
  },
  {
    id: '058_mission_control_research_command_v0',
    up(db: Database.Database) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS mission_control_research_briefs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          research_key TEXT NOT NULL,
          title TEXT NOT NULL,
          lane TEXT NOT NULL DEFAULT 'research_queue' CHECK(lane IN ('research_queue', 'karpathia', 'mirofish', 'citation_vault', 'trading_research', 'memory_harmony', 'design_research')),
          status TEXT NOT NULL DEFAULT 'evidence_missing' CHECK(status IN ('planned', 'draft', 'evidence_missing', 'approval_required', 'blocked', 'researched')),
          owner_agent TEXT NOT NULL,
          evidence_path TEXT,
          next_action TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(workspace_id, research_key)
        );
        CREATE INDEX IF NOT EXISTS idx_mc_research_briefs_workspace ON mission_control_research_briefs(workspace_id, status, lane);
      `)

      const now = Math.floor(Date.now() / 1000)
      const briefs = [
        {
          key: 'karpathia-auto-research-source-plan',
          title: 'Karpathia Auto-Research source/citation instrumentation plan',
          lane: 'karpathia',
          status: 'planned',
          owner: 'Karpathia',
          evidence: '/Users/vortexventures/Desktop/Vortex Ventures/VVHermsOps/Dispatch_Inbox/2026-05-02_MISSION_CONTROL_RESEARCH_KARPATHIA_MIROFISH_DESIGN_CONTRACT.md',
          action: 'Wire source-backed read-only research plans and citation receipts before claiming autonomous research is live.'
        },
        {
          key: 'mirofish-simulation-lab-paid-run-gate',
          title: 'MiroFish Simulation Lab paid-run approval gate',
          lane: 'mirofish',
          status: 'approval_required',
          owner: 'MiroFish',
          evidence: '/Users/vortexventures/Desktop/Vortex Ventures/VVHermsOps/Dispatch_Inbox/2026-05-02_MISSION_CONTROL_RESEARCH_KARPATHIA_MIROFISH_DESIGN_CONTRACT.md',
          action: 'Prepare simulation briefs only; explicit Chris approval is required before paid simulations or external compute spend.'
        },
        {
          key: 'blackwire-command-truth-research-findings',
          title: 'Blackwire Command Truth research findings board',
          lane: 'research_queue',
          status: 'researched',
          owner: 'Herm',
          evidence: '/Users/vortexventures/Desktop/Vortex Ventures/VVHermsOps/Dispatch_Inbox/2026-05-02_HERM_MISSION_CONTROL_MVP_PROOF_RECEIPT_0854.md',
          action: 'Keep findings tied to receipts before they promote into board tasks, approvals, or Command Truth claims.'
        },
        {
          key: 'trading-polymarket-signal-citations',
          title: 'Trading / Polymarket signal citation gate',
          lane: 'trading_research',
          status: 'evidence_missing',
          owner: 'Atlas',
          evidence: null,
          action: 'Do not promote market signals into trades or P&L claims until source citations and approval receipts exist.'
        }
      ]
      const insertBrief = db.prepare(`
        INSERT INTO mission_control_research_briefs (
          workspace_id, research_key, title, lane, status, owner_agent,
          evidence_path, next_action, created_at, updated_at
        )
        SELECT 1, ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE NOT EXISTS (
          SELECT 1 FROM mission_control_research_briefs
          WHERE workspace_id = 1 AND research_key = ?
        )
      `)
      for (const brief of briefs) {
        insertBrief.run(
          brief.key,
          brief.title,
          brief.lane,
          brief.status,
          brief.owner,
          brief.evidence,
          brief.action,
          now,
          now,
          brief.key
        )
      }
    }
  },
  {
    id: '059_mission_control_trading_operations_v0',
    up(db: Database.Database) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS mission_control_trading_watch_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          item_key TEXT NOT NULL,
          title TEXT NOT NULL,
          lane TEXT NOT NULL DEFAULT 'watchlist' CHECK(lane IN ('watchlist', 'signals', 'risk', 'spread', 'ledger', 'execution_guard')),
          status TEXT NOT NULL DEFAULT 'evidence_missing' CHECK(status IN ('planned', 'evidence_missing', 'approval_required', 'blocked', 'watching', 'researched')),
          owner_agent TEXT NOT NULL,
          market_url TEXT,
          evidence_path TEXT,
          next_action TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(workspace_id, item_key)
        );
        CREATE INDEX IF NOT EXISTS idx_mc_trading_watch_items_workspace ON mission_control_trading_watch_items(workspace_id, status, lane);
      `)

      const now = Math.floor(Date.now() / 1000)
      const items = [
        {
          key: 'polymarket-watchlist-shell',
          title: 'Polymarket / approved-market watchlist shell',
          lane: 'watchlist',
          status: 'planned',
          owner: 'Herald',
          marketUrl: null,
          evidence: '/Users/vortexventures/Desktop/Vortex Ventures/VVHermsOps/Dispatch_Inbox/2026-05-02_MISSION_CONTROL_TRADING_OPERATIONS_CONTRACT.md',
          action: 'Add sourced watch items only; no connector or live quote claim exists yet.'
        },
        {
          key: 'uncited-market-signal',
          title: 'Uncited market signal citation gate',
          lane: 'signals',
          status: 'evidence_missing',
          owner: 'Atlas',
          marketUrl: null,
          evidence: null,
          action: 'Attach research citations and simulation/approval receipts before any market signal can promote.'
        },
        {
          key: 'approval-gated-risk-note',
          title: 'Approval-gated risk and sizing note',
          lane: 'risk',
          status: 'approval_required',
          owner: 'Knox',
          marketUrl: null,
          evidence: '/Users/vortexventures/Desktop/Vortex Ventures/VVHermsOps/Dispatch_Inbox/2026-05-02_MISSION_CONTROL_TRADING_OPERATIONS_CONTRACT.md',
          action: 'Require explicit Chris approval before any account-affecting, financial, paid-data, or trading action.'
        },
        {
          key: 'execution-hard-block',
          title: 'Mission Control trading execution hard block',
          lane: 'execution_guard',
          status: 'blocked',
          owner: 'Ledger',
          marketUrl: null,
          evidence: '/Users/vortexventures/Desktop/Vortex Ventures/VVHermsOps/Dispatch_Inbox/2026-05-02_MISSION_CONTROL_TRADING_OPERATIONS_CONTRACT.md',
          action: 'Keep order placement, cancellation, wallet movement, account mutation, API-key use, fills, and P&L out of this MVP surface.'
        }
      ]
      const insertItem = db.prepare(`
        INSERT INTO mission_control_trading_watch_items (
          workspace_id, item_key, title, lane, status, owner_agent,
          market_url, evidence_path, next_action, created_at, updated_at
        )
        SELECT 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE NOT EXISTS (
          SELECT 1 FROM mission_control_trading_watch_items
          WHERE workspace_id = 1 AND item_key = ?
        )
      `)
      for (const item of items) {
        insertItem.run(
          item.key,
          item.title,
          item.lane,
          item.status,
          item.owner,
          item.marketUrl,
          item.evidence,
          item.action,
          now,
          now,
          item.key
        )
      }
    }
  },
  {
    id: '060_mission_control_design_studio_v0',
    up(db: Database.Database) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS mission_control_design_studio_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          item_key TEXT NOT NULL,
          title TEXT NOT NULL,
          lane TEXT NOT NULL DEFAULT 'ui_qa' CHECK(lane IN ('brand', 'ui_qa', 'visual_receipts', 'component_inventory', 'decision_log', 'publish_guard')),
          status TEXT NOT NULL DEFAULT 'evidence_missing' CHECK(status IN ('planned', 'evidence_missing', 'approval_required', 'blocked', 'receipt_backed', 'qa_ready')),
          owner_agent TEXT NOT NULL,
          evidence_path TEXT,
          screenshot_path TEXT,
          next_action TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(workspace_id, item_key)
        );
        CREATE INDEX IF NOT EXISTS idx_mc_design_studio_items_workspace ON mission_control_design_studio_items(workspace_id, status, lane);
      `)

      const now = Math.floor(Date.now() / 1000)
      const items = [
        {
          key: 'mission-control-brand-system',
          title: 'Mission Control brand system / token audit',
          lane: 'brand',
          status: 'planned',
          owner: 'Patch / Claw Design',
          evidence: '/Users/vortexventures/Desktop/Vortex Ventures/VVHermsOps/Dispatch_Inbox/2026-05-02_MISSION_CONTROL_RESEARCH_KARPATHIA_MIROFISH_DESIGN_CONTRACT.md',
          screenshot: null,
          action: 'Audit tokens, typography, spacing, and hierarchy against the premium command-center baseline before claiming design approved.'
        },
        {
          key: 'blackwire-room-visual-receipt-gate',
          title: 'Blackwire room visual receipt gate',
          lane: 'visual_receipts',
          status: 'evidence_missing',
          owner: 'Neon Forge / Herm',
          evidence: null,
          screenshot: null,
          action: 'Capture browser-visible Blackwire room, board, receipts, and queued-alert screenshots before using them as design proof.'
        },
        {
          key: 'component-inventory-command-surfaces',
          title: 'Command surface component inventory',
          lane: 'component_inventory',
          status: 'qa_ready',
          owner: 'Herm',
          evidence: '/Users/vortexventures/Desktop/Vortex Ventures/VVHermsOps/Dispatch_Inbox/mission_control_continuity_runs/2026-05-02_1425_mission_control_trading_operations_db_slice.md',
          screenshot: null,
          action: 'Keep the reusable MissionControlSurfacePanel as the shared component baseline; add visual receipts as they are captured.'
        },
        {
          key: 'external-publish-design-guard',
          title: 'External publish / customer-facing design guard',
          lane: 'publish_guard',
          status: 'blocked',
          owner: 'Knox',
          evidence: '/Users/vortexventures/Desktop/Vortex Ventures/VVHermsOps/HANDOFF.md',
          screenshot: null,
          action: 'Do not publish, post, deploy, send, or mutate customer-facing design surfaces without explicit scoped approval.'
        }
      ]
      const insertItem = db.prepare(`
        INSERT INTO mission_control_design_studio_items (
          workspace_id, item_key, title, lane, status, owner_agent,
          evidence_path, screenshot_path, next_action, created_at, updated_at
        )
        SELECT 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE NOT EXISTS (
          SELECT 1 FROM mission_control_design_studio_items
          WHERE workspace_id = 1 AND item_key = ?
        )
      `)
      for (const item of items) {
        insertItem.run(
          item.key,
          item.title,
          item.lane,
          item.status,
          item.owner,
          item.evidence,
          item.screenshot,
          item.action,
          now,
          now,
          item.key
        )
      }
    }
  },
]

export function runMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)

  const applied = new Set(
    db.prepare('SELECT id FROM schema_migrations').all().map((row: any) => row.id)
  )

  for (const migration of [...migrations, ...extraMigrations]) {
    if (applied.has(migration.id)) continue
    db.transaction(() => {
      migration.up(db)
      db.prepare('INSERT OR IGNORE INTO schema_migrations (id) VALUES (?)').run(migration.id)
    })()
  }
}
