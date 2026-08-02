import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';
import { Contract, TransactionBuilder } from '../src/index.js';
import { randomUtxo } from '../src/utils.js';
import { createTestProvider, verifyTransaction } from './test-util.js';

// A `bytes` constant initialized with abi.encode* / abi.decode / type().name / a pure hash builtin is now accepted
// as compile-time. Constants are expression-substituted at each use site (visitIdentifier re-emits the initializer),
// so the SOUNDNESS invariant is that the constant behaves identically to the same expression written inline. VM-verify
// that, independent of abi.encode's exact byte layout, with a negative against a different encoding.
describe('const-init folding: abi.encode/keccak constant is faithful to the inline expression (VM)', () => {
  const spend = (src: string): TransactionBuilder => {
    const provider = createTestProvider();
    const contract = new Contract(compileString(src, { solidityImportCompat: true }), [], { provider });
    const utxo = randomUtxo();
    provider.addUtxo(contract.address, utxo);
    return new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.f())
      .addOutput({ to: contract.address, amount: 10000n });
  };

  it('an abi.encode constant equals the same abi.encode written inline', () => {
    const src = `contract C {
      bytes constant E = abi.encode(uint256(7), uint256(9));
      function f() { require(E == abi.encode(uint256(7), uint256(9))); require(true); }
    }`;
    expect(() => verifyTransaction(spend(src))).not.toThrow();
  });

  it('negative: the constant does NOT equal a different abi.encode', () => {
    const src = `contract C {
      bytes constant E = abi.encode(uint256(7), uint256(9));
      function f() { require(E == abi.encode(uint256(7), uint256(8))); require(true); }
    }`;
    expect(() => verifyTransaction(spend(src))).toThrow();
  });

  it('an abi.encodePacked constant equals the same expression inline', () => {
    const src = `contract C {
      bytes constant P = abi.encodePacked(uint256(1), uint256(2));
      function f() { require(P == abi.encodePacked(uint256(1), uint256(2))); require(true); }
    }`;
    expect(() => verifyTransaction(spend(src))).not.toThrow();
  });
});
