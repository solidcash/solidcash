import { describe, expect, it } from 'vitest';
import { sha256 } from '@solidcash/utils';
import { deriveFramedGenesis } from '../../solidcash/src/framed/deploy/index.js';
import { compileString } from './direct-compile.js';
import { buildValidatorProgram } from '../src/framed/validator/index.js';
import { compositionMachine, compositionProvider } from './framed/machine.js';

/**
 * A compiled program defines every identifier at most once.
 *
 * The BCH-2026 machine refuses a program that `OP_DEFINE`s an identifier it has already defined, so a master that
 * defines one twice cannot be evaluated at all - it stops at the definition with `OP_DEFINE a previously-defined
 * function identifier`, and every transaction that would run it is unusable. The two families of identifiers have
 * to stay disjoint: the semantic pass numbers the contract's own functions, and code generation reserves compact
 * negative script numbers for the helpers it emits, drawing the rest from a pool whose fallback range has to skip
 * every fixed helper identifier.
 *
 * The sorted scalar read's identifier is fixed, and the captured-subroutine pass defines it in any convention once
 * the read is used at enough sites to be worth outlining. The shapes below reach a collision without one: reads of
 * a sorted mapping make that capture worthwhile, and the contract's internal functions take the single-byte
 * identifiers the allocator prefers, so the allocator falls through to the fallback range and can land on the
 * identifier the captured read is about to define.
 */

/** A framed contract whose helper pool is pressured past the single-byte range, with or without a constructor. */
const pressuredContract = (internals: number, withConstructor: boolean): string => 'pragma solidcash ^0.14.0;'
  + ' contract Rep {'
  + '   int public counter;'
  + '   mapping(int => int) totals;'
  + (withConstructor ? '   constructor(int v) { this.counter = v; }' : '')
  + '   function a(int k) returns (int) { return this.totals[k]; }'
  + '   function b(int k) returns (int) { return this.totals[k] + 1; }'
  + '   function bump(int v) { this.counter = v; require(true); }'
  + Array.from({ length: internals }, (_unused, index) =>
    ` function i${index}(int x) internal pure returns (int) { return x + ${index}; }`).join('')
  + ' }';

/** Every identifier a compiled program defines, in the order the definitions are emitted. */
const definedIds = (bytecode: string): readonly string[] => {
  const tokens = bytecode.split(/\s+/);
  return tokens.flatMap((token, at) => (token === 'OP_DEFINE' ? [tokens[at - 1]!] : []));
};

/** The ids a shape defines, with the duplicates it defines twice. */
const duplicateIds = (source: string): readonly string[] => {
  const artifact = compileString(source, { composition: 'framed', sortedMappings: ['totals'] });
  const ids = definedIds(artifact.bytecode);
  const seen = new Set<string>();
  return ids.filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
};

describe('the identifiers a compiled framed master defines', () => {
  it('are distinct when the helper pool falls through to the captured sorted read\'s range', () => {
    // The pressure shape: one read alone leaves the captured read unprofitable and no collision is possible, so
    // the two reads are what put the captured read's identifier in play while the allocator is still walking.
    expect(duplicateIds(pressuredContract(13, false))).toStrictEqual([]);
    expect(duplicateIds(pressuredContract(16, false))).toStrictEqual([]);
  });

  it('stay distinct as the pressure grows, where an identifier the pool had taken is given back', () => {
    for (const internals of [11, 12, 13, 14, 15, 16, 20, 24]) {
      expect(duplicateIds(pressuredContract(internals, false))).toStrictEqual([]);
    }
  });

  it('leaves the capture undefined rather than colliding when a single read is not worth outlining', () => {
    const single = 'pragma solidcash ^0.14.0;'
      + ' contract Rep {'
      + '   int public counter;'
      + '   mapping(int => int) totals;'
      + '   function a(int k) returns (int) { return this.totals[k]; }'
      + Array.from({ length: 16 }, (_unused, index) =>
        ` function i${index}(int x) internal pure returns (int) { return x + ${index}; }`).join('')
      + ' }';
    expect(duplicateIds(single)).toStrictEqual([]);
  });
});

/**
 * The same shape under the machine that enforces the rule.
 *
 * A genesis runs the constructor frame against the BCH-2026 machine, so the master has to be evaluable before any
 * state can be derived from it. Reading its verdict is what says the definitions are the machine's own subject
 * rather than a property of the assembly text.
 */
describe('a framed master whose helper pool falls through to the captured read\'s identifier', () => {
  it('is accepted by the machine that refuses a program defining an identifier twice', () => {
    const artifact = compileString(pressuredContract(13, true), {
      composition: 'framed', sortedMappings: ['totals'],
    });
    const genesis = deriveFramedGenesis({
      artifact,
      category: sha256(new TextEncoder().encode('define identifier uniqueness')),
      validatorProgram: buildValidatorProgram(),
      provider: compositionProvider(),
      constructorArgs: [7n],
    });
    const vm = compositionMachine();
    expect(vm.stateSuccess(vm.evaluate(genesis.program!))).toBe(true);
    // The rule the machine just enforced, read off the program it accepted.
    const ids = definedIds(artifact.bytecode);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
