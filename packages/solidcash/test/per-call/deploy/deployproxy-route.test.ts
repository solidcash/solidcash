import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { COMPOSITION_LIMITS } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import {
  MockNetworkProvider, Signer, getContractFactory, deployProxy, ProxyContract,
  type PerCallArtifact, type PerCallProxyHandle,
} from '../../../src/index.js';
import { deployMaster } from '../../../src/per-call/deploy/index.js';
import { buildProxyArtifact } from '../../../src/per-call/proxy/index.js';
import { VALIDATOR_PROGRAM } from '../shapes/harness.js';

/**
 * The ordinary `deployProxy` entry point reached with a per-call implementation.
 *
 * A per-call artifact is a master program, not a direct-convention contract: its entries read their frame from a
 * witness block, and it runs behind the fallback-only proxy the convention compiles. The direct builder therefore
 * has nothing to spend, and `deployProxy` routes the whole deployment - both geneses and the `initialize` hop -
 * through the per-call path, generating the proxy from the implementation's own declaration. What it returns is
 * the contract handle, whose bare names are the implementation's entries, with the deployment's own record nested
 * under it: the proxy's category and address, the implementation it forwards to, the derived hop and the machine's
 * verdict on every participant.
 *
 * The direct control below pins that a direct-convention artifact is unaffected and still returns a `ProxyContract`.
 */

// The proxy's records are the implementation's records: the implementation's write rebuilds the record from its
// own declaration, so both name the same fields and the address the fallback forwards to is one of them.
const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Impl {'
  + '   address public implementation;'
  + '   uint public initialized;'
  + '   int public version;'
  + '   function initialize(address expected) {'
  + '     require(msg.sender == expected);'
  + '     require(this.initialized == 0);'
  + '     this.initialized = 1;'
  + '     this.version = 7;'
  + '   }'
  + ' }';

const DIRECT_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Counter { int public counter; function initialize() public { this.counter = 5; } }';

/** A relaxed mock network, matching what a composition shape needs to run. */
function provider(): MockNetworkProvider {
  return new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
}

/** A funded Signer over the provider; a deploy needs fresh vout-0 coins to create each token category. */
async function fundedSigner(network: MockNetworkProvider, fill: number): Promise<Signer> {
  const signer = new Signer(new Uint8Array(32).fill(fill), network);
  for (let index = 0; index < 6; index += 1) {
    await network.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
  }
  return signer;
}

interface Routed {
  readonly artifacts: ReturnType<typeof compileStringMulti>;
  readonly deployerLock: Uint8Array;
  readonly routed: PerCallProxyHandle;
}

let routedRun: Promise<Routed> | undefined;

/** The routed deployment the first two cases read; the second's re-entered initialize broadcasts nothing. */
function routedDeployment(): Promise<Routed> {
  routedRun ??= (async (): Promise<Routed> => {
    const artifacts = compileStringMulti(SOURCE, { composition: 'per-call' });
    const network = provider();
    const signer = await fundedSigner(network, 0x51);
    const deployerLock = signer.getLockingBytecode();
    const routed: PerCallProxyHandle = await deployProxy(
      getContractFactory(artifacts.Impl! as PerCallArtifact, signer), [deployerLock],
    );
    return { artifacts, deployerLock, routed };
  })();
  return routedRun;
}

describe('deployProxy with a per-call implementation', () => {
  it('routes to the per-call deployment and settles the initialize hop', async () => {
    const { artifacts, routed } = await routedDeployment();
    const deployment = routed.proxyDeployment;

    // The handle names the deployed proxy: its category and the address its masters and records sit under.
    expect(deployment.proxy.categoryId).toMatch(/^[0-9a-f]{64}$/);
    const proxyArtifact = buildProxyArtifact(artifacts.Impl!);
    const proxyMaster = deployMaster(proxyArtifact, hexToBin(deployment.proxy.categoryId), VALIDATOR_PROGRAM);
    expect([...deployment.proxy.address]).toStrictEqual([...proxyMaster.address]);
    expect(deployment.implementation.categoryId).toMatch(/^[0-9a-f]{64}$/);

    // The initialize hop ran through the proxy: the implementation frame first, then the proxy that forwarded.
    expect(deployment.initialize.completed.map((frame) => frame.functionName))
      .toStrictEqual(['Impl.initialize()', `${proxyArtifact.contractName}.__fallback()`]);
    // Every convention participant - both masters, the validator and the proxy's record - was accepted.
    expect(deployment.initialize.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(deployment.initialize.accepted).toBe(true);
  });

  it('keeps the implementation entry callable beside the deployment record', async () => {
    const { deployerLock, routed } = await routedDeployment();

    // `initialize` names the implementation's entry, as it does for a direct-convention deploy; the deployment's
    // own record of the hop sits beside the handle rather than over that name.
    const handle = routed as unknown as { initialize: (arg: Uint8Array) => Promise<unknown> };
    expect(typeof handle.initialize).toBe('function');
    expect(routed.proxyDeployment.initialize.accepted).toBe(true);

    // Re-entering the initializer is the entry's own guard refusing, so nothing is broadcast.
    await expect(handle.initialize(deployerLock)).rejects.toThrow(/initialize/);
  });

  // The written record keeping the implementation's address is the deployment's own property, asserted in
  // `proxy-deployment`, `generated-proxy` and `proxy-initialize-broadcast`.
  it('leaves a direct-convention artifact on the direct path', async () => {
    const artifacts = compileStringMulti(DIRECT_SOURCE);
    const network = provider();
    const signer = await fundedSigner(network, 0x53);

    const handle = await deployProxy(getContractFactory(artifacts.Counter!, signer), []);

    expect(handle).toBeInstanceOf(ProxyContract);
    // The direct handle forwards through a pinned delegatecall; a per-call deployment has no such method.
    expect(typeof handle.forward).toBe('function');
    expect(handle.forwardShape.mode).toBe('baked');
    expect(await handle.getAddress()).toMatch(/^[a-z]+:/);
  });
});
