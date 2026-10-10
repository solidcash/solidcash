/**
 * Opt-in counters for the framed composer's own work, so a lane's cost can be sized instead of argued about.
 *
 * The plain framed call path plans and derives a composition once per value it learns, and the hop derives one frame
 * per iteration. Which of those dominates a title is a count, not an opinion: with `SOLIDC_DEBUG_FRAMED_COUNTS=1`
 * every site that plans, composes, derives or reads a close bumps its counter, and the running totals are logged as
 * one `framed-composer-counts {...}` line every 128 attempts of the plain path (a test runner keeps what a test
 * writes and drops what a worker writes while it tears down, so the line is written from inside the run).
 * `framedComposerCounts()` hands the same totals to a test that wants to pin them.
 *
 * Trace only. Nothing here changes a plan, a program or a verdict, and with the switch unset every bump is one
 * `false` test against a module-level boolean.
 */

/**
 * What one worker counted.
 *
 * `attempts` counts the plain path's global learning loop, `hosts`/`derivations` what one iteration of it costs, and
 * `scopedDerivations` the iterations that stop at the frame under judgement. `hopAttempts` and
 * `hopDerivations` are the same pair for the hop's per-frame loop. The `...Closes` triple splits the learning
 * walk's declaration reads into the ones answered from a close the machine already recorded, the ones answered from
 * a plain run, and the ones that had to step the program again.
 */
export interface FramedComposerCounts {
  readonly attempts: number;
  readonly hosts: number;
  readonly derivations: number;
  readonly scopedDerivations: number;
  readonly hopAttempts: number;
  readonly hopDerivations: number;
  readonly declarationReads: number;
  readonly recordedCloses: number;
  readonly evaluatedCloses: number;
  readonly tracedCloses: number;
  readonly evaluations: number;
  readonly steppedRuns: number;
}

/** The counters, in the order a report reads them. */
type CounterName = keyof FramedComposerCounts;

const zeroes = (): Record<CounterName, number> => ({
  attempts: 0,
  hosts: 0,
  derivations: 0,
  scopedDerivations: 0,
  hopAttempts: 0,
  hopDerivations: 0,
  declarationReads: 0,
  recordedCloses: 0,
  evaluatedCloses: 0,
  tracedCloses: 0,
  evaluations: 0,
  steppedRuns: 0,
});

const env = (): Record<string, string | undefined> | undefined =>
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;

/** True when the run asked for the composer's counters. */
export function framedCountersEnabled(): boolean {
  return env()?.SOLIDC_DEBUG_FRAMED_COUNTS === '1';
}

const counts = zeroes();

/** How often a running reporter states the totals, in attempts. */
const REPORT_EVERY_ATTEMPTS = 128;

/** Adds to one counter, when the run asked for them. */
export function bumpFramedCounter(name: CounterName, by = 1): void {
  if (!framedCountersEnabled()) return;
  counts[name] += by;
  // Stated from inside the run: a test runner prints what a test writes and discards what a worker writes while it
  // tears down, so an exit handler would never reach a lane's log. One line per 128 attempts bounds the noise.
  if (name === 'attempts' && counts.attempts % REPORT_EVERY_ATTEMPTS === 0) reportFramedCounts();
}

/** The counts taken so far, as a plain snapshot. */
export function framedComposerCounts(): FramedComposerCounts {
  return { ...counts };
}

/** Clears every counter, so a test can size one call. */
export function resetFramedComposerCounts(): void {
  Object.assign(counts, zeroes());
}

/** Writes the totals to stderr, as one line a lane log greps for. */
export function reportFramedCounts(): void {
  if (!framedCountersEnabled()) return;
  const line = `framed-composer-counts ${JSON.stringify(framedComposerCounts())}\n`;
  // Written straight to the stream: a test runner patches `console` for the duration of a test, and this runs when
  // the worker is already tearing down.
  const stderr = (globalThis as { process?: { stderr?: { write?: (text: string) => boolean } } })
    .process?.stderr;
  if (typeof stderr?.write === 'function') {
    stderr.write(line);
    return;
  }
  // eslint-disable-next-line no-console
  console.error(line.trimEnd());
}
