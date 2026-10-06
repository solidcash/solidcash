import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import { bytesToHex, sha256, validatorAddress } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { Unlocker, Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { FramedProxyDeployError, buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry, type FramedProxyCallResult } from '../../../src/framed/proxy/deploy.js';
import type { FramedProxyExternal } from '../../../src/framed/proxy/external-calls.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * A `require` that fails inside a callee reached through its own proxy (Solidity-compatible).
 *
 * The root, behind a generated proxy, calls a store behind another generated proxy, whose implementation runs as the
 * proxy's delegate frame and refuses the score with its own message. The reason a caller reads is the delegate
 * frame's message, as the EVM bubbles a callee's revert reason up through its proxy: the frame's description ends
 * the refusal, which is the shape the testing layer's `revertedWith` reads its reason from. The store refuses before
 * its own write, before a call of its own to a log that would refuse the score as well (a void frame with nothing to
 * learn, whose derivation stalls at that call), and before a later call of the root's that the hop's planner
 * refuses. Each admitted score settles, and nothing is broadcast for a refused one.
 */

/** A 32-byte category or txid that is neither one repeated byte nor a palindrome, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`proxied callee reason ${label}`)));
}

const LOG_CATEGORY = idOf('log');
const STORE_IMPL = idOf('store implementation');
const STORE_PROXY = idOf('store proxy');
const DESK_IMPL = idOf('desk implementation');
const DESK_PROXY = idOf('desk proxy');
const addressOf = (categoryId: string): Uint8Array => validatorAddress(hexToBin(categoryId), VALIDATOR_PROGRAM);
/** An address no contract of the deployment sits at. */
const GHOST = addressOf(idOf('ghost'));
const CALLER_LOCK = encodeLockingBytecodeP2pkh(alicePkh);

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'interface IStore {',
  '  function rate(address who_, uint8 score_) external;',
  '  function relay(uint8 score_) external;',
  '}',
  'interface ILog { function note(uint8 score_) external; }',
  'interface IGhost { function ping() external; }',
  'contract Log {',
  '  uint8 public floor;',
  '  function note(uint8 score_) public { require(score_ >= floor && score_ <= 5, "log refuses the score"); }',
  '}',
  'contract Store {',
  '  struct Rating { uint16 average; uint256 count; }',
  '  address public implementation;',
  '  address public desk;',
  '  address public log;',
  '  mapping(address => Rating) public ratings;',
  '  modifier onlyDesk() { require(msg.sender == desk, "not desk"); _; }',
  '  function initialize(address desk_, address log_) public { desk = desk_; log = log_; }',
  '  function rate(address who_, uint8 score_) public onlyDesk {',
  '    require(score_ >= 1 && score_ <= 5, "Invalid score");',
  '    Rating storage rating = ratings[who_];',
  '    rating.average = score_;',
  '    rating.count++;',
  '  }',
  '  function relay(uint8 score_) public onlyDesk {',
  '    require(score_ >= 1 && score_ <= 5, "Invalid relayed score");',
  '    ILog(log).note(score_);',
  '  }',
  '}',
  'contract Desk {',
  '  address public implementation;',
  '  address public store;',
  '  address public ghost;',
  '  uint8 public last;',
  '  function initialize(address store_, address ghost_) public { store = store_; ghost = ghost_; }',
  '  function rate(uint8 score_) public {',
  '    last = score_;',
  '    IStore(store).rate(msg.sender, score_);',
  '  }',
  '  function relay(uint8 score_) public {',
  '    last = score_;',
  '    IStore(store).relay(score_);',
  '  }',
  '  function rateThenPing(uint8 score_) public {',
  '    IStore(store).rate(msg.sender, score_);',
  '    IGhost(ghost).ping();',
  '  }',
  '}',
].join('\n');

const OPTIONS = {
  solidityImportCompat: true,
  commitmentLimit: 128,
  maximumInputBytes: 10_000_000,
  messageBus: true,
  optimizeForCompilationSpeed: true,
  suppressWarnings: true,
  ecrecover: 'p2pkh',
  sortedMappingsAll: false,
  composition: 'framed',
} as const;

const artifacts = compileStringMulti(SOURCE, OPTIONS as never);

/** The line of the first source line containing `needle`, 1-based. */
const lineOf = (needle: string): number => SOURCE.split('\n').findIndex((line) => line.includes(needle)) + 1;

/**
 * The tail a refusal ends with when `entry`'s frame refused at the line of `needle` with `reason`: the frame's own
 * description, its objection carrying no parentheses, and nothing after it.
 */
function reasonTail(entry: string, needle: string, reason: string): RegExp {
  return new RegExp(`frame "[^"]*" of ${entry.replace(/[.()]/g, '\\$&')} at line ${lineOf(needle)}: ${reason} `
    + '\\([^()]*\\)$');
}

interface World {
  readonly network: MockNetworkProvider;
  readonly externals: Readonly<Record<string, FramedProxyExternal>>;
  readonly changeAddress: string;
  readonly funder: Unlocker;
  readonly nextCoin: () => Utxo;
  readonly snapshot: SnapshotRestorer;
}

/** The log plain, then the store and the desk behind their generated proxies. */
async function deployWorld(): Promise<World> {
  const { Log, Store, Desk } = artifacts;
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const genesisFunder = wallet.unlock.spend(alicePub, signature);
  const changeAddress = wallet.address;
  const funder = signature.unlockP2PKH();
  let serial = 0;
  const nextCoin = (): Utxo => {
    serial += 1;
    return { txid: idOf(`coin ${serial}`), vout: 0, satoshis: 5_000_000n };
  };
  const funding = (txid: string): Utxo => ({ txid, vout: 0, satoshis: 5_000_000n });
  for (const id of [LOG_CATEGORY, STORE_IMPL, STORE_PROXY, DESK_IMPL, DESK_PROXY]) {
    await network.addUtxo(wallet.address, funding(id));
  }
  await fundShippedFacets(network);
  await deployStatefulContract(Log!, [], {
    fundingUtxo: funding(LOG_CATEGORY), funder: genesisFunder, changeAddress, provider: network,
  });
  const storeInit = nextCoin();
  await network.addUtxo(binToHex(CALLER_LOCK), storeInit);
  const store = await deployFramedProxy({
    provider: network,
    implementationArtifact: Store!,
    proxyArtifact: buildProxyArtifact(Store!),
    implementationDeploy: { fundingUtxo: funding(STORE_IMPL), funder: genesisFunder, changeAddress },
    proxyDeploy: { fundingUtxo: funding(STORE_PROXY), funder: genesisFunder, changeAddress },
    initialize: { functionName: 'initialize', args: [addressOf(DESK_PROXY), addressOf(LOG_CATEGORY)] },
    callerLockingBytecode: CALLER_LOCK,
    callerFunding: { utxo: storeInit, funder, changeAddress },
    vm: compositionMachine(),
  });
  expect(store.initialize.broadcast).toBeDefined();
  const deskInit = nextCoin();
  await network.addUtxo(binToHex(CALLER_LOCK), deskInit);
  const desk = await deployFramedProxy({
    provider: network,
    implementationArtifact: Desk!,
    proxyArtifact: buildProxyArtifact(Desk!),
    implementationDeploy: { fundingUtxo: funding(DESK_IMPL), funder: genesisFunder, changeAddress },
    proxyDeploy: { fundingUtxo: funding(DESK_PROXY), funder: genesisFunder, changeAddress },
    initialize: { functionName: 'initialize', args: [store.proxy.address, GHOST] },
    callerLockingBytecode: CALLER_LOCK,
    callerFunding: { utxo: deskInit, funder, changeAddress },
    vm: compositionMachine(),
  });
  expect(desk.initialize.broadcast).toBeDefined();
  return {
    network,
    externals: {
      IStore: {
        artifact: Store!,
        categoryId: store.proxy.categoryId,
        proxyArtifact: buildProxyArtifact(Store!),
        implementationCategoryId: store.implementation.categoryId,
      },
      ILog: { artifact: Log!, categoryId: LOG_CATEGORY },
    },
    changeAddress,
    funder,
    nextCoin,
    snapshot: await network.takeSnapshot(),
  };
}

let worldRun: Promise<World> | undefined;

/** One deployment serves every case, each rewinding the chain to it first. */
async function deployed(): Promise<World> {
  worldRun ??= deployWorld();
  const world = await worldRun;
  await world.snapshot.restore();
  return world;
}

/** One call of a desk entry through its proxy; a refusal is returned with the coin it left unspent. */
async function enter(
  world: World, functionName: string, score: bigint,
): Promise<{ result?: FramedProxyCallResult; error?: Error; coinLive: boolean }> {
  const coin = world.nextCoin();
  await world.network.addUtxo(binToHex(CALLER_LOCK), coin);
  let outcome: { result?: FramedProxyCallResult; error?: Error };
  try {
    outcome = {
      result: await callFramedProxyEntry({
        provider: world.network,
        implementationArtifact: artifacts.Desk!,
        proxyArtifact: buildProxyArtifact(artifacts.Desk!),
        proxyCategoryId: DESK_PROXY,
        implementationCategoryId: DESK_IMPL,
        functionName,
        args: [score] as FunctionArgument[],
        externals: world.externals,
        callerUtxo: coin,
        callerLockingBytecode: CALLER_LOCK,
        funder: world.funder,
        changeAddress: world.changeAddress,
        vm: compositionMachine(),
      }),
    };
  } catch (error) {
    outcome = { error: error as Error };
  }
  const coinLive = (await world.network.getUtxosForLockingBytecode(CALLER_LOCK))
    .some((utxo) => utxo.txid === coin.txid && utxo.vout === coin.vout);
  return { ...outcome, coinLive };
}

describe('a require inside a callee reached through its proxy', () => {
  it('settles a score the store admits, and names the store\'s own reason for one it refuses', async () => {
    const world = await deployed();
    const admitted = await enter(world, 'rate', 5n);
    expect(admitted.error?.message).toBeUndefined();
    expect(admitted.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);

    const refused = await enter(world, 'rate', 6n);
    expect(refused.result).toBeUndefined();
    expect(refused.error).toBeInstanceOf(FramedProxyDeployError);
    expect(refused.error!.message).toMatch(reasonTail('Store.rate()', '"Invalid score"', 'Invalid score'));
    expect(refused.coinLive).toBe(true);
  }, 600_000);

  it('names the store\'s own reason when it refuses before a call of its own', async () => {
    // The store's frame is void and writes nothing, so its own derivation stalls at its call to the log: the stall is
    // not the reason, the frame's own `require` is. The log would refuse the score too, but it is never called.
    const world = await deployed();
    const admitted = await enter(world, 'relay', 5n);
    expect(admitted.error?.message).toBeUndefined();
    expect(admitted.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);

    const refused = await enter(world, 'relay', 6n);
    expect(refused.result).toBeUndefined();
    expect(refused.error).toBeInstanceOf(FramedProxyDeployError);
    expect(refused.error!.message)
      .toMatch(reasonTail('Store.relay()', '"Invalid relayed score"', 'Invalid relayed score'));
    expect(refused.coinLive).toBe(true);
  }, 600_000);

  it('names the store\'s own reason before a later call the planner refuses, and the planner\'s past it', async () => {
    // The ghost call is refused while the hop plans it, but the execution meets the store's refusal first.
    const world = await deployed();
    const refused = await enter(world, 'rateThenPing', 6n);
    expect(refused.error).toBeInstanceOf(FramedProxyDeployError);
    expect(refused.error!.message).toMatch(reasonTail('Store.rate()', '"Invalid score"', 'Invalid score'));
    expect(refused.coinLive).toBe(true);

    const planned = await enter(world, 'rateThenPing', 5n);
    expect(planned.error!.message).toBe(`the call to "IGhost.ping" targets ${binToHex(GHOST)}, and none of the `
      + 'deployment\'s contracts sits at that address');
    expect(planned.coinLive).toBe(true);
  }, 600_000);
});
