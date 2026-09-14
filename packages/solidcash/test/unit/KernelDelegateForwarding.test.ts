import { describe, expect, it } from 'vitest';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { scriptToBytecode, type Artifact } from '@solidcash/utils';
import { encodeFunctionArgument } from '../../src/Argument.js';
import {
  planKernelDelegateForwarding, resolveKernelDelegateExecution, resolveKernelDelegatePromotion,
} from '../../src/stateful/KernelDelegateForwarding.js';
import { resolvePreparedKernelDelegateExecution } from '../../src/stateful/StatefulContract.js';

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

const implementationArtifact = (eligible = true): Artifact => ({
  contractName: 'Implementation', constructorInputs: [], source: '', bytecode: '',
  abi: [{
    name: 'apply', selector: '01020304', inputs: [{ name: 'value', type: 'bytes1' }],
    modifiers: ['delegate'],
  }],
  messageBus: {
    version: 1, selector: '53434231', convention: 'kernel-row-loop', maximumRows: 1, maximumBlobBytes: 520,
    route: { name: '__message_bus1', inputs: [], selector: '53434231' },
    handlers: [{
      name: 'apply', selector: '01020304', inputs: [{ name: 'value', type: 'bytes1' }], eligible,
      ...(!eligible && { rejectionReason: 'KERNEL_LAYOUT' }),
    }],
  },
} as Artifact);

const implementationPayload = (value: number): Uint8Array => {
  const argument = encodeFunctionArgument(Uint8Array.of(value), 'bytes1');
  if (!(argument instanceof Uint8Array)) throw new Error('test byte did not encode to bytes');
  return new Uint8Array([...hexToBin('01020304'), ...scriptToBytecode([argument])]);
};

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

  it('canonically resolves the forwarding payload to one eligible implementation row', () => {
    const payload = implementationPayload(7);
    const physical = frame();
    physical.forwardedCalldata = payload;
    const resolved = resolveKernelDelegateExecution(
      metadata(), [payload], [bytes('bb20')], physical,
      { artifact: implementationArtifact(), lockingBytecode: 'bb20' },
    );
    expect(resolved).toMatchObject({ functionName: 'apply', selector: '01020304', args: [bytes('07')] });
    expect(binToHex(resolved.transcript).startsWith('4b444631')).toBe(true);
    expect(resolved.commitment).toHaveLength(32);
  });

  it('binds selector-only forwarding to the implementation row arguments', () => {
    const payload = bytes('01020304');
    const resolved = resolveKernelDelegatePromotion({
      forwarding: metadata(),
      proxyParameters: [payload],
      proxyConstructorArgs: [bytes('bb20')],
      proxyLockingBytecode: 'aa20',
      stateCategory: '11'.repeat(32),
      implementation: { artifact: implementationArtifact(), lockingBytecode: 'bb20' },
      requestedFunctionName: 'apply',
      requestedArgs: [bytes('07')],
    });
    expect(resolved).toMatchObject({ functionName: 'apply', selector: '01020304', args: [bytes('07')] });
    expect(binToHex(resolved.transcript).startsWith('4b444632')).toBe(true);
    expect(() => resolveKernelDelegatePromotion({
      forwarding: metadata(),
      proxyParameters: [payload],
      proxyConstructorArgs: [bytes('bb20')],
      proxyLockingBytecode: 'aa20',
      stateCategory: '11'.repeat(32),
      implementation: { artifact: implementationArtifact(), lockingBytecode: 'bb20' },
      requestedFunctionName: 'apply',
      requestedArgs: [],
    })).toThrow(/canonical implementation arguments|out of bounds/);
  });

  it('rejects decoy code metadata, ineligible rows, and non-canonical payloads', () => {
    const payload = implementationPayload(7);
    const physical = frame();
    physical.forwardedCalldata = payload;
    expect(() => resolveKernelDelegateExecution(
      metadata(), [payload], [bytes('bb20')], physical,
      { artifact: implementationArtifact(), lockingBytecode: 'cc20' },
    )).toThrow(/authenticated executor input/);
    expect(() => resolveKernelDelegateExecution(
      metadata(), [payload], [bytes('bb20')], physical,
      { artifact: implementationArtifact(false), lockingBytecode: 'bb20' },
    )).toThrow(/eligible kernel implementation handler/);

    const trailing = new Uint8Array([...payload, 0x00]);
    const trailingFrame = frame();
    trailingFrame.forwardedCalldata = trailing;
    expect(() => resolveKernelDelegateExecution(
      metadata(), [trailing], [bytes('bb20')], trailingFrame,
      { artifact: implementationArtifact(), lockingBytecode: 'bb20' },
    )).toThrow(/trailing or non-canonical/);
  });

  it('promotes an arbitrary-named exact forwarding function to its canonical implementation row', () => {
    const payload = implementationPayload(7);
    expect(resolveKernelDelegatePromotion({
      forwarding: metadata(),
      proxyParameters: [payload],
      proxyConstructorArgs: [bytes('bb20')],
      proxyLockingBytecode: 'aa20',
      stateCategory: '11'.repeat(32),
      implementation: { artifact: implementationArtifact(), lockingBytecode: 'bb20' },
      requestedFunctionName: 'apply',
      requestedArgs: [bytes('07')],
    })).toMatchObject({ functionName: 'apply', selector: '01020304', args: [bytes('07')] });
  });

  it('does not promote a mismatched call, target, or widened forwarding frame', () => {
    const payload = implementationPayload(7);
    const base = {
      forwarding: metadata(),
      proxyParameters: [payload],
      proxyConstructorArgs: [bytes('bb20')],
      proxyLockingBytecode: 'aa20',
      stateCategory: '11'.repeat(32),
      implementation: { artifact: implementationArtifact(), lockingBytecode: 'bb20' },
      requestedFunctionName: 'apply',
      requestedArgs: [bytes('07')],
    };
    expect(() => resolveKernelDelegatePromotion({ ...base, requestedFunctionName: 'other' }))
      .toThrow(/different implementation function/);
    expect(() => resolveKernelDelegatePromotion({ ...base, requestedArgs: [bytes('08')] }))
      .toThrow(/does not match the proxy payload/);
    expect(() => resolveKernelDelegatePromotion({
      ...base, proxyConstructorArgs: [bytes('cc20')],
    })).toThrow(/committed forwarding target/);
    expect(() => resolveKernelDelegatePromotion({
      ...base, forwarding: { ...metadata(), terminalRequire: false },
    })).toThrow(/not the singular version-1 frame/);
  });

  it('uses forwarding metadata rather than the proxy function name at the StatefulContract boundary', () => {
    const payload = implementationPayload(7);
    const base = {
      callIndex: 0,
      proxyParameters: [payload],
      proxyConstructorArgs: [bytes('bb20')],
      proxyLockingBytecode: 'aa20',
      stateCategory: '11'.repeat(32),
      implementationArtifact: implementationArtifact(),
      implementationLockingBytecode: 'bb20',
      requestedFunctionName: 'apply',
      requestedArgs: [bytes('07')],
    };
    expect(resolvePreparedKernelDelegateExecution({
      ...base,
      proxyFunction: { name: 'relayArbitraryPayload', delegateForwarding: metadata() },
    })).toMatchObject({ functionName: 'apply', selector: '01020304' });
    expect(resolvePreparedKernelDelegateExecution({
      ...base,
      proxyFunction: { name: '__forward' },
    })).toBeUndefined();
    expect(() => resolvePreparedKernelDelegateExecution({
      ...base,
      proxyFunction: {
        name: 'relayArbitraryPayload',
        delegateForwarding: { ...metadata(), terminalRequire: false },
      },
    })).toThrow(/not the singular version-1 frame/);
  });
});
