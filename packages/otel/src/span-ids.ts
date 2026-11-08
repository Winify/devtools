import { createHash, randomBytes } from 'node:crypto'
import type { IdGenerator } from '@opentelemetry/sdk-trace'
import {
  isSpanId,
  isTraceId,
  SPAN_ID_BYTES,
  TRACE_ID_BYTES
} from '@wdio/devtools-shared'

export interface PinnedSpanIds {
  traceId?: string
  spanId: string
}

function randomId(bytes: number, isValid: (hex: string) => boolean): string {
  let hex: string
  do {
    hex = randomBytes(bytes).toString('hex')
  } while (!isValid(hex))
  return hex
}

/** Held until the caller clears it, since the SDK asks for a span id before it knows the parent. */
export class PinnedIdGenerator implements IdGenerator {
  #pinned: PinnedSpanIds | undefined

  pin(ids: PinnedSpanIds | undefined): void {
    this.#pinned = ids
  }

  generateTraceId(): string {
    return this.#pinned?.traceId ?? randomId(TRACE_ID_BYTES, isTraceId)
  }

  generateSpanId(): string {
    return this.#pinned?.spanId ?? randomId(SPAN_ID_BYTES, isSpanId)
  }
}

/** A child span's id is a function of its root's id, so re-pushing a manifest mints the same ids. */
export function derivedSpanId(rootSpanId: string, key: string): string {
  const digest = createHash('sha256')
    .update(`${rootSpanId}:${key}`)
    .digest('hex')
  const id = digest.slice(0, SPAN_ID_BYTES * 2)
  return isSpanId(id) ? id : `${digest.slice(0, SPAN_ID_BYTES * 2 - 1)}1`
}
