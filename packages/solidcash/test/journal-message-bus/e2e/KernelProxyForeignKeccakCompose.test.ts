import { binToHex, hexToBin } from '@bitauth/libauth';
import { keccakComputeLockingBytecode } from '@solidcash/utils';
import { keccak_256 } from '@noble/hashes/sha3.js';
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

describe('kernel proxy × foreign × keccak under composition', () => {
  it('characterizes deployProxy poke keccak×foreign via withExternalCall: fails closed (no hang)', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x4e), provider);
    for (let index = 0; index < 48; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

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
        function poke(address bank, bytes32 preimage, bytes32 expected, int k, int amt) public {
          require(keccak256(preimage) == expected);
          IBank(bank).credit(k, amt);
          this.count = this.count + 1;
        }
      }`, KERNEL);
    expect(implArtifact.delegateArtifact).toBeDefined();
    expect(implArtifact.abi.find((entry) => entry.name === 'poke')?.keccakCompute).toBe(true);

    const deployed = await upgrades.deployProxy(getContractFactory(implArtifact, signer), []);
    deployed.implementation._registerResolvedExternal('IBank', bank);

    const sidecarCategory = '77'.repeat(32);
    for (const lock of [
      binToHex(keccakComputeLockingBytecode(new Uint8Array(32), true)),
      binToHex(keccakComputeLockingBytecode(hexToBin(String(deployed.proxy.categoryId)).reverse(), true)),
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

    const preimage = hexToBin('0a'.repeat(32));
    const expected = keccak_256(preimage);
    // Self-proxy keccak alone settles (K3a); adding foreign Bank credit under __forward OP_VERIFYs
    // at the keccak require — pin fail-closed until deferred sidecar/owner-base placement is fixed.
    await expect(
      (deployed as any).poke(bank.inner.lockingBytecode, preimage, expected, 2n, 5n)
        .withExternalCall(bank, 'credit', [2n, 5n])
        .send(),
    ).rejects.toThrow(/BCH-2026 preflight failed|OP_VERIFY/);
  }, 300_000);

  it('characterizes compose+executionArtifact×keccak×foreign: fails closed (no hang)', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x4f), provider);
    for (let index = 0; index < 48; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

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
        function poke(address bank, bytes32 preimage, bytes32 expected, int k, int amt) public {
          require(keccak256(preimage) == expected);
          IBank(bank).credit(k, amt);
          this.count = this.count + 1;
        }
      }`, KERNEL);
    const delegate = implArtifact.delegateArtifact!;
    const deployed = await upgrades.deployProxy(getContractFactory(implArtifact, signer), []);
    deployed.implementation._registerResolvedExternal('IBank', bank);

    const sidecarCategory = '77'.repeat(32);
    for (const lock of [
      binToHex(keccakComputeLockingBytecode(new Uint8Array(32), true)),
      binToHex(keccakComputeLockingBytecode(hexToBin(String(deployed.proxy.categoryId)).reverse(), true)),
    ]) {
      await provider.addUtxo(lock, {
        ...randomUtxo({ satoshis: 100_000n }),
        token: {
          category: sidecarCategory, amount: 0n,
          nft: { capability: 'mutable', commitment: '' },
        },
      });
    }

    const preimage = hexToBin('0b'.repeat(32));
    const expected = keccak_256(preimage);
    const callsite = delegate.abi.find((entry) => entry.name === 'poke')?.externalCalls?.[0];
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: deployed.proxy,
        functionName: 'poke',
        args: [bank.inner.lockingBytecode, preimage, expected, 2n, 5n],
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
