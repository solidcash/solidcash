import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract,
  Signer,
} from '../../src/index.js';
import {
  getContractFactory,
  StatefulContract,
  upgrades,
} from '../../src/stateful/index.js';
import * as messageBus from '../../src/message-bus/index.js';
import { isContractUnlocker } from '../../src/interfaces.js';
import type { ExternalCallUtxoGroup } from '../../src/stateful/external-call-utxo-group.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import type { PreparedAtomicMessageBusCall } from '../../src/message-bus/compose.js';
import { createMessageBusSemanticTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';
import { messageBusVmAccepts } from '../journal-message-bus/e2e/vm-accepts.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../test-util.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true,
  maximumInputBytes: 1_000_000, suppressWarnings: true,
} as const;

describe('kernel late satoshi-container resources', () => {
  it.each([{ active: true, funded: true }, { active: false, funded: false }, { active: false, funded: true }])(
    'settles a late conditional payment (active $active, funded $funded)', async ({ active, funded }) => {
      const provider = createMessageBusSemanticTestProvider();
      const participant = async (source: string, args: string[] = []): Promise<StatefulContract> => {
        const artifact = compileString(source, { ...KERNEL, messageBusGraphContext: true });
        const base = new Contract(artifact, args, { provider });
        const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
        return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
      };
      const receipt = await participant(`contract LateReceipt() {
        int public stored;
        function record(int amount) public returns (bool) { this.stored = amount; return true; }
      }`);
      const wallet = await participant(`interface ILateReceipt { function record(int amount) external returns (bool); }
      contract LateWallet() {
      int public calls;
      function touch(int value) public { this.calls = value; require(true); }
      function pay(bool active, address destination, int amount, address receipt) public {
        this.calls = this.calls + 1;
        if (active) { this.transfer(destination, amount); }
        address(receipt).call(abi.encodeCall(ILateReceipt.record, (amount)));
        require(true);
      }
    }`);
      wallet._registerResolvedExternal('ILateReceipt', receipt);
      wallet._registerResolvedExternal('__raw__', receipt);
      const primer = await participant(`interface ILateWallet { function touch(int value) external; }
      contract LatePrimer(address wallet) {
        function prime() public { ILateWallet(wallet).touch(0); require(true); }
      }`, [wallet.inner.lockingBytecode]);
      primer._registerResolvedExternal('ILateWallet', wallet);
      const middle = await participant(`interface ILateWallet {
      function pay(bool active, address destination, int amount, address receipt) external;
    }
    contract LateMiddle(address wallet) {
      function run(bool active, address destination, int amount, address receipt) public {
        ILateWallet(wallet).pay(active, destination, amount, receipt); require(true);
      }
    }`, [wallet.inner.lockingBytecode]);
      middle._registerResolvedExternal('ILateWallet', wallet);
      const relayArtifact = compileString(`interface ILatePrimer { function prime() external; }
    interface ILateMiddle {
      function run(bool active, address destination, int amount, address receipt) external;
    }
    contract LateRelay() {
      int public runs;
      function relay(address primer, address middle, bool active, address destination, int amount,
                     address receipt) public {
        this.runs = this.runs + 1;
        ILatePrimer(primer).prime();
        ILateMiddle(middle).run(active, destination, amount, receipt); require(true);
      }
    }`, KERNEL);
      const signer = new Signer(new Uint8Array(32).fill(0x4b), provider);
      for (let index = 0; index < 20; index += 1) {
        await provider.addUtxo(signer.getAddress(), {
          txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
        });
      }
      const deployed = await upgrades.deployProxy(
        getContractFactory(relayArtifact, signer), { runs: 0n }, { initializer: false },
      );
      deployed.implementation._registerResolvedExternal('ILateMiddle', middle);
      deployed.implementation._registerResolvedExternal('ILatePrimer', primer);
      const destination = hexToBin(`76a914${'37'.repeat(20)}88ac`);
      if (funded) {
        await provider.addUtxo(wallet.satoshiContainer.address, {
          txid: 'c7'.repeat(32), vout: 0, satoshis: 50_000n,
        });
      }
      const call = (deployed as any).relay(
        primer.inner.lockingBytecode, middle.inner.lockingBytecode, active, destination, 1_000n,
        receipt.inner.lockingBytecode,
      );
      const prepared = await (call as unknown as {
        _applyOverrides(): Promise<{
          getExternalCallUtxoGroups(): ExternalCallUtxoGroup[];
          __preparedAtomicCalls?: PreparedAtomicMessageBusCall[];
        }>;
      })._applyOverrides();
      const group = prepared.getExternalCallUtxoGroups().find((candidate) => candidate.categoryId === wallet.categoryId
      && candidate.sharedGroupIndex === undefined);
      expect(group?.blockLayout?.slots.map((slot) => slot.kind)).toContain('satoshiContainer');
      expect(group?.blockInputs).toHaveLength(group!.blockLayout!.blockSize);
      const provisional = await call.build();
      const masterIndex = provisional.inputs.findIndex((input) => input.token?.category === wallet.categoryId
      && input.token.nft?.capability === 'minting');
      expect(masterIndex).toBeGreaterThan(0);
      if (funded) {
        const container = provisional.inputs.find((input) => input.txid === 'c7'.repeat(32))!;
        expect(isContractUnlocker(container.unlocker)).toBe(true);
        if (!isContractUnlocker(container.unlocker)) throw new Error('missing container unlocker');
        expect(container.unlocker.params).toEqual([1n, BigInt(masterIndex)]);
      }
      expect(prepared.__preparedAtomicCalls?.map((node) => node.functionName))
        .toEqual(['relay', 'prime', 'touch', 'run', 'pay', 'record']);
      const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
      const composed = messageBus.compose({
        preparedCalls: prepared.__preparedAtomicCalls!, funder, changeAddress: signer.getAddress(),
      });
      const builder = await composed.build();
      const transaction = builder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
      const vm = createVirtualMachineBch2026ForProvider(provider);
      expect(transaction.inputs.map((_input, inputIndex) => vm.stateSuccess(
        vm.evaluate({ inputIndex, sourceOutputs, transaction }),
      ))).toEqual(transaction.inputs.map(() => true));
      expect(messageBusVmAccepts(builder)).toBe(true);
      if (active) {
        expect(builder.outputs.some((output) => output.amount === 1_000n
        && output.to instanceof Uint8Array && binToHex(output.to) === binToHex(destination))).toBe(true);
        const containerOutput = transaction.outputs.find((output) => output.valueSatoshis === 49_000n)!;
        expect(containerOutput).toBeDefined();
        containerOutput.valueSatoshis -= 1n;
        expect(transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
          vm.evaluate({ inputIndex, sourceOutputs, transaction }),
        ) === true)).toBe(false);
      }
      await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
      expect((await wallet.getState()).calls).toBe(1n);
      expect((await receipt.getState()).stored).toBe(1_000n);
      expect((await provider.getUtxos(wallet.satoshiContainer.address)).map((utxo) => utxo.satoshis))
        .toEqual(funded ? [active ? 49_000n : 50_000n] : []);
    }, 180_000,
  );
});
