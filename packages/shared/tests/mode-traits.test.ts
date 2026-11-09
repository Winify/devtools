import { describe, expect, it } from 'vitest'
import {
  assertDevToolsMode,
  capturesTrace,
  forcesManifest,
  ignoredOptionsWarning,
  observesPage,
  startsBackend
} from '../src/mode-traits.js'
import type { DevToolsMode } from '../src/types.js'

describe('mode traits', () => {
  it('answers forcesManifest from the table', () => {
    expect(forcesManifest('live')).toBe(false)
    expect(forcesManifest('trace')).toBe(false)
    expect(forcesManifest('telemetry')).toBe(true)
    expect(forcesManifest(undefined)).toBe(false)
  })

  it('answers startsBackend, capturesTrace and observesPage from the table', () => {
    expect(startsBackend('live')).toBe(true)
    expect(startsBackend('trace')).toBe(false)
    expect(startsBackend('telemetry')).toBe(false)
    expect(capturesTrace('live')).toBe(false)
    expect(capturesTrace('trace')).toBe(true)
    expect(capturesTrace('telemetry')).toBe(false)
    expect(observesPage('live')).toBe(true)
    expect(observesPage('trace')).toBe(true)
    expect(observesPage('telemetry')).toBe(false)
  })

  it('treats an undefined mode as live', () => {
    expect(startsBackend(undefined)).toBe(true)
    expect(capturesTrace(undefined)).toBe(false)
    expect(observesPage(undefined)).toBe(true)
  })
})

describe('mode traits with an unknown mode', () => {
  const unknown = (mode: string): DevToolsMode => mode as DevToolsMode
  const message = (mode: string) =>
    new Error(
      `Unknown DevTools mode "${mode}"; expected one of: live, trace, telemetry`
    )

  it('throws naming the mode and the known ones instead of a raw TypeError', () => {
    expect(() => startsBackend(unknown('Trace'))).toThrow(message('Trace'))
    expect(() => capturesTrace(unknown('Trace'))).toThrow(message('Trace'))
    expect(() => observesPage(unknown('Trace'))).toThrow(message('Trace'))
    expect(() => forcesManifest(unknown('Trace'))).toThrow(message('Trace'))
  })

  it('does not answer for a property inherited from Object.prototype', () => {
    expect(() => startsBackend(unknown('toString'))).toThrow(
      message('toString')
    )
  })
})

describe('assertDevToolsMode', () => {
  const message = (mode: string) =>
    `Unknown DevTools mode "${mode}"; expected one of: live, trace, telemetry`

  it('accepts an absent mode and each known mode', () => {
    expect(() => assertDevToolsMode(undefined)).not.toThrow()
    expect(() => assertDevToolsMode('live')).not.toThrow()
    expect(() => assertDevToolsMode('trace')).not.toThrow()
    expect(() => assertDevToolsMode('telemetry')).not.toThrow()
  })

  it('throws the traitsOf message for a typo, including a null or inherited value', () => {
    expect(() => assertDevToolsMode('Trace')).toThrow(message('Trace'))
    expect(() => assertDevToolsMode('toString')).toThrow(message('toString'))
    expect(() => assertDevToolsMode(null)).toThrow(message('null'))
  })
})

describe('ignoredOptionsWarning', () => {
  it('names every capture option telemetry drops in one warning', () => {
    expect(
      ignoredOptionsWarning(
        { video: 'on', screencast: { enabled: true } },
        'telemetry'
      )
    ).toBe(
      'telemetry mode ignores `video` (trace mode only), `screencast.enabled` (live mode only).'
    )
  })

  it('names a trace option set in live mode, the default', () => {
    expect(ignoredOptionsWarning({ tracePolicy: 'retain-on-failure' })).toBe(
      'live mode ignores `tracePolicy` (trace mode only).'
    )
  })

  it('points trace mode at filmstrip and video when screencast.enabled is set', () => {
    expect(
      ignoredOptionsWarning({ screencast: { enabled: true } }, 'trace')
    ).toMatch(
      /^trace mode ignores `screencast\.enabled` .*`filmstrip` and `video` decide recording/
    )
  })

  it('stays silent when every set option applies to the mode', () => {
    expect(
      ignoredOptionsWarning(
        { tracePolicy: 'on', video: 'on', filmstrip: false },
        'trace'
      )
    ).toBeUndefined()
    expect(
      ignoredOptionsWarning({ screencast: { enabled: true } }, 'live')
    ).toBeUndefined()
    expect(ignoredOptionsWarning({}, 'telemetry')).toBeUndefined()
  })
})
