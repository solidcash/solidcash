import { binToHex, hexToBin } from '@bitauth/libauth';
import { ecrecoverComputeLockingBytecode } from '@solidcash/utils';
import { ethers } from 'ethers';
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

const littleEndian = (value: string): Uint8Array =>
  hexToBin(value.replace(/^0x/, '')).reverse();

const fundEcrecover = async (
  provider: ReturnType<typeof createMessageBusCapstoneTestProvider>,
  categoryId?: string,
): Promise<void> => {
  const salts = categoryId === undefined
    ? [new Uint8Array(32)]
    : [new Uint8Array(32), hexToBin(categoryId).reverse()];
  const sidecarCategory = 'ed'.repeat(31) + '12';
  for (const salt of salts) {
    for (const role of ['A', 'B2', 'M', 'B3'] as const) {
      await provider.addUtxo(binToHex(ecrecoverComputeLockingBytecode(salt, role)), {
        ...randomUtxo({ satoshis: 100_000n }),
        token: {
          category: sidecarCategory, amount: 0n,
          nft: { capability: 'mutable', commitment: '' },
        },
      });
    }
  }
};

/** Non-empty A/B recreates at branded/shared ecrecover locks (stand-in token categories allowed). */
const ecrecoverRecreates = (
  outputs: TransactionBuilder['outputs'],
  categoryId: string,
): typeof outputs => {
  const salts = [new Uint8Array(32), hexToBin(categoryId).reverse()];
  const locks = new Set(
    salts.flatMap((salt) => (['A', 'B2', 'M', 'B3'] as const)
      .map((role) => binToHex(ecrecoverComputeLockingBytecode(salt, role)).toLowerCase())),
  );
  return outputs.filter((output) => {
    const lock = typeof output.to === 'string'
      ? output.to.toLowerCase()
      : binToHex(output.to as Uint8Array).toLowerCase();
    if (!locks.has(lock) || output.token?.nft?.capability !== 'mutable') return false;
    const commitment = output.token!.nft!.commitment;
    const len = typeof commitment === 'string' ? commitment.length / 2 : commitment.length;
    return len >= 32;
  });
};

describe('kernel proxy × foreign × ecrecover under composition', () => {
  it('settles deployProxy poke: ecrecoverPubKey then foreign Sink.accept via withExternalCall', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x4c), provider);
    for (let index = 0; index < 48; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const wallet = new ethers.Wallet(`0x${'55'.repeat(32)}`);
    const message = 'kernel-proxy-foreign-ecrecover';
    const signature = await wallet.signMessage(message);
    const digestHex = ethers.hashMessage(message);
    const parsed = ethers.Signature.from(signature);
    const digest = littleEndian(digestHex);
    const r = littleEndian(parsed.r);
    const s = littleEndian(parsed.s);

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
        function poke(
          address sink, bytes32 h, int v, bytes32 r, bytes32 s, bytes32 marker
        ) public {
          pubkey signerKey = ecrecoverPubKey(h, v, r, s);
          require(signerKey.length == 33);
          ISink(sink).accept(marker);
          this.count = this.count + 1;
        }
      }`, KERNEL);
    expect(implArtifact.delegateArtifact).toBeDefined();

    const deployed = await upgrades.deployProxy(getContractFactory(implArtifact, signer), []);
    deployed.implementation._registerResolvedExternal('ISink', sink);
    await fundEcrecover(provider, String(deployed.proxy.categoryId));

    const marker = hexToBin('11'.repeat(32));
    const builder = await (deployed as any).poke(
      sink.inner.lockingBytecode, digest, BigInt(parsed.v), r, s, marker,
    ).withExternalCall(sink, 'accept', [marker]).build() as TransactionBuilder;
    expect(vmRejects(builder)).toBe(false);
    // Dual-assert: non-empty A/B sidecar recreation (commitment length), matching keccak foreign settle.
    expect(ecrecoverRecreates(builder.outputs, String(deployed.proxy.categoryId)).length)
      .toBeGreaterThanOrEqual(2);

    await expect(
      (deployed as any).poke(
        sink.inner.lockingBytecode, digest, BigInt(parsed.v), r, s, marker,
      ).withExternalCall(sink, 'accept', [marker]).send(),
    ).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect((await sink.getState()).seen).toBe(1n);
  }, 300_000);

  it('settles compose+executionArtifact×ecrecover×foreign Sink', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x4d), provider);
    for (let index = 0; index < 48; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const wallet = new ethers.Wallet(`0x${'66'.repeat(32)}`);
    const message = 'kernel-proxy-foreign-ecrecover-compose';
    const signature = await wallet.signMessage(message);
    const digestHex = ethers.hashMessage(message);
    const parsed = ethers.Signature.from(signature);
    const digest = littleEndian(digestHex);
    const r = littleEndian(parsed.r);
    const s = littleEndian(parsed.s);

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
        function poke(
          address sink, bytes32 h, int v, bytes32 r, bytes32 s, bytes32 marker
        ) public {
          pubkey signerKey = ecrecoverPubKey(h, v, r, s);
          require(signerKey.length == 33);
          ISink(sink).accept(marker);
          this.count = this.count + 1;
        }
      }`, KERNEL);
    const delegate = implArtifact.delegateArtifact!;
    const deployed = await upgrades.deployProxy(getContractFactory(implArtifact, signer), []);
    deployed.implementation._registerResolvedExternal('ISink', sink);
    await fundEcrecover(provider, String(deployed.proxy.categoryId));

    const marker = hexToBin('12'.repeat(32));
    const callsite = delegate.abi.find((entry) => entry.name === 'poke')?.externalCalls?.[0];
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: deployed.proxy,
        functionName: 'poke',
        args: [sink.inner.lockingBytecode, digest, BigInt(parsed.v), r, s, marker],
        executionArtifact: deployed.implementation.inner.artifact,
        executor: deployed.implementation,
      }, {
        contract: sink,
        functionName: 'accept',
        args: [marker],
        callsiteId: callsite!.callsiteId,
      }],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    const builder = await composition.build();
    expect(vmRejects(builder)).toBe(false);
    expect(ecrecoverRecreates(builder.outputs, String(deployed.proxy.categoryId)).length)
      .toBeGreaterThanOrEqual(2);
    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect((await sink.getState()).seen).toBe(1n);
  }, 300_000);
});
