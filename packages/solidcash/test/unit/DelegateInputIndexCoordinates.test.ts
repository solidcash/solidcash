import { hexToBin } from '@bitauth/libauth';
import { scriptToAsm } from '@solidcash/utils';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { DEFAULT_PROXY_SOURCE, defaultProxyArtifact } from '../../src/stateful/defaultProxyArtifact.js';
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

/**
 * The delegate derives its state owner positionally (`proxyMasterIndex == OP_INPUTINDEX - 1 - dataNftCount`).
 * The identity and payload pins do not bind that position, so a delegate placed after a DIFFERENT master's block
 * would authorize that master while the forwarding proxy's own state covenant is skipped. A proxy publishes the
 * distance to its delegate as the constructor input `__proxyBlockSize`, which its own p2sh32 commits to.
 */
const POSITION_PIN = 'OP_INPUTINDEX OP_ADD OP_DEPTH OP_1SUB OP_PICK OP_NUMEQUALVERIFY';

describe('delegate position pin', () => {
  it('pins the delegate one published proxy block after the forwarding input', () => {
    const compiled = compileString(DEFAULT_PROXY_SOURCE, { forceStateful: true, suppressWarnings: true });
    const forward = compiled.abi.find((entry) => entry.name === '__forward')!;

    expect(compiled.constructorInputs.map((input) => input.name)).toEqual([
      'implementation', '__proxyBlockSize',
    ]);
    // Baking still names the implementation: the extra constructor input must not move targetBinding.input.
    expect(forward.delegateForwarding?.targetBinding).toMatchObject({ kind: 'constructorArg', input: 0 });
    expect(scriptToAsm(hexToBin(compiled.debug!.bytecode))).toContain(POSITION_PIN);
    // The shipped artifact is the same compile, so the SDK deploy path carries the pin.
    expect(defaultProxyArtifact.constructorInputs.map((input) => input.name)).toEqual([
      'implementation', '__proxyBlockSize',
    ]);
  });

  it('leaves a proxy that publishes no distance on the witness-only pin', () => {
    const unpublished = `pragma solidcash >=0.8.0;
      contract UnpublishedProxy(address implementation) {
        function __forward(bytes input) {
          implementation.delegatecall(input);
          require(input.length > 0);
        }
      }`;
    const compiled = compileString(unpublished, { forceStateful: true, suppressWarnings: true });
    expect(compiled.constructorInputs.map((input) => input.name)).toEqual(['implementation']);
    expect(scriptToAsm(hexToBin(compiled.debug!.bytecode))).not.toContain(POSITION_PIN);
  });
});
