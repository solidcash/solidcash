import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  SHARED_LIBRARY_SALT,
  ecrecoverComputeLockingBytecode, keccakComputeLockingBytecode,
} from '@solidcash/utils';
import { ethers } from 'ethers';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { computeEcrecoverWitness } from '../../../src/ecrecover/ecrecoverRecovery.js';
import { probeEcrecoverSplit } from '../../../src/ecrecover/ecrecoverComputeSidecar.js';
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

const leBytes = (value: string): Uint8Array =>
  hexToBin(value.replace(/^0x/, '')).reverse();

const dummySc = (v: number): Parameters<typeof probeEcrecoverSplit>[2] => ({
  txid: (v ? 'bb' : 'aa').repeat(32),
  vout: v,
  satoshis: 100000n,
  token: {
    category: 'ee'.repeat(31) + '11',
    amount: 0n,
    nft: { capability: 'mutable' as const, commitment: '' },
  },
});

async function goodEvmSigner(prefix: string): Promise<{
  h: Uint8Array; v: bigint; r: Uint8Array; s: Uint8Array; owner: Uint8Array;
}> {
  let last = '(none)';
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const wallet = ethers.Wallet.createRandom();
    const message = `${prefix}-${attempt}`;
    const sig = await wallet.signMessage(message);
    const digest = ethers.hashMessage(message);
    const { r, s, v } = ethers.Signature.from(sig);
    const h = leBytes(digest);
    const rLe = leBytes(r);
    const sLe = leBytes(s);
    const owner = hexToBin(wallet.address.slice(2).toLowerCase());
    try {
      probeEcrecoverSplit(
        computeEcrecoverWitness(h, Number(v), rLe, sLe),
        SHARED_LIBRARY_SALT,
        dummySc(0),
        dummySc(1),
      );
      return { h, v: BigInt(v), r: rLe, s: sLe, owner };
    } catch (error) {
      last = (error as Error).message;
    }
  }
  throw new Error(`no width-fitting ecrecoverEvm signature in 24 tries; last: ${last}`);
}

describe('kernel ecrecoverEvm + keccak sidecar under composition', () => {
  it('publishes keccakSideCar beside ecrecoverSideCar for ecrecoverEvm under KERNEL', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract Acc(bytes20 owner) {
        int counter;
        function recoverEvm(bytes32 digest, int vv, bytes32 rr, bytes32 ss) public {
          require(ecrecoverEvm(digest, vv, rr, ss) == owner);
          this.counter = this.counter + 1;
        }
      }`, KERNEL);
    const recoverAbi = artifact.abi.find((entry) => entry.name === 'recoverEvm');
    expect(recoverAbi?.ecrecoverEvmFlags).toEqual([true]);
    expect(recoverAbi?.ecrecoverCompute).toBe(true);
    const slots = artifact.messageBus!.route.blockLayout!.slots;
    const ecrecoverSlots = slots.filter((slot) => slot.kind === 'ecrecoverSideCar');
    const keccakSlots = slots.filter((slot) => slot.kind === 'keccakSideCar');
    expect(ecrecoverSlots.length).toBeGreaterThanOrEqual(2);
    expect(keccakSlots.length).toBeGreaterThanOrEqual(1);
  });

  it('settles Acc.recoverEvm under compose with A/B + keccak sidecar; wrong keccak fails closed', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const { h, v, r, s, owner } = await goodEvmSigner('kernel-evm-settle');

    const probeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Probe() { function touch() public { require(true); } }`, {
      ...KERNEL, messageBusGraphContext: true,
    });
    const accArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IProbe { function touch() external; }
      contract Acc(bytes20 owner) {
        int counter;
        function recoverEvm(address probe, bytes32 digest, int vv, bytes32 rr, bytes32 ss) public {
          require(ecrecoverEvm(digest, vv, rr, ss) == owner);
          this.counter = this.counter + 1;
          IProbe(probe).touch();
        }
      }`, KERNEL);
    const recoverAbi = accArtifact.abi.find((entry) => entry.name === 'recoverEvm');
    expect(recoverAbi?.ecrecoverEvmFlags).toEqual([true]);
    const keccakSlots = accArtifact.messageBus!.route.blockLayout!.slots
      .filter((slot) => slot.kind === 'keccakSideCar');
    expect(keccakSlots.length).toBeGreaterThanOrEqual(1);

    const probeBase = new Contract(probeArtifact, [], { provider });
    const probeSetup = await setupStatefulUtxos(
      provider, probeBase, probeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const probe = StatefulContract.withCategory(
      probeBase.withCategory(hexToBin(probeSetup.categoryId)), probeSetup.categoryId,
    );

    const accBase = new Contract(accArtifact, [owner], { provider });
    const accSetup = await setupStatefulUtxos(
      provider, accBase, accArtifact.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    const acc = StatefulContract.withCategory(
      accBase.withCategory(hexToBin(accSetup.categoryId)), accSetup.categoryId,
    );
    acc._registerResolvedExternal('IProbe', probe);

    const ecrecoverCategory = 'ed'.repeat(31) + '12';
    for (const role of ['A', 'B'] as const) {
      await provider.addUtxo(binToHex(ecrecoverComputeLockingBytecode(SHARED_LIBRARY_SALT, role)), {
        ...randomUtxo({ satoshis: 100_000n }),
        token: {
          category: ecrecoverCategory, amount: 0n,
          nft: { capability: 'mutable', commitment: '' },
        },
      });
    }
    // Message-bus graph execution co-spends the shared-salt keccak lock for ecrecoverEvm's projection.
    const keccakCategory = '77'.repeat(31) + '88';
    const keccakLock = binToHex(keccakComputeLockingBytecode(SHARED_LIBRARY_SALT, true));
    for (let index = 0; index < 2; index += 1) {
      await provider.addUtxo(keccakLock, {
        ...randomUtxo({ satoshis: 100_000n }),
        token: {
          category: keccakCategory, amount: 0n,
          nft: { capability: 'mutable', commitment: '' },
        },
      });
    }

    const callsite = recoverAbi!.externalCalls!
      .find((call) => call.functionName === 'touch')!.callsiteId!;
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        {
          contract: acc,
          functionName: 'recoverEvm',
          args: [probe.inner.lockingBytecode, h, v, r, s],
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

    const sidecarOffset = accArtifact.messageBus!.route.blockLayout!.slots.find(
      (slot) => slot.kind === 'keccakSideCar',
    )?.offset;
    expect(sidecarOffset).toBeDefined();

    const canonical = await composition.build();
    expect(vmRejects(canonical)).toBe(false);

    // Prefer the published Acc-block keccakSideCar offset (Acc is preparedCalls[0] / owner base 0).
    // Category can be a stand-in NFT after deferred replacement, so do not key recreation on the funded hex.
    const sidecarOut = canonical.buildLibauthTransaction().outputs[sidecarOffset!];
    expect(sidecarOut?.token?.nft?.capability).toBe('mutable');
    const commitment = sidecarOut.token!.nft!.commitment;
    const commitmentLen = typeof commitment === 'string' ? commitment.length / 2 : commitment.length;
    expect(commitmentLen).toBeGreaterThanOrEqual(32);

    const wrongKeccak = await composition.build();
    wrongKeccak.outputs[sidecarOffset!] = {
      ...wrongKeccak.outputs[sidecarOffset!],
      token: {
        ...wrongKeccak.outputs[sidecarOffset!].token!,
        nft: {
          ...wrongKeccak.outputs[sidecarOffset!].token!.nft!,
          commitment: '00'.repeat(32),
        },
      },
    };
    expect(vmRejects(wrongKeccak)).toBe(true);

    await expect(canonical.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect((await acc.getState()).counter).toBe(1n);
  }, 180_000);
});
