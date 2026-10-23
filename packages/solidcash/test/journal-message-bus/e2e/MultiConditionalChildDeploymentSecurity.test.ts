/* eslint-disable max-len -- adversarial manifest rewrites are clearest when their authenticated fields stay together */
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
  if (verifier < 0) throw new Error('multi-conditional-deploy test found no verifier input');
  const instructions = decodeAuthenticationInstructions(
    builder.buildLibauthTransaction().inputs[verifier].unlockingBytecode,
  );
  const envelope = instructions[0];
  if (!envelope || !('data' in envelope)) throw new Error('multi-conditional-deploy verifier has no envelope');
  return decodeAtomicMessageEnvelope(envelope.data);
};

/** Recompute every participant commitment after a hostile call-manifest rewrite. */
const rewriteAuthenticatedEnvelope = (
  builder: TransactionBuilder,
  rewrite: (manifest: ReturnType<typeof decodeAtomicMessageEnvelope>) => ReturnType<typeof decodeAtomicMessageEnvelope>,
): void => {
  const verifierIndices = builder.inputs
    .map((input, index) => ({ input, index }))
    .filter(({ input }) => input.token?.nft?.commitment.startsWith('4c335631'))
    .map(({ index }) => index);
  if (verifierIndices.length < 2) throw new Error('multi-conditional-deploy mutation needs every verifier');
  const verifierUnlockers = verifierIndices.map((index) => builder.inputs[index].unlocker!);
  const transaction = builder.buildLibauthTransaction();
  const instructions = decodeAuthenticationInstructions(transaction.inputs[verifierIndices[0]].unlockingBytecode);
  const envelope = instructions[0];
  if (!envelope || !('data' in envelope)) throw new Error('multi-conditional-deploy verifier has no envelope push');
  const changedEnvelope = encodeAtomicMessageEnvelope(rewrite(decodeAtomicMessageEnvelope(envelope.data)));
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

const deploymentRows = (builder: TransactionBuilder, parent = 1): AtomicRow[] => envelopeOf(builder).rows
  .filter((row) => row.kind === 5 && row.parent === parent)
  .sort((left, right) => left.sourceOffset - right.sourceOffset);

const participantBase = (
  manifest: ReturnType<typeof decodeAtomicMessageEnvelope>, participant: number,
): number => manifest.participants.slice(0, participant).reduce((base, current) => base + current.actualSize, 0);

const rowWidth = (row: AtomicRow): number => {
  const bytes = hexToBin(row.effectHex.slice(0, 4));
  return bytes[0] + bytes[1] * 256;
};

const transplantSpan = (
  destination: TransactionBuilder, source: TransactionBuilder, destinationRow: AtomicRow, sourceRow: AtomicRow,
): void => {
  expect(rowWidth(destinationRow)).toBe(rowWidth(sourceRow));
  const destinationBase = participantBase(envelopeOf(destination), destinationRow.owner);
  const sourceBase = participantBase(envelopeOf(source), sourceRow.owner);
  for (let member = 0; member < rowWidth(sourceRow); member += 1) {
    destination.inputs[destinationBase + destinationRow.sourceOffset + member]
      = source.inputs[sourceBase + sourceRow.sourceOffset + member];
    const output = source.outputs[sourceBase + sourceRow.targetOffset + member];
    destination.outputs[destinationBase + destinationRow.targetOffset + member] = {
      ...output,
      ...(output.token && { token: { ...output.token, ...(output.token.nft && { nft: { ...output.token.nft } }) } }),
    };
  }
};

describe('multiple conditional child deployment sites authenticate one canonical partition', () => {
  it('binds independent predicates, exclusive arms, rows, and heterogeneous physical spans', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(`contract Narrow() {
        int marker;
        function keep() public { require(true); }
      }
      contract Wide() {
        bytes32 a; bytes32 b; bytes32 c; bytes32 d; bytes32 e;
        function keep() public { require(true); }
      }
      interface IFactory { function materialize(bool first, bool second, bool narrowArm); }
      contract Factory() {
        function materialize(bool first, bool second, bool narrowArm) public {
          Narrow anchor = new Narrow();
          if (first) { Narrow firstChild = new Narrow(); }
          if (second) { Wide secondChild = new Wide(); }
          if (narrowArm) { Narrow narrowChild = new Narrow(); }
          else { Wide wideChild = new Wide(); }
          require(true);
        }
      }
      contract Driver(address factory) {
        function run(bool first, bool second, bool narrowArm) public {
          IFactory(factory).materialize(first, second, narrowArm);
          require(true);
        }
      }`, { forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000 });
    const connect = async (artifact: Artifact, args: readonly unknown[] = []): Promise<StatefulContract> => {
      const base = new Contract(artifact, args as never[], { provider });
      const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    };
    const factory = (await connect(artifacts.Factory)).registerChild(artifacts.Narrow).registerChild(artifacts.Wide);
    const driver = await connect(artifacts.Driver, [hexToBin(factory.inner.lockingBytecode)]);
    const handler = artifacts.Factory.messageBus?.handlers.find((candidate) => candidate.name === 'materialize');
    expect(handler?.eligible).toBe(true);
    expect(handler?.childDeployments).toMatchObject([
      { siteIndex: 0, contractName: 'Narrow', occurrence: 'once', spanOffset: 0, spanWidth: 2 },
      { siteIndex: 1, contractName: 'Narrow', occurrence: 'conditional', spanOffset: 2, spanWidth: 2,
        activation: { kind: 'handlerInput', inputIndex: 0, resultType: 'bool' } },
      { siteIndex: 2, contractName: 'Wide', occurrence: 'conditional', spanOffset: 4, spanWidth: 3,
        activation: { kind: 'handlerInput', inputIndex: 1, resultType: 'bool' } },
      { siteIndex: 3, contractName: 'Narrow', occurrence: 'conditional', spanOffset: 7, spanWidth: 2,
        activation: { kind: 'handlerInput', inputIndex: 2, resultType: 'bool' } },
      { siteIndex: 4, contractName: 'Wide', occurrence: 'conditional', spanOffset: 9, spanWidth: 3,
        activation: { kind: 'unary', operator: '!', resultType: 'bool',
          operand: { kind: 'handlerInput', inputIndex: 2, resultType: 'bool' } } },
    ]);

    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const genesis = await Promise.all(Array.from(
      { length: 5 },
      (): ReturnType<typeof createBareP2pkhFeeFunder> => createBareP2pkhFeeFunder(provider, 20_000n),
    ));
    const build = (first: boolean, second: boolean, narrowArm: boolean): Promise<TransactionBuilder> => messageBus.compose({
      preparedCalls: [
        { contract: driver, functionName: 'run', args: [first, second, narrowArm] },
        { contract: factory, functionName: 'materialize', args: [first, second, narrowArm] },
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
      childDeployments: [
        { invocationIndex: 1, siteIndex: 0, funder: genesis[0] },
        ...(first ? [{ invocationIndex: 1, siteIndex: 1, funder: genesis[1] }] : []),
        ...(second ? [{ invocationIndex: 1, siteIndex: 2, funder: genesis[2] }] : []),
        ...(narrowArm
          ? [{ invocationIndex: 1, siteIndex: 3, funder: genesis[3] }]
          : [{ invocationIndex: 1, siteIndex: 4, funder: genesis[4] }]),
      ],
    }).build();

    const allIndependent = await build(true, true, true);
    const elseOnly = await build(false, false, false);
    expect(vmRejects(allIndependent)).toBe(false);
    expect(vmRejects(elseOnly)).toBe(false);
    expect(deploymentRows(allIndependent).map((row) => [row.mode, rowWidth(row)])).toEqual([
      [0, 2], [0, 2], [0, 3], [0, 2], [1, 3],
    ]);
    expect(deploymentRows(elseOnly).map((row) => [row.mode, rowWidth(row)])).toEqual([
      [0, 2], [1, 2], [1, 3], [1, 2], [0, 3],
    ]);

    // Composer-level exactness: the two independent predicates do not leak into each other, and exactly one
    // if/else arm owns a genesis on either value of narrowArm.
    await expect(messageBus.compose({
      preparedCalls: [
        { contract: driver, functionName: 'run', args: [true, false, true] },
        { contract: factory, functionName: 'materialize', args: [true, false, true] },
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
      childDeployments: [
        { invocationIndex: 1, siteIndex: 0, funder: genesis[0] },
        { invocationIndex: 1, siteIndex: 1, funder: genesis[1] },
        { invocationIndex: 1, siteIndex: 4, funder: genesis[4] },
      ],
    }).build()).rejects.toThrow(/missing child genesis.*site 3|inactive child deployment.*site 4/);

    // A straight-line site is not entitled to the inactive spelling. Transplant a genuinely neutral,
    // equal-width conditional span and authenticate a mode-1 row at site 0; per-site conditional metadata,
    // rather than the mere presence of conditional siblings in this handler, must reject the forgery.
    const inactiveUnconditional = await build(false, false, false);
    const inactiveUnconditionalDonor = await build(false, false, false);
    const unconditionalRow = deploymentRows(inactiveUnconditional)[0];
    const neutralConditionalRow = deploymentRows(inactiveUnconditionalDonor)[1];
    transplantSpan(inactiveUnconditional, inactiveUnconditionalDonor, unconditionalRow, neutralConditionalRow);
    rewriteAuthenticatedEnvelope(inactiveUnconditional, (manifest) => ({
      ...manifest,
      rows: manifest.rows.map((row) => row.kind === 5 && row.parent === 1 && row.argsHex.startsWith('0000')
        ? {
          ...neutralConditionalRow,
          slot: unconditionalRow.slot,
          sourceOffset: unconditionalRow.sourceOffset,
          targetOffset: unconditionalRow.targetOffset,
          position: unconditionalRow.position,
          argsHex: '0000',
        } : row),
    }));
    expect(vmRejects(inactiveUnconditional)).toBe(true);

    // Replace one predicate's active/inactive transcript with another equal-width site's opposite transcript.
    // Physical spans, rows, and every manifest digest are all rebound; only source-site identity can reject it.
    const swappedSites = await build(true, false, false);
    const swappedDonor = await build(false, false, true);
    const destinationRows = deploymentRows(swappedSites);
    const donorRows = deploymentRows(swappedDonor);
    transplantSpan(swappedSites, swappedDonor, destinationRows[1], donorRows[1]);
    transplantSpan(swappedSites, swappedDonor, destinationRows[3], donorRows[3]);
    rewriteAuthenticatedEnvelope(swappedSites, (manifest) => ({
      ...manifest,
      rows: manifest.rows.map((row) => row.kind === 5 && row.parent === 1
        && (row.argsHex.startsWith('0100') || row.argsHex.startsWith('0300'))
        ? donorRows[Number.parseInt(row.argsHex.slice(0, 4).match(/../g)!.reverse().join(''), 16)] : row),
    }));
    expect(vmRejects(swappedSites)).toBe(true);

    const rowOrderSwap = await build(true, true, true);
    rewriteAuthenticatedEnvelope(rowOrderSwap, (manifest) => {
      const rows = [...manifest.rows];
      const indices = rows.map((row, index) => ({ row, index }))
        .filter(({ row }) => row.kind === 5 && row.parent === 1).map(({ index }) => index);
      [rows[indices[0]], rows[indices[1]]] = [rows[indices[1]], rows[indices[0]]];
      return { ...manifest, rows };
    });
    expect(vmRejects(rowOrderSwap)).toBe(true);

    const omitted = await build(true, true, true);
    rewriteAuthenticatedEnvelope(omitted, (manifest) => ({
      ...manifest, rows: manifest.rows.filter((row) => !(row.kind === 5 && row.parent === 1 && row.argsHex.startsWith('0200'))),
    }));
    expect(vmRejects(omitted)).toBe(true);

    const extra = await build(true, true, true);
    rewriteAuthenticatedEnvelope(extra, (manifest) => {
      const row = manifest.rows.find((candidate) => candidate.kind === 5 && candidate.parent === 1)!;
      return { ...manifest, rows: [...manifest.rows, { ...row }] };
    });
    expect(vmRejects(extra)).toBe(true);

    const aliased = await build(true, true, true);
    rewriteAuthenticatedEnvelope(aliased, (manifest) => {
      const rows = manifest.rows.filter((row) => row.kind === 5 && row.parent === 1);
      return {
        ...manifest,
        rows: manifest.rows.map((row) => row === rows[3] ? {
          ...row,
          slot: rows[1].slot,
          sourceOffset: rows[1].sourceOffset,
          targetOffset: rows[1].targetOffset,
          position: rows[1].position,
        } : row),
      };
    });
    expect(vmRejects(aliased)).toBe(true);

    for (const mutate of [
      (row: AtomicRow): AtomicRow => ({ ...row, sourceOffset: row.sourceOffset + 1 }),
      (row: AtomicRow): AtomicRow => ({ ...row, targetOffset: row.targetOffset + 1 }),
      (row: AtomicRow): AtomicRow => ({ ...row, effectHex: '0100' + row.effectHex.slice(4) }),
    ]) {
      const tampered = await build(true, true, true);
      rewriteAuthenticatedEnvelope(tampered, (manifest) => ({
        ...manifest,
        rows: manifest.rows.map((row) => row.kind === 5 && row.parent === 1 && row.argsHex.startsWith('0200')
          ? mutate(row) : row),
      }));
      expect(vmRejects(tampered)).toBe(true);
    }
  }, 240_000);
});
