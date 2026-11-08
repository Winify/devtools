import { createHash } from 'node:crypto'
import type { IdGenerator } from '@opentelemetry/sdk-trace'
import {
  isSpanId,
  randomSpanId,
  randomTraceId,
  SPAN_ID_BYTES
} from '@wdio/devtools-shared'

export interface PinnedSpanIds {
  traceId?: string
  spanId: string
}

/** Held until the caller clears it, since the SDK asks for a span id before it knows the parent. */
export class PinnedIdGenerator implements IdGenerator {
  #pinned: PinnedSpanIds | undefined

  pin(ids: PinnedSpanIds | undefined): void {
    this.#pinned = ids
  }

  generateTraceId(): string {
    return this.#pinned?.traceId ?? randomTraceId()
  }

  generateSpanId(): string {
    return this.#pinned?.spanId ?? randomSpanId()
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
