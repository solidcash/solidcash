/**
 * An opt-in trace of a per-call hop's plan and settle path.
 *
 * A hop that does not settle reports one frame, and the frame it reports is read from the refusal reporter: the
 * deepest frame the machine refused, which need not be the frame the settle evaluated. The sequence that produced
 * the report — the plan's frames, the call records each draft carries before and after every attempt, and the
 * frame the derivation stopped on — is only visible while the settle runs. Setting `PER_CALL_HOP_TRACE=1` prints
 * that sequence, one line per event, under a fixed prefix so it can be grepped out of a noisy run.
 *
 * The trace is observation only: it reads the draft, never mutates it, and it is off unless the variable is
 * exactly `1`, so a run with the variable unset writes nothing and builds no line.
 */

/** The environment variable that turns the trace on. */
export const HOP_TRACE_ENV = 'PER_CALL_HOP_TRACE';

/** The prefix every trace line carries, so a run's output can be grepped for it. */
export const HOP_TRACE_PREFIX = 'HOPTRACE ';

/** The longest trace line; a wider set of call records is clipped rather than wrapped. */
const HOP_TRACE_LINE_LIMIT = 200;

/** True when the hop trace is requested. Reading the variable is the whole check; unset means off. */
export function hopTraceOn(): boolean {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.[HOP_TRACE_ENV] === '1';
}

/** Writes one prefixed, clipped trace line when the trace is on, and does nothing when it is off. */
export function hopTrace(line: string): void {
  if (!hopTraceOn()) return;
  const full = `${HOP_TRACE_PREFIX}${line}`;
  const text = full.length <= HOP_TRACE_LINE_LIMIT
    ? full
    : `${full.slice(0, HOP_TRACE_LINE_LIMIT - 3)}...`;
  const stdout = (globalThis as { process?: { stdout?: { write(chunk: string): void } } }).process?.stdout;
  stdout?.write(`${text}\n`);
}

/** One error as a single trace field: its message, with newlines folded out. */
export function hopTraceError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, ' ').trim();
}
