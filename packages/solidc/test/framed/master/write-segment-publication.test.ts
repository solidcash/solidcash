import { describe, expect, it } from 'vitest';
import { asmToScript, scriptToBytecode, type Artifact } from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';
import {
  declaredSegmentsSkipRuntimeScript, declaredSegmentsSkipScript,
} from '../../../src/framed/master/declared-view.js';

/**
 * The segment a framed entry's derived mapping write lands in, as the artifact publishes it.
 *
 * A builder declares the write's records in one segment of the frame's many, and the segment the entry's own source
 * fixes is the one code generation reads its records from. The artifact publishes that fact beside the entry's stop
 * sites, so the published value and the emitted derivation have to agree: a fixed index is a compile-time skip, and
 * `'last'` is the segment the run's own declared call count names.
 */

/** The identity the published table keys an entry on. */
const entryIdentity = (contractName: string, entryName: string): string => `${contractName}.${entryName}()`;

/** The segment the artifact publishes for one entry, reading the table the way a builder does. */
function publishedWriteSegment(
  artifact: Pick<Artifact, 'composition'>, contractName: string, entryName: string,
): number | 'last' | undefined {
  return artifact.composition?.stopSites?.entries
    .find((entry) => entry.functionName === entryIdentity(contractName, entryName))?.writeSegment;
}

/** The emitted program of an artifact, so a derivation recipe can be found in the bytes code generation produced. */
function emittedProgram(artifact: { readonly bytecode: string }): string {
  return Buffer.from(scriptToBytecode(asmToScript(artifact.bytecode))).toString('hex');
}

const PING = 'interface IOther { function ping(); }'
  + ' contract Other { function ping() { require(true); } }';
const OTHER = '0x' + '11'.repeat(31) + 'ee';

/** The write precedes the entry's only call, so it lands in the segment the frame opens with. */
const WRITE_FIRST_SOURCE = `pragma solidcash ^0.14.0;${PING}`
  + ' contract Ledger {'
  + '   uint public count;'
  + '   mapping(address => uint) balances;'
  + '   function move(address to, uint amount) {'
  + '     balances[to] = amount;'
  + `     IOther(${OTHER}).ping.call();`
  + '     require(true);'
  + '   }'
  + ' }';

/** The write follows an unconditional call, so it lands in the second segment the run opens. */
const WRITE_AFTER_ONE_CALL_SOURCE = `pragma solidcash ^0.14.0;${PING}`
  + ' contract Ledger {'
  + '   uint public count;'
  + '   mapping(address => uint) balances;'
  + '   function move(address to, uint amount) {'
  + `     IOther(${OTHER}).ping.call();`
  + '     balances[to] = amount;'
  + '     require(true);'
  + '   }'
  + ' }';

/** A call the source does not fix precedes the write, so no segment index names it and every call precedes it. */
const WRITE_AFTER_GUARDED_CALL_SOURCE = `pragma solidcash ^0.14.0;${PING}`
  + ' contract Ledger {'
  + '   uint public count;'
  + '   mapping(address => uint) balances;'
  + '   function move(bool go, address to, uint amount) {'
  + `     if (go) { IOther(${OTHER}).ping.call(); }`
  + '     balances[to] = amount;'
  + '     require(true);'
  + '   }'
  + ' }';

/** The same three positions for a write that lands on the entry's own record rather than a mapping node. */
const RECORD_WRITE_FIRST_SOURCE = `pragma solidcash ^0.14.0;${PING}`
  + ' contract Ledger {'
  + '   uint public count;'
  + '   function bump() {'
  + '     this.count = this.count + 1;'
  + `     IOther(${OTHER}).ping.call();`
  + '     require(true);'
  + '   }'
  + ' }';

const RECORD_WRITE_AFTER_ONE_CALL_SOURCE = `pragma solidcash ^0.14.0;${PING}`
  + ' contract Ledger {'
  + '   uint public count;'
  + '   function bump() {'
  + `     IOther(${OTHER}).ping.call();`
  + '     this.count = this.count + 1;'
  + '     require(true);'
  + '   }'
  + ' }';

const RECORD_WRITE_AFTER_GUARDED_CALL_SOURCE = `pragma solidcash ^0.14.0;${PING}`
  + ' contract Ledger {'
  + '   uint public count;'
  + '   function bump(bool go) {'
  + `     if (go) { IOther(${OTHER}).ping.call(); }`
  + '     this.count = this.count + 1;'
  + '     require(true);'
  + '   }'
  + ' }';

/**
 * A write to a field the record only sizes: the bytes live in a chunk run the epilogue pins, so the record is
 * declared written in the run's last segment wherever the source makes the write relative to the calls.
 */
const SIZED_FIELD_BEFORE_CALL_SOURCE = `pragma solidcash ^0.14.0;${PING}`
  + ' contract Ledger {'
  + '   string[] public names;'
  + '   function push() {'
  + '     this.names.push("hi");'
  + `     IOther(${OTHER}).ping.call();`
  + '     require(true);'
  + '   }'
  + ' }';

const SIZED_FIELD_AFTER_CALL_SOURCE = `pragma solidcash ^0.14.0;${PING}`
  + ' contract Ledger {'
  + '   string[] public names;'
  + '   function push() {'
  + `     IOther(${OTHER}).ping.call();`
  + '     this.names.push("hi");'
  + '     require(true);'
  + '   }'
  + ' }';

// Optimisation is off so the emitted bytes carry the derivation's own skip recipe verbatim: the optimiser
// rewrites equivalent sequences, which would hide the recipe this case matches the published fact against.
const writeFirst = compileStringMulti(WRITE_FIRST_SOURCE, { composition: 'framed', optimise: false }).Ledger!;
const writeAfterOneCall =
  compileStringMulti(WRITE_AFTER_ONE_CALL_SOURCE, { composition: 'framed', optimise: false }).Ledger!;
const writeAfterGuardedCall =
  compileStringMulti(WRITE_AFTER_GUARDED_CALL_SOURCE, { composition: 'framed', optimise: false }).Ledger!;
const recordWriteFirst =
  compileStringMulti(RECORD_WRITE_FIRST_SOURCE, { composition: 'framed', optimise: false }).Ledger!;
const recordWriteAfterOneCall =
  compileStringMulti(RECORD_WRITE_AFTER_ONE_CALL_SOURCE, { composition: 'framed', optimise: false }).Ledger!;
const recordWriteAfterGuardedCall =
  compileStringMulti(RECORD_WRITE_AFTER_GUARDED_CALL_SOURCE, { composition: 'framed', optimise: false }).Ledger!;
const sizedFieldBeforeCall =
  compileStringMulti(SIZED_FIELD_BEFORE_CALL_SOURCE, { composition: 'framed', optimise: false }).Ledger!;
const sizedFieldAfterCall =
  compileStringMulti(SIZED_FIELD_AFTER_CALL_SOURCE, { composition: 'framed', optimise: false }).Ledger!;

const RUNTIME_SKIP = Buffer.from(declaredSegmentsSkipRuntimeScript()).toString('hex');
const SKIP_ONE = Buffer.from(declaredSegmentsSkipScript(1)).toString('hex');

describe('the segment a derived mapping write lands in, as an artifact publishes it', () => {
  it('publishes the frame\'s opening segment for a write that precedes the entry\'s calls', () => {
    expect(publishedWriteSegment(writeFirst, 'Ledger', 'move')).toBe(0);
  });

  it('publishes the fixed index a call precedes the write in', () => {
    expect(publishedWriteSegment(writeAfterOneCall, 'Ledger', 'move')).toBe(1);
    // The emitted derivation steps over the one segment that call opened, a compile-time skip.
    expect(emittedProgram(writeAfterOneCall)).toContain(SKIP_ONE);
  });

  it('publishes the run\'s last segment for a write every call precedes', () => {
    expect(publishedWriteSegment(writeAfterGuardedCall, 'Ledger', 'move')).toBe('last');
    // The emitted derivation steps over the number of segments the witness block itself declares.
    expect(emittedProgram(writeAfterGuardedCall)).toContain(RUNTIME_SKIP);
  });
});

describe('the segment a write to the entry\'s own record lands in, as an artifact publishes it', () => {
  it('publishes the frame\'s opening segment for a record write that precedes the entry\'s calls', () => {
    expect(publishedWriteSegment(recordWriteFirst, 'Ledger', 'bump')).toBe(0);
  });

  it('publishes the fixed index a call precedes the record write in', () => {
    expect(publishedWriteSegment(recordWriteAfterOneCall, 'Ledger', 'bump')).toBe(1);
    // The record is rebuilt and compared against the declaration of the segment its write landed in.
    expect(emittedProgram(recordWriteAfterOneCall)).toContain(SKIP_ONE);
  });

  it('publishes the run\'s last segment for a record write every call precedes', () => {
    expect(publishedWriteSegment(recordWriteAfterGuardedCall, 'Ledger', 'bump')).toBe('last');
    expect(emittedProgram(recordWriteAfterGuardedCall)).toContain(RUNTIME_SKIP);
  });
});

describe('the segment a write to a field the record only sizes lands in, as an artifact publishes it', () => {
  it('publishes the run\'s last segment whether the write precedes the entry\'s call or follows it', () => {
    // The record carries the value's length and the bytes live in the run the epilogue pins, so the record is
    // declared written where that run is: the source position of the write does not name its segment.
    expect(publishedWriteSegment(sizedFieldBeforeCall, 'Ledger', 'push')).toBe('last');
    expect(publishedWriteSegment(sizedFieldAfterCall, 'Ledger', 'push')).toBe('last');
  });
});
