import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { hexToBin, binToHex } from '@bitauth/libauth';
import { hash256 } from '@solidcash/utils';
import { Contract, TransactionBuilder } from '../src/index.js';
import { randomUtxo } from '../src/utils.js';
import { createTestProvider, verifyTransaction } from './test-util.js';

// Yul `create(0, add(c, 0x20), mload(c))` deploying the full content of a bytes local `c` (the
// `type(D).creationCode` idiom, e.g. semanticTests/various/code_access_create.sol) lowers to the deploy address =
// p2sh32(c): `0xaa20 || hash256(c) || 0x87`. Same emission as the existing compile-time-blob / free-mem-buffer
// create lowerings, only the content source differs (the named bytes local). VM-verify the derived address matches
// an independently JS-computed p2sh32, with a negative.
describe('Yul create(0, add(c,0x20), mload(c)) -> p2sh32(c) address (VM)', () => {
  const p2sh32 = (code: Uint8Array): string => `0xaa20${binToHex(hash256(code))}87`;

  const spend = (codeHex: string, expectedAddr: string): TransactionBuilder => {
    const provider = createTestProvider();
    const src = `contract C {
      function f(bytes c, address expected) {
        address d;
        assembly { d := create(0, add(c, 0x20), mload(c)) }
        require(d == expected);
        require(true);
      } }`;
    const contract = new Contract(compileString(src, { solidityImportCompat: true }), [], { provider });
    const utxo = randomUtxo();
    provider.addUtxo(contract.address, utxo);
    return new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.f(codeHex, expectedAddr))
      .addOutput({ to: contract.address, amount: 10000n });
  };

  const code = hexToBin('60016000f3aabbcc');
  it('derives p2sh32(c) as the create address', () => {
    expect(() => verifyTransaction(spend(`0x${binToHex(code)}`, p2sh32(code)))).not.toThrow();
  });
  it('negative: a wrong expected address fails the spend', () => {
    expect(() => verifyTransaction(spend(`0x${binToHex(code)}`, `0xaa20${'00'.repeat(32)}87`))).toThrow();
  });
});
