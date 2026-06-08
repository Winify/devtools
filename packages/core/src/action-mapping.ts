/**
 * WDIO command → Playwright-compatible trace action mapping.
 *
 * Maps WebdriverIO command names to the class+method pairs used in
 * Playwright v8 trace before/after events. Framework-agnostic consumers
 * (transcript generator, trace viewer) use the mapped names.
 *
 * Other adapters (nightwatch, selenium) can provide their own maps.
 */

export interface TraceAction {
  class: 'Page' | 'Element' | 'Keyboard' | 'Mouse' | 'Frame'
  method: string
}

const ACTION_MAP: Record<string, TraceAction> = {
  url: { class: 'Page', method: 'navigate' },
  navigateTo: { class: 'Page', method: 'navigate' },
  back: { class: 'Page', method: 'goBack' },
  forward: { class: 'Page', method: 'goForward' },
  refresh: { class: 'Page', method: 'reload' },
  newWindow: { class: 'Page', method: 'goto' },
  click: { class: 'Element', method: 'click' },
  doubleClick: { class: 'Element', method: 'dblclick' },
  setValue: { class: 'Element', method: 'fill' },
  selectByVisibleText: { class: 'Element', method: 'selectOption' },
  selectByAttribute: { class: 'Element', method: 'selectOption' },
  selectByIndex: { class: 'Element', method: 'selectOption' },
  moveTo: { class: 'Element', method: 'hover' },
  scrollIntoView: { class: 'Element', method: 'scrollIntoViewIfNeeded' },
  dragAndDrop: { class: 'Element', method: 'dragTo' },
  keys: { class: 'Keyboard', method: 'press' },
  execute: { class: 'Page', method: 'evaluate' },
  executeAsync: { class: 'Page', method: 'evaluate' },
  executeScript: { class: 'Page', method: 'evaluate' },
  switchToFrame: { class: 'Frame', method: 'goto' },
  switchToParentFrame: { class: 'Frame', method: 'goto' },
  touchAction: { class: 'Element', method: 'tap' },
  action: { class: 'Mouse', method: 'tap' },
  clearValue: { class: 'Element', method: 'fill' },
  addValue: { class: 'Element', method: 'fill' },
  waitForExist: { class: 'Element', method: 'waitForElement' },
  waitForDisplayed: { class: 'Element', method: 'waitForElement' },
  waitForEnabled: { class: 'Element', method: 'waitForElement' },
  waitForClickable: { class: 'Element', method: 'waitForElement' }
}

/**
 * Look up the trace action for a WDIO command name.
 * Returns null for commands that should not appear in the trace
 * (internal commands, injection, etc.).
 */
export function mapCommandToAction(
  command: string,
  map?: Record<string, TraceAction>
): TraceAction | null {
  return (map ?? ACTION_MAP)[command] ?? null
}

/**
 * Extract a human-readable label from a selector string.
 * Mirrors the MCP's extractSelectorLabel in tool-mapping.ts.
 */
function extractSelectorLabel(selector: string): string {
  // UiAutomator: android=new UiSelector().text("Label")
  const uia = selector.match(
    /\.(?:text|description|textContains)\("([^"]+)"\)/
  )
  if (uia) return uia[1]

  // Accessibility ID: ~label
  if (selector.startsWith('~')) return selector.slice(1)

  // iOS predicate: label == "X" or name == "X"
  const pred = selector.match(/(?:label|name|value)\s*==\s*"([^"]+)"/)
  if (pred) return pred[1]

  // XPath attribute: [@text="X"] [@label="X"]
  const xp = selector.match(
    /@(?:text|label|name|content-desc)="([^"]+)"/
  )
  if (xp) return xp[1]

  // CSS: tag*=Text → "Text"
  const cssText = selector.match(/\*="([^"]+)"/)
  if (cssText) return cssText[1]

  // CSS: #id → "id"
  const cssId = selector.match(/^#([\w-]+)/)
  if (cssId) return `#${cssId[1]}`

  // CSS: [attr="value"]
  const cssAttr = selector.match(/\[(\w+)="([^"]+)"\]/)
  if (cssAttr) return cssAttr[2]

  return selector
}

/**
 * Format a human-readable action title for transcript and trace display.
 */
export function formatActionTitle(
  action: TraceAction,
  args: unknown[],
  params?: Record<string, unknown>
): string {
  // Prefer an explicit selector param, then the first positional arg
  const raw = params?.selector ?? args[0]
  if (raw === undefined) {
    return `${action.class}.${action.method}()`
  }
  const label = extractSelectorLabel(
    typeof raw === 'object' ? JSON.stringify(raw) : String(raw)
  ).slice(0, 80)
  return `${action.class}.${action.method}("${label}")`
}

/**
 * Methods where the first positional argument should render as value= in the
 * transcript line (e.g. setValue, selectByVisibleText).
 */
export const FILL_METHODS = new Set(['fill', 'selectOption'])

/**
 * Element-scoped commands — these carry a selector on the element, not in args.
 */
export const ELEMENT_COMMANDS = new Set(
  Object.entries(ACTION_MAP)
    .filter(([, a]) => a.class === 'Element')
    .map(([cmd]) => cmd)
)
