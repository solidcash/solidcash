import { describe, expect, it } from 'vitest';
import { refusalMessageOf } from './refused-entry.js';

/**
 * The shapes the framed convention still refuses, each at its smallest scale.
 *
 * Every shipped contract whose cold compile publishes a refusal publishes one of these, so a source that keeps a
 * refusal here is a shape a whole set of entries stops on. Each case sits beside the boundary the same mechanism
 * serves, so it pins where the refusal begins rather than that some refusal exists.
 *
 * Each source is compiled through the shipped entry point with the framed convention and the refusal is read
 * back from the artifact's composition metadata; a source the convention serves has none to read.
 *
 * The dynamic-array key is a wall rather than a gate: the derivation emits its keys where the body begins, and the
 * emitter answers an element read of a chunk-backed dynamic array there with a shape that does not leave one key
 * value (`FRAMED_CODEGEN_UNAVAILABLE`), even when the body never writes the array. Admitting the read without
 * moving the derivation only turns the clean refusal into that codegen failure.
 */

/** The reason a derived write key that reads an element of a dynamic state array is refused. */
const DYNAMIC_ARRAY_KEY_REASON = 'the body writes a mapping at slot 0 whose key 1 '
  + "'field:amount(arridx(state:entries,id:id))' reads an element of the dynamic state array 'entries', and a "
  + 'master derives a target slot only from a bare parameter, the frame\'s sender, a value of its own record, or a '
  + 'compile-time value the body holds at its start';

/** The reason a verified-mapping write behind a call the source does not fix is refused. */
const WRITE_BEHIND_CALL_REASON = 'the body writes a verified mapping behind a call whose occurrence the source '
  + 'does not fix, and the derived operands cannot follow the segment the write lands in';

const CALL = 'IOther(0x1111111111111111111111111111111111111111).ping.call();';
const CALL_CONTRACT = ' interface IOther { function ping(); }'
  + ' contract Other { function ping() { require(true); } }';

describe('a derived write key that reads an element of a dynamic state array', () => {
  it('refuses the body whose key reads the element through the array cache local', () => {
    // The push makes the compiler cache the array in a local the body defines in its own prologue, and the
    // derivation is emitted before that prologue, so the element is not a value the master holds where it hashes.
    const source = 'pragma solidcash ^0.14.0;'
      + ' contract Ledger {'
      + '   struct Entry { uint amount; }'
      + '   Entry[] entries;'
      + '   mapping(uint => mapping(uint => bool)) flags;'
      + '   function mark(uint id) {'
      + '     for (int i = 0; i < 2; i = i + 1) { entries.push(); }'
      + '     flags[id][entries[id].amount] = true;'
      + '   }'
      + ' }';
    expect(refusalMessageOf(source)).toBe(`Ledger.mark(): ${DYNAMIC_ARRAY_KEY_REASON}`);
  });

  it('serves the same write when the key is a bare parameter', () => {
    // The boundary: the mapping write beside the same array is served, so the refusal begins at the element read the
    // key performs rather than at the write or the array.
    const source = 'pragma solidcash ^0.14.0;'
      + ' contract Ledger {'
      + '   struct Entry { uint amount; }'
      + '   Entry[] entries;'
      + '   mapping(uint => mapping(uint => bool)) flags;'
      + '   function mark(uint id, uint amount) {'
      + '     for (int i = 0; i < 2; i = i + 1) { entries.push(); }'
      + '     flags[id][amount] = true;'
      + '     require(true);'
      + '   }'
      + ' }';
    expect(refusalMessageOf(source)).toBe('');
  });
});

describe('a verified-mapping write whose segment a call the source does not fix decides', () => {
  it('serves the write a branch of calls precedes, reading the segment the declared count names', () => {
    // One arm calls, so the write lands in segment 0 or 1 depending on the arm. No call follows it, so the write
    // lands in the last segment the run opens, whose index is the call count the block itself declares.
    const source = `pragma solidcash ^0.14.0;${CALL_CONTRACT}`
      + ' contract Ledger {'
      + '   mapping(address => uint) balances;'
      + '   function move(bool go, address to, uint amount) {'
      + `     if (go) { ${CALL} }`
      + '     balances[to] = amount;'
      + '   }'
      + ' }';
    expect(refusalMessageOf(source)).toBe('');
  });

  it('serves the write a loop of calls precedes, whose segment the declared count also names', () => {
    const source = `pragma solidcash ^0.14.0;${CALL_CONTRACT}`
      + ' contract Ledger {'
      + '   mapping(address => uint) balances;'
      + '   function move(int turns, address to, uint amount) {'
      + `     for (int i = 0; i < turns; i = i + 1) { ${CALL} }`
      + '     balances[to] = amount;'
      + '   }'
      + ' }';
    expect(refusalMessageOf(source)).toBe('');
  });

  it('refuses the write a call follows, because the declared count no longer names its segment', () => {
    // The run's declared call count includes the call after the write, so the write lands in an earlier segment than
    // that count names: the derivation cannot locate it and the entry stays refused.
    const source = `pragma solidcash ^0.14.0;${CALL_CONTRACT}`
      + ' contract Ledger {'
      + '   mapping(address => uint) balances;'
      + '   function move(bool go, address to, uint amount) {'
      + `     if (go) { ${CALL} }`
      + '     balances[to] = amount;'
      + `     ${CALL}`
      + '   }'
      + ' }';
    expect(refusalMessageOf(source)).toBe(`Ledger.move(): ${WRITE_BEHIND_CALL_REASON}`);
  });

  // A branch whose arms make the same number of calls is served and settled in `write-after-call.test.ts`.
  it('serves the write when no call sits beside it', () => {
    // The boundary: the write's own segment is the frame's first, which the derivation reads without a skip.
    const source = 'pragma solidcash ^0.14.0;'
      + ' contract Ledger {'
      + '   mapping(address => uint) balances;'
      + '   function move(address to, uint amount) { balances[to] = amount; require(true); }'
      + ' }';
    expect(refusalMessageOf(source)).toBe('');
  });
});
