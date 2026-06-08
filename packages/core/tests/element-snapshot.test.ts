import { describe, it, expect } from 'vitest'
import {
  serializeWebSnapshot,
  serializeMobileSnapshot
} from '../src/element-snapshot.js'
import type { AccessibilityNode } from '../src/element-types.js'
import type { JSONElement } from '../src/locators/types.js'

function a11yNode(
  overrides: Partial<AccessibilityNode> & { role: string; depth: number }
): AccessibilityNode {
  return {
    name: '',
    selector: '',
    level: '',
    disabled: '',
    checked: '',
    expanded: '',
    selected: '',
    pressed: '',
    required: '',
    readonly: '',
    ...overrides
  }
}

describe('serializeWebSnapshot', () => {
  it('produces a bare [Page] header with no nodes or context', () => {
    expect(serializeWebSnapshot([])).toBe('[Page]')
  })

  it('includes title and url in the header', () => {
    const out = serializeWebSnapshot([], {
      title: 'My Page',
      url: 'https://example.com'
    })
    expect(out.startsWith('[Page: My Page — https://example.com]')).toBe(true)
  })

  it('indents nodes relative to the header', () => {
    const nodes = [a11yNode({ role: 'navigation', depth: 0, name: 'Main' })]
    const out = serializeWebSnapshot(nodes)
    expect(out).toContain('  navigation "Main"')
  })

  it('renders interactive node with selector and name', () => {
    const nodes = [
      a11yNode({ role: 'button', depth: 0, name: 'Login', selector: '#login' })
    ]
    const out = serializeWebSnapshot(nodes)
    expect(out).toContain('button "Login"  →  #login')
  })

  it('skips nodes filtered by inViewportOnly when isInViewport=false', () => {
    const nodes = [
      a11yNode({
        role: 'button',
        depth: 0,
        name: 'Hidden',
        selector: '#btn',
        isInViewport: false
      })
    ]
    // default inViewportOnly=true
    const out = serializeWebSnapshot(nodes)
    expect(out).not.toContain('#btn')
  })

  it('includes off-screen nodes when inViewportOnly is explicitly false', () => {
    const nodes = [
      a11yNode({
        role: 'button',
        depth: 0,
        name: 'Off',
        selector: '#btn',
        isInViewport: false
      })
    ]
    const out = serializeWebSnapshot(nodes, undefined, {
      inViewportOnly: false
    })
    expect(out).toContain('#btn')
  })
})

describe('serializeMobileSnapshot', () => {
  function androidRoot(children: JSONElement[] = []): JSONElement {
    return {
      tagName: 'android.widget.FrameLayout',
      path: '/0',
      attributes: {
        index: '0',
        class: 'android.widget.FrameLayout',
        package: 'com.example',
        'content-desc': '',
        'resource-id': '',
        text: '',
        checkable: 'false',
        checked: 'false',
        clickable: 'false',
        enabled: 'true',
        focusable: 'false',
        focused: 'false',
        scrollable: 'false',
        'long-clickable': 'false',
        password: 'false',
        selected: 'false',
        bounds: '[0,0][1080,1920]',
        displayed: 'true'
      },
      children
    }
  }

  it('produces an android header', () => {
    const out = serializeMobileSnapshot(androidRoot(), {
      platform: 'android',
      deviceName: 'Pixel 6',
      viewport: { width: 1080, height: 1920 }
    })
    expect(out.startsWith('[android — Pixel 6 (1080×1920)]')).toBe(true)
  })

  it('produces an ios header', () => {
    const out = serializeMobileSnapshot(
      {
        tagName: 'XCUIElementTypeApplication',
        path: '/0',
        attributes: {
          index: '0',
          type: 'XCUIElementTypeApplication',
          name: '',
          label: '',
          enabled: 'true',
          visible: 'true',
          accessible: 'false',
          x: '0',
          y: '0',
          width: '390',
          height: '844'
        },
        children: []
      },
      { platform: 'ios' }
    )
    expect(out.startsWith('[ios]')).toBe(true)
  })

  it('maps android button class to semantic role', () => {
    const button: JSONElement = {
      tagName: 'android.widget.Button',
      path: '/0/1',
      attributes: {
        index: '1',
        class: 'android.widget.Button',
        package: 'com.example',
        'content-desc': '',
        'resource-id': 'com.example:id/ok',
        text: 'OK',
        checkable: 'false',
        checked: 'false',
        clickable: 'true',
        enabled: 'true',
        focusable: 'true',
        focused: 'false',
        scrollable: 'false',
        'long-clickable': 'false',
        password: 'false',
        selected: 'false',
        bounds: '[0,100][200,200]',
        displayed: 'true'
      },
      children: []
    }
    const out = serializeMobileSnapshot(androidRoot([button]), {
      platform: 'android',
      viewport: { width: 1080, height: 1920 }
    })
    expect(out).toContain('button "OK"')
  })

  it('uses id: prefix for resource-id based locator', () => {
    const button: JSONElement = {
      tagName: 'android.widget.Button',
      path: '/0/1',
      attributes: {
        index: '1',
        class: 'android.widget.Button',
        package: 'com.example',
        'content-desc': '',
        'resource-id': 'com.example:id/submit',
        text: '',
        checkable: 'false',
        checked: 'false',
        clickable: 'true',
        enabled: 'true',
        focusable: 'true',
        focused: 'false',
        scrollable: 'false',
        'long-clickable': 'false',
        password: 'false',
        selected: 'false',
        bounds: '[0,100][200,200]',
        displayed: 'true'
      },
      children: []
    }
    const out = serializeMobileSnapshot(androidRoot([button]), {
      platform: 'android',
      viewport: { width: 1080, height: 1920 }
    })
    expect(out).toContain('id:com.example:id/submit')
  })
})
