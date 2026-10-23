import { describe, expect, it } from 'vitest';
import { compileString } from '../../../src/compiler.js';
import { refusalMessageOf, refusalOf } from './refused-entry.js';

const STATE_CONTRACT = 'pragma solidcash ^0.14.0;'
  + ' contract Counter(pubkey admin) {'
  + '   int public counter;'
  + '   function increment(sig s) {'
  + '     require(checkSig(s, admin));'
  + '     this.counter = this.counter + 1;'
  + '   }'
  + ' }';

/** A composite return: a function pointer is a pair, not one value the frame compares against `retval`. */
const COMPOSITE_RETURN_CONTRACT = 'pragma solidcash ^0.14.0;'
  + ' contract Holder {'
  + '   function point() returns (function(int) external returns (int)) { revert("no"); }'
  + ' }';

/** An entry that emits one event: the head checks the event list, whose count the entry fixes. */
const EVENT_CONTRACT = 'pragma solidcash ^0.14.0;'
  + ' contract Pinged {'
  + '   event Ping(int indexed x);'
  + '   function ping() { emit Ping(1); }'
  + ' }';

/** An entry whose event count is the loop's trip count, which the head checks as a run the block declares. */
const LOOP_EVENT_CONTRACT = 'pragma solidcash ^0.14.0;'
  + ' contract Repeated {'
  + '   event Ping(int indexed x);'
  + '   function ping(int n) { for (int i = 0; i < n; i = i + 1) { emit Ping(i); } }'
  + ' }';

/** An entry that emits on a branch beside a loop's emits, so the outputs it lists depend on the branch. */
const BRANCHED_LOOP_EVENT_CONTRACT = 'pragma solidcash ^0.14.0;'
  + ' contract Repeated {'
  + '   event Ping(int indexed x);'
  + '   function ping(int n) {'
  + '     if (n > 2) { emit Ping(n); }'
  + '     for (int i = 0; i < n; i = i + 1) { emit Ping(i); }'
  + '   }'
  + ' }';

/** Dynamic state stores its bytes in a run of chunk NFTs whose base a framed frame cannot name. */
const DYNAMIC_READ_CONTRACT = 'pragma solidcash ^0.14.0;'
  + ' contract Named {'
  + '   string name;'
  + '   function getName() returns (string) { return this.name; }'
  + ' }';

const DYNAMIC_WRITE_CONTRACT = 'pragma solidcash ^0.14.0;'
  + ' contract Named {'
  + '   string name;'
  + '   function setName(string value) { this.name = value; }'
  + ' }';

const DYNAMIC_CONSTRUCTOR_CONTRACT = 'pragma solidcash ^0.14.0;'
  + ' contract Named {'
  + '   string name;'
  + '   constructor(string initial) { this.name = initial; }'
  + '   function getName() returns (string) { return this.name; }'
  + ' }';

const codeOf = (run: () => unknown): string | undefined => {
  try {
    run();
    return undefined;
  } catch (error) {
    return (error as { code?: string }).code;
  }
};

const messageOf = (run: () => unknown): string => {
  try {
    run();
    return '';
  } catch (error) {
    return (error as Error).message;
  }
};

describe('composition convention selection', () => {
  it('compiles the direct convention when none is requested', () => {
    expect(() => compileString(STATE_CONTRACT)).not.toThrow();
  });

  it('compiles the direct convention when it is requested explicitly, to the same bytecode', () => {
    const implicit = compileString(STATE_CONTRACT);
    const explicit = compileString(STATE_CONTRACT, { composition: 'direct' });
    expect(explicit.bytecode).toBe(implicit.bytecode);
  });

  it('compiles the framed convention to a master, not to the direct script', () => {
    const direct = compileString(STATE_CONTRACT, { composition: 'direct' });
    const framed = compileString(STATE_CONTRACT, { composition: 'framed' });
    expect(framed.composition?.convention).toBe('framed');
    expect(framed.bytecode).not.toBe(direct.bytecode);
  });

  // The framed refusal of this shape is asserted in `composite-return.test.ts`.
  it('still compiles a refused shape under the direct convention', () => {
    expect(() => compileString(COMPOSITE_RETURN_CONTRACT)).not.toThrow();
  });

  it('refuses an unknown convention by name instead of falling back', () => {
    const code = codeOf(() => compileString(STATE_CONTRACT, { composition: 'unknown-convention' as 'framed' }));
    expect(code).toBe('FRAMED_CODEGEN_UNAVAILABLE');
  });

  it('refuses the old per-call spelling of the framed convention', () => {
    // The rename is complete: the previous name is an unknown convention, not a silent alias, and the refusal
    // names both the offending value and the conventions this compiler accepts.
    const code = codeOf(() => compileString(STATE_CONTRACT, { composition: 'per-call' as 'framed' }));
    expect(code).toBe('FRAMED_CODEGEN_UNAVAILABLE');
    const message = messageOf(() => compileString(STATE_CONTRACT, { composition: 'per-call' as 'framed' }));
    expect(message).toContain('per-call');
    expect(message).toContain('framed');
  });

  it('names the offending value when a convention is unknown', () => {
    const message = messageOf(() => compileString(STATE_CONTRACT, { composition: 'nope' as 'framed' }));
    expect(message).toContain('nope');
    expect(message).toContain('direct');
  });
});

describe('the tail sections a compiled master fixes', () => {
  it('compiles an entry that emits a fixed number of events', () => {
    const artifact = compileString(EVENT_CONTRACT, { composition: 'framed' });
    expect(artifact.composition?.convention).toBe('framed');
  });

  it('serves an entry whose event count is a loop trip count, publishing the run its turns emit', () => {
    // The head checks the listed outputs as one run, and a builder lists one per turn the recurrence counts.
    const artifact = compileString(LOOP_EVENT_CONTRACT, { composition: 'framed' });
    expect(refusalMessageOf(LOOP_EVENT_CONTRACT)).toBe('');
    const entry = artifact.composition?.stopSites?.entries.find((row) => row.functionName === 'Repeated.ping()');
    expect(entry?.loopEffects?.events?.map((run) => [run.ids, run.iterationDomain?.counterName]))
      .toStrictEqual([[[0], 'i']]);
  });

  it('refuses an entry that also emits on a branch beside the loop, by name', () => {
    // The entry is refused on its own and published with the reason; the contract's other bodies still compile.
    expect(refusalOf(BRANCHED_LOOP_EVENT_CONTRACT).code).toBe('FRAMED_CODEGEN_UNAVAILABLE');
    expect(refusalMessageOf(BRANCHED_LOOP_EVENT_CONTRACT)).toContain('an event emitted on a branch beside one in a '
      + 'loop, so a builder cannot count the event outputs the body binds in turn');
  });

  // A value send is served: the body pins the lock it computed at the listed output. Its machine cases are in
  // `master/send-output.test.ts`, and the served spelling is asserted in
  // `solidcash/test/framed/edges/refused-contract-shapes.test.ts`.
});

describe('dynamic state a framed frame locates', () => {
  it('admits an entry that reads a dynamic state variable', () => {
    // A dynamic value lives in a run of chunk NFTs. The direct convention's SDK computes the run's first
    // coordinate from the entry's block layout and passes it as an argument; a framed master derives the same
    // coordinate from the frame's declared record block and the layout's own width, so the entry compiles.
    expect(() => compileString(DYNAMIC_READ_CONTRACT, { composition: 'framed' })).not.toThrow();
  });

  it('admits an entry that writes a dynamic state variable', () => {
    expect(() => compileString(DYNAMIC_WRITE_CONTRACT, { composition: 'framed' })).not.toThrow();
  });

  it('admits a constructor that stores a dynamic argument', () => {
    expect(() => compileString(DYNAMIC_CONSTRUCTOR_CONTRACT, { composition: 'framed' })).not.toThrow();
  });

  it('compiles each of those shapes under the direct convention too', () => {
    for (const source of [DYNAMIC_READ_CONTRACT, DYNAMIC_WRITE_CONTRACT, DYNAMIC_CONSTRUCTOR_CONTRACT]) {
      expect(() => compileString(source)).not.toThrow();
    }
  });
});
