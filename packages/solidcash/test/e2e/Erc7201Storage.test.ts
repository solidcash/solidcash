import { describe, it, expect } from 'vitest';
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

// ERC-7201 namespaced storage (docs/evm-storage-parity.md P1): a NO-PARAM factory
//   `function layout() internal pure returns (S storage $) { assembly { $.slot := CONST } }`
// is the OZ-upgradeable idiom. Its struct fields are PROMOTED to hidden packed state (scalar -> register var,
// mapping -> collection). This is the exact shape of every OZ v5 upgradeable base (Ownable/ERC20/etc).

// MVP-1: single scalar field, local-alias read + write. uint256 (clean roundtrip; address is a 25-byte lbc,
// out of scope like the __evm_storage address-slot case).
const NS_SINGLE = `pragma solidcash >=0.8.0;
library CounterStorage {
  struct Layout { uint256 count; }
  bytes32 constant SLOT = keccak256("myapp.storage.Counter");
  function layout() internal pure returns (Layout storage $) { assembly { $.slot := SLOT } }
}
contract Counter() {
  function setCount(uint256 v, pubkey pk, sig s) {
    require(checkSig(s, pk));
    CounterStorage.Layout storage $ = CounterStorage.layout();
    $.count = v;
  }
  function checkCount(uint256 e) {
    CounterStorage.Layout storage $ = CounterStorage.layout();
    require($.count == e);
  }
}`;

describe('ERC-7201 namespaced storage: const-slot factory -> promoted state (MVP-1)', () => {
  it('compiles the const-slot factory idiom (promotes the field, consumes the factory)', () => {
    const art = compileString(NS_SINGLE, { solidityImportCompat: true });
    // The no-param factory is consumed (never emitted as a callable).
    expect(art.abi.some((f) => f.name === 'layout')).toBe(false);
    // The scalar field is promoted to a hidden PACKED register state var (one data NFT), not an __evm_storage entry.
    const svs = (art.stateLayout as unknown as { variables?: { name: string }[] })?.variables ?? [];
    expect(svs.some((v) => /count/i.test(v.name))).toBe(true);
    expect((art.stateLayout as unknown as { dataNftCount?: number })?.dataNftCount).toBe(1);
  });

  it('reads the promoted scalar default (0) right after deploy', async () => {
    const sc = await deploy(NS_SINGLE);
    await (sc as any).checkCount(0n).send();
  });

  it('persists the promoted scalar across txs (set in tx1, read in tx2)', async () => {
    const sc = await deploy(NS_SINGLE);
    await (sc as any).setCount(42n, alicePub, sig()).send();
    await (sc as any).checkCount(42n).send();
  });
});
