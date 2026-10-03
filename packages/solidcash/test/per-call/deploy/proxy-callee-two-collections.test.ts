import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { validatorAddress, type Artifact } from '@solidcash/utils';
import { perCallValidator } from 'solidc';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { buildProxyArtifact, deployPerCallProxy } from '../../../src/per-call/proxy/index.js';
import { callPerCallProxyEntry } from '../../../src/per-call/proxy/deploy.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A callee whose own body writes mapping collections beside the calls it makes.
 *
 * The callee's frame declares one segment per call plus one, and each write lands in the segment its own source
 * fixes. With two collections the frame declares two collections' nodes, so the plan has to place each write's
 * records in the segment that write names rather than all of them in one.
 *
 * The one-collection sibling reaches the same calls with one collection's nodes, so it isolates the second
 * collection from the call itself.
 */

const IMPL_CATEGORY = '11'.repeat(31) + 'ee';
const PROXY_CATEGORY = '22'.repeat(31) + 'dd';
const DESK_CATEGORY = '55'.repeat(31) + 'aa';
const PROBE_CATEGORY = '66'.repeat(31) + 'bb';
const CALLER_TXID = '33'.repeat(31) + 'cc';

const VALIDATOR_PROGRAM = perCallValidator.buildValidatorProgram();
const DESK_ADDRESS = validatorAddress(hexToBin(DESK_CATEGORY), VALIDATOR_PROGRAM);
const PROBE_ADDRESS = validatorAddress(hexToBin(PROBE_CATEGORY), VALIDATOR_PROGRAM);

/** The callee writes one collection or two; everything else about the two shapes is the same. */
function sourceOf(collections: 'one' | 'two'): string {
  return 'pragma solidcash ^0.13.0;'
    + ' struct Note { uint amount; uint fee; uint seen; }'
    + ' struct Book { uint low; uint high; }'
    + ' interface IProbe { function probe(uint x) view returns (uint); }'
    + ' contract Probe {'
    + '   uint public hits;'
    + '   function probe(uint x) view returns (uint) { return x + 1; }'
    + ' }'
    + ' contract Desk {'
    + '   uint public total;'
    + '   mapping(uint => Note) public notes;'
    + (collections === 'two' ? '   mapping(uint => Book) public books;' : '')
    + '   function record(uint x) returns (uint) {'
    + `     uint before = IProbe(0x${binToHex(PROBE_ADDRESS)}).probe(x);`
    + '     this.notes[x] = Note(before, x, before);'
    + (collections === 'two' ? '     this.books[x] = Book(before, x);' : '')
    + `     uint after = IProbe(0x${binToHex(PROBE_ADDRESS)}).probe(before);`
    + '     this.total = before + after;'
    + '     return after;'
    + '   }'
    + ' }'
    + ' interface IDesk { function record(uint x) returns (uint); }'
    + ' contract Ledger {'
    + '   struct Entry { uint state; uint worker; uint externalId; uint amount; }'
    + '   address public implementation;'
    + '   Entry[] public rows;'
    + '   function initialize(uint amount_) { this.rows.push(); this.rows[0].amount = amount_; }'
    + '   function run(uint id_) {'
    + '     Entry storage entry = this.rows[id_];'
    + '     require(entry.state == 0);'
    + `     entry.externalId = IDesk(0x${binToHex(DESK_ADDRESS)}).record(id_);`
    + '     entry.state = 1;'
    + '   }'
    + ' }';
}

async function deploy(collections: 'one' | 'two'): Promise<{
  readonly network: MockNetworkProvider;
  readonly artifacts: ReturnType<typeof compileStringMulti>;
  readonly callerUtxos: readonly { txid: string; vout: number; satoshis: bigint }[];
  readonly deployerLock: Uint8Array;
  readonly changeAddress: string;
  readonly signature: SignatureTemplate;
  readonly initialized: boolean;
}> {
  const artifacts = compileStringMulti(sourceOf(collections), { composition: 'per-call' });
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const funder = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const implFunding = { txid: IMPL_CATEGORY, vout: 0, satoshis: 500_000n };
  const proxyFunding = { txid: PROXY_CATEGORY, vout: 0, satoshis: 500_000n };
  const deskFunding = { txid: DESK_CATEGORY, vout: 0, satoshis: 5_000_000n };
  const probeFunding = { txid: PROBE_CATEGORY, vout: 0, satoshis: 5_000_000n };
  const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);
  const callerUtxos = Array.from({ length: 4 }, (_unused, index) => ({
    txid: `${CALLER_TXID.slice(0, 62)}${(index + 1).toString(16).padStart(2, '0')}`,
    vout: 0, satoshis: 100_000n,
  }));
  await network.addUtxo(funder.address, implFunding);
  await network.addUtxo(funder.address, proxyFunding);
  await network.addUtxo(funder.address, deskFunding);
  await network.addUtxo(funder.address, probeFunding);
  await fundShippedFacets(network);
  for (const coin of callerUtxos) await network.addUtxo(binToHex(deployerLock), coin);
  const funderUnlock = funder.unlock.spend(alicePub, signature);
  // A deployment's token category is its funding coin's transaction id, so each coin carries the id its site names.
  await deployStatefulContract(artifacts.Probe as Artifact, [], {
    fundingUtxo: probeFunding, funder: funderUnlock, changeAddress: funder.address,
    provider: network, threadCount: 4,
  });
  await deployStatefulContract(artifacts.Desk as Artifact, [], {
    fundingUtxo: deskFunding, funder: funderUnlock, changeAddress: funder.address,
    provider: network, threadCount: 4,
  });
  const deployment = await deployPerCallProxy({
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

/** Calls the entry through the shipped hop and reports what the transaction carried. */
async function record(collections: 'one' | 'two'): Promise<{
  readonly accepted: boolean;
  readonly txid: string | undefined;
  readonly slots: readonly string[];
}> {
  const { network, artifacts, callerUtxos, deployerLock, changeAddress, signature, initialized }
    = await deploy(collections);
  expect(initialized).toBe(true);
  const callee = artifacts.Desk!.abi.find((candidate) => candidate.name === 'record')!;
  const result = await callPerCallProxyEntry({
    provider: network,
    implementationArtifact: artifacts.Ledger!,
    proxyArtifact: buildProxyArtifact(artifacts.Ledger!),
    proxyCategoryId: PROXY_CATEGORY,
    implementationCategoryId: IMPL_CATEGORY,
    functionName: 'run',
    args: [0n] as never,
    externals: {
      IDesk: { artifact: artifacts.Desk as Artifact, categoryId: DESK_CATEGORY },
      IProbe: { artifact: artifacts.Probe as Artifact, categoryId: PROBE_CATEGORY },
    },
    // The seeding initialize spends the first caller coin, so the entry's own call takes another.
    callerUtxo: callerUtxos[1]!,
    callerLockingBytecode: deployerLock,
    funder: signature.unlockP2PKH(),
    changeAddress,
    vm: compositionMachine(),
  });
  return {
    accepted: result.verdicts.every((verdict) => verdict.accepted),
    txid: result.broadcast?.txid,
    slots: (callee.blockLayout?.slots ?? []).map((slot) => slot.kind),
  };
}

describe('a callee that writes mapping collections beside its own calls', () => {
  it('settles one collection of its own records beside the calls, and broadcasts', async () => {
    const { accepted, txid, slots } = await record('one');
    // One collection's node, then the frame's own data record and the entry node its read declares.
    expect(slots).toStrictEqual(['master', 'dataNft', 'entry', 'returnEvent']);
    expect(accepted).toBe(true);
    expect(txid).toMatch(/^[0-9a-f]{64}$/);
  }, 300_000);

  it('settles two collections of its own records beside the calls, and broadcasts', async () => {
    // Both collections' nodes start from the same placeholder - the value each holds is the body's to compute - so
    // the frame's own close matches two candidates at once and each pass has to learn the next node in the order the
    // body closes them, rather than restating the first. Once both are stated the frame reaches the pin that sizes
    // its run, and the value is read there.
    const slots = (compileStringMulti(sourceOf('two'), { composition: 'per-call' }).Desk!.abi
      .find((candidate) => candidate.name === 'record')!.blockLayout?.slots ?? []).map((slot) => slot.kind);
    expect(slots).toStrictEqual(['master', 'dataNft', 'entry', 'entry', 'returnEvent']);
    const { accepted, txid } = await record('two');
    expect(accepted).toBe(true);
    expect(txid).toMatch(/^[0-9a-f]{64}$/);
  }, 300_000);
});
