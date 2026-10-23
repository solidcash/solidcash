/**
 * Hostile VM tests for the October 2026 class-C and class-D holes.
 * Each spend compiles through this worktree and is evaluated on the BCH 2026 VM.
 */
import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2sh32, hash256, hexToBin,
} from '@bitauth/libauth';

import {
  asmToScript, blockOracleRedeemScript, blockOracleUpdateUnlocking, buildDataNftCovenantScript,
  buildEntryNftCovenantScript, buildEventNftCovenantScript, buildPushdataCommitment, computeCollectionHash,
  computeEventNameHash, encodeBlockOracleCommitment, encodeIntegerValue, hash160, scriptToBytecode,
  type AbiFunction,
} from '@solidcash/utils';
import { SighashType } from '../../solidcash/src/interfaces.js';
import SignatureTemplate from '../../solidcash/src/SignatureTemplate.js';
import { createSighashPreimage } from '../../solidcash/src/utils.js';
import { alicePriv, alicePub } from '../../solidcash/test/fixture/vars.js';
import { encodeEntryCommitment, keyToSlot, keyToSlotMulti } from '../../solidcash/src/stateful/SortedList.js';
import { compileString, compileStringSplit } from '../src/index.js';

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];
type SourceOutputs = NonNullable<VmProgram['sourceOutputs']>;

const P = 'pragma solidcash ^0.14.0;';
const CATEGORY = Uint8Array.from({ length: 32 }, (_, i) => (0x29 + i * 17) & 0xff);
const VALUE = 20_000n;
const vm = createVirtualMachineBch2026();
const num = (value: bigint): Uint8Array => encodeIntegerValue(value);

function p2sh32(redeem: Uint8Array): Uint8Array {
  return encodeLockingBytecodeP2sh32(hash256(redeem));
}

function input(
  index: number, unlockingBytecode: Uint8Array, sequenceNumber = 0xffffffff,
): VmTransaction['inputs'][number] {
  const hash = new Uint8Array(32);
  hash[0] = index + 1;
  return { outpointIndex: 0, outpointTransactionHash: hash, sequenceNumber, unlockingBytecode };
}

function pushesOf(values: readonly Uint8Array[]): Uint8Array {
  return new Uint8Array(values.flatMap((value) => [...encodeDataPush(value)]));
}

function tokenOf(
  capability: 'minting' | 'mutable' | 'none', commitment: Uint8Array, category = CATEGORY,
): VmOutput['token'] {
  return { category, amount: 0n, nft: { capability, commitment } };
}

function verdict(sourceOutputs: SourceOutputs, transaction: VmTransaction): true | string {
  return vm.verify({ sourceOutputs, transaction });
}

function redeemUnlock(
  fn: AbiFunction, redeem: Uint8Array, values: Record<string, Uint8Array>, dispatch: boolean,
): Uint8Array {
  const args = fn.inputs.map((entry) => {
    const value = values[entry.name];
    if (value === undefined) throw new Error(`no value for ${fn.name}.${entry.name}`);
    return value;
  }).reverse();
  if (dispatch && fn.selector) args.unshift(hexToBin(fn.selector));
  return new Uint8Array([...pushesOf(args), ...encodeDataPush(redeem)]);
}

describe('October 2026 class C holes', () => {
  it('SEM-1 an early return cannot skip the only require, and the require path can', () => {
    const src = `${P} contract W() { function spend(int amount) { if (amount == 0) return; require(amount == 1); } }`;
    // The spend is the same body with the final-require gate disabled: the early return is then a failing
    // require, and amount == 1 still passes. The default compile rejects the function before bytecode.
    const artifact = compileString(src, { messageBus: false, enforceFinalRequire: false });
    const fn = artifact.abi.find((entry) => entry.name === 'spend');
    if (!fn) throw new Error(`no spend; ${artifact.abi.map((entry) => entry.name).join(',')}`);
    const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
    const lock = p2sh32(redeem);
    const dispatch = artifact.messageBus?.routeInBytecode === true;
    const spend = (amount: bigint): true | string => {
      const values: Record<string, Uint8Array> = {};
      for (const entry of fn.inputs) {
        if (entry.name === 'amount') values[entry.name] = num(amount);
        else throw new Error(`unexpected input ${entry.name}`);
      }
      const transaction: VmTransaction = {
        version: 2, locktime: 0,
        inputs: [input(0, redeemUnlock(fn, redeem, values, dispatch))],
        outputs: [{ lockingBytecode: lock, valueSatoshis: VALUE }],
      };
      const sourceOutputs: SourceOutputs = [{ lockingBytecode: lock, valueSatoshis: VALUE }];
      return vm.verify({ sourceOutputs, transaction });
    };
    expect(spend(1n), 'SEM-1 authorized').toBe(true);
    expect(spend(0n), 'SEM-1 early return').not.toBe(true);
    expect(() => compileString(src, { messageBus: false }), 'SEM-1 default reject').toThrow(/require/);
  });

  it('DS-8 a batch proof cannot name the pure-read input, and a distinct proof can', () => {
    const artifact = compileString(
      `${P} contract C { mapping(int => int) m;`
      + ' function writeRead(int k, int v, int r, int sel) { this.m[k] = v;'
      + ' if (sel > 0) { require(this.m[r] > 0); } require(true); } }',
      { messageBus: false, forceStateful: true },
    );
    const fn = artifact.abi.find((entry) => entry.name === 'writeRead');
    if (!fn) throw new Error(`no writeRead; ${artifact.abi.map((entry) => entry.name).join(',')}`);
    const entries = fn.blockLayout?.slots.filter((slot) => slot.kind === 'entry') ?? [];
    const target = entries.find((slot) => slot.slotIndex === 0);
    const read = entries.find((slot) => slot.slotIndex === 1);
    if (!target || !read) throw new Error(`slots ${JSON.stringify(fn.blockLayout ?? null)}`);
    const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
    const contractLock = p2sh32(redeem);
    const collection = artifact.stateLayout!.collections!.find((entry) => entry.name === 'm')!;
    const entryRedeem = scriptToBytecode(buildEntryNftCovenantScript(
      CATEGORY, computeCollectionHash(collection.signature), contractLock,
    ));
    const entryLock = p2sh32(entryRedeem);
    const zero = new Uint8Array(32);
    const targetSlot = keyToSlotMulti([num(7n)]);
    const victimSlot = keyToSlotMulti([num(9n)]);
    const targetBefore = encodeEntryCommitment(targetSlot, zero, num(1n));
    const targetAfter = encodeEntryCommitment(targetSlot, zero, num(55n));
    const victim = encodeEntryCommitment(victimSlot, zero, num(60n));
    const bare = Uint8Array.of(0x51);
    const entryUnlock = pushesOf([num(0n), num(1n), entryRedeem]);
    // The read is not taken. An honest proof names the written node. The overlap moves that node to the read
    // slot and recreates it there unchanged, points the proof at it, and spends a different node at the write
    // slot without recreating it. The census would count that one input twice and let the other node go.
    const spend = (proof: bigint, overlap: boolean): true | string => {
      const values: Record<string, Uint8Array> = {};
      for (const entry of fn.inputs) {
        if (entry.name === 'k') values[entry.name] = num(7n);
        else if (entry.name === 'v') values[entry.name] = num(55n);
        else if (entry.name === 'r') values[entry.name] = num(11n);
        else if (entry.name === 'sel') values[entry.name] = num(0n);
        else if (/^__internal__vmapBatchSlot_\d+$/.test(entry.name)) values[entry.name] = targetSlot;
        else if (entry.name.includes('vmapBatchProof')) values[entry.name] = num(proof);
        else if (entry.name.includes('vmapBatchNext')) values[entry.name] = zero;
        else if (entry.name.includes('vmapBatchPredOut')) values[entry.name] = num(-1n);
        else if (entry.name.includes('TrailingCount')) values[entry.name] = num(0n);
        else if (entry.name.startsWith('__internal__')) values[entry.name] = new Uint8Array();
        else throw new Error(`unexpected input ${entry.name}`);
      }
      const inputs = [
        input(0, redeemUnlock(fn, redeem, values, false)),
        input(target.offset, entryUnlock),
        input(read.offset, overlap ? entryUnlock : new Uint8Array()),
      ];
      const outputs: VmOutput[] = [
        { lockingBytecode: contractLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
        { lockingBytecode: entryLock, valueSatoshis: VALUE, token: tokenOf('mutable', targetAfter) },
        overlap
          ? { lockingBytecode: entryLock, valueSatoshis: VALUE, token: tokenOf('mutable', targetBefore) }
          : { lockingBytecode: bare, valueSatoshis: VALUE },
      ];
      const sources: SourceOutputs = [
        { lockingBytecode: contractLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
        {
          lockingBytecode: entryLock, valueSatoshis: VALUE,
          token: tokenOf('mutable', overlap ? victim : targetBefore),
        },
        overlap
          ? { lockingBytecode: entryLock, valueSatoshis: VALUE, token: tokenOf('mutable', targetBefore) }
          : { lockingBytecode: bare, valueSatoshis: VALUE },
      ];
      return verdict(sources, { version: 2, locktime: 0, inputs, outputs });
    };
    expect(spend(BigInt(target.offset), false), 'DS-8 authorized').toBe(true);
    expect(spend(BigInt(read.offset), true), 'DS-8 proof names the read input').not.toBe(true);
  });

  it('DS-8 a message-bus route proof cannot name the pure-read input, and a distinct proof can', () => {
    const artifact = compileString(
      `${P} contract C { mapping(int => int) m;`
      + ' function writeRead(int k, int v, int r) { this.m[k] = v;'
      + ' if (v < 0) { require(this.m[r] > 0); } require(true); } }',
      { messageBus: true, messageBusKernel: false, forceStateful: true },
    );
    const fn = artifact.abi.find((entry) => entry.name === 'writeRead');
    if (!fn) throw new Error(`no writeRead; ${artifact.abi.map((entry) => entry.name).join(',')}`);
    const entries = fn.blockLayout?.slots.filter((slot) => slot.kind === 'entry') ?? [];
    const target = entries.find((slot) => slot.slotIndex === 0);
    const read = entries.find((slot) => slot.slotIndex === 1);
    if (!target || !read) throw new Error(`slots ${JSON.stringify(fn.blockLayout ?? null)}`);
    const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
    if (redeem.length > 10_000) throw new Error(`DS-8 route is ${redeem.length} bytes`);
    const contractLock = p2sh32(redeem);
    const collection = artifact.stateLayout!.collections!.find((entry) => entry.name === 'm')!;
    const entryRedeem = scriptToBytecode(buildEntryNftCovenantScript(
      CATEGORY, computeCollectionHash(collection.signature), contractLock,
    ));
    const entryLock = p2sh32(entryRedeem);
    const zero = new Uint8Array(32);
    const targetSlot = keyToSlotMulti([num(7n)]);
    const victimSlot = keyToSlotMulti([num(9n)]);
    const targetBefore = encodeEntryCommitment(targetSlot, zero, num(1n));
    const targetAfter = encodeEntryCommitment(targetSlot, zero, num(55n));
    const victim = encodeEntryCommitment(victimSlot, zero, num(60n));
    const bare = Uint8Array.of(0x51);
    const entryUnlock = pushesOf([num(0n), num(1n), entryRedeem]);
    const spend = (proof: bigint, overlap: boolean): true | string => {
      const values: Record<string, Uint8Array> = {};
      for (const entry of fn.inputs) {
        if (entry.name === 'k') values[entry.name] = num(7n);
        else if (entry.name === 'v') values[entry.name] = num(55n);
        else if (entry.name === 'r') values[entry.name] = num(11n);
        else if (/^__internal__vmapBatchSlot_\d+$/.test(entry.name)) values[entry.name] = targetSlot;
        else if (entry.name.includes('vmapBatchProof')) values[entry.name] = num(proof);
        else if (entry.name.includes('vmapBatchNext')) values[entry.name] = zero;
        else if (entry.name.includes('vmapBatchPredOut')) values[entry.name] = num(-1n);
        else if (entry.name.includes('TrailingCount')) values[entry.name] = num(0n);
        else if (entry.name.startsWith('__internal__')) values[entry.name] = new Uint8Array();
        else throw new Error(`unexpected input ${entry.name}`);
      }
      const inputs = [
        input(0, redeemUnlock(fn, redeem, values, true)),
        input(target.offset, entryUnlock),
        input(read.offset, overlap ? entryUnlock : new Uint8Array()),
      ];
      const outputs: VmOutput[] = [
        { lockingBytecode: contractLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
        { lockingBytecode: entryLock, valueSatoshis: VALUE, token: tokenOf('mutable', targetAfter) },
        overlap
          ? { lockingBytecode: entryLock, valueSatoshis: VALUE, token: tokenOf('mutable', targetBefore) }
          : { lockingBytecode: bare, valueSatoshis: VALUE },
      ];
      const sources: SourceOutputs = [
        { lockingBytecode: contractLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
        {
          lockingBytecode: entryLock, valueSatoshis: VALUE,
          token: tokenOf('mutable', overlap ? victim : targetBefore),
        },
        overlap
          ? { lockingBytecode: entryLock, valueSatoshis: VALUE, token: tokenOf('mutable', targetBefore) }
          : { lockingBytecode: bare, valueSatoshis: VALUE },
      ];
      return verdict(sources, { version: 2, locktime: 0, inputs, outputs });
    };
    expect(spend(BigInt(target.offset), false), 'DS-8 route authorized').toBe(true);
    expect(spend(BigInt(read.offset), true), 'DS-8 route proof names the read input').not.toBe(true);
  });

  it('ARITH-3 bytesN of dynamic bytes keeps the first N bytes, so a longer prefix cannot pass a deny-list', () => {
    const artifact = compileString(
      `${P} contract W() { function spend(bytes data) { require(bytes4(data) != hex"aabbccdd"); } }`,
      { messageBus: false },
    );
    const fn = artifact.abi.find((entry) => entry.name === 'spend');
    if (!fn) throw new Error(`no spend; ${artifact.abi.map((entry) => entry.name).join(',')}`);
    const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
    const lock = p2sh32(redeem);
    const dispatch = artifact.messageBus?.routeInBytecode === true;
    const spend = (data: Uint8Array): true | string => {
      const values: Record<string, Uint8Array> = {};
      for (const entry of fn.inputs) {
        if (entry.name === 'data') values[entry.name] = data;
        else throw new Error(`unexpected input ${entry.name}`);
      }
      const transaction: VmTransaction = {
        version: 2, locktime: 0,
        inputs: [input(0, redeemUnlock(fn, redeem, values, dispatch))],
        outputs: [{ lockingBytecode: lock, valueSatoshis: VALUE }],
      };
      const sourceOutputs: SourceOutputs = [{ lockingBytecode: lock, valueSatoshis: VALUE }];
      return vm.verify({ sourceOutputs, transaction });
    };
    expect(spend(hexToBin('00112233ffffffff')), 'ARITH-3 authorized').toBe(true);
    expect(spend(hexToBin('aabbccddffffffff')), 'ARITH-3 longer selector').not.toBe(true);
    expect(spend(new Uint8Array()), 'ARITH-3 empty pads').toBe(true);
  });

  it('DS-6 a plain input at a conditional delete cannot skip the batch census, and the kept node can', () => {
    const artifact = compileString(
      `${P} contract C { mapping(int => int) m;`
      + ' function drop(int k, int sel) { if (sel > 0) { require(k != 3); delete m[k]; } require(true); } }',
      { messageBus: false, forceStateful: true },
    );
    const fn = artifact.abi.find((entry) => entry.name === 'drop');
    if (!fn) throw new Error(`no drop; ${artifact.abi.map((entry) => entry.name).join(',')}`);
    const slot = fn.blockLayout?.slots.find((entry) => entry.kind === 'entry' && entry.softDelete);
    if (!slot || slot.offset === undefined) throw new Error(`no delete slot; ${JSON.stringify(fn.blockLayout ?? null)}`);
    const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
    const contractLock = p2sh32(redeem);
    const collection = artifact.stateLayout!.collections!.find((entry) => entry.name === 'm')!;
    const entryRedeem = scriptToBytecode(buildEntryNftCovenantScript(
      CATEGORY, computeCollectionHash(collection.signature), contractLock,
    ));
    const entryLock = p2sh32(entryRedeem);
    const zero = new Uint8Array(32);
    const keptSlot = keyToSlotMulti([num(7n)]);
    const kept = encodeEntryCommitment(keptSlot, zero, num(1n));
    const forged = encodeEntryCommitment(keyToSlotMulti([num(42n)]), zero, num(1234n));
    const bare = Uint8Array.of(0x51);
    const entryUnlock = pushesOf([num(0n), num(1n), entryRedeem]);
    const spend = (plain: boolean): true | string => {
      const values: Record<string, Uint8Array> = {};
      for (const entry of fn.inputs) {
        if (entry.name === 'k') values[entry.name] = num(7n);
        else if (entry.name === 'sel') values[entry.name] = num(0n);
        else if (/^__internal__vmapBatchSlot_\d+$/.test(entry.name)) values[entry.name] = keptSlot;
        else if (entry.name.includes('vmapBatchProof')) values[entry.name] = num(BigInt(slot.offset));
        else if (entry.name.includes('vmapBatchNext')) values[entry.name] = zero;
        else if (entry.name.includes('vmapBatchPredOut')) values[entry.name] = num(-1n);
        else if (entry.name.includes('TrailingCount')) values[entry.name] = num(0n);
        else if (entry.name.startsWith('__internal__')) values[entry.name] = new Uint8Array();
        else throw new Error(`unexpected input ${entry.name}`);
      }
      const inputs = [
        input(0, redeemUnlock(fn, redeem, values, false)),
        input(slot.offset, plain ? new Uint8Array() : entryUnlock),
      ];
      const outputs: VmOutput[] = [
        { lockingBytecode: contractLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
        {
          lockingBytecode: entryLock, valueSatoshis: VALUE,
          token: tokenOf('mutable', plain ? forged : kept),
        },
      ];
      const sources: SourceOutputs = [
        { lockingBytecode: contractLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
        plain
          ? { lockingBytecode: bare, valueSatoshis: VALUE }
          : { lockingBytecode: entryLock, valueSatoshis: VALUE, token: tokenOf('mutable', kept) },
      ];
      if (slot.offset !== 1) throw new Error(`delete slot offset ${slot.offset}`);
      return verdict(sources, { version: 2, locktime: 0, inputs, outputs });
    };
    expect(spend(false), 'DS-6 authorized').toBe(true);
    expect(spend(true), 'DS-6 plain delete slot').not.toBe(true);
  });

  it('DS-6 a message-bus route cannot skip a branched sorted batch with a bad slot or a short commitment', () => {
    const artifact = compileString(
      `${P} contract C { mapping(int => int) m;`
      + ' function drop(int k, int sel) { if (sel > 0) { require(k != 3); delete m[k]; } require(true); }'
      + ' function set(int k, int v, int sel) { if (sel > 0) { require(k != 3); this.m[k] = v; } require(true); } }',
      { messageBus: true, forceStateful: true },
    );
    const drop = artifact.abi.find((entry) => entry.name === 'drop');
    const set = artifact.abi.find((entry) => entry.name === 'set');
    if (!drop || !set) throw new Error(`missing route arms; ${artifact.abi.map((entry) => entry.name).join(',')}`);
    const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
    const contractLock = p2sh32(redeem);
    const dispatch = artifact.messageBus?.routeInBytecode === true;
    const collection = artifact.stateLayout!.collections!.find((entry) => entry.name === 'm')!;
    const entryRedeem = scriptToBytecode(buildEntryNftCovenantScript(
      CATEGORY, computeCollectionHash(collection.signature), contractLock,
    ));
    const entryLock = p2sh32(entryRedeem);
    const zero = new Uint8Array(32);
    const keptSlot = keyToSlotMulti([num(7n)]);
    const kept = encodeEntryCommitment(keptSlot, zero, num(1n));
    const other = encodeEntryCommitment(keyToSlotMulti([num(42n)]), zero, num(9n));
    const spend = (
      fn: AbiFunction, slot: Uint8Array, commitment: Uint8Array, outputCommitment: Uint8Array, sel: bigint,
    ): true | string => {
      const values: Record<string, Uint8Array> = {};
      for (const entry of fn.inputs) {
        if (entry.name === 'k') values[entry.name] = num(7n);
        else if (entry.name === 'v') values[entry.name] = num(2n);
        else if (entry.name === 'sel') values[entry.name] = num(sel);
        else if (/^__internal__vmapBatchSlot_\d+$/.test(entry.name)) values[entry.name] = slot;
        else if (entry.name.includes('vmapBatchProof')) values[entry.name] = num(1n);
        else if (entry.name.includes('vmapBatchNext')) values[entry.name] = zero;
        else if (entry.name.includes('vmapBatchPredOut')) values[entry.name] = num(-1n);
        else if (entry.name.includes('TrailingCount')) values[entry.name] = num(0n);
        else if (entry.name.startsWith('__internal__')) values[entry.name] = new Uint8Array();
        else throw new Error(`unexpected input ${entry.name}`);
      }
      const layout = fn.blockLayout?.slots.find((entry) => entry.kind === 'entry');
      if (!layout || layout.offset !== 1) throw new Error(`entry offset ${layout?.offset}`);
      return verdict([
        { lockingBytecode: contractLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
        { lockingBytecode: entryLock, valueSatoshis: VALUE, token: tokenOf('mutable', commitment) },
      ], {
        version: 2, locktime: 0,
        inputs: [
          input(0, redeemUnlock(fn, redeem, values, dispatch)),
          input(1, pushesOf([num(0n), num(1n), entryRedeem])),
        ],
        outputs: [
          { lockingBytecode: contractLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
          { lockingBytecode: entryLock, valueSatoshis: VALUE, token: tokenOf('mutable', outputCommitment) },
        ],
      });
    };
    expect(spend(drop, keptSlot, kept, kept, 0n), 'DS-6 route delete arm kept').toBe(true);
    expect(spend(drop, keptSlot, kept, encodeEntryCommitment(keptSlot, zero, num(0n)), 1n), 'DS-6 route delete taken')
      .toBe(true);
    expect(spend(set, keptSlot, kept, encodeEntryCommitment(keptSlot, zero, num(2n)), 1n), 'DS-6 route write arm')
      .toBe(true);
    expect(spend(drop, new Uint8Array(32).fill(0x11), kept, other, 0n), 'DS-6 route mismatched slot').not.toBe(true);
    expect(spend(drop, keptSlot, Uint8Array.of(1, 2, 3, 4), other, 0n), 'DS-6 route short commitment').not.toBe(true);
  });

  it('DX-4 a standalone callee cannot sit beside its own return carrier, and a carrier-less call can', () => {
    const artifact = compileString(
      `${P} contract Quoter { int q; function quote() public returns (int) { return this.q; } }`,
      { messageBus: false, forceStateful: true },
    );
    const fn = artifact.abi.find((entry) => entry.name === 'quote');
    if (!fn) throw new Error(`no quote; ${artifact.abi.map((entry) => entry.name).join(',')}`);
    const data = fn.blockLayout?.slots.find((entry) => entry.kind === 'dataNft');
    if (!data) throw new Error(`no data nft; ${JSON.stringify(fn.blockLayout ?? null)}`);
    const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
    const lock = p2sh32(redeem);
    const dataRedeem = scriptToBytecode(buildDataNftCovenantScript(CATEGORY, lock));
    const dataLock = p2sh32(dataRedeem);
    const commitment = hexToBin(buildPushdataCommitment(artifact.stateLayout!, { q: 5n }, data.nftIndex ?? 0));
    const bare = Uint8Array.of(0x51);
    const dispatch = artifact.messageBus?.routeInBytecode === true;
    const dataUnlock = pushesOf([num(0n), num(0n), dataRedeem]);
    const spend = (carrier: boolean): true | string => {
      const values: Record<string, Uint8Array> = {};
      for (const entry of fn.inputs) {
        if (entry.name === '__internal__returnOutputIdx') values[entry.name] = num(-1n);
        else if (entry.name.startsWith('__internal__')) values[entry.name] = new Uint8Array();
        else throw new Error(`unexpected input ${entry.name}`);
      }
      const inputs = [
        input(0, redeemUnlock(fn, redeem, values, dispatch)),
        input(data.offset, dataUnlock),
      ];
      const outputs: VmOutput[] = [
        { lockingBytecode: lock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
        { lockingBytecode: dataLock, valueSatoshis: VALUE, token: tokenOf('mutable', commitment) },
      ];
      const sources: SourceOutputs = [
        { lockingBytecode: lock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
        { lockingBytecode: dataLock, valueSatoshis: VALUE, token: tokenOf('mutable', commitment) },
      ];
      if (carrier) {
        inputs.push(input(2, new Uint8Array()));
        outputs.push({
          lockingBytecode: bare, valueSatoshis: 1_000n,
          token: tokenOf('none', num(9n)),
        });
        sources.push({ lockingBytecode: bare, valueSatoshis: 1_000n });
      }
      return verdict(sources, { version: 2, locktime: 0, inputs, outputs });
    };
    expect(spend(false), 'DX-4 authorized').toBe(true);
    expect(spend(true), 'DX-4 forged carrier').not.toBe(true);
  });

  it('SEM-11 an entry function id can only name a public function, and a decoded id is held to the same list', () => {
    const artifact = compileString(
      `${P} contract C {`
      + ' function ok(int x) public pure returns (int) { return x; }'
      + ' function secret(int x) private pure returns (int) { int y = x; require(y == x); return y; }'
      + ' function cover(int x) public pure returns (int) { return this.secret(x); }'
      + ' function run(function(int) external pure returns (int) cb, int x) public { require(cb(x) == x); }'
      + ' function decoded(bytes data, int x) public {'
      + ' function(int) external pure returns (int) cb = abi.decode(data, (function(int) external pure returns (int)));'
      + ' require(cb(x) == x); }'
      + ' function touch() public { this.run(this.ok, 1); require(true); } }',
      { messageBus: false },
    );
    const invoke = artifact.debug?.invokeDebug ?? {};
    const idOf = (name: string): bigint => {
      const found = Object.entries(invoke).find(([, info]) => info.name === name);
      if (!found) throw new Error(`no id for ${name}; ${Object.entries(invoke).map(([id, info]) => `${id}:${info.name ?? ''}`).join(',')}`);
      return BigInt(found[0]);
    };
    const okId = idOf('ok');
    const secretId = idOf('secret');
    const call = (name: string, valuesFor: (entry: { name: string }) => Uint8Array | undefined): true | string => {
      const fn = artifact.abi.find((entry) => entry.name === name);
      if (!fn) throw new Error(`no ${name}`);
      const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
      const lock = p2sh32(redeem);
      const dispatch = fn.selector !== undefined;
      const values: Record<string, Uint8Array> = {};
      for (const entry of fn.inputs) {
        const value = valuesFor(entry);
        if (value === undefined) throw new Error(`unexpected input ${name}.${entry.name}`);
        values[entry.name] = value;
      }
      const transaction: VmTransaction = {
        version: 2, locktime: 0,
        inputs: [input(0, redeemUnlock(fn, redeem, values, dispatch))],
        outputs: [{ lockingBytecode: lock, valueSatoshis: VALUE }],
      };
      const sourceOutputs: SourceOutputs = [{ lockingBytecode: lock, valueSatoshis: VALUE }];
      return vm.verify({ sourceOutputs, transaction });
    };
    expect(call('run', (entry) => (
      entry.name === 'cb' ? num(okId) : entry.name === 'x' ? num(1n) : undefined
    )), 'SEM-11 authorized').toBe(true);
    expect(call('run', (entry) => (
      entry.name === 'cb' ? num(secretId) : entry.name === 'x' ? num(1n) : undefined
    )), 'SEM-11 private id').not.toBe(true);
  });

  it('SEM-11 a function id from abi.decode can only name a public function', () => {
    const artifact = compileString(
      `${P} contract C {`
      + ' function ok(int x) public pure returns (int) { return x; }'
      + ' function secret(int x) private pure returns (int) { int y = x; require(y == x); return y; }'
      + ' function cover(int x) public pure returns (int) { return this.secret(x); }'
      + ' function run(function(int) external pure returns (int) cb, int x) public { require(cb(x) == x); }'
      + ' function decoded(bytes data, int x) public {'
      + ' function(int) external pure returns (int) cb = abi.decode(data, (function(int) external pure returns (int)));'
      + ' require(cb(x) == x); }'
      + ' function touch() public { this.run(this.ok, 1); require(true); } }',
      { messageBus: false },
    );
    const invoke = artifact.debug?.invokeDebug ?? {};
    const idOf = (name: string): bigint => {
      const found = Object.entries(invoke).find(([, info]) => info.name === name);
      if (!found) throw new Error(`no id for ${name}`);
      return BigInt(found[0]);
    };
    const okId = idOf('ok');
    const secretId = idOf('secret');
    const encoded = (id: bigint): Uint8Array => {
      const value = Number(id);
      if (value === 0) return Uint8Array.of(0x00);
      if (value === -1) return Uint8Array.of(0x4f);
      if (value >= 1 && value <= 16) return Uint8Array.of(0x50 + value);
      return num(id);
    };
    const fn = artifact.abi.find((entry) => entry.name === 'decoded');
    if (!fn) throw new Error('no decoded');
    const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
    const lock = p2sh32(redeem);
    const spend = (id: bigint): true | string => {
      const values: Record<string, Uint8Array> = { data: encoded(id), x: num(1n) };
      const transaction: VmTransaction = {
        version: 2, locktime: 0,
        inputs: [input(0, redeemUnlock(fn, redeem, values, fn.selector !== undefined))],
        outputs: [{ lockingBytecode: lock, valueSatoshis: VALUE }],
      };
      return vm.verify({
        sourceOutputs: [{ lockingBytecode: lock, valueSatoshis: VALUE }],
        transaction,
      });
    };
    expect(spend(okId), 'SEM-11 decoded authorized').toBe(true);
    expect(spend(secretId), 'SEM-11 decoded private id').not.toBe(true);
  });

  it('ARITH-4 a static abi.decode rejects a last word longer than 32 bytes, and the canonical words verify', () => {
    const artifact = compileString(
      `${P} contract W() { function spend(bytes data) {`
      + ' (uint256 nonce, uint256 v) = abi.decode(data, (uint256, uint256));'
      + ' require(nonce == 7); require(v == 1); } }',
      { evmCompat: true, messageBus: false },
    );
    const fn = artifact.abi.find((entry) => entry.name === 'spend');
    if (!fn) throw new Error(`no spend; ${artifact.abi.map((entry) => entry.name).join(',')}`);
    const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
    const lock = p2sh32(redeem);
    const dispatch = artifact.messageBus?.routeInBytecode === true;
    const word = (value: bigint): Uint8Array => {
      const out = new Uint8Array(32);
      let rest = value;
      for (let i = 31; rest > 0n && i >= 0; i -= 1) {
        out[i] = Number(rest & 0xffn);
        rest >>= 8n;
      }
      return out;
    };
    const join = (parts: readonly Uint8Array[]): Uint8Array => {
      const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
      let offset = 0;
      for (const part of parts) {
        out.set(part, offset);
        offset += part.length;
      }
      return out;
    };
    const spend = (data: Uint8Array): true | string => {
      const values: Record<string, Uint8Array> = {};
      for (const entry of fn.inputs) {
        if (entry.name === 'data') values[entry.name] = data;
        else throw new Error(`unexpected input ${entry.name}`);
      }
      return vm.verify({
        sourceOutputs: [{ lockingBytecode: lock, valueSatoshis: VALUE }],
        transaction: {
          version: 2, locktime: 0,
          inputs: [input(0, redeemUnlock(fn, redeem, values, dispatch))],
          outputs: [{ lockingBytecode: lock, valueSatoshis: VALUE }],
        },
      });
    };
    const canonical = join([word(7n), word(1n)]);
    const padded = join([word(7n), Uint8Array.of(0x00), word(1n)]);
    expect(canonical.length, 'ARITH-4 canonical width').toBe(64);
    expect(spend(canonical), 'ARITH-4 authorized').toBe(true);
    expect(spend(padded), 'ARITH-4 padded last word').not.toBe(true);
  });

  it('ARITH-6 a native last bytes32 longer than its push is refused, and the exact push verifies', () => {
    const artifact = compileString(
      `${P} contract W() { function spend(bytes data) {`
      + ' (int n, bytes32 tag) = abi.decode(data, (int, bytes32));'
      + ' require(n == 1); require(tag == tag); } }',
      { messageBus: false },
    );
    const fn = artifact.abi.find((entry) => entry.name === 'spend');
    if (!fn) throw new Error('no spend');
    const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
    const lock = p2sh32(redeem);
    const tag = new Uint8Array(32).fill(0xaa);
    const frame = (prefix: number, payload: Uint8Array): Uint8Array => {
      const out = new Uint8Array(1 + 1 + payload.length);
      out[0] = 0x51;
      out[1] = prefix;
      out.set(payload, 2);
      return out;
    };
    const spend = (data: Uint8Array): true | string => vm.verify({
      sourceOutputs: [{ lockingBytecode: lock, valueSatoshis: VALUE }],
      transaction: {
        version: 2, locktime: 0,
        inputs: [input(0, redeemUnlock(fn, redeem, { data }, false))],
        outputs: [{ lockingBytecode: lock, valueSatoshis: VALUE }],
      },
    });
    expect(spend(frame(32, tag)), 'ARITH-6 authorized bytes32').toBe(true);
    expect(spend(frame(32, new Uint8Array(40).fill(0xaa))), 'ARITH-6 long bytes32').not.toBe(true);
  });

  it('ARITH-6 a native last bytes32 with the wrong prefix byte is refused', () => {
    const artifact = compileString(
      `${P} contract W() { function spend(bytes data) {`
      + ' (int n, bytes32 tag) = abi.decode(data, (int, bytes32));'
      + ' require(n == 1); require(tag == tag); } }',
      { messageBus: false },
    );
    const fn = artifact.abi.find((entry) => entry.name === 'spend');
    if (!fn) throw new Error('no spend');
    const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
    const lock = p2sh32(redeem);
    const tag = new Uint8Array(32).fill(0xaa);
    const spend = (data: Uint8Array): true | string => vm.verify({
      sourceOutputs: [{ lockingBytecode: lock, valueSatoshis: VALUE }],
      transaction: {
        version: 2, locktime: 0,
        inputs: [input(0, redeemUnlock(fn, redeem, { data }, false))],
        outputs: [{ lockingBytecode: lock, valueSatoshis: VALUE }],
      },
    });
    const honest = new Uint8Array(34);
    honest[0] = 0x51;
    honest[1] = 32;
    honest.set(tag, 2);
    const forged = new Uint8Array(34);
    forged[0] = 0x51;
    forged[1] = 40;
    forged.set(tag, 2);
    expect(spend(honest), 'ARITH-6 prefix authorized').toBe(true);
    expect(spend(forged), 'ARITH-6 wrong prefix').not.toBe(true);
  });

  it('ARITH-6 an out-of-range enum from abi.decode is refused, and a member verifies', () => {
    const artifact = compileString(
      `${P} enum Status { PENDING, ACTIVE, DONE } contract W() { function spend(bytes data) {`
      + ' Status s = abi.decode(data, (Status)); require(s == s); } }',
      { messageBus: false },
    );
    const fn = artifact.abi.find((entry) => entry.name === 'spend');
    if (!fn) throw new Error('no enum spend');
    const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
    const lock = p2sh32(redeem);
    const spend = (data: Uint8Array): true | string => vm.verify({
      sourceOutputs: [{ lockingBytecode: lock, valueSatoshis: VALUE }],
      transaction: {
        version: 2, locktime: 0,
        inputs: [input(0, redeemUnlock(fn, redeem, { data }, false))],
        outputs: [{ lockingBytecode: lock, valueSatoshis: VALUE }],
      },
    });
    expect(spend(Uint8Array.of(0x51)), 'ARITH-6 authorized enum').toBe(true);
    expect(spend(Uint8Array.of(0x55)), 'ARITH-6 enum out of range').not.toBe(true);
  });

  it('SEM-4 a value argument stays a copy when a nested helper writes it, and the post-write value is not credited', () => {
    const source = (seen: number): string => `${P} contract C { int accIndex;`
      + ' function poke() { int seen = _note(accIndex); require(seen == ' + seen + '); require(accIndex == 1); }'
      + ' function _note(int idx) internal returns (int) { _bump(); return idx; }'
      + ' function _bump() internal { accIndex = accIndex + 1; } }';
    const spend = (seen: number): true | string => {
      const artifact = compileString(source(seen), { messageBus: false, forceStateful: true });
      const fn = artifact.abi.find((entry) => entry.name === 'poke');
      if (!fn) throw new Error(`no poke; ${artifact.abi.map((entry) => entry.name).join(',')}`);
      const data = fn.blockLayout?.slots.find((entry) => entry.kind === 'dataNft');
      if (!data) {
        throw new Error(`layout ${JSON.stringify(fn.blockLayout ?? null)}`
          + ` inputs ${fn.inputs.map((entry) => entry.name).join(',')}`);
      }
      const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
      const lock = p2sh32(redeem);
      const dataRedeem = scriptToBytecode(buildDataNftCovenantScript(CATEGORY, lock));
      const dataLock = p2sh32(dataRedeem);
      const before = hexToBin(buildPushdataCommitment(artifact.stateLayout!, { accIndex: 0n }, data.nftIndex ?? 0));
      const after = hexToBin(buildPushdataCommitment(artifact.stateLayout!, { accIndex: 1n }, data.nftIndex ?? 0));
      const values: Record<string, Uint8Array> = {};
      for (const entry of fn.inputs) {
        if (entry.name.startsWith('__internal__')) values[entry.name] = new Uint8Array();
        else throw new Error(`unexpected input ${entry.name}`);
      }
      if (data.offset !== 1) throw new Error(`data offset ${data.offset}`);
      return verdict([
        { lockingBytecode: lock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
        { lockingBytecode: dataLock, valueSatoshis: VALUE, token: tokenOf('mutable', before) },
      ], {
        version: 2, locktime: 0,
        inputs: [
          input(0, redeemUnlock(fn, redeem, values, false)),
          input(1, pushesOf([num(0n), num(1n), dataRedeem])),
        ],
        outputs: [
          { lockingBytecode: lock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
          { lockingBytecode: dataLock, valueSatoshis: VALUE, token: tokenOf('mutable', after) },
        ],
      });
    };
    expect(spend(1), 'SEM-4 post-bump read').not.toBe(true);
    expect(spend(0), 'SEM-4 authorized copy').toBe(true);
  });

  it('SEM-5 an expression inline refuses a same-arity overload, and a single storage helper still inlines', () => {
    const ambiguous = `${P} contract C {`
      + ' function at(mapping(int => int) storage a, int i) internal returns (int) { return 1; }'
      + ' function at(int i, int j) internal returns (int) { require(i == 0); return j; }'
      + ' function spend(int i) { require(at(i, 1) == 1); } }';
    const single = `${P} contract C { mapping(int => int) m;`
      + ' function at(mapping(int => int) storage a, int i) internal returns (int) { return a[i]; }'
      + ' function spend() { require(at(m, 0) == 0); } }';
    let artifact: ReturnType<typeof compileString> | undefined;
    try {
      artifact = compileString(ambiguous, { messageBus: false });
    } catch (error) {
      expect(String(error), 'SEM-5 overload').toMatch(/multiple 2-argument overloads/);
    }
    if (artifact) {
      const fn = artifact.abi.find((entry) => entry.name === 'spend');
      if (!fn) throw new Error('no spend');
      const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
      const lock = p2sh32(redeem);
      const spend = (i: bigint): true | string => vm.verify({
        sourceOutputs: [{ lockingBytecode: lock, valueSatoshis: VALUE }],
        transaction: {
          version: 2, locktime: 0,
          inputs: [input(0, redeemUnlock(fn, redeem, { i: num(i) }, false))],
          outputs: [{ lockingBytecode: lock, valueSatoshis: VALUE }],
        },
      });
      expect(spend(0n), 'SEM-5 authorized').toBe(true);
      expect(spend(1n), 'SEM-5 dropped require').not.toBe(true);
    }
    expect(compileString(single, { messageBus: false }).contractName, 'SEM-5 single helper').toBe('C');
  });

  it('SEM-11 a function id returned by another contract can only name a public function', async () => {
    const options = { messageBus: false, evmCompat: true, forceStateful: true, suppressWarnings: true };
    const callerArtifact = compileString(
      `${P} interface IP { function get(int which) external returns (int, function(int) external returns (int)); }`
      + ' contract FnIdReturned {'
      + ' function g(int x) public pure returns (int) { return x + 1; }'
      + ' function secret(int v) private pure returns (int) { int y = v; require(y == v); return y; }'
      + ' function cover(int v) public pure returns (int) { return this.secret(v); }'
      + ' function run(function(int) external returns (int) cb, int x) public { require(cb(x) == x + 1); }'
      + ' function viaSelf(int x) public { this.run(this.g, x); require(true); }'
      + ' function fromCall(bytes target, int which, int x) public {'
      + ' (int n, function(int) external returns (int) f) = IP(target).get(which);'
      + ' require(f(x) == x + n); } }',
      options,
    );
    const pickerArtifact = compileString(
      `${P} contract Picker {`
      + ' function ok(int x) public pure returns (int) { return x + 1; }'
      + ' function other(int x) public pure returns (int) { return x; }'
      + ' function get(int which) public returns (int, function(int) external returns (int)) {'
      + ' if (which == 0) { return (1, this.ok); } return (0, this.other); } }',
      options,
    );
    const idOf = (artifact: ReturnType<typeof compileString>, name: string): number => {
      const found = Object.entries(artifact.debug?.invokeDebug ?? {}).find(([, info]) => info.name === name);
      if (!found) {
        throw new Error(`no id for ${name}; ${Object.entries(artifact.debug?.invokeDebug ?? {})
          .map(([id, info]) => `${id}:${info.name ?? ''}`).join(',')}`);
      }
      return Number(found[0]);
    };
    expect(idOf(pickerArtifact, 'ok'), 'picker ok id').toBe(idOf(callerArtifact, 'g'));
    expect(idOf(pickerArtifact, 'other'), 'picker other id').toBe(idOf(callerArtifact, 'secret'));
    const callerFn = callerArtifact.abi.find((entry) => entry.name === 'fromCall');
    const pickerFn = pickerArtifact.abi.find((entry) => entry.name === 'get');
    if (!callerFn || !pickerFn) throw new Error('missing fromCall or get');
    const callerRedeem = scriptToBytecode(asmToScript(callerArtifact.bytecode));
    const pickerRedeem = scriptToBytecode(asmToScript(pickerArtifact.bytecode));
    const callerLock = p2sh32(callerRedeem);
    const pickerLock = p2sh32(pickerRedeem);
    const callerCategory = Uint8Array.from({ length: 32 }, (_, i) => (0x41 + i * 3) & 0xff);
    const encodedId = (id: number): Uint8Array => {
      if (id === 0) return Uint8Array.of(0x00);
      if (id === -1) return Uint8Array.of(0x4f);
      if (id >= 1 && id <= 16) return Uint8Array.of(0x50 + id);
      return num(BigInt(id));
    };
    const join = (parts: readonly Uint8Array[]): Uint8Array => {
      const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
      let offset = 0;
      for (const part of parts) {
        out.set(part, offset);
        offset += part.length;
      }
      return out;
    };
    const spend = (which: bigint): Array<true | string> => {
      const n = which === 0n ? 1 : 0;
      const returned = which === 0n ? idOf(pickerArtifact, 'ok') : idOf(pickerArtifact, 'other');
      const commitment = join([encodedId(n), encodedId(returned)]);
      const callerValues: Record<string, Uint8Array> = {
        target: pickerLock,
        which: num(which),
        x: num(7n),
        __internal__externalCallInputBase: num(1n),
        __internal__extcallAnchorIdx0: num(-1n),
        __internal__externalReturnOutputIdx: num(2n),
      };
      const pickerValues: Record<string, Uint8Array> = {
        which: num(which),
        __internal__returnOutputIdx: num(2n),
      };
      const callerDispatch = callerFn.selector !== undefined;
      const pickerDispatch = pickerFn.selector !== undefined;
      const transaction: VmTransaction = {
        version: 2, locktime: 0,
        inputs: [
          input(0, redeemUnlock(callerFn, callerRedeem, callerValues, callerDispatch)),
          input(1, redeemUnlock(pickerFn, pickerRedeem, pickerValues, pickerDispatch)),
        ],
        outputs: [
          {
            lockingBytecode: callerLock, valueSatoshis: VALUE,
            token: { category: callerCategory, amount: 0n, nft: { capability: 'minting', commitment: new Uint8Array() } },
          },
          {
            lockingBytecode: pickerLock, valueSatoshis: VALUE,
            token: tokenOf('minting', new Uint8Array()),
          },
          {
            lockingBytecode: Uint8Array.of(0x51), valueSatoshis: 1_000n,
            token: tokenOf('none', commitment),
          },
        ],
      };
      const sourceOutputs: SourceOutputs = [
        {
          lockingBytecode: callerLock, valueSatoshis: VALUE,
          token: { category: callerCategory, amount: 0n, nft: { capability: 'minting', commitment: new Uint8Array() } },
        },
        {
          lockingBytecode: pickerLock, valueSatoshis: VALUE,
          token: tokenOf('minting', new Uint8Array()),
        },
      ];
      return transaction.inputs.map((_entry, inputIndex) => {
        const evaluated = vm.evaluate({ inputIndex, sourceOutputs, transaction });
        return evaluated.error === undefined ? true : evaluated.error;
      });
    };
    const honest = spend(0n);
    expect(honest.every((result) => result === true), `SEM-11 returned id authorized ${honest.join(' | ')}`).toBe(true);
    const hostile = spend(1n);
    expect(hostile[0], 'SEM-11 returned private id').not.toBe(true);
    expect(hostile[1], `SEM-11 callee still verifies ${hostile.join(' | ')}`).toBe(true);
  });

  it('DX-3 a commitment that only starts with SCID cannot skip the event pin, and a real anchor can', () => {
    const artifact = compileString(
      `${P} contract C { int n; event Log(int code, bytes note);`
      + ' function poke() { this.n = this.n + 1; require(true); } }',
      { messageBus: false, forceStateful: true },
    );
    const fn = artifact.abi.find((entry) => entry.name === 'poke');
    if (!fn) throw new Error(`no poke; ${artifact.abi.map((entry) => entry.name).join(',')}`);
    const data = fn.blockLayout?.slots.find((entry) => entry.kind === 'dataNft');
    if (!data || data.offset !== 1 || fn.blockLayout?.slots.some((entry) => entry.kind === 'event')) {
      throw new Error(`layout ${JSON.stringify(fn.blockLayout ?? null)}`);
    }
    const signature = artifact.events?.find((event) => event.name === 'Log')?.signature;
    if (!signature) throw new Error(`no Log signature; ${JSON.stringify(artifact.events ?? null)}`);
    const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
    const lock = p2sh32(redeem);
    const dataRedeem = scriptToBytecode(buildDataNftCovenantScript(CATEGORY, lock));
    const dataLock = p2sh32(dataRedeem);
    const eventRedeem = scriptToBytecode(buildEventNftCovenantScript(CATEGORY, computeEventNameHash(signature)));
    const eventLock = p2sh32(eventRedeem);
    const before = hexToBin(buildPushdataCommitment(artifact.stateLayout!, { n: 0n }, data.nftIndex ?? 0));
    const after = hexToBin(buildPushdataCommitment(artifact.stateLayout!, { n: 1n }, data.nftIndex ?? 0));
    const values: Record<string, Uint8Array> = {};
    for (const entry of fn.inputs) {
      if (entry.name.startsWith('__internal__')) values[entry.name] = new Uint8Array();
      else throw new Error(`unexpected input ${entry.name}`);
    }
    if (lock.length !== 35) throw new Error(`master lock is ${lock.length} bytes`);
    const scid = Uint8Array.of(0x53, 0x43, 0x49, 0x44, 0x49, 0x44);
    const anchor = new Uint8Array(5 + lock.length);
    anchor.set(Uint8Array.of(0x53, 0x43, 0x49, 0x44, 0x01), 0);
    anchor.set(lock, 5);
    // The direct function body does not consume a selector. Pushing one leaves it beside OP_1.
    // Master and data values are preserved exactly, so the appended output is paid by an OP_1 coin.
    const dust = 1_000n;
    const spend = (extra: VmOutput | undefined): true | string => {
      const inputs = [
        input(0, redeemUnlock(fn, redeem, values, false)),
        input(1, pushesOf([num(0n), num(1n), dataRedeem])),
      ];
      const outputs: VmOutput[] = [
        { lockingBytecode: lock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
        { lockingBytecode: dataLock, valueSatoshis: VALUE, token: tokenOf('mutable', after) },
      ];
      const sourceOutputs: SourceOutputs = [
        { lockingBytecode: lock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
        { lockingBytecode: dataLock, valueSatoshis: VALUE, token: tokenOf('mutable', before) },
      ];
      if (extra) {
        inputs.push(input(2, new Uint8Array()));
        sourceOutputs.push({ lockingBytecode: Uint8Array.of(0x51), valueSatoshis: dust });
        outputs.push(extra);
      }
      return verdict(sourceOutputs, { version: 2, locktime: 0, inputs, outputs });
    };
    expect(spend(undefined), 'DX-3 authorized').toBe(true);
    expect(spend({
      lockingBytecode: eventLock, valueSatoshis: dust,
      token: tokenOf('none', scid),
    }), 'DX-3 SCID-prefixed log').not.toBe(true);
    expect(spend({
      lockingBytecode: Uint8Array.of(0x6d, 0x51), valueSatoshis: dust,
      token: tokenOf('none', anchor),
    }), 'DX-3 real anchor').toBe(true);
  });

  it('ARITH-2 a struct bytes32 with a longer prefix cannot be stored, and the canonical struct can', () => {
    const artifact = compileString(
      `${P} struct Claim { bytes32 root; address owner; }`
      + ' contract C { Claim rec; function set(Claim c) { rec = c; require(true); } }',
      { messageBus: false, forceStateful: true },
    );
    const fn = artifact.abi.find((entry) => entry.name === 'set');
    if (!fn) throw new Error(`no set; ${artifact.abi.map((entry) => entry.name).join(',')}`);
    const data = fn.blockLayout?.slots.find((entry) => entry.kind === 'dataNft');
    if (!data || data.offset !== 1) throw new Error(`layout ${JSON.stringify(fn.blockLayout ?? null)}`);
    const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
    const lock = p2sh32(redeem);
    const dataRedeem = scriptToBytecode(buildDataNftCovenantScript(CATEGORY, lock));
    const dataLock = p2sh32(dataRedeem);
    const root = new Uint8Array(32).fill(0x11);
    const owner = new Uint8Array(25).fill(0x22);
    const frame = (width: number, payload: Uint8Array): Uint8Array => {
      const out = new Uint8Array(1 + payload.length);
      out[0] = width;
      out.set(payload, 1);
      return out;
    };
    const join = (parts: readonly Uint8Array[]): Uint8Array => {
      const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
      let offset = 0;
      for (const part of parts) {
        out.set(part, offset);
        offset += part.length;
      }
      return out;
    };
    const honest = join([frame(32, root), frame(owner.length, owner)]);
    // A width byte of 40 is not a bytes32. The old skip still took the next 33 bytes and the rest became owner.
    const attack = frame(40, new Uint8Array(40));
    const canonical = hexToBin(buildPushdataCommitment(
      artifact.stateLayout!, { rec: { root, owner } }, data.nftIndex ?? 0,
    ));
    if (canonical.length !== honest.length || canonical.some((byte, index) => byte !== honest[index])) {
      throw new Error(`canonical commitment is ${canonical.length} bytes, argument is ${honest.length}`);
    }
    const valuesFor = (blob: Uint8Array): Record<string, Uint8Array> => {
      const values: Record<string, Uint8Array> = { c: blob };
      for (const entry of fn.inputs) {
        if (entry.name === 'c') continue;
        if (entry.name.startsWith('__internal__')) values[entry.name] = new Uint8Array();
        else throw new Error(`unexpected input ${entry.name}`);
      }
      return values;
    };
    const spend = (blob: Uint8Array): true | string => verdict([
      { lockingBytecode: lock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
      { lockingBytecode: dataLock, valueSatoshis: VALUE, token: tokenOf('mutable', canonical) },
    ], {
      version: 2, locktime: 0,
      inputs: [
        input(0, redeemUnlock(fn, redeem, valuesFor(blob), false)),
        input(1, pushesOf([num(0n), num(1n), dataRedeem])),
      ],
      outputs: [
        { lockingBytecode: lock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
        { lockingBytecode: dataLock, valueSatoshis: VALUE, token: tokenOf('mutable', blob) },
      ],
    });
    expect(spend(honest), 'ARITH-2 authorized').toBe(true);
    expect(spend(attack), 'ARITH-2 long bytes32').not.toBe(true);
  });

  it('SEM-3 a break inside for-of stops the walk, and summing every entry does not', () => {
    const artifact = compileString(
      `${P} contract C { enumerable mapping(int => int) bal;`
      + ' function total(int stopAt, int expected) { int sum = 0; int seen = 0;'
      + ' for (int v of this.bal) { if (seen == stopAt) break; sum = sum + v; seen = seen + 1; }'
      + ' require(sum == expected); } }',
      { messageBus: false, forceStateful: true },
    );
    const fn = artifact.abi.find((entry) => entry.name === 'total');
    if (!fn) throw new Error(`no total; ${artifact.abi.map((entry) => entry.name).join(',')}`);
    const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
    const lock = p2sh32(redeem);
    const collection = artifact.stateLayout?.collections?.find((entry) => entry.name === 'bal');
    if (!collection?.sorted) throw new Error('bal is not a sorted enumerable mapping');
    const entryRedeem = scriptToBytecode(buildEntryNftCovenantScript(
      CATEGORY, computeCollectionHash(collection.signature), lock,
    ));
    const entryLock = p2sh32(entryRedeem);
    const entryUnlock = pushesOf([num(0n), num(0n), entryRedeem]);
    const zero = new Uint8Array(32);
    const slotA = keyToSlot(num(1n));
    const slotB = keyToSlot(num(2n));
    const head = encodeEntryCommitment(zero, slotA, new Uint8Array());
    const first = encodeEntryCommitment(slotA, slotB, num(10n));
    const second = encodeEntryCommitment(slotB, zero, num(20n));
    const chain = [head, first, second];
    const blockSize = fn.blockLayout?.blockSize ?? 1;
    const data = fn.blockLayout?.slots.find((entry) => entry.kind === 'dataNft');
    const dataCommitment = data
      ? hexToBin(buildPushdataCommitment(artifact.stateLayout!, {}, data.nftIndex ?? 0))
      : undefined;
    const dataRedeem = data ? scriptToBytecode(buildDataNftCovenantScript(CATEGORY, lock)) : undefined;
    const dataLock = dataRedeem ? p2sh32(dataRedeem) : undefined;
    const spend = (stopAt: bigint, expected: bigint): true | string => {
      const values: Record<string, Uint8Array> = {
        stopAt: num(stopAt),
        expected: num(expected),
      };
      for (const entry of fn.inputs) {
        if (entry.name === 'stopAt' || entry.name === 'expected') continue;
        if (/^__internal__collectionIterCount_\d+$/.test(entry.name)) values[entry.name] = num(BigInt(chain.length));
        else if (entry.name.startsWith('__internal__')) values[entry.name] = new Uint8Array();
        else throw new Error(`unexpected input ${entry.name}`);
      }
      const sources: SourceOutputs = [
        { lockingBytecode: lock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
      ];
      const outputs: VmOutput[] = [
        { lockingBytecode: lock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
      ];
      if (data && dataLock && dataRedeem && dataCommitment) {
        sources.push({
          lockingBytecode: dataLock, valueSatoshis: VALUE, token: tokenOf('mutable', dataCommitment),
        });
        outputs.push({
          lockingBytecode: dataLock, valueSatoshis: VALUE, token: tokenOf('mutable', dataCommitment),
        });
      }
      for (const commitment of chain) {
        const coin = {
          lockingBytecode: entryLock, valueSatoshis: VALUE, token: tokenOf('mutable', commitment),
        };
        sources.push(coin);
        outputs.push(coin);
      }
      const inputs = [
        input(0, redeemUnlock(fn, redeem, values, false)),
      ];
      if (data && dataRedeem) inputs.push(input(1, pushesOf([num(0n), num(0n), dataRedeem])));
      for (let index = 0; index < chain.length; index += 1) {
        inputs.push(input(blockSize + index, entryUnlock));
      }
      if (sources.length !== blockSize + chain.length) {
        throw new Error(`block ${blockSize} sources ${sources.length} chain ${chain.length}`);
      }
      return verdict(sources, { version: 2, locktime: 0, inputs, outputs });
    };
    expect(spend(0n, 30n), 'SEM-3 for-of ignored break').not.toBe(true);
    expect(spend(0n, 0n), 'SEM-3 for-of break').toBe(true);
  });

  it('SEM-3 a continue inside for-of skips that entry, and adding it does not', () => {
    const artifact = compileString(
      `${P} contract C { enumerable mapping(int => int) bal;`
      + ' function total(int skip, int expected) { int sum = 0;'
      + ' for (int v of this.bal) { if (v == skip) continue; sum = sum + v; }'
      + ' require(sum == expected); } }',
      { messageBus: false, forceStateful: true },
    );
    const fn = artifact.abi.find((entry) => entry.name === 'total');
    if (!fn) throw new Error(`no total; ${artifact.abi.map((entry) => entry.name).join(',')}`);
    const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
    const lock = p2sh32(redeem);
    const collection = artifact.stateLayout?.collections?.find((entry) => entry.name === 'bal');
    if (!collection?.sorted) throw new Error('bal is not a sorted enumerable mapping');
    const entryRedeem = scriptToBytecode(buildEntryNftCovenantScript(
      CATEGORY, computeCollectionHash(collection.signature), lock,
    ));
    const entryLock = p2sh32(entryRedeem);
    const entryUnlock = pushesOf([num(0n), num(0n), entryRedeem]);
    const zero = new Uint8Array(32);
    const slotA = keyToSlot(num(1n));
    const slotB = keyToSlot(num(2n));
    const chain = [
      encodeEntryCommitment(zero, slotA, new Uint8Array()),
      encodeEntryCommitment(slotA, slotB, num(10n)),
      encodeEntryCommitment(slotB, zero, num(20n)),
    ];
    const blockSize = fn.blockLayout?.blockSize ?? 1;
    const data = fn.blockLayout?.slots.find((entry) => entry.kind === 'dataNft');
    const dataCommitment = data
      ? hexToBin(buildPushdataCommitment(artifact.stateLayout!, {}, data.nftIndex ?? 0))
      : undefined;
    const dataRedeem = data ? scriptToBytecode(buildDataNftCovenantScript(CATEGORY, lock)) : undefined;
    const dataLock = dataRedeem ? p2sh32(dataRedeem) : undefined;
    const spend = (skip: bigint, expected: bigint): true | string => {
      const values: Record<string, Uint8Array> = { skip: num(skip), expected: num(expected) };
      for (const entry of fn.inputs) {
        if (entry.name === 'skip' || entry.name === 'expected') continue;
        if (/^__internal__collectionIterCount_\d+$/.test(entry.name)) values[entry.name] = num(BigInt(chain.length));
        else if (entry.name.startsWith('__internal__')) values[entry.name] = new Uint8Array();
        else throw new Error(`unexpected input ${entry.name}`);
      }
      const sources: SourceOutputs = [
        { lockingBytecode: lock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
      ];
      const outputs: VmOutput[] = [
        { lockingBytecode: lock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
      ];
      if (data && dataLock && dataRedeem && dataCommitment) {
        sources.push({
          lockingBytecode: dataLock, valueSatoshis: VALUE, token: tokenOf('mutable', dataCommitment),
        });
        outputs.push({
          lockingBytecode: dataLock, valueSatoshis: VALUE, token: tokenOf('mutable', dataCommitment),
        });
      }
      for (const commitment of chain) {
        const coin = {
          lockingBytecode: entryLock, valueSatoshis: VALUE, token: tokenOf('mutable', commitment),
        };
        sources.push(coin);
        outputs.push(coin);
      }
      const inputs = [input(0, redeemUnlock(fn, redeem, values, false))];
      if (data && dataRedeem) inputs.push(input(1, pushesOf([num(0n), num(0n), dataRedeem])));
      for (let index = 0; index < chain.length; index += 1) inputs.push(input(blockSize + index, entryUnlock));
      return verdict(sources, { version: 2, locktime: 0, inputs, outputs });
    };
    expect(spend(10n, 30n), 'SEM-3 for-of ignored continue').not.toBe(true);
    expect(spend(10n, 20n), 'SEM-3 for-of continue').toBe(true);
  });

  it('ARITH-5 a split-facet to64 does not truncate, and an in-range value verifies', () => {
    const bundle = compileStringSplit(
      'pragma solidity ^0.8.20;'
      + ' library BoringMath { function to64(uint256 a) internal pure returns (uint64 c) {'
      + ' require(a <= uint64(-1)); c = uint64(a); } }'
      + ' contract C { uint256 n; using BoringMath for uint256;'
      + ' function spend(uint256 x) external { require(x.to64() == uint64(0)); }'
      + ' function touch() external { n = n + 1; require(n > 0); } }',
      { evmCompat: true, messageBus: false, forceSplit: true, suppressWarnings: true },
    );
    const facetInfo = bundle.manifest.facets.find((facet) => facet.functions.includes('spend'));
    if (!facetInfo) {
      throw new Error(`no spend facet; ${bundle.manifest.facets.map((facet) => facet.functions.join('+')).join(',')}`);
    }
    const artifact = bundle.facets[facetInfo.name];
    const fn = artifact.abi.find((entry) => entry.name === 'spend');
    if (!fn) throw new Error(`no spend; ${artifact.abi.map((entry) => entry.name).join(',')}`);
    const proxyCategory = Uint8Array.from({ length: 32 }, (_, i) => (0x11 + i * 3) & 0xff);
    const brand = Uint8Array.from(proxyCategory).reverse();
    const redeem = new Uint8Array([
      ...encodeDataPush(brand),
      ...scriptToBytecode(asmToScript(artifact.bytecode)),
    ]);
    if (redeem.length > 10_000) throw new Error(`facet redeem is ${redeem.length} bytes`);
    const delegateLock = p2sh32(redeem);
    const proxyRedeem = Uint8Array.of(0x51);
    const proxyLock = p2sh32(proxyRedeem);
    if (fn.blockLayout?.blockSize !== 2) {
      throw new Error(`layout ${JSON.stringify(fn.blockLayout ?? null)}`);
    }
    const delegateIndex = 2;
    const values: Record<string, Uint8Array> = { x: num(0n) };
    for (const entry of fn.inputs) {
      if (entry.name === 'x') continue;
      if (entry.name === '__internal__proxyMasterIndex') values[entry.name] = num(0n);
      else throw new Error(`unexpected input ${entry.name}`);
    }
    const dispatch = fn.selector !== undefined;
    const proxyDataRedeem = scriptToBytecode(buildDataNftCovenantScript(proxyCategory, proxyLock));
    const proxyDataLock = p2sh32(proxyDataRedeem);
    const kept = hexToBin(buildPushdataCommitment(artifact.stateLayout!, { n: 0n }, 0));
    const spend = (x: bigint): true | string => {
      values.x = num(x);
      return verdict([
        { lockingBytecode: proxyLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array(), proxyCategory) },
        { lockingBytecode: proxyDataLock, valueSatoshis: VALUE, token: tokenOf('mutable', kept, proxyCategory) },
        { lockingBytecode: delegateLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
      ], {
        version: 2, locktime: 0,
        inputs: [
          input(0, encodeDataPush(proxyRedeem)),
          input(1, pushesOf([num(0n), num(0n), proxyDataRedeem])),
          input(delegateIndex, redeemUnlock(fn, redeem, values, dispatch)),
        ],
        outputs: [
          { lockingBytecode: proxyLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array(), proxyCategory) },
          { lockingBytecode: proxyDataLock, valueSatoshis: VALUE, token: tokenOf('mutable', kept, proxyCategory) },
          { lockingBytecode: delegateLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
        ],
      });
    };
    const honest = spend(0n);
    const overflow = spend(1n << 64n);
    expect(honest, 'ARITH-5 in range').toBe(true);
    expect(overflow, 'ARITH-5 truncated to64').not.toBe(true);
  });

  it('ARITH-5 an unchecked BoringMath add does not wrap, and an in-range sum verifies', () => {
    const bundle = compileStringSplit(
      'pragma solidity ^0.8.20;'
      + ' library BoringMath { function add(uint256 a, uint256 b) internal pure returns (uint256 c) {'
      + ' require((c = a + b) >= b); } }'
      + ' contract C { uint256 n; using BoringMath for uint256;'
      + ' function spend(uint256 x, uint256 y) external { unchecked { require(x.add(uint256(1)) == y); } }'
      + ' function touch() external { n = n + 1; require(n > 0); } }',
      { evmCompat: true, messageBus: false, forceSplit: true, suppressWarnings: true },
    );
    const facetInfo = bundle.manifest.facets.find((facet) => facet.functions.includes('spend'));
    if (!facetInfo) {
      throw new Error(`no spend facet; ${bundle.manifest.facets.map((facet) => facet.functions.join('+')).join(',')}`);
    }
    const artifact = bundle.facets[facetInfo.name];
    const fn = artifact.abi.find((entry) => entry.name === 'spend');
    if (!fn) throw new Error(`no spend; ${artifact.abi.map((entry) => entry.name).join(',')}`);
    const proxyCategory = Uint8Array.from({ length: 32 }, (_, i) => (0x11 + i * 3) & 0xff);
    const brand = Uint8Array.from(proxyCategory).reverse();
    const redeem = new Uint8Array([
      ...encodeDataPush(brand),
      ...scriptToBytecode(asmToScript(artifact.bytecode)),
    ]);
    if (redeem.length > 10_000) throw new Error(`facet redeem is ${redeem.length} bytes`);
    const delegateLock = p2sh32(redeem);
    const proxyRedeem = Uint8Array.of(0x51);
    const proxyLock = p2sh32(proxyRedeem);
    if (fn.blockLayout?.blockSize !== 2) {
      throw new Error(`layout ${JSON.stringify(fn.blockLayout ?? null)}`);
    }
    const values: Record<string, Uint8Array> = {};
    const spend = (x: bigint, y: bigint): true | string => {
      const args: Record<string, bigint> = { x, y };
      for (const entry of fn.inputs) {
        if (entry.name === 'x' || entry.name === 'y') values[entry.name] = num(args[entry.name]);
        else if (entry.name === '__internal__proxyMasterIndex') values[entry.name] = num(0n);
        else throw new Error(`unexpected input ${entry.name}`);
      }
      const proxyDataRedeem = scriptToBytecode(buildDataNftCovenantScript(proxyCategory, proxyLock));
      const proxyDataLock = p2sh32(proxyDataRedeem);
      const kept = hexToBin(buildPushdataCommitment(artifact.stateLayout!, { n: 0n }, 0));
      return verdict([
        { lockingBytecode: proxyLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array(), proxyCategory) },
        { lockingBytecode: proxyDataLock, valueSatoshis: VALUE, token: tokenOf('mutable', kept, proxyCategory) },
        { lockingBytecode: delegateLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
      ], {
        version: 2, locktime: 0,
        inputs: [
          input(0, encodeDataPush(proxyRedeem)),
          input(1, pushesOf([num(0n), num(0n), proxyDataRedeem])),
          input(2, redeemUnlock(fn, redeem, values, fn.selector !== undefined)),
        ],
        outputs: [
          { lockingBytecode: proxyLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array(), proxyCategory) },
          { lockingBytecode: proxyDataLock, valueSatoshis: VALUE, token: tokenOf('mutable', kept, proxyCategory) },
          { lockingBytecode: delegateLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
        ],
      });
    };
    const honest = spend(1n, 2n);
    const wrapped = spend((1n << 256n) - 1n, 0n);
    expect(honest, 'ARITH-5 unchecked add in range').toBe(true);
    expect(wrapped, 'ARITH-5 unchecked add wrapped').not.toBe(true);
  });

  it('FW-3 a reached emit of false is still an event, and an empty commitment is not', () => {
    const artifact = compileString(
      `${P} contract C { int n; event Flag(bool ok);`
      + ' function poke(bool go) { if (go) emit Flag(false); this.n = this.n + 1; require(true); } }',
      { messageBus: false, forceStateful: true },
    );
    const fn = artifact.abi.find((entry) => entry.name === 'poke');
    if (!fn) throw new Error(`no poke; ${artifact.abi.map((entry) => entry.name).join(',')}`);
    const data = fn.blockLayout?.slots.find((entry) => entry.kind === 'dataNft');
    const event = fn.blockLayout?.slots.find((entry) => entry.kind === 'event');
    if (!data || !event) throw new Error(`layout ${JSON.stringify(fn.blockLayout ?? null)}`);
    const signature = artifact.events?.find((entry) => entry.name === 'Flag')?.signature;
    if (!signature) throw new Error(`no Flag; ${JSON.stringify(artifact.events ?? null)}`);
    const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
    const lock = p2sh32(redeem);
    const dataRedeem = scriptToBytecode(buildDataNftCovenantScript(CATEGORY, lock));
    const dataLock = p2sh32(dataRedeem);
    const eventRedeem = scriptToBytecode(buildEventNftCovenantScript(CATEGORY, computeEventNameHash(signature)));
    const eventLock = p2sh32(eventRedeem);
    const before = hexToBin(buildPushdataCommitment(artifact.stateLayout!, { n: 0n }, data.nftIndex ?? 0));
    const after = hexToBin(buildPushdataCommitment(artifact.stateLayout!, { n: 1n }, data.nftIndex ?? 0));
    const dust = 1_000n;
    const payload = Uint8Array.of(0x00);
    const spend = (go: boolean, extra: VmOutput | undefined): true | string => {
      const values: Record<string, Uint8Array> = { go: num(go ? 1n : 0n) };
      for (const entry of fn.inputs) {
        if (entry.name === 'go') continue;
        if (entry.name.startsWith('__internal__')) values[entry.name] = new Uint8Array();
        else throw new Error(`unexpected input ${entry.name}`);
      }
      const sources: SourceOutputs = [
        { lockingBytecode: lock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
        { lockingBytecode: dataLock, valueSatoshis: VALUE, token: tokenOf('mutable', before) },
      ];
      const outputs: VmOutput[] = [
        { lockingBytecode: lock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
        { lockingBytecode: dataLock, valueSatoshis: VALUE, token: tokenOf('mutable', after) },
      ];
      const inputs = [
        input(0, redeemUnlock(fn, redeem, values, false)),
        input(1, pushesOf([num(0n), num(1n), dataRedeem])),
      ];
      if (extra) {
        inputs.push(input(2, new Uint8Array()));
        sources.push({ lockingBytecode: Uint8Array.of(0x51), valueSatoshis: dust });
        outputs.push(extra);
      }
      if (event.offset !== outputs.length - (extra ? 1 : 0)) {
        throw new Error(`event offset ${event.offset} outputs ${outputs.length}`);
      }
      return verdict(sources, { version: 2, locktime: 0, inputs, outputs });
    };
    expect(spend(false, undefined), 'FW-3 not taken').toBe(true);
    expect(spend(true, {
      lockingBytecode: Uint8Array.of(0x51), valueSatoshis: dust, token: tokenOf('none', new Uint8Array()),
    }), 'FW-3 empty commitment').not.toBe(true);
    expect(spend(true, {
      lockingBytecode: eventLock, valueSatoshis: dust, token: tokenOf('none', payload),
    }), 'FW-3 false payload').toBe(true);
  });

  it('SEM-3 a break inside unchecked stops the loop, and the full trip does not', () => {
    const artifact = compileString(
      `${P} contract W() { function spend(int mode) { int s = 0; int i = 0;`
      + ' while (i < 3) { unchecked { if (i == 1) break; } s = s + 1; i = i + 1; } require(s == mode); } }',
      { messageBus: false },
    );
    const fn = artifact.abi.find((entry) => entry.name === 'spend');
    if (!fn) throw new Error('no spend');
    const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
    const lock = p2sh32(redeem);
    const spend = (mode: bigint): true | string => vm.verify({
      sourceOutputs: [{ lockingBytecode: lock, valueSatoshis: VALUE }],
      transaction: {
        version: 2, locktime: 0,
        inputs: [input(0, redeemUnlock(fn, redeem, { mode: num(mode) }, false))],
        outputs: [{ lockingBytecode: lock, valueSatoshis: VALUE }],
      },
    });
    expect(spend(3n), 'SEM-3 ignored break').not.toBe(true);
    expect(spend(1n), 'SEM-3 break authorized').toBe(true);
  });

  it('SEM-3 a continue inside unchecked skips the rest of the body, and running it does not', () => {
    const artifact = compileString(
      `${P} contract W() { function spend(int mode) { int s = 0; int i = 0;`
      + ' while (i < 3) { i = i + 1; unchecked { if (i == 2) continue; } s = s + 1; } require(s == mode); } }',
      { messageBus: false },
    );
    const fn = artifact.abi.find((entry) => entry.name === 'spend');
    if (!fn) throw new Error('no continue spend');
    const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
    const lock = p2sh32(redeem);
    const spend = (mode: bigint): true | string => vm.verify({
      sourceOutputs: [{ lockingBytecode: lock, valueSatoshis: VALUE }],
      transaction: {
        version: 2, locktime: 0,
        inputs: [input(0, redeemUnlock(fn, redeem, { mode: num(mode) }, false))],
        outputs: [{ lockingBytecode: lock, valueSatoshis: VALUE }],
      },
    });
    expect(spend(3n), 'SEM-3 ignored continue').not.toBe(true);
    expect(spend(2n), 'SEM-3 continue authorized').toBe(true);
  });

  it('SEM-2 a created contract with an undefined modifier is rejected', () => {
    const src = `${P} contract B { function sweep() external onlyOwnr { require(true); } }`
      + ' contract A { function make() { B child = new B(); require(child != address(0)); } }';
    expect(() => compileString(src, { messageBus: false }), 'SEM-2 undefined modifier').toThrow(/onlyOwnr/);
  });

  // The shared block oracle covenant holds height 100 and timestamp T0, owned by alice. Each call signs a spend
  // that replaces the commitment.
  const ORACLE_T0 = 1_700_000_000n;
  const oracleUpdate = (number: bigint, timestamp: bigint, locktime: number): true | string => {
    const record = (height: bigint, time: bigint): Uint8Array => encodeBlockOracleCommitment(hash160(alicePub), {
      number: height, timestamp: time, difficulty: 0n, size: 1n, totalFees: 0n, coinbase: Uint8Array.of(0x51),
    });
    const redeem = blockOracleRedeemScript(CATEGORY);
    const lock = p2sh32(redeem);
    const next = record(number, timestamp);
    const sources: SourceOutputs = [
      { lockingBytecode: lock, valueSatoshis: VALUE, token: tokenOf('mutable', record(100n, ORACLE_T0)) },
    ];
    const inputs: VmTransaction['inputs'] = [input(0, new Uint8Array(), 0xfffffffe)];
    const outputs: VmOutput[] = [{ lockingBytecode: lock, valueSatoshis: VALUE, token: tokenOf('mutable', next) }];
    const transaction: VmTransaction = { version: 2, locktime, inputs, outputs };
    const signature = new SignatureTemplate(alicePriv).generateSignature(hash256(createSighashPreimage(
      transaction, sources, 0, redeem, SighashType.SIGHASH_ALL | SighashType.SIGHASH_UTXOS,
    )));
    inputs[0] = input(0, blockOracleUpdateUnlocking(CATEGORY, alicePub, signature, next), 0xfffffffe);
    return verdict(sources, transaction);
  };

  it('CRYPTO-5 an owner can advance the height and the timestamp', () => {
    // A height-type nLockTime anchors the number and keeps the timestamp; a time-type one the reverse.
    expect(oracleUpdate(150n, ORACLE_T0, 150), 'CRYPTO-5 honest height').toBe(true);
    expect(oracleUpdate(100n, ORACLE_T0 + 1n, Number(ORACLE_T0 + 1n)), 'CRYPTO-5 honest timestamp').toBe(true);
  });

  it('CRYPTO-5 a time-type block.number is rejected', () => {
    expect(oracleUpdate(1_700_000_000n, ORACLE_T0, 1_700_000_000), 'CRYPTO-5 time-type height').not.toBe(true);
  });

  it('CRYPTO-5 a block.number below the stored height is rejected', () => {
    expect(oracleUpdate(50n, ORACLE_T0, 50), 'CRYPTO-5 rewound height').not.toBe(true);
  });

  it('CRYPTO-5 a block.timestamp below the stored time is rejected', () => {
    expect(oracleUpdate(100n, ORACLE_T0 - 1n, Number(ORACLE_T0 - 1n)), 'CRYPTO-5 rewound timestamp').not.toBe(true);
  });
});
