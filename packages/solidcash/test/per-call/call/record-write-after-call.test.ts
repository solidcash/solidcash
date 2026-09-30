import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hexToBin } from '@bitauth/libauth';
import {
  buildPushdataCommitment, bytesToHex, hash256, validatorAddress, type Artifact, type StateLayout,
} from '@solidcash/utils';
import { perCallValidator } from 'solidc';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { stateRecordLockingBytecode } from '../../../src/per-call/deploy/index.js';
import { buildProxyArtifact, deployPerCallProxy } from '../../../src/per-call/proxy/index.js';
import { callPerCallProxyEntry } from '../../../src/per-call/proxy/deploy.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';

/**
 * A proxied entry that makes an external call and then writes its own record in the following segment.
 *
 * A call closes the witness segment the code before it runs in, so the record write lands in the second segment of
 * the frame's two. The artifact publishes that segment for the entry, and the hop declares the record kept in the
 * segments before it and written in it, so the entry settles instead of being refused. The whole shipped path
 * runs: the deployment through `deployPerCallProxy`, the call through `callPerCallProxyEntry`, and the machine's
 * verdict on every participant is the assertion.
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

// `recordAfter` makes one unguarded call and then writes the record the call precedes.
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
  + '   function initialize(address expected) { require(msg.sender == expected); this.initialized = 1; }'
  + '   function recordAfter(int amount) {'
  + `     IEscrow(0x${hexOf(ESCROW_ADDRESS)}).settle(amount);`
  + '     this.total = uint(amount);'
  + '     require(true);'
  + '   }'
  + '   function recordFirst(int amount) {'
  + '     this.total = uint(amount);'
  + `     IEscrow(0x${hexOf(ESCROW_ADDRESS)}).settle(amount);`
  + '     require(true);'
  + '   }'
  + '   function totalOf() view returns (uint) { return this.total; }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'per-call' });
const impl = artifacts.Impl!;
const escrow = artifacts.Escrow!;

/** The segment the artifact publishes for the entry's own record write. */
function publishedWriteSegment(artifact: Artifact, functionName: string): number | 'last' | undefined {
  const entries = (artifact.composition as {
    readonly stopSites?: {
      readonly entries?: readonly { readonly functionName?: string; readonly writeSegment?: number | 'last' }[];
    };
  } | undefined)?.stopSites?.entries;
  return entries?.find((entry) => entry.functionName === `${artifact.contractName}.${functionName}()`)
    ?.writeSegment;
}

/** The commitment the shipped encoder materializes from one state of a layout. */
function commitment(layout: StateLayout, state: Record<string, bigint | Uint8Array>): Uint8Array {
  return new Uint8Array(Buffer.from(buildPushdataCommitment(layout, state, 0), 'hex'));
}

/** The implementation's own address at its seeded category, which the proxy's record holds. */
function implementationAddress(): Uint8Array {
  return validatorAddress(hexToBin(IMPL_CATEGORY), VALIDATOR_PROGRAM);
}

/** The contracts the entry calls, keyed by the interface each call goes through. */
function externals(): Readonly<Record<string, { artifact: Artifact; categoryId: string }>> {
  return { IEscrow: { artifact: escrow, categoryId: ESCROW_CATEGORY } };
}

/** Deploys the escrow the entry calls, then the implementation and its proxy, and broadcasts the initialize hop. */
async function deployed(network: MockNetworkProvider): Promise<{
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

/** A deployment with the escrow it calls, on the network that holds it. */
interface Deployed {
  readonly network: MockNetworkProvider;
  readonly funded: Awaited<ReturnType<typeof deployed>>;
}

let deployedRun: Promise<Deployed> | undefined;

/**
 * The one deployment both cases share: the first call enters with the coin it funded, a later one with a fresh coin
 * at `txid`. Each entry writes the amount outright, so neither reads what the other wrote.
 */
async function sharedDeployment(txid?: string): Promise<Deployed> {
  deployedRun ??= (async (): Promise<Deployed> => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    return { network, funded: await deployed(network) };
  })();
  const shared = await deployedRun;
  if (txid === undefined) return shared;
  const callCoin = { txid, vout: 0, satoshis: 300_000n };
  await shared.network.addUtxo(hexOf(shared.funded.deployerLock), callCoin);
  return { network: shared.network, funded: { ...shared.funded, callCoin } };
}

describe('a proxied entry that writes its own record after an external call', () => {
  it('settles the record in the segment the call opened and broadcasts the hop', async () => {
    // The artifact publishes the segment the entry's own write lands in: the call before it opens the second one.
    expect(publishedWriteSegment(impl, 'recordAfter')).toBe(1);

    const { network, funded } = await sharedDeployment();

    const result = await callPerCallProxyEntry({
      provider: network,
      implementationArtifact: impl,
      proxyArtifact: buildProxyArtifact(impl),
      proxyCategoryId: funded.proxyCategoryId,
      implementationCategoryId: funded.implementationCategoryId,
      functionName: 'recordAfter',
      args: [AMOUNT],
      externals: externals(),
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    });

    // The callee runs before the entry that called it, which runs before the fallback that entered it.
    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual([
      `${escrow.contractName}.settle()`, `${impl.contractName}.recordAfter()`, 'ImplProxy.__fallback()',
    ]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    // The record the entry wrote holds the amount, beside the fields the deployment's own hop left.
    const written = commitment(impl.stateLayout!, {
      implementation: implementationAddress(), initialized: 1n, total: AMOUNT,
    });
    expect(bytesToHex(result.writtenCommitments[0]!)).toBe(bytesToHex(written));
    // And the record the transaction actually carries, read back from the hop's own outputs, holds the same value.
    const recordLock = stateRecordLockingBytecode(funded.proxyCategoryId);
    const recordOutput = result.transaction.outputs.find(
      (output) => bytesToHex(output.lockingBytecode) === bytesToHex(recordLock),
    );
    expect(bytesToHex(recordOutput?.token?.nft?.commitment ?? new Uint8Array(0))).toBe(bytesToHex(written));
  });

  it('settles a record the entry writes before its call, which the same plan places in the first segment', async () => {
    expect(publishedWriteSegment(impl, 'recordFirst')).toBe(0);
    const { network, funded } = await sharedDeployment('44'.repeat(31) + 'c2');
    const result = await callPerCallProxyEntry({
      provider: network,
      implementationArtifact: impl,
      proxyArtifact: buildProxyArtifact(impl),
      proxyCategoryId: funded.proxyCategoryId,
      implementationCategoryId: funded.implementationCategoryId,
      functionName: 'recordFirst',
      args: [AMOUNT],
      externals: externals(),
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    });
    expect(result.accepted).toBe(true);
  });
});
