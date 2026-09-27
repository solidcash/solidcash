import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256,
} from '@bitauth/libauth';
import {
  FrameKind,
  asmToScript, computeFunctionSelector, computeFunctionSignature,
  encodeWitnessBlock, scriptToBytecode, sha256, validatorAddress,
  type WitnessBlock,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { fillPlaceholders } from '../../../../solidc/src/per-call/master/placeholders.js';
import { callerUnlockingBytecode } from '../../../../solidc/test/per-call/master/caller-input.js';
import {
  REAL_VALIDATOR_PROGRAM, categorySlotValue, seededCategory, validatorSpend,
} from '../../../../solidc/test/per-call/master/validator-input.js';
import {
  createShippedDerivationHost,
  deriveDepthFirst,
  publishedCallee,
  readPublishedStopSites,
  type ShippedMasterRun,
} from '../../../src/per-call/composer/index.js';

/**
 * Deriving a composition through the real host.
 *
 * The caller and the callee are compiled through the shipped `compileStringMulti`, their deployment slots filled
 * the way a deployment fills them, and the host is handed the resulting artifacts. Its `sitesFor` reads the table
 * the compiler published; its `step` runs the compiled caller in the BCH-2026 machine against a draft transaction
 * whose call record has no callee yet, then fills the callee's index in and runs again. The derivation's own
 * result — which sites it stopped at, and that the callee completed before the caller — is the assertion.
 *
 * The draft geometry (which input a master or its callee sits at) is the host's one remaining seam; it is built
 * here the same way the compiled-composition tests build it, because the composer's layout and assembly are not
 * wired to the host yet.
 */

const CATEGORY_CALLER = seededCategory('shipped host caller');
const CATEGORY_CALLEE = seededCategory('shipped host callee');
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);
const ADDRESS_CALLER = validatorAddress(CATEGORY_CALLER, VALIDATOR_PROGRAM);
const ADDRESS_CALLEE = validatorAddress(CATEGORY_CALLEE, VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));

const CALLER_ENTRY = 'Caller.callIt()';
const CALLEE_ENTRY = 'Callee.ping()';
const CALLEE_MASTER = 'callee-1';
const CALLEE_SELECTOR = computeFunctionSelector(computeFunctionSignature('ping', []));

/** A callee index the draft has not recorded yet; the codec reserves `0xffff` for "no callee" and refuses it. */
const UNFILLED_CALLEE = 0xfffe;

/** Master input indices: the caller, its callee, the validator that covers both, then the user. */
const CALLER_INDEX = 0;
const CALLEE_INDEX = 1;
const VALIDATOR_INDEX = 2;
const USER_INDEX = 3;

const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' interface ICallee { function ping(); }'
  + ' contract Callee { function ping() { require(true); } }'
  + ' contract Caller {'
  + `   function callIt() { ICallee(0x${toHex(ADDRESS_CALLEE)}).ping.call(); require(true); }`
  + ' }';

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;

const token = (
  category: Uint8Array,
  capability: 'minting' | 'mutable',
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable'; commitment: Uint8Array } } =>
  ({ category, amount: 0n, nft: { capability, commitment: new Uint8Array(0) } });

/** The compiled, filled programs plus the draft the host's runs mutate. */
interface Composition {
  readonly callerProgram: Uint8Array;
  readonly calleeProgram: Uint8Array;
  readonly callerBlock: WitnessBlock;
  readonly calleeBlock: WitnessBlock;
  readonly sourceOutputs: VmProgram['sourceOutputs'];
  readonly transaction: () => VmTransaction;
}

function buildComposition(): Composition {
  const artifacts = compileStringMulti(SOURCE, { composition: 'per-call' });
  const scriptBytes = (name: string): Uint8Array => {
    const artifact = artifacts[name]!;
    return fillPlaceholders(
      scriptToBytecode(asmToScript(artifact.bytecode)),
      artifact.composition!.placeholders,
      {
        category: name === 'Caller' ? categorySlotValue(CATEGORY_CALLER) : categorySlotValue(CATEGORY_CALLEE),
        contractAddress: name === 'Caller' ? ADDRESS_CALLER : ADDRESS_CALLEE,
        templateHash: TEMPLATE_HASH,
      },
    );
  };
  const callerProgram = scriptBytes('Caller');
  const calleeProgram = scriptBytes('Callee');

  const validator = validatorSpend(CATEGORY_CALLER, {
    roots: [CALLER_INDEX], masters: [CALLER_INDEX, CALLEE_INDEX], settles: [],
  });

  const callerBlock: WitnessBlock = {
    kind: FrameKind.ROOT,
    callerRef: USER_INDEX,
    originRef: USER_INDEX,
    validatorRef: VALIDATOR_INDEX,
    sender: USER_LOCK,
    self: ADDRESS_CALLER,
    value: 0n,
    retval: new Uint8Array(0),
    // The call record the source fixes: everything but the callee, which this draft has not recorded yet.
    calls: [{
      kind: FrameKind.CALL,
      target: ADDRESS_CALLEE,
      value: 0n,
      calleeRef: UNFILLED_CALLEE,
      argsHash: sha256(CALLEE_SELECTOR),
      result: new Uint8Array(0),
    }],
    segments: [[], []],
    events: [],
    sends: [],
  };
  const calleeBlock: WitnessBlock = {
    kind: FrameKind.CALL,
    callerRef: CALLER_INDEX,
    originRef: USER_INDEX,
    validatorRef: VALIDATOR_INDEX,
    sender: ADDRESS_CALLER,
    self: ADDRESS_CALLEE,
    value: 0n,
    retval: new Uint8Array(0),
    calls: [],
    segments: [[]],
    events: [],
    sends: [],
  };

  const callerLock = encodeLockingBytecodeP2sh32(hash256(callerProgram));
  const calleeLock = encodeLockingBytecodeP2sh32(hash256(calleeProgram));
  const masterValue = 20_000n;
  const sourceOutputs = [
    { lockingBytecode: callerLock, valueSatoshis: masterValue, token: token(CATEGORY_CALLER, 'minting') },
    { lockingBytecode: calleeLock, valueSatoshis: masterValue, token: token(CATEGORY_CALLEE, 'minting') },
    { lockingBytecode: validator.lock, valueSatoshis: masterValue, token: token(CATEGORY_CALLER, 'mutable') },
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
  ];
  const transaction = (): VmTransaction => ({
    version: 2,
    inputs: [
      {
        outpointIndex: 0,
        outpointTransactionHash: new Uint8Array(32).fill(1),
        sequenceNumber: 0xffffffff,
        unlockingBytecode: new Uint8Array([
          ...encodeDataPush(encodeWitnessBlock(callerBlock)), ...encodeDataPush(callerProgram),
        ]),
      },
      {
        outpointIndex: 0,
        outpointTransactionHash: new Uint8Array(32).fill(2),
        sequenceNumber: 0xffffffff,
        unlockingBytecode: new Uint8Array([
          ...encodeDataPush(encodeWitnessBlock(calleeBlock)),
          ...encodeDataPush(CALLEE_SELECTOR),
          ...encodeDataPush(calleeProgram),
        ]),
      },
      {
        outpointIndex: 0,
        outpointTransactionHash: new Uint8Array(32).fill(3),
        sequenceNumber: 0xffffffff,
        unlockingBytecode: validator.unlockingBytecode,
      },
      {
        outpointIndex: 0,
        outpointTransactionHash: new Uint8Array(32).fill(4),
        sequenceNumber: 0xffffffff,
        unlockingBytecode: callerUnlockingBytecode(),
      },
    ],
    outputs: sourceOutputs,
    locktime: 0,
  });
  return { callerProgram, calleeProgram, callerBlock, calleeBlock, sourceOutputs, transaction };
}

/** The host for the compiled caller and callee, driven by the real compiled programs. */
function buildHost(
  onRun?: (master: string, site: { readonly kind: string; readonly site: number }, stop: {
    readonly accepted: boolean;
  }) => void,
  vm?: Parameters<typeof createShippedDerivationHost>[0]['vm'],
): { host: ReturnType<typeof createShippedDerivationHost>; composition: Composition } {
  const artifacts = compileStringMulti(SOURCE, { composition: 'per-call' });
  const composition = buildComposition();
  const published = readPublishedStopSites(artifacts.Caller!);
  const callerEntry = published.entries.find((entry) => entry.functionName === CALLER_ENTRY)!;

  const program = (index: number): VmProgram => ({
    inputIndex: index,
    sourceOutputs: composition.sourceOutputs,
    transaction: composition.transaction(),
  });

  const callerRun: ShippedMasterRun = {
    master: 'caller-1',
    functionName: CALLER_ENTRY,
    program: composition.callerProgram,
    initialBlock: () => composition.callerBlock,
    programFor: () => program(CALLER_INDEX),
    fill: (site, block) => {
      if (site.kind !== 'call') return {};
      block.calls[site.callIndex]!.calleeRef = CALLEE_INDEX;
      return { callee: publishedCallee(callerEntry, site.callIndex, { contract: 'Callee', master: CALLEE_MASTER }) };
    },
  };
  const calleeRun: ShippedMasterRun = {
    master: CALLEE_MASTER,
    functionName: CALLEE_ENTRY,
    program: composition.calleeProgram,
    initialBlock: () => composition.calleeBlock,
    programFor: () => program(CALLEE_INDEX),
    // A stateless callee closes one segment that declares no record, so there is nothing to write.
    fill: () => ({}),
  };
  return {
    host: createShippedDerivationHost({
      artifacts: [artifacts.Caller!, artifacts.Callee!],
      runs: [callerRun, calleeRun],
      ...(onRun === undefined ? {} : { onRun }),
      ...(vm === undefined ? {} : { vm }),
    }),
    composition,
  };
}

describe('a host driving the derivation from a real compile', () => {
  it('publishes the caller and callee tables the host reads', () => {
    const artifacts = compileStringMulti(SOURCE, { composition: 'per-call' });
    const caller = readPublishedStopSites(artifacts.Caller!);
    const callee = readPublishedStopSites(artifacts.Callee!);
    expect(caller.entries.map((entry) => entry.functionName)).toStrictEqual([CALLER_ENTRY]);
    expect(callee.entries.map((entry) => entry.functionName)).toStrictEqual([CALLEE_ENTRY]);
    expect(caller.entries[0]!.calls).toStrictEqual([{
      callIndex: 0,
      interfaceName: 'ICallee',
      functionName: 'ping',
      target: toHex(ADDRESS_CALLEE),
      selector: toHex(CALLEE_SELECTOR),
    }]);
  });

  it('derives the caller, its callee completing first, stopping at the published sites', () => {
    const { host } = buildHost();
    const root = { contract: 'Caller', functionName: CALLER_ENTRY, kind: FrameKind.ROOT, master: 'caller-1' };

    const result = deriveDepthFirst(root, host);

    expect(result.runs.map((run) => [run.frame.functionName, run.site.site])).toStrictEqual([
      [CALLER_ENTRY, 0], // the call site: the callee is derived here
      [CALLEE_ENTRY, 0], // the callee's one segment close, completed inside the caller's run
      [CALLER_ENTRY, 1],
      [CALLER_ENTRY, 2],
    ]);
    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual([CALLEE_ENTRY, CALLER_ENTRY]);
    expect(result.completed.map((frame) => frame.master)).toStrictEqual([CALLEE_MASTER, 'caller-1']);
  });

  it('names the callee of the call site from the published table', () => {
    const { host } = buildHost();
    const root = { contract: 'Caller', functionName: CALLER_ENTRY, kind: FrameKind.ROOT, master: 'caller-1' };
    // The first run is the call site; the driver derives the callee it names before the caller resumes.
    const result = deriveDepthFirst(root, host);
    expect(result.completed[0]).toStrictEqual({
      contract: 'Callee',
      functionName: CALLEE_ENTRY,
      kind: FrameKind.CALL,
      master: CALLEE_MASTER,
    });
  });

  it('stops the real caller at the call site, and the run accepting only once the callee is recorded', () => {
    const verdicts: { master: string; kind: string; site: number; accepted: boolean }[] = [];
    const { host } = buildHost((master, site, stop) => {
      verdicts.push({ master, kind: site.kind, site: site.site, accepted: stop.accepted });
    });
    const root = { contract: 'Caller', functionName: CALLER_ENTRY, kind: FrameKind.ROOT, master: 'caller-1' };
    deriveDepthFirst(root, host);

    // The call site's two runs: the draft stops the real program, and filling the callee's index lets it accept.
    expect(verdicts[0]).toStrictEqual({ master: 'caller-1', kind: 'call', site: 0, accepted: false });
    expect(verdicts[1]).toStrictEqual({ master: 'caller-1', kind: 'call', site: 0, accepted: true });
    // The callee's segment close: the compiled callee accepts with its empty record list.
    expect(verdicts[2]).toStrictEqual({ master: CALLEE_MASTER, kind: 'segmentClose', site: 0, accepted: true });
  });

  it('refuses a site whose fill does not move the real program', () => {
    const artifacts = compileStringMulti(SOURCE, { composition: 'per-call' });
    const composition = buildComposition();
    const run: ShippedMasterRun = {
      master: 'caller-1',
      functionName: CALLER_ENTRY,
      program: composition.callerProgram,
      initialBlock: () => composition.callerBlock,
      programFor: () => ({
        inputIndex: CALLER_INDEX,
        sourceOutputs: composition.sourceOutputs,
        transaction: composition.transaction(),
      }),
      // The control: a fill that writes nothing, so the program stops where it did.
      fill: () => ({}),
    };
    const host = createShippedDerivationHost({ artifacts: [artifacts.Caller!], runs: [run] });
    const root = { contract: 'Caller', functionName: CALLER_ENTRY, kind: FrameKind.ROOT, master: 'caller-1' };
    expect(() => deriveDepthFirst(root, host)).toThrow(/PER_CALL_DERIVATION_STALLED/);
  });
});

const SOLO_ENTRY = 'Solo.ping()';
const SOLO_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Solo { function ping() { require(true); } }';

describe('a host driving a caller whose entry makes no call', () => {
  it('publishes and derives the single segment close, running the compiled master', () => {
    const category = seededCategory('shipped host solo');
    const artifacts = compileStringMulti(SOLO_SOURCE, { composition: 'per-call' });
    const artifact = artifacts.Solo!;
    const address = validatorAddress(category, VALIDATOR_PROGRAM);
    const program = fillPlaceholders(
      scriptToBytecode(asmToScript(artifact.bytecode)),
      artifact.composition!.placeholders,
      { category: categorySlotValue(category), contractAddress: address, templateHash: TEMPLATE_HASH },
    );
    const published = readPublishedStopSites(artifact);
    expect(published.entries[0]!.sites.sites).toStrictEqual([
      { kind: 'segmentClose', site: 0, segmentIndex: 0 },
    ]);

    const lock = encodeLockingBytecodeP2sh32(hash256(program));
    const block: WitnessBlock = {
      kind: FrameKind.ROOT,
      callerRef: 0,
      originRef: 0,
      validatorRef: 0xffff,
      sender: USER_LOCK,
      self: address,
      value: 0n,
      retval: new Uint8Array(0),
      calls: [],
      segments: [[]],
      events: [],
      sends: [],
    };
    const sourceOutputs = [
      { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
      { lockingBytecode: lock, valueSatoshis: 20_000n, token: token(category, 'minting') },
    ];
    const programFor = (): VmProgram => ({
      inputIndex: 1,
      sourceOutputs,
      transaction: {
        version: 2,
        inputs: [
          {
            outpointIndex: 0,
            outpointTransactionHash: new Uint8Array(32),
            sequenceNumber: 0xffffffff,
            unlockingBytecode: callerUnlockingBytecode(),
          },
          {
            outpointIndex: 1,
            outpointTransactionHash: new Uint8Array(32).fill(1),
            sequenceNumber: 0xffffffff,
            unlockingBytecode: new Uint8Array([
              ...encodeDataPush(encodeWitnessBlock(block)), ...encodeDataPush(program),
            ]),
          },
        ],
        outputs: sourceOutputs,
        locktime: 0,
      },
    });
    const verdicts: boolean[] = [];
    const host = createShippedDerivationHost({
      artifacts: [artifact],
      runs: [{
        master: 'solo-1',
        functionName: SOLO_ENTRY,
        program,
        initialBlock: () => block,
        programFor,
        fill: () => ({}),
      }],
      onRun: (_master, _site, stop) => verdicts.push(stop.accepted),
    });

    const result = deriveDepthFirst(
      { contract: 'Solo', functionName: SOLO_ENTRY, kind: FrameKind.ROOT, master: 'solo-1' },
      host,
    );

    expect(result.runs.map((run) => [run.frame.functionName, run.site.site])).toStrictEqual([[SOLO_ENTRY, 0]]);
    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual([SOLO_ENTRY]);
    // The compiled standalone master accepts the real spend, so the segment's empty record list is its witness.
    expect(verdicts).toStrictEqual([true, true]);
  });

  it('refuses an artifact that publishes no stop-site table', () => {
    // A master compiled before the table existed, or one compiled for the direct convention, publishes nothing:
    // the host has to refuse it rather than derive against a guessed set of sites.
    const artifact = compileStringMulti(SOURCE, { composition: 'per-call' }).Caller!;
    const withoutTable: { [key: string]: unknown } = { ...artifact.composition as { [key: string]: unknown } };
    delete withoutTable.stopSites;
    expect(() => readPublishedStopSites({ composition: withoutTable }))
      .toThrow(/PER_CALL_HOST_STOP_SITES_UNPUBLISHED/);
    expect(() => createShippedDerivationHost({ artifacts: [{ composition: withoutTable }], runs: [] }))
      .toThrow(/PER_CALL_HOST_STOP_SITES_UNPUBLISHED/);
  });

  it('refuses a stop-site table whose schema version it does not know', () => {
    // The schema is frozen with a version, so a table written by a later compiler is refused by name rather than
    // read as if it had today's shape.
    const artifact = compileStringMulti(SOURCE, { composition: 'per-call' }).Caller!;
    const composition = artifact.composition as { stopSites?: { version?: number } };
    const future = { ...composition, stopSites: { ...composition.stopSites, version: 2 } };
    expect(() => readPublishedStopSites({ composition: future }))
      .toThrow(/PER_CALL_HOST_STOP_SITES_VERSION/);
  });
});

describe('the runs a derivation spends', () => {
  it('runs each master once per site after the first, not twice', () => {
    // The state a step starts from is the state the previous step's run ended on, so the run before a fill is only
    // needed for a master's first site. Counting the machine's own evaluations pins the saving: the caller publishes
    // three sites (its call and the two segment closes) and the callee one, so the derivation spends four fresh
    // runs and two reused verdicts, against eight runs if every site ran the program before and after its fill.
    const machine = createVirtualMachineBch2026(false);
    let evaluations = 0;
    const counting = new Proxy(machine, {
      get(target, property, receiver) {
        if (property === 'evaluate') {
          return (program: Parameters<typeof target.evaluate>[0]) => {
            evaluations += 1;
            return target.evaluate(program);
          };
        }
        return Reflect.get(target, property, receiver);
      },
    });
    const { host } = buildHost(undefined, counting as ReturnType<typeof createVirtualMachineBch2026>);
    deriveDepthFirst(
      { contract: 'Caller', functionName: CALLER_ENTRY, kind: FrameKind.ROOT, master: 'caller-1' },
      host,
    );
    expect(evaluations).toBe(6);
  });
});
