/**
 * resolveMessageBus selector-first: resolveMessageBusAbiFunction / resolveMessageBusHandler are selector-first under kernel.
 */
import { describe, expect, it } from 'vitest';
import type { Artifact } from '@solidcash/utils';
import {
  resolveMessageBusAbiFunction,
  resolveMessageBusHandler,
} from '../../src/message-bus/message-bus.js';

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

describe('resolveMessageBus selector-first resolveMessageBus* selector-first', () => {
  it('kernel ABI join succeeds when diagnostic name is alpha-renamed', () => {
    const artifact = kernelArtifact([
      { name: 'set', selector: 'a9059cbb' },
      { name: 'bump', selector: 'deadbeef' },
    ]);
    const resolved = resolveMessageBusAbiFunction(artifact, 'renamedSet', 'a9059cbb');
    expect(resolved?.name).toBe('set');
    expect(resolved?.selector).toBe('a9059cbb');
  });

  it('kernel handler join succeeds when diagnostic name collides with another entry', () => {
    const artifact = kernelArtifact([
      { name: 'set', selector: 'a9059cbb' },
      { name: 'other', selector: '11111111' },
    ]);
    // Name says "other" but selector points at set — selector wins.
    const handler = resolveMessageBusHandler(artifact, 'other', 'a9059cbb');
    expect(handler?.name).toBe('set');
    expect(handler?.selector).toBe('a9059cbb');
  });

  it('kernel fails closed on unknown selector (no name fallback)', () => {
    const artifact = kernelArtifact([{ name: 'set', selector: 'a9059cbb' }]);
    expect(() => resolveMessageBusAbiFunction(artifact, 'set', '00000000'))
      .toThrow(/does not identify an ABI function/);
    expect(resolveMessageBusHandler(artifact, 'set', '00000000')).toBeUndefined();
  });

  it('legacy still requires name+selector agreement', () => {
    const artifact = legacyArtifact([{ name: 'set', selector: 'a9059cbb' }]);
    expect(() => resolveMessageBusAbiFunction(artifact, 'renamedSet', 'a9059cbb'))
      .toThrow(/does not identify ABI function 'renamedSet'/);
    expect(resolveMessageBusAbiFunction(artifact, 'set', 'a9059cbb')?.name).toBe('set');
  });
});
