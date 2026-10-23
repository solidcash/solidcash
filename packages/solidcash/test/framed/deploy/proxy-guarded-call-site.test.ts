import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { parsePushdataCommitment, validatorAddress, type Artifact } from '@solidcash/utils';
import { framedValidator } from 'solidc';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { buildProxyArtifact, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry } from '../../../src/framed/proxy/deploy.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A proxied entry whose own body guards some of its calls behind a branch this execution does not take.
 *
 * The compiled body fixes one call site and one segment close per site the source names, while the plan states a
 * record only for the sites the execution reaches. This pins the plan's stated handling of that gap - "a body that
 * guards the call never reaches it and is settled on its own refusal" - from the outermost level: three published
 * sites, the middle one guarded away by the entry's own argument, one callee master placed for all three, and the
 * hop settles and broadcasts. A site the execution skips must leave the block's numbering intact rather than
 * shifting the sites after it.
 */

const IMPL_CATEGORY = '11'.repeat(31) + 'ee';
const PROXY_CATEGORY = '22'.repeat(31) + 'dd';
const OUTER_CATEGORY = '55'.repeat(31) + 'aa';
const INNER_CATEGORY = '66'.repeat(31) + 'bb';
const CALLER_TXID = '33'.repeat(31) + 'cc';

const VALIDATOR_PROGRAM = framedValidator.buildValidatorProgram();
const OUTER_ADDRESS = validatorAddress(hexToBin(OUTER_CATEGORY), VALIDATOR_PROGRAM);
const INNER_ADDRESS = validatorAddress(hexToBin(INNER_CATEGORY), VALIDATOR_PROGRAM);

/** Three call sites, the middle one behind a branch the arguments make unreachable. */
function sourceOf(): string {
  return 'pragma solidcash ^0.14.0;'
    + ' interface IInner { function probe(uint x) view returns (uint); }'
    + ' contract Inner {'
    + '   uint public hits;'
    + '   function probe(uint x) view returns (uint) { return x + 1; }'
    + ' }'
    + ' interface IOuter { function run(uint x, uint mode) returns (uint); }'
    + ' contract Outer {'
    + '   uint public status;'
    + '   function run(uint x, uint mode) returns (uint) {'
    + `     uint a = IInner(0x${binToHex(INNER_ADDRESS)}).probe(x);`
    + '     if (mode > 0) {'
    + `       a = a + IInner(0x${binToHex(INNER_ADDRESS)}).probe(a);`
    + '     }'
    + `     uint b = IInner(0x${binToHex(INNER_ADDRESS)}).probe(a);`
    + '     this.status = b;'
    + '     return b;'
    + '   }'
    + ' }'
    + ' contract Ledger {'
    + '   address public implementation;'
    + '   uint public stored;'
    + '   function initialize() { require(true); }'
    + `   function run(uint x, uint mode) { this.stored = IOuter(0x${binToHex(OUTER_ADDRESS)}).run(x, mode); }`
    + ' }';
}

/** The same guard, but on the proxied entry's own sites: three, the middle one unreachable this execution. */
function sourceOfGuardedEntry(): string {
  return 'pragma solidcash ^0.14.0;'
    + ' interface IOuter { function run(uint x, uint mode) returns (uint); }'
    + ' contract Outer {'
    + '   uint public status;'
    + '   function run(uint x, uint mode) returns (uint) { this.status = x + mode; return this.status; }'
    + ' }'
    + ' contract Ledger {'
    + '   address public implementation;'
    + '   uint public stored;'
    + '   function initialize() { require(true); }'
    + '   function run(uint x, uint mode) {'
    + `     this.stored = IOuter(0x${binToHex(OUTER_ADDRESS)}).run(x, mode);`
    + '     if (mode > 0) {'
    + `       this.stored = IOuter(0x${binToHex(OUTER_ADDRESS)}).run(x + 1, mode);`
    + '     }'
    + `     this.stored = IOuter(0x${binToHex(OUTER_ADDRESS)}).run(x + 2, mode);`
    + '   }'
    + ' }';
}

/** An internal helper forwards the entry's arguments in a different order to its guarded call. */
function sourceOfInternalGuardedEntry(): string {
  return 'pragma solidcash ^0.14.0;'
    + ' interface IOuter { function run(uint x, uint mode) returns (uint); }'
    + ' contract Outer {'
    + '   uint public status;'
    + '   function run(uint x, uint mode) returns (uint) { this.status = x + mode; return this.status; }'
    + ' }'
    + ' contract Ledger {'
    + '   address public implementation;'
    + '   uint public stored;'
    + '   function initialize() { require(true); }'
    + '   function optional(uint forwardedMode, uint value) internal {'
    + '     if (forwardedMode > 0) {'
    + `       this.stored = IOuter(0x${binToHex(OUTER_ADDRESS)}).run(value, forwardedMode);`
    + '     }'
    + '   }'
    + '   function run(uint x, uint mode) {'
    + '     optional(mode, x);'
    + `     this.stored = IOuter(0x${binToHex(OUTER_ADDRESS)}).run(x + 2, mode);`
    + '   }'
    + ' }';
}

/** Deploys the callee and its own callee, then the implementation behind its proxy. */
async function deploy(source: string = sourceOf()): Promise<{
  readonly network: MockNetworkProvider;
  readonly artifacts: ReturnType<typeof compileStringMulti>;
  readonly callerUtxos: readonly { txid: string; vout: number; satoshis: bigint }[];
  readonly deployerLock: Uint8Array;
  readonly changeAddress: string;
  readonly signature: SignatureTemplate;
  readonly initialized: boolean;
}> {
  const artifacts = compileStringMulti(source, { composition: 'framed' });
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const funder = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const implFunding = { txid: IMPL_CATEGORY, vout: 0, satoshis: 500_000n };
  const proxyFunding = { txid: PROXY_CATEGORY, vout: 0, satoshis: 500_000n };
  const outerFunding = { txid: OUTER_CATEGORY, vout: 0, satoshis: 5_000_000n };
  const innerFunding = { txid: INNER_CATEGORY, vout: 0, satoshis: 5_000_000n };
  const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);
  const callerUtxos = Array.from({ length: 4 }, (_unused, index) => ({
    txid: `${CALLER_TXID.slice(0, 62)}${(index + 1).toString(16).padStart(2, '0')}`,
    vout: 0, satoshis: 100_000n,
  }));
  await network.addUtxo(funder.address, implFunding);
  await network.addUtxo(funder.address, proxyFunding);
  await network.addUtxo(funder.address, outerFunding);
  if (artifacts.Inner !== undefined) await network.addUtxo(funder.address, innerFunding);
  await fundShippedFacets(network);
  for (const coin of callerUtxos) await network.addUtxo(binToHex(deployerLock), coin);
  const funderUnlock = funder.unlock.spend(alicePub, signature);
  if (artifacts.Inner !== undefined) await deployStatefulContract(artifacts.Inner as Artifact, [], {
    fundingUtxo: innerFunding, funder: funderUnlock, changeAddress: funder.address,
    provider: network, threadCount: 4,
  });
  await deployStatefulContract(artifacts.Outer as Artifact, [], {
    fundingUtxo: outerFunding, funder: funderUnlock, changeAddress: funder.address,
    provider: network, threadCount: 4,
  });
  const deployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: artifacts.Ledger!,
    implementationDeploy: { fundingUtxo: implFunding, funder: funderUnlock, changeAddress: funder.address },
    proxyDeploy: { fundingUtxo: proxyFunding, funder: funderUnlock, changeAddress: funder.address },
    initialize: { functionName: 'initialize', args: [] as never },
    callerLockingBytecode: deployerLock,
    callerFunding: { utxo: callerUtxos[0]!, funder: signature.unlockP2PKH() },
    vm: compositionMachine(),
  });
  return {
    network, artifacts, callerUtxos, deployerLock, changeAddress: funder.address, signature,
    initialized: deployment.initialize.accepted,
  };
}

describe('a proxied entry whose callee guards one of its calls away', () => {
  it.each([0n, 1n])('settles an internal helper call guard with forwarded arguments (mode=%s)', async (mode) => {
    const { network, artifacts, callerUtxos, deployerLock, changeAddress, signature, initialized } =
      await deploy(sourceOfInternalGuardedEntry());
    expect(initialized).toBe(true);
    const entry = artifacts.Ledger!.abi.find((candidate) => candidate.name === 'run')!;
    expect(entry.externalCalls?.[0].condition).toBeDefined();
    const proxyArtifact = buildProxyArtifact(artifacts.Ledger!);

    const result = await callFramedProxyEntry({
      provider: network,
      implementationArtifact: artifacts.Ledger!,
      proxyArtifact,
      proxyCategoryId: PROXY_CATEGORY,
      implementationCategoryId: IMPL_CATEGORY,
      functionName: 'run',
      args: [3n, mode] as never,
      externals: { IOuter: { artifact: artifacts.Outer as Artifact, categoryId: OUTER_CATEGORY } },
      callerUtxo: callerUtxos[1]!,
      callerLockingBytecode: deployerLock,
      funder: signature.unlockP2PKH(),
      changeAddress,
      vm: compositionMachine(),
    });
    expect(result.verdicts.every((verdict) => verdict.accepted)).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(result.completed.filter((frame) => frame.contract === 'Outer')).toHaveLength(mode === 0n ? 1 : 2);
    const state = Object.assign({}, ...result.writtenCommitments.map((commitment, index) =>
      parsePushdataCommitment(binToHex(commitment), proxyArtifact.stateLayout!, index)));
    expect(state.stored).toBe(5n + mode);
  }, 300_000);

  it('settles a callee whose middle call site no execution reaches', async () => {
    const { network, artifacts, callerUtxos, deployerLock, changeAddress, signature, initialized } = await deploy();
    expect(initialized).toBe(true);
    const callee = artifacts.Outer!.abi.find((candidate) => candidate.name === 'run')!;
    // Three sites are published; the body fixes all three whether or not this execution reaches them.
    expect((callee.externalCalls ?? []).map((call) => call.functionName))
      .toStrictEqual(['probe', 'probe', 'probe']);

    const result = await callFramedProxyEntry({
      provider: network,
      implementationArtifact: artifacts.Ledger!,
      proxyArtifact: buildProxyArtifact(artifacts.Ledger!),
      proxyCategoryId: PROXY_CATEGORY,
      implementationCategoryId: IMPL_CATEGORY,
      functionName: 'run',
      args: [3n, 0n] as never,
      externals: {
        IOuter: { artifact: artifacts.Outer as Artifact, categoryId: OUTER_CATEGORY },
        IInner: { artifact: artifacts.Inner as Artifact, categoryId: INNER_CATEGORY },
      },
      callerUtxo: callerUtxos[1]!,
      callerLockingBytecode: deployerLock,
      funder: signature.unlockP2PKH(),
      changeAddress,
      vm: compositionMachine(),
    });
    expect(result.verdicts.every((verdict) => verdict.accepted)).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  }, 300_000);

  /**
   * The guard on the entry's own body, which is also the frame whose own record is written in two segments.
   *
   * The compiled body fixes one call site and one segment close per site the entry's source names, so its witness
   * tail must hold one call record for each of them, whether or not that execution fills them. The plan states a
   * record only for the sites it places a callee for and writes the tail's call section as `master.calls.map(...)`,
   * so a site the entry guards away leaves the tail one record short of the body's own count: the run stops where
   * the missing record's site is read and the derivation fills no witness there.
   *
   * Two frames write one record here: the entry writes its own record in two segments, and the callee contract is
   * reached twice, so its two masters write its one record as well. Both shapes need the plan to declare each
   * change and chain the next declaration from the last change's end - the entry's own from the published write
   * segments (`proxy/deploy.ts`) and the callee frames' across frames (`chainSharedNodeViews`), through the
   * placeholder the composer declares for a change whose end the body computes. The derivation then learns both
   * ends, completes, and the hop settles and broadcasts.
   */
  it('settles the proxied entry itself when one of its own sites is guarded away', async () => {
    const { network, artifacts, callerUtxos, deployerLock, changeAddress, signature, initialized } =
      await deploy(sourceOfGuardedEntry());
    expect(initialized).toBe(true);
    const entry = artifacts.Ledger!.abi.find((candidate) => candidate.name === 'run')!;
    expect((entry.externalCalls ?? []).map((call) => call.functionName))
      .toStrictEqual(['run', 'run', 'run']);

    const result = await callFramedProxyEntry({
      provider: network,
      implementationArtifact: artifacts.Ledger!,
      proxyArtifact: buildProxyArtifact(artifacts.Ledger!),
      proxyCategoryId: PROXY_CATEGORY,
      implementationCategoryId: IMPL_CATEGORY,
      functionName: 'run',
      args: [3n, 0n] as never,
      externals: { IOuter: { artifact: artifacts.Outer as Artifact, categoryId: OUTER_CATEGORY } },
      callerUtxo: callerUtxos[1]!,
      callerLockingBytecode: deployerLock,
      funder: signature.unlockP2PKH(),
      changeAddress,
      vm: compositionMachine(),
    });
    expect(result.verdicts.every((verdict) => verdict.accepted)).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  }, 300_000);
});
