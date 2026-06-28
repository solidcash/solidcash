import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';

// A contract with a single variable-length `string` state var. Today this lives in ONE data NFT
// (dataNftCount === 1, fixed at compile time); the string grows and shrinks WITHIN that NFT's
// commitment. Multi-UTXO spanning (allocate an extra data NFT as the string grows past one
// commitment, free it as it shrinks) is the not-yet-implemented "memory" model - see the it.todo
// below and packages/solidc/docs/external-contract-calls.md (register/memory DECISION block).
const SOURCE = `
pragma solidcash >=0.8.0;

contract StringBox() {
    string text;

    function setText(string t, pubkey pk, sig s) {
        require(checkSig(s, pk));
        this.text = t;
    }
}
`;

describe('string state variable: extension and contraction (single data NFT)', () => {
  const provider = createTestProvider();
  const artifact = compileString(SOURCE);

  it('stores a variable-length string in exactly one data NFT', () => {
    expect(artifact.stateLayout!.dataNftCount).toBe(1);
    const v = artifact.stateLayout!.variables.find((x) => x.name === 'text')!;
    expect(v.type).toBe('string');
    expect(v.nftIndex).toBe(0);
  });

  it('extends then contracts the string across updates (deploy empty -> grow -> shrink -> empty)', async () => {
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { text: '' }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);
    const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

    // Grow from empty.
    await sc.setText('hello', alicePub, sig()).send();
    expect((await sc.getState()).text).toBe('hello');

    // Grow further.
    const longer = 'the quick brown fox jumps over the lazy dog';
    await sc.setText(longer, alicePub, sig()).send();
    expect((await sc.getState()).text).toBe(longer);

    // Contract to a shorter value.
    await sc.setText('hi', alicePub, sig()).send();
    expect((await sc.getState()).text).toBe('hi');

    // Contract back to empty.
    await sc.setText('', alicePub, sig()).send();
    expect((await sc.getState()).text).toBe('');
  });

  it('stores a string up to one chunk (<= 120 bytes) in a single chunk UTXO', async () => {
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { text: '' }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);
    const maxOneChunk = 'a'.repeat(120);
    await sc.setText(maxOneChunk, alicePub, new SignatureTemplate(alicePriv)).send();
    expect((await sc.getState()).text).toBe(maxOneChunk);
  });

  // Multi-chunk spanning (value > 120 bytes -> 2+ chunk UTXOs): the dynamic value is split across
  // several chunk UTXOs that allocate as it grows and free as it shrinks. The on-chain write loop
  // (OP_BEGIN/OP_UNTIL over i=0..ceil(len/120)-1, one chunk output verified per iteration) drives this.
  it('spans, allocates, and frees chunk UTXOs as a string state var grows past one chunk and shrinks back',
    async () => {
      const contract = new Contract(artifact, [], { provider });
      const { categoryId } = await setupStatefulUtxos(
        provider, contract, artifact.stateLayout!, { text: '' }, { saltContract: true },
      );
      const sc = StatefulContract.withCategory(contract, categoryId);
      const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

      // Distinct per-chunk content catches any chunk mis-ordering or off-by-one slice bug.
      const three = 'A'.repeat(120) + 'B'.repeat(120) + 'C'.repeat(10); // 250 bytes -> 3 chunks
      const two = 'X'.repeat(120) + 'Y'.repeat(10); // 130 bytes -> 2 chunks
      const one = 'hello'; // 5 bytes -> 1 chunk

      // Grow from empty (0 -> 3 chunks): mints 3 chunk UTXOs.
      await sc.setText(three, alicePub, sig()).send();
      expect((await sc.getState()).text).toBe(three);

      // Shrink (3 -> 2 chunks): consumes 3 old chunks, mints 2.
      await sc.setText(two, alicePub, sig()).send();
      expect((await sc.getState()).text).toBe(two);

      // Shrink (2 -> 1 chunk).
      await sc.setText(one, alicePub, sig()).send();
      expect((await sc.getState()).text).toBe(one);

      // Grow again (1 -> 3 chunks) to prove allocate-after-shrink works.
      await sc.setText(three, alicePub, sig()).send();
      expect((await sc.getState()).text).toBe(three);

      // Shrink all the way back to empty (3 -> 0 chunks): frees every chunk.
      await sc.setText('', alicePub, sig()).send();
      expect((await sc.getState()).text).toBe('');
    });
});

// Reading a dynamic var ON-CHAIN in the SAME function that writes it works (the raw new value is still
// on the stack, no chunk read loop needed). Reading a PERSISTED dynamic var co-spends the var's chunks
// as read-only inputs and loops to reassemble the value (see the read-loop describe below). The full
// off-chain read is always available via getState().
const RW_SOURCE = `
pragma solidcash >=0.8.0;

contract StringRW() {
    string text;

    function setAndCheck(string t, pubkey pk, sig s) {
        require(checkSig(s, pk));
        this.text = t;
        require(this.text == t);
    }
}
`;

describe('string state variable: on-chain read-after-write', () => {
  const provider = createTestProvider();
  const artifact = compileString(RW_SOURCE);

  it('passes on-chain require(this.text == t) for single- and multi-chunk values', async () => {
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { text: '' }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);
    const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

    await sc.setAndCheck('hi', alicePub, sig()).send(); // single chunk
    expect((await sc.getState()).text).toBe('hi');

    const big = 'Q'.repeat(250); // 3 chunks
    await sc.setAndCheck(big, alicePub, sig()).send();
    expect((await sc.getState()).text).toBe(big);
  });
});

// Reading a PERSISTED dynamic var on-chain (in a function that does NOT write it): the SDK co-spends the
// var's chunk UTXOs as read-only inputs, and the covenant loops to reassemble + verify the value.
const READ_SOURCE = `
pragma solidcash >=0.8.0;

contract ReadString() {
    string text;

    function setText(string t, pubkey pk, sig s) {
        require(checkSig(s, pk));
        this.text = t;
    }

    function checkText(string expected) {
        require(this.text == expected);
    }

    // reads the same persisted var twice in one function (two read loops, one co-spent chunk set)
    function checkTwice(string a) {
        require(this.text == a);
        require(this.text == a);
    }
}
`;

describe('string state variable: persisted on-chain read loop', () => {
  const provider = createTestProvider();
  const artifact = compileString(READ_SOURCE);
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  it('reassembles and verifies a persisted dynamic var on-chain (single + multi chunk)', async () => {
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { text: '' }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);

    // single chunk: read passes for the right value, fails the require for a wrong one.
    await sc.setText('hello', alicePub, sig()).send();
    await sc.checkText('hello').send();
    let threw = false;
    try { await sc.checkText('wrong').send(); } catch { threw = true; }
    expect(threw).toBe(true);

    // multi chunk (250 bytes -> 3 chunks): the read loop reassembles across chunks.
    const big = 'A'.repeat(120) + 'B'.repeat(120) + 'C'.repeat(10);
    await sc.setText(big, alicePub, sig()).send();
    await sc.checkText(big).send();

    // read the same var twice in one function.
    await sc.checkTwice(big).send();
  });

  it('reads an empty persisted value (from start and after shrink-to-empty)', async () => {
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { text: '' }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);

    await sc.checkText('').send(); // empty from the start: A$len 0, no chunks, read loop skipped
    await sc.setText('x', alicePub, sig()).send();
    await sc.setText('', alicePub, sig()).send(); // shrink back to empty
    await sc.checkText('').send();
  });
});

// Reading TWO distinct persisted dynamic vars in one function (phase-2 W1). Each var's chunks are co-spent
// as a contiguous trailing-input run in dynamicReads order; the covenant reads var R at
// blockSize + sum(prior read-var chunk counts) + i. Different chunk counts (3 vs 2) make a fixed-offset
// bug misread the second var, so this proves the shared-trailing-counter arithmetic.
const READ_TWO_SOURCE = `
pragma solidcash >=0.8.0;

contract ReadTwo() {
    string a;
    string b;

    function setA(string v, pubkey pk, sig s) { require(checkSig(s, pk)); this.a = v; }
    function setB(string v, pubkey pk, sig s) { require(checkSig(s, pk)); this.b = v; }

    // writes BOTH dynamic vars in one function, in reverse-of-declaration source order (b then a) to
    // exercise the declaration-order output-offset accumulation (W5).
    function setBoth(string va, string vb, pubkey pk, sig s) {
        require(checkSig(s, pk));
        this.b = vb;
        this.a = va;
    }

    function checkBoth(string ea, string eb) {
        require(this.a == ea);
        require(this.b == eb);
    }
}
`;

describe('string state variable: multiple persisted reads + distinct writes in one function (W1/W5)', () => {
  const provider = createTestProvider();
  const artifact = compileString(READ_TWO_SOURCE);
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  it('reassembles two distinct persisted vars with different chunk counts', async () => {
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { a: '', b: '' }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);

    const va = 'A'.repeat(120) + 'B'.repeat(120) + 'C'.repeat(10); // 250 -> 3 chunks
    const vb = 'X'.repeat(120) + 'Y'.repeat(10); // 130 -> 2 chunks
    await sc.setA(va, alicePub, sig()).send();
    await sc.setB(vb, alicePub, sig()).send();

    await sc.checkBoth(va, vb).send(); // both reassembled correctly via accumulated offsets
    // a wrong second value fails the require - proves b is read from its own chunk run, not a's.
    let threw = false;
    try { await sc.checkBoth(va, 'wrong').send(); } catch { threw = true; }
    expect(threw).toBe(true);
  });

  it('writes two distinct dynamic vars in one function with different chunk counts (W5)', async () => {
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { a: '', b: '' }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);

    const va = 'A'.repeat(120) + 'B'.repeat(120) + 'C'.repeat(10); // 250 -> 3 chunks
    const vb = 'X'.repeat(120) + 'Y'.repeat(10); // 130 -> 2 chunks
    await sc.setBoth(va, vb, alicePub, sig()).send(); // writes both, reverse source order, diff counts
    expect((await sc.getState()).a).toBe(va);
    expect((await sc.getState()).b).toBe(vb);
    await sc.checkBoth(va, vb).send(); // on-chain read-back of both (also W1 multi-read)
  });
});

// Reading one persisted var while WRITING a different var in one function (W2). The read var's chunks are
// co-spent read-only and preserved as outputs at [blockSize, blockSize+count) (the covenant pins
// output==input); the written var's new chunks come after them. Different chunk counts make a wrong output
// offset corrupt the preserved read var, so this proves the output-layout reconciliation.
const READ_WRITE_SOURCE = `
pragma solidcash >=0.8.0;

contract ReadWrite() {
    string a;
    string b;

    function setA(string v, pubkey pk, sig s) { require(checkSig(s, pk)); this.a = v; }

    function readAWriteB(string ea, string vb, pubkey pk, sig s) {
        require(checkSig(s, pk));
        require(this.a == ea);
        this.b = vb;
    }

    function checkBoth(string ea, string eb) {
        require(this.a == ea);
        require(this.b == eb);
    }
}
`;

describe('string state variable: read one var + write another in one function (W2)', () => {
  const provider = createTestProvider();
  const artifact = compileString(READ_WRITE_SOURCE);
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  it('preserves the read var while writing a different var (different chunk counts)', async () => {
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { a: '', b: '' }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);

    const va = 'A'.repeat(120) + 'B'.repeat(120) + 'C'.repeat(10); // 250 -> 3 chunks
    const vb = 'X'.repeat(120) + 'Y'.repeat(10); // 130 -> 2 chunks
    await sc.setA(va, alicePub, sig()).send();
    await sc.readAWriteB(va, vb, alicePub, sig()).send(); // read a (preserved), write b (new chunks after)
    expect((await sc.getState()).a).toBe(va); // a preserved intact
    expect((await sc.getState()).b).toBe(vb); // b written
    await sc.checkBoth(va, vb).send(); // on-chain read-back of both
  });
});

// The write covenant pins exactly ceil(A$len/120) chunk-address outputs (orphan-bound) and forces all
// ceil(oldLen/120) old chunks to be co-spent (old-chunk consumption), so no stray/duplicate chunk can
// survive to corrupt a future read. The grow/shrink suite above exercises the accept path across counts;
// this proves the reject path.
describe('string state variable: orphan-bound (write leaves exactly the right chunk set)', () => {
  const provider = createTestProvider();
  const artifact = compileString(SOURCE);
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  it('rejects a write that creates an extra (duplicate) chunk output', async () => {
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { text: '' }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);

    await sc.setText('hello', alicePub, sig()).send(); // valid baseline

    // Derive a valid single-chunk write, then append a duplicate chunk commitment so the builder emits
    // nNew+1 chunk outputs. The covenant's orphan-bound (count == nNew) must reject it.
    const call = sc.setText('world', alicePub, sig());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stb: any = await (call as any)._applyOverrides();
    const cur = stb.getChunkRawCommitments('text');
    stb.setChunkRawCommitments('text', [...cur, cur[0]]);
    let rejected = false;
    try { await stb.send(); } catch { rejected = true; }
    expect(rejected).toBe(true);
  });
});
