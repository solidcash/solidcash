import { beforeAll, describe, expect, it } from 'vitest';
import { binToHex, encodeDataPush, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import { keccak_256 } from '@noble/hashes/sha3.js';
import {
  bytesToHex, concatBytes, encodeEventCommitment, encodeWitnessBlock, sha256, splitFirstPush, type WitnessBlock,
} from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { eventLockingBytecode } from '../../../src/framed/deploy/index.js';
import {
  callFramedEntry, sendFramedValue, type FramedCallResult,
} from '../../../src/framed/call/index.js';
import {
  buildProxyArtifact, callFramedProxyEntry, deployFramedProxy, type FramedProxyCallResult,
} from '../../../src/framed/proxy/index.js';
import { compositionEventLogs } from '../../../src/framed/receipt/index.js';
import type { Utxo } from '../../../src/interfaces.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * Effects a loop repeats once per turn: a batch that emits one event per item, a path walk that hashes once per step
 * (the fold a Merkle proof makes), and an airdrop that pays each recipient in turn.
 *
 * Each body binds its k-th effect where its source makes it, at the k-th event or send output its frame lists or at
 * the k-th side-car after its own input, and pins how many it made against the run the frame lists. The call path
 * lays as many as the loop's published recurrence counts over the call's own arguments. The three settle through
 * the plain call path at zero, one and several turns, and the batch and the walk through a generated proxy too. A
 * frame that lists more or fewer outputs than its turns made is refused, and so is one laid with fewer side-cars. A
 * body that emits or sends once, beside the looped ones behind the same head, binds its own at the run's start.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'contract Batch {',
  '  address public implementation;',
  '  uint256 public count;',
  '  bytes32 public root;',
  '  event Noted(uint256 id);',
  '  receive() external payable {}',
  '  function initialize(bytes32 root_) public { root = root_; }',
  '  function note(uint256[] calldata ids) external {',
  '    for (uint256 i = 0; i < ids.length; i++) { emit Noted(ids[i]); }',
  '    count += ids.length;',
  '  }',
  '  function prove(bytes32 leaf, bytes32[] calldata path) external {',
  '    bytes32 node = leaf;',
  '    for (uint256 i = 0; i < path.length; i++) { node = keccak256(abi.encodePacked(node, path[i])); }',
  '    require(node == root, "bad path");',
  '    count += 1;',
  '  }',
  '  function drop(address[] calldata to, uint256 each) external {',
  '    for (uint256 i = 0; i < to.length; i++) { payable(to[i]).transfer(each); }',
  '    count += 1;',
  '  }',
  '  function ping(uint256 id) external { emit Noted(id); }',
  '  function payOne(address to, uint256 amount) external { payable(to).transfer(amount); }',
  '}',
].join('\n');

const batch = compileStringMulti(SOURCE, { evmCompat: true, composition: 'framed' } as never).Batch!;
const NOTED = batch.events!.find((definition) => definition.name === 'Noted')!;

const MASTER = 'master';
const CALLER = encodeLockingBytecodeP2pkh(alicePkh);
const CALLER_FUNDER = new SignatureTemplate(alicePriv).unlockP2PKH();
/** The `u16` sentinel a block's index field holds for no index. */
const INDEX_NONE = 0xffff;

/** A 32-byte value derived from a label, distinct per label. */
const word = (label: string): Uint8Array => sha256(utf8ToBin(`loop turn effects ${label}`));
/** A recipient's lock: a P2PKH lock of a hash derived from its label. */
const recipient = (label: string): Uint8Array => encodeLockingBytecodeP2pkh(word(label).slice(0, 20));

/** The node a path folds a leaf into: each step hashes the node so far with the next element. */
function fold(leaf: Uint8Array, path: readonly Uint8Array[]): Uint8Array {
  return path.reduce((node, step) => Uint8Array.from(keccak_256(concatBytes([node, step]))), leaf);
}

const LEAF = word('leaf');
const PATH = [word('step 0'), word('step 1'), word('step 2')];
const ROOT = fold(LEAF, PATH);

/** One network with the deployer's wallet, a coin factory, and the validator facets funded. */
interface World {
  readonly network: MockNetworkProvider;
  readonly walletAddress: string;
  readonly walletFunder: ReturnType<Contract['unlock']['spend']>;
  readonly coin: (lock: string) => Promise<Utxo>;
}

async function newWorld(seed: string): Promise<World> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  await fundShippedFacets(network);
  let serial = 0;
  return {
    network,
    walletAddress: wallet.address,
    walletFunder: wallet.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
    coin: async (lock: string): Promise<Utxo> => {
      serial += 1;
      const utxo = { txid: binToHex(word(`${seed} coin ${serial}`)), vout: 0, satoshis: 5_000_000n };
      await network.addUtxo(lock, utxo);
      return utxo;
    },
  };
}

/** The contract deployed without a proxy, its root stated through its own `initialize` entry. */
interface Plain {
  readonly world: World;
  readonly categoryId: string;
}

async function deployPlain(seed: string): Promise<Plain> {
  const world = await newWorld(seed);
  const deployment = await deployStatefulContract(batch, [], {
    provider: world.network, fundingUtxo: await world.coin(world.walletAddress), funder: world.walletFunder,
    changeAddress: world.walletAddress,
  });
  const plain = { world, categoryId: deployment.categoryId };
  expect(refused(await enterPlain(plain, 'initialize', [ROOT]))).toBeUndefined();
  return plain;
}

async function enterPlain(plain: Plain, functionName: string, args: readonly unknown[]): Promise<FramedCallResult> {
  return callFramedEntry({
    provider: plain.world.network, artifact: batch, categoryId: plain.categoryId, functionName,
    args: args as never, callerUtxo: await plain.world.coin(binToHex(CALLER)), callerLockingBytecode: CALLER,
    funder: CALLER_FUNDER, changeAddress: plain.world.walletAddress, vm: compositionMachine(),
  });
}

/** The contract behind its generated proxy, its root stated by the `initialize` the deployment runs. */
interface Proxied {
  readonly world: World;
  readonly proxyCategoryId: string;
  readonly implementationCategoryId: string;
}

async function deployProxied(seed: string): Promise<Proxied> {
  const world = await newWorld(seed);
  const deployOf = async (): Promise<Parameters<typeof deployFramedProxy>[0]['proxyDeploy']> => ({
    fundingUtxo: await world.coin(world.walletAddress), funder: world.walletFunder, changeAddress: world.walletAddress,
  });
  const deployment = await deployFramedProxy({
    provider: world.network,
    implementationArtifact: batch,
    proxyArtifact: buildProxyArtifact(batch),
    implementationDeploy: await deployOf(),
    proxyDeploy: await deployOf(),
    initialize: { functionName: 'initialize', args: [ROOT] },
    callerLockingBytecode: CALLER,
    callerFunding: {
      utxo: await world.coin(binToHex(CALLER)), funder: CALLER_FUNDER, changeAddress: world.walletAddress,
    },
    vm: compositionMachine(),
  });
  expect(deployment.initialize.broadcast).toBeDefined();
  return {
    world, proxyCategoryId: deployment.proxy.categoryId, implementationCategoryId: deployment.implementation.categoryId,
  };
}

async function enterProxied(
  proxied: Proxied, functionName: string, args: readonly unknown[],
): Promise<FramedProxyCallResult> {
  return callFramedProxyEntry({
    provider: proxied.world.network, implementationArtifact: batch, proxyArtifact: buildProxyArtifact(batch),
    proxyCategoryId: proxied.proxyCategoryId, implementationCategoryId: proxied.implementationCategoryId,
    functionName, args: args as never, externals: {}, callerUtxo: await proxied.world.coin(binToHex(CALLER)),
    callerLockingBytecode: CALLER, funder: CALLER_FUNDER, changeAddress: proxied.world.walletAddress,
    vm: compositionMachine(),
  });
}

/** The verdicts a result reports, one per participant. */
interface Verdicts {
  readonly verdicts: readonly { readonly id: string; readonly accepted: boolean; readonly objection?: string }[];
}

/** The refused verdicts of a result, as one line, or undefined when every participant accepted. */
function refused(result: Verdicts): string | undefined {
  const refusals = result.verdicts.filter((verdict) => !verdict.accepted);
  return refusals.length === 0 ? undefined
    : refusals.map((verdict) => `${verdict.id}: ${verdict.objection ?? 'refused'}`).join('; ');
}

/** The ids the plain broadcast's `Noted` events carry, read back from its outputs in output order. */
function notedIds(result: FramedCallResult): readonly unknown[] {
  return compositionEventLogs(result.draft, [batch], { outputs: result.broadcast!.outputs })
    .filter((log) => log.eventName === 'Noted').map((log) => log.args.id);
}

type VmProgram = Parameters<ReturnType<typeof compositionMachine>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmSourceOutputs = VmProgram['sourceOutputs'];

/** A spend the machine is asked about: the transaction and the outputs its inputs spend. */
interface Spend {
  readonly transaction: VmTransaction;
  readonly sourceOutputs: VmSourceOutputs;
}

const masterIndex = (result: FramedCallResult): number =>
  result.draft.layout.participants.find((placed) => placed.id === MASTER)!.index;

/** The machine's verdict on the master's input of a spend: undefined when accepted, the error otherwise. */
function masterVerdict(result: FramedCallResult, spend: Spend): string | undefined {
  const vm = compositionMachine();
  const state = vm.evaluate({ inputIndex: masterIndex(result), ...spend });
  return vm.stateSuccess(state) === true ? undefined : String((state as { readonly error?: unknown }).error);
}

/**
 * The accepted spend with the master's block rewritten by `apply`, which may change the transaction too: the block
 * is encoded as the composer encodes it, and the pushes after it are kept.
 */
function forged(
  result: FramedCallResult,
  apply: (draft: { readonly transaction: VmTransaction; readonly sourceOutputs: VmSourceOutputs[number][];
    readonly block: WitnessBlock }) => void,
): Spend {
  const transaction = structuredClone(result.transaction) as VmTransaction;
  const sourceOutputs = [...result.sourceOutputs];
  const block = structuredClone(result.draft.blockOf(MASTER)) as WitnessBlock;
  apply({ transaction, sourceOutputs, block });
  const input = transaction.inputs[masterIndex(result)]!;
  const { rest } = splitFirstPush(input.unlockingBytecode);
  transaction.inputs[masterIndex(result)] = {
    ...input, unlockingBytecode: concatBytes([encodeDataPush(encodeWitnessBlock(block)), rest]),
  };
  return { transaction, sourceOutputs };
}

/**
 * The accepted spend without one participant's input and the output it recreates, every index the master's block
 * holds past it moved down by one: the layout as if the plan had never placed that participant.
 */
function withoutParticipant(result: FramedCallResult, id: string): Spend {
  const removed = result.draft.layout.participants.find((placed) => placed.id === id)!.index;
  expect(removed).toBeGreaterThan(masterIndex(result));
  const moved = (index: number): number => (index !== INDEX_NONE && index > removed ? index - 1 : index);
  return forged(result, ({ transaction, sourceOutputs, block }) => {
    transaction.inputs.splice(removed, 1);
    transaction.outputs.splice(removed, 1);
    sourceOutputs.splice(removed, 1);
    block.callerRef = moved(block.callerRef);
    block.originRef = moved(block.originRef);
    block.validatorRef = moved(block.validatorRef);
    block.segments = block.segments.map((segment) => segment.map((entry) => ({
      ...entry, in: moved(entry.in), out: moved(entry.out),
    })));
    block.events = block.events.map(moved);
    block.sends = block.sends.map(moved);
  });
}

describe('a batch that emits one event per item', () => {
  let plain: Plain;
  beforeAll(async () => {
    plain = await deployPlain('events');
  }, 300_000);

  it('lists one event output per item and broadcasts them in item order', async () => {
    const result = await enterPlain(plain, 'note', [[5n, 7n, 9n]]);
    expect(refused(result)).toBeUndefined();
    expect(result.draft.blockOf(MASTER).events).toHaveLength(3);
    expect(notedIds(result)).toStrictEqual([5n, 7n, 9n]);
  }, 300_000);

  it('settles zero items, which list no event, and one item', async () => {
    const none = await enterPlain(plain, 'note', [[]]);
    expect(refused(none)).toBeUndefined();
    expect(none.draft.blockOf(MASTER).events).toStrictEqual([]);
    const one = await enterPlain(plain, 'note', [[4n]]);
    expect(refused(one)).toBeUndefined();
    expect(notedIds(one)).toStrictEqual([4n]);
  }, 300_000);

  it('refuses a frame that lists one event output fewer or one more than its turns emitted', async () => {
    const result = await enterPlain(plain, 'note', [[5n, 7n, 9n]]);
    expect(masterVerdict(result, forged(result, () => undefined))).toBeUndefined();
    // One short: the run's last event is left unlisted, an immutable output of the contract the census refuses.
    expect(masterVerdict(result, forged(result, ({ block }) => {
      block.events = block.events.slice(0, -1);
    }))).toBeDefined();
    // One more: a fourth genuine event output after the run, listed, which the body's count of its turns misses.
    expect(masterVerdict(result, forged(result, ({ transaction, block }) => {
      const last = block.events.at(-1)!;
      transaction.outputs.splice(last + 1, 0, structuredClone(transaction.outputs[last]!));
      block.events = [...block.events, last + 1];
    }))).toBeDefined();
    // Out of order: the head checks the listed outputs as one run of consecutive outputs.
    expect(masterVerdict(result, forged(result, ({ block }) => {
      block.events = [block.events[1]!, block.events[0]!, block.events[2]!];
    }))).toBeDefined();
  }, 300_000);

  it('settles a body that emits once beside the loop, at the run\'s first output', async () => {
    const result = await enterPlain(plain, 'ping', [11n]);
    expect(refused(result)).toBeUndefined();
    expect(notedIds(result)).toStrictEqual([11n]);
  }, 300_000);
});

describe('a path walk that hashes once per step', () => {
  let plain: Plain;
  beforeAll(async () => {
    plain = await deployPlain('hashes');
  }, 300_000);

  it('reads one side-car per step and accepts the path that folds into the root', async () => {
    const result = await enterPlain(plain, 'prove', [LEAF, PATH]);
    expect(refused(result)).toBeUndefined();
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(result.draft.layout.participants.filter((placed) => placed.id.startsWith(`${MASTER}/keccak-`)))
      .toHaveLength(PATH.length);
  }, 300_000);

  it('settles a walk of no step, whose leaf is the root, and of one step', async () => {
    expect(refused(await enterPlain(plain, 'prove', [ROOT, []]))).toBeUndefined();
    expect(refused(await enterPlain(plain, 'prove', [fold(LEAF, PATH.slice(0, 2)), [PATH[2]]]))).toBeUndefined();
  }, 300_000);

  it('refuses a path that does not fold into the root, at the body\'s own check', async () => {
    const result = await enterPlain(plain, 'prove', [LEAF, [PATH[1], PATH[0], PATH[2]]]);
    expect(refused(result)).toContain('bad path');
    expect(result.broadcast).toBeUndefined();
  }, 300_000);

  it('refuses a frame laid with one side-car fewer than its steps', async () => {
    const result = await enterPlain(plain, 'prove', [LEAF, PATH]);
    expect(masterVerdict(result, forged(result, () => undefined))).toBeUndefined();
    // The last step reads the input after the side-cars the frame laid, which is no side-car.
    expect(masterVerdict(result, withoutParticipant(result, `${MASTER}/keccak-${PATH.length - 1}`))).toBeDefined();
  }, 300_000);
});

describe('an airdrop that pays each recipient in turn', () => {
  let plain: Plain;
  beforeAll(async () => {
    plain = await deployPlain('sends');
    const deposit = await sendFramedValue({
      provider: plain.world.network, artifact: batch, categoryId: plain.categoryId,
      callerUtxo: await plain.world.coin(binToHex(CALLER)), callerLockingBytecode: CALLER, funder: CALLER_FUNDER,
      changeAddress: plain.world.walletAddress, vm: compositionMachine(), value: 100_000n,
    });
    expect(refused(deposit)).toBeUndefined();
  }, 300_000);

  /** The lock and the value each listed send pays, in list order. */
  const paid = (result: FramedCallResult): readonly string[] => result.draft.blockOf(MASTER).sends.map((index) => {
    const output = result.broadcast!.outputs[index]!;
    return `${binToHex(output.lockingBytecode)}:${output.valueSatoshis}`;
  });

  it('lists one send per recipient and pays each its amount', async () => {
    const recipients = [recipient('a'), recipient('b'), recipient('c')];
    const result = await enterPlain(plain, 'drop', [recipients, 2_000n]);
    expect(refused(result)).toBeUndefined();
    expect(paid(result)).toStrictEqual(recipients.map((lock) => `${binToHex(lock)}:2000`));
  }, 300_000);

  it('settles no recipient, which lists no send, and one recipient', async () => {
    const none = await enterPlain(plain, 'drop', [[], 2_000n]);
    expect(refused(none)).toBeUndefined();
    expect(none.draft.blockOf(MASTER).sends).toStrictEqual([]);
    const one = await enterPlain(plain, 'drop', [[recipient('d')], 1_500n]);
    expect(refused(one)).toBeUndefined();
    expect(paid(one)).toStrictEqual([`${binToHex(recipient('d'))}:1500`]);
  }, 300_000);

  it('settles a body that sends once beside the loop, at the run\'s first output', async () => {
    const result = await enterPlain(plain, 'payOne', [recipient('e'), 1_234n]);
    expect(refused(result)).toBeUndefined();
    expect(paid(result)).toStrictEqual([`${binToHex(recipient('e'))}:1234`]);
  }, 300_000);

  it('refuses a frame that lists one send fewer or one more than its turns paid', async () => {
    const result = await enterPlain(plain, 'drop', [[recipient('a'), recipient('b')], 2_000n]);
    expect(masterVerdict(result, forged(result, () => undefined))).toBeUndefined();
    // One short: the last payment is left unlisted, so the containers pay more than the sends the frame lists.
    expect(masterVerdict(result, forged(result, ({ block }) => {
      block.sends = block.sends.slice(0, -1);
    }))).toBeDefined();
    // One more: a third payment after the run, listed, which the body's count of its turns misses.
    expect(masterVerdict(result, forged(result, ({ transaction, block }) => {
      const last = block.sends.at(-1)!;
      transaction.outputs.splice(last + 1, 0, structuredClone(transaction.outputs[last]!));
      block.sends = [...block.sends, last + 1];
    }))).toBeDefined();
  }, 300_000);
});

describe('the loops behind a generated proxy', () => {
  let proxied: Proxied;
  beforeAll(async () => {
    proxied = await deployProxied('proxied');
  }, 300_000);

  it('emits one event per item through the hop, at the proxy\'s event covenant', async () => {
    const ids = [5n, 7n, 9n];
    const result = await enterProxied(proxied, 'note', [ids]);
    expect(refused(result)).toBeUndefined();
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    // A delegate frame emits under the records it runs on, so the proxy's category names each event's covenant.
    const lock = bytesToHex(eventLockingBytecode(hexToBin(proxied.proxyCategoryId), NOTED.signature, false));
    const payloads = ids.map((id) => bytesToHex(encodeEventCommitment(NOTED.parameters, [id])));
    expect(result.writtenEventCommitments.map(bytesToHex)).toStrictEqual(payloads);
    expect(result.draft.blockOf('implementation-master').events.map((index) => {
      const output = result.transaction.outputs[index]!;
      return `${bytesToHex(output.lockingBytecode)}:${bytesToHex(output.token!.nft!.commitment)}`;
    })).toStrictEqual(payloads.map((payload) => `${lock}:${payload}`));
  }, 300_000);

  it('folds the path through the hop', async () => {
    const result = await enterProxied(proxied, 'prove', [LEAF, PATH]);
    expect(refused(result)).toBeUndefined();
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  }, 300_000);
});
