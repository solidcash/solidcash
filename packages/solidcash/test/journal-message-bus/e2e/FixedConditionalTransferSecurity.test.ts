/* eslint-disable max-len -- adversarial transcript rewrites are clearest beside their complete fixture */
import {
  binToHex, decodeAuthenticationInstructions, encodeAuthenticationInstructions, hexToBin,
} from '@bitauth/libauth';
import { compileStringMulti } from 'solidc';
import { sha256 } from '@solidcash/utils';
import type { Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract, messageBus } from '../../../src/index.js';
import {
  decodeAtomicMessageEnvelope, encodeAtomicMessageEnvelope,
} from '../../../src/message-bus/atomic.js';
import type { AtomicRow } from '../../../src/message-bus/atomic.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { getSatoshiContainerAddress } from '../../../src/stateful/covenant-helpers.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { assertAuthenticatingVmEvidence } from '../vm-evidence.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const uint16 = (value: number): Uint8Array => Uint8Array.of(value & 0xff, (value >>> 8) & 0xff);

const concatBytes = (...parts: readonly Uint8Array[]): Uint8Array => {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let cursor = 0;
  for (const part of parts) { result.set(part, cursor); cursor += part.length; }
  return result;
};

const vmRejects = (candidate: TransactionBuilder): boolean => {
  assertAuthenticatingVmEvidence(candidate);
  const transaction = candidate.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(candidate.inputs);
  const vm = createVirtualMachineBch2026ForProvider(candidate.provider);
  return transaction.inputs.some((_input, inputIndex) => vm.stateSuccess(
    vm.evaluate({ inputIndex, sourceOutputs, transaction }),
  ) !== true);
};

const verifierIndices = (builder: TransactionBuilder): number[] => builder.inputs
  .map((input, index) => ({ input, index }))
  .filter(({ input }) => input.token?.nft?.commitment.startsWith('4c335631'))
  .map(({ index }) => index);

const envelopeOf = (builder: TransactionBuilder): ReturnType<typeof decodeAtomicMessageEnvelope> => {
  const verifier = verifierIndices(builder)[0];
  if (verifier === undefined) throw new Error('fixed-transfer test found no verifier input');
  const instruction = decodeAuthenticationInstructions(
    builder.buildLibauthTransaction().inputs[verifier].unlockingBytecode,
  )[0];
  if (!instruction || !('data' in instruction)) throw new Error('fixed-transfer verifier has no envelope');
  return decodeAtomicMessageEnvelope(instruction.data);
};

/** Rebind every verifier commitment after replacing the authenticated manifest. */
const rewriteAuthenticatedEnvelope = (
  builder: TransactionBuilder,
  rewrite: (manifest: ReturnType<typeof decodeAtomicMessageEnvelope>) => ReturnType<typeof decodeAtomicMessageEnvelope>,
): void => {
  const indices = verifierIndices(builder);
  if (indices.length < 2) throw new Error('fixed-transfer mutation needs every participant verifier');
  const unlockers = indices.map((index) => builder.inputs[index].unlocker!);
  const instruction = decodeAuthenticationInstructions(
    builder.buildLibauthTransaction().inputs[indices[0]].unlockingBytecode,
  )[0];
  if (!instruction || !('data' in instruction)) throw new Error('fixed-transfer verifier has no envelope push');
  const changedEnvelope = encodeAtomicMessageEnvelope(rewrite(decodeAtomicMessageEnvelope(instruction.data)));
  const changedManifest = changedEnvelope.slice(8);

  for (const [participant, verifierIndex] of indices.entries()) {
    const unlocker = unlockers[participant];
    builder.inputs[verifierIndex] = {
      ...builder.inputs[verifierIndex],
      unlocker: {
        generateLockingBytecode: () => unlocker.generateLockingBytecode(),
        generateUnlockingBytecode: (options) => {
          const changed = decodeAuthenticationInstructions(unlocker.generateUnlockingBytecode(options));
          if (!changed[0] || !('data' in changed[0])) throw new Error('participant verifier has no envelope push');
          changed[0] = { ...changed[0], data: changedEnvelope };
          return encodeAuthenticationInstructions(changed);
        },
      },
    };

    const activeBase = unlocker.params[1];
    const expectedRows = unlocker.params[2];
    const batch = unlocker.params[3];
    const graphValues = unlocker.params.slice(4);
    if (typeof activeBase !== 'bigint' || typeof expectedRows !== 'bigint' || !(batch instanceof Uint8Array)) {
      throw new Error('participant verifier has no canonical graph arguments');
    }
    const parts = [sha256(changedManifest), uint16(Number(activeBase)), uint16(Number(expectedRows)), sha256(batch)];
    for (const value of graphValues.slice(0, 7)) {
      if (typeof value === 'bigint') parts.push(uint16(Number(value)));
      else if (value instanceof Uint8Array) parts.push(sha256(value));
      else throw new Error('participant verifier has an invalid graph argument');
    }
    builder.outputs[verifierIndex].token!.nft!.commitment
      = `${builder.inputs[verifierIndex].token!.nft!.commitment.slice(0, 12)}`
      + binToHex(sha256(concatBytes(...parts)));
  }
};

const participantBase = (
  manifest: ReturnType<typeof decodeAtomicMessageEnvelope>, participant: number,
): number => manifest.participants.slice(0, participant).reduce((base, current) => base + current.actualSize, 0);

const valueRows = (builder: TransactionBuilder, parent = 1): AtomicRow[] =>
  envelopeOf(builder).rows.filter((row) => row.kind === 3 && row.parent === parent);

describe('fixed conditional BCH transfer transcript security', () => {
  it('binds true/false and if/else paths, neutral padding, exact recipes, row cardinality, and container debit', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(`interface IVault {
        function conditional(bool enabled, address recipient, uint amount);
        function choose(bool first, address recipientA, address recipientB, uint amountA, uint amountB);
        function dynamicSentinel(address recipient);
        function literalSentinel();
      }
      contract Vault() {
        function conditional(bool enabled, address recipient, uint amount) public {
          if (enabled && amount > 1000) { this.transfer(recipient, amount); }
          if (enabled && amount > 1000) { require(msg.value == -int(amount)); }
          else { require(msg.value == 0); }
        }
        function choose(bool first, address recipientA, address recipientB, uint amountA, uint amountB) public {
          if (first) { this.transfer(recipientA, amountA); }
          else { this.transfer(recipientB, amountB); }
          require(true);
        }
        function dynamicSentinel(address recipient) public {
          this.transfer(recipient, 1000);
          require(true);
        }
        function literalSentinel() public {
          this.transfer(hex"51", 1000);
          require(true);
        }
      }
      contract Driver(address vault) {
        function runConditional(bool enabled, address recipient, uint amount) public {
          IVault(vault).conditional(enabled, recipient, amount);
          require(true);
        }
        function runChoose(bool first, address recipientA, address recipientB, uint amountA, uint amountB) public {
          IVault(vault).choose(first, recipientA, recipientB, amountA, amountB);
          require(true);
        }
        function runDynamicSentinel(address recipient) public {
          IVault(vault).dynamicSentinel(recipient);
          require(true);
        }
        function runLiteralSentinel() public {
          IVault(vault).literalSentinel();
          require(true);
        }
      }`, { forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000 });
    const connect = async (artifact: Artifact, args: readonly unknown[] = []): Promise<StatefulContract> => {
      const base = new Contract(artifact, args as never[], { provider });
      const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    };
    const vault = await connect(artifacts.Vault);
    const driver = await connect(artifacts.Driver, [hexToBin(vault.inner.lockingBytecode)]);
    expect(artifacts.Vault.messageBus?.handlers.find((handler) => handler.name === 'conditional')).toMatchObject({
      eligible: true,
      transfers: [{ transferIndex: 0, recipient: { kind: 'forward', paramIndex: 1 }, amount: { kind: 'forward', paramIndex: 2 } }],
    });
    expect(artifacts.Vault.messageBus?.handlers.find((handler) => handler.name === 'choose')).toMatchObject({
      eligible: true,
      transfers: [
        { transferIndex: 0, recipient: { kind: 'forward', paramIndex: 1 }, amount: { kind: 'forward', paramIndex: 3 } },
        { transferIndex: 0, recipient: { kind: 'forward', paramIndex: 2 }, amount: { kind: 'forward', paramIndex: 4 } },
      ],
    });

    const containerAmount = 20_000n;
    await provider.addUtxo(getSatoshiContainerAddress(vault.inner, vault.categoryId), {
      txid: 'e0'.repeat(32), vout: 1, satoshis: containerAmount,
    });
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const recipientA = fee.unlocker.generateLockingBytecode();
    const recipientB = Uint8Array.of(0x52);
    const conditional = (enabled: boolean): Promise<TransactionBuilder> => messageBus.compose({
      preparedCalls: [
        { contract: driver, functionName: 'runConditional', args: [enabled, recipientA, 2_000n] },
        { contract: vault, functionName: 'conditional', args: [enabled, recipientA, 2_000n] },
      ],
      funder: fee,
      changeAddress: recipientA,
    }).build();
    const choose = (first: boolean): Promise<TransactionBuilder> => messageBus.compose({
      preparedCalls: [
        { contract: driver, functionName: 'runChoose', args: [first, recipientA, recipientB, 3_000n, 5_000n] },
        { contract: vault, functionName: 'choose', args: [first, recipientA, recipientB, 3_000n, 5_000n] },
      ],
      funder: fee,
      changeAddress: recipientA,
    }).build();

    const active = await conditional(true);
    const inactive = await conditional(false);
    const first = await choose(true);
    const second = await choose(false);
    expect([active, inactive, first, second].map(vmRejects)).toEqual([false, false, false, false]);
    expect(valueRows(active)).toHaveLength(1);
    expect(valueRows(inactive)).toHaveLength(0);
    expect(valueRows(first)).toHaveLength(1);
    expect(valueRows(second)).toHaveLength(1);

    const activeRow = valueRows(active)[0];
    const activeBase = participantBase(envelopeOf(active), activeRow.owner);
    const transferOutput = activeBase + activeRow.targetOffset;
    const transferInput = activeBase + activeRow.sourceOffset;
    expect(active.outputs[transferOutput]).toMatchObject({ amount: 2_000n, to: recipientA });
    expect(active.outputs.find((output) => !output.token && output.amount === 18_000n)).toBeDefined();

    const inactiveBase = participantBase(envelopeOf(inactive), activeRow.owner);
    const inactiveOutput = inactiveBase + activeRow.targetOffset;
    const inactiveInput = inactiveBase + activeRow.sourceOffset;
    expect(inactive.inputs[inactiveInput].token).toBeUndefined();
    expect(inactive.outputs[inactiveOutput]).toMatchObject({ amount: 1_000n, to: Uint8Array.of(0x51) });
    expect(inactive.outputs[inactiveOutput].token).toBeUndefined();
    expect(inactive.outputs.find((output) => !output.token && output.amount === containerAmount)).toBeDefined();
    expect(transferInput).toBe(inactiveInput);

    const firstRow = valueRows(first)[0];
    const secondRow = valueRows(second)[0];
    const firstOutput = participantBase(envelopeOf(first), firstRow.owner) + firstRow.targetOffset;
    const secondOutput = participantBase(envelopeOf(second), secondRow.owner) + secondRow.targetOffset;
    expect(first.outputs[firstOutput]).toMatchObject({ to: recipientA, amount: 3_000n });
    expect(second.outputs[secondOutput]).toMatchObject({ to: recipientB, amount: 5_000n });

    const hiddenInactiveInput = await conditional(false);
    hiddenInactiveInput.inputs[inactiveInput] = { ...fee.utxo, unlocker: fee.unlocker };
    expect(vmRejects(hiddenInactiveInput)).toBe(true);
    const wrongPaddingLock = await conditional(false);
    wrongPaddingLock.outputs[inactiveOutput].to = Uint8Array.of(0x52);
    expect(vmRejects(wrongPaddingLock)).toBe(true);
    const wrongPaddingAmount = await conditional(false);
    wrongPaddingAmount.outputs[inactiveOutput].amount += 1n;
    expect(vmRejects(wrongPaddingAmount)).toBe(true);
    const tokenPadding = await conditional(false);
    tokenPadding.outputs[inactiveOutput].token = { category: vault.categoryId, amount: 1n };
    expect(vmRejects(tokenPadding)).toBe(true);
    const inactiveContainer = inactive.outputs.findIndex((output) => !output.token && output.amount === containerAmount);
    const falseDebit = await conditional(false);
    falseDebit.outputs[inactiveContainer].amount -= 1n;
    expect(vmRejects(falseDebit)).toBe(true);

    // Replace the selected true-arm recipe, its physical transfer, and the corresponding container debit, then
    // rebind every manifest digest. The handler covenant must still reject this internally consistent false arm.
    const wrongBranch = await choose(true);
    wrongBranch.outputs[firstOutput].to = recipientB;
    wrongBranch.outputs[firstOutput].amount = 5_000n;
    const firstContainer = wrongBranch.outputs.findIndex((output) => !output.token && output.amount === 17_000n);
    wrongBranch.outputs[firstContainer].amount = 15_000n;
    rewriteAuthenticatedEnvelope(wrongBranch, (manifest) => ({
      ...manifest,
      rows: manifest.rows.map((row) => row.kind === 3 && row.parent === 1
        ? { ...row, subjectHex: binToHex(recipientB), effectHex: '8813000000000000' } : row),
    }));
    expect(vmRejects(wrongBranch)).toBe(true);

    const missing = await conditional(true);
    rewriteAuthenticatedEnvelope(missing, (manifest) => ({
      ...manifest, rows: manifest.rows.filter((row) => !(row.kind === 3 && row.parent === 1)),
    }));
    expect(vmRejects(missing)).toBe(true);
    const duplicate = await conditional(true);
    rewriteAuthenticatedEnvelope(duplicate, (manifest) => {
      const index = manifest.rows.findIndex((row) => row.kind === 3 && row.parent === 1);
      if (index < 0) throw new Error('fixed-transfer fixture has no value row');
      return { ...manifest, rows: [...manifest.rows.slice(0, index + 1), manifest.rows[index], ...manifest.rows.slice(index + 1)] };
    });
    expect(vmRejects(duplicate)).toBe(true);

    await expect(messageBus.compose({
      preparedCalls: [
        { contract: driver, functionName: 'runDynamicSentinel', args: [Uint8Array.of(0x51)] },
        { contract: vault, functionName: 'dynamicSentinel', args: [Uint8Array.of(0x51)] },
      ], funder: fee, changeAddress: recipientA,
    }).build()).rejects.toThrow(/transfer slot .* invalid|active transfer recipient.*OP_TRUE|preflight failed.*OP_VERIFY/i);
    await expect(messageBus.compose({
      preparedCalls: [
        { contract: driver, functionName: 'runLiteralSentinel', args: [] },
        { contract: vault, functionName: 'literalSentinel', args: [] },
      ], funder: fee, changeAddress: recipientA,
    }).build()).rejects.toThrow(/transfer slot .* invalid|active transfer recipient.*OP_TRUE|not a forwarded\/literal canonical effect/i);
  }, 240_000);

  it.each([
    ['address.transfer', 'transferStyle'],
    ['address.send', 'sendStyle'],
  ] as const)('fences %s from the kernel until its recipient representation is runtime-safe', (_style, vaultFunction) => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.0;
      contract Vault {
        function transferStyle(address payable recipient, uint amount) public {
          recipient.transfer(amount);
          require(true);
        }
        function sendStyle(address payable recipient, uint amount) public {
          require(recipient.send(amount));
        }
      }`, {
      forceStateful: true, messageBus: true, messageBusKernel: true,
      solidityImportCompat: true, maximumInputBytes: 1_000_000,
    });
    const handler = artifacts.Vault.messageBus?.handlers.find((candidate) => candidate.name === vaultFunction);
    expect(handler).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_LAYOUT',
    });
    expect(artifacts.Vault.abi.find((candidate) => candidate.name === vaultFunction)?.transfers).toEqual([{
      transferIndex: 0,
      recipient: { kind: 'forward', paramIndex: 0 },
      amount: { kind: 'forward', paramIndex: 1 },
    }]);
  });
});
