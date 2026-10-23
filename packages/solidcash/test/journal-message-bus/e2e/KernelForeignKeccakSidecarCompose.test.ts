import { binToHex, hexToBin } from '@bitauth/libauth';
import { keccakComputeLockingBytecode } from '@solidcash/utils';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../../src/utils.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { assertAuthenticatingVmEvidence } from '../vm-evidence.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

const vmRejects = (candidate: TransactionBuilder): boolean => {
  assertAuthenticatingVmEvidence(candidate);
  const transaction = candidate.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(candidate.inputs);
  const vm = createVirtualMachineBch2026ForProvider(candidate.provider);
  return transaction.inputs.some((_input, inputIndex) => vm.stateSuccess(
    vm.evaluate({ inputIndex, sourceOutputs, transaction }),
  ) !== true);
};

describe('kernel foreign keccak sidecar under composition', () => {
  it('Caller keccak256 → Sink.accept: recreates branded sidecar; tamper/omit/duplicate fail closed', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface ISink { function accept(bytes32 value) external; }
      contract Caller() {
        function invoke(address target, bytes32 payload) public {
          bytes32 value = keccak256(payload);
          ISink(target).accept(value);
          require(payload.length > 0);
        }
      }`, KERNEL);
    const sinkArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Sink() {
        function accept(bytes32 value) public pure { require(value.length == 32); }
      }`, KERNEL);
    expect(callerArtifact.messageBus?.route.blockLayout?.slots.some(
      (slot) => slot.kind === 'keccakSideCar',
    )).toBe(true);

    const payload = hexToBin('01'.repeat(32));
    const digest = keccak_256(payload);
    const sidecarCategory = 'ee'.repeat(31) + '11';

    const callerBase = new Contract(callerArtifact, [], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const sidecarLock = binToHex(keccakComputeLockingBytecode(
      hexToBin(callerSetup.categoryId).reverse(), true,
    ));
    for (let index = 0; index < 2; index += 1) {
      await provider.addUtxo(sidecarLock, {
        ...randomUtxo({ satoshis: 100_000n }),
        token: {
          category: sidecarCategory, amount: 0n,
          nft: { capability: 'mutable', commitment: '' },
        },
      });
    }
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );

    const sinkBase = new Contract(sinkArtifact, [], { provider });
    const sinkSetup = await setupStatefulUtxos(
      provider, sinkBase, sinkArtifact.stateLayout!, {}, { saltContract: true },
    );
    const sink = StatefulContract.withCategory(
      sinkBase.withCategory(hexToBin(sinkSetup.categoryId)), sinkSetup.categoryId,
    );

    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      calls: [
        caller.call.invoke(sink.inner.lockingBytecode, payload),
        sink.call.accept(digest),
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });

    const canonical = await composition.build();
    const sidecarOffset = callerArtifact.messageBus!.route.blockLayout!.slots.find(
      (slot) => slot.kind === 'keccakSideCar',
    )?.offset;
    expect(sidecarOffset).toBeDefined();
    expect(vmRejects(canonical)).toBe(false);

    const callerRoute = canonical.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === 'Caller'
      && input.unlocker.abiFunction.name === callerArtifact.messageBus!.route.name);
    const sinkRoute = canonical.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === 'Sink'
      && input.unlocker.abiFunction.name === sinkArtifact.messageBus!.route.name);
    expect(callerRoute).toBeGreaterThanOrEqual(0);
    expect(sinkRoute).toBeGreaterThanOrEqual(0);

    const sidecarOut = canonical.buildLibauthTransaction().outputs[sidecarOffset!];
    expect(sidecarOut?.token?.nft?.capability).toBe('mutable');
    const commitment = sidecarOut.token!.nft!.commitment;
    const commitmentLen = typeof commitment === 'string' ? commitment.length / 2 : commitment.length;
    expect(commitmentLen).toBeGreaterThanOrEqual(32);

    const wrongRecreation = await composition.build();
    wrongRecreation.outputs[sidecarOffset!] = {
      ...wrongRecreation.outputs[sidecarOffset!],
      token: {
        ...wrongRecreation.outputs[sidecarOffset!].token!,
        nft: {
          ...wrongRecreation.outputs[sidecarOffset!].token!.nft!,
          commitment: '00'.repeat(32),
        },
      },
    };
    expect(vmRejects(wrongRecreation)).toBe(true);

    const omitted = await composition.build();
    omitted.inputs[sidecarOffset!] = { ...omitted.inputs[sidecarOffset! + 1] };
    expect(vmRejects(omitted)).toBe(true);

    const duplicate = await composition.build();
    duplicate.inputs[sidecarOffset! + 1] = { ...duplicate.inputs[sidecarOffset!] };
    expect(vmRejects(duplicate)).toBe(true);

    await expect(canonical.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  }, 180_000);
});
