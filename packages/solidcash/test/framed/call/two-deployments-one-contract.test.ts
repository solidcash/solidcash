import { describe, expect, it } from 'vitest';
import { binToHex, encodeDataPush, encodeLockingBytecodeP2pkh, hexToBin, vmNumberToBigInt } from '@bitauth/libauth';
import {
  concatBytes, encodeWitnessBlock, splitFirstPush, validatorAddress,
  type Artifact, type StateLayout, type WitnessBlock,
} from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { decodeEntryCommitment } from '../../../src/stateful/SortedList.js';
import { callFramedEntry } from '../../../src/framed/call/index.js';
import { readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry, type FramedProxyCallResult } from '../../../src/framed/proxy/deploy.js';
import { deploymentStateValues, type FramedProxyExternal } from '../../../src/framed/proxy/external-calls.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * One entry reaching two deployments of the same contract, as an entry over a pair of tokens compiled from one
 * source reaches both.
 *
 * Each deployment is its own category, so it is its own block: its masters come from its own pool and its frames
 * declare its own records, whose participants are named apart from the other deployment's (`Token-record-0` and
 * `Token@<category>-record-0`). `both` credits each token once through the hop, `twice` enters each token twice with
 * the two deployments' frames interleaved, and `PlainBasket.both` takes the same calls through the plain call path.
 * Two deployments of a token behind proxies are four blocks, a proxy and an implementation per deployment. A frame
 * that declares the other deployment's record is refused by the machine.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'interface IToken { function credit(address to, uint256 amount) external; }',
  'contract Token {',
  '  uint256 public supply;',
  '  mapping(address => uint256) internal balances;',
  '  function credit(address to, uint256 amount) external { supply += amount; balances[to] += amount; }',
  '}',
  'contract ProxiedToken {',
  '  address public implementation;',
  '  uint256 public supply;',
  '  mapping(address => uint256) internal balances;',
  '  function initialize() public { supply = 1; }',
  '  function credit(address to, uint256 amount) external { supply += amount; balances[to] += amount; }',
  '}',
  'contract Basket {',
  '  address public implementation;',
  '  IToken public tokenA;',
  '  IToken public tokenB;',
  '  function initialize(IToken a, IToken b) public { tokenA = a; tokenB = b; }',
  '  function both(uint256 a, uint256 b) external {',
  '    tokenA.credit(msg.sender, a);',
  '    tokenB.credit(msg.sender, b);',
  '  }',
  '  function twice(uint256 a, uint256 b, uint256 c, uint256 d) external {',
  '    tokenA.credit(msg.sender, a);',
  '    tokenB.credit(msg.sender, b);',
  '    tokenA.credit(msg.sender, c);',
  '    tokenB.credit(msg.sender, d);',
  '  }',
  '}',
  'contract PlainBasket {',
  '  IToken public tokenA;',
  '  IToken public tokenB;',
  '  constructor(IToken a, IToken b) { tokenA = a; tokenB = b; }',
  '  function both(uint256 a, uint256 b) external {',
  '    tokenA.credit(msg.sender, a);',
  '    tokenB.credit(msg.sender, b);',
  '  }',
  '}',
].join('\n');

const artifacts = compileStringMulti(SOURCE, { solidityImportCompat: true, composition: 'framed' } as never);
const token = artifacts.Token!;
const proxiedToken = artifacts.ProxiedToken!;
const basket = artifacts.Basket!;
const plainBasket = artifacts.PlainBasket!;

/** The caller's lock, which enters every call and so is the `msg.sender` each token is credited to. */
const USER_LOCK = encodeLockingBytecodeP2pkh(alicePkh);

type VmProgram = Parameters<ReturnType<typeof compositionMachine>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type Coin = { txid: string; vout: number; satoshis: bigint };

/** A 32-byte id, distinct per `serial`, used as a coin's txid and so as the category a genesis mints. */
function idOf(serial: number): string {
  return `2d${serial.toString(16).padStart(6, '0')}`.padEnd(64, '7');
}

/** A deployment's address, which its category derives. */
const addressOf = (categoryId: string): Uint8Array => validatorAddress(hexToBin(categoryId), VALIDATOR_PROGRAM);

/** A deployment behind its generated proxy: the proxy's category, which its address names, and its implementation's. */
interface Proxied {
  readonly proxy: string;
  readonly implementation: string;
}

interface Chain {
  readonly network: MockNetworkProvider;
  readonly changeAddress: string;
  readonly userCoin: () => Promise<Coin>;
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
  /** Two deployments of `Token`, and the basket behind its proxy and the plain basket over both. */
  readonly tokenA: string;
  readonly tokenB: string;
  readonly basket: Proxied;
  readonly plainBasket: string;
  /** Two deployments of `ProxiedToken`, each behind its own proxy, and a second basket over both. */
  readonly proxiedA: Proxied;
  readonly proxiedB: Proxied;
  readonly proxiedBasket: Proxied;
  readonly snapshot: SnapshotRestorer;
}

let chainRun: Promise<Chain> | undefined;

/** Every deployment the cases share, each case rewinding the chain to it first. */
async function deployedChain(): Promise<Chain> {
  chainRun ??= (async (): Promise<Chain> => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signature = new SignatureTemplate(alicePriv);
    const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
    const walletFunder = wallet.unlock.spend(alicePub, signature);
    const funder = signature.unlockP2PKH();
    await fundShippedFacets(network);
    let serial = 0;
    const coinAt = async (lock: string): Promise<Coin> => {
      serial += 1;
      const utxo = { txid: idOf(serial), vout: 0, satoshis: 5_000_000n };
      await network.addUtxo(lock, utxo);
      return utxo;
    };
    const walletCoin = (): Promise<Coin> => coinAt(wallet.address);
    const userCoin = (): Promise<Coin> => coinAt(binToHex(USER_LOCK));
    const deployPlain = async (artifact: Artifact, args: readonly unknown[] = []): Promise<string> => (
      await deployStatefulContract(artifact, args as never, {
        provider: network, fundingUtxo: await walletCoin(), changeAddress: wallet.address, funder: walletFunder,
      })).categoryId;
    const deployProxied = async (artifact: Artifact, args: readonly Uint8Array[] = []): Promise<Proxied> => {
      const deployment = await deployFramedProxy({
        provider: network,
        implementationArtifact: artifact,
        proxyArtifact: buildProxyArtifact(artifact),
        implementationDeploy: { fundingUtxo: await walletCoin(), funder: walletFunder, changeAddress: wallet.address },
        proxyDeploy: { fundingUtxo: await walletCoin(), funder: walletFunder, changeAddress: wallet.address },
        initialize: { functionName: 'initialize', args: [...args] },
        callerLockingBytecode: USER_LOCK,
        callerFunding: { utxo: await userCoin(), funder, changeAddress: wallet.address },
        vm: compositionMachine(),
      });
      expect(deployment.initialize.broadcast).toBeDefined();
      return { proxy: deployment.proxy.categoryId, implementation: deployment.implementation.categoryId };
    };
    const tokenA = await deployPlain(token);
    const tokenB = await deployPlain(token);
    const proxiedA = await deployProxied(proxiedToken);
    const proxiedB = await deployProxied(proxiedToken);
    return {
      network,
      changeAddress: wallet.address,
      userCoin,
      funder,
      tokenA,
      tokenB,
      basket: await deployProxied(basket, [addressOf(tokenA), addressOf(tokenB)]),
      plainBasket: await deployPlain(plainBasket, [addressOf(tokenA), addressOf(tokenB)]),
      proxiedA,
      proxiedB,
      proxiedBasket: await deployProxied(basket, [addressOf(proxiedA.proxy), addressOf(proxiedB.proxy)]),
      snapshot: await network.takeSnapshot(),
    };
  })();
  const chain = await chainRun;
  await chain.snapshot.restore();
  return chain;
}

/** Both tokens, each under its own name, so each call is matched to its deployment by the address it targets. */
function tokenExternals(chain: Chain): Record<string, FramedProxyExternal> {
  return {
    TokenA: { artifact: token, categoryId: chain.tokenA },
    TokenB: { artifact: token, categoryId: chain.tokenB },
  };
}

/** Both proxied tokens, each as the hop names a callee behind its proxy. */
function proxiedExternals(chain: Chain): Record<string, FramedProxyExternal> {
  const external = (deployment: Proxied): FramedProxyExternal => ({
    artifact: proxiedToken,
    categoryId: deployment.proxy,
    proxyArtifact: buildProxyArtifact(proxiedToken),
    implementationCategoryId: deployment.implementation,
  });
  return { TokenA: external(chain.proxiedA), TokenB: external(chain.proxiedB) };
}

/** Enters one of a basket deployment's entries through the hop. */
async function enterBasket(
  chain: Chain, over: Proxied, externals: Record<string, FramedProxyExternal>,
  functionName: string, args: readonly bigint[],
): Promise<FramedProxyCallResult> {
  return callFramedProxyEntry({
    provider: chain.network,
    implementationArtifact: basket,
    proxyArtifact: buildProxyArtifact(basket),
    proxyCategoryId: over.proxy,
    implementationCategoryId: over.implementation,
    functionName,
    args: [...args],
    externals,
    callerUtxo: await chain.userCoin(),
    callerLockingBytecode: USER_LOCK,
    funder: chain.funder,
    changeAddress: chain.changeAddress,
    vm: compositionMachine(),
  });
}

/**
 * One token deployment's supply and the balance each key holds, read from the records the chain holds at the
 * category: a proxied token's records are its proxy's, and its nodes the implementation's collections minted there.
 */
async function tokenState(
  chain: Chain, categoryId: string, artifact: Artifact = token,
): Promise<{ readonly supply: unknown; readonly balances: readonly bigint[] }> {
  const layout: StateLayout = artifact === token ? token.stateLayout! : {
    ...buildProxyArtifact(artifact).stateLayout!, collections: artifact.stateLayout!.collections ?? [],
  };
  const deployment = await readFramedDeployment(chain.network, categoryId, layout);
  const balances = (deployment.nodesByCollection.get('balances') ?? [])
    .map((utxo) => decodeEntryCommitment(hexToBin(utxo.token!.nft!.commitment)))
    .filter((node) => node.slot.some((byte) => byte !== 0))
    .map((node) => vmNumberToBigInt(node.value, { requireMinimalEncoding: false }) as bigint);
  return { supply: deploymentStateValues(layout, categoryId, deployment).supply, balances };
}

const blockNames = (result: FramedProxyCallResult): readonly string[] =>
  result.draft.layout.blocks.map((block) => block.contract);

describe('one entry reaching two deployments of one contract', () => {
  it('credits each deployment through the hop, each on its own block and records', async () => {
    const chain = await deployedChain();
    const result = await enterBasket(chain, chain.basket, tokenExternals(chain), 'both', [5n, 7n]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    // Each deployment's records are their own participants, the first named for the contract, the second for its
    // category, and each block holds one master of its own deployment.
    const ids = result.draft.layout.participants.map((placed) => placed.id);
    expect(ids).toContain('Token-record-0');
    expect(ids).toContain(`Token@${chain.tokenB}-record-0`);
    expect(blockNames(result)).toStrictEqual(['BasketProxy', 'Basket', 'Token', `Token@${chain.tokenB}`]);
    expect(await tokenState(chain, chain.tokenA)).toStrictEqual({ supply: 5n, balances: [5n] });
    expect(await tokenState(chain, chain.tokenB)).toStrictEqual({ supply: 7n, balances: [7n] });
  }, 300_000);

  it('enters each deployment twice, the two deployments\' frames interleaved', async () => {
    const chain = await deployedChain();
    const result = await enterBasket(chain, chain.basket, tokenExternals(chain), 'twice', [2n, 3n, 11n, 13n]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    // Each block holds the two masters its deployment's reaches took, in the order the entry reaches them.
    const masters = result.draft.layout.blocks.filter((block) => block.contract.startsWith('Token'))
      .map((block) => block.masters);
    expect(masters).toStrictEqual([['callee-master-1', 'callee-master-3'], ['callee-master-2', 'callee-master-4']]);
    expect(await tokenState(chain, chain.tokenA)).toStrictEqual({ supply: 13n, balances: [13n] });
    expect(await tokenState(chain, chain.tokenB)).toStrictEqual({ supply: 16n, balances: [16n] });
  }, 300_000);

  it('credits two deployments behind their own proxies, a proxy and an implementation block for each', async () => {
    const chain = await deployedChain();
    const result = await enterBasket(chain, chain.proxiedBasket, proxiedExternals(chain), 'both', [5n, 7n]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(blockNames(result)).toStrictEqual([
      'BasketProxy', 'Basket', 'ProxiedTokenProxy', 'ProxiedToken',
      `ProxiedTokenProxy@${chain.proxiedB.proxy}`, `ProxiedToken@${chain.proxiedB.implementation}`,
    ]);
    expect(await tokenState(chain, chain.proxiedA.proxy, proxiedToken)).toStrictEqual({ supply: 6n, balances: [5n] });
    expect(await tokenState(chain, chain.proxiedB.proxy, proxiedToken)).toStrictEqual({ supply: 8n, balances: [7n] });
  }, 300_000);

  it('refuses a frame that declares the other deployment\'s record as its own', async () => {
    const chain = await deployedChain();
    // Equal credits leave the two records at the same views, so a forged declaration differs from the honest one
    // only in which deployment's record it names.
    const result = await enterBasket(chain, chain.basket, tokenExternals(chain), 'both', [5n, 5n]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    const indexOf = (id: string): number => result.draft.layout.participants.find((placed) => placed.id === id)!.index;
    const recordA = indexOf('Token-record-0');
    const recordB = indexOf(`Token@${chain.tokenB}-record-0`);
    const declared = (master: string, index: number): readonly string[] => result.draft.blockOf(master).segments
      .flatMap((segment) => segment.filter((entry) => entry.in === index))
      .flatMap((entry) => [binToHex(entry.viewIn), binToHex(entry.viewOut)]);
    expect(declared('callee-master-1', recordA)).toStrictEqual(declared('callee-master-2', recordB));
    // Each token's frame is handed the other deployment's supply record, at the views that record really holds: each
    // token's own master refuses a record of another category, and the honest transaction is accepted throughout.
    expect(refusedParticipants(result, swappedRecords(result, recordA, recordB)))
      .toStrictEqual(['callee-master-1', 'callee-master-2']);
    expect(refusedParticipants(result, result.transaction)).toStrictEqual([]);
  }, 300_000);

  it('credits each deployment through the plain call path', async () => {
    const chain = await deployedChain();
    const result = await callFramedEntry({
      provider: chain.network,
      artifact: plainBasket,
      categoryId: chain.plainBasket,
      functionName: 'both',
      args: [5n, 7n],
      callerUtxo: await chain.userCoin(),
      callerLockingBytecode: USER_LOCK,
      funder: chain.funder,
      changeAddress: chain.changeAddress,
      vm: compositionMachine(),
      externals: tokenExternals(chain),
    });
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(await tokenState(chain, chain.tokenA)).toStrictEqual({ supply: 5n, balances: [5n] });
    expect(await tokenState(chain, chain.tokenB)).toStrictEqual({ supply: 7n, balances: [7n] });
  }, 300_000);
});

/**
 * The settled transaction with each token frame's declarations of its own record moved to the other deployment's
 * record, at the views the other record's own frame declares: a builder that confused the two deployments.
 */
function swappedRecords(result: FramedProxyCallResult, recordA: number, recordB: number): VmTransaction {
  const transaction = structuredClone(result.transaction) as VmTransaction;
  const blocks = new Map(['callee-master-1', 'callee-master-2'].map((master) => [
    master, structuredClone(result.draft.blockOf(master)) as WitnessBlock,
  ]));
  const entryOf = (master: string, index: number): WitnessBlock['segments'][number][number] =>
    blocks.get(master)!.segments[0]!.find((entry) => entry.in === index)!;
  const declaredA = { ...entryOf('callee-master-1', recordA) };
  const declaredB = { ...entryOf('callee-master-2', recordB) };
  Object.assign(entryOf('callee-master-1', recordA), declaredB);
  Object.assign(entryOf('callee-master-2', recordB), declaredA);
  for (const [master, block] of blocks) {
    const index = result.draft.layout.participants.find((placed) => placed.id === master)!.index;
    const { rest } = splitFirstPush(result.transaction.inputs[index]!.unlockingBytecode);
    transaction.inputs[index] = {
      ...transaction.inputs[index]!,
      unlockingBytecode: concatBytes([encodeDataPush(encodeWitnessBlock(block)), rest]),
    };
  }
  return transaction;
}

/** The participants the machine refuses on a transaction built from a settled hop. */
function refusedParticipants(result: FramedProxyCallResult, transaction: VmTransaction): readonly string[] {
  const vm = compositionMachine();
  return result.draft.layout.participants
    .filter((placed) => vm.stateSuccess(vm.evaluate({
      inputIndex: placed.index, sourceOutputs: result.sourceOutputs, transaction,
    })) !== true)
    .map((placed) => placed.id);
}
