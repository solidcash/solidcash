import { describe, expect, it } from 'vitest';
import { parsePushdataCommitment } from '@solidcash/utils';
import { COMPOSITION_LIMITS } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { type TransactionDetails } from '../../../src/index.js';
import { HDSigner } from '../../../src/HDSigner.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { readFramedDeployment } from '../../../src/framed/deploy/index.js';
import type { FramedFunctionCall } from '../../../src/framed/call/index.js';
import type { StatefulContract } from '../../../src/stateful/StatefulContract.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * The call surface a deployed framed contract's handle exposes.
 *
 * The handle hands back one call per ABI entry. Awaiting a writing entry composes it, derives it, and broadcasts
 * what the machine accepted; awaiting a read-only entry answers with the value the entry's own frame computed and
 * sends nothing. Both go through the shipped deployment, composer, derivation and machine, and the state is read
 * back through the shipped deployment reader and decoded with the shipped state decoder rather than recomputed here.
 */

const CATEGORY_HEX = '55'.repeat(31) + 'aa';
const PHRASE = 'test test test test test test test test test test test junk';
/** A wallet no test funds. */
const UNFUNDED_PHRASE = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

// Two entries, so the master dispatches by selector; `add` writes and `current` only reads.
const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Tally {'
  + '   int public total;'
  + '   function add(int by) { this.total = this.total + by; require(this.total >= 0); }'
  + '   function current() view returns (int) { return this.total; }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const tally = artifacts.Tally!;

/** The deployed contract's record commitment, as the deployment reader reports it (hex, one per data NFT). */
async function recordCommitment(provider: MockNetworkProvider, categoryId: string): Promise<string> {
  const deployment = await readFramedDeployment(provider, categoryId, tally.stateLayout!);
  return deployment.records[0]!.token!.nft!.commitment;
}

/** The `total` field the record carries, decoded with the shipped state decoder. */
function recordTotal(commitment: string): bigint {
  const decoded = parsePushdataCommitment(commitment, tally.stateLayout!, 0);
  return decoded.total as bigint;
}

/** The entries the handle's call namespace exposes, as the class the framed path returns. */
interface TallyCalls {
  readonly add: (by: bigint) => FramedFunctionCall;
  readonly current: () => FramedFunctionCall;
}

/** Deploys the contract through the shipped deployment, with a funded signer connected to the handle. */
async function deploy(): Promise<{ calls: TallyCalls; handle: StatefulContract; provider: MockNetworkProvider }> {
  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signer = HDSigner.fromPhrase(PHRASE, provider);
  const fundingUtxo = { txid: CATEGORY_HEX, vout: 0, satoshis: 500_000n };
  await provider.addUtxo(signer.getAddress(), fundingUtxo);
  // The caller's own coin, at the signer's own P2PKH lock: a root frame binds `msg.sender` to its input's lock.
  await provider.addUtxo(signer.getAddress(), { txid: '66'.repeat(32), vout: 0, satoshis: 200_000n });
  // The calls broadcast, so each composition's facet input needs a live UTXO at the facet's lock.
  await fundShippedFacets(provider);

  const deployment = await deployStatefulContract(tally, [], {
    provider,
    fundingUtxo,
    funder: signer.unlockP2PKH(),
    changeAddress: signer.getAddress(),
  });
  const handle = (deployment.contract as StatefulContract).connect(signer);
  return { calls: handle.call as unknown as TallyCalls, handle, provider };
}

let deployedRun: ReturnType<typeof deploy> | undefined;

/** One deployment serves every case: only the last writes, after the read that expects the total the genesis left. */
function sharedDeployment(): ReturnType<typeof deploy> {
  deployedRun ??= deploy();
  return deployedRun;
}

describe('the call surface of a deployed framed contract', () => {
  it('answers a read-only entry with the value its own frame computed and sends nothing', async () => {
    const { calls } = await sharedDeployment();
    // A read is derived and evaluated locally: the contract's total starts at zero and no transaction is built.
    expect(await calls.current()).toBe(0n);
  });

  it('reports the entry\'s own refusal for a caller that holds no coin, simulated before any funding', async () => {
    const { handle, provider } = await sharedDeployment();
    const before = await recordCommitment(provider, handle.categoryId);
    const calls = handle.connect(HDSigner.fromPhrase(UNFUNDED_PHRASE, provider)).call as unknown as TallyCalls;
    // The call is derived over a stand-in coin at the caller's own lock, so the body's refusal is what it reports,
    // not that the caller cannot pay.
    await expect(calls.add(-1n)).rejects.toThrow(
      /FRAMED_COMPOSITION_REFUSED: frame "master" of Tally\.add\(\) at line \d+/,
    );
    expect(await recordCommitment(provider, handle.categoryId)).toBe(before);
  });

  it('reports that a caller holding no coin cannot pay for a call that would settle, and sends nothing', async () => {
    const { handle, provider } = await sharedDeployment();
    const before = await recordCommitment(provider, handle.categoryId);
    const calls = handle.connect(HDSigner.fromPhrase(UNFUNDED_PHRASE, provider)).call as unknown as TallyCalls;
    await expect(calls.add(4n)).rejects.toThrow(/holds no tokenless UTXO to pay the call with/);
    expect(await recordCommitment(provider, handle.categoryId)).toBe(before);
  });

  it('broadcasts an entry the handle is awaited on, and the record carries what the entry computed', async () => {
    const { calls, handle, provider } = await sharedDeployment();
    const before = await recordCommitment(provider, handle.categoryId);
    expect(recordTotal(before)).toBe(0n);

    // Awaiting the call sends it; the receipt names the transaction the composition was broadcast as.
    const receipt = await calls.add(4n);
    expect((receipt as TransactionDetails).txid).toMatch(/^[0-9a-f]{64}$/);

    // The record the call wrote, read back through the shipped deployment reader and decoded with the shipped
    // decoder, holds the value the entry's own body computed.
    const after = await recordCommitment(provider, handle.categoryId);
    expect(after).not.toBe(before);
    expect(recordTotal(after)).toBe(4n);
  });
});
