import {
  bigIntToVmNumber, binToHex, hexToBin, vmNumberToBigInt,
} from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import {
  StatefulContract,
  SortedList,
  getEntryNftAddress,
} from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { keyToSlot } from '../../../src/stateful/SortedList.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';
import { messageBusVmAccepts as vmAccepts } from './vm-accepts.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  evmCompat: true,
  suppressWarnings: true,
} as const;

describe('kernel fan-out two heterogeneous callees under composition', () => {
  it('Caller.fire co-spends Emitter.ping and Registry.set in one compose', async () => {
    const provider = createMessageBusCapstoneTestProvider();

    const emitterArtifact = compileString(`pragma solidity ^0.8.0;
      contract Emitter {
        event Ping(uint256 value);
        function ping(uint256 value) public {
          emit Ping(value);
          require(true);
        }
      }`, KERNEL);
    expect(emitterArtifact.messageBus?.handlers.find((entry) => entry.name === 'ping'))
      .toMatchObject({ eligible: true });
    const emitterBase = new Contract(emitterArtifact, [], { provider });
    const emitterSetup = await setupStatefulUtxos(
      provider, emitterBase, emitterArtifact.stateLayout!, {}, { saltContract: true },
    );
    const emitter = StatefulContract.withCategory(
      emitterBase.withCategory(hexToBin(emitterSetup.categoryId)), emitterSetup.categoryId,
    );

    const registryArtifact = compileString(`pragma solidity ^0.8.0;
      contract Registry {
        mapping(uint256 => uint256) bal;
        function set(uint256 k, uint256 v) public { bal[k] = v; require(true); }
      }`, KERNEL);
    const registryBase = new Contract(registryArtifact, [], { provider });
    const registrySetup = await setupStatefulUtxos(
      provider, registryBase, registryArtifact.stateLayout!, {}, { saltContract: true },
    );
    const registry = StatefulContract.withCategory(
      registryBase.withCategory(hexToBin(registrySetup.categoryId)), registrySetup.categoryId,
    );

    const callerArtifact = compileString(`pragma solidity ^0.8.0;
      interface IEmitter { function ping(uint256 value) external; }
      interface IRegistry { function set(uint256 k, uint256 v) external; }
      contract Caller(address emitter, address registry) {
        function fire(uint256 k, uint256 v) public {
          IEmitter(emitter).ping(v);
          IRegistry(registry).set(k, v);
          require(true);
        }
      }`, KERNEL);
    const callerBase = new Contract(
      callerArtifact,
      [emitter.inner.lockingBytecode, registry.inner.lockingBytecode],
      { provider },
    );
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );

    const pokeAbi = callerArtifact.abi.find((entry) => entry.name === 'fire')!;
    const pingCallsite = pokeAbi.externalCalls!.find((call) => call.functionName === 'ping')!.callsiteId!;
    const setCallsite = pokeAbi.externalCalls!.find((call) => call.functionName === 'set')!.callsiteId!;

    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        { contract: caller, functionName: 'fire', args: [2n, 7n] },
        { contract: emitter, functionName: 'ping', args: [7n], callsiteId: pingCallsite },
        { contract: registry, functionName: 'set', args: [2n, 7n], callsiteId: setCallsite },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });

    const builder = await composition.build();
    expect(vmAccepts(builder)).toBe(true);

    const callerRoute = builder.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === 'Caller'
      && input.unlocker.abiFunction.name === callerArtifact.messageBus!.route.name);
    const emitterRoute = builder.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === 'Emitter'
      && input.unlocker.abiFunction.name === emitterArtifact.messageBus!.route.name);
    const registryRoute = builder.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === 'Registry'
      && input.unlocker.abiFunction.name === registryArtifact.messageBus!.route.name);
    expect(callerRoute).toBeGreaterThanOrEqual(0);
    expect(emitterRoute).toBeGreaterThan(callerRoute);
    expect(registryRoute).toBeGreaterThan(callerRoute);
    expect(emitterRoute).not.toBe(registryRoute);

    const transaction = builder.buildLibauthTransaction();
    const callerCategory = callerSetup.categoryId.toLowerCase();
    const eventOutputs = transaction.outputs.filter((output) => {
      const category = output.token?.category;
      const hex = typeof category === 'string'
        ? category.toLowerCase()
        : category !== undefined ? binToHex(category).toLowerCase() : '';
      const commitment = output.token?.nft?.commitment;
      const commitmentLen = typeof commitment === 'string'
        ? commitment.length / 2
        : (commitment?.length ?? 0);
      return hex === callerCategory
        && output.token?.nft?.capability === 'none'
        && commitmentLen > 0
        && (output.valueSatoshis ?? 0n) > 0n;
    });
    // Ping is emitted by Emitter, not Caller — funder/event slot lives on Emitter category.
    const emitterCategory = emitterSetup.categoryId.toLowerCase();
    const emitterEvents = transaction.outputs.filter((output) => {
      const category = output.token?.category;
      const hex = typeof category === 'string'
        ? category.toLowerCase()
        : category !== undefined ? binToHex(category).toLowerCase() : '';
      const commitment = output.token?.nft?.commitment;
      const commitmentLen = typeof commitment === 'string'
        ? commitment.length / 2
        : (commitment?.length ?? 0);
      return hex === emitterCategory
        && output.token?.nft?.capability === 'none'
        && commitmentLen > 0
        && (output.valueSatoshis ?? 0n) > 0n;
    });
    expect(emitterEvents.length + eventOutputs.length).toBeGreaterThanOrEqual(1);

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    const ea = getEntryNftAddress(registry.inner, registrySetup.categoryId, 'bal');
    const entry = SortedList.fromUtxos(await provider.getUtxos(ea))
      .find(keyToSlot(bigIntToVmNumber(2n)));
    expect(entry).toBeDefined();
    expect(vmNumberToBigInt(entry!.value, { requireMinimalEncoding: false })).toBe(7n);
  }, 180_000);
});
