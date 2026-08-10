import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';

// BCH introspection: this.categoryId (the contract's own token category).

// Foundation for the EVM-parity external-call model. See docs/external-contract-calls.md.
describe('this.categoryId introspection (contract self-category)', () => {
  it('lowers to OP_INPUTINDEX OP_UTXOTOKENCATEGORY (the active input own category)', () => {
    const a = compileString(
      'contract C() { function f(bytes32 expected) { require(this.categoryId == expected); } }',
      { messageBus: false },
    );
    expect(a.bytecode).toContain('OP_INPUTINDEX OP_UTXOTOKENCATEGORY');
  });

  it('can be stored into a state variable', () => {
    const a = compileString('contract C() { bytes category; function f() { this.category = this.categoryId; } }');
    expect(a.contractName).toBe('C');
  });

  it('reserves `categoryId` as a state-variable name (shadowed by the introspection token)', () => {
    expect(() => compileString('contract C() { int categoryId; function f() { this.categoryId = 1; } }')).toThrow();
  });
});

describe('this.category introspection (display-order own category)', () => {
  it('strips the capability byte and reverses native category byte order', () => {
    const a = compileString(
      'contract C() { function f(bytes32 expected) { require(this.category == expected); } }',
      { messageBus: false },
    );
    expect(a.bytecode).toContain('OP_UTXOTOKENCATEGORY');
    expect(a.bytecode).toContain('OP_SPLIT OP_DROP OP_REVERSEBYTES');
  });

  it('can key an own-category token container without an ABI category parameter', () => {
    const a = compileString(
      'contract C() { int x; function readAmount() {'
      + ' bytes32 category = this.category; this.x = this.tokens[category].tokenAmount; } }',
      { messageBus: false },
    );
    const amount = a.abi.find((entry) => entry.name === 'readAmount')!;
    expect(amount.tokenContainerAccesses?.[0]).toMatchObject({ keySource: 'own' });
    expect(amount.inputs.some((input) => input.name === 'category')).toBe(false);
  });
});
