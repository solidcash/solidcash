import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import { bytesToHex, parsePushdataCommitment, sha256, validatorAddress } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import {
  buildProxyArtifact, callFramedProxyEntry, deployFramedProxy, type FramedProxyCallResult,
} from '../../../src/framed/proxy/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import type { Utxo } from '../../../src/interfaces.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * A mapping node a frame accesses on both sides of the call that leads to frames of its contract reading and
 * rewriting it.
 *
 * `Ledger.advance` sets a row's `stage` and calls `Settler.settle`, which reads the stage back through the ledger's
 * getter, requires the one it was told to expect, and calls `Ledger.close` to set the row's `done`; `advance` then
 * returns the settler's amount plus that `done`. The row is lowered through a cache the body reads once and writes
 * back once; the cache ends at the call, so the settler reads the stage written before it and `advance` reads the row
 * after it as the close left it. A cache held across the call served that read from the frame's own copy, which still
 * held the `done` from before the close, and the hop settled the wrong sum. `restage` writes the stage on both sides
 * of the call; a frame settles its mapping writes in one segment, so the entry is refused by name. One cache held
 * across the call published it as a single write past the call, a frame whose code shows a callee the stage from
 * before the first write. The row's note makes its value one the hop plans from the write the source states, which a
 * re-entered read of a node requires.
 */

/** A 32-byte category or txid that is neither one repeated byte nor a palindrome, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`entry cache across call ${label}`)));
}

const LEDGER_CATEGORY = idOf('ledger');
const SETTLER_CATEGORY = idOf('settler');
const ROOT_IMPL_CATEGORY = idOf('root implementation');
const ROOT_PROXY_CATEGORY = idOf('root proxy');
const ROOT_INIT_TXID = idOf('root initialize coin');

const addressOf = (categoryId: string): Uint8Array => validatorAddress(hexToBin(categoryId), VALIDATOR_PROGRAM);
const LEDGER = `0x${binToHex(addressOf(LEDGER_CATEGORY))}`;
const SETTLER = `0x${binToHex(addressOf(SETTLER_CATEGORY))}`;
const ID = 1n;
const ALICE_LOCK = encodeLockingBytecodeP2pkh(alicePkh);

// The ledger reaches the settler through an interface-typed local, which leaves its body graph-free, so the
// message-bus lowering does not rewrite the field updates in place first and they reach the entry cache.
const SOURCE = [
  'pragma solidcash ^0.14.0;',
  'interface ISettler { function settle(address ledger, int id, int stage) returns (int); }',
  'interface ILedger {',
  '  function open(int id); function advance(int id) returns (int); function restage(int id) returns (int);',
  '  function stageOf(int id) returns (int); function doneOf(int id) returns (int); function close(int id);',
  '}',
  'contract Ledger {',
  '  struct Row { int stage; int done; string note; }',
  '  mapping(int => Row) rows;',
  '  function open(int id) { this.rows[id] = Row(0, 0, "n7"); require(true); }',
  '  function advance(int id) returns (int) {',
  '    this.rows[id].stage = 1;',
  `    ISettler settler = ISettler(${SETTLER});`,
  `    int got = settler.settle(${LEDGER}, id, 1);`,
  '    return got + this.rows[id].done;',
  '  }',
  '  function restage(int id) returns (int) {',
  '    this.rows[id].stage = 1;',
  `    ISettler settler = ISettler(${SETTLER});`,
  `    int got = settler.settle(${LEDGER}, id, 1);`,
  '    this.rows[id].stage = 2;',
  '    return got;',
  '  }',
  '  function stageOf(int id) returns (int) { return this.rows[id].stage; }',
  '  function doneOf(int id) returns (int) { return this.rows[id].done; }',
  '  function close(int id) { this.rows[id].done = 1; require(true); }',
  '}',
  'contract Settler {',
  '  int public amount;',
  '  constructor() { this.amount = 100; }',
  '  function settle(address ledger, int id, int stage) returns (int) {',
  '    require(ILedger(ledger).stageOf(id) == stage, "stage");',
  '    ILedger(ledger).close(id);',
  '    return this.amount;',
  '  }',
  '}',
  'contract Root {',
  '  address public implementation;',
  '  int public last;',
  '  function initialize() { require(true); }',
  `  function open() { ILedger(${LEDGER}).open(1); }`,
  `  function run() { this.last = ILedger(${LEDGER}).advance(1); }`,
  `  function runRestage() { this.last = ILedger(${LEDGER}).restage(1); }`,
  '}',
].join('\n');

// The machine the hops run on relaxes the consensus limits (`COMPOSITION_LIMITS`), and so does the compile.
const compiled = compileStringMulti(SOURCE, { composition: 'framed', maximumInputBytes: 10_000_000 });
const { Ledger, Settler, Root } = compiled as Required<typeof compiled>;

/** A coin a genesis or a hop is funded from; a genesis's txid becomes the category it mints. */
function funding(txid: string): Utxo {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

/** The deployment with the row opened, the chain as it stood then, and an entry of the root to call on it. */
interface World {
  readonly network: MockNetworkProvider;
  readonly snapshot: SnapshotRestorer;
  readonly enter: (functionName: string) => Promise<FramedProxyCallResult>;
}

/** The ledger and the settler plain, the root behind its proxy, and the row opened through the root. */
async function deployWorld(): Promise<World> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, new SignatureTemplate(alicePriv));
  const changeAddress = wallet.address;
  const callerFunder = new SignatureTemplate(alicePriv).unlockP2PKH();
  for (const [artifact, id] of [[Ledger, LEDGER_CATEGORY], [Settler, SETTLER_CATEGORY]] as const) {
    await network.addUtxo(wallet.address, funding(id));
    await deployStatefulContract(artifact!, [], {
      fundingUtxo: funding(id), funder, changeAddress, provider: network, threadCount: 4,
    });
  }
  for (const id of [ROOT_IMPL_CATEGORY, ROOT_PROXY_CATEGORY]) await network.addUtxo(wallet.address, funding(id));
  await network.addUtxo(binToHex(ALICE_LOCK), funding(ROOT_INIT_TXID));
  await fundShippedFacets(network);
  const root = await deployFramedProxy({
    provider: network,
    implementationArtifact: Root!,
    proxyArtifact: buildProxyArtifact(Root!),
    implementationDeploy: { fundingUtxo: funding(ROOT_IMPL_CATEGORY), funder, changeAddress },
    proxyDeploy: { fundingUtxo: funding(ROOT_PROXY_CATEGORY), funder, changeAddress },
    initialize: { functionName: 'initialize', args: [] },
    callerLockingBytecode: ALICE_LOCK,
    callerFunding: { utxo: funding(ROOT_INIT_TXID), funder: callerFunder, changeAddress },
    vm: compositionMachine(),
  });
  expect(root.initialize.broadcast).toBeDefined();
  let coins = 0;
  const call = async (functionName: string): Promise<FramedProxyCallResult> => {
    coins += 1;
    const coin = funding(idOf(`call coin ${coins}`));
    await network.addUtxo(binToHex(ALICE_LOCK), coin);
    return callFramedProxyEntry({
      provider: network,
      implementationArtifact: Root!,
      proxyArtifact: buildProxyArtifact(Root!),
      proxyCategoryId: root.proxy.categoryId,
      implementationCategoryId: root.implementation.categoryId,
      functionName,
      args: [],
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
  const opened = await call('open');
  expect(opened.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  return { network, snapshot: await network.takeSnapshot(), enter: call };
}

let worldRun: Promise<World> | undefined;

/** One deployment serves every case, each rewinding the chain to it first. */
async function deployed(): Promise<World> {
  worldRun ??= deployWorld();
  const world = await worldRun;
  await world.snapshot.restore();
  return world;
}

describe('a node a frame accesses on both sides of the call that leads to frames rewriting it', () => {
  it('shows the settler the stage written before the call, and the frame the close made inside it', async () => {
    const world = await deployed();
    const result = await world.enter('run');
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    // The row holds the frame's own write and the close made inside its call.
    const read = async (functionName: string): Promise<unknown> => (await readFramedEntry({
      provider: world.network, artifact: Ledger!, categoryId: LEDGER_CATEGORY, functionName, args: [ID],
      vm: compositionMachine(),
    })).value;
    expect([await read('stageOf'), await read('doneOf')]).toStrictEqual([1n, 1n]);
    // The frame's read after the call saw the close: the settler's amount plus the `done` it set.
    const layout = buildProxyArtifact(Root!).stateLayout!;
    const field = layout.variables.find((variable) => variable.name === 'last')!;
    expect(parsePushdataCommitment(binToHex(result.writtenCommitments[field.nftIndex]!), layout, field.nftIndex).last)
      .toBe(101n);
  }, 300_000);

  it('refuses by name an entry that writes the node on both sides of the call', async () => {
    expect(Ledger!.composition?.refusedEntries?.find((refusal) => refusal.functionName === 'Ledger.restage()')?.reason)
      .toContain('a verified-mapping write is derived from the segment its own code runs in');
    const world = await deployed();
    await expect(world.enter('runRestage')).rejects.toThrow('Ledger.restage()');
  }, 300_000);
});
