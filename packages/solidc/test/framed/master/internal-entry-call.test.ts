import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../../src/compiler.js';
import { publishedRefusals } from './refused-entry.js';

/**
 * An internal call to a function that writes a mapping.
 *
 * A write to a sorted mapping takes its batch witnesses as the writing function's own parameters, which a call to
 * that function cannot pass. So the called function is inlined into its caller, whose own batch then covers the
 * write, and a called entry keeps its definition. The void inliner used to run only when the contract declared an
 * internal helper, and the returning one took a write only beside a read, so each shape below threw
 * `InvalidParameterTypeError` for the whole contract, in both conventions. `this.f()` is not one of them: it is a
 * message call, whose callee does not keep the caller's sender (`toys/identity.test.ts` pins it refused).
 */

const ledger = (members: string): string => 'pragma solidcash ^0.14.0;'
  + ' contract Ledger {'
  + '   mapping(int => int) seen;'
  + members
  + ' }';

const CASES = [
  {
    name: 'a void entry called by name',
    members: ' function f(int k) { this.seen[k] = 1; } function g(int k) { f(k); }',
    kept: 'f', caller: 'g',
  },
  {
    name: 'a returning entry',
    members: ' function f(int k) returns (int) { this.seen[k] = 1; return k; }'
      + ' function g(int k) { require(f(k) == k); }',
    kept: 'f', caller: 'g',
  },
  {
    name: 'a returning private helper',
    members: ' function mark(int k) private returns (int) { this.seen[k] = 1; return k; }'
      + ' function g(int k) { require(mark(k) == k); }',
    kept: undefined, caller: 'g',
  },
  {
    name: 'an entry the constructor calls',
    members: ' constructor() { f(1); } function f(int k) { this.seen[k] = 1; }',
    kept: 'f', caller: undefined,
  },
] as const;

type Abi = readonly { name: string; entryAccesses?: readonly { collection: string; operations: readonly string[] }[] }[];

describe('an internal call to a function that writes a mapping', () => {
  for (const { name, members, kept, caller } of CASES) {
    it(`compiles ${name} in both conventions`, () => {
      for (const options of [{ composition: 'framed' }, {}]) {
        const artifacts = compileStringMulti(ledger(members), options as never);
        expect(publishedRefusals(artifacts)).toStrictEqual([]);
        const abi = artifacts.Ledger!.abi as unknown as Abi;
        if (kept !== undefined) expect(abi.map((entry) => entry.name)).toContain(kept);
        if (caller === undefined) continue;
        // The caller's own accesses now name the write it inlined.
        const accesses = abi.find((entry) => entry.name === caller)?.entryAccesses ?? [];
        expect(accesses.some((access) => access.collection === 'seen' && access.operations.includes('write')))
          .toBe(true);
      }
    });
  }
});
