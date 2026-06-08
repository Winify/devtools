import { Given, When, Then } from '@wdio/cucumber-framework'
import { browser, $ } from '@wdio/globals'

Given(/^I open the page "(.*)"$/, async (url: string) => {
  await browser.url(url)
  await browser.pause(2000)
})

When(/^I type "(.*)" into the username field$/, async (text: string) => {
  const username = await $('#username')
  await username.setValue(text)
})

When(/^I type "(.*)" into the password field$/, async (text: string) => {
  const password = await $('#password')
  await password.setValue(text)
})

When('I click the login button', async () => {
  const button = await $('button[type="submit"]')
  await button.click()
  await browser.pause(1000)
})

Then(/^I should see the login success message$/, async () => {
  const flash = await $('#flash')
  const message = await flash.getText()
  if (!message.includes('You logged into a secure area')) {
    throw new Error(`Expected login success message, got: "${message}"`)
  }
})
