import { binToHex, hexToBin } from '@bitauth/libauth';
import { encodePushdataValue } from '@solidcash/utils';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract, messageBus, type TransactionBuilder } from '../../../src/index.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { assertAuthenticatingVmEvidence } from '../vm-evidence.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';
import { alicePub } from '../../fixture/vars.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true,
} as const;

const CURRENT = `contract CurrentVersion() {
  int stored;
  function setStored(int next) public {
    this.stored = next;
    require(true);
  }
  function replace() public upgrade {
    require(true);
  }
}`;

const REPLACEMENT = `contract ReplacementVersion(int domain) {
  int stored;
  function identify() public view returns (int) {
    return domain;
  }
}`;

const COORDINATOR = `interface IVersioned {
  function replace();
  function setStored(int next);
}
contract UpgradeCoordinator() {
  function replaceSelf() public upgrade {
    require(true);
  }
  function execute(address target) public {
    IVersioned(target).replace();
    require(true);
  }
  function executeAfterSet(address stateTarget, address upgradeTarget, int next) public {
    IVersioned(stateTarget).setStored(next);
    IVersioned(upgradeTarget).replace();
    require(true);
  }
}`;

const setup = async (): Promise<{
  current: StatefulContract;
  currentArtifact: ReturnType<typeof compileString>;
  replacementArtifact: ReturnType<typeof compileString>;
  coordinator: StatefulContract;
  coordinatorArtifact: ReturnType<typeof compileString>;
  fee: Awaited<ReturnType<typeof createBareP2pkhFeeFunder>>;
}> => {
  const provider = createMessageBusCapstoneTestProvider();
  const currentArtifact = compileString(CURRENT, KERNEL);
  const replacementArtifact = compileString(REPLACEMENT, KERNEL);
  const coordinatorArtifact = compileString(COORDINATOR, KERNEL);
  const currentBase = new Contract(currentArtifact, [], { provider });
  const currentSetup = await setupStatefulUtxos(
    provider, currentBase, currentArtifact.stateLayout!, {}, { saltContract: true },
  );
  const current = StatefulContract.withCategory(
    currentBase.withCategory(hexToBin(currentSetup.categoryId)), currentSetup.categoryId,
  );
  const coordinatorBase = new Contract(coordinatorArtifact, [], { provider });
  const coordinatorSetup = await setupStatefulUtxos(
    provider, coordinatorBase, coordinatorArtifact.stateLayout!, {}, { saltContract: true },
  );
  const coordinator = StatefulContract.withCategory(
    coordinatorBase.withCategory(hexToBin(coordinatorSetup.categoryId)), coordinatorSetup.categoryId,
  );
  const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
  return { current, currentArtifact, replacementArtifact, coordinator, coordinatorArtifact, fee };
};

describe('kernel in-place append upgrade composition', () => {
  it('authenticates one final upgrade row and preserves the master NFT geometry', async () => {
    const { current, currentArtifact, replacementArtifact, coordinator, coordinatorArtifact, fee } = await setup();
    expect(currentArtifact.messageBus?.handlers.find((handler) => handler.name === 'replace'))
      .toMatchObject({ eligible: true, lifecycle: { kind: 'upgrade', layout: 'in-place-append-v1' } });
    expect(currentArtifact.messageBus?.atomicMessageBus?.protocolVersions).toContain(2);
    expect(coordinatorArtifact.messageBus?.atomicMessageBus?.protocolVersions).toContain(2);
    expect(coordinatorArtifact.messageBus?.handlers.find((handler) => handler.name === 'replaceSelf'))
      .toMatchObject({ eligible: true, lifecycle: { kind: 'upgrade', layout: 'in-place-append-v1' } });

    const replacement = new Contract(replacementArtifact, [7n], {
      provider: current.inner.provider,
      addressType: current.inner.addressType,
      category: hexToBin(current.categoryId),
    });
    const composition = messageBus.compose({
      calls: [
        coordinator.call.execute(current.inner.lockingBytecode),
        current.call.replace().upgradeTo(replacementArtifact, [7n]),
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    const builder = await composition.build();
    const masterInput = builder.inputs.findIndex((input) =>
      input.token?.category === current.categoryId && input.token.nft?.capability === 'minting');
    expect(masterInput).toBeGreaterThanOrEqual(0);
    expect(binToHex(builder.inputs[masterInput].unlocker.generateLockingBytecode()))
      .toBe(current.inner.lockingBytecode);
    const output = builder.outputs[masterInput];
    expect(output.to).toBeInstanceOf(Uint8Array);
    expect(binToHex(output.to as Uint8Array)).toBe(replacement.lockingBytecode);
    expect(output.amount).toBe(builder.inputs[masterInput].satoshis);
    expect(output.token).toEqual(builder.inputs[masterInput].token);
    assertAuthenticatingVmEvidence(builder);
    expect(() => messageBus.preflightMessageBusTransaction(builder)).not.toThrow();
  }, 180_000);

  it('rejects missing, duplicate, and non-identical-layout replacement targets', async () => {
    const { current, replacementArtifact, coordinator, fee } = await setup();
    const compose = (call: ReturnType<typeof current.call.replace>): Promise<TransactionBuilder> => messageBus.compose({
      calls: [coordinator.call.execute(current.inner.lockingBytecode), call],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    }).build();
    await expect(compose(current.call.replace())).rejects.toThrow(/requires exactly one replacement target/);

    const incompatible = compileString(`contract DifferentLayout() {
      bool stored;
      int additional;
      function identify() public view returns (int) { return additional; }
    }`, KERNEL);
    await expect(compose(current.call.replace().upgradeTo(incompatible, [])))
      .rejects.toThrow(/does not preserve the existing state-variable geometry/);
    await expect(messageBus.compose({
      calls: [
        coordinator.call.executeAfterSet(
          current.inner.lockingBytecode, current.inner.lockingBytecode, 1n,
        ),
        current.call.setStored(1n).upgradeTo(replacementArtifact, [7n]),
        current.call.replace(),
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    }).build()).rejects.toThrow(/must be attached to its compiler-authored upgrade call/);
    expect(() => current.call.replace().upgradeTo(replacementArtifact, [1n]).upgradeTo(replacementArtifact, [2n]))
      .toThrow(/already been selected/);
    const duplicateTarget = { artifact: replacementArtifact, constructorArgs: [7n] } as const;
    await expect(messageBus.compose({
      preparedCalls: [
        { contract: current, functionName: 'replace', args: [], upgradeTarget: duplicateTarget },
        { contract: current, functionName: 'replace', args: [], upgradeTarget: duplicateTarget },
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    }).build()).rejects.toThrow(/requires exactly one replacement target/);
  }, 180_000);

  it('appends canonical new fields after the post-row old state and rejects suffix tampering', async () => {
    const { current, coordinator, fee } = await setup();
    const extended = compileString(`contract ExtendedVersion(int domain) {
      int stored;
      int added;
      bytes4 marker;
      function identify() public view returns (int) { return domain + added; }
    }`, KERNEL);
    const marker = Uint8Array.of(1, 2, 3, 4);
    const builder = await messageBus.compose({
      calls: [
        coordinator.call.executeAfterSet(
          current.inner.lockingBytecode, current.inner.lockingBytecode, 9n,
        ),
        current.call.setStored(9n),
        current.call.replace().upgradeTo(extended, [7n], {
          appendedState: { added: 5n, marker },
        }),
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    }).build();
    const master = builder.inputs.findIndex((input) =>
      input.token?.category === current.categoryId && input.token.nft?.capability === 'minting');
    const commitment = builder.outputs[master + 1].token?.nft?.commitment;
    expect(commitment).toBe(binToHex(new Uint8Array([
      ...encodePushdataValue(9n, 'int256'),
      ...encodePushdataValue(5n, 'int256'),
      ...encodePushdataValue(marker, 'bytes4'),
    ])));
    assertAuthenticatingVmEvidence(builder);
    expect(() => messageBus.preflightMessageBusTransaction(builder)).not.toThrow();
    builder.outputs[master + 1].token!.nft!.commitment = `${commitment!.slice(0, -2)}ff`;
    expect(() => messageBus.preflightMessageBusTransaction(builder)).toThrow();
  }, 180_000);

  it('defaults omitted appended fields and rejects initializers for an existing field', async () => {
    const { current, coordinator, fee } = await setup();
    const extended = compileString(`contract ExtendedVersion() {
      int stored;
      int added;
      function identify() public view returns (int) { return added; }
    }`, KERNEL);
    const defaults = await messageBus.compose({
      calls: [
        coordinator.call.execute(current.inner.lockingBytecode),
        current.call.replace().upgradeTo(extended, []),
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    }).build();
    const master = defaults.inputs.findIndex((input) =>
      input.token?.category === current.categoryId && input.token.nft?.capability === 'minting');
    expect(defaults.outputs[master + 1].token?.nft?.commitment).toBe(binToHex(new Uint8Array([
      ...encodePushdataValue(0n, 'int256'), ...encodePushdataValue(0n, 'int256'),
    ])));
    await expect(messageBus.compose({
      calls: [
        coordinator.call.execute(current.inner.lockingBytecode),
        current.call.replace().upgradeTo(extended, [], { appendedState: { stored: 1n } }),
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    }).build()).rejects.toThrow(/appendedState may only initialize new fields/);
  }, 180_000);

  it('rejects appended fields with nested dynamic state', async () => {
    const { current, coordinator, fee } = await setup();
    const dynamicStruct = compileString(`contract DynamicStructVersion() {
      struct Extra { bytes payload; }
      int stored;
      Extra extra;
      function identify() public view returns (int) { return stored; }
    }`, KERNEL);
    await expect(messageBus.compose({
      calls: [
        coordinator.call.execute(current.inner.lockingBytecode),
        current.call.replace().upgradeTo(dynamicStruct, [], {
          appendedState: { extra: { payload: Uint8Array.of(1) } },
        }),
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    }).build()).rejects.toThrow(/contiguous fixed-size suffix/);
  }, 180_000);

  it('rejects a transitively reached signature check anywhere in an upgrade graph', async () => {
    const { current, replacementArtifact, fee } = await setup();
    const activeProvider = current.inner.provider;
    const signedCoordinatorArtifact = compileString(`interface IVersioned {
      function replace();
    }
    contract SignedCoordinator() {
      function authorize(bytes proof, pubkey signer) internal {
        require(checkSig(sig(proof), signer));
      }
      function execute(address target, bytes proof, pubkey signer) public {
        authorize(proof, signer);
        IVersioned(target).replace();
        require(true);
      }
    }`, KERNEL);
    const base = new Contract(signedCoordinatorArtifact, [], { provider: activeProvider });
    const deployed = await setupStatefulUtxos(
      activeProvider, base, signedCoordinatorArtifact.stateLayout!, {}, { saltContract: true },
    );
    const coordinator = StatefulContract.withCategory(
      base.withCategory(hexToBin(deployed.categoryId)), deployed.categoryId,
    );
    expect(signedCoordinatorArtifact.messageBus?.handlers.find((handler) => handler.name === 'execute'))
      .toMatchObject({ eligible: true, usesTransactionSignature: true });
    const composition = messageBus.compose({
      calls: [
        coordinator.call.execute(current.inner.lockingBytecode, Uint8Array.of(1), alicePub),
        current.call.replace().upgradeTo(replacementArtifact, [7n]),
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    await expect(composition.build()).rejects.toThrow(/cannot include transaction-signature checks/);
  }, 180_000);
});
