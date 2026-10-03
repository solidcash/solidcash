import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { parsePushdataCommitment, validatorAddress } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import {
  buildProxyArtifact, callPerCallProxyEntry, deployPerCallProxy, type PerCallProxyCallResult,
} from '../../../src/per-call/proxy/index.js';
import { readPerCallEntry } from '../../../src/per-call/read/index.js';
import type { Utxo } from '../../../src/interfaces.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * A mapping node a frame rewrites before the call that leads to frames of its contract reading it back and rewriting
 * it again.
 *
 * `Ledger.advance` sets an entry's `stage` and calls `Settler.settle`, which reads the entry back through the ledger's
 * getter, requires that stage, and calls `Ledger.close`, which sets the entry's `done`: a re-entered read and a
 * re-entered rewrite of the node the outer frame wrote. The chain walk meets the frames in the order they run, so
 * the read keeps the view `advance` left and the rewrite continues from it; a value past the node's inline limit is
 * witnessed and kept from the bytes `advance` wrote. `advanceComputed` writes the entry's marks from a local it
 * rebuilds through a helper, so the compiler publishes no value for the write: the hop derives the writer up to its
 * call, reads the long value its own chunk pin stopped on, and plans again from it. A computed value the node keeps
 * inline passes no pin, so nothing exposes it before the frames inside are judged, and the read is refused by name.
 */

/** A 32-byte value with varied bytes, `seed` chosen so each name is distinct. */
function category(seed: string): string {
  const base = '7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2';
  return `${seed}${base}${base}`.slice(0, 64);
}

const LEDGER_CATEGORY = category('0e');
const SETTLER_CATEGORY = category('1f');
const ROOT_IMPL_CATEGORY = category('20');
const ROOT_PROXY_CATEGORY = category('31');
const ROOT_INIT_TXID = category('42');

const ID = 7n;
/** A note that keeps the entry within its node's inline limit, and one that takes it past it. */
const SHORT_NOTE = 'n7';
const LONG_NOTE = 'an entry note long enough that the entry value takes continuation chunks';
const ALICE_LOCK = encodeLockingBytecodeP2pkh(alicePkh);

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'struct Entry { address owner; uint16 stage; uint16 done; int16[2] marks; uint256 amount; string note; }',
  'function lift(int16 x) pure returns (int16) { return x >= 0 ? x : -x; }',
  'interface ISettler { function settle(uint256 id) external returns (uint256); }',
  'interface ILedger {',
  '  function open(uint256 id, string calldata note) external;',
  '  function advance(uint256 id) external;',
  '  function advanceComputed(uint256 id) external;',
  '  function entry(uint256 id) external view returns (Entry memory);',
  '  function close(uint256 id) external;',
  '}',
  'contract Ledger {',
  '  address public settler;',
  '  mapping(uint256 => Entry) entries;',
  '  constructor(address settler_) { settler = settler_; }',
  '  function open(uint256 id, string calldata note) external {',
  '    entries[id] = Entry(msg.sender, 0, 0, [int16(0), int16(0)], 100, note);',
  '  }',
  '  function advance(uint256 id) external {',
  '    require(entries[id].done == 0, "done");',
  '    entries[id].stage = 1;',
  '    uint256 got = ISettler(settler).settle(id);',
  '    require(got == 100, "got");',
  '  }',
  '  function advanceComputed(uint256 id) external {',
  '    Entry memory e = entries[id];',
  '    require(e.done == 0, "done");',
  '    e.marks[0] = lift(e.marks[0]) + 1;',
  '    e.marks[1] = lift(e.marks[1]);',
  '    entries[id].marks = e.marks;',
  '    uint256 got = ISettler(settler).settle(id);',
  '    require(got == 100, "got");',
  '  }',
  '  function entry(uint256 id) external view returns (Entry memory) { return entries[id]; }',
  '  function close(uint256 id) external { require(msg.sender == settler, "not settler"); entries[id].done = 1; }',
  '}',
  'contract Settler {',
  '  address public ledger;',
  '  constructor(address ledger_) { ledger = ledger_; }',
  '  function settle(uint256 id) external returns (uint256) {',
  '    Entry memory e = ILedger(ledger).entry(id);',
  '    require(e.stage == 1 || e.marks[0] == 1, "stage");',
  '    ILedger(ledger).close(id);',
  '    return e.amount;',
  '  }',
  '}',
  'contract Root {',
  '  address public implementation;',
  '  address public ledger;',
  '  uint256 public done;',
  '  function initialize(address ledger_) public { ledger = ledger_; }',
  '  function open(uint256 id, string calldata note) public { ILedger(ledger).open(id, note); }',
  '  function run(uint256 id) public { ILedger(ledger).advance(id); done = 1; }',
  '  function runComputed(uint256 id) public { ILedger(ledger).advanceComputed(id); done = 1; }',
  '}',
].join('\n');

/** Solidity-import compile options, under which a call result crosses the boundary as a Solidity ABI tuple. */
const FIXTURE_OPTIONS = {
  solidityImportCompat: true,
  commitmentLimit: 128,
  maximumInputBytes: 10_000_000,
  messageBus: true,
  optimizeForCompilationSpeed: true,
  suppressWarnings: true,
  ecrecover: 'p2pkh',
  sortedMappingsAll: false,
  composition: 'per-call',
} as const;

const compiled = compileStringMulti(SOURCE, FIXTURE_OPTIONS as never);
const { Ledger, Settler, Root } = compiled as Required<typeof compiled>;

/** A per-call contract's address, which its category fixes before anything is deployed. */
const addressOf = (id: string): Uint8Array => validatorAddress(hexToBin(id), VALIDATOR_PROGRAM);

/** A coin a genesis or a hop is funded from; a genesis's txid becomes the category it mints. */
function funding(txid: string): Utxo {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

/** The deployment with one entry opened, the chain as it stood then, and an entry of the root to call on it. */
interface World {
  readonly network: MockNetworkProvider;
  readonly snapshot: SnapshotRestorer;
  readonly enter: (functionName: string) => Promise<PerCallProxyCallResult>;
}

/** The ledger and the settler plain, the root behind its proxy, and the entry opened through the root with `note`. */
async function deployWorld(note: string): Promise<World> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, new SignatureTemplate(alicePriv));
  const changeAddress = wallet.address;
  const callerFunder = new SignatureTemplate(alicePriv).unlockP2PKH();
  const plain = [
    [Ledger, LEDGER_CATEGORY, [addressOf(SETTLER_CATEGORY)]],
    [Settler, SETTLER_CATEGORY, [addressOf(LEDGER_CATEGORY)]],
  ] as const;
  for (const [artifact, id, args] of plain) {
    await network.addUtxo(wallet.address, funding(id));
    await deployStatefulContract(artifact!, [...args], {
      fundingUtxo: funding(id), funder, changeAddress, provider: network, threadCount: 4,
    });
  }
  for (const id of [ROOT_IMPL_CATEGORY, ROOT_PROXY_CATEGORY]) await network.addUtxo(wallet.address, funding(id));
  await network.addUtxo(binToHex(ALICE_LOCK), funding(ROOT_INIT_TXID));
  await fundShippedFacets(network);
  const root = await deployPerCallProxy({
    provider: network,
    implementationArtifact: Root!,
    proxyArtifact: buildProxyArtifact(Root!),
    implementationDeploy: { fundingUtxo: funding(ROOT_IMPL_CATEGORY), funder, changeAddress },
    proxyDeploy: { fundingUtxo: funding(ROOT_PROXY_CATEGORY), funder, changeAddress },
    initialize: { functionName: 'initialize', args: [addressOf(LEDGER_CATEGORY)] },
    callerLockingBytecode: ALICE_LOCK,
    callerFunding: { utxo: funding(ROOT_INIT_TXID), funder: callerFunder, changeAddress },
    vm: compositionMachine(),
  });
  expect(root.initialize.broadcast).toBeDefined();
  let coins = 0x50;
  const call = async (functionName: string, args: readonly (bigint | string)[]): Promise<PerCallProxyCallResult> => {
    coins += 1;
    const coin = funding(category(coins.toString(16)));
    await network.addUtxo(binToHex(ALICE_LOCK), coin);
    return callPerCallProxyEntry({
      provider: network,
      implementationArtifact: Root!,
      proxyArtifact: buildProxyArtifact(Root!),
      proxyCategoryId: root.proxy.categoryId,
      implementationCategoryId: root.implementation.categoryId,
      functionName,
      args,
      externals: {
        ILedger: { artifact: Ledger!, categoryId: LEDGER_CATEGORY },
        ISettler: { artifact: Settler!, categoryId: SETTLER_CATEGORY },
      },
      callerUtxo: coin,
      callerLockingBytecode: ALICE_LOCK,
      funder: callerFunder,
      changeAddress,
      vm: compositionMachine(),
    });
  };
  const opened = await call('open', [ID, note]);
  expect(opened.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  return { network, snapshot: await network.takeSnapshot(), enter: (functionName) => call(functionName, [ID]) };
}

const worlds = new Map<string, Promise<World>>();
/** One deployment per note serves its cases, each rewinding the chain to it first. */
async function world(note: string): Promise<World> {
  if (!worlds.has(note)) worlds.set(note, deployWorld(note));
  const shared = await worlds.get(note)!;
  await shared.snapshot.restore();
  return shared;
}

/**
 * The hop settled and broadcast, the entry holds both writes (`stage` and `marks` as the outer write left them, `done`
 * as the inner rewrite set it) and its note, and the root kept its own write.
 */
async function expectBothWrites(
  shared: World, result: PerCallProxyCallResult, note: string, stage: bigint, marks: readonly bigint[],
): Promise<void> {
  expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
  expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  const read = await readPerCallEntry({
    provider: shared.network, artifact: Ledger!, categoryId: LEDGER_CATEGORY, functionName: 'entry', args: [ID],
    vm: compositionMachine(),
  });
  const fields = read.value as { stage: bigint; done: bigint; marks: bigint[]; amount: bigint; note: string };
  expect([fields.stage, fields.done, [...fields.marks], fields.amount, fields.note])
    .toStrictEqual([stage, 1n, [...marks], 100n, note]);
  const layout = buildProxyArtifact(Root!).stateLayout!;
  const field = layout.variables.find((variable) => variable.name === 'done')!;
  expect(parsePushdataCommitment(binToHex(result.writtenCommitments[field.nftIndex]!), layout, field.nftIndex).done)
    .toBe(1n);
}

describe('a node a frame rewrites before the call that leads to frames reading and rewriting it again', () => {
  for (const [label, note] of [['within the inline limit', SHORT_NOTE], ['taking chunks', LONG_NOTE]] as const) {
    it(`chains the read and the rewrite after the enclosing write the plan states, ${label}`, async () => {
      const shared = await world(note);
      await expectBothWrites(shared, await shared.enter('run'), note, 1n, [0n, 0n]);
    }, 300_000);
  }

  it('learns a long value the enclosing writer computes from its own pin, and plans again from it', async () => {
    const shared = await world(LONG_NOTE);
    await expectBothWrites(shared, await shared.enter('runComputed'), LONG_NOTE, 0n, [1n, 0n]);
  }, 300_000);

  it('refuses by name a read inside a computed value the node keeps inline, which no pin exposes', async () => {
    const shared = await world(SHORT_NOTE);
    await expect(shared.enter('runComputed')).rejects.toThrow(
      'the hop\'s reach "Ledger.entry()" reads a node of collection "entries" that "Ledger.advanceComputed()", a '
      + 'frame it runs inside, writes before the call that leads to it, and that write\'s value is the body\'s to '
      + 'compute: the read is judged before the writer settles, so it would read the plan\'s placeholder');
  }, 300_000);
});
