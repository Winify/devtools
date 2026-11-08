import {
  AlwaysOnSampler,
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SimpleSpanProcessor,
  TracerProvider,
  type ReadableSpan,
  type SpanExporter
} from '@opentelemetry/sdk-trace'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import {
  detectResources,
  envDetector,
  resourceFromAttributes
} from '@opentelemetry/resources'
import type { Tracer } from '@opentelemetry/api'
import { PinnedIdGenerator } from './span-ids.js'

const SCOPE_NAME = '@wdio/devtools-otel'
const DEFAULT_SERVICE_NAME = 'devtools-tests'
const EXPORT_SUCCESS_CODE = 0

// A push emits the whole run synchronously and flushes once, so a bounded queue (2048 by default) silently drops the overflow.
const BATCH_LIMITS = { maxQueueSize: Number.MAX_SAFE_INTEGER }

export function batchedProcessors(
  spanExporter: SpanExporter
): BatchSpanProcessor {
  return new BatchSpanProcessor({ exporter: spanExporter, ...BATCH_LIMITS })
}

/**
 * The batch processor discards a failed export, so the exporter records its
 * failure for `flush` to rethrow, which is what makes the CLI exit non-zero.
 */
class FailureRecordingTraceExporter extends OTLPTraceExporter {
  constructor(private readonly failures: Error[]) {
    super()
  }

  override export(
    spans: ReadableSpan[],
    done: Parameters<OTLPTraceExporter['export']>[1]
  ): void {
    super.export(spans, (result) => {
      if (result.code !== EXPORT_SUCCESS_CODE) {
        this.failures.push(
          result.error ?? new Error('OTLP trace export failed')
        )
      }
      done(result)
    })
  }
}

export interface Telemetry {
  tracer: Tracer
  ids: PinnedIdGenerator
  flush(): Promise<void>
  shutdown(): Promise<void>
}

export function createTelemetry(options: { dryRun: boolean }): Telemetry {
  const failures: Error[] = []
  const resource = resourceFromAttributes({
    'service.name': DEFAULT_SERVICE_NAME
  }).merge(detectResources({ detectors: [envDetector] }))
  const ids = new PinnedIdGenerator()
  // A remote parent with the sampled flag unset would otherwise drop every span.
  const tracerProvider = new TracerProvider({
    resource,
    sampler: new AlwaysOnSampler(),
    idGenerator: ids,
    spanProcessors: [
      options.dryRun
        ? new SimpleSpanProcessor({ exporter: new ConsoleSpanExporter() })
        : batchedProcessors(new FailureRecordingTraceExporter(failures))
    ]
  })
  return {
    tracer: tracerProvider.getTracer(SCOPE_NAME),
    ids,
    async flush() {
      await tracerProvider.forceFlush()
      const [first] = failures
      if (first) {
        throw first
      }
    },
    async shutdown() {
      await tracerProvider.shutdown()
    }
  }
}
