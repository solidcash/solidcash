import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import {
  encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256, Opcodes,
} from '@bitauth/libauth';
import {
  asmToBytecode, buildKernelCapabilitySchema, chainCategory, encodeTranscript, encodeWitnessBlock,
  FrameKind, functionSplitLoaderLock, functionSplitLoaderScript, isRejectedFunctionLoader, sha256,
  TokenCapability, validatorAddress, validatorRedeemScript, type WitnessBlock,
} from '@solidcash/utils';
import { compileString, compileStringSplit } from '../src/compiler.js';
import { SolidcDiagnosticError } from '../src/Errors.js';
import { buildMasterHeadScript } from '../src/framed/master/master-head.js';
import { findPlaceholderOffsets } from '../src/framed/master/master-program.js';
import { fillPlaceholders } from '../src/framed/master/placeholders.js';
import { isMasterToken } from '../src/framed/validator/model.js';
import { buildValidatorProgram } from '../src/framed/validator/index.js';
import { compositionMachine } from './framed/machine.js';
import { callerUnlockingBytecode } from './framed/master/caller-input.js';

const FRAMED = { composition: 'framed' as const, suppressWarnings: true };

const LEDGER = `pragma solidcash ^0.14.0;
contract Ledger {
  mapping(int => int) seen;
  function f(int k) { this.seen[k] = 1; require(this.seen[k] == 1); }
  function g(int k) { f(k); require(this.seen[k] == 1); }
}`;

const OVERLOADS = `pragma solidcash ^0.14.0;
contract Pair {
  int x;
  function set(int v) { this.x = v; require(this.x == v); }
  function set(int v, int w) { this.x = v + w; require(this.x == v + w); }
  function read() view returns (int) { return this.x; }
  function identity(int v) pure returns (int) { return v; }
  function ext(int v) external { this.x = v; require(this.x == v); }
}`;

const WITH_HELPER = `pragma solidcash ^0.14.0;
contract Cap {
  int x;
  function pub() { hidden(); require(this.x == 1); }
  function hidden() internal { this.x = 1; }
}`;

function diagnostic(run: () => unknown): SolidcDiagnosticError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(SolidcDiagnosticError);
    return error as SolidcDiagnosticError;
  }
  throw new Error('expected a diagnostic');
}

function selectorPush(selector: string): string {
  return `04${selector.toLowerCase()}88`;
}

interface InternalHeadSpend {
  readonly redeem: Uint8Array;
  readonly lock: Uint8Array;
  readonly category: Uint8Array;
  readonly address: Uint8Array;
  readonly userLock: Uint8Array;
  readonly validatorUnlocking: Uint8Array;
  readonly validatorLock: Uint8Array;
}

/** A master whose head admits only INTERNAL, with the frame values dropped and a final true. */
function internalHeadSpend(): InternalHeadSpend {
  const category = sha256(new TextEncoder().encode('function split internal head'));
  const validator = buildValidatorProgram();
  const templateHash = sha256(validator);
  const address = validatorAddress(category, validator);
  const head = buildMasterHeadScript({
    blockOnTop: true,
    frameKinds: [FrameKind.INTERNAL],
    reservesValidatorHashSlot: true,
    tail: { maxEventCount: 0, sendCount: 0 },
  });
  const filled = fillPlaceholders(
    head.script,
    { version: 1, ...findPlaceholderOffsets(head.script, head.validatorHashSlotOffset !== undefined) },
    {
      category: chainCategory(category),
      contractAddress: address,
      ...(head.validatorHashSlotOffset === undefined ? {} : { templateHash }),
    },
  );
  const redeem = new Uint8Array([
    ...filled,
    Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP,
    Opcodes.OP_DROP, Opcodes.OP_DROP, Opcodes.OP_DROP,
    Opcodes.OP_1,
  ]);
  const validatorRedeem = validatorRedeemScript(category, validator);
  return {
    redeem,
    lock: encodeLockingBytecodeP2sh32(hash256(redeem)),
    category,
    address,
    userLock: encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22)),
    validatorLock: address,
    validatorUnlocking: new Uint8Array([
      ...encodeDataPush(encodeTranscript({ roots: [], masters: [], settles: [] })),
      ...encodeDataPush(validatorRedeem),
    ]),
  };
}

function spendInternalHead(
  prepared: InternalHeadSpend,
  kind: number,
  validatorRef: number,
): { accepted: boolean; objection?: string } {
  const block: WitnessBlock = {
    kind,
    callerRef: 1,
    originRef: 1,
    validatorRef,
    sender: prepared.userLock,
    self: prepared.address,
    value: 0n,
    retval: new Uint8Array(0),
    calls: [],
    segments: [[]],
    events: [],
    sends: [],
  };
  const master = {
    lockingBytecode: prepared.lock,
    valueSatoshis: 20_000n,
    token: {
      category: prepared.category,
      amount: 0n,
      nft: { capability: 'minting' as const, commitment: new Uint8Array(0) },
    },
  };
  const user = { lockingBytecode: prepared.userLock, valueSatoshis: 100_000n };
  const validator = {
    lockingBytecode: prepared.validatorLock,
    valueSatoshis: 10_000n,
    token: {
      category: prepared.category,
      amount: 0n,
      nft: { capability: 'mutable' as const, commitment: new Uint8Array(0) },
    },
  };
  const transaction = {
    version: 2,
    locktime: 0,
    inputs: [
      {
        outpointIndex: 0,
        outpointTransactionHash: new Uint8Array(32).fill(1),
        sequenceNumber: 0xffffffff,
        unlockingBytecode: new Uint8Array([
          ...encodeDataPush(encodeWitnessBlock(block)),
          ...encodeDataPush(prepared.redeem),
        ]),
      },
      {
        outpointIndex: 0,
        outpointTransactionHash: new Uint8Array(32).fill(2),
        sequenceNumber: 0xffffffff,
        unlockingBytecode: callerUnlockingBytecode(),
      },
      {
        outpointIndex: 0,
        outpointTransactionHash: new Uint8Array(32).fill(3),
        sequenceNumber: 0xffffffff,
        unlockingBytecode: prepared.validatorUnlocking,
      },
    ],
    outputs: [master],
  };
  const vm = compositionMachine();
  const state = vm.evaluate({ inputIndex: 0, sourceOutputs: [master, user, validator], transaction });
  return vm.stateSuccess(state) === true
    ? { accepted: true }
    : { accepted: false, objection: String((state as { error?: unknown }).error) };
}

/**
 * Both masters of one loader, reading the code from the carrier at input 2.
 *
 * `expected` is the code the loader names. `carried` is the push on the carrier, which is the same bytes
 * when the spend is honest.
 */
function spendLoader(
  expected: Uint8Array,
  carried: Uint8Array,
  selector: Uint8Array,
): { accepted: boolean; objection?: string }[] {
  const codeHash = hash256(expected);
  const loader = functionSplitLoaderScript(codeHash, selector);
  const lock = functionSplitLoaderLock(loader);
  const carrierRedeem = new Uint8Array([
    Opcodes.OP_HASH256,
    ...encodeDataPush(codeHash),
    Opcodes.OP_EQUALVERIFY,
    Opcodes.OP_1,
  ]);
  const carrierLock = encodeLockingBytecodeP2sh32(hash256(carrierRedeem));
  const masterUnlocking = new Uint8Array([
    ...encodeDataPush(Uint8Array.of(2)),
    ...encodeDataPush(loader),
  ]);
  const carrierUnlocking = new Uint8Array([
    ...encodeDataPush(carried),
    ...encodeDataPush(carrierRedeem),
  ]);
  const master = { lockingBytecode: lock, valueSatoshis: 10_000n };
  const carrier = { lockingBytecode: carrierLock, valueSatoshis: 10_000n };
  const transaction = {
    version: 2,
    locktime: 0,
    inputs: [0, 1, 2].map((at) => ({
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32).fill(at + 1),
      sequenceNumber: 0xffffffff,
      unlockingBytecode: at === 2 ? carrierUnlocking : masterUnlocking,
    })),
    outputs: [master, master, carrier],
  };
  const sourceOutputs = [master, master, carrier];
  const vm = compositionMachine();
  return [0, 1].map((inputIndex) => {
    const state = vm.evaluate({ inputIndex, sourceOutputs, transaction });
    return vm.stateSuccess(state) === true
      ? { accepted: true }
      : { accepted: false, objection: String((state as { error?: unknown }).error) };
  });
}

describe('split: off | size | func', () => {
  it('refuses func without framed composition and refuses size with it', () => {
    const direct = ' '.repeat(10_001) + LEDGER;
    const omitted = diagnostic(() => compileStringSplit(direct, { split: 'func', suppressWarnings: true }));
    expect(omitted.code).toBe('SPLIT_FUNC_REQUIRES_FRAMED');
    expect(omitted.message).toContain("'direct'");
    const kernel = diagnostic(() => compileStringSplit(LEDGER, {
      split: 'func', composition: 'kernel', suppressWarnings: true,
    }));
    expect(kernel.code).toBe('SPLIT_FUNC_REQUIRES_FRAMED');
    expect(kernel.message).toContain("'kernel'");
    const sized = diagnostic(() => compileStringSplit(LEDGER, { split: 'size', ...FRAMED }));
    expect(sized.code).toBe('SPLIT_SIZE_REFUSES_FRAMED');
    expect(sized.message).toContain("'framed'");
  });

  it('keeps size packing on state-affinity-best-fit-v2 and returns one artifact for off', () => {
    const sized = compileStringSplit(LEDGER, { split: 'size', forceSplit: true, suppressWarnings: true });
    expect(sized.format).toBe('solidcash-split-v1');
    expect(sized.manifest.algorithm).toBe('state-affinity-best-fit-v2');
    expect(sized.root.messageBus?.available === true).toBe(false);
    const off = compileStringSplit(LEDGER, { split: 'off', suppressWarnings: true });
    const plain = compileString(LEDGER, { suppressWarnings: true });
    expect(off.contractName).toBe(plain.contractName);
    expect(off.bytecode).toBe(plain.bytecode);
    const docs = readFileSync(new URL('../../../website/docs/compiler/large-contracts.md', import.meta.url), 'utf8');
    expect(docs).toContain('over-cap kernel route is outside function split');
  });

  it('emits one salted framed shard per ABI entry, including view, pure, and external', () => {
    const bundle = compileStringSplit(OVERLOADS, { split: 'func', ...FRAMED });
    const monolith = compileString(OVERLOADS, FRAMED);
    expect(bundle.format).toBe('solidcash-split-v2');
    expect(bundle.algorithm).toBe('per-entry-v1');
    expect(bundle.composition).toBe('framed');
    expect(bundle.internalCuts).toEqual([]);
    expect(bundle.messageBus).toEqual({ available: false });
    expect(bundle.logical.messageBus?.kernelExecutionPlans).toBeUndefined();
    expect(bundle.logical.messageBus?.available === true).toBe(false);
    const abiEntries = bundle.abi.filter((fn) => fn.name !== 'constructor');
    expect(bundle.shards).toHaveLength(abiEntries.length);
    expect(bundle.loaders).toHaveLength(bundle.shards.length);
    const selectors = bundle.shards.map((shard) => shard.selector);
    expect(new Set(selectors).size).toBe(selectors.length);
    const monolithSlots = (monolith.stateLayout?.variables ?? []).map((variable) => variable.name);
    expect((bundle.logical.stateLayout?.variables ?? []).map((variable) => variable.name)).toEqual(monolithSlots);
    for (const shard of bundle.shards) {
      expect(shard.lock.length).toBeGreaterThan(0);
      expect((shard.artifact.stateLayout?.variables ?? []).map((variable) => variable.name)).toEqual(monolithSlots);
      const script = Buffer.from(asmToBytecode(shard.artifact.bytecode)).toString('hex');
      expect(script).toContain(selectorPush(shard.selector));
      expect(script).not.toContain('0453434231');
      expect(shard.artifact.messageBus?.kernelExecutionPlans).toBeUndefined();
      for (const other of bundle.shards) {
        if (other.selector === shard.selector) continue;
        expect(script).not.toContain(selectorPush(other.selector));
      }
    }
    const sets = bundle.shards.filter((shard) => shard.function === 'set');
    expect(sets).toHaveLength(2);
    expect(sets.every((shard) => shard.acceptedFrameKinds.includes('INTERNAL'))).toBe(true);
    expect(bundle.shards.find((shard) => shard.function === 'ext')?.acceptedFrameKinds).not.toContain('INTERNAL');
    expect(bundle.shards.find((shard) => shard.function === 'read')?.acceptedFrameKinds).toContain('STATIC');
    expect(bundle.shards.find((shard) => shard.function === 'identity')?.acceptedFrameKinds).toContain('STATIC');
    const loaderLocks = new Set(bundle.loaders.map((loader) => loader.lock));
    expect(loaderLocks.size).toBe(bundle.loaders.length);
    expect(isRejectedFunctionLoader('00'.repeat(35), bundle.loaders)).toBe(true);
    expect(isRejectedFunctionLoader(bundle.loaders[0]!.lock, bundle.loaders)).toBe(false);
    const schema = JSON.stringify(buildKernelCapabilitySchema({ available: false }));
    expect(schema).not.toMatch(/shardLock|shard-lock|functionLock/);
  });

  it('names the helper and emits no internal shard when the closure exceeds the cap', () => {
    const error = diagnostic(() => compileStringSplit(WITH_HELPER, {
      split: 'func', ...FRAMED, maxShardBytes: 1,
    }));
    expect(error.code).toBe('SPLIT_CLOSURE_CAPACITY');
    expect(error.message).toContain('hidden');
    expect(error.context.helperCuts).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: expect.stringContaining('hidden') }),
    ]));
    expect(error.message).not.toContain('solidcash-split-v2');
  });

  it('cuts a legal over-cap helper into an INTERNAL shard and leaves the validator template', () => {
    const blob = 'ab'.repeat(4000);
    const source = `pragma solidcash ^0.14.0;
contract Cap {
  int x;
  function pub() { pad(); require(this.x == this.x); }
  function pad() internal { bytes b = hex"${blob}"; require(b.length > 0); }
}`;
    const before = Buffer.from(buildValidatorProgram());
    const open = compileStringSplit(source, { split: 'func', ...FRAMED });
    expect(open.internalCuts).toEqual([]);
    expect(open.abi.some((fn) => fn.name === 'pad')).toBe(false);
    const pubOpen = open.shards.find((shard) => shard.function === 'pub')!;
    const limit = asmToBytecode(pubOpen.artifact.bytecode).length - 1;
    const cut = compileStringSplit(source, { split: 'func', ...FRAMED, maxShardBytes: limit });
    expect(Buffer.from(buildValidatorProgram()).equals(before)).toBe(true);
    expect(cut.internalCuts).toHaveLength(1);
    const helper = cut.internalCuts[0]!;
    expect(helper.name).toContain('pad');
    expect(helper.wholeSpendBytes).toBeLessThanOrEqual(limit);
    expect(helper.callerSelectors).toEqual([
      cut.shards.find((shard) => shard.function === 'pub')!.selector,
    ]);
    expect(cut.abi.some((fn) => fn.name === 'pad')).toBe(false);
    expect(helper.artifact.abi.some((fn) => fn.name === 'pad')).toBe(false);
    expect(cut.shards.some((shard) => shard.function === 'pad')).toBe(false);
    const pub = cut.shards.find((shard) => shard.function === 'pub')!;
    expect(pub.wholeSpendBytes).toBeLessThanOrEqual(limit);
    const script = Buffer.from(asmToBytecode(helper.artifact.bytecode)).toString('hex');
    // The head's INTERNAL arm is OP_4 (0x54) then OP_NUMEQUALVERIFY (0x9d). A ROOT or CALL spend
    // falls through that arm to the refusal.
    expect(script).toContain('549d');
    const calls = pub.artifact.composition?.stopSites?.entries
      .find((entry) => entry.functionName.endsWith('.pub()'))?.calls ?? [];
    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    const target = call.target.replace(/^0x/i, '').toLowerCase();
    expect(call.functionName).toBe('pad');
    expect(call.interfaceName).toBe('__FunctionSplitInternal');
    expect(target).toHaveLength(70);
    expect(target).not.toBe('00'.repeat(35));
    const program = asmToBytecode(pub.artifact.bytecode);
    const slots = (pub.artifact.composition?.internalHelperLocks ?? [])
      .filter((slot) => slot.name === helper.name);
    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      expect(program[slot.offset]).toBe(0x23);
      const payload = Buffer.from(program.subarray(slot.offset + 1, slot.offset + 36)).toString('hex');
      expect(payload).toBe(target);
      const standIn = new Uint8Array(35);
      standIn[0] = 0xaa;
      standIn[1] = 0x20;
      standIn.fill(0x44, 2, 34);
      standIn[34] = 0x87;
      const rewritten = Uint8Array.from(program);
      rewritten.set(standIn, slot.offset + 1);
      expect(rewritten[slot.offset]).toBe(0x23);
      expect(Buffer.from(rewritten.subarray(slot.offset + 1, slot.offset + 36)).equals(Buffer.from(standIn))).toBe(true);
    }
    const literal = (pub.artifact.abi.find((fn) => fn.name === 'pub')?.externalCalls ?? [])
      .map((site) => site.addressLiteral?.replace(/^0x/i, '').toLowerCase());
    expect(literal).toContain(target);
  });

  it('publishes a distinct P2SH32 loader per function and rejects a shared loader lock', () => {
    const bundle = compileStringSplit(OVERLOADS, { split: 'func', ...FRAMED });
    expect(bundle.loaders.length).toBeGreaterThan(1);
    const locks = new Set(bundle.loaders.map((loader) => loader.lock.toLowerCase()));
    expect(locks.size).toBe(bundle.loaders.length);
    for (const loader of bundle.loaders) {
      const codeHash = Uint8Array.from(Buffer.from(loader.codeHash, 'hex'));
      const selector = Uint8Array.from(Buffer.from(loader.selector, 'hex'));
      const script = functionSplitLoaderScript(codeHash, selector);
      const lock = functionSplitLoaderLock(script);
      expect(Buffer.from(script).toString('hex')).toBe(loader.script.toLowerCase());
      expect(Buffer.from(lock).toString('hex')).toBe(loader.lock.toLowerCase());
      expect(lock.length).toBe(35);
      expect([lock[0], lock[1], lock[34]]).toEqual([0xaa, 0x20, 0x87]);
      expect(script[0]).toBe(0x20);
      expect(script.subarray(1, 33)).toEqual(codeHash);
      expect(script[33]).toBe(0x04);
      expect(script.subarray(34, 38)).toEqual(selector);
      expect(loader).not.toHaveProperty('commitment');
    }
    // One script for every function. The function id is not in the redeem script, so a witness or an NFT
    // commitment would be the only place left for it. That lock is not in the per-function table.
    const shared = functionSplitLoaderLock(Uint8Array.of(0x51));
    expect(isRejectedFunctionLoader(Buffer.from(shared).toString('hex'), bundle.loaders)).toBe(true);
  });

  it('copies a bare call and turns this.f() into a call on that entry', () => {
    const source = `pragma solidcash ^0.14.0;
contract Ledger {
  int x;
  function f(int k) { this.x = k; require(this.x == k); }
  function g(int k) { f(k); require(this.x == k); }
  function h(int k) { this.f(k); require(this.x == k); }
}`;
    const bundle = compileStringSplit(source, { split: 'func', ...FRAMED });
    const f = bundle.shards.find((shard) => shard.function === 'f')!;
    const g = bundle.shards.find((shard) => shard.function === 'g')!;
    const h = bundle.shards.find((shard) => shard.function === 'h')!;
    const scriptOf = (shard: typeof f): string => Buffer.from(asmToBytecode(shard.artifact.bytecode)).toString('hex');
    expect(scriptOf(g)).not.toContain(selectorPush(f.selector));
    expect(scriptOf(h)).toContain(selectorPush(h.selector));
    expect(scriptOf(h)).toContain(f.selector.toLowerCase());
    const calls = h.artifact.composition?.stopSites?.entries
      .find((entry) => entry.functionName.endsWith('.h()'))?.calls ?? [];
    expect(calls).toEqual([expect.objectContaining({
      functionName: 'f',
      selector: f.selector.toLowerCase(),
      target: '',
    })]);
    expect(g.artifact.composition?.stopSites?.entries
      .find((entry) => entry.functionName.endsWith('.g()'))?.calls ?? []).toEqual([]);
    const published = h.artifact.abi.find((fn) => fn.name === 'h')?.externalCalls ?? [];
    expect(published[0]?.callerIdentity?.auth).toBe('input-bytecode');
  });

  it('keeps the master capability-only and the validator program stable', () => {
    const category = Uint8Array.from({ length: 32 }, (_v, i) => (i === 31 ? 0xee : 0x11));
    const token = {
      category, capability: TokenCapability.MINTING, hasNft: true, nftCommitment: Uint8Array.of(0xab), amount: 0n,
    };
    expect(isMasterToken(token)).toBe(true);
    expect(isMasterToken({ ...token, capability: TokenCapability.MUTABLE })).toBe(false);
    const before = Buffer.from(buildValidatorProgram());
    const bundle = compileStringSplit(OVERLOADS, { split: 'func', ...FRAMED });
    expect(Buffer.from(buildValidatorProgram()).equals(before)).toBe(true);
    // Empty commitment: INPUTINDEX OUTPUTTOKENCOMMITMENT OP_0 EQUALVERIFY. No shard pins a commitment value.
    const emptyCommitment = Buffer.from([192, 210, 0, 0x88]);
    for (const shard of bundle.shards) {
      const script = Buffer.from(asmToBytecode(shard.artifact.bytecode));
      expect(script.includes(emptyCommitment)).toBe(true);
    }
  });

  it('still refuses a delegate entry when a size-split bus route is requested', () => {
    const source = `contract C(address impl) {
      function denied(bytes input) public {
        impl.delegatecall(input);
        require(true);
      }
      function control() public { require(true); }
    }`;
    // Admission publishes the raw reason when the kernel catalog is off, and KERNEL_FOREIGN_DELEGATE when it is
    // on. A size-split root is compiled with the bus off. No facet of this source admits `denied`.
    const admitted = compileString(source, {
      forceStateful: true, messageBus: true, messageBusKernel: false, suppressWarnings: true,
    });
    expect(admitted.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'atomic-delegate-context-unpreservable',
    });
    const catalog = compileString(source, {
      forceStateful: true, messageBus: true, suppressWarnings: true,
    });
    expect(catalog.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_FOREIGN_DELEGATE',
    });
    const delegateSplit = compileStringSplit(source, {
      split: 'size', forceSplit: true, messageBus: true, suppressWarnings: true,
    });
    expect(delegateSplit.root.messageBus?.available === true).toBe(false);
    const moved = Object.values(delegateSplit.facets)
      .flatMap((facet) => facet.messageBus?.handlers ?? []);
    expect(moved.find((handler) => handler.name === 'denied' && handler.eligible === true)).toBeUndefined();
    const bundle = compileStringSplit(`contract C() {
      int n;
      function left() public { this.n = 1; require(true); }
      function right() public { this.n = 2; require(true); }
    }`, { split: 'size', forceSplit: true, messageBus: true, suppressWarnings: true });
    expect(bundle.root.messageBus?.available === true).toBe(false);
    expect(Object.keys(bundle.facets).length).toBeGreaterThan(0);
  });

  it('keeps the historical head unless INTERNAL or DELEGATE is admitted', () => {
    const head = (frameKinds: number[]): Buffer => Buffer.from(buildMasterHeadScript({
      blockOnTop: false, frameKinds, reservesValidatorHashSlot: true, calls: [],
    }).script);
    const narrow = head([0, 1]);
    const withStatic = head([0, 1, 2]);
    const four = head([0, 1, 2, 3]);
    const withInternal = head([0, 1, 2, 3, 4]);
    const onlyInternal = head([4]);
    expect(narrow.equals(withStatic)).toBe(true);
    // G0: a master that admits DELEGATE frames settles its own category on a delegate frame.
    expect(four.equals(withStatic)).toBe(false);
    expect(withInternal.equals(four)).toBe(false);
    expect(onlyInternal.equals(four)).toBe(false);
  });

  it('refuses a user ROOT or CALL spend of an INTERNAL helper and accepts the internal kind', () => {
    const prepared = internalHeadSpend();
    expect(spendInternalHead(prepared, FrameKind.ROOT, 0xffff).accepted).toBe(false);
    expect(spendInternalHead(prepared, FrameKind.CALL, 0xffff).accepted).toBe(false);
    expect(spendInternalHead(prepared, FrameKind.INTERNAL, 2)).toEqual({ accepted: true });
  }, 180_000);

  it('loads one copy of a function for every master that spends its loader', () => {
    const code = new Uint8Array(81);
    code.fill(Opcodes.OP_NOP, 0, 80);
    code[80] = Opcodes.OP_1;
    const selector = Uint8Array.of(1, 2, 3, 4);
    const codeHash = hash256(code);
    const lock = functionSplitLoaderLock(functionSplitLoaderScript(codeHash, selector));
    const other = functionSplitLoaderLock(functionSplitLoaderScript(codeHash, Uint8Array.of(5, 6, 7, 8)));
    expect(Buffer.from(lock).equals(Buffer.from(other))).toBe(false);
    expect([lock[0], lock[1], lock[34]]).toEqual([0xaa, 0x20, 0x87]);
    const honest = spendLoader(code, code, selector);
    expect(honest).toEqual([{ accepted: true }, { accepted: true }]);
    const wrong = Uint8Array.from(code);
    wrong[0] = wrong[0] ^ 0xff;
    expect(spendLoader(code, wrong, selector).some((verdict) => verdict.accepted)).toBe(false);
  });
});
