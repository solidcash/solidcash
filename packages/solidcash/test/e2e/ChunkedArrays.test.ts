import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';
import { hexToBin } from '@bitauth/libauth';

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

// W3: multiple writes to the SAME dynamic var in ONE function coalesce into a single final-value write -
// each op after the first reads the prior op's pending value via read-after-write. push;push, push x3
// (across a chunk-count boundary), idx-write + pop. Unblocks Structs.sol (push x3) + ArrayReplaceFromEnd.sol.
const MULTIW = `pragma solidcash >=0.8.0;
contract C() {
  uint256[] nums;
  function pushTwo(uint256 a, uint256 b, pubkey pk, sig s) { require(checkSig(s, pk)); this.nums.push(a); this.nums.push(b); }
  function pushThree(uint256 a, uint256 b, uint256 c, pubkey pk, sig s) {
    require(checkSig(s, pk)); this.nums.push(a); this.nums.push(b); this.nums.push(c);
  }
  function setAndPop(int i, uint256 v, pubkey pk, sig s) { require(checkSig(s, pk)); this.nums[i] = v; this.nums.pop(); }
}`;

describe('chunk-packed array: multiple writes per function (W3 coalescing)', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  it('coalesces push;push, push x3 (across a chunk boundary), and idx-write + pop', async () => {
    const artifact = compileString(MULTIW, { chunkedArrays: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { nums: [] }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);

    await sc.pushTwo(10n, 20n, alicePub, sig()).send();
    expect((await sc.getState()).nums).toEqual([10n, 20n]);
    await sc.pushThree(30n, 40n, 50n, alicePub, sig()).send(); // 2 -> 5 elems, crosses 1->2 chunk boundary
    expect((await sc.getState()).nums).toEqual([10n, 20n, 30n, 40n, 50n]);
    await sc.setAndPop(0n, 99n, alicePub, sig()).send(); // nums[0]=99 then pop last -> [99,20,30,40]
    expect((await sc.getState()).nums).toEqual([99n, 20n, 30n, 40n]);
  });
});

// P2c: a dynamic array mutated INSIDE a loop is auto-cached in a local (read once, mutate local in the loop,
// flush back once). push-in-loop and the shift-remove idiom (arr[i]=arr[i+1] + pop) - the Solidity-style
// bare-access forms the corpus uses (ArrayRemoveByShifting, MerkleTree).
const LOOPW = `pragma solidcash >=0.8.0;
contract C {
  uint256[] nums;
  function setNums(uint256 a, uint256 b, uint256 c, pubkey pk, sig s) external { require(checkSig(s, pk)); nums = [a, b, c]; }
  function appendRange(uint256 n, pubkey pk, sig s) external { require(checkSig(s, pk)); for (uint256 i = 0; i < n; i++) { nums.push(i); } }
  function removeAt(uint256 index, pubkey pk, sig s) external {
    require(checkSig(s, pk));
    for (uint256 i = index; i < nums.length - 1; i++) { nums[i] = nums[i + 1]; }
    nums.pop();
  }
}`;

describe('chunk-packed array: write inside a loop (P2c local-cache transform)', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  it('push-in-loop and shift-remove-in-loop produce correct state', async () => {
    const artifact = compileString(LOOPW, { solidityImportCompat: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { nums: [] }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);

    await sc.setNums(1n, 2n, 3n, alicePub, sig()).send();
    expect((await sc.getState()).nums).toEqual([1n, 2n, 3n]);
    await sc.appendRange(2n, alicePub, sig()).send(); // push 0,1 in a loop -> [1,2,3,0,1]
    expect((await sc.getState()).nums).toEqual([1n, 2n, 3n, 0n, 1n]);
    await sc.removeAt(1n, alicePub, sig()).send(); // shift-remove index 1 in a loop -> [1,3,0,1]
    expect((await sc.getState()).nums).toEqual([1n, 3n, 0n, 1n]);
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

// Phase 3 (#18): variable-width element types (string[]/int[]/bytes[]) chunk-pack as a single dynamic blob
// `pushdata(count) ++ pushdata(elem_0) ++ ...` (count kept in the blob, element access via scan). Reuses the
// dynamic-storage machinery + the packed-array variable-width codegen.
const STRS = `pragma solidcash >=0.8.0;
contract C() {
  string[] words;
  function setWords(string a, string b, string c, pubkey pk, sig s) { require(checkSig(s, pk)); this.words = [a, b, c]; }
  function pushWord(string w, pubkey pk, sig s) { require(checkSig(s, pk)); this.words.push(w); }
  function popWord(pubkey pk, sig s) { require(checkSig(s, pk)); this.words.pop(); }
  function checkElem(int i, string expected) { require(this.words[i] == expected); }
  function totalLen(int n) { int t = 0; for (string w of this.words) { t = t + w.length; } require(t == n); }
}`;

describe('chunk-packed array: variable-width elements (string[] / int[] / bytes[])', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  it('round-trips a string[]: write, read, index, push/pop, for..of - across chunk boundaries', async () => {
    const artifact = compileString(STRS, { chunkedArrays: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { words: [] }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);

    // two 100-byte strings: 200 B of element data + framing spills past one 120 B chunk
    const big = 'x'.repeat(100); const big2 = 'y'.repeat(100);
    await sc.setWords(big, 'mid', big2, alicePub, sig()).send();
    expect(await sc.getState().then((s) => s.words)).toEqual([big, 'mid', big2]);
    await sc.checkElem(0n, big).send();             // element 0 straddles chunks
    await sc.totalLen(203n).send();                 // for..of sums element .lengths (100+3+100)
    await expect(sc.checkElem(1n, 'nope').send()).rejects.toThrow();

    await sc.pushWord('extra', alicePub, sig()).send();
    expect(await sc.getState().then((s) => (s.words as string[]).length)).toBe(4);
    await sc.popWord(alicePub, sig()).send();
    expect(await sc.getState().then((s) => s.words)).toEqual([big, 'mid', big2]);
  });

  // address is variable-width on BCH (locking bytecode: 23/25/35 B) -> framed layout like bytes[].
  it('round-trips an address[]: assign, on-chain index read, push, length', async () => {
    const src = `pragma solidcash >=0.8.0;
contract C() {
  address[] addrs;
  function setAddrs(address a, address b, pubkey pk, sig s) { require(checkSig(s, pk)); this.addrs = [a, b]; }
  function add(address a, pubkey pk, sig s) { require(checkSig(s, pk)); this.addrs.push(a); }
  function checkElem(int i, address expected) { require(this.addrs[i] == expected); }
  function count(int n) { require(this.addrs.length == n); }
}`;
    const artifact = compileString(src, { chunkedArrays: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { addrs: [] }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);

    const a1 = hexToBin(`aa20${'11'.repeat(32)}87`); // p2sh32 locking bytecode (35 B)
    const a2 = hexToBin(`aa20${'22'.repeat(32)}87`);
    const a3 = hexToBin(`aa20${'33'.repeat(32)}87`);
    await sc.setAddrs(a1, a2, alicePub, sig()).send();
    await sc.count(2n).send();
    await sc.checkElem(0n, a1).send();              // framed decode of element 0
    await sc.checkElem(1n, a2).send();
    await expect(sc.checkElem(0n, a2).send()).rejects.toThrow(); // wrong expected at idx 0
    await sc.add(a3, alicePub, sig()).send();       // push to non-empty
    await sc.count(3n).send();
    await sc.checkElem(2n, a3).send();
  });

  it('round-trips int[] and bytes[] in one contract (cross-var preservation)', async () => {
    const src = `pragma solidcash >=0.8.0;
contract C() {
  int[] nums;
  bytes[] blobs;
  function setNums(int a, int b, int c, pubkey pk, sig s) { require(checkSig(s, pk)); this.nums = [a, b, c]; }
  function setBlobs(bytes a, bytes b, pubkey pk, sig s) { require(checkSig(s, pk)); this.blobs = [a, b]; }
  function checkNum(int i, int e) { require(this.nums[i] == e); }
}`;
    const artifact = compileString(src, { chunkedArrays: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { nums: [], blobs: [] }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);

    await sc.setNums(100n, 200n, 300n, alicePub, sig()).send();
    await sc.setBlobs(new Uint8Array([1, 2, 3]), new Uint8Array([4, 5]), alicePub, sig()).send(); // preserves nums
    const st = await sc.getState();
    expect(st.nums).toEqual([100n, 200n, 300n]);
    expect((st.blobs as Uint8Array[]).map((b) => [...b])).toEqual([[1, 2, 3], [4, 5]]);
    await sc.checkNum(2n, 300n).send();
  });
});

// #15: variable-width struct elements (a struct with a string/bytes/bigint field) chunk-pack via the framed
// layout, navigated by walking each element's inner field frames. Element-field writes (`arr[i].field = v`)
// desugar to a whole-element rebuild (`arr[i] = T(arr[i].f0, .., v, ..)`).
const STRUCTARR = `pragma solidcash >=0.8.0;
contract C() {
  struct Item { string name; int qty; }
  Item[] items;
  function setItems(string n0, int q0, string n1, int q1, pubkey pk, sig s) {
    require(checkSig(s, pk)); this.items = [Item(n0, q0), Item(n1, q1)];
  }
  function pushItem(string n, int q, pubkey pk, sig s) { require(checkSig(s, pk)); this.items.push(Item(n, q)); }
  function popItem(pubkey pk, sig s) { require(checkSig(s, pk)); this.items.pop(); }
  function setQty(int i, int q, pubkey pk, sig s) { require(checkSig(s, pk)); this.items[i].qty = q; }
  function checkName(int i, string e) { require(this.items[i].name == e); }
  function checkQty(int i, int e) { require(this.items[i].qty == e); }
}`;

describe('chunk-packed array: variable-width struct elements', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  it('round-trips a struct[] with a string field: write, read, push, element-field-write, pop', async () => {
    const artifact = compileString(STRUCTARR, { chunkedArrays: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { items: [] }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);

    // a 100-byte name pushes the element data past one chunk
    const big = 'x'.repeat(100);
    await sc.setItems(big, 3n, 'banana', 5n, alicePub, sig()).send();
    expect(await sc.getState().then((s) => s.items)).toEqual([{ name: big, qty: 3n }, { name: 'banana', qty: 5n }]);
    await sc.checkName(0n, big).send();          // element 0 straddles chunks
    await sc.checkQty(1n, 5n).send();
    await expect(sc.checkQty(1n, 4n).send()).rejects.toThrow();

    await sc.pushItem('cherry', 7n, alicePub, sig()).send();
    expect(await sc.getState().then((s) => (s.items as unknown[]).length)).toBe(3);
    await sc.checkName(2n, 'cherry').send();

    // element-field write -> whole-element rebuild
    await sc.setQty(0n, 99n, alicePub, sig()).send();
    expect(await sc.getState().then((s) => s.items)).toEqual(
      [{ name: big, qty: 99n }, { name: 'banana', qty: 5n }, { name: 'cherry', qty: 7n }],
    );

    await sc.popItem(alicePub, sig()).send();
    expect(await sc.getState().then((s) => (s.items as unknown[]).length)).toBe(2);
  });
});
