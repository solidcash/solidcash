import { describe, expect, it } from 'vitest';
import {
  binToHex, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hexToBin, utf8ToBin,
} from '@bitauth/libauth';
import { bytesToHex, encodeIntegerValue, hash256, validatorAddress, type Artifact } from '@solidcash/utils';
import { framedValidator } from '@solidcash/solidc';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry } from '../../../src/framed/proxy/deploy.js';
import { decodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';

/**
 * A proxied entry that writes a sorted-mapping record and makes external calls in the same body.
 *
 * A call closes the witness segment the code before it runs in, so the entry's write lands in one segment of the
 * frame's many. The compiler knows which and publishes it for the entry — the count of calls before the write, or
 * the run's last segment when every call precedes it — so the hop declares the write's records in that one segment
 * instead of refusing the entry. The whole shipped path runs: the deployment through `deployFramedProxy`, the call
 * through `callFramedProxyEntry`, and the machine's verdict on every participant is the assertion.
 */

const VALIDATOR_PROGRAM = framedValidator.buildValidatorProgram();
const IMPL_CATEGORY = '11'.repeat(31) + 'ee';
const PROXY_CATEGORY = '22'.repeat(31) + 'dd';
const ORACLE_CATEGORY = '55'.repeat(31) + 'aa';
const ESCROW_CATEGORY = '66'.repeat(31) + '99';
const ORACLE_ADDRESS = validatorAddress(hexToBin(ORACLE_CATEGORY), VALIDATOR_PROGRAM);
const ESCROW_ADDRESS = validatorAddress(hexToBin(ESCROW_CATEGORY), VALIDATOR_PROGRAM);
const hexOf = (bytes: Uint8Array): string => binToHex(bytes);
/** What the composer's plan gives each facet input; a facet holds no token and pays its own fee share. */
const FACET_SATOSHIS = 10_000n;
const ID = 7n;
const AWARD = ID + 100n;

// `record` writes the award first, then makes an unguarded call and reaches a guarded site.
const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IOracle { function amountOf(int id) view returns (int); }'
  + ' interface IEscrow { function settle(int id); }'
  + ' contract Oracle {'
  + '   int public answer;'
  + '   constructor() { this.answer = 5; }'
  + '   function amountOf(int id) view returns (int) { return this.answer + id; }'
  + ' }'
  + ' contract Escrow { int public touched; function settle(int id) { require(this.touched == 0); require(id > 0); } }'
  + ' contract Impl {'
  + '   address public implementation;'
  + '   uint public initialized;'
  + '   mapping(int => int) awarded;'
  + '   function initialize(address expected) { require(msg.sender == expected); this.initialized = 1; }'
  + '   function record(int id) {'
  + '     this.awarded[id] = id + 100;'
  + `     IEscrow(0x${hexOf(ESCROW_ADDRESS)}).settle(id);`
  + `     if (id > 0) { require(IOracle(0x${hexOf(ORACLE_ADDRESS)}).amountOf(id) > 0); }`
  + '     require(true);'
  + '   }'
  + '   function awardOf(int id) view returns (int) { return this.awarded[id]; }'
  + ' }';

/** The key a first call writes, so a later `record(ID)` splices in beside a node the collection holds. */
const HELD_ID = 1n;

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const impl = artifacts.Impl!;
const oracle = artifacts.Oracle!;
const escrow = artifacts.Escrow!;

/** The segment the artifact publishes for the entry's own record write. */
function publishedWriteSegment(artifact: Artifact, functionName: string): number | 'last' | undefined {
  return artifact.composition?.stopSites?.entries
    .find((entry) => entry.functionName === `${artifact.contractName}.${functionName}()`)?.writeSegment;
}

/** The contracts the entry calls, keyed by the interface each call goes through. */
function externals(): Readonly<Record<string, { artifact: Artifact; categoryId: string }>> {
  return {
    IOracle: { artifact: oracle, categoryId: ORACLE_CATEGORY },
    IEscrow: { artifact: escrow, categoryId: ESCROW_CATEGORY },
  };
}

/** Deploys a callee at `categoryId`, so a hop's call has a live deployment to run against. */
async function deployCallee(
  network: MockNetworkProvider, artifact: Artifact, categoryId: string,
): Promise<void> {
  const signature = new SignatureTemplate(alicePriv);
  const source = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = source.unlock.spend(alicePub, signature);
  const funding = { txid: categoryId, vout: 0, satoshis: 500_000n };
  await network.addUtxo(source.address, funding);
  await deployStatefulContract(artifact, [], {
    fundingUtxo: funding, funder, changeAddress: source.address, provider: network,
  });
}

/**
 * Deploys both callees, then the implementation and its proxy, and broadcasts the initialize hop.
 *
 * The callees are deployed at the categories the implementation's address literals were compiled from, so each
 * call's target names the address the deployed callee actually presents.
 */
async function deployedWithCallees(network: MockNetworkProvider): Promise<{
  readonly proxyCategoryId: string;
  readonly implementationCategoryId: string;
  readonly deployerLock: Uint8Array;
  readonly changeAddress: string;
  readonly callCoin: { txid: string; vout: number; satoshis: bigint };
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
}> {
  const signature = new SignatureTemplate(alicePriv);
  const source = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = source.unlock.spend(alicePub, signature);
  const callerFunder = signature.unlockP2PKH();
  const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);

  for (const [artifact, categoryId] of [[oracle, ORACLE_CATEGORY], [escrow, ESCROW_CATEGORY]] as const) {
    await deployCallee(network, artifact, categoryId);
  }

  // The validator runs as a head plus one input per facet, each locked by its own code and holding no token, so
  // any live UTXO at the facet's lock serves it.
  const facets = framedValidator.buildValidatorFacets();
  for (const [index, code] of facets.entries()) {
    await network.addUtxo(hexOf(encodeLockingBytecodeP2sh32(hash256(code))), {
      txid: (0x70 + index).toString(16).padStart(2, '0').repeat(32), vout: 0, satoshis: FACET_SATOSHIS,
    });
  }

  const implFunding = { txid: IMPL_CATEGORY, vout: 0, satoshis: 500_000n };
  const proxyFunding = { txid: PROXY_CATEGORY, vout: 0, satoshis: 500_000n };
  const hopCoin = { txid: '33'.repeat(32), vout: 0, satoshis: 300_000n };
  const callCoin = { txid: '44'.repeat(32), vout: 0, satoshis: 300_000n };
  for (const coin of [implFunding, proxyFunding]) await network.addUtxo(source.address, coin);
  for (const coin of [hopCoin, callCoin]) await network.addUtxo(hexOf(deployerLock), coin);

  const deployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: impl,
    proxyArtifact: buildProxyArtifact(impl),
    implementationDeploy: { fundingUtxo: implFunding, funder, changeAddress: source.address },
    proxyDeploy: { fundingUtxo: proxyFunding, funder, changeAddress: source.address },
    initialize: { functionName: 'initialize', args: [deployerLock] },
    callerLockingBytecode: deployerLock,
    callerFunding: { utxo: hopCoin, funder: callerFunder, changeAddress: source.address },
    vm: compositionMachine(),
  });
  expect(deployment.initialize.broadcast).toBeDefined();
  return {
    proxyCategoryId: deployment.proxy.categoryId,
    implementationCategoryId: deployment.implementation.categoryId,
    deployerLock, changeAddress: source.address, callCoin, funder: callerFunder,
  };
}

type Funded = Awaited<ReturnType<typeof deployedWithCallees>>;

/** The deployment the cases share, and the chain as it stood when it was done. */
interface World {
  readonly network: MockNetworkProvider;
  readonly funded: Funded;
  readonly snapshot: SnapshotRestorer;
}

let worldRun: Promise<World> | undefined;

/** One deployment serves both cases, each rewinding the chain to it first, so no case reads another's broadcast. */
async function deployed(): Promise<World> {
  worldRun ??= (async (): Promise<World> => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funded = await deployedWithCallees(network);
    return { network, funded, snapshot: await network.takeSnapshot() };
  })();
  const world = await worldRun;
  await world.snapshot.restore();
  return world;
}

/** Enters `record(id)` through the hop with the caller's coin. */
function record(
  network: MockNetworkProvider, funded: Funded, id: bigint, callerUtxo: Funded['callCoin'] = funded.callCoin,
): ReturnType<typeof callFramedProxyEntry> {
  return callFramedProxyEntry({
    provider: network,
    implementationArtifact: impl,
    proxyArtifact: buildProxyArtifact(impl),
    proxyCategoryId: funded.proxyCategoryId,
    implementationCategoryId: funded.implementationCategoryId,
    functionName: 'record',
    args: [id],
    externals: externals(),
    callerUtxo,
    callerLockingBytecode: funded.deployerLock,
    funder: funded.funder,
    changeAddress: funded.changeAddress,
    vm: compositionMachine(),
  });
}

/** The mapping node's value the hop writes, found among the transaction's outputs by the slot the key names. */
function writtenAward(transaction: { readonly outputs: readonly { readonly token?: { readonly nft?: {
  readonly commitment?: Uint8Array } } }[] }): Uint8Array | undefined {
  const slot = bytesToHex(keyToSlotMulti([encodeIntegerValue(ID)]));
  for (const output of transaction.outputs) {
    const commitment = output.token?.nft?.commitment;
    if (commitment === undefined) continue;
    const decoded = decodeEntryCommitment(commitment);
    if (bytesToHex(decoded.slot) === slot) return new Uint8Array(decoded.value);
  }
  return undefined;
}

describe('a proxied entry that writes a sorted-mapping record beside external calls', () => {
  it('settles the record, runs every callee and broadcasts the hop', async () => {
    // The artifact publishes the segment the entry's own write lands in, which is the frame's opening one: the
    // write precedes every call the entry makes.
    expect(publishedWriteSegment(impl, 'record')).toBe(0);

    const { network, funded } = await deployed();
    const result = await record(network, funded, ID);

    // Both callees run before the entry that called them, which runs before the fallback that entered it.
    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual([
      `${escrow.contractName}.settle()`, `${oracle.contractName}.amountOf()`,
      `${impl.contractName}.record()`, 'ImplProxy.__fallback()',
    ]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    // The node the entry's own body computed carries the award it wrote, at the slot the call data's key names.
    expect(bytesToHex(writtenAward(result.transaction)!)).toBe(bytesToHex(encodeIntegerValue(AWARD)));
  });

  it('settles an insert spliced through a node the collection holds, the predecessor spent beside the calls', async () => {
    // The guarded call makes the number of calls a fact of the run, so the body walks the segment its run reached.
    // The insert's predecessor is a live node the transaction spends: the write's segment relinks it and the later
    // segments keep it at the relinked view, so the batch's verification has to read the write's own segment
    // rather than the one the run ends in, or it compares the relinked successor with the one it spliced against.
    const { network, funded } = await deployed();
    expect((await record(network, funded, HELD_ID)).broadcast).toBeDefined();
    const coin = { txid: binToHex(hash256(utf8ToBin('record write beside calls, held'))), vout: 0, satoshis: 300_000n };
    await network.addUtxo(hexOf(funded.deployerLock), coin);
    const result = await record(network, funded, ID, coin);

    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    // The predecessor is a node the transaction spends, recreated where it was spent and relinked to the new key.
    const slot = keyToSlotMulti([encodeIntegerValue(ID)]);
    const spentNodes = result.draft.layout.participants
      .filter((placed) => placed.id.startsWith('mapping-head-') || placed.id.startsWith('mapping-node-'));
    expect(spentNodes).toHaveLength(1);
    const relinked = decodeEntryCommitment(
      Uint8Array.from(result.transaction.outputs[spentNodes[0]!.index]!.token!.nft!.commitment!));
    expect(bytesToHex(relinked.nextKey)).toBe(bytesToHex(slot));
    expect(bytesToHex(writtenAward(result.transaction)!)).toBe(bytesToHex(encodeIntegerValue(AWARD)));
  });
});
