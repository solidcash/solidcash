import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';
import type { CompilerOptions } from '../../src/compiler.js';

describe('external-result physical slot identity', () => {
  it('uses the authenticated physical result ordinal for a late-cloned helper call', () => {
    const failures: unknown[] = [];
    const artifact = compileString(`pragma solidity ^0.8.20;
      interface IReader { function read(uint key) external view returns (uint); }
      struct Record { address payable buyer; address currency; uint amount; uint value; }
      library Raw {
        function invoke(address target, bytes memory data) internal returns (bytes memory) {
          return withValue(target, data, 0, "failed");
        }
        function withValue(address target, bytes memory data, uint value, string memory reason)
          internal returns (bytes memory) {
          (bool success, bytes memory result) = target.call{value: value}(data);
          return verify(target, success, result, reason);
        }
        function verify(address, bool success, bytes memory result, string memory reason)
          internal pure returns (bytes memory) {
          if (success) { return result; } else { revert(reason); }
        }
      }
      contract Registry(address reader) {
        mapping(uint => Record) records;
        event Done(uint key, Record item);
        function execute(uint key, bytes calldata payload) external {
          Record memory item = records[key];
          uint observed = IReader(reader).read(key);
          item.value = observed;
          records[key].value = observed;
          if (item.currency == address(0)) {
            (bool success,) = item.buyer.call{value: item.amount}("");
            require(success);
          } else {
            bytes memory result = Raw.invoke(item.currency, payload);
            require(result.length >= 0);
          }
          emit Done(key, item);
        }
      }`, {
      forceStateful: true,
      solidityImportCompat: true,
      messageBus: true,
      messageBusKernel: true,
      messageBusGraphContext: true,
      maximumInputBytes: 1_000_000,
      optimizeForCompilationSpeed: true,
      suppressWarnings: true,
      __artifactCache: false,
      __attemptFailureBox: { failures },
      __strictNoInternalRecovery: true,
    } as CompilerOptions);

    const calls = artifact.abi.find((entry) => entry.name === 'execute')?.externalCalls;
    expect(failures).toEqual([]);
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(calls).toMatchObject([
      { callsiteId: 0, interfaceName: 'IReader', functionName: 'read', hasReturnValues: true },
      { callsiteId: 1, interfaceName: '__raw__', functionName: '__raw__', hasReturnValues: true },
    ]);
    expect(artifact.bytecode.replace(/\s+/g, '')).toContain('OP_INVOKE');
  });
});
