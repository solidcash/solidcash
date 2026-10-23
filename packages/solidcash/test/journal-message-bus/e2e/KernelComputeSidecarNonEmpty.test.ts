import { binToHex, hexToBin } from '@bitauth/libauth';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { keccakChainLockingBytecode, keccakComputeLockingBytecode } from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { isRepairableNftOutput } from '../../../src/stateful/computed-output-repair.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  evmCompat: true,
  suppressWarnings: true,
} as const;

const KECCAK_SIDECAR_CATEGORY = '77'.repeat(31) + '88';
const ZEROS_PREIMAGE = '00'.repeat(32);
const ZEROS_HASH = '290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563';

const TOKENLESS_PAD_FAILURE = /BCH-2026 preflight failed|OP_SPLIT|empty|token|side-?car|keccak/i;

describe('kernel compute sidecar non-empty', () => {
  it('materializes keccak sideband NFTs with commitments long enough for a 32-byte digest split', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract NestedKeccak {
        int counter;
        function reveal(bytes secret, bytes32 expected) public {
          require(keccak256(keccak256(secret)) == expected);
          counter += 1;
          require(true);
        }
      }`, KERNEL);
    expect(artifact.abi.find((entry) => entry.name === 'reveal')?.keccakCompute).toBe(true);

    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    const lock = binToHex(keccakComputeLockingBytecode(hexToBin(categoryId).slice().reverse(), true));
    for (let index = 0; index < 2; index += 1) {
      await provider.addUtxo(lock, {
        txid: (40 + index).toString(16).padStart(2, '0').repeat(32),
        vout: 0,
        satoshis: 100_000n,
        token: {
          category: KECCAK_SIDECAR_CATEGORY,
          amount: 0n,
          nft: { capability: 'mutable', commitment: '' },
        },
      });
    }

    const secret = hexToBin(ZEROS_PREIMAGE);
    const expected = keccak_256(hexToBin(ZEROS_HASH));
    const sc = StatefulContract.withCategory(contract, categoryId);
    const builder = await sc.call.reveal(secret, expected).build();
    const transaction = builder.buildLibauthTransaction();

    const sidecarOutputs = transaction.outputs.filter((output) => {
      const category = output.token?.category;
      const categoryHex = typeof category === 'string'
        ? category.toLowerCase()
        : category !== undefined ? binToHex(category).toLowerCase() : '';
      return categoryHex === KECCAK_SIDECAR_CATEGORY
        && output.token?.nft?.capability === 'mutable';
    });
    expect(sidecarOutputs.length).toBeGreaterThanOrEqual(1);
    for (const output of sidecarOutputs) {
      const commitment = output.token!.nft!.commitment;
      const bytes = typeof commitment === 'string' ? hexToBin(commitment) : commitment;
      // Digest path consumes a 32-byte slice; empty / tokenless pads must never be addressed.
      expect(bytes.length).toBeGreaterThanOrEqual(32);
      expect(isRepairableNftOutput('mutable', bytes.length, 128)).toBe(true);
    }
    // Nested digest pair yields at least 64 bytes of authenticated keccak result material across sidecars.
    const totalCommitmentBytes = sidecarOutputs.reduce((sum, output) => {
      const commitment = output.token!.nft!.commitment;
      const bytes = typeof commitment === 'string' ? hexToBin(commitment) : commitment;
      return sum + bytes.length;
    }, 0);
    expect(totalCommitmentBytes).toBeGreaterThanOrEqual(64);

    await expect(sc.call.reveal(secret, expected).send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  }, 180_000);

  it('fails closed when a keccak sidecar output is replaced by a tokenless OP_TRUE pad', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract StatefulKeccak {
        int counter;
        function bump(bytes preimage, bytes32 expected) public {
          require(keccak256(preimage) == expected);
          counter += 1;
          require(true);
        }
      }`, KERNEL);
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    // A single unbounded-bytes keccak preimage routes through the chained START/CONT/FINAL side-car model; a
    // 32-byte preimage needs exactly one FINAL side-car. Fund that covenant, not the fixed-slot compute lock.
    const salt = hexToBin(categoryId).slice().reverse();
    const lock = binToHex(keccakChainLockingBytecode(salt, 'final', true));
    await provider.addUtxo(lock, {
      ...({ txid: 'aa'.repeat(32), vout: 0, satoshis: 100_000n }),
      token: {
        category: KECCAK_SIDECAR_CATEGORY,
        amount: 0n,
        nft: { capability: 'mutable', commitment: '' },
      },
    });
    const sc = StatefulContract.withCategory(contract, categoryId);
    const builder = await sc.call.bump(hexToBin(ZEROS_PREIMAGE), hexToBin(ZEROS_HASH)).build();
    const sidecarOutputIndex = builder.outputs.findIndex((output) => {
      const category = output.token?.category;
      const categoryHex = typeof category === 'string'
        ? category.toLowerCase()
        : category !== undefined ? binToHex(category as Uint8Array).toLowerCase() : '';
      return categoryHex === KECCAK_SIDECAR_CATEGORY;
    });
    expect(sidecarOutputIndex).toBeGreaterThanOrEqual(0);
    // Replace the materialised sidecar with a tokenless OP_TRUE pad — SPLIT/digest path must fail closed.
    builder.outputs[sidecarOutputIndex] = {
      to: Uint8Array.of(0x51),
      amount: 1000n,
    };
    await expect(builder.send()).rejects.toThrow(TOKENLESS_PAD_FAILURE);
  }, 120_000);

  it('rejects undersized commitments as repairable SPLIT-32 sidecars', () => {
    expect(isRepairableNftOutput('mutable', 0, 128)).toBe(false);
    expect(isRepairableNftOutput('mutable', 2, 128)).toBe(false);
    expect(isRepairableNftOutput('none', 0, 128)).toBe(false);
    expect(isRepairableNftOutput('mutable', 32, 128)).toBe(true);
    expect(isRepairableNftOutput('mutable', 64, 128)).toBe(true);
  });
});
