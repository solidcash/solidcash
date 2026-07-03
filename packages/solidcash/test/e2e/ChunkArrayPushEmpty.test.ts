import { describe, it } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';
import { hexToBin } from '@bitauth/libauth';

// Pushing onto an initially-EMPTY variable-width chunk array. A variable-width element type carries its
// `pushdata(count)` prefix inside the stored blob, so a never-written (A$len=0) array reads back as a
// zero-length blob with no prefix - the element ops then split an empty value. emitReadStateArrayBlob
// canonicalizes empty -> pushdata(0) so the first push decodes count=0. (IterableMapping's first keys.push().)
const SRC = `pragma solidcash >=0.8.0;
contract C() {
  address[] keys;
  function add(address k, pubkey pk, sig s) { require(checkSig(s, pk)); this.keys.push(k); }
  function count(int n) { require(this.keys.length == n); }
  function elem(int i, address e) { require(this.keys[i] == e); }
}`;

describe('chunk-array push onto an empty variable-width array', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);
  const a1 = hexToBin(`aa20${'11'.repeat(32)}87`);
  const a2 = hexToBin(`aa20${'22'.repeat(32)}87`);

  it('first push grows [] -> [a], second push -> [a, b]', async () => {
    const artifact = compileString(SRC, { chunkedArrays: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { keys: [] }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);

    await sc.add(a1, alicePub, sig()).send();       // push onto empty
    await sc.count(1n).send();
    await sc.elem(0n, a1).send();
    await sc.add(a2, alicePub, sig()).send();        // push onto non-empty
    await sc.count(2n).send();
    await sc.elem(1n, a2).send();
  });
});
