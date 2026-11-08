import { describe, it, expect, vi } from 'vitest'
import type * as DevToolsCore from '@wdio/devtools-core'
import { finalizeTraceExport } from '@wdio/devtools-core'
import { NightwatchDevToolsPlugin } from '../src/index.js'

vi.mock('@wdio/devtools-core', async (importOriginal) => ({
  ...(await importOriginal<typeof DevToolsCore>()),
  finalizeTraceExport: vi.fn(async () => [])
}))
vi.mock('@wdio/devtools-backend', () => ({ start: vi.fn(), stop: vi.fn() }))

describe('telemetry mode finalize', () => {
  it('reaches the trace finalizer so the manifest is written', async () => {
    const plugin = new NightwatchDevToolsPlugin({ mode: 'telemetry' })
    Object.assign(plugin, {
      suiteManager: { getAllSuites: () => new Map() },
      sessionCapturer: {
        metadata: { sessionId: 'session-1' },
        snapshotCaptures: [],
        nativeNetwork: { stop: vi.fn() },
        closeWebSocket: vi.fn(async () => {})
      }
    })
    await plugin.after()
    expect(finalizeTraceExport).toHaveBeenCalledTimes(1)
  })
})
