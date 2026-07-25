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

const ERC20_CALLEE = `pragma solidcash >=0.8.0;
contract Token() {
  mapping(bytes20 => bigint) balances;
  mapping(bytes20 => mapping(bytes20 => bigint)) allowances;
  function transferFrom(bytes20 from, bytes20 to, bytes20 spender, bigint amount) public {
    require(this.allowances[from][spender] >= amount);
    require(this.balances[from] >= amount);
    this.allowances[from][spender] = this.allowances[from][spender] - amount;
    this.balances[from] = this.balances[from] - amount;
    this.balances[to] = this.balances[to] + amount;
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
      batchBytes: 1007,
      covenantDeltaBytes: 638,
      expandedOpcodes: 23,
      routeBodyBytes: 312,
    });
  });

  it('pins the exact two-row ERC20 resource route footprint', () => {
    const direct = compileString(ERC20_CALLEE, { forceStateful: true });
    const batch = compileString(ERC20_CALLEE, {
      forceStateful: true,
      experimentalHiddenBatch: true,
    });

    expect(batch.hiddenBatch).toMatchObject({ minimumRows: 2, maximumRows: 2 });
    expect({
      directBytes: byteLength(direct),
      batchBytes: byteLength(batch),
      covenantDeltaBytes: byteLength(batch) - byteLength(direct),
      routeBodyBytes: batch.functionBodies?.['53434231']!.length / 2,
    }).toEqual({
      directBytes: 3047,
      batchBytes: 3949,
      covenantDeltaBytes: 902,
      routeBodyBytes: 1271,
    });
  }, 15_000);

  it('reports an artifact error when library compilation exceeds the BCH script limit', () => {
    const source = `pragma solidcash >=0.8.0;
      contract Oversized() {
        function run() public {
          assembly { ${Array.from({ length: 10_050 }, () => 'OP_NOP').join(' ')} }
          require(true);
        }
      }`;
    const artifact = compileString(source);
    expect(byteLength(artifact)).toBeGreaterThan(10_000);
    expect(artifact.diagnostics).toContainEqual({
      severity: 'error',
      code: 'contract-size-limit',
      message: expect.stringMatching(/exceeding the BCH 10000-byte input-script limit/),
    });
  });

  it.each([
    [2, 407, 518, 111, 431],
    [3, 426, 542, 116, 444],
    [8, 518, 662, 144, 509],
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
