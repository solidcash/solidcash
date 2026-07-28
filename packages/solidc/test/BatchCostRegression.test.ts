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
      batchBytes: 1037,
      covenantDeltaBytes: 668,
      expandedOpcodes: 24,
      routeBodyBytes: 325,
    });
  });

  it('pins the exact two-row ERC20 resource route footprint', () => {
    const direct = compileString(ERC20_CALLEE, { forceStateful: true });
    const batch = compileString(ERC20_CALLEE, {
      forceStateful: true,
      experimentalHiddenBatch: true,
    });

    expect(batch.hiddenBatch).toMatchObject({ minimumRows: 2, maximumRows: 2 });
    // X19: this fixture spells its read-modify-writes `this.balances[k] = this.balances[k] - amount`. That
    // spelling used to skip the read-once/mutate-local/write-once C2 entry cache the equivalent bare spelling
    // (`balances[k] = ...`, what Solidity source actually writes) has always taken, so the two spellings of one
    // program published different bytecode. The dotted spelling now takes the same cache: `directBytes` moved
    // onto the bare spelling's pre-existing figure, which is unchanged by that fix.
    expect({
      directBytes: byteLength(direct),
      batchBytes: byteLength(batch),
      covenantDeltaBytes: byteLength(batch) - byteLength(direct),
      routeBodyBytes: batch.functionBodies?.['53434231']!.length / 2,
    }).toEqual({
      directBytes: 3157,
      batchBytes: 4773,
      covenantDeltaBytes: 1616,
      routeBodyBytes: 1565,
    });
  }, 15_000);

  /**
   * X19 anchor: the figure above is the BARE spelling's, not a third one. Respelling the fixture's depth-1
   * mapping accesses without `this.` must produce byte-identical output.
   */
  it('publishes the same direct-route bytecode for both spellings of the same write', () => {
    const bare = ERC20_CALLEE.replace(/this\.balances\[/g, 'balances[');
    expect(compileString(bare, { forceStateful: true }).bytecode)
      .toBe(compileString(ERC20_CALLEE, { forceStateful: true }).bytecode);
  }, 15_000);

  const LEDGER = `pragma solidcash >=0.8.0;
contract Ledger() {
  mapping(bytes20 => bigint) balances;
  function credit(bytes20 k, bigint amount) public {
    this.balances[k] = this.balances[k] + amount;
    require(amount > 0);
  }
}`;

  /**
   * X19's other half. The DIRECT route converged above, but the SCB1 route did not: route eligibility built
   * its per-collection key alternatives from the Mapping* nodes only, so the bare spelling arrived with an
   * empty directKeys, was rejected 'collection-helper-route-not-enabled', and got no route at all for a write
   * the direct route compiles. Both spellings must now publish one route, byte for byte.
   */
  it('publishes the same SCB1 route for both spellings of a self-reached entry write', () => {
    const options = { forceStateful: true, experimentalHiddenBatch: true };
    const dotted = compileString(LEDGER, options);
    const bare = compileString(LEDGER.replace(/this\.balances\[/g, 'balances['), options);
    expect(dotted.hiddenBatch?.handlers.map((handler) => [handler.name, handler.eligible]))
      .toEqual([['credit', true]]);
    expect(bare.hiddenBatch?.handlers.map((handler) => [handler.name, handler.eligible]))
      .toEqual([['credit', true]]);
    expect(bare.bytecode).toBe(dotted.bytecode);
  }, 15_000);

  /**
   * The boundary that convergence stops at, pinned so moving it is deliberate. A SECOND key alternative on one
   * collection makes the route reach the entry through a CLONED handler whose keys are rewritten to synthetic
   * entry-key parameters (bindEntryKeyParameters), and that rewrite still matches only the `this.`-prefixed
   * nodes - admitting the bare spelling there fails the build outright rather than producing a route. So the
   * two-alternative bare spelling keeps its established fail-closed outcome: no route.
   */
  it('still publishes no SCB1 route for the bare spelling of a two-alternative entry write', () => {
    const options = { forceStateful: true, experimentalHiddenBatch: true };
    const move = `pragma solidcash >=0.8.0;
contract Ledger() {
  mapping(bytes20 => bigint) balances;
  function move(bytes20 from, bytes20 to, bigint amount) public {
    this.balances[from] = this.balances[from] - amount;
    this.balances[to] = this.balances[to] + amount;
    require(amount > 0);
  }
}`;
    expect(compileString(move, options).hiddenBatch?.handlers.map((handler) => handler.eligible))
      .toEqual([true]);
    expect(compileString(move.replace(/this\.balances\[/g, 'balances['), options).hiddenBatch)
      .toBeUndefined();
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
