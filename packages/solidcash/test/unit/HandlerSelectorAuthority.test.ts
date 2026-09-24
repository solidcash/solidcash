import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import type { Artifact } from '@solidcash/utils';
import {
  findKernelHandlerBySelector,
  findMessageBusHandlerForInvocation,
  normalizeMessageBusFunctionSelector,
  resolveMessageBusHandler,
  resolvePublishedHandlerForInvocation,
} from '../../src/message-bus/index.js';

const kernelArtifact = (handlers: Artifact['messageBus'] extends infer M
  ? M extends { handlers: infer H } ? H : never
  : never): Artifact => ({
  contractName: 'AuthProbe',
  constructorInputs: [],
  abi: handlers.map((handler) => ({
    name: handler.name,
    inputs: [],
    selector: handler.selector,
  })),
  bytecode: '',
  source: '',
  compiler: { name: 'solidc', version: '0.0.0' },
  updatedAt: '',
  messageBus: {
    convention: 'kernel-row-loop',
    handlers,
  },
} as Artifact);

/**
 * handler selector authority: resolveMessageBusHandler and findMessageBusHandlerForInvocation share
 * handler-selector-authority so kernel selector joins cannot drift.
 */
describe('handler selector authority handler-selector-authority', () => {
  it('normalizeMessageBusFunctionSelector accepts 0x / bare 4-byte hex', () => {
    expect(normalizeMessageBusFunctionSelector('0xAABBCCDD')).toBe('aabbccdd');
    expect(normalizeMessageBusFunctionSelector('aabbccdd')).toBe('aabbccdd');
    expect(normalizeMessageBusFunctionSelector('dead')).toBeUndefined();
  });

  it('resolveMessageBusHandler and findMessageBusHandlerForInvocation agree on kernel selector', () => {
    const artifact = kernelArtifact([
      {
        name: 'ping',
        selector: 'aabbccdd',
        eligible: true,
        effects: [],
        dynamicWrites: [],
      } as Artifact['messageBus']['handlers'][number],
      {
        name: 'pong',
        selector: '11223344',
        eligible: true,
        effects: [],
        dynamicWrites: [],
      } as Artifact['messageBus']['handlers'][number],
    ]);

    const viaResolve = resolveMessageBusHandler(artifact, 'diagnosticIgnored', '0xAABBCCDD');
    const viaFind = findMessageBusHandlerForInvocation(artifact, {
      function: 'alsoIgnored',
      selectorHex: 'aabbccdd',
    });
    const viaShared = resolvePublishedHandlerForInvocation(artifact, {
      function: 'x',
      selectorHex: 'AABBCCDD',
    });
    const viaKernel = findKernelHandlerBySelector(artifact, 'aabbccdd');

    expect(viaResolve?.name).toBe('ping');
    expect(viaFind?.name).toBe('ping');
    expect(viaShared?.name).toBe('ping');
    expect(viaKernel?.name).toBe('ping');
    expect(viaResolve).toBe(viaFind);
    expect(viaFind).toBe(viaShared);
  });

  it('message-bus.ts and graph-handler-join.ts import handler-selector-authority', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const messageBus = readFileSync(join(here, '../../src/message-bus/message-bus.ts'), 'utf8');
    const graphJoin = readFileSync(join(here, '../../src/message-bus/graph-handler-join.ts'), 'utf8');
    expect(messageBus).toContain("from './handler-selector-authority.js'");
    expect(graphJoin).toContain("from './handler-selector-authority.js'");
    expect(graphJoin).toContain('resolvePublishedHandlerForInvocation');
    expect(messageBus).toContain('findKernelHandlerBySelector');
  });
});
