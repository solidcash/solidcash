import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import type { StateLayout } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileString, compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, ContractFactory, SignatureTemplate, Signer } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import type { StatefulContract } from '../../../src/stateful/StatefulContract.js';
import { readPerCallState } from '../../../src/per-call/deploy/index.js';
import {
  PerCallProxyDeployError, buildProxyArtifact, callPerCallProxyEntry, deployPerCallProxy,
  type PerCallProxyCallResult,
} from '../../../src/per-call/proxy/index.js';
import type { Unlocker, Utxo } from '../../../src/interfaces.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * The mock chain's clock in a per-call contract's `block.timestamp`.
 *
 * `block.timestamp` compiles to a register of the contract's own record, `__block_timestamp`, which a keeper
 * refreshes on a live chain. The mock chain has none: its `evm_increaseTime` and `evm_mine` (the Hardhat analogue)
 * rewrite the register in the records of every registered deployment. A per-call proxy keeps the application state,
 * the register included, in the proxy's own records under the implementation's layout, so that is where the clock
 * has to land for an entry run through the proxy to read it. A plain per-call deployment the factory registers keeps
 * it in its own records, and a direct contract beside it in its data NFT; one mined block moves both.
 */

const DAY = 86_400n;

const SOURCE = [
  'pragma solidcash ^0.13.0;',
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

const clock = compileStringMulti(SOURCE, { composition: 'per-call' }).Clock!;
const proxyArtifact = buildProxyArtifact(clock);

/** The direct convention's control: the same register, gated the same way. */
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
  const { byNft } = await readPerCallState(network, categoryId, layout);
  return Object.assign({}, ...byNft) as Record<string, unknown>;
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
  const deployment = await deployPerCallProxy({
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
): Promise<{ readonly result?: PerCallProxyCallResult; readonly error?: Error; readonly coinLive: boolean }> {
  const coin = await world.nextCoin();
  let result: PerCallProxyCallResult | undefined;
  let error: Error | undefined;
  try {
    result = await callPerCallProxyEntry({
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

describe('the mock chain\'s clock in a proxied per-call contract', () => {
  let world: World;

  it('setup: the proxy and its initialize hop settle', async () => {
    world = await deployWorld();
  }, 300_000);

  it('the register is 0 at genesis, and a mined block writes the chain\'s clock into the proxy\'s record', async () => {
    const genesis = await proxyState(world);
    expect(genesis.__block_timestamp).toBe(0n);
    await world.network.send('evm_mine', []);
    const now = BigInt(world.network.getBlockTime());
    expect(now).toBeGreaterThan(DAY);
    // Only the register moves: every other field of the record decodes as it did.
    expect(await proxyState(world)).toStrictEqual({ ...genesis, __block_timestamp: now });
  }, 300_000);

  it('an entry gated a day after its stamp is refused before the day and settles after it', async () => {
    const marked = await enter(world, 'mark');
    expect(marked.error).toBeUndefined();
    expect(marked.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    const stamped = await proxyState(world);
    expect(stamped.stamp).toBe(stamped.__block_timestamp);

    const early = await enter(world, 'later');
    expect(early.error).toBeInstanceOf(PerCallProxyDeployError);
    expect(early.error!.message).toContain('frame "implementation-master" of Clock.later() at line '
      + `${lineOf('"a day has not passed"')}: a day has not passed (Program failed an OP_VERIFY operation.)`);
    expect(early.coinLive).toBe(true);

    await world.network.send('evm_increaseTime', [Number(DAY)]);
    await world.network.send('evm_mine', []);
    const moved = await proxyState(world);
    expect(moved.__block_timestamp).toBe(BigInt(world.network.getBlockTime()));
    expect(moved.__block_timestamp as bigint).toBeGreaterThanOrEqual((stamped.stamp as bigint) + DAY);

    const settled = await enter(world, 'later');
    expect(settled.error).toBeUndefined();
    expect(settled.result!.verdicts.every((verdict) => verdict.accepted)).toBe(true);
    expect(settled.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(settled.coinLive).toBe(false);
    expect((await proxyState(world)).count).toBe(1n);
  }, 900_000);
});

describe('the mock chain\'s clock in a plain per-call contract, with a direct one beside it', () => {
  it('a mined block writes the chain\'s clock into both, and the gated entry settles after the day', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signer = new Signer(alicePriv, network);
    for (const seed of ['c9', 'da', 'eb']) await network.addUtxo(signer.getAddress(), funding(category(seed)));
    await fundShippedFacets(network);
    // The factory registers each deployment it makes, which is how the mock chain's clock finds it.
    const plain = await new ContractFactory(clock, signer).deploy() as unknown as StatefulContract;
    const direct = await new ContractFactory(timed, signer).deploy() as unknown as StatefulContract;
    const plainState = (): Promise<Record<string, unknown>> => stateOf(network, plain.categoryId, clock.stateLayout!);
    expect((await plainState()).__block_timestamp).toBe(0n);
    expect((await direct.getState()).__block_timestamp).toBe(0n);

    await network.send('evm_mine', []);
    const now = BigInt(network.getBlockTime());
    expect((await plainState()).__block_timestamp).toBe(now);
    expect((await direct.getState()).__block_timestamp).toBe(now);

    const calls = plain.call as unknown as { mark: () => Promise<unknown>; later: () => Promise<unknown> };
    await calls.mark();
    expect((await plainState()).stamp).toBe(now);
    await expect(calls.later()).rejects.toThrow(/a day has not passed/);

    await network.send('evm_increaseTime', [Number(DAY)]);
    await network.send('evm_mine', []);
    expect((await plainState()).__block_timestamp).toBe(BigInt(network.getBlockTime()));
    await calls.later();
    expect((await plainState()).count).toBe(1n);
  }, 900_000);
});
