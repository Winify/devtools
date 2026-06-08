import { describe, it, expect } from 'vitest'
import {
  accessibilityTreeScript,
  elementsScript
} from '../src/element-scripts.js'

describe('accessibilityTreeScript', () => {
  it('returns a string containing a self-invoking function', () => {
    const script = accessibilityTreeScript(true)
    expect(script).toContain('(function () {')
    expect(script).toContain('})()')
  })

  it('inlines inViewportOnly=true as a boolean literal', () => {
    const script = accessibilityTreeScript(true)
    expect(script).toContain('if (true && !inViewport)')
  })

  it('inlines inViewportOnly=false as a boolean literal', () => {
    const script = accessibilityTreeScript(false)
    expect(script).toContain('if (false && !inViewport)')
  })

  it('contains essential role-classification logic', () => {
    const script = accessibilityTreeScript(false)
    expect(script).toContain('INPUT_TYPE_ROLES')
    expect(script).toContain('CONTAINER_ROLES')
    expect(script).toContain('function getRole(el)')
    expect(script).toContain('function getAccessibleName(el, role)')
    expect(script).toContain('function getSelector(element)')
    expect(script).toContain("case 'button': return 'button'")
    expect(script).toContain(
      "case 'a': return el.hasAttribute('href') ? 'link' : null"
    )
  })

  it('contains viewport and visibility helpers', () => {
    const script = accessibilityTreeScript(false)
    expect(script).toContain('function isVisible(el)')
    expect(script).toContain('function isInViewport(el)')
    expect(script).toContain('checkVisibility')
  })

  it('walks from document.body.children', () => {
    const script = accessibilityTreeScript(false)
    expect(script).toContain('document.body.children')
  })
})

describe('elementsScript', () => {
  it('returns a string containing a self-invoking function', () => {
    const script = elementsScript(false, true)
    expect(script).toContain('(function () {')
    expect(script).toContain('})()')
  })

  it('inlines inViewportOnly=true as boolean literal', () => {
    const script = elementsScript(false, true)
    expect(script).toContain('if (true && !isInVp)')
  })

  it('inlines inViewportOnly=false as boolean literal', () => {
    const script = elementsScript(false, false)
    expect(script).toContain('if (false && !isInVp)')
  })

  it('includes boundingBox injection when includeBounds=true', () => {
    const script = elementsScript(true, false)
    expect(script).toContain('boundingBox')
    expect(script).toContain('window.scrollX')
    expect(script).toContain('window.scrollY')
  })

  it('omits boundingBox when includeBounds=false', () => {
    const script = elementsScript(false, false)
    expect(script).not.toContain('boundingBox')
  })

  it('contains interactable selector list', () => {
    const script = elementsScript(false, false)
    expect(script).toContain('a[href]')
    expect(script).toContain('[role="button"]')
    expect(script).toContain('[contenteditable="true"]')
  })

  it('contains visibility and selector helpers', () => {
    const script = elementsScript(false, false)
    expect(script).toContain('function isVisible(element)')
    expect(script).toContain('function getAccessibleName(el)')
    expect(script).toContain('function getSelector(element)')
  })

  it('deduplicates with a seen Set', () => {
    const script = elementsScript(false, false)
    expect(script).toContain('var seen = new Set()')
    expect(script).toContain('seen.has(el)')
  })
})
