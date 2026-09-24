import { describe, expect, it } from 'vitest';
import type { Artifact } from '@solidcash/utils';
import { stickyKernelLeftoverScalarWrites } from '../../src/message-bus/compose.js';
import type { TransactionBuilder } from '../../src/TransactionBuilder.js';

const counterArtifact = {
  contractName: 'Acc',
  abi: [{ name: 'ping', writesState: true, inputs: [] }],
  stateLayout: {
    variables: [
      { name: 'counter', type: 'int256', nftIndex: 0, fieldIndex: 0, dynamic: false },
    ],
    structs: [],
    commitmentLimit: 128,
  },
} as unknown as Artifact;

const eventOnlyArtifact = {
  contractName: 'Acc',
  abi: [{ name: 'ping', writesState: false, inputs: [] }],
  stateLayout: {
    variables: [
      { name: '__messageBusHold', type: 'uint256', nftIndex: 0, fieldIndex: 0, dynamic: false },
    ],
    structs: [],
    commitmentLimit: 128,
  },
} as unknown as Artifact;

describe('ahead-of-time compose coverage stickyKernelLeftoverScalarWrites', () => {
  it('applies leftover +1 when a single-int data NFT still mirrors its input', () => {
    const local = {
      inputs: [
        { token: { nft: { capability: 'minting', commitment: '' }, amount: 0n, category: 'aa' } },
        { token: { nft: { capability: 'mutable', commitment: '00' }, amount: 0n, category: 'aa' } },
      ],
      outputs: [
        { token: { nft: { capability: 'minting', commitment: '' }, amount: 0n, category: 'aa' } },
        { token: { nft: { capability: 'mutable', commitment: '00' }, amount: 0n, category: 'aa' } },
      ],
    } as unknown as TransactionBuilder;
    const wrote = stickyKernelLeftoverScalarWrites(local, counterArtifact, {
      slots: [
        { kind: 'master', offset: 0 },
        { kind: 'dataNft', offset: 1 },
      ],
    });
    expect(wrote).toBe(true);
    expect(local.outputs[1].token?.nft?.commitment).toBe('51');
  });

  it('skips event-only writers and already-updated outputs', () => {
    const mirrored = {
      inputs: [
        { token: { nft: { capability: 'mutable', commitment: '00' }, amount: 0n, category: 'aa' } },
      ],
      outputs: [
        { token: { nft: { capability: 'mutable', commitment: '00' }, amount: 0n, category: 'aa' } },
      ],
    } as unknown as TransactionBuilder;
    expect(stickyKernelLeftoverScalarWrites(mirrored, eventOnlyArtifact, {
      slots: [{ kind: 'dataNft', offset: 0 }],
    })).toBe(false);
    expect(mirrored.outputs[0].token?.nft?.commitment).toBe('00');

    const advanced = {
      inputs: [
        { token: { nft: { capability: 'mutable', commitment: '00' }, amount: 0n, category: 'aa' } },
      ],
      outputs: [
        { token: { nft: { capability: 'mutable', commitment: '51' }, amount: 0n, category: 'aa' } },
      ],
    } as unknown as TransactionBuilder;
    expect(stickyKernelLeftoverScalarWrites(advanced, counterArtifact, {
      slots: [{ kind: 'dataNft', offset: 0 }],
    })).toBe(false);
    expect(advanced.outputs[0].token?.nft?.commitment).toBe('51');
  });

  it('applies leftover +1 from an executionArtifact ping row onto a proxy shell layout', () => {
    // Proxy ABI only publishes `__forward`; the real writer is the impl ping carried as writingRows.
    const proxyShellArtifact = {
      contractName: 'AccProxy',
      abi: [{ name: '__forward', writesState: true, inputs: [] }],
      stateLayout: counterArtifact.stateLayout,
    } as unknown as Artifact;
    const pingWriter = {
      name: 'ping',
      writesState: true,
      emits: [{ name: 'Ping' }],
      inputs: [{ name: 'value', type: 'int256' }],
    };
    const local = {
      inputs: [
        { token: { nft: { capability: 'minting', commitment: '' }, amount: 0n, category: 'aa' } },
        { token: { nft: { capability: 'mutable', commitment: '00' }, amount: 0n, category: 'aa' } },
      ],
      outputs: [
        { token: { nft: { capability: 'minting', commitment: '' }, amount: 0n, category: 'aa' } },
        { token: { nft: { capability: 'mutable', commitment: '00' }, amount: 0n, category: 'aa' } },
      ],
    } as unknown as TransactionBuilder;
    const wrote = stickyKernelLeftoverScalarWrites(local, proxyShellArtifact, {
      slots: [
        { kind: 'master', offset: 0 },
        { kind: 'dataNft', offset: 1 },
      ],
    }, [{ handler: pingWriter as any, args: [7n] }]);
    expect(wrote).toBe(true);
    expect(local.outputs[1].token?.nft?.commitment).toBe('51');
  });

  it('assigns the unique int arg when the writer has no emits (I4 Mid.seen = next)', () => {
    const midArtifact = {
      contractName: 'Mid',
      abi: [{
        name: 'writeThenSee',
        writesState: true,
        inputs: [
          { name: 'leaf', type: 'address' },
          { name: 'next', type: 'int256' },
        ],
      }],
      stateLayout: {
        variables: [
          { name: 'seen', type: 'int256', nftIndex: 0, fieldIndex: 0, dynamic: false },
        ],
        structs: [],
        commitmentLimit: 128,
      },
    } as unknown as Artifact;
    const local = {
      inputs: [
        { token: { nft: { capability: 'mutable', commitment: '00' }, amount: 0n, category: 'aa' } },
      ],
      outputs: [
        // Wrong leftover +1 from a message-bus shell must be replaced by next=17.
        { token: { nft: { capability: 'mutable', commitment: '51' }, amount: 0n, category: 'aa' } },
      ],
    } as unknown as TransactionBuilder;
    const wrote = stickyKernelLeftoverScalarWrites(local, midArtifact, {
      slots: [{ kind: 'dataNft', offset: 0 }],
    }, [{
      handler: midArtifact.abi[0],
      args: [new Uint8Array(25), 17n],
    }]);
    expect(wrote).toBe(true);
    expect(local.outputs[0].token?.nft?.commitment).toBe('0111');
  });
});
