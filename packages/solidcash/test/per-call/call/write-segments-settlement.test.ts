import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256, hexToBin } from '@bitauth/libauth';
import {
  buildPushdataCommitment, bytesToHex, encodeIntegerValue, validatorAddress, type Artifact,
  type PublishedWriteSegment,
} from '@solidcash/utils';
import { perCallValidator } from 'solidc';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate, encodeFunctionArgument } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { stateRecordLockingBytecode } from '../../../src/per-call/deploy/index.js';
import { buildProxyArtifact, deployPerCallProxy } from '../../../src/per-call/proxy/index.js';
import { callPerCallProxyEntry } from '../../../src/per-call/proxy/deploy.js';
import { decodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';

/**
 * A proxied entry whose writes land in different segments of the frame's own.
 *
 * A call closes the segment the code before it runs in, so an entry that writes a sorted mapping's node and then
 * its own record beside a call it makes declares the two writes in different segments. The artifact publishes the
 * segment of each write, and the hop declares each write's records in its own segment instead of refusing the
 * entry. A batch and the run of chunk records a dynamic write grows have to share a segment, because a frame reads
 * that run past the records its own block declares; a plan that would split them keeps a named refusal.
 *
 * The whole shipped path runs: the deployment through `deployPerCallProxy`, the call through
 * `callPerCallProxyEntry`, and the machine's verdict on every participant is the assertion.
 */

const VALIDATOR_PROGRAM = perCallValidator.buildValidatorProgram();
const IMPL_CATEGORY = '11'.repeat(32);
const PROXY_CATEGORY = '22'.repeat(32);
const ESCROW_CATEGORY = '66'.repeat(32);
const ESCROW_ADDRESS = validatorAddress(hexToBin(ESCROW_CATEGORY), VALIDATOR_PROGRAM);
const hexOf = (bytes: Uint8Array): string => binToHex(bytes);
/** What the composer's plan gives each facet input; a facet holds no token and pays its own fee share. */
const FACET_SATOSHIS = 10_000n;
const AMOUNT = 42n;

// `record` writes its mapping's node first, makes a call, and then writes its own record: the call closes the
// segment the mapping's records are declared in.
const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' interface IEscrow { function settle(int amount); }'
  + ' contract Escrow {'
  + '   int public touched;'
  + '   function settle(int amount) { require(this.touched == 0); require(amount > 0); }'
  + ' }'
  + ' contract Impl {'
  + '   address public implementation;'
  + '   uint public initialized;'
  + '   uint public total;'
  + '   mapping(address => uint) awarded;'
  + '   function initialize(address expected) { require(msg.sender == expected); this.initialized = 1; }'
  + '   function record(address to, uint amount) {'
  + '     this.awarded[to] = amount;'
  + `     IEscrow(0x${hexOf(ESCROW_ADDRESS)}).settle(amount);`
  + '     this.total = amount;'
  + '     require(true);'
  + '   }'
  + ' }';

// The same body beside a dynamic value's write: the run that write grows is pinned in the last segment, so the
// mapping's records and the run would land in different segments, which the hop refuses by name.
const DYNAMIC_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' interface IEscrow { function settle(int amount); }'
  + ' contract Escrow {'
  + '   int public touched;'
  + '   function settle(int amount) { require(this.touched == 0); require(amount > 0); }'
  + ' }'
  + ' contract Impl {'
  + '   address public implementation;'
  + '   uint public initialized;'
  + '   string[] public names;'
  + '   mapping(address => uint) awarded;'
  + '   function initialize(address expected) { require(msg.sender == expected); this.initialized = 1; }'
  + '   function record(address to, uint amount) {'
  + '     this.awarded[to] = amount;'
  + `     IEscrow(0x${hexOf(ESCROW_ADDRESS)}).settle(amount);`
  + '     this.names.push("hi");'
  + '     require(true);'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'per-call' });
const impl = artifacts.Impl!;
const escrow = artifacts.Escrow!;
const dynamicArtifacts = compileStringMulti(DYNAMIC_SOURCE, { composition: 'per-call' });
const dynamicImpl = dynamicArtifacts.Impl!;

/** One write as the artifact publishes it. */
type PublishedWrite = PublishedWriteSegment;

/** The write facts the artifact publishes for one entry. */
function publishedWrites(artifact: Artifact, functionName: string): {
  readonly single?: number | 'last'; readonly writes?: readonly PublishedWrite[];
} {
  const entry = artifact.composition?.stopSites?.entries.find((candidate) =>
    candidate.functionName === `${artifact.contractName}.${functionName}()`);
  return {
    ...(entry?.writeSegment === undefined ? {} : { single: entry.writeSegment }),
    ...(entry?.writeSegments === undefined ? {} : { writes: entry.writeSegments }),
  };
}

/** The contracts the entry calls, keyed by the interface each call goes through. */
function externals(): Readonly<Record<string, { artifact: Artifact; categoryId: string }>> {
  return { IEscrow: { artifact: escrow, categoryId: ESCROW_CATEGORY } };
}

/** The commitment the shipped encoder materializes from one state of a layout. */
function commitment(artifact: Artifact, state: Record<string, bigint | Uint8Array>): Uint8Array {
  return new Uint8Array(Buffer.from(buildPushdataCommitment(artifact.stateLayout!, state, 0), 'hex'));
}

/** Deploys the escrow the entry calls, then the implementation and its proxy, and runs the initialize hop. */
async function deployed(
  network: MockNetworkProvider, implementation: Artifact,
): Promise<{
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

  const escrowFunding = { txid: ESCROW_CATEGORY, vout: 0, satoshis: 500_000n };
  await network.addUtxo(source.address, escrowFunding);
  await deployStatefulContract(escrow, [], {
    fundingUtxo: escrowFunding, funder, changeAddress: source.address, provider: network,
  });

  // The validator runs as a head plus one input per facet, each locked by its own code and holding no token, so
  // any live UTXO at the facet's lock serves it.
  const facets = perCallValidator.buildValidatorFacets();
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

  const deployment = await deployPerCallProxy({
    provider: network,
    implementationArtifact: implementation,
    proxyArtifact: buildProxyArtifact(implementation),
    implementationDeploy: { fundingUtxo: implFunding, funder, changeAddress: source.address },
    proxyDeploy: { fundingUtxo: proxyFunding, funder, changeAddress: source.address },
    initialize: { functionName: 'initialize', args: [deployerLock] },
    callerLockingBytecode: deployerLock,
    callerFunding: { utxo: hopCoin, funder: callerFunder, changeAddress: source.address },
    vm: compositionMachine(),
  });
  expect(deployment.initialize.accepted).toBe(true);
  return {
    proxyCategoryId: deployment.proxy.categoryId,
    implementationCategoryId: deployment.implementation.categoryId,
    deployerLock, changeAddress: source.address, callCoin, funder: callerFunder,
  };
}

/** The mapping node's value the hop writes, found among the transaction's outputs by the slot the key names. */
function writtenAward(transaction: { readonly outputs: readonly { readonly token?: { readonly nft?: {
  readonly commitment?: Uint8Array } } }[] }): Uint8Array | undefined {
  // The key the frame's body hashes is the locking bytecode the shipped encoder gives the argument, so the lookup
  // keys the same way rather than by the caller's raw 20-byte spelling.
  const slot = bytesToHex(keyToSlotMulti([encodeFunctionArgument(alicePkh, 'address') as Uint8Array]));
  for (const output of transaction.outputs) {
    const commitmentBytes = output.token?.nft?.commitment;
    if (commitmentBytes === undefined) continue;
    const decoded = decodeEntryCommitment(commitmentBytes);
    if (bytesToHex(decoded.slot) === slot) return new Uint8Array(decoded.value);
  }
  return undefined;
}

describe('a proxied entry whose writes land in different segments', () => {
  it('publishes a segment per write, with no single fact for the entry', () => {
    // The mapping write precedes the entry's call, so its records are declared in the frame's opening segment and
    // the record the entry writes after the call is declared in the segment the call opened. No one fact states
    // both, so none is published for the entry, and each write names its own.
    expect(publishedWrites(impl, 'record').single).toBeUndefined();
    expect(publishedWrites(impl, 'record').writes).toStrictEqual([
      { collection: 'awarded', segment: 0 },
      { record: 0, segment: 1, writtenVariables: ['total'] },
    ]);
  });

  it('settles both writes, runs the callee and broadcasts the hop', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funded = await deployed(network, impl);

    const result = await callPerCallProxyEntry({
      provider: network,
      implementationArtifact: impl,
      proxyArtifact: buildProxyArtifact(impl),
      proxyCategoryId: funded.proxyCategoryId,
      implementationCategoryId: funded.implementationCategoryId,
      functionName: 'record',
      args: [alicePkh, AMOUNT],
      externals: externals(),
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    });

    // The callee runs before the entry that called it, which runs before the fallback that entered it.
    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual([
      `${escrow.contractName}.settle()`, `${impl.contractName}.record()`, 'ImplProxy.__fallback()',
    ]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);

    // The node the entry's batch wrote carries the award, at the slot the call data's key names.
    expect(bytesToHex(writtenAward(result.transaction)!))
      .toBe(bytesToHex(encodeIntegerValue(AMOUNT)));

    // And the record the entry wrote in the next segment holds the amount, beside the fields the deployment left.
    const implementationAddress = validatorAddress(hexToBin(IMPL_CATEGORY), VALIDATOR_PROGRAM);
    const written = commitment(impl, {
      implementation: implementationAddress, initialized: 1n, total: AMOUNT,
    });
    expect(bytesToHex(result.writtenCommitments[0]!)).toBe(bytesToHex(written));
    const recordOutput = result.transaction.outputs.find((output) =>
      bytesToHex(output.lockingBytecode) === bytesToHex(stateRecordLockingBytecode(funded.proxyCategoryId)));
    expect(bytesToHex(recordOutput?.token?.nft?.commitment ?? new Uint8Array(0))).toBe(bytesToHex(written));
  });

  it('keeps a named refusal for an entry whose batch and dynamic run cannot share a segment', async () => {
    // The run a dynamic write grows is read past the records the body's own block declares, so a plan that declares
    // the batch's records in another segment has nowhere to put them: the hop refuses the entry by name instead.
    expect(publishedWrites(dynamicImpl, 'record').writes).toStrictEqual([
      { collection: 'awarded', segment: 0 },
      { record: 0, segment: 'last', writtenVariables: ['names'] },
      { variable: 'names', segment: 'last' },
    ]);
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funded = await deployed(network, dynamicImpl);
    await expect(callPerCallProxyEntry({
      provider: network,
      implementationArtifact: dynamicImpl,
      proxyArtifact: buildProxyArtifact(dynamicImpl),
      proxyCategoryId: funded.proxyCategoryId,
      implementationCategoryId: funded.implementationCategoryId,
      functionName: 'record',
      args: [alicePkh, AMOUNT],
      externals: externals(),
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    })).rejects.toThrow(
      /declares its mapping's records in segment 0 and the run of chunk records its dynamic write grows in segment 1/,
    );
  });
});
