import { Given, When, Then } from '@wdio/cucumber-framework'
import { browser, $ } from '@wdio/globals'

Given('the ApiDemos app is open', async () => {
  // App is launched via desired capabilities — just wait for it to settle
  await browser.pause(2000)
})

When(/^I tap on "(.*)"$/, async (label: string) => {
  const el = await $(`~${label}`)
  await el.click()
  await browser.pause(1000)
})

Then('the trace should capture element snapshots for each action', async () => {
  // The trace validation happens externally — we just need the test to complete
  // so the service's after() hook writes the trace directory.
  const activity = await browser.getCurrentActivity()
  console.log(`[mobile-trace] Current activity: ${activity}`)
})
