import { hash160, hexToBin } from '@bitauth/libauth';
import {
  decorateDecodedResult, resolveAddressForm, type StateValue, type StructDefinitionInfo,
} from '@solidcash/utils';
import { describe, expect as check, it } from 'vitest';
import { expect } from '../src/chai.js';

const identity = hexToBin('1234567890abcdef1234567890abcdef12345678');
const word = new Uint8Array(32);
word.set(identity, 12);
const lock = hexToBin(`76a914${'1234567890abcdef1234567890abcdef12345678'}88ac`);
const structs: StructDefinitionInfo[] = [
  { name: 'Party', fields: [{ name: 'recipient', type: 'address' }, { name: 'digest', type: 'bytes32' }] },
  { name: 'Record', fields: [{ name: 'parties', type: 'Party[]' }, { name: 'reviewers', type: 'address[2]' }] },
];
const typed = (value: StateValue, type = 'address'): StateValue => (
  decorateDecodedResult(value, type, structs, 'evm-abi-v1')
);

describe('ABI-typed address comparisons', () => {
  it('compares identity, ABI word, and locking-bytecode forms symmetrically', () => {
    for (const value of [identity, word, lock]) {
      expect(typed(word)).to.equal(value);
      expect(value).to.equal(typed(word));
    }
  });

  it('retains address typing through nested arrays and toObject/toArray', () => {
    const result = typed({ parties: [{ recipient: word, digest: word }], reviewers: [word, word] }, 'Record') as any;
    const expected = { parties: [{ recipient: lock, digest: word }], reviewers: [identity, lock] };
    expect(result.toObject()).to.deep.equal(expected);
    expect(expected).to.deep.equal(result.toObject());
    expect(result.reviewers.toArray()).to.deep.equal([lock, identity]);
    check(() => expect(result.toObject()).to.deep.equal({
      ...expected, parties: [{ recipient: lock, digest: identity }],
    })).toThrow();
  });

  it('does not loosen untyped bytes or native address equality', () => {
    check(() => expect(word).to.equal(identity)).toThrow();
    check(() => expect(identity).to.equal(lock)).toThrow();
    // A native artifact's form is 'bytecode': the leaf keeps its stored bytes ('hash' would project it).
    const native = decorateDecodedResult(word, 'address', undefined, 'compact-pushdata-v1', resolveAddressForm({}));
    check(() => expect(native).to.equal(identity)).toThrow();
    const other = identity.slice();
    other[0] ^= 1;
    check(() => expect(typed(word)).to.equal(other)).toThrow();
    const invalidWord = word.slice();
    invalidWord[0] = 1;
    check(() => expect(typed(word)).to.equal(invalidWord)).toThrow();
  });

  it('uses the Solidity P2SH32 identity without treating an arbitrary hash as an address', () => {
    const p2sh32 = hexToBin(`aa20${'ab'.repeat(32)}87`);
    expect(typed(hash160(p2sh32))).to.equal(p2sh32);
    check(() => expect(hash160(p2sh32)).to.equal(p2sh32)).toThrow();
  });
});
