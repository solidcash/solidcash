import { describe, expect, it } from 'vitest';
import { compileString, compileStringMulti } from '../../../src/compiler.js';
import { publishedRefusals } from './refused-entry.js';
import { deployMaster, verifyMasterDeployment } from '../../../../solidcash/src/framed/deploy/index.js';
import { REAL_VALIDATOR_PROGRAM, seededCategory } from './validator-input.js';

/**
 * A framed master whose body reads a long mapping value.
 *
 * A mapping whose value type is unbounded (`string`, `bytes`) stores the value as a length, a root and the head
 * of its bytes; the body that reads one materializes the value from the frame's own value list, which the head
 * parks one slot per long value the bodies behind it read. The count is therefore a property of the *master*: it
 * is derived from every body the head dispatches, and each body is emitted on its own traversal, which seeds
 * itself from the slots the head leaves.
 *
 * The entries are deliberately split: one body writes the mapping and another reads it. A read in the same body
 * as a write resolves from that body's own pending write, so a contract whose only reader also writes says
 * nothing about whether the head leaves the slot the reader needs.
 */

const CATEGORY = seededCategory('long value witness framed');
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;

/** One body writes a long mapping value and another reads one back. */
const SPLIT_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Tags {'
  + '   mapping(string => string) tags;'
  + '   function put(string k, string v) { tags[k] = v; }'
  + '   function probe(string k) { string v = tags[k]; require(v.length > 0); }'
  + ' }';

/** The same read in the same body as the write, which resolves without the head's slot. */
const SINGLE_BODY_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Tags {'
  + '   mapping(string => string) tags;'
  + '   function put(string k, string v) { tags[k] = v; string back = tags[k]; require(back.length >= 0); }'
  + ' }';

const artifacts = compileStringMulti(SPLIT_SOURCE, { composition: 'framed' });

describe('a framed master whose body reads a long mapping value', () => {
  it('compiles with the reading body served rather than failing its own emission', () => {
    // The reader's body is emitted on its own traversal; the value it reads is the slot the head parked, so a head
    // that did not leave one would stop this compile inside the body rather than publishing a refusal.
    expect(publishedRefusals(artifacts)).toStrictEqual([]);
    const tags = artifacts.Tags!;
    expect(tags.abi.map((entry) => entry.name).sort()).toStrictEqual(['probe', 'put']);
    expect(tags.composition?.convention).toBe('framed');
  });

  it('publishes a master program that deploys against its own reserved slots', () => {
    // The reservation check is the shipped deployment's: every published offset has to sit on a reserved push in
    // the finished script, so this only passes when the offsets the head published point at its own slots.
    const array = compileStringMulti(SPLIT_SOURCE, { composition: 'framed' });
    const deployed = deployMaster(array.Tags!, CATEGORY, VALIDATOR_PROGRAM);
    expect(() => verifyMasterDeployment(deployed, array.Tags!, CATEGORY, VALIDATOR_PROGRAM)).not.toThrow();
  });

  it('compiles the same read inside one body, which resolves from that body\'s own write', () => {
    // The control beside the shape above: this contract has one body and never reaches the head's value slot, so
    // it compiles both before and after the change that made the split shape compile.
    const single = compileString(SINGLE_BODY_SOURCE, { composition: 'framed' });
    expect(single.composition?.convention).toBe('framed');
    expect(publishedRefusals({ Tags: single })).toStrictEqual([]);
  });
});
