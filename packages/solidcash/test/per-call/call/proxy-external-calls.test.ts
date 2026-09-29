import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hexToBin } from '@bitauth/libauth';
import {
  bytesToHex, buildPushdataCommitment, hash256, validatorAddress, type Artifact, type StateLayout,
} from '@solidcash/utils';
import { perCallValidator } from 'solidc';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { deployMaster, readPerCallDeployment } from '../../../src/per-call/deploy/index.js';
import { buildProxyArtifact, deployPerCallProxy } from '../../../src/per-call/proxy/index.js';
import { callPerCallProxyEntry } from '../../../src/per-call/proxy/deploy.js';
import { planHopExternalCalls } from '../../../src/per-call/proxy/external-calls.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';

/**
 * A proxied entry whose own body makes external calls.
 *
 * A per-call body binds each external call to its own frame's k-th call record, so a hop that runs such an entry
 * has to state the calls the entry makes and run each callee as a frame of its own. The deployment is driven only
 * through the shipped deploy/compose/derive/machine/broadcast path, and the state is read back through the
 * shipped deployment reader.
 */

const VALIDATOR_PROGRAM = perCallValidator.buildValidatorProgram();
const IMPL_CATEGORY = '11'.repeat(32);
const PROXY_CATEGORY = '22'.repeat(32);
const ORACLE_CATEGORY = '55'.repeat(32);
const ESCROW_CATEGORY = '66'.repeat(32);
const WRITER_CATEGORY = '77'.repeat(32);
const ORACLE_ADDRESS = validatorAddress(hexToBin(ORACLE_CATEGORY), VALIDATOR_PROGRAM);
const ESCROW_ADDRESS = validatorAddress(hexToBin(ESCROW_CATEGORY), VALIDATOR_PROGRAM);
const WRITER_ADDRESS = validatorAddress(hexToBin(WRITER_CATEGORY), VALIDATOR_PROGRAM);
const hexOf = (bytes: Uint8Array): string => binToHex(bytes);
/** What the composer's plan gives each facet input; a facet holds no token and pays its own fee share. */
const FACET_SATOSHIS = 10_000n;

// The callees carry a record each: the oracle's entry returns a field of it, and the escrow's entry reads one.
// `Impl`'s entries read their own record beside the call, so the frame's segments declare the record it touches;
// `plain` is the control, an entry that makes no call at all.
const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' interface IOracle { function amountOf() view returns (int); }'
  + ' interface IEscrow { function settle(); }'
  + ' interface IWriter { function bump(); }'
  + ' contract Oracle {'
  + '   int public answer;'
  + '   constructor() { this.answer = 5; }'
  + '   function amountOf() view returns (int) { return this.answer; }'
  + ' }'
  + ' contract Escrow {'
  + '   int public touched;'
  + '   function settle() { require(this.touched == 0); }'
  + ' }'
  + ' contract Writer {'
  + '   int public count;'
  + '   function bump() { this.count = this.count + 1; require(this.count > 0); }'
  + ' }'
  + ' contract Impl {'
  + '   address public implementation;'
  + '   uint public initialized;'
  + '   int public total;'
  + '   function initialize(address expected) { require(msg.sender == expected); this.initialized = 1; }'
  + `   function probe() { require(IOracle(0x${hexOf(ORACLE_ADDRESS)}).amountOf() > this.total); require(true); }`
  + `   function poke() { IEscrow(0x${hexOf(ESCROW_ADDRESS)}).settle(); require(this.total >= 0); }`
  + `   function write() { IWriter(0x${hexOf(WRITER_ADDRESS)}).bump(); require(this.total >= 0); }`
  + '   function plain() { this.total = this.total + 1; require(true); }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'per-call' });
const impl = artifacts.Impl!;
const oracle = artifacts.Oracle!;
const escrow = artifacts.Escrow!;
const writer = artifacts.Writer!;

// Two shapes the artifact compiles but does not fix: an occurrence the source leaves open, and a target the
// caller's own code computes. Both are refused by name rather than guessed at.
const UNFIXED = compileStringMulti('pragma solidcash ^0.13.0;'
  + ' interface IOracle { function amountOf() view returns (int); }'
  + ' contract Oracle { int public answer; function amountOf() view returns (int) { return this.answer; } }'
  + ' contract Looping {'
  + `   function spin(int n) { for (int i = 0; i < n; i = i + 1) { require(IOracle(0x${hexOf(ORACLE_ADDRESS)}).amountOf() > 0); } require(true); }`
  + ' }'
  + ' contract Target {'
  + '   address public foo;'
  + '   function go() { require(IOracle(this.foo).amountOf() > 0); require(true); }'
  + ' }', { composition: 'per-call' });

/** The implementation's address at its seeded category, `addrV(category)`. */
function implementationAddress(): Uint8Array {
  return deployMaster(impl, new Uint8Array(hexToBin(IMPL_CATEGORY)), VALIDATOR_PROGRAM).address;
}

/** The record's own state, read back through the shipped deployment reader and decoded as a field map. */
async function recordState(network: MockNetworkProvider, categoryId: string): Promise<string> {
  const deployment = await readPerCallDeployment(network, categoryId, impl.stateLayout!);
  return bytesToHex(new Uint8Array(hexToBin(deployment.records[0]!.token!.nft!.commitment)));
}

/** The commitment the shipped encoder materializes from one state of a layout. */
function commitment(layout: StateLayout, state: Record<string, bigint | Uint8Array>): Uint8Array {
  return new Uint8Array(Buffer.from(buildPushdataCommitment(layout, state, 0), 'hex'));
}

/** The contracts the entries call, keyed by the interface each call goes through. */
function externals(): Readonly<Record<string, { artifact: Artifact; categoryId: string }>> {
  return {
    IOracle: { artifact: oracle, categoryId: ORACLE_CATEGORY },
    IEscrow: { artifact: escrow, categoryId: ESCROW_CATEGORY },
    IWriter: { artifact: writer, categoryId: WRITER_CATEGORY },
  };
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

  const callees: readonly [Artifact, string][] =
    [[oracle, ORACLE_CATEGORY], [escrow, ESCROW_CATEGORY], [writer, WRITER_CATEGORY]];
  for (const [artifact, categoryId] of callees) {
    const funding = { txid: categoryId, vout: 0, satoshis: 500_000n };
    await network.addUtxo(source.address, funding);
    await deployStatefulContract(artifact, [], { fundingUtxo: funding, funder, changeAddress: source.address, provider: network });
  }

  // The validator runs as a head plus one input per facet, each locked by its own code and holding no token, so
  // any live UTXO at the facet's lock serves it.
  const facets = perCallValidator.buildValidatorFacets();
  for (const [index, code] of facets.entries()) {
    const lock = encodeLockingBytecodeP2sh32(hash256(code));
    await network.addUtxo(hexOf(lock), {
      txid: (0x70 + index).toString(16).padStart(2, '0').repeat(32),
      vout: 0,
      satoshis: FACET_SATOSHIS,
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

describe('a proxied entry that calls another deployed contract', () => {
  it('plans the static read, runs the callee frame, accepts every contract input and broadcasts', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funded = await deployedWithCallees(network);
    const afterInitialize = await recordState(network, funded.proxyCategoryId);

    const result = await callPerCallProxyEntry({
      provider: network,
      implementationArtifact: impl,
      proxyArtifact: buildProxyArtifact(impl),
      proxyCategoryId: funded.proxyCategoryId,
      implementationCategoryId: funded.implementationCategoryId,
      functionName: 'probe',
      args: [],
      externals: externals(),
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    });

    // The callee completes before the entry that called it, which completes before the fallback that entered it.
    expect(result.completed.map((frame) => frame.functionName))
      .toStrictEqual([`${oracle.contractName}.amountOf()`, `${impl.contractName}.probe()`, 'ImplProxy.__fallback()']);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    // The call is not a write, so the proxy's record is where the initialize hop left it.
    expect(await recordState(network, funded.proxyCategoryId)).toBe(afterInitialize);
  });

  it('plans a state-changing call whose callee reads its own record', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funded = await deployedWithCallees(network);

    const result = await callPerCallProxyEntry({
      provider: network,
      implementationArtifact: impl,
      proxyArtifact: buildProxyArtifact(impl),
      proxyCategoryId: funded.proxyCategoryId,
      implementationCategoryId: funded.implementationCategoryId,
      functionName: 'poke',
      args: [],
      externals: externals(),
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    });

    expect(result.completed.map((frame) => frame.functionName))
      .toStrictEqual([`${escrow.contractName}.settle()`, `${impl.contractName}.poke()`, 'ImplProxy.__fallback()']);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it('leaves an entry that makes no call unaffected', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funded = await deployedWithCallees(network);

    const result = await callPerCallProxyEntry({
      provider: network,
      implementationArtifact: impl,
      proxyArtifact: buildProxyArtifact(impl),
      proxyCategoryId: funded.proxyCategoryId,
      implementationCategoryId: funded.implementationCategoryId,
      functionName: 'plain',
      args: [],
      externals: externals(),
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    });

    // No callee frame runs: the only frames are the entry and the fallback that entered it.
    expect(result.completed.map((frame) => frame.functionName))
      .toStrictEqual([`${impl.contractName}.plain()`, 'ImplProxy.__fallback()']);
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(bytesToHex(result.writtenCommitments[0]!)).toBe(bytesToHex(commitment(impl.stateLayout!, {
      implementation: implementationAddress(), initialized: 1n, total: 1n,
    })));
  });

  it('refuses a call whose callee the deployment does not hold, naming the address', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funded = await deployedWithCallees(network);
    const before = await recordState(network, funded.proxyCategoryId);

    await expect(callPerCallProxyEntry({
      provider: network,
      implementationArtifact: impl,
      proxyArtifact: buildProxyArtifact(impl),
      proxyCategoryId: funded.proxyCategoryId,
      implementationCategoryId: funded.implementationCategoryId,
      functionName: 'probe',
      args: [],
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    })).rejects.toThrow(/none of the deployment's contracts sits at that address/);

    expect(await recordState(network, funded.proxyCategoryId)).toBe(before);
  });

  it('refuses a callee whose own body rewrites its record, naming that frame', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funded = await deployedWithCallees(network);

    await expect(callPerCallProxyEntry({
      provider: network,
      implementationArtifact: impl,
      proxyArtifact: buildProxyArtifact(impl),
      proxyCategoryId: funded.proxyCategoryId,
      implementationCategoryId: funded.implementationCategoryId,
      functionName: 'write',
      args: [],
      externals: externals(),
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    })).rejects.toThrow(/the call's callee "Writer\.bump\(\)" did not settle through the proxy/);
  });

  it('refuses an occurrence the source does not fix, naming it', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    await expect(planHopExternalCalls({
      provider: network,
      artifact: UNFIXED.Looping!,
      functionName: 'spin',
      args: [3n],
      externals: externals(),
      validatorProgram: VALIDATOR_PROGRAM,
    })).rejects.toThrow(/runs loop, and the hop declares one record per call the source fixes/);
  });

  it("refuses a target the caller's own code computes, naming it", async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    await expect(planHopExternalCalls({
      provider: network,
      artifact: UNFIXED.Target!,
      functionName: 'go',
      args: [],
      externals: externals(),
      validatorProgram: VALIDATOR_PROGRAM,
    })).rejects.toThrow(/targets an address the caller's own code computes/);
  });
});
