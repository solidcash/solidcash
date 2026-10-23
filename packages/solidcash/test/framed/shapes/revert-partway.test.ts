import { describe, expect, it, vi } from 'vitest';
import {
  FrameKind,
  buildPushdataCommitment,
  bytesToHex,
  encodeIntegerValue,
  encodeResultList,
  type Artifact,
  type RecordEntry,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import {
  stateRecordLockingBytecode,
  stateRecordUnlockingBytecode,
} from '../../../src/framed/deploy/index.js';
import {
  createComposedDerivationHost,
  deriveComposition,
  participant,
  reportCompositionRefusal,
  type CompositionDraft,
  type CompositionDraftPlan,
  type DraftMaster,
  type FrameRequest,
} from '../../../src/framed/composer/index.js';
import {
  USER_LOCK, compileAndDeploy, entryName, layoutWithFacets, master, masterInput, rootOf,
  seededAddress, selectorOf, token, userInput, userInputs, validatorFor,
  type ArtifactMap,
} from './harness.js';

/**
 * A user-entered root that calls earlier entries and then fails a check of its own.
 *
 * The root's first call writes a state record, so the write is declared and would change the record; the root's
 * own check then fails. Nothing settles: the derivation stalls at the failing frame, the report names that frame
 * and its source line, and no accepted transaction carries the write. A second shape nests the failing check one
 * call deeper, so the report must name the innermost frame rather than the root. A third shape reverts with a
 * declared error carrying arguments, pinning what the compiler publishes, what it says about those arguments and
 * the values the report reads back.
 *
 * Every shape is driven the shipped way: compile with `compileStringMulti`, deploy with `deployMaster`, lay out
 * with `layoutTransaction`/`participant`, derive with `createComposedDerivationHost`/`deriveComposition`, and ask
 * the BCH-2026 machine for a verdict. No coordinate is supplied: the record index, the master indices and the
 * record's commitment all come from the shipped layout and encoders.
 */

const USER = 'user';
const VALIDATOR = 'validator';
const STORE_RECORD = 'storeRecord';

/** The commitment the shipped encoder materializes for a one-field record: `int count`. */
function recordCommitment(artifact: Artifact, count: bigint): Uint8Array {
  return new Uint8Array(Buffer.from(
    buildPushdataCommitment(artifact.stateLayout!, { count }, 0), 'hex'));
}

/** The 1-based line of the first source line containing `needle`. */
function lineOf(text: string, needle: string): number {
  return text.split('\n').findIndex((line) => line.includes(needle)) + 1;
}

// --- The root that calls a writing entry and then fails its own check -------------------------------

const PAIR = { Root: 'revert partway root', Store: 'revert partway store' } as const;
const PAIR_ROOT = 'root-1';
const PAIR_STORE = 'store-1';

function pairSource(rootBody: string): string {
  return 'pragma solidcash ^0.14.0;'
    + ' interface IStore { function write(int next) returns (int); }'
    + ' contract Store {'
    + '   int public count;'
    + '   function write(int next) returns (int) { this.count = next; require(this.count == next); return this.count; }'
    + ' }'
    + ' contract Root {'
    + `   function run() { int got = IStore(0x${hexOfAddress(PAIR.Store)}).write.call(1); ${rootBody} }`
    + ' }';
}

function hexOfAddress(label: string): string {
  return Buffer.from(seededAddress(label)).toString('hex');
}

interface PairRun {
  readonly text: string;
  readonly artifacts: ArtifactMap;
  readonly plan: CompositionDraftPlan;
  readonly draft: CompositionDraft;
  readonly completed: readonly FrameRequest[];
  readonly derivationError?: Error;
  readonly before: Uint8Array;
  readonly after: Uint8Array;
  readonly recordIndex: number;
}

/** Compiles, deploys, lays out and derives the root-plus-writer shape with the root's own tail as `rootBody`. */
function buildPair(rootBody: string): PairRun {
  const text = pairSource(rootBody);
  const { artifacts, contracts } = compileAndDeploy(text, PAIR);
  const root = contracts.Root!;
  const store = contracts.Store!;
  const before = recordCommitment(artifacts.Store!, 0n);
  const after = recordCommitment(artifacts.Store!, 1n);
  const writeSelector = selectorOf(artifacts, 'Store', 'write');
  const one = encodeIntegerValue(1n);

  const blocks = [
    {
      contract: 'Root', masters: [PAIR_ROOT],
      validator: { id: VALIDATOR, settles: [] as readonly string[] }, state: [] as readonly string[],
    },
    { contract: 'Store', masters: [PAIR_STORE], state: [STORE_RECORD] },
  ];
  const layout = layoutWithFacets(blocks);
  const recordIndex = participant(layout, STORE_RECORD).index;
  const storeIndex = participant(layout, PAIR_STORE).index;
  const recordWrite: RecordEntry = { in: recordIndex, out: recordIndex, viewIn: before, viewOut: after };
  const validator = validatorFor(root.category);

  const rootMaster = master({
    master: PAIR_ROOT, contract: 'Root', entry: 'run', program: root.program,
    facts: {
      contract: 'Root', functionName: entryName('Root', 'run'), kind: FrameKind.ROOT,
      callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: root.address, value: 0n },
    enteredBy: USER, origin: USER,
    calls: [{
      kind: FrameKind.CALL, callee: PAIR_STORE, target: store.address, value: 0n,
      argumentPushes: [writeSelector, one],
    }],
  });
  const storeMaster: DraftMaster = {
    ...master({
      master: PAIR_STORE, contract: 'Store', entry: 'write', program: store.program,
      facts: {
        contract: 'Store', functionName: entryName('Store', 'write'), kind: FrameKind.CALL,
        callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1,
      },
      frame: { kind: FrameKind.CALL, sender: root.address, self: store.address, value: 0n },
      enteredBy: PAIR_ROOT, origin: USER, argumentPushes: [writeSelector, one],
      segments: [[recordWrite]],
    }),
    // `write` returns the count it wrote, which its caller reads back, in the shipped result encoding.
    retval: encodeResultList([one]),
  };

  const recordLock = stateRecordLockingBytecode(bytesToHex(store.category));
  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: userInputs([USER], layout.funderInputBase),
    masters: [rootMaster, storeMaster],
    inputs: {
      [PAIR_ROOT]: { source: masterInput(root) },
      [PAIR_STORE]: { source: masterInput(store) },
      [VALIDATOR]: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(root.category, 'mutable') },
      },
      [STORE_RECORD]: {
        source: { lockingBytecode: recordLock, valueSatoshis: 20_000n, token: token(store.category, 'mutable', before) },
        output: { lockingBytecode: recordLock, valueSatoshis: 20_000n, token: token(store.category, 'mutable', after) },
        unlockingBytecode: stateRecordUnlockingBytecode(bytesToHex(store.category), storeIndex, 1),
      },
      [USER]: userInput(),
    },
    validator: {
      id: VALIDATOR, covers: ['Store'],
      settles: [],
      redeemScript: validator.redeem,
    },
  };

  const { host, draft } = createComposedDerivationHost({
    vm: compositionMachine(), artifacts: [artifacts.Root!, artifacts.Store!], plan,
  });
  let completed: readonly FrameRequest[] = [];
  let derivationError: Error | undefined;
  try {
    completed = deriveComposition([rootOf('Root', 'run', PAIR_ROOT)], host).completed;
  } catch (error) {
    derivationError = error as Error;
  }
  return {
    text, artifacts, plan, draft, completed, before, after, recordIndex,
    ...(derivationError === undefined ? {} : { derivationError }),
  };
}

// --- The root that calls a writing entry and a nested chain that fails ------------------------------

const CHAIN = {
  Root: 'revert partway chain root', Store: 'revert partway chain store',
  Mid: 'revert partway chain mid', Deep: 'revert partway chain deep',
} as const;
const CHAIN_ROOT = 'root-1';
const CHAIN_STORE = 'store-1';
const CHAIN_MID = 'mid-1';
const CHAIN_DEEP = 'deep-1';

function chainSource(deepBody: string): string {
  return 'pragma solidcash ^0.14.0;'
    + ' error Rejected(int code, int limit);'
    + ' interface IStore { function write(int next); }'
    + ' interface IMid { function enter(); }'
    + ' interface IDeep { function check(); }'
    + ' contract Store {'
    + '   int public count;'
    + '   function write(int next) { this.count = next; require(this.count == next); }'
    + ' }'
    + ' contract Mid {'
    + `   function enter() { IDeep(0x${hexOfAddress(CHAIN.Deep)}).check.call(); require(true); }`
    + ' }'
    + ' contract Deep {'
    + `   function check() { ${deepBody} }`
    + ' }'
    + ' contract Root {'
    + `   function run() { IStore(0x${hexOfAddress(CHAIN.Store)}).write.call(1); `
    + 'IMid(' + `0x${hexOfAddress(CHAIN.Mid)}` + ').enter.call(); require(true); }'
    + ' }';
}

interface ChainRun {
  readonly text: string;
  readonly artifacts: ArtifactMap;
  readonly plan: CompositionDraftPlan;
  readonly draft: CompositionDraft;
  readonly completed: readonly FrameRequest[];
  readonly derivationError?: Error;
  readonly before: Uint8Array;
  readonly after: Uint8Array;
  readonly recordIndex: number;
}

/** Compiles, deploys, lays out and derives the root-store-mid-deep chain with `deepBody` under test. */
function buildChain(deepBody: string): ChainRun {
  const text = chainSource(deepBody);
  const { artifacts, contracts } = compileAndDeploy(text, CHAIN);
  const root = contracts.Root!;
  const store = contracts.Store!;
  const mid = contracts.Mid!;
  const deep = contracts.Deep!;
  const before = recordCommitment(artifacts.Store!, 0n);
  const after = recordCommitment(artifacts.Store!, 1n);
  const writeSelector = selectorOf(artifacts, 'Store', 'write');
  const enterSelector = selectorOf(artifacts, 'Mid', 'enter');
  const checkSelector = selectorOf(artifacts, 'Deep', 'check');
  const one = encodeIntegerValue(1n);

  const blocks = [
    {
      contract: 'Root', masters: [CHAIN_ROOT],
      validator: { id: VALIDATOR, settles: [] as readonly string[] }, state: [] as readonly string[],
    },
    { contract: 'Store', masters: [CHAIN_STORE], state: [STORE_RECORD] },
    { contract: 'Mid', masters: [CHAIN_MID], state: [] as readonly string[] },
    { contract: 'Deep', masters: [CHAIN_DEEP], state: [] as readonly string[] },
  ];
  const layout = layoutWithFacets(blocks);
  const recordIndex = participant(layout, STORE_RECORD).index;
  const storeIndex = participant(layout, CHAIN_STORE).index;
  const recordWrite: RecordEntry = { in: recordIndex, out: recordIndex, viewIn: before, viewOut: after };
  const validator = validatorFor(root.category);

  const rootMaster = master({
    master: CHAIN_ROOT, contract: 'Root', entry: 'run', program: root.program,
    facts: {
      contract: 'Root', functionName: entryName('Root', 'run'), kind: FrameKind.ROOT,
      callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: root.address, value: 0n },
    enteredBy: USER, origin: USER,
    calls: [
      { kind: FrameKind.CALL, callee: CHAIN_STORE, target: store.address, value: 0n, argumentPushes: [writeSelector, one] },
      { kind: FrameKind.CALL, callee: CHAIN_MID, target: mid.address, value: 0n, argumentPushes: [enterSelector] },
    ],
  });
  const storeMaster = master({
    master: CHAIN_STORE, contract: 'Store', entry: 'write', program: store.program,
    facts: {
      contract: 'Store', functionName: entryName('Store', 'write'), kind: FrameKind.CALL,
      callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.CALL, sender: root.address, self: store.address, value: 0n },
    enteredBy: CHAIN_ROOT, origin: USER, argumentPushes: [writeSelector, one],
    segments: [[recordWrite]],
  });
  const midMaster = master({
    master: CHAIN_MID, contract: 'Mid', entry: 'enter', program: mid.program,
    facts: {
      contract: 'Mid', functionName: entryName('Mid', 'enter'), kind: FrameKind.CALL,
      callerIsUser: false, originEqualsCaller: false, makesExternalCall: true, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.CALL, sender: root.address, self: mid.address, value: 0n },
    enteredBy: CHAIN_ROOT, origin: USER, argumentPushes: [enterSelector],
    calls: [{ kind: FrameKind.CALL, callee: CHAIN_DEEP, target: deep.address, value: 0n, argumentPushes: [checkSelector] }],
  });
  const deepMaster = master({
    master: CHAIN_DEEP, contract: 'Deep', entry: 'check', program: deep.program,
    facts: {
      contract: 'Deep', functionName: entryName('Deep', 'check'), kind: FrameKind.CALL,
      callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.CALL, sender: mid.address, self: deep.address, value: 0n },
    enteredBy: CHAIN_MID, origin: USER, argumentPushes: [checkSelector],
  });

  const recordLock = stateRecordLockingBytecode(bytesToHex(store.category));
  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: userInputs([USER], layout.funderInputBase),
    masters: [rootMaster, storeMaster, midMaster, deepMaster],
    inputs: {
      [CHAIN_ROOT]: { source: masterInput(root) },
      [CHAIN_STORE]: { source: masterInput(store) },
      [CHAIN_MID]: { source: masterInput(mid) },
      [CHAIN_DEEP]: { source: masterInput(deep) },
      [VALIDATOR]: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(root.category, 'mutable') },
      },
      [STORE_RECORD]: {
        source: { lockingBytecode: recordLock, valueSatoshis: 20_000n, token: token(store.category, 'mutable', before) },
        output: { lockingBytecode: recordLock, valueSatoshis: 20_000n, token: token(store.category, 'mutable', after) },
        unlockingBytecode: stateRecordUnlockingBytecode(bytesToHex(store.category), storeIndex, 1),
      },
      [USER]: userInput(),
    },
    validator: {
      id: VALIDATOR, covers: ['Store', 'Mid', 'Deep'],
      settles: [],
      redeemScript: validator.redeem,
    },
  };

  const { host, draft } = createComposedDerivationHost({
    vm: compositionMachine(),
    artifacts: [artifacts.Root!, artifacts.Store!, artifacts.Mid!, artifacts.Deep!], plan,
  });
  let completed: readonly FrameRequest[] = [];
  let derivationError: Error | undefined;
  try {
    completed = deriveComposition([rootOf('Root', 'run', CHAIN_ROOT)], host).completed;
  } catch (error) {
    derivationError = error as Error;
  }
  return {
    text, artifacts, plan, draft, completed, before, after, recordIndex,
    ...(derivationError === undefined ? {} : { derivationError }),
  };
}

/** Every contract input of a derived draft the real machine refuses, as the harness reports them. */
function rejectedInputs(draft: CompositionDraft, rootMaster: string): readonly string[] {
  const program = draft.programFor(rootMaster);
  const vm = compositionMachine();
  return draft.layout.participants.flatMap((placed) => {
    const state = vm.evaluate({
      inputIndex: placed.index, sourceOutputs: program.sourceOutputs, transaction: program.transaction,
    });
    return vm.stateSuccess(state) === true ? [] : [`${placed.id}: ${String(state.error)}`];
  });
}

describe('a root whose own check fails after an earlier call succeeded', () => {
  it('stalls the derivation, names the root frame and its line, and leaves no accepted transaction', () => {
    const run = buildPair('require(got == 2, "root check failed");');

    // The driver threw: the root's frame fails its own check, so nothing is built and the partial derivation's
    // completions are discarded. The earlier call still ran first — its write is the record declaration the
    // derivation left in the writer's own block — but no accepted transaction carries it.
    expect((run.derivationError as { code?: string }).code).toBe('FRAMED_DERIVATION_STALLED');
    expect(run.draft.blockOf(PAIR_STORE).segments[0]!.map((entry) => entry.out)).toStrictEqual([run.recordIndex]);
    // The write would change the record, and the same composition with the check passing settles (control below).
    expect(bytesToHex(run.before)).not.toBe(bytesToHex(run.after));

    const report = reportCompositionRefusal({
      draft: run.draft, artifacts: [run.artifacts.Root!, run.artifacts.Store!], vm: compositionMachine(),
    });
    // No composition is accepted, so the writer's declaration stands nowhere. The writer's own input is not the
    // machine's objection: the caller's own frame is the one that refused.
    expect(report.accepted).toBe(false);
    expect(report.innermost!.master).toBe(PAIR_ROOT);
    expect(report.innermost!.depth).toBe(0);
    expect(report.innermost!.contract).toBe('Root');
    expect(report.innermost!.reason.message).toBe('root check failed');
    expect(report.innermost!.reason.line).toBe(lineOf(run.text, 'require(got == 2, "root check failed")'));
    expect(report.refusals.map((refusal) => refusal.master)).not.toContain(PAIR_STORE);
  });
});

describe('a nested callee whose check fails after the root called another callee', () => {
  it('reports the innermost frame\'s reason, not the root\'s, with its own line and message', () => {
    const run = buildChain('require(false, "deep check failed");');

    // The root called the writer and then the mid contract; the mid contract called the deep one, which fails.
    // The derivation stalls at the deep frame, and the report names it rather than the entry the user made.
    expect((run.derivationError as { code?: string }).code).toBe('FRAMED_DERIVATION_STALLED');

    const report = reportCompositionRefusal({
      draft: run.draft,
      artifacts: [run.artifacts.Root!, run.artifacts.Store!, run.artifacts.Mid!, run.artifacts.Deep!],
      vm: compositionMachine(),
    });
    expect(report.accepted).toBe(false);
    // Only the deepest frame refused; the root's own program passed, yet the report must not name the root.
    expect(report.refusals.map((refusal) => refusal.master)).toStrictEqual([CHAIN_DEEP]);
    const innermost = report.innermost!;
    expect(innermost.master).toBe(CHAIN_DEEP);
    expect(innermost.master).not.toBe(CHAIN_ROOT);
    expect(innermost.depth).toBe(2);
    expect(innermost.contract).toBe('Deep');
    expect(innermost.functionName).toBe(entryName('Deep', 'check'));
    expect(innermost.reason.message).toBe('deep check failed');
    expect(innermost.reason.line).toBe(lineOf(run.text, 'require(false, "deep check failed")'));
  });
});

describe('a revert with a declared error carrying arguments', () => {
  it('publishes the error\'s name and parameters, warns the arguments are not evaluated, and reports the name', () => {
    // The compiler emits `revert <Error>(...)` as an unconditional failure and prints a warning for it. Spying on
    // `console.log` also disables the compile cache, so this compile really runs the warning site.
    const logged: string[] = [];
    const log = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => { logged.push(args.join(' ')); });
    let run: ChainRun;
    try {
      run = buildChain('revert Rejected(7, 3);');
    } finally {
      log.mockRestore();
    }
    const text = run.text;
    const line = lineOf(text, 'revert Rejected');

    // The compiler's own warning, verbatim, naming the line of the revert.
    const warning = `Warning: revert with custom error is a no-op in SolidCash at line ${line}. `
      + 'Error arguments are type-checked but not evaluated; the script simply fails unconditionally.';
    expect(logged).toContain(warning);

    // The artifact publishes the error's name, signature and declared parameters; the values passed at the site
    // are not part of it.
    expect(run.artifacts.Deep!.errors).toStrictEqual([{
      name: 'Rejected', signature: 'Rejected(int256,int256)',
      parameters: [{ name: 'code', type: 'int256' }, { name: 'limit', type: 'int256' }],
    }]);

    // The refusal report resolves the failing frame's published message back to the declared error. The machine's
    // own objection is the bare `OP_VERIFY` failure the unconditional revert emits, with no argument values.
    const report = reportCompositionRefusal({
      draft: run.draft,
      artifacts: [run.artifacts.Root!, run.artifacts.Store!, run.artifacts.Mid!, run.artifacts.Deep!],
      vm: compositionMachine(),
    });
    const innermost = report.innermost!;
    expect(innermost.master).toBe(CHAIN_DEEP);
    expect(innermost.reason.line).toBe(line);
    expect(innermost.reason.message).toBe('revert Rejected(...)');
    expect(innermost.reason.error!.name).toBe('Rejected');
    expect(innermost.reason.error!.parameters).toStrictEqual([
      { name: 'code', type: 'int256' }, { name: 'limit', type: 'int256' },
    ]);
    expect(innermost.objection).toContain('OP_VERIFY');
    expect(innermost.objection).not.toMatch(/[0-9]/);
    // The values are not in the objection, but the compiler publishes where the revert leaves them.
    expect(innermost.reason.arguments).toStrictEqual([7n, 3n]);
  });

  it('type-checks the arguments: a mismatched count is refused at compile time', () => {
    // The arguments are checked even though they are never evaluated. One argument for a two-parameter error is
    // refused by the compiler before any bytecode is emitted.
    expect(() => compileStringMulti(chainSource('revert Rejected(7);'), { composition: 'framed' }))
      .toThrow(/Error 'Rejected' expects 2 arguments but got 1/);
  });
});

describe('the same compositions with their checks passing', () => {
  it('the root-plus-writer shape derives and every contract input is accepted', () => {
    const run = buildPair('require(got == 1);');
    expect(run.derivationError).toBeUndefined();
    expect(run.completed.map((frame) => frame.master)).toStrictEqual([PAIR_STORE, PAIR_ROOT]);

    expect(rejectedInputs(run.draft, PAIR_ROOT)).toStrictEqual([]);
    // The write stands: the record output is the commitment the frame computed.
    const record = run.draft.programFor(PAIR_ROOT).transaction.outputs[run.recordIndex]!.token!.nft!.commitment;
    expect(bytesToHex(record)).toBe(bytesToHex(run.after));
  });

  it('the root-store-mid-deep chain derives and every contract input is accepted', () => {
    const run = buildChain('require(true);');
    expect(run.derivationError).toBeUndefined();
    expect(run.completed.map((frame) => frame.master))
      .toStrictEqual([CHAIN_STORE, CHAIN_DEEP, CHAIN_MID, CHAIN_ROOT]);

    expect(rejectedInputs(run.draft, CHAIN_ROOT)).toStrictEqual([]);
    const record = run.draft.programFor(CHAIN_ROOT).transaction.outputs[run.recordIndex]!.token!.nft!.commitment;
    expect(bytesToHex(record)).toBe(bytesToHex(run.after));
  });
});
