import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { blockOracleFieldBytes, type StateLayout } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileString, compileStringMulti } from '../../../../solidc/src/compiler.js';
import {
  Contract,
  SignatureTemplate,
  Signer,
  TransactionBuilder,
} from '../../../src/index.js';
import { ContractFactory } from '../../../src/stateful/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import type { StatefulContract } from '../../../src/stateful/StatefulContract.js';
import { readFramedState } from '../../../src/framed/deploy/index.js';
import {
  FramedProxyDeployError, buildProxyArtifact, callFramedProxyEntry, deployFramedProxy,
  type FramedProxyCallResult,
} from '../../../src/framed/proxy/index.js';
import type { Unlocker, Utxo } from '../../../src/interfaces.js';
import { randomUtxo } from '../../../src/utils.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * The mock chain's clock in a framed contract's `block.timestamp`.
 *
 * `block.timestamp` slices the commitment of the one block-oracle covenant an entry co-spends; no record holds a
 * register. The mock chain mints that oracle and writes its clock into it on `evm_increaseTime` and `evm_mine` (the
 * Hardhat analogue) and with every block it mines for a transaction it accepts. An entry run through a framed proxy
 * reads that commitment as a plain framed deployment's entry does, and a direct contract beside them pins the same
 * oracle lock: one mined block moves the clock all of them read.
 */

const DAY = 86_400n;

const SOURCE = [
  'pragma solidcash ^0.14.0;',
  'contract Clock {',
  '  address public implementation;',
  '  int public stamp;',
  '  int public count;',
  '  function initialize() { require(true); }',
  '  function mark() { this.stamp = block.timestamp; }',
  '  function later() {',
  `    require(block.timestamp >= this.stamp + ${DAY}, "a day has not passed");`,
  '    this.count = this.count + 1;',
  '  }',
  '}',
].join('\n');

const clock = compileStringMulti(SOURCE, { composition: 'framed' }).Clock!;
const proxyArtifact = buildProxyArtifact(clock);

/** The direct convention's control: a stateless reader of the same oracle, gated the same way. */
const timed = compileString([
  'contract Timed() {',
  '  function gated(int started) {',
  `    require(block.timestamp >= started + ${DAY}, "a day has not passed");`,
  '    require(true);',
  '  }',
  '}',
].join('\n'), { messageBus: false });

/** The 1-based line of the first source line containing `needle`. */
function lineOf(needle: string): number {
  return SOURCE.split('\n').findIndex((line) => line.includes(needle)) + 1;
}

/** A 32-byte id with varied bytes, `seed` chosen so each is distinct. */
function category(seed: string): string {
  const base = '5d6e7f8091a2b3c4d5e6f708192a3b4';
  return `${seed}${base}${base}`.slice(0, 64);
}

const IMPL_CATEGORY = category('a7');
const PROXY_CATEGORY = category('b8');
const CALLER = encodeLockingBytecodeP2pkh(alicePkh);

/** A coin a genesis or a hop is funded from; a genesis mints its txid as the category. */
function funding(txid: string): Utxo {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

/** The fields a category's records hold, decoded under `layout` with the shipped reader. */
async function stateOf(
  network: MockNetworkProvider, categoryId: string, layout: StateLayout,
): Promise<Record<string, unknown>> {
  const { byNft } = await readFramedState(network, categoryId, layout);
  return Object.assign({}, ...byNft) as Record<string, unknown>;
}

/** The timestamp of the oracle a reader co-spends: the first mutable NFT at the oracle lock. */
async function oracleClock(network: MockNetworkProvider): Promise<bigint> {
  const oracle = (await network.getUtxosForLockingBytecode(network.blockOracleLock))
    .find((utxo) => utxo.token?.nft?.capability === 'mutable');
  const field = blockOracleFieldBytes(hexToBin(oracle?.token?.nft?.commitment ?? ''), 'timestamp');
  let value = 0n;
  for (let index = 0; index < 4; index += 1) value |= BigInt(field[index] ?? 0) << BigInt(8 * index);
  return value;
}

/** Spends the direct reader's `gated(started)`; the builder co-spends the oracle it pins. */
async function gated(network: MockNetworkProvider, direct: Contract, started: bigint): Promise<string> {
  const coin = await network.addUtxo(direct.address, randomUtxo({ satoshis: 100_000n }));
  const tx = await new TransactionBuilder({ provider: network })
    .addInput(coin, direct.unlock.gated(started))
    .addOutput({ to: direct.address, amount: 90_000n })
    .send();
  return tx.txid;
}

/** One proxied deployment and what a hop through it is entered with. */
interface World {
  readonly network: MockNetworkProvider;
  readonly proxy: string;
  readonly implementation: string;
  readonly funder: Unlocker;
  readonly changeAddress: string;
  /** Hands out a fresh coin at the caller's lock per hop, distinct from every category. */
  readonly nextCoin: () => Promise<Utxo>;
}

/** Deploys `Clock` behind its generated proxy; the initialize hop settles and broadcasts. */
async function deployWorld(): Promise<World> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const genesisFunder = wallet.unlock.spend(alicePub, signature);
  const funder = signature.unlockP2PKH();
  const changeAddress = wallet.address;
  let serial = 0x31;
  const nextCoin = async (): Promise<Utxo> => {
    serial += 1;
    const coin = funding(category(serial.toString(16)));
    await network.addUtxo(binToHex(CALLER), coin);
    return coin;
  };
  for (const id of [IMPL_CATEGORY, PROXY_CATEGORY]) await network.addUtxo(wallet.address, funding(id));
  await fundShippedFacets(network);
  const deployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: clock,
    proxyArtifact,
    implementationDeploy: { fundingUtxo: funding(IMPL_CATEGORY), funder: genesisFunder, changeAddress },
    proxyDeploy: { fundingUtxo: funding(PROXY_CATEGORY), funder: genesisFunder, changeAddress },
    initialize: { functionName: 'initialize', args: [] },
    callerLockingBytecode: CALLER,
    callerFunding: { utxo: await nextCoin(), funder, changeAddress },
    vm: compositionMachine(),
  });
  expect(deployment.initialize.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  return {
    network,
    proxy: deployment.proxy.categoryId,
    implementation: deployment.implementation.categoryId,
    funder,
    changeAddress,
    nextCoin,
  };
}

/** Enters one entry through the proxy as the caller; returns its result or error and whether its coin is unspent. */
async function enter(
  world: World, functionName: string,
): Promise<{ readonly result?: FramedProxyCallResult; readonly error?: Error; readonly coinLive: boolean }> {
  const coin = await world.nextCoin();
  let result: FramedProxyCallResult | undefined;
  let error: Error | undefined;
  try {
    result = await callFramedProxyEntry({
      provider: world.network,
      implementationArtifact: clock,
      proxyArtifact,
      proxyCategoryId: world.proxy,
      implementationCategoryId: world.implementation,
      functionName,
      args: [],
      callerUtxo: coin,
      callerLockingBytecode: CALLER,
      funder: world.funder,
      changeAddress: world.changeAddress,
      vm: compositionMachine(),
    });
  } catch (caught) {
    error = caught as Error;
  }
  const live = await world.network.getUtxosForLockingBytecode(CALLER);
  return {
    ...(result === undefined ? {} : { result }),
    ...(error === undefined ? {} : { error }),
    coinLive: live.some((utxo) => utxo.txid === coin.txid && utxo.vout === coin.vout),
  };
}

/** The proxy's application state, read as the hop reads it: the proxy's records under the proxy's layout. */
function proxyState(world: World): Promise<Record<string, unknown>> {
  return stateOf(world.network, world.proxy, proxyArtifact.stateLayout!);
}

describe('the mock chain\'s clock in a proxied framed contract', () => {
  let world: World;

  it('setup: the proxy and its initialize hop settle', async () => {
    world = await deployWorld();
  }, 300_000);

  it('the clock is the oracle commitment, not a field of the proxy\'s record, and a mined block moves it', async () => {
    expect(proxyArtifact.stateLayout!.variables.map((variable) => variable.name)).not.toContain('__block_timestamp');
    const genesis = await proxyState(world);
    await world.network.send('evm_mine', []);
    const now = BigInt(world.network.getBlockTime());
    expect(now).toBeGreaterThan(DAY);
    expect(await oracleClock(world.network)).toBe(now);
    // The record decodes as it did: the mined block writes only the oracle.
    expect(await proxyState(world)).toStrictEqual(genesis);
  }, 300_000);

  it('an entry gated a day after its stamp is refused before the day and settles after it', async () => {
    const read = await oracleClock(world.network);
    const marked = await enter(world, 'mark');
    expect(marked.error).toBeUndefined();
    expect(marked.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    // The entry stamps the clock it read; the block that confirms it moves the oracle on to that block's time.
    const stamped = await proxyState(world);
    expect(stamped.stamp).toBe(read);
    const confirmed = await oracleClock(world.network);
    expect(confirmed).toBe(BigInt(world.network.getBlockTime()));
    expect(confirmed).toBeGreaterThan(read);

    const early = await enter(world, 'later');
    expect(early.error).toBeInstanceOf(FramedProxyDeployError);
    expect(early.error!.message).toContain('frame "implementation-master" of Clock.later() at line '
      + `${lineOf('"a day has not passed"')}: a day has not passed (Program failed an OP_VERIFY operation.)`);
    expect(early.coinLive).toBe(true);

    await world.network.send('evm_increaseTime', [Number(DAY)]);
    await world.network.send('evm_mine', []);
    const moved = await oracleClock(world.network);
    expect(moved).toBe(BigInt(world.network.getBlockTime()));
    expect(moved).toBeGreaterThanOrEqual((stamped.stamp as bigint) + DAY);

    const settled = await enter(world, 'later');
    expect(settled.error).toBeUndefined();
    expect(settled.result!.verdicts.every((verdict) => verdict.accepted)).toBe(true);
    expect(settled.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(settled.coinLive).toBe(false);
    expect((await proxyState(world)).count).toBe(1n);
  }, 900_000);
});

describe('the mock chain\'s clock in a plain framed contract, with a direct one beside it', () => {
  it('a mined block moves the one clock both read, and the gated entry settles after the day', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signer = new Signer(alicePriv, network);
    for (const seed of ['c9', 'da', 'eb']) await network.addUtxo(signer.getAddress(), funding(category(seed)));
    await fundShippedFacets(network);
    const plain = await new ContractFactory(clock, signer).deploy() as unknown as StatefulContract;
    const plainState = (): Promise<Record<string, unknown>> => stateOf(network, plain.categoryId, clock.stateLayout!);
    expect(clock.stateLayout!.variables.map((variable) => variable.name)).not.toContain('__block_timestamp');
    // The direct reader keeps no state and pins the lock of the oracle the framed entries co-spend.
    const direct = new Contract(timed, [], { provider: network });
    expect(timed.stateLayout?.variables ?? []).toStrictEqual([]);
    expect(binToHex(direct.blockOracleLock!)).toBe(binToHex(network.blockOracleLock));

    await network.send('evm_mine', []);
    const now = BigInt(network.getBlockTime());
    expect(await oracleClock(network)).toBe(now);

    const calls = plain.call as unknown as { mark: () => Promise<unknown>; later: () => Promise<unknown> };
    await calls.mark();
    expect((await plainState()).stamp).toBe(now);
    await expect(calls.later()).rejects.toThrow(/a day has not passed/);
    // The oracle co-spend is a custom unlocker, which `send()` does not debug, so the network's verdict is raw.
    await expect(gated(network, direct, now)).rejects.toThrow(/OP_VERIFY|non-truthy/);

    await network.send('evm_increaseTime', [Number(DAY)]);
    await network.send('evm_mine', []);
    expect(await oracleClock(network)).toBe(BigInt(network.getBlockTime()));
    await expect(gated(network, direct, now)).resolves.toMatch(/^[0-9a-f]{64}$/);
    await calls.later();
    expect((await plainState()).count).toBe(1n);
  }, 900_000);
});
