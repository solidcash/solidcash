import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { buildChunkCommitment, encodePushdataValue } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployFramedProxy } from '../../../src/framed/proxy/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A proxied entry that appends a struct whose default holds an `address` field.
 *
 * The body pushes the element type's default, which for an address field is `address(0)` — a cast the compiled
 * body emits as no opcode at all, so the field's stack value is the VM number zero, i.e. the empty byte string.
 * The artifact publishes that default as the element the append writes, and the hop sizes the run from the shipped
 * encoders. Both spellings of the zero address the element can state — the empty string the body computes and a
 * stated 20-byte zero — must encode to the same field bytes, so the hop's declaration matches the body's own close.
 *
 * The value here comes from the shipped `encodePushdataValue`; the created chunk carries what the body computed,
 * and the transaction settles through the BCH-2026 machine.
 */

const IMPL_CATEGORY = '11'.repeat(31) + 'ee';
const PROXY_CATEGORY = '22'.repeat(31) + 'dd';
const CALLER_TXID = '33'.repeat(31) + 'cc';

/** An append of the element type's default, whose address field is `address(0)`. */
const DEFAULT_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Impl {'
  + '   struct Pair { address who; uint amount; }'
  + '   address public implementation;'
  + '   Pair[] public items;'
  + '   function initialize() { this.items.push(); }'
  + ' }';

/** The same element spelled out, which the artifact states identically. */
const SPELLED_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Impl {'
  + '   struct Pair { address who; uint amount; }'
  + '   address public implementation;'
  + '   Pair[] public items;'
  + '   function initialize() { this.items.push(Pair(address(0), 0)); }'
  + ' }';

interface Funding {
  readonly network: MockNetworkProvider;
  readonly signature: SignatureTemplate;
  readonly funder: ReturnType<Contract['unlock']['spend']>;
  readonly implFunding: { txid: string; vout: number; satoshis: bigint };
  readonly proxyFunding: { txid: string; vout: number; satoshis: bigint };
  readonly callerUtxo: { txid: string; vout: number; satoshis: bigint };
  readonly deployerLock: Uint8Array;
  readonly changeAddress: string;
}

/** Funds the two genesis UTXOs and the caller's own coin. */
async function funded(network: MockNetworkProvider): Promise<Funding> {
  const signature = new SignatureTemplate(alicePriv);
  const funder = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const implFunding = { txid: IMPL_CATEGORY, vout: 0, satoshis: 500_000n };
  const proxyFunding = { txid: PROXY_CATEGORY, vout: 0, satoshis: 500_000n };
  const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);
  const callerUtxo = { txid: CALLER_TXID, vout: 0, satoshis: 100_000n };
  await network.addUtxo(funder.address, implFunding);
  await network.addUtxo(funder.address, proxyFunding);
  // The hop broadcasts, so each composition's facet input needs a live UTXO at the facet's lock.
  await fundShippedFacets(network);
  await network.addUtxo(binToHex(deployerLock), callerUtxo);
  return {
    network, signature, funder: funder.unlock.spend(alicePub, signature),
    implFunding, proxyFunding, callerUtxo, deployerLock, changeAddress: funder.address,
  };
}

/** Deploys one hop for an appending initialize, with the implementation's generated proxy. */
async function deploy(source: string): Promise<{
  readonly deployment: Awaited<ReturnType<typeof deployFramedProxy>>;
  readonly network: MockNetworkProvider;
  readonly artifacts: ReturnType<typeof compileStringMulti>;
  readonly funding: Funding;
}> {
  const artifacts = compileStringMulti(source, { composition: 'framed' });
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const funding = await funded(network);
  const deployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: artifacts.Impl!,
    implementationDeploy: {
      fundingUtxo: funding.implFunding, funder: funding.funder, changeAddress: funding.changeAddress,
    },
    proxyDeploy: {
      fundingUtxo: funding.proxyFunding, funder: funding.funder, changeAddress: funding.changeAddress,
    },
    initialize: { functionName: 'initialize', args: [] as never },
    callerLockingBytecode: funding.deployerLock,
    callerFunding: { utxo: funding.callerUtxo, funder: funding.signature.unlockP2PKH() },
    vm: compositionMachine(),
  });
  return { deployment, network, artifacts, funding };
}

/** The element source both spellings of the default publish. */
const defaultElementSource = (): unknown => ({
  items: {
    kind: 'call', name: 'Pair', type: 'Pair',
    args: [
      { kind: 'cast', type: 'address', expression: { kind: 'literal', value: '0', type: 'bigint' } },
      { kind: 'literal', value: '0', type: 'bigint' },
    ],
  },
});

describe('a proxied append of a struct whose default holds an address field', () => {
  it('settles the default element, whose address field is the empty the body computes', async () => {
    const { deployment, artifacts } = await deploy(DEFAULT_SOURCE);
    expect(deployment.initialize.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(deployment.initialize.accepted).toBe(true);

    // The compiler states the element the push appends: the default `Pair`, whose address field is `address(0)`.
    expect(artifacts.Impl!.abi.find((candidate) => candidate.name === 'initialize')?.dynamicWriteSources)
      .toStrictEqual(defaultElementSource());

    // The body pushes the default: `address(0)` contributes the empty string, so the encoded element is the empty
    // address field followed by the zero amount. The hop sizes the run from exactly this value.
    const elementBytes = encodePushdataValue(
      [{ who: new Uint8Array(0), amount: 0n }], 'Pair[]', artifacts.Impl!.structs,
    );
    const trailing = deployment.initialize.draft.trailingOutputs;
    expect(trailing).toHaveLength(1);
    expect(deployment.initialize.transaction.outputs[trailing[0]!.index]!.token!.nft!.commitment)
      .toStrictEqual(new Uint8Array(Buffer.from(buildChunkCommitment(0, elementBytes), 'hex')));
    expect(deployment.initialize.broadcast).toBeDefined();
  });

  it('settles the spelled-out `address(0)`, which the artifact states identically', () => {
    // The spelled-out element compiles to the default's program and ABI, so it settles through the deployment above.
    const spelled = compileStringMulti(SPELLED_SOURCE, { composition: 'framed' }).Impl!;
    const plain = compileStringMulti(DEFAULT_SOURCE, { composition: 'framed' }).Impl!;
    expect(spelled.bytecode).toBe(plain.bytecode);
    expect(spelled.abi).toStrictEqual(plain.abi);
    expect(spelled.abi.find((candidate) => candidate.name === 'initialize')?.dynamicWriteSources)
      .toStrictEqual(defaultElementSource());
  });

  it('encodes a stated 20-byte address value as itself, the zero one as the empty the body computes', () => {
    const structs = [{ name: 'Pair', fields: [{ name: 'who', type: 'address' }, { name: 'amount', type: 'uint256' }] }];
    const empty = encodePushdataValue({ who: new Uint8Array(0), amount: 0n }, 'Pair', structs);
    // The control: a stated 20-byte zero address is the same value the body computes for `address(0)`, so it must
    // encode to the same field bytes rather than being rejected as a value with no byte meaning.
    expect([...encodePushdataValue({ who: new Uint8Array(20), amount: 0n }, 'Pair', structs)]).toStrictEqual([...empty]);
    // A stated non-zero 20-byte address keeps its own bytes: the default's normalization does not touch it.
    const stated = encodePushdataValue({ who: new Uint8Array(20).fill(0x11), amount: 0n }, 'Pair', structs);
    expect([...stated]).toStrictEqual([0x14, ...new Uint8Array(20).fill(0x11), 0x00]);
  });
});
