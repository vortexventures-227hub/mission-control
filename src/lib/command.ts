import { spawn } from 'node:child_process'
import { config } from './config'

interface CommandOptions {
  cwd?: string
  env?: NodeJS.ProcessEnv
  timeoutMs?: number
  input?: string
  onData?: (chunk: string) => void
}

interface CommandResult {
  stdout: string
  stderr: string
  code: number | null
}

export function runCommand(
  command: string,
  args: string[],
  options: CommandOptions = {}
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      shell: false
    })

    let stdout = ''
    let stderr = ''
    let timeoutId: NodeJS.Timeout | undefined
    let settled = false

    // Settle exactly once. A SIGKILL'd child does not always emit `close` —
    // if a grandchild still holds the stdio pipes, the event never fires and
    // this promise hangs forever. The caller's `await` then never returns and
    // the route writes NO HTTP response at all: the client sees zero bytes and
    // its own timeout, while the server log shows an error that was never
    // delivered. Timing out must therefore reject on its own, not merely
    // signal the child and hope for an event.
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      if (timeoutId) clearTimeout(timeoutId)
      fn()
    }

    if (options.timeoutMs) {
      timeoutId = setTimeout(() => {
        child.kill('SIGKILL')
        finish(() => {
          const error = new Error(
            `Command timed out after ${options.timeoutMs}ms (${command} ${args.join(' ')}): ${stderr || stdout}`
          )
          ;(error as any).stdout = stdout
          ;(error as any).stderr = stderr
          ;(error as any).timedOut = true
          reject(error)
        })
      }, options.timeoutMs)
    }

    child.stdout.on('data', (data) => {
      const chunk = data.toString()
      stdout += chunk
      options.onData?.(chunk)
    })

    child.stderr.on('data', (data) => {
      const chunk = data.toString()
      stderr += chunk
      options.onData?.(chunk)
    })

    child.on('error', (error) => {
      finish(() => reject(error))
    })

    child.on('close', (code) => {
      finish(() => {
        if (code === 0) {
          resolve({ stdout, stderr, code })
          return
        }
        const error = new Error(
          `Command failed (${command} ${args.join(' ')}): ${stderr || stdout}`
        )
        ;(error as any).stdout = stdout
        ;(error as any).stderr = stderr
        ;(error as any).code = code
        reject(error)
      })
    })

    // ALWAYS end stdin. Previously stdin was only closed when `options.input`
    // was supplied, so callers that pass no input (callOpenClawGateway is one)
    // left the pipe open and a CLI that reads stdin would block forever — the
    // request hung well past its own timeout budget instead of returning 500.
    if (options.input) {
      child.stdin.write(options.input)
    }
    child.stdin.end()
  })
}

export function runOpenClaw(args: string[], options: CommandOptions = {}) {
  // Explicitly pass OPENCLAW_STATE_DIR so the CLI uses the exact resolved path.
  // Without this, the CLI may interpret OPENCLAW_HOME as a parent directory and
  // append ".openclaw" to it — causing double-nesting when OPENCLAW_HOME is
  // already set to the state directory (e.g. /root/.openclaw → /root/.openclaw/.openclaw).
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    OPENCLAW_STATE_DIR: config.openclawStateDir,
    ...options.env,
  }
  return runCommand(config.openclawBin, args, {
    ...options,
    env,
    cwd: options.cwd || config.openclawStateDir || process.cwd()
  })
}

export function runClawdbot(args: string[], options: CommandOptions = {}) {
  return runCommand(config.clawdbotBin, args, {
    ...options,
    cwd: options.cwd || config.openclawStateDir || process.cwd()
  })
}
