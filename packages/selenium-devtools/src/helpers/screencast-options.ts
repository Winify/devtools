import { SCREENCAST_DEFAULTS, startsBackend } from '@wdio/devtools-shared'
import type { DevToolsOptions, ScreencastOptions } from '../types.js'

/** Outside live mode `enabled` is the one field that does not apply (filmstrip and video decide recording); the tuning fields still do. */
export function screencastFor(
  base: ScreencastOptions,
  user: ScreencastOptions | undefined,
  mode: DevToolsOptions['mode']
): ScreencastOptions {
  const merged = { ...base, ...(user ?? {}) }
  return startsBackend(mode)
    ? merged
    : { ...merged, enabled: SCREENCAST_DEFAULTS.enabled }
}
