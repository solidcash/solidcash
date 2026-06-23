import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';

// Chunk-packed fixed-width arrays (docs/arrays.md), behind the chunkedArrays flag. Whole-array
// store/read round-trip through the dynamic-storage chunk machinery + the tight-pack codec.
// KNOWN follow-ups (not yet covered): shrink-to-empty (`this.a = []`) and >1 dynamic array per contract.
const NUMS = `pragma solidcash >=0.8.0;
contract C() {
  uint256[] nums;
  function setNums(uint256 a, uint256 b, uint256 c, uint256 d, pubkey pk, sig s) {
    require(checkSig(s, pk)); this.nums = [a, b, c, d];
  }
  function checkLen(int n) { require(this.nums.length == n); }
}`;
const BLOBS = `pragma solidcash >=0.8.0;
contract C() {
  bytes200[] blobs;
  function setBlobs(bytes200 x, bytes200 y, pubkey pk, sig s) { require(checkSig(s, pk)); this.blobs = [x, y]; }
}`;

describe('chunk-packed array: whole-array round-trip', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  it('writes a multi-chunk uint256[], reads it back, and verifies .length on-chain', async () => {
    const artifact = compileString(NUMS, { chunkedArrays: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { nums: [] }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);

    await sc.setNums(1n, 2n, 3n, 4n, alicePub, sig()).send(); // 4 x uint256 = 132 B = 2 chunks
    expect((await sc.getState()).nums).toEqual([1n, 2n, 3n, 4n]);
    await sc.checkLen(4n).send(); // on-chain .length = A$len / elementWidth
  });

  it('writes a bytes200[] whose elements each span multiple chunks, and reads it back', async () => {
    const artifact = compileString(BLOBS, { chunkedArrays: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { blobs: [] }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);

    const x = new Uint8Array(200).fill(0xaa);
    const y = new Uint8Array(200).fill(0xbb);
    await sc.setBlobs(x, y, alicePub, sig()).send(); // 2 x 200 B = 400 B = 4 chunks
    const got = (await sc.getState()).blobs as Uint8Array[];
    expect(got.length).toBe(2);
    expect([...got[0]]).toEqual([...x]);
    expect([...got[1]]).toEqual([...y]);
  });
});
