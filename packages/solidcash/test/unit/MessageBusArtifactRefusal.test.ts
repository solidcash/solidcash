import { compileString } from '@solidcash/solidc';
import type { Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { Contract, MessageBusArtifactError } from '../../src/index.js';
import { MockNetworkProvider } from '../../src/network/mock/index.js';
import {
  ContractBundle, ContractFactory, SplitContractBundle, StatefulContract,
} from '../../src/stateful/index.js';

// The shape a 0.52 message-bus build publishes: the ordinary artifact plus its `messageBus` record.
const legacy = {
  contractName: 'Legacy',
  constructorInputs: [],
  abi: [{ name: 'f', inputs: [{ name: 'x', type: 'int' }] }],
  bytecode: 'OP_1',
  compiler: { name: 'solidc', version: '0.52.1' },
  messageBus: { version: 1, selector: '53434231' },
} as unknown as Artifact;

describe('an artifact compiled with the message bus', () => {
  const provider = new MockNetworkProvider();

  it('is refused by name where a contract is built from it', () => {
    expect(() => new Contract(legacy, [], { provider })).toThrow(MessageBusArtifactError);
    expect(() => new Contract(legacy, [], { provider })).toThrow(/'Legacy' was compiled with the message bus/);
    expect(() => new ContractFactory(legacy, provider)).toThrow(MessageBusArtifactError);
  });

  it('is refused before deployment, upgrade, child registration or bundling uses it', async () => {
    await expect(StatefulContract.deploy(legacy, [], {} as never)).rejects.toThrow(MessageBusArtifactError);
    await expect(StatefulContract.upgrade({ newArtifact: legacy } as never)).rejects.toThrow(MessageBusArtifactError);
    expect(() => ContractBundle.from({ Legacy: legacy }, {} as never)).toThrow(MessageBusArtifactError);
    expect(() => SplitContractBundle.from(
      { format: 'solidcash-split-v1', root: legacy, facets: {} } as never, provider,
    )).toThrow(MessageBusArtifactError);

    const current = compileString('contract C() { int n; function f(int x) { this.n = x; require(x > 0); } }');
    const parent = StatefulContract.withCategory(new Contract(current, [], { provider }), '00'.repeat(32));
    expect(() => parent.registerChild(legacy)).toThrow(MessageBusArtifactError);
    expect(() => parent.registerArtifacts({ Legacy: legacy })).toThrow(MessageBusArtifactError);
  });
});
