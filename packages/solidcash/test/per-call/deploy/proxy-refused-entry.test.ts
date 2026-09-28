import { describe, expect, it } from 'vitest';
import { encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import {
  PerCallProxyDeployError, buildProxyArtifact, callPerCallProxyEntry, deployPerCallProxy,
} from '../../../src/per-call/proxy/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';

/**
 * An implementation entry the compiler refused is reported by name, not as the opcode its stub fails on.
 *
 * A Solidity-compatible upgradeable implementation is marked `delegate` by initializer inference, and that marking
 * injects the direct convention's `__internal__proxyMasterIndex` witness. A per-call master serves delegate frames
 * from its own declared records and supplies no such operand, so the body is refused by name and emitted as a body
 * that fails whenever the dispatcher reaches it. The hop that runs the entry stops on that stub, and the deployment
 * has to say which entry the compiler refused rather than report the opcode the stub stopped on.
 */

const IMPL_CATEGORY = '31'.repeat(32);
const PROXY_CATEGORY = '42'.repeat(32);

// The refused shape: `initializer` inference marks every externally callable function `delegate`, so the entry the
// hop runs carries the direct convention's proxy-master witness.
const REFUSED_SOURCE = 'pragma solidity ^0.8.19;\n'
  + 'contract Impl {\n'
  + '  uint public initialized;\n'
  + '  int public version;\n'
  + '  bytes32 public contentHash;\n'
  + '  bytes32 public resultHash;\n'
  + '  bytes32 public jobSalt;\n'
  + '  bytes32 public metaHash;\n'
  + '  modifier initializer() { require(initialized == 0); _; }\n'
  + '  function initialize(address expected) public initializer {\n'
  + '    require(msg.sender == expected);\n'
  + '    initialized = 1;\n'
  + '    version = 7;\n'
  + '  }\n'
  + '}\n';

// The same fields with no `initializer` modifier: the entry stays an ordinary per-call body, so the proxy the
// deployment generates keeps records the two layouts agree on.
const SERVED_SOURCE = 'pragma solidity ^0.8.19;\n'
  + 'contract Impl {\n'
  + '  uint public initialized;\n'
  + '  int public version;\n'
  + '  bytes32 public contentHash;\n'
  + '  bytes32 public resultHash;\n'
  + '  bytes32 public jobSalt;\n'
  + '  bytes32 public metaHash;\n'
  + '  function initialize(address expected) public {\n'
  + '    require(msg.sender == expected);\n'
  + '    initialized = 1;\n'
  + '    version = 7;\n'
  + '  }\n'
  + '}\n';

const COMPILE_OPTIONS = { composition: 'per-call', solidityImportCompat: true } as const;

/** Funds the two genesis UTXOs and returns the deployer's own lock and funder. */
async function funded(network: MockNetworkProvider): Promise<{
  readonly funder: ReturnType<Contract['unlock']['spend']>;
  readonly implFunding: { txid: string; vout: number; satoshis: bigint };
  readonly proxyFunding: { txid: string; vout: number; satoshis: bigint };
  readonly deployerLock: Uint8Array;
  readonly changeAddress: string;
}> {
  const signature = new SignatureTemplate(alicePriv);
  const funder = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const implFunding = { txid: IMPL_CATEGORY, vout: 0, satoshis: 500_000n };
  const proxyFunding = { txid: PROXY_CATEGORY, vout: 0, satoshis: 500_000n };
  await network.addUtxo(funder.address, implFunding);
  await network.addUtxo(funder.address, proxyFunding);
  return {
    funder: funder.unlock.spend(alicePub, signature),
    implFunding,
    proxyFunding,
    deployerLock: encodeLockingBytecodeP2pkh(alicePkh),
    changeAddress: funder.address,
  };
}

describe('a hop whose implementation entry the compiler refused', () => {
  it('publishes the refusal by name and emits no served body for it', () => {
    const artifacts = compileStringMulti(REFUSED_SOURCE, COMPILE_OPTIONS);
    const refusals = (artifacts.Impl!.composition as {
      readonly refusedEntries?: readonly { readonly functionName: string; readonly reason: string }[];
    } | undefined)?.refusedEntries ?? [];

    expect(refusals.map((refused) => refused.functionName)).toStrictEqual(['Impl.initialize()']);
    expect(refusals[0]!.reason).toContain("a proxy implementation's entry");
    expect(refusals[0]!.reason).toContain('__internal__proxyMasterIndex');
    const published = (artifacts.Impl!.composition as {
      readonly stopSites?: { readonly entries: readonly { readonly functionName: string }[] };
    } | undefined)?.stopSites?.entries ?? [];
    expect(published.map((entry) => entry.functionName)).not.toContain('Impl.initialize()');
  });

  it('refuses the initialize hop by name rather than reporting the stub\'s opcode', async () => {
    const artifacts = compileStringMulti(REFUSED_SOURCE, COMPILE_OPTIONS);
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const { funder, implFunding, proxyFunding, changeAddress, deployerLock } = await funded(network);

    const deployment = deployPerCallProxy({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      implementationDeploy: { fundingUtxo: implFunding, funder, changeAddress },
      proxyDeploy: { fundingUtxo: proxyFunding, funder, changeAddress },
      initialize: { functionName: 'initialize', args: [deployerLock] },
      callerLockingBytecode: deployerLock,
      vm: compositionMachine(),
    });

    await expect(deployment).rejects.toThrow(PerCallProxyDeployError);
    await expect(deployment).rejects.toThrow(
      /the implementation's "initialize" entry is refused by the compiler.*__internal__proxyMasterIndex/,
    );
    await expect(deployment).rejects.not.toThrow(/opcode 105/);
  });

  it('refuses the same entry by name when a caller reaches it later, through the call surface', async () => {
    const artifacts = compileStringMulti(REFUSED_SOURCE, COMPILE_OPTIONS);
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const { funder, deployerLock } = await funded(network);

    // The refusal is a fact about the artifact, so it is read before the live pools are: the categories below name
    // no deployment.
    const call = callPerCallProxyEntry({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      proxyCategoryId: PROXY_CATEGORY,
      implementationCategoryId: IMPL_CATEGORY,
      functionName: 'initialize',
      args: [deployerLock],
      callerUtxo: { txid: '55'.repeat(32), vout: 0, satoshis: 100_000n },
      callerLockingBytecode: deployerLock,
      funder,
    });

    await expect(call).rejects.toThrow(PerCallProxyDeployError);
    await expect(call).rejects.toThrow(/the implementation's "initialize" entry is refused by the compiler/);
  });

  it('settles the same hop when the implementation declares no initializer inference', async () => {
    // The control: the same fields and the same initialize body, reached through the same shipped path. What
    // decides the refusal is the delegate marking the initializer modifier carries, not the hop itself.
    const artifacts = compileStringMulti(SERVED_SOURCE, COMPILE_OPTIONS);
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const { funder, implFunding, proxyFunding, changeAddress, deployerLock } = await funded(network);
    const proxy = buildProxyArtifact(artifacts.Impl!);

    const deployment = await deployPerCallProxy({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      implementationDeploy: { fundingUtxo: implFunding, funder, changeAddress },
      proxyDeploy: { fundingUtxo: proxyFunding, funder, changeAddress },
      initialize: { functionName: 'initialize', args: [deployerLock] },
      callerLockingBytecode: deployerLock,
      vm: compositionMachine(),
    });

    expect(deployment.initialize.completed.map((frame) => frame.functionName))
      .toStrictEqual([`${artifacts.Impl!.contractName}.initialize()`, `${proxy.contractName}.__fallback()`]);
    expect(deployment.initialize.accepted).toBe(true);
  });
});
