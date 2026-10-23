import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { getEntryNftAddress } from '../../../src/stateful/covenant-helpers.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { addressToLockScript, generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';
import { messageBusVmAccepts } from './vm-accepts.js';

describe('kernel inactive entry category verification', () => {
  it.each([{ values: [7n] }, { values: [7n, 0n, 7n] }])(
    'does not dereference an unselected sibling proof for rows $values', async ({ values }) => {
      const options = {
        forceStateful: true, messageBus: true, messageBusKernel: true, messageBusGraphContext: true,
        evmCompat: true, maximumInputBytes: 1_000_000, suppressWarnings: true,
      } as const;
      const artifact = compileString(`contract Store() {
      mapping(address => int) levels;
      mapping(address => int) flags;
      function move(address from, address to, int amount) public {
        this.levels[from] = this.levels[from] - amount;
        this.levels[to] = this.levels[to] + amount;
        require(true);
      }
      function setFlag(address who, int value) public returns (bool) {
        this.flags[who] = value;
        return true;
      }
    }`, options);
      const callerArtifact = compileString(`interface IStore {
      function setFlag(address who, int value) external returns (bool);
    }
    contract Caller() {
      function run(address store, address who) public {
        ${values.map((value) => `require(IStore(store).setFlag(who, ${value}));`).join('\n')}
      }
    }`, options);
      const provider = createMessageBusCapstoneTestProvider();
      const base = new Contract(artifact, [], { provider });
      const seeded = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
      const store = StatefulContract.withCategory(base.withCategory(hexToBin(seeded.categoryId)), seeded.categoryId);
      const callerBase = new Contract(callerArtifact, [], { provider });
      const callerSeed = await setupStatefulUtxos(
        provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
      );
      const caller = StatefulContract.withCategory(
        callerBase.withCategory(hexToBin(callerSeed.categoryId)), callerSeed.categoryId,
      );
      caller._registerResolvedExternal('IStore', store);
      const calls = callerArtifact.abi.find((entry) => entry.name === 'run')!.externalCalls!;
      const who = new Uint8Array(20).fill(0x65);
      const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
      const call = messageBus.compose({
        preparedCalls: [
          { contract: caller, functionName: 'run', args: [store.inner.lockingBytecode, who] },
          ...values.map((value, index) => ({
            contract: store, functionName: 'setFlag', args: [who, value], callsiteId: calls[index].callsiteId,
          })),
        ],
        funder, changeAddress: funder.unlocker.generateLockingBytecode(),
      });
      const builder = await call.build();
      expect(messageBusVmAccepts(builder)).toBe(true);
      const route = artifact.messageBus!.route;
      const routeInputIndex = builder.inputs.findIndex((input) => 'contract' in input.unlocker
        && input.unlocker.contract.artifact.contractName === 'Store'
        && input.unlocker.abiFunction.name === route.name);
      expect(routeInputIndex).toBeGreaterThanOrEqual(0);
      const unlocker = builder.inputs[routeInputIndex].unlocker;
      if (!('params' in unlocker)) throw new Error('route input has no parameters');
      const activeProofIndex = route.inputs.findIndex((input, index) => (
        /^__internal__vmapBatchProof_\d+$/.test(input.name) && Number(unlocker.params[index]) > 0
        && Number(unlocker.params[route.inputs.findIndex((candidate) => (
          candidate.name === input.name.replace('Proof', 'PredOut')
        ))]) !== -2
      ));
      expect(activeProofIndex).toBeGreaterThanOrEqual(0);
      const originalProof = unlocker.params[activeProofIndex];
      const originalUnlock = binToHex(builder.buildLibauthTransaction().inputs[routeInputIndex].unlockingBytecode);
      expect(unlocker.syncEncodedArgsFromParams).toBeTypeOf('function');
      const entryLock = addressToLockScript(getEntryNftAddress(store.inner, store.categoryId, 'flags'));
      const active = builder.inputs.find((input) => input.token?.nft
      && binToHex(input.unlocker.generateLockingBytecode()) === binToHex(entryLock))!;
      expect(active).toBeDefined();
      const original = active.token!;
      const vmAccepts = (forgeWrittenValue = false): boolean => {
        const transaction = builder.buildLibauthTransaction(true);
        if (forgeWrittenValue) {
          const written = transaction.outputs.find((output) => output.token?.nft
            && binToHex(output.lockingBytecode) === binToHex(entryLock)
            && output.token.nft.commitment.length > 64)!;
          expect(written).toBeDefined();
          written.token!.nft!.commitment = written.token!.nft!.commitment.slice();
          written.token!.nft!.commitment[written.token!.nft!.commitment.length - 1] ^= 1;
        }
        const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
        const vm = createVirtualMachineBch2026ForProvider(provider);
        return transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
          vm.evaluate({ transaction, sourceOutputs, inputIndex }),
        ) === true);
      };
      try {
        for (const proof of [originalProof, -1n, 0n]) {
          unlocker.params[activeProofIndex] = proof;
          unlocker.syncEncodedArgsFromParams?.([activeProofIndex]);
          if (proof !== originalProof) {
            expect(binToHex(builder.buildLibauthTransaction(true).inputs[routeInputIndex].unlockingBytecode))
              .not.toBe(originalUnlock);
          }
          active.token = { ...original, category: 'fa'.repeat(31) + '05' };
          expect(vmAccepts(), `forged category with proof=${proof}`).toBe(false);
          active.token = { ...original, nft: { ...original.nft!, capability: 'none' } };
          expect(vmAccepts(), `forged capability with proof=${proof}`).toBe(false);
          active.token = original;
          expect(vmAccepts(true), `forged written value with proof=${proof}`).toBe(false);
        }
      } finally {
        active.token = original;
        unlocker.params[activeProofIndex] = originalProof;
        unlocker.syncEncodedArgsFromParams?.([activeProofIndex]);
      }
      await expect(call.send()).resolves.toHaveProperty('txid');
      expect(await store.state.flags(who)).toBe(7n);
    }, 180_000);
});
