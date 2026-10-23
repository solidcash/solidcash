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
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { aliceAddress, alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * An entry that fails its own check after an earlier call, beside a callee whose refusal names no source reason.
 *
 * The entry reads `Linker.isReady()` first, then fails its own `require` before the call to the wedge. In the
 * settle the earlier call is unbound when the entry's program is first read, so the entry stops on the unfilled
 * reference rather than its own check, and its refusal names no source line. The wedge's own `require(false)`
 * publishes a source line but no message either, so its objection has none. The entry's own reason is the one a
 * caller must read: the entry's frame is derived with the earlier call bound and the wedge's verdict deferred, so
 * it reaches its own check and names its message instead of the wedge's unattributed refusal.
 */

/** A 32-byte id whose bytes vary and whose reverse is a different value. */
function id32(lead: string): string {
  return `${lead.repeat(31)}c4`;
}

const LINKER_CATEGORY = id32('5a');
const WEDGE_CATEGORY = id32('5b');
const IMPL_CATEGORY = id32('5c');
const PROXY_CATEGORY = id32('5d');

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ILinker { function isReady() returns (bool); }'
  + ' interface IWedge { function wedge(); }'
  + ' contract Linker {'
  + '   int public ready;'
  + '   function isReady() returns (bool) { return this.ready == 0; }'
  + ' }'
  + ' contract Wedge {'
  + '   int public hits;'
  + '   function wedge() { require(false); }'
  + ' }'
  + ' contract Impl {'
  + '   address public implementation;'
  + '   uint public initialized;'
  + '   address public linker;'
  + '   int public gate;'
  + '   function initialize(address linker_) { require(this.initialized == 0); this.initialized = 1; this.linker = linker_; }'
  + '   function run(address wedge_) {'
  + '     require(ILinker(this.linker).isReady());'
  + '     require(this.gate > 0, "entry gate");'
  + '     IWedge(wedge_).wedge();'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const impl = artifacts.Impl!;
const linker = artifacts.Linker!;
const wedge = artifacts.Wedge!;
const linkerAddress = deployMaster(linker, hexToBin(LINKER_CATEGORY), VALIDATOR_PROGRAM).address;
const wedgeAddress = deployMaster(wedge, hexToBin(WEDGE_CATEGORY), VALIDATOR_PROGRAM).address;

interface Deployed {
  readonly network: MockNetworkProvider;
  readonly proxyCategoryId: string;
  readonly implementationCategoryId: string;
  readonly deployerLock: Uint8Array;
  readonly changeAddress: string;
  readonly callCoin: { txid: string; vout: number; satoshis: bigint };
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
}

/** Deploys both callees plainly and the entry behind the generated proxy, plus a coin a caller enters a hop with. */
async function deployed(): Promise<Deployed> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const source = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = source.unlock.spend(alicePub, signature);
  const aliceFunder = signature.unlockP2PKH();

  for (const [artifact, category] of [[linker, LINKER_CATEGORY], [wedge, WEDGE_CATEGORY]] as const) {
    const fundingCoin = { txid: category, vout: 0, satoshis: 500_000n };
    await network.addUtxo(aliceAddress, fundingCoin);
    await deployStatefulContract(artifact, [], {
      fundingUtxo: fundingCoin, funder: aliceFunder, changeAddress: aliceAddress, provider: network, threadCount: 4,
    });
  }

  const implFunding = { txid: IMPL_CATEGORY, vout: 0, satoshis: 500_000n };
  const proxyFunding = { txid: PROXY_CATEGORY, vout: 0, satoshis: 500_000n };
  const hopCoin = { txid: id32('5e'), vout: 0, satoshis: 300_000n };
  const callCoin = { txid: id32('5f'), vout: 0, satoshis: 300_000n };
  for (const coin of [implFunding, proxyFunding]) await network.addUtxo(source.address, coin);
  const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);
  for (const coin of [hopCoin, callCoin]) await network.addUtxo(binToHex(deployerLock), coin);
  await fundShippedFacets(network);

  const deployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: impl,
    implementationDeploy: { fundingUtxo: implFunding, funder, changeAddress: source.address },
    proxyDeploy: { fundingUtxo: proxyFunding, funder, changeAddress: source.address },
    initialize: { functionName: 'initialize', args: [linkerAddress] },
    callerLockingBytecode: deployerLock,
    callerFunding: { utxo: hopCoin, funder: aliceFunder, changeAddress: source.address },
    vm: compositionMachine(),
  });
  expect(deployment.initialize.broadcast).toBeDefined();
  return {
    network, proxyCategoryId: deployment.proxy.categoryId,
    implementationCategoryId: deployment.implementation.categoryId,
    deployerLock, changeAddress: source.address, callCoin, funder: aliceFunder,
  };
}

describe('an unattributed callee refusal beside the entry\'s own check', () => {
  it('names the entry\'s own source reason, not the callee whose objection has no source line', async () => {
    const funded = await deployed();

    await expect(callFramedProxyEntry({
      provider: funded.network,
      implementationArtifact: impl,
      proxyArtifact: buildProxyArtifact(impl),
      proxyCategoryId: funded.proxyCategoryId,
      implementationCategoryId: funded.implementationCategoryId,
      functionName: 'run',
      args: [wedgeAddress],
      externals: {
        ILinker: { artifact: linker, categoryId: LINKER_CATEGORY },
        IWedge: { artifact: wedge, categoryId: WEDGE_CATEGORY },
      },
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    })).rejects.toThrow(new RegExp(
      'the implementation\'s "run" entry did not settle through the proxy: frame "implementation-master" of '
      + 'Impl\\.run\\(\\) at line \\d+: entry gate \\(Program failed an OP_VERIFY operation\\.\\)',
    ));
  });
});
