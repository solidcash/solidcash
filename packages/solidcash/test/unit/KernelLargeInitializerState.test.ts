import type { Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { MockNetworkProvider } from '../../src/network/mock/index.js';
import { deriveLargeMockInitializerState } from '../../src/stateful/upgrades.js';

describe('large mock initializer legacy fence', () => {
  const provider = new MockNetworkProvider({ consensus: { maximumInputBytes: 1_000_000 } });
  const legacy = {
    bytecode: 'OP_0 '.repeat(100_001).trim(),
    abi: [{ name: 'initialize', inputs: [{ name: 'counter_', type: 'int' }] }],
    stateLayout: { variables: [{ name: 'counter', type: 'int', nftIndex: 0, fieldIndex: 0 }] },
    compiler: { name: 'solidc', version: '0.14.0-beta.1' },
  } as Artifact;

  it('retains the explicitly legacy size-based shortcut', () => {
    expect(deriveLargeMockInitializerState([7n], 'initialize', legacy, provider)).toEqual({ counter: 7n });
  });

  it('never guesses kernel initializer state, including direct delegate artifacts without a route', () => {
    const direct = { ...legacy, compiler: { ...legacy.compiler, options: { messageBusKernel: true } } };
    const routed = { ...legacy, messageBus: { convention: 'kernel-row-loop' } } as Artifact;
    expect(deriveLargeMockInitializerState([7n], 'initialize', direct, provider)).toBeUndefined();
    expect(deriveLargeMockInitializerState([7n], 'initialize', routed, provider)).toBeUndefined();
  });
});
