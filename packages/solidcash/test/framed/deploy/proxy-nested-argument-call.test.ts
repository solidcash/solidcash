import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { validatorAddress, type Artifact } from '@solidcash/utils';
import { framedValidator } from '@solidcash/solidc';
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
 * A proxied entry that feeds one external call's return value straight into another call's argument.
 *
 * The execution reaches the call an argument makes before the call it feeds, and the value the first leaves is what
 * the second's argument digest consumes. The compiler publishes the two sites in source order, so the record each
 * body binds has to be the published position rather than the order the emission happens to reach them, and the
 * digest has to read the value the first site left rather than a value of its own.
 *
 * The same value passed through a local first, one call's result held and handed to the next, is
 * `call/argument-from-earlier-result.test.ts` ("passes each result on to the next call and broadcasts the chain").
 */

const IMPL_CATEGORY = '11'.repeat(31) + 'ee';
const PROXY_CATEGORY = '22'.repeat(31) + 'dd';
const SERVICE_CATEGORY = '55'.repeat(31) + 'aa';
const CALLER_TXID = '33'.repeat(31) + 'cc';

const VALIDATOR_PROGRAM = framedValidator.buildValidatorProgram();
const SERVICE_ADDRESS = validatorAddress(hexToBin(SERVICE_CATEGORY), VALIDATOR_PROGRAM);

/** The entry whose outer call's argument list makes the inner call. */
function sourceOf(): string {
  const service = `IService(0x${binToHex(SERVICE_ADDRESS)})`;
  return 'pragma solidcash ^0.14.0;'
    + ' interface IService { function apply(uint id_, uint amount_, uint fee_) returns (uint);'
    + '   function feeOf(uint id_) view returns (uint); }'
    + ' contract Service {'
    + '   int public applied;'
    + '   function apply(uint id_, uint amount_, uint fee_) returns (uint) {'
    + '     this.applied = this.applied + 1; return id_ + amount_ + fee_; }'
    + '   function feeOf(uint id_) view returns (uint) { return id_ + 1; }'
    + ' }'
    + ' contract Ledger {'
    + '   struct Entry { uint state; uint worker; uint externalId; uint amount; }'
    + '   address public implementation;'
    + '   Entry[] public rows;'
    + '   function initialize(uint amount_) {'
    + '     this.rows.push(); this.rows[0].amount = amount_;'
    + '   }'
    + '   function run(uint id_) {'
    + '     Entry storage entry = this.rows[id_];'
    + '     require(entry.state == 0);'
    + `     entry.externalId = ${service}.apply(id_, entry.amount, ${service}.feeOf(id_));`
    + '     entry.state = 1;'
    + '   }'
    + ' }';
}

interface Funding {
  readonly network: MockNetworkProvider;
  readonly funder: ReturnType<Contract['unlock']['spend']>;
  readonly implFunding: { txid: string; vout: number; satoshis: bigint };
  readonly proxyFunding: { txid: string; vout: number; satoshis: bigint };
  readonly callerUtxos: readonly { txid: string; vout: number; satoshis: bigint }[];
  readonly deployerLock: Uint8Array;
  readonly changeAddress: string;
  readonly signature: SignatureTemplate;
}

/** Funds the two genesis UTXOs, the callee's own coin and the deployer's. */
async function funded(network: MockNetworkProvider): Promise<Funding> {
  const signature = new SignatureTemplate(alicePriv);
  const funder = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const implFunding = { txid: IMPL_CATEGORY, vout: 0, satoshis: 500_000n };
  const proxyFunding = { txid: PROXY_CATEGORY, vout: 0, satoshis: 500_000n };
  const serviceFunding = { txid: SERVICE_CATEGORY, vout: 0, satoshis: 5_000_000n };
  const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);
  const callerUtxos = Array.from({ length: 4 }, (_unused, index) => ({
    txid: `${CALLER_TXID.slice(0, 62)}${(index + 1).toString(16).padStart(2, '0')}`,
    vout: 0, satoshis: 100_000n,
  }));
  await network.addUtxo(funder.address, implFunding);
  await network.addUtxo(funder.address, proxyFunding);
  await network.addUtxo(funder.address, serviceFunding);
  await fundShippedFacets(network);
  for (const coin of callerUtxos) await network.addUtxo(binToHex(deployerLock), coin);
  return {
    network, funder: funder.unlock.spend(alicePub, signature), signature,
    implFunding, proxyFunding, callerUtxos, deployerLock, changeAddress: funder.address,
  };
}

/** Deploys the callee, then the implementation and its proxy, broadcasting the seeding initialize. */
async function deploy(): Promise<{
  readonly network: MockNetworkProvider;
  readonly artifacts: ReturnType<typeof compileStringMulti>;
  readonly service: Artifact;
  readonly funding: Funding;
  readonly initialized: boolean;
}> {
  const artifacts = compileStringMulti(sourceOf(), { composition: 'framed' });
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const funding = await funded(network);
  // A deployment's token category is its funding coin's transaction id, so the coin carries the id the site names.
  await deployStatefulContract(artifacts.Service!, [], {
    fundingUtxo: { txid: SERVICE_CATEGORY, vout: 0, satoshis: 5_000_000n },
    funder: funding.funder, changeAddress: funding.changeAddress,
    provider: network, threadCount: 4,
  });
  const deployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: artifacts.Ledger!,
    implementationDeploy: {
      fundingUtxo: funding.implFunding, funder: funding.funder, changeAddress: funding.changeAddress,
    },
    proxyDeploy: {
      fundingUtxo: funding.proxyFunding, funder: funding.funder, changeAddress: funding.changeAddress,
    },
    initialize: { functionName: 'initialize', args: [7n] as never },
    callerLockingBytecode: funding.deployerLock,
    callerFunding: { utxo: funding.callerUtxos[0]!, funder: funding.signature.unlockP2PKH() },
    vm: compositionMachine(),
  });
  return {
    network, artifacts, service: artifacts.Service!, funding, initialized: deployment.initialize.accepted,
  };
}

/** Calls the entry through the shipped hop and returns whether every frame accepted. */
async function callEntry(): Promise<{
  readonly accepted: boolean;
  readonly txid: string | undefined;
}> {
  const { network, artifacts, service, funding } = await deploy();
  const result = await callFramedProxyEntry({
    provider: network,
    implementationArtifact: artifacts.Ledger!,
    proxyArtifact: buildProxyArtifact(artifacts.Ledger!),
    proxyCategoryId: PROXY_CATEGORY,
    implementationCategoryId: IMPL_CATEGORY,
    functionName: 'run',
    args: [0n] as never,
    externals: { IService: { artifact: service, categoryId: SERVICE_CATEGORY } },
    // The seeding initialize spends the first caller coin, so the entry's own call takes another.
    callerUtxo: funding.callerUtxos[1]!,
    callerLockingBytecode: funding.deployerLock,
    funder: funding.signature.unlockP2PKH(),
    changeAddress: funding.changeAddress,
    vm: compositionMachine(),
  });
  return {
    accepted: result.verdicts.every((verdict) => verdict.accepted),
    txid: result.broadcast?.txid,
  };
}

describe('a proxied entry that feeds one call into another call\u2019s argument', () => {
  it('settles and broadcasts with the inner call inlined into the outer call\u2019s argument list', async () => {
    const artifacts = compileStringMulti(sourceOf(), { composition: 'framed' });
    const entry = artifacts.Ledger!.abi.find((candidate) => candidate.name === 'run')!;
    // The compiler publishes the argument's own call beside the call it feeds, in the order the execution reaches
    // them; the body binds those positions, not the order its own emission happens to reach them.
    expect((entry.externalCalls ?? []).map((call) => call.functionName)).toStrictEqual(['feeOf', 'apply']);

    const { accepted, txid } = await callEntry();
    expect(accepted).toBe(true);
    expect(txid).toMatch(/^[0-9a-f]{64}$/);
  }, 300_000);
});
