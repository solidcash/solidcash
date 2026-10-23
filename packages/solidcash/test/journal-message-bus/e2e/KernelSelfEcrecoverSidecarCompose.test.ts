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

describe('kernel self ecrecover sidecar under composition', () => {
  it('Acc.recover under compose recreates A/B pair on Acc category', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const wallet = new ethers.Wallet(`0x${'22'.repeat(32)}`);
    const message = 'kernel-self-ecrecover';
    const signature = await wallet.signMessage(message);
    const digestHex = ethers.hashMessage(message);
    const parsed = ethers.Signature.from(signature);
    const digest = littleEndian(digestHex);
    const r = littleEndian(parsed.r);
    const s = littleEndian(parsed.s);

    const probeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Probe() { function touch() public { require(true); } }`, {
      ...KERNEL, messageBusGraphContext: true,
    });
    const accArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IProbe { function touch() external; }
      contract Acc() {
        int counter;
        function recover(address probe, bytes32 h, int v, bytes32 r, bytes32 s) public {
          pubkey value = ecrecoverPubKey(h, v, r, s);
          require(value.length == 33);
          this.counter = this.counter + 1;
          IProbe(probe).touch();
        }
      }`, KERNEL);
    expect(accArtifact.messageBus?.route.blockLayout?.slots.filter(
      (slot) => slot.kind === 'ecrecoverSideCar',
    ).length).toBeGreaterThanOrEqual(2);

    const probeBase = new Contract(probeArtifact, [], { provider });
    const probeSetup = await setupStatefulUtxos(
      provider, probeBase, probeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const probe = StatefulContract.withCategory(
      probeBase.withCategory(hexToBin(probeSetup.categoryId)), probeSetup.categoryId,
    );

    const accBase = new Contract(accArtifact, [], { provider });
    const accSetup = await setupStatefulUtxos(
      provider, accBase, accArtifact.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    const acc = StatefulContract.withCategory(
      accBase.withCategory(hexToBin(accSetup.categoryId)), accSetup.categoryId,
    );
    acc._registerResolvedExternal('IProbe', probe);

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

    const callsite = accArtifact.abi.find((entry) => entry.name === 'recover')!
      .externalCalls!.find((call) => call.functionName === 'touch')!.callsiteId!;
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        {
          contract: acc,
          functionName: 'recover',
          args: [probe.inner.lockingBytecode, digest, BigInt(parsed.v), r, s],
        },
        {
          contract: probe,
          functionName: 'touch',
          args: [],
          callsiteId: callsite,
        },
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });

    const canonical = await composition.build();
    const offsets = accArtifact.messageBus!.route.blockLayout!.slots
      .filter((slot) => slot.kind === 'ecrecoverSideCar')
      .map((slot) => slot.offset);
    // One A/M/B triple per syntactic recovery call (not maximumRows×3 kernel capacity padding).
    expect(offsets.length).toBe(3);
    expect(vmRejects(canonical)).toBe(false);

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
    expect((await acc.getState()).counter).toBe(1n);
  }, 180_000);
});
