import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  formatTraceEvent,
  generateTranscript,
  writeTraceDirectory
} from '../src/trace-writer.js'
import type {
  TraceEvent,
  CommandLog,
  NetworkRequest,
  Metadata
} from '@wdio/devtools-shared'

describe('formatTraceEvent', () => {
  it('serializes a trace event to a single JSON line', () => {
    const event: TraceEvent = {
      version: 8,
      type: 'context-options',
      origin: 'library',
      libraryName: '@wdio/devtools-service',
      libraryVersion: '0.0.0',
      browserName: 'chromium',
      platform: 'linux',
      wallTime: 1000,
      monotonicTime: 0,
      sdkLanguage: 'javascript',
      title: 'test',
      contextId: 'ctx@abc',
      options: { viewport: { width: 1920, height: 1080 } }
    }
    const line = formatTraceEvent(event)
    const parsed = JSON.parse(line)
    expect(parsed.type).toBe('context-options')
    expect(parsed.version).toBe(8)
  })

  it('serializes before/after events', () => {
    const before: TraceEvent = {
      type: 'before',
      callId: 'call@1',
      startTime: 100,
      class: 'Page',
      method: 'navigate',
      pageId: 'page@abc',
      params: { url: 'https://example.com' },
      title: 'Page.navigate("https://example.com")'
    }
    expect(JSON.parse(formatTraceEvent(before)).type).toBe('before')

    const after: TraceEvent = {
      type: 'after',
      callId: 'call@1',
      endTime: 200
    }
    expect(JSON.parse(formatTraceEvent(after)).type).toBe('after')
  })
})

describe('generateTranscript', () => {
  it('produces a markdown header with the wall-time ISO string', () => {
    const transcript = generateTranscript([], 1717891200000)
    expect(transcript.startsWith('# Session — 2024-06-')).toBe(true)
  })

  it('uses the title param when provided', () => {
    const transcript = generateTranscript([], 1717891200000, 'My Test')
    expect(transcript.startsWith('# My Test — ')).toBe(true)
  })

  it('lists mapped commands as numbered steps', () => {
    const commands: CommandLog[] = [
      {
        command: 'url',
        args: ['https://example.com'],
        timestamp: 1000,
        result: undefined
      },
      {
        command: 'click',
        args: ['#submit'],
        timestamp: 2000,
        result: undefined
      }
    ]
    const transcript = generateTranscript(commands, 1000)
    expect(transcript).toContain('1. Page.navigate("https://example.com")')
    expect(transcript).toContain('2. Element.click("#submit")')
  })

  it('skips commands that do not map to traceable actions', () => {
    const commands: CommandLog[] = [
      { command: '$', args: ['#btn'], timestamp: 1000, result: undefined },
      { command: 'pause', args: [500], timestamp: 2000, result: undefined },
      {
        command: 'click',
        args: ['#btn'],
        timestamp: 3000,
        result: undefined
      }
    ]
    const transcript = generateTranscript(commands, 1000)
    expect(transcript).toContain('1. Element.click("#btn")')
    expect(transcript).not.toContain('$')
    expect(transcript).not.toContain('pause')
  })

  it('annotates fill-method commands with value=', () => {
    const commands: CommandLog[] = [
      {
        command: 'setValue',
        args: ['#username', 'tomsmith'],
        timestamp: 1000,
        result: undefined
      }
    ]
    const transcript = generateTranscript(commands, 1000)
    expect(transcript).toContain('value="tomsmith"')
  })

  it('shows ERROR annotation when command has error', () => {
    const commands: CommandLog[] = [
      {
        command: 'click',
        args: ['#missing'],
        timestamp: 1000,
        result: undefined,
        error: { message: 'element not found' }
      }
    ]
    const transcript = generateTranscript(commands, 1000)
    expect(transcript).toContain('ERROR: element not found')
  })
})

describe('writeTraceDirectory', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'trace-writer-test-'))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  const baseCommands: CommandLog[] = [
    {
      command: 'url',
      args: ['https://example.com'],
      timestamp: 1717891200000,
      result: undefined
    }
  ]

  const baseMetadata: Metadata = {
    type: 'test',
    options: {} as Record<string, unknown>,
    capabilities: { browserName: 'chrome' } as Record<string, unknown>
  }

  it('creates the trace directory with trace.trace and transcript.md', async () => {
    const dir = await writeTraceDirectory({
      outputDir: tmpDir,
      sessionId: 'test-session',
      commands: baseCommands,
      networkRequests: [],
      metadata: baseMetadata,
      consoleLogs: [],
      sources: {},
      startWallTime: 1717891200000
    })

    expect(dir).toBe(path.join(tmpDir, 'trace-test-session'))

    const tracePath = path.join(dir, 'trace.trace')
    const traceContent = await fs.readFile(tracePath, 'utf8')
    expect(traceContent).toContain('context-options')
    expect(traceContent).toContain('before')
    expect(traceContent).toContain('after')

    const transcriptPath = path.join(dir, 'transcript.md')
    const transcript = await fs.readFile(transcriptPath, 'utf8')
    expect(transcript.startsWith('# chrome — ')).toBe(true)

    const resourcesDir = path.join(dir, 'resources')
    const stat = await fs.stat(resourcesDir)
    expect(stat.isDirectory()).toBe(true)
  })

  it('writes trace.network when there are network requests', async () => {
    const net: NetworkRequest[] = [
      {
        url: 'https://example.com/api',
        method: 'GET',
        status: 200,
        timestamp: 1717891200100
      }
    ]
    const dir = await writeTraceDirectory({
      outputDir: tmpDir,
      sessionId: 'test-session',
      commands: baseCommands,
      networkRequests: net,
      metadata: baseMetadata,
      consoleLogs: [],
      sources: {},
      startWallTime: 1717891200000
    })

    const netPath = path.join(dir, 'trace.network')
    const netContent = await fs.readFile(netPath, 'utf8')
    expect(netContent).toContain('"url":"https://example.com/api"')
  })

  it('skips trace.network when there are no network requests', async () => {
    const dir = await writeTraceDirectory({
      outputDir: tmpDir,
      sessionId: 'test-session',
      commands: baseCommands,
      networkRequests: [],
      metadata: baseMetadata,
      consoleLogs: [],
      sources: {},
      startWallTime: 1717891200000
    })

    const netPath = path.join(dir, 'trace.network')
    await expect(fs.access(netPath)).rejects.toThrow()
  })

  it('emits an initial screencast-frame when the first command has a screenshot', async () => {
    const commands: CommandLog[] = [
      {
        command: 'url',
        args: ['https://example.com'],
        timestamp: 1717891200000,
        result: undefined,
        screenshot: Buffer.from('fake-png').toString('base64')
      }
    ]
    const dir = await writeTraceDirectory({
      outputDir: tmpDir,
      sessionId: 'test-session',
      commands,
      networkRequests: [],
      metadata: baseMetadata,
      consoleLogs: [],
      sources: {},
      startWallTime: 1717891200000
    })

    const tracePath = path.join(dir, 'trace.trace')
    const traceContent = await fs.readFile(tracePath, 'utf8')

    // First event is context-options, second is screencast-frame with timestamp=0
    const lines = traceContent
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l))
    const frameEvents = lines.filter((e) => e.type === 'screencast-frame')
    expect(frameEvents.length).toBeGreaterThanOrEqual(1)
    expect(frameEvents[0].timestamp).toBe(0)

    // Screenshot PNG should exist in resources/
    const resources = await fs.readdir(path.join(dir, 'resources'))
    const pngs = resources.filter((f) => f.endsWith('.png'))
    expect(pngs.length).toBeGreaterThanOrEqual(1)
  })

  it('produces a mobile context-options with chromium browserName and device title', async () => {
    const metadata: Metadata = {
      ...baseMetadata,
      capabilities: {
        platformName: 'Android',
        'appium:deviceName': 'Pixel 6',
        'appium:platformVersion': '13'
      } as unknown as Record<string, unknown>
    }
    const dir = await writeTraceDirectory({
      outputDir: tmpDir,
      sessionId: 'test-session',
      commands: baseCommands,
      networkRequests: [],
      metadata,
      consoleLogs: [],
      sources: {},
      startWallTime: 1717891200000
    })

    const tracePath = path.join(dir, 'trace.trace')
    const traceContent = await fs.readFile(tracePath, 'utf8')
    const lines = traceContent.trim().split('\n')
    const ctxEvent = JSON.parse(lines[0])
    expect(ctxEvent.type).toBe('context-options')
    expect(ctxEvent.browserName).toBe('chromium')
    expect(ctxEvent.title).toBe('android - Pixel 6 (13)')
  })
})
