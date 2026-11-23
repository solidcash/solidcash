/**
 * A record at a claimed but unused slot of a bound message-bus route that runs without its verifier
 * (docs/security/security-audit-2026-10-16.md, "Fix pass 2026-10-22", Open: "Routes without a verifier").
 *
 * A standalone batch runs the route with `__internal__activeVerifierIndex` -1. Its C3 pin then holds each own-category
 * mutable input of the participant block at its own index, except at the offsets a row that ran claims
 * (emitRouteBlockClaims): the whole trailing band once a row that may use it ran, and every handler-managed entry slot
 * of a collection a row that ran names. A row checks only the records it uses, the census leaves a handler-managed
 * collection to its handlers, and a handler's sorted write counts at most the outputs at its collection's address. So
 * a claimed offset that no row uses holds a record that nothing checks:
 *
 * - Trailing band: beside a `setNote` batch (dynamic state claims the band), an entry of `side`, which only `put`
 *   names, is rewritten or burnt at a trailing slot the batch leaves as a pad. Beside a `put` batch, which claims no
 *   trailing record, the pin refuses the same placement.
 * - Collection lane: `compare` reads `side` at two keys, so the route holds a second handler-managed `side` lane,
 *   which a `check` or `put` row claims with the first. Beside a `check` batch an entry is rewritten in that lane;
 *   beside a `put` batch it is rewritten or burnt there: no count at `side`'s address runs in this route.
 *
 * Adjacent (no input, so no pin applies): beside a `setNote` batch a second `side` node is minted at the collection's
 * lock. The output scan admits any record lock the contract mints at, and nothing beside it counts `side`'s outputs.
 *
 * Each attack row is `it.fails`: today the entry covenant and the route accept the spend. It turns red once the route
 * holds a claimed slot no row used (and, for the mint, bounds the outputs at a collection's lock beside every row).
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

/** A live `side` entry that `honest` does not spend, with the redeem of its entry covenant. */
async function victimOf(
  provider: Provider, artifact: Artifact, bus: StatefulContract, categoryId: string, honest: Spend,
): Promise<Victim> {
  const spent = new Set(honest.transaction.inputs.map((input) =>
    `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`));
  const redeem = scriptToBytecode(buildEntryNftCovenantScript(
    hexToBin(categoryId), computeCollectionHash(resolveCollectionSignature(artifact, 'side')),
    directConventionMasterLock(bus.inner),
  ));
  const address = getEntryNftAddress(bus.inner, categoryId, 'side');
  const lock = addressToLockScript(address);
  expect(binToHex(encodeLockingBytecodeP2sh32(hash256(redeem)))).toBe(binToHex(lock));
  const entry = (await provider.getUtxos(address)).find((utxo) => utxo.token?.nft?.capability === 'mutable'
    && !spent.has(`${utxo.txid}:${utxo.vout}`));
  expect(entry, 'an unspent side entry').toBeDefined();
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

  // Fails today: setNote's flag claims the whole band, and nothing beside it counts `side` (handler-managed).
  it.fails('refuses a side entry rewritten at an unused trailing slot beside a setNote batch', () => {
    expect(state.route.rewrite).not.toBe(true);
  });

  // Fails today: as above; a burn adds no output, so not even a side writer's output count would see it.
  it.fails('refuses a side entry burnt at an unused trailing slot beside a setNote batch', () => {
    expect(state.route.burn).not.toBe(true);
  });

  // Fails today (adjacent): the minted node has no input to pin, and nothing beside setNote counts side's outputs.
  it.fails('refuses a side node minted with no input beside a setNote batch', () => {
    expect(state.route.mint).not.toBe(true);
  });
});

describe('bound route without its verifier: a collection lane the collection claim covers and no row uses', () => {
  let state: {
    provider: Provider;
    bus: StatefulContract;
    honest: { check: ReturnType<typeof failures>; put: ReturnType<typeof failures> };
    covenant: { checkRewrite: Verdict; putBurn: Verdict };
    route: { checkRewrite: Verdict; putBurn: Verdict; putRewrite: Verdict };
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
    state = {
      provider, bus,
      honest: { check: failures(vm, check), put: failures(vm, put) },
      covenant: { checkRewrite: verdict(vm, checkRewrite, checkAt!), putBurn: verdict(vm, putBurn, putAt!) },
      route: {
        checkRewrite: verdict(vm, checkRewrite, checkMaster), putBurn: verdict(vm, putBurn, putMaster),
        putRewrite: verdict(vm, putRewrite, putMaster),
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

  // Fails today: check's flag claims every side lane, and a read checks only its own lane and counts nothing.
  it.fails('refuses a side entry rewritten in the unused lane beside a check batch', () => {
    expect(state.route.checkRewrite).not.toBe(true);
  });

  // Fails today: put's flag claims every side lane, and no count at side's address runs beside it in this route.
  it.fails('refuses a side entry rewritten in the unused lane beside a put batch', () => {
    expect(state.route.putRewrite).not.toBe(true);
  });

  // Fails today: as above; a burn adds no output at side's address, so no output count could see it.
  it.fails('refuses a side entry burnt in the unused lane beside a put batch', () => {
    expect(state.route.putBurn).not.toBe(true);
  });
});
