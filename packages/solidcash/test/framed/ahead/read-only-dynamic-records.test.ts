import { describe, expect, it, vi } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { validatorAddress } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import * as composer from '../../../src/framed/composer/index.js';
import {
  FramedProxyDeployError, buildProxyArtifact, callFramedProxyEntry, deployFramedProxy,
  type FramedProxyCallResult,
} from '../../../src/framed/proxy/index.js';
import type { FramedProxyExternal } from '../../../src/framed/proxy/external-calls.js';
import type { Unlocker, Utxo } from '../../../src/interfaces.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub, bobPkh, bobPriv, carolPkh, carolPriv } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * A proxied root's entry that only reads a dynamic state value, through the shipped hop.
 *
 * `Board` keeps a struct array whose elements carry a string, so the array is a dynamic value: its record holds the
 * byte length and the bytes sit in a run of chunk records, which a framed body reads from its frame's own
 * declaration, past the records its block layout names. `initialize` appends one element, and three entries only
 * read it: `check` (the run alone), `checkAllowed` (the run behind a nested-mapping read, whose node the layout names
 * ahead of the run) and `checkBeside` (the run read on both sides of a `view` call to a plain `Pinger`). These are
 * the shapes of the fixture's thread message (title 47) and allowlist update (30), whose modifiers and first
 * requirements read the task array those entries never write.
 *
 * The hop declares every live chunk of a run the entry reads and does not write (`dynamicReads` minus
 * `dynamicWrites`; `proxy/entry-writes.ts`, `planHopReadRuns`), kept unchanged in every segment ahead of any written
 * run, and the root frame's read-only mapping nodes after its data records, as a callee frame's are planned
 * (`proxy/deploy.ts`, `calleeReadNodesOrNone`). So the owner's `check` and `checkBeside` and the allowed caller's
 * `checkAllowed` settle and broadcast, each placing `dynamic-chunk-items-0` (and `checkAllowed` its
 * `mapping-read-allowed-` node), and a stranger's `check` and `checkAllowed` are refused with their own "not owner"
 * and "not allowed". Before it, the hop laid a run only for an entry that writes it, and each entry here was refused
 * at its first read of the array. It declares no read-only run beside a mapping write, whose geometry is the
 * compiler's: a verified batch's body holds the records past its groups to the chunks it writes
 * (`countsDynamicChunkRecords` counts `dynamicWrites` only), and a run-time loop's nodes, one per turn, do not keep
 * the run one layout width past the frame's first declared record, where the body reads it. The file runs only
 * under `FRAMED_AHEAD=1`.
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
  'pragma solidcash ^0.14.0;',
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
  compiledRun ??= compileStringMulti(SOURCE, { composition: 'framed' });
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
  readonly externals: Readonly<Record<string, FramedProxyExternal>>;
  readonly changeAddress: string;
  /** Hands out a fresh coin id per hop, distinct from every category. */
  readonly nextCoin: () => Utxo;
}

/** What a hop left: its result, or its error with the last draft built and the stalls the settle caught. */
interface Outcome {
  readonly result?: FramedProxyCallResult;
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
  let result: FramedProxyCallResult | undefined;
  let error: Error | undefined;
  try {
    result = await callFramedProxyEntry({
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
function expectSettled(outcome: Outcome): FramedProxyCallResult {
  expect(outcome.error).toBeUndefined();
  expect(outcome.result!.verdicts.every((verdict) => verdict.accepted)).toBe(true);
  expect(outcome.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  expect(outcome.coinLive).toBe(false);
  return outcome.result!;
}

/** The hop was refused before anything was broadcast, by the board's own `reason` at its line in `entry`. */
function expectOwnRefusal(outcome: Outcome, entry: string, reason: string): void {
  expect(outcome.error).toBeInstanceOf(FramedProxyDeployError);
  expect(outcome.coinLive).toBe(true);
  expect(outcome.error!.message).toContain(`the implementation's "${entry}" entry did not settle through the proxy: `
    + `frame "implementation-master" of Board.${entry}() at line ${lineOf(`"${reason}"`, `function ${entry}(`)}: `
    + `${reason} (Program failed an OP_VERIFY operation.)`);
}

/** The ids of the participants a settled hop's draft placed that start with `prefix`. */
function placed(result: FramedProxyCallResult, prefix: string): readonly string[] {
  return result.draft.layout.participants.map((participant) => participant.id)
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
  const board = await deployFramedProxy({
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

describe.runIf(process.env.FRAMED_AHEAD === '1')('ahead: a proxied root entry that only reads a dynamic value', () => {
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

    it('the owner\'s check settles, the array\'s run declared kept', async () => {
      const outcome = await enter(world, 'check', [ITEM], OWNER);
      // The hop lays the run the entry only reads (`proxy/entry-writes.ts`, `planHopReadRuns` and `layReadRuns`).
      const settled = expectSettled(outcome);
      expect(placed(settled, 'dynamic-chunk-items-')).toStrictEqual(['dynamic-chunk-items-0']);
      expect(outcome.stalls).toStrictEqual([]);
    }, 300_000);

    it('a stranger\'s check is refused with its own "not owner"', async () => {
      expectOwnRefusal(await enter(world, 'check', [ITEM], STRANGER), 'check', 'not owner');
    }, 300_000);

    it('the allowed caller\'s check behind the mapping read settles, its node and the run declared kept', async () => {
      const outcome = await enter(world, 'checkAllowed', [ITEM], ALLOWED);
      // The root frame plans the node it only reads as a callee frame's are (`proxy/deploy.ts`, `readNodes`).
      const settled = expectSettled(outcome);
      expect(placed(settled, 'dynamic-chunk-items-')).toStrictEqual(['dynamic-chunk-items-0']);
      expect(placed(settled, 'mapping-read-allowed-')).toHaveLength(1);
    }, 300_000);

    it('a stranger\'s check behind the mapping read is refused with its own "not allowed"', async () => {
      expectOwnRefusal(await enter(world, 'checkAllowed', [ITEM], STRANGER), 'checkAllowed', 'not allowed');
    }, 300_000);

    it('the owner\'s check on both sides of a call settles, the run declared kept', async () => {
      const outcome = await enter(world, 'checkBeside', [ITEM], OWNER);
      // The pinger's frame settles first, and the entry reads the run on both sides of its call.
      const settled = expectSettled(outcome);
      expect(placed(settled, 'dynamic-chunk-items-')).toStrictEqual(['dynamic-chunk-items-0']);
      expect(outcome.stalls).toStrictEqual([]);
    }, 300_000);
  });
});
