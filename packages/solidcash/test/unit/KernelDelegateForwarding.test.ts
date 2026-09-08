import { describe, expect, it } from 'vitest';
import { planKernelDelegateForwarding } from '../../src/stateful/KernelDelegateForwarding.js';

const bytes = (hex: string): Uint8Array => Uint8Array.from(
  hex.match(/../g)?.map((part) => Number.parseInt(part, 16)) ?? [],
);

// Deliberately mutable inferred fixtures keep hostile schema mutations concise.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const metadata = () => ({
  version: 1,
  callIndex: 0,
  payloadInput: 0,
  target: { kind: 'constructorArg', name: 'implementation' },
  targetBinding: { kind: 'constructorArg', input: 0, name: 'implementation' },
  frame: {
    stateOwner: 'participant', executor: 'target-input', calldata: 'payload-input',
    outputOwner: 'participant',
  },
  terminalRequire: true,
});

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const frame = () => ({
  participantInputIndex: 4,
  participantOutputIndex: 4,
  executorInputIndex: 7,
  participantInput: { lockingBytecode: 'aa20', stateCategory: '11'.repeat(32) },
  participantOutput: { lockingBytecode: 'aa20', stateCategory: '11'.repeat(32) },
  executorLockingBytecode: 'bb20',
  forwardedCalldata: bytes('01020304'),
});

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe('kernel delegate forwarding binding prerequisite', () => {
  it('binds one exact owner, executor, payload, and output frame', () => {
    expect(planKernelDelegateForwarding(
      metadata(), [bytes('01020304')], [bytes('bb20')], frame(),
    )).toEqual({
      participantInputIndex: 4,
      participantOutputIndex: 4,
      executorInputIndex: 7,
      ownerLockingBytecode: 'aa20',
      stateCategory: '11'.repeat(32),
      executorLockingBytecode: 'bb20',
      forwardedCalldata: bytes('01020304'),
    });
  });

  it('rejects target and payload substitution', () => {
    const wrongExecutor = frame();
    wrongExecutor.executorLockingBytecode = 'cc20';
    expect(() => planKernelDelegateForwarding(
      metadata(), [bytes('01020304')], [bytes('bb20')], wrongExecutor,
    )).toThrow(/committed forwarding target/);

    const wrongPayload = frame();
    wrongPayload.forwardedCalldata = bytes('ffffffff');
    expect(() => planKernelDelegateForwarding(
      metadata(), [bytes('01020304')], [bytes('bb20')], wrongPayload,
    )).toThrow(/selected payload input/);
  });

  it('rejects owner, state-category, and output-coordinate substitution', () => {
    const wrongOwner = frame();
    wrongOwner.participantOutput.lockingBytecode = 'cc20';
    const wrongCategory = frame();
    wrongCategory.participantOutput.stateCategory = '22'.repeat(32);
    const wrongCoordinate = frame();
    wrongCoordinate.participantOutputIndex = 5;
    for (const hostile of [wrongOwner, wrongCategory]) {
      expect(() => planKernelDelegateForwarding(
        metadata(), [bytes('01020304')], [bytes('bb20')], hostile,
      )).toThrow(/preserve the participant owner and state category/);
    }
    expect(() => planKernelDelegateForwarding(
      metadata(), [bytes('01020304')], [bytes('bb20')], wrongCoordinate,
    )).toThrow(/balanced block offset/);
  });

  it('supports an exact literal target and rejects widened metadata', () => {
    const literal = metadata();
    literal.target = { kind: 'literal' } as never;
    literal.targetBinding = { kind: 'literal', lockingBytecode: 'bb20' } as never;
    expect(planKernelDelegateForwarding(
      literal, [bytes('01020304')], [], frame(),
    ).executorLockingBytecode).toBe('bb20');

    const widened = clone(metadata()) as Record<string, unknown>;
    widened.unboundOutput = true;
    expect(() => planKernelDelegateForwarding(
      widened, [bytes('01020304')], [bytes('bb20')], frame(),
    )).toThrow(/unsupported schema/);
  });

  it('rejects an executor aliasing the participant owner coordinate', () => {
    const aliased = frame();
    aliased.executorInputIndex = aliased.participantInputIndex;
    expect(() => planKernelDelegateForwarding(
      metadata(), [bytes('01020304')], [bytes('bb20')], aliased,
    )).toThrow(/must be distinct/);
  });
});
