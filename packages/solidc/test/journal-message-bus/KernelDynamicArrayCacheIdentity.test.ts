import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { compileFileMulti } from '../../src/compileFile.js';
import { CompilerOptions } from '../../src/compiler.js';

describe('kernel dynamic-array cache identity', () => {
  it('resolves indexed reads exposed after an imported struct storage alias is cached locally', () => {
    const failures: unknown[] = [];
    const source = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      'fixtures/dynamic-cache/CachedRecords.sol',
    );
    const options = {
      forceStateful: true,
      evmCompat: true,
      messageBus: true,
      messageBusKernel: true,
      messageBusGraphContext: true,
      maximumInputBytes: 1_000_000,
      optimizeForCompilationSpeed: true,
      suppressWarnings: true,
      __artifactCache: false,
      __attemptFailureBox: { failures },
      __strictNoInternalRecovery: true,
      compileDeclarations: ['CachedRecords'],
    } as CompilerOptions;

    const artifact = compileFileMulti(source, options).CachedRecords;
    expect(failures).toEqual([]);
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'update'))
      .toMatchObject({ eligible: true });
    expect(artifact.bytecode.replace(/\s+/g, '')).toContain('OP_INVOKE');
  });
});
