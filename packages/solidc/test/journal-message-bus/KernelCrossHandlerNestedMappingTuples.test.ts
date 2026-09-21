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
      expect(artifact.messageBus?.route.inputs.some((input) => /_r\d+$/.test(input.name))).toBe(false);
    },
  );
});
