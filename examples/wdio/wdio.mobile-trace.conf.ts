import path from 'node:path'
import { browser } from '@wdio/globals'

const __dirname = path.resolve(path.dirname(new URL(import.meta.url).pathname))

export const config: WebdriverIO.Config = {
  runner: 'local',

  specs: ['./features/mobile-trace.feature'],

  maxInstances: 1,
  capabilities: [
    {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName': 'Android Emulator',
      'appium:appPackage': 'io.appium.android.apis',
      'appium:appActivity': '.ApiDemos'
    }
  ],

  logLevel: 'warn',
  waitforTimeout: 15000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,

  hostname: process.env.APPIUM_HOST || '127.0.0.1',
  port: 4723,
  path: '/',

  services: [
    [
      'devtools',
      {
        captureElements: true,
        disableDebugger: true,
        traceFormat: 'ndjson-directory'
      }
    ]
  ],

  framework: 'cucumber',
  reporters: ['spec'],

  cucumberOpts: {
    require: [
      path.resolve(
        __dirname,
        'features',
        'step-definitions',
        'mobile-trace-steps.ts'
      )
    ],
    backtrace: false,
    requireModule: [],
    dryRun: false,
    failFast: false,
    snippets: true,
    source: true,
    strict: false,
    tagExpression: '',
    timeout: 60000,
    ignoreUndefinedDefinitions: false
  },

  before: async function () {
    await browser.pause(3000)
  }
}
