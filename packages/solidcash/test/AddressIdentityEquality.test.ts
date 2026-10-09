import { describe, expect, it } from 'vitest';
import { Contract, TransactionBuilder } from '../src/index.js';
import { compileString } from './direct-compile.js';
import { createTestProvider, verifyTransaction } from './test-util.js';
import { randomUtxo } from '../src/utils.js';

const SOURCE = `
contract AddressIdentityEquality {
  function same(address left, address right) public pure {
    require(left == right);
  }

  function different(address left, address right) public pure {
    require(left != right);
  }
}
`;

const p2pkh = (identity: Uint8Array): Uint8Array => Uint8Array.of(
  0x76, 0xa9, 0x14, ...identity, 0x88, 0xac,
);

const abiWord = (identity: Uint8Array): Uint8Array => Uint8Array.of(
  ...new Uint8Array(12), ...identity,
);

describe('Solidity-compatible address identity equality', () => {
  const build = async (
    name: 'same' | 'different', left: Uint8Array, right: Uint8Array,
  ): Promise<TransactionBuilder> => {
    const provider = createTestProvider();
    const contract = new Contract(compileString(SOURCE, { evmCompat: true }), [], { provider });
    const utxo = randomUtxo();
    await provider.addUtxo(contract.address, utxo);
    return new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock[name](left, right))
      .addOutput({ to: contract.address, amount: 10_000n });
  };

  it('matches a native BCH address with its right-aligned ABI word', async () => {
    const identity = new Uint8Array(20).fill(0x24);
    const transaction = await build('same', p2pkh(identity), abiWord(identity));
    expect(() => verifyTransaction(transaction)).not.toThrow();
  });

  it('does not collapse distinct address identities', async () => {
    const left = new Uint8Array(20).fill(0x24);
    const right = new Uint8Array(20).fill(0x42);
    const transaction = await build('different', p2pkh(left), abiWord(right));
    expect(() => verifyTransaction(transaction)).not.toThrow();
  });
});
