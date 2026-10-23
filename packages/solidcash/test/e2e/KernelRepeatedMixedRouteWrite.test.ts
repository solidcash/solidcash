import {
  bigIntToVmNumber, binToHex, decodeAuthenticationInstructions, encodeAuthenticationInstructions,
} from '@bitauth/libauth';
import { MESSAGE_BUS_VERIFIER_COMMITMENT_DOMAIN, scriptToBytecode } from '@solidcash/utils';
import { compileString, compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import * as messageBus from '../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import type { TransactionBuilder } from '../../src/TransactionBuilder.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

describe('kernel repeated writes beside a direct-only participant', () => {
  it.each(['Ledger', 'ILedger'])('preserves an earlier mapping update and both later appends via %s', async (calleeType) => {
    const source = `pragma solidity ^0.8.20;
      struct Record { string note; uint256 count; }
      struct Payment { address payable recipient; uint256 amount; bool enabled; }
      interface ILedger {
        function bump(uint256 key) external;
        function append(uint256 key, bytes memory value) external;
      }
      contract Ledger {
        mapping(uint256 => Record) public records;
        mapping(uint256 => bytes[]) public messages;
        function initialize() public { require(true); }
        function seed(uint256 key, string memory note) public {
          this.records[key] = Record(note, 0);
        }
        function bump(uint256 key) public {
          this.records[key].count = this.records[key].count + 1;
        }
        function append(uint256 key, bytes memory value) public {
          this.messages[key].push(value);
        }
      }
      contract Payer {
        mapping(uint256 => Payment) public payments;
        uint256 public visits;
        function initialize() public { require(true); }
        function visit(uint256 key) public {
          Payment memory payment = this.payments[key];
          if (payment.enabled) {
            (bool success,) = payment.recipient.call{value: payment.amount}("");
            require(success);
          }
          this.visits = this.visits + 1;
        }
      }
      contract AlternatePayer {
        uint256 public visits;
        function initialize() public { require(true); }
        function visit(uint256 key) public {
          this.visits = this.visits + 10;
          require(key >= 0);
        }
      }
      contract Coordinator {
        address public ledger;
        address public payer;
        uint256 public runs;
        function initialize() public { require(true); }
        function seed(address first, address second) public {
          this.ledger = first;
          this.payer = second;
        }
        function run(uint256 key) public {
          Payer(this.payer).visit(key);
          ${calleeType}(this.ledger).bump(key);
          ${calleeType}(this.ledger).append(key, hex"11");
          ${calleeType}(this.ledger).append(key, hex"22");
          this.runs = this.runs + 1;
        }
      }`;
    const options = { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true,
      messageBusDirectParticipant: true, messageBusProxyForwardEnvelope: true,
      maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: false } as const;
    const artifacts = compileStringMulti(source, options);
    // This scenario intentionally mixes a direct-only participant with kernel-routed siblings. Keep that
    // selection explicit instead of depending on whether a low-level call happens to pass kernel admission.
    const payerArtifact = compileString(source, { ...options, primaryContractName: 'Payer', messageBus: false });
    const alternatePayerArtifact = compileString(source, {
      ...options, primaryContractName: 'AlternatePayer', messageBus: false,
    });
    expect(payerArtifact.messageBus).toBeUndefined();
    expect(alternatePayerArtifact.messageBus).toBeUndefined();
    for (const name of ['bump', 'append']) {
      expect(artifacts.Ledger.delegateArtifact!.messageBus?.handlers.find((handler) => handler.name === name))
        .toMatchObject({ eligible: true });
    }
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x6b), provider);
    for (let index = 0; index < 24; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const ledger = await upgrades.deployProxy(getContractFactory(artifacts.Ledger, signer), []);
    const payer = await getContractFactory(payerArtifact, signer).deploy();
    const alternatePayer = await getContractFactory(alternatePayerArtifact, signer).deploy();
    const coordinator = await upgrades.deployProxy(getContractFactory(artifacts.Coordinator, signer), []);
    coordinator.implementation._registerResolvedExternal(calleeType, ledger.proxy);
    coordinator.implementation._registerResolvedExternal('Payer', payer);
    await ledger.forward('seed', [7n, 'authenticated chunked record '.repeat(5)]).send();
    await coordinator.forward('seed', [ledger.proxy.inner.lockingBytecode, payer.inner.lockingBytecode]).send();
    if (calleeType === 'Ledger') {
      // White-box only for the adversarial VM proof: public send() consumes this prepared graph before
      // building its atomic transaction. The public build() returns only the preliminary direct builder.
      type PreparedBuilder = {
        __preparedAtomicCalls?: Parameters<typeof messageBus.compose>[0]['preparedCalls'];
        build(): TransactionBuilder;
      };
      const preparation = coordinator.forward('run', [7n]) as unknown as {
        _applyOverrides(): Promise<PreparedBuilder>;
      };
      const prepared = await preparation._applyOverrides();
      const preparedCalls = prepared.__preparedAtomicCalls;
      expect(preparedCalls).toBeDefined();
      if (!preparedCalls) throw new Error('mixed route has no prepared atomic graph');
      const usedOutpoints = new Set(prepared.build().inputs.map((input) => `${input.txid}:${input.vout}`));
      const feeUtxos = (await signer.getUtxos())
        .filter((utxo) => utxo.token === undefined)
        .sort((left, right) => Number(right.satoshis - left.satoshis));
      const feeUtxo = feeUtxos.find((utxo) => !usedOutpoints.has(`${utxo.txid}:${utxo.vout}`));
      expect(feeUtxo).toBeDefined();
      if (!feeUtxo) throw new Error('mixed route has no fresh token-free fee input');
      const builder = await messageBus.compose({
        preparedCalls,
        funder: { ...feeUtxo, unlocker: signer.unlockP2PKH() },
        changeAddress: signer.getAddress(),
      }).build();
      const matchingInputs = (categoryId: string, lockingBytecode: string, functionName: string): number[] => builder.inputs
        .map((input, index) => ({ input, index }))
        .filter(({ input }) => input.token?.category === categoryId
          && binToHex(input.unlocker.generateLockingBytecode()) === lockingBytecode
          && 'contract' in input.unlocker && input.unlocker.abiFunction.name === functionName)
        .map(({ index }) => index);
      const payerInputs = matchingInputs(payer.categoryId, payer.inner.lockingBytecode, 'visit');
      const ledgerInputs = matchingInputs(ledger.proxy.categoryId, ledger.proxy.inner.lockingBytecode, '__forward');
      expect(payerInputs).toHaveLength(1);
      expect(ledgerInputs).toHaveLength(1);
      const payerInputIndex = payerInputs[0];
      const ledgerInputIndex = ledgerInputs[0];
      expect(payerInputIndex).not.toBe(ledgerInputIndex);
      const allVerifierInputs = builder.inputs
        .map((input, index) => ({ input, index }))
        .filter(({ input }) => input.token?.nft?.capability === 'mutable'
          && input.token.nft.commitment.toLowerCase()
            .startsWith(binToHex(MESSAGE_BUS_VERIFIER_COMMITMENT_DOMAIN)))
        .map(({ index }) => index);
      expect(allVerifierInputs).toHaveLength(2); // routed Coordinator and Ledger; direct Payer has no verifier NFT
      const verifierInputIndex = allVerifierInputs[0]; // canonical routed participant order
      const payerInput = builder.inputs[payerInputIndex];
      if (!('contract' in payerInput.unlocker)) throw new Error('direct Payer input has no contract unlocker');
      const originalUnlocker = payerInput.unlocker;
      const inputs = originalUnlocker.abiFunction.inputs;
      const hiddenIndex = inputs.findIndex((input) => input.name === '__internal__callInputIndex');
      const keyIndex = inputs.findIndex((input) => input.name === 'key');
      expect(hiddenIndex).toBeGreaterThanOrEqual(0);
      expect(keyIndex).toBeGreaterThanOrEqual(0);
      expect(originalUnlocker.params[hiddenIndex]).toBe(BigInt(builder.inputs.length));
      const honestTransaction = builder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
      const vm = createVirtualMachineBch2026ForProvider(builder.provider);
      const vmAcceptsInput = (transaction: typeof honestTransaction, inputIndex: number): boolean => vm.stateSuccess(
        vm.evaluate({ inputIndex, sourceOutputs, transaction }),
      ) === true;
      const directInputBytes = honestTransaction.inputs[payerInputIndex].unlockingBytecode.length;
      const verifierInputBytes = allVerifierInputs.map((index) => honestTransaction.inputs[index].unlockingBytecode.length);
      expect(directInputBytes).toBeLessThanOrEqual(10_000);
      for (const length of verifierInputBytes) expect(length).toBeLessThanOrEqual(10_000);
      expect(vmAcceptsInput(honestTransaction, payerInputIndex)).toBe(true);
      expect(vmAcceptsInput(honestTransaction, verifierInputIndex)).toBe(true);

      const expectOnePushRejected = (abiIndex: number, replacement: bigint): void => {
        const pushIndex = 1 + inputs.length - 1 - abiIndex; // selector, reversed ABI arguments, redeem
        const replacementPush = decodeAuthenticationInstructions(
          scriptToBytecode([bigIntToVmNumber(replacement)]),
        )[0];
        if (!replacementPush) throw new Error('replacement argument has no push instruction');
        builder.inputs[payerInputIndex] = {
          ...payerInput,
          unlocker: {
            ...originalUnlocker,
            generateUnlockingBytecode(unlockOptions) {
              const instructions = decodeAuthenticationInstructions(
                originalUnlocker.generateUnlockingBytecode(unlockOptions),
              );
              if (instructions.length !== inputs.length + 2 || !instructions[pushIndex]) {
                throw new Error('direct Payer unlocking frame differs from selector/reversed-ABI/redeem layout');
              }
              if (instructions[pushIndex].opcode === replacementPush.opcode
                && ('data' in instructions[pushIndex] ? binToHex(instructions[pushIndex].data) : '')
                  === ('data' in replacementPush ? binToHex(replacementPush.data) : '')) {
                throw new Error('adversarial replacement did not change the Payer argument');
              }
              instructions[pushIndex] = replacementPush;
              return encodeAuthenticationInstructions(instructions);
            },
          },
        };
        try {
          const forgedTransaction = builder.buildLibauthTransaction();
          // The absent payment's low-level branch is inactive, so Payer's own covenant still accepts the
          // changed frame. The V5 routed verifier must reject it solely for disagreeing with the graph.
          expect(vmAcceptsInput(forgedTransaction, payerInputIndex)).toBe(true);
          expect(vmAcceptsInput(forgedTransaction, verifierInputIndex)).toBe(false);
        } finally {
          builder.inputs[payerInputIndex] = payerInput;
        }
      };
      expectOnePushRejected(hiddenIndex, BigInt(ledgerInputIndex));
      expectOnePushRejected(keyIndex, 8n);
      expect(builder.buildLibauthTransaction().inputs[payerInputIndex].unlockingBytecode)
        .toEqual(honestTransaction.inputs[payerInputIndex].unlockingBytecode);
    }
    await expect(coordinator.forward('run', [7n]).send()).resolves.toBeDefined();
    expect((await payer.getState()).visits).toBe(1n);
    const records = await ledger.proxy.getEntries('records');
    expect(records).toHaveLength(1);
    expect(records[0].value).toMatchObject({ count: 1n });
    const messages = await ledger.proxy.getEntries('messages');
    expect(messages).toHaveLength(1);
    expect(messages[0].value).toEqual([new Uint8Array([0x11]), new Uint8Array([0x22])]);
    // The caller's Payer-typed state is an address, not a static bytecode pin. Switch it to a separately
    // compiled implementation with the same visit(uint256) ABI, then spend that direct covenant in V5.
    await coordinator.forward('seed', [ledger.proxy.inner.lockingBytecode, alternatePayer.inner.lockingBytecode]).send();
    coordinator.implementation._registerResolvedExternal('Payer', alternatePayer);
    if (calleeType === 'Ledger') {
      type PreparedBuilder = {
        __preparedAtomicCalls?: Parameters<typeof messageBus.compose>[0]['preparedCalls'];
        build(): TransactionBuilder;
      };
      const preparation = coordinator.forward('run', [7n]) as unknown as {
        _applyOverrides(): Promise<PreparedBuilder>;
      };
      const prepared = await preparation._applyOverrides();
      if (!prepared.__preparedAtomicCalls) throw new Error('alternate direct target has no prepared atomic graph');
      const usedOutpoints = new Set(prepared.build().inputs.map((input) => `${input.txid}:${input.vout}`));
      const feeUtxo = (await signer.getUtxos()).find((utxo) =>
        utxo.token === undefined && !usedOutpoints.has(`${utxo.txid}:${utxo.vout}`));
      if (!feeUtxo) throw new Error('alternate direct target has no fee input');
      const builder = await messageBus.compose({
        preparedCalls: prepared.__preparedAtomicCalls,
        funder: { ...feeUtxo, unlocker: signer.unlockP2PKH() },
        changeAddress: signer.getAddress(),
      }).build();
      const directIndex = builder.inputs.findIndex((input) => input.token?.category === alternatePayer.categoryId
        && 'contract' in input.unlocker && input.unlocker.abiFunction.name === 'visit');
      const verifierIndex = builder.inputs.findIndex((input) => input.token?.nft?.commitment.toLowerCase()
        .startsWith(binToHex(MESSAGE_BUS_VERIFIER_COMMITMENT_DOMAIN)));
      expect(directIndex).toBeGreaterThanOrEqual(0);
      expect(verifierIndex).toBeGreaterThanOrEqual(0);
      const original = builder.inputs[directIndex];
      const replacement = decodeAuthenticationInstructions(scriptToBytecode([bigIntToVmNumber(8n)]))[0];
      if (!replacement) throw new Error('alternate direct argument has no replacement push');
      builder.inputs[directIndex] = {
        ...original,
        unlocker: {
          ...original.unlocker,
          generateUnlockingBytecode(unlockOptions) {
            const instructions = decodeAuthenticationInstructions(
              original.unlocker.generateUnlockingBytecode(unlockOptions),
            );
            if (instructions.length !== 3 || !instructions[1]) {
              throw new Error('alternate direct scalar frame is not selector/argument/redeem');
            }
            instructions[1] = replacement;
            return encodeAuthenticationInstructions(instructions);
          },
        },
      };
      const transaction = builder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
      const vm = createVirtualMachineBch2026ForProvider(builder.provider);
      const accepts = (inputIndex: number): boolean => vm.stateSuccess(
        vm.evaluate({ inputIndex, sourceOutputs, transaction }),
      ) === true;
      expect(accepts(directIndex)).toBe(true);
      expect(accepts(verifierIndex)).toBe(false);
    }
    await expect(coordinator.forward('run', [7n]).send()).resolves.toBeDefined();
    expect((await alternatePayer.getState()).visits).toBe(10n);
    expect((await payer.getState()).visits).toBe(1n);
  }, 180_000);
});
