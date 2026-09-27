import { describe, expect, it } from 'vitest';
import { compileString } from '../../../src/compiler.js';

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

/** A composite return: the encoding is not a blob the entry's own code compares against `retval`. */
const COMPOSITE_RETURN_CONTRACT = 'pragma solidcash ^0.13.0;'
  + ' contract Holder {'
  + '   struct Point { int x; int y; }'
  + '   function point() returns (Point) { return Point(1, 2); }'
  + ' }';

/** An entry that emits one event: the head checks the event list, whose count the entry fixes. */
const EVENT_CONTRACT = 'pragma solidcash ^0.13.0;'
  + ' contract Pinged {'
  + '   event Ping(int indexed x);'
  + '   function ping() { emit Ping(1); }'
  + ' }';

/** An entry whose event count is the loop's trip count, which the head cannot fix. */
const LOOP_EVENT_CONTRACT = 'pragma solidcash ^0.13.0;'
  + ' contract Repeated {'
  + '   event Ping(int indexed x);'
  + '   function ping(int n) { for (int i = 0; i < n; i = i + 1) { emit Ping(i); } }'
  + ' }';

/** An entry that sends value: whether the send is a listed send depends on the recipient's lock type. */
const SEND_CONTRACT = 'pragma solidcash ^0.13.0;'
  + ' contract Payer {'
  + '   function pay(address to) { this.transfer(to, 1000); }'
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
  + `   function b() { ICallee(0x${'11'.repeat(35)}).ping.call(); ICallee(0x${'22'.repeat(35)}).ping.call(); }`
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
    const code = codeOf(() => compileString(COMPOSITE_RETURN_CONTRACT, { composition: 'per-call' }));
    expect(code).toBe('PER_CALL_CODEGEN_UNAVAILABLE');
  });

  it('names the shape that was refused', () => {
    expect(messageOf(() => compileString(COMPOSITE_RETURN_CONTRACT, { composition: 'per-call' })))
      .toContain('retval');
  });

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
    expect(codeOf(() => compileString(LOOP_EVENT_CONTRACT, { composition: 'per-call' })))
      .toBe('PER_CALL_CODEGEN_UNAVAILABLE');
    expect(messageOf(() => compileString(LOOP_EVENT_CONTRACT, { composition: 'per-call' })))
      .toContain('loop');
  });

  it('refuses a value send, whose list membership the recipient lock type decides, by name', () => {
    expect(codeOf(() => compileString(SEND_CONTRACT, { composition: 'per-call' })))
      .toBe('PER_CALL_CODEGEN_UNAVAILABLE');
    expect(messageOf(() => compileString(SEND_CONTRACT, { composition: 'per-call' })))
      .toContain('recipient');
  });
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

  it('refuses entries that make different numbers of calls, by name', () => {
    expect(codeOf(() => compileString(DIFFERENT_CALL_COUNTS_PER_ENTRY_CONTRACT, { composition: 'per-call' })))
      .toBe('PER_CALL_CODEGEN_UNAVAILABLE');
    expect(messageOf(() => compileString(DIFFERENT_CALL_COUNTS_PER_ENTRY_CONTRACT, { composition: 'per-call' })))
      .toContain('different numbers of external calls');
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
