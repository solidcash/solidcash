/**
 * Block-info reads from the oracle pool a contract is bound to (oracle pools, phase 3).
 *
 * A direct contract that reads `block.*` or `blockhash`, or creates a contract that takes the binding, takes the
 * hidden bytes32 parameter `__oraclePool`. A read checks the co-spent input's category against it, with the mutable
 * capability, and the commitment's flags byte against 0x00; it checks no lock. Each VM case runs the whole
 * transaction on the BCH 2026 VM, and every refused one is valid but for the reader.
 */
import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2sh32, hash256, hexToBin,
} from '@bitauth/libauth';
import {
  applyOraclePool, asmToBytecode, asmToScript, encodeIntegerValue, encodePoolInfoCommitment, encodePoolSlotCommitment,
  findOraclePoolSlots, oraclePoolBinding, ORACLE_POOL_PARAMETER, POOL_COIN_SATS,
  POOL_FLAG_NUMBER_STOPPED, POOL_FLAG_SLOT, poolInfoLockingBytecode, poolInfoReadUnlocking, poolSlotLockingBytecode,
  poolSlotReadUnlocking, scriptToBytecode, type AbiFunction, type Artifact, type PoolInfoFields,
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

const P = 'pragma solidcash ^0.52.0;';
const READER = `${P} contract R { function read(int t, int n) { require(block.timestamp == t); `
  + 'require(block.number == n); } }';
// A field makes it stateful, so its two reads share one pool check helper.
const STATEFUL_READER = `${P} contract T { int seen; function read(int t, int n) { `
  + 'require(block.timestamp == t); require(block.number == n); } }';
const CHILD = 'contract Child { function read(int t) { require(block.timestamp == t); } }';
const MAKER = `${P} ${CHILD} contract Maker { function make() { require(tx.outputs[0].lockingBytecode == new Child()); } }`;
const STATEFUL_MAKER = `${P} contract Child() { int y; function ping(int t) { require(block.timestamp == t); } }`
  + ' contract Maker() { int x; function make() { Child c = new Child(); require(c.length > 0); } }';
const HASH_READER = `${P} contract H { function read(int n, bytes32 h) { require(blockhash(n) == h); }`
  + ' function poke(int x) { require(x > 0); } }';

const POOL = Uint8Array.from({ length: 32 }, (_, i) => (0x37 + i * 11) & 0xff);
const OTHER_POOL = Uint8Array.from({ length: 32 }, (_, i) => (0x91 + i * 7) & 0xff);
const MASTER_CATEGORY = Uint8Array.from({ length: 32 }, (_, i) => (0x15 + i * 13) & 0xff);
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
function redeemOf(artifact: Artifact, pool: Uint8Array = POOL): Uint8Array {
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
function unlock(artifact: Artifact, name: string, values: Record<string, Uint8Array>): Uint8Array {
  const fn = fnOf(artifact, name);
  const args = fn.inputs.map((entry) => {
    const value = values[entry.name] ?? (entry.name.startsWith('__internal__') ? EMPTY : undefined);
    if (value === undefined) throw new Error(`no value for ${name}.${entry.name}`);
    return value;
  }).reverse();
  if (fn.selector && dispatchesBySelector(artifact)) args.unshift(hexToBin(fn.selector));
  return new Uint8Array([...pushesOf(args), ...encodeDataPush(redeemOf(artifact))]);
}

function mutable(lockingBytecode: Uint8Array, category: Uint8Array, commitment: Uint8Array): VmOutput {
  return {
    lockingBytecode, valueSatoshis: POOL_COIN_SATS,
    token: { category, amount: 0n, nft: { capability: 'mutable', commitment } },
  };
}

function infoCoin(category = POOL, flags = 0): Coin {
  return {
    utxo: mutable(poolInfoLockingBytecode(category), category, encodePoolInfoCommitment({ ...infoFields, flags })),
    unlocking: poolInfoReadUnlocking(category),
  };
}

function slotCoin(): Coin {
  const commitment = encodePoolSlotCommitment({
    flags: POOL_FLAG_SLOT, n: HEIGHT, hash: new Uint8Array(32).fill(0xa1), owner: OWNER, depth: 4,
  });
  return { utxo: mutable(poolSlotLockingBytecode(POOL), POOL, commitment), unlocking: poolSlotReadUnlocking(POOL) };
}

function master(artifact: Artifact, lockingBytecode = p2sh32(redeemOf(artifact))): VmOutput {
  return {
    lockingBytecode, valueSatoshis: 20_000n,
    token: { category: MASTER_CATEGORY, amount: 0n, nft: { capability: 'minting', commitment: EMPTY } },
  };
}

/**
 * The reader at input 0 and the pool coin at input 1, which its read path recreates at output 1. A stateful reader
 * is its master, recreated at output 0, and a funder at input 2 pays.
 */
function readSpend(artifact: Artifact, coin: Coin, time = TIME): Spend {
  const unlocking = unlock(artifact, 'read', {
    t: num(time), n: num(HEIGHT), __internal__blockOracleInputIndex: num(1n), __internal__returnOutputIdx: num(-1n),
  });
  if (artifact.stateLayout !== undefined) {
    return {
      sourceOutputs: [master(artifact), coin.utxo, { lockingBytecode: FUNDER_LOCK, valueSatoshis: 100_000n }],
      transaction: {
        version: 2, locktime: 0,
        inputs: [input(0, unlocking), input(1, coin.unlocking), input(2, EMPTY)],
        outputs: [master(artifact), coin.utxo, { lockingBytecode: FUNDER_LOCK, valueSatoshis: 90_000n }],
      },
    };
  }
  return {
    sourceOutputs: [{ lockingBytecode: p2sh32(redeemOf(artifact)), valueSatoshis: 10_000n }, coin.utxo],
    transaction: {
      version: 2, locktime: 0,
      inputs: [input(0, unlocking), input(1, coin.unlocking)],
      outputs: [{ lockingBytecode: FUNDER_LOCK, valueSatoshis: 9_000n }, coin.utxo],
    },
  };
}

describe('a block.* reader bound to an oracle pool', () => {
  const artifact = compileString(READER, { messageBus: false });

  it('takes the __oraclePool input, and no pool slots, update entry or block register', () => {
    expect(artifact.usesBlockOracle).toBe(true);
    expect(artifact.constructorInputs).toEqual([{ name: ORACLE_POOL_PARAMETER, type: 'bytes32' }]);
    expect(artifact.oraclePoolSlots).toBeUndefined();
    expect(artifact.abi.map((fn) => fn.name)).not.toContain('__updateBlockOracle');
    expect(artifact.stateLayout?.variables.map((variable) => variable.name) ?? []).not.toContain('__block_timestamp');
  });

  it('accepts a read of a block-info coin of its pool', () => {
    expect(vm.verify(readSpend(artifact, infoCoin()))).toBe(true);
    expect(vm.verify(readSpend(artifact, infoCoin(), TIME + 1n)), 'a field it does not hold').not.toBe(true);
  });

  it('accepts the same reads in a stateful reader, whose entry checks the coin through its shared helper', () => {
    const stateful = compileString(STATEFUL_READER, { messageBus: false });
    expect(stateful.stateLayout).toBeDefined();
    expect(stateful.constructorInputs).toEqual([{ name: ORACLE_POOL_PARAMETER, type: 'bytes32' }]);
    expect(vm.verify(readSpend(stateful, infoCoin()))).toBe(true);
    expect(vm.verify(readSpend(stateful, infoCoin(OTHER_POOL))), 'another category').not.toBe(true);
    expect(vm.verify(readSpend(stateful, slotCoin())), 'a ring slot').not.toBe(true);
  });

  it('refuses a coin of another category', () => {
    expect(vm.verify(readSpend(artifact, infoCoin(OTHER_POOL)))).not.toBe(true);
  });

  it('refuses a ring slot of its pool', () => {
    expect(vm.verify(readSpend(artifact, slotCoin()))).not.toBe(true);
  });

  it('refuses a stopped block-info coin', () => {
    expect(vm.verify(readSpend(artifact, infoCoin(POOL, POOL_FLAG_NUMBER_STOPPED)))).not.toBe(true);
  });
});

describe('a framed block.* reader', () => {
  it('carries P in pool slots instead of a constructor input', () => {
    const source = `${P} contract Clock { uint32 public stamp;`
      + ' function open() { this.stamp = uint32(block.timestamp); require(true); } }';
    const artifact = compileString(source, { composition: 'framed', suppressWarnings: true });
    const program = asmToBytecode(artifact.bytecode);
    expect(artifact.constructorInputs.map((entry) => entry.name)).not.toContain(ORACLE_POOL_PARAMETER);
    expect(artifact.oraclePoolSlots?.length).toBeGreaterThan(0);
    expect(artifact.oraclePoolSlots).toEqual(findOraclePoolSlots(program));
    const filled = applyOraclePool(program, POOL, artifact.oraclePoolSlots!);
    expect(findOraclePoolSlots(filled)).toEqual([]);
    expect(filled.length).toBe(program.length);
  });
});

describe('a creator of a bound contract', () => {
  it('passes its own binding as the child\'s __oraclePool', () => {
    const maker = compileString(MAKER, { messageBus: false, primaryContractName: 'Maker' });
    const child = compileString(MAKER, { messageBus: false, primaryContractName: 'Child' });
    expect(child.constructorInputs).toEqual([{ name: ORACLE_POOL_PARAMETER, type: 'bytes32' }]);
    expect(maker.constructorInputs).toEqual([{ name: ORACLE_POOL_PARAMETER, type: 'bytes32' }]);
    const spend = (childPool: Uint8Array): Spend => ({
      sourceOutputs: [{ lockingBytecode: p2sh32(redeemOf(maker)), valueSatoshis: 10_000n }],
      transaction: {
        version: 2, locktime: 0,
        inputs: [input(0, unlock(maker, 'make', { __internal__returnOutputIdx: num(-1n) }))],
        outputs: [{ lockingBytecode: p2sh32(redeemOf(child, childPool)), valueSatoshis: 9_000n }],
      },
    });
    expect(vm.verify(spend(POOL))).toBe(true);
    expect(vm.verify(spend(OTHER_POOL)), 'a child bound to another pool').not.toBe(true);
  });

  it('publishes the binding as the deployed child\'s forwarded argument', () => {
    const options = { messageBus: false as const, forceStateful: true, allowUnsafeOperations: true };
    // The binding-forwarding shape predates B10; the legacy fold path is the one that carries a block-reading
    // child (a deployer refuses `child-reads-block-data`).
    const maker = compileString(STATEFUL_MAKER, {
      ...options, primaryContractName: 'Maker', __legacyDeployFold: true,
    } as never);
    const child = compileString(STATEFUL_MAKER, { ...options, primaryContractName: 'Child' });
    expect(child.constructorInputs.map((entry) => entry.name)).toEqual([ORACLE_POOL_PARAMETER]);
    expect(maker.constructorInputs.map((entry) => entry.name)).toEqual([ORACLE_POOL_PARAMETER]);
    expect(fnOf(maker, 'make').deployTargets?.[0]?.constructorArgs).toEqual([ORACLE_POOL_PARAMETER]);
  });
});

describe('ORACLE-1: a blockhash-only contract with two functions', () => {
  const artifact = compileString(HASH_READER, { messageBus: false });
  const pokeSpend = (output: VmOutput): Spend => ({
    sourceOutputs: [master(artifact), { lockingBytecode: FUNDER_LOCK, valueSatoshis: 100_000n }],
    transaction: {
      version: 2, locktime: 0,
      inputs: [
        input(0, unlock(artifact, 'poke', { x: num(1n), __internal__returnOutputIdx: num(-1n) })), input(1, EMPTY),
      ],
      outputs: [output, { lockingBytecode: FUNDER_LOCK, valueSatoshis: 90_000n }],
    },
  });

  it('takes the binding', () => {
    expect(artifact.constructorInputs.map((entry) => entry.name)).toEqual([ORACLE_POOL_PARAMETER]);
  });

  it('keeps its master covenant in a body that reads nothing', () => {
    expect(vm.verify(pokeSpend(master(artifact)))).toBe(true);
    expect(vm.verify(pokeSpend(master(artifact, FUNDER_LOCK))), 'the minting NFT moved to another lock')
      .not.toBe(true);
  });
});
