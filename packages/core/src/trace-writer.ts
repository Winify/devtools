/**
 * Trace serialization utilities.
 *
 * Pure formatting functions — no I/O, no framework dependencies.
 * Consumers (service, adapters) handle file writing.
 */

import type { TraceEvent, CommandLog } from '@wdio/devtools-shared'
import {
  mapCommandToAction,
  formatActionTitle,
  FILL_METHODS
} from './action-mapping.js'

/**
 * Serialize a single trace event to a JSON line (NDJSON format).
 * No trailing newline — the caller adds it when writing to a stream.
 */
export function formatTraceEvent(event: TraceEvent): string {
  return JSON.stringify(event)
}

/**
 * Generate a human/LLM-readable Markdown transcript from captured commands.
 *
 * Pure post-processing — one line per command with timing, selectors, and
 * error annotations. Designed for zero-parsing LLM consumption.
 *
 * @param commands  The captured command log from a session.
 * @param startWallTime  Session start wall time for the ISO header line.
 * @param title  Optional session title (browser name, device name, etc.).
 */
export function generateTranscript(
  commands: CommandLog[],
  startWallTime: number,
  title?: string
): string {
  const wallTimeISO = new Date(startWallTime).toISOString()
  const lines: string[] = [
    `# ${title ?? 'Session'} — ${wallTimeISO}`,
    ''
  ]

  commands.forEach((entry, idx) => {
    const action = mapCommandToAction(String(entry.command))
    const label = action
      ? formatActionTitle(action, entry.args as unknown[])
      : String(entry.command)

    const duration = 0 // Duration isn't available on CommandLog — before/after pair gap

    const parts: string[] = [`${idx + 1}. ${label}`]

    if (duration > 0) {
      parts.push(`${duration}ms`)
    }

    if (
      action &&
      FILL_METHODS.has(action.method) &&
      entry.args &&
      (entry.args as unknown[])[0] !== undefined
    ) {
      const val = String((entry.args as unknown[])[0]).slice(0, 50)
      parts.push(`value="${val}"`)
    }

    if (entry.error) {
      const msg =
        typeof entry.error === 'object' && 'message' in entry.error
          ? (entry.error as { message: string }).message
          : String(entry.error)
      parts.push(`ERROR: ${msg}`)
    }

    lines.push(parts.join('  '))
  })

  return lines.join('\n')
}
