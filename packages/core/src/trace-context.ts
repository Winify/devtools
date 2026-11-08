import {
  randomSpanId,
  randomTraceId,
  parseTraceparent,
  TRACE_CONTEXT_ENV,
  TRACE_FLAGS_SAMPLED,
  type ParentTraceContext,
  type TestTraceContext
} from '@wdio/devtools-shared'

let parentCache: { value: ParentTraceContext | undefined } | undefined

/** A new context for one test attempt; a parent contributes the trace it joins. */
export function mintTraceContext(parent?: TestTraceContext): TestTraceContext {
  return {
    traceId: parent?.traceId ?? randomTraceId(),
    spanId: randomSpanId(),
    traceFlags: parent?.traceFlags ?? TRACE_FLAGS_SAMPLED
  }
}

/** The `TRACEPARENT` this process was launched under, read once per process. */
export function resolveParentTraceContext(): ParentTraceContext | undefined {
  parentCache ??= { value: readParentFromEnv() }
  return parentCache.value
}

function readParentFromEnv(): ParentTraceContext | undefined {
  const header = process.env[TRACE_CONTEXT_ENV.TRACEPARENT]
  if (!header) {
    return undefined
  }
  const parent = parseTraceparent(header)
  if (parent === undefined) {
    process.emitWarning(
      `Ignoring invalid ${TRACE_CONTEXT_ENV.TRACEPARENT}; expected a W3C traceparent.`,
      'DevToolsTraceContext'
    )
    return undefined
  }
  const traceState = process.env[TRACE_CONTEXT_ENV.TRACESTATE]
  return traceState ? { ...parent, traceState } : parent
}
