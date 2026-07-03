import { describe, it } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';

const provider = createTestProvider();
const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

async function deploy(src: string): Promise<StatefulContract> {
  const art = compileString(src, { solidityImportCompat: true });
  const contract = new Contract(art, [], { provider });
  const { categoryId } = await setupStatefulUtxos(provider, contract, art.stateLayout!, {}, { saltContract: true });
  return StatefulContract.withCategory(contract, categoryId);
}

// EVM-storage foundation (docs/evm-storage-parity.md): assembly sstore/sload on an arbitrary slot routes to a
// synthesized `mapping(uint256 => uint256) __evm_storage`. A persistent roundtrip (set in tx1, read in tx2)
// must ride the mapping entry-NFT covenant: distinct slots are independent, an untouched slot reads default 0.
const EVM = `pragma solidcash >=0.8.0;
contract C() {
  function setSlot(uint256 slot, uint256 v, pubkey pk, sig s) {
    require(checkSig(s, pk));
    assembly { sstore(slot, v) }
  }
  function checkSlot(uint256 slot, uint256 expected) {
    uint256 r = 0;
    assembly { r := sload(slot) }
    require(r == expected);
  }
}`;

describe('EVM-storage foundation: sstore/sload roundtrip via __evm_storage', () => {
  it('persists a slot across txs; distinct/untouched slots are independent', async () => {
    const sc = await deploy(EVM);
    await (sc as any).setSlot(5n, 42n, alicePub, sig()).send();   // __evm_storage[5] = 42
    await (sc as any).checkSlot(5n, 42n).send();                  // reads 42 back
    await (sc as any).checkSlot(9n, 0n).send();                   // untouched slot -> default 0
    await (sc as any).setSlot(9n, 100n, alicePub, sig()).send();  // __evm_storage[9] = 100
    await (sc as any).checkSlot(9n, 100n).send();                 // slot 9 now 100
    await (sc as any).checkSlot(5n, 42n).send();                  // slot 5 unchanged
  });
});
