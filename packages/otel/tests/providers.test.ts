import { describe, expect, it } from 'vitest'
import { InMemorySpanExporter, TracerProvider } from '@opentelemetry/sdk-trace'
import { batchedProcessors } from '../src/providers.js'

const RECORDS = 5000

describe('one flush per push', () => {
  it('exports every span emitted before it', async () => {
    const spans = new InMemorySpanExporter()
    const tracerProvider = new TracerProvider({
      spanProcessors: [batchedProcessors(spans)]
    })
    const tracer = tracerProvider.getTracer('t')
    for (let i = 0; i < RECORDS; i++) {
      tracer.startSpan(`s${i}`).end()
    }
    await tracerProvider.forceFlush()
    expect(spans.getFinishedSpans()).toHaveLength(RECORDS)
  })
})
