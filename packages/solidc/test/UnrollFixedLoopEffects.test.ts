import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';

// Outside a framed compile a fixed-bound `for` loop whose body pays, sends, transfers tokens or emits unrolls, so
// each turn's effect is a site of its own (solidcash test/e2e/LiteralBoundLoopEffects.test.ts runs the calls through
// the VM). A loop that stays rolled keeps one site, whose register the generator refuses to fill twice.
describe('a fixed-bound loop with an effect', () => {
  type Artifact = ReturnType<typeof compileString>;
  const run = (artifact: Artifact): Artifact['abi'][number] => artifact.abi.find((entry) => entry.name === 'run')!;
  const contract = (body: string, parameters = 'bytes20[] to'): string => `contract P {
    int paid;
    event E(int turn);
    function run(${parameters}) public { ${body} this.paid = this.paid + 1; }
  }`;
  const pay = 'this.transfer(new LockingBytecodeP2PKH(to[i]), 1000 + i);';

  it('gives each turn a payment, send, token transfer and event site of its own', () => {
    const payments = run(compileString(contract(`for (int i = 0; i < 3; i++) { ${pay} }`)));
    expect(payments.transferCount).toBe(3);
    expect(payments.runtimeLoopTransfers).toBeUndefined();
    const events = run(compileString(contract('for (int i = 0; i < 3; i++) { emit E(i); }')));
    expect(events.emits).toHaveLength(3);
    expect(events.runtimeLoopEvents).toBeUndefined();
    const sends = run(compileString(contract(
      'for (int i = 0; i < 2; i++) { to.transfer(1500 + i); } for (int i = 0; i < 2; i++) { require(to.send(1600)); }',
      'address payable to',
    )));
    expect(sends.transferCount).toBe(4);
    const tokens = run(compileString(contract(
      'for (int i = 0; i < 3; i++) { this.tokens[series].transfer(new LockingBytecodeP2PKH(to[i]), 5 + i); }',
      'bytes32 series, bytes20[] to',
    )));
    expect(tokens.tokenContainerTransferSites).toHaveLength(3);
  });

  it('keeps only the arm a branch takes once the counter is a literal', () => {
    const folded = run(compileString(contract(`for (int i = 0; i < 3; i++) { if (i != 1) { ${pay} } }`)));
    expect(folded.transferCount).toBe(2);
    expect(folded.transfers?.every((transfer) => transfer.condition === undefined)).toBe(true);
    const nested = run(compileString(contract(
      'for (int i = 0; i < 2; i++) { for (int j = 0; j < 3; j++) { if (j != i) { emit E(10 * i + j); } } }',
    )));
    expect(nested.emits).toHaveLength(4);
  });

  it('keeps one site in a loop that moves its counter, runs past 64 turns, or compiles for a frame', () => {
    expect(run(compileString(contract(`for (int i = 0; i < 3; i++) { ${pay} if (i == 0) { i = i + 1; } }`)))
      .transferCount).toBe(1);
    expect(run(compileString(contract('for (int i = 0; i < 65; i++) { emit E(i); }'))).emits).toHaveLength(1);
    const looped = contract('for (int i = 0; i < 3; i++) { emit E(i); }');
    expect(run(compileString(looped, { composition: 'framed', suppressWarnings: true })).emits).toHaveLength(1);
  });

});
