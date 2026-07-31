import {
  bigIntToVmNumber, binToHex, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { buildInitialStateCommitments, scriptToBytecode } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import {
  Contract, MockNetworkProvider, SignatureTemplate, StatefulContract, TransactionBuilder, layer3,
} from '../../src/index.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../src/utils.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import {
  acceptedByNode, createLayer3SemanticTestProvider, dustOutputs, formatDustOutputs,
} from './layer3-semantic-profile.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import {
  createDataNftUnlocker, createReadOnlyDynamicChunkUnlocker, getDataNftAddress, getDynamicChunkAddress,
} from '../../src/stateful/covenant-helpers.js';

/**
 * C2 - the heterogeneous cycle capstone.
 *
 * Four independently compiled contracts compose one graph transaction:
 *
 *   inv0  root  -> HUB.fireAll     HUB local row 0
 *   inv1  HUB   -> LEG_B.credit    table occurrence 0
 *   inv2  LEG_B -> HUB.absorb      the RETURN EDGE; HUB local row 1
 *   inv3  HUB   -> LEG_C.debit     table occurrence 1
 *   inv4  LEG_C -> AUDIT_D.score   the only returning edge
 *
 * The hub is reached twice logically and co-spent once physically, so the A -> B -> A cycle is structural
 * rather than two participants agreeing on a label. Both table occurrences resolve their target AND their
 * selector out of persisted dynamic state, and the compiler publishes three possible target/selector pairs for
 * that one callsite, so neither field is implied by the other.
 *
 * Every hostile case plans its tampered graph, re-encodes the canonical transcript bytes and commits the
 * RE-DERIVED root. Nothing is mutated after derivation, so an accepted transcript is internally consistent and
 * only a covenant can reject it. Each negative names the exact failing input.
 *
 * The participant shapes here deliberately avoid one measured escape: a pointer-table caller stops
 * authenticating its emission rows as soon as its own contract declares any returning public handler, whether
 * or not that handler is ever invoked. See Layer3PointerTableRowEscape.test.ts. That is why the only returning
 * handler in this graph belongs to AUDIT_D, which owns no pointer table and makes no outgoing call.
 *
 * SEMANTIC evidence only, on the named layer3-bch2026-semantic-relaxed-v1 profile (BCH-2026 opcode,
 * introspection and 128-byte-commitment behaviour, relaxed capacity). Not consensus-fit or policy-fit.
 */

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);
/** One ABI value as the SCB1 row encodes it: a single minimal pushdata. */
const packedResult = (value: bigint): Uint8Array => scriptToBytecode([bigIntToVmNumber(value)]);
/** The aggregate return blob a route commits to its return-event NFT: the row's result vector, pushed once. */
const aggregateResult = (value: bigint): Uint8Array => scriptToBytecode([packedResult(value)]);
/** Read-back state values arrive as raw bytes or as hex, depending on the decoded type. */
const asHex = (value: unknown): string =>
  (value instanceof Uint8Array ? binToHex(value) : String(value)).toLowerCase();

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

/** Participant A. Dispatches through a persisted runtime-sized pointer table and is re-entered on `absorb`. */
const CYCLE_HUB = `pragma solidcash >=0.8.0;
interface ICycleLeg {
  function credit(uint value);
  function debit(uint value);
  function debitAlt(uint value);
}
contract CycleHub() {
  function(uint) external[] legs;
  uint total;
  function registerCredit(address target) public { this.legs.push(ICycleLeg(target).credit); require(true); }
  function registerDebit(address target) public { this.legs.push(ICycleLeg(target).debit); require(true); }
  function fireAll(uint value) public {
    require(legs.length <= 2);
    for (int i = 0; i < legs.length; i = i + 1) { legs[i](value); }
    require(value >= 0);
  }
  function absorb(uint credited) public {
    this.total = this.total + credited;
    require(credited > 0);
  }
}`;

/** Participant B. Closes the cycle by calling back into the hub. */
const CYCLE_LEG_B = `pragma solidcash >=0.8.0;
interface ICycleHub { function absorb(uint credited); }
contract CycleLegB(address hub) {
  uint seen;
  function credit(uint value) public {
    this.seen = this.seen + value;
    ICycleHub(hub).absorb(value);
    require(value > 0);
  }
}`;

/** Participant C. The second target/selector pair; two same-shape handlers make a selector attack meaningful. */
const CYCLE_LEG_C = `pragma solidcash >=0.8.0;
interface ICycleAudit { function score(uint value) returns (uint); }
contract CycleLegC(address auditor) {
  uint burned;
  function debit(uint value) public {
    uint scored = ICycleAudit(auditor).score(value);
    this.burned = this.burned + scored;
    require(value > 0);
  }
  function debitAlt(uint value) public {
    uint scored = ICycleAudit(auditor).score(value);
    this.burned = this.burned + scored + 1;
    require(value > 0);
  }
}`;

/** Participant D. The only returning participant, reached once and making no outgoing call. */
const CYCLE_AUDIT_D = `pragma solidcash >=0.8.0;
contract CycleAuditD(int brand) {
  uint reviews;
  function score(uint value) public returns (uint) {
    this.reviews = this.reviews + 1;
    require(value > 0 && brand >= 0);
    return value + 1;
  }
}`;

const CALL_VALUE = 4n;
/** A locking bytecode no participant owns; used to substitute a persisted table target. */
const FOREIGN_TARGET = `aa20${'44'.repeat(32)}87`;

/**
 * X59. Widened from `createLayer3SemanticTestProvider`'s mock-only return type to the union
 * `createTestProvider` returns, so `buildCycleGraph` can build this shape against a real BCHN regtest node
 * instead of only against `MockNetworkProvider`. The mock remains the default; nothing else moves.
 */
type SemanticProvider = ReturnType<typeof createTestProvider>;

/**
 * Ordinary BCH-2026 capacity, and a relaxed density ceiling for reading a true cost. Both are the ones C1 and
 * C3 already state: relay dust stays off (dust is policy, not consensus) and the hash-iteration allowance is 3
 * rather than 3.5, because the mock feeds one integer to both the standard and nonstandard knobs.
 */
const createOrdinaryCapacityProvider = (): SemanticProvider => new MockNetworkProvider({
  consensusLimits: {
    maximumInputBytes: 10_000,
    maximumStackItemBytes: 10_000,
    maximumTransactionBytes: 1_000_000,
    maximumNftCommitmentBytes: 128,
    operationCostBudgetPerByte: 800,
    hashDigestIterationsPerByte: 3,
  },
  policy: { enforceDust: false },
});

const RELAXED_BUDGET_LIMITS = {
  maximumInputBytes: 10_000,
  maximumStackItemBytes: 10_000,
  maximumTransactionBytes: 1_000_000,
  maximumNftCommitmentBytes: 128,
  operationCostBudgetPerByte: 800_000,
  hashDigestIterationsPerByte: 3_000,
};

/**
 * The one field each hostile case attacks. Every mode differs from `none` in exactly one authenticated field;
 * the sources, the compiled artifacts, the physical layout and every other field stay honest.
 */
type Tamper =
  | 'none'
  | 'target'
  | 'selector'
  | 'argument'
  | 'result'
  | 'hubPostState'
  | 'legPostState'
  | 'reordered'
  | 'missingReturnEdge'
  // ---- A1 review additions: fields the capstone authenticates but did not attack ----
  /** The persisted table holds ONE slot while the transcript declares two table occurrences. */
  | 'tableOverRun'
  /** The persisted table holds THREE slots while the transcript still declares two. */
  | 'tableUnderRun'
  /** The transcript names leg B's data NFT input as leg B's master input. */
  | 'participantInputLie'
  /** The transcript names a projection slot the auditor's proof does not physically occupy. */
  | 'projectionInputLie'
  /** The transcript names an output the return-event NFT does not physically occupy. */
  | 'returnOutputLie'
  /** Leg B's settled master keeps its commitment but loses its minting capability. */
  | 'masterCapability'
  /** Leg B's settled master keeps everything but its satoshi value. */
  | 'masterValue'
  /** Leg B's settled data NFT carries the honest commitment under the auditor's category. */
  | 'foreignCategory'
  /** Leg B's settled master carries the honest token to a locking bytecode leg B does not own. */
  | 'foreignOwner';

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
  return { projection, controller, categoryId: genesis.categoryId as string, genesisUtxo: genesis.utxos[0] };
}

async function initializeGraphAuthority(
  provider: SemanticProvider, controller: Contract, genesisUtxo: any, categoryId: string,
  root: string, p2pkh: Contract, outpoints: Set<string>,
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

interface BuiltCycle {
  provider: SemanticProvider;
  builder: TransactionBuilder;
  transaction: string;
  transcript: layer3.FinalizedCompiledGraph;
  artifacts: readonly any[];
  /** The HONEST physical layout, which every build assembles its transaction from. */
  layout: layer3.CompiledGraphPhysicalLayout;
  /** Physical master input of each participant, in participant order. */
  participantInputs: readonly number[];
  /** The hub's persisted dispatch table, read back from settled state: one target and one selector per slot. */
  persistedTargets: readonly string[];
  persistedSelectors: readonly string[];
  /** Settled data NFT commitments this transaction claims, in participant order. */
  claimedPostStates: readonly string[];
  /** Result bytes the only returning edge claims. */
  claimedResultHex: string;
}

async function buildCycleGraph(
  tamper: Tamper = 'none',
  createProvider: () => SemanticProvider = createLayer3SemanticTestProvider,
): Promise<BuiltCycle> {
  const provider = createProvider();
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
  const hubArtifact = compileString(CYCLE_HUB, options);
  const legBArtifact = compileString(CYCLE_LEG_B, options);
  const legCArtifact = compileString(CYCLE_LEG_C, options);
  const auditArtifact = compileString(CYCLE_AUDIT_D, options);

  // Construction order follows the dependency edges the SOURCES declare, and the hub reaches its legs only
  // through persisted state, so four independently compiled types compose with no circular dependency.
  const hubBase = new Contract(hubArtifact, [], { provider });
  const hubSetup = await setupStatefulUtxos(
    provider, hubBase, hubArtifact.stateLayout!, { total: 0n, legs: [], __fnsel_legs: [] },
  );
  const hub = hubBase.withCategory(hexToBin(hubSetup.categoryId));
  const auditBase = new Contract(auditArtifact, [9n], { provider });
  const auditSetup = await setupStatefulUtxos(provider, auditBase, auditArtifact.stateLayout!, { reviews: 0n });
  const audit = auditBase.withCategory(hexToBin(auditSetup.categoryId));
  const legBBase = new Contract(legBArtifact, [hub.lockingBytecode], { provider });
  const legBSetup = await setupStatefulUtxos(provider, legBBase, legBArtifact.stateLayout!, { seen: 0n });
  const legB = legBBase.withCategory(hexToBin(legBSetup.categoryId));
  const legCBase = new Contract(legCArtifact, [audit.lockingBytecode], { provider });
  const legCSetup = await setupStatefulUtxos(provider, legCBase, legCArtifact.stateLayout!, { burned: 0n });
  const legC = legCBase.withCategory(hexToBin(legCSetup.categoryId));

  // Persist the dispatch table. Slot 0 -> (B, credit) and slot 1 -> (C, debit): distinct targets AND distinct
  // selectors, so neither field can stand in for the other. The 'target' attack persists a foreign target in
  // slot 1 through the SAME registration handler, so the selector it writes is the honest one.
  const hubStateful = StatefulContract.withCategory(hubBase, hubSetup.categoryId);
  await hubStateful.registerCredit(legB.lockingBytecode).send();
  // 'tableOverRun' leaves slot 1 unwritten, so the persisted table holds ONE entry while the transcript below
  // still declares two table occurrences. Every other field of both occurrences stays honest.
  if (tamper !== 'tableOverRun') {
    await hubStateful.registerDebit(
      tamper === 'target' ? hexToBin(FOREIGN_TARGET) : legC.lockingBytecode,
    ).send();
  }
  // 'tableUnderRun' writes a THIRD slot the transcript never answers. Both table entries the transcript does
  // declare stay byte-identical to the control's, and the physical shape is unchanged: three 35-byte targets
  // still fit the one chunk two of them occupied.
  if (tamper === 'tableUnderRun') await hubStateful.registerCredit(legB.lockingBytecode).send();
  const currentHub = await hubStateful.getFullState();
  if (!currentHub.masterUtxo || currentHub.dataNftUtxos.length !== 1) {
    throw new Error('cycle fixture did not materialize the hub master/data state');
  }

  const participants: layer3.CompiledGraphParticipant[] = [
    { artifact: hubArtifact, lockingBytecode: hub.lockingBytecode },
    { artifact: legBArtifact, lockingBytecode: legB.lockingBytecode },
    { artifact: legCArtifact, lockingBytecode: legC.lockingBytecode },
    { artifact: auditArtifact, lockingBytecode: audit.lockingBytecode },
  ];
  const legFunction = tamper === 'selector' ? 'debitAlt' : 'debit';
  // The C subtree stays internally consistent under the argument attack: C really is invoked with the value
  // the transcript states, and D really scores that value. The single divergence is that the hub's source
  // forwards its own `value` to occurrence 1 while the transcript states a different one.
  const legValue = tamper === 'argument' ? CALL_VALUE + 1n : CALL_VALUE;
  const honestScore = legValue + 1n;
  const claimedScore = tamper === 'result' ? honestScore + 1n : honestScore;
  const creditEdge: layer3.CompiledGraphInvocation = {
    parent: 0, callee: 1, function: 'credit', args: [CALL_VALUE], callMode: 'call',
  };
  const absorbEdge = (parent: number): layer3.CompiledGraphInvocation => ({
    parent, callee: 0, function: 'absorb', args: [CALL_VALUE], callMode: 'call',
  });
  const debitEdge: layer3.CompiledGraphInvocation = {
    parent: 0, callee: 2, function: legFunction, args: [legValue], callMode: 'call',
  };
  const scoreEdge = (parent: number): layer3.CompiledGraphInvocation => ({
    parent, callee: 3, function: 'score', args: [legValue], callMode: 'call',
  });
  // 'reordered' exchanges the two table occurrences, moving the B -> A return edge from occurrence 0 to
  // occurrence 1. 'missingReturnEdge' drops the B -> A edge entirely.
  const orderedEdges = tamper === 'reordered'
    ? [debitEdge, scoreEdge(1), creditEdge, absorbEdge(3)]
    : tamper === 'missingReturnEdge'
      ? [creditEdge, debitEdge, scoreEdge(2)]
      : [creditEdge, absorbEdge(1), debitEdge, scoreEdge(3)];
  const invocations: layer3.CompiledGraphInvocation[] = [
    { parent: null, callee: 0, function: 'fireAll', args: [CALL_VALUE] },
    ...orderedEdges,
  ];
  const plan = layer3.planCompiledGraph(participants, invocations);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const resultVectors = plan.participants.map((participant) =>
    (participant.batch.results.length > 0 ? binToHex(packedResult(claimedScore)) : ''));
  const invocationResults: Record<number, string> = {};
  plan.invocations.forEach((invocation) => {
    if (invocation.resultTypes.length > 0) {
      invocationResults[invocation.index] = binToHex(packedResult(claimedScore));
    }
  });
  // Physical binding lies. The transaction is assembled from the HONEST `layout` throughout; only the numbers
  // the transcript states about where each participant, proof and return NFT physically sits are moved. Each
  // stays inside what `finalizeCompiledGraph` will accept - strictly increasing, uint16, no collision with a
  // participant input - so the SDK admits them and only a covenant can refuse.
  const claimedParticipantInputs = tamper === 'participantInputLie'
    ? layout.participantInputs.map((input, index) => (index === 1 ? input + 1 : input))
    : layout.participantInputs;
  const claimedProjectionInputs = tamper === 'projectionInputLie'
    ? layout.projectionInputs.map((input, index) => (index === 3 ? input + 1 : input))
    : layout.projectionInputs;
  const claimedReturnOutputs = tamper === 'returnOutputLie'
    ? layout.returnOutputs!.map((output, index) => (index === 3 ? output! - 1 : output))
    : layout.returnOutputs!;
  const transcript = layer3.finalizeCompiledGraph(
    plan, invocationResults, claimedParticipantInputs, claimedReturnOutputs, resultVectors,
    claimedProjectionInputs,
  );

  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh, outpoints,
  );
  const projections = plan.participants.map(() => uniqueUtxo(outpoints, { satoshis: 1000n }));
  for (const proof of projections) await provider.addUtxo(projection.address, proof);
  const fee = uniqueUtxo(outpoints, { satoshis: 300_000n });
  await provider.addUtxo(p2pkh.address, fee);

  // The hub's persisted table lives in chunk UTXOs inside the hub's own trailing region.
  const dynamicVariables = hubArtifact.stateLayout!.variables.filter((variable: any) => variable.dynamic);
  const chunks: { variable: any; utxo: any; address: string }[] = [];
  for (const variable of dynamicVariables) {
    const address = getDynamicChunkAddress(hub, hubSetup.categoryId, variable.name, variable.type);
    for (const utxo of await provider.getUtxos(address)) chunks.push({ variable, utxo, address });
  }
  const hubLayout = hubArtifact.hiddenBatch!.route.blockLayout!;
  expect(chunks.length).toBeLessThanOrEqual(hubLayout.trailingCapacity ?? 0);
  // Slot kinds by offset, so the hub block is assembled from the compiler-published layout rather than from
  // hard-coded offsets: a shape change moves nothing in this harness.
  const hubSlotKind = new Map<number, string>(hubLayout.slots.map((slot: any) => [slot.offset, slot.kind]));
  const fillers = Array.from(
    { length: hubLayout.blockSize - 2 - chunks.length }, () => uniqueUtxo(outpoints, { satoshis: 1000n }),
  );
  for (const funding of fillers) await provider.addUtxo(p2pkh.address, funding);
  const auditReturnFunding = uniqueUtxo(outpoints, { satoshis: 1000n });
  await provider.addUtxo(p2pkh.address, auditReturnFunding);

  const routeFor = (contract: Contract, artifact: any): any => contract.createCompilerRouteUnlocker(
    artifact.hiddenBatch.route, hexToBin(artifact.hiddenBatch.selector),
  );

  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  // Hub block, walked slot by slot. The chunk UTXOs holding the persisted table occupy the head of the
  // trailing region; every other non-master, non-data slot is ordinary funding on the input side.
  let chunkCursor = 0;
  let fillerCursor = 0;
  for (let offset = 0; offset < hubLayout.blockSize; offset += 1) {
    const kind = hubSlotKind.get(offset);
    if (kind === 'master') {
      tx.addInput(currentHub.masterUtxo, routeFor(hub, hubArtifact)(
        ...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any,
      ));
    } else if (kind === 'dataNft') {
      tx.addInput(
        currentHub.dataNftUtxos[0],
        createDataNftUnlocker(hub, layout.participantInputs[0], hubSetup.categoryId),
      );
    } else if (kind === 'trailing' && chunkCursor < chunks.length) {
      const { variable, utxo } = chunks[chunkCursor];
      chunkCursor += 1;
      tx.addInput(utxo, createReadOnlyDynamicChunkUnlocker(
        hub, layout.participantInputs[0], hubSetup.categoryId, variable.name, variable.type,
      ));
    } else {
      tx.addInput(fillers[fillerCursor], p2pkh.unlock.spend(alicePub, signature()));
      fillerCursor += 1;
    }
  }
  // Leg blocks: master plus data NFT.
  tx.addInput(legBSetup.masterUtxo, routeFor(legB, legBArtifact)(
    ...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput) as any,
  ));
  tx.addInput(
    legBSetup.dataNftUtxos[0],
    createDataNftUnlocker(legB, layout.participantInputs[1], legBSetup.categoryId),
  );
  tx.addInput(legCSetup.masterUtxo, routeFor(legC, legCArtifact)(
    ...layer3.compiledGraphRouteArgs(transcript, 2, layout.controllerInput) as any,
  ));
  tx.addInput(
    legCSetup.dataNftUtxos[0],
    createDataNftUnlocker(legC, layout.participantInputs[2], legCSetup.categoryId),
  );
  // The auditor block additionally reserves the return-event slot; its input side is ordinary funding.
  tx.addInput(auditSetup.masterUtxo, routeFor(audit, auditArtifact)(
    ...layer3.compiledGraphRouteArgs(transcript, 3, layout.controllerInput) as any,
    BigInt(layout.returnOutputs![3]!),
  ));
  tx.addInput(
    auditSetup.dataNftUtxos[0],
    createDataNftUnlocker(audit, layout.participantInputs[3], auditSetup.categoryId),
  );
  tx.addInput(auditReturnFunding, p2pkh.unlock.spend(alicePub, signature()));
  projections.forEach((proof, participant) => tx.addInput(
    proof, projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), BigInt(participant)),
  ));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));

  // The hub's data NFT commitment is one minimally encoded pushdata per state field, and the cycle writes only
  // the leading scalar; the two dynamic table fields carry chunk headers no initial-state builder reproduces.
  // So the hub's post-state is the CURRENT commitment with exactly the scalar field replaced.
  const hubTotal = tamper === 'missingReturnEdge' ? 0n : CALL_VALUE;
  const currentHubCommitment: string = currentHub.dataNftUtxos[0].token.nft.commitment;
  const zeroFieldHex = binToHex(scriptToBytecode([bigIntToVmNumber(0n)]));
  expect(currentHubCommitment.startsWith(zeroFieldHex)).toBe(true);
  const hubNext = binToHex(scriptToBytecode([
    bigIntToVmNumber(tamper === 'hubPostState' ? hubTotal + 1n : hubTotal),
  ])) + currentHubCommitment.slice(zeroFieldHex.length);
  const legBNext = buildInitialStateCommitments(legBArtifact.stateLayout!, {
    seen: tamper === 'legPostState' ? CALL_VALUE + 1n : CALL_VALUE,
  })[0];
  const legCNext = buildInitialStateCommitments(legCArtifact.stateLayout!, {
    burned: legFunction === 'debitAlt' ? claimedScore + 1n : claimedScore,
  })[0];
  const auditNext = buildInitialStateCommitments(auditArtifact.stateLayout!, { reviews: 1n })[0];

  // The hub's output block mirrors its input block slot for slot.
  let chunkOutCursor = 0;
  for (let offset = 0; offset < hubLayout.blockSize; offset += 1) {
    const kind = hubSlotKind.get(offset);
    if (kind === 'master') {
      tx.addOutput({
        to: hub.tokenAddress, amount: currentHub.masterUtxo.satoshis,
        token: { category: hubSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      });
    } else if (kind === 'dataNft') {
      tx.addOutput({
        to: getDataNftAddress(hub, hubSetup.categoryId), amount: currentHub.dataNftUtxos[0].satoshis,
        token: {
          category: hubSetup.categoryId, amount: 0n, nft: { capability: 'mutable', commitment: hubNext },
        },
      });
    } else if (kind === 'trailing' && chunkOutCursor < chunks.length) {
      const { address, utxo } = chunks[chunkOutCursor];
      chunkOutCursor += 1;
      tx.addOutput({ to: address, amount: utxo.satoshis, token: utxo.token });
    } else {
      tx.addOutput({ to: p2pkh.address, amount: 1000n });
    }
  }
  // `attacked` is leg B only: each resource-preservation mode moves exactly ONE property of leg B's settled
  // pair - capability, satoshi value, category or owning locking bytecode - and leaves the commitment, the
  // transcript and every other participant's block untouched.
  const settle = (contract: Contract, setup: any, commitment: string, attacked = false): void => {
    tx.addOutput({
      to: attacked && tamper === 'foreignOwner' ? audit.tokenAddress : contract.tokenAddress,
      amount: attacked && tamper === 'masterValue'
        ? setup.masterUtxo.satoshis - 100n : setup.masterUtxo.satoshis,
      token: {
        category: setup.categoryId,
        amount: 0n,
        nft: {
          capability: attacked && tamper === 'masterCapability' ? 'mutable' : 'minting',
          commitment: '',
        },
      },
    });
    tx.addOutput({
      to: getDataNftAddress(contract, setup.categoryId), amount: setup.dataNftUtxos[0].satoshis,
      token: {
        category: attacked && tamper === 'foreignCategory' ? auditSetup.categoryId : setup.categoryId,
        amount: 0n,
        nft: { capability: 'mutable', commitment },
      },
    });
  };
  settle(legB, legBSetup, legBNext, true);
  settle(legC, legCSetup, legCNext);
  settle(audit, auditSetup, auditNext);
  tx.addOutput({
    to: hexToBin('51'), amount: 1000n,
    token: {
      category: auditSetup.categoryId, amount: 0n,
      nft: { capability: 'none', commitment: binToHex(aggregateResult(claimedScore)) },
    },
  });
  for (let slot = 0; slot < projections.length + 1; slot += 1) {
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
  }
  tx.addOutput({ to: p2pkh.address, amount: 30_000n });

  return {
    provider,
    builder: tx,
    transaction: raw(tx),
    transcript,
    artifacts: [hubArtifact, legBArtifact, legCArtifact, auditArtifact],
    layout,
    participantInputs: layout.participantInputs,
    persistedTargets: (currentHub.state.legs as unknown[]).map(asHex),
    persistedSelectors: (currentHub.state.__fnsel_legs as unknown[]).map(asHex),
    claimedPostStates: [hubNext, legBNext, legCNext, auditNext].map((value) => value.toLowerCase()),
    claimedResultHex: binToHex(packedResult(claimedScore)),
  };
}

/** Decode a caller's emission vector: framed(target) || mode || selector[4] || framed(args) || framed(result). */
function decodeEmissionRows(
  emissionsHex: string,
): { targetHex: string; selectorHex: string; argsHex: string; resultHex: string }[] {
  const bytes = hexToBin(emissionsHex);
  const rows: { targetHex: string; selectorHex: string; argsHex: string; resultHex: string }[] = [];
  let cursor = 0;
  const frame = (): Uint8Array => {
    const length = bytes[cursor] | (bytes[cursor + 1] << 8);
    const value = bytes.slice(cursor + 2, cursor + 2 + length);
    cursor += 2 + length;
    return value;
  };
  while (cursor < bytes.length) {
    const target = frame();
    cursor += 1;
    const selector = bytes.slice(cursor, cursor + 4);
    cursor += 4;
    const args = frame();
    const result = frame();
    rows.push({
      targetHex: binToHex(target), selectorHex: binToHex(selector),
      argsHex: binToHex(args), resultHex: binToHex(result),
    });
  }
  return rows;
}

/** Assert the transaction is refused by a specific participant's own covenant, not by anything downstream. */
function expectRejectionAtInput(built: BuiltCycle, input: number): string {
  let outcome = 'ACCEPTED';
  try {
    layer3.preflightLayer3Transaction(built.builder);
  } catch (error) {
    outcome = (error as Error).message;
  }
  expect(outcome).toContain(`layer3: BCH-2026 preflight failed at input ${input}`);
  return outcome;
}

const scriptRefusalAt = (input: number): RegExp => new RegExp(
  `mandatory-script-verify-flag-failed .*error in evaluating input index ${input}:`,
);

const abiSelector = (artifact: any, name: string): string =>
  artifact.abi.find((entry: any) => entry.name === name).selector.toLowerCase();

/**
 * The honest target/selector/argument shape of a build, read out of that SAME build. Two builds mint fresh
 * categories, so every participant locking bytecode differs between them and cross-build comparison of these
 * fields is meaningless - the capstone's own note, and it applies to the review cases below too.
 */
const honestShapeOf = (built: BuiltCycle): { targets: string[]; selectors: string[]; args: string[] } => ({
  targets: [
    built.transcript.plan.participants[1].lockingBytecode,
    built.transcript.plan.participants[2].lockingBytecode,
  ],
  selectors: [abiSelector(built.artifacts[1], 'credit'), abiSelector(built.artifacts[2], 'debit')],
  args: [binToHex(packedResult(CALL_VALUE)), binToHex(packedResult(CALL_VALUE))],
});

/** The physical input a covenant refused at, or `null` when the whole transaction was accepted. */
function rejectionIndex(built: BuiltCycle): number | null {
  try {
    layer3.preflightLayer3Transaction(built.builder);
    return null;
  } catch (error) {
    const match = (error as Error).message.match(/preflight failed at input (\d+)/);
    if (!match) throw error;
    return Number(match[1]);
  }
}

/**
 * A1 - independent hostile review of C2. Written by the worker that built C1, not by C2's author.
 *
 * Every case below attacks a field C2 authenticates but did not attack, and each is measured against an
 * honest control built by the same function, differing in exactly the named field. Each names the physical
 * input that refused it.
 */
describe('A1 review of C2: fields the capstone authenticates but did not attack', () => {
  // WHOLE-TABLE EXHAUSTION, over-run. The persisted table holds ONE slot; the transcript still declares two
  // table occurrences with honest targets, selectors and arguments. Nothing else moves: three participants
  // still settle, the block shapes are identical, and both dynamic fields still occupy one chunk each.
  //
  // This is the direction C2's own scoping note leaves open. C2 records that `minimumOccurrences` is
  // undefined for a runtime-sized table, so nothing in the file proves the loop must run at all - and it does
  // not test omitting or adding an occurrence. Claiming a dispatch the persisted table does not authorize is
  // the exploitable half of that gap, and it is refused by the hub's own route, at input 0.
  //
  // SCOPED the same way as the under-run case below: this establishes the PROPERTY, not the mechanism. With
  // one slot persisted, a row-count comparison and an in-range check on `legs[1]` are both in a position to
  // reject, and this case does not separate them.
  it('rejects a transcript that claims more table occurrences than the persisted table holds', async () => {
    const built = await buildCycleGraph('tableOverRun');
    const honestBuild = await buildCycleGraph();
    expect(rejectionIndex(honestBuild)).toBeNull();
    // One field differs: the table's length. Both declared occurrences are still the honest pair.
    expect(honestBuild.persistedTargets).toHaveLength(2);
    expect(built.persistedTargets).toHaveLength(1);
    const rows = decodeEmissionRows(built.transcript.participantEmissionsHex[0]);
    expect(rows).toHaveLength(2);
    expect(rows[0].targetHex).toBe(built.transcript.plan.participants[1].lockingBytecode);
    expect(rows[1].targetHex).toBe(built.transcript.plan.participants[2].lockingBytecode);
    expect(rows[0].selectorHex).toBe(abiSelector(built.artifacts[1], 'credit'));
    expect(rows[1].selectorHex).toBe(abiSelector(built.artifacts[2], 'debit'));
    expect(rows.map((row) => row.argsHex))
      .toEqual([binToHex(packedResult(CALL_VALUE)), binToHex(packedResult(CALL_VALUE))]);
    expect(built.participantInputs).toEqual(honestBuild.participantInputs);
    expect(rejectionIndex(built)).toBe(built.participantInputs[0]);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(scriptRefusalAt(built.participantInputs[0]));
  }, 600_000);

  // WHOLE-TABLE EXHAUSTION, under-run. The persisted table holds THREE slots and the transcript answers two.
  //
  // SCOPED: this case does NOT isolate which check refuses it. With three entries the hub's own source guard
  // `require(legs.length <= 2)` also fails, so a row-count comparison and the guard are both in a position to
  // reject. Isolating the comparison needs a table of two answered by one occurrence, and that cannot be built
  // inside this fixture: dropping occurrence 1 leaves leg C and the auditor with no invocation, which the
  // planner refuses outright, so the participant count and the whole physical shape would have to change.
  it('rejects a transcript that answers fewer table occurrences than the persisted table holds', async () => {
    const built = await buildCycleGraph('tableUnderRun');
    const honestBuild = await buildCycleGraph();
    expect(rejectionIndex(honestBuild)).toBeNull();
    const shape = honestShapeOf(built);
    expect(built.persistedTargets).toHaveLength(3);
    expect(built.persistedTargets.slice(0, 2)).toEqual(shape.targets);
    expect(built.persistedSelectors.slice(0, 2)).toEqual(shape.selectors);
    // The unanswered third slot repeats slot 0's pair, so no new target or selector enters the fixture.
    expect(built.persistedTargets[2]).toBe(shape.targets[0]);
    expect(built.persistedSelectors[2]).toBe(shape.selectors[0]);
    const rows = decodeEmissionRows(built.transcript.participantEmissionsHex[0]);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.targetHex)).toEqual(shape.targets);
    expect(rows.map((row) => row.selectorHex)).toEqual(shape.selectors);
    expect(rows.map((row) => row.argsHex)).toEqual(shape.args);
    expect(built.participantInputs).toEqual(honestBuild.participantInputs);
    expect(rejectionIndex(built)).toBe(built.participantInputs[0]);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(scriptRefusalAt(built.participantInputs[0]));
  }, 600_000);

  // PHYSICAL INPUT BINDING. The transcript names leg B's DATA NFT input as leg B's master input - one index
  // higher, still strictly increasing, still not colliding with another participant, so the SDK admits it.
  // The transaction itself is assembled from the honest layout, so leg B's route really does execute one
  // input below where the transcript says it does.
  it('rejects a transcript that names the wrong physical input for a participant', async () => {
    const built = await buildCycleGraph('participantInputLie');
    const honestBuild = await buildCycleGraph();
    expect(rejectionIndex(honestBuild)).toBeNull();
    expect(built.transcript.participantInputs[1]).toBe(built.layout.participantInputs[1] + 1);
    expect([...built.transcript.participantInputs].filter(
      (input, index) => input !== built.layout.participantInputs[index],
    )).toHaveLength(1);
    expect(built.claimedPostStates).toEqual(honestBuild.claimedPostStates.map(
      (state, index) => (index === 0 ? built.claimedPostStates[0] : state),
    ));
    expect(rejectionIndex(built)).toBe(built.layout.participantInputs[1]);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(scriptRefusalAt(built.layout.participantInputs[1]));
  }, 600_000);

  // PHYSICAL PROOF BINDING. The transcript names a projection slot the auditor's proof does not occupy.
  // Note WHERE this is caught: not at the moved slot, but at the FIRST projection input, so the projection
  // covenant validates the whole declared proof region rather than only its own row.
  it('rejects a transcript that names the wrong projection slot for a participant', async () => {
    const built = await buildCycleGraph('projectionInputLie');
    const honestBuild = await buildCycleGraph();
    expect(rejectionIndex(honestBuild)).toBeNull();
    expect(built.transcript.projectionInputs[3]).toBe(built.layout.projectionInputs[3] + 1);
    expect([...built.transcript.projectionInputs].filter(
      (input, index) => input !== built.layout.projectionInputs[index],
    )).toHaveLength(1);
    expect(rejectionIndex(built)).toBe(built.layout.projectionInputs[0]);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(scriptRefusalAt(built.layout.projectionInputs[0]));
  }, 600_000);

  // PHYSICAL OUTPUT BINDING. The transcript names an output the return-event NFT does not occupy, while the
  // auditor's own route unlocker is still handed the honest index.
  //
  // Worth recording for the F phase: the auditor's route at input 70 accepts this transaction - it checks the
  // output index it was handed, which is honest - and the GRAPH ROOT CONTROLLER is what refuses it. The
  // return-output binding is enforced centrally, not by the participant that produces the result.
  it('rejects a transcript that names the wrong return-event output', async () => {
    const built = await buildCycleGraph('returnOutputLie');
    const honestBuild = await buildCycleGraph();
    expect(rejectionIndex(honestBuild)).toBeNull();
    expect(built.transcript.returnOutputs[3]).toBe(built.layout.returnOutputs![3]! - 1);
    expect(built.transcript.returnOutputs.slice(0, 3)).toEqual([null, null, null]);
    expect(built.claimedResultHex).toBe(honestBuild.claimedResultHex);
    expect(rejectionIndex(built)).toBe(built.layout.controllerInput);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(scriptRefusalAt(built.layout.controllerInput));
  }, 600_000);

  // RESOURCE PRESERVATION. Four properties of one settled pair, one per case, with the authenticated post-state
  // commitment and the whole transcript held honest in all four.
  it.each([
    ['capability', 'masterCapability' as Tamper],
    ['satoshi value', 'masterValue' as Tamper],
    ['token category', 'foreignCategory' as Tamper],
    ['owning locking bytecode', 'foreignOwner' as Tamper],
  ])('rejects a settled participant whose %s is not preserved', async (_label, tamper) => {
    const built = await buildCycleGraph(tamper);
    const honestBuild = await buildCycleGraph();
    expect(rejectionIndex(honestBuild)).toBeNull();
    // The commitment - the only resource property C2 already attacked - is the honest one in all four, and so
    // is every dispatch field, checked inside this build.
    const shape = honestShapeOf(built);
    const rows = decodeEmissionRows(built.transcript.participantEmissionsHex[0]);
    expect(built.claimedPostStates[1]).toBe(honestBuild.claimedPostStates[1]);
    expect(rows.map((row) => row.targetHex)).toEqual(shape.targets);
    expect(rows.map((row) => row.selectorHex)).toEqual(shape.selectors);
    expect(rows.map((row) => row.argsHex)).toEqual(shape.args);
    expect(built.persistedTargets).toEqual(shape.targets);
    expect(rejectionIndex(built)).toBe(built.layout.participantInputs[1]);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(scriptRefusalAt(built.layout.participantInputs[1]));
  }, 600_000);

  // OWNER UNIQUENESS. C3 attacks this at the VM by patching a transcript; C2 has no such case. Within C2's
  // shape the planner refuses it before a transcript exists, so the VM-level form is not reachable from here.
  it('refuses two participant rows naming one physical owner, before a transcript exists', async () => {
    const built = await buildCycleGraph();
    const rows = built.transcript.plan.participants.map((participant, index) => ({
      artifact: built.artifacts[index], lockingBytecode: participant.lockingBytecode,
    }));
    expect(() => layer3.planCompiledGraph([...rows, rows[1]] as any, [
      { parent: null, callee: 0, function: 'fireAll', args: [CALL_VALUE] },
      { parent: 0, callee: 1, function: 'credit', args: [CALL_VALUE], callMode: 'call' },
      { parent: 1, callee: 0, function: 'absorb', args: [CALL_VALUE], callMode: 'call' },
      { parent: 0, callee: 4, function: 'credit', args: [CALL_VALUE], callMode: 'call' },
    ] as any)).toThrow(/two participant rows name the same physical locking bytecode/);
  }, 600_000);

  // CALL MODE. The transcript commits a per-invocation call mode C2 never substitutes. Within this fixture
  // the substitution is unreachable at the VM: every handler here writes state, so the planner refuses to
  // call any of them `staticcall`. Recorded as a fail-closed planner refusal, not as VM evidence.
  // RELAXED LIMITS. C2 carries no capacity measurement at all, so nothing in the file establishes that the
  // relaxed profile is the ONLY reason it is semantic-only evidence. This measures it, with the same
  // run-to-completion method X25 used: build under ORDINARY BCH-2026 capacity, then read the true operation
  // cost of every input by re-evaluating those exact bytes against a relaxed density ceiling.
  it('MEASURED: C2 under ordinary BCH-2026 capacity, and the true cost of every sidecar input', async () => {
    const built = await buildCycleGraph('none', createOrdinaryCapacityProvider);
    const outcome = rejectionIndex(built);
    const transaction = built.builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(built.builder.inputs as never);
    const vm = createVirtualMachineBch2026ForProvider({ consensusLimits: RELAXED_BUDGET_LIMITS } as never);
    const measured: { input: number; bytes: number; cost: number; ratio: number; instructions: number }[] = [];
    const measure = (input: number): { bytes: number; cost: number; ratio: number; instructions: number } => {
      const state = vm.evaluate({ inputIndex: input, sourceOutputs, transaction }) as any;
      expect(state.error, `input ${input} failed on the relaxed budget`).toBeUndefined();
      const { densityControlLength: bytes, operationCost: cost } = state.metrics;
      const row = {
        input, bytes, cost, ratio: cost / (bytes * 800), instructions: state.metrics.evaluatedInstructionCount,
      };
      measured.push(row);
      return row;
    };
    const controller = measure(built.layout.controllerInput);
    const projections = built.layout.projectionInputs.map(measure);
    const participants = built.layout.participantInputs.map(measure);
    console.log('C2 capacity, run to completion (input:bytes:cost:instructions:ratio): '
      + measured.sort((left, right) => left.input - right.input)
        .map((row) => `${row.input}:${row.bytes}b:${row.cost}:${row.instructions}i:${row.ratio.toFixed(4)}`)
        .join(' '));
    console.log(`C2 serialized transaction size: ${built.transaction.length / 2} bytes; `
      + `transcript ${built.transcript.bytes.length} bytes; ${built.layout.totalSlots} slots`);

    // RE-MEASURED at `3281ece9`, run to completion, ratio against the ORDINARY 800/byte budget.
    // 4 participants, 5 invocations, a 743-byte transcript, 79 slots:
    //
    //   input             bytes   cost        instructions   ratio
    //   0    hub          4,766   2,195,317    20,603        0.5758
    //   66   leg B        2,585     894,508     8,398        0.4325
    //   68   leg C        2,722     910,810     8,543        0.4183
    //   70   auditor      2,766   1,159,267    10,996        0.5239
    //   73-76 projections 4,914 each, 1,311,150-1,323,013, 11,818 each, 0.3335-0.3365
    //   77   controller   2,309   1,198,938     9,536        0.6491   <- the worst input, and it FITS
    //
    // Serialized transaction: 51,049 bytes, inside both the 100,000-byte standard relay ceiling and the
    // 1,000,000-byte consensus one. EVERY input fits, so C2 settles under ordinary BCH-2026 capacity today and
    // the relaxed profile is NOT what this composition needs - its SEMANTIC-only label is conservative.
    //
    // R3-13. THE PROJECTION ROW AND THE SERIALIZED FIGURE ABOVE ARE THE ONES THAT MOVED. This block used to
    // give 5,464 B / 1,721,310-1,739,262 / 15,008 each / 0.3938-0.3979 and a 53,249-byte transaction, both
    // pre-X65 readings, and the 15,008 contradicted the `toEqual([11_818, ...])` assertion sixty lines below
    // it. The other five rows reproduce byte-for-byte at `3281ece9`. Re-read from this test's own printed
    // table, not from any other file's citation.
    //
    // WHAT THIS CORRECTS, and it is all six rows. The block that stood here recorded hub 4,709 B / 2,234,254 /
    // 0.5931, leg B 2,602 / 935,055 / 0.4492, leg C 2,739 / 949,332 / 0.4332, auditor 2,682 / 905,373 / 0.4220,
    // projections 5,294 B at 0.4607-0.4677 and controller 2,354 / 1,538,567 / 0.8170. Not one reproduces. It
    // was taken before X24 and X27 were composed on one tree and never re-run - the same failure that produced
    // the stale C1 and C3 blocks, found in this file only after both of those were repaired. The run now prints
    // its own table above these assertions so the next reader compares against a measurement, not a citation.
    //
    // The re-measurement that FLAGGED this block is itself already stale, which is the point. It reported
    // projections at 5,427 B / 0.3916-0.3957 and controller 2,309 / 1,198,938 / 0.6491. The controller half
    // reproduces exactly; the projection half does not, because X5 landed afterwards and added 37 bytes and 210
    // instructions to the projection verifier alone. A capacity figure is a reading, never a standing claim.
    expect(outcome).toBeNull();
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
    expect(built.transcript.plan.participants).toHaveLength(4);
    expect(built.transcript.plan.invocations).toHaveLength(5);
    for (const row of [...participants, ...projections, controller]) expect(row.ratio).toBeLessThan(1);
    expect(controller.ratio).toBeGreaterThan(0.6);
    expect(controller.ratio).toBeLessThan(0.95);
    // Both consensus claims stated separately, as C1 and C3 state theirs: C2 clears the relay ceiling too.
    expect(built.transaction.length / 2).toBeLessThan(100_000);
    // X60. Relay dust, the policy rule that turned out to refuse C1 on a real node while every harness
    // reading called it relayable. C2 carries no compiled satoshi effect and so never had the defect; the
    // check is here because "no dust" was an untested assumption in all four capstones, not a measured one.
    expect(formatDustOutputs(dustOutputs(transaction))).toBe('no dust outputs');
    expect(projections.map((row) => row.instructions)).toEqual([11_818, 11_818, 11_818, 11_818]);
    // X24 cut these 14.3% AND removed the +325 returning-row surcharge that used to distinguish the last
    // entry. That surcharge was measured identically across C1, C2 and C3 and recorded as a property of
    // authenticating a result; it was an artifact of the counted-loop lowering. All four rows now cost the
    // same, which is asserted directly so the distinction cannot silently return.
    // X5 then added the row call-options bound to the same walk: +210 instructions over 5 invocations, +1.4%.
    // It buys the ROOT row's call-options byte, which no other covenant reads. Every ratio above is unchanged
    // in sign and the assertions on them still hold, so this is spend, not a capacity move.
    expect(new Set(projections.map((row) => row.instructions)).size).toBe(1);

    // THE CROSS-BUILD COMPARISON, re-measured at `3281ece9` rather than carried over. C1 and C3 print their
    // own tables from their own capacity tests; these are the readings this file's claims are stated against:
    //
    //   build  P/N   transcript  slots  projection instr  controller instr  controller ratio  serialized
    //   C1     5/6   1,314 B      38    13,882 x5          9,561            0.6183            60,617 B
    //   C2     4/5     743 B      79    11,818 x4          9,536            0.6491            51,049 B
    //   C3     8/8   1,325 B     108    18,845 x8         15,336            0.9218            96,302 B
    //
    // R3-13. The projection and serialized columns moved on all three since the 17,686 / 15,008 / 24,382 and
    // 63,315 / 53,249 / 100,650 this table used to give. The controller instruction counts did NOT move, and
    // neither did any controller ratio beyond the fourth decimal. Each figure re-read from that capstone's own
    // capacity test at `3281ece9`; no attempt is made here to attribute the moves to individual commits.
    //
    // WHAT THAT SUPPORTS, and what this file must STOP claiming:
    //   1. Within a build every projection costs the same instruction count whatever row it proves, which is
    //      what the assertion above pins for C2's four.
    //   2. "C1 and C2 have the SAME row counts, so the projection verifier is a pure function of participant
    //      and invocation count and transcript length does not enter" - GONE. The SEC-6 reshape made C1 5/6, so
    //      no two of these builds share row counts, and the three projection counts differ (13,882 / 11,818 /
    //      18,845 at `3281ece9`; 17,686 / 15,008 / 24,382 when this paragraph was written, which is the same
    //      conclusion at three stale figures). The 17,259-in-both and 17,584-returning-row figures are pre-X24
    //      history and
    //      are obtainable on no tree today. Re-earning the claim needs two builds at equal P/N and different
    //      transcript length; none exists.
    //   3. "The controller is that plus 32 instructions per output, fitted over C1's 35 slots, C2's 79 and
    //      C3's 108" - NOT what these builds establish. The controller counts it fitted, C1 10,035 and C2
    //      11,443, reproduce as 9,561 and 9,536, and C2 now costs FEWER controller instructions than C1 while
    //      carrying more than twice the slots, which no monotone per-output model admits. P, N and slots also
    //      move together across the three, so a linear model in them has four unknowns against three points
    //      and any constant fits. C1 has 38 slots, not 35. The constant itself is not in doubt - X28 re-fit it
    //      at exactly 32 per output holding P, N and transcript length fixed, which is the control to cite,
    //      and this file cites it rather than re-deriving it.

    // KNOB LIVENESS. "Every input fits under ordinary capacity" is only evidence if the budget knob can refuse
    // these exact bytes. Same transaction, same source outputs, a budget the worst input provably cannot meet:
    // it must now fail on density. Without this control an aborted evaluation - which reports the budget back
    // rather than the cost, and once made a 2.07x overrun read as 0.0095% - would look like a pass. The control
    // budget is DERIVED from the reading, half the density the controller was measured to need, because a fixed
    // fraction passes vacuously against a row measured well under budget.
    const controlBudget = Math.max(1, Math.floor(controller.cost / controller.bytes / 2));
    expect(controlBudget).toBeLessThan(800);
    const tightened = createVirtualMachineBch2026ForProvider({
      consensusLimits: { ...RELAXED_BUDGET_LIMITS, operationCostBudgetPerByte: controlBudget },
    } as never);
    const tight = tightened.evaluate({
      inputIndex: built.layout.controllerInput, sourceOutputs, transaction,
    }) as any;
    expect(tight.error, `the operation-cost knob does not bite at ${controlBudget}/byte`).toBeDefined();
    expect(String(tight.error)).toMatch(/density|operation cost/i);
  }, 600_000);

  it('refuses a staticcall mode on a state-writing handler, before a transcript exists', async () => {
    const built = await buildCycleGraph();
    const rows = built.transcript.plan.participants.map((participant, index) => ({
      artifact: built.artifacts[index], lockingBytecode: participant.lockingBytecode,
    }));
    expect(() => layer3.planCompiledGraph(rows as any, [
      { parent: null, callee: 0, function: 'fireAll', args: [CALL_VALUE] },
      { parent: 0, callee: 1, function: 'credit', args: [CALL_VALUE], callMode: 'call' },
      { parent: 1, callee: 0, function: 'absorb', args: [CALL_VALUE], callMode: 'call' },
      { parent: 0, callee: 2, function: 'debit', args: [CALL_VALUE], callMode: 'staticcall' },
      { parent: 3, callee: 3, function: 'score', args: [CALL_VALUE], callMode: 'call' },
    ] as any)).toThrow(/staticcall target 'debit' is not compiler-proven read-only/);
  }, 600_000);
});

describe('Layer-3 C2 heterogeneous cycle capstone (SEMANTIC)', () => {
  /**
   * The honest baseline every hostile case is measured against, computed INSIDE one fixture. Cross-fixture
   * comparison would be meaningless: each build mints fresh categories, so participant locking bytecodes and
   * data NFT commitments differ between two honest builds for reasons unrelated to any attack.
   */
  const honestShape = (built: BuiltCycle): { targets: string[]; selectors: string[]; args: string[] } => ({
    targets: [
      built.transcript.plan.participants[1].lockingBytecode,
      built.transcript.plan.participants[2].lockingBytecode,
    ],
    selectors: [abiSelector(built.artifacts[1], 'credit'), abiSelector(built.artifacts[2], 'debit')],
    args: [binToHex(packedResult(CALL_VALUE)), binToHex(packedResult(CALL_VALUE))],
  });

  it('settles one A -> B -> A cycle across four independently compiled participants', async () => {
    const built = await buildCycleGraph();
    const { transcript } = built;
    const [hubArtifact, legBArtifact, legCArtifact, auditArtifact] = built.artifacts;

    // Independently compiled types, each with its own bytecode and its own physical master input.
    expect(new Set(built.artifacts.map((artifact: any) => artifact.bytecode)).size).toBe(4);
    expect(new Set(transcript.plan.participants.map((p) => p.lockingBytecode)).size).toBe(4);
    expect(built.participantInputs).toHaveLength(4);
    expect([...built.participantInputs]).toEqual([...built.participantInputs].sort((a, b) => a - b));

    // Structural cycle: the hub owns two local rows and ONE physical input; every other participant owns one.
    expect(transcript.plan.participants[0].invocations).toEqual([0, 2]);
    expect(transcript.plan.participants[1].invocations).toEqual([1]);
    expect(transcript.plan.participants[2].invocations).toEqual([3]);
    expect(transcript.plan.participants[3].invocations).toEqual([4]);
    // The return edge is the hub re-entered by the participant the hub called.
    expect(transcript.plan.invocations[2].caller).toBe(1);
    expect(transcript.plan.invocations[2].callee).toBe(0);
    // Every physical input executes exactly once. No outpoint is spent twice anywhere in the transaction, and
    // the hub's two logical rows share the single master input at the head of its block - the cycle re-enters
    // a participant without re-spending it.
    const spent = (built.builder.inputs as any[]).map((input) => `${input.txid}:${input.vout}`);
    expect(new Set(spent).size).toBe(spent.length);
    expect(new Set(transcript.participantInputs).size).toBe(4);
    expect(transcript.participantInputs[0]).toBe(0);
    expect(spent.filter((outpoint) =>
      outpoint === spent[transcript.participantInputs[0]])).toHaveLength(1);

    // Two possible target/selector pairs are reached, and the compiler published the disjunction.
    const honest = honestShape(built);
    const hubRows = decodeEmissionRows(transcript.participantEmissionsHex[0]);
    expect(hubRows.map((row) => row.targetHex)).toEqual(honest.targets);
    expect(hubRows.map((row) => row.selectorHex)).toEqual(honest.selectors);
    expect(new Set(hubRows.map((row) => row.targetHex)).size).toBe(2);
    expect(new Set(hubRows.map((row) => row.selectorHex)).size).toBe(2);
    const fireAll = hubArtifact.abi.find((entry: any) => entry.name === 'fireAll');
    expect(fireAll.externalCalls).toHaveLength(1);
    expect(fireAll.externalCalls[0].selectorArrayVar).toBe('__fnsel_legs');
    expect(fireAll.externalCalls[0].possibleTargets.length).toBeGreaterThanOrEqual(2);
    // Dynamic state: the dispatch reads chunk-backed dynamic storage, not a compile-time constant.
    expect(hubArtifact.stateLayout.variables.filter((variable: any) => variable.dynamic)).toHaveLength(2);

    // The one returning edge, produced by the participant reached last.
    const legCRows = decodeEmissionRows(transcript.participantEmissionsHex[2]);
    expect(legCRows).toHaveLength(1);
    expect(legCRows[0].targetHex).toBe(transcript.plan.participants[3].lockingBytecode);
    expect(legCRows[0].selectorHex).toBe(abiSelector(auditArtifact, 'score'));
    expect(legCRows[0].resultHex).toBe(binToHex(packedResult(CALL_VALUE + 1n)));
    expect(transcript.resultsHex.filter((value) => value !== '')).toHaveLength(1);
    // Leg B emits only the return edge; the auditor emits nothing.
    const legBRows = decodeEmissionRows(transcript.participantEmissionsHex[1]);
    expect(legBRows).toHaveLength(1);
    expect(legBRows[0].targetHex).toBe(transcript.plan.participants[0].lockingBytecode);
    expect(legBRows[0].selectorHex).toBe(abiSelector(hubArtifact, 'absorb'));
    expect(transcript.participantEmissionsHex[3]).toBe('');
    expect(legBArtifact.contractName).toBe('CycleLegB');
    expect(legCArtifact.contractName).toBe('CycleLegC');

    layer3.preflightLayer3Transaction(built.builder);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 600_000);

  it('publishes the compiler-proven occurrence ceiling the cycle dispatch relies on', async () => {
    const built = await buildCycleGraph();
    const callsite = built.artifacts[0].abi
      .find((entry: any) => entry.name === 'fireAll').externalCalls[0];
    expect(callsite.occurrence).toBe('loop');
    expect(callsite.maximumOccurrences).toBe(2);
    expect(callsite.occurrenceBoundSource).toBe('guard');
    // A runtime-sized table can reach zero occurrences, so NO floor is published for this shape. The capstone
    // states the ceiling it has and claims no minimum: nothing here proves the loop must run at all.
    expect(callsite.minimumOccurrences).toBeUndefined();
  }, 600_000);

  it('binds the honest transcript to the persisted table it was derived from', async () => {
    const built = await buildCycleGraph();
    const honest = honestShape(built);
    const rows = decodeEmissionRows(built.transcript.participantEmissionsHex[0]);
    expect(built.persistedTargets).toEqual(honest.targets);
    expect(built.persistedSelectors).toEqual(honest.selectors);
    expect(rows.map((row) => row.targetHex)).toEqual(honest.targets);
    expect(rows.map((row) => row.selectorHex)).toEqual(honest.selectors);
    expect(rows.map((row) => row.argsHex)).toEqual(honest.args);
  }, 600_000);

  // TARGET. Slot 1 of the persisted table names a locking bytecode no participant owns, while the SAME
  // registration wrote the honest `debit` selector. Every selector, argument and result stays honest.
  it('rejects a substituted dispatch target with every selector honest', async () => {
    const built = await buildCycleGraph('target');
    const honest = honestShape(built);
    const rows = decodeEmissionRows(built.transcript.participantEmissionsHex[0]);
    expect(built.persistedTargets[0]).toBe(honest.targets[0]);
    expect(built.persistedTargets[1]).toBe(FOREIGN_TARGET);
    expect(built.persistedSelectors).toEqual(honest.selectors);
    expect(rows.map((row) => row.targetHex)).toEqual(honest.targets);
    expect(rows.map((row) => row.selectorHex)).toEqual(honest.selectors);
    expect(rows.map((row) => row.argsHex)).toEqual(honest.args);
    expectRejectionAtInput(built, built.participantInputs[0]);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(scriptRefusalAt(built.participantInputs[0]));
  }, 600_000);

  // SELECTOR. Occurrence 1 answers `debitAlt` while the persisted table slot still holds `debit`. Both targets
  // are honest, and the callee genuinely implements the substituted method with the same call shape, so the
  // graph is internally consistent everywhere except the hub's own recomputation.
  it('rejects a substituted selector with every target honest', async () => {
    const built = await buildCycleGraph('selector');
    const honest = honestShape(built);
    const rows = decodeEmissionRows(built.transcript.participantEmissionsHex[0]);
    expect(built.persistedTargets).toEqual(honest.targets);
    expect(built.persistedSelectors).toEqual(honest.selectors);
    expect(rows.map((row) => row.targetHex)).toEqual(honest.targets);
    expect(rows[0].selectorHex).toBe(honest.selectors[0]);
    expect(rows[1].selectorHex).toBe(abiSelector(built.artifacts[2], 'debitAlt'));
    expect(rows.map((row) => row.argsHex)).toEqual(honest.args);
    expectRejectionAtInput(built, built.participantInputs[0]);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(scriptRefusalAt(built.participantInputs[0]));
  }, 600_000);

  // ARGUMENT. Same participant, same selector, same position; only the forwarded argument vector differs, and
  // the whole subtree below it agrees with the substituted value.
  it('rejects a substituted argument vector with target and selector honest', async () => {
    const built = await buildCycleGraph('argument');
    const honest = honestShape(built);
    const rows = decodeEmissionRows(built.transcript.participantEmissionsHex[0]);
    expect(rows.map((row) => row.targetHex)).toEqual(honest.targets);
    expect(rows.map((row) => row.selectorHex)).toEqual(honest.selectors);
    expect(rows[0].argsHex).toBe(honest.args[0]);
    expect(rows[1].argsHex).toBe(binToHex(packedResult(CALL_VALUE + 1n)));
    expectRejectionAtInput(built, built.participantInputs[0]);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(scriptRefusalAt(built.participantInputs[0]));
  }, 600_000);

  // RESULT. The only returning edge claims a value its producer never computed. Target, selector and argument
  // on that edge are the honest ones, and the producer's own post-state is honest too.
  it('rejects a substituted result with target, selector, argument and post-state honest', async () => {
    const built = await buildCycleGraph('result');
    const honestBuild = await buildCycleGraph();
    const rows = decodeEmissionRows(built.transcript.participantEmissionsHex[2]);
    expect(rows).toHaveLength(1);
    expect(rows[0].targetHex).toBe(built.transcript.plan.participants[3].lockingBytecode);
    expect(rows[0].selectorHex).toBe(abiSelector(built.artifacts[3], 'score'));
    expect(rows[0].argsHex).toBe(binToHex(packedResult(CALL_VALUE)));
    expect(rows[0].resultHex).toBe(binToHex(packedResult(CALL_VALUE + 2n)));
    expect(built.claimedResultHex).not.toBe(honestBuild.claimedResultHex);
    expect(built.claimedPostStates[3]).toBe(honestBuild.claimedPostStates[3]);
    expectRejectionAtInput(built, built.participantInputs[3]);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(scriptRefusalAt(built.participantInputs[3]));
  }, 600_000);

  // POST-STATE, twice-reached participant. The transcript and the claimed result are the honest ones; only the
  // hub's settled data NFT commitment differs.
  it('rejects a forged post-state on the twice-reached participant', async () => {
    const built = await buildCycleGraph('hubPostState');
    const honestBuild = await buildCycleGraph();
    const honest = honestShape(built);
    const rows = decodeEmissionRows(built.transcript.participantEmissionsHex[0]);
    expect(rows.map((row) => row.targetHex)).toEqual(honest.targets);
    expect(rows.map((row) => row.selectorHex)).toEqual(honest.selectors);
    expect(rows.map((row) => row.argsHex)).toEqual(honest.args);
    expect(built.claimedResultHex).toBe(honestBuild.claimedResultHex);
    expect(built.claimedPostStates[0].startsWith(
      binToHex(scriptToBytecode([bigIntToVmNumber(CALL_VALUE + 1n)])),
    )).toBe(true);
    expectRejectionAtInput(built, built.participantInputs[0]);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(scriptRefusalAt(built.participantInputs[0]));
  }, 600_000);

  // POST-STATE, cycle-closing participant. Same transcript; only leg B's settled commitment differs.
  it('rejects a forged post-state on the participant that closes the cycle', async () => {
    const built = await buildCycleGraph('legPostState');
    const honestBuild = await buildCycleGraph();
    const honest = honestShape(built);
    const rows = decodeEmissionRows(built.transcript.participantEmissionsHex[0]);
    expect(rows.map((row) => row.selectorHex)).toEqual(honest.selectors);
    expect(rows.map((row) => row.argsHex)).toEqual(honest.args);
    expect(built.claimedPostStates[1]).not.toBe(honestBuild.claimedPostStates[1]);
    expect(built.claimedPostStates[2]).toBe(honestBuild.claimedPostStates[2]);
    expect(built.claimedPostStates[3]).toBe(honestBuild.claimedPostStates[3]);
    expectRejectionAtInput(built, built.participantInputs[1]);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(scriptRefusalAt(built.participantInputs[1]));
  }, 600_000);

  // REORDERED RETURN EDGE. The same five edges with the same targets, selectors and arguments, but the return
  // edge now hangs off occurrence 1 instead of occurrence 0. The persisted table fixes which occurrence must
  // answer which slot, so the reordering is what rejects.
  it('rejects a reordered return edge', async () => {
    const built = await buildCycleGraph('reordered');
    const honest = honestShape(built);
    const rows = decodeEmissionRows(built.transcript.participantEmissionsHex[0]);
    expect([...rows.map((row) => row.selectorHex)].sort()).toEqual([...honest.selectors].sort());
    expect([...rows.map((row) => row.targetHex)].sort()).toEqual([...honest.targets].sort());
    expect(rows[0].selectorHex).toBe(honest.selectors[1]);
    expect(rows[1].selectorHex).toBe(honest.selectors[0]);
    // The hub still owns exactly two local rows; the return edge moved to the end of the tree.
    expect(built.transcript.plan.participants[0].invocations).toEqual([0, 4]);
    expectRejectionAtInput(built, built.participantInputs[0]);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(scriptRefusalAt(built.participantInputs[0]));
  }, 600_000);

  // MISSING RETURN EDGE. The hub still dispatches to both legs, but B's callback is absent from the graph, so
  // B's emission vector is empty where B's compiled source emits one row.
  /**
   * X179 MOVED THIS REFUSAL EARLIER, and the VM evidence it carried is not lost - it is stronger. A dropped
   * outgoing edge is now refused by name at plan time, by the mirror of an existing capacity check on the same
   * shared occurrence bound. `Layer3DroppedEdgeX179.test.ts` keeps the covenant half against a SETTLING
   * positive, and does it through an artifact-stripped bypass that walks past the SDK gate entirely - so the
   * covenant refusal at input 0 is still demonstrated, on a path no SDK rule can reach.
   */
  it('refuses a graph that omits the return edge, ahead of the covenant that also rejects it', async () => {
    await expect(buildCycleGraph('missingReturnEdge')).rejects.toThrow(
      'was planned with 0 occurrences, below the 1 proven',
    );
  }, 600_000);
});

/**
 * X59. THE SAME A -> B -> A CYCLE, BUILT AGAINST A REAL BCHN NODE.
 *
 * Round 17 offered C2's mock-built bytes to BCHN and got `missing-inputs`. That is not acceptance and it is
 * not a script verdict: the node stopped at input lookup, because those outpoints exist on no chain. The only
 * way to make the node execute these covenants is to build against the node, which the widened `createProvider`
 * parameter above now allows.
 *
 * NOTHING IS RELAXED. `RegtestNetworkProvider` carries no `consensusLimits`, so both the SDK's probe VM and
 * BCHN itself apply the real BCH-2026 rules and the real standard relay policy. C2 is 51,049 bytes at
 * `3281ece9`, inside the 100,000-byte ceiling, so unlike C3 it can actually be relayed. (R3-13: 53,249 stood
 * here in the present tense and was two readings stale; the run's own assertion is a band under 100,000, which
 * both figures satisfy, so nothing was asserting it.)
 *
 * Requires the docker regtest stack; see the root CLAUDE.md.
 */
describe.runIf(process.env.TESTS_USE_REGTEST)('X59: C2 on a real BCHN node', () => {
  it('CONSENSUS: BCHN executes the four-participant cycle, accepts it and mines it', async () => {
    const built = await buildCycleGraph('none', createTestProvider);
    const transaction = built.builder.buildLibauthTransaction();
    const dust = dustOutputs(transaction);
    expect(formatDustOutputs(dust)).toBe('no dust outputs');

    const accepted = await acceptedByNode(built.provider as never, transaction, built.transaction);
    console.log(`X59 C2 accepted by BCHN: ${accepted.txid} at height ${accepted.blockHeight}, `
      + `${accepted.serializedBytes} B, ${accepted.inputCount} inputs`);
    expect(accepted.serializedBytes).toBeLessThan(100_000);
    expect(accepted.blockHeight).toBeGreaterThan(0);
  }, 900_000);

  /**
   * THE CONTROL, on the same chain in the same run: a substituted dispatch target is refused BY THE NODE. An
   * acceptance is only evidence that the covenants ran if a transaction they should refuse is also refused.
   */
  it('CONSENSUS: BCHN refuses a substituted dispatch target', async () => {
    const built = await buildCycleGraph('target', createTestProvider);
    // R3. NAME THE CAUSE. A bare `rejects.toThrow()` passes on `64: dust`, `64: tx-size`, `missing-inputs`
    // - where the node stopped BEFORE executing anything - a mempool conflict, or an RPC error. This block
    // claims the node EXECUTED the covenants and they refused, so the verdict must say so. Measured at
    // `abb3f13b`: OP_EQUALVERIFY, code 16. The opcode is not pinned; the script-verify flag is.
    const refusal = await built.provider.sendRawTransaction(built.transaction)
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    console.log(`X59 C2 node refusal: ${refusal}`);
    expect(refusal).toMatch(/mandatory-script-verify-flag-failed/);
  }, 900_000);
});
