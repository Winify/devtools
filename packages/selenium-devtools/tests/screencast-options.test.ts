import { describe, expect, it } from 'vitest'
import { SCREENCAST_DEFAULTS } from '@wdio/devtools-shared'
import { screencastFor } from '../src/helpers/screencast-options.js'

describe('screencastFor', () => {
  it('keeps the tuning fields outside live mode and drops only enabled', () => {
    expect(
      screencastFor(
        { ...SCREENCAST_DEFAULTS },
        { enabled: true, quality: 40, pollIntervalMs: 500 },
        'trace'
      )
    ).toEqual({
      ...SCREENCAST_DEFAULTS,
      quality: 40,
      pollIntervalMs: 500,
      enabled: false
    })
  })

  it('applies every field in live mode', () => {
    expect(
      screencastFor({ ...SCREENCAST_DEFAULTS }, { enabled: true }, 'live')
    ).toEqual({ ...SCREENCAST_DEFAULTS, enabled: true })
  })
})
