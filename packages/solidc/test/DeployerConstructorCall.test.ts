/**
 * A7/B7.16: a constructor's external call through Deploy<C>.
 *
 * The constructor's call slot names one callee input. The create checks that input's code, computes the digest over
 * `ff ff ‖ tag ‖ selector ‖ arguments`, reads the callee's record at the slot's return index and pins the caller-edge
 * when the slot names one. These cases drive the real `create` on the BCH 2026 VM; the callee's own arm runs as the
 * callee input, so the whole creation is judged, not a re-implementation of it.
 */
import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2sh32, hash256, hexToBin,
  sha256 as libsha,
} from '@bitauth/libauth';
import {
  buildDataNftCovenantScript, buildPushdataCommitment, scriptToBytecode,
  type Artifact, type DeployerAbi,
} from '@solidcash/utils';
import { compileString } from '../src/index.js';
import { createUnlockingBytecode } from '../../solidcash/src/utils.js';

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];
type VmInput = VmTransaction['inputs'][number];
type SourceOutputs = NonNullable<VmProgram['sourceOutputs']>;

const P = 'pragma solidcash ^0.51.0;';
const EMPTY = new Uint8Array(0);
const TOKENLESS = Uint8Array.from([0x51]);
const OUTBASE = 5;
const DEPLOYER_INPUT = 3;
const vm = createVirtualMachineBch2026();

const pushes = (values: readonly Uint8Array[]): Uint8Array =>
  new Uint8Array(values.flatMap((value) => [...encodeDataPush(value)]));

const dummyInput = (index: number): VmInput => ({
  outpointIndex: 0,
  outpointTransactionHash: Uint8Array.from({ length: 32 }, (_, i) => (0x40 + index + i * 19) & 0xff),
  sequenceNumber: 0xffffffff,
  unlockingBytecode: EMPTY,
});

/** The author coin (X, 1) of the deployer coin at input DEPLOYER_INPUT (A4.3 step 4), at input 1. */
const authorInput = (): VmInput => ({
  ...dummyInput(1), outpointTransactionHash: dummyInput(DEPLOYER_INPUT).outpointTransactionHash, outpointIndex: 1,
});

/** The selector at the bottom, then the ABI arguments with the first on top, then the redeem. */
const createUnlock = (deployer: DeployerAbi, values: Record<string, Uint8Array>): Uint8Array => {
  const fn = deployer.abi.find((entry) => entry.name === 'create');
  if (!fn) throw new Error('no create arm');
  const args = fn.inputs.map((input) => values[input.name] ?? new Uint8Array()).reverse();
  if (fn.selector) args.unshift(hexToBin(fn.selector));
  return new Uint8Array([...pushes(args), ...encodeDataPush(hexToBin(deployer.bytecode))]);
};

/** The category `x`, C's redeem and master lock for a deployer seeded at `seedIndex`. */
type Masters = { x: Uint8Array; redeem: Uint8Array; master: Uint8Array };
const masters = (deployer: DeployerAbi, seedIndex = DEPLOYER_INPUT): Masters => {
  const x = dummyInput(seedIndex).outpointTransactionHash;
  const category = Uint8Array.from([...x.slice().reverse(), 0x02]);
  const redeem = new Uint8Array([...encodeDataPush(category), 0xc0, 0xce, 0x88, ...hexToBin(deployer.code)]);
  return { x, redeem, master: encodeLockingBytecodeP2sh32(hash256(redeem)) };
};

const dataOutput = (
  artifact: Artifact, values: Record<string, bigint>, category: Uint8Array, master: Uint8Array,
): VmOutput => ({
  lockingBytecode: encodeLockingBytecodeP2sh32(hash256(scriptToBytecode(
    buildDataNftCovenantScript(category, master),
  ))),
  valueSatoshis: 1200n,
  token: {
    category, amount: 0n,
    nft: { capability: 'mutable', commitment: hexToBin(buildPushdataCommitment(artifact.stateLayout!, values, 0)) },
  },
});

const calleeSource = (name: string): string => `${P} interface I { function f(int x) external returns (bool); }
contract ${name} { bool ok; function f(int x) external returns (bool) { ok = true; return true; } }`;

const callerSource = (calleeName: string, body: string): string =>
  `${P} interface I { function f(int x) external returns (bool); }
contract ${calleeName} { bool ok; function f(int x) external returns (bool) { ok = true; return true; } }
contract C { bool ok; constructor(I i) { ${body} } }`;

interface CalleeRun {
  input: VmInput;
  dataInput: VmInput;
  source: SourceOutputs[number];
  dataSource: SourceOutputs[number];
  outputs: VmOutput[];
  tag: Uint8Array;
  inputIndex: number;
}

/**
 * The callee's master and data inputs and its outputs (master, data, return record). `ge` is the category the tag
 * names, `calleeSeed` seeds the callee's own category, and `slot` is written into the tag.
 */
const calleeRun = (options: {
  callee: Artifact;
  calleeSeed: number;
  callerX: Uint8Array;
  callerSlot: number;
  gIn: number;
  gOut: number;
  unlock: Uint8Array;
  inputIndex: number;
  returnIndex: number;
  record: (digest31: Uint8Array) => Uint8Array;
  callDigest: Uint8Array;
}): CalleeRun => {
  const { callee, calleeSeed, callerX, callerSlot, gIn, gOut, unlock, inputIndex } = options;
  const calleeDeployer = callee.deployer!;
  const master = masters(calleeDeployer, calleeSeed);
  const tag = new Uint8Array([
    ...callerX, callerSlot & 0xff, (callerSlot >> 8) & 0xff, gIn & 0xff, (gIn >> 8) & 0xff,
    gOut & 0xff, (gOut >> 8) & 0xff,
    0, 0, 0, 0, 0, 0, 0, 0,
  ]);
  const record = options.record(options.callDigest);
  const returnOutput: VmOutput = {
    lockingBytecode: Uint8Array.of(0x51),
    valueSatoshis: 1000n,
    token: { category: master.x, amount: 0n, nft: { capability: 'none', commitment: record } },
  };
  const calleeData = dataOutput(callee, { ok: 0n }, master.x, master.master);
  const dataRedeem = scriptToBytecode(buildDataNftCovenantScript(master.x, master.master));
  return {
    inputIndex,
    tag,
    input: { ...dummyInput(inputIndex), unlockingBytecode: unlock },
    dataInput: { ...dummyInput(inputIndex + 1), unlockingBytecode: new Uint8Array([...encodeDataPush(dataRedeem)]) },
    source: {
      lockingBytecode: master.master, valueSatoshis: 1200n,
      token: { category: master.x, amount: 0n, nft: { capability: 'minting', commitment: EMPTY } },
    },
    dataSource: calleeData as SourceOutputs[number],
    outputs: [
      {
        lockingBytecode: master.master, valueSatoshis: 1200n,
        token: { category: master.x, amount: 0n, nft: { capability: 'minting', commitment: EMPTY } },
      },
      dataOutput(callee, { ok: 1n }, master.x, master.master),
      returnOutput,
    ],
  };
};

/**
 * The digest the caller computes: `ff ff ‖ X ‖ slot ‖ selector ‖ size ‖ argument`, the tag being the parameter's
 * first 34 bytes (A7).
 */
const callDigest = (tag: Uint8Array, selector: string, argument: Uint8Array): Uint8Array => {
  const preimage = new Uint8Array([
    0xff, 0xff, ...tag.slice(0, 34), ...hexToBin(selector), argument.length & 0xff, (argument.length >> 8) & 0xff,
    ...argument,
  ]);
  return libsha.hash(preimage).slice(0, 31);
};

describe('A7: a constructor call in create', () => {
  it('passes when the callee publishes the tagged record and its outputs sit at its input index', () => {
    const callee = compileString(calleeSource('T'), { deployer: true, messageBus: false, genesisCalls: true });
    const caller = compileString(callerSource('T', 'i.f(5); ok = true;'), {
      deployer: true, messageBus: false, genesisCalls: true, primaryContractName: 'C',
    });
    const x = masters(caller.deployer!).x;
    const calleeMaster = masters(callee.deployer!, 7);
    const calleeArgs = [Uint8Array.of(0x05), new Uint8Array(36), Uint8Array.of(9)];
    const tag = new Uint8Array([...x.slice().reverse(), 0, 0, DEPLOYER_INPUT & 0xff, 0]);
    calleeArgs[1] = tag;
    const digest = callDigest(tag, '32c0b359', Uint8Array.of(0x05));
    const run = calleeRun({
      callee, calleeSeed: 7, callerX: x.slice().reverse(), callerSlot: 0, gIn: DEPLOYER_INPUT, gOut: OUTBASE,
      unlock: createUnlockingBytecode('p2sh32', calleeMaster.redeem, calleeArgs),
      inputIndex: 7, returnIndex: 9,
      callDigest: digest,
      record: (d) => new Uint8Array([...d, 0x01, 0x51]),
    });
    const values: Record<string, Uint8Array> = {
      __internal__budgetPad: EMPTY,
      __internal__authorIndex: Uint8Array.of(0x01),
      __internal__identity: EMPTY,
      __internal__genesisOutputBase: Uint8Array.of(OUTBASE),
      __internal__genesisSidecarBase: Uint8Array.of(OUTBASE + 2),
      __internal__externalCallInputBase: Uint8Array.of(7),
      __internal__extcallAnchorIdx0: Uint8Array.of(0x81),
      __internal__externalReturnOutputIdx: Uint8Array.of(9),
      __internal__callEdgeOutputIdx0: Uint8Array.of(0x81),
      __internal__code: hexToBin(caller.deployer!.code),
      __internal__deployValue: EMPTY,
      __internal__msgSenderCategory: new Uint8Array(32),
      __internal__genesisCallees: Uint8Array.of(7, 0),
      i: calleeMaster.master,
    };
    const outputs: VmOutput[] = Array.from({ length: OUTBASE }, () => ({
      lockingBytecode: TOKENLESS, valueSatoshis: 1000n,
    }));
    outputs.push(
      { lockingBytecode: masters(caller.deployer!).master, valueSatoshis: 1200n,
        token: { category: x, amount: 0n, nft: { capability: 'minting', commitment: EMPTY } } },
      dataOutput(caller, { ok: 1n }, x, masters(caller.deployer!).master),
      ...run.outputs,
    );
    const inputs = [dummyInput(0), authorInput(), dummyInput(2), {
      ...dummyInput(DEPLOYER_INPUT), unlockingBytecode: createUnlock(caller.deployer!, values),
    }, ...Array.from({ length: 3 }, (_, i) => dummyInput(4 + i)), run.input, run.dataInput];
    const sources: SourceOutputs = [
      ...[0, 1, 2, 4, 5, 6].map(() => ({ lockingBytecode: TOKENLESS, valueSatoshis: 10_000n })),
    ];
    sources.splice(3, 0, { lockingBytecode: hexToBin(caller.deployer!.lockingBytecode), valueSatoshis: 1200n });
    sources.push(run.source, run.dataSource);
    const program = { inputIndex: DEPLOYER_INPUT, sourceOutputs: sources, transaction: {
      version: 2, locktime: 0, inputs, outputs,
    } };
    const state = vm.evaluate(program as never);
    expect(vm.stateSuccess(state)).toBe(true);
  });

  it('fails when the callee is answered with an untagged record', () => {
    const callee = compileString(calleeSource('T'), { deployer: true, messageBus: false, genesisCalls: true });
    const caller = compileString(callerSource('T', 'i.f(5); ok = true;'), {
      deployer: true, messageBus: false, genesisCalls: true, primaryContractName: 'C',
    });
    const x = masters(caller.deployer!).x;
    const calleeMaster = masters(callee.deployer!, 7);
    const digest = callDigest(new Uint8Array(36), '32c0b359', Uint8Array.of(0x05));
    const run = calleeRun({
      callee, calleeSeed: 7, callerX: x.slice().reverse(), callerSlot: 0, gIn: DEPLOYER_INPUT, gOut: OUTBASE,
      unlock: createUnlockingBytecode('p2sh32', calleeMaster.redeem, [
        Uint8Array.of(0x05), EMPTY, Uint8Array.of(9),
      ]),
      inputIndex: 7, returnIndex: 9,
      callDigest: digest,
      record: (d) => new Uint8Array([...d, 0x01, 0x51]),
    });
    const values: Record<string, Uint8Array> = {
      __internal__budgetPad: EMPTY,
      __internal__authorIndex: Uint8Array.of(0x01),
      __internal__identity: EMPTY,
      __internal__genesisOutputBase: Uint8Array.of(OUTBASE),
      __internal__genesisSidecarBase: Uint8Array.of(OUTBASE + 2),
      __internal__externalCallInputBase: Uint8Array.of(7),
      __internal__extcallAnchorIdx0: Uint8Array.of(0x81),
      __internal__externalReturnOutputIdx: Uint8Array.of(9),
      __internal__callEdgeOutputIdx0: Uint8Array.of(0x81),
      __internal__code: hexToBin(caller.deployer!.code),
      __internal__deployValue: EMPTY,
      __internal__msgSenderCategory: new Uint8Array(32),
      __internal__genesisCallees: Uint8Array.of(7, 0),
      i: calleeMaster.master,
    };
    const outputs: VmOutput[] = Array.from({ length: OUTBASE }, () => ({
      lockingBytecode: TOKENLESS, valueSatoshis: 1000n,
    }));
    outputs.push(
      { lockingBytecode: masters(caller.deployer!).master, valueSatoshis: 1200n,
        token: { category: x, amount: 0n, nft: { capability: 'minting', commitment: EMPTY } } },
      dataOutput(caller, { ok: 1n }, x, masters(caller.deployer!).master),
      ...run.outputs,
    );
    const inputs = [dummyInput(0), authorInput(), dummyInput(2), {
      ...dummyInput(DEPLOYER_INPUT), unlockingBytecode: createUnlock(caller.deployer!, values),
    }, ...Array.from({ length: 3 }, (_, i) => dummyInput(4 + i)), run.input, run.dataInput];
    const sources: SourceOutputs = [
      ...[0, 1, 2, 4, 5, 6].map(() => ({ lockingBytecode: TOKENLESS, valueSatoshis: 10_000n })),
    ];
    sources.splice(3, 0, { lockingBytecode: hexToBin(caller.deployer!.lockingBytecode), valueSatoshis: 1200n });
    sources.push(run.source, run.dataSource);
    const program = { inputIndex: DEPLOYER_INPUT, sourceOutputs: sources, transaction: {
      version: 2, locktime: 0, inputs, outputs,
    } };
    expect(vm.stateSuccess(vm.evaluate(program as never))).not.toBe(true);
  });

  it('binds both slots of a two-call constructor', () => {
    const source = `${P} interface IA { function f(int x) external returns (bool); }
      interface IB { function g(int x) external returns (bool); }
      contract T1 { bool a; function f(int x) external returns (bool) { a = true; return true; } }
      contract T2 { bool b; function g(int x) external returns (bool) { b = true; return true; } }
      contract C { bool ok; constructor(IA x, IB y) { ok = x.f(1); y.g(2); } }`;
    const caller = compileString(source, {
      deployer: true, messageBus: false, genesisCalls: true, primaryContractName: 'C',
    } as never);
    const calleeA = compileString(source, {
      deployer: true, messageBus: false, genesisCalls: true, primaryContractName: 'T1',
    } as never);
    const calleeB = compileString(source, {
      deployer: true, messageBus: false, genesisCalls: true, primaryContractName: 'T2',
    } as never);
    const x = masters(caller.deployer!).x;
    const aMaster = masters(calleeA.deployer!, 7);
    const bMaster = masters(calleeB.deployer!, 10);
    const selectorA = calleeA.abi.find((entry) => entry.name === 'f')!.selector!;
    const selectorB = calleeB.abi.find((entry) => entry.name === 'g')!.selector!;
    const tagA = new Uint8Array([...x.slice().reverse(), 0, 0, DEPLOYER_INPUT & 0xff, 0]);
    const tagB = new Uint8Array([...x.slice().reverse(), 1, 0, DEPLOYER_INPUT & 0xff, 0]);
    const digestA = callDigest(tagA, selectorA, Uint8Array.of(0x01));
    const digestB = callDigest(tagB, selectorB, Uint8Array.of(0x02));
    const runA = calleeRun({
      callee: calleeA, calleeSeed: 7, callerX: x.slice().reverse(), callerSlot: 0,
      gIn: DEPLOYER_INPUT, gOut: OUTBASE,
      unlock: createUnlockingBytecode('p2sh32', aMaster.redeem, [Uint8Array.of(0x01), tagA, Uint8Array.of(9)]),
      inputIndex: 7, returnIndex: 9, callDigest: digestA,
      record: (d) => new Uint8Array([...d, 0x01, 0x51]),
    });
    const runB = calleeRun({
      callee: calleeB, calleeSeed: 10, callerX: x.slice().reverse(), callerSlot: 1,
      gIn: DEPLOYER_INPUT, gOut: OUTBASE,
      unlock: createUnlockingBytecode('p2sh32', bMaster.redeem, [Uint8Array.of(0x02), tagB, Uint8Array.of(12)]),
      inputIndex: 10, returnIndex: 12, callDigest: digestB,
      record: (d) => new Uint8Array([...d, 0x01, 0x51]),
    });
    const values: Record<string, Uint8Array> = {
      __internal__budgetPad: EMPTY,
      __internal__authorIndex: Uint8Array.of(0x01),
      __internal__identity: EMPTY,
      __internal__genesisOutputBase: Uint8Array.of(OUTBASE),
      __internal__genesisSidecarBase: Uint8Array.of(OUTBASE + 2),
      __internal__externalCallInputBase: Uint8Array.of(7),
      __internal__extcallMasterIdx0: Uint8Array.of(7),
      __internal__extcallMasterIdx1: Uint8Array.of(10),
      __internal__extcallAnchorIdx0: Uint8Array.of(0x81),
      __internal__extcallAnchorIdx1: Uint8Array.of(0x81),
      __internal__externalReturnOutputIdx0: Uint8Array.of(9),
      __internal__externalReturnOutputIdx1: Uint8Array.of(12),
      __internal__callEdgeOutputIdx0: Uint8Array.of(0x81),
      __internal__callEdgeOutputIdx1: Uint8Array.of(0x81),
      __internal__code: hexToBin(caller.deployer!.code),
      __internal__deployValue: EMPTY,
      __internal__msgSenderCategory: new Uint8Array(32),
      __internal__genesisCallees: Uint8Array.of(7, 0, 10, 0),
      x: aMaster.master,
      y: bMaster.master,
    };
    const outputs: VmOutput[] = Array.from({ length: OUTBASE }, () => ({
      lockingBytecode: TOKENLESS, valueSatoshis: 1000n,
    }));
    outputs.push(
      { lockingBytecode: masters(caller.deployer!).master, valueSatoshis: 1200n,
        token: { category: x, amount: 0n, nft: { capability: 'minting', commitment: EMPTY } } },
      dataOutput(caller, { ok: 1n }, x, masters(caller.deployer!).master),
      ...runA.outputs,
      ...runB.outputs,
    );
    const inputs = [dummyInput(0), authorInput(), dummyInput(2), {
      ...dummyInput(DEPLOYER_INPUT), unlockingBytecode: createUnlock(caller.deployer!, values),
    }, ...Array.from({ length: 3 }, (_, i) => dummyInput(4 + i)), runA.input, runA.dataInput,
    dummyInput(9), runB.input, runB.dataInput];
    const fillerSource = { lockingBytecode: TOKENLESS, valueSatoshis: 10_000n };
    const sources: SourceOutputs = [
      fillerSource, fillerSource, fillerSource,
      { lockingBytecode: hexToBin(caller.deployer!.lockingBytecode), valueSatoshis: 1200n },
      fillerSource, fillerSource, fillerSource,
      runA.source, runA.dataSource, fillerSource, runB.source, runB.dataSource,
    ];
    const program = { inputIndex: DEPLOYER_INPUT, sourceOutputs: sources, transaction: {
      version: 2, locktime: 0, inputs, outputs,
    } };
    const state = vm.evaluate(program as never) as any;
    expect(vm.stateSuccess(state)).toBe(true);
  });



  it('reports a callee unlocking shorter than 300 bytes at its code-marker check', () => {
    const callee = compileString(calleeSource('T'), { deployer: true, messageBus: false, genesisCalls: true });
    const caller = compileString(callerSource('T', 'i.f(5); ok = true;'), {
      deployer: true, messageBus: false, genesisCalls: true, primaryContractName: 'C',
    });
    const x = masters(caller.deployer!).x;
    const calleeMaster = masters(callee.deployer!, 7);
    const digest = callDigest(new Uint8Array(36), '32c0b359', Uint8Array.of(0x05));
    const run = calleeRun({
      callee, calleeSeed: 7, callerX: x.slice().reverse(), callerSlot: 0, gIn: DEPLOYER_INPUT, gOut: OUTBASE,
      unlock: Uint8Array.of(0x51),
      inputIndex: 7, returnIndex: 9,
      callDigest: digest,
      record: (d) => new Uint8Array([...d, 0x01, 0x51]),
    });
    const values: Record<string, Uint8Array> = {
      __internal__budgetPad: EMPTY,
      __internal__authorIndex: Uint8Array.of(0x01),
      __internal__identity: EMPTY,
      __internal__genesisOutputBase: Uint8Array.of(OUTBASE),
      __internal__genesisSidecarBase: Uint8Array.of(OUTBASE + 2),
      __internal__externalCallInputBase: Uint8Array.of(7),
      __internal__extcallAnchorIdx0: Uint8Array.of(0x81),
      __internal__externalReturnOutputIdx: Uint8Array.of(9),
      __internal__callEdgeOutputIdx0: Uint8Array.of(0x81),
      __internal__code: hexToBin(caller.deployer!.code),
      __internal__deployValue: EMPTY,
      __internal__msgSenderCategory: new Uint8Array(32),
      __internal__genesisCallees: Uint8Array.of(7, 0),
      i: calleeMaster.master,
    };
    const outputs: VmOutput[] = Array.from({ length: OUTBASE }, () => ({
      lockingBytecode: TOKENLESS, valueSatoshis: 1000n,
    }));
    outputs.push(
      { lockingBytecode: masters(caller.deployer!).master, valueSatoshis: 1200n,
        token: { category: x, amount: 0n, nft: { capability: 'minting', commitment: EMPTY } } },
      dataOutput(caller, { ok: 1n }, x, masters(caller.deployer!).master),
      ...run.outputs,
    );
    const inputs = [dummyInput(0), authorInput(), dummyInput(2), {
      ...dummyInput(DEPLOYER_INPUT), unlockingBytecode: createUnlock(caller.deployer!, values),
    }, ...Array.from({ length: 3 }, (_, i) => dummyInput(4 + i)), run.input, run.dataInput];
    const sources: SourceOutputs = [
      ...[0, 1, 2, 4, 5, 6].map(() => ({ lockingBytecode: TOKENLESS, valueSatoshis: 10_000n })),
    ];
    sources.splice(3, 0, { lockingBytecode: hexToBin(caller.deployer!.lockingBytecode), valueSatoshis: 1200n });
    sources.push(run.source, run.dataSource);
    const program = { inputIndex: DEPLOYER_INPUT, sourceOutputs: sources, transaction: {
      version: 2, locktime: 0, inputs, outputs,
    } };
    const state = vm.evaluate(program as never) as { error?: string };
    // A one-byte unlocking has no 23 bytes to hold the code marker: the split that reads it fails.
    expect(state.error).toMatch(/OP_VERIFY|OP_EQUALVERIFY|OP_SPLIT|marker|unlocking/i);
  });
});

/**
 * A4.3 steps 10 and 14: `create` binds the call it accepts. The carrier at the return index is the callee's own record
 * (its category, no capability, no units, lock `51`, at most 1,200 satoshis), the callee's code is record-sound, and
 * a tagged callee entry runs only where X is created.
 */
describe('A7: create binds the record it accepts to the callee', () => {
  const build = (options: {
    carrier?: (output: VmOutput) => VmOutput;
    calleeUnlock?: (unlocking: Uint8Array) => Uint8Array;
    tagGIn?: number;
  } = {}) => {
    const callee = compileString(calleeSource('T'), { deployer: true, messageBus: false, genesisCalls: true });
    const caller = compileString(callerSource('T', 'i.f(5); ok = true;'), {
      deployer: true, messageBus: false, genesisCalls: true, primaryContractName: 'C',
    });
    const x = masters(caller.deployer!).x;
    const calleeMaster = masters(callee.deployer!, 7);
    const tag = new Uint8Array([...x.slice().reverse(), 0, 0, (options.tagGIn ?? DEPLOYER_INPUT) & 0xff, 0]);
    // The argument, the genesis call, the reader (none: a tagged record names its reader by X) and the record's output.
    const unlock = createUnlockingBytecode('p2sh32', calleeMaster.redeem, [
      Uint8Array.of(0x05), tag, Uint8Array.of(0x81), Uint8Array.of(9),
    ]);
    const run = calleeRun({
      callee, calleeSeed: 7, callerX: x.slice().reverse(), callerSlot: 0, gIn: DEPLOYER_INPUT, gOut: OUTBASE,
      unlock: options.calleeUnlock?.(unlock) ?? unlock, inputIndex: 7, returnIndex: 9,
      callDigest: callDigest(tag, '32c0b359', Uint8Array.of(0x05)),
      record: (d) => new Uint8Array([...d, 0x01, 0x51]),
    });
    const values: Record<string, Uint8Array> = {
      __internal__budgetPad: EMPTY,
      __internal__authorIndex: Uint8Array.of(0x01),
      __internal__identity: EMPTY,
      __internal__genesisOutputBase: Uint8Array.of(OUTBASE),
      __internal__genesisSidecarBase: Uint8Array.of(OUTBASE + 2),
      __internal__externalCallInputBase: Uint8Array.of(7),
      __internal__extcallAnchorIdx0: Uint8Array.of(0x81),
      __internal__externalReturnOutputIdx: Uint8Array.of(9),
      __internal__callEdgeOutputIdx0: Uint8Array.of(0x81),
      __internal__code: hexToBin(caller.deployer!.code),
      __internal__deployValue: EMPTY,
      __internal__msgSenderCategory: new Uint8Array(32),
      __internal__genesisCallees: Uint8Array.of(7, 0),
      i: calleeMaster.master,
    };
    const outputs: VmOutput[] = Array.from({ length: OUTBASE }, () => ({
      lockingBytecode: TOKENLESS, valueSatoshis: 1000n,
    }));
    outputs.push(
      { lockingBytecode: masters(caller.deployer!).master, valueSatoshis: 1200n,
        token: { category: x, amount: 0n, nft: { capability: 'minting', commitment: EMPTY } } },
      dataOutput(caller, { ok: 1n }, x, masters(caller.deployer!).master),
      run.outputs[0]!, run.outputs[1]!, options.carrier?.(run.outputs[2]!) ?? run.outputs[2]!,
    );
    const inputs = [dummyInput(0), authorInput(), dummyInput(2), {
      ...dummyInput(DEPLOYER_INPUT), unlockingBytecode: createUnlock(caller.deployer!, values),
    }, ...Array.from({ length: 3 }, (_, i) => dummyInput(4 + i)), run.input, run.dataInput];
    const sources: SourceOutputs = [
      ...[0, 1, 2, 4, 5, 6].map(() => ({ lockingBytecode: TOKENLESS, valueSatoshis: 10_000n })),
    ];
    sources.splice(3, 0, { lockingBytecode: hexToBin(caller.deployer!.lockingBytecode), valueSatoshis: 1200n });
    sources.push(run.source, run.dataSource);
    return (inputIndex: number) => ({
      inputIndex, sourceOutputs: sources, transaction: { version: 2, locktime: 0, inputs, outputs },
    });
  };
  const passes = (program: unknown): boolean => vm.stateSuccess(vm.evaluate(program as never)) === true;

  it('accepts the honest creation, and the callee input passes', () => {
    const program = build();
    expect(passes(program(DEPLOYER_INPUT))).toBe(true);
    expect(passes(program(7))).toBe(true);
  });

  it('refuses the record on a carrier of another category', () => {
    expect(passes(build({
      carrier: (output) => ({ ...output, token: { ...output.token!, category: new Uint8Array(32).fill(0x5a) } }),
    })(DEPLOYER_INPUT))).toBe(false);
  });

  it('refuses a carrier with a capability or fungible units', () => {
    expect(passes(build({
      carrier: (output) => ({ ...output, token: { ...output.token!, nft: { ...output.token!.nft!, capability: 'mutable' } } }),
    })(DEPLOYER_INPUT))).toBe(false);
    expect(passes(build({
      carrier: (output) => ({ ...output, token: { ...output.token!, amount: 5n } }),
    })(DEPLOYER_INPUT))).toBe(false);
  });

  it('refuses a carrier at another lock or above 1,200 satoshis', () => {
    expect(passes(build({ carrier: (output) => ({ ...output, lockingBytecode: Uint8Array.of(0x52) }) })(DEPLOYER_INPUT)))
      .toBe(false);
    expect(passes(build({ carrier: (output) => ({ ...output, valueSatoshis: 1201n }) })(DEPLOYER_INPUT))).toBe(false);
  });

  it('refuses a callee whose code marker lacks the record-sound flag', () => {
    expect(passes(build({
      calleeUnlock: (unlocking) => Uint8Array.from(unlocking, (byte, i) => (i === unlocking.length - 2 ? 0x00 : byte)),
    })(DEPLOYER_INPUT))).toBe(false);
  });

  it('refuses a tagged callee run whose g_in does not spend (X, 0)', () => {
    // The digest covers the tag X ‖ slot only, so create still accepts the record; the callee refuses the run.
    const program = build({ tagGIn: 2 });
    expect(passes(program(DEPLOYER_INPUT))).toBe(true);
    expect(passes(program(7))).toBe(false);
  });
});

/**
 * A4.3 steps 12 and 14: the epilogue settles the calls before it pins the body's events, so an event the constructor
 * emits after its last call keeps its blob through the call settlement. `DeployerConstructorCalls.e2e` runs the create.
 */
describe('A7: an emit after a constructor call', () => {
  it('compiles the create of a constructor that emits after it calls, with the event in the genesis range', () => {
    const source = `${P} interface I { function f(int x) external returns (bool); }
      contract T { bool ok; function f(int x) external returns (bool) { ok = true; return true; } }
      contract C { bool ok; event Made(int v); constructor(I i) { ok = i.f(5); emit Made(7); } }`;
    const caller = compileString(source, {
      deployer: true, messageBus: false, genesisCalls: true, primaryContractName: 'C',
    } as never);
    expect(caller.deployer?.callSlots).toBe(1);
    expect(caller.deployer?.abi.find((entry) => entry.name === 'create')?.blockLayout?.slots.map((slot) => slot.kind))
      .toEqual(['master', 'dataNft', 'event']);
  });
});
