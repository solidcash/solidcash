import { describe, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';
import { hexToBin } from '@bitauth/libauth';

// `bytes` dynamic byte array push/pop. A bytes blob has no per-element length prefix, so `b.push(x)` desugars
// to a concat (`b = b + x`) and `b.pop()` to a slice (`b = b[0 : b.length - 1]`), reusing the tested bytes
// concat/slice codegen. Verified end-to-end on the VM via `== e` / `.length` readers.
const SRC = `pragma solidcash >=0.8.0;
contract C() {
  bytes data;
  function push(bytes1 b, pubkey pk, sig s) { require(checkSig(s, pk)); data.push(b); }
  function pop(pubkey pk, sig s) { require(checkSig(s, pk)); data.pop(); }
  function check(bytes e) { require(data == e); }
  function len(int n) { require(data.length == n); }
}`;

describe('bytes .push() / .pop()', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function dep(): Promise<any> {
    const art = compileString(SRC, { solidityImportCompat: true });
    const contract = new Contract(art, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, contract, art.stateLayout!, {}, { saltContract: true });
    return StatefulContract.withCategory(contract, categoryId);
  }

  it('push appends bytes and pop drops the last byte', async () => {
    const sc = await dep();
    await sc.push(hexToBin('42'), alicePub, sig()).send();
    await sc.check(hexToBin('42')).send();
    await sc.len(1n).send();
    await sc.push(hexToBin('37'), alicePub, sig()).send();
    await sc.check(hexToBin('4237')).send();  // appended in order
    await sc.len(2n).send();
    await sc.pop(alicePub, sig()).send();
    await sc.check(hexToBin('42')).send();     // last byte dropped
    await sc.len(1n).send();
  });
});
