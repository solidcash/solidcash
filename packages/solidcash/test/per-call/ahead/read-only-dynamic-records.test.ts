import { describe, expect, it, vi } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { validatorAddress } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import * as composer from '../../../src/per-call/composer/index.js';
import {
  PerCallProxyDeployError, buildProxyArtifact, callPerCallProxyEntry, deployPerCallProxy,
  type PerCallProxyCallResult,
} from '../../../src/per-call/proxy/index.js';
import type { PerCallProxyExternal } from '../../../src/per-call/proxy/external-calls.js';
import type { Unlocker, Utxo } from '../../../src/interfaces.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub, bobPkh, bobPriv, carolPkh, carolPriv } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * Walls ahead: a proxied root's entry that only reads a dynamic state value, through the shipped hop.
 *
 * `Board` keeps a struct array whose elements carry a string, so the array is a dynamic value: its record holds the
 * byte length and the bytes sit in a run of chunk records, which a per-call body reads from its frame's own
 * declaration, past the records its block layout names. `initialize` appends one element, and three entries only
 * read it: `check` (the run alone), `checkAllowed` (the run behind a nested-mapping read, whose node the layout names
 * ahead of the run) and `checkBeside` (the run read on both sides of a `view` call to a plain `Pinger`). These are
 * the shapes of the fixture's thread message (title 47) and allowlist update (30), whose modifiers and first
 * requirements read the task array those entries never write.
 *
 * Pinned where HEAD stands: each read is refused at its first read of the array, because the hop lays a dynamic
 * value's chunk records only for an entry that writes it (`proxy/entry-writes.ts`, `hopEntryWrites` plans runs from
 * `dynamicWrites` alone), and it declares no mapping node the root entry only reads (`proxy/deploy.ts`, only a callee
 * frame is given `readNodes`). No `dynamic-chunk-items-` or `mapping-read-` participant is placed.
 *
 * The patch `docs/per-call/patches/hop-read-only-dynamic-records.diff` declares both: every live chunk of a run the
 * entry reads and does not write (`dynamicReads` minus `dynamicWrites`), kept unchanged in every segment ahead of any
 * written run, and the root frame's read-only mapping nodes after its data records, as a callee frame's are planned.
 * With it, the owner's `check` and `checkBeside` and the allowed caller's `checkAllowed` settle and broadcast, each
 * placing `dynamic-chunk-items-0` (and `checkAllowed` its `mapping-read-allowed-` node), and a stranger's `check`
 * and `checkAllowed` are refused with their own "not owner" and "not allowed". It declares no read-only run beside a
 * mapping write, whose geometry is the compiler's: a verified batch's body holds the records past its groups to the
 * chunks it writes (`countsDynamicChunkRecords` counts `dynamicWrites` only), and a run-time loop's nodes, one per
 * turn, do not keep the run one layout width past the frame's first declared record, where the body reads it. The
 * file runs only under `PER_CALL_AHEAD=1`.
 */

/** A 32-byte value with varied bytes, `seed` chosen so each name is distinct. */
function category(seed: string): string {
  const base = '8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3';
  return `${seed}${base}${base}`.slice(0, 64);
}

const PINGER_CATEGORY = category('1a');
const BOARD_IMPL_CATEGORY = category('2b');
const BOARD_PROXY_CATEGORY = category('3c');

const ALICE_LOCK = encodeLockingBytecodeP2pkh(alicePkh);
const BOB_LOCK = encodeLockingBytecodeP2pkh(bobPkh);
const CAROL_LOCK = encodeLockingBytecodeP2pkh(carolPkh);
const TITLE = 'An element whose title keeps the array in a run of chunk records';
const ITEM = 0n;

const SOURCE = [
  'pragma solidcash ^0.13.0;',
  'struct Item { int state; address owner; string title; }',
  'interface IPinger { function level() view returns (int); }',
  'contract Pinger {',
  '  int public count;',
  '  function level() view returns (int) { return this.count; }',
  '}',
  'contract Board {',
  '  address public implementation;',
  '  address public pinger;',
  '  Item[] items;',
  '  mapping(int => mapping(address => bool)) allowed;',
  '  function initialize(address p, string title) {',
  '    this.pinger = p;',
  '    this.items.push(Item(0, msg.sender, title));',
  '  }',
  '  function allow(int id, address who) { this.allowed[id][who] = true; }',
  '  function check(int id) {',
  '    require(this.items[id].owner == msg.sender, "not owner");',
  '  }',
  '  function checkAllowed(int id) {',
  '    require(this.items[id].state == 0, "closed");',
  '    require(this.items[id].owner == msg.sender || this.allowed[id][msg.sender], "not allowed");',
  '  }',
  '  function checkBeside(int id) {',
  '    require(this.items[id].owner == msg.sender, "not owner");',
  '    require(IPinger(this.pinger).level() >= 0, "low");',
  '    require(this.items[id].state == 0, "closed");',
  '  }',
  '}',
].join('\n');

/** The 1-based line of the first source line containing `needle`, searching from the line containing `after`. */
function lineOf(needle: string, after = 'pragma'): number {
  const lines = SOURCE.split('\n');
  const start = lines.findIndex((line) => line.includes(after));
  return lines.findIndex((line, index) => index >= start && line.includes(needle)) + 1;
}

type ArtifactMap = ReturnType<typeof compileStringMulti>;
let compiledRun: ArtifactMap | undefined;
/** The contracts, compiled once and only when the file runs. */
function compiled(): ArtifactMap {
  compiledRun ??= compileStringMulti(SOURCE, { composition: 'per-call' });
  return compiledRun;
}

interface Caller { readonly lock: Uint8Array; readonly funder: Unlocker }

const OWNER: Caller = { lock: ALICE_LOCK, funder: new SignatureTemplate(alicePriv).unlockP2PKH() };
const ALLOWED: Caller = { lock: BOB_LOCK, funder: new SignatureTemplate(bobPriv).unlockP2PKH() };
const STRANGER: Caller = { lock: CAROL_LOCK, funder: new SignatureTemplate(carolPriv).unlockP2PKH() };

/** A coin a genesis is funded from; its txid becomes the category it mints. */
function funding(txid: string): Utxo {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

/** The deployment the hops run against, and the coins they are entered with. */
interface World {
  readonly network: MockNetworkProvider;
  readonly board: { readonly proxy: string; readonly implementation: string };
  readonly externals: Readonly<Record<string, PerCallProxyExternal>>;
  readonly changeAddress: string;
  /** Hands out a fresh coin id per hop, distinct from every category. */
  readonly nextCoin: () => Utxo;
}

/** What a hop left: its result, or its error with the last draft built and the stalls the settle caught. */
interface Outcome {
  readonly result?: PerCallProxyCallResult;
  readonly error?: Error;
  readonly draft?: composer.CompositionDraft;
  readonly stalls: readonly string[];
  /** Whether the caller's coin is still unspent, i.e. nothing was broadcast from it. */
  readonly coinLive: boolean;
}

/** Enters one of the board's entries through its proxy, and returns what it left. */
async function enter(
  world: World, functionName: string, args: readonly FunctionArgument[], caller: Caller,
): Promise<Outcome> {
  const board = compiled().Board!;
  const coin = world.nextCoin();
  await world.network.addUtxo(binToHex(caller.lock), coin);
  const hosts = vi.spyOn(composer, 'createComposedDerivationHost');
  const derivations = vi.spyOn(composer, 'deriveComposition');
  let result: PerCallProxyCallResult | undefined;
  let error: Error | undefined;
  try {
    result = await callPerCallProxyEntry({
      provider: world.network,
      implementationArtifact: board,
      proxyArtifact: buildProxyArtifact(board),
      proxyCategoryId: world.board.proxy,
      implementationCategoryId: world.board.implementation,
      functionName,
      args,
      externals: world.externals,
      callerUtxo: coin,
      callerLockingBytecode: caller.lock,
      funder: caller.funder,
      changeAddress: world.changeAddress,
      vm: compositionMachine(),
    });
  } catch (caught) {
    error = caught as Error;
  }
  const last = hosts.mock.results.at(-1);
  const stalls = derivations.mock.results.filter((entry) => entry.type === 'throw')
    .map((entry) => String((entry.value as Error).message));
  hosts.mockRestore();
  derivations.mockRestore();
  const live = await world.network.getUtxosForLockingBytecode(caller.lock);
  return {
    ...(result === undefined ? {} : { result }),
    ...(error === undefined ? {} : { error }),
    ...(last?.type === 'return' ? { draft: last.value.draft } : {}),
    stalls,
    coinLive: live.some((utxo) => utxo.txid === coin.txid && utxo.vout === coin.vout),
  };
}

/** The hop settled: every verdict accepted and the transaction broadcast. */
function expectSettled(outcome: Outcome): PerCallProxyCallResult {
  expect(outcome.error).toBeUndefined();
  expect(outcome.result!.verdicts.every((verdict) => verdict.accepted)).toBe(true);
  expect(outcome.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  expect(outcome.coinLive).toBe(false);
  return outcome.result!;
}

/**
 * The line a refusal of the board's entry names for a check of its own emitted code, which carries no source
 * message. It is the line the outlined code holding the check is attributed to, so the caller bounds it.
 */
function unnamedRefusalLine(outcome: Outcome, entry: string): number {
  expect(outcome.error).toBeInstanceOf(PerCallProxyDeployError);
  expect(outcome.coinLive).toBe(true);
  expect(outcome.error!.message).toContain(`the implementation's "${entry}" entry did not settle through the proxy: `
    + `frame "implementation-master" of Board.${entry}() at line `);
  const line = /at line (\d+): no source message \(Program failed an OP_VERIFY operation\.\)/
    .exec(outcome.error!.message);
  expect(line).not.toBeNull();
  return Number(line![1]);
}

/** The ids of the participants the refused hop's last draft placed that start with `prefix`. */
function placed(outcome: Outcome, prefix: string): readonly string[] {
  return outcome.draft!.layout.participants.map((participant) => participant.id)
    .filter((id) => id.startsWith(prefix));
}

/** Deploys the pinger plain and the board behind its generated proxy, then allows the second caller. */
async function deployWorld(): Promise<World> {
  const { Pinger, Board } = compiled();
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, signature);
  const changeAddress = wallet.address;
  let serial = 0x70;
  const nextCoin = (): Utxo => {
    serial += 1;
    return funding(category(serial.toString(16)));
  };
  for (const id of [PINGER_CATEGORY, BOARD_IMPL_CATEGORY, BOARD_PROXY_CATEGORY]) {
    await network.addUtxo(wallet.address, funding(id));
  }
  await deployStatefulContract(Pinger!, [], {
    fundingUtxo: funding(PINGER_CATEGORY), funder, changeAddress, provider: network,
  });
  await fundShippedFacets(network);
  const initCoin = nextCoin();
  await network.addUtxo(binToHex(ALICE_LOCK), initCoin);
  const board = await deployPerCallProxy({
    provider: network,
    implementationArtifact: Board!,
    proxyArtifact: buildProxyArtifact(Board!),
    implementationDeploy: { fundingUtxo: funding(BOARD_IMPL_CATEGORY), funder, changeAddress },
    proxyDeploy: { fundingUtxo: funding(BOARD_PROXY_CATEGORY), funder, changeAddress },
    initialize: {
      functionName: 'initialize',
      args: [validatorAddress(hexToBin(PINGER_CATEGORY), VALIDATOR_PROGRAM), TITLE],
    },
    callerLockingBytecode: ALICE_LOCK,
    callerFunding: { utxo: initCoin, funder: OWNER.funder, changeAddress },
    vm: compositionMachine(),
  });
  expect(board.initialize.broadcast).toBeDefined();
  const world: World = {
    network,
    board: { proxy: board.proxy.categoryId, implementation: board.implementation.categoryId },
    externals: { IPinger: { artifact: Pinger!, categoryId: PINGER_CATEGORY } },
    changeAddress,
    nextCoin,
  };
  expectSettled(await enter(world, 'allow', [ITEM, BOB_LOCK], OWNER));
  return world;
}

describe.runIf(process.env.PER_CALL_AHEAD === '1')('ahead: a proxied root entry that only reads a dynamic value', () => {
  it('publishes each entry\'s read of the array, and a mapping slot ahead of the run for the allowlist check', () => {
    const board = compiled().Board!;
    const row = (name: string): (typeof board.abi)[number] => board.abi.find((entry) => entry.name === name)!;
    for (const name of ['check', 'checkAllowed', 'checkBeside']) {
      expect(row(name).dynamicReads).toStrictEqual(['items']);
      expect(row(name).dynamicWrites ?? []).toStrictEqual([]);
    }
    expect(row('checkAllowed').blockLayout!.slots.map((slot) => slot.kind))
      .toStrictEqual(['master', 'dataNft', 'entry']);
    expect(row('checkAllowed').entryAccesses!.map((access) => [access.collection, access.operations]))
      .toStrictEqual([['allowed', ['read']]]);
  });

  describe('against one live element', () => {
    let world: World;
    it('setup: the board is deployed with one element and the allowance write settles', async () => {
      world = await deployWorld();
    }, 600_000);

    it('the owner\'s check stops at its first read of the array', async () => {
      const outcome = await enter(world, 'check', [ITEM], OWNER);
      // Owner: the SDK hop (`proxy/entry-writes.ts`, `hopEntryWrites`): the run is laid for a writer only.
      expect([lineOf('function check('), lineOf('"not owner"')]).toContain(unnamedRefusalLine(outcome, 'check'));
      expect(placed(outcome, 'dynamic-chunk-items-')).toStrictEqual([]);
      expect(outcome.stalls).toStrictEqual([]);
    }, 300_000);

    it('a stranger\'s check stops at the same read, before its own "not owner"', async () => {
      const outcome = await enter(world, 'check', [ITEM], STRANGER);
      expect([lineOf('function check('), lineOf('"not owner"')]).toContain(unnamedRefusalLine(outcome, 'check'));
      expect(placed(outcome, 'dynamic-chunk-items-')).toStrictEqual([]);
    }, 300_000);

    it('the allowed caller\'s check behind the mapping read stops at the same read', async () => {
      const outcome = await enter(world, 'checkAllowed', [ITEM], ALLOWED);
      // Owner: the SDK hop; the run sits past the entry slot, whose node the root frame does not declare either.
      expect([lineOf('function checkAllowed('), lineOf('"closed"')])
        .toContain(unnamedRefusalLine(outcome, 'checkAllowed'));
      expect(placed(outcome, 'dynamic-chunk-items-')).toStrictEqual([]);
      expect(placed(outcome, 'mapping-read-')).toStrictEqual([]);
    }, 300_000);

    it('the owner\'s check on both sides of a call stops at the same read', async () => {
      const outcome = await enter(world, 'checkBeside', [ITEM], OWNER);
      // Owner: the SDK hop, as the check alone. The pinger's frame settles first; the entry's never reaches its call.
      expect([lineOf('function checkBeside('), lineOf('"not owner"', 'function checkBeside(')])
        .toContain(unnamedRefusalLine(outcome, 'checkBeside'));
      expect(placed(outcome, 'dynamic-chunk-items-')).toStrictEqual([]);
      expect(outcome.stalls).toStrictEqual([
        'PER_CALL_DERIVATION_STALLED: master "implementation-master" of Board.checkBeside() filled no witness at site 0 '
        + '(call 0)',
      ]);
    }, 300_000);
  });
});
