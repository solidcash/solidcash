import { describe, expect, it } from 'vitest';
import {
  bigIntToVmNumber, binToHex, encodeDataPush, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin,
} from '@bitauth/libauth';
import { bytesToHex, sha256, type RecordEntry } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { deployMaster, readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry, type FramedProxyCallResult } from '../../../src/framed/proxy/deploy.js';
import { sharedNodeId } from '../../../src/framed/proxy/entry-writes.js';
import { decodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { aliceAddress, alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * Reaches of one hop that touch one mapping node of a callee share it: one input, the frames' views chained.
 *
 * A proxied root reaches a plain token several times in one entry: a balance read and a debit of the same holder
 * (the shape of a publish entry's `balanceOf` then `transferFrom`), a debit then a read, two debits, and two grants
 * of a key the token does not hold. Each reach is planned against the deployment alone; the node is placed once,
 * keyed by the token's category, the collection and the node's slot, and the hop chains the views the frames declare
 * of it in the order the validator walks them: a read keeps the view the last write before it left, and an update
 * continues from it to the one its own frame computed, so a read after a debit returns the debited balance.
 *
 * A key the list does not hold is inserted once and then rewritten: the first reach splices a node in at the
 * predecessor's output, and a later reach that writes the same key continues that node (its declaration names the
 * creating reach's output and carries the created view forward), so one transaction carries both. Inserts that land
 * beside one another chain the same way, each reach planned against the list the reaches before it left
 * (`call/payouts-into-one-list.test.ts`).
 */

/** A 32-byte category or txid that is neither one repeated byte nor a palindrome, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`shared node across reaches ${label}`)));
}

const TOKEN_CATEGORY = idOf('token');
const DESK_IMPL_CATEGORY = idOf('desk implementation');
const DESK_PROXY_CATEGORY = idOf('desk proxy');

const HOLDER = encodeLockingBytecodeP2pkh(alicePkh);
/** A key the token's constructor writes beside the holder's, so the balances list holds more than one node. */
const OTHER = hexToBin(`76a914${bytesToHex(sha256(utf8ToBin('shared node other holder'))).slice(0, 40)}88ac`);
/** A key the token does not hold, which a grant inserts. */
const NEWCOMER = hexToBin(`76a914${bytesToHex(sha256(utf8ToBin('shared node newcomer'))).slice(0, 40)}88ac`);

const SOURCE = [
  'pragma solidcash ^0.14.0;',
  'interface IToken {',
  '  function balanceOf(address who) returns (int);',
  '  function debit(address who, int amount);',
  '  function grant(address who, int amount);',
  '}',
  'contract Token {',
  '  mapping(address => int) balances;',
  `  constructor() { this.balances[msg.sender] = 1000; this.balances[0x${binToHex(OTHER)}] = 500; }`,
  '  function balanceOf(address who) returns (int) { return this.balances[who]; }',
  '  function debit(address who, int amount) {',
  '    int held = this.balances[who];',
  '    require(held >= amount, "short balance");',
  '    this.balances[who] = held - amount;',
  '  }',
  '  function grant(address who, int amount) { this.balances[who] = amount; }',
  '}',
  'contract Desk {',
  '  address public implementation;',
  '  address public token;',
  '  function initialize(address t) { this.token = t; require(true); }',
  '  function readThenDebit(int amount, int expected) {',
  '    require(IToken(this.token).balanceOf(msg.sender) == expected, "unexpected balance");',
  '    IToken(this.token).debit(msg.sender, amount);',
  '  }',
  '  function debitThenRead(int amount, int expected) {',
  '    IToken(this.token).debit(msg.sender, amount);',
  '    require(IToken(this.token).balanceOf(msg.sender) == expected, "unexpected balance");',
  '  }',
  '  function debitTwice(int first, int second) {',
  '    IToken(this.token).debit(msg.sender, first);',
  '    IToken(this.token).debit(msg.sender, second);',
  '  }',
  '  function grantTwice(address who) {',
  '    IToken(this.token).grant(who, 1);',
  '    IToken(this.token).grant(who, 2);',
  '  }',
  '  function grantThenRead(address who) {',
  '    IToken(this.token).grant(who, 1);',
  '    require(IToken(this.token).balanceOf(who) == 1, "unexpected balance");',
  '  }',
  '}',
].join('\n');

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const token = artifacts.Token!;
const desk = artifacts.Desk!;
const TOKEN_ADDRESS = deployMaster(token, hexToBin(TOKEN_CATEGORY), VALIDATOR_PROGRAM).address;
/** The participant the holder's balance node is placed under, whichever reach reads or writes it. */
const HOLDER_NODE = sharedNodeId(TOKEN_CATEGORY, 'balances', keyToSlotMulti([HOLDER]));

/** A coin a genesis or a hop is funded from; a genesis's txid becomes the category it mints. */
function funding(txid: string): { txid: string; vout: number; satoshis: bigint } {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

/** The deployment the cases share, and the chain as it stood when the deployment was done. */
interface World {
  readonly network: MockNetworkProvider;
  readonly deskProxyCategoryId: string;
  readonly deskImplementationCategoryId: string;
  readonly callCoin: { txid: string; vout: number; satoshis: bigint };
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
  readonly snapshot: SnapshotRestorer;
}

/** Deploys the token, then the root behind a generated proxy pointed at it. */
async function deployWorld(): Promise<World> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const walletFunder = wallet.unlock.spend(alicePub, signature);
  const holderFunder = signature.unlockP2PKH();

  // The holder's own coin funds the token's genesis, so the holder is its constructor's `msg.sender`.
  const tokenCoin = funding(TOKEN_CATEGORY);
  await network.addUtxo(aliceAddress, tokenCoin);
  await deployStatefulContract(token, [], {
    fundingUtxo: tokenCoin, funder: holderFunder, changeAddress: aliceAddress, provider: network, threadCount: 4,
  });
  for (const categoryId of [DESK_IMPL_CATEGORY, DESK_PROXY_CATEGORY]) {
    await network.addUtxo(wallet.address, funding(categoryId));
  }
  const initCoin = funding(idOf('desk initialize coin'));
  const callCoin = funding(idOf('call coin'));
  for (const coin of [initCoin, callCoin]) await network.addUtxo(binToHex(HOLDER), coin);
  await fundShippedFacets(network);

  const deskDeployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: desk,
    proxyArtifact: buildProxyArtifact(desk),
    implementationDeploy: { fundingUtxo: funding(DESK_IMPL_CATEGORY), funder: walletFunder, changeAddress: wallet.address },
    proxyDeploy: { fundingUtxo: funding(DESK_PROXY_CATEGORY), funder: walletFunder, changeAddress: wallet.address },
    initialize: { functionName: 'initialize', args: [TOKEN_ADDRESS] },
    callerLockingBytecode: HOLDER,
    callerFunding: { utxo: initCoin, funder: holderFunder, changeAddress: wallet.address },
    vm: compositionMachine(),
  });
  expect(deskDeployment.initialize.broadcast).toBeDefined();
  return {
    network,
    deskProxyCategoryId: deskDeployment.proxy.categoryId,
    deskImplementationCategoryId: deskDeployment.implementation.categoryId,
    callCoin,
    funder: holderFunder,
    snapshot: await network.takeSnapshot(),
  };
}

let worldRun: Promise<World> | undefined;

/** One deployment serves every case, each rewinding the chain to it first, so each starts from the same balances. */
async function deployed(): Promise<World> {
  worldRun ??= deployWorld();
  const world = await worldRun;
  await world.snapshot.restore();
  return world;
}

/** One call of the root's entry through its proxy, made by the holder, the token reached directly. */
function callDesk(
  world: World, functionName: string, args: readonly (bigint | Uint8Array)[],
): Promise<FramedProxyCallResult> {
  return callFramedProxyEntry({
    provider: world.network,
    implementationArtifact: desk,
    proxyArtifact: buildProxyArtifact(desk),
    proxyCategoryId: world.deskProxyCategoryId,
    implementationCategoryId: world.deskImplementationCategoryId,
    functionName,
    args: [...args],
    externals: { IToken: { artifact: token, categoryId: TOKEN_CATEGORY } },
    callerUtxo: world.callCoin,
    callerLockingBytecode: HOLDER,
    funder: world.funder,
    changeAddress: aliceAddress,
    vm: compositionMachine(),
  });
}

/** True while the caller's coin is unspent, i.e. nothing was broadcast for the hop. */
async function callCoinLive(world: World): Promise<boolean> {
  return (await world.network.getUtxosForLockingBytecode(HOLDER))
    .some((utxo) => utxo.txid === world.callCoin.txid && utxo.vout === world.callCoin.vout);
}

/** The balance the token's live node holds for `who`, read back from the chain after the hop. */
async function liveBalance(world: World, who: Uint8Array): Promise<string | undefined> {
  const deployment = await readFramedDeployment(world.network, TOKEN_CATEGORY, token.stateLayout!);
  const slot = bytesToHex(keyToSlotMulti([who]));
  const node = (deployment.nodesByCollection.get('balances') ?? [])
    .map((utxo) => decodeEntryCommitment(hexToBin(utxo.token!.nft!.commitment)))
    .find((decoded) => bytesToHex(decoded.slot) === slot);
  return node === undefined ? undefined : bytesToHex(node.value);
}

/** The value a balance node's commitment carries, as the token's own encoding writes an `int`. */
function balanceValue(amount: bigint): string {
  return bytesToHex(bigIntToVmNumber(amount));
}

/** Each declaration one frame makes of the holder's node, in segment order, as `viewIn -> viewOut` value pairs. */
function holderViews(result: FramedProxyCallResult, master: string): readonly (readonly [string, string])[] {
  const index = result.draft.layout.participants.find((placed) => placed.id === HOLDER_NODE)!.index;
  const value = (commitment: Uint8Array): string => bytesToHex(decodeEntryCommitment(commitment).value);
  return result.draft.blockOf(master).segments.flatMap((segment: readonly RecordEntry[]) => segment)
    .filter((entry) => entry.in === index)
    .map((entry) => [value(entry.viewIn), value(entry.viewOut)] as const);
}

/** The value the holder's node output carries in the settled transaction. */
function holderOutput(result: FramedProxyCallResult): string {
  const index = result.draft.layout.participants.find((placed) => placed.id === HOLDER_NODE)!.index;
  return bytesToHex(decodeEntryCommitment(Uint8Array.from(result.transaction.outputs[index]!.token!.nft!.commitment))
    .value);
}

/** The records one frame declares with no input index: the nodes it creates or continues at an output. */
function outputDeclarations(result: FramedProxyCallResult, master: string): readonly RecordEntry[] {
  return result.draft.blockOf(master).segments.flatMap((segment: readonly RecordEntry[]) => segment)
    .filter((entry) => entry.in === 0xffff);
}

/** Every participant placed for a node of the token's balances. */
function balanceNodes(result: FramedProxyCallResult): readonly string[] {
  return result.draft.layout.participants.map((placed) => placed.id)
    .filter((id) => id.startsWith(`mapping-node-${TOKEN_CATEGORY}-balances-`) || id.startsWith('mapping-read-'));
}

describe('reaches of one hop that touch one mapping node of a callee', () => {
  it('a balance read then a debit of it settle and broadcast, the node one input and the debit continuing from it',
    async () => {
      const world = await deployed();

      const result = await callDesk(world, 'readThenDebit', [100n, 1000n]);
      expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
      expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);

      // One participant for the node both reaches touch, declared kept by the read and rewritten by the debit.
      expect(balanceNodes(result)).toStrictEqual([HOLDER_NODE]);
      expect(holderViews(result, 'callee-master-1')).toStrictEqual([[balanceValue(1000n), balanceValue(1000n)]]);
      expect(holderViews(result, 'callee-master-2')).toStrictEqual([[balanceValue(1000n), balanceValue(900n)]]);
      expect(holderOutput(result)).toBe(balanceValue(900n));
      expect(await liveBalance(world, HOLDER)).toBe(balanceValue(900n));
    });

  it('a debit then a read settle, the read declaring and returning the view the debit left', async () => {
    const world = await deployed();

    const result = await callDesk(world, 'debitThenRead', [100n, 900n]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);

    expect(balanceNodes(result)).toStrictEqual([HOLDER_NODE]);
    expect(holderViews(result, 'callee-master-1')).toStrictEqual([[balanceValue(1000n), balanceValue(900n)]]);
    expect(holderViews(result, 'callee-master-2')).toStrictEqual([[balanceValue(900n), balanceValue(900n)]]);
    // The read's frame returned the debited balance, which is what the root's own check compared.
    expect(binToHex(result.draft.blockOf('callee-master-2').retval))
      .toBe(binToHex(encodeDataPush(bigIntToVmNumber(900n))));
    expect(holderOutput(result)).toBe(balanceValue(900n));
    expect(await liveBalance(world, HOLDER)).toBe(balanceValue(900n));
  });

  it('a debit then a read that expects the balance before the debit is refused by the root\'s own check',
    async () => {
      const world = await deployed();

      await expect(callDesk(world, 'debitThenRead', [100n, 1000n])).rejects.toThrow(/unexpected balance/);
      expect(await callCoinLive(world)).toBe(true);
      expect(await liveBalance(world, HOLDER)).toBe(balanceValue(1000n));
    });

  it('two debits of one balance settle, the second continuing from the view the first left', async () => {
    const world = await deployed();

    const result = await callDesk(world, 'debitTwice', [100n, 50n]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);

    expect(balanceNodes(result)).toStrictEqual([HOLDER_NODE]);
    expect(holderViews(result, 'callee-master-1')).toStrictEqual([[balanceValue(1000n), balanceValue(900n)]]);
    expect(holderViews(result, 'callee-master-2')).toStrictEqual([[balanceValue(900n), balanceValue(850n)]]);
    expect(holderOutput(result)).toBe(balanceValue(850n));
    expect(await liveBalance(world, HOLDER)).toBe(balanceValue(850n));
  });

  it('two grants of a key the token does not hold settle, the later rewriting the node the first created',
    async () => {
      const world = await deployed();

      const result = await callDesk(world, 'grantTwice', [NEWCOMER]);
      expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
      expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);

      // Only the first grant creates a node: the later grant continues it rather than minting a second one, so the
      // collection's one balances participant is the predecessor the first grant relinks.
      expect(result.draft.trailingOutputs).toHaveLength(1);
      expect(balanceNodes(result)).toHaveLength(1);
      const created = result.draft.trailingOutputs[0]!.index;

      // The creating frame declares the relinked predecessor and the node it created; the continuing frame declares
      // that same node alone, claiming no input for it.
      expect(result.draft.blockOf('callee-master-1').segments.flatMap((s) => s)).toHaveLength(2);
      expect(result.draft.blockOf('callee-master-2').segments.flatMap((s) => s)).toHaveLength(1);

      const value = (commitment: Uint8Array): string => bytesToHex(decodeEntryCommitment(commitment).value);
      const createdCommitment = Uint8Array.from(result.transaction.outputs[created]!.token!.nft!.commitment);
      expect(bytesToHex(decodeEntryCommitment(createdCommitment).slot)).toBe(bytesToHex(keyToSlotMulti([NEWCOMER])));

      const first = outputDeclarations(result, 'callee-master-1');
      expect(first).toHaveLength(1);
      expect(first[0]!.out).toBe(created);
      expect(first[0]!.viewIn.length).toBe(0);
      expect(value(first[0]!.viewOut)).toBe(balanceValue(1n));

      // The later frame's declaration names the creating reach's output and carries the view `1 -> 2`: a continued
      // rewrite of the created node, not a second insert through the bracketing predecessor.
      const later = outputDeclarations(result, 'callee-master-2');
      expect(later).toHaveLength(1);
      expect(later[0]!.out).toBe(created);
      expect([value(later[0]!.viewIn), value(later[0]!.viewOut)])
        .toStrictEqual([balanceValue(1n), balanceValue(2n)]);

      // The settled output and the live chain carry the later grant's value.
      expect(value(createdCommitment)).toBe(balanceValue(2n));
      expect(await liveBalance(world, NEWCOMER)).toBe(balanceValue(2n));
    });

  /**
   * The read-after-insert shape: one reach inserts a key, a later reach reads the node it created.
   *
   * The read resolves to the node the grant created rather than the bracketing predecessor it relinked, so
   * `requireSatisfiableReachWrites` does not refuse the pair, and the compiler's entry-category verification asks
   * whether a declared record has an input at all (`emitReadOnlyEntryExistsCheck`) rather than reading a category at
   * the no-index coordinate the created form declares. The read's own frame then holds the segment's created record:
   * both views have to be the value the creating frame left, or the frame's own settlement equality on the
   * declaration (`declaredRecordsKeptScript`) refuses it. The shared-node walk fills them from the view the grant's
   * write left, so the read settles and the node it created carries the inserted value.
   */
  it('a read after a grant inserted its key settles, the read declaring the node the grant created', async () => {
    const world = await deployed();

    const result = await callDesk(world, 'grantThenRead', [NEWCOMER]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);

    // Only the grant creates a node, and it is the one the read is planned against: the read frame declares that
    // node at the creating frame's output with both views the value the grant wrote.
    expect(result.draft.trailingOutputs).toHaveLength(1);
    const created = result.draft.trailingOutputs[0]!.index;

    const value = (commitment: Uint8Array): string => bytesToHex(decodeEntryCommitment(commitment).value);
    const createdCommitment = Uint8Array.from(result.transaction.outputs[created]!.token!.nft!.commitment);
    expect(bytesToHex(decodeEntryCommitment(createdCommitment).slot)).toBe(bytesToHex(keyToSlotMulti([NEWCOMER])));

    const read = outputDeclarations(result, 'callee-master-2');
    expect(read).toHaveLength(1);
    expect(read[0]!.out).toBe(created);
    expect([value(read[0]!.viewIn), value(read[0]!.viewOut)])
      .toStrictEqual([balanceValue(1n), balanceValue(1n)]);

    // The settled output and the live chain carry the grant's value, which the read returned.
    expect(value(createdCommitment)).toBe(balanceValue(1n));
    expect(await liveBalance(world, NEWCOMER)).toBe(balanceValue(1n));
  });
});
