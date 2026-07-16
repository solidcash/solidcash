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

// P4 Tier-2 interop (docs/evm-storage-parity.md): the EVM mapping-slot assembly idiom
//   mstore(0,k); mstore(32,p); sload/sstore(keccak256(0,64))   // m at slot p
// bridges to the high-level mapping m at slot p, so hand-written assembly and high-level m[k] hit the SAME
// entry collection. `balances` is the first (only) state member -> EVM slot 0.
const TIER2 = `pragma solidcash >=0.8.0;
contract C() {
  mapping(uint256 => uint256) balances;
  function setViaAsm(uint256 k, uint256 v, pubkey pk, sig s) {
    require(checkSig(s, pk));
    assembly {
      mstore(0, k)
      mstore(32, 0)
      sstore(keccak256(0, 64), v)
    }
  }
  function setHighLevel(uint256 k, uint256 v, pubkey pk, sig s) {
    require(checkSig(s, pk));
    balances[k] = v;
  }
  function checkHighLevel(uint256 k, uint256 e) { require(balances[k] == e); }
  function checkViaAsm(uint256 k, uint256 e) {
    uint256 r = 0;
    assembly {
      mstore(0, k)
      mstore(32, 0)
      r := sload(keccak256(0, 64))
    }
    require(r == e);
  }
}`;

describe('EVM storage Tier-2: assembly mapping-slot idiom <-> high-level mapping (P4)', () => {
  it('routes the assembly keccak mapping-slot idiom to the high-level mapping (no __evm_storage)', () => {
    const art = compileString(TIER2, { solidityImportCompat: true });
    const cols = (art.stateLayout as unknown as { collections?: { name: string }[] })?.collections ?? [];
    expect(cols.map((c) => c.name)).toContain('balances');
    expect(cols.some((c) => c.name === '__evm_storage')).toBe(false); // idiom bridged, not routed to __evm_storage
    const set = art.abi.find((f) => f.name === 'setViaAsm') as { entryAccesses?: { collection: string }[] };
    expect(set?.entryAccesses?.[0]?.collection).toBe('balances');
  });

  it('assembly write is read back by high-level m[k] (and by assembly)', async () => {
    const sc = await deploy(TIER2);
    await (sc as any).setViaAsm(5n, 42n, alicePub, sig()).send();
    await (sc as any).checkHighLevel(5n, 42n).send();   // high-level sees the assembly write
    await (sc as any).checkViaAsm(5n, 42n).send();       // assembly reads it back
  });

  it('high-level write is read back by the assembly idiom (bidirectional interop)', async () => {
    const sc = await deploy(TIER2);
    await (sc as any).setHighLevel(7n, 99n, alicePub, sig()).send();
    await (sc as any).checkViaAsm(7n, 99n).send();        // assembly sees the high-level write
    await (sc as any).checkHighLevel(7n, 99n).send();
  });
});
