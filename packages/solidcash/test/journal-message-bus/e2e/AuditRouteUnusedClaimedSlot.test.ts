/**
 * A record at a claimed but unused slot of a bound message-bus route that runs without its verifier
 * (docs/security/security-audit-2026-10-16.md, "Fix pass 2026-10-22", Open: "Routes without a verifier").
 *
 * A standalone batch runs the route with `__internal__activeVerifierIndex` -1. Its C3 pin holds each own-category
 * mutable input of the participant block at its own index, except at the offsets a row that ran claims
 * (emitRouteBlockClaims). A row checks only the records it uses, the census leaves a handler-managed collection to
 * its handlers, and a handler's sorted write counts at most the outputs at its collection's address. The claims were
 * once whole groups, so a claimed offset no row used held a record nothing checked:
 *
 * - Trailing band: beside a `setNote` batch (it writes dynamic state), an entry of `side`, which only `put` names,
 *   was rewritten or burnt at a trailing slot the batch leaves as a pad. A dynamic-state writer now claims only the
 *   chunk locks of the state the route writes there. Beside a `put` batch, which claims no band, the pin refuses it.
 * - Collection lane: `compare` reads `side` at two keys, so the route holds a second handler-managed `side` lane.
 *   Beside a `check` batch an entry was rewritten in that lane, beside a `put` batch rewritten or burnt. A read now
 *   claims nothing, and a writer claims only its own handler's lanes.
 * - Inputless mint (no input, so no pin applies): beside a `setNote` or `check` batch, or an honest update, insert or
 *   delete, a second `side` node was minted at the collection's lock. Its outputs now equal its inputs plus the
 *   inserts the run made, counted from the predecessors relinked in place. `MintBook` adds a second `side` lane, so
 *   `put` keeps no output count of its own and that bound alone refuses the mint.
 *
 * - A row with a loop or a delete claims, in the trailing band, only its collections' entry locks: beside a `drop`
 *   batch, an entry of `other`, which `drop` does not touch, rewritten at an unused trailing slot is refused.
 * - A row that writes no record claims none: beside a kernel-safe native assembly row or an unsafe(2) row, a `side`
 *   entry rewritten at the block's pad is refused (both once claimed the whole block). A handler whose free function
 *   holds assembly that is not kernel-safe is no longer admitted (it was, and claimed the whole block); it runs as
 *   a direct call.
 * - A row touching a sorted collection with a chunkable value admits, in the trailing band, only the value-chunk locks
 *   its run pinned or spent: beside a long `notes` write over a long note, a `side` entry rewritten at an unused
 *   trailing slot is refused (it once claimed the whole band), and the honest write, which spends the old note's
 *   chunks, settles.
 *
 * Each attack row asserts the route's refusal; the entry covenant alone accepts every one of these spends.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { binToHex, encodeDataPush, encodeLockingBytecodeP2sh32, hash256, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import {
  buildEntryNftCovenantScript, computeCollectionHash, encodeIntegerValue, scriptToBytecode,
} from '@solidcash/utils';
import { Contract, type TransactionBuilder } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import {
  addressToLockScript, generateLibauthSourceOutputs, solidCashOutputToLibauthOutput,
} from '../../../src/utils.js';
import {
  directConventionMasterLock, getEntryNftAddress, resolveCollectionSignature,
} from '../../../src/stateful/covenant-helpers.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const BAND = `contract BandNote() {
  bytes note;
  mapping(int => int) public side;
  function setNote(bytes value) public { this.note = value; require(true); }
  function put(int key, int value) public { this.side[key] = value; require(true); }
}`;

const LANE = `contract LaneBook() {
  mapping(int => int) public side;
  function put(int key, int value) public { this.side[key] = value; require(true); }
  function check(int key, int expected) public { require(this.side[key] == expected); }
  function compare(int a, int b) public { require(this.side[a] == this.side[b]); }
}`;

const MINT = `contract MintBook() {
  mapping(int => int) public side;
  function put(int key, int value) public { this.side[key] = value; require(true); }
  function compare(int a, int b) public { require(this.side[a] == this.side[b]); }
  function drop(int key) public { delete this.side[key]; require(true); }
}`;

const PAIR = `contract PairBook() {
  mapping(int => int) public side;
  function put(int key, int value) public { this.side[key] = value; require(true); }
  function putPair(int a, int va, int b, int vb) public { this.side[a] = va; this.side[b] = vb; require(true); }
}`;

const DROP = `contract DropBook() {
  bytes note;
  mapping(int => int) public side;
  mapping(int => int) public other;
  function setNote(bytes value) public { this.note = value; require(true); }
  function put(int key, int value) public { this.side[key] = value; require(true); }
  function putOther(int key, int value) public { this.other[key] = value; require(true); }
  function drop(int key) public { delete this.side[key]; require(true); }
}`;

const QUIET = `contract QuietBook() {
  mapping(int => int) public side;
  function put(int key, int value) public { this.side[key] = value; require(true); }
  function probe(int x) public { assembly { OP_1 OP_VERIFY } require(x >= 0); }
  function idle(int x) unsafe(2) { require(x >= 0); }
}`;

// A free function's body runs in the row; its assembly borrows a value it did not push.
const STIR = `function stir() { assembly { OP_DUP OP_DROP } }
contract StirBook() {
  mapping(int => int) public side;
  function put(int key, int value) public { this.side[key] = value; require(true); }
  function churn(int x) public { stir(); require(x >= 0); }
}`;

// A sorted mapping with a chunkable value beside the victim's mapping.
const NOTES = `contract NoteBook() {
  mapping(int => bytes) public notes;
  mapping(int => int) public side;
  function write(int key, bytes value) public { this.notes[key] = value; require(true); }
  function put(int key, int value) public { this.side[key] = value; require(true); }
}`;

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true,
  maximumInputBytes: 1_000_000, suppressWarnings: true,
} as const;

type Artifact = ReturnType<typeof compileString>;
type Provider = ReturnType<typeof createMessageBusCapstoneTestProvider>;
type LibauthTransaction = ReturnType<TransactionBuilder['buildLibauthTransaction']>;
type LibauthOutput = LibauthTransaction['outputs'][number];
type Vm = ReturnType<typeof createVirtualMachineBch2026ForProvider>;
type Verdict = true | string;

interface Spend {
  readonly transaction: LibauthTransaction;
  readonly sourceOutputs: LibauthOutput[];
}

interface Victim {
  readonly txid: string;
  readonly vout: number;
  readonly source: LibauthOutput;
  readonly redeem: Uint8Array;
}

const OTHER_LOCK = Uint8Array.of(0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x66), 0x88, 0xac);
const TXID = /^[0-9a-f]{64}$/;

function spendOf(builder: TransactionBuilder): Spend {
  return {
    transaction: builder.buildLibauthTransaction(),
    sourceOutputs: generateLibauthSourceOutputs(builder.inputs),
  };
}

function verdict(vm: Vm, spend: Spend, inputIndex: number): Verdict {
  const state = vm.evaluate({ inputIndex, transaction: spend.transaction, sourceOutputs: spend.sourceOutputs });
  const result = vm.stateSuccess(state);
  return result === true ? true : `${result} (ip ${state.ip})`;
}

function failures(vm: Vm, spend: Spend): Array<{ inputIndex: number; error: string }> {
  return spend.transaction.inputs.flatMap((_input, inputIndex) => {
    const result = verdict(vm, spend, inputIndex);
    return result === true ? [] : [{ inputIndex, error: result }];
  });
}

function eligibleOf(artifact: Artifact): Set<string> {
  return new Set(artifact.messageBus?.handlers.filter((handler) => handler.eligible).map((handler) => handler.name));
}

async function connect(
  provider: Provider, artifact: Artifact, initialState: Record<string, unknown>,
): Promise<{ bus: StatefulContract; categoryId: string }> {
  const base = new Contract(artifact, [], { provider });
  const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, initialState, { saltContract: true });
  return {
    bus: StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId),
    categoryId: setup.categoryId,
  };
}

/** A live entry of `collection` that `honest` does not spend, with the redeem of its entry covenant. */
async function victimOf(
  provider: Provider, artifact: Artifact, bus: StatefulContract, categoryId: string, honest: Spend,
  collection = 'side',
): Promise<Victim> {
  const spent = new Set(honest.transaction.inputs.map((input) =>
    `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`));
  const redeem = scriptToBytecode(buildEntryNftCovenantScript(
    hexToBin(categoryId), computeCollectionHash(resolveCollectionSignature(artifact, collection)),
    directConventionMasterLock(bus.inner),
  ));
  const address = getEntryNftAddress(bus.inner, categoryId, collection);
  const lock = addressToLockScript(address);
  expect(binToHex(encodeLockingBytecodeP2sh32(hash256(redeem)))).toBe(binToHex(lock));
  const entry = (await provider.getUtxos(address)).find((utxo) => utxo.token?.nft?.capability === 'mutable'
    && !spent.has(`${utxo.txid}:${utxo.vout}`));
  expect(entry, `an unspent ${collection} entry`).toBeDefined();
  return {
    txid: entry!.txid, vout: entry!.vout, redeem,
    source: solidCashOutputToLibauthOutput({ to: lock, amount: entry!.satoshis, token: entry!.token }),
  };
}

function masterOf(honest: Spend, victim: Victim): number {
  const master = honest.sourceOutputs.findIndex((output) => output.token?.nft?.capability === 'minting'
    && binToHex(output.token.category) === binToHex(victim.source.token!.category));
  expect(master).toBeGreaterThanOrEqual(0);
  return master;
}

/** The victim's input, spent through the entry write flag, which only asks for the master. */
function victimInput(victim: Victim, master: number): LibauthTransaction['inputs'][number] {
  return {
    outpointIndex: victim.vout, outpointTransactionHash: hexToBin(victim.txid), sequenceNumber: 0xffffffff,
    unlockingBytecode: Uint8Array.from([
      ...encodeDataPush(encodeIntegerValue(BigInt(master))),
      ...encodeDataPush(encodeIntegerValue(1n)),
      ...encodeDataPush(victim.redeem),
    ]),
  };
}

/**
 * The highest index in `[start, end)` that `honest` leaves to a pad: no token in its input (or no input there yet)
 * and none in its output (or no output there yet).
 */
function padIndex(honest: Spend, start: number, end: number): number | undefined {
  const { inputs, outputs } = honest.transaction;
  for (let at = Math.min(end, Math.max(start, inputs.length) + 1) - 1; at >= start; at -= 1) {
    if (at < inputs.length && honest.sourceOutputs[at]!.token !== undefined) continue;
    if (at < outputs.length && outputs[at]!.token !== undefined) continue;
    return at;
  }
  return undefined;
}

/** The victim spent at `at`, in place of the pad there or appended, and `output` at the same index. */
function placed(honest: Spend, victim: Victim, master: number, at: number, output: LibauthOutput): Spend {
  const inputs = [...honest.transaction.inputs];
  const sourceOutputs = [...honest.sourceOutputs];
  const outputs = [...honest.transaction.outputs];
  // The spender's own token-less coins stand for the pads of a spend that ends before `at`.
  while (inputs.length < at) {
    inputs.push({
      outpointIndex: inputs.length, outpointTransactionHash: new Uint8Array(32).fill(0xfe),
      sequenceNumber: 0xffffffff, unlockingBytecode: Uint8Array.of(),
    });
    sourceOutputs.push({ lockingBytecode: OTHER_LOCK, valueSatoshis: 1_000n });
  }
  const replaces = at < inputs.length ? 1 : 0;
  inputs.splice(at, replaces, victimInput(victim, master));
  sourceOutputs.splice(at, replaces, victim.source);
  while (outputs.length < at) outputs.push({ lockingBytecode: OTHER_LOCK, valueSatoshis: 1_000n });
  outputs.splice(at, at < outputs.length ? 1 : 0, output);
  return { sourceOutputs, transaction: { ...honest.transaction, inputs, outputs } };
}

/** The victim's node at its own lock with its last commitment byte flipped. */
function rewritten(victim: Victim): LibauthOutput {
  const forged = Uint8Array.from(victim.source.token!.nft!.commitment);
  forged[forged.length - 1] ^= 1;
  return { ...victim.source, token: { ...victim.source.token!, nft: { capability: 'mutable', commitment: forged } } };
}

/** The victim's satoshis at another lock, its NFT burnt. */
function burnt(victim: Victim): LibauthOutput {
  return { lockingBytecode: OTHER_LOCK, valueSatoshis: victim.source.valueSatoshis };
}

describe('bound route without its verifier: a trailing slot the band claim covers and no row uses', () => {
  let state: {
    provider: Provider;
    bus: StatefulContract;
    trailingBase: number;
    blockSize: number;
    honest: { note: ReturnType<typeof failures>; put: ReturnType<typeof failures> };
    offsets: { note: number; put: number };
    covenant: { rewrite: Verdict; burn: Verdict };
    route: { rewrite: Verdict; burn: Verdict; mint: Verdict; putRewrite: Verdict };
  };

  beforeAll(async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(BAND, { ...KERNEL, messageBusHandlers: ['setNote', 'put'] });
    expect(eligibleOf(artifact)).toEqual(new Set(['setNote', 'put']));
    expect(artifact.messageBus?.route.inputs.some((input) => input.name === '__internal__activeVerifierIndex'))
      .toBe(true);
    const layout = artifact.messageBus!.route.blockLayout!;
    expect(layout.trailingBase, 'the route has a trailing band').toBeDefined();
    const trailingBase = layout.trailingBase!;
    const { bus, categoryId } = await connect(provider, artifact, { note: new Uint8Array() });
    await bus.call.put(5n, 7n).send();
    await bus.call.put(9n, 1n).send();
    const vm = createVirtualMachineBch2026ForProvider(provider);

    const noteCall = bus.batch([{ function: 'setNote', args: [Uint8Array.of(1, 2, 3)] }]);
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    noteCall.addInput(fee.utxo, fee.unlocker);
    const note = spendOf(await noteCall.build());
    const put = spendOf(await bus.batch([{ function: 'put', args: [5n, 8n] }]).build());
    // The `put` batch spends side[5], so the victim is side[9], which neither batch spends.
    const victim = await victimOf(provider, artifact, bus, categoryId, put);
    const noteMaster = masterOf(note, victim);
    const putMaster = masterOf(put, victim);
    const noteAt = padIndex(note, noteMaster + trailingBase, noteMaster + layout.blockSize);
    const putAt = padIndex(put, putMaster + trailingBase, putMaster + layout.blockSize);
    expect(noteAt, 'the setNote batch leaves a trailing pad').toBeDefined();
    expect(putAt, 'the put batch leaves a trailing pad').toBeDefined();

    const rewrite = placed(note, victim, noteMaster, noteAt!, rewritten(victim));
    const burn = placed(note, victim, noteMaster, noteAt!, burnt(victim));
    const putRewrite = placed(put, victim, putMaster, putAt!, rewritten(victim));
    // A second node for side[9] with another value, minted from the master's category with no input.
    const mint: Spend = {
      sourceOutputs: note.sourceOutputs,
      transaction: { ...note.transaction, outputs: [...note.transaction.outputs, rewritten(victim)] },
    };
    state = {
      provider, bus, trailingBase, blockSize: layout.blockSize,
      honest: { note: failures(vm, note), put: failures(vm, put) },
      offsets: { note: noteAt! - noteMaster, put: putAt! - putMaster },
      covenant: { rewrite: verdict(vm, rewrite, noteAt!), burn: verdict(vm, burn, noteAt!) },
      route: {
        rewrite: verdict(vm, rewrite, noteMaster), burn: verdict(vm, burn, noteMaster),
        mint: verdict(vm, mint, noteMaster), putRewrite: verdict(vm, putRewrite, putMaster),
      },
    };
    console.log('trailing band', {
      trailingBase, blockSize: layout.blockSize, offsets: state.offsets, covenant: state.covenant, route: state.route,
    });
  }, 300_000);

  it('settles honest setNote and put batches, and the entry covenant accepts the victim spends', async () => {
    expect(state.honest.note, 'honest setNote batch').toEqual([]);
    expect(state.honest.put, 'honest put batch').toEqual([]);
    for (const offset of [state.offsets.note, state.offsets.put]) {
      expect(offset).toBeGreaterThanOrEqual(state.trailingBase);
      expect(offset).toBeLessThan(state.blockSize);
    }
    expect(state.covenant.rewrite, 'the entry write flag accepts the rewrite').toBe(true);
    expect(state.covenant.burn, 'the entry write flag accepts the burn').toBe(true);
    const noteCall = state.bus.batch([{ function: 'setNote', args: [Uint8Array.of(4, 5)] }]);
    const fee = await createBareP2pkhFeeFunder(state.provider, 500_000n);
    noteCall.addInput(fee.utxo, fee.unlocker);
    await expect(noteCall.send()).resolves.toMatchObject({ txid: expect.stringMatching(TXID) });
    await expect(state.bus.batch([{ function: 'put', args: [5n, 8n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(TXID) });
  }, 300_000);

  it('pins the trailing slot beside a put batch, which claims no trailing record', () => {
    expect(state.route.putRewrite).not.toBe(true);
  });

  // setNote claims only the chunk locks of the dynamic state the route writes; a side entry's lock is not one.
  it('refuses a side entry rewritten at an unused trailing slot beside a setNote batch', () => {
    expect(state.route.rewrite).not.toBe(true);
  });

  it('refuses a side entry burnt at an unused trailing slot beside a setNote batch', () => {
    expect(state.route.burn).not.toBe(true);
  });

  // No input, so no pin: the mint bound refuses an output at side's address beyond its inputs, as setNote inserts none.
  it('refuses a side node minted with no input beside a setNote batch', () => {
    expect(state.route.mint).not.toBe(true);
  });
});

describe('bound route without its verifier: a collection lane the collection claim covers and no row uses', () => {
  let state: {
    provider: Provider;
    bus: StatefulContract;
    honest: { check: ReturnType<typeof failures>; put: ReturnType<typeof failures> };
    covenant: { checkRewrite: Verdict; putBurn: Verdict };
    route: { checkRewrite: Verdict; checkMint: Verdict; putBurn: Verdict; putRewrite: Verdict };
  };

  beforeAll(async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(LANE, { ...KERNEL, messageBusHandlers: ['put', 'check', 'compare'] });
    expect(eligibleOf(artifact)).toEqual(new Set(['put', 'check', 'compare']));
    const route = artifact.messageBus!.route;
    const sideSlots = new Set((route.entryAccesses ?? []).flatMap((access, index) =>
      (access.collection === 'side' ? [access.slotIndex ?? index] : [])));
    const managed = new Set(artifact.messageBus!.handlers.filter((handler) => handler.eligible)
      .flatMap((handler) => handler.physicalEntrySlots ?? []));
    const lanes = route.blockLayout!.slots.filter((slot) => slot.kind === 'entry' && slot.slotIndex !== undefined
      && sideSlots.has(slot.slotIndex) && managed.has(slot.slotIndex)).map((slot) => slot.offset);
    expect(lanes.length, 'two handler-managed side lanes').toBeGreaterThanOrEqual(2);
    const { bus, categoryId } = await connect(provider, artifact, {});
    await bus.call.put(5n, 7n).send();
    await bus.call.put(9n, 1n).send();
    const vm = createVirtualMachineBch2026ForProvider(provider);

    const check = spendOf(await bus.batch([{ function: 'check', args: [5n, 7n] }]).build());
    const put = spendOf(await bus.batch([{ function: 'put', args: [5n, 8n] }]).build());
    // Both batches spend side[5] in the first lane, so the victim is side[9].
    const victim = await victimOf(provider, artifact, bus, categoryId, put);
    const freeLane = (spend: Spend, master: number): number | undefined => lanes.map((offset) => master + offset)
      .find((at) => padIndex(spend, at, at + 1) === at);
    const checkMaster = masterOf(check, victim);
    const putMaster = masterOf(put, victim);
    const checkAt = freeLane(check, checkMaster);
    const putAt = freeLane(put, putMaster);
    expect(checkAt, 'the check batch leaves a side lane to a pad').toBeDefined();
    expect(putAt, 'the put batch leaves a side lane to a pad').toBeDefined();

    const checkRewrite = placed(check, victim, checkMaster, checkAt!, rewritten(victim));
    const putBurn = placed(put, victim, putMaster, putAt!, burnt(victim));
    const putRewrite = placed(put, victim, putMaster, putAt!, rewritten(victim));
    // A second node for side[9] with another value, minted beside a row that only reads side.
    const checkMint: Spend = {
      sourceOutputs: check.sourceOutputs,
      transaction: { ...check.transaction, outputs: [...check.transaction.outputs, rewritten(victim)] },
    };
    state = {
      provider, bus,
      honest: { check: failures(vm, check), put: failures(vm, put) },
      covenant: { checkRewrite: verdict(vm, checkRewrite, checkAt!), putBurn: verdict(vm, putBurn, putAt!) },
      route: {
        checkRewrite: verdict(vm, checkRewrite, checkMaster), checkMint: verdict(vm, checkMint, checkMaster),
        putBurn: verdict(vm, putBurn, putMaster), putRewrite: verdict(vm, putRewrite, putMaster),
      },
    };
    console.log('collection lane', {
      lanes, check: checkAt! - checkMaster, put: putAt! - putMaster, covenant: state.covenant, route: state.route,
    });
  }, 300_000);

  it('settles honest check and put batches, and the entry covenant accepts the victim spends', async () => {
    expect(state.honest.check, 'honest check batch').toEqual([]);
    expect(state.honest.put, 'honest put batch').toEqual([]);
    expect(state.covenant.checkRewrite, 'the entry write flag accepts the rewrite').toBe(true);
    expect(state.covenant.putBurn, 'the entry write flag accepts the burn').toBe(true);
    await expect(state.bus.batch([{ function: 'check', args: [5n, 7n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(TXID) });
    await expect(state.bus.batch([{ function: 'put', args: [5n, 8n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(TXID) });
  }, 300_000);

  // A read claims no lane, so the unused lane is pinned beside a check row.
  it('refuses a side entry rewritten in the unused lane beside a check batch', () => {
    expect(state.route.checkRewrite).not.toBe(true);
  });

  // put claims only its own lane; the other handler's lane stays pinned.
  it('refuses a side entry rewritten in the unused lane beside a put batch', () => {
    expect(state.route.putRewrite).not.toBe(true);
  });

  it('refuses a side entry burnt in the unused lane beside a put batch', () => {
    expect(state.route.putBurn).not.toBe(true);
  });

  // check inserts nothing, so side's address takes no output beyond its inputs.
  it('refuses a side node minted with no input beside a check batch', () => {
    expect(state.route.checkMint).not.toBe(true);
  });
});

describe('bound route without its verifier: an inputless mint beside an honest update, insert and delete', () => {
  const rows = {
    update: { function: 'put', args: [5n, 8n] },
    insert: { function: 'put', args: [11n, 4n] },
    drop: { function: 'drop', args: [9n] },
  } as const;
  let state: {
    bus: StatefulContract;
    honest: Record<keyof typeof rows, ReturnType<typeof failures>>;
    route: Record<keyof typeof rows, Verdict>;
  };

  beforeAll(async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(MINT, { ...KERNEL, messageBusHandlers: ['put', 'compare', 'drop'] });
    expect(eligibleOf(artifact)).toEqual(new Set(['put', 'compare', 'drop']));
    const { bus, categoryId } = await connect(provider, artifact, {});
    await bus.call.put(5n, 7n).send();
    await bus.call.put(9n, 1n).send();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const spends = {
      update: spendOf(await bus.batch([{ ...rows.update, args: [...rows.update.args] }]).build()),
      insert: spendOf(await bus.batch([{ ...rows.insert, args: [...rows.insert.args] }]).build()),
      drop: spendOf(await bus.batch([{ ...rows.drop, args: [...rows.drop.args] }]).build()),
    };
    // The forged node: side[9]'s, its last commitment byte flipped, appended with no input.
    const victim = await victimOf(provider, artifact, bus, categoryId, spends.update);
    const minted = (honest: Spend): Spend => ({
      sourceOutputs: honest.sourceOutputs,
      transaction: { ...honest.transaction, outputs: [...honest.transaction.outputs, rewritten(victim)] },
    });
    const keys = Object.keys(rows) as Array<keyof typeof rows>;
    state = {
      bus,
      honest: Object.fromEntries(keys.map((key) => [key, failures(vm, spends[key])])) as typeof state.honest,
      route: Object.fromEntries(keys.map((key) => [key,
        verdict(vm, minted(spends[key]), masterOf(spends[key], victim))])) as typeof state.route,
    };
    console.log('inputless mint', state.route);
  }, 300_000);

  it('settles an honest update, insert and delete, and sends each', async () => {
    expect(state.honest, 'honest batches').toEqual({ update: [], insert: [], drop: [] });
    for (const row of Object.values(rows)) {
      await expect(state.bus.batch([{ ...row, args: [...row.args] }]).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(TXID) });
    }
  }, 300_000);

  // An update relinks nothing, so it grants no node.
  it('refuses a side node minted with no input beside an honest update', () => {
    expect(state.route.update).not.toBe(true);
  });

  // The insert relinks one predecessor for its one new node; the forged node is a second.
  it('refuses a side node minted with no input beside an honest insert', () => {
    expect(state.route.insert).not.toBe(true);
  });

  // A delete writes the default and removes no node.
  it('refuses a side node minted with no input beside a delete', () => {
    expect(state.route.drop).not.toBe(true);
  });
});

describe('bound route without its verifier: an honest batch inserting two keys into one gap', () => {
  let state: { bus: StatefulContract; spend: Spend; failures: ReturnType<typeof failures> };

  beforeAll(async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(PAIR, { ...KERNEL, messageBusHandlers: ['put', 'putPair'] });
    expect(eligibleOf(artifact)).toEqual(new Set(['put', 'putPair']));
    const { bus } = await connect(provider, artifact, {});
    await bus.call.put(5n, 7n).send();
    await bus.call.put(9n, 1n).send();
    // 11 and 12 both fall after 9, so one node is relinked for two new nodes.
    const spend = spendOf(await bus.batch([{ function: 'putPair', args: [11n, 4n, 12n, 3n] }]).build());
    state = { bus, spend, failures: failures(createVirtualMachineBch2026ForProvider(provider), spend) };
    // The require each failure stopped at, by its instruction pointer.
    const requires = artifact.debug?.requires ?? [];
    console.log('two inserts into one gap', state.failures.map((failure) => {
      const ip = Number(/\(ip (\d+)\)/.exec(failure.error)?.[1]);
      return { ...failure, require: requires.find((entry) => entry.ip === ip || entry.ip === ip - 1)?.message };
    }));
  }, 300_000);

  // Two new nodes after one spent node: the route's node count must still admit the honest batch.
  it('settles the batch', () => {
    expect(state.failures).toEqual([]);
  });
});

describe('bound route without its verifier: a trailing slot beside a delete, which claims only its collection', () => {
  let state: {
    bus: StatefulContract;
    honest: ReturnType<typeof failures>;
    covenant: Verdict;
    route: Verdict;
  };

  beforeAll(async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(DROP, { ...KERNEL, messageBusHandlers: ['setNote', 'put', 'putOther', 'drop'] });
    expect(eligibleOf(artifact)).toEqual(new Set(['setNote', 'put', 'putOther', 'drop']));
    const layout = artifact.messageBus!.route.blockLayout!;
    expect(layout.trailingBase, 'the route has a trailing band').toBeDefined();
    const { bus, categoryId } = await connect(provider, artifact, { note: new Uint8Array() });
    await bus.call.put(5n, 7n).send();
    await bus.call.put(9n, 1n).send();
    await bus.call.putOther(3n, 4n).send();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const drop = spendOf(await bus.batch([{ function: 'drop', args: [9n] }]).build());
    // other[3]: `drop` touches only `side`.
    const victim = await victimOf(provider, artifact, bus, categoryId, drop, 'other');
    const master = masterOf(drop, victim);
    const at = padIndex(drop, master + layout.trailingBase!, master + layout.blockSize);
    expect(at, 'the drop batch leaves a trailing pad').toBeDefined();
    const rewrite = placed(drop, victim, master, at!, rewritten(victim));
    state = {
      bus, honest: failures(vm, drop), covenant: verdict(vm, rewrite, at!), route: verdict(vm, rewrite, master),
    };
    console.log('trailing band beside a delete', { offset: at! - master, covenant: state.covenant, route: state.route });
  }, 300_000);

  it('settles an honest drop batch, and the entry covenant accepts the victim spend', async () => {
    expect(state.honest).toEqual([]);
    expect(state.covenant, 'the entry write flag accepts the rewrite').toBe(true);
    await expect(state.bus.batch([{ function: 'drop', args: [9n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(TXID) });
  }, 300_000);

  // The delete claims, in the band, only side's entry lock; other's lock is not one, so the pin holds the entry.
  it('refuses an other entry rewritten at an unused trailing slot beside a drop batch', () => {
    expect(state.route).not.toBe(true);
  });
});


describe('bound route without its verifier: a block slot beside a row that writes no record', () => {
  let state: {
    bus: StatefulContract;
    honest: { probe: ReturnType<typeof failures>; idle: ReturnType<typeof failures> };
    covenant: Verdict;
    route: { probe: Verdict; idle: Verdict };
  };

  beforeAll(async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(QUIET, { ...KERNEL, messageBusHandlers: ['put', 'probe', 'idle'] });
    expect(eligibleOf(artifact)).toEqual(new Set(['put', 'probe', 'idle']));
    const layout = artifact.messageBus!.route.blockLayout!;
    const { bus, categoryId } = await connect(provider, artifact, {});
    await bus.call.put(5n, 7n).send();
    await bus.call.put(9n, 1n).send();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const probe = spendOf(await bus.batch([{ function: 'probe', args: [1n] }]).build());
    const idle = spendOf(await bus.batch([{ function: 'idle', args: [1n] }]).build());
    const victim = await victimOf(provider, artifact, bus, categoryId, probe);
    // The victim rewritten at the highest pad of the batch's compile-time block.
    const attack = (honest: Spend): { at: number; master: number; spend: Spend } => {
      const master = masterOf(honest, victim);
      const at = padIndex(honest, master + 1, master + layout.blockSize);
      expect(at, 'the batch leaves a pad in its block').toBeDefined();
      return { at: at!, master, spend: placed(honest, victim, master, at!, rewritten(victim)) };
    };
    const onProbe = attack(probe);
    const onIdle = attack(idle);
    state = {
      bus,
      honest: { probe: failures(vm, probe), idle: failures(vm, idle) },
      covenant: verdict(vm, onProbe.spend, onProbe.at),
      route: { probe: verdict(vm, onProbe.spend, onProbe.master), idle: verdict(vm, onIdle.spend, onIdle.master) },
    };
    console.log('block slot beside a row that writes no record', {
      blockSize: layout.blockSize, offsets: { probe: onProbe.at - onProbe.master, idle: onIdle.at - onIdle.master },
      covenant: state.covenant, route: state.route,
    });
  }, 300_000);

  it('settles honest probe and idle batches, and the entry covenant accepts the victim spend', async () => {
    expect(state.honest.probe, 'honest probe batch').toEqual([]);
    expect(state.honest.idle, 'honest idle batch').toEqual([]);
    expect(state.covenant, 'the entry write flag accepts the rewrite').toBe(true);
    await expect(state.bus.batch([{ function: 'probe', args: [2n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(TXID) });
    await expect(state.bus.batch([{ function: 'idle', args: [2n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(TXID) });
  }, 300_000);

  // Kernel-safe native assembly is a closed computation (NativeAssemblyKernelSafety): the row claims nothing.
  it('refuses a side entry rewritten in the block beside a native assembly row', () => {
    expect(state.route.probe).not.toBe(true);
  });

  // unsafe(2) writes no state, entry, container, transfer or event (SymbolTableTraversal): the row claims nothing.
  it('refuses a side entry rewritten in the block beside an unsafe(2) row', () => {
    expect(state.route.idle).not.toBe(true);
  });
});


describe('a handler whose free function holds opaque assembly', () => {
  // Its writes are unbounded, so it is not admitted by name; its row would have claimed the whole block.
  it('is refused admission and runs as a direct call', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(STIR, { ...KERNEL, messageBusHandlers: ['put', 'churn'] });
    expect(eligibleOf(artifact)).toEqual(new Set(['put']));
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'churn'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_OPAQUE_EFFECT' });
    const { bus } = await connect(provider, artifact, {});
    await expect(bus.call.churn(1n).send()).resolves.toMatchObject({ txid: expect.stringMatching(TXID) });
  }, 300_000);
});


describe('bound route without its verifier: a trailing slot beside a chunkable mapping write', () => {
  let state: { bus: StatefulContract; honest: ReturnType<typeof failures>; covenant: Verdict; route: Verdict };

  beforeAll(async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(NOTES, { ...KERNEL, messageBusHandlers: ['write', 'put'] });
    expect(eligibleOf(artifact)).toEqual(new Set(['write', 'put']));
    const layout = artifact.messageBus!.route.blockLayout!;
    expect(layout.trailingBase, 'the route has a trailing band').toBeDefined();
    const { bus, categoryId } = await connect(provider, artifact, {});
    await bus.call.put(5n, 7n).send();
    await bus.call.put(9n, 1n).send();
    await bus.call.write(3n, new Uint8Array(90).fill(0x61)).send();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    // A long value over a long value: the old value's chunks are spent, the new one's created.
    const write = spendOf(await bus.batch([{ function: 'write', args: [3n, new Uint8Array(95).fill(0x62)] }]).build());
    const victim = await victimOf(provider, artifact, bus, categoryId, write);
    const master = masterOf(write, victim);
    const at = padIndex(write, master + layout.trailingBase!, master + layout.blockSize);
    expect(at, 'the write batch leaves a trailing pad').toBeDefined();
    const rewrite = placed(write, victim, master, at!, rewritten(victim));
    state = {
      bus, honest: failures(vm, write), covenant: verdict(vm, rewrite, at!), route: verdict(vm, rewrite, master),
    };
    console.log('trailing band beside a chunkable mapping write', {
      offset: at! - master, covenant: state.covenant, route: state.route,
    });
  }, 300_000);

  it('settles an honest long write over a long value, and the entry covenant accepts the victim spend', async () => {
    expect(state.honest).toEqual([]);
    expect(state.covenant, 'the entry write flag accepts the rewrite').toBe(true);
    await expect(state.bus.batch([{ function: 'write', args: [3n, new Uint8Array(70).fill(0x63)] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(TXID) });
  }, 300_000);

  // The band admits only the value-chunk locks the run itself pinned or spent; a side entry's lock is not one.
  it('refuses a side entry rewritten at an unused trailing slot beside a write batch', () => {
    expect(state.route).not.toBe(true);
  });
});
