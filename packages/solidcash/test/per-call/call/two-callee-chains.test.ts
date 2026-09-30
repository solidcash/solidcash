import { describe, expect, it, vi } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { deployMaster } from '../../../src/per-call/deploy/index.js';
import { buildProxyArtifact, deployPerCallProxy } from '../../../src/per-call/proxy/index.js';
import { callPerCallProxyEntry } from '../../../src/per-call/proxy/deploy.js';
import type { PerCallProxyExternal } from '../../../src/per-call/proxy/external-calls.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * A hop whose entry reaches two chains: a contract behind its own proxy, then a contract whose entry returns a
 * value.
 *
 * The two reaches are settled deepest first, so the plain callee is settled after the proxied chain's frames. A
 * callee whose own body writes a mapping and returns a value has to be told the value it wrote and the value it
 * returned, each learned from a close its own frame leaves; the settle must derive far enough for the frame's own
 * program to reach those closes.
 */

// Categories and coin outpoints: 32-byte values whose bytes are not all the same, distinct per seed.
/** A 32-byte value with varied bytes, `seed` chosen so each name is distinct. */
function category(seed: string): string {
  const base = 'a1b2c3d4e5f60718293a4b5c6d7e8f9';
  return `${seed}${base}${base}`.slice(0, 64);
}

const REGISTRY_IMPL_CATEGORY = category('0a');
const REGISTRY_PROXY_CATEGORY = category('1b');
const LEDGER_CATEGORY = category('2c');
const ROOT_IMPL_CATEGORY = category('3d');
const ROOT_PROXY_CATEGORY = category('4e');
const REGISTRY_INIT_TXID = category('5f');
const ROOT_INIT_TXID = category('60');
const CALL_TXID = category('71');

// `Registry` is reached behind its own proxy; `Ledger.move` writes a mapping node and returns a value, so its frame
// has to learn both the record it wrote and the value it returned. `Root.run` reaches `Registry` first and `Ledger`
// second, so the plain callee is settled after the proxied chain.
const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' interface IRegistry { function note(); }'
  + ' interface ILedger { function move(int by) returns (bool); }'
  + ' contract Registry {'
  + '   address public implementation;'
  + '   int public tags;'
  + '   function initialize() { this.tags = 7; require(this.tags > 0); }'
  + '   function note() { require(this.tags == 7); }'
  + ' }'
  + ' contract Ledger {'
  + '   int public floor;'
  + '   mapping(int => int) public held;'
  + '   mapping(int => int) public credit;'
  + '   function initialize() { this.floor = 1; this.held[1] = 1; this.credit[2] = 9; require(true); }'
  + '   function move(int by) returns (bool) {'
  + '     this.held[2] = this.held[2] + by;'
  + '     this.credit[3] = this.credit[3] - by;'
  + '     require(this.held[2] >= this.floor);'
  + '     return true;'
  + '   }'
  + ' }'
  + ' contract Root {'
  + '   address public implementation;'
  + '   address public registry;'
  + '   address public ledger;'
  + '   function initialize(address r, address l) { this.registry = r; this.ledger = l; require(true); }'
  + '   function run() { IRegistry(this.registry).note(); ILedger(this.ledger).move(3); require(true); }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'per-call' });
const registry = artifacts.Registry!;
const ledger = artifacts.Ledger!;
const root = artifacts.Root!;

/** A coin a genesis is funded from; its txid becomes the category it mints. */
function funding(txid: string): { txid: string; vout: number; satoshis: bigint } {
  return { txid, vout: 0, satoshis: 500_000n };
}

/**
 * Deploys the proxied chain, the plain callee, then the caller behind its own proxy, and runs both initializes.
 *
 * The caller's initialize is handed the addresses the two callees present, so the caller's own entry computes them
 * from its record and each call resolves to the deployment named for its interface.
 */
async function deployTwoChains(network: MockNetworkProvider): Promise<{
  readonly rootProxyCategoryId: string;
  readonly rootImplementationCategoryId: string;
  readonly deployerLock: Uint8Array;
  readonly changeAddress: string;
  readonly callCoin: { txid: string; vout: number; satoshis: bigint };
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
  readonly externals: Record<string, PerCallProxyExternal>;
}> {
  const signature = new SignatureTemplate(alicePriv);
  const source = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = source.unlock.spend(alicePub, signature);
  const callerFunder = signature.unlockP2PKH();
  const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);

  // The plain callee is deployed first so its master address can seed the proxied chain's own record and the
  // caller's.
  const ledgerFunding = funding(LEDGER_CATEGORY);
  await network.addUtxo(source.address, ledgerFunding);
  await deployStatefulContract(ledger, [], {
    fundingUtxo: ledgerFunding, funder, changeAddress: source.address, provider: network, threadCount: 4,
  });

  for (const txid of [REGISTRY_IMPL_CATEGORY, REGISTRY_PROXY_CATEGORY, ROOT_IMPL_CATEGORY, ROOT_PROXY_CATEGORY]) {
    await network.addUtxo(source.address, funding(txid));
  }
  const registryInitCoin = funding(REGISTRY_INIT_TXID);
  const rootInitCoin = funding(ROOT_INIT_TXID);
  const callCoin = funding(CALL_TXID);
  for (const coin of [registryInitCoin, rootInitCoin, callCoin]) {
    await network.addUtxo(binToHex(deployerLock), coin);
  }
  await fundShippedFacets(network);

  const registryDeployment = await deployPerCallProxy({
    provider: network,
    implementationArtifact: registry,
    proxyArtifact: buildProxyArtifact(registry),
    implementationDeploy: { fundingUtxo: funding(REGISTRY_IMPL_CATEGORY), funder, changeAddress: source.address },
    proxyDeploy: { fundingUtxo: funding(REGISTRY_PROXY_CATEGORY), funder, changeAddress: source.address },
    initialize: { functionName: 'initialize', args: [] },
    callerLockingBytecode: deployerLock,
    callerFunding: { utxo: registryInitCoin, funder: callerFunder, changeAddress: source.address },
    vm: compositionMachine(),
  });
  expect(registryDeployment.initialize.broadcast).toBeDefined();

  // The plain callee presents its master at its own category, which is the address the caller's entry calls.
  const ledgerAddress = deployMaster(ledger, hexToBin(LEDGER_CATEGORY), VALIDATOR_PROGRAM).address;

  const rootDeployment = await deployPerCallProxy({
    provider: network,
    implementationArtifact: root,
    proxyArtifact: buildProxyArtifact(root),
    implementationDeploy: { fundingUtxo: funding(ROOT_IMPL_CATEGORY), funder, changeAddress: source.address },
    proxyDeploy: { fundingUtxo: funding(ROOT_PROXY_CATEGORY), funder, changeAddress: source.address },
    initialize: { functionName: 'initialize', args: [registryDeployment.proxy.address, ledgerAddress] },
    callerLockingBytecode: deployerLock,
    callerFunding: { utxo: rootInitCoin, funder: callerFunder, changeAddress: source.address },
    vm: compositionMachine(),
  });
  expect(rootDeployment.initialize.broadcast).toBeDefined();

  return {
    rootProxyCategoryId: rootDeployment.proxy.categoryId,
    rootImplementationCategoryId: rootDeployment.implementation.categoryId,
    deployerLock,
    changeAddress: source.address,
    callCoin,
    funder: callerFunder,
    externals: {
      IRegistry: {
        artifact: registry,
        categoryId: registryDeployment.proxy.categoryId,
        proxyArtifact: buildProxyArtifact(registry),
        implementationCategoryId: registryDeployment.implementation.categoryId,
      },
      ILedger: { artifact: ledger, categoryId: LEDGER_CATEGORY },
    },
  };
}

/** The instrumented call one hop's run makes, with the trace captured around it. */
async function callWithTrace(
  network: MockNetworkProvider,
  funded: Awaited<ReturnType<typeof deployTwoChains>>,
): Promise<readonly string[]> {
  const previous = process.env.PER_CALL_HOP_TRACE;
  process.env.PER_CALL_HOP_TRACE = '1';
  const lines: string[] = [];
  const spy = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array): boolean => {
    lines.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
    return true;
  }) as typeof process.stdout.write);
  try {
    await callPerCallProxyEntry({
      provider: network,
      implementationArtifact: root,
      proxyArtifact: buildProxyArtifact(root),
      proxyCategoryId: funded.rootProxyCategoryId,
      implementationCategoryId: funded.rootImplementationCategoryId,
      functionName: 'run',
      args: [],
      externals: funded.externals,
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    });
  } finally {
    spy.mockRestore();
    if (previous === undefined) delete process.env.PER_CALL_HOP_TRACE;
    else process.env.PER_CALL_HOP_TRACE = previous;
  }
  return lines.filter((line) => line.startsWith('HOPTRACE ')).map((line) => line.trimEnd());
}

describe('a hop whose entry reaches two callee chains', () => {
  it('settles the proxied chain and the later value-returning callee, and broadcasts', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funded = await deployTwoChains(network);

    const result = await callPerCallProxyEntry({
      provider: network,
      implementationArtifact: root,
      proxyArtifact: buildProxyArtifact(root),
      proxyCategoryId: funded.rootProxyCategoryId,
      implementationCategoryId: funded.rootImplementationCategoryId,
      functionName: 'run',
      args: [],
      externals: funded.externals,
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    });

    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it('attempts the later callee more than once and reaches it, since its write is a value the body computes', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funded = await deployTwoChains(network);
    const traced = await callWithTrace(network, funded);

    const attempts = traced.filter((line) => line.startsWith('HOPTRACE attempt callee=callee-master-3 '));
    expect(attempts.length).toBeGreaterThan(1);
    expect(traced.some((line) => line.includes('stop callee=callee-master-3 reason=accepted'))).toBe(true);
    expect(traced.some((line) => line.includes('plan frame=callee-master-3 fn=Ledger.move() kind=CALL'))).toBe(true);
    expect(traced.every((line) => line.length <= 200)).toBe(true);
  });
});
