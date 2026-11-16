import { describe, expect, it } from 'vitest';
import type { Artifact } from '@solidcash/utils';
import { compileString } from './direct-compile.js';

/**
 * A raw low-level call through a target its function writes before the call. SynthesizeExternalAddressLocals reads the
 * call's receiver into a compiler local at the top of the body: a stored address (`payee.call{value: v}("")`), a
 * stored struct's field or a collection entry (`__extaddr_ll_split_to`, `__extaddr_ll_book_k`), a parameter's field
 * or element. A low-level call pinned and paid that local where it ran, so after `payee = p` the call was bound to the
 * address the variable held at the top of the body, which the EVM's call does not go to. The call site now reads the
 * written value, and an entry it cannot read there is refused by name.
 *
 * The payments are checked on the VM in LowLevelCallSiteTarget.e2e.test.ts.
 */

/** A payer whose one function is `body`, over a stored address, a stored struct and a mapping of addresses. */
const payer = (body: string): string => `pragma solidcash >=0.8.0;
contract Payer {
  struct Split { address to; int share; }
  address payee;
  Split split;
  mapping(int => address) book;
  int sends;
  ${body}
}`;

/** Each shape: a value call made after a write of its target, or with no write before it. */
const SHAPES: ReadonlyArray<readonly [string, string]> = [
  ['through a stored address written first', `function f(address p, int amount) external {
    payee = p;
    (bool ok, bytes data) = payee.call{value: amount}("");
    require(ok && data.length == 0);
    sends = sends + 1;
  }`],
  ['through a stored struct\'s field written first', `function f(address p, int amount) external {
    split = Split(p, 2);
    (bool ok, bytes data) = split.to.call{value: amount}("");
    require(ok && data.length == 0);
  }`],
  ['through the entry written first', `function f(int k, address p, int amount) external {
    book[k] = p;
    (bool ok, bytes data) = book[k].call{value: amount}("");
    require(ok && data.length == 0);
  }`],
  ['through a parameter\'s field written first', `function f(Split s, address p, int amount) external {
    s.to = p;
    (bool ok, bytes data) = s.to.call{value: amount}("");
    require(ok && data.length == 0);
  }`],
  ['through a parameter\'s element written first', `function f(address[] payees, int i, address p, int amount)
    external {
    payees[i] = p;
    (bool ok, bytes data) = payees[i].call{value: amount}("");
    require(ok && data.length == 0);
  }`],
  ['before a write of its target', `function f(address p, int amount) external {
    (bool ok, bytes data) = payee.call{value: amount}("");
    require(ok && data.length == 0);
    payee = p;
  }`],
  ['with no write of its target', `function f(int amount) external {
    (bool ok, bytes data) = payee.call{value: amount}("");
    require(ok && data.length == 0);
  }`],
  ['as a statement after a write', `function f(address p, int amount) external {
    payee = p;
    payee.call{value: amount}("");
  }`],
];

describe('a low-level call through a target its function writes before the call', () => {
  it.each(SHAPES)('compiles a value call %s, with its payment slot', (_shape, body) => {
    const artifact = compileString(payer(body), { forceStateful: true });
    expect(artifact.abi.find((fn) => fn.name === 'f')?.transferCount).toBe(1);
  });

  it('refuses by name a value call through an entry the function writes under another key first', () => {
    const compile = (): Artifact => compileString(payer(`function f(int j, int k, address p, int amount) external {
      book[j] = p;
      (bool ok, bytes data) = book[k].call{value: amount}("");
      require(ok && data.length == 0);
    }`), { forceStateful: true });
    expect(compile).toThrow(/ENTRY_TARGET_WRITTEN_BEFORE_CALL/);
    expect(compile).toThrow(/'f' writes 'book' before making a low-level call through an entry of it/);
    expect(compile).toThrow(/Make the call before the write, or write the same entry unconditionally/);
  });
});
