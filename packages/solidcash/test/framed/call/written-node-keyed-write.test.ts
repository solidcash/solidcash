import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, utf8ToBin } from '@bitauth/libauth';
import { bytesEqual, bytesToHex, sha256 } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { Unlocker, Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { decodeEntryCommitment, encodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import type { CompositionDraft } from '../../../src/framed/composer/index.js';
import {
  buildProxyArtifact, callFramedProxyEntry, deployFramedProxy, type FramedProxyCallResult,
} from '../../../src/framed/proxy/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub, bobPkh, bobPriv, carolPkh } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A mapping write keyed by a value the body reads out of a node it then writes.
 *
 * A deed's transfer debits the holder its token record names, credits the recipient and moves the record
 * (`address holder = _ownerOf(id); ...; _balances[holder] -= 1; _balances[to] += 1; _owners[id] = to`), and
 * `safeTransferFrom` runs the same transfer. The artifact publishes the debit's key as the read
 * (`map:_owners(id:id)`) and declares the `_owners` batch ahead of the `_balances` one; the hop keys the debit by the
 * holder the deployment's record names, which is the value the body reads before its write, and the master derives
 * the debit's slot from the record's view as its group begins it. Two transfers settle through the generated proxy
 * and every balance and owner is read back through the views. A plan that debits another party than the record names
 * is refused by the entry's own frame.
 */

/** A 32-byte txid with varied bytes, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`written node keyed write ${label}`)));
}

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'contract Deed {',
  '  address public implementation;',
  '  uint256 public started;',
  '  mapping(uint256 => address) private _owners;',
  '  mapping(address => uint256) private _balances;',
  '  function initialize() public { started = 1; }',
  '  function balanceOf(address holder) external view returns (uint256) { return _balances[holder]; }',
  '  function ownerOf(uint256 id) external view returns (address) { return _owners[id]; }',
  '  function _ownerOf(uint256 id) internal view returns (address) { return _owners[id]; }',
  '  function mint(address to, uint256 id) external {',
  '    require(_ownerOf(id) == address(0), "minted");',
  '    _balances[to] += 1;',
  '    _owners[id] = to;',
  '  }',
  '  function transferFrom(address from, address to, uint256 id) public {',
  '    address holder = _ownerOf(id);',
  '    require(holder == from, "not the holder");',
  '    require(holder == msg.sender, "not allowed");',
  '    _balances[holder] -= 1;',
  '    _balances[to] += 1;',
  '    _owners[id] = to;',
  '  }',
  '  function safeTransferFrom(address from, address to, uint256 id) external {',
  '    transferFrom(from, to, id);',
  '  }',
  '}',
].join('\n');

const deed = compileStringMulti(SOURCE, { solidityImportCompat: true, composition: 'framed' } as never).Deed!;

interface Caller { readonly lock: Uint8Array; readonly funder: Unlocker }

const signer = (pkh: Uint8Array, priv: Uint8Array): Caller => ({
  lock: encodeLockingBytecodeP2pkh(pkh), funder: new SignatureTemplate(priv).unlockP2PKH(),
});
const ALICE = signer(alicePkh, alicePriv);
const BOB = signer(bobPkh, bobPriv);
/** A party no call is made from. */
const CAROL_LOCK = encodeLockingBytecodeP2pkh(carolPkh);

interface World {
  readonly network: MockNetworkProvider;
  readonly changeAddress: string;
  readonly proxy: string;
  readonly implementation: string;
}

let coins = 0;

/** A fresh coin at `lock`, which a genesis or a call is funded from. */
async function coinAt(network: MockNetworkProvider, lock: string, label: string): Promise<Utxo> {
  coins += 1;
  const coin = { txid: idOf(`${label} ${coins}`), vout: 0, satoshis: 5_000_000n };
  await network.addUtxo(lock, coin);
  return coin;
}

async function deployWorld(): Promise<World> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, new SignatureTemplate(alicePriv));
  await fundShippedFacets(network);
  const deployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: deed,
    proxyArtifact: buildProxyArtifact(deed),
    implementationDeploy: {
      fundingUtxo: await coinAt(network, wallet.address, 'implementation'), funder, changeAddress: wallet.address,
    },
    proxyDeploy: { fundingUtxo: await coinAt(network, wallet.address, 'proxy'), funder, changeAddress: wallet.address },
    initialize: { functionName: 'initialize', args: [] },
    callerLockingBytecode: ALICE.lock,
    callerFunding: {
      utxo: await coinAt(network, binToHex(ALICE.lock), 'initialize'), funder: ALICE.funder,
      changeAddress: wallet.address,
    },
    vm: compositionMachine(),
  });
  expect(deployment.initialize.broadcast).toBeDefined();
  return {
    network, changeAddress: wallet.address,
    proxy: deployment.proxy.categoryId, implementation: deployment.implementation.categoryId,
  };
}

/** One call through the proxy, from a fresh coin of the caller's; it has to settle. */
async function settle(
  world: World, functionName: string, args: readonly FunctionArgument[], caller: Caller,
): Promise<FramedProxyCallResult> {
  const result = await callFramedProxyEntry({
    provider: world.network,
    implementationArtifact: deed,
    proxyArtifact: buildProxyArtifact(deed),
    proxyCategoryId: world.proxy,
    implementationCategoryId: world.implementation,
    functionName,
    args: [...args],
    callerUtxo: await coinAt(world.network, binToHex(caller.lock), functionName),
    callerLockingBytecode: caller.lock,
    funder: caller.funder,
    changeAddress: world.changeAddress,
    vm: compositionMachine(),
  });
  expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
  expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  return result;
}

/** A view's value, read from the proxy's records through the read path. */
async function view(world: World, functionName: string, args: readonly FunctionArgument[]): Promise<unknown> {
  const read = await readFramedEntry({
    provider: world.network, artifact: deed, categoryId: world.proxy, functionName, args: [...args],
    vm: compositionMachine(),
  });
  expect(read.accepted, read.objection).toBe(true);
  return read.value;
}

/** Each party's balance, then the holder each token's record names, as the views read them. */
async function ledger(world: World, ids: readonly bigint[]): Promise<readonly unknown[]> {
  const read: unknown[] = [];
  for (const party of [ALICE.lock, BOB.lock, CAROL_LOCK]) read.push(await view(world, 'balanceOf', [party]));
  for (const id of ids) read.push(binToHex(await view(world, 'ownerOf', [id]) as Uint8Array));
  return read;
}

/** The participants that refuse the transaction a draft lays out for one master, by id. */
function refusingParticipants(draft: CompositionDraft, master: string): readonly string[] {
  const vm = compositionMachine();
  const { sourceOutputs, transaction } = draft.programFor(master);
  return draft.layout.participants.filter((placed) => vm.stateSuccess(vm.evaluate({
    inputIndex: placed.index, sourceOutputs, transaction,
  })) !== true).map((placed) => placed.id);
}

const partySlot = (party: Uint8Array): Uint8Array => keyToSlotMulti([party]);

describe('a mapping write keyed by a value read out of a node the body writes', () => {
  it('publishes the debit\'s key as the read and declares the record\'s batch ahead of the balances', () => {
    expect(deed.composition?.refusedEntries ?? []).toStrictEqual([]);
    for (const entry of ['transferFrom', 'safeTransferFrom']) {
      const fn = deed.abi.find((candidate) => candidate.name === entry)!;
      expect(fn.sortedBatchInfo?.map((batch) => batch.collection)).toStrictEqual(['_owners', '_balances']);
      expect(fn.entryAccesses?.map((access) => access.keySources?.[0]?.expressionLabel ?? access.keyParams[0]))
        .toContain('map:_owners(id:id)');
    }
  }, 300_000);

  it('mints, transfers and safe-transfers through the proxy, each balance and holder read back', async () => {
    const world = await deployWorld();
    await settle(world, 'mint', [ALICE.lock, 7n], ALICE);
    await settle(world, 'mint', [ALICE.lock, 8n], ALICE);
    const alice = binToHex(alicePkh);
    expect(await ledger(world, [7n, 8n])).toStrictEqual([2n, 0n, 0n, alice, alice]);

    // Alice moves token 7 to Bob: her node is debited, and Bob's is spliced in.
    const moved = await settle(world, 'transferFrom', [ALICE.lock, BOB.lock, 7n], ALICE);
    expect(await ledger(world, [7n, 8n])).toStrictEqual([1n, 1n, 0n, binToHex(bobPkh), alice]);

    // Bob moves it on to Carol: the record now names Bob, so his node is the one debited.
    await settle(world, 'safeTransferFrom', [BOB.lock, CAROL_LOCK, 7n], BOB);
    expect(await ledger(world, [7n, 8n])).toStrictEqual([1n, 0n, 1n, binToHex(carolPkh), alice]);

    // The first transfer's plan, its debit moved to Carol: the record names Alice, so the frame's own derivation
    // keys the debit by her and refuses the node it is handed.
    const draft = moved.draft;
    const entry = draft.runs.find((run) => run.functionName === `${deed.contractName}.transferFrom()`)!.master;
    expect(refusingParticipants(draft, entry)).toStrictEqual([]);
    const debited = draft.blockOf(entry).segments.flat().find((record) => record.viewIn.length >= 64
      && bytesEqual(decodeEntryCommitment(record.viewIn).slot, partySlot(ALICE.lock)))!;
    const moveTo = (bytes: Uint8Array): Uint8Array => {
      const held = decodeEntryCommitment(bytes);
      return encodeEntryCommitment(partySlot(CAROL_LOCK), held.nextKey, held.value);
    };
    debited.viewIn = moveTo(debited.viewIn);
    debited.viewOut = moveTo(debited.viewOut);
    expect(refusingParticipants(draft, entry)).toContain(entry);
  }, 600_000);
});
