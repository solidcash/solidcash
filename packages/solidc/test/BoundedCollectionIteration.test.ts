import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

const options = { forceStateful: true, hiddenBatch: true };

const fixed = (bound: number): string => `pragma solidcash >=0.8.0;
contract FixedIteration() {
  bigint total;
  bigint[${bound}] values;
  function sum() public {
    bigint result = 0;
    for (bigint value of this.values) { result = result + value; }
    this.total = result;
    require(result >= 0);
  }
  function check(bigint expected) public { require(this.total == expected); }
}`;

describe('bounded collection iteration route', () => {
  it('admits a fixed array with one ordered entry identity per element', () => {
    const artifact = compileString(fixed(3), options);
    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'sum'))
      .toMatchObject({ eligible: true });
    expect(artifact.hiddenBatch?.route.blockLayout?.slots.map((slot) => slot.kind))
      .toEqual(['master', 'dataNft', 'entry', 'entry', 'entry']);
    expect(artifact.hiddenBatch?.route.entryAccesses?.map((access) =>
      access.keySources[0].kind === 'constant' ? access.keySources[0].constantValue : undefined))
      .toEqual(['0', '1', '2']);
  }, 180_000);

  it('keeps dynamically-cardinal enumerable mapping iteration fail-closed', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract DynamicIteration() {
        enumerable mapping(bytes20 => bigint) values;
        function sum() public { bigint n = 0; for (bigint v of this.values) { n = n + v; } require(n >= 0); }
        function ok() public { require(true); }
      }`, options);
    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'sum'))
      .toMatchObject({ eligible: false, rejectionReason: 'collection-iteration-handler-not-enabled' });
  }, 180_000);

  it('refuses a fixed iteration above the compiler resource expansion ceiling', () => {
    const artifact = compileString(fixed(65), options);
    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'sum'))
      .toMatchObject({ eligible: false, rejectionReason: 'collection-iteration-handler-not-enabled' });
  }, 180_000);
});
