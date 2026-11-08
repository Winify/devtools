---
'@wdio/devtools-otel': minor
---

New `devtools-otel` CLI pushes the tests listed in devtools artifacts manifests to an OpenTelemetry collector (the WebdriverIO, Selenium and Nightwatch adapters write one in `mode: 'telemetry'`, or in trace mode with `emitArtifactsManifest: true`; WebdriverIO also when `@wdio/allure-reporter` is configured and Selenium when an allure-js-commons runtime is active) as spans: a root span per test attempt (carrying its status, duration and failure) and, where its trace zip was retained, child spans for its actions. Manifests recorded under a retain policy are pushed in full, with the dropped zips left unlinked. See the package README.
