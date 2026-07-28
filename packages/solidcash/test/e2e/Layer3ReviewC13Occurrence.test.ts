import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import {
  Contract, SignatureTemplate, StatefulContract, TransactionBuilder, layer3,
} from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import {
  createDataNftUnlocker, createReadOnlyDynamicChunkUnlocker, getDataNftAddress, getDynamicChunkAddress,
} from '../../src/stateful/covenant-helpers.js';

/**
 * Round-13 independent hostile review (Worker C): the COMPLETENESS of G2's occurrence-tamper set.
 *
 * G2 ships five tampers - missing, injected, duplicated, reordered and argument-substituted. All five are
 * spellings of ONE mechanism: the caller recomputes each reached row locally and splits it off the front of
 * `__internal__graphEmissions`, then requires the remainder empty, so the whole vector is pinned byte-exactly.
 * Completeness therefore follows from the mechanism, not from the enumeration - which is a claim worth testing
 * with tampers the shipped set does not contain.
 *
 * Three more, each naming a distinct row field the five do not isolate:
 *
 *   selector  occurrence 1 answers the SAME participant at the SAME position with the same argument vector,
 *             and only the method changes. `duplicated` and `reordered` both move the target as well.
 *   mode      the row's call-mode byte, which no shipped case touches at all.
 *   reparent  occurrence 1 is re-parented to another invocation, moving its row out of the caller's vector.
 *
 * All three reject at the caller's own master input. No occurrence-level escape was found.
 *
 * An honest limit on the shipped `argument` case, recorded because it is not an escape but is easy to
 * over-read: the source forwards a loop-invariant `value`, so every honest row carries the SAME argument
 * frame (the shipped fixture asserts exactly that). A cross-occurrence argument PERMUTATION is therefore
 * inexpressible in this shape, and `argument` demonstrates only that a value the source forwards at NO
 * occurrence is refused - not positional argument binding ACROSS occurrences.
 *
 * SEMANTIC evidence only, on the named `layer3-bch2026-semantic-relaxed-v1` profile.
 */

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);

function uniqueUtxo(seen: Set<string>, defaults?: Parameters<typeof randomUtxo>[0]): ReturnType<typeof randomUtxo> {
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const utxo = randomUtxo(defaults);
    const outpoint = `${utxo.txid}:${utxo.vout}`;
    if (seen.has(outpoint)) continue;
    seen.add(outpoint);
    return utxo;
  }
  throw new Error('could not draw a distinct funding outpoint');
}

const POINTER_TARGET = `pragma solidcash >=0.8.0;
contract CompiledPointerTarget(int brand) {
  function inc(uint value) public pure { require(value > 0); }
  function dec(uint value) public pure { require(value > 0); }
}`;

const POINTER_TABLE_BOUND = 3;

const RUNTIME_SIZED_TABLE = `pragma solidcash >=0.8.0;
interface IVaryingHandler { function inc(uint value); function dec(uint value); }
contract CompiledRuntimeSizedTable() {
  function(uint) external[] handlers;
  function registerInc(address target) public { this.handlers.push(IVaryingHandler(target).inc); require(true); }
  function registerDec(address target) public { this.handlers.push(IVaryingHandler(target).dec); require(true); }
  function fireAll(uint value) public {
    require(handlers.length <= 3);
    for (int i = 0; i < handlers.length; i = i + 1) { handlers[i](value); }
    require(value >= 0);
  }
}`;

type SemanticProvider = ReturnType<typeof createLayer3SemanticTestProvider>;

/** Registration alternates inc/dec, so occurrence i must answer selector `inc` for even i and `dec` for odd i. */
const honestFunction = (registrationIndex: number): string => (registrationIndex % 2 === 0 ? 'inc' : 'dec');

/**
 * How the transcript's reached-occurrence sequence is tampered with. `none` is the honest control; every other
 * mode names exactly one invariant of the caller's row partition.
 */
type Tamper = 'none' | 'selector' | 'mode' | 'reparent';

const CALL_VALUE = 4n;

async function createGraphAuthority(provider: SemanticProvider): Promise<any> {
  const projection = new Contract(compileString(layer3.generateGraphProjectionVerifier()), [], { provider });
  const controller = new Contract(
    compileString(layer3.generateGraphRootController(projection.lockingBytecode)), [alicePkh], { provider },
  );
  const genesis = await (provider as any).addTokenUtxosDynamic((_category: string) => [{
    address: controller.tokenAddress,
    satoshis: 3000n,
    token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } },
  }]);
  return {
    projection, controller, categoryId: genesis.categoryId as string, genesisUtxo: genesis.utxos[0],
  };
}

async function initializeGraphAuthority(
  provider: SemanticProvider,
  controller: Contract,
  genesisUtxo: any,
  categoryId: string,
  root: string,
  p2pkh: Contract,
  outpoints: Set<string>,
): Promise<any> {
  const fee = uniqueUtxo(outpoints, { satoshis: 20_000n });
  await provider.addUtxo(p2pkh.address, fee);
  const tx = new TransactionBuilder({ provider });
  tx.addInput(genesisUtxo, controller.unlock.initialize(hexToBin(root), alicePub, signature()));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({
    to: controller.tokenAddress, amount: genesisUtxo.satoshis,
    token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: root } },
  });
  tx.addOutput({ to: p2pkh.address, amount: 15_000n });
  await provider.sendRawTransaction(raw(tx));
  const rooted = (await provider.getUtxos(controller.tokenAddress))
    .find((utxo: any) => utxo.token?.nft?.commitment === root);
  if (!rooted) throw new Error('graph controller initialization did not create the rooted authority');
  return rooted;
}

interface BuiltGraph {
  provider: SemanticProvider;
  builder: TransactionBuilder;
  transaction: string;
  transcript: layer3.FinalizedCompiledGraph;
  /** Registration index of each co-spent handler, in participant order (participant 0 is the table). */
  handlerOrder: number[];
  /** Selector of a handler method, for asserting the emitted selector sequence. */
  handlerSelector: (name: string) => string;
}

/**
 * Assemble the whole balanced graph transaction for a persisted table of `rows` entries, planning the reached
 * occurrences according to `tamper`. Only the reached-occurrence SEQUENCE varies; the persisted table, the
 * source guard and the compiled artifacts are identical in every mode.
 */
async function buildOccurrenceGraph(rows: number, tamper: Tamper = 'none'): Promise<BuiltGraph> {
  const provider = createLayer3SemanticTestProvider();
  const outpoints = new Set<string>();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  };
  const handlerArtifact = compileString(POINTER_TARGET, options);
  const brands = Array.from({ length: rows }, (_, index) => BigInt(index + 2));
  const handlerSetups = await Promise.all(brands.map(async (brand) => {
    const base = new Contract(handlerArtifact, [brand], { provider });
    const setup = await setupStatefulUtxos(provider, base, handlerArtifact.stateLayout!, {});
    return { contract: base.withCategory(hexToBin(setup.categoryId)), setup, brand };
  }));
  const tableArtifact = compileString(RUNTIME_SIZED_TABLE, options);
  const tableBase = new Contract(tableArtifact, [], { provider });
  const tableSetup = await setupStatefulUtxos(
    provider, tableBase, tableArtifact.stateLayout!, { handlers: [], __fnsel_handlers: [] },
  );
  const table = tableBase.withCategory(hexToBin(tableSetup.categoryId));
  const tableStateful = StatefulContract.withCategory(tableBase, tableSetup.categoryId);
  for (const [index, setup] of handlerSetups.entries()) {
    if (honestFunction(index) === 'inc') await tableStateful.registerInc(setup.contract.lockingBytecode).send();
    else await tableStateful.registerDec(setup.contract.lockingBytecode).send();
  }
  const currentTable = await tableStateful.getFullState();
  if (!currentTable.masterUtxo || currentTable.dataNftUtxos.length !== 1) {
    throw new Error('occurrence fixture did not materialize its current master/data state');
  }

  // The honest reached sequence: occurrence i answers persisted slot i. Each tamper edits this sequence only.
  // The reached SEQUENCE is honest in every mode here: these three tampers move a field INSIDE a row, or the
  // row's parent, never which occurrences are reached. That is what makes them disjoint from the shipped five.
  const reached = handlerSetups.map((_setup, index) => index);

  // Physical owners: the table plus every distinct handler the reached sequence names, in first-reach order.
  const handlerOrder = [...new Set(reached)];
  const participants: layer3.CompiledGraphParticipant[] = [
    { artifact: tableArtifact, lockingBytecode: table.lockingBytecode },
    ...handlerOrder.map((index) => ({
      artifact: handlerArtifact, lockingBytecode: handlerSetups[index].contract.lockingBytecode,
    })),
  ];
  const invocations: layer3.CompiledGraphInvocation[] = [
    { parent: null, callee: 0, function: 'fireAll', args: [CALL_VALUE] },
    ...reached.map((registration, occurrence) => ({
      // `reparent` moves occurrence 1 under invocation 1, so its row leaves the caller's emission vector.
      parent: tamper === 'reparent' && occurrence === 1 ? 1 : 0,
      callee: handlerOrder.indexOf(registration) + 1,
      // `selector` swaps only the method: same participant, same position, same argument vector.
      function: tamper === 'selector' && occurrence === 1
        ? (honestFunction(registration) === 'inc' ? 'dec' : 'inc')
        : honestFunction(registration),
      args: [CALL_VALUE],
      // `mode` moves the row's call-mode byte and nothing else.
      callMode: (tamper === 'mode' && occurrence === 1 ? 'staticcall' : 'call') as const,
    })),
  ];
  const plan = layer3.planCompiledGraph(participants, invocations);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs,
    plan.participants.map(() => ''), layout.projectionInputs,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh, outpoints,
  );
  const projections = plan.participants.map(() => uniqueUtxo(outpoints, { satoshis: 1000n }));
  const fee = uniqueUtxo(outpoints, { satoshis: 120_000n });
  for (const proof of projections) await provider.addUtxo(projection.address, proof);
  await provider.addUtxo(p2pkh.address, fee);

  const dynamicVariables = tableArtifact.stateLayout!.variables.filter((variable) => variable.dynamic);
  const chunks: { variable: typeof dynamicVariables[number]; utxo: any; address: string }[] = [];
  for (const variable of dynamicVariables) {
    const address = getDynamicChunkAddress(table, tableSetup.categoryId, variable.name, variable.type);
    for (const utxo of await provider.getUtxos(address)) chunks.push({ variable, utxo, address });
  }
  const trailingCapacity = tableArtifact.hiddenBatch!.route.blockLayout!.trailingCapacity ?? 0;
  expect(chunks.length).toBeLessThanOrEqual(trailingCapacity);
  const trailingFunding = Array.from(
    { length: trailingCapacity - chunks.length }, () => uniqueUtxo(outpoints, { satoshis: 1000n }),
  );
  for (const funding of trailingFunding) await provider.addUtxo(p2pkh.address, funding);

  const tableRoute = table.createCompilerRouteUnlocker(
    tableArtifact.hiddenBatch!.route, hexToBin(tableArtifact.hiddenBatch!.selector),
  );
  const handlerRoute = (index: number): any => handlerSetups[index].contract.createCompilerRouteUnlocker(
    handlerArtifact.hiddenBatch!.route, hexToBin(handlerArtifact.hiddenBatch!.selector),
  );
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(
    currentTable.masterUtxo,
    tableRoute(...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any),
  );
  tx.addInput(
    currentTable.dataNftUtxos[0],
    createDataNftUnlocker(table, layout.participantInputs[0], tableSetup.categoryId),
  );
  for (const { variable, utxo } of chunks) {
    tx.addInput(utxo, createReadOnlyDynamicChunkUnlocker(
      table, layout.participantInputs[0], tableSetup.categoryId, variable.name, variable.type,
    ));
  }
  for (const funding of trailingFunding) tx.addInput(funding, p2pkh.unlock.spend(alicePub, signature()));
  handlerOrder.forEach((registration, index) => tx.addInput(
    handlerSetups[registration].setup.masterUtxo,
    handlerRoute(registration)(
      ...layer3.compiledGraphRouteArgs(transcript, index + 1, layout.controllerInput) as any,
    ),
  ));
  projections.forEach((proof, participant) => tx.addInput(
    proof,
    projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), BigInt(participant)),
  ));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));

  tx.addOutput({
    to: table.tokenAddress, amount: currentTable.masterUtxo.satoshis, token: currentTable.masterUtxo.token,
  });
  tx.addOutput({
    to: getDataNftAddress(table, tableSetup.categoryId),
    amount: currentTable.dataNftUtxos[0].satoshis,
    token: currentTable.dataNftUtxos[0].token,
  });
  for (const { address, utxo } of chunks) tx.addOutput({ to: address, amount: utxo.satoshis, token: utxo.token });
  for (const funding of trailingFunding) tx.addOutput({ to: p2pkh.address, amount: funding.satoshis });
  handlerOrder.forEach((registration) => tx.addOutput({
    to: handlerSetups[registration].contract.tokenAddress,
    amount: handlerSetups[registration].setup.masterUtxo.satoshis,
    token: handlerSetups[registration].setup.masterUtxo.token,
  }));
  for (let index = 0; index < projections.length + 1; index++) {
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
  }
  tx.addOutput({ to: p2pkh.address, amount: 10_000n });
  return {
    provider,
    builder: tx,
    transaction: raw(tx),
    transcript,
    handlerOrder,
    handlerSelector: (name: string): string =>
      handlerArtifact.abi.find((candidate) => candidate.name === name)!.selector!.toLowerCase(),
  };
}

/**
 * The caller's own covenant refused the transaction. `preflightLayer3Transaction` evaluates EVERY input on the
 * BCH-2026 VM and reports the first failing index, so naming input 0 - the pointer table's master, the only
 * script that partitions the emission vector - attributes the rejection to occurrence exhaustion rather than to
 * a downstream projection or funding failure.
 */
function expectCallerRejection(built: BuiltGraph, reason: string): void {
  let outcome = 'ACCEPTED';
  try {
    layer3.preflightLayer3Transaction(built.builder);
  } catch (error) {
    outcome = (error as Error).message;
  }
  expect(outcome).toContain('layer3: BCH-2026 preflight failed at input 0');
  expect(outcome).toContain(reason);
}

/** A reached row failed its byte-exact comparison against the row the caller recomputed. */
const ROW_MISMATCH = 'Program failed an OP_VERIFY operation.';
/** Decode the caller's emission vector: framed(target) || mode || selector[4] || framed(args) || framed(result). */
function decodeEmissionRows(emissionsHex: string): { targetHex: string; selectorHex: string; argsHex: string }[] {
  const bytes = hexToBin(emissionsHex);
  const rows: { targetHex: string; selectorHex: string; argsHex: string }[] = [];
  let cursor = 0;
  const frame = (): Uint8Array => {
    const length = bytes[cursor] | (bytes[cursor + 1] << 8);
    const value = bytes.slice(cursor + 2, cursor + 2 + length);
    cursor += 2 + length;
    return value;
  };
  while (cursor < bytes.length) {
    const target = frame();
    cursor += 1; // call mode
    const selector = bytes.slice(cursor, cursor + 4);
    cursor += 4;
    const args = frame();
    frame(); // result
    rows.push({ targetHex: binToHex(target), selectorHex: binToHex(selector), argsHex: binToHex(args) });
  }
  return rows;
}


// SEMANTIC evidence only, on the named layer3-bch2026-semantic-relaxed-v1 profile (BCH-2026 opcode,
// introspection and 128-byte-commitment behaviour, relaxed capacity). Not consensus-fit or policy-fit.
describe('Layer-3 round-13 review: occurrence tampers absent from G2 (SEMANTIC)', () => {
  /**
   * The shared honest control. Its selector sequence alternates and its argument frames are all identical, so
   * a selector substitution is observable and an argument substitution across occurrences is not - which is
   * the evidence limit recorded in this file's header.
   */
  it('honest control: three occurrences, two distinct selectors, one argument frame', async () => {
    const built = await buildOccurrenceGraph(POINTER_TABLE_BOUND);
    const rows = decodeEmissionRows(built.transcript.participantEmissionsHex[0]);
    expect(rows).toHaveLength(POINTER_TABLE_BOUND);
    expect(new Set(rows.map((row) => row.selectorHex)).size).toBe(2);
    expect(new Set(rows.map((row) => row.argsHex)).size).toBe(1);
    layer3.preflightLayer3Transaction(built.builder);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 300_000);

  /**
   * SELECTOR. Occurrence 1 answers the participant persisted at slot 1, at position 1, with the argument
   * vector the source forwards - and calls `inc` where the persisted pointer says `dec`. The honest control
   * emits two distinct selectors and this emits one, which is what pins that the substitution took effect and
   * that nothing else moved.
   */
  it('rejects a transcript that substitutes one occurrence selector', async () => {
    const built = await buildOccurrenceGraph(POINTER_TABLE_BOUND, 'selector');
    const rows = decodeEmissionRows(built.transcript.participantEmissionsHex[0]);
    expect(rows).toHaveLength(POINTER_TABLE_BOUND);
    // Same participant and same argument frame as the honest build; only the method moved.
    expect(rows[1].targetHex).toBe(built.transcript.plan.participants[2].lockingBytecode);
    expect(rows[1].argsHex).toBe(rows[0].argsHex);
    expect(new Set(rows.map((row) => row.selectorHex)).size).toBe(1);
    expectCallerRejection(built, ROW_MISMATCH);
  }, 300_000);

  /** MODE. The row's call-mode byte, which no shipped occurrence case touches. */
  it('rejects a transcript that substitutes one occurrence call mode', async () => {
    const built = await buildOccurrenceGraph(POINTER_TABLE_BOUND, 'mode');
    const rows = decodeEmissionRows(built.transcript.participantEmissionsHex[0]);
    expect(rows).toHaveLength(POINTER_TABLE_BOUND);
    // Target, selector and argument frame all stay honest - the mode byte is the only field that moved.
    expect(rows[1].targetHex).toBe(built.transcript.plan.participants[2].lockingBytecode);
    expect(new Set(rows.map((row) => row.selectorHex)).size).toBe(2);
    expect(new Set(rows.map((row) => row.argsHex)).size).toBe(1);
    expectCallerRejection(built, ROW_MISMATCH);
  }, 300_000);

  /**
   * REPARENT. Not a row-content attack at all: occurrence 1 is declared a child of invocation 1, so its row is
   * emitted into THAT participant's vector instead of the caller's. The caller then partitions two rows where
   * its expanded covenant reaches three.
   */
  it('rejects a transcript that re-parents one occurrence onto another participant', async () => {
    const built = await buildOccurrenceGraph(POINTER_TABLE_BOUND, 'reparent');
    const emissions = built.transcript.participantEmissionsHex;
    expect(decodeEmissionRows(emissions[0])).toHaveLength(POINTER_TABLE_BOUND - 1);
    // The row was moved, not deleted: participant 1 now owns it.
    expect(decodeEmissionRows(emissions[1])).toHaveLength(1);
    expectCallerRejection(built, ROW_MISMATCH);
  }, 300_000);
});
