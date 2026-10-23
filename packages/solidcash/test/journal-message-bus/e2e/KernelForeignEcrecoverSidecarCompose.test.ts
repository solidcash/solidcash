import { binToHex, hexToBin } from '@bitauth/libauth';
import { ecrecoverComputeLockingBytecode } from '@solidcash/utils';
import { ethers } from 'ethers';
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

const littleEndian = (value: string): Uint8Array =>
  hexToBin(value.replace(/^0x/, '')).reverse();

describe('kernel foreign ecrecover sidecar under composition', () => {
  it('Caller→Sink.ecrecoverPubKey: recreates A/B pair; wrong recreation fails closed', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const wallet = new ethers.Wallet(`0x${'11'.repeat(32)}`);
    const message = 'kernel-foreign-ecrecover';
    const signature = await wallet.signMessage(message);
    const digestHex = ethers.hashMessage(message);
    const parsed = ethers.Signature.from(signature);
    const digest = littleEndian(digestHex);
    const r = littleEndian(parsed.r);
    const s = littleEndian(parsed.s);

    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface ISink {
        function recover(bytes32 h, int v, bytes32 r, bytes32 s) external;
      }
      contract Caller() {
        function invoke(address target, bytes32 h, int v, bytes32 r, bytes32 s) public {
          ISink(target).recover(h, v, r, s);
          require(v == 27 || v == 28);
        }
      }`, KERNEL);
    const sinkArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Sink() {
        function recover(bytes32 h, int v, bytes32 r, bytes32 s) public {
          pubkey value = ecrecoverPubKey(h, v, r, s);
          require(value.length == 33);
        }
      }`, KERNEL);
    expect(sinkArtifact.messageBus?.route.blockLayout?.slots.filter(
      (slot) => slot.kind === 'ecrecoverSideCar',
    ).length).toBeGreaterThanOrEqual(2);

    const callerBase = new Contract(callerArtifact, [], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
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

    const salt = new Uint8Array(32);
    const sidecarCategory = 'ed'.repeat(31) + '12';
    for (const role of ['A', 'B2', 'M', 'B3'] as const) {
      await provider.addUtxo(binToHex(ecrecoverComputeLockingBytecode(salt, role)), {
        ...randomUtxo({ satoshis: 100_000n }),
        token: {
          category: sidecarCategory, amount: 0n,
          nft: { capability: 'mutable', commitment: '' },
        },
      });
    }

    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      calls: [
        caller.call.invoke(
          sink.inner.lockingBytecode, digest, BigInt(parsed.v), r, s,
        ),
        sink.call.recover(digest, BigInt(parsed.v), r, s),
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });

    const canonical = await composition.build();
    const sinkBaseOffset = callerArtifact.messageBus!.route.blockLayout!.blockSize;
    const offsets = sinkArtifact.messageBus!.route.blockLayout!.slots
      .filter((slot) => slot.kind === 'ecrecoverSideCar')
      .map((slot) => sinkBaseOffset + slot.offset);
    // One A/M/B triple per syntactic recovery call (not maximumRows×3 kernel capacity padding).
    expect(offsets.length).toBe(3);
    expect(vmRejects(canonical)).toBe(false);

    const sinkRoute = canonical.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === 'Sink'
      && input.unlocker.abiFunction.name === sinkArtifact.messageBus!.route.name);
    expect(sinkRoute).toBeGreaterThanOrEqual(0);

    const wrongRecreation = await composition.build();
    wrongRecreation.outputs[offsets[2]] = {
      ...wrongRecreation.outputs[offsets[2]],
      token: {
        ...wrongRecreation.outputs[offsets[2]].token!,
        nft: {
          ...wrongRecreation.outputs[offsets[2]].token!.nft!,
          commitment: '00'.repeat(33),
        },
      },
    };
    expect(vmRejects(wrongRecreation)).toBe(true);

    await expect(canonical.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  }, 180_000);
});
