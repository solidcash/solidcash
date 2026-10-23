import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { deployMaster } from '../../../src/framed/deploy/index.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry } from '../../../src/framed/proxy/deploy.js';
import type { FramedProxyExternal } from '../../../src/framed/proxy/external-calls.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * One entry whose second call is gated on the first call's returned result.
 *
 * `Root.run` calls the token-like callee once, and only if that call's `bool` result is false does it call the
 * callee twice more — both arms writing the same mapping key the first call wrote. At run time the callee returns
 * true, so the arms never run. The compiler still publishes three call sites: the first with no published
 * condition, and the two arms each conditional on the first site's result. The hop plans the first site, learns
 * that it returned true, and re-plans with the two arms decided against that result, so it states exactly the one
 * call the execution makes rather than all three.
 */

/** A 32-byte value with varied bytes, `seed` chosen so each name is distinct. */
function category(seed: string): string {
  const base = 'a1b2c3d4e5f60718293a4b5c6d7e8f9';
  return `${seed}${base}${base}`.slice(0, 64);
}

const TOKEN_CATEGORY = category('0a');
const ROOT_IMPL_CATEGORY = category('1b');
const ROOT_PROXY_CATEGORY = category('2c');
const ROOT_INIT_TXID = category('3d');
const CALL_TXID = category('4e');

const SPENDER = 7n;

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IToken { function approve(int spender, int amount) returns (bool); }'
  + ' contract Token {'
  + '   mapping(int => int) public _allowances;'
  + '   int public floor;'
  + '   constructor(int seed) { this.floor = 0; this._allowances[seed] = 1; }'
  + '   function approve(int spender, int amount) returns (bool) {'
  + '     this._allowances[spender] = amount;'
  + '     require(this._allowances[spender] >= this.floor);'
  + '     return true;'
  + '   }'
  + ' }'
  + ' contract Root {'
  + '   address public implementation;'
  + '   address public token;'
  + '   function initialize(address t) { this.token = t; require(true); }'
  + '   function run(int spender) {'
  + '     if (!IToken(this.token).approve(spender, 100)) {'
  + '       IToken(this.token).approve(spender, 0);'
  + '       IToken(this.token).approve(spender, 100);'
  + '     }'
  + '     require(true);'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const token = artifacts.Token!;
const root = artifacts.Root!;

function funding(txid: string): { txid: string; vout: number; satoshis: bigint } {
  return { txid, vout: 0, satoshis: 500_000n };
}

/** Deploys the token-like callee, then the caller behind its own proxy and runs the caller's initialize. */
async function deployChains(network: MockNetworkProvider): Promise<{
  readonly rootProxyCategoryId: string;
  readonly rootImplementationCategoryId: string;
  readonly deployerLock: Uint8Array;
  readonly changeAddress: string;
  readonly callCoin: { txid: string; vout: number; satoshis: bigint };
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
  readonly externals: Record<string, FramedProxyExternal>;
}> {
  const signature = new SignatureTemplate(alicePriv);
  const source = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = source.unlock.spend(alicePub, signature);
  const callerFunder = signature.unlockP2PKH();
  const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);

  const tokenCoin = funding(TOKEN_CATEGORY);
  await network.addUtxo(source.address, tokenCoin);
  await deployStatefulContract(token, [SPENDER], {
    fundingUtxo: tokenCoin, funder, changeAddress: source.address, provider: network, threadCount: 4,
  });

  for (const txid of [ROOT_IMPL_CATEGORY, ROOT_PROXY_CATEGORY]) {
    await network.addUtxo(source.address, funding(txid));
  }
  const rootInitCoin = funding(ROOT_INIT_TXID);
  const callCoin = funding(CALL_TXID);
  for (const coin of [rootInitCoin, callCoin]) {
    await network.addUtxo(binToHex(deployerLock), coin);
  }
  await fundShippedFacets(network);

  const tokenAddress = deployMaster(token, hexToBin(TOKEN_CATEGORY), VALIDATOR_PROGRAM).address;

  const rootDeployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: root,
    proxyArtifact: buildProxyArtifact(root),
    implementationDeploy: { fundingUtxo: funding(ROOT_IMPL_CATEGORY), funder, changeAddress: source.address },
    proxyDeploy: { fundingUtxo: funding(ROOT_PROXY_CATEGORY), funder, changeAddress: source.address },
    initialize: { functionName: 'initialize', args: [tokenAddress] },
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
    externals: { IToken: { artifact: token, categoryId: TOKEN_CATEGORY } },
  };
}

/** Runs one hop of the caller's entry, whose return-gated call carries the spender key. */
async function callRun(
  network: MockNetworkProvider,
  funded: Awaited<ReturnType<typeof deployChains>>,
): Promise<Awaited<ReturnType<typeof callFramedProxyEntry>>> {
  return callFramedProxyEntry({
    provider: network,
    implementationArtifact: root,
    proxyArtifact: buildProxyArtifact(root),
    proxyCategoryId: funded.rootProxyCategoryId,
    implementationCategoryId: funded.rootImplementationCategoryId,
    functionName: 'run',
    args: [SPENDER],
    externals: funded.externals,
    callerUtxo: funded.callCoin,
    callerLockingBytecode: funded.deployerLock,
    funder: funded.funder,
    changeAddress: funded.changeAddress,
    vm: compositionMachine(),
  });
}

describe('an entry whose later call is gated on an earlier call\'s result', () => {
  it('settles the call the earlier result decides and broadcasts it', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funded = await deployChains(network);
    const result = await callRun(network, funded);
    expect(result.accepted).toBe(true);
    expect(result.verdicts.every((verdict) => verdict.accepted)).toBe(true);
    expect(result.broadcast).toBeDefined();
    // The plan states exactly the one call the run makes: the two arms the earlier result did not take are planned
    // as no visit, so no frame is declared for a call the execution never reaches.
    expect(result.draft.blockOf('implementation-master').calls).toHaveLength(1);
  });
});
