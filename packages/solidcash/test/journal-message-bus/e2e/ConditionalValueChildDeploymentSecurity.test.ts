/* eslint-disable max-len -- the source fixture and transcript mutations are clearest inline */
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
  if (verifier === undefined) throw new Error('conditional-value-deploy test found no verifier input');
  const instructions = decodeAuthenticationInstructions(
    builder.buildLibauthTransaction().inputs[verifier].unlockingBytecode,
  );
  const envelope = instructions[0];
  if (!envelope || !('data' in envelope)) throw new Error('conditional-value-deploy verifier has no envelope');
  return decodeAtomicMessageEnvelope(envelope.data);
};

/** Rebind every verifier after rewriting an otherwise internally consistent hostile manifest. */
const rewriteAuthenticatedEnvelope = (
  builder: TransactionBuilder,
  rewrite: (manifest: ReturnType<typeof decodeAtomicMessageEnvelope>) => ReturnType<typeof decodeAtomicMessageEnvelope>,
): void => {
  const indices = verifierIndices(builder);
  if (indices.length < 2) throw new Error('conditional-value-deploy mutation needs every participant verifier');
  const unlockers = indices.map((index) => builder.inputs[index].unlocker!);
  const instructions = decodeAuthenticationInstructions(
    builder.buildLibauthTransaction().inputs[indices[0]].unlockingBytecode,
  );
  const envelope = instructions[0];
  if (!envelope || !('data' in envelope)) throw new Error('conditional-value-deploy verifier has no envelope push');
  const changedEnvelope = encodeAtomicMessageEnvelope(rewrite(decodeAtomicMessageEnvelope(envelope.data)));
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

    const params = unlocker.params;
    const activeBase = params[1];
    const expectedRows = params[2];
    const batch = params[3];
    if (typeof activeBase !== 'bigint' || typeof expectedRows !== 'bigint' || !(batch instanceof Uint8Array)) {
      throw new Error('participant verifier has no canonical graph arguments');
    }
    const parts = [sha256(changedManifest), uint16(Number(activeBase)), uint16(Number(expectedRows)), sha256(batch)];
    for (const value of params.slice(4, 11)) {
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

const rowsFor = (builder: TransactionBuilder, parent: number, kind: number): AtomicRow[] =>
  envelopeOf(builder).rows.filter((row) => row.kind === kind && row.parent === parent);

describe('conditional value-bearing child deployment transcript security', () => {
  it('binds the predicate, exact genesis, exact value row, neutral false frame, and container debit', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(`contract Unit() {
        int marker;
        function keep() public { require(true); }
      }
      interface IFactory { function materialize(bool enabled, uint amount); }
      contract Factory() {
        function materialize(bool enabled, uint amount) public {
          if (enabled) { Unit child = new Unit{value: amount}(); }
          require(true);
        }
      }
      contract Driver(address factory) {
        function run(bool enabled, uint amount) public {
          IFactory(factory).materialize(enabled, amount);
          require(true);
        }
      }`, { forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000 });
    const connect = async (artifact: Artifact, args: readonly unknown[] = []): Promise<StatefulContract> => {
      const base = new Contract(artifact, args as never[], { provider });
      const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    };
    const factory = (await connect(artifacts.Factory)).registerChild(artifacts.Unit);
    const driver = await connect(artifacts.Driver, [hexToBin(factory.inner.lockingBytecode)]);
    const handler = artifacts.Factory.messageBus?.handlers.find((candidate) => candidate.name === 'materialize');
    expect(handler).toMatchObject({
      eligible: true,
      childDeployments: [{
        occurrence: 'conditional', siteIndex: 0, spanOffset: 0, spanWidth: 2,
        activation: { kind: 'handlerInput', inputIndex: 0, resultType: 'bool' },
        value: { transferIndex: 0, amount: { kind: 'handlerInput', inputIndex: 1, resultType: 'uint256' } },
      }],
    });

    const containerAmount = 20_000n;
    const childAmount = 5_000n;
    await provider.addUtxo(getSatoshiContainerAddress(factory.inner, factory.categoryId), {
      txid: 'c0'.repeat(32), vout: 1, satoshis: containerAmount,
    });
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const genesis = await createBareP2pkhFeeFunder(provider, 20_000n);
    const intruder = await createBareP2pkhFeeFunder(provider, 20_000n);
    const compose = (
      enabled: boolean, amount = childAmount, supplyGenesis = enabled,
    ): Promise<TransactionBuilder> => messageBus.compose({
      preparedCalls: [
        { contract: driver, functionName: 'run', args: [enabled, amount] },
        { contract: factory, functionName: 'materialize', args: [enabled, amount] },
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
      childDeployments: supplyGenesis ? [{ invocationIndex: 1, siteIndex: 0, funder: genesis }] : [],
    }).build();

    await expect(compose(true, childAmount, false)).rejects.toThrow(/missing child genesis.*site 0/);
    await expect(compose(false, childAmount, true)).rejects.toThrow(/inactive child deployment.*must not supply genesis/);
    await expect(messageBus.compose({
      preparedCalls: [
        { contract: driver, functionName: 'run', args: [true, childAmount] },
        { contract: factory, functionName: 'materialize', args: [true, childAmount] },
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
      childDeployments: [
        { invocationIndex: 1, siteIndex: 0, funder: genesis },
        { invocationIndex: 1, siteIndex: 0, funder: intruder },
      ],
    }).build()).rejects.toThrow(/duplicate child genesis|does not name a selected/);

    const active = await compose(true);
    const inactive = await compose(false);
    expect(vmRejects(active)).toBe(false);
    expect(vmRejects(inactive)).toBe(false);
    const activeDeploy = rowsFor(active, 1, 5);
    const inactiveDeploy = rowsFor(inactive, 1, 5);
    const activeValues = rowsFor(active, 1, 3);
    expect(activeDeploy).toHaveLength(1);
    expect(activeDeploy[0].mode).toBe(0);
    expect(inactiveDeploy).toHaveLength(1);
    expect(inactiveDeploy[0].mode).toBe(1);
    expect(activeValues).toHaveLength(1);
    expect(rowsFor(inactive, 1, 3)).toHaveLength(0);
    expect(activeValues[0].effectHex).toBe('8813000000000000');

    const activeManifest = envelopeOf(active);
    const factoryBase = participantBase(activeManifest, activeValues[0].owner);
    const transferOutput = factoryBase + activeValues[0].targetOffset;
    const childMaster = active.outputs.find((output) =>
      output.token?.category === genesis.utxo.txid && output.token.nft?.capability === 'minting');
    expect(childMaster).toBeDefined();
    expect(binToHex(active.outputs[transferOutput].to as Uint8Array)).toBe(binToHex(childMaster!.to as Uint8Array));
    expect(activeValues[0].subjectHex).toBe(binToHex(childMaster!.to as Uint8Array));
    expect(active.outputs[transferOutput].amount).toBe(childAmount);
    const activeContainer = active.outputs.findIndex((output) => !output.token && output.amount === 15_000n);
    const inactiveContainer = inactive.outputs.findIndex((output) => !output.token && output.amount === containerAmount);
    expect(activeContainer).toBeGreaterThanOrEqual(0);
    expect(inactiveContainer).toBeGreaterThanOrEqual(0);

    // The false path owns the same physical transfer frame, but both sides must be canonical neutral padding.
    const inactiveBase = participantBase(envelopeOf(inactive), activeValues[0].owner);
    const inactiveTransferInput = inactiveBase + activeValues[0].sourceOffset;
    const inactiveTransferOutput = inactiveBase + activeValues[0].targetOffset;
    expect(inactive.inputs[inactiveTransferInput].token).toBeUndefined();
    expect(inactive.outputs[inactiveTransferOutput]).toMatchObject({ amount: 1000n, to: Uint8Array.of(0x51) });
    expect(inactive.outputs[inactiveTransferOutput].token).toBeUndefined();
    expect(inactive.outputs[inactiveContainer].amount).toBe(containerAmount);

    const hiddenInput = await compose(false);
    hiddenInput.inputs[inactiveTransferInput] = { ...intruder.utxo, unlocker: intruder.unlocker };
    expect(vmRejects(hiddenInput)).toBe(true);
    const wrongPaddingLock = await compose(false);
    wrongPaddingLock.outputs[inactiveTransferOutput].to = Uint8Array.of(0x52);
    expect(vmRejects(wrongPaddingLock)).toBe(true);
    const wrongPaddingValue = await compose(false);
    wrongPaddingValue.outputs[inactiveTransferOutput].amount += 1n;
    expect(vmRejects(wrongPaddingValue)).toBe(true);
    const tokenPadding = await compose(false);
    tokenPadding.outputs[inactiveTransferOutput].token = {
      category: factory.categoryId, amount: 1n,
    };
    expect(vmRejects(tokenPadding)).toBe(true);
    const falseContainerDebit = await compose(false);
    falseContainerDebit.outputs[inactiveContainer].amount -= 1n;
    expect(vmRejects(falseContainerDebit)).toBe(true);

    // Rebind the row and every participant digest as well as the physical output. Only the compiler recipe can
    // reject these otherwise self-consistent recipient/amount claims.
    const wrongRecipient = await compose(true);
    wrongRecipient.outputs[transferOutput].to = Uint8Array.of(0x52);
    rewriteAuthenticatedEnvelope(wrongRecipient, (manifest) => ({
      ...manifest,
      rows: manifest.rows.map((row) => row.kind === 3 && row.parent === 1
        ? { ...row, subjectHex: '52' } : row),
    }));
    expect(vmRejects(wrongRecipient)).toBe(true);

    const wrongAmount = await compose(true);
    wrongAmount.outputs[transferOutput].amount += 1n;
    wrongAmount.outputs[activeContainer].amount -= 1n;
    rewriteAuthenticatedEnvelope(wrongAmount, (manifest) => ({
      ...manifest,
      rows: manifest.rows.map((row) => row.kind === 3 && row.parent === 1
        ? { ...row, effectHex: '8913000000000000' } : row),
    }));
    expect(vmRejects(wrongAmount)).toBe(true);

    const missingValueRow = await compose(true);
    rewriteAuthenticatedEnvelope(missingValueRow, (manifest) => ({
      ...manifest, rows: manifest.rows.filter((row) => !(row.kind === 3 && row.parent === 1)),
    }));
    expect(vmRejects(missingValueRow)).toBe(true);
    const extraValueRow = await compose(false);
    rewriteAuthenticatedEnvelope(extraValueRow, (manifest) => ({
      ...manifest, rows: [...manifest.rows, activeValues[0]],
    }));
    expect(vmRejects(extraValueRow)).toBe(true);

    await expect(compose(true, 0n)).rejects.toThrow(/positive uint64/);
    await expect(compose(true, 0x1_0000_0000_0000_0000n)).rejects.toThrow(/positive uint64/);

  }, 240_000);

  it('binds heterogeneous transfer suffixes and keeps active recipients disjoint from OP_TRUE padding', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(`interface IFactory {
        function short(address recipient, uint amount);
        function dynamicSentinel(address recipient);
        function literalSentinel();
      }
      contract Factory() {
        function short(address recipient, uint amount) public {
          this.transfer(recipient, amount);
          require(true);
        }
        function wide(address first, address second, uint amount) public {
          this.transfer(first, amount);
          this.transfer(second, amount);
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
      contract Driver(address factory) {
        function run(address recipient, uint amount) public {
          IFactory(factory).short(recipient, amount);
          require(true);
        }
        function runDynamic(address recipient) public {
          IFactory(factory).dynamicSentinel(recipient);
          require(true);
        }
        function runLiteral() public {
          IFactory(factory).literalSentinel();
          require(true);
        }
      }`, { forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000 });
    const connect = async (artifact: Artifact, args: readonly unknown[] = []): Promise<StatefulContract> => {
      const base = new Contract(artifact, args as never[], { provider });
      const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    };
    const factory = await connect(artifacts.Factory);
    const driver = await connect(artifacts.Driver, [hexToBin(factory.inner.lockingBytecode)]);
    const shortHandler = artifacts.Factory.messageBus?.handlers.find((candidate) => candidate.name === 'short');
    const wideHandler = artifacts.Factory.messageBus?.handlers.find((candidate) => candidate.name === 'wide');
    expect(shortHandler).toMatchObject({ eligible: true, transfers: [{ transferIndex: 0 }] });
    expect(wideHandler).toMatchObject({
      eligible: true, transfers: [{ transferIndex: 0 }, { transferIndex: 1 }],
    });

    await provider.addUtxo(getSatoshiContainerAddress(factory.inner, factory.categoryId), {
      txid: 'd0'.repeat(32), vout: 1, satoshis: 20_000n,
    });
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const recipient = fee.unlocker.generateLockingBytecode();
    const short = (): Promise<TransactionBuilder> => messageBus.compose({
      preparedCalls: [
        { contract: driver, functionName: 'run', args: [recipient, 1_000n] },
        { contract: factory, functionName: 'short', args: [recipient, 1_000n] },
      ],
      funder: fee,
      changeAddress: recipient,
    }).build();
    const canonical = await short();
    expect(vmRejects(canonical)).toBe(false);
    const [activeValue] = rowsFor(canonical, 1, 3);
    expect(activeValue).toBeDefined();
    expect(rowsFor(canonical, 1, 3)).toHaveLength(1);
    const base = participantBase(envelopeOf(canonical), activeValue.owner);
    const unusedInput = base + activeValue.sourceOffset + 1;
    const unusedOutput = base + activeValue.targetOffset + 1;
    expect(canonical.inputs[unusedInput].token).toBeUndefined();
    expect(canonical.outputs[unusedOutput]).toMatchObject({ to: Uint8Array.of(0x51), amount: 1000n });
    expect(canonical.outputs[unusedOutput].token).toBeUndefined();

    // The selected one-transfer handler cannot claim the second slot reserved because another handler on the
    // same participant has width two. Rebind the added kind-3 row and every verifier commitment as well as the
    // physical suffix output; only the compiler-owned selected-handler width can reject it.
    const forgedSuffix = await short();
    forgedSuffix.outputs[unusedOutput].to = recipient;
    rewriteAuthenticatedEnvelope(forgedSuffix, (manifest) => {
      const activeIndex = manifest.rows.findIndex((row) => row.kind === 3 && row.parent === 1);
      if (activeIndex < 0) throw new Error('heterogeneous transfer fixture has no active value row');
      const suffix: AtomicRow = {
        ...manifest.rows[activeIndex],
        slot: manifest.rows[activeIndex].slot + 1,
        sourceOffset: manifest.rows[activeIndex].sourceOffset + 1,
        targetOffset: manifest.rows[activeIndex].targetOffset + 1,
        position: manifest.rows[activeIndex].position + 1,
      };
      return {
        ...manifest,
        rows: [
          ...manifest.rows.slice(0, activeIndex + 1), suffix,
          ...manifest.rows.slice(activeIndex + 1),
        ],
      };
    });
    expect(vmRejects(forgedSuffix)).toBe(true);

    // OP_TRUE is the physical absence sentinel, so it cannot also be an authenticated active recipient whether
    // it arrived from a dynamic handler argument or a literal compiler recipe.
    await expect(messageBus.compose({
      preparedCalls: [
        { contract: driver, functionName: 'runDynamic', args: [Uint8Array.of(0x51)] },
        { contract: factory, functionName: 'dynamicSentinel', args: [Uint8Array.of(0x51)] },
      ],
      funder: fee,
      changeAddress: recipient,
    }).build()).rejects.toThrow(/transfer slot .* invalid|active transfer recipient.*OP_TRUE|preflight failed.*OP_VERIFY/i);
    await expect(messageBus.compose({
      preparedCalls: [
        { contract: driver, functionName: 'runLiteral', args: [] },
        { contract: factory, functionName: 'literalSentinel', args: [] },
      ],
      funder: fee,
      changeAddress: recipient,
    }).build()).rejects.toThrow(
      /transfer slot .* invalid|active transfer recipient.*OP_TRUE|not a canonical typed effect|preflight failed.*OP_VERIFY/i,
    );
  }, 240_000);
});
