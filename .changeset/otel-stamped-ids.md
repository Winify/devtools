---
'@wdio/devtools-otel': minor
---

`devtools-otel push` pushes each test attempt as a root span with the trace and span ids the run recorded when the attempt started, so a re-push produces the same spans and a `TRACEPARENT` set on the run makes every attempt a child of the CI span. Trace zips are read only with `--trace-zips` (a missing zip warns and skips that test's actions). Spans are the only signal pushed. Manifests recorded under a retain policy are pushed in full; their dropped zips are not linked. The run id defaults to the manifests' `runId`.
