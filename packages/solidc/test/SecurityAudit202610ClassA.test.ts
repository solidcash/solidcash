/**
 * Hostile VM tests for the October 2026 class-A holes that stayed open after the fifteen critical fixes.
 * Each case compiles through this worktree and is evaluated on the BCH 2026 VM.
 */
import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2sh32, hash256, hexToBin,
} from '@bitauth/libauth';
import {
  asmToScript, blockhashOracleLockingBytecode, buildBlockhashCommitment, buildBlockhashOracleCovenantScript,
  buildEntryNftCovenantScript, computeCollectionHash, encodeIntegerValue, scriptToBytecode,
  type AbiFunction,
} from '@solidcash/utils';
import { encodeEntryCommitment, keyToSlotMulti } from '../../solidcash/src/stateful/SortedList.js';
import { compileString } from '../src/index.js';

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

function tokenOf(capability: 'minting' | 'mutable' | 'none', commitment: Uint8Array): VmOutput['token'] {
  return { category: CATEGORY, amount: 0n, nft: { capability, commitment } };
}

function input(index: number, unlockingBytecode: Uint8Array, sequenceNumber = 0xffffffff): VmTransaction['inputs'][number] {
  const hash = new Uint8Array(32);
  hash[0] = index + 1;
  return { outpointIndex: 0, outpointTransactionHash: hash, sequenceNumber, unlockingBytecode };
}

function pushesOf(values: readonly Uint8Array[]): Uint8Array {
  return new Uint8Array(values.flatMap((value) => [...encodeDataPush(value)]));
}

function redeemUnlock(
  fn: AbiFunction, redeem: Uint8Array, values: Record<string, Uint8Array>, dispatch: boolean,
): Uint8Array {
  const args = fn.inputs.map((entry) => {
    const value = values[entry.name];
    if (value === undefined) {
      throw new Error(`no value for ${fn.name}.${entry.name}; inputs=${fn.inputs.map((item) => item.name).join(',')}`);
    }
    return value;
  }).reverse();
  if (dispatch && fn.selector) args.unshift(hexToBin(fn.selector));
  return new Uint8Array([...pushesOf(args), ...encodeDataPush(redeem)]);
}

function verdict(sourceOutputs: SourceOutputs, transaction: VmTransaction): true | string {
  return vm.verify({ sourceOutputs, transaction });
}

describe('October 2026 class A holes', () => {
  it('DX-5 a low-level call cannot be satisfied by a coin at another lock, and the named lock can', () => {
    const artifact = compileString(
      `${P} contract C { function f(bytes target, bytes payload) {`
      + ' address(target).call(payload); require(true); } }',
      { messageBus: false },
    );
    const fn = artifact.abi.find((entry) => entry.name === 'f');
    if (!fn) throw new Error(`no f; ${artifact.abi.map((entry) => entry.name).join(',')}`);
    const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
    const contractLock = p2sh32(redeem);
    const payload = Uint8Array.of(0x01, 0x02);
    // The callee lock is executed, so it has to drop the payload push and leave true. The attack uses another
    // script that does the same, which the old check accepted because it never read the lock.
    const targetLock = Uint8Array.of(0x75, 0x51);
    const values: Record<string, Uint8Array> = {};
    for (const entry of fn.inputs) {
      if (entry.name === 'payload') values[entry.name] = payload;
      else if (entry.name === 'target') values[entry.name] = targetLock;
      else if (entry.name.toLowerCase().includes('callinput')) values[entry.name] = num(1n);
      else values[entry.name] = new Uint8Array();
    }
    const dispatch = artifact.messageBus?.routeInBytecode === true;
    const calleeUnlock = pushesOf([payload]);
    const spend = (calleeLock: Uint8Array): true | string => {
      const transaction: VmTransaction = {
        version: 2, locktime: 0,
        inputs: [
          input(0, redeemUnlock(fn, redeem, values, dispatch)),
          input(1, calleeUnlock),
        ],
        outputs: [
          { lockingBytecode: contractLock, valueSatoshis: VALUE },
          { lockingBytecode: calleeLock, valueSatoshis: VALUE },
        ],
      };
      const sourceOutputs: SourceOutputs = [
        { lockingBytecode: contractLock, valueSatoshis: VALUE + 10_000n },
        { lockingBytecode: calleeLock, valueSatoshis: VALUE },
      ];
      return verdict(sourceOutputs, transaction);
    };
    expect(spend(targetLock), 'DX-5 authorized').toBe(true);
    expect(spend(Uint8Array.of(0x75, 0x51, 0x51, 0x75)), 'DX-5 other-lock call').not.toBe(true);
  });

  it('CRYPTO-3 a blockhash oracle at another lock cannot choose the hash, and the real lock can', () => {
    const artifact = compileString(
      `${P} contract C { function f(int n, bytes32 expect) { require(blockhash(n) == expect); } }`,
    );
    const fn = artifact.abi.find((entry) => entry.name === 'f');
    if (!fn) throw new Error(`no f; ${artifact.abi.map((entry) => entry.name).join(',')}`);
    const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
    const contractLock = p2sh32(redeem);
    const n = 1n;
    const hash = Uint8Array.from({ length: 32 }, (_, index) => index + 3);
    const forged = Uint8Array.from({ length: 32 }, () => 0x44);
    const oracleRedeem = scriptToBytecode(buildBlockhashOracleCovenantScript(CATEGORY));
    const oracleLock = blockhashOracleLockingBytecode(CATEGORY);
    const oracleUnlock = pushesOf([num(0n), oracleRedeem]);
    const commitment = buildBlockhashCommitment(n, hash);
    const values: Record<string, Uint8Array> = {};
    for (const entry of fn.inputs) {
      if (entry.name === 'n') values[entry.name] = num(n);
      else if (entry.name === 'expect') values[entry.name] = hash;
      else if (entry.name.toLowerCase().includes('blockhash')) values[entry.name] = num(1n);
      else values[entry.name] = new Uint8Array();
    }
    const masterUnlock = redeemUnlock(fn, redeem, values, artifact.messageBus?.routeInBytecode === true);
    const spend = (sideLock: Uint8Array, sideHash: Uint8Array): true | string => {
      const sideCommitment = buildBlockhashCommitment(n, sideHash);
      const transaction: VmTransaction = {
        version: 2, locktime: 2,
        inputs: [
          input(0, masterUnlock, 0xfffffffe),
          input(1, oracleUnlock, 0xfffffffe),
        ],
        outputs: [
          { lockingBytecode: contractLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
          { lockingBytecode: sideLock, valueSatoshis: VALUE, token: tokenOf('none', sideCommitment) },
        ],
      };
      const sourceOutputs: SourceOutputs = [
        { lockingBytecode: contractLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
        { lockingBytecode: sideLock, valueSatoshis: VALUE, token: tokenOf('none', commitment) },
      ];
      return verdict(sourceOutputs, transaction);
    };
    expect(spend(oracleLock, hash), 'CRYPTO-3 authorized').toBe(true);
    expect(spend(Uint8Array.of(0x6d, 0x51), forged), 'CRYPTO-3 bare-lock oracle').not.toBe(true);
  });

  it('DS-7 a stray coin at a skipped read slot cannot make room to rewrite another node, and the write can', () => {
    const artifact = compileString(
      `${P} contract C { mapping(int => int) m;`
      + ' function writeRead(int k, int v, int r, int sel) { this.m[k] = v;'
      + ' if (sel > 0) { require(this.m[r] > 0); } require(true); } }',
      // The message-bus redeem for this body is past the 10_000-byte standard limit, so the spend is the
      // direct function, which is the census the read-slot count lives in.
      { messageBus: false, forceStateful: true },
    );
    const fn = artifact.abi.find((entry) => entry.name === 'writeRead');
    if (!fn) throw new Error(`no writeRead; ${artifact.abi.map((entry) => entry.name).join(',')}`);
    const read = fn.blockLayout?.slots.find((slot) => slot.kind === 'entry' && slot.slotIndex === 1);
    if (!read) throw new Error(`no read slot; ${JSON.stringify(fn.blockLayout ?? null)}`);
    const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
    const contractLock = p2sh32(redeem);
    const collection = artifact.stateLayout!.collections!.find((entry) => entry.name === 'm')!;
    const entryRedeem = scriptToBytecode(buildEntryNftCovenantScript(
      CATEGORY, computeCollectionHash(collection.signature), contractLock,
    ));
    const entryLock = p2sh32(entryRedeem);
    const key = num(7n);
    const slot = keyToSlotMulti([key]);
    const victimSlot = keyToSlotMulti([num(9n)]);
    const zero = new Uint8Array(32);
    const values: Record<string, Uint8Array> = {};
    for (const entry of fn.inputs) {
      if (entry.name === 'k') values[entry.name] = key;
      else if (entry.name === 'v') values[entry.name] = num(55n);
      else if (entry.name === 'r') values[entry.name] = num(11n);
      else if (entry.name === 'sel') values[entry.name] = num(0n);
      else if (/^__internal__vmapBatchSlot_\d+$/.test(entry.name)) values[entry.name] = slot;
      else if (entry.name.includes('vmapBatchProof')) values[entry.name] = num(1n);
      else if (entry.name.includes('vmapBatchNext')) values[entry.name] = zero;
      else if (entry.name.includes('vmapBatchPredOut')) values[entry.name] = num(-1n);
      else if (entry.name.includes('TrailingCount')) values[entry.name] = num(0n);
      else if (entry.name.startsWith('__internal__')) values[entry.name] = new Uint8Array();
      else throw new Error(`unexpected input ${entry.name}`);
    }
    const dispatch = artifact.messageBus?.routeInBytecode === true;
    const master = input(0, redeemUnlock(fn, redeem, values, dispatch));
    const entryUnlock = pushesOf([num(0n), num(1n), entryRedeem]);
    const before = encodeEntryCommitment(slot, zero, num(1n));
    const after = encodeEntryCommitment(slot, zero, num(55n));
    const bare = Uint8Array.of(0x51);
    const readAt = read.offset;
    const honestInputs = [
      master,
      input(1, entryUnlock),
      input(2, new Uint8Array()),
    ];
    const honestOutputs: VmOutput[] = [
      { lockingBytecode: contractLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
      { lockingBytecode: entryLock, valueSatoshis: VALUE, token: tokenOf('mutable', after) },
      { lockingBytecode: bare, valueSatoshis: VALUE },
    ];
    const honestSources: SourceOutputs = [
      { lockingBytecode: contractLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
      { lockingBytecode: entryLock, valueSatoshis: VALUE, token: tokenOf('mutable', before) },
      { lockingBytecode: bare, valueSatoshis: VALUE },
    ];
    if (readAt !== 2) throw new Error(`read slot offset ${readAt}, expected the third input`);
    const honest: VmTransaction = { version: 2, locktime: 0, inputs: honestInputs, outputs: honestOutputs };
    expect(verdict(honestSources, honest), 'DS-7 authorized').toBe(true);

    const strayCommitment = encodeEntryCommitment(keyToSlotMulti([num(11n)]), zero, num(70n));
    const victimBefore = encodeEntryCommitment(victimSlot, zero, num(60n));
    const victimAfter = encodeEntryCommitment(victimSlot, zero, num(61n));
    const attackInputs = honestInputs.map((entry, index) => index === readAt
      ? input(index, new Uint8Array())
      : entry);
    attackInputs.push(input(3, entryUnlock));
    const attackOutputs = honestOutputs.map((output, index) => index === readAt
      ? { lockingBytecode: bare, valueSatoshis: VALUE, token: tokenOf('mutable', strayCommitment) }
      : output);
    attackOutputs.push({ lockingBytecode: entryLock, valueSatoshis: VALUE, token: tokenOf('mutable', victimAfter) });
    const attackSources = honestSources.map((output, index) => index === readAt
      ? { lockingBytecode: bare, valueSatoshis: VALUE, token: tokenOf('mutable', strayCommitment) }
      : output);
    attackSources.push({ lockingBytecode: entryLock, valueSatoshis: VALUE, token: tokenOf('mutable', victimBefore) });
    const attack: VmTransaction = { version: 2, locktime: 0, inputs: attackInputs, outputs: attackOutputs };
    expect(verdict(attackSources, attack), 'DS-7 stray read slot').not.toBe(true);
  });
});
