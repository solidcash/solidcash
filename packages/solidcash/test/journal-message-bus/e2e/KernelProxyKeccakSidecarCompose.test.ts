import { binToHex, hexToBin } from '@bitauth/libauth';
import { keccakComputeLockingBytecode } from '@solidcash/utils';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract,
  Signer,
} from '../../../src/index.js';
import {
  StatefulContract,
  getContractFactory,
  upgrades,
} from '../../../src/stateful/index.js';
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

const fundKeccakSidecars = async (
  provider: ReturnType<typeof createMessageBusCapstoneTestProvider>,
  categoryId: string,
): Promise<string> => {
  const sidecarCategory = '77'.repeat(31) + '88';
  const locks = [
    binToHex(keccakComputeLockingBytecode(new Uint8Array(32), true)),
    binToHex(keccakComputeLockingBytecode(hexToBin(categoryId).reverse(), true)),
  ];
  for (const lock of locks) {
    for (let index = 0; index < 2; index += 1) {
      await provider.addUtxo(lock, {
        ...randomUtxo({ satoshis: 100_000n }),
        token: {
          category: sidecarCategory, amount: 0n,
          nft: { capability: 'mutable', commitment: '' },
        },
      });
    }
  }
  return sidecarCategory;
};

const ACC = `pragma solidcash >=0.8.0;
  contract Acc() {
    int counter;
    mapping(int => int) bal;
    function initialize() public { this.counter = 0; }
    function reveal(bytes32 preimage, bytes32 expected) public {
      require(keccak256(preimage) == expected);
      this.counter = this.counter + 1;
      int key = 1;
      bal[key] = this.counter;
    }
  }`;

describe('kernel proxy keccak sidecar under composition', () => {
  it('settles deployProxy reveal via __forward with keccak sidecar recreation', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x48), provider);
    for (let index = 0; index < 40; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const implArtifact = compileString(ACC, KERNEL);
    expect(implArtifact.delegateArtifact).toBeDefined();
    expect(implArtifact.abi.find((entry) => entry.name === 'reveal')?.keccakCompute).toBe(true);

    const deployed = await upgrades.deployProxy(getContractFactory(implArtifact, signer), []);
    const sidecarCategory = await fundKeccakSidecars(provider, String(deployed.proxy.categoryId));

    const preimage = hexToBin('02'.repeat(32));
    const expected = keccak_256(preimage);
    const builder = await (deployed as any).reveal(preimage, expected).build() as TransactionBuilder;
    expect(vmRejects(builder)).toBe(false);
    expect(builder.inputs.some((input) => 'contract' in input.unlocker
      && input.unlocker.contract.address === deployed.implementation.inner.address)).toBe(true);

    const tx = builder.buildLibauthTransaction();
    const sidecarOuts = tx.outputs.filter((output) => {
      const category = output.token?.category;
      const hex = typeof category === 'string'
        ? category.toLowerCase()
        : category !== undefined ? binToHex(category).toLowerCase() : '';
      if (hex !== sidecarCategory || output.token?.nft?.capability !== 'mutable') return false;
      const commitment = output.token!.nft!.commitment;
      const len = typeof commitment === 'string' ? commitment.length / 2 : commitment.length;
      return len >= 32;
    });
    expect(sidecarOuts.length).toBeGreaterThanOrEqual(1);

    await expect((deployed as any).reveal(preimage, expected).send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  }, 300_000);

  it('settles compose+executionArtifact×keccak with foreign Probe touch', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x49), provider);
    for (let index = 0; index < 40; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const probeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Probe() { function touch() public { require(true); } }`, {
      ...KERNEL, messageBusGraphContext: true,
    });
    // Scalar-only: local mapping INSERT under proxy+foreign remains a separate failure class.
    const implArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IProbe { function touch() external; }
      contract Acc() {
        int counter;
        function initialize() public { this.counter = 0; }
        function reveal(address probe, bytes32 preimage, bytes32 expected) public {
          require(keccak256(preimage) == expected);
          this.counter = this.counter + 1;
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
    await fundKeccakSidecars(provider, String(deployed.proxy.categoryId));

    const preimage = hexToBin('03'.repeat(32));
    const expected = keccak_256(preimage);
    const callsite = delegate.abi.find((entry) => entry.name === 'reveal')
      ?.externalCalls?.find((call) => call.functionName === 'touch');
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: deployed.proxy,
        functionName: 'reveal',
        args: [probe.inner.lockingBytecode, preimage, expected],
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
    const builder = await composition.build();
    expect(vmRejects(builder)).toBe(false);
    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  }, 300_000);
});
