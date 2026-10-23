import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { buildPushdataCommitment, bytesToHex, type StateLayout } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployMaster, readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry } from '../../../src/framed/proxy/deploy.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM } from '../shapes/harness.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * Calling an entry of a deployed framed implementation through the proxy in front of it.
 *
 * A user's coin enters the proxy's fallback, which forwards the call data to the address its record holds, and the
 * implementation's entry runs as a delegate frame on the proxy's records. The call is the same hop a deployment's
 * `initialize` is, on the deployment's own live outpoints, so this drives the shipped deployment, composer,
 * derivation and machine and then reads the state back through the shipped deployment reader and decoder.
 */

const IMPL_CATEGORY = '11'.repeat(31) + 'ee';
const PROXY_CATEGORY = '22'.repeat(31) + 'dd';

// The implementation declares the field the fallback forwards to beside the state its entries write: its own write
// rebuilds the record from its declaration, so the address has to be one of the fields that survives it.
const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Impl {'
  + '   address public implementation;'
  + '   uint public initialized;'
  + '   int public total;'
  + '   function initialize(address expected) {'
  + '     require(msg.sender == expected);'
  + '     require(this.initialized == 0);'
  + '     this.initialized = 1;'
  + '     this.total = 5;'
  + '   }'
  + '   function add(int by) { this.total = this.total + by; require(this.total >= 0); }'
  + '   function bump(int by) returns (int) {'
  + '     this.total = this.total + by;'
  + '     require(this.total >= 0);'
  + '     return by * 3;'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const impl = artifacts.Impl!;

// The shape whose fallback drops the delegated result, which a caller can still write by hand. Kept as a compiled
// artifact rather than the generated source so the refusal it trips stays pinned while the generated shape moves.
const BARE_PROXY_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract BareProxy {'
  + '   address public implementation;'
  + '   uint public initialized;'
  + '   int public total;'
  + '   fallback(bytes input) external { this.implementation.delegatecall(input); require(true); }'
  + ' }';
const bareProxy = compileStringMulti(BARE_PROXY_SOURCE, { composition: 'framed' }).BareProxy!;

/** The commitment the shipped encoder materializes from one state of a layout. */
function commitment(layout: StateLayout, state: Record<string, bigint | Uint8Array>): Uint8Array {
  return new Uint8Array(Buffer.from(buildPushdataCommitment(layout, state, 0), 'hex'));
}

/** The record's own state, read back through the shipped deployment reader and decoded as a field map. */
async function recordState(network: MockNetworkProvider, categoryId: string): Promise<string> {
  const deployment = await readFramedDeployment(network, categoryId, impl.stateLayout!);
  return bytesToHex(new Uint8Array(Buffer.from(deployment.records[0]!.token!.nft!.commitment, 'hex')));
}

/** The implementation's address at its seeded category, `addrV(category)`. */
function implementationAddress(): Uint8Array {
  return deployMaster(impl, new Uint8Array(Buffer.from(IMPL_CATEGORY, 'hex')), VALIDATOR_PROGRAM).address;
}

/** A deployment funded from the deployer's own P2PKH lock, plus two coins a caller can enter a hop with. */
async function deployedWithCallerCoins(
  network: MockNetworkProvider,
  proxyArtifact: typeof impl = buildProxyArtifact(impl),
): Promise<{
    readonly proxyArtifact: typeof impl;
    readonly proxyCategoryId: string;
    readonly implementationCategoryId: string;
    readonly deployerLock: Uint8Array;
    readonly changeAddress: string;
    readonly hopCoin: { txid: string; vout: number; satoshis: bigint };
    readonly callCoin: { txid: string; vout: number; satoshis: bigint };
    readonly funder: ReturnType<Contract['unlock']['spend']>;
  }> {
  const signature = new SignatureTemplate(alicePriv);
  const source = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = source.unlock.spend(alicePub, signature);
  // A hop's caller funding signs for its own P2PKH lock, which is the lock the root frame binds `msg.sender` to.
  const callerFunder = signature.unlockP2PKH();
  const implFunding = { txid: IMPL_CATEGORY, vout: 0, satoshis: 500_000n };
  const proxyFunding = { txid: PROXY_CATEGORY, vout: 0, satoshis: 500_000n };
  const hopCoin = { txid: '33'.repeat(32), vout: 0, satoshis: 300_000n };
  const callCoin = { txid: '44'.repeat(32), vout: 0, satoshis: 300_000n };
  for (const coin of [implFunding, proxyFunding]) await network.addUtxo(source.address, coin);
  // A hop's root frame binds `msg.sender` to the lock of the input it names, so the caller's own coins sit at that
  // 25-byte P2PKH lock rather than at the p2pkh contract's address.
  const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);
  for (const coin of [hopCoin, callCoin]) await network.addUtxo(binToHex(deployerLock), coin);
  // The hops broadcast, so each composition's facet input needs a live UTXO at the facet's lock.
  await fundShippedFacets(network);

  const deployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: impl,
    proxyArtifact,
    implementationDeploy: { fundingUtxo: implFunding, funder, changeAddress: source.address },
    proxyDeploy: { fundingUtxo: proxyFunding, funder, changeAddress: source.address },
    initialize: { functionName: 'initialize', args: [deployerLock] },
    callerLockingBytecode: deployerLock,
    callerFunding: { utxo: hopCoin, funder: callerFunder, changeAddress: source.address },
    vm: compositionMachine(),
  });
  expect(deployment.initialize.broadcast).toBeDefined();
  return {
    proxyArtifact,
    proxyCategoryId: deployment.proxy.categoryId,
    implementationCategoryId: deployment.implementation.categoryId,
    deployerLock, changeAddress: source.address, hopCoin, callCoin, funder: callerFunder,
  };
}

/** A deployment behind the generated proxy, on the network that holds it, and the chain as it stood when done. */
interface Deployed {
  readonly network: MockNetworkProvider;
  readonly funded: Awaited<ReturnType<typeof deployedWithCallerCoins>>;
  readonly snapshot: SnapshotRestorer;
}

let deployedRun: Promise<Deployed> | undefined;

/** The deployment the generated proxy's cases share, each rewinding the chain to it first. */
async function sharedDeployment(): Promise<Deployed> {
  deployedRun ??= (async (): Promise<Deployed> => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funded = await deployedWithCallerCoins(network);
    return { network, funded, snapshot: await network.takeSnapshot() };
  })();
  const deployed = await deployedRun;
  await deployed.snapshot.restore();
  return deployed;
}

describe('a call into a framed implementation through its proxy', () => {
  it('lays out the hop with no OP_RETURN and no bare OP_1 output', async () => {
    const { network, funded } = await sharedDeployment();

    // The deployment's own initialize hop ran on chain, so the state the entry computed is the state the next
    // call reads.
    const afterInitialize = await recordState(network, funded.proxyCategoryId);
    expect(afterInitialize).toBe(bytesToHex(commitment(impl.stateLayout!, {
      implementation: implementationAddress(), initialized: 1n, total: 5n,
    })));

    const result = await callFramedProxyEntry({
      provider: network,
      implementationArtifact: impl,
      proxyArtifact: funded.proxyArtifact,
      proxyCategoryId: funded.proxyCategoryId,
      implementationCategoryId: funded.implementationCategoryId,
      functionName: 'add',
      args: [4n],
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    });

    // The proxy's fallback frame is entered first and the implementation's entry completes before it.
    expect(result.completed.map((frame) => frame.functionName))
      .toStrictEqual([`${impl.contractName}.add()`, 'ImplProxy.__fallback()']);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(bytesToHex(result.writtenCommitments[0]!)).toBe(bytesToHex(commitment(impl.stateLayout!, {
      implementation: implementationAddress(), initialized: 1n, total: 9n,
    })));
    // A non-returning entry reports no value.
    expect(result.values).toStrictEqual([]);
    expect(result.retval).toStrictEqual(new Uint8Array(0));
    expect(result.value).toBe(0n);

    // A hop is a whole transaction the composer lays out, so its outputs are where the path's no-placeholder rule
    // shows: every output carries a positive value and a lock that is not anyone-can-spend, and none carries data.
    expect(result.transaction.outputs.length).toBeGreaterThan(0);
    const locks = result.transaction.outputs.map((output) => binToHex(output.lockingBytecode));
    expect(locks.filter((lock) => lock.startsWith('6a'))).toStrictEqual([]);
    expect(locks.filter((lock) => lock === '51')).toStrictEqual([]);
    expect(locks.filter((lock) => lock.length === 0)).toStrictEqual([]);
    expect(result.transaction.outputs.filter((output) => output.valueSatoshis <= 0n)).toStrictEqual([]);

    // The state the broadcast left behind, read back through the shipped reader rather than recomputed here.
    expect(await recordState(network, funded.proxyCategoryId))
      .toBe(bytesToHex(commitment(impl.stateLayout!, {
        implementation: implementationAddress(), initialized: 1n, total: 9n,
      })));
  });

  it('refuses an entry the implementation does not publish, and broadcasts nothing', async () => {
    const { network, funded } = await sharedDeployment();
    const callCoin = { txid: '44'.repeat(31) + 'c2', vout: 0, satoshis: 300_000n };
    await network.addUtxo(binToHex(funded.deployerLock), callCoin);
    const before = await recordState(network, funded.proxyCategoryId);

    await expect(callFramedProxyEntry({
      provider: network,
      implementationArtifact: impl,
      proxyArtifact: buildProxyArtifact(impl),
      proxyCategoryId: funded.proxyCategoryId,
      implementationCategoryId: funded.implementationCategoryId,
      functionName: 'noSuchEntry',
      args: [],
      callerUtxo: callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    })).rejects.toThrow(/publishes no entry "noSuchEntry"/);

    expect(await recordState(network, funded.proxyCategoryId)).toBe(before);
  });

  it('carries the value a returning entry computed through the generated closure shape', async () => {
    // The generated proxy's fallback consumes the delegated result, so the forwarded call records what the
    // implementation entry computed. The value is the implementation frame's own `retval`: `bump` returns `by * 3`,
    // which is not a field of any record, so only the entry's own answer explains the value the call reports.
    const { network, funded } = await sharedDeployment();

    const result = await callFramedProxyEntry({
      provider: network,
      implementationArtifact: impl,
      proxyArtifact: funded.proxyArtifact,
      proxyCategoryId: funded.proxyCategoryId,
      implementationCategoryId: funded.implementationCategoryId,
      functionName: 'bump',
      args: [4n],
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    });

    expect(result.completed.map((frame) => frame.functionName))
      .toStrictEqual([`${impl.contractName}.bump()`, 'ImplProxy.__fallback()']);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(result.values).toStrictEqual([12n]);
    expect(result.value).toBe(12n);
    expect(result.retval.length).toBeGreaterThan(0);
    // The record still carries the write the entry computed, which is not the value it returned.
    expect(bytesToHex(result.writtenCommitments[0]!)).toBe(bytesToHex(commitment(impl.stateLayout!, {
      implementation: implementationAddress(), initialized: 1n, total: 9n,
    })));
  });

  it('refuses a returning entry through a fallback that records no result, naming that shape', async () => {
    // A fallback that drops the delegated result with a bare `delegatecall(input)` statement binds the call record's
    // result to empty while the implementation frame records the value it computed; the two cannot both hold. The
    // refusal names the proxy shape rather than the value being lost silently.
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funded = await deployedWithCallerCoins(network, bareProxy);
    const before = await recordState(network, funded.proxyCategoryId);

    await expect(callFramedProxyEntry({
      provider: network,
      implementationArtifact: impl,
      proxyArtifact: funded.proxyArtifact,
      proxyCategoryId: funded.proxyCategoryId,
      implementationCategoryId: funded.implementationCategoryId,
      functionName: 'bump',
      args: [4n],
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    })).rejects.toThrow(/returns a value, which a call through this proxy hop does not carry/);

    expect(await recordState(network, funded.proxyCategoryId)).toBe(before);
  });
});
