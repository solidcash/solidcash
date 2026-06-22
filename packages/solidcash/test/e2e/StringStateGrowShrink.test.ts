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

  it('rejects a string that overflows the single data NFT commitment (no UTXO is allocated)', async () => {
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { text: '' }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);

    // commitmentLimit is 128 bytes; a 200-byte string exceeds one commitment. Today this throws at
    // build time rather than allocating a second data NFT - that is the pending "memory" feature.
    const tooBig = 'x'.repeat(200);
    await expect(
      sc.setText(tooBig, alicePub, new SignatureTemplate(alicePriv)).send(),
    ).rejects.toThrow(/exceed/i);
  });

  // PENDING the variable-size "memory" model (entry-NFT-style growable storage for dynamic state).
  // When implemented, a `string` state var should span multiple data NFTs: deploying empty needs one
  // NFT, growing to 200 bytes allocates an extra NFT, and shrinking to 10 bytes frees the extraneous
  // NFT. Tracked in docs/external-contract-calls.md (register/memory DECISION block).
  it.todo('spans, allocates, and frees data NFTs as a string state var grows past one commitment and shrinks back');
});
