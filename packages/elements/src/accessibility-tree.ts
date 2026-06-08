/**
 * Browser accessibility tree
 * Single browser.execute() call: DOM walk → flat accessibility node list.
 *
 * The injected script lives in @wdio/devtools-core/element-scripts so it is
 * the single source of truth for both the @wdio/elements wrappers and the
 * framework-agnostic trace/snapshot pipeline.
 */

import type { AccessibilityNode } from '@wdio/devtools-core/element-types'
import { accessibilityTreeScript } from '@wdio/devtools-core/element-scripts'

export type { AccessibilityNode }

/**
 * Get browser accessibility tree via a single DOM walk.
 *
 * @param browser  WebdriverIO browser instance
 * @param options  {@link inViewportOnly} defaults to `true` — only nodes
 *                 whose bounding rect intersects the viewport are included.
 */
export async function getBrowserAccessibilityTree(
  browser: WebdriverIO.Browser,
  options: { inViewportOnly?: boolean } = {}
): Promise<AccessibilityNode[]> {
  const { inViewportOnly = true } = options
  return browser.execute(
    accessibilityTreeScript(inViewportOnly)
  ) as unknown as Promise<AccessibilityNode[]>
}
