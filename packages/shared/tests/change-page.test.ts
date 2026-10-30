import { describe, it, expect } from 'vitest'
import {
  ACTION_MAP,
  METHOD_EFFECT,
  changesPage,
  skipsCapture
} from '@wdio/devtools-shared'

describe('changesPage', () => {
  it.each([
    'click',
    'setValue',
    'url',
    'execute',
    'keys',
    'sendKeys',
    'switchToWindow'
  ])('is true for %s', (command) => {
    expect(changesPage(command)).toBe(true)
  })

  it.each([
    'getText',
    'isDisplayed',
    'waitForDisplayed',
    'waitUntil',
    'getTitle',
    'waitForElementVisible',
    'expect.toHaveText',
    'assert.equal',
    'findElement',
    'constructor'
  ])('is false for %s', (command) => {
    expect(changesPage(command)).toBe(false)
  })

  it('classifies the method of every ACTION_MAP entry', () => {
    for (const { method } of Object.values(ACTION_MAP)) {
      expect(Object.keys(METHOD_EFFECT)).toContain(method)
    }
  })
})

describe('skipsCapture', () => {
  it.each([
    'getText',
    'waitForDisplayed',
    'findElement',
    'getCurrentUrl',
    'assert.equal',
    'expect.toHaveText',
    'getElementText',
    'w3cGetCurrentWindowHandle',
    'getElementAriaRole',
    'isVisible',
    'title',
    'getDomAttribute'
  ])('is true for %s', (command) => {
    expect(skipsCapture(command)).toBe(true)
  })

  it.each([
    'click',
    'executeScript',
    'actions',
    'submitForm',
    'acceptAlert',
    'w3cExecuteScript',
    'someUnknownCommand'
  ])('is false for %s', (command) => {
    expect(skipsCapture(command)).toBe(false)
  })
})
