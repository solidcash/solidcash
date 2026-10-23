/**
 * C3 leaf band, value chunks (docs/security/SECURITY-AUDIT.md C3).
 *
 * AuditC3BusGraphValueChunkBand with the ledger a default leaf callee: no external call and no
 * `messageBusGraphContext`, so its route is bound with claim flags and is not a graph route. It takes no
 * `__internal__graphBlockSize`. Once its verifier ran, the route claims its whole compile-time block
 * `[master, master + B)` (emitRouteBlockClaims), while the verifier census walks only the physical block
 * `[master, master + s)`. With the ledger last and B > s + P, the fee slot sits between them.
 *
 * A ledger value chunk in the fee slot, spent through the entry write flag, is refused by the root verifier's
 * `tx.origin` when rewritten or burned, and also by the route's output slot scan when moved to a P2PKH. With the
 * root caller's own coin in a balanced pad slot, which keeps `tx.origin`, no input refuses the rewrite or the burn:
 * KNOWN OPEN, held as `it.fails` until a fix binds the leaf route's physical size or the verifier holds the band.
 */
import { describe, expect, it } from 'vitest';
import {
  bigIntToVmNumber, binToHex, disassembleAuthenticationInstructionsMaybeMalformed, encodeDataPush,
  encodeLockingBytecodeP2sh32, encodeTransaction, hash256, hexToBin,
} from '@bitauth/libauth';
import { OpcodesBch2026 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-opcodes.js';
import { compileString } from 'solidc';
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

// The graph test's ledger: two handler-managed mappings leave the trailing band out of a `tick`'s physical block,
// and `side` holds bytes, so a long value keeps value chunks.
const LEDGER = `contract LeafLedger() {
  int public count;
  mapping(int => bytes) side;
  mapping(int => int) public other;
  function tick() public { this.count = this.count + 1; require(true); }
  function put(int key, bytes value) public { this.side[key] = value; require(true); }
  function putOther(int key, int value) public { this.other[key] = value; require(true); }
}`;

const DRIVER = `interface ILeafLedger { function tick(); }
contract LeafDriver(address ledger) {
  function poke() public { ILeafLedger(ledger).tick(); require(true); }
}`;

// The ledger takes the graph test's options minus `messageBusGraphContext`; the driver keeps them.
const LEAF = {
  forceStateful: true, messageBus: true, messageBusKernel: true,
  maximumInputBytes: 1_000_000, suppressWarnings: true,
} as const;
const GRAPH = { ...LEAF, messageBusGraphContext: true } as const;

const KEY = 5n;
const VALUE = new Uint8Array(200).fill(0xab);
const OTHER_LOCK = Uint8Array.of(0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x66), 0x88, 0xac);
const TX_ORIGIN_REFUSAL = /OP_UNTIL OP_DROP OP_DUP OP_SIZE OP_NIP OP_0NOTEQUAL OP_VERIFY$/;
const VERIFIER_INDEX = '__internal__activeVerifierIndex';

type LibauthTransaction = ReturnType<TransactionBuilder['buildLibauthTransaction']>;
type LibauthOutput = LibauthTransaction['outputs'][number];
type Vm = ReturnType<typeof createVirtualMachineBch2026ForProvider>;
type Provider = ReturnType<typeof createMessageBusCapstoneTestProvider>;
type Artifact = ReturnType<typeof compileString>;
type Funder = Awaited<ReturnType<typeof createBareP2pkhFeeFunder>>;
type Fate = 'rewrite' | 'burn' | 'steal';
type Refusals = Array<{ inputIndex: number; at: string }>;

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
  readonly blockSize: number;
  readonly master: number;
  readonly physicalSize: number;
  readonly verifierInputs: number[];
  readonly rootVerifier: number;
  readonly feeIndex: number;
  /** The first balanced pad before the fee slot. */
  readonly pad: number;
}

interface RouteKind {
  readonly bound: boolean;
  readonly graph: boolean;
  readonly localCaller: boolean;
  /** The bytecode holds `OP_IF OP_DROP <(1 << B) - 2> OP_ENDIF`, the claim of the whole compile-time block. */
  readonly wholeBlockClaim: boolean;
}

let compiled: { ledger: Artifact; driver: Artifact } | undefined;

function artifacts(): { ledger: Artifact; driver: Artifact } {
  compiled ??= {
    ledger: compileString(LEDGER, { ...LEAF, messageBusHandlers: ['tick', 'put', 'putOther'] }),
    driver: compileString(DRIVER, GRAPH),
  };
  return compiled;
}

/** Whether `hex` holds `pattern` on a byte boundary. */
function holdsAt(hex: string, pattern: string): boolean {
  for (let at = hex.indexOf(pattern); at >= 0; at = hex.indexOf(pattern, at + 1)) if (at % 2 === 0) return true;
  return false;
}

function routeKind(artifact: Artifact): RouteKind {
  const route = artifact.messageBus!.route;
  const names = route.inputs.map((input) => input.name);
  const blockSize = BigInt(route.blockLayout?.blockSize ?? 0);
  const claim = binToHex(Uint8Array.from([
    0x63, 0x75, ...encodeDataPush(bigIntToVmNumber((1n << blockSize) - 2n)), 0x68,
  ]));
  const bodies = [artifact.debug?.bytecode ?? '', ...Object.values(artifact.functionBodies ?? {})];
  return {
    bound: names.includes(VERIFIER_INDEX),
    graph: names.some((name) => name.startsWith('__internal__graph')),
    localCaller: names.includes('__internal__msgSenderCategory'),
    wholeBlockClaim: blockSize > 0n && bodies.some((hex) => holdsAt(hex, claim)),
  };
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
function refusedInputs(vm: Vm, spend: Spend): Refusals {
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
async function valueChunkOf(provider: Provider, bus: StatefulContract, categoryId: string): Promise<Victim> {
  const slot = keyToSlot(bigIntToVmNumber(KEY));
  const root = sha256(VALUE);
  const masterLock = directConventionMasterLock(bus.inner);
  const redeem = scriptToBytecode(buildValueChunkCovenantScript(
    hexToBin(categoryId), computeCollectionHash(valueChunkSignature('side')), slot, root, masterLock,
  ));
  const lock = encodeLockingBytecodeP2sh32(hash256(redeem));
  expect(binToHex(lock)).toBe(binToHex(getValueChunkLockingBytecode(categoryId, 'side', slot, root, masterLock)));
  const chunks = splitValueIntoValueChunks(VALUE);
  const utxos = await provider.getUtxos(getValueChunkAddress(bus.inner, categoryId, 'side', slot, root));
  expect(utxos.length, 'the long value keeps its value chunks at the chunk lock').toBe(chunks.length);
  const chunk = utxos.find((utxo) => utxo.token?.nft?.commitment === buildValueChunkCommitment(0, chunks[0]!));
  expect(chunk?.token?.nft?.capability, 'value chunk 0 is a mutable NFT').toBe('mutable');
  return {
    txid: chunk!.txid, vout: chunk!.vout, redeem,
    source: solidCashOutputToLibauthOutput({ to: lock, amount: chunk!.satoshis, token: chunk!.token }),
  };
}

/** The honest compose driver.poke -> ledger.tick, with the ledger last, and the value chunk it leaves out. */
async function scenario(): Promise<Scenario> {
  const provider = createMessageBusCapstoneTestProvider();
  const { ledger, driver: driverArtifact } = artifacts();
  const blockSize = ledger.messageBus!.route.blockLayout?.blockSize ?? 0;
  const { contract: bus, categoryId } = await seeded(provider, ledger, [], { count: 0n });
  await bus.call.put(KEY, VALUE).send();
  const victim = await valueChunkOf(provider, bus, categoryId);
  const { contract: driver } = await seeded(provider, driverArtifact, [hexToBin(bus.inner.lockingBytecode)], {});
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
    provider, vm, bus, composed, honest, funder, victim, blockSize, master,
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

/** On a fresh chain, the chunk in the fee slot beside a root caller pad that pays the fee input's fee. */
async function rootPadAttack(fate: Fate): Promise<{ pad: number; refused: Refusals; outcome: string }> {
  const s = await scenario();
  const { honest, feeIndex } = s;
  const feePaid = honest.sourceOutputs[feeIndex]!.valueSatoshis - honest.transaction.outputs[feeIndex]!.valueSatoshis;
  const spend = signed(chunkInFeeSlot(s, await originInPad(s, honest, feePaid + 5_000n), fate), s.funder);
  return { pad: s.pad, refused: refusedInputs(s.vm, spend), outcome: await outcomeOf(s.provider, spend) };
}

describe('C3 leaf band: a value chunk in the fee slot of a default leaf callee\'s compose', () => {
  it('binds a claim-flag route, settles the honest compose and refuses the chunk by tx.origin', async () => {
    const { ledger, driver } = artifacts();
    const kinds = { ledger: routeKind(ledger), driver: routeKind(driver) };
    console.log('leaf band route kinds', JSON.stringify({
      ...kinds,
      ledgerInputs: ledger.messageBus!.route.inputs.map((input) => input.name)
        .filter((name) => name.startsWith('__')),
      eligible: ledger.messageBus!.handlers.filter((handler) => handler.eligible).map((handler) => handler.name),
      ledgerBytes: (ledger.debug?.bytecode.length ?? 0) / 2,
      verifierProgramBytes: (ledger.messageBus!.verifierProgram?.functions ?? [])
        .reduce((total, fn) => total + fn.bytecode.length / 2, 0),
    }));
    // A bound route that is not a graph route: no `__internal__graphBlockSize`, and the verifier's whole-block claim.
    expect.soft(kinds.ledger, 'the ledger route is bound with claim flags')
      .toEqual({ bound: true, graph: false, localCaller: false, wholeBlockClaim: true });
    expect.soft(kinds.driver.graph, 'the driver route is a graph route').toBe(true);

    const s = await scenario();
    const { vm, honest, master, blockSize, physicalSize, verifierInputs, rootVerifier, feeIndex } = s;
    expect(refusedInputs(vm, honest), 'honest compose').toEqual([]);
    console.log('leaf band geometry', JSON.stringify({
      master, physicalSize, blockSize, verifierInputs, rootVerifier, feeIndex, pad: s.pad,
    }));

    // [driver block | ledger block | one verifier per participant | fee]: the fee slot is P = 2 past the ledger's
    // physical block and inside its compile-time block [master, master + B), which the verifier's claim covers.
    expect.soft(verifierInputs, 'one verifier per participant')
      .toEqual([master + physicalSize, master + physicalSize + 1]);
    expect.soft(honest.sourceOutputs[feeIndex]!.token, 'the last input is the fee input').toBeUndefined();
    expect.soft(feeIndex).toBe(master + physicalSize + 2);
    expect.soft(feeIndex, 'the fee slot sits inside the compile-time block').toBeLessThan(master + blockSize);
    expect.soft(s.pad, 'a balanced pad sits in the ledger block').toBeGreaterThan(master);

    const refused = {} as Record<Fate, Refusals>;
    for (const fate of ['rewrite', 'burn', 'steal'] as const) {
      const spend = chunkInFeeSlot(s, honest, fate);
      expect.soft(verdict(vm, spend, feeIndex), `the entry write flag accepts the ${fate}`).toBe(true);
      refused[fate] = refusedInputs(vm, spend);
    }
    console.log('leaf band refusals', JSON.stringify(refused));
    // With the fee input gone no token-free P2PKH input is left, so the root verifier refuses at tx.origin.
    for (const fate of ['rewrite', 'burn'] as const) {
      const root = refused[fate].find((input) => input.inputIndex === rootVerifier);
      expect.soft(root?.at, `the root verifier's tx.origin refuses the ${fate}`).toMatch(TX_ORIGIN_REFUSAL);
    }
    expect.soft(refused.steal.map((input) => input.inputIndex), 'the route and the root verifier refuse the steal')
      .toEqual(expect.arrayContaining([master, rootVerifier]));

    await expect(s.provider.sendRawTransaction(s.composed.build())).resolves.toMatch(/^[0-9a-f]{64}$/);
    expect((await s.bus.getState()).count).toBe(1n);
  }, 300_000);

  // The root caller's own coin in a balanced pad slot keeps tx.origin, as in the graph test. The leaf route's claim
  // covers its whole compile-time block once the verifier ran, so its pin skips the fee slot, and the verifier
  // counts records only in the physical block. Each fate runs on a fresh chain: an accepted spend would make the
  // other a double spend.
  it.fails('KNOWN OPEN C3 leaf band value chunk: refuses a chunk in the fee slot rewritten or burned beside a root '
    + 'caller pad', async () => {
    const results = { rewrite: await rootPadAttack('rewrite'), burn: await rootPadAttack('burn') };
    console.log('leaf band root caller pad', JSON.stringify(results));
    for (const fate of ['rewrite', 'burn'] as const) {
      expect(results[fate].refused.length, `an input refuses the ${fate}`).toBeGreaterThan(0);
      expect(results[fate].outcome, `the node refuses the ${fate}`).not.toBe('ACCEPTED');
    }
  }, 600_000);
});
