/* eslint-disable max-len -- adversarial transcript rewrites are clearest beside their complete fixture */
import {
  binToHex, decodeAuthenticationInstructions, encodeAuthenticationInstructions, hexToBin,
} from '@bitauth/libauth';
import { compileStringMulti } from '@solidcash/solidc';
import { sha256 } from '@solidcash/utils';
import type { Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
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
        function aliased(bool enabled, address first, address second, uint amount);
        function joined(bool take, bool change, address recipient, uint amount);
        function selectTransfer(bool alternate, address first, address second, uint amount);
        function switchTransfer(int choice, address first, address second, uint amount);
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
        function aliased(bool enabled, address first, address second, uint amount) public {
          bool selected = enabled;
          selected = !selected;
          address recipient = first;
          recipient = second;
          uint adjusted = amount;
          adjusted = adjusted + 1;
          if (selected) { this.transfer(recipient, adjusted); }
          require(true);
        }
        function joined(bool take, bool change, address recipient, uint amount) public {
          bool selected = take;
          if (change) { selected = !selected; }
          if (selected) { this.transfer(recipient, amount); }
          require(true);
        }
        function selectTransfer(bool alternate, address first, address second, uint amount) public {
          address recipient = first;
          uint value = amount;
          if (alternate) { recipient = second; value = amount + 1000; }
          this.transfer(recipient, value);
          require(true);
        }
        function switchTransfer(int choice, address first, address second, uint amount) public {
          address recipient = first;
          uint value = amount;
          switch (choice) {
            case 1: recipient = second; value = amount + 1000; break;
            case 2: value = amount + 2000; break;
            default: break;
          }
          this.transfer(recipient, value);
          require(true);
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
        function runAliased(bool enabled, address first, address second, uint amount) public {
          IVault(vault).aliased(enabled, first, second, amount);
          require(true);
        }
        function runJoined(bool take, bool change, address recipient, uint amount) public {
          IVault(vault).joined(take, change, recipient, amount);
          require(true);
        }
        function runSelected(bool alternate, address first, address second, uint amount) public {
          IVault(vault).selectTransfer(alternate, first, second, amount);
          require(true);
        }
        function runSwitchTransfer(int choice, address first, address second, uint amount) public {
          IVault(vault).switchTransfer(choice, first, second, amount);
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
    expect(artifacts.Vault.messageBus?.handlers.find((handler) => handler.name === 'aliased')).toMatchObject({
      eligible: true,
      transfers: [{
        recipientRecipe: { kind: 'handlerInput', inputIndex: 2 },
        // The amount is `adjusted + 1`, and the recipe now resolves both operands instead of a cast wrapper:
        // handler input 3 (the `amount` parameter) plus the literal 1.
        amountRecipe: {
          kind: 'binary',
          operator: '+',
          left: { kind: 'handlerInput', inputIndex: 3, resultType: 'uint256' },
          right: { kind: 'intLiteral', value: '1', resultType: 'int' },
        },
        condition: { kind: 'unary', operator: '!' },
      }],
    });
    expect(artifacts.Vault.messageBus?.handlers.find((handler) => handler.name === 'joined')).toMatchObject({
      eligible: true,
      transfers: [{ condition: { kind: 'ternary' } }],
    });
    expect(artifacts.Vault.messageBus?.handlers.find((handler) => handler.name === 'selectTransfer')).toMatchObject({
      eligible: true,
      transfers: [{
        recipientRecipe: { kind: 'conditional', resultType: 'address' },
        amountRecipe: { kind: 'conditional', resultType: 'uint256' },
      }],
    });
    expect(artifacts.Vault.messageBus?.handlers.find((handler) => handler.name === 'switchTransfer')).toMatchObject({
      eligible: true,
      transfers: [{
        recipientRecipe: { kind: 'conditional' },
        amountRecipe: { kind: 'conditional', ifFalse: { kind: 'conditional' } },
      }],
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
    const aliased = (enabled: boolean): Promise<TransactionBuilder> => messageBus.compose({
      preparedCalls: [
        { contract: driver, functionName: 'runAliased', args: [enabled, recipientA, recipientB, 2_000n] },
        { contract: vault, functionName: 'aliased', args: [enabled, recipientA, recipientB, 2_000n] },
      ],
      funder: fee,
      changeAddress: recipientA,
    }).build();
    const joined = (take: boolean, change: boolean): Promise<TransactionBuilder> => messageBus.compose({
      preparedCalls: [
        { contract: driver, functionName: 'runJoined', args: [take, change, recipientA, 2_000n] },
        { contract: vault, functionName: 'joined', args: [take, change, recipientA, 2_000n] },
      ],
      funder: fee,
      changeAddress: recipientA,
    }).build();
    const selected = (alternate: boolean): Promise<TransactionBuilder> => messageBus.compose({
      preparedCalls: [
        { contract: driver, functionName: 'runSelected', args: [alternate, recipientA, recipientB, 2_000n] },
        { contract: vault, functionName: 'selectTransfer', args: [alternate, recipientA, recipientB, 2_000n] },
      ],
      funder: fee,
      changeAddress: recipientA,
    }).build();
    const switched = (choice: bigint): Promise<TransactionBuilder> => messageBus.compose({
      preparedCalls: [
        { contract: driver, functionName: 'runSwitchTransfer', args: [choice, recipientA, recipientB, 2_000n] },
        { contract: vault, functionName: 'switchTransfer', args: [choice, recipientA, recipientB, 2_000n] },
      ],
      funder: fee,
      changeAddress: recipientA,
    }).build();

    const active = await conditional(true);
    const inactive = await conditional(false);
    const first = await choose(true);
    const second = await choose(false);
    const aliasedActive = await aliased(false);
    const aliasedInactive = await aliased(true);
    const joinedActive = await joined(false, true);
    const joinedInactive = await joined(true, true);
    const selectedFirst = await selected(false);
    const selectedSecond = await selected(true);
    const switchedDefault = await switched(0n);
    const switchedSecond = await switched(1n);
    const switchedThird = await switched(2n);
    expect([active, inactive, first, second, aliasedActive, aliasedInactive, joinedActive, joinedInactive]
      .concat([selectedFirst, selectedSecond, switchedDefault, switchedSecond, switchedThird]).map(vmRejects))
      .toEqual([false, false, false, false, false, false, false, false, false, false, false, false, false]);
    expect(valueRows(active)).toHaveLength(1);
    expect(valueRows(inactive)).toHaveLength(0);
    expect(valueRows(first)).toHaveLength(1);
    expect(valueRows(second)).toHaveLength(1);
    expect(valueRows(aliasedActive)).toHaveLength(1);
    expect(valueRows(aliasedInactive)).toHaveLength(0);
    expect(valueRows(joinedActive)).toHaveLength(1);
    expect(valueRows(joinedInactive)).toHaveLength(0);
    expect(valueRows(selectedFirst)).toHaveLength(1);
    expect(valueRows(selectedSecond)).toHaveLength(1);
    expect(valueRows(switchedDefault)).toHaveLength(1);
    expect(valueRows(switchedSecond)).toHaveLength(1);
    expect(valueRows(switchedThird)).toHaveLength(1);

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
    const aliasedRow = valueRows(aliasedActive)[0];
    const aliasedOutput = participantBase(envelopeOf(aliasedActive), aliasedRow.owner) + aliasedRow.targetOffset;
    expect(aliasedActive.outputs[aliasedOutput]).toMatchObject({ to: recipientB, amount: 2_001n });
    const selectedFirstRow = valueRows(selectedFirst)[0];
    const selectedSecondRow = valueRows(selectedSecond)[0];
    const selectedFirstOutput = participantBase(envelopeOf(selectedFirst), selectedFirstRow.owner)
      + selectedFirstRow.targetOffset;
    const selectedSecondOutput = participantBase(envelopeOf(selectedSecond), selectedSecondRow.owner)
      + selectedSecondRow.targetOffset;
    expect(selectedFirst.outputs[selectedFirstOutput]).toMatchObject({ to: recipientA, amount: 2_000n });
    expect(selectedSecond.outputs[selectedSecondOutput]).toMatchObject({ to: recipientB, amount: 3_000n });
    selectedFirst.outputs[selectedFirstOutput].amount += 1n;
    expect(vmRejects(selectedFirst)).toBe(true);
    selectedSecond.outputs[selectedSecondOutput].to = recipientA;
    expect(vmRejects(selectedSecond)).toBe(true);
    const switchedDefaultRow = valueRows(switchedDefault)[0];
    const switchedSecondRow = valueRows(switchedSecond)[0];
    const switchedDefaultOutput = participantBase(envelopeOf(switchedDefault), switchedDefaultRow.owner)
      + switchedDefaultRow.targetOffset;
    const switchedSecondOutput = participantBase(envelopeOf(switchedSecond), switchedSecondRow.owner)
      + switchedSecondRow.targetOffset;
    const switchedThirdRow = valueRows(switchedThird)[0];
    const switchedThirdOutput = participantBase(envelopeOf(switchedThird), switchedThirdRow.owner)
      + switchedThirdRow.targetOffset;
    expect(switchedDefault.outputs[switchedDefaultOutput]).toMatchObject({ to: recipientA, amount: 2_000n });
    expect(switchedSecond.outputs[switchedSecondOutput]).toMatchObject({ to: recipientB, amount: 3_000n });
    expect(switchedThird.outputs[switchedThirdOutput]).toMatchObject({ to: recipientA, amount: 4_000n });

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
    }).build()).rejects.toThrow(
      /transfer slot .* invalid|active transfer recipient.*OP_TRUE|not a canonical typed effect|preflight failed.*OP_VERIFY/i,
    );
  }, 240_000);

  it('authenticates bytes.concat recipients selected by branch and switch joins', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(`interface IVault {
        function branch(bool alternate, bytes fallbackRecipient, bytes first, bytes second, uint amount);
        function select(int choice, bytes fallbackRecipient, bytes first, bytes second, uint amount);
      }
      contract Vault() {
        function branch(bool alternate, bytes fallbackRecipient, bytes first, bytes second, uint amount) public {
          bytes recipient = fallbackRecipient;
          if (alternate) recipient = bytes.concat(first, second);
          this.transfer(recipient, amount);
          require(true);
        }
        function select(int choice, bytes fallbackRecipient, bytes first, bytes second, uint amount) public {
          bytes recipient = fallbackRecipient;
          switch (choice) { case 1: recipient = bytes.concat(first, second); break; default: break; }
          this.transfer(recipient, amount);
          require(true);
        }
      }
      contract Driver(address vault) {
        function runBranch(bool alternate, bytes fallbackRecipient, bytes first, bytes second, uint amount) public {
          IVault(vault).branch(alternate, fallbackRecipient, first, second, amount); require(true);
        }
        function runSwitch(int choice, bytes fallbackRecipient, bytes first, bytes second, uint amount) public {
          IVault(vault).select(choice, fallbackRecipient, first, second, amount); require(true);
        }
      }`, { forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000 });
    const connect = async (artifact: Artifact, args: readonly unknown[] = []): Promise<StatefulContract> => {
      const base = new Contract(artifact, args as never[], { provider });
      const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    };
    const vault = await connect(artifacts.Vault);
    const driver = await connect(artifacts.Driver, [hexToBin(vault.inner.lockingBytecode)]);
    for (const name of ['branch', 'select']) {
      expect(artifacts.Vault.messageBus?.handlers.find((handler) => handler.name === name)).toMatchObject({
        eligible: true,
        transfers: [{ recipientRecipe: { kind: 'conditional', ifTrue: { kind: 'concat' } } }],
      });
    }
    await provider.addUtxo(getSatoshiContainerAddress(vault.inner, vault.categoryId), {
      txid: 'a5'.repeat(32), vout: 1, satoshis: 20_000n,
    });
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const joinedRecipient = fee.unlocker.generateLockingBytecode();
    const fallbackRecipient = new Uint8Array(joinedRecipient);
    fallbackRecipient[3] ^= 1;
    expect(binToHex(joinedRecipient)).not.toBe(binToHex(fallbackRecipient));
    const first = joinedRecipient.slice(0, 11);
    const second = joinedRecipient.slice(11);
    const build = (kind: 'branch' | 'switch', selected: boolean): Promise<TransactionBuilder> => {
      const driverName = kind === 'branch' ? 'runBranch' : 'runSwitch';
      const vaultName = kind === 'branch' ? 'branch' : 'select';
      const selector = kind === 'branch' ? selected : (selected ? 1n : 0n);
      const args = [selector, fallbackRecipient, first, second, 3_000n];
      return messageBus.compose({
        preparedCalls: [
          { contract: driver, functionName: driverName, args },
          { contract: vault, functionName: vaultName, args },
        ],
        funder: fee,
        changeAddress: fallbackRecipient,
      }).build();
    };
    for (const kind of ['branch', 'switch'] as const) {
      for (const selected of [false, true]) {
        const transaction = await build(kind, selected);
        expect(vmRejects(transaction)).toBe(false);
        const row = valueRows(transaction)[0];
        const outputIndex = participantBase(envelopeOf(transaction), row.owner) + row.targetOffset;
        expect(transaction.outputs[outputIndex]).toMatchObject({
          amount: 3_000n,
          to: selected ? joinedRecipient : fallbackRecipient,
        });
        const hostile = await build(kind, selected);
        const hostileRow = valueRows(hostile)[0];
        const hostileOutput = participantBase(envelopeOf(hostile), hostileRow.owner) + hostileRow.targetOffset;
        hostile.outputs[hostileOutput].to = selected ? fallbackRecipient : joinedRecipient;
        expect(vmRejects(hostile), `${kind}/${selected}`).toBe(true);
      }
    }
  }, 180_000);

  it.each([
    ['address.transfer', 'transferStyle'],
    ['address.send', 'sendStyle'],
  ] as const)('executes %s from its typed fixed-effect descriptor', async (_style, vaultFunction) => {
    const provider = createMessageBusCapstoneTestProvider();
    // D27: the dispatch scheme follows the compile's mode, and a native caller cannot typed-call an evmCompat
    // callee. This fixture's subject is the vault's typed fixed-effect transfer descriptor, which a native vault
    // publishes identically; compiling the vault native keeps the caller and callee on one scheme.
    const artifacts = compileStringMulti(`pragma solidcash ^0.14.0;
      contract Vault {
        function transferStyle(address payable recipient, uint amount) public {
          recipient.transfer(amount);
          require(true);
        }
        function sendStyle(address payable recipient, uint amount) public {
          require(recipient.send(amount));
        }
      }`, {
      forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000,
    });
    const driverArtifacts = compileStringMulti(`pragma solidcash ^0.14.0;
      interface IVault {
        function transferStyle(address recipient, uint amount);
        function sendStyle(address recipient, uint amount);
      }
      contract Driver(address vault) {
        function runTransfer(address recipient, uint amount) public {
          IVault(vault).transferStyle(recipient, amount);
          require(true);
        }
        function runSend(address recipient, uint amount) public {
          IVault(vault).sendStyle(recipient, amount);
          require(true);
        }
      }`, {
      forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000,
    });
    const handler = artifacts.Vault.messageBus?.handlers.find((candidate) => candidate.name === vaultFunction);
    expect(handler).toMatchObject({
      eligible: true,
      transfers: [{
        transferIndex: 0,
        recipientRecipe: { kind: 'handlerInput', inputIndex: 0 },
        amountRecipe: { kind: 'handlerInput', inputIndex: 1 },
      }],
    });
    const connect = async (artifact: Artifact, args: readonly unknown[] = []): Promise<StatefulContract> => {
      const base = new Contract(artifact, args as never[], { provider });
      const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    };
    const vault = await connect(artifacts.Vault);
    const driver = await connect(driverArtifacts.Driver, [hexToBin(vault.inner.lockingBytecode)]);
    await provider.addUtxo(getSatoshiContainerAddress(vault.inner, vault.categoryId), {
      txid: (vaultFunction === 'transferStyle' ? 'e1' : 'e2').repeat(32), vout: 1, satoshis: 20_000n,
    });
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const recipient = fee.unlocker.generateLockingBytecode();
    const builder = await messageBus.compose({
      preparedCalls: [
        {
          contract: driver,
          functionName: vaultFunction === 'transferStyle' ? 'runTransfer' : 'runSend',
          args: [recipient, 2_000n],
        },
        { contract: vault, functionName: vaultFunction, args: [recipient, 2_000n] },
      ],
      funder: fee,
      changeAddress: recipient,
    }).build();
    expect(vmRejects(builder)).toBe(false);
    expect(builder.outputs.filter((output) => !output.token
      && output.amount === 2_000n && binToHex(output.to as Uint8Array) === binToHex(recipient))).toHaveLength(1);
  }, 240_000);

  it('replays dominating scalar-state assignments for transfer activation, recipient, and amount', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(`interface IPayer {
        function pay(bool enabled, bool alternate, address first, address second, uint base);
      }
      contract Payer() {
        bool enabled;
        address destination;
        uint quantity;
        function pay(bool take, bool alternate, address first, address second, uint base) public {
          this.enabled = take;
          if (alternate) { this.destination = second; this.quantity = base + 7; }
          else { this.destination = first; this.quantity = base; }
          if (this.enabled) this.transfer(this.destination, this.quantity);
          require(true);
        }
      }
      contract Driver(address payer) {
        function run(bool enabled, bool alternate, address first, address second, uint base) public {
          IPayer(payer).pay(enabled, alternate, first, second, base);
          require(true);
        }
      }`, { forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000 });
    const connect = async (artifact: Artifact, args: readonly unknown[] = []): Promise<StatefulContract> => {
      const base = new Contract(artifact, args as never[], { provider });
      const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    };
    const payer = await connect(artifacts.Payer);
    const driver = await connect(artifacts.Driver, [hexToBin(payer.inner.lockingBytecode)]);
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const first = fee.unlocker.generateLockingBytecode();
    const second = Uint8Array.from([...first.slice(0, -1), first.at(-1)! ^ 1]);
    const build = async (enabled: boolean, alternate: boolean): Promise<TransactionBuilder> => {
      await provider.addUtxo(getSatoshiContainerAddress(payer.inner, payer.categoryId), {
        txid: `${enabled ? 'd1' : 'd2'}`.repeat(32), vout: 1, satoshis: 20_000n,
      });
      return messageBus.compose({
        preparedCalls: [
          { contract: driver, functionName: 'run', args: [enabled, alternate, first, second, 2_000n] },
          { contract: payer, functionName: 'pay', args: [enabled, alternate, first, second, 2_000n] },
        ],
        funder: fee,
        changeAddress: first,
      }).build();
    };
    const active = await build(true, true);
    const inactive = await build(false, false);
    expect(vmRejects(active)).toBe(false);
    expect(vmRejects(inactive)).toBe(false);
    expect(active.outputs.filter((output) => !output.token && output.amount === 2_007n
      && binToHex(output.to as Uint8Array) === binToHex(second))).toHaveLength(1);
    expect(inactive.outputs.some((output) => !output.token && output.amount === 2_000n
      && binToHex(output.to as Uint8Array) === binToHex(first))).toBe(false);
    const transferOutput = active.outputs.find((output) => !output.token && output.amount === 2_007n
      && binToHex(output.to as Uint8Array) === binToHex(second));
    expect(transferOutput).toBeDefined();
    transferOutput!.to = first;
    expect(vmRejects(active)).toBe(true);
  }, 240_000);

  it('materializes direct pre-state transfer recipes from authenticated participant state', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(`interface IPayer { function pay(); }
      contract Payer() {
        bool enabled;
        address destination;
        uint quantity;
        function pay() public {
          if (this.enabled) this.transfer(this.destination, this.quantity);
          require(true);
        }
      }
      contract Driver(address payer) {
        function run() public { IPayer(payer).pay(); require(true); }
      }`, { forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000 });
    expect(artifacts.Payer.messageBus?.handlers.find((handler) => handler.name === 'pay')).toMatchObject({
      eligible: true,
      transfers: [{
        recipientRecipe: { kind: 'state', name: 'destination', resultType: 'address' },
        amountRecipe: { kind: 'state', name: 'quantity', resultType: 'uint256' },
        condition: { kind: 'state', name: 'enabled' },
      }],
    });
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const recipient = fee.unlocker.generateLockingBytecode();
    const payerBase = new Contract(artifacts.Payer, [], { provider });
    const payerSetup = await setupStatefulUtxos(provider, payerBase, artifacts.Payer.stateLayout!, {
      enabled: true, destination: recipient, quantity: 2_000n,
    }, { saltContract: true });
    const payer = StatefulContract.withCategory(
      payerBase.withCategory(hexToBin(payerSetup.categoryId)), payerSetup.categoryId,
    );
    const driverBase = new Contract(artifacts.Driver, [hexToBin(payer.inner.lockingBytecode)], { provider });
    const driverSetup = await setupStatefulUtxos(
      provider, driverBase, artifacts.Driver.stateLayout!, {}, { saltContract: true },
    );
    const driver = StatefulContract.withCategory(
      driverBase.withCategory(hexToBin(driverSetup.categoryId)), driverSetup.categoryId,
    );
    await provider.addUtxo(getSatoshiContainerAddress(payer.inner, payer.categoryId), {
      txid: 'e3'.repeat(32), vout: 1, satoshis: 20_000n,
    });
    const builder = await messageBus.compose({
      preparedCalls: [
        { contract: driver, functionName: 'run', args: [] },
        { contract: payer, functionName: 'pay', args: [] },
      ],
      funder: fee,
      changeAddress: recipient,
    }).build();
    expect(vmRejects(builder)).toBe(false);
    const transfer = builder.outputs.find((output) => !output.token && output.amount === 2_000n
      && binToHex(output.to as Uint8Array) === binToHex(recipient));
    expect(transfer).toBeDefined();
    transfer!.amount += 1n;
    expect(vmRejects(builder)).toBe(true);

    const disabledBase = new Contract(artifacts.Payer, [], { provider });
    const disabledSetup = await setupStatefulUtxos(provider, disabledBase, artifacts.Payer.stateLayout!, {
      enabled: false, destination: recipient, quantity: 2_000n,
    }, { saltContract: true });
    const disabled = StatefulContract.withCategory(
      disabledBase.withCategory(hexToBin(disabledSetup.categoryId)), disabledSetup.categoryId,
    );
    const disabledDriverBase = new Contract(
      artifacts.Driver, [hexToBin(disabled.inner.lockingBytecode)], { provider },
    );
    const disabledDriverSetup = await setupStatefulUtxos(
      provider, disabledDriverBase, artifacts.Driver.stateLayout!, {}, { saltContract: true },
    );
    const disabledDriver = StatefulContract.withCategory(
      disabledDriverBase.withCategory(hexToBin(disabledDriverSetup.categoryId)), disabledDriverSetup.categoryId,
    );
    await provider.addUtxo(getSatoshiContainerAddress(disabled.inner, disabled.categoryId), {
      txid: 'e4'.repeat(32), vout: 1, satoshis: 20_000n,
    });
    const inactive = await messageBus.compose({
      preparedCalls: [
        { contract: disabledDriver, functionName: 'run', args: [] },
        { contract: disabled, functionName: 'pay', args: [] },
      ],
      funder: fee,
      changeAddress: recipient,
    }).build();
    expect(vmRejects(inactive)).toBe(false);
    expect(valueRows(inactive)).toHaveLength(0);
  }, 240_000);

  it('executes cast and hash recipes selected through an exact pure overload', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(`interface IPayer { function pay(bytes seed); }
      contract Payer() {
        int marker;
        function quote(bytes20 digest) internal pure returns (int) { return 2000; }
        function quote(bytes32 digest) internal pure returns (int) { return 3000; }
        function pay(bytes seed) public {
          this.transfer(sha256(seed), uint(quote(hash160(seed))));
          require(true);
        }
      }
      contract Driver(address payer) {
        function run(bytes seed) public { IPayer(payer).pay(seed); require(true); }
      }`, { forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000 });
    expect(artifacts.Payer.messageBus?.handlers.find((handler) => handler.name === 'pay')).toMatchObject({
      eligible: true,
      transfers: [{
        recipientRecipe: { kind: 'hash', algorithm: 'sha256' },
        amountRecipe: { kind: 'cast', resultType: 'uint256' },
      }],
    });
    const connect = async (artifact: Artifact, args: readonly unknown[] = []): Promise<StatefulContract> => {
      const base = new Contract(artifact, args as never[], { provider });
      const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    };
    const payer = await connect(artifacts.Payer);
    const driver = await connect(artifacts.Driver, [hexToBin(payer.inner.lockingBytecode)]);
    await provider.addUtxo(getSatoshiContainerAddress(payer.inner, payer.categoryId), {
      txid: 'e5'.repeat(32), vout: 1, satoshis: 20_000n,
    });
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const seed = Uint8Array.of(1, 2, 3);
    const expectedRecipient = sha256(seed);
    const builder = await messageBus.compose({
      preparedCalls: [
        { contract: driver, functionName: 'run', args: [seed] },
        { contract: payer, functionName: 'pay', args: [seed] },
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    }).build();
    expect(vmRejects(builder)).toBe(false);
    const transfer = builder.outputs.find((output) => !output.token && output.amount === 2_000n
      && binToHex(output.to as Uint8Array) === binToHex(expectedRecipient));
    expect(transfer).toBeDefined();
    transfer!.to = Uint8Array.from(expectedRecipient, (byte, index) => index === 0 ? byte ^ 1 : byte);
    expect(vmRejects(builder)).toBe(true);
  }, 240_000);

  it('authenticates a fixed transfer after a successful early-return path', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(`interface IPayer {
        function pay(bool stop, address recipient, uint amount);
        function guarded(bool enabled, bool alternate, address first, address second, uint amount);
      }
      contract Payer() {
        address fallbackRecipient;
        function pay(bool stop, address recipient, uint amount) public {
          address selected = recipient;
          if (stop) {
            selected = this.fallbackRecipient;
            require(true);
            return;
          }
          this.transfer(selected, amount);
          require(true);
        }
        function guarded(bool enabled, bool alternate, address first, address second, uint amount) public {
          address selected = first;
          if (alternate) selected = second;
          require(enabled);
          this.transfer(selected, amount);
          require(true);
        }
      }
      contract Driver(address payer) {
        function run(bool stop, address recipient, uint amount) public {
          IPayer(payer).pay(stop, recipient, amount);
          require(true);
        }
        function runGuarded(bool enabled, bool alternate, address first, address second, uint amount) public {
          IPayer(payer).guarded(enabled, alternate, first, second, amount);
          require(true);
        }
      }`, {
      forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000,
    });
    expect(artifacts.Payer.messageBus?.handlers.find((handler) => handler.name === 'pay')).toMatchObject({
      eligible: true,
      transfers: [{
        recipientRecipe: { kind: 'handlerInput', inputIndex: 1 },
        amountRecipe: { kind: 'handlerInput', inputIndex: 2 },
        condition: { kind: 'unary', operator: '!' },
      }],
    });
    expect(artifacts.Payer.messageBus?.handlers.find((handler) => handler.name === 'guarded')).toMatchObject({
      eligible: true,
      transfers: [{
        recipientRecipe: { kind: 'conditional', resultType: 'address' },
        amountRecipe: { kind: 'handlerInput', inputIndex: 4 },
        condition: { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
      }],
    });
    const connect = async (artifact: Artifact, args: readonly unknown[] = []): Promise<StatefulContract> => {
      const base = new Contract(artifact, args as never[], { provider });
      const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    };
    const payer = await connect(artifacts.Payer);
    const driver = await connect(artifacts.Driver, [hexToBin(payer.inner.lockingBytecode)]);
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const recipient = fee.unlocker.generateLockingBytecode();
    const build = async (stop: boolean, tag: string): Promise<TransactionBuilder> => {
      await provider.addUtxo(getSatoshiContainerAddress(payer.inner, payer.categoryId), {
        txid: tag.repeat(32), vout: 1, satoshis: 20_000n,
      });
      return messageBus.compose({
        preparedCalls: [
          { contract: driver, functionName: 'run', args: [stop, recipient, 2_000n] },
          { contract: payer, functionName: 'pay', args: [stop, recipient, 2_000n] },
        ],
        funder: fee,
        changeAddress: recipient,
      }).build();
    };
    const active = await build(false, 'd3');
    const stopped = await build(true, 'd4');
    expect(vmRejects(active)).toBe(false);
    expect(vmRejects(stopped)).toBe(false);
    expect(valueRows(active)).toHaveLength(1);
    expect(valueRows(stopped)).toHaveLength(0);
    const row = valueRows(active)[0];
    const activeOutput = participantBase(envelopeOf(active), row.owner) + row.targetOffset;
    const stoppedOutput = participantBase(envelopeOf(stopped), row.owner) + row.targetOffset;
    expect(active.outputs[activeOutput]).toMatchObject({ to: recipient, amount: 2_000n });
    expect(stopped.outputs[stoppedOutput]).toMatchObject({ to: Uint8Array.of(0x51), amount: 1_000n });

    active.outputs[activeOutput].amount += 1n;
    expect(vmRejects(active)).toBe(true);
    stopped.outputs[stoppedOutput].to = Uint8Array.of(0x52);
    expect(vmRejects(stopped)).toBe(true);

    const guarded = async (enabled: boolean, tag: string): Promise<TransactionBuilder> => {
      await provider.addUtxo(getSatoshiContainerAddress(payer.inner, payer.categoryId), {
        txid: tag.repeat(32), vout: 1, satoshis: 20_000n,
      });
      return messageBus.compose({
        preparedCalls: [
          {
            contract: driver, functionName: 'runGuarded',
            args: [enabled, true, recipient, Uint8Array.of(0x52), 3_000n],
          },
          {
            contract: payer, functionName: 'guarded',
            args: [enabled, true, recipient, Uint8Array.of(0x52), 3_000n],
          },
        ],
        funder: fee,
        changeAddress: recipient,
      }).build();
    };
    const guardPasses = await guarded(true, 'd5');
    expect(vmRejects(guardPasses)).toBe(false);
    await expect(guarded(false, 'd6')).rejects.toThrow(/preflight failed.*OP_VERIFY/i);
    const guardedRow = valueRows(guardPasses)[0];
    const guardedOutput = participantBase(envelopeOf(guardPasses), guardedRow.owner) + guardedRow.targetOffset;
    expect(guardPasses.outputs[guardedOutput]).toMatchObject({ to: Uint8Array.of(0x52), amount: 3_000n });
    guardPasses.outputs[guardedOutput].to = recipient;
    expect(vmRejects(guardPasses)).toBe(true);
  }, 240_000);
});
