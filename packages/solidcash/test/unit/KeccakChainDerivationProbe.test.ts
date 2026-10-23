import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { compileString } from '@solidcash/solidc';
import { getContractFactory } from '../../src/stateful/index.js';
import { fundedSigner } from '../test-util.js';

/**
 * The factory-deploy state-derivation probe (`sc-derive-commitments.ts`) must thread a direct unbounded
 * `keccak256(x)` through its chained START/CONT/FINAL side-cars so the FINAL side-car digest feeds the derived
 * post-call state commitment. This drives that probe through a real StatefulContract instance.
 */
const SOURCE = `
contract ChainHasher {
    bytes32 digest;

    function record(bytes memory x) public {
        digest = keccak256(x);
    }
}`;

const ARTIFACT = compileString(SOURCE, { forceStateful: true, enforceFinalRequire: false });

const bigPreimage = (): Uint8Array => {
  const out = new Uint8Array(12_000);
  for (let i = 0; i < out.length; i += 1) out[i] = (i * 13 + 7) & 0xff;
  return out;
};

describe('keccak chained side-cars in the state-derivation probe', () => {
  it('derives the FINAL chained digest into the post-call state commitment', async () => {
    const signer = await fundedSigner(8, 10_000_000n);
    const contract = await getContractFactory(ARTIFACT, signer).deploy();
    const preimage = bigPreimage();

    const derived = await (contract as unknown as {
      _deriveCommitments(
        functionName: string,
        args: unknown[],
        requiredNftIndices: readonly number[],
      ): Promise<{ state: Record<string, unknown> }>;
    })._deriveCommitments('record', [preimage], [0]);

    const digest = derived.state.digest;
    expect(digest).toBeInstanceOf(Uint8Array);
    expect(binToHex(digest as Uint8Array)).toBe(binToHex(keccak_256(preimage)));
  }, 300_000);
});
