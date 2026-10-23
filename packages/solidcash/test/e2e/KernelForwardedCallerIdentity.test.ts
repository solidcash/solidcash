import { binToHex, hexToBin } from '@bitauth/libauth';
import { addressToGraphEmissionBytes } from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import * as messageBus from '../../src/message-bus/index.js';
import { isContractUnlocker } from '../../src/interfaces.js';
import type { PreparedAtomicMessageBusCall } from '../../src/message-bus/compose-prepared-invocation.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import type { StatefulTransactionBuilder } from '../../src/stateful/StatefulTransactionBuilder.js';
import { addressToLockScript, generateLibauthSourceOutputs } from '../../src/utils.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';
import { createBareP2pkhFeeFunder } from '../test-util.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true, messageBusGraphContext: true,
  evmCompat: true, maximumInputBytes: 1_000_000, suppressWarnings: true,
} as const;

describe('kernel forwarded contract caller identity', () => {
  it('preserves public self coordinates when value folds append route witnesses', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x5a), provider);
    for (let index = 0; index < 12; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract Journal() {
        mapping(uint => uint[]) history;
        function append(uint key, uint value, bytes expectedSelf) public {
          require(bytes(address(this)) == expectedSelf, "wrong public self");
          this.history[key].push(value);
          require(true);
        }
      }`, KERNEL);
    expect(artifact.messageBus!.route.inputs.some((input) =>
      input.name.startsWith('__internal__completePushValue_'))).toBe(true);
    const journal = await getContractFactory(artifact, signer).deploy();
    const driverArtifact = compileString(`pragma solidity ^0.8.0;
      interface IJournal { function append(uint key, uint value, bytes expectedSelf) external; }
      contract Driver(address target) {
        function run(bytes expectedSelf) public {
          IJournal(target).append(1, 7, expectedSelf);
          require(true);
        }
      }`, KERNEL);
    const driver = await getContractFactory(driverArtifact, signer).deploy(journal.inner.address);
    const journalAddress = addressToLockScript(await journal.getAddress());
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        { contract: driver, functionName: 'run', args: [journalAddress] },
        {
          contract: journal, functionName: 'append', args: [1n, 7n, journalAddress],
          targetLockingBytecode: journal.inner.lockingBytecode,
        },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/u) });
  }, 180_000);

  it.each([false, true])(
    'spends an approval using the same caller identity (nested proxy: %s)',
    async (nestedProxy) => {
      const provider = createMessageBusCapstoneTestProvider();
      const signer = new Signer(new Uint8Array(32).fill(0x59), provider);
      for (let index = 0; index < 60; index += 1) await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
      });
      const ledgerArtifact = compileString(`pragma solidity ^0.8.0;
      contract Ledger() {
        mapping(address => mapping(address => uint)) allowances;
        function approve(address spender, uint amount) public {
          this.allowances[msg.sender][spender] = amount;
          require(true);
        }
        function spendFrom(address owner, address spenderSelf, uint amount) public {
          require(msg.sender == spenderSelf, "inconsistent spender identity");
          uint allowance = this.allowances[owner][msg.sender];
          require(allowance >= amount, "insufficient allowance");
          this.allowances[owner][msg.sender] = allowance - amount;
          require(true);
        }
      }`, KERNEL);
      const spenderArtifact = compileString(`pragma solidity ^0.8.0;
      interface ILedger { function spendFrom(address owner, address spenderSelf, uint amount) external; }
      contract Spender(${nestedProxy ? '' : 'address ledger'}) {
        ${nestedProxy ? `address ledger;
        uint count;
        function initialize(address target) public { this.ledger = target; this.count = 0; }` : ''}
        function spend(address owner, uint amount) public {
          ILedger(${nestedProxy ? 'this.ledger' : 'ledger'}).spendFrom(owner, address(this), amount);
          ${nestedProxy ? 'this.count = this.count + 1;' : ''}
          require(true);
        }
      }`, KERNEL);
      const callerArtifact = compileString(`pragma solidity ^0.8.0;
      interface ILedger { function approve(address spender, uint amount) external; }
      interface ISpender { function spend(address owner, uint amount) external; }
      contract Caller() {
        uint count;
        function initialize() public { this.count = 0; }
        function run(address ledger, address spender, uint amount) public {
          ILedger(ledger).approve(spender, amount);
          ISpender(spender).spend(address(this), amount);
          this.count = this.count + 1;
          require(true);
        }
      }`, KERNEL);
      const ledger = await getContractFactory(ledgerArtifact, signer).deploy();
      const spenderFactory = getContractFactory(spenderArtifact, signer);
      const spender = nestedProxy
        ? await upgrades.deployProxy(spenderFactory, [await ledger.getAddress()])
        : await spenderFactory.deploy(await ledger.getAddress());
      const caller = await upgrades.deployProxy(getContractFactory(callerArtifact, signer), []);
      ('implementation' in spender ? spender.implementation : spender)._registerResolvedExternal('ILedger', ledger);
      caller.implementation._registerResolvedExternal('ILedger', ledger);
      caller.implementation._registerResolvedExternal('ISpender', spender);
      const call = caller.forward('run', [await ledger.getAddress(), await spender.getAddress(), 100n]);
      const prepared = await (call as unknown as {
        _applyOverrides(): Promise<StatefulTransactionBuilder & {
          __preparedAtomicCalls?: readonly PreparedAtomicMessageBusCall[];
        }>;
      })._applyOverrides();
      const spend = prepared.__preparedAtomicCalls?.find((entry) => entry.functionName === 'spendFrom');
      expect(spend).toBeDefined();
      const callerWord = addressToGraphEmissionBytes(addressToLockScript(await caller.getAddress()));
      expect(callerWord).not.toEqual(addressToGraphEmissionBytes(addressToLockScript(caller.proxy.inner.address)));
      expect(binToHex(addressToGraphEmissionBytes(spend!.args[0] as Uint8Array)))
        .toBe(binToHex(callerWord));

      const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
      const builder = await messageBus.compose({
        preparedCalls: prepared.__preparedAtomicCalls!,
        funder,
        changeAddress: funder.unlocker.generateLockingBytecode(),
      }).build();
      const inputIndex = builder.inputs.findIndex(({ unlocker }) => isContractUnlocker(unlocker)
      && unlocker.abiFunction.inputs.some((input) => input.name === '__internal__graphSelfIdentityInput'));
      expect(inputIndex).toBeGreaterThanOrEqual(0);
      const { unlocker } = builder.inputs[inputIndex];
      if (!isContractUnlocker(unlocker)) throw new Error('Missing delegated route unlocker');
      const witnessIndex = unlocker.abiFunction.inputs.findIndex(
        (input) => input.name === '__internal__graphSelfIdentityInput',
      );
      const anchorIndex = Number(unlocker.params[witnessIndex]);
      expect(anchorIndex).toBeGreaterThanOrEqual(0);
      const transaction = builder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
      const vm = createVirtualMachineBch2026ForProvider(provider);
      expect(vm.stateSuccess(vm.evaluate({ transaction, sourceOutputs, inputIndex }))).toBe(true);
      const anchor = sourceOutputs[anchorIndex];
      expect(anchor.token?.nft?.capability).toBe('none');
      expect(binToHex(anchor.lockingBytecode)).toBe(binToHex(addressToLockScript(await caller.getAddress())));
      const malformedCommitment = anchor.token!.nft!.commitment.slice();
      malformedCommitment[0] ^= 1;
      const foreignOwnerCommitment = anchor.token!.nft!.commitment.slice();
      foreignOwnerCommitment[foreignOwnerCommitment.length - 1] ^= 1;
      for (const token of [
        { ...anchor.token!, category: Uint8Array.from({ length: 32 }, (_v, i) => (i === 31 ? 0xce : 0x31)) },
        { ...anchor.token!, nft: { ...anchor.token!.nft!, capability: 'mutable' as const } },
        { ...anchor.token!, nft: { ...anchor.token!.nft!, commitment: malformedCommitment } },
        { ...anchor.token!, nft: { ...anchor.token!.nft!, commitment: foreignOwnerCommitment } },
      ]) {
        const forgedOutputs = sourceOutputs.map((output, index) => index === anchorIndex ? { ...output, token } : output);
        expect(vm.stateSuccess(vm.evaluate({ transaction, sourceOutputs: forgedOutputs, inputIndex }))).not.toBe(true);
      }
      const forgedArgs = [...unlocker.params];
      forgedArgs[witnessIndex] = -1n;
      const physicalSelfUnlocker = unlocker.contract.createCompilerRouteUnlocker(
        unlocker.abiFunction, hexToBin(unlocker.contract.artifact.messageBus!.route.selector),
      )(...forgedArgs);
      const forgedTransaction = {
        ...transaction,
        inputs: transaction.inputs.map((input, index) => index === inputIndex ? {
          ...input,
          unlockingBytecode: physicalSelfUnlocker.generateUnlockingBytecode({ transaction, sourceOutputs, inputIndex }),
        } : input),
      };
      expect(vm.stateSuccess(vm.evaluate({ transaction: forgedTransaction, sourceOutputs, inputIndex }))).not.toBe(true);
      await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/u) });
    }, 180_000);
});
