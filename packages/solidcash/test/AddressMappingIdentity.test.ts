import { hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';
import { Contract, Signer, StatefulContract } from '../src/index.js';
import { addressToLockScript } from '../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from './test-util.js';

describe('typed address mapping identity in direct calls', () => {
  it.each([
    { compat: false, nested: false }, { compat: true, nested: false },
    { compat: false, nested: true }, { compat: true, nested: true },
  ])('authenticates reads and keys (compatibility: $compat, nested: $nested)', async ({ compat, nested }) => {
    const artifact = compileString(`contract Store() {
      ${nested ? 'mapping(address => mapping(address => int))' : 'enumerable mapping(address => int)'} records;
      function record() public { this.records[msg.sender]${nested ? '[msg.sender]' : ''} = 42; require(true); }
      function check(address who, int expected) public {
        require(this.records[who]${nested ? '[who]' : ''} == expected);
      }
      ${nested ? '' : `function checkKeys() public {
        int count = 0;
        for (address key in this.records) { count = count + 1; }
        require(count == 1);
      }`}
    }`, { forceStateful: true, evmCompat: compat, suppressWarnings: true });
    const provider = createTestProvider();
    const base = new Contract(artifact, [], { provider });
    const seeded = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
    const signer = new Signer(new Uint8Array(32).fill(0x63), provider);
    for (let index = 0; index < 8; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 100).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
      });
    }
    const store = StatefulContract.withCategory(base.withCategory(hexToBin(seeded.categoryId)), seeded.categoryId)
      .connect(signer);
    await store.call.record().send();
    const native = addressToLockScript(signer.getAddress());
    const word = Uint8Array.of(...new Uint8Array(12), ...native.slice(3, 23));
    await expect(store.call.check(native, 42n).send()).resolves.toHaveProperty('txid');
    await expect(store.call.check(word, compat ? 42n : 0n).send()).resolves.toHaveProperty('txid');
    const other = Uint8Array.of(...new Uint8Array(12), ...new Uint8Array(20).fill(0x64));
    await expect(store.call.check(other, 0n).send()).resolves.toHaveProperty('txid');
    if (!nested) {
      store.setIterationKeys('records', [compat ? word : native]);
      await expect(store.call.checkKeys().send()).resolves.toHaveProperty('txid');
      store._setRawIterationKeysBlob('records', Uint8Array.of(other.length, ...other));
      await expect(store.call.checkKeys().send()).rejects.toThrow('OP_VERIFY');
    }
  }, 180_000);
});
