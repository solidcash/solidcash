import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { validatorAddress, type Artifact } from '@solidcash/utils';
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
 * A proxied entry whose callee writes one of its own records on both sides of the call its body makes.
 *
 * A callee with k calls closes k + 1 segments, and the artifact publishes each of the callee's own record writes by
 * the segment it closes in. A write the source puts before the first call and again after the last one is therefore
 * declared in two segments with the ones between them carrying the record rather than writing it, and the frame's
 * view of it has to chain across every one of those. The call is conditional and the last segment also creates a
 * mapping node, so that segment carries a written record and a created node together. This pins the shape from the
 * outermost level: the implementation frame reaches `Outer.run`, whose own body writes `status`, calls a view
 * entry, writes `total` and `held`, then writes `status` again, and the transaction the hop settles is the one the
 * chain carries.
 */

const IMPL_CATEGORY = '11'.repeat(31) + 'ee';
const PROXY_CATEGORY = '22'.repeat(31) + 'dd';
const OUTER_CATEGORY = '55'.repeat(31) + 'aa';
const INNER_CATEGORY = '66'.repeat(31) + 'bb';
const CALLER_TXID = '33'.repeat(31) + 'cc';

const VALIDATOR_PROGRAM = framedValidator.buildValidatorProgram();
const OUTER_ADDRESS = validatorAddress(hexToBin(OUTER_CATEGORY), VALIDATOR_PROGRAM);
const INNER_ADDRESS = validatorAddress(hexToBin(INNER_CATEGORY), VALIDATOR_PROGRAM);

/** The callee writes one record before its first call and again after its last, and another in between. */
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
    + '   uint public total;'
    + '   mapping(uint => uint) public held;'
    + '   function run(uint x, uint mode) returns (uint) {'
    + '     this.status = this.status + 1;'
    + '     uint a = 0;'
    + '     if (mode > 0) {'
    + `       a = IInner(0x${binToHex(INNER_ADDRESS)}).probe(x);`
    + '       this.total = this.total + a;'
    + '     }'
    + '     this.held[x] = a + 1;'
    + '     this.status = this.status + 1;'
    + '     return this.status;'
    + '   }'
    + ' }'
    + ' contract Ledger {'
    + '   address public implementation;'
    + '   uint public stored;'
    + '   function initialize() { require(true); }'
    + `   function run(uint x, uint mode) { this.stored = IOuter(0x${binToHex(OUTER_ADDRESS)}).run(x, mode); }`
    + ' }';
}

/** Deploys the callee and its own callee, then the implementation behind its proxy. */
async function deploy(): Promise<{
  readonly network: MockNetworkProvider;
  readonly artifacts: ReturnType<typeof compileStringMulti>;
  readonly callerUtxos: readonly { txid: string; vout: number; satoshis: bigint }[];
  readonly deployerLock: Uint8Array;
  readonly changeAddress: string;
  readonly signature: SignatureTemplate;
  readonly initialized: boolean;
}> {
  const artifacts = compileStringMulti(sourceOf(), { composition: 'framed' });
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
  await network.addUtxo(funder.address, innerFunding);
  await fundShippedFacets(network);
  for (const coin of callerUtxos) await network.addUtxo(binToHex(deployerLock), coin);
  const funderUnlock = funder.unlock.spend(alicePub, signature);
  // A deployment's token category is its funding coin's transaction id, so the coin carries the id the site names.
  await deployStatefulContract(artifacts.Inner as Artifact, [], {
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

describe('a proxied entry whose callee writes a record on both sides of its call', () => {
  it('chains the record across its segment boundaries and broadcasts', async () => {
    const { network, artifacts, callerUtxos, deployerLock, changeAddress, signature, initialized } = await deploy();
    expect(initialized).toBe(true);
    // The callee publishes two calls and the segment each of its own records is written in, so the hop has the
    // spans to place one level below the callee.
    const callee = artifacts.Outer!.abi.find((candidate) => candidate.name === 'run')!;
    expect((callee.externalCalls ?? []).map((call) => call.functionName)).toStrictEqual(['probe']);

    const result = await callFramedProxyEntry({
      provider: network,
      implementationArtifact: artifacts.Ledger!,
      proxyArtifact: buildProxyArtifact(artifacts.Ledger!),
      proxyCategoryId: PROXY_CATEGORY,
      implementationCategoryId: IMPL_CATEGORY,
      functionName: 'run',
      args: [3n, 1n] as never,
      externals: {
        IOuter: { artifact: artifacts.Outer as Artifact, categoryId: OUTER_CATEGORY },
        IInner: { artifact: artifacts.Inner as Artifact, categoryId: INNER_CATEGORY },
      },
      // The seeding initialize spends the first caller coin, so the entry's own call takes another.
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
