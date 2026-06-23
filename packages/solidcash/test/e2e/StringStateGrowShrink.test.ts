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
