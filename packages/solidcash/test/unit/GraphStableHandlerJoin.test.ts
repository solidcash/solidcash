/**
 * F5″: kernel graph joins use published selector; name is diagnostic only.
 */
import { describe, expect, it } from 'vitest';
import type { Artifact } from '@solidcash/utils';
import {
  findMessageBusHandlerByNameOrSelector,
  findMessageBusHandlerForInvocation,
} from '../../src/message-bus/graph-handler-join.js';

const kernelArtifact = (handlers: Array<{ name: string; selector: string }>): Artifact => ({
  contractName: 'Store',
  constructorInputs: [],
  abi: [],
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

describe('F5″ graph stable handler join', () => {
  it('kernel joins by selector even when diagnostic name is renamed', () => {
    const artifact = kernelArtifact([
      { name: 'set', selector: 'a9059cbb' },
      { name: 'bump', selector: 'deadbeef' },
    ]);
    const byOriginal = findMessageBusHandlerForInvocation(artifact, {
      function: 'set',
      selectorHex: 'a9059cbb',
    });
    const byRenamed = findMessageBusHandlerForInvocation(artifact, {
      function: 'renamedSet',
      selectorHex: 'a9059cbb',
    });
    expect(byOriginal?.selector).toBe('a9059cbb');
    expect(byRenamed?.selector).toBe('a9059cbb');
    expect(byRenamed?.name).toBe('set');
  });

  it('kernel fails closed when selector is omitted (name-only is not authority)', () => {
    const artifact = kernelArtifact([{ name: 'set', selector: 'a9059cbb' }]);
    expect(() => findMessageBusHandlerByNameOrSelector(artifact, { name: 'set' }))
      .toThrow(/requires selector/);
  });

  it('kernel returns undefined when selector is unknown (no name fallback)', () => {
    const artifact = kernelArtifact([{ name: 'set', selector: 'a9059cbb' }]);
    expect(findMessageBusHandlerForInvocation(artifact, {
      function: 'set',
      selectorHex: '00000000',
    })).toBeUndefined();
  });

  it('legacy may still join by name when selector mismatches', () => {
    const artifact = legacyArtifact([{ name: 'set', selector: 'a9059cbb' }]);
    expect(findMessageBusHandlerForInvocation(artifact, {
      function: 'set',
      selectorHex: 'ffffffff',
    })?.name).toBe('set');
  });
});
