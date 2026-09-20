import { binToHex, hexToBin } from '@bitauth/libauth';
import { ecrecoverComputeLockingBytecode } from '@solidcash/utils';
import { ethers } from 'ethers';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract, StatefulContract, getContractFactory, upgrades, messageBus, Signer,
} from '../../../src/index.js';
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

const fundEcrecoverSidecars = async (
  provider: ReturnType<typeof createMessageBusCapstoneTestProvider>,
): Promise<void> => {
  const salt = new Uint8Array(32);
  const sidecarCategory = 'ed'.repeat(32);
  for (const role of ['A', 'B'] as const) {
    await provider.addUtxo(binToHex(ecrecoverComputeLockingBytecode(salt, role)), {
      ...randomUtxo({ satoshis: 100_000n }),
      token: {
        category: sidecarCategory, amount: 0n,
        nft: { capability: 'mutable', commitment: '' },
      },
    });
  }
};

describe('kernel proxy ecrecover sidecar under composition', () => {
  it('settles deployProxy recover via __forward with A/B sidecar recreation', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x4a), provider);
    for (let index = 0; index < 40; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const wallet = new ethers.Wallet(`0x${'33'.repeat(32)}`);
    const message = 'kernel-proxy-ecrecover';
    const signature = await wallet.signMessage(message);
    const digestHex = ethers.hashMessage(message);
    const parsed = ethers.Signature.from(signature);
    const digest = littleEndian(digestHex);
    const r = littleEndian(parsed.r);
    const s = littleEndian(parsed.s);

    const implArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Acc() {
        int counter;
        mapping(int => int) bal;
        function initialize() public { this.counter = 0; }
        function recover(bytes32 h, int v, bytes32 r, bytes32 s) public {
          pubkey value = ecrecoverPubKey(h, v, r, s);
          require(value.length == 33);
          this.counter = this.counter + 1;
          int key = 1;
          bal[key] = this.counter;
        }
      }`, KERNEL);
    expect(implArtifact.delegateArtifact).toBeDefined();
    expect(implArtifact.messageBus?.route.blockLayout?.slots.filter(
      (slot) => slot.kind === 'ecrecoverSideCar',
    ).length).toBeGreaterThanOrEqual(2);

    const deployed = await upgrades.deployProxy(getContractFactory(implArtifact, signer), []);
    await fundEcrecoverSidecars(provider);

    const builder = await (deployed as any)
      .recover(digest, BigInt(parsed.v), r, s)
      .build() as TransactionBuilder;
    expect(vmRejects(builder)).toBe(false);
    expect(builder.inputs.some((input) => 'contract' in input.unlocker
      && input.unlocker.contract.address === deployed.implementation.inner.address)).toBe(true);

    await expect(
      (deployed as any).recover(digest, BigInt(parsed.v), r, s).send(),
    ).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  }, 300_000);

  it('characterizes compose+executionArtifact×ecrecover: fails closed at preflight (no hang)', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x4b), provider);
    for (let index = 0; index < 40; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const wallet = new ethers.Wallet(`0x${'44'.repeat(32)}`);
    const message = 'kernel-proxy-ecrecover-compose';
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
    const implArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IProbe { function touch() external; }
      contract Acc() {
        int counter;
        mapping(int => int) bal;
        function initialize() public { this.counter = 0; }
        function recover(address probe, bytes32 h, int v, bytes32 r, bytes32 s) public {
          pubkey value = ecrecoverPubKey(h, v, r, s);
          require(value.length == 33);
          this.counter = this.counter + 1;
          int key = 1;
          bal[key] = this.counter;
          IProbe(probe).touch();
        }
      }`, KERNEL);
    const delegate = implArtifact.delegateArtifact!;

    const probeBase = new Contract(probeArtifact, [], { provider });
    const probeSetup = await setupStatefulUtxos(
      provider, probeBase, probeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const probe = StatefulContract.withCategory(
      probeBase.withCategory(hexToBin(probeSetup.categoryId)), probeSetup.categoryId,
    );

    const deployed = await upgrades.deployProxy(getContractFactory(implArtifact, signer), []);
    deployed.implementation._registerResolvedExternal('IProbe', probe);
    await fundEcrecoverSidecars(provider);

    const callsite = delegate.abi.find((entry) => entry.name === 'recover')
      ?.externalCalls?.find((call) => call.functionName === 'touch');
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: deployed.proxy,
        functionName: 'recover',
        args: [probe.inner.lockingBytecode, digest, BigInt(parsed.v), r, s],
        executionArtifact: deployed.implementation.inner.artifact,
        executor: deployed.implementation,
      }, {
        contract: probe,
        functionName: 'touch',
        args: [],
        callsiteId: callsite!.callsiteId,
      }],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    await expect(composition.build()).rejects.toThrow(
      /BCH-2026 preflight failed|operation cost density limit/,
    );
  }, 300_000);
});
