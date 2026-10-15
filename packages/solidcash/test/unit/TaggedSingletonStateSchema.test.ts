import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  buildPushdataCommitment, encodeNftIndexTag, encodePushdataValue, parsePushdataCommitment,
  type Artifact, type StateLayout,
} from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import type { Utxo } from '../../src/interfaces.js';
import type NetworkProvider from '../../src/network/NetworkProvider.js';
import { widestRecordCommitmentBytes } from '../../src/framed/composer/dust.js';
import {
  classifyFramedDeployment, readFramedState, stateRecordLockingBytecode,
} from '../../src/framed/deploy/records.js';
import { appendOnlyStateSuffix } from '../../src/message-bus/compose-participant-helpers.js';
import { StateReader } from '../../src/stateful/StateReader.js';
import { sameStatePrefixThroughField } from '../../src/stateful/sc-derive-return-value.js';

const CATEGORY = 'ab'.repeat(32);
const legacy: StateLayout = {
  dataNftCount: 1, commitmentLimit: 128,
  variables: [{ name: 'counter', type: 'uint8', nftIndex: 0, fieldIndex: 0 }],
};
const tagged: StateLayout = { ...legacy, taggedDataNfts: true };
const record = (commitment: string, vout = 5): Utxo & { lockingBytecode: Uint8Array } => ({
  txid: 'cd'.repeat(32), vout, satoshis: 1200n, lockingBytecode: stateRecordLockingBytecode(CATEGORY),
  token: { category: CATEGORY, amount: 0n, nft: { capability: 'mutable', commitment } },
});
const artifact = (stateLayout: StateLayout): Artifact => ({ stateLayout } as Artifact);

describe('SDK tagged singleton state schemas', () => {
  it('discovers and decodes a tagged singleton without accepting untagged or wrong-index records', () => {
    const commitment = buildPushdataCommitment(tagged, { counter: 42n }, 0);
    const correct = record(commitment);
    const untagged = record(buildPushdataCommitment(legacy, { counter: 42n }, 0), 1);
    const wrongTag = record(binToHex(encodeNftIndexTag(1)) + commitment.slice(
      encodeNftIndexTag(0).length * 2,
    ), 2);
    const reader = new StateReader(tagged);
    expect(reader.findDataNfts([untagged, wrongTag, correct], CATEGORY)).toEqual([correct]);
    expect(reader.readState([correct])).toEqual({ counter: 42n });
  });

  it('retains legacy singleton decoding and rejects the newly tagged wire form under that schema', () => {
    const oldRecord = record(buildPushdataCommitment(legacy, { counter: 42n }, 0));
    const newRecord = record(buildPushdataCommitment(tagged, { counter: 42n }, 0), 1);
    const reader = new StateReader(legacy);
    expect(reader.findDataNfts([newRecord, oldRecord], CATEGORY)).toEqual([oldRecord]);
    expect(reader.readState([oldRecord])).toEqual({ counter: 42n });
  });

  it('classifies and reads framed singleton records using their published tag schema', async () => {
    const correct = record(buildPushdataCommitment(tagged, { counter: 255n }, 0));
    const legacyRecord = record(buildPushdataCommitment(legacy, { counter: 255n }, 0), 1);
    const wrongLock = { ...correct, vout: 2, lockingBytecode: Uint8Array.of(0x51) };
    const coins = [legacyRecord, wrongLock, correct];
    expect(classifyFramedDeployment(coins, tagged).records).toEqual([correct]);
    const provider = { getUtxosByTokenCategory: async () => coins } as unknown as NetworkProvider;
    expect(await readFramedState(provider, CATEGORY, tagged)).toEqual({
      byNft: [{ counter: 255n }], records: [correct],
    });
  });

  it('includes the singleton header in the widest commitment used for genesis dust funding', () => {
    const value = { counter: 255n };
    expect(widestRecordCommitmentBytes(tagged, 0))
      .toBe(hexToBin(buildPushdataCommitment(tagged, value, 0)).length);
    expect(widestRecordCommitmentBytes(tagged, 0))
      .toBe(widestRecordCommitmentBytes(legacy, 0)! + encodeNftIndexTag(0).length);
  });

  it('allows a tagged delegate prefix across NFT counts while refusing a header or field encoding change', () => {
    const multi: StateLayout = { ...legacy, dataNftCount: 2,
      variables: [...legacy.variables, { name: 'extra', type: 'uint8', nftIndex: 1, fieldIndex: 0 }] };
    expect(sameStatePrefixThroughField(tagged, multi, 0, 0)).toBe(true);
    expect(sameStatePrefixThroughField(multi, tagged, 0, 0)).toBe(true);
    expect(sameStatePrefixThroughField(legacy, tagged, 0, 0)).toBe(false);
    expect(sameStatePrefixThroughField(tagged, legacy, 0, 0)).toBe(false);
    expect(sameStatePrefixThroughField(tagged, { ...tagged,
      variables: [{ ...tagged.variables[0], type: 'uint16' }] }, 0, 0)).toBe(false);
  });

  it('refuses a bus upgrade header switch and appends a fixed suffix under a matching tagged schema', () => {
    expect(() => appendOnlyStateSuffix(artifact(legacy), artifact(tagged)))
      .toThrow(/data NFT geometry/);
    expect(() => appendOnlyStateSuffix(artifact(tagged), artifact(legacy)))
      .toThrow(/data NFT geometry/);
    const next: StateLayout = { ...tagged,
      variables: [...tagged.variables, { name: 'extra', type: 'uint8', nftIndex: 0, fieldIndex: 1 }] };
    const suffix = appendOnlyStateSuffix(artifact(tagged), artifact(next), { extra: 9n });
    expect(suffix).toEqual(encodePushdataValue(9n, 'uint8'));
    const preservedPrefix = buildPushdataCommitment(tagged, { counter: 42n }, 0);
    expect(parsePushdataCommitment(preservedPrefix + binToHex(suffix), next, 0))
      .toEqual({ counter: 42n, extra: 9n });
  });
});
