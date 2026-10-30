import logger from '@wdio/logger'
import {
  errorMessage,
  finalFrameStamp,
  supersedeSnapshotAt
} from '@wdio/devtools-core'
import { captureActionSnapshot } from '../action-snapshot.js'
import type { SessionLifecycleCtx } from '../session-lifecycle.js'

const log = logger('@wdio/selenium-devtools:finalFrame')

/** Rows after the test's last capture saw a state nothing captured; one more capture, stamped at that capture, shows the test's end. */
export async function captureFinalFrame(
  ctx: SessionLifecycleCtx
): Promise<void> {
  const capturer = ctx.sessionCapturer
  if (
    ctx.options.mode !== 'trace' ||
    ctx.finalized ||
    !ctx.driver ||
    !capturer
  ) {
    return
  }
  await Promise.all(ctx.snapshotCaptures)
  const stamp = finalFrameStamp(
    capturer.commandsLog,
    capturer.testStartWallTime,
    capturer.lastCapturedTimestamp
  )
  if (!stamp) {
    return
  }
  try {
    const snap = await captureActionSnapshot(
      ctx.driver,
      stamp.command,
      stamp.timestamp,
      capturer.isNativeAppSession
    )
    if (snap) {
      supersedeSnapshotAt(ctx.actionSnapshots, snap)
    }
  } catch (err) {
    log.debug(`End-of-test frame capture failed: ${errorMessage(err)}`)
  }
}
