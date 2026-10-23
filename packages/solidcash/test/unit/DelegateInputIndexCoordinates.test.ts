import { hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import type { ContractUnlocker } from '../../src/interfaces.js';
import { addressToLockScript } from '../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

const OWNER_SOURCE = `pragma solidcash ^0.14.0;
contract RoutedOwner() {
  bigint counter;
  function forward(bytes input, address implementation) external {
    implementation.delegatecall(input);
    require(input.length > 0);
  }
}`;

const IMPLEMENTATION_SOURCE = `pragma solidcash ^0.14.0;
contract RoutedImplementation() {
  bigint counter;
  function increment() public {
    this.counter = this.counter + 1;
  }
}`;

describe('delegate input coordinate refresh', () => {
  it('converts a participant-local materialized index to its aggregate absolute index', async () => {
    const provider = createTestProvider();
    const ownerArtifact = compileString(OWNER_SOURCE, {
      allowUnsafeOperations: true, suppressWarnings: true,
    });
    const implementationArtifact = compileString(IMPLEMENTATION_SOURCE).delegateArtifact!;
    const ownerInner = new Contract(ownerArtifact, [], { provider });
    const implementationInner = new Contract(implementationArtifact, [], { provider });
    const { categoryId: ownerCategory, masterUtxo: ownerMaster } = await setupStatefulUtxos(
      provider, ownerInner, ownerArtifact.stateLayout!, { counter: 4n }, { saltContract: true },
    );
    const { categoryId: implementationCategory } = await setupStatefulUtxos(
      provider, implementationInner, implementationArtifact.stateLayout!, { counter: 0n },
      { saltContract: true },
    );
    const owner = StatefulContract.withCategory(ownerInner, ownerCategory);
    const implementation = StatefulContract.withCategory(implementationInner, implementationCategory);
    const implementationSelector = hexToBin(
      implementationArtifact.abi.find((candidate) => candidate.name === 'increment')!.selector!,
    );
    const ownerFunction = ownerArtifact.abi.find((candidate) => candidate.name === 'forward')!;
    const routeFunction = { ...ownerFunction, name: '__route' };
    const blockBase = 37;

    const statefulBuilder = await owner._createBuilder(
      'forward',
      [implementationSelector, addressToLockScript(implementation.address)],
      {
        abiFunction: routeFunction,
        compilerRouteSelector: hexToBin(ownerFunction.selector!),
        blockBase,
        calls: [{
          type: 'stateful', contract: implementation, functionName: 'increment', args: [],
        }],
      },
    );
    const localDelegateIndex = statefulBuilder.getLowLevelCallMasterInputIndex(0);
    expect(localDelegateIndex).toBeGreaterThanOrEqual(0);

    const built = statefulBuilder.build();
    const ownerInput = built.inputs.find(
      (input) => input.txid === ownerMaster.txid && input.vout === ownerMaster.vout,
    )!;
    const unlocker = ownerInput.unlocker as ContractUnlocker;
    const witnessIndex = unlocker.abiFunction.inputs.findIndex(
      (input) => input.name === '__internal__delegateInputIndex',
    );

    expect(witnessIndex).toBeGreaterThanOrEqual(0);
    expect(unlocker.params[witnessIndex]).toBe(BigInt(blockBase + localDelegateIndex));
  });
});
