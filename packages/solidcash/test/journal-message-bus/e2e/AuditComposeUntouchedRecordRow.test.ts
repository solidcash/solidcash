/**
 * A record no row touched, rewritten in a participant block on the compose path
 * (docs/security/security-audit-2026-10-16.md, "Security completion (2026-11-23)", "Compose path").
 *
 * Once its verifier ran, a bound route claimed its whole verified block (emitRouteBlockClaims), so it held no in-block
 * record a row did not touch. The verifier holds each own-category mutable endpoint there to a manifest resource row
 * (kind 1, mode 0: the exact input and output commitment) and to the endpoint count, but no resource row to an
 * executed handler effect. So a composer who writes the manifest declared a rewrite of an untouched record, and it
 * settled (VM-confirmed at f3e5026c9). The route now keeps the claims of the rows that ran, cut to its physical block.
 *
 * The honest compose runs `put(5, 9)` on the bus beside its verifier. The control adds `side[9]` at the bus block's
 * unused lane, recreated unchanged, with the resource row that declares it: every input settles, so the envelope and
 * verifier rebinding below are sound. The attack is the control with the entry's value rewritten, row and output
 * alike: the route refuses it.
 *
 * The second describe compiles the bus and the driver as graph routes (`messageBusGraphContext`). A graph route takes
 * no claims and its pin skips its whole verifier-proven block, so its attack row is `it.fails` until it keeps them.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  binToHex, decodeAuthenticationInstructions, encodeAuthenticationInstructions, encodeDataPush,
  encodeLockingBytecodeP2sh32, hash256, hexToBin,
} from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import {
  buildEntryNftCovenantScript, computeCollectionHash, encodeIntegerValue, scriptToBytecode, sha256,
} from '@solidcash/utils';
import { Contract, type TransactionBuilder } from '../../../src/index.js';
import type { ContractUnlocker, UnlockableUtxo, Utxo } from '../../../src/interfaces.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import {
  decodeAtomicMessageEnvelope, encodeAtomicMessageEnvelope, type AtomicRow,
} from '../../../src/message-bus/atomic.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { addressToLockScript, generateLibauthSourceOutputs } from '../../../src/utils.js';
import {
  directConventionMasterLock, getEntryNftAddress, resolveCollectionSignature,
} from '../../../src/stateful/covenant-helpers.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const BUS = `contract LaneBus() {
  mapping(int => int) public side;
  function put(int key, int value) public { this.side[key] = value; require(true); }
  function check(int key, int expected) public { require(this.side[key] == expected); }
  function compare(int a, int b) public { require(this.side[a] == this.side[b]); }
}`;

const DRIVER = `interface ILaneBus { function put(int key, int value); }
contract LaneDriver(address bus) {
  function poke() public { ILaneBus(bus).put(5, 9); require(true); }
}`;

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true,
  maximumInputBytes: 1_000_000, suppressWarnings: true,
} as const;

type Artifact = ReturnType<typeof compileString>;
type Provider = ReturnType<typeof createMessageBusCapstoneTestProvider>;
type Manifest = ReturnType<typeof decodeAtomicMessageEnvelope>;

const ENVELOPE_MAGIC = '4c334331';
const VERIFIER_MAGIC = '4c335631';
const TXID = /^[0-9a-f]{64}$/;

const uint16 = (value: number): Uint8Array => Uint8Array.of(value & 0xff, (value >>> 8) & 0xff);

function concatBytes(...parts: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let cursor = 0;
  for (const part of parts) {
    result.set(part, cursor);
    cursor += part.length;
  }
  return result;
}

function failures(builder: TransactionBuilder): Array<{ inputIndex: number; error: string }> {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  return transaction.inputs.flatMap((_input, inputIndex) => {
    const state = vm.evaluate({ inputIndex, sourceOutputs, transaction });
    const result = vm.stateSuccess(state);
    return result === true ? [] : [{ inputIndex, error: `${result} (ip ${state.ip})` }];
  });
}

async function connect(
  provider: Provider, artifact: Artifact, args: readonly unknown[],
): Promise<{ contract: StatefulContract; categoryId: string }> {
  const base = new Contract(artifact, args as never[], { provider });
  const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
  return {
    contract: StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId),
    categoryId: setup.categoryId,
  };
}

/** The encoded envelope the transaction carries and the inputs whose unlocking pushes it verbatim. */
function carriedEnvelope(builder: TransactionBuilder): { envelope: Uint8Array; carriers: number[] } {
  let envelope: Uint8Array | undefined;
  const carriers: number[] = [];
  builder.buildLibauthTransaction().inputs.forEach((input, index) => {
    for (const instruction of decodeAuthenticationInstructions(input.unlockingBytecode)) {
      if (!('data' in instruction) || !binToHex(instruction.data).startsWith(ENVELOPE_MAGIC)) continue;
      if (envelope !== undefined && binToHex(envelope) !== binToHex(instruction.data)) {
        throw new Error('the compose carries two different envelopes');
      }
      envelope = instruction.data;
      carriers.push(index);
    }
  });
  if (envelope === undefined) throw new Error('the compose carries no envelope');
  return { envelope, carriers };
}

/** Carry `changed` wherever the compose carried the envelope, and rebind every verifier commitment to it. */
function rebindEnvelope(builder: TransactionBuilder, changed: Manifest): void {
  const { envelope, carriers } = carriedEnvelope(builder);
  const oldHex = binToHex(envelope);
  const changedEnvelope = encodeAtomicMessageEnvelope(changed);
  for (const index of carriers) {
    const unlocker = builder.inputs[index].unlocker;
    builder.inputs[index] = {
      ...builder.inputs[index],
      unlocker: {
        ...unlocker,
        generateLockingBytecode: () => unlocker.generateLockingBytecode(),
        generateUnlockingBytecode: (options) => encodeAuthenticationInstructions(
          decodeAuthenticationInstructions(unlocker.generateUnlockingBytecode(options)).map((instruction) => (
            'data' in instruction && binToHex(instruction.data) === oldHex
              ? { ...instruction, data: changedEnvelope } : instruction)),
        ),
      } as typeof unlocker,
    };
  }
  // The binding digest as compose-assemble builds it: a verifier with no graph arguments binds its participant's
  // physical block size last, and its commitment is the instance prefix, the digest, and a lifecycle code if any.
  const changedManifest = changedEnvelope.slice(8);
  const bases = changed.participants.map((_participant, index) => changed.participants.slice(0, index)
    .reduce((base, current) => base + current.actualSize, 0));
  builder.inputs.forEach((input, index) => {
    if (!input.token?.nft?.commitment.startsWith(VERIFIER_MAGIC)) return;
    // [densityReserve, activeInputIndex, expectedLocalRows, localBatch, graph values..., messageEnvelope], the
    // envelope last on a participant-verifier transport (createMessageBusVerifierUnlocker).
    const params = (input.unlocker as ContractUnlocker).params;
    const last = params[params.length - 1];
    const carriesEnvelope = last instanceof Uint8Array && binToHex(last) === oldHex;
    const [, activeBase, expectedRows, batch] = params;
    if (typeof activeBase !== 'bigint' || typeof expectedRows !== 'bigint' || !(batch instanceof Uint8Array)) {
      throw new Error('a verifier input has no canonical arguments');
    }
    const parts = [sha256(changedManifest), uint16(Number(activeBase)), uint16(Number(expectedRows)), sha256(batch)];
    const graphArguments = params.slice(4, carriesEnvelope ? -1 : undefined);
    for (const value of graphArguments) {
      if (typeof value === 'bigint') parts.push(uint16(Number(value)));
      else if (value instanceof Uint8Array) parts.push(sha256(value));
      else throw new Error('a verifier input has an unexpected argument');
    }
    if (graphArguments.length === 0) {
      const participant = bases.indexOf(Number(activeBase));
      if (participant < 0) throw new Error('a verifier names no participant base');
      parts.push(uint16(changed.participants[participant]!.actualSize));
    }
    const output = builder.outputs[index].token!.nft!;
    if (output.commitment.length !== 76 && output.commitment.length !== 80) {
      throw new Error(`a verifier output commitment of ${output.commitment.length / 2} bytes`);
    }
    output.commitment = input.token.nft.commitment.slice(0, 12) + binToHex(sha256(concatBytes(...parts)))
      + output.commitment.slice(76);
  });
}

interface ComposeScenario {
  provider: Provider;
  honest: { builder: TransactionBuilder; failures: ReturnType<typeof failures> };
  control: ReturnType<typeof failures>;
  attack: ReturnType<typeof failures>;
  lane: number;
}

/**
 * The honest compose, the control and the attack, the bus and the driver compiled as graph routes or as bound leaf
 * routes: `side[9]` at a pad of the bus block no row uses, declared under its own resource row, unchanged or with its
 * value one bit off.
 */
async function composeScenario(graph: boolean): Promise<ComposeScenario> {
  const provider = createMessageBusCapstoneTestProvider();
  const options = { ...KERNEL, ...(graph ? { messageBusGraphContext: true } : {}) };
  const busArtifact = compileString(BUS, { ...options, messageBusHandlers: ['put', 'check', 'compare'] });
  expect(new Set(busArtifact.messageBus?.handlers.filter((handler) => handler.eligible)
    .map((handler) => handler.name))).toEqual(new Set(['put', 'check', 'compare']));
  // A graph route takes its verifier-proven block size; a bound leaf route takes its participant size.
  expect(busArtifact.messageBus!.route.inputs.some((input) => input.name === '__internal__graphBlockSize'))
    .toBe(graph);
  const driverArtifact = compileString(DRIVER, options);
  const { contract: bus, categoryId } = await connect(provider, busArtifact, []);
  const { contract: driver } = await connect(provider, driverArtifact, [hexToBin(bus.inner.lockingBytecode)]);
  await bus.call.put(5n, 7n).send();
  await bus.call.put(9n, 1n).send();

  const compose = async (): Promise<TransactionBuilder> => {
    const funder = await createBareP2pkhFeeFunder(provider, 2_000_000n);
    return messageBus.compose({
      preparedCalls: [
        { contract: driver, functionName: 'poke', args: [] },
        { contract: bus, functionName: 'put', args: [5n, 9n] },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    }).build();
  };
  const honest = await compose();
  const honestFailures = failures(honest);

  // The bus block: its minting master and its span in the manifest.
  const masterOf = (builder: TransactionBuilder): number => builder.inputs.findIndex((input) =>
    input.token?.nft?.capability === 'minting' && input.token.category === categoryId);
  const manifest = decodeAtomicMessageEnvelope(carriedEnvelope(honest).envelope);
  const baseOf = (participant: number): number => manifest.participants.slice(0, participant)
    .reduce((base, current) => base + current.actualSize, 0);
  const master = masterOf(honest);
  const busParticipant = manifest.participants.findIndex((_participant, index) => baseOf(index) === master);
  expect(busParticipant, 'the bus block starts at its master').toBeGreaterThanOrEqual(0);
  const blockSize = manifest.participants[busParticipant]!.actualSize;
  // A handler-managed side lane no row of this compose uses: a token-less pad in and out.
  const routeEntries = busArtifact.messageBus!.route.entryAccesses ?? [];
  const sideSlots = new Set(routeEntries.flatMap((access, index) =>
    (access.collection === 'side' ? [access.slotIndex ?? index] : [])));
  const lanes = busArtifact.messageBus!.route.blockLayout!.slots
    .filter((slot) => slot.kind === 'entry' && slot.slotIndex !== undefined && sideSlots.has(slot.slotIndex))
    .map((slot) => slot.offset);
  const free = (offset: number): boolean => offset > 0 && offset < blockSize
    && honest.inputs[master + offset]?.token === undefined && honest.outputs[master + offset]?.token === undefined;
  // A side lane if one is left to a pad, else any pad of the block: no row of the compose uses either.
  const lane = lanes.find(free) ?? Array.from({ length: blockSize }, (_unused, offset) => offset).find(free);
  expect(lane, 'the compose leaves a pad in the bus block').toBeDefined();

  // side[9], which the compose does not spend, with the redeem of its entry covenant's write flag.
  const redeem = scriptToBytecode(buildEntryNftCovenantScript(
    hexToBin(categoryId), computeCollectionHash(resolveCollectionSignature(busArtifact, 'side')),
    directConventionMasterLock(bus.inner),
  ));
  const lock = addressToLockScript(getEntryNftAddress(bus.inner, categoryId, 'side'));
  expect(binToHex(encodeLockingBytecodeP2sh32(hash256(redeem)))).toBe(binToHex(lock));
  const spent = new Set(honest.inputs.map((input) => `${input.txid}:${input.vout}`));
  const victim = (await provider.getUtxos(getEntryNftAddress(bus.inner, categoryId, 'side')))
    .find((utxo) => utxo.token?.nft?.capability === 'mutable' && !spent.has(`${utxo.txid}:${utxo.vout}`)) as Utxo;
  expect(victim, 'an untouched side entry').toBeDefined();

  /** The compose with the victim at the unused lane, recreated with `commitment`, and the row declaring it. */
  const declared = async (commitment: string): Promise<TransactionBuilder> => {
    const builder = await compose();
    const at = masterOf(builder) + lane!;
    const input: UnlockableUtxo = {
      ...victim,
      unlocker: {
        generateLockingBytecode: () => lock,
        generateUnlockingBytecode: () => Uint8Array.from([
          ...encodeDataPush(encodeIntegerValue(BigInt(masterOf(builder)))),
          ...encodeDataPush(encodeIntegerValue(1n)),
          ...encodeDataPush(redeem),
        ]),
      },
    };
    builder.inputs[at] = input;
    builder.outputs[at] = {
      to: lock, amount: victim.satoshis,
      token: { ...victim.token!, nft: { capability: 'mutable', commitment } },
    };
    const current = decodeAtomicMessageEnvelope(carriedEnvelope(builder).envelope);
    const row: AtomicRow = {
      kind: 1, owner: busParticipant, consumer: busParticipant, slot: lane!, mode: 0,
      sourceOffset: lane!, targetOffset: lane!, selectorHex: '00000000', position: lane!,
      parent: 0xffff, depth: 0, subtreeEnd: lane!, subjectHex: binToHex(lock),
      // In the VM's byte order, as compose-semantic-effects writes a resource row's category.
      argsHex: `${binToHex(hexToBin(categoryId).reverse())}01`,
      resultHex: victim.token!.nft!.commitment, effectHex: commitment,
    };
    const target = (candidate: AtomicRow): number => baseOf(candidate.consumer) + candidate.targetOffset;
    const rows = [...current.rows];
    let position = rows.findIndex((candidate) => candidate.kind === 1 && target(candidate) > target(row));
    if (position < 0) {
      position = rows.reduce((last, candidate, index) => (candidate.kind <= 1 ? index : last), -1) + 1;
    }
    rows.splice(position, 0, row);
    rebindEnvelope(builder, { ...current, rows });
    return builder;
  };
  const original = victim.token!.nft!.commitment;
  const forged = original.slice(0, -2) + (parseInt(original.slice(-2), 16) ^ 1).toString(16).padStart(2, '0');
  const control = failures(await declared(original));
  const attack = failures(await declared(forged));
  console.log('compose untouched record', { graph, lane, control, attack });
  return { provider, honest: { builder: honest, failures: honestFailures }, control, attack, lane: lane! };
}

describe('compose path: a resource row may rewrite a record no row touched', () => {
  let state: ComposeScenario;
  beforeAll(async () => { state = await composeScenario(false); }, 300_000);

  it('settles the honest compose, and the control that declares an untouched entry unchanged', async () => {
    expect(state.honest.failures, 'honest compose').toEqual([]);
    expect(state.control, 'control: the entry recreated unchanged under its row').toEqual([]);
    await expect(state.provider.sendRawTransaction(state.honest.builder.build())).resolves.toMatch(TXID);
  }, 300_000);

  // No row of this compose claims the lane, so the route pins the entry there whatever the verifier's row declares.
  it('refuses an untouched entry rewritten under a declared resource row', () => {
    expect(state.attack).not.toEqual([]);
  });
});

describe('compose path on a graph route: a resource row may rewrite a record no row touched', () => {
  let state: ComposeScenario;
  beforeAll(async () => { state = await composeScenario(true); }, 300_000);

  it('settles the honest compose, and the control that declares an untouched entry unchanged', async () => {
    expect(state.honest.failures, 'honest compose').toEqual([]);
    expect(state.control, 'control: the entry recreated unchanged under its row').toEqual([]);
    await expect(state.provider.sendRawTransaction(state.honest.builder.build())).resolves.toMatch(TXID);
  }, 300_000);

  // Fails today: a graph route takes no claims and its pin skips its whole verifier-proven block, while the verifier
  // holds the entry only to the declared row. Turns red once a graph route keeps its row claims.
  it.fails('refuses an untouched entry rewritten under a declared resource row', () => {
    expect(state.attack).not.toEqual([]);
  });
});
