/**
 * C3 on a census-path message-bus route (docs/security/SECURITY-AUDIT.md C3).
 *
 * The route admits `put`, which writes a mapping entry, so it settles through the direct collection census instead
 * of the own-category count. A standalone `batch` runs it with no verifier. The census leaves a collection an
 * admitted handler names to that handler, which settles only the rows it runs. Beside a batch that runs no `put`
 * row, an entry of that collection is co-spent through the entry covenant's write flag, which only asks for the
 * master: it is rewritten in place, or destroyed while its NFT reappears at its own lock at another index. The route
 * now pins every own-category mutable input outside its participant block at its own index, except the one at its
 * verifier index. Beside a `put` batch the handler's own address count refuses the same entry, and an entry of a
 * collection no admitted handler names is refused by the census count. An honest batch of each handler, and an
 * honest compose whose callee row runs `put` beside the bus verifier, settle.
 *
 * Inside the block, a pad no row that ran uses (the `side` entry slot beside a `tick` batch, a trailing slot beside a
 * `put` batch) took the same entry, rewritten or burnt. Without the verifier, which counts the block's records, the
 * route now pins an own-category record there too: the slots a row that ran claims, through the flag its selector
 * branch sets, and the route's own data band stay free. An honest insert, whose new node takes a trailing output
 * beside a pad input, settles.
 */
import { describe, expect, it } from 'vitest';
import { binToHex, encodeDataPush, encodeLockingBytecodeP2sh32, hash256, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import {
  buildEntryNftCovenantScript, computeCollectionHash, encodeIntegerValue, scriptToBytecode,
} from '@solidcash/utils';
import { Contract, type TransactionBuilder } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import * as messageBus from '../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import {
  addressToLockScript, generateLibauthSourceOutputs, solidCashOutputToLibauthOutput,
} from '../../src/utils.js';
import {
  directConventionMasterLock, getEntryNftAddress, getMessageBusVerifierLockingBytecode, resolveCollectionSignature,
} from '../../src/stateful/covenant-helpers.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../test-util.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

const BUS = `contract BusBook() {
  int public count;
  mapping(int => int) public side;
  mapping(int => int) public other;
  function tick() public { this.count = this.count + 1; require(true); }
  function put(int key, int value) public { this.side[key] = value; require(true); }
  function note(int key, int value) public { this.other[key] = value; require(true); }
}`;

// A second participant so the atomic envelope clears its 256-byte minimum, as in the kernel composition suites.
const DRIVER = `interface IBusBook { function put(int key, int value); }
contract BusDriver(address bus) {
  function poke() public { IBusBook(bus).put(5, 9); require(true); }
}`;

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true,
  maximumInputBytes: 1_000_000, suppressWarnings: true,
} as const;

type LibauthTransaction = ReturnType<TransactionBuilder['buildLibauthTransaction']>;
type LibauthOutput = LibauthTransaction['outputs'][number];
type Vm = ReturnType<typeof createVirtualMachineBch2026ForProvider>;

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

function spendOf(builder: TransactionBuilder): Spend {
  return {
    transaction: builder.buildLibauthTransaction(),
    sourceOutputs: generateLibauthSourceOutputs(builder.inputs),
  };
}

function verdict(vm: Vm, spend: Spend, inputIndex: number): true | string {
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

/** The victim at the next input index through the entry write flag, `atVictim` at its index, `extra` after all. */
function beside(
  honest: Spend, victim: Victim, master: number, atVictim: LibauthOutput, extra: readonly LibauthOutput[] = [],
): Spend {
  const at = honest.transaction.inputs.length;
  const outputs = [...honest.transaction.outputs];
  while (outputs.length < at) outputs.push({ lockingBytecode: OTHER_LOCK, valueSatoshis: 1_000n });
  outputs.splice(at, 0, atVictim);
  return {
    sourceOutputs: [...honest.sourceOutputs, victim.source],
    transaction: {
      ...honest.transaction,
      inputs: [...honest.transaction.inputs, victimInput(victim, master)],
      outputs: [...outputs, ...extra],
    },
  };
}

/** The victim in place of the pad at `at`, inside the participant block, and `atVictim` in place of its output. */
function inside(honest: Spend, victim: Victim, master: number, at: number, atVictim: LibauthOutput): Spend {
  const inputs = [...honest.transaction.inputs];
  const outputs = [...honest.transaction.outputs];
  const sourceOutputs = [...honest.sourceOutputs];
  inputs[at] = victimInput(victim, master);
  outputs[at] = atVictim;
  sourceOutputs[at] = victim.source;
  return { sourceOutputs, transaction: { ...honest.transaction, inputs, outputs } };
}

/** In-block indices after the master whose input holds no token: the pads a batch leaves in its block. */
function padSlots(honest: Spend, master: number, blockSize: number): number[] {
  return Array.from({ length: blockSize - 1 }, (_unused, offset) => master + 1 + offset)
    .filter((index) => index < honest.sourceOutputs.length && honest.sourceOutputs[index]!.token === undefined);
}

interface InBlockVerdicts {
  readonly victim: true | string;
  readonly burntVictim: true | string;
  readonly rewrite: true | string;
  readonly burn: true | string;
}

/** The victim in each pad, rewritten or burnt: the entry covenant's verdicts at the pad, and the route's. */
function inBlockVerdicts(
  vm: Vm, honest: Spend, victim: Victim, master: number, pads: readonly number[],
): Record<number, InBlockVerdicts> {
  return Object.fromEntries(pads.map((pad) => {
    const rewrite = inside(honest, victim, master, pad, rewritten(victim));
    const burn = inside(honest, victim, master, pad, {
      lockingBytecode: OTHER_LOCK, valueSatoshis: victim.source.valueSatoshis,
    });
    return [pad, {
      victim: verdict(vm, rewrite, pad), burntVictim: verdict(vm, burn, pad),
      rewrite: verdict(vm, rewrite, master), burn: verdict(vm, burn, master),
    }];
  }));
}

/** Each pad's victim passes its own covenant and is refused by the route. */
function expectInBlockRefused(verdicts: Record<number, InBlockVerdicts>, batch: string): void {
  for (const [pad, result] of Object.entries(verdicts)) {
    expect(result.victim, `the entry write flag accepts the spend at ${pad}`).toBe(true);
    expect(result.burntVictim, `the entry write flag accepts the burn at ${pad}`).toBe(true);
    expect.soft(result.rewrite, `beside ${batch}, the route refuses a rewritten entry at pad ${pad}`).not.toBe(true);
    expect.soft(result.burn, `beside ${batch}, the route refuses a burnt entry at pad ${pad}`).not.toBe(true);
  }
}

function rewritten(victim: Victim): LibauthOutput {
  const forged = Uint8Array.from(victim.source.token!.nft!.commitment);
  forged[forged.length - 1] ^= 1;
  return { ...victim.source, token: { ...victim.source.token!, nft: { capability: 'mutable', commitment: forged } } };
}

/** Destroyed at its index, its NFT re-emitted unchanged at its own lock after every output. */
function moved(honest: Spend, victim: Victim, master: number): Spend {
  return beside(honest, victim, master, {
    lockingBytecode: OTHER_LOCK, valueSatoshis: victim.source.valueSatoshis,
  }, [victim.source]);
}

describe('C3 census-path route: an own-category record no row that ran claims is pinned at its index', () => {
  it('settles honest batches and a compose, and refuses an entry the batch does not reach', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const busArtifact = compileString(BUS, { ...KERNEL, messageBusHandlers: ['tick', 'put'] });
    const driverArtifact = compileString(DRIVER, KERNEL);
    expect(new Set(busArtifact.messageBus?.handlers.filter((handler) => handler.eligible)
      .map((handler) => handler.name))).toEqual(new Set(['tick', 'put']));
    expect(busArtifact.messageBus?.route.inputs.some((input) => input.name === '__internal__activeVerifierIndex'))
      .toBe(true);
    const blockSize = busArtifact.messageBus!.route.blockLayout!.blockSize;
    const routeBody = busArtifact.functionBodies?.[busArtifact.messageBus!.route.selector!];
    console.log('census route', { blockSize, routeBodyBytes: routeBody === undefined ? 'n/a' : routeBody.length / 2,
      contractBytes: (busArtifact.debug?.bytecode.length ?? 0) / 2 });

    const connect = async (
      artifact: typeof busArtifact, args: readonly unknown[], initialState: Record<string, unknown>,
    ): Promise<{ contract: StatefulContract; categoryId: string }> => {
      const base = new Contract(artifact, args as never[], { provider });
      const setup = await setupStatefulUtxos(
        provider, base, artifact.stateLayout!, initialState, { saltContract: true },
      );
      return {
        contract: StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId),
        categoryId: setup.categoryId,
      };
    };
    const { contract: bus, categoryId } = await connect(busArtifact, [], { count: 0n });
    const { contract: driver } = await connect(driverArtifact, [hexToBin(bus.inner.lockingBytecode)], {});
    await bus.call.put(5n, 7n).send();
    await bus.call.put(9n, 1n).send();
    await bus.call.note(1n, 2n).send();
    const vm = createVirtualMachineBch2026ForProvider(provider);

    /** A live entry of `collection` that `honest` does not spend. */
    const victimOf = async (honest: Spend, collection: string): Promise<Victim> => {
      const spent = new Set(honest.transaction.inputs.map((input) =>
        `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`));
      const collectionHash = computeCollectionHash(resolveCollectionSignature(busArtifact, collection));
      const redeem = scriptToBytecode(buildEntryNftCovenantScript(
        hexToBin(categoryId), collectionHash, directConventionMasterLock(bus.inner),
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
    };
    const masterOf = (honest: Spend, victim: Victim): number => {
      const master = honest.sourceOutputs.findIndex((output) => output.token?.nft?.capability === 'minting'
        && binToHex(output.token.category) === binToHex(victim.source.token!.category));
      expect(master).toBeGreaterThanOrEqual(0);
      return master;
    };

    // 1. A `tick` batch: the census-path route runs no `put` row and no verifier.
    const tickCall = bus.batch([{ function: 'tick', args: [] }]);
    const tick = spendOf(await tickCall.build());
    expect(failures(vm, tick), 'honest tick batch').toEqual([]);
    const at = tick.transaction.inputs.length;
    const side = await victimOf(tick, 'side');
    const master = masterOf(tick, side);
    expect(at, 'the victim sits past the participant block').toBeGreaterThanOrEqual(master + blockSize);
    const sideRewrite = beside(tick, side, master, rewritten(side));
    const sideMove = moved(tick, side, master);
    const other = await victimOf(tick, 'other');
    const otherRewrite = beside(tick, other, master, rewritten(other));
    for (const spend of [sideRewrite, sideMove, otherRewrite]) {
      expect(verdict(vm, spend, at), 'the entry write flag accepts the spend').toBe(true);
    }
    const tickVerdicts = {
      sideRewrite: verdict(vm, sideRewrite, master),
      sideMove: verdict(vm, sideMove, master),
      otherRewrite: verdict(vm, otherRewrite, master),
    };
    console.log('tick batch verdicts', tickVerdicts);
    expect.soft(tickVerdicts.sideRewrite, 'the route refuses a rewritten `side` entry').not.toBe(true);
    expect.soft(tickVerdicts.sideMove, 'the route refuses a moved `side` entry').not.toBe(true);
    expect.soft(tickVerdicts.otherRewrite, 'the census refuses an unnamed entry').not.toBe(true);
    // Inside the block: the `side` entry slot and the trailing band, which no `tick` row claims, hold pads.
    const tickPads = padSlots(tick, master, blockSize);
    expect(tickPads.length, 'the tick batch leaves pads inside its block').toBeGreaterThan(0);
    const tickInBlock = inBlockVerdicts(vm, tick, side, master, tickPads);
    console.log('tick batch in-block verdicts', tickInBlock);
    expectInBlockRefused(tickInBlock, 'a tick batch');
    await tickCall.send();
    expect((await bus.getState()).count).toBe(1n);

    // 2. A `put` batch: the handler's own address count already holds the collection it writes.
    const putCall = bus.batch([{ function: 'put', args: [5n, 8n] }]);
    const put = spendOf(await putCall.build());
    expect(failures(vm, put), 'honest put batch').toEqual([]);
    const putSide = await victimOf(put, 'side');
    const putMaster = masterOf(put, putSide);
    const putRewrite = beside(put, putSide, putMaster, rewritten(putSide));
    expect(verdict(vm, putRewrite, put.transaction.inputs.length), 'the entry write flag accepts it').toBe(true);
    const putVerdict = verdict(vm, putRewrite, putMaster);
    console.log('put batch verdict', putVerdict);
    expect.soft(putVerdict, 'the route refuses a rewritten `side` entry beside `put`').not.toBe(true);
    // Inside the block: the trailing band, which `put` takes no record from, holds pads.
    const putPads = padSlots(put, putMaster, blockSize);
    expect(putPads.length, 'the put batch leaves pads inside its block').toBeGreaterThan(0);
    const putInBlock = inBlockVerdicts(vm, put, putSide, putMaster, putPads);
    console.log('put batch in-block verdicts', putInBlock);
    expectInBlockRefused(putInBlock, 'a put batch');
    await putCall.send();
    expect((await bus.getEntries('side')).map((entry) => entry.value)).toEqual(expect.arrayContaining([8n, 1n]));

    // An honest insert: the new node takes a trailing output beside a pad input, the pinned band's honest use.
    const insertCall = bus.batch([{ function: 'put', args: [11n, 4n] }]);
    expect(failures(vm, spendOf(await insertCall.build())), 'honest insert batch').toEqual([]);
    await insertCall.send();
    expect((await bus.getEntries('side')).map((entry) => entry.value)).toEqual(expect.arrayContaining([8n, 1n, 4n]));

    // 3. Honest compose: the callee row runs `put` beside the bus verifier, which comes back with a new commitment.
    const funder = await createBareP2pkhFeeFunder(provider, 2_000_000n);
    const composed = await messageBus.compose({
      preparedCalls: [
        { contract: driver, functionName: 'poke', args: [] },
        { contract: bus, functionName: 'put', args: [5n, 9n] },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    }).build();
    const composeSpend = spendOf(composed);
    const verifierLock = binToHex(getMessageBusVerifierLockingBytecode(bus.inner, categoryId));
    const verifierAt = composeSpend.sourceOutputs.findIndex((output) =>
      binToHex(output.lockingBytecode) === verifierLock && output.token?.nft?.capability === 'mutable');
    expect(verifierAt, 'compose co-spends the bus verifier').toBeGreaterThanOrEqual(0);
    expect(binToHex(composeSpend.transaction.outputs[verifierAt]!.token!.nft!.commitment))
      .not.toBe(binToHex(composeSpend.sourceOutputs[verifierAt]!.token!.nft!.commitment));
    expect(failures(vm, composeSpend), 'honest compose').toEqual([]);
    await expect(provider.sendRawTransaction(composed.build())).resolves.toMatch(/^[0-9a-f]{64}$/);
    expect((await bus.getEntries('side')).map((entry) => entry.value)).toEqual(expect.arrayContaining([9n, 1n]));
  }, 300_000);
});
