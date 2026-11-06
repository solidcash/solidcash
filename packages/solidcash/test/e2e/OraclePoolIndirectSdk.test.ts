import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { ORACLE_POOL_PARAMETER, POOL_FLAG_SLOT, type Artifact } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { Contract, Signer, type TransactionBuilder } from '../../src/index.js';
import type { MockNetworkProvider } from '../../src/network/mock/index.js';
import { getContractFactory, StatefulContract, upgrades } from '../../src/stateful/index.js';
import {
  isPoolInfoInput, isPoolSlotInput, poolSlotCoin, readsPoolOnlyIndirectly, selectPoolSlot, type PoolBlockFields,
} from '../../src/oracle/pool/index.js';
import { randomUtxo } from '../../src/utils.js';
import { addProvenUtxo, createTestProvider, mintTestOraclePool, setupStatefulUtxos } from '../test-util.js';
import { alicePriv } from '../fixture/vars.js';

/**
 * A block.* or blockhash read reached only through a function pointer (oracle pools, phase 3). An indirect call hands
 * its target no coin index, so the target finds the first coin of the pool its contract binds that answers it, and
 * the entry publishes no index or slot, only `indirectPoolReads`. The SDK co-spends a coin of each kind for every
 * call of such an entry, at the root or in a nested or delegate callee, recreated at its own index, and the read
 * checks the coin's category and flags, not its lock. Every block.* reader is stateful on this branch, so each
 * reader here is deployed.
 */

const POINTER_READER = `
contract PointerClock() {
    function stamp() internal view returns (uint32) { return block.timestamp; }
    function zero() internal view returns (uint32) { return 0; }
    function check(int expected, bool live) {
        function() internal view returns (uint32) read = live ? stamp : zero;
        require(read() == expected);
    }
}`;

// Fields of a pool the test mints, unlike the chain's tip that the provider's pool publishes.
const POOL_TIP: PoolBlockFields = {
  number: 120_000n, timestamp: 1_690_000_000n, difficulty: 0n, size: 1_000n, totalFees: 0n,
  coinbase: hexToBin(`76a914${'11'.repeat(20)}88ac`),
};

// A stateful reader: the call that reads through the pointer advances its state.
const STATEFUL_POINTER_READER = `
contract PointerClockState() {
    int reads;
    function stamp() internal view returns (uint32) { return block.timestamp; }
    function zero() internal view returns (uint32) { return 0; }
    function check(int expected, bool live) {
        function() internal view returns (uint32) read = live ? stamp : zero;
        require(read() == expected);
        this.reads = this.reads + 1;
    }
}`;

// One entry reads directly and takes a slot; the other reads only through the pointer.
const MIXED_READER = `
contract MixedClock() {
    int reads;
    function stamp() internal view returns (uint32) { return block.timestamp; }
    function zero() internal view returns (uint32) { return 0; }
    function direct(int expected) {
        require(block.timestamp == expected);
        this.reads = this.reads + 1;
    }
    function pointer(int expected, bool live) {
        function() internal view returns (uint32) read = live ? stamp : zero;
        require(read() == expected);
        this.reads = this.reads + 1;
    }
}`;

// blockhash(n) through a pointer: the target walks to the first slot of its pool that answers n.
const POINTER_HASHES = `
contract PointerHashes() {
    int reads;
    function hashOf(int n) internal view returns (bytes32) { return blockhash(n); }
    function before(int n) internal view returns (bytes32) { return blockhash(n - 1); }
    function check(int n, bytes32 expected, bool live) {
        function(int) internal view returns (bytes32) read = live ? hashOf : before;
        require(read(n) == expected);
        this.reads = this.reads + 1;
    }
}`;

// The same reader as a proxy implementation: its public entry runs as the proxy's delegate.
const POINTER_HASHES_IMPL = `
pragma solidcash >=0.8.0;
contract PointerHashesImpl() {
    int reads;
    function hashOf(int n) internal view returns (bytes32) { return blockhash(n); }
    function before(int n) internal view returns (bytes32) { return blockhash(n - 1); }
    function check(int n, bytes32 expected, bool live) public {
        function(int) internal view returns (bytes32) read = live ? hashOf : before;
        require(read(n) == expected);
        this.reads = this.reads + 1;
    }
}`;

// A caller that reads no pool: its nested callee's pointer target walks to the slot.
const HASH_RELAY = `
pragma solidcash >=0.8.0;
interface IPointerHashes { function check(int n, bytes32 expected, bool live); }
contract HashRelay(address hashes) {
    int relays;
    function relay(int n, bytes32 expected, bool live) {
        IPointerHashes(hashes).check(n, expected, live);
        this.relays = this.relays + 1;
    }
}`;

const TXID = /^[0-9a-f]{64}$/;
const SCRIPT_FAILURE = /OP_VERIFY|EQUALVERIFY|non-truthy/;
const ZERO = new Uint8Array(32);

type Call = PromiseLike<{ txid: string }> & { build(): Promise<TransactionBuilder> };

async function funded(provider: MockNetworkProvider): Promise<Signer> {
  const signer = new Signer(alicePriv, provider);
  for (let coin = 0; coin < 6; coin += 1) {
    await provider.addUtxo(signer.getAddress(), randomUtxo({ vout: 0, satoshis: 1_000_000n }));
  }
  return signer;
}

/** The indices of the inputs `isCoin` picks, each of which the output at its own index recreates. */
function recreatedAtOwnIndex(
  builder: TransactionBuilder, isCoin: (input: TransactionBuilder['inputs'][number]) => boolean,
): number[] {
  const indices = builder.inputs.flatMap((input, index) => (isCoin(input) ? [index] : []));
  for (const index of indices) {
    const { token } = builder.inputs[index];
    expect(builder.outputs[index]?.token?.category).toBe(token!.category);
    expect(builder.outputs[index]?.token?.nft?.commitment).toBe(token!.nft!.commitment);
  }
  return indices;
}

/** The newest block a live slot of the pool holds. */
async function newestSlot(provider: MockNetworkProvider, category: string): Promise<bigint> {
  let newest = -1n;
  for (const utxo of await provider.getUtxosByTokenCategory(category)) {
    const fields = poolSlotCoin(utxo, category)?.fields;
    if (fields !== undefined && fields.flags === POOL_FLAG_SLOT && fields.n > newest) newest = fields.n;
  }
  return newest;
}

/** The hash the chain holds for block n. */
async function hashOf(provider: MockNetworkProvider, n: bigint): Promise<Uint8Array> {
  return hexToBin(await provider.getBlockHash(Number(n)));
}

/** A stateful contract set up at its genesis, bound to the provider's pool. */
async function deployStateful(
  provider: MockNetworkProvider, artifact: Artifact, args: string[], state: Record<string, bigint>,
): Promise<{ sc: StatefulContract; locking: string; pool: string | undefined }> {
  const base = new Contract(artifact, args, { provider });
  const { categoryId } = await setupStatefulUtxos(provider, base, artifact.stateLayout!, state, { saltContract: true });
  const inner = base.withCategory(hexToBin(categoryId));
  return { sc: StatefulContract.withCategory(inner, categoryId), locking: inner.lockingBytecode, pool: inner.oraclePool };
}

/** A key no other deployment used: a proxy's logical address follows its deployer and nonce. */
function freshPrivateKey(): Uint8Array {
  const key = new Uint8Array(32);
  crypto.getRandomValues(key);
  key[0] = (key[0] & 0x7f) | 0x01;
  return key;
}

const artifact = compileString(POINTER_READER);

describe('oracle pool reads reached only through a function pointer', () => {
  it('compiles an entry that takes the pool binding and no coin index', () => {
    expect(artifact.usesBlockOracle).toBe(true);
    expect(artifact.constructorInputs.map((input) => input.name)).toEqual([ORACLE_POOL_PARAMETER]);
    const check = artifact.abi.find((fn) => fn.name === 'check')!;
    expect(check.inputs.map((input) => input.name)).not.toContain('__internal__blockOracleInputIndex');
    expect(check.usesBlockOracle).toBeUndefined();
    expect(check.indirectPoolReads).toEqual({ blockInfo: true });
    expect(readsPoolOnlyIndirectly(artifact)).toBe(true);
  });

  it('a stateful call co-spends a coin past its block, and a mixed contract\'s pointer entry co-spends too', async () => {
    const provider = createTestProvider() as MockNetworkProvider;
    const signer = await funded(provider);
    const pool = await mintTestOraclePool(provider, POOL_TIP);

    const statefulArtifact = compileString(STATEFUL_POINTER_READER);
    const statefulCheck = statefulArtifact.abi.find((fn) => fn.name === 'check')!;
    expect(statefulCheck.blockLayout?.slots.some((slot) => slot.kind === 'blockInfoOracle')).toBe(false);
    expect(statefulCheck.indirectPoolReads).toEqual({ blockInfo: true });
    const stateful = await getContractFactory(statefulArtifact, signer).deploy({
      initialState: { reads: 0n }, oraclePool: pool,
    });
    const clock = stateful as unknown as { check(expected: bigint, live: boolean): Call };
    const built = await clock.check(POOL_TIP.timestamp, true).build();
    expect(recreatedAtOwnIndex(built, (input) => isPoolInfoInput(input, pool))).toHaveLength(1);
    expect((await clock.check(POOL_TIP.timestamp, true)).txid).toMatch(TXID);
    await expect(clock.check(POOL_TIP.timestamp + 1n, true)).rejects.toThrow(SCRIPT_FAILURE);
    expect((await (stateful as unknown as StatefulContract).getState()).reads).toBe(1n);

    const mixedArtifact = compileString(MIXED_READER);
    const direct = mixedArtifact.abi.find((fn) => fn.name === 'direct')!;
    const pointer = mixedArtifact.abi.find((fn) => fn.name === 'pointer')!;
    expect(direct.usesBlockOracle).toBe(true);
    expect(direct.indirectPoolReads).toBeUndefined();
    expect(pointer.usesBlockOracle).toBeUndefined();
    expect(pointer.indirectPoolReads).toEqual({ blockInfo: true });
    expect(readsPoolOnlyIndirectly(mixedArtifact)).toBe(false);
    const mixed = await getContractFactory(mixedArtifact, signer).deploy({ initialState: { reads: 0n }, oraclePool: pool });
    const reads = mixed as unknown as { direct(expected: bigint): Call; pointer(expected: bigint, live: boolean): Call };
    const viaPointer = await reads.pointer(POOL_TIP.timestamp, true).build();
    expect(recreatedAtOwnIndex(viaPointer, (input) => isPoolInfoInput(input, pool))).toHaveLength(1);
    expect((await reads.pointer(POOL_TIP.timestamp, true)).txid).toMatch(TXID);
    expect((await reads.direct(POOL_TIP.timestamp)).txid).toMatch(TXID);
    expect((await (mixed as unknown as StatefulContract).getState()).reads).toBe(2n);
  }, 300_000);

  it('a pointer target reads blockhash from a slot it finds, the zero for a block 256 older than its residue', async () => {
    const provider = createTestProvider() as MockNetworkProvider;
    const signer = await funded(provider);
    const hashesArtifact = compileString(POINTER_HASHES);
    const check = hashesArtifact.abi.find((fn) => fn.name === 'check')!;
    expect(check.blockhashReads).toBeUndefined();
    expect(check.inputs.map((input) => input.name)).not.toContain('__internal__blockhashInputIndex');
    expect(check.indirectPoolReads).toEqual({ blockhash: true });
    const sc = await getContractFactory(hashesArtifact, signer).deploy({ initialState: { reads: 0n } });
    const pool = provider.oraclePoolCategory!;
    expect((sc as unknown as StatefulContract).inner.oraclePool).toBe(pool);
    const reader = sc as unknown as { check(n: bigint, expected: Uint8Array, live: boolean): Call };

    // A slot that holds n answers its hash; the other target reads n - 1.
    const recent = (await newestSlot(provider, pool)) - 1n;
    const built = await reader.check(recent, await hashOf(provider, recent), true).build();
    expect(recreatedAtOwnIndex(built, (input) => isPoolSlotInput(input, pool))).toHaveLength(1);
    expect((await reader.check(recent, await hashOf(provider, recent), true)).txid).toMatch(TXID);
    expect((await reader.check(recent + 1n, await hashOf(provider, recent), false)).txid).toMatch(TXID);
    await expect(reader.check(recent, ZERO, true)).rejects.toThrow(SCRIPT_FAILURE);

    // No slot holds a block 256 older than the newest of its residue, which reads as zero.
    const old = (await newestSlot(provider, pool)) - 256n;
    expect((await selectPoolSlot(provider, pool, old))?.exact).toBe(false);
    expect((await reader.check(old, ZERO, true)).txid).toMatch(TXID);
    await expect(reader.check(old, await hashOf(provider, old), true)).rejects.toThrow(SCRIPT_FAILURE);
    expect((await (sc as unknown as StatefulContract).getState()).reads).toBe(3n);
  }, 300_000);

  it('a nested callee\'s pointer target reads blockhash from a slot its caller co-spends, and the zero', async () => {
    const provider = createTestProvider() as MockNetworkProvider;
    const relayArtifact = compileString(HASH_RELAY);
    expect(relayArtifact.abi.find((fn) => fn.name === 'relay')!.indirectPoolReads).toBeUndefined();
    const hashes = await deployStateful(provider, compileString(POINTER_HASHES), [], { reads: 0n });
    const relay = await deployStateful(provider, relayArtifact, [hashes.locking], { relays: 0n });
    const pool = provider.oraclePoolCategory!;
    expect(hashes.pool).toBe(pool);
    const call = (n: bigint, expected: Uint8Array): Call => (relay.sc as unknown as {
      relay(...args: unknown[]): { withExternalCall(callee: StatefulContract, fn: string, args: unknown[]): Call };
    }).relay(n, expected, true).withExternalCall(hashes.sc, 'check', [n, expected, true]);

    // The root reads no pool: the callee's walk gets the slot holding n, past every block.
    const recent = (await newestSlot(provider, pool)) - 1n;
    const built = await call(recent, await hashOf(provider, recent)).build();
    expect(recreatedAtOwnIndex(built, (input) => isPoolSlotInput(input, pool))).toHaveLength(1);
    expect((await call(recent, await hashOf(provider, recent))).txid).toMatch(TXID);

    // A block 256 older than the newest of its residue reads as zero.
    const old = (await newestSlot(provider, pool)) - 256n;
    expect((await selectPoolSlot(provider, pool, old))?.exact).toBe(false);
    expect((await call(old, ZERO)).txid).toMatch(TXID);
    expect((await hashes.sc.getState()).reads).toBe(2n);
    expect((await relay.sc.getState()).relays).toBe(2n);
    await expect(call(old, await hashOf(provider, old))).rejects.toThrow();
  }, 300_000);

  it('a delegate\'s pointer target reads blockhash from a slot the proxy call co-spends, and the zero', async () => {
    const provider = createTestProvider() as MockNetworkProvider;
    const signer = new Signer(freshPrivateKey(), provider);
    for (let coin = 0; coin < 6; coin += 1) await addProvenUtxo(provider, signer.getAddress());
    const implArtifact = compileString(POINTER_HASHES_IMPL);
    expect(implArtifact.delegateArtifact?.abi.find((fn) => fn.name === 'check')?.indirectPoolReads)
      .toEqual({ blockhash: true });
    const proxy = await upgrades.deployProxy(getContractFactory(implArtifact, signer), { reads: 0n });
    const pool = provider.oraclePoolCategory!;
    const reader = proxy as unknown as { check(n: bigint, expected: Uint8Array, live: boolean): Call };

    // The proxy's forward reads no pool: the implementation's walk gets the slot holding n.
    const recent = (await newestSlot(provider, pool)) - 1n;
    const built = await reader.check(recent, await hashOf(provider, recent), true).build();
    expect(recreatedAtOwnIndex(built, (input) => isPoolSlotInput(input, pool))).toHaveLength(1);
    expect((await reader.check(recent, await hashOf(provider, recent), true)).txid).toMatch(TXID);

    const old = (await newestSlot(provider, pool)) - 256n;
    expect((await selectPoolSlot(provider, pool, old))?.exact).toBe(false);
    expect((await reader.check(old, ZERO, true)).txid).toMatch(TXID);
    expect((await (proxy.proxy as unknown as StatefulContract).getState()).reads).toBe(2n);
    await expect(reader.check(old, await hashOf(provider, old), true)).rejects.toThrow();
  }, 300_000);
});
