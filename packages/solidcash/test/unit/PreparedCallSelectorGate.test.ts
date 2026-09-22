/**
 * F26: prepared-call ↔ plan invocation matching uses selector under kernel.
 */
import { describe, expect, it } from 'vitest';
import type { Artifact } from '@solidcash/utils';
import { preparedCallMatchesPlanInvocation } from '../../src/message-bus/message-bus.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const kernelArtifact = (handlers: Array<{ name: string; selector: string }>): Artifact => ({
  contractName: 'Store',
  constructorInputs: [],
  abi: handlers.map((handler) => ({
    name: handler.name,
    inputs: [],
    selector: handler.selector,
  })),
  bytecode: '',
  source: '',
  compiler: { name: 'solidc', version: '0' },
  updatedAt: '',
  messageBus: {
    version: 1,
    selector: '53434231',
    convention: 'kernel-row-loop',
    maximumRows: 4,
    maximumBlobBytes: 1000,
    route: { name: '__message_bus1', inputs: [], selector: '53434231' },
    handlers: handlers.map((handler) => ({
      name: handler.name,
      selector: handler.selector,
      inputs: [],
      eligible: true,
    })),
  },
} as unknown as Artifact);

const legacyArtifact = (handlers: Array<{ name: string; selector: string }>): Artifact => {
  const artifact = kernelArtifact(handlers);
  artifact.messageBus!.convention = 'legacy-unroll';
  return artifact;
};

describe('F26 prepared-call selector gate', () => {
  it('kernel accepts renamed functionName when transported selector matches', () => {
    const artifact = kernelArtifact([{ name: 'set', selector: 'a9059cbb' }]);
    expect(preparedCallMatchesPlanInvocation(
      { functionName: 'renamedSet', selector: 'a9059cbb', artifact },
      { function: 'set', selectorHex: 'a9059cbb' },
    )).toBe(true);
  });

  it('kernel accepts renamed functionName when plan selector resolves on the artifact', () => {
    const artifact = kernelArtifact([{ name: 'set', selector: 'a9059cbb' }]);
    // No transported selector — F25 resolve by plan selector still matches.
    expect(preparedCallMatchesPlanInvocation(
      { functionName: 'renamedSet', artifact },
      { function: 'set', selectorHex: 'a9059cbb' },
    )).toBe(true);
  });

  it('kernel refuses wrong selector even when diagnostic names match', () => {
    const artifact = kernelArtifact([{ name: 'set', selector: 'a9059cbb' }]);
    expect(preparedCallMatchesPlanInvocation(
      { functionName: 'set', selector: 'deadbeef', artifact },
      { function: 'set', selectorHex: 'a9059cbb' },
    )).toBe(false);
    expect(preparedCallMatchesPlanInvocation(
      { functionName: 'set', artifact },
      { function: 'set', selectorHex: '00000000' },
    )).toBe(false);
  });

  it('legacy still requires function-name equality', () => {
    const artifact = legacyArtifact([{ name: 'set', selector: 'a9059cbb' }]);
    expect(preparedCallMatchesPlanInvocation(
      { functionName: 'renamedSet', selector: 'a9059cbb', artifact },
      { function: 'set', selectorHex: 'a9059cbb' },
    )).toBe(false);
    expect(preparedCallMatchesPlanInvocation(
      { functionName: 'set', selector: 'a9059cbb', artifact },
      { function: 'set', selectorHex: 'a9059cbb' },
    )).toBe(true);
  });

  it('compose.ts drives preparedCallMatchesPlanInvocation (not raw name inequality)', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, '../../src/message-bus/compose.ts'), 'utf8');
    expect(src).toContain('preparedCallMatchesPlanInvocation');
    const codeLines = src.split('\n').filter((line) => {
      const t = line.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    });
    const rawNameGate = codeLines.filter((line) => (
      /functionName\s*!==\s*invocation\.function\b/.test(line)
    ));
    expect(rawNameGate).toEqual([]);
  });
});
