import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/index.js';

// Preserve the historical expansion contract while the kernel-specific iteration behavior is covered by
// KernelCutoverRoute. The legacy route is now an explicit compatibility mode.
const options = { forceStateful: true, messageBus: true, messageBusKernel: false };
const kernelOptions = { forceStateful: true, messageBus: true, messageBusKernel: true };

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
  it('publishes the complete fixed identity set on the kernel route without scalar-value chunk witnesses', () => {
    const artifact = compileString(fixed(3), kernelOptions);
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'sum'))
      .toMatchObject({ eligible: true, physicalEntrySlots: [0, 1, 2] });
    expect(artifact.messageBus?.route.blockLayout?.slots.map((slot) => slot.kind).slice(0, 5))
      .toEqual(['master', 'dataNft', 'entry', 'entry', 'entry']);
    expect(artifact.messageBus?.route.entryAccesses?.map((access) =>
      access.keySources[0].kind === 'constant' ? access.keySources[0].constantValue : undefined))
      .toEqual(['0', '1', '2']);
    expect(artifact.messageBus?.route.inputs.some((input) =>
      input.name.startsWith('__internal__valueWitness_')
        || input.name.startsWith('__internal__leadingPushValue_'))).toBe(false);
  }, 180_000);

  it('keeps fixed scalar element writers alongside iteration without speculative witness failures', () => {
    const attemptFailureBox = {
      failures: [] as Array<{
        stage: string; errorName: string; message: string; internalCodegen: boolean;
      }>,
    };
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract FixedWriters() {
        bigint total;
        bigint[2] values;
        function set0(bigint value) public { this.values[0] = value; require(value >= 0); }
        function set1(bigint value) public { this.values[1] = value; require(value >= 0); }
        function sum() public {
          bigint result = 0;
          for (bigint value of this.values) { result = result + value; }
          this.total = result;
          require(result >= 0);
        }
      }`, {
      ...kernelOptions,
      suppressWarnings: true,
      __artifactCache: false,
      __attemptFailureBox: attemptFailureBox,
      __strictNoInternalRecovery: true,
    });

    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(artifact.messageBus?.handlers.filter((handler) => handler.eligible).map((handler) => handler.name))
      .toEqual(['set0', 'set1', 'sum']);
    expect(attemptFailureBox.failures).toEqual([]);
  }, 180_000);

  it('admits a fixed array with one ordered entry identity per element', () => {
    const artifact = compileString(fixed(3), options);
    expect(artifact.messageBus?.convention).toBe('legacy-unroll');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'sum'))
      .toMatchObject({ eligible: true });
    // The compatibility route may reserve trailing row-journal capacity, but its fixed predecessor identity
    // prefix remains one master, one data NFT and exactly one entry for every fixed-array element.
    expect(artifact.messageBus?.route.blockLayout?.slots.map((slot) => slot.kind).slice(0, 5))
      .toEqual(['master', 'dataNft', 'entry', 'entry', 'entry']);
    expect(artifact.messageBus?.route.entryAccesses?.map((access) =>
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
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'sum'))
      .toMatchObject({ eligible: false, rejectionReason: 'collection-iteration-handler-not-enabled' });
  }, 180_000);

  it('refuses a fixed iteration above the compiler resource expansion ceiling', () => {
    const artifact = compileString(fixed(65), options);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'sum'))
      .toMatchObject({ eligible: false, rejectionReason: 'collection-iteration-handler-not-enabled' });
  }, 180_000);
});
