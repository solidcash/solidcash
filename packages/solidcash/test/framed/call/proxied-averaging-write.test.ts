import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import { bytesToHex, sha256, validatorAddress } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { Unlocker, Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry, type FramedProxyCallResult } from '../../../src/framed/proxy/deploy.js';
import type { FramedProxyExternal } from '../../../src/framed/proxy/external-calls.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * An averaging write in a callee reached through its own proxy, whose product of a score and a literal is wider than
 * the score's type (Solidity-compatible).
 *
 * The root, behind a generated proxy, writes its own record and then calls a store behind another generated proxy,
 * whose implementation runs as the proxy's delegate frame and averages the score into a struct-valued mapping node.
 * `score_ * 10000` on a uint8 is uint16 arithmetic, as Solidity's common type makes it, so an admitted score of 5
 * (50000) settles through the shipped hop; typed uint8 it was refused. A score past the store's range is refused by
 * the store's own message.
 */

/** A 32-byte category or txid that is neither one repeated byte nor a palindrome, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`proxied averaging write ${label}`)));
}

const STORE_IMPL = idOf('store implementation');
const STORE_PROXY = idOf('store proxy');
const DESK_IMPL = idOf('desk implementation');
const DESK_PROXY = idOf('desk proxy');
const addressOf = (categoryId: string): Uint8Array => validatorAddress(hexToBin(categoryId), VALIDATOR_PROGRAM);
const CALLER_LOCK = encodeLockingBytecodeP2pkh(alicePkh);

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'interface IStore { function rate(address who_, uint8 score_) external; }',
  'contract Store {',
  '  struct Rating { uint16 average; uint256 count; }',
  '  address public implementation;',
  '  address public desk;',
  '  mapping(address => Rating) public ratings;',
  '  modifier onlyDesk() { require(msg.sender == desk, "not desk"); _; }',
  '  function initialize(address desk_) public { desk = desk_; }',
  '  function rate(address who_, uint8 score_) public onlyDesk {',
  '    require(score_ >= 1 && score_ <= 5, "Invalid score");',
  '    Rating storage rating = ratings[who_];',
  '    rating.average = uint16((rating.average * rating.count + score_ * 10000) / (rating.count + 1));',
  '    rating.count++;',
  '  }',
  '}',
  'contract Desk {',
  '  address public implementation;',
  '  address public store;',
  '  uint8 public last;',
  '  function initialize(address store_) public { store = store_; }',
  '  function rate(uint8 score_) public {',
  '    last = score_;',
  '    IStore(store).rate(msg.sender, score_);',
  '  }',
  '}',
].join('\n');

const OPTIONS = {
  evmCompat: true,
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

interface World {
  readonly network: MockNetworkProvider;
  readonly externals: Readonly<Record<string, FramedProxyExternal>>;
  readonly changeAddress: string;
  readonly funder: Unlocker;
  readonly nextCoin: () => Utxo;
}

async function deployWorld(): Promise<World> {
  const { Store, Desk } = artifacts;
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
  for (const id of [STORE_IMPL, STORE_PROXY, DESK_IMPL, DESK_PROXY]) await network.addUtxo(wallet.address, funding(id));
  await fundShippedFacets(network);
  const storeInit = nextCoin();
  await network.addUtxo(binToHex(CALLER_LOCK), storeInit);
  const store = await deployFramedProxy({
    provider: network,
    implementationArtifact: Store!,
    proxyArtifact: buildProxyArtifact(Store!),
    implementationDeploy: { fundingUtxo: funding(STORE_IMPL), funder: genesisFunder, changeAddress },
    proxyDeploy: { fundingUtxo: funding(STORE_PROXY), funder: genesisFunder, changeAddress },
    initialize: { functionName: 'initialize', args: [addressOf(DESK_PROXY)] },
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
    initialize: { functionName: 'initialize', args: [store.proxy.address] },
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
    },
    changeAddress,
    funder,
    nextCoin,
  };
}

async function rate(world: World, score: bigint): Promise<{ result?: FramedProxyCallResult; error?: Error }> {
  const coin = world.nextCoin();
  await world.network.addUtxo(binToHex(CALLER_LOCK), coin);
  try {
    const result = await callFramedProxyEntry({
      provider: world.network,
      implementationArtifact: artifacts.Desk!,
      proxyArtifact: buildProxyArtifact(artifacts.Desk!),
      proxyCategoryId: DESK_PROXY,
      implementationCategoryId: DESK_IMPL,
      functionName: 'rate',
      args: [score] as FunctionArgument[],
      externals: world.externals,
      callerUtxo: coin,
      callerLockingBytecode: CALLER_LOCK,
      funder: world.funder,
      changeAddress: world.changeAddress,
      vm: compositionMachine(),
    });
    return { result };
  } catch (error) {
    return { error: error as Error };
  }
}

describe('an averaging write in a callee reached through its proxy', () => {
  it('settles the average of an admitted score, and refuses one past the range by the store\'s message', async () => {
    const world = await deployWorld();
    const admitted = await rate(world, 5n);
    expect(admitted.error?.message).toBeUndefined();
    expect(admitted.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);

    const refused = await rate(world, 6n);
    expect(refused.result).toBeUndefined();
    expect(refused.error!.message).toMatch(new RegExp(
      `frame "[^"]*" of Store\\.rate\\(\\) at line ${lineOf('"Invalid score"')}: Invalid score \\(`,
    ));
  }, 600_000);
});
