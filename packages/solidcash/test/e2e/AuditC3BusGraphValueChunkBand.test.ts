/**
 * C3 graph band, value chunks (docs/security/SECURITY-AUDIT.md C3).
 *
 * The graph verifier census walks only the physical block `[master, master + s)`. With the contract last and a
 * compile-time block B > s + P, the fee slot sits past the physical block but inside `[master, master + B)`. A long
 * mapping value keeps its continuation in own-category mutable value chunks at their own chunk lock, spent through
 * the entry covenant's write flag beside the master, and the route's collection census counts entry addresses, not
 * chunk locks.
 *
 * The route's record pin skips only its authenticated physical block: the verifier binds `__internal__graphBlockSize`
 * to s. So a chunk in the fee slot, rewritten in place or burned, is refused by the route's pin, and by the root
 * verifier's `tx.origin` (the first token-free P2PKH input was the fee input). Moved to a P2PKH it is refused by the
 * route's output slot scan first. With the root caller's own coin in a balanced pad slot, which keeps `tx.origin`,
 * the route's pin alone refuses the rewrite and the burn.
 */
import { describe, expect, it } from 'vitest';
import {
  bigIntToVmNumber, binToHex, disassembleAuthenticationInstructionsMaybeMalformed, encodeDataPush,
  encodeLockingBytecodeP2sh32, encodeTransaction, hash256, hexToBin,
} from '@bitauth/libauth';
import { OpcodesBch2026 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-opcodes.js';
import { compileString } from '@solidcash/solidc';
import {
  BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX, buildValueChunkCommitment, buildValueChunkCovenantScript,
  computeCollectionHash, encodeIntegerValue, scriptToBytecode, sha256, splitValueIntoValueChunks,
  valueChunkSignature,
} from '@solidcash/utils';
import { Contract, type TransactionBuilder } from '../../src/index.js';
import { StatefulContract, keyToSlot } from '../../src/stateful/index.js';
import * as messageBus from '../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs, solidCashOutputToLibauthOutput } from '../../src/utils.js';
import {
  directConventionMasterLock, getMessageBusVerifierLockingBytecode, getValueChunkAddress,
  getValueChunkLockingBytecode,
} from '../../src/stateful/covenant-helpers.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../test-util.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

// Two handler-managed mappings, as in AuditC3BusGraphParkedPin's wide ledger, so a `tick`'s physical block leaves
// the trailing band out; `side` holds bytes, so a long value keeps value chunks.
const LEDGER = `contract GraphLedger() {
  int public count;
  mapping(int => bytes) side;
  mapping(int => int) public other;
  function tick() public { this.count = this.count + 1; require(true); }
  function put(int key, bytes value) public { this.side[key] = value; require(true); }
  function putOther(int key, int value) public { this.other[key] = value; require(true); }
}`;

const DRIVER = `interface IGraphLedger { function tick(); }
contract GraphDriver(address ledger) {
  function poke() public { IGraphLedger(ledger).tick(); require(true); }
}`;

const GRAPH = {
  forceStateful: true, messageBus: true, messageBusKernel: true, messageBusGraphContext: true,
  maximumInputBytes: 1_000_000, suppressWarnings: true,
} as const;

const KEY = 5n;
const VALUE = new Uint8Array(200).fill(0xab);
const OTHER_LOCK = Uint8Array.of(0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x66), 0x88, 0xac);
const TX_ORIGIN_REFUSAL = /OP_UNTIL OP_DROP OP_DUP OP_SIZE OP_NIP OP_0NOTEQUAL OP_VERIFY$/;
// The route's record pin: an own-category record past its block comes back at its own index, lock and commitment.
const PIN_REFUSAL = {
  rewrite: /OP_DUP OP_OUTPUTTOKENCOMMITMENT OP_OVER OP_UTXOTOKENCOMMITMENT OP_EQUALVERIFY$/,
  burn: /OP_NOTIF OP_DUP OP_OUTPUTBYTECODE OP_OVER OP_UTXOBYTECODE OP_EQUALVERIFY$/,
} as const;

type LibauthTransaction = ReturnType<TransactionBuilder['buildLibauthTransaction']>;
type LibauthOutput = LibauthTransaction['outputs'][number];
type Vm = ReturnType<typeof createVirtualMachineBch2026ForProvider>;
type Provider = ReturnType<typeof createMessageBusCapstoneTestProvider>;
type Artifact = ReturnType<typeof compileString>;
type Funder = Awaited<ReturnType<typeof createBareP2pkhFeeFunder>>;
type Fate = 'rewrite' | 'burn' | 'steal';

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

interface Scenario {
  readonly provider: Provider;
  readonly vm: Vm;
  readonly bus: StatefulContract;
  readonly composed: TransactionBuilder;
  readonly honest: Spend;
  readonly funder: Funder;
  readonly victim: Victim;
  readonly chunkAddress: string;
  readonly blockSize: number;
  readonly master: number;
  readonly physicalSize: number;
  readonly verifierInputs: number[];
  readonly rootVerifier: number;
  readonly feeIndex: number;
  /** The first balanced pad before the fee slot. */
  readonly pad: number;
}

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

/** Each input the VM refuses, with the last instructions it ran. */
function refusedInputs(vm: Vm, spend: Spend): Array<{ inputIndex: number; at: string }> {
  return spend.transaction.inputs.flatMap((_input, inputIndex) => {
    const state = vm.evaluate({ inputIndex, transaction: spend.transaction, sourceOutputs: spend.sourceOutputs });
    return vm.stateSuccess(state) === true ? [] : [{
      inputIndex,
      at: disassembleAuthenticationInstructionsMaybeMalformed(
        OpcodesBch2026, state.instructions.slice(Math.max(0, state.ip - 8), state.ip),
      ),
    }];
  });
}

/** A co-spent verifier NFT: it carries the L3V1 commitment domain and recreates itself at its own input index. */
function isVerifier(output: LibauthOutput | undefined): boolean {
  return output?.token?.nft?.capability === 'mutable' && binToHex(output.token.nft.commitment).startsWith('4c335631');
}

/** A balanced pad: the token-free P2SH32(OP_TRUE) input the compose recreates at OP_TRUE. */
function isPad(spend: Spend, index: number): boolean {
  const source = spend.sourceOutputs[index];
  return source !== undefined && source.token === undefined
    && binToHex(source.lockingBytecode) === BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX
    && binToHex(spend.transaction.outputs[index]?.lockingBytecode ?? new Uint8Array()) === '51';
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

/** Value chunk 0 of `side[KEY]`, at its chunk lock, with the redeem that spends it. */
async function valueChunkOf(
  provider: Provider, bus: StatefulContract, categoryId: string,
): Promise<{ victim: Victim; chunkAddress: string }> {
  const slot = keyToSlot(bigIntToVmNumber(KEY));
  const root = sha256(VALUE);
  const masterLock = directConventionMasterLock(bus.inner);
  const redeem = scriptToBytecode(buildValueChunkCovenantScript(
    hexToBin(categoryId), computeCollectionHash(valueChunkSignature('side')), slot, root, masterLock,
  ));
  const lock = encodeLockingBytecodeP2sh32(hash256(redeem));
  expect(binToHex(lock)).toBe(binToHex(getValueChunkLockingBytecode(categoryId, 'side', slot, root, masterLock)));
  const chunkAddress = getValueChunkAddress(bus.inner, categoryId, 'side', slot, root);
  const chunks = splitValueIntoValueChunks(VALUE);
  const utxos = await provider.getUtxos(chunkAddress);
  expect(utxos.length, 'the long value keeps its value chunks at the chunk lock').toBe(chunks.length);
  const chunk = utxos.find((utxo) => utxo.token?.nft?.commitment === buildValueChunkCommitment(0, chunks[0]!));
  expect(chunk?.token?.nft?.capability, 'value chunk 0 is a mutable NFT').toBe('mutable');
  return {
    chunkAddress,
    victim: {
      txid: chunk!.txid, vout: chunk!.vout, redeem,
      source: solidCashOutputToLibauthOutput({ to: lock, amount: chunk!.satoshis, token: chunk!.token }),
    },
  };
}

/** The honest compose driver.poke -> ledger.tick, with the ledger last, and the value chunk it leaves out. */
async function scenario(): Promise<Scenario> {
  const provider = createMessageBusCapstoneTestProvider();
  const artifact = compileString(LEDGER, { ...GRAPH, messageBusHandlers: ['tick', 'put', 'putOther'] });
  const blockSize = artifact.messageBus!.route.blockLayout?.blockSize ?? 0;
  const { contract: bus, categoryId } = await seeded(provider, artifact, [], { count: 0n });
  await bus.call.put(KEY, VALUE).send();
  const { victim, chunkAddress } = await valueChunkOf(provider, bus, categoryId);
  const { contract: driver } = await seeded(
    provider, compileString(DRIVER, GRAPH), [hexToBin(bus.inner.lockingBytecode)], {},
  );
  const vm = createVirtualMachineBch2026ForProvider(provider);
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
  const master = honest.sourceOutputs.findIndex((output) => output.token?.nft?.capability === 'minting'
    && binToHex(output.token.category) === binToHex(victim.source.token!.category));
  const verifierInputs = honest.sourceOutputs.flatMap((output, index) => (isVerifier(output) ? [index] : []));
  const verifierLock = binToHex(getMessageBusVerifierLockingBytecode(bus.inner, categoryId));
  const feeIndex = honest.transaction.inputs.length - 1;
  return {
    provider, vm, bus, composed, honest, funder, victim, chunkAddress, blockSize, master,
    physicalSize: (verifierInputs[0] ?? master) - master,
    verifierInputs,
    rootVerifier: verifierInputs.find((index) =>
      binToHex(honest.sourceOutputs[index]!.lockingBytecode) !== verifierLock) ?? -1,
    feeIndex,
    pad: honest.sourceOutputs.findIndex((_output, index) => index < feeIndex && isPad(honest, index)),
  };
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

/** The chunk's output in the fee slot: rewritten in place, burned, or moved to a P2PKH at that index. */
function fateOf(victim: Victim, fate: Fate): LibauthOutput {
  const value = victim.source.valueSatoshis;
  if (fate === 'burn') return { lockingBytecode: OTHER_LOCK, valueSatoshis: value };
  if (fate === 'steal') return { lockingBytecode: OTHER_LOCK, valueSatoshis: value, token: victim.source.token };
  const forged = Uint8Array.from(victim.source.token!.nft!.commitment);
  forged[forged.length - 1] ^= 1;
  return { ...victim.source, token: { ...victim.source.token!, nft: { capability: 'mutable', commitment: forged } } };
}

/** `spend` with input and output `slot` replaced. */
function inSlot(
  spend: Spend, slot: number, input: LibauthTransaction['inputs'][number], source: LibauthOutput,
  output: LibauthOutput,
): Spend {
  const inputs = [...spend.transaction.inputs];
  const sourceOutputs = [...spend.sourceOutputs];
  const outputs = [...spend.transaction.outputs];
  inputs[slot] = input;
  sourceOutputs[slot] = source;
  outputs[slot] = output;
  return { sourceOutputs, transaction: { ...spend.transaction, inputs, outputs } };
}

/** The value chunk in the fee slot through the entry write flag. */
function chunkInFeeSlot(s: Scenario, base: Spend, fate: Fate): Spend {
  return inSlot(base, s.feeIndex, victimInput(s.victim, s.master), s.victim.source, fateOf(s.victim, fate));
}

/** `spend` with every input at the funder's P2PKH lock signed again. */
function signed(spend: Spend, funder: Funder): Spend {
  const lock = binToHex(funder.unlocker.generateLockingBytecode());
  const inputs = spend.transaction.inputs.map((input, inputIndex) => (
    binToHex(spend.sourceOutputs[inputIndex]!.lockingBytecode) !== lock ? input : {
      ...input,
      unlockingBytecode: funder.unlocker.generateUnlockingBytecode({
        transaction: spend.transaction, sourceOutputs: spend.sourceOutputs, inputIndex,
      }),
    }));
  return { sourceOutputs: spend.sourceOutputs, transaction: { ...spend.transaction, inputs } };
}

/** A fresh coin at the root caller's P2PKH in the pad slot, worth the pad plus `extra`; the pad's output stays. */
async function originInPad(s: Scenario, base: Spend, extra: bigint): Promise<Spend> {
  const origin = await createBareP2pkhFeeFunder(s.provider, base.sourceOutputs[s.pad]!.valueSatoshis + extra);
  expect(binToHex(origin.unlocker.generateLockingBytecode()))
    .toBe(binToHex(s.funder.unlocker.generateLockingBytecode()));
  return inSlot(base, s.pad, {
    outpointIndex: origin.utxo.vout, outpointTransactionHash: hexToBin(origin.utxo.txid),
    sequenceNumber: 0xffffffff, unlockingBytecode: new Uint8Array(),
  }, {
    lockingBytecode: origin.unlocker.generateLockingBytecode(), valueSatoshis: origin.utxo.satoshis,
  }, base.transaction.outputs[s.pad]!);
}

const outcomeOf = (provider: Provider, spend: Spend): Promise<string> => provider
  .sendRawTransaction(binToHex(encodeTransaction(spend.transaction)))
  .then(() => 'ACCEPTED').catch((error: Error) => error.message);

describe('C3 graph band: a value chunk in the fee slot of a cheap entry\'s compose', () => {
  it('settles the honest compose and refuses a value chunk in the fee slot by the route pin and tx.origin', async () => {
    const s = await scenario();
    const { vm, honest, master, blockSize, physicalSize, verifierInputs, rootVerifier, feeIndex } = s;
    expect(refusedInputs(vm, honest), 'honest compose').toEqual([]);
    console.log('value chunk band geometry', JSON.stringify({
      master, physicalSize, blockSize, verifierInputs, rootVerifier, feeIndex, pad: s.pad,
    }));

    // [driver block | ledger block | one verifier per participant | fee]: the fee slot is P = 2 past the ledger's
    // physical block and inside its compile-time block [master, master + B).
    expect(verifierInputs, 'one verifier per participant').toEqual([master + physicalSize, master + physicalSize + 1]);
    expect(honest.sourceOutputs[feeIndex]!.token, 'the last input is the fee input').toBeUndefined();
    expect(feeIndex).toBe(master + physicalSize + 2);
    expect(feeIndex, 'the fee slot sits inside the compile-time block').toBeLessThan(master + blockSize);
    expect(s.pad, 'a balanced pad sits in the ledger block').toBeGreaterThan(master);

    // The chunk's covenant accepts each fate; the route's census and the ledger verifier count no chunk lock.
    const refused = {} as Record<Fate, ReturnType<typeof refusedInputs>>;
    for (const fate of ['rewrite', 'burn', 'steal'] as const) {
      const spend = chunkInFeeSlot(s, honest, fate);
      expect(verdict(vm, spend, feeIndex), `the entry write flag accepts the ${fate}`).toBe(true);
      refused[fate] = refusedInputs(vm, spend);
    }
    console.log('value chunk band refusals', JSON.stringify(refused));

    // Rewritten or burned, the ledger route refuses it at its record pin, which skips only the physical block, and the
    // root verifier at tx.origin: no token-free P2PKH input is left (emitTxOrigin). Moved to a P2PKH, the ledger
    // route refuses it at its output slot scan, before the pin.
    for (const fate of ['rewrite', 'burn'] as const) {
      expect.soft(refused[fate].map((input) => input.inputIndex), `the route and the root verifier refuse the ${fate}`)
        .toEqual([master, rootVerifier]);
      expect.soft(refused[fate][0]?.at, `the route's record pin refuses the ${fate}`).toMatch(PIN_REFUSAL[fate]);
      expect.soft(refused[fate][1]?.at, `the root verifier's tx.origin refuses the ${fate}`)
        .toMatch(TX_ORIGIN_REFUSAL);
    }
    expect.soft(refused.steal.map((input) => input.inputIndex), 'the route and the root verifier refuse the steal')
      .toEqual([master, rootVerifier]);

    await expect(s.provider.sendRawTransaction(s.composed.build())).resolves.toMatch(/^[0-9a-f]{64}$/);
    expect((await s.bus.getState()).count).toBe(1n);
  }, 300_000);

  // The root caller's own coin in a balanced pad slot keeps tx.origin: the verifier's physical census counts a
  // token-free input other than the dummy funder only when its output keeps its lock, and no route check binds the
  // pad slots of a row that names none. The coin pays what the fee input paid, and the chunk takes the fee slot.
  // The route's record pin, past its authenticated physical block, refuses the rewrite and the burn alone.
  it('refuses a chunk in the fee slot rewritten or burned beside a root caller pad at the route pin', async () => {
    const s = await scenario();
    const { vm, honest, master, feeIndex } = s;
    const feePaid = honest.sourceOutputs[feeIndex]!.valueSatoshis - honest.transaction.outputs[feeIndex]!.valueSatoshis;
    const attack = async (fate: Fate): Promise<Spend> => signed(
      chunkInFeeSlot(s, await originInPad(s, honest, feePaid + 5_000n), fate), s.funder,
    );
    const spends = { rewrite: await attack('rewrite'), burn: await attack('burn') };
    const refused = { rewrite: refusedInputs(vm, spends.rewrite), burn: refusedInputs(vm, spends.burn) };
    const outcome = {
      rewrite: await outcomeOf(s.provider, spends.rewrite), burn: await outcomeOf(s.provider, spends.burn),
    };
    console.log('value chunk band root caller pad', JSON.stringify({ pad: s.pad, refused, outcome }));
    for (const fate of ['rewrite', 'burn'] as const) {
      expect(refused[fate].map((input) => input.inputIndex), `only the ledger route refuses the ${fate}`)
        .toEqual([master]);
      expect.soft(refused[fate][0]?.at, `the route's record pin refuses the ${fate}`).toMatch(PIN_REFUSAL[fate]);
      expect(outcome[fate], `the node refuses the ${fate}`).not.toBe('ACCEPTED');
    }
  }, 300_000);
});
