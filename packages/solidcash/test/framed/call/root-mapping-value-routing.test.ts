import { describe, expect, it } from 'vitest';
import {
  bigIntToVmNumber, binToHex, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin,
} from '@bitauth/libauth';
import { VALUE_INLINE_LIMIT, bytesEqual, bytesToHex, sha256, validatorAddress } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import type NetworkProvider from '../../../src/network/NetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { decodeEntryCommitment, encodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import { readFramedDeployment } from '../../../src/framed/deploy/index.js';
import {
  buildProxyArtifact, callFramedProxyEntry, deployFramedProxy, type FramedProxyCallResult,
} from '../../../src/framed/proxy/index.js';
import {
  deploymentStateValues, planHopExternalCalls, type FramedProxyExternal,
} from '../../../src/framed/proxy/external-calls.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import type { Utxo } from '../../../src/interfaces.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * A call a root entry routes through a value its own mapping holds, and one a reach routes through a value an earlier
 * reach of the same hop left.
 *
 * `Keeper` sits behind a generated proxy and is entered directly, so its entry is the hop's root frame. A call it routes
 * through one of its own mappings - an argument (`names[k]`, `amounts[k]`), the arm a value picks, the address it calls
 * (`targets[k]`), the condition that makes the call (`flags[k]`) and a struct field (`lots[k].holder`) - is planned
 * from the node the keeper's deployment holds for the key, in the form the node holds it, and a key it does not hold
 * reads as its type's default. A write the entry itself makes before the call leaves the key at the value the body then
 * reads: the value its published facts state is the one the call is planned from (a `Starter`'s initialize calls the
 * address it has just stored), one its body computes is learned from the entry's own close of the node
 * (`root-computed-mapping-value`), and a write after the call leaves the call reading the deployment's own value. A
 * value a listing misreports is planned from as reported, and the transaction is refused for it.
 *
 * `Relay` reaches the keeper twice in one hop. A node the first reach leaves is what the second reads, whether the
 * first created it or rewrote one the deployment holds: the value the first reach's facts state, or the view its settle
 * learned, and one its body computes and nothing learned is refused by name.
 */

/** A 32-byte category or txid that is neither one repeated byte nor a palindrome, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`root mapping value routing ${label}`)));
}

const SINK_CATEGORY = idOf('sink');
const ALICE_LOCK = encodeLockingBytecodeP2pkh(alicePkh);

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'interface ISink {',
  '  function take(uint256 k, string calldata name) external;',
  '  function takeLong(uint256 k, string calldata name) external;',
  '  function takeAmount(uint256 k, uint256 amount) external;',
  '  function ping(uint256 k) external;',
  '}',
  'interface IKeeper {',
  '  function setAmount(uint256 k, uint256 amount) external;',
  '  function bumpAmount(uint256 k) external;',
  '  function relayAmount(uint256 k) external;',
  '}',
  'contract Sink {',
  '  uint256 lastPing;',
  '  mapping(uint256 => string) names;',
  '  mapping(uint256 => string) longNames;',
  '  mapping(uint256 => uint256) amounts;',
  '  function take(uint256 k, string calldata name) external { names[k] = name; }',
  '  function takeLong(uint256 k, string calldata name) external { longNames[k] = name; }',
  '  function takeAmount(uint256 k, uint256 amount) external { amounts[k] = amount; }',
  '  function ping(uint256 k) external { lastPing = k; }',
  '  function pinged() external view returns (uint256) { return lastPing; }',
  '  function nameOf(uint256 k) external view returns (string memory) { return names[k]; }',
  '  function longNameOf(uint256 k) external view returns (string memory) { return longNames[k]; }',
  '  function amountOf(uint256 k) external view returns (uint256) { return amounts[k]; }',
  '}',
  'contract Keeper {',
  '  struct Lot { address holder; uint256 size; }',
  '  address public implementation;',
  '  address public sink;',
  '  mapping(uint256 => string) names;',
  '  mapping(uint256 => uint256) amounts;',
  '  mapping(uint256 => address) targets;',
  '  mapping(uint256 => bool) flags;',
  '  mapping(uint256 => Lot) lots;',
  '  function initialize(address sink_) public { sink = sink_; }',
  '  function setName(uint256 k, string calldata name) public { names[k] = name; }',
  '  function setAmount(uint256 k, uint256 amount) public { amounts[k] = amount; }',
  '  function setTarget(uint256 k, address target) public { targets[k] = target; }',
  '  function setFlag(uint256 k, bool flag) public { flags[k] = flag; }',
  '  function setLot(uint256 k, address holder, uint256 size) public { lots[k] = Lot(holder, size); }',
  '  function bumpAmount(uint256 k) public { amounts[k] = amounts[k] + 1; }',
  '  function relayName(uint256 k) public {',
  '    if (bytes(names[k]).length > 60) { ISink(sink).takeLong(k, names[k]); }',
  '    else { ISink(sink).take(k, names[k]); }',
  '  }',
  '  function relayAmount(uint256 k) public { ISink(sink).takeAmount(k, amounts[k]); }',
  '  function pingTarget(uint256 k) public { ISink(targets[k]).ping(k); }',
  '  function pingIfFlagged(uint256 k) public { if (flags[k]) { ISink(sink).ping(k); } }',
  '  function pingHolder(uint256 k) public { ISink(lots[k].holder).ping(k); }',
  '  function relaySize(uint256 k) public { ISink(sink).takeAmount(k, lots[k].size); }',
  '  function nameThenRelay(uint256 k, string calldata name) public {',
  '    names[k] = name;',
  '    ISink(sink).take(k, names[k]);',
  '  }',
  '  function amountThenRelay(uint256 k, uint256 amount) public {',
  '    amounts[k] = amount;',
  '    ISink(sink).takeAmount(k, amounts[k]);',
  '  }',
  '  function bumpThenRelay(uint256 k) public {',
  '    amounts[k] = amounts[k] + 1;',
  '    ISink(sink).takeAmount(k, amounts[k]);',
  '  }',
  '  function relayThenSet(uint256 k, uint256 amount) public {',
  '    ISink(sink).takeAmount(k, amounts[k]);',
  '    amounts[k] = amount;',
  '  }',
  '}',
  'contract Starter {',
  '  address public implementation;',
  '  mapping(uint256 => address) targets;',
  '  function initialize(address target, uint256 k) public {',
  '    targets[k] = target;',
  '    ISink(targets[k]).ping(k);',
  '  }',
  '}',
  'contract Relay {',
  '  address public implementation;',
  '  address public keeper;',
  '  function initialize(address keeper_) public { keeper = keeper_; }',
  '  function setThenRelay(uint256 k, uint256 amount) public {',
  '    IKeeper(keeper).setAmount(k, amount);',
  '    IKeeper(keeper).relayAmount(k);',
  '  }',
  '  function bumpThenRelay(uint256 k) public {',
  '    IKeeper(keeper).bumpAmount(k);',
  '    IKeeper(keeper).relayAmount(k);',
  '  }',
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
const { Sink, Keeper, Starter, Relay } = compiled as Required<typeof compiled>;

/** A short name a pushdata decoder reads as another value, and a long one that spans a run of chunk records. */
const SHORT_NAME = "Sam's short note";
const LONG_NAME = `# a long note ${'n'.repeat(120)} that spans a run of chunk records`;

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
  readonly keeper: Proxied;
  readonly relay: Proxied;
  readonly externals: Readonly<Record<string, FramedProxyExternal>>;
  /** Deploys a contract behind its generated proxy and requires its initialize, which may call the sink, to settle. */
  readonly deploy: (
    implementationArtifact: NonNullable<typeof Keeper>, label: string, initArgs: readonly FunctionArgument[],
  ) => Promise<Proxied>;
  readonly enter: (
    target: 'keeper' | 'relay', functionName: string, args: readonly FunctionArgument[], provider?: NetworkProvider,
  ) => Promise<Entered>;
}

/** The sink plain, the keeper behind its generated proxy, and the relay behind another. */
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
    implementationArtifact: NonNullable<typeof Keeper>, label: string, initArgs: readonly FunctionArgument[],
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
      externals: { ISink: sinkExternal },
      vm: compositionMachine(),
    });
    expect(deployment.initialize.accepted).toBe(true);
    expect(deployment.initialize.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
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
  const keeper = await proxied(Keeper!, 'keeper', [SINK]);
  const relay = await proxied(Relay!, 'relay', [keeper.address]);
  const externals = { ISink: sinkExternal, IKeeper: keeper.external };
  let coins = 0;
  const enter = async (
    target: 'keeper' | 'relay', functionName: string, args: readonly FunctionArgument[],
    provider: NetworkProvider = network,
  ): Promise<Entered> => {
    coins += 1;
    const coin = funding(idOf(`call coin ${coins}`));
    await network.addUtxo(binToHex(ALICE_LOCK), coin);
    const deployment = target === 'keeper' ? keeper : relay;
    const artifact = target === 'keeper' ? Keeper! : Relay!;
    const call = callFramedProxyEntry({
      provider,
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
  return { network, snapshot: await network.takeSnapshot(), keeper, relay, externals, deploy: proxied, enter };
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
  world: World, target: 'keeper' | 'relay', functionName: string, args: readonly FunctionArgument[],
): Promise<FramedProxyCallResult> {
  const result = await (await world.enter(target, functionName, args)).call;
  expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
  expect(result.accepted).toBe(true);
  expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  return result;
}

/** Every outpoint the keeper's proxy category holds. */
async function keeperOutpoints(world: World): Promise<readonly string[]> {
  return (await world.network.getUtxosByTokenCategory(world.keeper.proxyCategoryId))
    .map((utxo) => `${utxo.txid}:${utxo.vout}`).sort();
}

/** Enters a call that must be refused with `reason`, leaving the caller's coin and the keeper's records untouched. */
async function expectRefused(
  world: World, target: 'keeper' | 'relay', functionName: string, args: readonly FunctionArgument[],
  reason: string | RegExp, provider?: NetworkProvider,
): Promise<void> {
  const before = await keeperOutpoints(world);
  const entered = await world.enter(target, functionName, args, provider);
  const error = await entered.call.then(() => undefined, (caught: unknown) => caught);
  expect(error).toBeInstanceOf(Error);
  if (typeof reason === 'string') expect((error as Error).message).toBe(reason);
  else expect((error as Error).message).toMatch(reason);
  expect((await world.network.getUtxosForLockingBytecode(ALICE_LOCK))
    .some((utxo) => utxo.txid === entered.coin.txid && utxo.vout === entered.coin.vout)).toBe(true);
  expect(await keeperOutpoints(world)).toStrictEqual(before);
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

/** The keeper's live set, its mapping nodes classified by the implementation's collections. */
async function keeperDeployment(world: World): ReturnType<typeof readFramedDeployment> {
  const proxy = buildProxyArtifact(Keeper!);
  const layout = { ...proxy.stateLayout!, collections: Keeper!.stateLayout!.collections };
  return readFramedDeployment(world.network, world.keeper.proxyCategoryId, layout);
}

/** A listing that reports the keeper's `amounts` node of key `k` as holding `value`, at the same outpoint. */
function misreporting(world: World, k: bigint, value: bigint): NetworkProvider {
  const slot = keyToSlotMulti([bigIntToVmNumber(k)]);
  return new Proxy(world.network, {
    get(target, key): unknown {
      if (key === 'getUtxosByTokenCategory') {
        return async (category: string): Promise<Utxo[]> => (await target.getUtxosByTokenCategory(category))
          .map((utxo) => {
            const commitment = utxo.token?.nft?.commitment;
            if (category !== world.keeper.proxyCategoryId || commitment === undefined) return utxo;
            const node = decodeEntryCommitment(hexToBin(commitment));
            if (!bytesEqual(node.slot, slot)) return utxo;
            const forged = encodeEntryCommitment(node.slot, node.nextKey, bigIntToVmNumber(value));
            return { ...utxo, token: { ...utxo.token!, nft: { ...utxo.token!.nft!, commitment: binToHex(forged) } } };
          });
      }
      const member = Reflect.get(target, key, target);
      return typeof member === 'function' ? member.bind(target) : member;
    },
  });
}

describe('a call a root entry routes through a value its own mapping holds', () => {
  it('holds the short name inline and the long one past the inline limit', () => {
    expect(utf8ToBin(SHORT_NAME).length).toBeLessThanOrEqual(VALUE_INLINE_LIMIT);
    expect(utf8ToBin(LONG_NAME).length).toBeGreaterThan(2 * VALUE_INLINE_LIMIT);
  });

  it('forwards a short and a chunked string down the arm each length picks', async () => {
    const world = await deployed();
    await settle(world, 'keeper', 'setName', [1n, SHORT_NAME]);
    await settle(world, 'keeper', 'setName', [2n, LONG_NAME]);
    expect(sinkFrames(await settle(world, 'keeper', 'relayName', [1n]))).toStrictEqual([`${Sink!.contractName}.take()`]);
    expect(sinkFrames(await settle(world, 'keeper', 'relayName', [2n])))
      .toStrictEqual([`${Sink!.contractName}.takeLong()`]);
    expect(await sinkView(world, 'nameOf', [1n])).toBe(SHORT_NAME);
    expect(await sinkView(world, 'longNameOf', [2n])).toBe(LONG_NAME);
  }, 600_000);

  it('forwards an integer, and the defaults keys the mappings do not hold read as', async () => {
    const world = await deployed();
    await settle(world, 'keeper', 'setAmount', [4n, 85n]);
    await settle(world, 'keeper', 'relayAmount', [4n]);
    expect(await sinkView(world, 'amountOf', [4n])).toBe(85n);
    expect(sinkFrames(await settle(world, 'keeper', 'relayName', [9n]))).toStrictEqual([`${Sink!.contractName}.take()`]);
    expect(await sinkView(world, 'nameOf', [9n])).toBe('');
    await settle(world, 'keeper', 'relayAmount', [9n]);
    expect(await sinkView(world, 'amountOf', [9n])).toBe(0n);
  }, 600_000);

  it('calls the address it holds', async () => {
    const world = await deployed();
    await settle(world, 'keeper', 'setTarget', [5n, SINK]);
    expect(sinkFrames(await settle(world, 'keeper', 'pingTarget', [5n]))).toStrictEqual([`${Sink!.contractName}.ping()`]);
    expect(await sinkView(world, 'pinged', [])).toBe(5n);
  }, 600_000);

  it('makes the call a flag it holds guards only while the flag is set', async () => {
    const world = await deployed();
    await settle(world, 'keeper', 'setFlag', [8n, true]);
    expect(sinkFrames(await settle(world, 'keeper', 'pingIfFlagged', [8n])))
      .toStrictEqual([`${Sink!.contractName}.ping()`]);
    await settle(world, 'keeper', 'setFlag', [8n, false]);
    for (const key of [8n, 10n]) expect(sinkFrames(await settle(world, 'keeper', 'pingIfFlagged', [key]))).toStrictEqual([]);
    expect(await sinkView(world, 'pinged', [])).toBe(8n);
  }, 600_000);

  it('reads a struct field as the address it calls and as an argument', async () => {
    const world = await deployed();
    await settle(world, 'keeper', 'setLot', [6n, SINK, 33n]);
    expect(sinkFrames(await settle(world, 'keeper', 'pingHolder', [6n]))).toStrictEqual([`${Sink!.contractName}.ping()`]);
    expect(await sinkView(world, 'pinged', [])).toBe(6n);
    await settle(world, 'keeper', 'relaySize', [6n]);
    expect(await sinkView(world, 'amountOf', [6n])).toBe(33n);
  }, 600_000);

  it('forwards the value its own write before the call states, not the one the deployment holds', async () => {
    const world = await deployed();
    await settle(world, 'keeper', 'setAmount', [13n, 85n]);
    await settle(world, 'keeper', 'amountThenRelay', [13n, 7n]);
    expect(await sinkView(world, 'amountOf', [13n])).toBe(7n);
    // A key the mapping did not hold is created by the write, and the call forwards what it stored.
    await settle(world, 'keeper', 'nameThenRelay', [12n, SHORT_NAME]);
    expect(await sinkView(world, 'nameOf', [12n])).toBe(SHORT_NAME);
  }, 600_000);

  it('forwards the deployment\'s value when its own write lands after the call', async () => {
    const world = await deployed();
    await settle(world, 'keeper', 'setAmount', [14n, 85n]);
    await settle(world, 'keeper', 'relayThenSet', [14n, 99n]);
    expect(await sinkView(world, 'amountOf', [14n])).toBe(85n);
    await settle(world, 'keeper', 'relayAmount', [14n]);
    expect(await sinkView(world, 'amountOf', [14n])).toBe(99n);
  }, 600_000);

  it('routes an initialize through the address the initialize itself writes before the call', async () => {
    const world = await deployed();
    await world.deploy(Starter!, 'starter', [SINK, 7n]);
    expect(await sinkView(world, 'pinged', [])).toBe(7n);
  }, 600_000);

  it('forwards a value its own write before the call computes, as its own close of the node shows it', async () => {
    const world = await deployed();
    await settle(world, 'keeper', 'setAmount', [15n, 85n]);
    await settle(world, 'keeper', 'bumpThenRelay', [15n]);
    expect(await sinkView(world, 'amountOf', [15n])).toBe(86n);
  }, 600_000);

  it('is refused for a value a listing misreports: the transaction spends the node as it is', async () => {
    const world = await deployed();
    await settle(world, 'keeper', 'setAmount', [16n, 85n]);
    await expectRefused(world, 'keeper', 'relayAmount', [16n], /mandatory-script-verify-flag-failed/,
      misreporting(world, 16n, 86n));
    await settle(world, 'keeper', 'relayAmount', [16n]);
    expect(await sinkView(world, 'amountOf', [16n])).toBe(85n);
  }, 600_000);
});

describe('a call a reach routes through a value an earlier reach of the hop left', () => {
  it('forwards the integer an earlier reach rewrote, not the one the deployment holds', async () => {
    const world = await deployed();
    await settle(world, 'keeper', 'setAmount', [20n, 85n]);
    await settle(world, 'relay', 'setThenRelay', [20n, 5n]);
    expect(await sinkView(world, 'amountOf', [20n])).toBe(5n);
  }, 600_000);

  it('forwards the integer an earlier reach created at a key the mapping did not hold', async () => {
    const world = await deployed();
    await settle(world, 'relay', 'setThenRelay', [21n, 5n]);
    expect(await sinkView(world, 'amountOf', [21n])).toBe(5n);
  }, 600_000);

  it('refuses by name a call routed through a value an earlier reach computes and nothing learned', async () => {
    const world = await deployed();
    await settle(world, 'keeper', 'setAmount', [22n, 85n]);
    await expectRefused(world, 'relay', 'bumpThenRelay', [22n],
      'a call is routed through mapping "amounts" at a node an earlier reach of the hop leaves at a value its body '
      + 'computes, which the hop has not learned, so the call cannot be stated from it');
  }, 600_000);

  it('plans the later reach from the view a settle learned for the delegate frame that wrote the node', async () => {
    const world = await deployed();
    await settle(world, 'keeper', 'setAmount', [23n, 85n]);
    const relaySet = await readFramedDeployment(
      world.network, world.relay.proxyCategoryId, buildProxyArtifact(Relay!).stateLayout!);
    // The node the first reach rewrites, at the view a settle hands back for its delegate frame: the count raised.
    const slot = keyToSlotMulti([bigIntToVmNumber(23n)]);
    const held = ((await keeperDeployment(world)).nodesByCollection.get('amounts') ?? [])
      .map((utxo) => decodeEntryCommitment(hexToBin(utxo.token!.nft!.commitment)))
      .find((node) => bytesEqual(node.slot, slot));
    expect(held).toBeDefined();
    const learned = encodeEntryCommitment(slot, held!.nextKey, bigIntToVmNumber(86n));
    const plan = await planHopExternalCalls({
      provider: world.network, artifact: Relay!, functionName: 'bumpThenRelay', args: [23n],
      externals: world.externals, validatorProgram: VALIDATOR_PROGRAM,
      stateValues: deploymentStateValues(buildProxyArtifact(Relay!).stateLayout!, world.relay.proxyCategoryId, relaySet),
      selfAddress: world.relay.address, senderAddress: ALICE_LOCK,
      // The first reach's fallback frame and the delegate frame that runs its entry, in placement order.
      calleeWriteViews: new Map([['callee-impl-master-2', [learned]]]),
    });
    const relaying = plan.callees.find((callee) => callee.entry === 'relayAmount' && callee.recordOwner !== undefined);
    expect(relaying?.calls.map((call) => call.argumentPushes.slice(1).map(binToHex)))
      .toStrictEqual([[binToHex(bigIntToVmNumber(86n)), binToHex(bigIntToVmNumber(23n))]]);
  }, 600_000);
});
