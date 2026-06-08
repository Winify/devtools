/**
 * Trace serialization utilities.
 *
 * Formatting and directory-writing functions — `writeTraceDirectory` is the
 * main entry point for producing a Playwright-compatible trace directory.
 *
 * Event ordering matches the reference @wdio/mcp trace format:
 *   context-options → screencast-frame(init) → [before → after → screencast-frame] × N
 */

import fs from 'node:fs/promises'
import path from 'node:path'

import type {
  TraceEvent,
  TraceContextOptionsEvent,
  CommandLog,
  Metadata,
  NetworkRequest
} from '@wdio/devtools-shared'
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

  // Only include commands that map to traceable actions
  const captured = commands.filter(
    (c) => mapCommandToAction(String(c.command)) !== null
  )

  captured.forEach((entry, idx) => {
    const action = mapCommandToAction(String(entry.command))!
    const label = formatActionTitle(action, entry.args as unknown[])

    const rawArgs = entry.args as unknown[]
    const parts: string[] = [`${idx + 1}. ${label}`]

    if (FILL_METHODS.has(action.method) && rawArgs) {
      // When args = [selector, value], use args[1] for the value annotation
      const valueIdx = rawArgs.length >= 2 ? 1 : 0
      if (rawArgs[valueIdx] !== undefined) {
        parts.push(`value="${String(rawArgs[valueIdx]).slice(0, 50)}"`)
      }
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

// ── NDJSON directory writer ────────────────────────────────────────────────

export interface WriteTraceDirectoryOptions {
  outputDir: string
  sessionId: string
  commands: CommandLog[]
  networkRequests: NetworkRequest[]
  metadata: Metadata
  consoleLogs: unknown[]
  sources: Record<string, string>
  suites?: Record<string, unknown>[]
  startWallTime: number
  title?: string
}

function resourceName(
  pageId: string,
  wallTimestamp: number,
  suffix: string
): string {
  return `${pageId}-${wallTimestamp}${suffix}`
}

/**
 * Write a Playwright-compatible trace directory matching the @wdio/mcp format.
 *
 * Produces:
 * ```
 * trace-{sessionId}/
 *   trace.trace       NDJSON event stream
 *   trace.network     NDJSON network entries
 *   transcript.md     Markdown step log
 *   sources.json      Source file map
 *   suites.json       Test suite structure
 *   resources/
 *     {pageId}-{wallTimestamp}.png           Screenshot
 *     {pageId}-{wallTimestamp}-elements.json Element data
 *     {pageId}-{wallTimestamp}-snapshot.txt  Text snapshot
 * ```
 *
 * Resource files for the same command share a wall-timestamp prefix so
 * parsers can correlate screenshot ↔ elements ↔ snapshot by stripping
 * the well-known suffixes.
 */
export async function writeTraceDirectory(
  opts: WriteTraceDirectoryOptions
): Promise<string> {
  const dir = path.join(opts.outputDir, `trace-${opts.sessionId}`)
  await fs.mkdir(dir, { recursive: true })
  await fs.mkdir(path.join(dir, 'resources'), { recursive: true })

  const pageId = `page@${opts.sessionId.slice(0, 8)}`
  const contextId = `context@${opts.sessionId.slice(0, 8)}`

  const ctxEvent: TraceContextOptionsEvent = {
    version: 8,
    type: 'context-options',
    origin: 'library',
    libraryName: '@wdio/devtools-service',
    libraryVersion: '0.0.0',
    browserName:
      (opts.metadata.capabilities as Record<string, unknown> | undefined)
        ?.browserName as string ?? 'chromium',
    platform:
      process.platform === 'darwin'
        ? 'darwin'
        : process.platform === 'win32'
          ? 'windows'
          : 'linux',
    wallTime: opts.startWallTime,
    monotonicTime: 0,
    sdkLanguage: 'javascript',
    title: opts.title ?? 'Session',
    contextId,
    options: { viewport: { width: 1920, height: 1080 } }
  }

  const events: TraceEvent[] = [ctxEvent]

  // Emit initial screencast-frame (timestamp=0) if the first command has a
  // screenshot — represents the page state before any interaction.
  const firstScreenshot = opts.commands.find((c) => c.screenshot)
  if (firstScreenshot?.screenshot && firstScreenshot.timestamp) {
    const ts = firstScreenshot.timestamp
    const pngName = resourceName(pageId, ts, '.png')
    await fs.writeFile(
      path.join(dir, 'resources', pngName),
      Buffer.from(firstScreenshot.screenshot, 'base64')
    )
    events.push({
      type: 'screencast-frame',
      pageId,
      sha1: pngName,
      width: 1280,
      height: 720,
      timestamp: 0
    })
  }

  let callCounter = 0

  for (const cmd of opts.commands) {
    const action = mapCommandToAction(String(cmd.command))
    // Skip commands that don't map to traceable actions (pause, $, getText, …).
    if (!action) {
      continue
    }

    callCounter++
    const callId = `call@${callCounter}`
    const startTime = cmd.timestamp - opts.startWallTime

    // before — build named params matching MCP conventions
    const rawArgs = cmd.args as unknown[]
    let params: Record<string, unknown>
    if (
      action.class === 'Element' &&
      action.method === 'fill' &&
      rawArgs.length >= 2
    ) {
      params = { selector: rawArgs[0], value: rawArgs[1] }
    } else if (
      action.class === 'Element' &&
      action.method === 'fill' &&
      rawArgs.length === 1
    ) {
      params = { value: rawArgs[0] }
    } else if (
      action.class === 'Element' &&
      rawArgs.length === 1 &&
      typeof rawArgs[0] === 'string'
    ) {
      params = { selector: rawArgs[0] }
    } else if (rawArgs.length === 1 && typeof rawArgs[0] === 'string') {
      // Page.navigate(url) etc. — single string arg → name it url
      params = { url: rawArgs[0] }
    } else {
      params = Object.fromEntries(rawArgs.map((a, i) => [String(i), a]))
    }

    events.push({
      type: 'before',
      callId,
      startTime,
      class: action.class,
      method: action.method,
      pageId,
      params,
      title: formatActionTitle(action, rawArgs, params)
    })

    // after
    const afterEvt: TraceEvent = {
      type: 'after',
      callId,
      endTime: startTime
    }
    if (cmd.error) {
      ;(afterEvt as unknown as Record<string, unknown>).error = {
        message:
          typeof cmd.error === 'object' && 'message' in cmd.error
            ? (cmd.error as { message: string }).message
            : String(cmd.error)
      }
    }
    events.push(afterEvt)

    // screencast-frame — post-action visual state with correlated resources.
    if (cmd.screenshot) {
      const wallTs = cmd.timestamp

      // Write screenshot
      const pngName = resourceName(pageId, wallTs, '.png')
      await fs.writeFile(
        path.join(dir, 'resources', pngName),
        Buffer.from(cmd.screenshot, 'base64')
      )

      // Write elements + snapshot with correlated timestamp prefix
      let elementsFile: string | undefined
      let snapshotFile: string | undefined

      const elData = (cmd as unknown as Record<string, unknown>).elements as
        | { elements: unknown; snapshotText?: string }
        | undefined
      if (elData) {
        elementsFile = resourceName(pageId, wallTs, '-elements.json')
        await fs.writeFile(
          path.join(dir, 'resources', elementsFile),
          JSON.stringify(elData.elements),
          'utf8'
        )

        if (elData.snapshotText) {
          snapshotFile = resourceName(pageId, wallTs, '-snapshot.txt')
          await fs.writeFile(
            path.join(dir, 'resources', snapshotFile),
            elData.snapshotText,
            'utf8'
          )
        }
      }

      events.push({
        type: 'screencast-frame',
        pageId,
        sha1: pngName,
        ...(elementsFile ? { elements: elementsFile } : {}),
        ...(snapshotFile ? { snapshot: snapshotFile } : {}),
        width: 1280,
        height: 720,
        timestamp: wallTs
      })
    }
  }

  // Write trace.trace
  const traceNdjson = events.map((e) => JSON.stringify(e)).join('\n') + '\n'
  await fs.writeFile(path.join(dir, 'trace.trace'), traceNdjson, 'utf8')

  // Write trace.network
  if (opts.networkRequests.length > 0) {
    const netNdjson =
      opts.networkRequests.map((r) => JSON.stringify(r)).join('\n') + '\n'
    await fs.writeFile(path.join(dir, 'trace.network'), netNdjson, 'utf8')
  }

  // Write transcript.md — human/LLM-readable step log
  const transcript = generateTranscript(
    opts.commands,
    opts.startWallTime,
    opts.title
  )
  await fs.writeFile(path.join(dir, 'transcript.md'), transcript, 'utf8')

  return dir
}
