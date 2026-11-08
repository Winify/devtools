import { describe, expect, it } from 'vitest'
import { ROOT_CONTEXT, TraceFlags, trace } from '@opentelemetry/api'
import {
  InMemorySpanExporter,
  TracerProvider,
  type SpanExporter
} from '@opentelemetry/sdk-trace'
import {
  batchedProcessors,
  recordingFailures,
  telemetryWith
} from '../src/providers.js'

const RECORDS = 5000
// ExportResultCode.FAILED; @opentelemetry/core is not a dependency of this package.
const EXPORT_FAILED = 1

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

describe('telemetry wiring', () => {
  const unsampledParent = trace.setSpanContext(ROOT_CONTEXT, {
    traceId: '0af7651916cd43dd8448eb211c80319c',
    spanId: 'b7ad6b7169203331',
    traceFlags: TraceFlags.NONE,
    isRemote: true
  })

  it('exports a span whose TRACEPARENT parent is not sampled', async () => {
    const spans = new InMemorySpanExporter()
    const telemetry = telemetryWith(batchedProcessors(spans), [])
    telemetry.tracer.startSpan('child', {}, unsampledParent).end()
    await telemetry.flush()
    expect(spans.getFinishedSpans().map((span) => span.name)).toEqual(['child'])
  })

  it('rejects the flush when the collector refused an export', async () => {
    const refusing: SpanExporter = {
      export: (_spans, done) =>
        done({ code: EXPORT_FAILED, error: new Error('refused') }),
      shutdown: async () => {}
    }
    const failures: Error[] = []
    const telemetry = telemetryWith(
      batchedProcessors(recordingFailures(refusing, failures)),
      failures
    )
    telemetry.tracer.startSpan('s').end()
    await expect(telemetry.flush()).rejects.toThrow('refused')
  })
})
