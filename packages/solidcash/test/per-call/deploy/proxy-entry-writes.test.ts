import { describe, expect, it } from 'vitest';
import { encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { bytesToHex, encodeChunkableValueTail } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { planMappingBatch, planMappingWrite } from '../../../src/per-call/composer/index.js';
import { deployPerCallProxy } from '../../../src/per-call/proxy/index.js';
import { decodeEntryCommitment, headSentinelCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';

/**
 * The sorted-mapping records a proxied `initialize` writes.
 *
 * A delegate frame runs on the proxy's records, so an entry that writes a mapping touches the collection's node
 * UTXOs. The hop has to declare them in the frame's segment: the head sentinel it splices through, recreated in
 * place, and every node it creates as a trailing output. Each node's commitment carries the value the artifact
 * states for the write, so the plan declares it outright rather than learning it from the body's close. The
 * expected commitments here come from the shipped batch planner against the real keys and values.
 */

const IMPL_CATEGORY = '11'.repeat(32);
const PROXY_CATEGORY = '22'.repeat(32);

const SINGLE_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Impl {'
  + '   mapping(string => string) tags;'
  + '   function initialize() { this.tags["DV"] = "DIGITAL_VIDEO"; }'
  + ' }';

/** The fixture's shape: one entry inserting several keys into one collection in one batch. */
const BATCH_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Impl {'
  + '   mapping(string => string) tags;'
  + '   function initialize() {'
  + '     this.tags["DA"] = "DIGITAL_AUDIO";'
  + '     this.tags["DV"] = "DIGITAL_VIDEO";'
  + '   }'
  + ' }';

/** The marketplace data contract's own eight-key initializer. */
const EIGHT_TAGS: readonly (readonly [string, string])[] = [
  ['DA', 'DIGITAL_AUDIO'], ['DV', 'DIGITAL_VIDEO'], ['DT', 'DIGITAL_TEXT'], ['DS', 'DIGITAL_SOFTWARE'],
  ['DO', 'DIGITAL_OTHERS'], ['NDG', 'NON_DIGITAL_GOODS'], ['NDS', 'NON_DIGITAL_SERVICES'],
  ['NDO', 'NON_DIGITAL_OTHERS'],
];
const EIGHT_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Impl {'
  + '   mapping(string => string) tags;'
  + '   function initialize() {'
  + EIGHT_TAGS.map(([key, value]) => `     this.tags["${key}"] = "${value}";`).join('')
  + '   }'
  + ' }';

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

/** Deploys one hop for a mapping-writing initialize, with the implementaion generated proxy. */
async function deploy(
  source: string,
  args: readonly unknown[] = [],
): Promise<Awaited<ReturnType<typeof deployPerCallProxy>>> {
  const artifacts = compileStringMulti(source, { composition: 'per-call' });
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const { funder, implFunding, proxyFunding, changeAddress, deployerLock } = await funded(network);
  return deployPerCallProxy({
    provider: network,
    implementationArtifact: artifacts.Impl!,
    implementationDeploy: { fundingUtxo: implFunding, funder, changeAddress },
    proxyDeploy: { fundingUtxo: proxyFunding, funder, changeAddress },
    initialize: { functionName: 'initialize', args: args as never },
    callerLockingBytecode: deployerLock,
    vm: compositionMachine(),
  });
}

describe('a proxied initialize that writes a sorted mapping', () => {
  it('settles the reduced write, the created node carrying the commitment the entry computed', async () => {
    const deployment = await deploy(SINGLE_SOURCE);

    expect(deployment.initialize.completed.map((frame) => frame.functionName))
      .toStrictEqual(['Impl.initialize()', 'ImplProxy.__fallback()']);
    expect(deployment.initialize.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(deployment.initialize.accepted).toBe(true);

    // The shipped planner's own value for the write, which is what the entry's body computed.
    const expected = planMappingWrite({
      keys: [new TextEncoder().encode('DV')],
      value: new TextEncoder().encode('DIGITAL_VIDEO'),
      inventory: [headSentinelCommitment()],
      encodeValue: encodeChunkableValueTail,
    }).written[1]!.after;

    // The created node is a trailing output, and the frame declares it at the index the transaction carries it.
    const trailing = deployment.initialize.draft.trailingOutputs;
    expect(trailing).toHaveLength(1);
    expect(bytesToHex(trailing[0]!.output.token!.nft!.commitment)).toBe(bytesToHex(expected));
    expect(bytesToHex(deployment.initialize.transaction.outputs[trailing[0]!.index]!.token!.nft!.commitment))
      .toBe(bytesToHex(expected));
    // The node's slot is the key's, so it is the entry's own write rather than some other record.
    expect(bytesToHex(decodeEntryCommitment(expected).slot))
      .toBe(bytesToHex(keyToSlotMulti([new TextEncoder().encode('DV')])));

    // The head sentinel is spent under the collection covenant and recreated with the relinked commitment.
    const head = deployment.initialize.draft.layout.participants
      .find((placed) => placed.id.startsWith('mapping-head-'))!.index;
    expect(bytesToHex(deployment.initialize.transaction.outputs[head]!.token!.nft!.commitment))
      .not.toBe(bytesToHex(headSentinelCommitment()));
  });

  it('settles a batch of several writes to one collection, each created node carrying its stated value', async () => {
    const deployment = await deploy(BATCH_SOURCE);

    expect(deployment.initialize.completed.map((frame) => frame.functionName))
      .toStrictEqual(['Impl.initialize()', 'ImplProxy.__fallback()']);
    expect(deployment.initialize.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(deployment.initialize.accepted).toBe(true);

    // The shipped batch planner's own commitments: the head relinked to the lowest created slot, then one node per
    // write in the order the body declares them.
    const encoder = new TextEncoder();
    const plan = planMappingBatch({
      writes: [
        { keys: [encoder.encode('DA')], value: encoder.encode('DIGITAL_AUDIO') },
        { keys: [encoder.encode('DV')], value: encoder.encode('DIGITAL_VIDEO') },
      ],
      inventory: [headSentinelCommitment()],
      encodeValue: encodeChunkableValueTail,
    });
    const created = plan.written.filter((node) => !node.existed);

    const trailing = deployment.initialize.draft.trailingOutputs;
    expect(trailing).toHaveLength(created.length);
    trailing.forEach((output, position) => {
      expect(bytesToHex(output.output.token!.nft!.commitment)).toBe(bytesToHex(created[position]!.after));
      expect(bytesToHex(deployment.initialize.transaction.outputs[output.index]!.token!.nft!.commitment))
        .toBe(bytesToHex(created[position]!.after));
      // The node's slot is its key's, so it is one of the entry's own writes rather than some other record.
      expect(bytesToHex(decodeEntryCommitment(created[position]!.after).slot))
        .toBe(bytesToHex(keyToSlotMulti([encoder.encode(position === 0 ? 'DA' : 'DV')])));
    });

    // The head sentinel is spent under the collection covenant and recreated with the relinked commitment.
    const head = deployment.initialize.draft.layout.participants
      .find((placed) => placed.id.startsWith('mapping-head-'))!.index;
    expect(bytesToHex(deployment.initialize.transaction.outputs[head]!.token!.nft!.commitment))
      .toBe(bytesToHex(plan.written.find((node) => node.existed)!.after));
  });

  it('refuses a write whose value the artifact publishes no source for', async () => {
    const computed = 'pragma solidcash ^0.13.0;'
      + ' contract Impl {'
      + '   mapping(string => string) tags;'
      + '   function initialize(string a, string b) { this.tags["DA"] = a + b; }'
      + ' }';
    await expect(deploy(computed, ['x', 'y'])).rejects.toThrow(
      /writes mapping "tags" a value whose source the artifact does not publish/,
    );
  });

  it('settles the eight-key initializer the marketplace data contract publishes', async () => {
    const deployment = await deploy(EIGHT_SOURCE);

    expect(deployment.initialize.completed.map((frame) => frame.functionName))
      .toStrictEqual(['Impl.initialize()', 'ImplProxy.__fallback()']);
    expect(deployment.initialize.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(deployment.initialize.accepted).toBe(true);

    const encoder = new TextEncoder();
    const plan = planMappingBatch({
      writes: EIGHT_TAGS.map(([key, value]) => ({ keys: [encoder.encode(key)], value: encoder.encode(value) })),
      inventory: [headSentinelCommitment()],
      encodeValue: encodeChunkableValueTail,
    });
    const created = plan.written.filter((node) => !node.existed);
    const trailing = deployment.initialize.draft.trailingOutputs;
    expect(trailing).toHaveLength(created.length);
    trailing.forEach((output, position) => {
      expect(bytesToHex(output.output.token!.nft!.commitment)).toBe(bytesToHex(created[position]!.after));
    });
  });
});
