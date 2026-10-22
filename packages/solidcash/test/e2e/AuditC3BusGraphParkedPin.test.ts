/**
 * C3 beside a graph-context message-bus route (docs/security/SECURITY-AUDIT.md C3).
 *
 * A graph route always runs its verifier binder, so its C3 record pin skips the verifier by index, and the contract's
 * direct entries share that pin's parked helper with no input exempt: a pinned count, and a census walk.
 * Beside a direct `tick` (a pinned count) and a direct `put` (a census walk), a `side` entry outside the block is
 * co-spent through the entry covenant's write flag, which only asks for the master: it is rewritten in place, or
 * destroyed while its NFT reappears at its own lock at another index. Each spend is accepted by the entry covenant
 * and refused by the master. The honest calls settle.
 *
 * Through the route, an honest compose co-spends the bus verifier and settles. The verifier fixes the inputs to the
 * participant blocks, one verifier each and the fee input, and the outputs to as many, and the binder reads the
 * envelope at `tx.inputs.length - 2`, so the fee input's slot is the one outside every participant block. A `side`
 * entry there, rewritten in place, or destroyed while its NFT reappears after every output, is refused by the route's
 * parked pin at its index. With the route's verifier index re-encoded to aim at that entry, the binder's lock check
 * refuses the route before the pin runs.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeAuthenticationInstructions, disassembleAuthenticationInstructionsMaybeMalformed, encodeDataPush,
  encodeLockingBytecodeP2sh32, hash256, hexToBin,
} from '@bitauth/libauth';
import { OpcodesBch2026 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-opcodes.js';
import { compileString } from 'solidc';
import {
  buildEntryNftCovenantScript, computeCollectionHash, encodeIntegerValue, scriptToBytecode,
} from '@solidcash/utils';
import { Contract, type TransactionBuilder } from '../../src/index.js';
import type { ContractUnlocker } from '../../src/interfaces.js';
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

const LEDGER = `contract GraphLedger() {
  int public count;
  mapping(int => int) public side;
  function tick() public { this.count = this.count + 1; require(true); }
  function put(int key, int value) public { this.side[key] = value; require(true); }
}`;

// A caller, so the ledger's route runs inside a compose and the atomic envelope clears its 256-byte minimum.
const DRIVER = `interface IGraphLedger { function tick(); }
contract GraphDriver(address ledger) {
  function poke() public { IGraphLedger(ledger).tick(); require(true); }
}`;

const GRAPH = {
  forceStateful: true, messageBus: true, messageBusKernel: true, messageBusGraphContext: true,
  maximumInputBytes: 1_000_000, suppressWarnings: true,
} as const;

const ACTIVE_VERIFIER_INDEX = '__internal__activeVerifierIndex';

type LibauthTransaction = ReturnType<TransactionBuilder['buildLibauthTransaction']>;
type LibauthOutput = LibauthTransaction['outputs'][number];
type Vm = ReturnType<typeof createVirtualMachineBch2026ForProvider>;
type Provider = ReturnType<typeof createMessageBusCapstoneTestProvider>;
type Artifact = ReturnType<typeof compileString>;

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

interface Ledger {
  readonly bus: StatefulContract;
  readonly categoryId: string;
  /** A live `side` entry that `honest` does not spend. */
  readonly victimOf: (honest: Spend) => Promise<Victim>;
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
  return result === true ? true : `${result}`;
}

function failures(vm: Vm, spend: Spend): Array<{ inputIndex: number; error: string }> {
  return spend.transaction.inputs.flatMap((_input, inputIndex) => {
    const result = verdict(vm, spend, inputIndex);
    return result === true ? [] : [{ inputIndex, error: result }];
  });
}

interface Refusal {
  readonly verdict: true | string;
  /** The last instructions the input ran, ending at the one that failed. */
  readonly at: string;
  /** Every input the VM refuses. */
  readonly failing: readonly number[];
}

function refusal(vm: Vm, spend: Spend, inputIndex: number): Refusal {
  const state = vm.evaluate({ inputIndex, transaction: spend.transaction, sourceOutputs: spend.sourceOutputs });
  const result = vm.stateSuccess(state);
  return {
    verdict: result === true ? true : `${result}`,
    at: disassembleAuthenticationInstructionsMaybeMalformed(
      OpcodesBch2026, state.instructions.slice(Math.max(0, state.ip - 8), state.ip),
    ),
    failing: failures(vm, spend).map((failure) => failure.inputIndex),
  };
}

async function seeded(
  provider: Provider, artifact: Artifact, args: readonly unknown[], initialState: Record<string, unknown>,
): Promise<{ contract: StatefulContract; categoryId: string }> {
  const base = new Contract(artifact, args as never[], { provider });
  const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, initialState, { saltContract: true });
  return {
    contract: StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId),
    categoryId: setup.categoryId,
  };
}

/** The ledger with `side` entries 5 and 9. */
async function seedLedger(provider: Provider, artifact: Artifact): Promise<Ledger> {
  const { contract: bus, categoryId } = await seeded(provider, artifact, [], { count: 0n });
  await bus.call.put(5n, 7n).send();
  await bus.call.put(9n, 1n).send();
  const collectionHash = computeCollectionHash(resolveCollectionSignature(artifact, 'side'));
  const redeem = scriptToBytecode(buildEntryNftCovenantScript(
    hexToBin(categoryId), collectionHash, directConventionMasterLock(bus.inner),
  ));
  const entryAddress = getEntryNftAddress(bus.inner, categoryId, 'side');
  const entryLock = addressToLockScript(entryAddress);
  expect(binToHex(encodeLockingBytecodeP2sh32(hash256(redeem)))).toBe(binToHex(entryLock));
  const victimOf = async (honest: Spend): Promise<Victim> => {
    const spent = new Set(honest.transaction.inputs.map((input) =>
      `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`));
    const entry = (await provider.getUtxos(entryAddress)).find((utxo) => utxo.token?.nft?.capability === 'mutable'
      && !spent.has(`${utxo.txid}:${utxo.vout}`));
    expect(entry, 'an unspent side entry').toBeDefined();
    return {
      txid: entry!.txid, vout: entry!.vout, redeem,
      source: solidCashOutputToLibauthOutput({ to: entryLock, amount: entry!.satoshis, token: entry!.token }),
    };
  };
  return { bus, categoryId, victimOf };
}

/** The input index of the victim's master in `honest`. */
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

function rewritten(victim: Victim): LibauthOutput {
  const forged = Uint8Array.from(victim.source.token!.nft!.commitment);
  forged[forged.length - 1] ^= 1;
  return { ...victim.source, token: { ...victim.source.token!, nft: { capability: 'mutable', commitment: forged } } };
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

/** The victim through the entry write flag in place of input and output `slot`, `extra` after all outputs. */
function inSlot(
  honest: Spend, victim: Victim, master: number, slot: number, atVictim: LibauthOutput,
  extra: readonly LibauthOutput[] = [],
): Spend {
  const inputs = [...honest.transaction.inputs];
  const sourceOutputs = [...honest.sourceOutputs];
  const outputs = [...honest.transaction.outputs];
  inputs[slot] = victimInput(victim, master);
  sourceOutputs[slot] = victim.source;
  outputs[slot] = atVictim;
  return { sourceOutputs, transaction: { ...honest.transaction, inputs, outputs: [...outputs, ...extra] } };
}

/** `spend` with input `inputIndex` unlocked by `unlockingBytecode`. */
function unlockedBy(spend: Spend, inputIndex: number, unlockingBytecode: Uint8Array): Spend {
  return {
    sourceOutputs: spend.sourceOutputs,
    transaction: {
      ...spend.transaction,
      inputs: spend.transaction.inputs.map((input, index) => (
        index === inputIndex ? { ...input, unlockingBytecode } : input)),
    },
  };
}

/** Input `inputIndex`'s unlocking bytecode with argument `name` re-encoded as `value`; the builder is restored. */
function reencoded(builder: TransactionBuilder, inputIndex: number, name: string, value: bigint): Uint8Array {
  const unlocker = builder.inputs[inputIndex]!.unlocker as ContractUnlocker;
  const at = unlocker.abiFunction.inputs.findIndex((input) => input.name === name);
  expect(at, `the unlocker takes ${name}`).toBeGreaterThanOrEqual(0);
  const original = unlocker.params[at]!;
  try {
    unlocker.params[at] = value;
    unlocker.syncEncodedArgsFromParams!([at]);
    return builder.buildLibauthTransaction(true).inputs[inputIndex]!.unlockingBytecode;
  } finally {
    unlocker.params[at] = original;
    unlocker.syncEncodedArgsFromParams!([at]);
  }
}

/** The push indices at which two unlocking bytecodes differ. */
function changedPushes(left: Uint8Array, right: Uint8Array): number[] {
  const pushes = (bytecode: Uint8Array): string[] => decodeAuthenticationInstructions(bytecode)
    .map((instruction) => `${instruction.opcode}:${'data' in instruction ? binToHex(instruction.data) : ''}`);
  const [before, after] = [pushes(left), pushes(right)];
  expect(after.length).toBe(before.length);
  return before.flatMap((push, index) => (push === after[index] ? [] : [index]));
}

describe('C3 beside a graph route: the parked record pin holds each own-category record past the block', () => {
  it('settles honest direct calls and refuses a rewritten or moved entry beside them', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(LEDGER, { ...GRAPH, messageBusHandlers: ['tick'] });
    const routeInputs = artifact.messageBus!.route.inputs.map((input) => input.name);
    expect(routeInputs).toContain(ACTIVE_VERIFIER_INDEX);
    expect(routeInputs).toContain('__internal__graphFixedSize');
    const { bus, victimOf } = await seedLedger(provider, artifact);
    const vm = createVirtualMachineBch2026ForProvider(provider);

    /** The victim rewritten in place, and moved, beside `honest`: its covenant accepts each, the master refuses. */
    const attack = async (honest: Spend, label: string): Promise<void> => {
      const victim = await victimOf(honest);
      const master = masterOf(honest, victim);
      const at = honest.transaction.inputs.length;
      const rewrite = beside(honest, victim, master, rewritten(victim));
      const moved = beside(honest, victim, master, {
        lockingBytecode: OTHER_LOCK, valueSatoshis: victim.source.valueSatoshis,
      }, [victim.source]);
      expect(verdict(vm, rewrite, at), `beside ${label}, the entry write flag accepts the rewrite`).toBe(true);
      expect(verdict(vm, moved, at), `beside ${label}, the entry write flag accepts the move`).toBe(true);
      expect.soft(verdict(vm, rewrite, master), `beside ${label}, the master refuses the rewrite`).not.toBe(true);
      expect.soft(verdict(vm, moved, master), `beside ${label}, the master refuses the move`).not.toBe(true);
    };

    // 1. A direct `tick`: its pinned count runs through the parked pin.
    const tickCall = bus.call.tick();
    const tick = spendOf(await tickCall.build());
    expect(failures(vm, tick), 'honest tick').toEqual([]);
    await attack(tick, 'a direct tick');
    await tickCall.send();
    expect((await bus.getState()).count).toBe(1n);

    // 2. A direct `put` of key 5: its census walk runs through the parked pin; key 9's entry is the victim.
    const putCall = bus.call.put(5n, 8n);
    const put = spendOf(await putCall.build());
    expect(failures(vm, put), 'honest put').toEqual([]);
    await attack(put, 'a direct put');
    await putCall.send();
    expect((await bus.getEntries('side')).map((entry) => entry.value)).toEqual(expect.arrayContaining([8n, 1n]));
  }, 300_000);

  it('settles an honest compose and refuses a record beside it, or the verifier index aimed at one', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(LEDGER, { ...GRAPH, messageBusHandlers: ['tick'] });
    const route = artifact.messageBus!.route;
    const blockSize = route.blockLayout?.blockSize ?? 0;
    expect(blockSize, 'the route has a participant block').toBeGreaterThan(0);
    const { bus, categoryId, victimOf } = await seedLedger(provider, artifact);
    const { contract: driver } = await seeded(
      provider, compileString(DRIVER, GRAPH), [hexToBin(bus.inner.lockingBytecode)], {},
    );
    const vm = createVirtualMachineBch2026ForProvider(provider);

    // 1. Honest compose: the route runs `tick` beside the bus verifier, which comes back with a new commitment.
    const funder = await createBareP2pkhFeeFunder(provider, 2_000_000n);
    const composed = await messageBus.compose({
      preparedCalls: [
        { contract: driver, functionName: 'poke', args: [] },
        { contract: bus, functionName: 'tick', args: [] },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    }).build();
    const honest = spendOf(composed);
    const verifierLock = binToHex(getMessageBusVerifierLockingBytecode(bus.inner, categoryId));
    const verifierAt = honest.sourceOutputs.findIndex((output) =>
      binToHex(output.lockingBytecode) === verifierLock && output.token?.nft?.capability === 'mutable');
    expect(verifierAt, 'compose co-spends the bus verifier').toBeGreaterThanOrEqual(0);
    expect(binToHex(honest.transaction.outputs[verifierAt]!.token!.nft!.commitment))
      .not.toBe(binToHex(honest.sourceOutputs[verifierAt]!.token!.nft!.commitment));
    expect(failures(vm, honest), 'honest compose').toEqual([]);
    const victim = await victimOf(honest);
    const master = masterOf(honest, victim);
    const unlocker = composed.inputs[master]!.unlocker as ContractUnlocker;
    expect(unlocker.abiFunction.name, 'the master runs the route').toBe(route.name);
    expect(unlocker.params[unlocker.abiFunction.inputs.findIndex((input) => input.name === ACTIVE_VERIFIER_INDEX)],
      'the route names its verifier by index').toBe(BigInt(verifierAt));

    // 2. The verifier fixes the inputs to the participant blocks, one verifier each and the fee input, and the
    // outputs to as many, so the fee input's slot is the one outside every block. A `side` entry there through the
    // entry write flag: rewritten in place, or destroyed while its NFT reappears at its own lock after every output.
    const slot = honest.transaction.inputs.length - 1;
    expect(honest.sourceOutputs[slot]!.token, 'the last input is the fee input').toBeUndefined();
    expect(slot, 'the fee slot sits past the route band').toBeGreaterThanOrEqual(master + blockSize);
    expect(slot, 'the fee slot sits past the verifier').toBeGreaterThan(verifierAt);
    const tampered = {
      rewrite: inSlot(honest, victim, master, slot, rewritten(victim)),
      move: inSlot(honest, victim, master, slot, {
        lockingBytecode: OTHER_LOCK, valueSatoshis: victim.source.valueSatoshis,
      }, [victim.source]),
    };

    // 3. The same spends with the route's verifier index re-encoded to aim at the entry: one push changes.
    const aimed = reencoded(composed, master, ACTIVE_VERIFIER_INDEX, BigInt(slot));
    expect(changedPushes(honest.transaction.inputs[master]!.unlockingBytecode, aimed), 'one push changes')
      .toHaveLength(1);
    const misaimed = {
      rewrite: unlockedBy(tampered.rewrite, master, aimed),
      move: unlockedBy(tampered.move, master, aimed),
    };
    const entrySpends = { ...tampered, 'aimed rewrite': misaimed.rewrite, 'aimed move': misaimed.move };
    for (const [label, spend] of Object.entries(entrySpends)) {
      expect(verdict(vm, spend, slot), `the entry write flag accepts the ${label}`).toBe(true);
    }
    const pinned = { rewrite: refusal(vm, tampered.rewrite, master), move: refusal(vm, tampered.move, master) };
    const binder = { rewrite: refusal(vm, misaimed.rewrite, master), move: refusal(vm, misaimed.move, master) };
    console.log('graph compose refusals', JSON.stringify({ master, blockSize, verifierAt, slot, pinned, binder }));

    // The route refuses each: the parked pin at the entry's commitment or lock and, with the index aimed at the
    // entry, the binder's lock check on that input after `index < tx.inputs.length`, before the pin runs.
    expect.soft(pinned.rewrite.verdict, 'the route refuses the rewritten entry').not.toBe(true);
    expect.soft(pinned.move.verdict, 'the route refuses the moved entry').not.toBe(true);
    expect.soft(pinned.rewrite.at, 'the pin refuses the rewrite at its commitment')
      .toMatch(/OP_DUP OP_OUTPUTTOKENCOMMITMENT OP_OVER OP_UTXOTOKENCOMMITMENT OP_EQUALVERIFY$/);
    expect.soft(pinned.move.at, 'the pin refuses the move at its lock')
      .toMatch(/OP_NUMEQUAL OP_BOOLOR OP_NOTIF OP_DUP OP_OUTPUTBYTECODE OP_OVER OP_UTXOBYTECODE OP_EQUALVERIFY$/);
    const lockCheck = new RegExp(
      `OP_TXINPUTCOUNT OP_LESSTHAN OP_VERIFY OP_DUP OP_UTXOBYTECODE OP_PUSHBYTES_35 0x${verifierLock} OP_EQUALVERIFY$`,
    );
    for (const [label, result] of Object.entries(binder)) {
      expect.soft(result.verdict, `the route refuses the aimed ${label}`).not.toBe(true);
      expect.soft(result.at, `the binder's lock check refuses the aimed ${label}`).toMatch(lockCheck);
    }

    await expect(provider.sendRawTransaction(composed.build())).resolves.toMatch(/^[0-9a-f]{64}$/);
    expect((await bus.getState()).count).toBe(1n);
  }, 300_000);
});
