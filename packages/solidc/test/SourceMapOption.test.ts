import { describe, expect, it } from 'vitest';
import { bytecodeToScript, sourceMapToLocationData } from '@solidcash/utils';
import { hexToBin } from '@bitauth/libauth';
import { compileString, compileStringMulti } from '../src/index.js';
import type { Artifact } from '@solidcash/utils';

const SOURCE = `
  contract Store() {
    uint256 a;
    uint256 b;
    function set(uint256 v) public {
      this.a = v; this.b = v; require(this.a == this.b);
    }
  }
`;

const collectSourceMaps = (artifact: Artifact): string[] => {
  const maps = [artifact.debug?.sourceMap ?? ''];
  for (const debug of Object.values(artifact.debug?.functionDebug ?? {})) maps.push(debug.sourceMap);
  for (const debug of Object.values(artifact.debug?.invokeDebug ?? {})) maps.push(debug.sourceMap);
  return maps;
};

describe('sourceMap compiler option', () => {
  it('emits bytecode source maps by default', () => {
    const artifact = compileString(SOURCE, { messageBus: false });
    expect(collectSourceMaps(artifact).some((map) => map.length > 0)).toBe(true);
    expect(artifact.debug?.requires.some((entry) => entry.line > 0)).toBe(true);
  });

  it('skips encoding source maps when sourceMap is false', () => {
    const artifact = compileString(SOURCE, { messageBus: false, sourceMap: false });
    expect(collectSourceMaps(artifact).every((map) => map === '')).toBe(true);
    expect(artifact.debug?.bytecode.length).toBeGreaterThan(0);
    expect(artifact.debug?.requires.some((entry) => entry.line > 0)).toBe(true);
    expect(artifact.compiler.options?.sourceMap).toBe(false);
  });

  it('skips encoding source maps on the multi-artifact path when sourceMap is false', () => {
    const map = compileStringMulti(SOURCE, {
      messageBus: true,
      sourceMap: false,
      compileDeclarations: ['Store'],
    });
    expect(map.Store.compiler.options?.__cheapAdmissionCodegen).toBeUndefined();
    expect(collectSourceMaps(map.Store).every((entry) => entry === '')).toBe(true);
    expect(map.Store.debug?.bytecode.length).toBeGreaterThan(0);
  });

  it('keeps every unoptimised kernel instruction aligned with its source location', () => {
    const failures: unknown[] = [];
    const artifact = compileString(SOURCE, {
      messageBus: true,
      messageBusKernel: true,
      forceStateful: true,
      optimise: false,
      __artifactCache: false,
      __attemptFailureBox: { failures },
      __strictNoInternalRecovery: true,
    });
    expect(failures).toEqual([]);
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    let checked = 0;
    for (const debug of [artifact.debug, ...Object.values(artifact.debug?.functionDebug ?? {}),
      ...Object.values(artifact.debug?.invokeDebug ?? {})]) {
      if (!debug.bytecode) continue;
      expect(sourceMapToLocationData(debug.sourceMap)).toHaveLength(
        bytecodeToScript(hexToBin(debug.bytecode)).length,
      );
      checked += 1;
    }
    expect(checked).toBeGreaterThan(0);
    const optimised = compileString(SOURCE, {
      messageBus: true, messageBusKernel: true, forceStateful: true, optimise: true, __artifactCache: false,
    });
    expect(optimised.messageBus?.convention).toBe('kernel-row-loop');
    expect(optimised.abi.map((entry) => entry.selector)).toEqual(artifact.abi.map((entry) => entry.selector));
  });
});
