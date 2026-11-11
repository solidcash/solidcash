/**
 * Block-info reads in a body an indirect call may enter (oracle pools, phase 3).
 *
 * An indirect call pushes a body's declared arguments only, so a function-pointer target holds no pool binding and
 * no coin index its caller could hand it. It takes P from a helper the contract level defines from its own
 * `__oraclePool` parameter, and finds the first block-info coin of P itself. A direct read keeps the parameter. Each
 * VM case runs the whole transaction on the BCH 2026 VM, and every refused one is valid but for the reader.
 */
import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2sh32, hash256, hexToBin,
} from '@bitauth/libauth';
import {
  asmToScript, encodeIntegerValue, encodePoolInfoCommitment, oraclePoolBinding, ORACLE_POOL_PARAMETER,
  POOL_COIN_SATS, poolInfoLockingBytecode, poolInfoReadUnlocking, scriptToBytecode, type AbiFunction, type Artifact,
  type PoolInfoFields,
} from '@solidcash/utils';
import { compileString } from '../src/index.js';

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];
type SourceOutputs = NonNullable<VmProgram['sourceOutputs']>;

interface Spend {
  readonly sourceOutputs: SourceOutputs;
  readonly transaction: VmTransaction;
}

interface Coin {
  readonly utxo: VmOutput;
  readonly unlocking: Uint8Array;
}

const P = 'pragma solidcash ^0.50.0;';
// `p()` reaches the read only through a pointer, so its target is entered by an indirect call.
const INDIRECT = `${P} contract R {`
  + ' function stamp() internal view returns (uint32) { return block.timestamp; }'
  + ' function zero() internal view returns (uint32) { return 0; }'
  + ' function read(int t, bool b) { function() internal view returns (uint32) p = b ? stamp : zero;'
  + ' require(p() == t); } }';
const READER = `${P} contract R { function read(int t, int n) { require(block.timestamp == t); `
  + 'require(block.number == n); } }';
// The binding helper's definition: its body, the push of P, is built at run time from the parameter.
const BINDING_DEFINE = /OP_CAT \S+ OP_DEFINE/;

const POOL = Uint8Array.from({ length: 32 }, (_, i) => (0x37 + i * 11) & 0xff);
const OTHER_POOL = Uint8Array.from({ length: 32 }, (_, i) => (0x91 + i * 7) & 0xff);
const OWNER = new Uint8Array(20).fill(0x31);
const EMPTY = new Uint8Array(0);
const FUNDER_LOCK = Uint8Array.of(0x51);
const TIME = 1_700_000_000n;
const HEIGHT = 900n;
const vm = createVirtualMachineBch2026();

const num = (value: bigint): Uint8Array => encodeIntegerValue(value);
const p2sh32 = (redeem: Uint8Array): Uint8Array => encodeLockingBytecodeP2sh32(hash256(redeem));
const pushesOf = (values: readonly Uint8Array[]): Uint8Array =>
  new Uint8Array(values.flatMap((value) => [...encodeDataPush(value)]));

const infoFields: PoolInfoFields = {
  flags: 0, owner: OWNER, number: HEIGHT, timestamp: TIME, difficulty: 1n, size: 1_000n, totalFees: 100n,
  coinbase: FUNDER_LOCK,
};

function input(index: number, unlockingBytecode: Uint8Array): VmTransaction['inputs'][number] {
  return {
    outpointIndex: 0,
    outpointTransactionHash: Uint8Array.from({ length: 32 }, (_, i) => (0x70 + index + i * 29) & 0xff),
    sequenceNumber: 0xfffffffe,
    unlockingBytecode,
  };
}

function fnOf(artifact: Artifact, name: string): AbiFunction {
  const fn = artifact.abi.find((entry) => entry.name === name);
  if (!fn) throw new Error(`no function ${name}; have ${artifact.abi.map((entry) => entry.name).join(',')}`);
  return fn;
}

/** The constructor arguments, last pushed first, then the program, as the SDK composes a redeem. */
function redeemOf(artifact: Artifact, pool: Uint8Array): Uint8Array {
  const values = artifact.constructorInputs.map((entry) => {
    if (entry.name !== ORACLE_POOL_PARAMETER) throw new Error(`no value for constructor input ${entry.name}`);
    return oraclePoolBinding(pool);
  });
  return new Uint8Array([...pushesOf([...values].reverse()), ...scriptToBytecode(asmToScript(artifact.bytecode))]);
}

/** As the SDK: a sole function with no compiler route or multi-call entry in the redeem takes no selector. */
function dispatchesBySelector(artifact: Artifact): boolean {
  const route = artifact.messageBus !== undefined && artifact.messageBus.available !== false
    && artifact.messageBus.routeInBytecode !== false;
  return artifact.abi.length > 1 || route || typeof artifact.callBatch === 'object';
}

/** The selector at the bottom, then the ABI arguments with the first on top, then the redeem. */
function unlock(artifact: Artifact, redeem: Uint8Array, name: string, values: Record<string, Uint8Array>): Uint8Array {
  const fn = fnOf(artifact, name);
  const args = fn.inputs.map((entry) => {
    const value = values[entry.name] ?? (entry.name.startsWith('__internal__') ? EMPTY : undefined);
    if (value === undefined) throw new Error(`no value for ${name}.${entry.name}`);
    return value;
  }).reverse();
  if (fn.selector && dispatchesBySelector(artifact)) args.unshift(hexToBin(fn.selector));
  return new Uint8Array([...pushesOf(args), ...encodeDataPush(redeem)]);
}

function infoCoin(category: Uint8Array): Coin {
  return {
    utxo: {
      lockingBytecode: poolInfoLockingBytecode(category), valueSatoshis: POOL_COIN_SATS,
      token: { category, amount: 0n, nft: { capability: 'mutable', commitment: encodePoolInfoCommitment(infoFields) } },
    },
    unlocking: poolInfoReadUnlocking(category),
  };
}

/**
 * The stateless reader at input 0, bound to `bound`, and the pool coin at input 1, which its read path recreates at
 * output 1. `values` are the reader's arguments, which its caller chooses.
 */
function readSpend(artifact: Artifact, bound: Uint8Array, coin: Coin, values: Record<string, Uint8Array>): Spend {
  const redeem = redeemOf(artifact, bound);
  return {
    sourceOutputs: [{ lockingBytecode: p2sh32(redeem), valueSatoshis: 10_000n }, coin.utxo],
    transaction: {
      version: 2, locktime: 0,
      inputs: [
        input(0, unlock(artifact, redeem, 'read', { __internal__returnOutputIdx: num(-1n), ...values })),
        input(1, coin.unlocking),
      ],
      outputs: [{ lockingBytecode: FUNDER_LOCK, valueSatoshis: 9_000n }, coin.utxo],
    },
  };
}

describe('a block.* read in a function-pointer target', () => {
  const artifact = compileString(INDIRECT, { messageBus: false });
  const pointerRead = { t: num(TIME), b: num(1n) };

  it('compiles, and no input its caller fills carries a binding or a coin index', () => {
    expect(artifact.usesBlockOracle).toBe(true);
    expect(fnOf(artifact, 'read').indirectPoolReads).toEqual({ blockInfo: true });
    expect(artifact.constructorInputs).toEqual([{ name: ORACLE_POOL_PARAMETER, type: 'bytes32' }]);
    expect(fnOf(artifact, 'read').inputs.map((entry) => entry.name))
      .not.toContain('__internal__blockOracleInputIndex');
    expect(artifact.bytecode).toMatch(BINDING_DEFINE);
  });

  it('accepts a block-info coin of the bound pool through the indirect call', () => {
    expect(vm.verify(readSpend(artifact, POOL, infoCoin(POOL), pointerRead))).toBe(true);
    expect(vm.verify(readSpend(artifact, POOL, infoCoin(POOL), { ...pointerRead, t: num(TIME + 1n) })),
      'a field it does not hold').not.toBe(true);
  });

  it('refuses a coin of another category', () => {
    expect(vm.verify(readSpend(artifact, POOL, infoCoin(OTHER_POOL), pointerRead))).not.toBe(true);
  });

  it('reads the binding its own redeem carries, which no caller substitutes', () => {
    // The caller fills only `t` and `b`. The same program bound to another pool is another lock: it reads that pool
    // and refuses the first.
    expect(vm.verify(readSpend(artifact, OTHER_POOL, infoCoin(OTHER_POOL), pointerRead))).toBe(true);
    expect(vm.verify(readSpend(artifact, OTHER_POOL, infoCoin(POOL), pointerRead)), 'the first pool')
      .not.toBe(true);
  });
});

describe('an ordinary reader', () => {
  const artifact = compileString(READER, { messageBus: false });
  const directRead = { t: num(TIME), n: num(HEIGHT), __internal__blockOracleInputIndex: num(1n) };

  it('keeps its direct read: no binding helper and no coin search', () => {
    expect(artifact.constructorInputs).toEqual([{ name: ORACLE_POOL_PARAMETER, type: 'bytes32' }]);
    expect(fnOf(artifact, 'read').inputs.map((entry) => entry.name)).toContain('__internal__blockOracleInputIndex');
    expect(artifact.bytecode).not.toMatch(BINDING_DEFINE);
    expect(artifact.abi.every((fn) => fn.indirectPoolReads === undefined)).toBe(true);
    expect(artifact.bytecode).not.toContain('OP_BEGIN');
  });

  it('still reads the coin at the index its caller names', () => {
    expect(vm.verify(readSpend(artifact, POOL, infoCoin(POOL), directRead))).toBe(true);
    expect(vm.verify(readSpend(artifact, POOL, infoCoin(OTHER_POOL), directRead)), 'another category')
      .not.toBe(true);
  });
});
