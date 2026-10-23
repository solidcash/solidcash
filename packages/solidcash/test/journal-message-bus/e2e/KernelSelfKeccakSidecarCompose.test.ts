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

describe('kernel self keccak sidecar under composition', () => {
  it('Acc.reveal under compose recreates branded keccak sidecar on Acc category', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const probeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Probe() { function touch() public { require(true); } }`, {
      ...KERNEL, messageBusGraphContext: true,
    });
    const accArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IProbe { function touch() external; }
      contract Acc() {
        int counter;
        function reveal(address probe, bytes32 preimage, bytes32 expected) public {
          require(keccak256(preimage) == expected);
          this.counter = this.counter + 1;
          IProbe(probe).touch();
        }
      }`, KERNEL);
    expect(accArtifact.abi.find((entry) => entry.name === 'reveal')?.keccakCompute).toBe(true);
    expect(accArtifact.messageBus?.route.blockLayout?.slots.some(
      (slot) => slot.kind === 'keccakSideCar',
    )).toBe(true);

    const preimage = hexToBin('01'.repeat(32));
    const expected = keccak_256(preimage);
    const sidecarCategory = '77'.repeat(31) + '88';

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
    const sidecarLock = binToHex(keccakComputeLockingBytecode(
      hexToBin(accSetup.categoryId).reverse(), true,
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
    const acc = StatefulContract.withCategory(
      accBase.withCategory(hexToBin(accSetup.categoryId)), accSetup.categoryId,
    );
    acc._registerResolvedExternal('IProbe', probe);

    const callsite = accArtifact.abi.find((entry) => entry.name === 'reveal')!
      .externalCalls!.find((call) => call.functionName === 'touch')!.callsiteId!;
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        {
          contract: acc,
          functionName: 'reveal',
          args: [probe.inner.lockingBytecode, preimage, expected],
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
    const sidecarOffset = accArtifact.messageBus!.route.blockLayout!.slots.find(
      (slot) => slot.kind === 'keccakSideCar',
    )?.offset;
    expect(sidecarOffset).toBeDefined();
    expect(vmRejects(canonical)).toBe(false);

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

    await expect(canonical.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect((await acc.getState()).counter).toBe(1n);
  }, 180_000);
});
