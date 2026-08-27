import { describe, expect, it } from 'vitest';
import { hash160 } from '@solidcash/utils';
import type {
  AbiFunction, ArgSource, Artifact, ExternalCallAbi, ExternalCallExpression, FunctionArgument,
} from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { StatefulContract } from '../../src/index.js';
import {
  anchorRoutedDynamicResourcesAtOwner,
  canRefreshReachedCallFromPostState,
  externalCallRuntimeOccurrences,
  externalCallGraphOccurrences,
  externalCallSourcesAtOccurrence,
  externalCallTargetSourceLockingBytecodeHex,
  externalReturnParamSlot,
  groupIndexForExternalCallSlot,
  hasStatefulDerivationWork,
  inactiveMessageBusRouteWitness,
  isSdkResolvedExternalCallTopologyWitness,
  mergeCallerStateForArgumentRefresh,
  physicalExternalCallSelectorHex,
  rebaseRoutedBatchProofOffsets,
  selectedMessageBusResourceMetadata,
  planMessageBusDynamicResourceActivity,
} from '../../src/stateful/StatefulContract.js';
import { createTestProvider } from '../test-util.js';
import { addressToLockScript } from '../../src/utils.js';
import { binToHex, hexToBin } from '@bitauth/libauth';

type PredicateEvaluator = {
  _evaluateExternalExpression: (
    expression: ExternalCallExpression,
    args: FunctionArgument[],
    artifact: Artifact,
    state?: Record<string, unknown>,
    inputs?: readonly { type: string }[],
  ) => FunctionArgument | undefined;
  _resolveExternalArgs: (
    sources: ArgSource[],
    args: FunctionArgument[],
    artifact: Artifact,
    state?: Record<string, unknown>,
    inputs?: readonly { type: string }[],
    returns?: ReadonlyMap<string, FunctionArgument>,
    occurrenceIndex?: number,
    stateIncludesPriorWrites?: boolean,
    executionSelfAddress?: FunctionArgument,
  ) => FunctionArgument[] | undefined;
};

const artifact = compileString(`
  pragma solidcash >=0.8.0;
  contract PredicateHost {
    function keep(address target, bytes32 expected, sig s, pubkey pk) {
      require(target != address(0) && expected == expected);
      require(checkSig(s, pk));
    }
  }
`, { solidityImportCompat: true, forceStateful: true });

const evaluator = new StatefulContract(
  '00'.repeat(32), artifact, createTestProvider(),
) as unknown as PredicateEvaluator;

const source = (paramIndex: number): ExternalCallExpression => ({
  kind: 'source', source: { kind: 'forward', paramIndex },
});

describe('compiler-published external-call predicate evaluation', () => {
  it('rebases owner-relative batch proofs across an embedded proxy prefix', () => {
    const rebased = rebaseRoutedBatchProofOffsets({
      __internal__vmapBatchProof_0: 3n,
      __internal__vmapBatchProof_1: -1n,
      __internal__vmapBatchPredOut_0: 72n,
      unrelated: 4n,
    }, 3);

    expect(rebased).toEqual({
      __internal__vmapBatchProof_0: 6n,
      __internal__vmapBatchProof_1: -1n,
      __internal__vmapBatchPredOut_0: 72n,
      unrelated: 4n,
    });
  });

  it('anchors routed dynamic resources to the state owner without changing block width', () => {
    const inputs = Array.from({ length: 8 }, (_, id) => ({ id }));
    const chunk = { id: 5, token: { category: '01' } };
    inputs[5] = chunk;

    const anchored = anchorRoutedDynamicResourcesAtOwner(
      inputs, [{ blockSlot: 3, name: 'payload' }], 2,
    );

    expect(anchored).toHaveLength(inputs.length);
    expect(anchored[3]).toBe(chunk);
    expect(anchored[5]).toEqual({ id: 3 });
    expect(inputs[5]).toBe(chunk);
  });

  it('selects loop resources from the concrete message-bus handlers', () => {
    const selected = selectedMessageBusResourceMetadata([
      {
        handler: {
          name: 'append', inputs: [], entryLoopWrites: ['history'],
          dynamicReads: ['archive'], dynamicWrites: ['archive'],
          entryLoopWriteSignatures: { history: 'history:mapping(bytes32 => bytes[])' },
        },
      },
      {
        handler: {
          name: 'appendAgain', inputs: [], entryLoopWrites: ['history'],
          entryLoopWriteSignatures: { history: 'history:mapping(bytes32 => bytes[])' },
        },
      },
      {
        handler: {
          name: 'upsert', inputs: [],
          sortedUpsertLoopInfo: [{
            collection: 'balances', fixedKeyParams: [], varyingArrayParam: 'keys',
            valueArrayParam: 'values', op: 'set',
          }],
        },
      },
    ]);

    expect(selected).toEqual({
      entryLoopWrites: ['history'],
      entryLoopWriteSignatures: { history: 'history:mapping(bytes32 => bytes[])' },
      loopCollections: ['history', 'balances'],
      dynamicReads: ['archive'],
      dynamicWrites: ['archive'],
    });
  });

  it('excludes zero-cardinality runtime loops from the concrete resource frame', () => {
    const selected = selectedMessageBusResourceMetadata([{
      handler: {
        name: 'writeMany',
        inputs: [{ name: 'keys', type: 'bytes32[]' }],
        entryLoopWrites: ['balances'],
        entryLoopWriteSignatures: { balances: 'balances:mapping(bytes32 => int)' },
        sortedUpsertLoopInfo: [{
          collection: 'balances', fixedKeyParams: [], varyingArrayParam: 'keys',
          valueConst: '1', op: 'set',
        }],
        dynamicWrites: ['records'],
      },
      args: [[]],
    }]);

    expect(selected).toEqual({
      entryLoopWrites: [],
      entryLoopWriteSignatures: {},
      loopCollections: [],
      dynamicReads: [],
      dynamicWrites: ['records'],
    });
  });

  it('retains a loop when any concrete occurrence is non-empty', () => {
    const handler: AbiFunction = {
      name: 'writeMany',
      inputs: [{ name: 'keys', type: 'bytes32[]' }],
      entryLoopWrites: ['balances'],
      entryLoopWriteSignatures: { balances: 'balances:mapping(bytes32 => int)' },
      sortedUpsertLoopInfo: [{
        collection: 'balances', fixedKeyParams: [], varyingArrayParam: 'keys',
        valueConst: '1', op: 'set',
      }],
    };

    const selected = selectedMessageBusResourceMetadata([
      { handler, args: [[]] },
      { handler, args: [[new Uint8Array(32)]] },
    ]);

    expect(selected).toEqual({
      entryLoopWrites: ['balances'],
      entryLoopWriteSignatures: { balances: 'balances:mapping(bytes32 => int)' },
      loopCollections: ['balances'],
      dynamicReads: [],
      dynamicWrites: [],
    });
  });

  it('retains the compiler-published dynamic union for every concrete envelope', () => {
    const published = {
      dynamicReads: ['records'],
      dynamicWrites: ['records', 'audit'],
    };
    expect(planMessageBusDynamicResourceActivity(published, ['audit', 'records'])).toEqual({
      readOnly: [],
      writes: ['audit', 'records'],
    });
  });

  it('keeps genuinely read-only dynamic runs separate from published writes', () => {
    expect(planMessageBusDynamicResourceActivity({
      dynamicReads: ['lookup', 'records'], dynamicWrites: ['records'],
    }, ['records', 'lookup'])).toEqual({ readOnly: ['lookup'], writes: ['records'] });
  });

  it('does not skip derivation for a dynamic-only routed state write', () => {
    const noWork = {
      requiredStateNfts: 0,
      entryAccesses: 0,
      entryLoopWrites: 0,
      sortedLoops: 0,
      dynamicWrites: 0,
      emits: 0,
      transfers: 0,
      tokenEffects: 0,
      externalCalls: 0,
      externalReads: 0,
      returns: 0,
    };

    expect(hasStatefulDerivationWork(noWork)).toBe(false);
    expect(hasStatefulDerivationWork({ ...noWork, dynamicWrites: 1 })).toBe(true);
  });

  it('resolves loop-index sources relative to the reached occurrence', () => {
    expect(evaluator._resolveExternalArgs(
      [{ kind: 'loopIndex', initialValue: '2', stepValue: '3' }],
      [], artifact, undefined, undefined, undefined, 4,
    )).toEqual([14n]);
  });

  it('materializes every array-backed external-call loop occurrence with its own arguments', () => {
    const call = {
      callsiteId: 4,
      occurrence: 'loop',
      interfaceName: 'IReader',
      functionName: 'read',
      requiredDataNftIndices: [],
      argSources: [{ kind: 'arrayElement', paramIndex: 0, indexValue: 0 }],
    } satisfies ExternalCallAbi;
    const args: FunctionArgument[] = [[11n, 22n, 33n]];
    const occurrences = externalCallRuntimeOccurrences(call, args);

    expect(occurrences).toEqual([0, 1, 2]);
    expect(occurrences?.map((occurrence) => evaluator._resolveExternalArgs(
      externalCallSourcesAtOccurrence(call.argSources, occurrence),
      args, artifact, undefined, undefined, undefined, occurrence,
    ))).toEqual([[11n], [22n], [33n]]);
  });

  it('refuses an external-call loop when array-backed occurrence proofs disagree', () => {
    const call = {
      occurrence: 'loop',
      interfaceName: 'IReader',
      functionName: 'readPair',
      requiredDataNftIndices: [],
      argSources: [
        { kind: 'arrayElement', paramIndex: 0, indexValue: 0 },
        { kind: 'arrayElement', paramIndex: 1, indexValue: 0 },
      ],
    } satisfies ExternalCallAbi;

    expect(externalCallRuntimeOccurrences(call, [[1n, 2n], [3n]])).toBeUndefined();
  });

  it('defers a read-only returned-array loop to authenticated return-width expansion', () => {
    const call = {
      occurrence: 'loop',
      resultArrayOutput: 0,
      maximumOccurrences: 64,
      interfaceName: 'IReader',
      functionName: 'read',
      requiredDataNftIndices: [],
      argSources: [{ kind: 'loopIndex', initialValue: '0', stepValue: '1' }],
    } satisfies ExternalCallAbi;

    expect(externalCallRuntimeOccurrences(call, [])).toBeUndefined();
    expect(externalCallGraphOccurrences(call, [], false)).toEqual([0]);
    expect(externalCallGraphOccurrences(call, [], true)).toBeUndefined();
  });

  it('resolves address(this) from the authenticated execution context', () => {
    const executionAddress = Uint8Array.of(0xaa, 0x20, ...new Uint8Array(32).fill(0x42), 0x87);
    expect(evaluator._resolveExternalArgs(
      [{ kind: 'selfAddress' }], [], artifact, undefined, undefined, undefined, 0, false,
      executionAddress,
    )).toEqual([executionAddress]);
  });

  it('uses the physical active input rather than a logical deployment identity by default', () => {
    const contract = evaluator as unknown as StatefulContract;
    const originalLogicalAddress = contract._logicalAddress;
    contract._logicalAddress = 'logical-identity-is-not-the-active-input';
    try {
      expect(evaluator._resolveExternalArgs(
        [{ kind: 'selfAddress' }], [], artifact,
      )).toEqual([hexToBin(contract.inner.lockingBytecode)]);
    } finally {
      contract._logicalAddress = originalLogicalAddress;
    }
  });

  it('resolves compiler-marked address(this) through the logical identity', () => {
    const contract = evaluator as unknown as StatefulContract;
    expect(evaluator._resolveExternalArgs(
      [{ kind: 'selfAddress', logicalIdentity: true }], [], artifact,
    )).toEqual([addressToLockScript(contract.target)]);
  });

  it('compares address(0) against ethers-style zero addresses by value', () => {
    const expression: ExternalCallExpression = {
      kind: 'binary',
      operator: '!=',
      left: source(0),
      right: {
        kind: 'cast', type: 'address',
        expression: { kind: 'literal', type: 'bigint', value: '0' },
      },
    };
    const evaluate = (target: string): FunctionArgument | undefined => evaluator._evaluateExternalExpression(
      expression, [target], artifact, undefined, [{ type: 'address' }],
    );

    expect(evaluate(`0x${'00'.repeat(20)}`)).toBe(false);
    expect(evaluate(`0x${'01'.repeat(20)}`)).toBe(true);
  });

  it('compares separately allocated byte arrays by contents', () => {
    const expression: ExternalCallExpression = {
      kind: 'binary', operator: '==', left: source(0), right: source(1),
    };
    const value = new Uint8Array([1, 2, 3]);

    expect(evaluator._evaluateExternalExpression(
      expression, [value, value.slice()], artifact, undefined,
      [{ type: 'bytes32' }, { type: 'bytes32' }],
    )).toBe(true);
  });

  it('short-circuits predicates before evaluating an unresolved right operand', () => {
    const unresolved: ExternalCallExpression = { kind: 'state', name: 'runtimeOnly' };
    const evaluate = (operator: '&&' | '||', left: boolean): FunctionArgument | undefined => (
      evaluator._evaluateExternalExpression({
        kind: 'binary', operator, left: { kind: 'literal', type: 'bool', value: left }, right: unresolved,
      }, [], artifact)
    );

    expect(evaluate('&&', false)).toBe(false);
    expect(evaluate('||', true)).toBe(true);
    expect(evaluate('&&', true)).toBeUndefined();
    expect(evaluate('||', false)).toBeUndefined();
  });

  it('packs Solidity addresses and arbitrarily long hex bytes like the compiler', () => {
    const addressHash = new Uint8Array(20).fill(0x47);
    const lockingBytecode = Uint8Array.of(0x76, 0xa9, 0x14, ...addressHash, 0x88, 0xac);
    const signature = `0x${'ab'.repeat(65)}`;
    const expression: ExternalCallExpression = {
      kind: 'abiEncodePacked', fields: ['', ''], args: [source(0), source(1)],
    };

    const packed = evaluator._evaluateExternalExpression(
      expression, [lockingBytecode, signature], artifact, undefined,
      [{ type: 'address' }, { type: 'bytes' }],
    );

    expect(packed).toBeInstanceOf(Uint8Array);
    expect(packed).toEqual(Uint8Array.of(...addressHash, ...new Uint8Array(65).fill(0xab)));
  });

  it('uses the compiler address narrowing rule for Solidity P2SH32 values', () => {
    const lockingBytecode = Uint8Array.of(0xaa, 0x20, ...new Uint8Array(32).fill(0x23), 0x87);
    const expression: ExternalCallExpression = {
      kind: 'abiEncodePacked', fields: [''], args: [source(0)],
    };

    expect(evaluator._evaluateExternalExpression(
      expression, [lockingBytecode], artifact, undefined, [{ type: 'address' }],
    )).toEqual(hash160(lockingBytecode));
  });

  it('infers packed Solidity address types through array-element sources', () => {
    const addressHash = new Uint8Array(20).fill(0x47);
    const lockingBytecode = Uint8Array.of(0x76, 0xa9, 0x14, ...addressHash, 0x88, 0xac);
    const expression: ExternalCallExpression = {
      kind: 'abiEncodePacked',
      fields: [''],
      args: [{
        kind: 'source',
        source: { kind: 'arrayElement', paramIndex: 0, indexValue: 0 },
      }],
    };

    expect(evaluator._evaluateExternalExpression(
      expression, [[lockingBytecode]], artifact, undefined, [{ type: 'address[]' }],
    )).toEqual(addressHash);
  });

  it('packs typed Solidity integers at natural width in big-endian order', () => {
    const expression: ExternalCallExpression = {
      kind: 'abiEncodePacked', fields: ['uint16', 'int16'],
      args: [source(0), source(1)],
    };

    expect(evaluator._evaluateExternalExpression(
      expression, [2n, -2n], artifact, undefined,
      [{ type: 'uint16' }, { type: 'int16' }],
    )).toEqual(Uint8Array.of(0x00, 0x02, 0xff, 0xfe));
  });

  it('evaluates compiler-published pure helper programs without helper-name knowledge', () => {
    const helperArtifact = compileString(`
      pragma solidity >=0.8.0;
      function prefixItems(string[] values) pure returns (bytes) {
        bytes result = abi.encodePacked(uint8(values.length));
        for (uint i = 0; i < values.length; i = i + 1) {
          result = bytes.concat(result, abi.encodePacked(uint8(bytes(values[i]).length), values[i]));
        }
        return result;
      }
      interface ISink { function publish(bytes value) external; }
      contract HelperCaller(address sink) {
        function run(string[] values) public {
          ISink(sink).publish(prefixItems(values));
          ISink(sink).publish(prefixItems(values));
          require(values.length >= 0);
        }
      }
    `, { solidityImportCompat: true, forceStateful: true, messageBus: true });
    const expression = helperArtifact.abi.find((candidate) => candidate.name === 'run')
      ?.externalCalls?.[0].batchInvocations?.[0].argSources?.[0].expression;
    expect(expression).toBeDefined();

    const helperEvaluator = new StatefulContract(
      '00'.repeat(32), helperArtifact, createTestProvider(), { constructorArgs: [new Uint8Array()] },
    ) as unknown as PredicateEvaluator;
    expect(helperEvaluator._evaluateExternalExpression(
      expression!, [['DV']], helperArtifact, undefined, [{ type: 'string[]' }],
    )).toEqual(Uint8Array.of(1, 2, 0x44, 0x56));
  });

  it('packs address-to-uint160 casts as 20-byte Solidity identities', () => {
    const expression: ExternalCallExpression = {
      kind: 'abiEncodePacked', fields: ['uint160'], args: [source(0)],
    };
    const p2pkhHash = new Uint8Array(20).fill(0x47);
    const p2pkh = Uint8Array.of(0x76, 0xa9, 0x14, ...p2pkhHash, 0x88, 0xac);
    const p2sh32 = Uint8Array.of(0xaa, 0x20, ...new Uint8Array(32).fill(0x23), 0x87);
    const evaluate = (value: FunctionArgument): FunctionArgument | undefined => (
      evaluator._evaluateExternalExpression(
        expression, [value], artifact, undefined, [{ type: 'address' }],
      )
    );

    expect(evaluate(`0x${'00'.repeat(20)}`)).toEqual(new Uint8Array(20));
    expect(evaluate(p2pkh)).toEqual(p2pkhHash);
    expect(evaluate(p2sh32)).toEqual(hash160(p2sh32));
  });

  it('defers argument refresh while a dynamic write has only revealed its new byte length', () => {
    const lastItem: ExternalCallExpression = {
      kind: 'binary',
      operator: '-',
      left: {
        kind: 'unary',
        operator: '.length',
        expression: { kind: 'state', name: 'items' },
        value: '1',
      },
      right: { kind: 'literal', type: 'bigint', value: '1' },
    };
    const sourceExpression: ArgSource = { kind: 'expression', expression: lastItem };
    const currentState = { items: [] };

    // Before execution, the compiler-published +1 write delta makes the first appended index resolvable.
    expect(evaluator._resolveExternalArgs(
      [sourceExpression], [], artifact, currentState, [], undefined, 0, false,
    )).toEqual([0n]);

    const incompleteState = mergeCallerStateForArgumentRefresh(
      currentState, { 'items$len': 64n }, [{ name: 'items', type: 'Item[]' }],
    );
    expect(incompleteState).not.toHaveProperty('items');
    expect(evaluator._resolveExternalArgs(
      [sourceExpression], [], artifact, incompleteState, [], undefined, 0, true,
    )).toBeUndefined();

    const completeState = mergeCallerStateForArgumentRefresh(
      currentState, { 'items$len': 64n, items: [1n] }, [{ name: 'items', type: 'Item[]' }],
    );
    expect(evaluator._resolveExternalArgs(
      [sourceExpression], [], artifact, completeState, [], undefined, 0, true,
    )).toEqual([0n]);

    expect(mergeCallerStateForArgumentRefresh(
      { items: [1n] }, { 'items$len': 0n }, [{ name: 'items', type: 'Item[]' }],
    ).items).toEqual([]);
  });
});

describe('conditional external-call topology', () => {
  it('recognizes a state-derived external target as a direct physical identity', () => {
    const physicalLock = Uint8Array.of(0xaa, 0x20, ...new Uint8Array(32).fill(0x57), 0x87);
    const owner = {
      inputs: [],
      externalCalls: [{
        interfaceName: 'ITarget', functionName: 'run', requiredDataNftIndices: [],
        addressStateVar: 'target',
        addressSource: { kind: 'expression', expression: { kind: 'state', name: 'target' } },
      }],
    } as unknown as Artifact['abi'][number];
    const resolved = evaluator._resolveExternalArgs(
      [owner.externalCalls![0].addressSource!], [], artifact, { target: physicalLock }, owner.inputs,
    )?.[0];

    expect(externalCallTargetSourceLockingBytecodeHex(owner, 0, [], resolved))
      .toBe(binToHex(physicalLock));
  });

  it('retains a reached call when completed caller state invalidates its earlier guard', () => {
    const guard: ExternalCallExpression = {
      kind: 'binary',
      operator: '>',
      left: source(0),
      right: { kind: 'state', name: 'amount' },
    };
    const initialReachability = evaluator._evaluateExternalExpression(
      guard, [200n], artifact, { amount: 100n }, [{ type: 'uint256' }],
    );
    const postStateReachability = evaluator._evaluateExternalExpression(
      guard, [200n], artifact, { amount: 200n }, [{ type: 'uint256' }],
    );

    expect(initialReachability).toBe(true);
    expect(canRefreshReachedCallFromPostState(postStateReachability)).toBe(false);
  });

  it('uses ABI-valid placeholders for inactive fixed route bands', () => {
    expect(inactiveMessageBusRouteWitness('string')).toBe('');
    expect(inactiveMessageBusRouteWitness('uint256')).toBe(0n);
    expect(inactiveMessageBusRouteWitness('bytes4')).toEqual(new Uint8Array(4));
    expect(inactiveMessageBusRouteWitness('bool[2]')).toEqual([false, false]);
    expect(inactiveMessageBusRouteWitness('address')).toHaveLength(25);
  });

  it('maps stable callsite slots after an earlier conditional call is omitted', () => {
    const externalCalls = [
      { callsiteId: 4, occurrence: 'conditional' },
      { callsiteId: 7, occurrence: 'conditional' },
    ];
    const groupByCallsite = new Map([[7, 22]]);

    expect(groupIndexForExternalCallSlot({
      slot: 0, externalCalls, groupByCallsite, compactGroups: [22],
    })).toBeUndefined();
    expect(groupIndexForExternalCallSlot({
      slot: 1, externalCalls, groupByCallsite, compactGroups: [22],
    })).toBe(22);
  });

  it('maps compact return-witness ordinals across non-returning call slots', () => {
    const externalCalls = [
      { hasReturnValues: true },
      { hasReturnValues: false },
      { hasReturnValues: true },
      { hasReturnValues: true },
    ];

    expect(externalReturnParamSlot('__internal__externalReturnOutputIdx0', externalCalls)).toBe(0);
    expect(externalReturnParamSlot('__internal__externalReturnOutputIdx1', externalCalls)).toBe(2);
    expect(externalReturnParamSlot('__internal__externalReturnOutputIdx2', externalCalls)).toBe(3);
  });

  it('follows a shared proxy master to its compiler-route selector', () => {
    const proxy = {
      functionName: '__forward', delegateCallGroupIndex: 0,
      externalContract: { inner: { artifact: { abi: [{ name: '__forward', selector: 'aaaaaaaa' }] } } },
    };
    const sharedView = {
      ...proxy, sharedGroupIndex: 0, delegateCallGroupIndex: undefined, functionName: 'userRegistered',
    };
    const delegate = {
      functionName: '_batchRaw', compilerRoute: { selector: hexToBin('53434231') },
      externalContract: { inner: { artifact: { abi: [{ name: '_batchRaw', selector: '53434231' }] } } },
    };

    expect(physicalExternalCallSelectorHex([proxy, sharedView], [delegate], 1)).toBe('53434231');
  });

  it('treats physical call bases and master indices as SDK-owned route witnesses', () => {
    expect(isSdkResolvedExternalCallTopologyWitness('__internal__externalCallInputBase')).toBe(true);
    expect(isSdkResolvedExternalCallTopologyWitness('__internal__extcallMasterIdx6')).toBe(true);
    expect(isSdkResolvedExternalCallTopologyWitness('__internal__extcallAnchorIdx6')).toBe(true);
    expect(isSdkResolvedExternalCallTopologyWitness('__internal__vmapBatchProof_0')).toBe(false);
  });
});
