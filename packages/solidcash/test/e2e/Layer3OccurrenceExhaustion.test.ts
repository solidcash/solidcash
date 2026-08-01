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
 * G2 - occurrence ordering and exact exhaustion for the compiler-bounded runtime-sized pointer table (G1).
 *
 * The compiled handler expands the loop into `bound` guarded callsites and consumes ONE canonical row per
 * reached occurrence out of `__internal__graphEmissions`, splitting the vector by the row it recomputes
 * locally and replacing the slot with the remainder. Its physical wrapper then requires that remainder to be
 * the empty vector. Order therefore comes from the persisted table (occurrence i must answer `handlers[i]`),
 * and exhaustion is the byte-exact partition of the whole vector.
 *
 * Every hostile case here builds a fully self-consistent transcript: the tampered row set is planned, the
 * canonical bytes are re-encoded and the controller commits to the RE-DERIVED root. Nothing is mutated after
 * derivation, so the caller covenant is the only thing left that can reject, and each negative pins the
 * failure to the caller's own master input rather than accepting any error.
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
type Tamper = 'none' | 'missing' | 'injected' | 'duplicated' | 'reordered' | 'argument';

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
  const honest = handlerSetups.map((_setup, index) => index);
  let reached: number[];
  if (tamper === 'missing') reached = honest.slice(0, rows - 1);
  else if (tamper === 'injected') reached = [...honest, honest[0]];
  else if (tamper === 'duplicated') reached = [honest[0], honest[0], ...honest.slice(2)];
  else if (tamper === 'reordered') reached = [honest[1], honest[0], ...honest.slice(2)];
  else reached = honest;

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
      parent: 0,
      callee: handlerOrder.indexOf(registration) + 1,
      function: honestFunction(registration),
      // Attacks the per-occurrence argument vector only: same participant, same selector, same position.
      args: [tamper === 'argument' && occurrence === 1 ? CALL_VALUE + 1n : CALL_VALUE],
      callMode: 'call' as const,
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
  expect(outcome).toContain('layer3 [L3_SCB_ENVELOPE_MALFORMED]: BCH-2026 preflight failed at input 0');
  expect(outcome).toContain(reason);
}

/** A reached row failed its byte-exact comparison against the row the caller recomputed. */
const ROW_MISMATCH = 'Program failed an OP_VERIFY operation.';
/** The vector ran out mid-partition: a reached occurrence had no row left to consume. */
const VECTOR_EXHAUSTED = 'Program called an OP_SPLIT operation with an invalid index';

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
describe('Layer-3 occurrence ordering and exact exhaustion (SEMANTIC)', () => {
  it('emits one row per reached occurrence, in persisted-table order', async () => {
    const built = await buildOccurrenceGraph(POINTER_TABLE_BOUND);
    const rows = decodeEmissionRows(built.transcript.participantEmissionsHex[0]);
    expect(rows).toHaveLength(POINTER_TABLE_BOUND);
    // Occurrence i answers persisted slot i: same order the source loop visits `handlers`.
    built.handlerOrder.forEach((registration, occurrence) => {
      const target = built.transcript.plan.participants[occurrence + 1].lockingBytecode;
      expect(rows[occurrence].targetHex).toBe(target);
      expect(registration).toBe(occurrence);
    });
    // Alternating registration makes the selector sequence observable rather than uniform, so a permuted
    // transcript is distinguishable by selector as well as by target.
    expect(rows.map((row) => row.selectorHex)).toEqual(
      built.handlerOrder.map((registration) => built.handlerSelector(honestFunction(registration))),
    );
    expect(new Set(rows.map((row) => row.selectorHex)).size).toBe(2);
    // Every reached occurrence carries the one canonical argument vector the source forwards.
    expect(new Set(rows.map((row) => row.argsHex)).size).toBe(1);
    layer3.preflightLayer3Transaction(built.builder);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 180_000);

  it.each([1, 2, 3])('settles an honest %i-occurrence transcript', async (rows) => {
    const built = await buildOccurrenceGraph(rows);
    layer3.preflightLayer3Transaction(built.builder);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 180_000);

  // MISSING. Attacks exhaustion from below: the persisted table still has three entries, so the expanded
  // covenant reaches three occurrences, but the transcript partitions only two rows and the third occurrence
  // has nothing left to split.
  it('rejects a transcript that omits a reached occurrence', async () => {
    const built = await buildOccurrenceGraph(POINTER_TABLE_BOUND, 'missing');
    expect(decodeEmissionRows(built.transcript.participantEmissionsHex[0]))
      .toHaveLength(POINTER_TABLE_BOUND - 1);
    expectCallerRejection(built, VECTOR_EXHAUSTED);
  }, 180_000);

  // INJECTED, at the full table. A fourth row is one more than the source's own `require(handlers.length <= 3)`
  // proves reachable, so X36 refuses it before a transcript exists - the same bound `deriveCompiledGraphPlan`
  // has always applied to this artifact, now applied to the rows this entry point is handed. The covenant
  // rejection this case used to demonstrate is preserved by the one below, whose surplus row stays inside the
  // published ceiling and therefore still reaches the VM.
  it('refuses an occurrence the source never reaches, ahead of the covenant that also rejects it', async () => {
    await expect(buildOccurrenceGraph(POINTER_TABLE_BOUND, 'injected')).rejects.toThrow(
      'layer3: callsite 0 was planned with 4 occurrences, above the 3 proven by a dominating require guard',
    );
  }, 180_000);

  // The decisive form of the same attack, and now the one that carries its VM evidence. With one persisted
  // entry the caller reaches exactly ONE occurrence, and row 0 is the same row the passing single-occurrence
  // control emits, so there is no second row for a per-row comparison to fail on. The surplus row is the only
  // difference from an accepted transaction, and two rows are within the published ceiling of three, so the
  // planner admits the plan and the caller's own covenant is what refuses it.
  it('rejects a surplus row when only one occurrence is reachable', async () => {
    const built = await buildOccurrenceGraph(1, 'injected');
    const rows = decodeEmissionRows(built.transcript.participantEmissionsHex[0]);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual(rows[0]);
    expect(rows[0].targetHex).toBe(built.transcript.plan.participants[1].lockingBytecode);
    expectCallerRejection(built, ROW_MISMATCH);
  }, 180_000);

  // DUPLICATED. Attacks the occurrence -> persisted-slot binding: occurrence 1 answers slot 0's participant a
  // second time instead of slot 1's.
  it('rejects a transcript that answers one occurrence twice', async () => {
    const built = await buildOccurrenceGraph(POINTER_TABLE_BOUND, 'duplicated');
    const rows = decodeEmissionRows(built.transcript.participantEmissionsHex[0]);
    expect(rows).toHaveLength(POINTER_TABLE_BOUND);
    expect(rows[1]).toEqual(rows[0]);
    expectCallerRejection(built, ROW_MISMATCH);
  }, 180_000);

  // REORDERED. Attacks ordering alone: the reached multiset, the participant set and the row count are all
  // honest; only occurrences 0 and 1 are exchanged, so nothing but position distinguishes it from the control.
  it('rejects a transcript whose occurrences are a permutation of the honest sequence', async () => {
    const built = await buildOccurrenceGraph(POINTER_TABLE_BOUND, 'reordered');
    const rows = decodeEmissionRows(built.transcript.participantEmissionsHex[0]);
    expect(rows).toHaveLength(POINTER_TABLE_BOUND);
    expect(new Set(rows.map((row) => row.targetHex)).size).toBe(POINTER_TABLE_BOUND);
    expectCallerRejection(built, ROW_MISMATCH);
  }, 180_000);

  // ARGUMENT. Attacks the per-occurrence argument vector with the participant, selector and position honest.
  it('rejects a transcript that substitutes one occurrence argument vector', async () => {
    const built = await buildOccurrenceGraph(POINTER_TABLE_BOUND, 'argument');
    const rows = decodeEmissionRows(built.transcript.participantEmissionsHex[0]);
    expect(rows[1].targetHex).toBe(built.transcript.plan.participants[2].lockingBytecode);
    expect(rows[1].argsHex).not.toBe(rows[0].argsHex);
    expectCallerRejection(built, ROW_MISMATCH);
  }, 180_000);

  // The admitted bound is a CEILING, not an exact count: the honest derivation path refuses a reached count
  // above it before any transaction is built, with a stable diagnostic.
  it('refuses an occurrence count above the published ceiling with a stable diagnostic', () => {
    const artifact = compileString(RUNTIME_SIZED_TABLE, {
      forceStateful: true,
      experimentalHiddenBatch: true,
      experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
      experimentalMessageBusControllerCategory: '22'.repeat(32),
    });
    const root = { artifact, lockingBytecode: '51' };
    expect(() => layer3.deriveCompiledGraphPlan({
      root,
      function: 'fireAll',
      args: [CALL_VALUE],
      targets: {},
      occurrence: () => POINTER_TABLE_BOUND + 1,
      dynamicCall: () => ({ participant: root, function: 'inc' }),
      // X36 made the ceiling leg the shared `occurrenceCountViolation` message, so it now names the bound and
      // where the compiler proved it. Stable in the sense that mattered: it is one string for one fault, and
      // it is the same string the other planning entry point reports for the same over-count.
    })).toThrow(
      'layer3: callsite 0 was planned with 4 occurrences, above the 3 proven by a dominating require guard',
    );
  });

  /**
   * The same rolled shape, now with the source bound the sibling case lacks.
   *
   * `ExpandBoundedPointerTableLoop` still expands only POINTER dispatches, so this loop keeps its rolled form
   * and the covenant is unchanged. What changed is that the ceiling the source proves reaches the artifact, so
   * the planner refuses an over-count here instead of admitting anything below the global transcript ceiling.
   */
  it('refuses an over-count for a rolled loop whose source bounds the trip count', () => {
    const options = {
      forceStateful: true,
      experimentalHiddenBatch: true,
      experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
      experimentalMessageBusControllerCategory: '22'.repeat(32),
    };
    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
interface IFoo { function bar(uint value); }
contract GuardedLoopPlainCall() {
  int n;
  function fireAll(uint value, address target) public {
    require(n <= 3);
    for (int i = 0; i < n; i = i + 1) { IFoo(target).bar(value); }
    require(value >= 0);
  }
}`, options);
    const calleeArtifact = compileString(`pragma solidcash >=0.8.0;
contract PlainTarget() {
  function bar(uint value) public pure { require(value > 0); }
}`, options);
    const row = callerArtifact.abi.find((fn) => fn.name === 'fireAll')!.externalCalls![0];
    expect(row.maximumOccurrences).toBe(3);
    expect(row.occurrenceBoundSource).toBe('guard');
    // A guard bounds from above only, so an under-count stays honest and must NOT gain a floor.
    expect(row.minimumOccurrences).toBeUndefined();
    const base = {
      root: { artifact: callerArtifact, lockingBytecode: '51' },
      function: 'fireAll',
      args: [CALL_VALUE, hexToBin('52')],
      targets: { IFoo: { artifact: calleeArtifact, lockingBytecode: '52' } },
    };
    expect(() => layer3.deriveCompiledGraphPlan({ ...base, occurrence: () => 4 }))
      .toThrow(
        'layer3: callsite 0 was planned with 4 occurrences, above the 3 proven by a dominating require guard',
      );
    expect(layer3.deriveCompiledGraphPlan({ ...base, occurrence: () => 3 }).invocations).toHaveLength(4);
  });

  /**
   * An unbounded loop has no finite transcript row ceiling. Both planners reject it before constructing a
   * graph, using the public structured diagnostic shared with the X36 unit matrix.
   */
  it('rejects an unbounded external-call loop with the exact structured diagnostic', () => {
    const options = {
      forceStateful: true,
      experimentalHiddenBatch: true,
      experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
      experimentalMessageBusControllerCategory: '22'.repeat(32),
    };
    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
interface IFoo { function bar(uint value); }
contract UnboundedLoopPlainCall() {
  int n;
  function fireAll(uint value, address target) public {
    for (int i = 0; i < n; i = i + 1) { IFoo(target).bar(value); }
    require(value >= 0);
  }
}`, options);
    const calleeArtifact = compileString(`pragma solidcash >=0.8.0;
contract PlainTarget() {
  function bar(uint value) public pure { require(value > 0); }
}`, options);
    expect(callerArtifact.abi.find((fn) => fn.name === 'fireAll')!.externalCalls![0].maximumOccurrences)
      .toBeUndefined();
    expect(() => layer3.deriveCompiledGraphPlan({
      root: { artifact: callerArtifact, lockingBytecode: '51' },
      function: 'fireAll',
      args: [CALL_VALUE, hexToBin('52')],
      targets: { IFoo: { artifact: calleeArtifact, lockingBytecode: '52' } },
      occurrence: () => 6,
    })).toThrowError(expect.objectContaining({
      code: 'L3_UNBOUNDED_EXTERNAL_CALL_LOOP',
      message: 'layer3 [L3_UNBOUNDED_EXTERNAL_CALL_LOOP]: '
        + 'unbounded-external-call-loop-transcript-ineligible: callsite 0',
    }));
  });
});
