/* eslint-disable max-len -- source fixtures and authenticated transcript mutations are clearest inline */
import {
  binToHex, decodeAuthenticationInstructions, encodeAuthenticationInstructions, hexToBin,
} from '@bitauth/libauth';
import { compileStringMulti } from '@solidcash/solidc';
import { buildEntryCommitment, sha256 } from '@solidcash/utils';
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

const envelopeOf = (builder: TransactionBuilder): ReturnType<typeof decodeAtomicMessageEnvelope> => {
  const verifier = builder.inputs.findIndex((input) => input.token?.nft?.commitment.startsWith('4c335631'));
  if (verifier < 0) throw new Error('conditional-deploy test found no verifier input');
  const instructions = decodeAuthenticationInstructions(
    builder.buildLibauthTransaction().inputs[verifier].unlockingBytecode,
  );
  const envelope = instructions[0];
  if (!envelope || !('data' in envelope)) throw new Error('conditional-deploy verifier has no envelope');
  return decodeAtomicMessageEnvelope(envelope.data);
};

/** Rebind every participant after a hostile but internally consistent call-manifest rewrite. */
const rewriteAuthenticatedEnvelope = (
  builder: TransactionBuilder,
  rewrite: (manifest: ReturnType<typeof decodeAtomicMessageEnvelope>) => ReturnType<typeof decodeAtomicMessageEnvelope>,
): void => {
  const verifierIndices = builder.inputs
    .map((input, index) => ({ input, index }))
    .filter(({ input }) => input.token?.nft?.commitment.startsWith('4c335631'))
    .map(({ index }) => index);
  if (verifierIndices.length < 2) throw new Error('conditional-deploy mutation needs every participant verifier');
  const verifierUnlockers = verifierIndices.map((index) => builder.inputs[index].unlocker!);
  const transaction = builder.buildLibauthTransaction();
  const instructions = decodeAuthenticationInstructions(transaction.inputs[verifierIndices[0]].unlockingBytecode);
  const envelope = instructions[0];
  if (!envelope || !('data' in envelope)) throw new Error('conditional-deploy verifier has no envelope push');
  const original = decodeAtomicMessageEnvelope(envelope.data);
  const changedEnvelope = encodeAtomicMessageEnvelope(rewrite(original));
  const changedManifest = changedEnvelope.slice(8);

  for (const [participant, verifierIndex] of verifierIndices.entries()) {
    const unlocker = verifierUnlockers[participant];
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
    const output = builder.outputs[verifierIndex];
    output.token!.nft!.commitment = `${builder.inputs[verifierIndex].token!.nft!.commitment.slice(0, 12)}`
      + binToHex(sha256(concatBytes(...parts)));
  }
};

const deploymentRow = (builder: TransactionBuilder, parent: number): AtomicRow => {
  const row = envelopeOf(builder).rows.find((candidate) => candidate.kind === 5 && candidate.parent === parent);
  if (!row) throw new Error(`conditional-deploy test found no row for invocation ${parent}`);
  return row;
};

const participantBase = (
  manifest: ReturnType<typeof decodeAtomicMessageEnvelope>, participant: number,
): number => manifest.participants.slice(0, participant).reduce((base, current) => base + current.actualSize, 0);

const spanWidth = (row: AtomicRow): number => {
  const bytes = hexToBin(row.effectHex.slice(0, 4));
  if (bytes.length !== 2) throw new Error('deployment row has no span width');
  return bytes[0] + bytes[1] * 256;
};

/** Transplant the complete physical deployment span; the envelope is replaced separately. */
const transplantDeploymentSpan = (
  destination: TransactionBuilder, source: TransactionBuilder, destinationRow: AtomicRow, sourceRow: AtomicRow,
): void => {
  const destinationManifest = envelopeOf(destination);
  const sourceManifest = envelopeOf(source);
  const destinationBase = participantBase(destinationManifest, destinationRow.owner);
  const sourceBase = participantBase(sourceManifest, sourceRow.owner);
  const width = spanWidth(sourceRow);
  expect(spanWidth(destinationRow)).toBe(width);
  for (let member = 0; member < width; member += 1) {
    destination.inputs[destinationBase + destinationRow.sourceOffset + member]
      = source.inputs[sourceBase + sourceRow.sourceOffset + member];
    const output = source.outputs[sourceBase + sourceRow.targetOffset + member];
    destination.outputs[destinationBase + destinationRow.targetOffset + member] = {
      ...output,
      ...(output.token && { token: { ...output.token, ...(output.token.nft && { nft: { ...output.token.nft } }) } }),
    };
  }
};

describe('explicit conditional child deployment transcript security', () => {
  it('binds active and inactive genesis spans to the repeated row source predicate', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(`contract Unit() {
        int32[2] values;
        constructor() { this.values[0] = 7; this.values[1] = 8; }
        function keep() public { require(true); }
      }
      interface IFactory { function materialize(bool enabled); }
      contract Factory() {
        function materialize(bool enabled) deploy {
          if (enabled) { Unit child = new Unit(); }
          require(true);
        }
      }
      contract Driver(address factory) {
        function run(bool first, bool second) public {
          IFactory(factory).materialize(first);
          IFactory(factory).materialize(second);
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
        occurrence: 'conditional', siteIndex: 0, spanOffset: 0, spanWidth: 3,
        entryNftOutputCount: 2,
        activation: { kind: 'handlerInput', inputIndex: 0, resultType: 'bool' },
      }],
    });

    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const firstGenesis = await createBareP2pkhFeeFunder(provider, 20_000n);
    const secondGenesis = await createBareP2pkhFeeFunder(provider, 20_000n);
    const build = (
      second: boolean, supplySecond = second,
    ): Promise<TransactionBuilder> => messageBus.compose({
      preparedCalls: [
        { contract: driver, functionName: 'run', args: [true, second] },
        { contract: factory, functionName: 'materialize', args: [true] },
        { contract: factory, functionName: 'materialize', args: [second] },
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
      childDeployments: [
        { invocationIndex: 1, siteIndex: 0, funder: firstGenesis },
        ...(supplySecond ? [{ invocationIndex: 2, siteIndex: 0, funder: secondGenesis }] : []),
      ],
    }).build();

    await expect(build(true, false)).rejects.toThrow(/missing child genesis.*site 0/);
    await expect(build(false, true)).rejects.toThrow(/inactive child deployment.*must not supply genesis/);

    const bothActive = await build(true);
    const secondInactive = await build(false);
    expect(vmRejects(bothActive)).toBe(false);
    expect(vmRejects(secondInactive)).toBe(false);
    expect(deploymentRow(bothActive, 1).mode).toBe(0);
    expect(deploymentRow(bothActive, 2).mode).toBe(0);
    expect(deploymentRow(secondInactive, 1).mode).toBe(0);
    expect(deploymentRow(secondInactive, 2).mode).toBe(1);

    // The second finite constructor entry is independently authenticated even though it reuses the first
    // entry's already-checked collection covenant address.
    const forgedSecondCommitment = await build(false);
    const firstEntryOutputs = forgedSecondCommitment.outputs.filter((output) =>
      output.token?.category === firstGenesis.utxo.txid && output.token.nft?.capability === 'mutable');
    expect(firstEntryOutputs).toHaveLength(2);
    firstEntryOutputs[1].token!.nft!.commitment = buildEntryCommitment(1n, 'bigint', 9n, 'int32');
    expect(vmRejects(forgedSecondCommitment)).toBe(true);
    const forgedSecondAddress = await build(false);
    const firstAddressOutputs = forgedSecondAddress.outputs.filter((output) =>
      output.token?.category === firstGenesis.utxo.txid && output.token.nft?.capability === 'mutable');
    firstAddressOutputs[1].to = Uint8Array.of(0x51);
    expect(vmRejects(forgedSecondAddress)).toBe(true);

    // False source branch + a fully valid active row/genesis/output span. Every digest is rebound, so only the
    // handler's source-path execution bit and fixed span checks can reject this transcript.
    const forgedActive = await build(false);
    const activeDonor = await build(true);
    const inactiveRow = deploymentRow(forgedActive, 2);
    const activeRow = deploymentRow(activeDonor, 2);
    transplantDeploymentSpan(forgedActive, activeDonor, inactiveRow, activeRow);
    rewriteAuthenticatedEnvelope(forgedActive, (manifest) => ({
      ...manifest,
      rows: manifest.rows.map((row) => row.kind === 5 && row.parent === 2 ? activeRow : row),
    }));
    expect(vmRejects(forgedActive)).toBe(true);

    // True source branch + a canonical inactive row and neutral physical span is the inverse forgery.
    const forgedInactive = await build(true);
    const inactiveDonor = await build(false);
    const originallyActive = deploymentRow(forgedInactive, 2);
    const donorInactive = deploymentRow(inactiveDonor, 2);
    transplantDeploymentSpan(forgedInactive, inactiveDonor, originallyActive, donorInactive);
    rewriteAuthenticatedEnvelope(forgedInactive, (manifest) => ({
      ...manifest,
      rows: manifest.rows.map((row) => row.kind === 5 && row.parent === 2 ? donorInactive : row),
    }));
    expect(vmRejects(forgedInactive)).toBe(true);

    // The inactive span is still a compiler-owned physical region, not spare output capacity.
    const nonNeutralInactive = await build(false);
    const row = deploymentRow(nonNeutralInactive, 2);
    const base = participantBase(envelopeOf(nonNeutralInactive), row.owner);
    nonNeutralInactive.outputs[base + row.targetOffset].to = Uint8Array.of(0x52);
    expect(vmRejects(nonNeutralInactive)).toBe(true);

    // Neither an inactive member nor an active data-NFT padding member may hide an unlisted co-spend.
    const intruder = await createBareP2pkhFeeFunder(provider, 20_000n);
    const hiddenInactiveInput = await build(false);
    const hiddenInactiveRow = deploymentRow(hiddenInactiveInput, 2);
    const hiddenInactiveBase = participantBase(envelopeOf(hiddenInactiveInput), hiddenInactiveRow.owner);
    hiddenInactiveInput.inputs[hiddenInactiveBase + hiddenInactiveRow.sourceOffset] = {
      ...intruder.utxo, unlocker: intruder.unlocker,
    };
    expect(vmRejects(hiddenInactiveInput)).toBe(true);

    const hiddenActivePadding = await build(true);
    const hiddenActiveRow = deploymentRow(hiddenActivePadding, 2);
    const hiddenActiveBase = participantBase(envelopeOf(hiddenActivePadding), hiddenActiveRow.owner);
    hiddenActivePadding.inputs[hiddenActiveBase + hiddenActiveRow.sourceOffset + 1] = {
      ...intruder.utxo, unlocker: intruder.unlocker,
    };
    expect(vmRejects(hiddenActivePadding)).toBe(true);

    // The inactive spelling must retain the exact compiler-published site identity and complete span. These
    // rewrites keep every physical slot neutral and rebind every digest, so acceptance would mean the manifest
    // can understate or relocate a source occurrence without changing execution.
    const wrongSite = await build(false);
    rewriteAuthenticatedEnvelope(wrongSite, (manifest) => ({
      ...manifest,
      rows: manifest.rows.map((candidate) => candidate.kind === 5 && candidate.parent === 2
        ? { ...candidate, argsHex: '0100' } : candidate),
    }));
    expect(vmRejects(wrongSite)).toBe(true);

    const narrowInactive = await build(false);
    rewriteAuthenticatedEnvelope(narrowInactive, (manifest) => ({
      ...manifest,
      rows: manifest.rows.map((candidate) => candidate.kind === 5 && candidate.parent === 2
        ? { ...candidate, effectHex: '0100' } : candidate),
    }));
    expect(vmRejects(narrowInactive)).toBe(true);

    const shiftedInactive = await build(false);
    rewriteAuthenticatedEnvelope(shiftedInactive, (manifest) => ({
      ...manifest,
      rows: manifest.rows.map((candidate) => candidate.kind === 5 && candidate.parent === 2
        ? {
          ...candidate,
          sourceOffset: candidate.sourceOffset + 1,
          targetOffset: candidate.targetOffset + 1,
          slot: candidate.slot + 1,
          position: candidate.position + 1,
        } : candidate),
    }));
    expect(vmRejects(shiftedInactive)).toBe(true);
  }, 240_000);
});
