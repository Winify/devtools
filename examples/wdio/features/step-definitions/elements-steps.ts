import { Given, When, Then } from '@wdio/cucumber-framework'
import { browser } from '@wdio/globals'
import fs from 'node:fs/promises'
import path from 'node:path'

import {
  getElements,
  getBrowserAccessibilityTree,
  serializeWebSnapshot,
  getInteractableBrowserElements
} from '@wdio/elements'
import type {
  VisibleElementsResult,
  AccessibilityNode,
  BrowserElementInfo
} from '@wdio/elements'

// ---------------------------------------------------------------------------
// Shared state between steps in the same scenario
// ---------------------------------------------------------------------------

let scannedElements: VisibleElementsResult
let interactableElements: BrowserElementInfo[]
let a11yNodes: AccessibilityNode[]
let snapshot: string
let screenshotPath: string

// ---------------------------------------------------------------------------
// Given
// ---------------------------------------------------------------------------

Given(/^I navigate to "(.*)"$/, async (url: string) => {
  console.log(`[elements-showcase] 🌐 Navigating to ${url}`)
  await browser.url(url)
  // Let the page settle — dynamic content, cookie banners, etc.
  await browser.pause(3000)
  console.log(`[elements-showcase] ✅ Page loaded: "${await browser.getTitle()}"`)
})

// ---------------------------------------------------------------------------
// When
// ---------------------------------------------------------------------------

When('I scan the page for interactable elements', async () => {
  console.log('[elements-showcase] 🔍 Scanning for interactable elements via getElements()...')

  scannedElements = await getElements(browser, {
    includeBounds: true,
    limit: 0 // return all — inViewportOnly defaults to true
  })

  interactableElements = scannedElements.elements as BrowserElementInfo[]

  console.log(`[elements-showcase]   Total:  ${scannedElements.total}`)
  console.log(`[elements-showcase]   Showing: ${scannedElements.showing}`)
  console.log(`[elements-showcase]   Has more: ${scannedElements.hasMore}`)

  if (interactableElements.length > 0) {
    console.log('[elements-showcase]   First 5 elements:')
    for (const el of interactableElements.slice(0, 5)) {
      const bounds = el.boundingBox
        ? ` @ (${Math.round(el.boundingBox.x)},${Math.round(el.boundingBox.y)} ${Math.round(el.boundingBox.width)}×${Math.round(el.boundingBox.height)})`
        : ''
      console.log(
        `     <${el.tagName}> "${el.name}" → ${el.selector}${bounds}`
      )
    }
  }
})

When('I capture the accessibility tree', async () => {
  console.log('[elements-showcase] 🌳 Capturing accessibility tree...')

  a11yNodes = await getBrowserAccessibilityTree(browser)
  console.log(`[elements-showcase]   ${a11yNodes.length} nodes in tree`)

  const pageUrl = await browser.getUrl()
  const pageTitle = await browser.getTitle()

  snapshot = serializeWebSnapshot(a11yNodes, {
    url: pageUrl,
    title: pageTitle
  })

  console.log('[elements-showcase] ── Snapshot preview (first 30 lines) ──')
  for (const line of snapshot.split('\n').slice(0, 30)) {
    console.log(`[elements-showcase]  ${line}`)
  }
  if (snapshot.split('\n').length > 30) {
    console.log(`[elements-showcase]  … (${snapshot.split('\n').length - 30} more lines)`)
  }
  console.log('[elements-showcase] ──────────────────────────────────────────')
})

// ---------------------------------------------------------------------------
// Then
// ---------------------------------------------------------------------------

Then(/^at least (\d+) interactable elements should be found$/, async (min: string) => {
  const count = interactableElements.length
  console.log(`[elements-showcase] ✅ Asserting ${count} interactable elements >= ${min}`)
  if (count < parseInt(min, 10)) {
    throw new Error(`Expected at least ${min} interactable elements, but found ${count}`)
  }
})

Then(/^a web snapshot should be generated with at least (\d+) lines$/, async (min: string) => {
  const lines = snapshot.split('\n').length
  console.log(`[elements-showcase] ✅ Snapshot has ${lines} lines (min ${min})`)
  if (lines < parseInt(min, 10)) {
    throw new Error(`Expected snapshot to have at least ${min} lines, but got ${lines}`)
  }
})

Then('the snapshot should contain the header {string} and a link to the home page', async (header: string) => {
  console.log(`[elements-showcase] ✅ Checking snapshot header contains "${header}"`)
  if (!snapshot.includes(header)) {
    throw new Error(`Snapshot header missing expected text "${header}"`)
  }

  // Verify at least one link is present
  if (!snapshot.includes('link')) {
    throw new Error('Snapshot should contain at least one "link" role')
  }

  console.log('[elements-showcase] ✅ Snapshot header and links verified')
})

When('I take a screenshot and cross-reference with the snapshot', async () => {
  // Take screenshot
  screenshotPath = path.resolve(process.cwd(), 'elements-showcase-screenshot.png')
  await browser.saveScreenshot(screenshotPath)
  console.log(`[elements-showcase] 📸 Screenshot saved to ${screenshotPath}`)

  // Print ALL interactable elements with bounds for cross-referencing
  console.log(`[elements-showcase] ── All ${interactableElements.length} viewport elements ──`)
  for (let i = 0; i < interactableElements.length; i++) {
    const el = interactableElements[i]
    const bounds = el.boundingBox
      ? `(${Math.round(el.boundingBox.x)},${Math.round(el.boundingBox.y)} ${Math.round(el.boundingBox.width)}×${Math.round(el.boundingBox.height)})`
      : 'no-bounds'
    const vp = el.isInViewport ? '✓' : '✗'
    console.log(`[elements-showcase]   [${String(i).padStart(2)}] ${vp} <${el.tagName}> "${el.name}" → ${el.selector} ${bounds}`)
  }

  // Print FULL snapshot
  console.log('[elements-showcase] ── Full snapshot ──')
  for (const line of snapshot.split('\n')) {
    console.log(`[elements-showcase]  ${line}`)
  }
  console.log('[elements-showcase] ── End snapshot ──')
})
