import { describe, expect, it } from 'vitest'
import type { TestAttemptRecord } from '@wdio/devtools-shared'
import { traceArtifactsByUid } from '../src/artifact-sources.js'
import type {
  Manifest,
  ManifestArtifact,
  ManifestTest
} from '../src/manifest.js'

const UID = 'uid-login'
const TRACE_ID = '0af7651916cd43dd8448eb211c80319c'
const SPAN_ID = 'b7ad6b7169203331'

function traceZip(path: string, key?: string): ManifestArtifact {
  return { kind: 'trace', path, key, testUids: [UID], retained: true }
}

function record(attempt: number, final?: boolean): TestAttemptRecord {
  return { attempt, startTime: 0, traceId: TRACE_ID, spanId: SPAN_ID, final }
}

function manifestOf(
  artifacts: ManifestArtifact[],
  test: Partial<ManifestTest> & Pick<ManifestTest, 'attempt'>
): Manifest {
  return {
    sessionId: 's1',
    artifacts,
    tests: [
      {
        uid: UID,
        title: 'logs in',
        specFile: 'specs/login.spec.ts',
        state: 'failed',
        ...test
      }
    ]
  }
}

function linkedPath(manifest: Manifest): string | undefined {
  return traceArtifactsByUid(manifest).get(UID)?.path
}

describe('traceArtifactsByUid', () => {
  it('links the zip whose key is the test attempt exactly', () => {
    const manifest = manifestOf(
      [
        traceZip('traces/login.zip', UID),
        traceZip('traces/login-retry1.zip', `${UID}-retry1`)
      ],
      { attempt: 1 }
    )
    expect(linkedPath(manifest)).toBe('traces/login-retry1.zip')
  })

  it('links a specFileRetries zip keyed by the bare uid when the final record is attempt 0', () => {
    const manifest = manifestOf([traceZip('traces/login.zip', UID)], {
      attempt: 1,
      attempts: [record(0, true)]
    })
    expect(linkedPath(manifest)).toBe('traces/login.zip')
  })

  it('links nothing for an in-process retry whose final record has no zip', () => {
    const manifest = manifestOf([traceZip('traces/login.zip', UID)], {
      attempt: 1,
      attempts: [record(0), record(1, true)]
    })
    expect(linkedPath(manifest)).toBeUndefined()
  })

  it('links the final record zip when in-process retries each have one', () => {
    const manifest = manifestOf(
      [
        traceZip('traces/login.zip', UID),
        traceZip('traces/login-retry1.zip', `${UID}-retry1`)
      ],
      { attempt: 1, attempts: [record(0), record(1, true)] }
    )
    expect(linkedPath(manifest)).toBe('traces/login-retry1.zip')
  })
})
