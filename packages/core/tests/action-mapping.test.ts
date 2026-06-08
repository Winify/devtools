import { describe, it, expect } from 'vitest'
import {
  mapCommandToAction,
  formatActionTitle,
  FILL_METHODS,
  ELEMENT_COMMANDS
} from '../src/action-mapping.js'

describe('mapCommandToAction', () => {
  it('maps known WDIO commands to trace actions', () => {
    expect(mapCommandToAction('click')).toEqual({
      class: 'Element',
      method: 'click'
    })
    expect(mapCommandToAction('url')).toEqual({
      class: 'Page',
      method: 'navigate'
    })
    expect(mapCommandToAction('navigateTo')).toEqual({
      class: 'Page',
      method: 'navigate'
    })
    expect(mapCommandToAction('setValue')).toEqual({
      class: 'Element',
      method: 'fill'
    })
    expect(mapCommandToAction('keys')).toEqual({
      class: 'Keyboard',
      method: 'press'
    })
    expect(mapCommandToAction('execute')).toEqual({
      class: 'Page',
      method: 'evaluate'
    })
    expect(mapCommandToAction('switchToFrame')).toEqual({
      class: 'Frame',
      method: 'goto'
    })
  })

  it('returns null for unknown commands', () => {
    expect(mapCommandToAction('$')).toBeNull()
    expect(mapCommandToAction('$$')).toBeNull()
    expect(mapCommandToAction('getText')).toBeNull()
    expect(mapCommandToAction('pause')).toBeNull()
  })

  it('accepts a custom map without falling through to default', () => {
    const custom = { myCmd: { class: 'Page' as const, method: 'reload' } }
    expect(mapCommandToAction('myCmd', custom)).toEqual({
      class: 'Page',
      method: 'reload'
    })
    // custom map replaces, not extends — unknown commands return null
    expect(mapCommandToAction('click', custom)).toBeNull()
  })
})

describe('formatActionTitle', () => {
  it('formats action with string selector arg', () => {
    const action = { class: 'Element' as const, method: 'click' }
    expect(formatActionTitle(action, ['#submit'])).toBe(
      'Element.click("#submit")'
    )
  })

  it('formats action with params.selector', () => {
    const action = { class: 'Element' as const, method: 'fill' }
    expect(formatActionTitle(action, [], { selector: '#username' })).toBe(
      'Element.fill("#username")'
    )
  })

  it('formats action with no args', () => {
    const action = { class: 'Page' as const, method: 'reload' }
    expect(formatActionTitle(action, [])).toBe('Page.reload()')
  })

  it('truncates long labels to 80 chars', () => {
    const action = { class: 'Element' as const, method: 'click' }
    const long =
      'this-is-a-very-long-selector-that-exceeds-eighty-characters-for-testing-truncation-behavior'
    const title = formatActionTitle(action, [long])
    expect(title.length).toBeLessThanOrEqual(
      'Element.click("'.length + 80 + '")'.length
    )
  })

  it('extracts label from UiAutomator selector', () => {
    const action = { class: 'Element' as const, method: 'click' }
    const title = formatActionTitle(action, [
      'android=new UiSelector().text("Settings")'
    ])
    expect(title).toContain('"Settings"')
  })

  it('extracts label from accessibility-id shorthand', () => {
    const action = { class: 'Element' as const, method: 'tap' }
    const title = formatActionTitle(action, ['~App'])
    expect(title).toContain('"App"')
  })
})

describe('FILL_METHODS', () => {
  it('contains fill and selectOption', () => {
    expect(FILL_METHODS.has('fill')).toBe(true)
    expect(FILL_METHODS.has('selectOption')).toBe(true)
    expect(FILL_METHODS.has('click')).toBe(false)
  })
})

describe('ELEMENT_COMMANDS', () => {
  it('contains WDIO commands that map to Element class', () => {
    expect(ELEMENT_COMMANDS.has('click')).toBe(true)
    expect(ELEMENT_COMMANDS.has('setValue')).toBe(true)
    expect(ELEMENT_COMMANDS.has('doubleClick')).toBe(true)
  })

  it('does not contain Page or Keyboard commands', () => {
    expect(ELEMENT_COMMANDS.has('url')).toBe(false)
    expect(ELEMENT_COMMANDS.has('keys')).toBe(false)
    expect(ELEMENT_COMMANDS.has('execute')).toBe(false)
  })
})
