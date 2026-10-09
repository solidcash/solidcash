import { describe, expect, it } from 'vitest';
import { createMapResolver } from '../../src/index.js';
import { compileString } from '../../src/compiler.js';
import type { CompilerOptions } from '../../src/compiler.js';

describe('kernel single-entry journal aggregate results', () => {
  it('preserves an imported aggregate result through a graph handler with one journal entry', () => {
    const failures: unknown[] = [];
    const artifact = compileString(`pragma solidity ^0.8.20;
      import "./Types.scash";
      interface IObserver { function observe(uint key) external view returns (uint); }
      contract Snapshot(address observer) {
        mapping(uint => Entry) entries;
        function inspect(uint key) external view returns (Aggregate memory) {
          uint observed = IObserver(observer).observe(key);
          return Aggregate(entries[key], observed);
        }
      }`, {
      forceStateful: true,
      evmCompat: true,
      importResolver: createMapResolver({
        '/Types.scash': `pragma solidity ^0.8.20;
          struct Entry { uint value; }
          struct Aggregate { Entry entry; uint observed; }`,
      }),
      rootFileId: '/Snapshot.sol',
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

    expect(failures).toEqual([]);
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'inspect'))
      .toMatchObject({ eligible: true, outputs: [{ type: 'Aggregate' }] });
    expect(artifact.bytecode.replace(/\s+/g, '')).toContain('OP_INVOKE');
  });
});
