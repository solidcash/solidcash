import { describe, expect, it } from 'vitest';
import {
  encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32,
  hash256,
} from '@bitauth/libauth';
import {
  asmToScript, buildPushdataCommitment, encodeArgumentList, encodeIntegerValue, encodeWitnessBlock,
  scriptToBytecode, sha256, validatorAddress, type WitnessBlock,
} from '@solidcash/utils';
import { compileString, compileStringMulti } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { REAL_VALIDATOR_PROGRAM, categorySlotValue, dataRecordLock, seededCategory } from './validator-input.js';
import { publishedRefusals, refusalOf } from './refused-entry.js';

/**
 * A body the master cannot serve fails on its own rather than failing the contract.
 *
 * The master is one program, but one unsupported function used to refuse the whole unit: every other function of the
 * contract stopped compiling, including the ones a transaction can reach. A refused body is emitted as a body that
 * fails whenever the dispatcher reaches it, its reason is published beside the artifact, and the entries that reach
 * it are refused with it — so what a builder reports is which function is unsupported, and the functions that are
 * supported keep their programs.
 *
 * The machine settles it: the same master is spent with the selector of each entry, and the accepted spend beside
 * the refused ones is what shows the refusal is a property of the body rather than of the program.
 */

const CATEGORY = seededCategory('refused body');
const ADDRESS = validatorAddress(CATEGORY, REAL_VALIDATOR_PROGRAM);
const TEMPLATE_HASH = sha256(REAL_VALIDATOR_PROGRAM);
const OWNER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(9));

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Choice {'
  + '   function good() { require(true); }'
  + '   function bad() returns (function(int) external returns (int)) { revert("no"); }'
  + '   function callsBad() { bad(); require(true); }'
  + ' }';

/** A contract whose only body is refused, so the master serves nothing and must still compile. */
const ALL_REFUSED_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Only {'
  + '   function bad() returns (function(int) external returns (int)) { revert("no"); }'
  + ' }';

const artifact = compileStringMulti(SOURCE, { composition: 'framed' }).Choice!;
const program = fillPlaceholders(
  scriptToBytecode(asmToScript(artifact.bytecode)),
  artifact.composition!.placeholders,
  { category: categorySlotValue(CATEGORY), contractAddress: ADDRESS, templateHash: TEMPLATE_HASH },
);

/** The selector the ABI publishes for an entry, which is what the dispatcher reads. */
const selectorOf = (name: string): Uint8Array =>
  new Uint8Array(Buffer.from(artifact.abi.find((entry) => entry.name === name)!.selector!, 'hex'));

/** Spends the master's own input with one entry's selector, and reports whether the machine accepted it. */
function spend(entry: string): boolean {
  return spendSelector(program, selectorOf(entry));
}

/** Spends a master program's own input with `selector` under the shared standalone frame, and reports the verdict. */
function spendSelector(programBytes: Uint8Array, selector: Uint8Array): boolean {
  const lock = encodeLockingBytecodeP2sh32(hash256(programBytes));
  const block: WitnessBlock = {
    kind: 0,
    callerRef: 0,
    originRef: 0,
    validatorRef: 0xffff,
    sender: OWNER_LOCK,
    self: ADDRESS,
    value: 0n,
    retval: new Uint8Array(0),
    calls: [],
    segments: [[]],
    events: [],
    sends: [],
  };
  const masterSource = {
    lockingBytecode: lock,
    valueSatoshis: 20_000n,
    token: { category: CATEGORY, amount: 0n, nft: { capability: 'minting' as const, commitment: new Uint8Array(0) } },
  };
  const masterOutput = {
    lockingBytecode: lock,
    valueSatoshis: 20_000n,
    token: { category: CATEGORY, amount: 0n, nft: { capability: 'minting' as const, commitment: new Uint8Array(0) } },
  };
  const transaction = {
    version: 2,
    inputs: [
      { outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(7), sequenceNumber: 0xffffffff,
        unlockingBytecode: callerUnlockingBytecode() },
      { outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(2), sequenceNumber: 0xffffffff,
        unlockingBytecode: new Uint8Array([
          ...encodeDataPush(encodeWitnessBlock(block)),
          ...encodeDataPush(selector),
          ...encodeDataPush(programBytes),
        ]) },
    ],
    outputs: [{ lockingBytecode: OWNER_LOCK, valueSatoshis: 100_000n }, masterOutput],
    locktime: 0,
  };
  const sourceOutputs = [{ lockingBytecode: OWNER_LOCK, valueSatoshis: 100_000n }, masterSource];
  const vm = compositionMachine();
  return vm.stateSuccess(vm.evaluate({ inputIndex: 1, sourceOutputs, transaction })) === true;
}

describe('a body the master cannot serve', () => {
  it('is refused by name while the entries the master can serve keep compiling', () => {
    const reasons = publishedRefusals(compileStringMulti(SOURCE, { composition: 'framed' }));
    expect(reasons.map((refused) => refused.functionName).sort()).toStrictEqual([
      'Choice.bad()', 'Choice.callsBad()',
    ]);
    expect(reasons.find((refused) => refused.functionName === 'Choice.bad()')!.reason)
      .toContain('returns a function pointer');
    // The entry that calls it is refused with it, and the reason names the body it runs.
    expect(reasons.find((refused) => refused.functionName === 'Choice.callsBad()')!.reason)
      .toContain("it runs 'bad'");
  });

  it('fails whenever the dispatcher reaches it, beside a served entry that settles', () => {
    // The accepted spend is the control: the same program, the same frame, one selector apart.
    expect(spend('good')).toBe(true);
    expect(spend('bad')).toBe(false);
    expect(spend('callsBad')).toBe(false);
  });

  it('refuses a contract whose every body is unsupported, rather than refusing the unit', () => {
    // Nothing is served, so the master is a dispatcher over refusals; a builder reads which function is missing
    // from the published reasons instead of from a compile that fails.
    const artifacts = compileStringMulti(ALL_REFUSED_SOURCE, { composition: 'framed' });
    expect(artifacts.Only?.composition?.convention).toBe('framed');
    expect(refusalOf(ALL_REFUSED_SOURCE, 'Only').message).toContain('returns a function pointer');
  });
});

/**
 * A refused entry that makes external calls must not size the head's call count.
 *
 * A master whose only call-making entries are refused can still stand alone, because a refused body is a stub that
 * makes no call. The head's count is therefore the served bodies' bound, which keeps the standalone frame a user
 * enters admissible. Taking the count from every entry the call-site pass measured instead holds a call no served
 * body makes, and the head refuses the frame before any body runs.
 *
 * The call here sits in a switch arm, a shape the call walk cannot count through, so the body stays refused by
 * name and its entry still sizes nothing.
 */
const REFUSED_CALL_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IOracle { function get(int id) view returns (int); }'
  + ' contract Feed {'
  + '   address public oracle;'
  + '   constructor(address o) { this.oracle = o; }'
  + '   function pick(uint sel) {'
  + '     switch (sel) { case 0: IOracle(this.oracle).get(1); break; default: require(true); }'
  + '     require(true);'
  + '   }'
  + '   function ping() { require(true); }'
  + ' }';

const refusedCallArtifact = compileStringMulti(REFUSED_CALL_SOURCE, { composition: 'framed' }).Feed!;
const refusedCallProgram = fillPlaceholders(
  scriptToBytecode(asmToScript(refusedCallArtifact.bytecode)),
  refusedCallArtifact.composition!.placeholders,
  { category: categorySlotValue(CATEGORY), contractAddress: ADDRESS, templateHash: TEMPLATE_HASH },
);
const refusedCallSelector = (name: string): Uint8Array =>
  new Uint8Array(Buffer.from(refusedCallArtifact.abi.find((entry) => entry.name === name)!.selector!, 'hex'));

describe('a refused call-making entry', () => {
  it('is refused by name and publishes no call site', () => {
    const refusals = publishedRefusals(compileStringMulti(REFUSED_CALL_SOURCE, { composition: 'framed' }));
    expect(refusals.map((refused) => refused.functionName)).toStrictEqual(['Feed.pick()']);
    expect(refusals.find((refused) => refused.functionName === 'Feed.pick()')!.reason)
      .toContain('is in a body that switches');
    const stopSites = refusedCallArtifact.composition!.stopSites!;
    expect(stopSites.entries.flatMap((entry) => entry.calls)).toStrictEqual([]);
  });

  it('admits the standalone frame the served entry is entered by', () => {
    // The served entry is one no call is left in the head for, so the user's root frame is admitted; the refused
    // entry's own stub still fails when the dispatcher reaches it.
    expect(spendSelector(refusedCallProgram, refusedCallSelector('ping'))).toBe(true);
    expect(spendSelector(refusedCallProgram, refusedCallSelector('pick'))).toBe(false);
  });
});

/**
 * A call-making entry the master serves, and the wall its bare frame hits.
 *
 * The entry reads another contract and then writes a verified mapping. It was refused before the mapping write's
 * own segment and the conditional-call admission were served; it compiles served now and publishes the read's call
 * site. Its bare standalone frame no longer settles: a master whose served body makes a call cannot be entered
 * without that call, so the head's standalone arm refuses the user's root frame before any body runs. The entry is
 * entered with a composed frame instead — the validator input and the call record — which this file does not build.
 */
const SERVED_CALL_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IOracle { function get(int id) view returns (int); }'
  + ' contract Feed {'
  + '   address public oracle;'
  + '   mapping(int => int) public log;'
  + '   constructor(address o) { this.oracle = o; }'
  + '   function readBack(int id) {'
  + '     int x = IOracle(this.oracle).get(id);'
  + '     this.log[id] = x + 1;'
  + '     require(true);'
  + '   }'
  + '   function ping() { require(true); }'
  + ' }';

const servedCallArtifact = compileStringMulti(SERVED_CALL_SOURCE, { composition: 'framed' }).Feed!;
const servedCallProgram = fillPlaceholders(
  scriptToBytecode(asmToScript(servedCallArtifact.bytecode)),
  servedCallArtifact.composition!.placeholders,
  { category: categorySlotValue(CATEGORY), contractAddress: ADDRESS, templateHash: TEMPLATE_HASH },
);
const servedCallSelector = (name: string): Uint8Array =>
  new Uint8Array(Buffer.from(servedCallArtifact.abi.find((entry) => entry.name === name)!.selector!, 'hex'));

describe('a call-making entry the master serves', () => {
  it('publishes no refusal and the call site for the read it makes', () => {
    const refusals = publishedRefusals(compileStringMulti(SERVED_CALL_SOURCE, { composition: 'framed' }));
    expect(refusals).toStrictEqual([]);
    const entry = servedCallArtifact.composition!.stopSites!.entries
      .find((candidate) => candidate.functionName === 'Feed.readBack()')!;
    expect(entry.calls).toHaveLength(1);
  });

  it('refuses the standalone frame it was formerly entered by, now that a served body makes a call', () => {
    // The head's standalone arm (`assertStandalone`) emits a refusal whenever its call count is nonzero, because a
    // master whose served body makes a call cannot be entered without that call. This master's served bound is one,
    // so both entries stop at that arm, before their bodies run; the entry is entered with a composed frame
    // instead.
    expect(spendSelector(servedCallProgram, servedCallSelector('ping'))).toBe(false);
    expect(spendSelector(servedCallProgram, servedCallSelector('readBack'))).toBe(false);
  });
});

/**
 * A Solidity-compatible proxy implementation's entries are served like any other entry.
 *
 * Solidity has no `delegate` keyword, so the direct convention infers the proxy-implementation surface from an
 * `initializer`/`reinitializer` modifier and hands each such entry the co-spent proxy master's input index as
 * `__internal__proxyMasterIndex`. That operand belongs to the direct convention's state base: a framed master
 * reads the records its own frame declares, and its head establishes a `DELEGATE` frame kind where the proxy
 * relationship applies, so no body carries the marking or the operand under this convention.
 */
const INITIALIZER_SOURCE = 'pragma solidity ^0.8.19;'
  + ' contract Impl {'
  + '   address public owner;'
  + '   mapping(string => string) public tags;'
  + '   modifier initializer() { _; }'
  + '   function initialize(address who) public initializer { owner = who; tags["DA"] = "x"; }'
  + '   function setOwner(address who) public { owner = who; }'
  + ' }';

describe('a Solidity-compatible proxy implementation', () => {
  it('is served, and no entry carries the proxy-master operand', () => {
    const artifacts = compileStringMulti(INITIALIZER_SOURCE, {
      composition: 'framed', evmCompat: true,
    });
    expect(publishedRefusals(artifacts)).toStrictEqual([]);
    for (const compiled of Object.values(artifacts)) {
      for (const entry of compiled.abi) {
        expect(entry.inputs.map((input) => input.name)).not.toContain('__internal__proxyMasterIndex');
      }
    }
    expect(artifacts.Impl?.abi.map((entry) => entry.name).sort())
      .toStrictEqual(['initialize', 'owner', 'setOwner', 'tags']);
  });

  it('keeps the marking and the operand under the direct convention', () => {
    // The control for the inference the framed convention skips: the direct build still marks the surface and
    // still publishes the operand its delegate frame addresses through.
    const direct = compileString(INITIALIZER_SOURCE, { evmCompat: true });
    const initialize = direct.abi.find((entry) => entry.name === 'initialize')!;
    expect(initialize.modifiers).toContain('delegate');
    expect(initialize.inputs.map((input) => input.name)).toContain('__internal__proxyMasterIndex');
  });
});

/** A proxy implementation whose initializer writes the one record the frame declares. */
const INITIALIZER_WRITE_SOURCE = 'pragma solidity ^0.8.19;'
  + ' contract Store {'
  + '   uint256 count;'
  + '   modifier initializer() { _; }'
  + '   function initialize(uint256 value) public initializer { count = value; }'
  + ' }';

const STORE_CATEGORY = seededCategory('initializer implementation');
const STORE_ADDRESS = validatorAddress(STORE_CATEGORY, REAL_VALIDATOR_PROGRAM);
/** A record's lock: the entry only requires input and output to agree, so any lock serves. */
const STORE_STATE_LOCK = dataRecordLock(STORE_CATEGORY);
const STORE_USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
/** The value the record holds before the entry runs, and the one the entry writes. */
const STORE_BEFORE = 42n;
const STORE_WRITTEN = 7n;

const storeArtifact = compileString(INITIALIZER_WRITE_SOURCE, {
  composition: 'framed', evmCompat: true,
});
const storeProgram = fillPlaceholders(
  scriptToBytecode(asmToScript(storeArtifact.bytecode)),
  storeArtifact.composition!.placeholders,
  { category: categorySlotValue(STORE_CATEGORY), contractAddress: STORE_ADDRESS, templateHash: TEMPLATE_HASH },
);
const storeLock = encodeLockingBytecodeP2sh32(hash256(storeProgram));
/** The record's commitment for one value of `count`. */
const storeCommitment = (count: bigint): Uint8Array =>
  new Uint8Array(Buffer.from(buildPushdataCommitment(storeArtifact.stateLayout!, { count }, 0), 'hex'));
/**
 * The selector the dispatcher is entered with.
 *
 * A Solidity-compatible contract exposes a getter for its state variable, so the master has several entries and the
 * frame's leading call data names the one it runs.
 */
const storeSelector: Uint8Array =
  new Uint8Array(Buffer.from(storeArtifact.abi.find((entry) => entry.name === 'initialize')!.selector!, 'hex'));
/** The push the entry's one argument reaches it as: the value it writes, in its canonical encoding. */
const storeArgumentPushes = encodeArgumentList([encodeIntegerValue(STORE_WRITTEN)]);

/** One record token in the shipped form. */
function storeToken(
  capability: 'minting' | 'mutable',
  commitment: Uint8Array = new Uint8Array(0),
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable'; commitment: Uint8Array } } {
  return { category: STORE_CATEGORY, amount: 0n, nft: { capability, commitment } };
}

/** Spends the initializer's own input; the frame's record declares `viewOut` as the value the write produced. */
function spendInitializer(viewOut: Uint8Array): boolean {
  const block: WitnessBlock = {
    kind: 0,
    callerRef: 2,
    originRef: 2,
    validatorRef: 0xffff,
    sender: STORE_USER_LOCK,
    self: STORE_ADDRESS,
    value: 0n,
    retval: new Uint8Array(0),
    calls: [],
    segments: [[{ in: 1, out: 1, viewIn: storeCommitment(STORE_BEFORE), viewOut }]],
    events: [],
    sends: [],
  };
  const masterValue = 20_000n;
  const sourceOutputs = [
    { lockingBytecode: storeLock, valueSatoshis: masterValue, token: storeToken('minting') },
    { lockingBytecode: STORE_STATE_LOCK, valueSatoshis: masterValue,
      token: storeToken('mutable', storeCommitment(STORE_BEFORE)) },
    { lockingBytecode: STORE_USER_LOCK, valueSatoshis: 100_000n },
  ];
  const transaction = {
    version: 2,
    inputs: [
      { outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(1), sequenceNumber: 0xffffffff,
        unlockingBytecode: new Uint8Array([
          ...encodeDataPush(encodeWitnessBlock(block)),
          ...encodeDataPush(storeSelector),
          ...storeArgumentPushes,
          ...encodeDataPush(storeProgram),
        ]) },
      { outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(2), sequenceNumber: 0xffffffff,
        unlockingBytecode: encodeDataPush(new Uint8Array([1])) },
      { outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(4), sequenceNumber: 0xffffffff,
        unlockingBytecode: callerUnlockingBytecode() },
    ],
    outputs: [
      sourceOutputs[0]!,
      { lockingBytecode: STORE_STATE_LOCK, valueSatoshis: masterValue,
        token: storeToken('mutable', storeCommitment(STORE_WRITTEN)) },
      sourceOutputs[2]!,
    ],
    locktime: 0,
  };
  const vm = compositionMachine();
  return vm.stateSuccess(vm.evaluate({ inputIndex: 0, sourceOutputs, transaction })) === true;
}

describe('a Solidity-compatible initializer the master serves', () => {
  it('settles the write it was refused for, and refuses a record of another value', () => {
    expect(spendInitializer(storeCommitment(STORE_WRITTEN))).toBe(true);
    expect(spendInitializer(storeCommitment(STORE_WRITTEN + 1n))).toBe(false);
  });
});

/**
 * A constructor that runs a body the master cannot serve.
 *
 * The constructor is dispatched behind the same head, so a body it invokes is the refusal an entry would reach: it
 * is refused with that body, by name, as an entry is, and its genesis answers with the published reason rather
 * than stopping at the body's stub.
 */
const constructorRunning = (name: string, members: string): string => 'pragma solidcash ^0.14.0;'
  + ` contract ${name} {`
  + '   int public seen;'
  + members
  + '   function bad() returns (function(int) external returns (int)) { revert("no"); }'
  + '   function note() { this.seen = this.seen + 1; require(true); }'
  + ' }';

const BAD_REASON = 'the entry point \'bad\' returns a function pointer, but a frame\'s `retval` is compared with one '
  + 'scalar value the entry computed, which a composite value is not yet';

const refusalsOfConstructor = (name: string, members: string): ReturnType<typeof publishedRefusals> =>
  publishedRefusals(compileStringMulti(constructorRunning(name, members), { composition: 'framed' }));

describe('a constructor that runs a body the master cannot serve', () => {
  it('is refused by name with the body it runs, however it reaches the body', () => {
    const shapes: Readonly<Record<string, string>> = {
      Direct: ' constructor() { bad(); this.seen = 1; }',
      Helper: ' constructor() { this.seen = viaHelper(); }'
        + ' function viaHelper() internal returns (int) { bad(); return 1; }',
      // A body on one arm refuses the constructor as it refuses an entry: the closure is over the bodies the
      // constructor can run, not over the arm one genesis takes.
      Branch: ' constructor(bool flag) { if (flag) { bad(); } this.seen = 1; }',
    };
    for (const [name, members] of Object.entries(shapes)) {
      expect(refusalsOfConstructor(name, members), name).toStrictEqual([
        { functionName: `${name}.__construct()`, reason: `it runs 'bad', which the master cannot serve: ${BAD_REASON}` },
        { functionName: `${name}.bad()`, reason: BAD_REASON },
      ]);
    }
  });

  it('leaves a constructor that runs no refused body served', () => {
    expect(refusalsOfConstructor('Control', ' constructor() { this.seen = 1; }'))
      .toStrictEqual([{ functionName: 'Control.bad()', reason: BAD_REASON }]);
  });
});
