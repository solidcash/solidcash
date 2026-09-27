import { describe, expect, it } from 'vitest';
import { buildChunkCommitment, splitValueIntoChunks } from '@solidcash/utils';
import { deriveFullPhase2ApplyDynamicChunks } from '../../src/stateful/sc-derive-full-phase2-apply-dynamic-chunks.js';
import type { StatefulTransactionBuilder } from '../../src/stateful/StatefulTransactionBuilder.js';
import type { TransactionBuilder } from '../../src/TransactionBuilder.js';
import { createTestProvider } from '../test-util.js';

const chunks = (value: Uint8Array): string[] => splitValueIntoChunks(value)
  .map((chunk, index) => buildChunkCommitment(index, chunk, 128));

describe('delegate dynamic chunk count convergence', () => {
  it.each([180, 240, 400])('uses the exact post-state length of %s bytes', (length) => {
    const value = new Uint8Array(length).fill(0x41);
    let commitments = chunks(new Uint8Array(300).fill(0x41));
    const stb = {
      getDynamicChunkVars: () => [{
        name: 'payload', type: 'bytes', lockingBytecode: Uint8Array.of(0x51), delegate: true, delegateSuffix: true,
      }],
      getChunkOutputBase: () => 4,
      getChunkRawCommitments: () => commitments,
      setChunkRawCommitments: (_name: string, next: string[]) => { commitments = next; },
    } as unknown as StatefulTransactionBuilder;
    const result = deriveFullPhase2ApplyDynamicChunks({
      categoryId: '01'.repeat(32), inner: { provider: createTestProvider() },
    }, stb, {
      probeBuilder2: { outputs: Array.from({ length: 8 }, () => ({})) } as unknown as TransactionBuilder,
      fullTrace2: [], commitmentProgress: 0,
      derivedAState: { payload: value, payload$len: BigInt(length) },
      stateLayout: { variables: [], dataNftCount: 1, commitmentLimit: 128 }, iter: 0,
      phaseCheckpoint: () => {},
    });

    expect(commitments).toEqual(chunks(value));
    // Retiring a final chunk is progress even when every retained chunk's bytes stay identical.
    expect(result.commitmentProgress).toBeGreaterThan(0);
    expect(result.getPhysicalChunkOutputBase()).toBe(7 - commitments.length);
  });

  it('keeps the speculative suffix when no post-state length or value is known', () => {
    const before = chunks(new Uint8Array(300).fill(0x41));
    let commitments = before;
    const stb = {
      getDynamicChunkVars: () => [{
        name: 'payload', type: 'bytes', lockingBytecode: Uint8Array.of(0x51), delegate: true, delegateSuffix: true,
      }],
      getChunkOutputBase: () => 4,
      getChunkRawCommitments: () => commitments,
      setChunkRawCommitments: (_name: string, next: string[]) => { commitments = next; },
    } as unknown as StatefulTransactionBuilder;
    const result = deriveFullPhase2ApplyDynamicChunks({
      categoryId: '01'.repeat(32), inner: { provider: createTestProvider() },
    }, stb, {
      probeBuilder2: { outputs: Array.from({ length: 8 }, () => ({})) } as unknown as TransactionBuilder,
      fullTrace2: [], commitmentProgress: 0, derivedAState: {},
      stateLayout: { variables: [], dataNftCount: 1, commitmentLimit: 128 }, iter: 0,
      phaseCheckpoint: () => {},
    });
    expect(commitments).toEqual(before);
    expect(result.commitmentProgress).toBe(0);
  });

  it.each([undefined, 0n])('does not retire a speculative tail from an unresolved delegate length (%s)', (length) => {
    const before = chunks(new Uint8Array(300).fill(0x41));
    const value = new Uint8Array(180).fill(0x42);
    let commitments = before;
    const stb = {
      getDynamicChunkVars: () => [{
        name: 'payload', type: 'bytes', lockingBytecode: Uint8Array.of(0x51), delegate: true, delegateSuffix: true,
      }],
      getChunkOutputBase: () => 4,
      getChunkRawCommitments: () => commitments,
      setChunkRawCommitments: (_name: string, next: string[]) => { commitments = next; },
    } as unknown as StatefulTransactionBuilder;
    deriveFullPhase2ApplyDynamicChunks({
      categoryId: '01'.repeat(32), inner: { provider: createTestProvider() },
    }, stb, {
      probeBuilder2: { outputs: Array.from({ length: 8 }, () => ({})) } as unknown as TransactionBuilder,
      fullTrace2: [], commitmentProgress: 0,
      derivedAState: { payload: value, ...(length === undefined ? {} : { payload$len: length }) },
      stateLayout: { variables: [], dataNftCount: 1, commitmentLimit: 128 }, iter: 0,
      phaseCheckpoint: () => {},
    });
    expect(commitments).toEqual([...chunks(value), before[2]]);
  });
});
