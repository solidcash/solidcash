import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

const byteLength = (artifact: ReturnType<typeof compileString>): number =>
  artifact.debug!.bytecode.length / 2;

const opcodeCount = (artifact: ReturnType<typeof compileString>): number =>
  (artifact.bytecode.match(/\bOP_[A-Z0-9_]+\b/g) ?? []).length;

const CALLEE = `pragma solidcash >=0.8.0;
interface IB { function ping(); }
contract B() is IB {
  int x;
  function ping() public { this.x = this.x + 1; require(true); }
}`;

const caller = (rows: number): string => `pragma solidcash >=0.8.0;
interface IB { function ping(); }
contract A(bytes target) {
  int x;
  function run() public {
    ${Array.from({ length: rows }, () => 'IB(target).ping();').join('\n')}
    this.x = this.x + 1;
    require(true);
  }
}`;

describe('Release 0 SCB1 compiler cost regression', () => {
  it('pins the B parser/dispatcher covenant footprint', () => {
    const direct = compileString(CALLEE, { forceStateful: true });
    const batch = compileString(CALLEE, {
      forceStateful: true,
      experimentalHiddenBatch: true,
    });

    expect({
      directBytes: byteLength(direct),
      batchBytes: byteLength(batch),
      covenantDeltaBytes: byteLength(batch) - byteLength(direct),
      expandedOpcodes: opcodeCount(batch),
      routeBodyBytes: batch.functionBodies?.['53434231']!.length / 2,
    }).toEqual({
      directBytes: 369,
      batchBytes: 1217,
      covenantDeltaBytes: 848,
      expandedOpcodes: 18,
      routeBodyBytes: 760,
    });
  });

  it.each([
    [2, 407, 515, 108, 428],
    [3, 426, 539, 113, 441],
    [8, 518, 659, 141, 506],
  ])(
    'pins A comparator growth for %i zero-argument rows',
    (rows, directBytes, batchBytes, covenantDeltaBytes, expandedOpcodes) => {
      const direct = compileString(caller(rows), { forceStateful: true });
      const batch = compileString(caller(rows), {
        forceStateful: true,
        experimentalRepeatedExternalBatch: true,
      });

      expect({
        directBytes: byteLength(direct),
        batchBytes: byteLength(batch),
        covenantDeltaBytes: byteLength(batch) - byteLength(direct),
        expandedOpcodes: opcodeCount(batch),
      }).toEqual({ directBytes, batchBytes, covenantDeltaBytes, expandedOpcodes });
    },
  );
});
