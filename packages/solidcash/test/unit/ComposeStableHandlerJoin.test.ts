/**
 * F17: compose handler joins use the same selector-first helper as graph (F5″).
 * Name is diagnostic only under kernel-row-loop.
 */
import { describe, expect, it } from 'vitest';
import type { Artifact } from '@solidcash/utils';
import { findMessageBusHandlerForInvocation } from '../../src/message-bus/graph-handler-join.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

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

describe('F17 compose stable handler join', () => {
  it('compose entry helper joins by selector when diagnostic name is renamed', () => {
    const artifact = kernelArtifact([
      { name: 'set', selector: 'a9059cbb' },
      { name: 'bump', selector: 'deadbeef' },
    ]);
    // Compose call sites pass plan.invocations[*] through this same helper.
    const joined = findMessageBusHandlerForInvocation(artifact, {
      function: 'renamedSet',
      selectorHex: 'a9059cbb',
    });
    expect(joined?.name).toBe('set');
    expect(joined?.selector).toBe('a9059cbb');
  });

  it('kernel fails closed on unknown selector (no name fallback)', () => {
    const artifact = kernelArtifact([{ name: 'set', selector: 'a9059cbb' }]);
    expect(findMessageBusHandlerForInvocation(artifact, {
      function: 'set',
      selectorHex: '00000000',
    })).toBeUndefined();
  });

  it('compose.ts routes message-bus handler joins through findMessageBusHandlerForInvocation', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, '../../src/message-bus/compose.ts'), 'utf8');
    expect(src).toContain("from './graph-handler-join.js'");
    expect(src).toContain('findMessageBusHandlerForInvocation');
    const codeLines = src.split('\n').filter((line) => {
      const t = line.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    });
    // No remaining messageBus.handlers.find/some joins — compose uses the shared helper.
    const residualHandlerJoins = codeLines.filter((line) => (
      /handlers\.find\(/.test(line) || /handlers\.some\(/.test(line)
    ));
    expect(residualHandlerJoins).toEqual([]);
  });

  it('kernel ABI resolution prefers published selector over colliding name', () => {
    const artifact = kernelArtifact([
      { name: 'set', selector: 'a9059cbb' },
      { name: 'other', selector: '11111111' },
    ]);
    const published = findMessageBusHandlerForInvocation(artifact, {
      function: 'other', // colliding diagnostic name
      selectorHex: 'a9059cbb',
    });
    expect(published?.name).toBe('set');
    const selector = published!.selector.toLowerCase();
    const abi = artifact.abi.find((candidate) => candidate.selector?.toLowerCase() === selector);
    expect(abi?.name).toBe('set');
    // Name-only would have picked 'other' — selector authority wins.
    expect(artifact.abi.find((candidate) => candidate.name === 'other')?.selector).toBe('11111111');
  });
});
