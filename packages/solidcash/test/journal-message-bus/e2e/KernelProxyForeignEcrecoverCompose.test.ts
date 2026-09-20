import { binToHex, hexToBin } from '@bitauth/libauth';
import { ecrecoverComputeLockingBytecode } from '@solidcash/utils';
import { ethers } from 'ethers';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract, StatefulContract, getContractFactory, upgrades, messageBus, Signer,
} from '../../../src/index.js';
import { randomUtxo } from '../../../src/utils.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

const littleEndian = (value: string): Uint8Array =>
  hexToBin(value.replace(/^0x/, '')).reverse();

describe('kernel proxy × foreign × ecrecover under composition', () => {
  it('characterizes deployProxy poke ecrecover×foreign via withExternalCall: fails closed (no hang)', async () => {
    // General shape: recover then mutate a foreign mapping under deployProxy.
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

    const bankArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Bank() {
        mapping(int => int) bal;
        function seed(int k, int v) public { bal[k] = v; }
        function credit(int k, int v) public { bal[k] = bal[k] + v; }
      }`, KERNEL);
    const bankBase = new Contract(bankArtifact, [], { provider });
    const bankSetup = await setupStatefulUtxos(
      provider, bankBase, bankArtifact.stateLayout!, {}, { saltContract: true },
    );
    const bank = StatefulContract.withCategory(
      bankBase.withCategory(hexToBin(bankSetup.categoryId)), bankSetup.categoryId,
    );
    await bank.call.seed(2n, 10n).send();

    const implArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IBank { function credit(int k, int v) external; }
      contract Coordinator() {
        int count;
        function initialize() public { this.count = 0; }
        function poke(
          address bank, bytes32 h, int v, bytes32 r, bytes32 s, int k, int amt
        ) public {
          pubkey signer = ecrecoverPubKey(h, v, r, s);
          require(signer.length == 33);
          IBank(bank).credit(k, amt);
          this.count = this.count + 1;
        }
      }`, KERNEL);
    expect(implArtifact.delegateArtifact).toBeDefined();

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

    const deployed = await upgrades.deployProxy(getContractFactory(implArtifact, signer), []);
    deployed.implementation._registerResolvedExternal('IBank', bank);

    // Self-proxy ecrecover alone settles (K3b); adding foreign Bank credit under __forward OP_VERIFYs.
    // Pin fail-closed until sidecar+foreign proxy placement is fixed.
    await expect(
      (deployed as any).poke(
        bank.inner.lockingBytecode, digest, BigInt(parsed.v), r, s, 2n, 5n,
      ).withExternalCall(bank, 'credit', [2n, 5n]).send(),
    ).rejects.toThrow(/BCH-2026 preflight failed|OP_VERIFY/);
  }, 300_000);

  it('characterizes compose+executionArtifact×ecrecover×foreign: fails closed (no hang)', async () => {
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

    const bankArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Bank() {
        mapping(int => int) bal;
        function seed(int k, int v) public { bal[k] = v; }
        function credit(int k, int v) public { bal[k] = bal[k] + v; }
      }`, KERNEL);
    const bankBase = new Contract(bankArtifact, [], { provider });
    const bankSetup = await setupStatefulUtxos(
      provider, bankBase, bankArtifact.stateLayout!, {}, { saltContract: true },
    );
    const bank = StatefulContract.withCategory(
      bankBase.withCategory(hexToBin(bankSetup.categoryId)), bankSetup.categoryId,
    );
    await bank.call.seed(2n, 10n).send();

    const implArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IBank { function credit(int k, int v) external; }
      contract Coordinator() {
        int count;
        function initialize() public { this.count = 0; }
        function poke(
          address bank, bytes32 h, int v, bytes32 r, bytes32 s, int k, int amt
        ) public {
          pubkey signer = ecrecoverPubKey(h, v, r, s);
          require(signer.length == 33);
          IBank(bank).credit(k, amt);
          this.count = this.count + 1;
        }
      }`, KERNEL);
    const delegate = implArtifact.delegateArtifact!;

    for (const role of ['A', 'B'] as const) {
      await provider.addUtxo(binToHex(ecrecoverComputeLockingBytecode(new Uint8Array(32), role)), {
        ...randomUtxo({ satoshis: 100_000n }),
        token: {
          category: 'ed'.repeat(32), amount: 0n,
          nft: { capability: 'mutable', commitment: '' },
        },
      });
    }

    const deployed = await upgrades.deployProxy(getContractFactory(implArtifact, signer), []);
    deployed.implementation._registerResolvedExternal('IBank', bank);
    const callsite = delegate.abi.find((entry) => entry.name === 'poke')?.externalCalls?.[0];
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: deployed.proxy,
        functionName: 'poke',
        args: [bank.inner.lockingBytecode, digest, BigInt(parsed.v), r, s, 2n, 5n],
        executionArtifact: deployed.implementation.inner.artifact,
        executor: deployed.implementation,
      }, {
        contract: bank,
        functionName: 'credit',
        args: [2n, 5n],
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
