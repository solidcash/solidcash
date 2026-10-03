import { decodeAuthenticationInstructions, hexToBin, OpcodesBCH } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const SOURCE = `pragma solidity ^0.8.0;
  contract NestedTupleLedger {
    mapping(address => mapping(address => uint256)) private credits;

    function grant(address spender, uint256 amount) public {
      credits[msg.sender][spender] = amount;
      require(true);
    }

    function consume(address owner, uint256 amount) public {
      uint256 available = credits[owner][msg.sender];
      require(available >= amount);
      credits[owner][msg.sender] = available - amount;
      require(true);
    }
  }
`;

describe('kernel cross-handler nested-mapping tuple metadata', () => {
  it('keeps the synthesized sender-anchor name unavailable to source parameters', () => {
    expect(() => compileString(`pragma solidity ^0.8.0;
      contract SourceOwnedAnchor {
        function touch(uint256 __internal__msgSenderAnchorIdx) public {
          require(__internal__msgSenderAnchorIdx > 0);
        }
      }
    `, { solidityImportCompat: true })).toThrow(/uses reserved prefix '__internal__'/);
  });

  it.each([2, 7])(
    'allocates the two tuple recipes independently of the %i-row route bound',
    (maximumRows) => {
      const artifact = compileString(SOURCE, {
        forceStateful: true,
        solidityImportCompat: true,
        messageBus: true,
        messageBusKernel: true,
        __messageBusMaximumRows: maximumRows,
        maximumInputBytes: 10_000_000,
        optimizeForCompilationSpeed: true,
        suppressWarnings: true,
      });

      expect(artifact.messageBus?.maximumRows).toBe(maximumRows);
      const handlers = ['grant', 'consume'].map((name) => {
        const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === name);
        expect(handler).toMatchObject({ eligible: true });
        expect(handler?.batchKeyWitnesses).toHaveLength(2);
        return handler!;
      });
      expect(handlers.map((handler) => handler.batchKeyWitnesses?.map((binding) => [
        binding.source, binding.inputIndex,
      ]))).toEqual([
        [['msgSender', -2], ['argument', 0]],
        [['argument', 0], ['msgSender', -2]],
      ]);

      // `grant` addresses [msg.sender, spender], while `consume` addresses
      // [owner, msg.sender]. They are two physical tuple recipes, not one
      // route-global key and not one allocation per maximum route row.
      const tupleAccesses = artifact.messageBus?.route.entryAccesses?.filter(
        (access) => access.collection === 'credits',
      ) ?? [];
      expect(tupleAccesses).toHaveLength(2);
      expect(tupleAccesses.every((access) => access.keyParams.length === 2)).toBe(true);
      expect(new Set(tupleAccesses.map((access) => access.keyParams.join('\0'))).size).toBe(2);

      // One source access selects either fixed route lane as a complete tuple. The primary projection remains
      // one-to-one with the direct ABI; alternatives are aligned separately and never encoded as row copies.
      expect(handlers.map((handler) => handler.physicalEntrySlotAlternatives)).toEqual([
        [[0, 1]],
        [[0, 1]],
      ]);
      expect(artifact.messageBus?.route.sortedBatchInfo).toEqual([
        { collection: 'credits', slotIndices: [0, 1] },
      ]);
      expect(artifact.messageBus?.route.inputs.some((input) => /_r\d+$/.test(input.name))).toBe(false);
    },
  );

  it('retains a complete multi-lane batch declared by a routed handler', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract RoutedTransfer {
        mapping(address => uint256) private balances;
        function transfer(address from, address to, uint256 amount) public {
          balances[from] = balances[from] - amount;
          balances[to] = balances[to] + amount;
          require(true);
        }
      }
    `, {
      forceStateful: true, solidityImportCompat: true,
      messageBus: true, messageBusKernel: true,
      maximumInputBytes: 10_000_000, suppressWarnings: true,
    });

    expect(artifact.messageBus?.route.sortedBatchInfo).toEqual([
      { collection: 'balances', slotIndices: Array.from({ length: 9 }, (_, slot) => slot) },
    ]);
  });

  it('publishes selected-row loop resources on the handler descriptor', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract CompositeLedger {
        struct Record { address owner; uint256 amount; }
        mapping(uint256 => Record[]) private records;
        function set(uint256 key, address owner, uint256 amount) public {
          records[key].push(Record(owner, amount));
          require(true);
        }
      }
    `, {
      forceStateful: true, solidityImportCompat: true,
      messageBus: true, messageBusKernel: true,
      maximumInputBytes: 10_000_000, suppressWarnings: true,
    });

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'set')).toMatchObject({
      eligible: true,
      entryLoopWrites: ['records'],
    });
    const route = artifact.messageBus!.route;
    const instructions = decodeAuthenticationInstructions(hexToBin(artifact.functionBodies![route.selector]));
    const compactInsertGuard = [
      OpcodesBCH.OP_PICK, OpcodesBCH.OP_0, OpcodesBCH.OP_LESSTHAN, OpcodesBCH.OP_SUB,
      OpcodesBCH.OP_DUP, OpcodesBCH.OP_OUTPUTBYTECODE, OpcodesBCH.OP_2,
      OpcodesBCH.OP_PICK, OpcodesBCH.OP_EQUALVERIFY,
    ];
    expect(instructions.some((_, start) => compactInsertGuard.every(
      (opcode, offset) => instructions[start + offset]?.opcode === opcode,
    ))).toBe(false);
  });

  it('publishes independent two-entry lanes for repeated read-only mapping handlers', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract ReadOnlyLedger {
        mapping(string => string) public labels;
        mapping(uint256 => uint256) public scores;
      }
    `, {
      forceStateful: true, solidityImportCompat: true,
      messageBus: true, messageBusKernel: true,
      maximumInputBytes: 10_000_000, suppressWarnings: true,
    });

    const handlers = ['labels', 'scores'].map((name) => {
      const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === name);
      expect(handler).toMatchObject({
        eligible: true,
        batchKeyWitnesses: [expect.objectContaining({
          source: 'argument', inputIndex: 0,
          entryTupleGroup: expect.any(Number),
          alternateRouteInput: expect.stringMatching(/_alt$/),
        })],
        physicalEntrySlotAlternatives: [[expect.any(Number), expect.any(Number)]],
      });
      return handler!;
    });
    expect(new Set(handlers.map((handler) =>
      handler.batchKeyWitnesses?.[0].entryTupleGroup)).size).toBe(2);
    for (const collection of ['labels', 'scores']) {
      expect(artifact.messageBus?.route.entryAccesses?.filter((access) =>
        access.collection === collection)).toHaveLength(2);
    }
    expect(artifact.messageBus?.route.inputs.some((input) => /_r\d+$/.test(input.name))).toBe(false);
  });

  it('reserves a bounded write key pool only for graph-context repeated entry keys', () => {
    const source = `contract RepeatedWriter {
      mapping(uint => uint) private values;
      function set(uint key, uint value) public {
        values[key] = value;
        require(true);
      }
    }`;
    const options = {
      forceStateful: true, messageBus: true, messageBusKernel: true,
      maximumInputBytes: 1_000_000, optimizeForCompilationSpeed: true,
    } as const;
    const ordinary = compileString(source, options);
    const graph = compileString(source, { ...options, messageBusGraphContext: true });
    const expanded = compileString(source, {
      ...options, messageBusGraphContext: true, messageBusEntryPoolCapacity: 9,
    });
    const ordinaryWriter = ordinary.messageBus?.handlers.find((handler) => handler.name === 'set');
    const graphWriter = graph.messageBus?.handlers.find((handler) => handler.name === 'set');
    expect(ordinaryWriter).toMatchObject({ eligible: true, physicalEntrySlots: [0] });
    expect(ordinaryWriter?.physicalEntrySlotAlternatives).toBeUndefined();
    const pool = Array.from({ length: 8 }, (_unused, lane) =>
      lane === 0 ? '__message_bus_key_values_0' : `__message_bus_key_values_0_pool${lane}`);
    expect(graphWriter).toMatchObject({
      eligible: true,
      physicalEntrySlots: [0],
      physicalEntrySlotAlternatives: [Array.from({ length: 8 }, (_unused, slot) => slot)],
      batchKeyWitnesses: [expect.objectContaining({
        source: 'argument', inputIndex: 0, keyPool: pool,
      })],
    });
    expect(graph.messageBus?.route.sortedBatchInfo)
      .toContainEqual({ collection: 'values', slotIndices: Array.from({ length: 8 }, (_unused, slot) => slot) });
    expect(graph.compiler.options?.messageBusEntryPoolCapacity).toBeUndefined();
    expect(expanded.compiler.options?.messageBusEntryPoolCapacity).toBe(9);
    expect(expanded.messageBus?.handlers.find((handler) => handler.name === 'set')
      ?.physicalEntrySlotAlternatives)
      .toEqual([Array.from({ length: 9 }, (_unused, slot) => slot)]);
    expect(expanded.messageBus?.route.entryAccesses).toHaveLength(9);
    for (const capacity of [0, 1.5, 100]) {
      expect(() => compileString(source, {
        ...options, messageBusGraphContext: true, messageBusEntryPoolCapacity: capacity,
      })).toThrow('messageBusEntryPoolCapacity must be an integer between 1 and 99');
    }
  });

  it('reserves three complete nested-mapping tuple lanes when explicitly requested', () => {
    const source = `contract NestedWriter {
      mapping(uint => mapping(uint => uint)) private values;
      function set(uint outer, uint inner, uint value) public {
        values[outer][inner] = value;
        require(true);
      }
    }`;
    const options = {
      forceStateful: true, messageBus: true, messageBusKernel: true,
      messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      optimizeForCompilationSpeed: true,
    } as const;
    const ordinary = compileString(source, options);
    const expanded = compileString(source, { ...options, messageBusEntryPoolCapacity: 3 });
    expect(ordinary.messageBus?.handlers.find((handler) => handler.name === 'set')
      ?.physicalEntrySlotAlternatives).toEqual([[0, 1]]);
    expect(expanded.messageBus?.handlers.find((handler) => handler.name === 'set')
      ?.physicalEntrySlotAlternatives).toEqual([[0, 1, 2]]);
    expect(expanded.messageBus?.route.entryAccesses).toHaveLength(3);
  });
});
