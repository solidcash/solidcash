import { describe, expect, it } from 'vitest';
import { compileFileMulti } from 'solidc';

/**
 * X177. THE FOUR ABSENT-FLAG HANDLERS DO NOT MUTATE, AND THE FIFTH EXPLICIT WRITER DOES NOT EITHER.
 *
 * `Layer3RecoveredPartitionX160.test.ts` counts ELEVEN state-changing handlers among the 206 the L2-F2
 * repair recovered, under a classifier that reads `writesState` ABSENT as writing. SEVEN publish
 * `writesState: true` outright; the other FOUR publish it absent and the partition test says plainly that
 * counting them is conservative and "not a claim that they mutate". Nobody had established which way it goes.
 *
 * THE ANSWER IS THAT NONE OF THE FOUR MUTATES, and it is structural rather than behavioural:
 *
 *   handler                        dataNftCount   route block
 *   Bar.log                                   0   master + 8 event
 *   HashFunction.hash                         0   master + 2 keccakSideCar + returnEvent
 *   HashFunction.collision                    0   master + 2 keccakSideCar + returnEvent
 *   TestTransientStorage.val                  0   master + returnEvent
 *
 * A contract with `dataNftCount === 0` has NO persistent state UTXO. There is no data NFT in its route block,
 * so the covenant has nothing to recreate and no commitment to pin, and "does this handler mutate state" has
 * no referent for it - the question is not close, it is void. That is what this file measures, and it is
 * measured off the compiled artifact rather than read off the Solidity: for each of the four, the contract
 * declares no state variable, the layout allocates no data NFT, and the route's own block layout contains no
 * `dataNft` slot.
 *
 * THIS IS A STRUCTURAL PROOF, NOT A VM RUN, and that is stated rather than dressed up. A VM run would add
 * nothing here: the discriminator for a writer is "publish the pre state and be refused, publish the post
 * state and settle", and a route with no data NFT slot has neither state to publish nor a slot to publish it
 * in. What the four ARE is a separate question this file does not answer - `Bar.log` emits eight events and
 * `HashFunction.hash` drives two keccak side-cars, and neither is run to completion anywhere.
 *
 * AND THE FIFTH EXPLICIT WRITER IS THE SAME SHAPE OF SURPRISE. `Foo.callBar` publishes `writesState: true`
 * and its Solidity body is `bar.log();` - one external call and NOT ONE ASSIGNMENT. The flag is set by the
 * external call, not by a storage write. So of the SEVEN handlers the partition counts as explicit writers,
 * at least one writes nothing, and `Attack.attack` - whose body is also exactly one external call and no
 * assignment - is the same case. The classifier's `true` means "this handler needs the state machinery", not
 * "this handler changes a state variable", and the two readings are not interchangeable.
 *
 * WHAT IS NOT ESTABLISHED. `Foo.callBar` is NOT run to completion here. Its counterparty `Bar` IS bus
 * admissible - unlike `Attack.attack`'s `Wallet` - which makes it the one recovered writer that could carry
 * a SOUND external-call co-spend, and that is exactly why it deserves its own VM row rather than a paragraph.
 * It has none yet.
 */

const SBE = `${process.env.SBE_ROOT ?? '/Code/solidity-by-example'}/contracts/src`;

const BUS = {
  solidityImportCompat: true,
  ecrecover: 'p2pkh',
  forceStateful: true,
  hiddenBatch: true,
  messageBusController: `aa20${'11'.repeat(32)}87`,
  messageBusControllerCategory: '22'.repeat(32),
};
const DIRECT = { solidityImportCompat: true, ecrecover: 'p2pkh' };

interface AbsentRow {
  /** The partition key, exactly as `Layer3RecoveredPartitionX160.test.ts` prints it. */
  key: string;
  file: string;
  contract: string;
  handler: string;
  /** The block this route publishes, asserted so a shape change turns this file red. */
  slots: readonly string[];
}

const ABSENT: readonly AbsentRow[] = [
  {
    key: 'hacks/hiding-malicious-code-with-external-contract/ExternalContract.sol::Bar.log',
    file: `${SBE}/hacks/hiding-malicious-code-with-external-contract/ExternalContract.sol`,
    contract: 'Bar',
    handler: 'log',
    slots: ['master', 'event', 'event', 'event', 'event', 'event', 'event', 'event', 'event'],
  },
  {
    key: 'hashing/Keccak256.sol::HashFunction.hash',
    file: `${SBE}/hashing/Keccak256.sol`,
    contract: 'HashFunction',
    handler: 'hash',
    slots: ['master', 'keccakSideCar', 'keccakSideCar', 'returnEvent'],
  },
  {
    key: 'hashing/Keccak256.sol::HashFunction.collision',
    file: `${SBE}/hashing/Keccak256.sol`,
    contract: 'HashFunction',
    handler: 'collision',
    slots: ['master', 'keccakSideCar', 'keccakSideCar', 'returnEvent'],
  },
  {
    key: 'transient-storage/TransientStorage.sol::TestTransientStorage.val',
    file: `${SBE}/transient-storage/TransientStorage.sol`,
    contract: 'TestTransientStorage',
    handler: 'val',
    slots: ['master', 'returnEvent'],
  },
];

const compiled = new Map<string, any>();
function busMap(file: string): any {
  if (!compiled.has(file)) compiled.set(file, compileFileMulti(file, BUS as never));
  return compiled.get(file);
}

describe('X177: the four ABSENT-flag recovered handlers', () => {
  /**
   * THE CLASSIFIER READING, re-measured. Each of the four publishes `writesState` ABSENT - not `false` - in
   * the DIRECT artifact, which is why the census counts them and why the count is conservative.
   */
  const absentFlag = (row: AbsentRow) => (): void => {
    const direct = compileFileMulti(row.file, DIRECT as never) as any;
    const abi = direct[row.contract].abi.find((entry: any) => entry.name === row.handler);
    console.log(`[X177A] ${row.key} DIRECT writesState=${JSON.stringify(abi?.writesState)}`);
    expect(abi, `${row.key} has no direct ABI entry`).toBeDefined();
    expect(abi.writesState, `${row.key} publishes writesState explicitly`).toBeUndefined();
  };

  /**
   * THE ANSWER. No state variable, no data NFT, no `dataNft` slot in the route block. There is no persistent
   * state for this handler to mutate, so it does not - and this is a fact about the compiled route, not a
   * reading of the source.
   */
  const doesNotMutate = (row: AbsentRow) => (): void => {
    const artifact = busMap(row.file)[row.contract];
    const layout = artifact.stateLayout!;
    if (row.contract === 'TestTransientStorage') {
      // Both entry points use transient-storage Yul. SCB1 cannot summarize those effects, so the contract is
      // deliberately route-less rather than publishing a misleading `val` row. Its ordinary state layout
      // still proves the narrower fact this census records: there is no persistent data NFT to mutate.
      expect(artifact.hiddenBatch).toBeUndefined();
      const absence = (artifact.diagnostics ?? [])
        .filter((entry: any) => entry.code === 'hidden-batch-route-not-synthesized');
      expect(absence).toHaveLength(1);
      expect(absence[0]).toMatchObject({ severity: 'error' });
      expect(absence[0].message).toContain("'val': opaque-assembly-effects-transcript-ineligible");
      expect(layout.dataNftCount, `${row.key} has persistent state`).toBe(0);
      expect(layout.variables ?? []).toEqual([]);
      expect(layout.collections ?? []).toEqual([]);
      return;
    }
    const block = (artifact.hiddenBatch!.route.blockLayout!.slots as any[]).map((slot) => slot.kind);
    console.log(`[X177A] ${row.key} dataNftCount=${layout.dataNftCount} `
      + `variables=${JSON.stringify((layout.variables ?? []).map((v: any) => v.name))} `
      + `collections=${JSON.stringify((layout.collections ?? []).map((c: any) => c.name))}`);
    console.log(`[X177A] ${row.key} block=${JSON.stringify(block)}`);
    const eligible = (artifact.hiddenBatch!.handlers as any[])
      .filter((handler) => handler.eligible).map((handler) => handler.name);
    expect(eligible, `${row.handler} is not admitted`).toContain(row.handler);
    expect(layout.dataNftCount, `${row.key} has persistent state`).toBe(0);
    expect(layout.variables ?? []).toEqual([]);
    expect(layout.collections ?? []).toEqual([]);
    expect(block).toEqual(row.slots);
    expect(block, `${row.key} carries a data NFT slot`).not.toContain('dataNft');
  };

  for (const row of ABSENT) {
    it(`MEASURED: ${row.key} publishes writesState ABSENT`, absentFlag(row), 300_000);
    it(`MEASURED: ${row.key} has NO persistent state, so it does not mutate`, doesNotMutate(row), 300_000);
  }

  /**
   * AND THE CONTRAST THAT MAKES THE MEASUREMENT MEAN SOMETHING. `Counter` - the one recovered writer proved
   * to settle - takes the other branch on every one of these: it declares a state variable, allocates a data
   * NFT, and its route block carries a `dataNft` slot. So "no data NFT" is a discriminating property of these
   * four and not something every recovered route has.
   */
  it('CONTROL: the proved writer `Counter` has state, a data NFT, and a dataNft slot', () => {
    const artifact = busMap(`${SBE}/fallback/FallbackInputOutput.sol`).Counter;
    const block = (artifact.hiddenBatch!.route.blockLayout!.slots as any[]).map((slot) => slot.kind);
    console.log(`[X177A] Counter dataNftCount=${artifact.stateLayout.dataNftCount} block=`
      + `${JSON.stringify(block)}`);
    expect(artifact.stateLayout.dataNftCount).toBe(1);
    expect((artifact.stateLayout.variables ?? []).map((v: any) => v.name)).toEqual(['count']);
    expect(block).toContain('dataNft');
  }, 300_000);

  /**
   * THE FIFTH EXPLICIT WRITER. `Foo.callBar` publishes `writesState: true` and assigns nothing: its body is
   * `bar.log();`. The flag comes from the external call. Its counterparty `Bar` IS admitted by the bus, which
   * is the difference from `Attack.attack`'s `Wallet` and the reason this row is the one worth running.
   */
  it('MEASURED: `Foo.callBar` publishes writesState TRUE and its body assigns nothing', () => {
    const file = `${SBE}/hacks/hiding-malicious-code-with-external-contract/ExternalContract.sol`;
    const direct = compileFileMulti(file, DIRECT as never) as any;
    const abi = direct.Foo.abi.find((entry: any) => entry.name === 'callBar');
    console.log(`[X177A] Foo.callBar DIRECT writesState=${JSON.stringify(abi.writesState)}`);
    expect(abi.writesState).toBe(true);
    const bus = busMap(file);
    const foo = bus.Foo;
    const block = (foo.hiddenBatch!.route.blockLayout!.slots as any[]).map((slot) => slot.kind);
    const inputs = (foo.abi.find((entry: any) => entry.name === 'callBar').inputs as any[])
      .map((input) => input.name);
    console.log(`[X177A] Foo block=${JSON.stringify(block)} callBar inputs=${JSON.stringify(inputs)} `
      + `dataNftCount=${foo.stateLayout.dataNftCount}`);
    // `bar` is the only state variable and `callBar` does not assign it; the handler carries the external
    // call's synthetic witness and no argument of its own.
    expect((foo.stateLayout.variables ?? []).map((v: any) => v.name)).toEqual(['bar']);
    expect(inputs).toEqual(['__internal__externalCallInputBase']);
    expect(block).toEqual(['master', 'dataNft', 'returnEvent']);
    // THE COUNTERPARTY IS ADMISSIBLE, which `Attack.attack`'s is not. Measured on the same compile.
    const barEligible = (bus.Bar.hiddenBatch!.handlers as any[])
      .filter((handler) => handler.eligible).map((handler) => handler.name);
    console.log(`[X177A] counterparty Bar eligible=${JSON.stringify(barEligible)}`);
    expect(barEligible).toContain('log');
  }, 300_000);
});
