import { beforeAll, describe, expect, it } from 'vitest';
import { compileString } from '../src/compiler.js';

/**
 * X72 - a refused hidden-batch handler must carry a reason.
 *
 * `hiddenBatch.handlers` publishes `eligible: false` with the `rejectionReason` key omitted whenever route
 * synthesis never examined the function. That is silence, not a refusal: the F3 corpus census recorded 20
 * such rows across four corpora and could only label them `unnamed`.
 *
 * The mechanism is an ordering one. `compiler.ts` runs `synthesizeHiddenBatchRoute` EARLY (before lowering)
 * whenever a handler touches a collection, carries an effect or returns a value; `SynthesizeBlockOracle`
 * runs later and appends `__updateBlockOracle`, which route synthesis has therefore already passed. The
 * absence channel already resolves exactly this condition to `not-examined-by-route-synthesis`
 * (`hiddenBatchAbsenceMessage`); the handlers channel did not.
 *
 * Every case below is paired with a control that differs in exactly ONE field - the `block.*` read, or the
 * mapping that decides the pass ordering - so the reason is a property of the ordering rather than of the
 * contract.
 */

const graph = {
  solidityImportCompat: true,
  forceStateful: true,
  hiddenBatch: true,
  messageBusController: `aa20${'11'.repeat(32)}87`,
  messageBusControllerCategory: '22'.repeat(32),
};

interface PublishedHandler { name: string; eligible: boolean; rejectionReason?: string }

// Compile each source ONCE. Every case below reads the same four artifacts, and recompiling per assertion is
// what turns a passing file into a wall-clock failure under the load of a full multi-package run.
const compiled = new Map<string, ReturnType<typeof compileString>>();
const artifactOf = (code: string): ReturnType<typeof compileString> => {
  if (!compiled.has(code)) compiled.set(code, compileString(code, graph));
  return compiled.get(code)!;
};

const handlersOf = (code: string): PublishedHandler[] =>
  (artifactOf(code).hiddenBatch?.handlers ?? []) as PublishedHandler[];

const unnamedOf = (code: string): PublishedHandler[] =>
  handlersOf(code).filter((handler) => !handler.eligible && handler.rejectionReason === undefined);

/** A mapping write forces the EARLY route synthesis, so the oracle updater is appended after it. */
const mappingAndBlock = `pragma solidity ^0.8.0;
contract X72Early {
  mapping(address => uint256) public balances;
  uint256 public lastSeen;
  function credit(address who, uint256 amount) public { balances[who] = amount; }
  function stamp() public { lastSeen = block.number; }
}`;

/** Control: identical but for the `block.*` read, so no `__updateBlockOracle` is synthesized at all. */
const mappingNoBlock = `pragma solidity ^0.8.0;
contract X72Early {
  mapping(address => uint256) public balances;
  uint256 public lastSeen;
  function credit(address who, uint256 amount) public { balances[who] = amount; }
  function stamp() public { lastSeen = 1; }
}`;

/**
 * Control: no collection, no effect and no returning entry point, so route synthesis runs LATE and does
 * examine the updater. `internal` rather than `public` state, because a public getter RETURNS and that alone
 * selects the early ordering - which is why the mapping is not the only way to reach the defect.
 */
const scalarAndBlock = `pragma solidity ^0.8.0;
contract X72Late {
  uint256 internal lastSeen;
  uint256 internal counter;
  function stamp() public { lastSeen = block.number; }
  function bump() public { counter = 1; }
}`;

/** The public-getter form of the defect: a returning getter, not a mapping, selects the early ordering. */
const gettersAndBlock = `pragma solidity ^0.8.0;
contract X72Getter {
  uint256 public lastSeen;
  uint256 public counter;
  function stamp() public { lastSeen = block.number; }
  function bump() public { counter = 1; }
}`;

/** No entry point survives route synthesis, so the reason reaches the user through the ABSENCE channel. */
const noRoute = `pragma solidity ^0.8.0;
contract X72NoRoute {
  mapping(address => uint256) internal balances;
  uint256 internal lastSeen;
  function credit(address who, uint256 amount) internal { balances[who] = amount; }
  function stamp() external { lastSeen = block.number; }
}`;

describe('X72 a refused hidden-batch handler names its reason', () => {
  const REASON = 'not-examined-by-route-synthesis';

  // Every assertion below reads one of these five artifacts. Compiling them here rather than inside the cases
  // keeps the wall-clock cost in ONE budgeted hook: recompiling per assertion is what turns a passing file
  // into a timeout under the load of a full multi-package run.
  beforeAll(() => {
    for (const source of [mappingAndBlock, mappingNoBlock, scalarAndBlock, gettersAndBlock, noRoute]) {
      artifactOf(source);
    }
  }, 300_000);

  it('publishes no handler with eligible:false and no reason', () => {
    // `handlersOf` defaults to `[]` when no route was published, so `unnamedOf` is empty for a contract that
    // has no handlers channel at all. The three controls below each pair the absence with a positive read;
    // this one did not. Measured at this commit: 5 handlers, one of them refused.
    expect(handlersOf(mappingAndBlock).length, 'no handlers published, so the absence has no subject')
      .toBeGreaterThan(0);
    expect(unnamedOf(mappingAndBlock)).toHaveLength(0);
  });

  it('names the compiler-synthesized entry point route synthesis never saw', () => {
    const updater = handlersOf(mappingAndBlock).find((handler) => handler.name === '__updateBlockOracle');
    expect(updater).toMatchObject({ eligible: false, rejectionReason: REASON });
  });

  /**
   * The control differs in exactly one field - the `block.*` read. Without it there is no synthesized entry
   * point, so the shape that produced the unnamed row does not exist. Both are otherwise the same contract,
   * and both publish a route.
   */
  it('control: with no block.* read there is no such handler at all', () => {
    expect(handlersOf(mappingNoBlock).map((handler) => handler.name)).not.toContain('__updateBlockOracle');
    expect(unnamedOf(mappingNoBlock)).toHaveLength(0);
    expect(handlersOf(mappingNoBlock).length).toBeGreaterThan(0);
  });

  /**
   * The other control differs in exactly one field - the mapping. Without it route synthesis runs AFTER the
   * oracle pass and examines the updater like any other entry point, which is the ordering that already
   * worked. The default set at synthesis time must not survive that pass, or an admitted handler would be
   * reported refused.
   */
  it('control: when route synthesis runs after the oracle pass the updater is examined, not defaulted', () => {
    const updater = handlersOf(scalarAndBlock).find((handler) => handler.name === '__updateBlockOracle');
    expect(updater).toMatchObject({ eligible: true });
    expect(updater!.rejectionReason).toBeUndefined();
    expect(unnamedOf(scalarAndBlock)).toHaveLength(0);
  });

  /**
   * The defect is not specific to mappings. A public state variable synthesizes a RETURNING getter, which
   * selects the early ordering on its own - so the same silent row appears with no collection in sight. Both
   * reach the artifact through the same hole and both are named by the same default.
   */
  it('names it for the returning-getter form of the early ordering too', () => {
    const updater = handlersOf(gettersAndBlock).find((handler) => handler.name === '__updateBlockOracle');
    expect(updater).toMatchObject({ eligible: false, rejectionReason: REASON });
    expect(unnamedOf(gettersAndBlock)).toHaveLength(0);
  });

  /**
   * The same name the absence channel already uses for the same condition, so a user who reads one and then
   * the other is told the same thing. This is what makes the fix a diagnostic change and not a new category.
   */
  it('uses the same name on the handlers channel that the absence channel gives this condition', () => {
    // X73 MOVED THIS FIXTURE'S CHANNEL, AND THAT IS THE POINT. `stamp()` is `external`, and this case was
    // written when an external entry point was refused outright - so no route existed and the reason arrived
    // on the ABSENCE channel. X73 admits external handlers through an internal clone, so a route now exists
    // and the same condition surfaces on the HANDLERS channel instead.
    //
    // The subject is unchanged: `__updateBlockOracle` is appended by `SynthesizeBlockOracle` AFTER route
    // synthesis has named its reasons, so it is never examined. Asserting it here is strictly stronger than
    // the original - it shows the two channels agree on the name rather than only that one of them has it.
    const artifact = artifactOf(noRoute);
    expect(artifact.hiddenBatch).toBeDefined();

    const oracle = artifact.hiddenBatch!.handlers!.find((entry) => entry.name === '__updateBlockOracle')!;
    expect(oracle.eligible).toBe(false);
    expect(oracle.rejectionReason).toBe(REASON);

    // The admitted handler is the one X73 newly lets through, and it carries no reason because it was not
    // refused. Without this row the assertion above could pass on a route that admitted nothing at all.
    const stamp = artifact.hiddenBatch!.handlers!.find((entry) => entry.name === 'stamp')!;
    expect(stamp.eligible).toBe(true);
    expect(stamp.rejectionReason).toBeUndefined();
  });
});
