import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry, type FramedProxyCallResult } from '../../../src/framed/proxy/deploy.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * The root proxy frame a user enters directly, whose implementation entry records no return but does emit.
 *
 * The proxy is generated for the whole implementation, so its fallback declares a return as soon as any entry of
 * that implementation returns one. The fallback is then one body under the compiler's own-category immutable-NFT
 * pin, and the pin admits the event outputs a *declared* event of the fallback's own block layout names. An event
 * the delegated implementation entry emits sits at that entry's own block offset instead, which the generated
 * proxy cannot mirror, so the pin refuses it and the hop stalls at the proxy frame's first segment close.
 *
 * Both root entry points are driven: `deployFramedProxy`'s `initialize`, and a later `callFramedProxyEntry`.
 * The implementation below has one returning entry (`total`) so the generated fallback publishes a return, and one
 * void emitting entry (`note`) that is the shape that stalls.
 */

const LEDGER_IMPL_CATEGORY = '3f7a1c9e5b2d8046a1f3c5e7b9d0f2a4' + 'c6e8b0d2f4a6c8e0b2d4f6a8c0e2b4d6';
const LEDGER_PROXY_CATEGORY = '7b2e4d6f8a0c2e4f6b8d0a2c4e6f8b0d' + '2a4c6e8f0b2d4a6c8e0f2b4d6a8c0e2e';
const LEDGER_INIT_TXID = '5c8e0a2b4d6f8a0c2e4b6d8f0a2c4e6b' + '8d0f2a4c6e8b0d2f4a6c8e0b2d4f6a8c';

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Ledger {'
  + '   address public implementation;'
  + '   int public base;'
  + '   event Noted(int indexed v);'
  + '   function initialize(int b) { this.base = b; require(true); }'
  + '   function total() public returns (int) { return this.base + 1; }'
  + '   function note() public { emit Noted(this.base); require(this.base >= 0); }'
  + '   function publish(int v) public returns (int) { emit Noted(v); return v + 1; }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const ledger = artifacts.Ledger!;

/** A coin a genesis is funded from; its txid becomes the category it mints. */
function funding(txid: string): { txid: string; vout: number; satoshis: bigint } {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

interface Setup {
  readonly network: MockNetworkProvider;
  readonly deployerLock: Uint8Array;
  readonly changeAddress: string;
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
}

async function setup(network: MockNetworkProvider): Promise<Setup> {
  const signature = new SignatureTemplate(alicePriv);
  const source = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  await fundShippedFacets(network);
  return {
    network,
    deployerLock: encodeLockingBytecodeP2pkh(alicePkh),
    changeAddress: source.address,
    funder: signature.unlockP2PKH(),
  };
}

/** Deploys the implementation behind its generated proxy, entering `entry` as the user's own root call. */
async function deployEntering(
  setup_: Setup, entry: string, args: readonly (bigint | Uint8Array | string | boolean)[],
): Promise<{ readonly accepted: boolean; readonly proxyCategoryId: string;
    readonly implementationCategoryId: string }> {
  const signature = new SignatureTemplate(alicePriv);
  const source = new Contract(p2pkhArtifact, [alicePkh], { provider: setup_.network });
  const funder = source.unlock.spend(alicePub, signature);
  const initCoin = funding(LEDGER_INIT_TXID);
  await setup_.network.addUtxo(binToHex(setup_.deployerLock), initCoin);
  for (const txid of [LEDGER_IMPL_CATEGORY, LEDGER_PROXY_CATEGORY]) {
    await setup_.network.addUtxo(source.address, funding(txid));
  }

  const deployment = await deployFramedProxy({
    provider: setup_.network,
    implementationArtifact: ledger,
    proxyArtifact: buildProxyArtifact(ledger),
    implementationDeploy: {
      fundingUtxo: funding(LEDGER_IMPL_CATEGORY), funder, changeAddress: source.address, threadCount: 5,
    },
    proxyDeploy: {
      fundingUtxo: funding(LEDGER_PROXY_CATEGORY), funder, changeAddress: source.address, threadCount: 5,
    },
    initialize: { functionName: entry, args: [...args] },
    callerLockingBytecode: setup_.deployerLock,
    callerFunding: { utxo: initCoin, funder: setup_.funder, changeAddress: source.address },
    vm: compositionMachine(),
  });
  return {
    accepted: deployment.initialize.accepted,
    proxyCategoryId: deployment.proxy.categoryId,
    implementationCategoryId: deployment.implementation.categoryId,
  };
}

/** Calls one entry of the deployed proxy as the user's own root call. */
async function callRoot(
  setup_: Setup,
  deployed: { readonly proxyCategoryId: string; readonly implementationCategoryId: string },
  entry: string, args: readonly (bigint | Uint8Array | string | boolean)[], fundingTxid: string,
): Promise<FramedProxyCallResult> {
  const coin = funding(fundingTxid);
  await setup_.network.addUtxo(binToHex(setup_.deployerLock), coin);
  return callFramedProxyEntry({
    provider: setup_.network,
    implementationArtifact: ledger,
    proxyArtifact: buildProxyArtifact(ledger),
    proxyCategoryId: deployed.proxyCategoryId,
    implementationCategoryId: deployed.implementationCategoryId,
    functionName: entry,
    args: [...args],
    externals: {},
    callerUtxo: coin,
    callerLockingBytecode: setup_.deployerLock,
    funder: setup_.funder,
    changeAddress: setup_.changeAddress,
    vm: compositionMachine(),
  });
}

/** The deployment entered through `initialize(9)`, and the chain as it stood when the deployment was done. */
interface Initialized {
  readonly setup: Setup;
  readonly deployed: Awaited<ReturnType<typeof deployEntering>>;
  readonly snapshot: SnapshotRestorer;
}

let initializedRun: Promise<Initialized> | undefined;

/** One `initialize(9)` deployment serves the cases that enter it, each rewinding the chain to it first. */
async function initialized(): Promise<Initialized> {
  initializedRun ??= (async (): Promise<Initialized> => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const arranged = await setup(network);
    const deployed = await deployEntering(arranged, 'initialize', [9n]);
    return { setup: arranged, deployed, snapshot: await network.takeSnapshot() };
  })();
  const shared = await initializedRun;
  await shared.snapshot.restore();
  return shared;
}

describe('a root proxy frame whose implementation entry records nothing', () => {
  it('generates a returning fallback when some implementation entry returns', () => {
    const fallback = buildProxyArtifact(ledger).abi.find((entry) => entry.name === '__fallback');
    expect(fallback?.outputs).toStrictEqual([{ type: 'bytes' }]);
  });

  it('settles a writing initialize through the proxy', async () => {
    const { deployed } = await initialized();
    expect(deployed.accepted).toBe(true);
  });

  it('carries the value the returning entry computed through the root proxy', async () => {
    const { setup: arranged, deployed } = await initialized();
    const result = await callRoot(arranged, deployed, 'total', [],
      '6d9f0b2a4c8e0d2f4b6a8c0e2d4f6b8a' + '0c2e4d6f8b0a2c4e6d8f0b2a4c6e8d0f');
    expect(result.accepted).toBe(true);
    expect(result.value).toBe(10n);
  });

  // A delegated entry emits at its own block offset while the fallback declares the return that puts it under the
  // pin. The pin holds a proxy's fallback to the offsets its own body declares, which are not the offsets the
  // delegated event occupies, so a framed proxy's fallback is not pinned at all: the delegated body's own
  // delegate frame is the one pinned, and its layout names the offsets its events sit at.
  it('settles a void emitting entry entered as the user\'s own initialize', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const setupRun = await setup(network);
    const deployed = await deployEntering(setupRun, 'note', []);
    expect(deployed.accepted).toBe(true);
  });

  it('settles a returning entry that also emits, entered as the user\'s own initialize', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const setupRun = await setup(network);
    const deployed = await deployEntering(setupRun, 'publish', [4n]);
    expect(deployed.accepted).toBe(true);
  });

  it('settles a returning entry that also emits, entered as a later root call', async () => {
    const { setup: arranged, deployed } = await initialized();
    const result = await callRoot(
      arranged, deployed, 'publish', [4n], '4b6d8f0a2c4e6b8d0f2a4c6e8b0d2f4a' + '6c8e0b2d4f6a8c0e2b4d6f8a0c2e4d6e',
    );
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it('settles a void emitting entry entered as a later root call', async () => {
    const { setup: arranged, deployed } = await initialized();
    const result = await callRoot(
      arranged, deployed, 'note', [], '8e0d2f4b6a8c0e2d4f6b8a0c2e4d6f8b' + '0a2c4e6d8f0b2a4c6e8d0f2b4a6c8e0e',
    );
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  });
});
