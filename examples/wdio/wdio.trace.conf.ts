import path from 'node:path'
import { browser } from '@wdio/globals'

const __dirname = path.resolve(path.dirname(new URL(import.meta.url).pathname))

export const config: WebdriverIO.Config = {
  runner: 'local',

  specs: ['./features/trace.feature'],

  maxInstances: 1,
  capabilities: [
    {
      browserName: 'chrome',
      'goog:chromeOptions': {
        args: [
          '--headless',
          '--disable-gpu',
          '--remote-allow-origins=*',
          '--window-size=1600,1200',
          '--no-sandbox',
          '--disable-dev-shm-usage'
        ]
      }
    }
  ],

  logLevel: 'warn',

  baseUrl: 'http://localhost',
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,

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
      path.resolve(__dirname, 'features', 'step-definitions', 'trace-steps.ts')
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
    await browser.pause(2000)
  }
}
