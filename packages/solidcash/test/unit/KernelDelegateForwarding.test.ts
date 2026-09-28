import { describe, expect, it } from 'vitest';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { scriptToBytecode, type Artifact } from '@solidcash/utils';
import { encodeFunctionArgument } from '../../src/Argument.js';
import {
  planKernelDelegateForwarding, resolveKernelDelegateExecution, resolveKernelDelegateForwardingTarget,
  resolveKernelDelegatePromotion,
} from '../../src/stateful/KernelDelegateForwarding.js';
import {
  assertExternalCallRowPayload, assertPreparedExternalCallRowReconciliation,
  evaluateExternalCallAffineIterationDomain,
  externalCallCandidateIterationIndices, externalCallMetadataIdentityMatches,
  externalCallReachedOccurrenceIndices,
  externalReturnsForCallsites,
  producerResultOccurrenceIndex,
  repeatedExternalResultNeedsOccurrenceIdentity,
  publishPreparedKernelDelegateOwnerFrame,
  resolvePreparedKernelDelegateExecution,
  resolvePreparedKernelDelegateOwnerFrame,
  resolvePublishedEntryBlockOffset, selectKernelDelegateForwardingGroupIndex,
} from '../../src/stateful/StatefulContract.js';

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

describe('kernel delegate entry coordinates', () => {
  it('resolves an entry-access lane through the published block layout', () => {
    const layout = {
      slots: [
        { kind: 'master', offset: 0 },
        { kind: 'dataNft', offset: 1 },
        { kind: 'dataNft', offset: 2 },
        { kind: 'entry', offset: 3, slotIndex: 1 },
        { kind: 'event', offset: 4 },
      ],
    };

    expect(resolvePublishedEntryBlockOffset(layout, 1)).toBe(3);
    expect(resolvePublishedEntryBlockOffset(layout)).toBe(3);
  });

  it('derives exact loop occurrences from every compiler array-element source', () => {
    const call = {
      occurrence: 'loop' as const,
      minimumOccurrences: 0,
      maximumOccurrences: 4,
      argSources: [{
        kind: 'expression',
        left: { kind: 'arrayElement', paramIndex: 0 },
        right: [{ kind: 'arrayElement', paramIndex: 1 }],
      }],
    };

    expect(externalCallReachedOccurrenceIndices(call, [[], []])).toEqual([]);
    expect(externalCallReachedOccurrenceIndices(call, [[1n], [2n]])).toEqual([0]);
    expect(externalCallReachedOccurrenceIndices(call, [[1n, 2n], [3n, 4n]])).toEqual([0, 1]);
  });

  it('fails closed for missing, inconsistent, or out-of-bound loop cardinality', () => {
    const source = { kind: 'arrayElement', paramIndex: 0 };
    expect(externalCallReachedOccurrenceIndices(
      { occurrence: 'loop', argSources: [] }, [[1n]],
    )).toBeUndefined();
    expect(externalCallReachedOccurrenceIndices(
      { occurrence: 'loop', argSources: [source] }, [1n],
    )).toBeUndefined();
    expect(externalCallReachedOccurrenceIndices({
      occurrence: 'loop', argSources: [source, { kind: 'arrayElement', paramIndex: 1 }],
    }, [[1n], [2n, 3n]])).toBeUndefined();
    expect(externalCallReachedOccurrenceIndices({
      occurrence: 'loop', maximumOccurrences: 1, argSources: [source],
    }, [[1n, 2n]])).toBeUndefined();
  });

  it('enumerates a literal loop candidate domain before sparse conditions compact reached rows', () => {
    const call = {
      occurrence: 'loop' as const,
      occurrenceBoundSource: 'literal' as const,
      maximumOccurrences: 5,
      rawArgSources: [{ kind: 'expression', expression: { kind: 'source', source: { kind: 'loopIndex' } } }],
    };

    expect(externalCallReachedOccurrenceIndices(call, [])).toBeUndefined();
    expect(externalCallCandidateIterationIndices(call, [])).toEqual([0, 1, 2, 3, 4]);
    expect(externalCallCandidateIterationIndices({ ...call, maximumOccurrences: 0 }, [])).toEqual([]);
    expect(externalCallCandidateIterationIndices({ ...call, maximumOccurrences: 1 }, [])).toEqual([0]);
    expect(externalCallCandidateIterationIndices({ ...call, maximumOccurrences: 10_001 }, []))
      .toBeUndefined();
  });

  it.each([
    ['zero', 0n, 1n, 0n, []],
    ['one', 0n, 1n, 1n, [0]],
    ['positive N', -2n, 2n, 5n, [0, 1, 2, 3]],
    ['negative N', 5n, -2n, -2n, [0, 1, 2, 3]],
  ] as const)('evaluates an exact %s bounded affine iteration domain', (
    _name, initial, step, bound, expected,
  ) => {
    const initialExpression = { kind: 'initial' };
    const stepExpression = { kind: 'step' };
    const continueCondition = { kind: 'condition' };
    const domain = {
      counterName: 'counter', initialValue: initialExpression, stepValue: stepExpression,
      continueCondition, maximumIterations: 8,
    };

    expect(evaluateExternalCallAffineIterationDomain(domain, (expression, bindings) => {
      if (expression === initialExpression) return initial;
      if (expression === stepExpression) return step;
      const counter = bindings.get('counter');
      if (typeof counter !== 'bigint') return undefined;
      return step > 0n ? counter < bound : counter > bound;
    })).toEqual(expected);
  });

  it('fails closed for unresolved, non-progressing, changing, and ceiling-bound affine domains', () => {
    const initialValue = { kind: 'initial' };
    const stepValue = { kind: 'step' };
    const continueCondition = { kind: 'condition' };
    const domain = {
      counterName: 'counter', initialValue, stepValue, continueCondition, maximumIterations: 2,
    };
    const evaluate = (
      initial: bigint | undefined, step: bigint | undefined,
      active: (counter: bigint) => boolean | undefined,
    ) => evaluateExternalCallAffineIterationDomain(domain, (expression, bindings) => {
      if (expression === initialValue) return initial;
      if (expression === stepValue) return step;
      const counter = bindings.get('counter');
      if (typeof counter !== 'bigint') return undefined;
      return active(counter);
    });

    expect(() => evaluate(undefined, 1n, () => true)).toThrow(/unresolved initial value/);
    expect(() => evaluate(0n, 1n, () => undefined)).toThrow(/unresolved continue condition/);
    expect(() => evaluate(0n, undefined, () => true)).toThrow(/unresolved step/);
    expect(() => evaluate(0n, 0n, () => true)).toThrow(/non-progressing zero step/);
    expect(() => evaluateExternalCallAffineIterationDomain({
      ...domain, stepValue: { kind: 'identifier', name: 'counter' },
    }, () => 1n)).toThrow(/step is not invariant/);
    expect(() => evaluate(0n, 1n, () => true)).toThrow(/2-iteration ceiling/);
    expect(() => evaluateExternalCallAffineIterationDomain(
      { ...domain, maximumIterations: 20_000 }, (expression, bindings) => (
        expression === initialValue ? 0n : expression === stepValue ? 1n : bindings.has('counter')
      ),
    )).toThrow(/SDK hard cap/);
  });

  it('accepts exactly one authenticated iteration-domain result-consumer lane', () => {
    const producerCall = {
      callsiteId: 3, interfaceName: 'ISource', functionName: 'bound', requiredDataNftIndices: [],
      hasReturnValues: true, returnTypes: ['uint16'],
    };
    const lane = {
      consumerCallsiteId: 4, producerCallsiteId: 3, resultIndex: 0, iterationDomain: true as const,
    };
    expect(() => externalReturnsForCallsites([], new Map(), [producerCall], {
      callsiteId: 4, resultConsumers: [lane] as never,
    })).not.toThrow();
    expect(() => externalReturnsForCallsites([], new Map(), [producerCall], {
      callsiteId: 4, resultConsumers: [{ ...lane, condition: true }] as never,
    })).toThrow(/one valid consumer lane/);
  });

  it('does not clone one producer result across consumer loop iterations', () => {
    expect(producerResultOccurrenceIndex({ callsiteId: 4, occurrence: 'once' })).toBe(0);
    expect(producerResultOccurrenceIndex({ callsiteId: 5, occurrence: 'conditional' })).toBe(0);
    expect(() => producerResultOccurrenceIndex({ callsiteId: 6, occurrence: 'loop' }))
      .toThrow(/no per-occurrence identity/);
  });

  it('requires occurrence identity for sparse or graph-consumed repeated returns', () => {
    const repeated = { callsiteId: 6, hasReturnValues: true, occurrence: 'loop' as const };
    const consumer = { consumerCallsiteId: 7, argument: 0, producerCallsiteId: 6 } as never;
    const unrelated = { consumerCallsiteId: 7, argument: 0, producerCallsiteId: 5 } as never;
    const dense = [{ sourceIteration: 0, occurrenceIndex: 0 }, { sourceIteration: 1, occurrenceIndex: 1 }];
    expect(repeatedExternalResultNeedsOccurrenceIdentity(repeated, undefined, [])).toBe(false);
    expect(repeatedExternalResultNeedsOccurrenceIdentity(repeated, [unrelated], dense)).toBe(false);
    expect(repeatedExternalResultNeedsOccurrenceIdentity(repeated, undefined, [
      { sourceIteration: 1, occurrenceIndex: 0 },
    ])).toBe(true);
    expect(repeatedExternalResultNeedsOccurrenceIdentity(repeated, undefined, [
      { sourceIteration: 0, occurrenceIndex: 0 }, { sourceIteration: 2, occurrenceIndex: 1 },
    ])).toBe(true);
    expect(repeatedExternalResultNeedsOccurrenceIdentity(repeated, [consumer], dense)).toBe(true);
    expect(repeatedExternalResultNeedsOccurrenceIdentity({
      ...repeated, resultArrayOutput: 0,
    }, [consumer], dense)).toBe(true);
  });

  it('does not alias sibling legacy callsites whose stable IDs are both absent', () => {
    const legacy = {};
    expect(externalCallMetadataIdentityMatches(legacy, legacy)).toBe(true);
    expect(externalCallMetadataIdentityMatches({}, {})).toBe(false);
    expect(externalCallMetadataIdentityMatches({ callsiteId: 3 }, { callsiteId: 3 })).toBe(true);
    expect(externalCallMetadataIdentityMatches({ callsiteId: 3 }, { callsiteId: 4 })).toBe(false);
    expect(externalCallMetadataIdentityMatches({ callsiteId: 3 }, {})).toBe(false);
  });

  it('reuses a materialized row only for the same arguments, target, and effect', () => {
    const existing = {
      args: [1n, bytes('aabb')],
      targetLockingBytecode: 'AABBCC',
      sourceEffectOrdinal: 7,
    };

    expect(() => assertExternalCallRowPayload(12, 3, existing, {
      args: [1n, bytes('aabb')],
      targetLockingBytecode: 'aabbcc',
      sourceEffectOrdinal: 7,
    })).not.toThrow();
    expect(() => assertExternalCallRowPayload(12, 3, existing, {
      ...existing, args: [2n, bytes('aabb')],
    })).toThrow(/callsite 12 occurrence 3.*arguments, or effect identity/);
    expect(() => assertExternalCallRowPayload(12, 3, existing, {
      ...existing, targetLockingBytecode: 'ddeeff',
    })).toThrow(/callsite 12 occurrence 3.*arguments, or effect identity/);
    expect(() => assertExternalCallRowPayload(12, 3, existing, {
      ...existing, sourceEffectOrdinal: 8,
    })).toThrow(/callsite 12 occurrence 3.*arguments, or effect identity/);
  });

  it('reconciles a prepared row only with the same producer path and physical owner', () => {
    const contract = {};
    const existing = {
      parent: 2,
      sourceCallsiteId: 12,
      occurrenceIndex: 3,
      sourceEffectOrdinal: 7,
      producerPathKey: 'root/12:3',
      args: [1n],
      targetLockingBytecode: 'aabbcc',
      contract,
    };
    const reached = {
      args: [1n], targetLockingBytecode: 'AABBCC', sourceEffectOrdinal: 7,
    };
    const expected = { parent: 2, producerPathKey: 'root/12:3' };
    const physical = { contract, lockingBytecode: 'aabbcc', hasMaster: true };

    expect(() => assertPreparedExternalCallRowReconciliation(
      12, 3, existing, reached, expected, physical,
    )).not.toThrow();
    for (const hostile of [
      { existing: { ...existing, parent: 4 }, physical },
      { existing: { ...existing, producerPathKey: 'root/12:2' }, physical },
      { existing: { ...existing, sourceLogicalIndex: 0 }, physical },
      { existing, physical: { ...physical, contract: {} } },
      { existing, physical: { ...physical, lockingBytecode: 'ddeeff' } },
      { existing, physical: { ...physical, hasMaster: false } },
    ]) {
      expect(() => assertPreparedExternalCallRowReconciliation(
        12, 3, hostile.existing, reached, expected, hostile.physical,
      )).toThrow(/different stable identity or physical owner/);
    }
  });
});

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

  it('resolves the exact forwarding target independently of a physical frame', () => {
    expect(resolveKernelDelegateForwardingTarget(metadata(), [bytes('bb20')])).toEqual({
      callIndex: 0,
      lockingBytecode: 'bb20',
    });
    const literal = metadata();
    literal.target = { kind: 'literal' } as never;
    literal.targetBinding = { kind: 'literal', lockingBytecode: 'BB20' } as never;
    expect(resolveKernelDelegateForwardingTarget(literal, [])).toEqual({
      callIndex: 0,
      lockingBytecode: 'bb20',
    });
  });

  it('selects the authenticated delegate executor independently of group order', () => {
    const group = (lockingBytecode: string, callMode = 'delegatecall') => ({
      callMode,
      externalContract: { inner: { lockingBytecode } },
    });
    const decoy = group('cc20');
    const target = group('bb20');
    const ordinary = group('bb20', 'call');
    const select = (groups: ReturnType<typeof group>[]) => selectKernelDelegateForwardingGroupIndex({
      forwarding: metadata(),
      encodedProxyConstructorArgs: [bytes('bb20')],
      groups,
    });
    expect(select([decoy, ordinary, target])).toBe(2);
    expect(select([target, ordinary, decoy])).toBe(0);
    expect(() => select([decoy])).toThrow(/not materialized/);
    expect(() => select([target, target])).toThrow(/ambiguous/);
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

  it('decodes a forwarded aggregate from its outer ABI push boundary', () => {
    const artifact = implementationArtifact();
    const inputs = [{ name: 'values', type: 'uint256[]' }];
    artifact.abi[0]!.inputs = inputs;
    artifact.messageBus!.handlers[0]!.inputs = inputs;
    const values = [1n, 2n, 3n];
    const encoded = encodeFunctionArgument(values, 'uint256[]');
    if (!(encoded instanceof Uint8Array)) throw new Error('test array did not encode to bytes');
    const payload = new Uint8Array([...hexToBin('01020304'), ...scriptToBytecode([encoded])]);

    expect(resolveKernelDelegatePromotion({
      forwarding: metadata(),
      proxyParameters: [payload],
      proxyConstructorArgs: [bytes('bb20')],
      proxyLockingBytecode: 'aa20',
      stateCategory: '11'.repeat(32),
      implementation: { artifact, lockingBytecode: 'bb20' },
      requestedFunctionName: 'apply',
      requestedArgs: [values],
    }).args).toEqual([values]);
  });

  it('preserves the explicit zero count of a forwarded empty dynamic array', () => {
    const artifact = implementationArtifact();
    const inputs = [{ name: 'recipients', type: 'address[]' }];
    artifact.abi[0]!.inputs = inputs;
    artifact.messageBus!.handlers[0]!.inputs = inputs;
    const encoded = encodeFunctionArgument([], 'address[]');
    if (!(encoded instanceof Uint8Array)) throw new Error('test array did not encode to bytes');
    const payload = new Uint8Array([...hexToBin('01020304'), ...scriptToBytecode([encoded])]);

    expect(resolveKernelDelegatePromotion({
      forwarding: metadata(), proxyParameters: [payload], proxyConstructorArgs: [bytes('bb20')],
      proxyLockingBytecode: 'aa20', stateCategory: '11'.repeat(32),
      implementation: { artifact, lockingBytecode: 'bb20' },
      requestedFunctionName: 'apply', requestedArgs: [[]],
    }).args).toEqual([[]]);
  });

  it('binds nested resolution to the selector-authenticated promoted owner frame', () => {
    const logical = {
      name: 'apply', selector: '01020304', inputs: [
        { name: 'key', type: 'uint256' },
        { name: 'value', type: 'bytes32' },
        { name: '__internal__valueWitness_0', type: 'bytes' },
      ],
    } as any;
    const physicalRoute = {
      name: '__message_bus1', selector: '05060708', inputs: [
        { name: 'rows', type: 'bytes' },
        { name: '__internal__valueWitness_0', type: 'bytes' },
      ],
    } as any;
    const execution = {
      functionName: 'apply', selector: '01020304', args: [5n, bytes('aa'.repeat(32))],
    } as any;

    const selected = resolvePreparedKernelDelegateOwnerFrame({
      execution,
      implementationAbi: [physicalRoute, logical],
    });

    expect(selected.abiFunction).toBe(logical);
    expect(selected.args).toEqual(execution.args);
    expect(selected.args).not.toBe(execution.args);
  });

  it('publishes the promoted logical arguments independently of the physical delegate payload', () => {
    const physicalPayload = [bytes('11'.repeat(35))];
    const logicalArgs = [bytes('22'.repeat(35))];
    const group = { functionArgs: physicalPayload } as any;

    publishPreparedKernelDelegateOwnerFrame(group, {
      abiFunction: { name: 'apply' } as any,
      args: logicalArgs,
    });

    expect(group.functionArgs).toBe(physicalPayload);
    expect(group.logicalFunctionName).toBe('apply');
    expect(group.logicalFunctionArgs).toEqual(logicalArgs);
    expect(group.logicalFunctionArgs).not.toBe(logicalArgs);
  });

  it('fails closed for an ambiguous promoted owner or mismatched decoded arity', () => {
    const execution = { functionName: 'apply', selector: '01020304', args: [5n] } as any;
    const exact = {
      name: 'apply', selector: '01020304', inputs: [{ name: 'key', type: 'uint256' }],
    } as any;
    expect(() => resolvePreparedKernelDelegateOwnerFrame({
      execution, implementationAbi: [exact, { ...exact }],
    })).toThrow(/exactly one logical implementation handler/);
    expect(() => resolvePreparedKernelDelegateOwnerFrame({
      execution, implementationAbi: [{ ...exact, inputs: [] }],
    })).toThrow(/declares 0/);
  });
});
