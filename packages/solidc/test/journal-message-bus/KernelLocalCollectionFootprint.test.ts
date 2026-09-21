import { describe, expect, it } from 'vitest';
import { createMapResolver } from '../../src/createMapResolver.js';
import { compileString } from '../../src/compiler.js';
import type { CompilerOptions } from '../../src/compiler.js';

describe('kernel local collection footprint', () => {
  it('does not classify an indexed field of an imported struct local as contract storage', () => {
    const attemptFailureBox = { failures: [] as unknown[] };
    const artifact = compileString(`
      pragma solidity ^0.8.20;
      import { Snapshot } from "./Types.scash";

      interface Remote {
        function read(uint key) external view returns (Snapshot memory);
        function apply(uint key, uint value) external;
      }

      contract Coordinator {
        Remote immutable remote;
        event Applied(uint indexed key, uint value);

        constructor(address target) { remote = Remote(target); }

        function update(uint key) external {
          Snapshot memory snapshot = remote.read(key);
          snapshot.values[0] = snapshot.values[0] + 1;
          remote.apply(key, snapshot.values[0]);
          emit Applied(key, snapshot.values[0]);
        }
      }
    `, {
      forceStateful: true,
      solidityImportCompat: true,
      messageBus: true,
      messageBusKernel: true,
      messageBusGraphContext: true,
      maximumInputBytes: 1_000_000,
      commitmentLimit: 1_000_000,
      optimizeForCompilationSpeed: true,
      suppressWarnings: true,
      __artifactCache: false,
      __attemptFailureBox: attemptFailureBox,
      __strictNoInternalRecovery: true,
      importResolver: createMapResolver({
        '/Types.scash': 'pragma solidity ^0.8.20; struct Snapshot { uint[2] values; }',
      }),
      rootFileId: '/Coordinator.sol',
    } as CompilerOptions);

    expect(attemptFailureBox.failures).toEqual([]);
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'update'))
      .toMatchObject({ eligible: true });
    expect(artifact.bytecode.replace(/\s+/g, '')).toContain('OP_INVOKE');
  });
});
