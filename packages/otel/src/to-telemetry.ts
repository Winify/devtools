import path from 'node:path'
import {
  ROOT_CONTEXT,
  createTraceState,
  trace,
  type Context
} from '@opentelemetry/api'
import {
  effectiveFailure,
  retriedRows,
  type CommandLog,
  type TraceActionChild,
  type TracePlayerData
} from '@wdio/devtools-shared'
import * as attr from './attributes.js'
import {
  artifactUrlFor,
  describe,
  traceArtifactsByUid,
  zipReader
} from './artifact-sources.js'
import { emitPrepared, type TelemetrySink } from './emit-spans.js'
import type { Manifest, ManifestTest } from './manifest.js'
import {
  actionStart,
  normalizeSelector,
  STATE_FAILED,
  STATE_PASSED,
  type ActionInfo,
  type AttemptView,
  type Bounds,
  type PreparedRoot,
  type PreparedTest,
  type TraceEvidence
} from './prepared.js'
import type { PinnedSpanIds } from './span-ids.js'

type ManifestParent = NonNullable<Manifest['parent']>

export interface ManifestInput {
  file: string
  manifest: Manifest
  mtimeMs: number
}

export interface PushInput {
  manifests: ManifestInput[]
  runId: string
  artifactBaseUrl?: string
  traceZips: boolean
  loadZip: (zipPath: string) => Uint8Array
  warn: (message: string) => void
}

export interface PushPlan {
  /** Zips requested under --trace-zips that could not be read or parsed; complete once `emit` has run. */
  unreadable: () => string[]
  emit: (sink: TelemetrySink) => Promise<number>
}

interface RunContext {
  runId: string
  mtimeMs: number
  parent: ManifestParent | undefined
  warn: (message: string) => void
}

interface TestSource {
  data: TracePlayerData | undefined
  artifactUrl: string | undefined
}

interface PreparedFacts {
  test: ManifestTest
  run: RunContext
  span: Bounds | undefined
  evidence: TraceEvidence | undefined
  finalAttributes: Record<string, string | number>
  errorMessage: string | undefined
}

function actionKey(command: CommandLog): string {
  return command.selector
    ? `${command.command} ${normalizeSelector(command.selector)}`
    : command.command
}

function actionInfos(commands: CommandLog[]): ActionInfo[] {
  const chronological = commands
    .map((command, index) => ({ command, index }))
    .sort(
      (a, b) =>
        actionStart(a.command) - actionStart(b.command) || a.index - b.index
    )
  const retried = retriedRows(commands)
  const infos = new Array<ActionInfo>(commands.length)
  chronological.forEach(({ command, index }, ordinal) => {
    infos[index] = {
      command,
      key: actionKey(command),
      ordinal,
      failure: effectiveFailure(command, retried)
    }
  })
  return infos
}

const MAX_ERROR_MESSAGE_LENGTH = 4096

function capLength(message: string | undefined): string | undefined {
  return message && message.length > MAX_ERROR_MESSAGE_LENGTH
    ? `${message.slice(0, MAX_ERROR_MESSAGE_LENGTH)}…`
    : message
}

function status(state: string): string {
  if (state === STATE_PASSED) {
    return attr.TEST_CASE_RESULT_STATUS_PASS
  }
  if (state === STATE_FAILED) {
    return attr.TEST_CASE_RESULT_STATUS_FAIL
  }
  return state
}

function testAttributes(
  test: ManifestTest,
  runId: string,
  state: string | undefined,
  attempt: number,
  extra: Record<string, string | number>
): Record<string, string | number> {
  return {
    [attr.ATTR_TEST_CASE_NAME]: test.title,
    [attr.ATTR_TEST_SUITE_NAME]: test.specFile,
    ...(state !== undefined
      ? { [attr.ATTR_TEST_CASE_RESULT_STATUS]: status(state) }
      : {}),
    [attr.ATTR_TEST_ATTEMPT]: attempt,
    [attr.ATTR_RUN_ID]: runId,
    ...extra
  }
}

function actionBounds(action: ActionInfo): Bounds {
  return {
    startMs: actionStart(action.command),
    endMs: Math.max(action.command.timestamp, actionStart(action.command))
  }
}

function groupBounds(children: TraceActionChild[]): Bounds[] {
  return children.flatMap((child) =>
    'group' in child
      ? [
          { startMs: child.group.startTime, endMs: child.group.endTime },
          ...groupBounds(child.group.children)
        ]
      : []
  )
}

function bounds(
  actions: ActionInfo[],
  groups: TraceActionChild[],
  fallbackMs: number
): Bounds {
  const spans = [...actions.map(actionBounds), ...groupBounds(groups)]
  if (!spans.length) {
    return { startMs: fallbackMs, endMs: fallbackMs }
  }
  return {
    startMs: Math.min(...spans.map((span) => span.startMs)),
    endMs: Math.max(...spans.map((span) => span.endMs))
  }
}

function union(a: Bounds, b: Bounds): Bounds {
  return {
    startMs: Math.min(a.startMs, b.startMs),
    endMs: Math.max(a.endMs, b.endMs)
  }
}

/** The test's own timing, for a manifest that predates `attempts`. */
function testBounds(test: ManifestTest): Bounds | undefined {
  const endMs =
    test.endTime ??
    (test.startTime !== undefined && test.durationMs !== undefined
      ? test.startTime + test.durationMs
      : undefined)
  if (endMs === undefined) {
    return undefined
  }
  return {
    startMs:
      test.startTime ??
      (test.durationMs !== undefined ? endMs - test.durationMs : endMs),
    endMs
  }
}

/** A root covers its own timing and every action under it, so children never fall outside. */
function rootBounds(
  timing: Bounds | undefined,
  span: Bounds | undefined,
  fallbackMs: number
): Bounds {
  const base = timing ?? span ?? { startMs: fallbackMs, endMs: fallbackMs }
  return timing && span ? union(timing, span) : base
}

function timeSourceOf(test: ManifestTest, span: Bounds | undefined): string {
  if (test.endTime !== undefined) {
    return attr.TIME_SOURCE_MANIFEST
  }
  return span ? attr.TIME_SOURCE_TRACE : attr.TIME_SOURCE_MANIFEST_FILE
}

function durationOf(
  test: ManifestTest,
  span: Bounds | undefined
): number | undefined {
  const manifestDurationMs =
    test.startTime !== undefined && test.endTime !== undefined
      ? test.endTime - test.startTime
      : undefined
  return (
    test.durationMs ??
    manifestDurationMs ??
    (span ? span.endMs - span.startMs : undefined)
  )
}

function attemptViews(test: ManifestTest): AttemptView[] {
  if (!test.attempts?.length) {
    return [
      {
        attempt: test.attempt,
        state: test.state,
        ids: undefined,
        timing: testBounds(test),
        final: true
      }
    ]
  }
  const records = [...test.attempts].sort((a, b) => a.attempt - b.attempt)
  const stamped = records.some((record) => record.final)
  return records.map((record, index) => {
    // Manifests from before `final` was stamped have no marked record; their last attempt is the final one.
    const final = record.final ?? (!stamped && index === records.length - 1)
    return {
      attempt: record.attempt,
      state: final ? test.state : record.state,
      ids: { traceId: record.traceId, spanId: record.spanId },
      timing: {
        startMs: record.startTime,
        endMs: record.endTime ?? record.startTime
      },
      final
    }
  })
}

/** The attempt's ids win over a parent that disagrees, since the children and the stamped ids were minted together. */
function parentContextOf(
  parent: ManifestParent | undefined,
  ids: PinnedSpanIds | undefined,
  label: string,
  warn: (message: string) => void
): Context {
  if (!parent) {
    return ROOT_CONTEXT
  }
  if (ids?.traceId !== undefined && ids.traceId !== parent.traceId) {
    warn(
      `${label} is in trace ${ids.traceId}, not the manifest's parent trace ${parent.traceId}, so it keeps its own ids and is not linked to the parent`
    )
    return ROOT_CONTEXT
  }
  return trace.setSpanContext(ROOT_CONTEXT, {
    traceId: parent.traceId,
    spanId: parent.spanId,
    traceFlags: parent.traceFlags,
    isRemote: true,
    ...(parent.traceState !== undefined
      ? { traceState: createTraceState(parent.traceState) }
      : {})
  })
}

function prepareRoot(view: AttemptView, facts: PreparedFacts): PreparedRoot {
  const { test, run, span, evidence, finalAttributes, errorMessage } = facts
  const label = `${test.uid} attempt ${view.attempt}`
  const attributes = view.final
    ? finalAttributes
    : testAttributes(test, run.runId, view.state, view.attempt, {
        ...(view.timing
          ? {
              [attr.ATTR_DURATION_MS]: view.timing.endMs - view.timing.startMs,
              [attr.ATTR_TIME_SOURCE]: attr.TIME_SOURCE_MANIFEST
            }
          : { [attr.ATTR_TIME_SOURCE]: attr.TIME_SOURCE_MANIFEST_FILE })
      })
  return {
    attributes: { ...attributes, [attr.ATTR_TEST_FINAL_ATTEMPT]: view.final },
    bounds: rootBounds(view.timing, view.final ? span : undefined, run.mtimeMs),
    state: view.state,
    errorMessage: view.final ? errorMessage : undefined,
    ids: view.ids,
    context: parentContextOf(run.parent, view.ids, label, run.warn),
    final: view.final,
    trace: view.final ? evidence : undefined
  }
}

/** A passing test's erroring command is one it caught or retried, not its failure. */
function failedActionOf(
  test: ManifestTest,
  actions: ActionInfo[]
): ActionInfo | undefined {
  if (test.state !== STATE_FAILED) {
    return undefined
  }
  return actions
    .filter((action) => action.failure)
    .sort((a, b) => a.ordinal - b.ordinal)[0]
}

function prepareTest(
  test: ManifestTest,
  source: TestSource,
  run: RunContext
): PreparedTest {
  const { data, artifactUrl } = source
  const actions = data ? actionInfos(data.trace.commands) : []
  const failure = failedActionOf(test, actions)
  const evidence: TraceEvidence | undefined = data
    ? {
        data,
        actions,
        failure,
        span: bounds(actions, data.groups ?? [], data.startTime)
      }
    : undefined
  const span = evidence?.span
  const errorMessage = capLength(test.error ?? failure?.failure?.message)
  const durationMs = durationOf(test, span)
  const finalAttributes = testAttributes(
    test,
    run.runId,
    test.state,
    test.attempt,
    {
      ...(durationMs !== undefined
        ? { [attr.ATTR_DURATION_MS]: durationMs }
        : {}),
      [attr.ATTR_TIME_SOURCE]: timeSourceOf(test, span),
      ...(errorMessage !== undefined
        ? { [attr.ATTR_ERROR_MESSAGE]: errorMessage }
        : {}),
      ...(failure ? { [attr.ATTR_FAILED_ACTION]: failure.key } : {}),
      ...(artifactUrl ? { [attr.ATTR_ARTIFACT_URL]: artifactUrl } : {})
    }
  )
  return {
    test,
    roots: attemptViews(test).map((view) =>
      prepareRoot(view, {
        test,
        run,
        span,
        evidence,
        finalAttributes,
        errorMessage
      })
    )
  }
}

/** Each test's preparation is deferred so its zip is parsed only when its spans are emitted. */
function planManifest(
  input: PushInput,
  { file, manifest, mtimeMs }: ManifestInput,
  readTrace: (zipPath: string) => TracePlayerData | undefined
): Array<() => PreparedTest> {
  const dir = path.dirname(file)
  const testUids = new Set(manifest.tests.map((test) => test.uid))
  const artifactsByUid = traceArtifactsByUid(manifest)
  const run: RunContext = {
    runId: input.runId,
    mtimeMs,
    parent: manifest.parent,
    warn: input.warn
  }
  const pending: Array<() => PreparedTest> = []
  let warnedSharedZip = false
  for (const test of manifest.tests) {
    const artifact = artifactsByUid.get(test.uid)
    const sharedZip =
      artifact !== undefined &&
      artifact.testUids.filter((uid) => testUids.has(uid)).length > 1
    if (sharedZip && input.traceZips && !warnedSharedZip) {
      input.warn(
        `skipped traces in ${file}: traceGranularity:'test' is required for traces, so its zips cover several tests`
      )
      warnedSharedZip = true
    }
    // A dropped zip (retained:false) has no file to link to.
    const linked = !sharedZip && artifact?.retained ? artifact : undefined
    const zipPath = linked ? path.resolve(dir, linked.path) : undefined
    const artifactUrl =
      zipPath && input.artifactBaseUrl
        ? artifactUrlFor(dir, zipPath, input.artifactBaseUrl, input.warn)
        : undefined
    pending.push(() =>
      prepareTest(
        test,
        {
          data: input.traceZips && zipPath ? readTrace(zipPath) : undefined,
          artifactUrl
        },
        run
      )
    )
  }
  return pending
}

export function planPush(input: PushInput): PushPlan {
  const reader = zipReader(input.loadZip, input.warn)
  const pending = input.manifests.flatMap((manifest) =>
    planManifest(input, manifest, reader.read)
  )
  return {
    unreadable: () => reader.unreadable(),
    async emit(sink) {
      for (const prepare of pending) {
        emitPrepared(sink, prepare())
      }
      try {
        await sink.flush()
      } catch (error) {
        throw new Error(
          `the export of ${pending.length} test(s) failed, so some may not have reached the collector: ${describe(error)}`
        )
      }
      return pending.length
    }
  }
}
