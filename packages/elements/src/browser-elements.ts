/**
 * Browser element detection
 * Single browser.execute() call: querySelectorAll → flat interactable element list.
 *
 * The injected script lives in @wdio/devtools-core/element-scripts so it is
 * the single source of truth for both the @wdio/elements wrappers and the
 * framework-agnostic trace/snapshot pipeline.
 */

import type {
  BrowserElementInfo,
  GetBrowserElementsOptions
} from '@wdio/devtools-core/element-types'
import { elementsScript } from '@wdio/devtools-core/element-scripts'

export type { BrowserElementInfo, GetBrowserElementsOptions }

/**
 * Get interactable browser elements via querySelectorAll.
 */
export async function getInteractableBrowserElements(
  browser: WebdriverIO.Browser,
  options: GetBrowserElementsOptions = {}
): Promise<BrowserElementInfo[]> {
  const { includeBounds = false, inViewportOnly = true } = options
  return browser.execute(
    elementsScript(includeBounds, inViewportOnly)
  ) as unknown as Promise<BrowserElementInfo[]>
}
