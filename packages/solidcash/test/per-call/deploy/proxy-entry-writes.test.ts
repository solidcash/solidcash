import { describe, expect, it } from 'vitest';
import { encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { bytesToHex, encodeChunkableValueTail } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { planMappingWrite } from '../../../src/per-call/composer/index.js';
import { deployPerCallProxy } from '../../../src/per-call/proxy/index.js';
import { decodeEntryCommitment, headSentinelCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';

/**
 * The sorted-mapping records a proxied `initialize` writes.
 *
 * A delegate frame runs on the proxy's records, so an entry that writes a mapping touches the collection's node
 * UTXOs. The hop has to declare them in the frame's segment: the head sentinel it splices through, recreated in
 * place, and the node it creates as a trailing output. The node's commitment is what the entry's own body computed,
 * so the plan seeds it with a structurally valid placeholder and the derivation learns the value from the body's
 * close. The expected value here comes from the shipped planner against the real key and value.
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

  it('refuses a batch of several writes to one collection, naming the entry', async () => {
    // The same boundary the constructor planner holds: one write to one collection. The fixture's own `initialize`
    // writes eight keys in one batch, which this hop has no plan for.
    await expect(deploy(BATCH_SOURCE)).rejects.toThrow(
      /writes 2 mapping entry\(ies\) across 1 sorted batch\(es\), and this hop plans exactly one write/,
    );
  });
});
