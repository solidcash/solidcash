import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';

// Chunk-packed fixed-width arrays (docs/arrays.md), behind the chunkedArrays flag. Whole-array
// store/read round-trip through the dynamic-storage chunk machinery + the tight-pack codec, plus
// shrink-to-empty and multiple dynamic vars per contract (cross-field preservation).
const NUMS = `pragma solidcash >=0.8.0;
contract C() {
  uint256[] nums;
  function setNums(uint256 a, uint256 b, uint256 c, uint256 d, pubkey pk, sig s) {
    require(checkSig(s, pk)); this.nums = [a, b, c, d];
  }
  function clearNums(pubkey pk, sig s) { require(checkSig(s, pk)); this.nums = []; }
  function checkLen(int n) { require(this.nums.length == n); }
  function checkElem(int i, uint256 expected) { require(this.nums[i] == expected); }
}`;
const BLOBS = `pragma solidcash >=0.8.0;
contract C() {
  bytes200[] blobs;
  function setBlobs(bytes200 x, bytes200 y, pubkey pk, sig s) { require(checkSig(s, pk)); this.blobs = [x, y]; }
}`;
// Two dynamic arrays in one contract. The data NFT holds both uint32 length headers (a$len, b$len);
// writing one must preserve the other's header AND leave its chunk UTXOs untouched.
const TWO = `pragma solidcash >=0.8.0;
contract C() {
  uint256[] a;
  bytes20[] b;
  function setA(uint256 x, uint256 y, pubkey pk, sig s) { require(checkSig(s, pk)); this.a = [x, y]; }
  function setB(bytes20 p, bytes20 q, bytes20 r, pubkey pk, sig s) { require(checkSig(s, pk)); this.b = [p, q, r]; }
  function clearA(pubkey pk, sig s) { require(checkSig(s, pk)); this.a = []; }
  function lenB(int n) { require(this.b.length == n); }
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

  it('shrinks a chunk-packed array to empty, and a .length-only read leaves chunks intact', async () => {
    const artifact = compileString(NUMS, { chunkedArrays: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { nums: [] }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);

    await sc.setNums(1n, 2n, 3n, 4n, alicePub, sig()).send(); // 132 B = 2 chunks
    // A function that only reads `.length` must NOT consume the chunk UTXOs (regression: it used to
    // destroy them, so the next read found A$len > 0 but no chunks).
    await sc.checkLen(4n).send();
    expect((await sc.getState()).nums).toEqual([1n, 2n, 3n, 4n]);
    await sc.clearNums(alicePub, sig()).send(); // 2 chunks -> empty
    expect((await sc.getState()).nums).toEqual([]);
  });

  it('reads array elements on-chain via this.a[i], including one spanning a chunk boundary', async () => {
    const artifact = compileString(NUMS, { chunkedArrays: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { nums: [] }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);

    await sc.setNums(10n, 20n, 30n, 40n, alicePub, sig()).send(); // 4 x 33 B = 132 B = 2 chunks
    // element 3 occupies bytes [99,132) - it straddles the 120-byte chunk boundary; reassembly handles it.
    for (const [i, exp] of [[0n, 10n], [1n, 20n], [2n, 30n], [3n, 40n]] as const) {
      await sc.checkElem(i, exp).send();
    }
    await expect(sc.checkElem(1n, 99n).send()).rejects.toThrow(); // wrong value
    await expect(sc.checkElem(4n, 0n).send()).rejects.toThrow();  // out of bounds
  });

  it('keeps two dynamic arrays independent: writing one preserves the other (header + chunks)', async () => {
    const artifact = compileString(TWO, { chunkedArrays: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { a: [], b: [] }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);
    const b20 = (n: number): Uint8Array => new Uint8Array(20).fill(n);

    await sc.setA(11n, 22n, alicePub, sig()).send();
    await sc.setB(b20(1), b20(2), b20(3), alicePub, sig()).send(); // must preserve a
    let st = await sc.getState();
    expect(st.a).toEqual([11n, 22n]);
    expect((st.b as Uint8Array[]).map((e) => e[0])).toEqual([1, 2, 3]);

    await sc.lenB(3n).send(); // read b.length while a has chunks
    await sc.setA(99n, 88n, alicePub, sig()).send(); // rewrite a, must preserve b
    st = await sc.getState();
    expect(st.a).toEqual([99n, 88n]);
    expect((st.b as Uint8Array[]).length).toBe(3);

    await sc.clearA(alicePub, sig()).send(); // clear a to empty, must preserve b
    st = await sc.getState();
    expect(st.a).toEqual([]);
    expect((st.b as Uint8Array[]).map((e) => e[0])).toEqual([1, 2, 3]);
  });
});

// Element ops (#14): each reads the array (reassemble chunks), modifies on-stack, and writes it back. The
// read and write of the SAME var co-spend its chunks once - read loop reassembles from the consumed inputs.
const ELEMS = `pragma solidcash >=0.8.0;
contract C() {
  uint256[] nums;
  function setNums(uint256 a, uint256 b, pubkey pk, sig s) { require(checkSig(s, pk)); this.nums = [a, b]; }
  function setElem(int i, uint256 v, pubkey pk, sig s) { require(checkSig(s, pk)); this.nums[i] = v; }
  function push(uint256 v, pubkey pk, sig s) { require(checkSig(s, pk)); this.nums.push(v); }
  function pop(pubkey pk, sig s) { require(checkSig(s, pk)); this.nums.pop(); }
  function del(int i, pubkey pk, sig s) { require(checkSig(s, pk)); this.nums.delete(i); }
}`;

describe('chunk-packed array: element ops (read-modify-write)', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  const fresh = async (): Promise<StatefulContract> => {
    const artifact = compileString(ELEMS, { chunkedArrays: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { nums: [] }, { saltContract: true },
    );
    return StatefulContract.withCategory(contract, categoryId);
  };

  it('writes element i in place (including one straddling a chunk boundary)', async () => {
    const sc = await fresh();
    // grow to 4 elements (132 B = 2 chunks) so element 3 straddles the boundary
    await sc.setNums(10n, 20n, alicePub, sig()).send();
    await sc.push(30n, alicePub, sig()).send();
    await sc.push(40n, alicePub, sig()).send();
    await sc.setElem(1n, 99n, alicePub, sig()).send();
    expect((await sc.getState()).nums).toEqual([10n, 99n, 30n, 40n]);
    await sc.setElem(3n, 88n, alicePub, sig()).send(); // straddles bytes [99,132)
    expect((await sc.getState()).nums).toEqual([10n, 99n, 30n, 88n]);
  });

  it('pushes and pops across chunk-count transitions', async () => {
    const sc = await fresh();
    await sc.setNums(10n, 20n, alicePub, sig()).send(); // 66 B, 1 chunk
    await sc.push(30n, alicePub, sig()).send();         // 99 B, 1 chunk
    await sc.push(40n, alicePub, sig()).send();         // 132 B, 2 chunks (1 -> 2)
    expect((await sc.getState()).nums).toEqual([10n, 20n, 30n, 40n]);
    await sc.pop(alicePub, sig()).send();               // 99 B, 1 chunk (2 -> 1)
    await sc.pop(alicePub, sig()).send();               // 66 B, 1 chunk
    expect((await sc.getState()).nums).toEqual([10n, 20n]);
  });

  it('deletes an element (swap-with-last, same semantics as a packed array)', async () => {
    const sc = await fresh();
    await sc.setNums(10n, 20n, alicePub, sig()).send();
    await sc.push(30n, alicePub, sig()).send();
    await sc.push(40n, alicePub, sig()).send();
    await sc.del(1n, alicePub, sig()).send(); // [10,20,30,40] -> [10,40,30]
    expect((await sc.getState()).nums).toEqual([10n, 40n, 30n]);
  });
});

// for..of (#17): desugars to an index loop over a once-cached local, so it works on chunk-packed (and
// packed) arrays, which aren't collections. The loop var may go unused (e.g. counting), like a collection.
const ITER = `pragma solidcash >=0.8.0;
contract C() {
  uint256[] nums;
  function setNums(uint256 a, uint256 b, uint256 c, uint256 d, pubkey pk, sig s) {
    require(checkSig(s, pk)); this.nums = [a, b, c, d];
  }
  function checkSum(int expected) { int t = 0; for (uint256 x of this.nums) { t = t + int(x); } require(t == expected); }
  function checkCount(int expected) { int c = 0; for (uint256 x of this.nums) { c = c + 1; } require(c == expected); }
}`;

describe('chunk-packed array: for..of iteration', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  it('iterates elements on-chain (sum + count across a chunk boundary)', async () => {
    const artifact = compileString(ITER, { chunkedArrays: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { nums: [] }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);

    await sc.setNums(10n, 20n, 30n, 40n, alicePub, sig()).send(); // 132 B = 2 chunks, sum 100
    await sc.checkSum(100n).send();                 // sums elements (incl. boundary-straddling element 3)
    await sc.checkCount(4n).send();                 // loop var unused -> still allowed
    await expect(sc.checkSum(99n).send()).rejects.toThrow();
  });
});
