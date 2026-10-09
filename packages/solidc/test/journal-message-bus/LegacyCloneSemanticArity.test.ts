import { describe, expect, it } from 'vitest';
import { createMapResolver } from '../../src/index.js';
import { compileString } from '../../src/compiler.js';
import type { CompilerOptions } from '../../src/compiler.js';

describe('legacy generated-clone semantic arity', () => {
  it('forwards hidden witnesses resolved after an imported chunkable entry type', () => {
    const failures: unknown[] = [];
    const artifact = compileString(`pragma solidity ^0.8.20;
      import "./Types.scash";
      interface IReader { function read(uint key) external view returns (uint); }
      contract Registry(address reader) {
        mapping(uint => Record) records;
        function update(uint key) external { records[key].flag = 1; }
        function relay(uint key) external view returns (uint) { return IReader(reader).read(key); }
      }`, {
      forceStateful: true,
      evmCompat: true,
      importResolver: createMapResolver({
        '/Types.scash': `pragma solidity ^0.8.20;
          struct Record { string note; uint flag; }`,
      }),
      rootFileId: '/Registry.sol',
      messageBus: true,
      messageBusKernel: false,
      messageBusGraphContext: true,
      maximumInputBytes: 1_000_000,
      optimizeForCompilationSpeed: true,
      suppressWarnings: true,
      __artifactCache: false,
      __attemptFailureBox: { failures },
      __strictNoInternalRecovery: true,
    } as CompilerOptions);

    const inputs = artifact.abi.find((entry) => entry.name === 'update')?.inputs ?? [];
    expect(failures).toEqual([]);
    expect(artifact.messageBus?.convention).toBe('legacy-unroll');
    expect(inputs.map((input) => input.name)).toEqual(expect.arrayContaining([
      '__internal__valueWitness_0',
      '__internal__leadingPushValue_0',
      '__internal__valueChunkOutputBase',
    ]));
    expect(artifact.bytecode.replace(/\s+/g, '')).toContain('OP_INVOKE');
  });
});
