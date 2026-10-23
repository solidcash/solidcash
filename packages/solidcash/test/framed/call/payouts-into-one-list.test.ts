import { describe, expect, it } from 'vitest';
import { bigIntToVmNumber, binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import { bytesToHex, sha256, validatorAddress, type RecordEntry } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { deployMaster, readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry, type FramedProxyCallResult } from '../../../src/framed/proxy/deploy.js';
import { sharedNodeId } from '../../../src/framed/proxy/entry-writes.js';
import { bytesToSlotValue, decodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { aliceAddress, alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * A payer that pays several payees in one transaction through a token whose balances are a sorted list of nodes.
 *
 * The payer, behind a generated proxy, loops over its payees and calls the token's `transfer` once per turn, so each
 * turn is a reach of the token's own master that debits the payer's node and credits the payee's. A payee the list
 * does not hold is inserted, which relinks the node below it: the payer's own node when the payee sorts just above
 * it, a node an earlier turn created when new payees share one gap, or a holder's node an earlier turn credited.
 * Each turn is planned against the list the turns before it left, and the views of every node several turns touch
 * chain in the order the turns run, so the payer is debited once per turn and each payee ends at the sum it was paid:
 * five transfers in one hop, three of them inserting into the one gap above the payer. A transfer to the payer itself
 * writes one key twice in one batch, which is refused by name.
 */

/** A 32-byte category or txid that is neither one repeated byte nor a palindrome, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`payouts into one list ${label}`)));
}

const TOKEN_CATEGORY = idOf('token');
const PAYER_IMPL_CATEGORY = idOf('payer implementation');
const PAYER_PROXY_CATEGORY = idOf('payer proxy');

/** The payer's own address, which its proxy's category fixes before anything is deployed. */
const PAYER = validatorAddress(hexToBin(PAYER_PROXY_CATEGORY), VALIDATOR_PROGRAM);
const CALLER = encodeLockingBytecodeP2pkh(alicePkh);

/** The slot a holder's balance node sits at. */
const slotOf = (who: Uint8Array): bigint => bytesToSlotValue(keyToSlotMulti([who]));

/** The first five candidate holders above the payer in slot order. */
const ABOVE = Array.from({ length: 256 }, (_unused, index) =>
  encodeLockingBytecodeP2pkh(sha256(utf8ToBin(`payouts into one list holder ${index}`)).slice(0, 20)))
  .filter((who) => slotOf(who) > slotOf(PAYER))
  .sort((left, right) => (slotOf(left) < slotOf(right) ? -1 : 1))
  .slice(0, 5);
if (ABOVE.length < 5) throw new Error('fewer than five candidate holders sort above the payer');
/**
 * Three keys the list does not hold between the payer and the one holder above it, lowest first, that holder, and a
 * key above it: the token's list starts as the head, the payer and the holder.
 */
const [LOW, MIDDLE, HIGH, HOLDER, BEYOND] = ABOVE as [Uint8Array, Uint8Array, Uint8Array, Uint8Array, Uint8Array];

const SOURCE = [
  'pragma solidcash ^0.14.0;',
  'interface IToken { function transfer(address to, int amount); }',
  'contract Token {',
  '  mapping(address => int) balances;',
  `  constructor() { this.balances[0x${binToHex(PAYER)}] = 1000; this.balances[0x${binToHex(HOLDER)}] = 50; }`,
  '  function transfer(address to, int amount) {',
  '    int held = this.balances[msg.sender];',
  '    require(held >= amount, "short balance");',
  '    this.balances[msg.sender] = held - amount;',
  '    this.balances[to] = this.balances[to] + amount;',
  '  }',
  '}',
  'contract Payer {',
  '  address public implementation;',
  '  address public token;',
  '  function initialize(address t) { this.token = t; require(true); }',
  '  function payEach(address[] payees, int[] amounts) {',
  '    for (int i = 0; i < payees.length; i = i + 1) { IToken(this.token).transfer(payees[i], amounts[i]); }',
  '  }',
  '}',
].join('\n');

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const token = artifacts.Token!;
const payer = artifacts.Payer!;
const TOKEN_ADDRESS = deployMaster(token, hexToBin(TOKEN_CATEGORY), VALIDATOR_PROGRAM).address;

/** A coin a genesis or a hop is funded from; a genesis's txid becomes the category it mints. */
function funding(txid: string): { txid: string; vout: number; satoshis: bigint } {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

/** The deployment the cases share, and the chain as it stood when the deployment was done. */
interface World {
  readonly network: MockNetworkProvider;
  readonly payerProxyCategoryId: string;
  readonly payerImplementationCategoryId: string;
  readonly callCoin: { txid: string; vout: number; satoshis: bigint };
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
  readonly snapshot: SnapshotRestorer;
}

/** Deploys the token with a master for every turn, then the payer behind a generated proxy pointed at it. */
async function deployWorld(): Promise<World> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const walletFunder = wallet.unlock.spend(alicePub, signature);
  const callerFunder = signature.unlockP2PKH();

  const tokenCoin = funding(TOKEN_CATEGORY);
  await network.addUtxo(aliceAddress, tokenCoin);
  await deployStatefulContract(token, [], {
    fundingUtxo: tokenCoin, funder: callerFunder, changeAddress: aliceAddress, provider: network, threadCount: 6,
  });
  for (const categoryId of [PAYER_IMPL_CATEGORY, PAYER_PROXY_CATEGORY]) {
    await network.addUtxo(wallet.address, funding(categoryId));
  }
  const initCoin = funding(idOf('payer initialize coin'));
  const callCoin = funding(idOf('call coin'));
  for (const coin of [initCoin, callCoin]) await network.addUtxo(binToHex(CALLER), coin);
  await fundShippedFacets(network);

  const deployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: payer,
    proxyArtifact: buildProxyArtifact(payer),
    implementationDeploy: {
      fundingUtxo: funding(PAYER_IMPL_CATEGORY), funder: walletFunder, changeAddress: wallet.address,
    },
    proxyDeploy: { fundingUtxo: funding(PAYER_PROXY_CATEGORY), funder: walletFunder, changeAddress: wallet.address },
    initialize: { functionName: 'initialize', args: [TOKEN_ADDRESS] },
    callerLockingBytecode: CALLER,
    callerFunding: { utxo: initCoin, funder: callerFunder, changeAddress: wallet.address },
    vm: compositionMachine(),
  });
  expect(deployment.initialize.broadcast).toBeDefined();
  // The token was minted with the payer's balance at this address, so the proxy has to sit there.
  expect(binToHex(deployment.proxy.address)).toBe(binToHex(PAYER));
  return {
    network,
    payerProxyCategoryId: deployment.proxy.categoryId,
    payerImplementationCategoryId: deployment.implementation.categoryId,
    callCoin,
    funder: callerFunder,
    snapshot: await network.takeSnapshot(),
  };
}

let worldRun: Promise<World> | undefined;

/** One deployment serves every case, each rewinding the chain to it first, so each starts from the same list. */
async function deployed(): Promise<World> {
  worldRun ??= deployWorld();
  const world = await worldRun;
  await world.snapshot.restore();
  return world;
}

/** The payer's `payEach`, entered on its proxy by the caller, paying each payee the amount beside it. */
function payEach(
  world: World, payees: readonly Uint8Array[], amounts: readonly bigint[],
): Promise<FramedProxyCallResult> {
  return callFramedProxyEntry({
    provider: world.network,
    implementationArtifact: payer,
    proxyArtifact: buildProxyArtifact(payer),
    proxyCategoryId: world.payerProxyCategoryId,
    implementationCategoryId: world.payerImplementationCategoryId,
    functionName: 'payEach',
    args: [[...payees], [...amounts]],
    externals: { IToken: { artifact: token, categoryId: TOKEN_CATEGORY } },
    callerUtxo: world.callCoin,
    callerLockingBytecode: CALLER,
    funder: world.funder,
    changeAddress: aliceAddress,
    vm: compositionMachine(),
  });
}

/** The value a balance node carries, as the token's own encoding writes an `int`. */
const balance = (amount: bigint): string => bytesToHex(bigIntToVmNumber(amount));

/** The token's list as the chain holds it, walked from the head along each node's link, by slot and value. */
async function liveList(world: World): Promise<readonly (readonly [bigint, string])[]> {
  const deployment = await readFramedDeployment(world.network, TOKEN_CATEGORY, token.stateLayout!);
  const nodes = new Map((deployment.nodesByCollection.get('balances') ?? []).map((utxo) => {
    const node = decodeEntryCommitment(hexToBin(utxo.token!.nft!.commitment));
    return [bytesToSlotValue(node.slot), node] as const;
  }));
  const list: (readonly [bigint, string])[] = [];
  for (let next = nodes.get(0n)?.nextKey; next !== undefined && bytesToSlotValue(next) !== 0n;) {
    const node = nodes.get(bytesToSlotValue(next));
    if (node === undefined) break;
    list.push([bytesToSlotValue(node.slot), bytesToHex(node.value)]);
    next = node.nextKey;
  }
  // Every node the token holds is on the walk, so no node fell out of the list.
  expect(list).toHaveLength(nodes.size - 1);
  return list;
}

/** The list the given holders' balances make, in slot order. */
function listOf(holders: readonly (readonly [Uint8Array, bigint])[]): readonly (readonly [bigint, string])[] {
  return holders.map(([who, amount]) => [slotOf(who), balance(amount)] as const)
    .sort((left, right) => (left[0] < right[0] ? -1 : 1));
}

/** Each declaration a token frame makes of one holder's node, in segment order, as `viewIn -> viewOut` values. */
function declarationsOf(
  result: FramedProxyCallResult, master: string, who: Uint8Array,
): readonly (readonly [string, string])[] {
  const id = sharedNodeId(TOKEN_CATEGORY, 'balances', keyToSlotMulti([who]));
  const index = result.draft.layout.participants.find((placed) => placed.id === id)!.index;
  const value = (commitment: Uint8Array): string => bytesToHex(decodeEntryCommitment(commitment).value);
  return result.draft.blockOf(master).segments.flatMap((segment: readonly RecordEntry[]) => segment)
    .filter((entry) => entry.in === index)
    .map((entry) => [value(entry.viewIn), value(entry.viewOut)] as const);
}

/** The token frames the hop placed, one per turn, in the order the turns run. */
function transferFrames(result: FramedProxyCallResult): readonly string[] {
  return result.draft.layout.participants.map((placed) => placed.id)
    .filter((id) => /^callee-master-\d+$/.test(id));
}

describe('a payer that pays several payees through one token in one transaction', () => {
  it('starts from a list the payer and one holder make, the payees around them', () => {
    const slots = [PAYER, LOW, MIDDLE, HIGH, HOLDER, BEYOND].map(slotOf);
    expect(slots).toStrictEqual([...slots].sort((left, right) => (left < right ? -1 : 1)));
  });

  it('settles five payouts, three of them new payees in the one gap above the payer', async () => {
    const world = await deployed();
    expect(await liveList(world)).toStrictEqual(listOf([[PAYER, 1000n], [HOLDER, 50n]]));

    // MIDDLE splices in through the payer's own node, which the same transfer debits; HIGH through the node MIDDLE's
    // transfer created; LOW through the payer's node again, now linked to MIDDLE; HOLDER is credited where it stands;
    // BEYOND splices in through HOLDER's node, which the transfer before it credited.
    const result = await payEach(world, [MIDDLE, HIGH, LOW, HOLDER, BEYOND], [10n, 20n, 30n, 40n, 50n]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);

    // The payer's node is debited once per turn, each turn continuing from the balance the one before it left; a turn
    // whose insert relinks it declares it twice, once in the insert's group.
    const frames = transferFrames(result);
    expect(frames).toHaveLength(5);
    expect(frames.map((master) => declarationsOf(result, master, PAYER))).toStrictEqual([
      [[balance(1000n), balance(990n)], [balance(990n), balance(990n)]],
      [[balance(990n), balance(970n)]],
      [[balance(970n), balance(940n)], [balance(940n), balance(940n)]],
      [[balance(940n), balance(900n)]],
      [[balance(900n), balance(850n)]],
    ]);
    // The holder is credited, then relinked with the balance the credit left.
    expect(frames.slice(3).map((master) => declarationsOf(result, master, HOLDER)))
      .toStrictEqual([[[balance(50n), balance(90n)]], [[balance(90n), balance(90n)]]]);

    expect(await liveList(world)).toStrictEqual(listOf([
      [PAYER, 850n], [LOW, 30n], [MIDDLE, 10n], [HIGH, 20n], [HOLDER, 90n], [BEYOND, 50n],
    ]));
  }, 600_000);

  it('settles one new payee paid twice, which ends at the sum', async () => {
    const world = await deployed();

    const result = await payEach(world, [BEYOND, BEYOND], [5n, 6n]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);

    expect(await liveList(world)).toStrictEqual(listOf([[PAYER, 989n], [HOLDER, 50n], [BEYOND, 11n]]));
  }, 600_000);

  it('refuses a payout to the payer itself by name, which one batch would write twice', async () => {
    const world = await deployed();

    await expect(payEach(world, [PAYER], [5n]))
      .rejects.toThrow(/the callee "Token\.transfer\(\)" writes records this hop cannot declare: .*more than once/);
    expect(await liveList(world)).toStrictEqual(listOf([[PAYER, 1000n], [HOLDER, 50n]]));
  });
});
