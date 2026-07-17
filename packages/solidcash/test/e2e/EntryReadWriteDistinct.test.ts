import { describe, it } from 'vitest';
import { compileString as _csRawSolidc } from 'solidc';
const compileString = (s: string, o: Record<string, unknown> = {}): ReturnType<typeof _csRawSolidc> => _csRawSolidc(s, { sortedMappingsAll: false, ...o } as any);
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';
import { hexToBin } from '@bitauth/libauth';

// Reading one mapping entry and writing a DIFFERENT mapping entry in the same function. Two facets had to line
// up: (1) written entries get lower slot indices than pure-read entries (SymbolTable), so an absent read-only
// slot never precedes a written slot and desyncs the derivation's positional commitment extraction; (2) the
// builder positions each existing entry input at ITS slot offset (not densely), so an absent lower slot funds
// a gap instead of shifting a higher slot's entry into it. Verified for new keys and existing keys.
const SRC = `pragma solidcash >=0.8.0;
contract C() {
  mapping(address => uint256) a;
  mapping(address => uint256) b;
  function seedB(address k, uint256 v, pubkey pk, sig s) { require(checkSig(s, pk)); this.b[k] = v; }
  function seedA(address k, uint256 v, pubkey pk, sig s) { require(checkSig(s, pk)); this.a[k] = v; }
  function copy(address k, uint256 v, pubkey pk, sig s) {
    require(checkSig(s, pk));
    uint256 x = this.b[k];   // read b (a DIFFERENT entry than the one written)
    this.a[k] = v + x;       // write a
  }
  function chkA(address k, uint256 ea) { require(this.a[k] == ea); }
}`;

describe('read one mapping entry, write a different one', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);
  const k1 = hexToBin(`aa20${'11'.repeat(32)}87`);

  async function fresh(): Promise<StatefulContract> {
    const artifact = compileString(SRC, { chunkedArrays: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, {}, { saltContract: true },
    );
    return StatefulContract.withCategory(contract, categoryId);
  }

  it('new key (both entries absent): read b=default, write a', async () => {
    const sc = await fresh();
    await sc.copy(k1, 100n, alicePub, sig()).send();   // x = b[k] = 0, a[k] = 100
    await sc.chkA(k1, 100n).send();
  });

  it('read entry exists, written entry absent', async () => {
    const sc = await fresh();
    await sc.seedB(k1, 5n, alicePub, sig()).send();
    await sc.copy(k1, 100n, alicePub, sig()).send();    // x = 5, a[k] = 105
    await sc.chkA(k1, 105n).send();
  });

  it('both entries exist', async () => {
    const sc = await fresh();
    await sc.seedB(k1, 5n, alicePub, sig()).send();
    await sc.seedA(k1, 1n, alicePub, sig()).send();
    await sc.copy(k1, 100n, alicePub, sig()).send();    // x = 5, a[k] = 105 (overwrites 1)
    await sc.chkA(k1, 105n).send();
  });
});
