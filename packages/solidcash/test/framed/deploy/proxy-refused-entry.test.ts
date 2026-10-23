import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import {
  FramedProxyDeployError, buildProxyArtifact, callFramedProxyEntry, deployFramedProxy,
  type FramedProxyCallerFunding,
} from '../../../src/framed/proxy/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';

/**
 * An implementation entry the compiler refused is reported by name, not as the opcode its stub fails on.
 *
 * A body a framed master cannot serve is emitted as a body that fails whenever the dispatcher reaches it, so a
 * hop that runs one stops on that stub. The artifact publishes the reason beside the stop sites, and the deployment
 * has to say which entry the compiler refused rather than report the opcode the stub stopped on. The refused shape
 * here is an opaque low-level call, which names no method to lower to.
 *
 * The shape this file used before - a Solidity-compatible `initializer`-marked entry - is served as of 2026-09-28
 * (initializer inference is a direct-convention lowering and no longer runs for this convention), and the last case
 * asserts that: it compiles, and the same hop settles through the same shipped path.
 */

const IMPL_CATEGORY = '31'.repeat(31) + 'ce';
const PROXY_CATEGORY = '42'.repeat(31) + 'bd';

// The refused shape: the payload is opaque, so the call names no method the convention could compile as a typed
// call, and the body keeps its own low-level refusal.
const REFUSED_SOURCE = 'pragma solidcash ^0.14.0;\n'
  + 'contract Impl {\n'
  + '  uint public initialized;\n'
  + '  int public version;\n'
  + '  bytes32 public contentHash;\n'
  + '  bytes32 public resultHash;\n'
  + '  bytes32 public jobSalt;\n'
  + '  bytes32 public metaHash;\n'
  + '  function initialize(address expected) {\n'
  + '    (bool ok, bytes ret) = address(expected).call(hex"deadbeef");\n'
  + '    require(ok);\n'
  + '    require(msg.sender == expected);\n'
  + '    this.initialized = 1;\n'
  + '    this.version = 7;\n'
  + '  }\n'
  + '}\n';

// The same fields and the same body with the opaque call replaced by a state write: an ordinary framed entry.
const SERVED_SOURCE = 'pragma solidcash ^0.14.0;\n'
  + 'contract Impl {\n'
  + '  uint public initialized;\n'
  + '  int public version;\n'
  + '  bytes32 public contentHash;\n'
  + '  bytes32 public resultHash;\n'
  + '  bytes32 public jobSalt;\n'
  + '  bytes32 public metaHash;\n'
  + '  function initialize(address expected) {\n'
  + '    require(msg.sender == expected);\n'
  + '    this.initialized = 1;\n'
  + '    this.version = 7;\n'
  + '  }\n'
  + '}\n';

/**
 * The Solidity-compatible shape initializer inference used to refuse for this convention. Its clock read adds no
 * record, so it names its proxy's address itself: a generated proxy keeps no record of its own beside one record.
 */
const INITIALIZER_SOURCE = 'pragma solidity ^0.8.19;\n'
  + 'contract Impl {\n'
  + '  address public implementation;\n'
  + '  uint public initialized;\n'
  + '  int public version;\n'
  + '  uint public lastSeen;\n'
  + '  modifier initializer() { require(initialized == 0); _; }\n'
  + '  function initialize(address expected) public initializer {\n'
  + '    require(msg.sender == expected);\n'
  + '    initialized = 1;\n'
  + '    version = 7;\n'
  + '    lastSeen = block.timestamp;\n'
  + '  }\n'
  + '}\n';

/** The served fields and initialize, beside an entry that runs a kept subroutine reading its contract's balance. */
const KEPT_BALANCE_SOURCE = SERVED_SOURCE.replace(/}\n$/, ''
  + '  function settle(int expected) { require(mine() == expected); this.version = 8; }\n'
  + '  function mine() internal view returns (int) { return address(this).balance; }\n'
  + '}\n');

const COMPILE_OPTIONS = { composition: 'framed' } as const;
const SOLIDITY_OPTIONS = { composition: 'framed', evmCompat: true } as const;

/** Funds the two genesis UTXOs and the hop's caller coin, and returns the deployer's own lock and funders. */
async function funded(network: MockNetworkProvider): Promise<{
  readonly funder: ReturnType<Contract['unlock']['spend']>;
  readonly implFunding: { txid: string; vout: number; satoshis: bigint };
  readonly proxyFunding: { txid: string; vout: number; satoshis: bigint };
  readonly deployerLock: Uint8Array;
  readonly changeAddress: string;
  readonly callerFunding: FramedProxyCallerFunding;
}> {
  const signature = new SignatureTemplate(alicePriv);
  const funder = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const implFunding = { txid: IMPL_CATEGORY, vout: 0, satoshis: 500_000n };
  const proxyFunding = { txid: PROXY_CATEGORY, vout: 0, satoshis: 500_000n };
  await network.addUtxo(funder.address, implFunding);
  await network.addUtxo(funder.address, proxyFunding);
  // The initialize hop is entered with the deployer's own coin, at its own P2PKH lock.
  const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);
  const callerUtxo = { txid: '53'.repeat(31) + 'af', vout: 0, satoshis: 100_000n };
  await network.addUtxo(binToHex(deployerLock), callerUtxo);
  return {
    funder: funder.unlock.spend(alicePub, signature),
    implFunding,
    proxyFunding,
    deployerLock,
    changeAddress: funder.address,
    callerFunding: { utxo: callerUtxo, funder: signature.unlockP2PKH() },
  };
}

describe('a hop whose implementation entry the compiler refused', () => {
  it('publishes the refusal by name and emits no served body for it', () => {
    const artifacts = compileStringMulti(REFUSED_SOURCE, COMPILE_OPTIONS);
    const refusals = artifacts.Impl!.composition?.refusedEntries ?? [];

    expect(refusals.map((refused) => refused.functionName)).toStrictEqual(['Impl.initialize()']);
    expect(refusals[0]!.reason).toContain("the call to '__raw__'");
    const published = artifacts.Impl!.composition?.stopSites?.entries ?? [];
    expect(published.map((entry) => entry.functionName)).not.toContain('Impl.initialize()');
  });

  it('refuses the initialize hop by name rather than reporting the stub\'s opcode', async () => {
    const artifacts = compileStringMulti(REFUSED_SOURCE, COMPILE_OPTIONS);
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const { funder, implFunding, proxyFunding, changeAddress, deployerLock, callerFunding } = await funded(network);

    const deployment = deployFramedProxy({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      implementationDeploy: { fundingUtxo: implFunding, funder, changeAddress },
      proxyDeploy: { fundingUtxo: proxyFunding, funder, changeAddress },
      initialize: { functionName: 'initialize', args: [deployerLock] },
      callerLockingBytecode: deployerLock,
      callerFunding,
      vm: compositionMachine(),
    });

    await expect(deployment).rejects.toThrow(FramedProxyDeployError);
    await expect(deployment).rejects.toThrow(
      /the implementation's "initialize" entry is refused by the compiler \(Impl\.initialize\(\)\).*'__raw__'/,
    );
    await expect(deployment).rejects.not.toThrow(/stopped at opcode/);
  });

  it('refuses the same entry by name when a caller reaches it later, through the call surface', async () => {
    const artifacts = compileStringMulti(REFUSED_SOURCE, COMPILE_OPTIONS);
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const { funder, deployerLock } = await funded(network);

    // The refusal is a fact about the artifact, so it is read before the live pools are: the categories below name
    // no deployment.
    const call = callFramedProxyEntry({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      proxyCategoryId: PROXY_CATEGORY,
      implementationCategoryId: IMPL_CATEGORY,
      functionName: 'initialize',
      args: [deployerLock],
      callerUtxo: { txid: '55'.repeat(31) + 'aa', vout: 0, satoshis: 100_000n },
      callerLockingBytecode: deployerLock,
      funder,
    });

    await expect(call).rejects.toThrow(FramedProxyDeployError);
    await expect(call).rejects.toThrow(/the implementation's "initialize" entry is refused by the compiler/);
  });

  it('refuses by name an entry that runs a kept subroutine reading its contract\'s balance', async () => {
    // The subroutine's definition is emitted as a refusal stub, so the implementation compiles and the entry that
    // runs it is published as refused, which the call surface reads before the live pools.
    const artifacts = compileStringMulti(KEPT_BALANCE_SOURCE, COMPILE_OPTIONS);
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const { funder, deployerLock } = await funded(network);
    const call = callFramedProxyEntry({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      proxyCategoryId: PROXY_CATEGORY,
      implementationCategoryId: IMPL_CATEGORY,
      functionName: 'settle',
      args: [0n],
      callerUtxo: { txid: '55'.repeat(31) + 'ab', vout: 0, satoshis: 100_000n },
      callerLockingBytecode: deployerLock,
      funder,
    });

    await expect(call).rejects.toThrow(FramedProxyDeployError);
    await expect(call).rejects.toThrow('the implementation\'s "settle" entry is refused by the compiler '
      + '(Impl.settle()): it runs \'mine\', which the master cannot serve: the body reads its contract\'s balance');
  });

  it('settles the same hop when the entry has no refusal of its own', async () => {
    // The control: the same fields and the same initialize body without the opaque call, reached through the same
    // shipped path. What decides the refusal is the body's own shape, not the hop itself.
    const artifacts = compileStringMulti(SERVED_SOURCE, COMPILE_OPTIONS);
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const { funder, implFunding, proxyFunding, changeAddress, deployerLock, callerFunding } = await funded(network);
    const proxy = buildProxyArtifact(artifacts.Impl!);

    const deployment = await deployFramedProxy({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      implementationDeploy: { fundingUtxo: implFunding, funder, changeAddress },
      proxyDeploy: { fundingUtxo: proxyFunding, funder, changeAddress },
      initialize: { functionName: 'initialize', args: [deployerLock] },
      callerLockingBytecode: deployerLock,
      callerFunding,
      vm: compositionMachine(),
    });

    expect(deployment.initialize.completed.map((frame) => frame.functionName))
      .toStrictEqual([`${artifacts.Impl!.contractName}.initialize()`, `${proxy.contractName}.__fallback()`]);
    expect(deployment.initialize.accepted).toBe(true);
  });

  it('serves a Solidity-compatible proxy implementation whose entries initializer inference would mark', async () => {
    // Initializer inference belongs to the direct convention, which hands an entry the co-spent proxy master's
    // input index; a framed master serves a delegate frame from the records its own block declares. So the
    // marking no longer runs for this convention, the entries stay ordinary bodies, and the hop settles.
    const artifacts = compileStringMulti(INITIALIZER_SOURCE, SOLIDITY_OPTIONS);
    const refusals = artifacts.Impl!.composition?.refusedEntries ?? [];
    expect(refusals).toStrictEqual([]);
    expect(artifacts.Impl!.abi.some((entry) => entry.inputs.some(
      (input) => input.name === '__internal__proxyMasterIndex',
    ))).toBe(false);

    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const { funder, implFunding, proxyFunding, changeAddress, deployerLock, callerFunding } = await funded(network);
    const deployment = await deployFramedProxy({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      implementationDeploy: { fundingUtxo: implFunding, funder, changeAddress },
      proxyDeploy: { fundingUtxo: proxyFunding, funder, changeAddress },
      initialize: { functionName: 'initialize', args: [deployerLock] },
      callerLockingBytecode: deployerLock,
      callerFunding,
      vm: compositionMachine(),
    });

    expect(deployment.initialize.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(deployment.initialize.accepted).toBe(true);
  });
});
