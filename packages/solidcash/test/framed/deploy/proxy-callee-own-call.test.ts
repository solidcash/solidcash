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
 * A proxied entry whose callee makes a call of its own, one hop deeper than the entry itself.
 *
 * A callee frame carries its own call records like any other frame, so the plan has to place the callee's callees
 * as well: the outer frame binds the record of the call it makes, and that record's callee is itself settled
 * against the calls its own body makes. The case settles three frames deep (the proxy, the implementation, the
 * callee and the callee's own static callee) and asserts the transaction is the one the chain carries.
 */

const IMPL_CATEGORY = '11'.repeat(31) + 'ee';
const PROXY_CATEGORY = '22'.repeat(31) + 'dd';
const OUTER_CATEGORY = '55'.repeat(31) + 'aa';
const INNER_CATEGORY = '66'.repeat(31) + 'bb';
const CALLER_TXID = '33'.repeat(31) + 'cc';

const VALIDATOR_PROGRAM = framedValidator.buildValidatorProgram();
const OUTER_ADDRESS = validatorAddress(hexToBin(OUTER_CATEGORY), VALIDATOR_PROGRAM);
const INNER_ADDRESS = validatorAddress(hexToBin(INNER_CATEGORY), VALIDATOR_PROGRAM);

/**
 * The implementation reaches `Outer.run()`, whose own body reads a view of `Inner` and then writes its record.
 *
 * The order matters: the callee's write follows its own call, so the frame declares the record it wrote in one
 * segment and keeps it in the next, exactly as the entry's own body does one level up.
 */
function sourceOf(): string {
  return 'pragma solidcash ^0.14.0;'
    + ' interface IInner { function probe(uint x) view returns (uint); }'
    + ' contract Inner {'
    + '   uint public hits;'
    + '   function probe(uint x) view returns (uint) { return x + 1; }'
    + ' }'
    + ' interface IOuter { function run(uint x) returns (uint); }'
    + ' contract Outer {'
    + '   uint public total;'
    + `   function run(uint x) returns (uint) { uint v = IInner(0x${binToHex(INNER_ADDRESS)}).probe(x);`
    + '     this.total = this.total + v; return v; }'
    + ' }'
    + ' contract Ledger {'
    + '   struct Entry { uint state; uint worker; uint externalId; uint amount; }'
    + '   address public implementation;'
    + '   Entry[] public rows;'
    + '   function initialize(uint amount_) { this.rows.push(); this.rows[0].amount = amount_; }'
    + '   function run(uint id_) {'
    + '     Entry storage entry = this.rows[id_];'
    + '     require(entry.state == 0);'
    + `     entry.externalId = IOuter(0x${binToHex(OUTER_ADDRESS)}).run(id_);`
    + '     entry.state = 1;'
    + '   }'
    + ' }';
}

/** Deploys the callee, the callee's own callee, then the implementation and its proxy, seeding the entry. */
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
    initialize: { functionName: 'initialize', args: [7n] as never },
    callerLockingBytecode: deployerLock,
    callerFunding: { utxo: callerUtxos[0]!, funder: signature.unlockP2PKH() },
    vm: compositionMachine(),
  });
  return {
    network, artifacts, callerUtxos, deployerLock, changeAddress: funder.address, signature,
    initialized: deployment.initialize.accepted,
  };
}

describe('a proxied entry whose callee makes a call of its own', () => {
  it('settles the callee and the callee\u2019s own static callee, and broadcasts', async () => {
    const { network, artifacts, callerUtxos, deployerLock, changeAddress, signature, initialized } = await deploy();
    expect(initialized).toBe(true);
    // The callee's own body publishes its view call, so the hop has a record to place one level below the callee.
    const callee = artifacts.Outer!.abi.find((candidate) => candidate.name === 'run')!;
    expect((callee.externalCalls ?? []).map((call) => call.functionName)).toStrictEqual(['probe']);

    const result = await callFramedProxyEntry({
      provider: network,
      implementationArtifact: artifacts.Ledger!,
      proxyArtifact: buildProxyArtifact(artifacts.Ledger!),
      proxyCategoryId: PROXY_CATEGORY,
      implementationCategoryId: IMPL_CATEGORY,
      functionName: 'run',
      args: [0n] as never,
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
