import { describe, expect, it } from 'vitest';
import { encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { VALUE_INLINE_LIMIT, bytesToHex, encodeChunkableValueTail, encodePushdataValue } from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { encodeFunctionArgument } from '../../../src/Argument.js';
import { planMappingWrite } from '../../../src/framed/composer/index.js';
import { hopEntryWrites } from '../../../src/framed/proxy/entry-writes.js';
import { headSentinelCommitment } from '../../../src/stateful/SortedList.js';

/**
 * A chunking mapping value the entry assembles from an argument that is itself an array.
 *
 * The artifact states the write's value as the struct construction the body performs, and one of the construction's
 * operands is an array parameter. Resolving that operand needs the type the entry declares for it, read element by
 * element; read as a single field value it yields nothing, and the hop then refuses the write because it cannot
 * size the run of chunk records the value takes. The node's commitment is checked against the shipped batch planner
 * over the same value, so the assertion is the value the body would write rather than a literal.
 */

const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x5b));

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Impl {'
  + '   struct Note { int kind; int16[2] pair; string memo; string tag; }'
  + '   mapping(string => Note) notes;'
  + '   function initialize(string id, int kind, int16[2] pair, string memo, string tag) {'
  + '     this.notes[id] = Note(kind, pair, memo, tag);'
  + '   }'
  + ' }';

const ID = 'AA';
const KIND = 5n;
const PAIR = [3n, 4n];
const MEMO = 'm'.repeat(30);
const TAG = 't'.repeat(30);

const artifact = compileStringMulti(SOURCE, { composition: 'framed' }).Impl!;

describe('a chunking mapping value built from an array argument', () => {
  it('states the whole value, and the created node carries the commitment the shipped planner derives from it', () => {
    const plan = hopEntryWrites({
      artifact, functionName: 'initialize', args: [ID, KIND, PAIR, MEMO, TAG], callerLockingBytecode: USER_LOCK,
    });
    expect(plan?.collection).toBe('notes');

    // The same value the body writes, in the shipped struct encoding, which is past the inline limit so the write
    // takes the run of chunk records whose length this planning step is what sizes.
    const value = encodePushdataValue(
      { kind: KIND, pair: PAIR, memo: MEMO, tag: TAG }, 'Note', artifact.structs,
    );
    expect(value.length).toBeGreaterThan(VALUE_INLINE_LIMIT);

    const expected = planMappingWrite({
      keys: [encodeFunctionArgument(ID, 'string') as Uint8Array],
      value,
      inventory: [headSentinelCommitment()],
      encodeValue: encodeChunkableValueTail,
    }).written[1]!.after;
    const created = plan!.writtenNodes.filter((node) => !node.existed);
    expect(created).toHaveLength(1);
    expect(bytesToHex(created[0]!.commitment)).toBe(bytesToHex(expected));
  });
});
