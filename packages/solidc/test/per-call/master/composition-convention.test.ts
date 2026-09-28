import { describe, expect, it } from 'vitest';
import { compileString, compileStringMulti } from '../../../src/compiler.js';
import { refusalMessageOf, refusalOf } from './refused-entry.js';

const STATE_CONTRACT = 'pragma solidcash ^0.13.0;'
  + ' contract Counter(pubkey admin) {'
  + '   int public counter;'
  + '   function increment(sig s) {'
  + '     require(checkSig(s, admin));'
  + '     this.counter = this.counter + 1;'
  + '   }'
  + ' }';

/** Two entry points: one master head, and the dispatcher picks the entry the unlocking selector names. */
const TWO_ENTRY_CONTRACT = 'pragma solidcash ^0.13.0;'
  + ' contract TwoEntry {'
  + '   int public counter;'
  + '   function inc() { this.counter = this.counter + 1; }'
  + '   function dec() { this.counter = this.counter - 1; }'
  + ' }';

/** A returning entry point: one scalar value, settled against the frame's witness `retval`. */
const RETURNING_CONTRACT = 'pragma solidcash ^0.13.0;'
  + ' contract Answer {'
  + '   function answer() returns (int) { return 42; }'
  + ' }';

/** A composite return: a function pointer is a pair, not one value the frame compares against `retval`. */
const COMPOSITE_RETURN_CONTRACT = 'pragma solidcash ^0.13.0;'
  + ' contract Holder {'
  + '   function point() returns (function(int) external returns (int)) { revert("no"); }'
  + ' }';

/** An entry that emits one event: the head checks the event list, whose count the entry fixes. */
const EVENT_CONTRACT = 'pragma solidcash ^0.13.0;'
  + ' contract Pinged {'
  + '   event Ping(int indexed x);'
  + '   function ping() { emit Ping(1); }'
  + ' }';

/** A contract with no event and no state of its own, for units that hold an emitting contract beside it. */
const QUIET_SIBLING = ' contract Quiet {'
  + '   function idle() { require(true); }'
  + ' }';

/** An entry whose event count is the loop's trip count, which the head cannot fix. */
const LOOP_EVENT_CONTRACT = 'pragma solidcash ^0.13.0;'
  + ' contract Repeated {'
  + '   event Ping(int indexed x);'
  + '   function ping(int n) { for (int i = 0; i < n; i = i + 1) { emit Ping(i); } }'
  + ' }';

/** One entry that makes two calls: the tail's count is fixed at two, one record per call in execution order. */
const TWO_CALLS_IN_ONE_ENTRY_CONTRACT = 'pragma solidcash ^0.13.0;'
  + ' interface ICallee { function ping(); function pong(); }'
  + ' contract Caller {'
  + `   function callIt() { ICallee(0x${'11'.repeat(35)}).ping.call(); ICallee(0x${'22'.repeat(35)}).pong.call(); }`
  + ' }';

/** One entry that makes two calls through a single-method interface, so no selector operand is involved. */
const TWO_CALLS_SINGLE_METHOD_CONTRACT = 'pragma solidcash ^0.13.0;'
  + ' interface ICallee { function ping(); }'
  + ' contract Caller {'
  + `   function callIt() { ICallee(0x${'11'.repeat(35)}).ping.call(); ICallee(0x${'22'.repeat(35)}).ping.call(); }`
  + ' }';

/** Entries that make different calls but the same number: one head fixes the count, each site binds its record. */
const DIFFERENT_CALLS_PER_ENTRY_CONTRACT = 'pragma solidcash ^0.13.0;'
  + ' interface ICallee { function ping(); function pong(); }'
  + ' contract Caller {'
  + `   function a() { ICallee(0x${'11'.repeat(35)}).ping.call(); }`
  + `   function b() { ICallee(0x${'22'.repeat(35)}).pong.call(); }`
  + ' }';

/** Entries that make different numbers of calls, which one fixed tail count cannot describe. */
const DIFFERENT_CALL_COUNTS_PER_ENTRY_CONTRACT = 'pragma solidcash ^0.13.0;'
  + ' interface ICallee { function ping(); }'
  + ' contract Caller {'
  + `   function a() { ICallee(0x${'11'.repeat(35)}).ping.call(); }`
  + '   function b() { require(true); }'
  + ' }';

/** Dynamic state stores its bytes in a run of chunk NFTs whose base a per-call frame cannot name. */
const DYNAMIC_READ_CONTRACT = 'pragma solidcash ^0.13.0;'
  + ' contract Named {'
  + '   string name;'
  + '   function getName() returns (string) { return this.name; }'
  + ' }';

const DYNAMIC_WRITE_CONTRACT = 'pragma solidcash ^0.13.0;'
  + ' contract Named {'
  + '   string name;'
  + '   function setName(string value) { this.name = value; }'
  + ' }';

const DYNAMIC_CONSTRUCTOR_CONTRACT = 'pragma solidcash ^0.13.0;'
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

  it('compiles the per-call convention to a master, not to the direct script', () => {
    const direct = compileString(STATE_CONTRACT, { composition: 'direct' });
    const perCall = compileString(STATE_CONTRACT, { composition: 'per-call' });
    expect(perCall.composition?.convention).toBe('per-call');
    expect(perCall.bytecode).not.toBe(direct.bytecode);
  });

  it('compiles a contract with several entry points to one master, dispatched by selector', () => {
    const artifact = compileString(TWO_ENTRY_CONTRACT, { composition: 'per-call' });
    expect(artifact.composition?.convention).toBe('per-call');
    expect(artifact.abi.map((entry) => entry.name).sort()).toEqual(['dec', 'inc']);
  });

  it('compiles an entry point that returns one scalar value', () => {
    const artifact = compileString(RETURNING_CONTRACT, { composition: 'per-call' });
    expect(artifact.composition?.convention).toBe('per-call');
  });

  it('refuses a composite return shape a master cannot emit for, by name', () => {
    // The contract compiles and the body that returns a composite shape is refused by name, which is what a builder
    // reports instead of the whole unit failing.
    const refusal = refusalOf(COMPOSITE_RETURN_CONTRACT);
    expect(refusal.code).toBe('PER_CALL_CODEGEN_UNAVAILABLE');
  });

  // The refusal's message for this source is asserted in `return-value.test.ts`.
  it('still compiles a refused shape under the direct convention', () => {
    expect(() => compileString(COMPOSITE_RETURN_CONTRACT)).not.toThrow();
  });

  it('refuses an unknown convention by name instead of falling back', () => {
    const code = codeOf(() => compileString(STATE_CONTRACT, { composition: 'percall' as 'per-call' }));
    expect(code).toBe('PER_CALL_CODEGEN_UNAVAILABLE');
  });

  it('names the offending value when a convention is unknown', () => {
    const message = messageOf(() => compileString(STATE_CONTRACT, { composition: 'nope' as 'per-call' }));
    expect(message).toContain('nope');
    expect(message).toContain('direct');
  });
});

describe('the tail sections a compiled master fixes', () => {
  it('compiles an entry that emits a fixed number of events', () => {
    const artifact = compileString(EVENT_CONTRACT, { composition: 'per-call' });
    expect(artifact.composition?.convention).toBe('per-call');
  });

  it('refuses an entry whose event count is a loop trip count, by name', () => {
    // The entry is refused on its own and published with the reason; the contract's other bodies still compile.
    expect(refusalOf(LOOP_EVENT_CONTRACT).code).toBe('PER_CALL_CODEGEN_UNAVAILABLE');
    expect(refusalMessageOf(LOOP_EVENT_CONTRACT)).toContain('loop');
  });

  it('sizes a contract\'s event region by its own bodies, not a sibling\'s emits', () => {
    // The same unit holds one contract that emits and one that does not. A master's event region is fixed by the
    // bodies it runs, so the quiet contract is emitted beside the emitting one rather than refused for an emit
    // that is not its own.
    const artifacts = compileStringMulti(EVENT_CONTRACT + QUIET_SIBLING, { composition: 'per-call' });
    expect(artifacts.Pinged?.composition?.convention).toBe('per-call');
    expect(artifacts.Quiet?.composition?.convention).toBe('per-call');
  });
  // A value send is served: the body pins the lock it computed at the listed output. Its machine cases are in
  // `master/send-output.test.ts`, and the served spelling is asserted in
  // `solidcash/test/per-call/edges/refused-contract-shapes.test.ts`.
});

describe('the call set a compiled master fixes', () => {
  it('compiles an entry that makes two calls, through one interface with two methods', () => {
    const artifact = compileString(TWO_CALLS_IN_ONE_ENTRY_CONTRACT, { composition: 'per-call' });
    expect(artifact.composition?.convention).toBe('per-call');
  });

  it('compiles an entry that makes two calls through a single-method interface', () => {
    const artifact = compileString(TWO_CALLS_SINGLE_METHOD_CONTRACT, { composition: 'per-call' });
    expect(artifact.composition?.convention).toBe('per-call');
  });

  it('compiles entries that make different calls but the same number of them', () => {
    // The head fixes one count and walks one record per call; each site binds its own entry's record in the body,
    // so two entries may call different methods at different targets.
    const artifact = compileString(DIFFERENT_CALLS_PER_ENTRY_CONTRACT, { composition: 'per-call' });
    expect(artifact.composition?.convention).toBe('per-call');
    expect(artifact.abi.map((entry) => entry.name).sort()).toEqual(['a', 'b']);
  });

  it('admits one entry that calls beside one that makes no call, since each body pins its own count', () => {
    // The walk reads the count the block declares and the body that runs holds the block to its own, so one head
    // can serve a contract entered twice: once as a caller and once as a plain state write.
    const artifact = compileString(DIFFERENT_CALL_COUNTS_PER_ENTRY_CONTRACT, { composition: 'per-call' });
    expect(artifact.composition?.convention).toBe('per-call');
    expect(artifact.abi.map((entry) => entry.name).sort()).toEqual(['a', 'b']);
  });
});

describe('dynamic state a per-call frame locates', () => {
  it('admits an entry that reads a dynamic state variable', () => {
    // A dynamic value lives in a run of chunk NFTs. The direct convention's SDK computes the run's first
    // coordinate from the entry's block layout and passes it as an argument; a per-call master derives the same
    // coordinate from the frame's declared record block and the layout's own width, so the entry compiles.
    expect(() => compileString(DYNAMIC_READ_CONTRACT, { composition: 'per-call' })).not.toThrow();
  });

  it('admits an entry that writes a dynamic state variable', () => {
    expect(() => compileString(DYNAMIC_WRITE_CONTRACT, { composition: 'per-call' })).not.toThrow();
  });

  it('admits a constructor that stores a dynamic argument', () => {
    expect(() => compileString(DYNAMIC_CONSTRUCTOR_CONTRACT, { composition: 'per-call' })).not.toThrow();
  });

  it('compiles each of those shapes under the direct convention too', () => {
    for (const source of [DYNAMIC_READ_CONTRACT, DYNAMIC_WRITE_CONTRACT, DYNAMIC_CONSTRUCTOR_CONTRACT]) {
      expect(() => compileString(source)).not.toThrow();
    }
  });
});
