import { describe, expect, it } from 'vitest';
import { binToHex, decodeTransaction, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { buildPushdataCommitment, bytesToHex, type StateLayout } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import {
  Contract,
  SignatureTemplate,
} from '../../../src/index.js';
import { providerUnixLocktime } from '../../../src/stateful/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployMaster, readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry } from '../../../src/framed/proxy/deploy.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * A framed hop carries the chain's current time as its nLocktime.
 *
 * An entry that writes `tx.locktime` into state only records a real value when the hop's plan states one. The
 * plan's locktime comes from the provider through the deployment layer's own `providerUnixLocktime` (the tip,
 * one second behind), so no clock is invented here. The plan also states a non-final sequence, because
 * `OP_CHECKLOCKTIMEVERIFY` refuses a final input and the compiler injects a guard for every `tx.locktime` read.
 *
 * The contract is deployed and entered through the shipped proxy hop, and the stored record is read back with
 * the shipped deployment reader: the state, not a re-derivation, is what the assertion checks.
 */

const IMPL_CATEGORY = '11'.repeat(31) + 'ee';
const PROXY_CATEGORY = '22'.repeat(31) + 'dd';

// `evmCompat` is the mode the ported contracts (and the marketplace project) compile under.
const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Clock {'
  + '   address public implementation;'
  + '   uint32 public stamped;'
  + '   function initialize(address expected) { require(msg.sender == expected); }'
  + '   function stamp() { this.stamped = uint32(tx.locktime); require(true); }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true });
const impl = artifacts.Clock!;

/** The commitment the shipped encoder materializes from one state of a layout. */
function commitment(layout: StateLayout, state: Record<string, bigint | Uint8Array>): Uint8Array {
  return new Uint8Array(Buffer.from(buildPushdataCommitment(layout, state, 0), 'hex'));
}

/** The implementation's address at its seeded category, `addrV(category)`. */
function implementationAddress(): Uint8Array {
  return deployMaster(impl, new Uint8Array(Buffer.from(IMPL_CATEGORY, 'hex')), VALIDATOR_PROGRAM).address;
}

/** The record's own state, read back through the shipped deployment reader. */
async function recordCommitment(network: MockNetworkProvider, categoryId: string): Promise<string> {
  const deployment = await readFramedDeployment(network, categoryId, impl.stateLayout!);
  return bytesToHex(new Uint8Array(Buffer.from(deployment.records[0]!.token!.nft!.commitment, 'hex')));
}

interface Deployed {
  readonly network: MockNetworkProvider;
  readonly proxyCategoryId: string;
  readonly implementationCategoryId: string;
  readonly callerLock: Uint8Array;
  readonly changeAddress: string;
  callCoin: { txid: string; vout: number; satoshis: bigint };
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
}

/** A deployment behind the generated proxy, with a coin the caller enters the stamp hop with. */
async function deployClock(): Promise<Deployed> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, signature);
  const callerLock = encodeLockingBytecodeP2pkh(alicePkh);
  const implFunding = { txid: IMPL_CATEGORY, vout: 0, satoshis: 500_000n };
  const proxyFunding = { txid: PROXY_CATEGORY, vout: 0, satoshis: 500_000n };
  const hopCoin = { txid: '33'.repeat(32), vout: 0, satoshis: 300_000n };
  const callCoin = { txid: '44'.repeat(32), vout: 0, satoshis: 300_000n };
  for (const coin of [implFunding, proxyFunding]) await network.addUtxo(wallet.address, coin);
  for (const coin of [hopCoin, callCoin]) await network.addUtxo(binToHex(callerLock), coin);
  // The hops broadcast, so each composition's facet input needs a live UTXO at the facet's lock.
  await fundShippedFacets(network);

  const deployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: impl,
    proxyArtifact: buildProxyArtifact(impl),
    implementationDeploy: { fundingUtxo: implFunding, funder, changeAddress: wallet.address },
    proxyDeploy: { fundingUtxo: proxyFunding, funder, changeAddress: wallet.address },
    initialize: { functionName: 'initialize', args: [callerLock] },
    callerLockingBytecode: callerLock,
    callerFunding: { utxo: hopCoin, funder: signature.unlockP2PKH(), changeAddress: wallet.address },
    vm: compositionMachine(),
  });
  expect(deployment.initialize.broadcast).toBeDefined();
  return {
    network,
    proxyCategoryId: deployment.proxy.categoryId,
    implementationCategoryId: deployment.implementation.categoryId,
    callerLock,
    changeAddress: wallet.address,
    callCoin,
    funder: signature.unlockP2PKH(),
  };
}

/** The stamp hop, entered on the proxy through the shipped path. */
async function stamp(deployed: Deployed): Promise<Awaited<ReturnType<typeof callFramedProxyEntry>>> {
  return callFramedProxyEntry({
    provider: deployed.network,
    implementationArtifact: impl,
    proxyArtifact: buildProxyArtifact(impl),
    proxyCategoryId: deployed.proxyCategoryId,
    implementationCategoryId: deployed.implementationCategoryId,
    functionName: 'stamp',
    args: [],
    callerUtxo: deployed.callCoin,
    callerLockingBytecode: deployed.callerLock,
    funder: deployed.funder,
    changeAddress: deployed.changeAddress,
    vm: compositionMachine(),
  });
}

describe('a framed hop states the chain time as its nLocktime', () => {
  it('stores the stated locktime and broadcasts it, reading the tip again for a later hop', async () => {
    const deployed = await deployClock();
    deployed.network.increaseTime(5000);
    const first = providerUnixLocktime(deployed.network)!;
    expect(first).toBeGreaterThan(0);

    const firstResult = await stamp(deployed);

    expect(firstResult.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(firstResult.accepted).toBe(true);
    expect(firstResult.transaction.locktime).toBe(first);

    // The broadcast transaction is the one the frames were evaluated against, so its locktime is the stated one.
    const broadcast = decodeTransaction(hexToBin(firstResult.broadcast!.hex));
    expect(typeof broadcast).toBe('object');
    expect((broadcast as { locktime: number }).locktime).toBe(first);

    // The entry read the transaction's locktime and wrote it; the record the broadcast left carries it.
    expect(await recordCommitment(deployed.network, deployed.proxyCategoryId)).toBe(bytesToHex(commitment(
      impl.stateLayout!, { implementation: implementationAddress(), stamped: BigInt(first) },
    )));

    // A hop spends its caller's coin, so a later chain time needs a fresh one (and a fresh facet pool).
    const nextCoin = { txid: '55'.repeat(32), vout: 0, satoshis: 300_000n };
    await deployed.network.addUtxo(binToHex(deployed.callerLock), nextCoin);
    await fundShippedFacets(deployed.network);
    deployed.callCoin = nextCoin;

    deployed.network.increaseTime(3600);
    const later = providerUnixLocktime(deployed.network)!;
    expect(later).toBeGreaterThan(first);
    const laterResult = await stamp(deployed);
    expect(laterResult.accepted).toBe(true);
    expect(laterResult.transaction.locktime).toBe(later);
    expect(await recordCommitment(deployed.network, deployed.proxyCategoryId)).toBe(bytesToHex(commitment(
      impl.stateLayout!, { implementation: implementationAddress(), stamped: BigInt(later) },
    )));
  });
});
