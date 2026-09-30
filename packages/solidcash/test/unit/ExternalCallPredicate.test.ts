import { describe, expect, it } from 'vitest';
import { hash160 } from '@solidcash/utils';
import type {
  ArgSource, Artifact, ExternalCallAbi, ExternalCallExpression, FunctionArgument,
} from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { StatefulContract } from '../../src/index.js';
import {
  anchorRoutedDynamicResourcesAtOwner,
  compilerRouteUsesPhysicalWrapper,
  externalCallTargetSourceLockingBytecodeHex,
  externalReturnParamSlot,
  groupIndexForExternalCallSlot,
  inactiveMessageBusRouteWitness,
  isSdkResolvedExternalCallTopologyWitness,
  physicalExternalCallGroupIndexByMasterOutpoint,
  physicalExternalCallSelectorHex,
  rebaseRoutedBatchProofOffsets,
  selectedMessageBusResourceMetadata,
  createGraphPlanningProducerResultContext,
} from '../../src/stateful/StatefulContract.js';
import { createTestProvider } from '../test-util.js';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { expandResolveCreateBuilderExternalCalls } from '../../src/stateful/sc-expand-resolve-create-builder-external-calls.js';

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
    executionMsgSender?: FunctionArgument,
  ) => FunctionArgument[] | undefined;
  _planExternalCallOccurrences: (
    call: ExternalCallAbi,
    frame: Record<string, unknown>,
  ) => Promise<readonly { args: readonly FunctionArgument[] }[]>;
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
  it('short-circuits logical predicates but fails closed when an unresolved branch is required', () => {
    const literal = (value: boolean): ExternalCallExpression => ({ kind: 'literal', type: 'bool', value });
    const logical = (operator: '&&' | '||', left: boolean): ExternalCallExpression => ({
      kind: 'binary', operator, left: literal(left), right: { kind: 'identifier', name: 'missing' },
    });
    const evaluate = (expression: ExternalCallExpression): FunctionArgument | undefined =>
      evaluator._evaluateExternalExpression(expression, [], artifact, undefined, []);

    expect(evaluate(logical('&&', false))).toBe(false);
    expect(evaluate(logical('||', true))).toBe(true);
    expect(evaluate(logical('&&', true))).toBeUndefined();
    expect(evaluate(logical('||', false))).toBeUndefined();
  });

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

  it('distinguishes synthetic compiler routes from physical wrapper routes', () => {
    const selector = Uint8Array.of(1, 2, 3, 4);
    const route = { name: '__message_bus1', inputs: [] } as never;
    const wrapper = { name: '__forward', inputs: [] } as never;

    expect(compilerRouteUsesPhysicalWrapper(selector, undefined, route)).toBe(false);
    expect(compilerRouteUsesPhysicalWrapper(selector, wrapper, route)).toBe(true);
    expect(compilerRouteUsesPhysicalWrapper(selector, route, route)).toBe(false);
    expect(compilerRouteUsesPhysicalWrapper(undefined, wrapper, route)).toBe(false);
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

  it('resolves loop-index sources relative to the reached occurrence', () => {
    expect(evaluator._resolveExternalArgs(
      [{ kind: 'loopIndex', initialValue: '2', stepValue: '3' }],
      [], artifact, undefined, undefined, undefined, 4,
    )).toEqual([14n]);
  });

  it('resolves address(this) from the authenticated execution context', () => {
    const executionAddress = Uint8Array.of(0xaa, 0x20, ...new Uint8Array(32).fill(0x42), 0x87);
    expect(evaluator._resolveExternalArgs(
      [{ kind: 'selfAddress' }], [], artifact, undefined, undefined, undefined, 0, false,
      executionAddress,
    )).toEqual([executionAddress]);
  });

  it('resolves msg.sender from the authenticated execution frame independently of address(this)', () => {
    const executionAddress = Uint8Array.of(0xaa, 0x20, ...new Uint8Array(32).fill(0x42), 0x87);
    const executionSender = Uint8Array.of(0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x24), 0x88, 0xac);
    expect(evaluator._resolveExternalArgs(
      [{ kind: 'msgSender' }, { kind: 'selfAddress' }], [], artifact,
      undefined, undefined, undefined, 0, false, executionAddress, executionSender,
    )).toEqual([executionSender, executionAddress]);
  });

  it('selects mutually exclusive callsites using the authenticated execution-frame sender', async () => {
    const owner = Uint8Array.of(0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x24), 0x88, 0xac);
    const recipient = Uint8Array.of(0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x42), 0x88, 0xac);
    const sender: ExternalCallExpression = {
      kind: 'source', type: 'address', source: { kind: 'msgSender' },
    };
    const ownerArgument: ExternalCallExpression = {
      kind: 'source', type: 'address', source: { kind: 'forward', paramIndex: 0 },
    };
    const ownerMatchesSender: ExternalCallExpression = {
      kind: 'binary', operator: '==', type: 'bool', left: ownerArgument, right: sender,
    };
    const calls: ExternalCallAbi[] = [{
      callsiteId: 0, interfaceName: 'IReader', functionName: 'read', requiredDataNftIndices: [],
      occurrence: 'conditional',
      condition: { kind: 'unary', operator: '!', type: 'bool', expression: ownerMatchesSender },
      argSources: [{ kind: 'msgSender' }],
    }, {
      callsiteId: 1, interfaceName: 'IReader', functionName: 'read', requiredDataNftIndices: [],
      occurrence: 'conditional', condition: ownerMatchesSender,
      argSources: [{ kind: 'forward', paramIndex: 1 }],
    }];
    const frame = {
      functionArgs: [owner, recipient], artifact, registryOwner: evaluator, state: {},
      callerInputs: [{ type: 'address' }, { type: 'address' }],
      executionSelfAddress: new Uint8Array(35), executionMsgSender: owner,
      producerCalls: calls, planningContext: createGraphPlanningProducerResultContext(),
    };

    await expect(evaluator._planExternalCallOccurrences(calls[0], frame)).resolves.toEqual([]);
    await expect(evaluator._planExternalCallOccurrences(calls[1], frame)).resolves.toMatchObject([
      { args: [recipient] },
    ]);
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

  it('evaluates guarded pure-library arguments and rejects a failed guard', () => {
    const helperArtifact = compileString(`pragma solidity >=0.8.0;
      library Checked {
        function sub(uint256 a, uint256 b) internal pure returns (uint256) {
          require(b <= a);
          return a - b;
        }
        function mul(uint256 a, uint256 b) internal pure returns (uint256) {
          if (a == 0) return 0;
          uint256 product = a * b;
          require(product / a == b);
          return product;
        }
      }
      interface ISink { function publish(uint256 value) external; }
      contract GuardedArgument(address sink) {
        using Checked for uint256;
        function run(uint256 a, uint256 b) public {
          ISink(sink).publish(a.sub(b).mul(2));
          require(true);
        }
      }`, { solidityImportCompat: true, forceStateful: true });
    const expression = helperArtifact.abi.find((candidate) => candidate.name === 'run')
      ?.externalCalls?.[0].argSources?.[0].expression;
    expect(expression).toBeDefined();
    const helperEvaluator = new StatefulContract(
      '00'.repeat(32), helperArtifact, createTestProvider(), { constructorArgs: [new Uint8Array()] },
    ) as unknown as PredicateEvaluator;
    expect(helperEvaluator._evaluateExternalExpression(
      expression!, [10n, 3n], helperArtifact, undefined, [{ type: 'uint256' }, { type: 'uint256' }],
    )).toBe(14n);
    expect(helperEvaluator._evaluateExternalExpression(
      expression!, [3n, 10n], helperArtifact, undefined, [{ type: 'uint256' }, { type: 'uint256' }],
    )).toBeUndefined();
  });

  it('evaluates fixed-array element assignments in a compiler-published pure helper', () => {
    const helperArtifact = compileString(`
      pragma solidity >=0.8.0;
      uint constant FIRST = 0;
      uint constant SECOND = 1;
      uint constant LAST = 2;
      uint constant SCALE = 100;
      function distribute(uint amount, uint16[3] splits) pure returns (uint[3]) {
        uint[3] values;
        values[FIRST] = uint(splits[FIRST]) * amount / SCALE;
        values[SECOND] = uint(splits[SECOND]) * amount / SCALE;
        values[LAST] = amount - values[FIRST] - values[SECOND];
        return values;
      }
      interface ISink { function publish(uint value) external; }
      contract HelperCaller(address sink) {
        function run(uint amount, uint16[3] splits) public {
          uint[3] memory values = distribute(amount, splits);
          ISink(sink).publish(values[2]);
          ISink(sink).publish(values[0]);
          require(amount >= 0);
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
      expression!, [1000n, [20n, 30n, 50n]], helperArtifact, undefined,
      [{ type: 'uint' }, { type: 'uint16[3]' }],
    )).toBe(500n);
  });

  it.each([
    ['scalar state', 'Record current;', '',
      'current.enabled = flags.length > 0;', 'current.enabled'],
    ['mapping state', 'mapping(uint => Record) records;', '',
      'records[7].enabled = flags.length > 0;', 'records[7].enabled'],
    ['state-array storage alias', 'Record[] records;', `records.push();
      uint id = records.length - 1;
      Record storage record = records[id];`,
    'record.enabled = flags.length > 0;', 'record.enabled'],
  ])('resolves a field from its dominating %s struct write without application names',
    (_label, declaration, setup, assignment, read) => {
      const snapshotArtifact = compileString(`
        pragma solidity ^0.8.0;
        interface ISink { function accept(bytes calldata value) external; }
        contract Registry {
          struct Record { bool enabled; }
          ${declaration}
          address sink;
          function publish(bool[] calldata flags) public {
            ${setup}
            ${assignment}
            ISink(sink).accept(abi.encodePacked(${read}));
            require(true);
          }
        }
      `, {
        solidityImportCompat: true, forceStateful: true, messageBus: true, messageBusKernel: true,
        maximumInputBytes: 1_000_000,
      });
      const publish = snapshotArtifact.abi.find((candidate) => candidate.name === 'publish')!;
      const sources = publish.externalCalls?.[0].argSources;
      expect(sources).toBeDefined();
      expect(JSON.stringify(sources)).not.toContain('stateAccess');

      const snapshotEvaluator = new StatefulContract(
        '00'.repeat(32), snapshotArtifact, createTestProvider(),
      ) as unknown as PredicateEvaluator;
      expect(snapshotEvaluator._resolveExternalArgs(
        sources!, [[]], snapshotArtifact, {}, publish.inputs,
      )).toEqual([Uint8Array.of(0)]);
      expect(snapshotEvaluator._resolveExternalArgs(
        sources!, [[true]], snapshotArtifact, {}, publish.inputs,
      )).toEqual([Uint8Array.of(1)]);
    });

  it('preserves a dominating field type for packed external-call arguments', () => {
    const typedArtifact = compileString(`
      pragma solidity ^0.8.0;
      interface ISink { function accept(bytes calldata value) external; }
      contract Registry {
        struct Record { uint16 number; }
        mapping(uint => Record) records;
        address sink;
        function publish(uint id, uint16 number) public {
          records[id].number = number;
          ISink(sink).accept(abi.encodePacked(records[id].number));
          require(true);
        }
      }
    `, {
      solidityImportCompat: true, forceStateful: true, messageBus: true, messageBusKernel: true,
      maximumInputBytes: 1_000_000,
    });
    const publish = typedArtifact.abi.find((candidate) => candidate.name === 'publish')!;
    const sources = publish.externalCalls?.[0].argSources;
    const typedEvaluator = new StatefulContract(
      '00'.repeat(32), typedArtifact, createTestProvider(),
    ) as unknown as PredicateEvaluator;
    expect(typedEvaluator._resolveExternalArgs(
      sources!, [7n, 2n], typedArtifact, {}, publish.inputs,
    )).toEqual([Uint8Array.of(0, 2)]);
  });

  it('does not snapshot a conditional state-array struct write as unconditional', () => {
    const conditionalArtifact = compileString(`
      pragma solidity ^0.8.0;
      interface ISink { function accept(bytes calldata value) external; }
      contract Registry {
        struct Record { bool enabled; }
        Record[] records;
        address sink;
        function publish(bool[] calldata flags, bool update) public {
          records.push();
          uint id = records.length - 1;
          Record storage record = records[id];
          record.enabled = flags.length > 0;
          if (update) record.enabled = false;
          ISink(sink).accept(abi.encodePacked(record.enabled));
          require(true);
        }
      }
    `, {
      solidityImportCompat: true, forceStateful: true, messageBus: true, messageBusKernel: true,
      maximumInputBytes: 1_000_000,
    });
    const sources = conditionalArtifact.abi.find((candidate) => candidate.name === 'publish')
      ?.externalCalls?.[0].argSources;
    expect(sources).toBeDefined();
    expect(JSON.stringify(sources)).toContain('arrayAccess');
    expect(JSON.stringify(sources)).not.toContain('"name":"Record"');
  });

  it('packs a zero address cast to uint160 as the compiler zero value', () => {
    const expression: ExternalCallExpression = {
      kind: 'abiEncodePacked', fields: ['uint160'], args: [source(0)],
    };

    expect(evaluator._evaluateExternalExpression(
      expression, [`0x${'00'.repeat(20)}`], artifact, undefined, [{ type: 'address' }],
    )).toEqual(new Uint8Array());
  });

  it.each([0, 0x47])('strips ABI framing from a packed uint160 address word (byte %s)', (byte) => {
    const identity = new Uint8Array(20).fill(byte);
    const word = Uint8Array.of(...new Uint8Array(12), ...identity);
    const expression: ExternalCallExpression = {
      kind: 'abiEncodePacked', fields: ['uint160', 'bool'],
      args: [source(0), { kind: 'literal', type: 'bool', value: true }],
    };

    expect(evaluator._evaluateExternalExpression(
      expression, [word], artifact, undefined, [{ type: 'address' }],
    )).toEqual(Uint8Array.of(...identity, 1));
  });

  it('preserves Solidity-compatible BCH locks in packed uint160 expressions', () => {
    const lock = Uint8Array.of(0xaa, 0x20, ...new Uint8Array(32).fill(0x53), 0x87);
    const expression: ExternalCallExpression = {
      kind: 'abiEncodePacked', fields: ['uint160'], args: [source(0)],
    };
    expect(evaluator._evaluateExternalExpression(
      expression, [lock], artifact, undefined, [{ type: 'address' }],
    )).toEqual(lock);
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

  it('auto-resolves a state-pinned callee without an interface-name registration', async () => {
    const physicalLock = Uint8Array.of(0xaa, 0x20, ...new Uint8Array(32).fill(0x58), 0x87);
    const callee = { categoryId: 'ab'.repeat(32) };
    const fn = {
      name: 'run', inputs: [], externalCalls: [{
        interfaceName: 'IData', functionName: 'ping', requiredDataNftIndices: [], argSources: [],
        addressSource: { kind: 'expression', expression: { kind: 'state', name: 'target' } },
      }],
    } as unknown as Artifact['abi'][number];
    const resolved = await expandResolveCreateBuilderExternalCalls({
      getExternalTargetEntriesByInterface: () => [],
      getExternalRegistryEntry: () => undefined,
      getExternalDeploymentByAddressValue: (value) =>
        value instanceof Uint8Array && binToHex(value) === binToHex(physicalLock) ? callee : undefined,
      getFullState: async () => ({ state: { target: physicalLock } }),
      resolveExternalArgs: (...args) => (
        evaluator._resolveExternalArgs as (...values: any[]) => FunctionArgument[] | undefined
      )(...args),
    }, fn, [], artifact, undefined, undefined);
    expect(resolved.resolvedExternalCalls).toEqual([{
      externalContract: callee, functionName: 'ping', args: [],
    }]);
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

  it('interns repeated callsites by the exact consumed master outpoint', () => {
    const first = { masterUtxo: { txid: 'AA'.repeat(32), vout: 2 } };
    const alias = { masterUtxo: { txid: 'aa'.repeat(32), vout: 2 }, sharedGroupIndex: 0 };
    const groups = [first, alias];

    expect(physicalExternalCallGroupIndexByMasterOutpoint(
      groups, { txid: 'Aa'.repeat(32), vout: 2 },
    )).toBe(0);
    expect(physicalExternalCallGroupIndexByMasterOutpoint(
      groups, { txid: 'aa'.repeat(32), vout: 3 },
    )).toBe(-1);
    expect(physicalExternalCallGroupIndexByMasterOutpoint(
      groups, { txid: 'bb'.repeat(32), vout: 2 },
    )).toBe(-1);
  });

  it('treats physical call bases and master indices as SDK-owned route witnesses', () => {
    expect(isSdkResolvedExternalCallTopologyWitness('__internal__externalCallInputBase')).toBe(true);
    expect(isSdkResolvedExternalCallTopologyWitness('__internal__extcallMasterIdx6')).toBe(true);
    expect(isSdkResolvedExternalCallTopologyWitness('__internal__extcallAnchorIdx6')).toBe(true);
    expect(isSdkResolvedExternalCallTopologyWitness('__internal__vmapBatchProof_0')).toBe(false);
  });

  it('selects the array element a reached loop occurrence actually evaluates', () => {
    // A runtime loop's callsite is expanded once per reached occurrence, so an induction-variable element index
    // advances with it. Freezing the index on the first element makes every later row carry an argument the
    // callee row it is paired with never evaluated.
    const resolveAt = (occurrenceIndex: number): FunctionArgument[] | undefined =>
      evaluator._resolveExternalArgs(
        [{ kind: 'arrayElement', paramIndex: 0, indexValue: 0, indexStepValue: 1 }],
        [['DV', 'test', 'DA']], artifact, undefined, [{ type: 'string[]' }], undefined, occurrenceIndex,
      );

    expect(resolveAt(0)).toEqual(['DV']);
    expect(resolveAt(1)).toEqual(['test']);
    expect(resolveAt(2)).toEqual(['DA']);
  });

  it('does not advance a literal array index between reached occurrences', () => {
    // A published zero step marks an index the compiler proved does not depend on the loop variable, so every
    // reached occurrence must keep selecting the same element.
    const resolveAt = (occurrenceIndex: number): FunctionArgument[] | undefined =>
      evaluator._resolveExternalArgs(
        [{ kind: 'arrayElement', paramIndex: 0, indexValue: 1, indexStepValue: 0 }],
        [['DV', 'test', 'DA']], artifact, undefined, [{ type: 'string[]' }], undefined, occurrenceIndex,
      );

    expect(resolveAt(0)).toEqual(['test']);
    expect(resolveAt(2)).toEqual(['test']);
  });
});
