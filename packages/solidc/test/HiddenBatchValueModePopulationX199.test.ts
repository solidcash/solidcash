import { describe, expect, it } from 'vitest';
import { compileString } from '../src/compiler.js';

/**
 * X199. THE SCB1 HEADER'S VALUE-MODE BYTE IS DECIDED OVER THE HANDLERS THE ROUTE CAN DISPATCH.
 *
 * Two flags answered one question over two different populations: the SDK encoder counted every PUBLISHED
 * handler's `usesMsgValue`, the compiler counted a set a handler joins only while route synthesis still
 * admits it. The SDK half of the repair lives in `layer3/hidden-batch.ts` and is exercised end-to-end by
 * `Layer3ValueModePopulationX199`. THIS file pins the compiler half, which is a distinct defect:
 *
 * `graphMsgValueHandlers` is filled during the FIRST per-handler pass and never revised, while `eligible` is
 * afterwards narrowed by `applyRouteUniformity`. So the flag was computed over a THIRD population - neither
 * the published handlers nor the final survivors - and a payable handler admitted by pass one and demoted by
 * uniformity still widened every row of the route from 12 to 21 bytes and demanded a header byte no
 * artifact-derivable predicate reproduces.
 *
 * WHY THAT MATTERS BEYOND TIDINESS: it is what makes an SDK-ONLY repair a REGRESSION. On `V1ThirdPopulation`
 * below the old compiler demanded `01` and the old SDK wrote `01`, so the bus WORKED. Teaching the SDK to
 * count only eligible handlers, and nothing else, would have made it write `00` into a route still demanding
 * `01` - breaking a contract that worked. The two halves are one repair.
 */

const BUS = {
  forceStateful: true,
  hiddenBatch: true,
  messageBusController: `aa20${'11'.repeat(32)}87`,
  messageBusControllerCategory: '22'.repeat(32),
} as never;

/**
 * The header byte the ROUTE demands, decoded out of the compiled script rather than recomputed from the same
 * predicate under test. The route preamble emits
 *     OP_6 OP_SPLIT OP_DROP OP_5 OP_SPLIT OP_NIP PUSH<mode> OP_EQUALVERIFY
 * for `require(batchBlob.slice(5, 6) == hex"<mode>")`; X192 decoded that window instruction by instruction.
 * Reading the push back out is an INDEPENDENT observation of the flag, which is the point.
 */
function routeDemandedModeByte(artifact: { debug?: { bytecode?: string } }): string {
  const hex = artifact.debug?.bytecode;
  if (typeof hex !== 'string') return 'NO-BYTECODE';
  const needle = /567f75557f77(0100|0101|51|00)88/g;
  const hits: string[] = [];
  let match = needle.exec(hex);
  while (match !== null) {
    hits.push(match[1] === '0100' || match[1] === '00' ? '00' : '01');
    match = needle.exec(hex);
  }
  const unique = [...new Set(hits)];
  if (unique.length === 1) return unique[0];
  if (hits.length === 0) {
    const raw = /567f75557f77([0-9a-f]{8})/.exec(hex);
    return raw ? `UNRECOGNISED:${raw[1]}` : 'NOT-FOUND';
  }
  return `AMBIGUOUS:${hits.join(',')}`;
}

/** The predicate the artifact can express, and the one both sides must now agree on. */
const publishedValueMode = (artifact: any): boolean =>
  (artifact.hiddenBatch.handlers as any[]).some((handler) => handler.eligible && handler.usesMsgValue);

/**
 * THE THIRD POPULATION, CONSTRUCTED. `deposit` is payable, reads `msg.value` and passes the first per-handler
 * pass; `peek` returns, which makes the route result-shaped, and uniformity then demotes the effect-carrying
 * `deposit` by name. One handler publishes `usesMsgValue`, zero eligible ones read it.
 */
const THIRD_POPULATION = `pragma solidcash >=0.8.0;
contract V1ThirdPopulation() {
  int total;
  event Paid(int amount);
  function deposit() public { total = total + msg.value; emit Paid(msg.value); require(true); }
  function peek() public returns (int) { return total; }
}`;

/** The control: a payable handler route synthesis ADMITS. The route must stay in value mode. */
const ADMITTED_VALUE = `pragma solidcash >=0.8.0;
contract V1AdmittedValue() {
  int total;
  function deposit() public { total = total + msg.value; require(true); }
  function peek() public { require(total >= 0); }
}`;

/** No handler anywhere reads msg.value. The route must stay out of value mode. */
const NO_VALUE = `pragma solidcash >=0.8.0;
contract V1NoValue() {
  int total;
  function bump() public { total = total + 1; require(true); }
  function peek() public { require(total >= 0); }
}`;

describe('X199: the SCB1 value-mode flag is computed over the dispatchable handler set', () => {
  it('a payable handler DEMOTED by route uniformity no longer widens the route', () => {
    const artifact = compileString(THIRD_POPULATION, BUS) as any;
    const handlers = artifact.hiddenBatch.handlers as any[];
    const deposit = handlers.find((handler) => handler.name === 'deposit');
    // The subject only exists while uniformity is what refuses `deposit`; if that changes, this test must be
    // re-taken rather than quietly passing on a different shape.
    expect(deposit.usesMsgValue).toBe(true);
    expect(deposit.eligible).toBe(false);
    expect(deposit.rejectionReason).toBe('result-route-requires-effect-free-handlers');
    expect(handlers.some((handler) => handler.eligible && handler.usesMsgValue)).toBe(false);
    expect(routeDemandedModeByte(artifact)).toBe('00');
  });

  it('a payable handler the route ADMITS still puts it in value mode', () => {
    const artifact = compileString(ADMITTED_VALUE, BUS) as any;
    const deposit = (artifact.hiddenBatch.handlers as any[]).find((handler) => handler.name === 'deposit');
    expect(deposit.eligible).toBe(true);
    expect(deposit.usesMsgValue).toBe(true);
    expect(routeDemandedModeByte(artifact)).toBe('01');
  });

  it('a route with no msg.value handler at all stays out of value mode', () => {
    const artifact = compileString(NO_VALUE, BUS) as any;
    expect((artifact.hiddenBatch.handlers as any[]).some((handler) => handler.usesMsgValue)).toBe(false);
    expect(routeDemandedModeByte(artifact)).toBe('00');
  });

  /**
   * THE INVARIANT THE TWO SIDES NOW SHARE. Whatever the route demands has to be reproducible from the two
   * per-handler predicates the artifact actually publishes, because that pair is all the SDK encoder can see.
   * Asserted across every shape above, in both directions.
   */
  it('the route\'s demanded byte is reproducible from the published handler list', () => {
    for (const source of [THIRD_POPULATION, ADMITTED_VALUE, NO_VALUE]) {
      const artifact = compileString(source, BUS) as any;
      expect(routeDemandedModeByte(artifact)).toBe(publishedValueMode(artifact) ? '01' : '00');
    }
  });
});
