import { describe, expect, it } from 'vitest';
import { binToHex, encodeDataPush, encodeLockingBytecodeP2pkh, utf8ToBin } from '@bitauth/libauth';
import {
  bytesToHex, concatBytes, encodeWitnessBlock, sha256, splitFirstPush, type Artifact, type WitnessBlock,
} from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callPerCallEntry, type PerCallCallResult } from '../../../src/per-call/call/index.js';
import {
  buildProxyArtifact, callPerCallProxyEntry, deployPerCallProxy, type PerCallProxyCallResult,
} from '../../../src/per-call/proxy/index.js';
import { readPerCallEntry } from '../../../src/per-call/read/index.js';
import { decodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A verified-mapping write a branch guards, which the body skips whenever the branch is not taken.
 *
 * The compiler publishes the condition each such write runs under (`entryAccesses[].activation`) in the language a
 * conditional call site's condition is published in, and the frame lets the body skip the write: a skipped write keeps
 * its node, or the predecessor that proves an absent key absent. The builder decides the condition from the frame's
 * facts and declares the write only where it runs. Each guard is entered taken and skipped, behind a generated proxy
 * and as a plain deployment, and the values are read back:
 *
 * - `join` guards the write on the node it writes (`if (!members[who])`): a second join skips;
 * - `leave` guards it on the same node the other way, so leaving a key the list does not hold skips with no node;
 * - `credit` guards it on another mapping's value;
 * - `top` guards it on an argument, where the body caches the read-modify-write and flushes it on a dirty flag;
 * - `bump` guards it on a field the body writes first, which no frame fact decides: the write is planned where the
 *   key's node exists, its end view learned from the frame's own stop, and refused by name where it does not.
 *
 * A skipped write of an absent key leaves the deployment holding no node for it, and a spend that restates a
 * skipped write as one that ran is refused by the master.
 */

const body = (constructor: boolean): string => [
  'pragma solidity ^0.8.20;',
  'contract Registry {',
  ...(constructor ? [] : ['  address public implementation;']),
  '  address public owner;',
  '  uint256 public joined;',
  '  uint256 public credited;',
  '  uint256 public bumps;',
  '  mapping(address => bool) private members;',
  '  mapping(address => bool) private allowed;',
  '  mapping(address => uint256) private balances;',
  constructor
    ? '  constructor(address admin) { owner = admin; }'
    : '  function initialize(address admin) public { owner = admin; }',
  '  function isMember(address who) public view returns (bool) { return members[who]; }',
  '  function balanceOf(address who) public view returns (uint256) { return balances[who]; }',
  '  function join(address who) external {',
  '    if (!members[who]) { members[who] = true; joined += 1; }',
  '  }',
  '  function leave(address who) external {',
  '    require(msg.sender == owner, "owner only");',
  '    if (members[who]) { members[who] = false; joined -= 1; }',
  '  }',
  '  function allow(address who) external { require(msg.sender == owner, "owner only"); allowed[who] = true; }',
  '  function credit(address who, uint256 amount) external {',
  '    if (allowed[who]) { balances[who] = amount; credited += 1; }',
  '  }',
  '  function top(address who, uint256 amount, bool add) external {',
  '    if (add) { balances[who] = balances[who] + amount; credited += 1; }',
  '  }',
  '  function bump(address who, uint256 amount) external {',
  '    bumps += 1;',
  '    if (bumps > 2) { balances[who] = amount; credited += 1; }',
  '  }',
  '}',
].join('\n');

const OPTIONS = { solidityImportCompat: true, composition: 'per-call' } as never;
const proxied = compileStringMulti(body(false), OPTIONS).Registry!;
const plain = compileStringMulti(body(true), OPTIONS).Registry!;

const ADMIN = encodeLockingBytecodeP2pkh(alicePkh);
const ADMIN_FUNDER = new SignatureTemplate(alicePriv).unlockP2PKH();
const account = (fill: number): Uint8Array => encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(fill));
const A = account(0x31);
const B = account(0x32);
const C = account(0x33);
const D = account(0x34);

/** A 32-byte category or txid with varied bytes, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`guarded mapping write ${label}`)));
}

/** One deployment, entered through its proxy or as a plain contract, and the chain as it stood once deployed. */
interface World {
  readonly network: MockNetworkProvider;
  readonly artifact: Artifact;
  /** The category its records and nodes sit at: the proxy's, or the plain contract's own. */
  readonly records: string;
  /** The master whose frame declares the entry's records. */
  readonly frame: string;
  readonly enter: (functionName: string, args: readonly FunctionArgument[]) => Promise<Entered>;
  readonly snapshot: SnapshotRestorer;
}

type Entered = PerCallProxyCallResult | PerCallCallResult;

let coins = 0;

async function coinAt(network: MockNetworkProvider, lock: string, label: string): Promise<Utxo> {
  coins += 1;
  const coin = { txid: idOf(`${label} ${coins}`), vout: 0, satoshis: 5_000_000n };
  await network.addUtxo(lock, coin);
  return coin;
}

async function deployWorld(behindProxy: boolean): Promise<World> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, new SignatureTemplate(alicePriv));
  const changeAddress = wallet.address;
  await fundShippedFacets(network);
  if (behindProxy) {
    const deployment = await deployPerCallProxy({
      provider: network,
      implementationArtifact: proxied,
      proxyArtifact: buildProxyArtifact(proxied),
      implementationDeploy: { fundingUtxo: await coinAt(network, wallet.address, 'implementation'), funder, changeAddress },
      proxyDeploy: { fundingUtxo: await coinAt(network, wallet.address, 'proxy'), funder, changeAddress },
      initialize: { functionName: 'initialize', args: [ADMIN] },
      callerLockingBytecode: ADMIN,
      callerFunding: {
        utxo: await coinAt(network, binToHex(ADMIN), 'initialize'), funder: ADMIN_FUNDER, changeAddress,
      },
      vm: compositionMachine(),
    });
    expect(deployment.initialize.broadcast).toBeDefined();
    const enter = async (functionName: string, args: readonly FunctionArgument[]): Promise<Entered> =>
      callPerCallProxyEntry({
        provider: network,
        implementationArtifact: proxied,
        proxyArtifact: buildProxyArtifact(proxied),
        proxyCategoryId: deployment.proxy.categoryId,
        implementationCategoryId: deployment.implementation.categoryId,
        functionName,
        args: [...args],
        callerUtxo: await coinAt(network, binToHex(ADMIN), functionName),
        callerLockingBytecode: ADMIN,
        funder: ADMIN_FUNDER,
        changeAddress,
        vm: compositionMachine(),
      });
    return {
      network, artifact: proxied, records: deployment.proxy.categoryId, frame: 'implementation-master', enter,
      snapshot: await network.takeSnapshot(),
    };
  }
  const deployment = await deployStatefulContract(plain, [ADMIN], {
    provider: network, fundingUtxo: await coinAt(network, wallet.address, 'genesis'), funder, changeAddress,
  });
  const enter = async (functionName: string, args: readonly FunctionArgument[]): Promise<Entered> =>
    callPerCallEntry({
      provider: network,
      artifact: plain,
      categoryId: deployment.categoryId,
      functionName,
      args: [...args],
      callerUtxo: await coinAt(network, binToHex(ADMIN), functionName),
      callerLockingBytecode: ADMIN,
      funder: ADMIN_FUNDER,
      vm: compositionMachine(),
    });
  return {
    network, artifact: plain, records: deployment.categoryId, frame: 'master', enter,
    snapshot: await network.takeSnapshot(),
  };
}

const worlds = new Map<boolean, Promise<World>>();
/** One deployment per path serves its cases, each rewinding the chain to it first. */
async function world(behindProxy: boolean): Promise<World> {
  if (!worlds.has(behindProxy)) worlds.set(behindProxy, deployWorld(behindProxy));
  const shared = await worlds.get(behindProxy)!;
  await shared.snapshot.restore();
  return shared;
}

/** Enters a call and requires it to settle: every participant accepted and the transaction broadcast. */
async function settle(shared: World, functionName: string, args: readonly FunctionArgument[]): Promise<Entered> {
  const result = await shared.enter(functionName, args);
  expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
  expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  return result;
}

/** A view's value, read from the deployment's records through the read path. */
async function view(shared: World, functionName: string, args: readonly FunctionArgument[] = []): Promise<unknown> {
  const read = await readPerCallEntry({
    provider: shared.network, artifact: shared.artifact, categoryId: shared.records, functionName, args,
  });
  expect(read.accepted).toBe(true);
  return read.value;
}

/** How many UTXOs the deployment's category holds: a call that creates no node leaves the count as it found it. */
async function heldCount(shared: World): Promise<number> {
  return (await shared.network.getUtxosByTokenCategory(shared.records)).length;
}

/** The slot of `who`'s node: a flat mapping's slot is the key's own. */
const slotOf = (who: Uint8Array): string => bytesToHex(keyToSlotMulti([who]));

/**
 * The master's verdict on a settled call that kept `who`'s node, and on the same call restated with the node
 * rewritten: the restatement changes the node's declared end view in the frame's block and its output alike, so
 * only the master's own rule for a write that did not run tells it from the call that settled.
 */
function expectRestatedSkipRefused(shared: World, result: Entered, who: Uint8Array): void {
  const index = result.transaction.outputs.findIndex((output) => {
    const commitment = output.token?.nft?.commitment;
    return commitment !== undefined && commitment.length >= 64
      && bytesToHex(decodeEntryCommitment(commitment).slot) === slotOf(who);
  });
  expect(index).toBeGreaterThanOrEqual(0);
  const kept = result.transaction.outputs[index]!.token!.nft!.commitment;
  const { slot, nextKey, value } = decodeEntryCommitment(kept);
  const restated = concatBytes([slot, nextKey, value.length === 0 ? Uint8Array.of(1) : new Uint8Array(0)]);
  const frame = result.verdicts.find((verdict) => verdict.id === shared.frame)!;
  expect(frame.accepted).toBe(true);
  const block = structuredClone(result.draft.blockOf(shared.frame)) as WitnessBlock;
  const declared = block.segments.flat().filter((record) => record.out === index);
  expect(declared.length).toBeGreaterThan(0);
  for (const record of declared) record.viewOut = restated;
  const { rest } = splitFirstPush(result.transaction.inputs[frame.index]!.unlockingBytecode);
  const mutated = {
    ...result.transaction,
    inputs: result.transaction.inputs.map((input, at) => (at === frame.index
      ? { ...input, unlockingBytecode: concatBytes([encodeDataPush(encodeWitnessBlock(block)), rest]) }
      : input)),
    outputs: result.transaction.outputs.map((output, at) => (at === index
      ? { ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment: restated } } }
      : output)),
  };
  const vm = compositionMachine();
  const verdict = (transaction: Entered['transaction']): unknown => vm.stateSuccess(
    vm.evaluate({ inputIndex: frame.index, sourceOutputs: result.sourceOutputs, transaction }),
  );
  expect(verdict(result.transaction)).toBe(true);
  expect(verdict(mutated)).not.toBe(true);
}

describe('a verified-mapping write a branch guards, entered taken and skipped', () => {
  it('publishes the condition each guarded write runs under', () => {
    const activation = (entry: string, collection: string): unknown => proxied.abi
      .find((candidate) => candidate.name === entry)?.entryAccesses
      ?.find((access) => access.collection === collection && access.operations.includes('write'))?.activation;
    const who = { kind: 'source', source: { kind: 'forward', paramIndex: 0 } };
    expect(activation('join', 'members')).toStrictEqual({
      kind: 'unary', operator: '!', expression: { kind: 'stateAccess', name: 'members', args: [who], type: 'bool' },
    });
    expect(activation('leave', 'members'))
      .toStrictEqual({ kind: 'stateAccess', name: 'members', args: [who], type: 'bool' });
    expect(activation('credit', 'balances'))
      .toStrictEqual({ kind: 'stateAccess', name: 'allowed', args: [who], type: 'bool' });
    // The body caches the read-modify-write and flushes it on a flag the taken arm sets, which is the argument.
    expect(activation('top', 'balances')).toStrictEqual({ kind: 'source', source: { kind: 'forward', paramIndex: 2 } });
    // The guard reads a field the body writes before the branch, which no fact the frame starts with decides.
    expect(activation('bump', 'balances')).toStrictEqual({ kind: 'unsupported' });
    expect(activation('allow', 'allowed')).toBeUndefined();
  });

  for (const behindProxy of [true, false]) {
    const path = behindProxy ? 'behind a generated proxy' : 'as a plain deployment';

    it(`skips a second join, whose guard reads the node it writes, ${path}`, async () => {
      const shared = await world(behindProxy);
      await settle(shared, 'join', [A]);
      expect([await view(shared, 'isMember', [A]), await view(shared, 'joined')]).toStrictEqual([true, 1n]);
      const held = await heldCount(shared);
      const skipped = await settle(shared, 'join', [A]);
      expect([await view(shared, 'isMember', [A]), await view(shared, 'joined')]).toStrictEqual([true, 1n]);
      expect(await heldCount(shared)).toBe(held);
      expectRestatedSkipRefused(shared, skipped, A);
    }, 600_000);

    it(`skips a leave of a key the list does not hold, creating no node, ${path}`, async () => {
      const shared = await world(behindProxy);
      await settle(shared, 'join', [A]);
      const held = await heldCount(shared);
      await settle(shared, 'leave', [B]);
      expect(await heldCount(shared)).toBe(held);
      expect([await view(shared, 'isMember', [B]), await view(shared, 'joined')]).toStrictEqual([false, 1n]);
      // Taken, then skipped on the node the taken leave left.
      await settle(shared, 'leave', [A]);
      expect([await view(shared, 'isMember', [A]), await view(shared, 'joined')]).toStrictEqual([false, 0n]);
      await settle(shared, 'leave', [A]);
      expect([await view(shared, 'isMember', [A]), await view(shared, 'joined')]).toStrictEqual([false, 0n]);
    }, 600_000);

    it(`decides a guard that reads another mapping, ${path}`, async () => {
      const shared = await world(behindProxy);
      const held = await heldCount(shared);
      await settle(shared, 'credit', [C, 5n]);
      expect(await heldCount(shared)).toBe(held);
      expect([await view(shared, 'balanceOf', [C]), await view(shared, 'credited')]).toStrictEqual([0n, 0n]);
      await settle(shared, 'allow', [C]);
      await settle(shared, 'credit', [C, 7n]);
      expect([await view(shared, 'balanceOf', [C]), await view(shared, 'credited')]).toStrictEqual([7n, 1n]);
    }, 600_000);

    it(`decides a guard on an argument over a cached read-modify-write, ${path}`, async () => {
      const shared = await world(behindProxy);
      const held = await heldCount(shared);
      await settle(shared, 'top', [D, 3n, false]);
      expect(await heldCount(shared)).toBe(held);
      await settle(shared, 'top', [D, 3n, true]);
      await settle(shared, 'top', [D, 4n, true]);
      expect([await view(shared, 'balanceOf', [D]), await view(shared, 'credited')]).toStrictEqual([7n, 2n]);
      const skipped = await settle(shared, 'top', [D, 5n, false]);
      expect([await view(shared, 'balanceOf', [D]), await view(shared, 'credited')]).toStrictEqual([7n, 2n]);
      expectRestatedSkipRefused(shared, skipped, D);
    }, 600_000);

    it(`plans an undecided guard from the frame's own stop where the node exists, refused where not, ${path}`, async () => {
      const shared = await world(behindProxy);
      const held = await heldCount(shared);
      // The key holds no node, so whether the write creates one is the body's to say, and the call is refused.
      const refused = await shared.enter('bump', [C, 9n]).then(() => undefined, (error: unknown) => error as Error);
      expect(refused?.message).toMatch(new RegExp(`${behindProxy ? 'the implementation\'s "bump" entry' : 'entry "bump"'} `
        + 'writes mapping "balances" under a condition this (hop|call) cannot decide from the frame\'s facts, at a key '
        + 'the collection does not hold, so it cannot declare whether the write creates the key\'s node$'));
      expect(await heldCount(shared)).toBe(held);
      // A held key's node: skipped twice, its value learned from the check of the arm not taken, then written.
      await settle(shared, 'top', [D, 3n, true]);
      await settle(shared, 'bump', [D, 9n]);
      await settle(shared, 'bump', [D, 9n]);
      expect([await view(shared, 'balanceOf', [D]), await view(shared, 'bumps')]).toStrictEqual([3n, 2n]);
      await settle(shared, 'bump', [D, 9n]);
      expect([await view(shared, 'balanceOf', [D]), await view(shared, 'bumps')]).toStrictEqual([9n, 3n]);
    }, 600_000);
  }
});
