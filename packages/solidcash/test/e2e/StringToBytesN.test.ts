import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { hexToBin } from '@bitauth/libauth';

// A string literal assigned/compared to a fixed bytesN is right-padded with zeros (Solidity parity).
// "abc" -> 0x616263 padded to N bytes.
const SRC = `contract C() {
  function check(bytes32 e) { bytes32 x = "abc"; require(x == e); }
  function checkCmp(bytes3 e) { require("abc" == e); }
}`;
const ABC32 = hexToBin(`616263${'00'.repeat(29)}`); // "abc" right-padded to 32 bytes
const ABC3 = hexToBin('616263');

describe('string literal -> bytesN (right-padded)', () => {
  const provider = createTestProvider();
  const art = compileString(SRC, { solidityImportCompat: true, forceStateful: true });
  const contract = new Contract(art, [], { provider });

  it('bytes32 x = "abc" equals the right-padded value; wrong value fails', async () => {
    const { categoryId } = await setupStatefulUtxos(provider, contract, art.stateLayout!, {}, { saltContract: true });
    const sc = StatefulContract.withCategory(contract, categoryId);
    const tx = await sc.check(ABC32).send();
    expect(tx.txid).toBeDefined();
    await expect(sc.check(hexToBin('00'.repeat(32))).send()).rejects.toThrow('messageBus: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.');
  });

  it('comparison "abc" == bytes3 arg holds for the exact-fit value', async () => {
    const { categoryId } = await setupStatefulUtxos(provider, contract, art.stateLayout!, {}, { saltContract: true });
    const sc = StatefulContract.withCategory(contract, categoryId);
    const tx = await sc.checkCmp(ABC3).send();
    expect(tx.txid).toBeDefined();
  });
});
