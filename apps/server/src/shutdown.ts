interface Logger {
  info(obj: unknown, msg?: string): void
  error(obj: unknown, msg?: string): void
}

export interface Resources {
  /** Stops background jobs (retention). */
  stopJobs(): void
  manager: { stop(): Promise<void> }
  closeDb(): Promise<void>
}

/**
 * Runs as an onClose hook, after the app's preClose hook closed Socket.IO (no more commands):
 * no timer-driven transitions, every game saved, then the database closed. Every transition is
 * already persisted as it happens; this only waits for saves still in flight.
 */
export async function closeResources({ stopJobs, manager, closeDb }: Resources): Promise<void> {
  stopJobs()
  await manager.stop()
  await closeDb()
}

interface SignalOptions {
  log: Logger
  exit?: (code: number) => void
  /** Hard exit when closing hangs (a stuck DB connection, say). */
  timeoutMs?: number
}

/**
 * Returns the signal handler: closes the app once (`app.close()` runs the onClose hooks,
 * including `closeResources`) and exits. A second signal while closing is ignored.
 */
export function shutdownHandler(app: { close(): Promise<unknown> }, { log, exit = process.exit, timeoutMs = 10_000 }: SignalOptions) {
  let closing = false
  return async (signal: string) => {
    if (closing) return
    closing = true
    log.info({ signal }, 'shutting down')
    const timer = setTimeout(() => {
      log.error({ timeoutMs }, 'shutdown timed out')
      exit(1)
    }, timeoutMs)
    timer.unref?.()
    try {
      await app.close()
      log.info({}, 'shutdown complete')
      exit(0)
    } catch (error) {
      log.error(error, 'shutdown failed')
      exit(1)
    } finally {
      clearTimeout(timer)
    }
  }
}
