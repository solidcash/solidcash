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

const fundKeccak = async (
  provider: ReturnType<typeof createMessageBusCapstoneTestProvider>,
  categoryId: string,
): Promise<string> => {
  const sidecarCategory = '77'.repeat(31) + '88';
  for (const lock of [
    binToHex(keccakComputeLockingBytecode(new Uint8Array(32), true)),
    binToHex(keccakComputeLockingBytecode(hexToBin(categoryId).reverse(), true)),
  ]) {
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

describe('kernel proxy × foreign × keccak under composition', () => {
  it('settles deployProxy poke: keccak256 then foreign Sink.accept via withExternalCall', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x4e), provider);
    for (let index = 0; index < 48; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const sinkArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Sink() {
        int seen;
        function accept(bytes32 value) public {
          require(value.length == 32);
          this.seen = 1;
        }
      }`, KERNEL);
    const sinkBase = new Contract(sinkArtifact, [], { provider });
    const sinkSetup = await setupStatefulUtxos(
      provider, sinkBase, sinkArtifact.stateLayout!, { seen: 0n }, { saltContract: true },
    );
    const sink = StatefulContract.withCategory(
      sinkBase.withCategory(hexToBin(sinkSetup.categoryId)), sinkSetup.categoryId,
    );

    // Scalar-only proxy state: local mapping INSERT under proxy+foreign is a separate failure class.
    const implArtifact = compileString(`pragma solidcash >=0.8.0;
      interface ISink { function accept(bytes32 value) external; }
      contract Coordinator() {
        int count;
        function initialize() public { this.count = 0; }
        function poke(address sink, bytes32 preimage, bytes32 expected) public {
          require(keccak256(preimage) == expected);
          ISink(sink).accept(expected);
          this.count = this.count + 1;
        }
      }`, KERNEL);
    expect(implArtifact.delegateArtifact).toBeDefined();
    expect(implArtifact.abi.find((entry) => entry.name === 'poke')?.keccakCompute).toBe(true);

    const deployed = await upgrades.deployProxy(getContractFactory(implArtifact, signer), []);
    deployed.implementation._registerResolvedExternal('ISink', sink);
    const sidecarCategory = await fundKeccak(provider, String(deployed.proxy.categoryId));

    const preimage = hexToBin('0a'.repeat(32));
    const expected = keccak_256(preimage);
    const builder = await (deployed as any)
      .poke(sink.inner.lockingBytecode, preimage, expected)
      .withExternalCall(sink, 'accept', [expected])
      .build() as TransactionBuilder;
    expect(vmRejects(builder)).toBe(false);

    const keccakOut = builder.outputs.find((output) => {
      const category = output.token?.category;
      const hex = typeof category === 'string'
        ? category.toLowerCase()
        : category !== undefined ? binToHex(category).toLowerCase() : '';
      if (hex !== sidecarCategory || output.token?.nft?.capability !== 'mutable') return false;
      const commitment = output.token!.nft!.commitment;
      const len = typeof commitment === 'string' ? commitment.length / 2 : commitment.length;
      return len >= 32;
    });
    expect(keccakOut).toBeDefined();

    await expect(
      (deployed as any).poke(sink.inner.lockingBytecode, preimage, expected)
        .withExternalCall(sink, 'accept', [expected])
        .send(),
    ).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect((await sink.getState()).seen).toBe(1n);
  }, 300_000);

  it('settles compose+executionArtifact×keccak×foreign Sink', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x4f), provider);
    for (let index = 0; index < 48; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const sinkArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Sink() {
        int seen;
        function accept(bytes32 value) public {
          require(value.length == 32);
          this.seen = 1;
        }
      }`, KERNEL);
    const sinkBase = new Contract(sinkArtifact, [], { provider });
    const sinkSetup = await setupStatefulUtxos(
      provider, sinkBase, sinkArtifact.stateLayout!, { seen: 0n }, { saltContract: true },
    );
    const sink = StatefulContract.withCategory(
      sinkBase.withCategory(hexToBin(sinkSetup.categoryId)), sinkSetup.categoryId,
    );

    const implArtifact = compileString(`pragma solidcash >=0.8.0;
      interface ISink { function accept(bytes32 value) external; }
      contract Coordinator() {
        int count;
        function initialize() public { this.count = 0; }
        function poke(address sink, bytes32 preimage, bytes32 expected) public {
          require(keccak256(preimage) == expected);
          ISink(sink).accept(expected);
          this.count = this.count + 1;
        }
      }`, KERNEL);
    const delegate = implArtifact.delegateArtifact!;
    const deployed = await upgrades.deployProxy(getContractFactory(implArtifact, signer), []);
    deployed.implementation._registerResolvedExternal('ISink', sink);
    await fundKeccak(provider, String(deployed.proxy.categoryId));

    const preimage = hexToBin('0b'.repeat(32));
    const expected = keccak_256(preimage);
    const callsite = delegate.abi.find((entry) => entry.name === 'poke')?.externalCalls?.[0];
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: deployed.proxy,
        functionName: 'poke',
        args: [sink.inner.lockingBytecode, preimage, expected],
        executionArtifact: deployed.implementation.inner.artifact,
        executor: deployed.implementation,
      }, {
        contract: sink,
        functionName: 'accept',
        args: [expected],
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
    expect((await sink.getState()).seen).toBe(1n);
  }, 300_000);
});
