import { describe, expect, it } from 'vitest';
import { bigIntToVmNumber, binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import {
  VALUE_INLINE_LIMIT, argsHash, bytesEqual, bytesToHex, encodeArgumentList, sha256, validatorAddress,
} from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { decodeEntryCommitment, encodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import { readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { readComputedDeclaration } from '../../../src/framed/deploy/declaration.js';
import {
  buildProxyArtifact, callFramedProxyEntry, deployFramedProxy, type FramedProxyCallResult,
} from '../../../src/framed/proxy/index.js';
import {
  deploymentStateValues, liveMappingValueReader, planHopExternalCalls, type FramedProxyExternal,
} from '../../../src/framed/proxy/external-calls.js';
import { entryWriteValueKey } from '../../../src/framed/proxy/written-values.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import type { Utxo } from '../../../src/interfaces.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * A call a root entry routes through a mapping value its own body computes before the call.
 *
 * `Ledger` sits behind a generated proxy and is entered directly, so its entry is the hop's root frame. Each entry
 * writes a node and then calls the sink with what the node holds: a count it raises from the node's own value (also as
 * the guard of the call), a nonce raised under an address key, a struct it edits one field of in place and passes
 * whole, an array it appends to, whose new length it passes, and a string it builds, short and long; `Opener`'s
 * initialize does the same on the deployment's first hop. No published fact states those bytes, so the hop settles the
 * entry up to the call, reads what its close of the node rebuilt (or the whole value its write plan states, or its
 * chunk pin exposed), and plans the call again from it. The bytes only fill the plan: the entry's own close compares
 * the node it rebuilds with the view the transaction declares and its own call data with the record the call carries,
 * so a forged value is refused. A write on either side of a branch is served: the write publishes the condition it
 * runs under, so the side that skips it plans no write and the call reads the value the node keeps. `Relay`, which
 * reaches the ledger as a callee, keeps the ledger's own computed write refused by name: only the hop's own entry is
 * settled up to a site before the site is planned.
 */

/** A 32-byte category or txid that is neither one repeated byte nor a palindrome, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`root computed mapping value ${label}`)));
}

const SINK_CATEGORY = idOf('sink');
const ALICE_LOCK = encodeLockingBytecodeP2pkh(alicePkh);

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'struct Lot { address holder; uint256 size; uint256 state; }',
  'interface ISink {',
  '  function takeAmount(uint256 k, uint256 amount) external;',
  '  function notify(address a, uint256 n) external;',
  '  function settle(uint256 id, Lot calldata lot) external;',
  '  function count(uint256 k, uint256 n) external;',
  '  function takeNote(uint256 k, string calldata note) external;',
  '}',
  'interface ILedger {',
  '  function bumpThenRelay(uint256 k) external;',
  '}',
  'contract Sink {',
  '  mapping(uint256 => uint256) amounts;',
  '  mapping(address => uint256) notes;',
  '  mapping(uint256 => uint256) settled;',
  '  mapping(uint256 => uint256) counts;',
  '  mapping(uint256 => string) texts;',
  '  function takeAmount(uint256 k, uint256 amount) external { amounts[k] = amount; }',
  '  function notify(address a, uint256 n) external { notes[a] = n; }',
  '  function settle(uint256 id, Lot calldata lot) external { settled[id] = lot.state * 1000 + lot.size; }',
  '  function count(uint256 k, uint256 n) external { counts[k] = n; }',
  '  function takeNote(uint256 k, string calldata note) external { texts[k] = note; }',
  '  function amountOf(uint256 k) external view returns (uint256) { return amounts[k]; }',
  '  function noteOf(address a) external view returns (uint256) { return notes[a]; }',
  '  function settledOf(uint256 id) external view returns (uint256) { return settled[id]; }',
  '  function countOf(uint256 k) external view returns (uint256) { return counts[k]; }',
  '  function textOf(uint256 k) external view returns (string memory) { return texts[k]; }',
  '}',
  'contract Ledger {',
  '  address public implementation;',
  '  address public sink;',
  '  mapping(uint256 => uint256) amounts;',
  '  mapping(address => uint256) nonces;',
  '  mapping(uint256 => Lot) lots;',
  '  mapping(uint256 => uint256[]) lists;',
  '  mapping(uint256 => string) notes;',
  '  function initialize(address sink_) public { sink = sink_; }',
  '  function setAmount(uint256 k, uint256 amount) public { amounts[k] = amount; }',
  '  function openLot(uint256 id, address holder, uint256 size) public { lots[id] = Lot(holder, size, 1); }',
  '  function bumpThenRelay(uint256 k) public {',
  '    amounts[k] = amounts[k] + 1;',
  '    ISink(sink).takeAmount(k, amounts[k]);',
  '  }',
  '  function nonceThenNotify(address a) public {',
  '    nonces[a] += 1;',
  '    ISink(sink).notify(a, nonces[a]);',
  '  }',
  '  function settleLot(uint256 id) public {',
  '    Lot storage l = lots[id];',
  '    l.state = 2;',
  '    ISink(sink).settle(id, lots[id]);',
  '  }',
  '  function pushThenCount(uint256 k, uint256 x) public {',
  '    lists[k].push(x);',
  '    ISink(sink).count(k, lists[k].length);',
  '  }',
  '  function bumpThenRelayIfHigh(uint256 k) public {',
  '    amounts[k] = amounts[k] + 1;',
  '    if (amounts[k] > 10) { ISink(sink).takeAmount(k, amounts[k]); }',
  '  }',
  '  function noteThenRelay(uint256 k, string calldata a, string calldata b) public {',
  '    notes[k] = string(abi.encodePacked(a, " - ", b));',
  '    ISink(sink).takeNote(k, notes[k]);',
  '  }',
  '  function maybeBumpThenRelay(uint256 k, bool bump) public {',
  '    if (bump) { amounts[k] = amounts[k] + 1; }',
  '    ISink(sink).takeAmount(k, amounts[k]);',
  '  }',
  '}',
  'contract Opener {',
  '  address public implementation;',
  '  mapping(uint256 => uint256) counts;',
  '  function initialize(address sink_, uint256 k) public {',
  '    counts[k] = counts[k] + 5;',
  '    ISink(sink_).takeAmount(k, counts[k]);',
  '  }',
  '}',
  'contract Relay {',
  '  address public implementation;',
  '  address public ledger;',
  '  function initialize(address ledger_) public { ledger = ledger_; }',
  '  function bumpThenRelay(uint256 k) public { ILedger(ledger).bumpThenRelay(k); }',
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
  composition: 'framed',
} as const;

const compiled = compileStringMulti(SOURCE, FIXTURE_OPTIONS as never);
const { Sink, Ledger, Opener, Relay } = compiled as Required<typeof compiled>;

/** A framed contract's address, which its category fixes before anything is deployed. */
const addressOf = (id: string): Uint8Array => validatorAddress(hexToBin(id), VALIDATOR_PROGRAM);
const SINK = addressOf(SINK_CATEGORY);

/** A coin a genesis or a hop is funded from; a genesis's txid becomes the category it mints. */
function funding(txid: string): Utxo {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

/** A proxied deployment's two categories, the address its proxy presents, and the external a caller names it by. */
interface Proxied {
  readonly proxyCategoryId: string;
  readonly implementationCategoryId: string;
  readonly address: Uint8Array;
  readonly external: FramedProxyExternal;
}

/** One call entered with a fresh coin of the caller's: the coin, and the hop it pays for. */
interface Entered {
  readonly coin: Utxo;
  readonly call: Promise<FramedProxyCallResult>;
}

/** The deployments, the chain as it stood once every initialize settled, and a way to enter each proxied root. */
interface World {
  readonly network: MockNetworkProvider;
  readonly snapshot: SnapshotRestorer;
  readonly ledger: Proxied;
  readonly externals: Readonly<Record<string, FramedProxyExternal>>;
  /** Deploys a contract behind its generated proxy and requires its initialize, which may call the sink, to settle. */
  readonly deploy: (
    implementationArtifact: NonNullable<typeof Ledger>, label: string, initArgs: readonly FunctionArgument[],
  ) => Promise<Proxied>;
  readonly enter: (
    target: 'ledger' | 'relay', functionName: string, args: readonly FunctionArgument[],
  ) => Promise<Entered>;
}

/** The sink plain, the ledger behind its generated proxy, and the relay behind another. */
async function deployWorld(): Promise<World> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, new SignatureTemplate(alicePriv));
  const changeAddress = wallet.address;
  const callerFunder = new SignatureTemplate(alicePriv).unlockP2PKH();
  await network.addUtxo(wallet.address, funding(SINK_CATEGORY));
  await deployStatefulContract(Sink!, [], {
    fundingUtxo: funding(SINK_CATEGORY), funder, changeAddress, provider: network, threadCount: 4,
  });
  await fundShippedFacets(network);
  const sinkExternal = { artifact: Sink!, categoryId: SINK_CATEGORY };
  const proxied = async (
    implementationArtifact: NonNullable<typeof Ledger>, label: string, initArgs: readonly FunctionArgument[],
    externals: Readonly<Record<string, FramedProxyExternal>>,
  ): Promise<Proxied> => {
    const [implementationId, proxyId, initTxid] = ['implementation', 'proxy', 'initialize coin']
      .map((part) => idOf(`${label} ${part}`));
    for (const id of [implementationId!, proxyId!]) await network.addUtxo(wallet.address, funding(id));
    await network.addUtxo(binToHex(ALICE_LOCK), funding(initTxid!));
    const proxyArtifact = buildProxyArtifact(implementationArtifact);
    const deployment = await deployFramedProxy({
      provider: network,
      implementationArtifact,
      proxyArtifact,
      implementationDeploy: { fundingUtxo: funding(implementationId!), funder, changeAddress, threadCount: 5 },
      proxyDeploy: { fundingUtxo: funding(proxyId!), funder, changeAddress, threadCount: 5 },
      initialize: { functionName: 'initialize', args: [...initArgs] },
      callerLockingBytecode: ALICE_LOCK,
      callerFunding: { utxo: funding(initTxid!), funder: callerFunder, changeAddress },
      externals,
      vm: compositionMachine(),
    });
    expect(deployment.initialize.accepted).toBe(true);
    return {
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      address: deployment.proxy.address,
      external: {
        artifact: implementationArtifact, categoryId: deployment.proxy.categoryId, proxyArtifact,
        implementationCategoryId: deployment.implementation.categoryId,
      },
    };
  };
  const ledger = await proxied(Ledger!, 'ledger', [SINK], { ISink: sinkExternal });
  const externals = { ISink: sinkExternal, ILedger: ledger.external };
  const relay = await proxied(Relay!, 'relay', [ledger.address], externals);
  let coins = 0;
  const enter = async (
    target: 'ledger' | 'relay', functionName: string, args: readonly FunctionArgument[],
  ): Promise<Entered> => {
    coins += 1;
    const coin = funding(idOf(`call coin ${coins}`));
    await network.addUtxo(binToHex(ALICE_LOCK), coin);
    const deployment = target === 'ledger' ? ledger : relay;
    const artifact = target === 'ledger' ? Ledger! : Relay!;
    const call = callFramedProxyEntry({
      provider: network,
      implementationArtifact: artifact,
      proxyArtifact: buildProxyArtifact(artifact),
      proxyCategoryId: deployment.proxyCategoryId,
      implementationCategoryId: deployment.implementationCategoryId,
      functionName,
      args,
      externals,
      callerUtxo: coin,
      callerLockingBytecode: ALICE_LOCK,
      funder: callerFunder,
      changeAddress,
      vm: compositionMachine(),
    });
    return { coin, call };
  };
  const deploy = (
    implementationArtifact: NonNullable<typeof Ledger>, label: string, initArgs: readonly FunctionArgument[],
  ): Promise<Proxied> => proxied(implementationArtifact, label, initArgs, { ISink: sinkExternal });
  return { network, snapshot: await network.takeSnapshot(), ledger, externals, deploy, enter };
}

let worldRun: Promise<World> | undefined;

/** One deployment serves every case, each rewinding the chain to it first. */
async function deployed(): Promise<World> {
  worldRun ??= deployWorld();
  const world = await worldRun;
  await world.snapshot.restore();
  return world;
}

/** Enters one call and requires it to settle every participant and broadcast; hands back the hop. */
async function settle(
  world: World, functionName: string, args: readonly FunctionArgument[], target: 'ledger' | 'relay' = 'ledger',
): Promise<FramedProxyCallResult> {
  const result = await (await world.enter(target, functionName, args)).call;
  expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
  expect(result.accepted).toBe(true);
  expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  return result;
}

/** Every outpoint the ledger's proxy category holds. */
async function ledgerOutpoints(world: World): Promise<readonly string[]> {
  return (await world.network.getUtxosByTokenCategory(world.ledger.proxyCategoryId))
    .map((utxo) => `${utxo.txid}:${utxo.vout}`).sort();
}

/** Enters a call that must be refused with `reason`, leaving the caller's coin and the ledger's records untouched. */
async function expectRefused(
  world: World, functionName: string, args: readonly FunctionArgument[], reason: string,
  target: 'ledger' | 'relay' = 'ledger',
): Promise<void> {
  const before = await ledgerOutpoints(world);
  const entered = await world.enter(target, functionName, args);
  const error = await entered.call.then(() => undefined, (caught: unknown) => caught);
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toBe(reason);
  expect((await world.network.getUtxosForLockingBytecode(ALICE_LOCK))
    .some((utxo) => utxo.txid === entered.coin.txid && utxo.vout === entered.coin.vout)).toBe(true);
  expect(await ledgerOutpoints(world)).toStrictEqual(before);
}

/** The sink entries a hop ran, in the order the derivation completed them. */
const sinkFrames = (result: FramedProxyCallResult): readonly string[] => result.completed
  .map((frame) => frame.functionName).filter((name) => name.startsWith(`${Sink!.contractName}.`));

/** One of the sink's view entries, read from its live records. */
async function sinkView(world: World, functionName: string, args: readonly FunctionArgument[]): Promise<unknown> {
  const read = await readFramedEntry({
    provider: world.network, artifact: Sink!, categoryId: SINK_CATEGORY, functionName, args: [...args],
    vm: compositionMachine(),
  });
  expect(read.accepted, read.objection).toBe(true);
  return read.value;
}

/** The ledger's live set, its mapping nodes classified by the implementation's collections. */
async function ledgerDeployment(world: World): ReturnType<typeof readFramedDeployment> {
  const layout = { ...buildProxyArtifact(Ledger!).stateLayout!, collections: Ledger!.stateLayout!.collections };
  return readFramedDeployment(world.network, world.ledger.proxyCategoryId, layout);
}

/** What the ledger's own node for `keys` holds on chain, decoded as its body reads it. */
async function ledgerValue(
  world: World, collection: string, keys: readonly FunctionArgument[],
): Promise<FunctionArgument | undefined> {
  const set = await ledgerDeployment(world);
  const read = liveMappingValueReader(Ledger!, {
    category: hexToBin(world.ledger.proxyCategoryId), recordCommitments: [],
    chunks: [...set.chunks, ...set.collectionNodes], nodesByCollection: set.nodesByCollection,
  }, Ledger!.structs);
  return read(collection, keys);
}

/** The refusal a site meets when the hop learns no bytes for the frame's own write before it. */
function unstatedWriteRefusal(call: string, collection: string): string {
  return `the call to "${call}" reads mapping "${collection}" at a key the entry's own write before the call leaves `
    + 'at a value its published facts do not state, so the hop cannot state the call the body makes from it';
}

describe('a call a root entry routes through a mapping value its own body computes before the call', () => {
  it('forwards the count it raises from the node, and from the default of a key the mapping did not hold', async () => {
    const world = await deployed();
    await settle(world, 'setAmount', [1n, 85n]);
    await settle(world, 'bumpThenRelay', [1n]);
    expect(await sinkView(world, 'amountOf', [1n])).toBe(86n);
    expect(await ledgerValue(world, 'amounts', [1n])).toBe(86n);
    // The next hop starts from the count the last one left, and a key the mapping did not hold starts at zero.
    await settle(world, 'bumpThenRelay', [1n]);
    expect(await sinkView(world, 'amountOf', [1n])).toBe(87n);
    await settle(world, 'bumpThenRelay', [2n]);
    expect(await sinkView(world, 'amountOf', [2n])).toBe(1n);
    expect(await ledgerValue(world, 'amounts', [2n])).toBe(1n);
  }, 600_000);

  it('makes the call the count it raises guards once the count passes the guard', async () => {
    const world = await deployed();
    await settle(world, 'setAmount', [10n, 10n]);
    expect(sinkFrames(await settle(world, 'bumpThenRelayIfHigh', [10n])))
      .toStrictEqual([`${Sink!.contractName}.takeAmount()`]);
    expect(await sinkView(world, 'amountOf', [10n])).toBe(11n);
    expect(await ledgerValue(world, 'amounts', [10n])).toBe(11n);
  }, 600_000);

  it('forwards a nonce it raises under an address key', async () => {
    const world = await deployed();
    await settle(world, 'nonceThenNotify', [ALICE_LOCK]);
    expect(await sinkView(world, 'noteOf', [ALICE_LOCK])).toBe(1n);
    await settle(world, 'nonceThenNotify', [ALICE_LOCK]);
    expect(await sinkView(world, 'noteOf', [ALICE_LOCK])).toBe(2n);
    expect(await ledgerValue(world, 'nonces', [ALICE_LOCK])).toBe(2n);
  }, 600_000);

  it('passes whole a struct it edits one field of in place', async () => {
    const world = await deployed();
    await settle(world, 'openLot', [3n, SINK, 33n]);
    await settle(world, 'settleLot', [3n]);
    expect(await sinkView(world, 'settledOf', [3n])).toBe(2033n);
    const lot = await ledgerValue(world, 'lots', [3n]);
    expect(JSON.stringify(lot, (_key, value: unknown) => (typeof value === 'bigint' ? value.toString()
      : value instanceof Uint8Array ? binToHex(value) : value)))
      .toBe(JSON.stringify({ holder: binToHex(SINK), size: '33', state: '2' }));
  }, 600_000);

  it('forwards the length an append leaves', async () => {
    const world = await deployed();
    await settle(world, 'pushThenCount', [4n, 7n]);
    expect(await sinkView(world, 'countOf', [4n])).toBe(1n);
    await settle(world, 'pushThenCount', [4n, 9n]);
    expect(await sinkView(world, 'countOf', [4n])).toBe(2n);
    expect(await ledgerValue(world, 'lists', [4n])).toStrictEqual([7n, 9n]);
  }, 600_000);

  it('forwards a string it builds, kept inline and spanning chunk records', async () => {
    const world = await deployed();
    // A short note is the tail of the node the close rebuilt; a long one is what the entry's chunk pin stopped on.
    const short = 'ab - cd';
    const long = `${'x'.repeat(50)} - ${'y'.repeat(50)}`;
    expect(utf8ToBin(short).length).toBeLessThanOrEqual(VALUE_INLINE_LIMIT);
    expect(utf8ToBin(long).length).toBeGreaterThan(VALUE_INLINE_LIMIT);
    await settle(world, 'noteThenRelay', [8n, 'ab', 'cd']);
    expect(await sinkView(world, 'textOf', [8n])).toBe(short);
    await settle(world, 'noteThenRelay', [9n, 'x'.repeat(50), 'y'.repeat(50)]);
    expect(await sinkView(world, 'textOf', [9n])).toBe(long);
    expect(await ledgerValue(world, 'notes', [9n])).toBe(long);
  }, 600_000);

  it('routes an initialize through the count it computes before the call', async () => {
    const world = await deployed();
    await world.deploy(Opener!, 'opener', [SINK, 12n]);
    expect(await sinkView(world, 'amountOf', [12n])).toBe(5n);
  }, 600_000);

  it('serves a write on the side of a branch the entry takes, and the side it skips', async () => {
    const world = await deployed();
    await settle(world, 'setAmount', [5n, 40n]);
    await settle(world, 'maybeBumpThenRelay', [5n, true]);
    expect(await sinkView(world, 'amountOf', [5n])).toBe(41n);
    expect(await ledgerValue(world, 'amounts', [5n])).toBe(41n);
    // The write publishes the condition it runs under, so the arm that skips it plans no write and the call reads
    // the value the node keeps.
    await settle(world, 'setAmount', [6n, 60n]);
    await settle(world, 'maybeBumpThenRelay', [6n, false]);
    expect(await sinkView(world, 'amountOf', [6n])).toBe(60n);
    expect(await ledgerValue(world, 'amounts', [6n])).toBe(60n);
  }, 600_000);

  it('refuses a forged value: the entry closes the node it rebuilt and checks its own call data', async () => {
    const world = await deployed();
    await settle(world, 'setAmount', [6n, 85n]);
    const before = await ledgerDeployment(world);
    const result = await settle(world, 'bumpThenRelay', [6n]);
    const draft = result.draft;
    const entry = draft.runs.find((run) => run.functionName === `${Ledger!.contractName}.bumpThenRelay()`)!.master;
    const block = draft.blockOf(entry);
    const slot = keyToSlotMulti([bigIntToVmNumber(6n)]);
    const written = block.segments.flat().find((record) => record.viewOut.length >= 64
      && bytesEqual(decodeEntryCommitment(record.viewOut).slot, slot))!;
    const after = written.viewOut;
    expect(binToHex(decodeEntryCommitment(after).value)).toBe(binToHex(bigIntToVmNumber(86n)));
    const vm = compositionMachine();
    expect(vm.stateSuccess(vm.evaluate(draft.programFor(entry)))).toBe(true);

    // The plan a forged learned count fills states the call from it; the pushes are the arguments in stack order.
    const forgedCount = bigIntToVmNumber(87n);
    const layout = { ...buildProxyArtifact(Ledger!).stateLayout!, collections: Ledger!.stateLayout!.collections };
    const plan = await planHopExternalCalls({
      provider: world.network, artifact: Ledger!, functionName: 'bumpThenRelay', args: [6n],
      externals: world.externals, validatorProgram: VALIDATOR_PROGRAM,
      stateValues: deploymentStateValues(layout, world.ledger.proxyCategoryId, before),
      entryDeployment: { categoryId: world.ledger.proxyCategoryId, deployment: before, layout },
      selfAddress: world.ledger.address, senderAddress: ALICE_LOCK,
      calleeWriteValues: new Map([[entryWriteValueKey('amounts', slot), forgedCount]]),
    });
    const [selector, ...pushes] = plan.calls[0]!.argumentPushes;
    expect(pushes.map(binToHex)).toStrictEqual([binToHex(forgedCount), binToHex(bigIntToVmNumber(6n))]);

    // The call record that plan states is refused by the entry's own check of its call data, which it compares with
    // the hash of the arguments it computed.
    const realHash = block.calls[0]!.argsHash;
    const forgedHash = argsHash(selector!, encodeArgumentList(pushes));
    block.calls[0]!.argsHash = forgedHash;
    const forgedCall = draft.programFor(entry);
    expect(vm.stateSuccess(vm.evaluate(forgedCall))).not.toBe(true);
    const callReading = readComputedDeclaration({ vm, program: forgedCall, maximumCommitmentBytes: 128 });
    expect(callReading.ok).toBe(true);
    if (!callReading.ok) return;
    expect([binToHex(callReading.declared), binToHex(callReading.computed)].sort())
      .toStrictEqual([binToHex(forgedHash), binToHex(realHash)].sort());
    block.calls[0]!.argsHash = realHash;

    // A node declared at the forged count is refused by the entry's own close, which hands back the node it rebuilt.
    const { nextKey } = decodeEntryCommitment(after);
    const forged = encodeEntryCommitment(slot, nextKey, forgedCount);
    written.viewOut = forged;
    const program = draft.programFor(entry);
    expect(vm.stateSuccess(vm.evaluate(program))).not.toBe(true);
    const reading = readComputedDeclaration({ vm, program, maximumCommitmentBytes: 128 });
    expect(reading.ok).toBe(true);
    if (!reading.ok) return;
    expect(binToHex(reading.declared)).toBe(binToHex(forged));
    expect(binToHex(reading.computed)).toBe(binToHex(after));
  }, 600_000);

  it('still refuses by name a computed write of a frame the root reaches, which the hop does not settle first', async () => {
    const world = await deployed();
    await settle(world, 'setAmount', [7n, 85n]);
    await expectRefused(world, 'bumpThenRelay', [7n], unstatedWriteRefusal('ISink.takeAmount', 'amounts'), 'relay');
  }, 600_000);
});
