import {
  bigIntToVmNumber, binToHex, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { buildInitialStateCommitments, scriptToBytecode } from '@solidcash/utils';
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

type SemanticProvider = ReturnType<typeof createLayer3SemanticTestProvider>;

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
  | 'missingReturnEdge';

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

async function buildCycleGraph(tamper: Tamper = 'none'): Promise<BuiltCycle> {
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
  await hubStateful.registerDebit(
    tamper === 'target' ? hexToBin(FOREIGN_TARGET) : legC.lockingBytecode,
  ).send();
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
  const transcript = layer3.finalizeCompiledGraph(
    plan, invocationResults, layout.participantInputs, layout.returnOutputs!, resultVectors,
    layout.projectionInputs,
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
  const settle = (contract: Contract, setup: any, commitment: string): void => {
    tx.addOutput({
      to: contract.tokenAddress, amount: setup.masterUtxo.satoshis,
      token: { category: setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    });
    tx.addOutput({
      to: getDataNftAddress(contract, setup.categoryId), amount: setup.dataNftUtxos[0].satoshis,
      token: { category: setup.categoryId, amount: 0n, nft: { capability: 'mutable', commitment } },
    });
  };
  settle(legB, legBSetup, legBNext);
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

const abiSelector = (artifact: any, name: string): string =>
  artifact.abi.find((entry: any) => entry.name === name).selector.toLowerCase();

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
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
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
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
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
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
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
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
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
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
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
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
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
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
  }, 600_000);

  // MISSING RETURN EDGE. The hub still dispatches to both legs, but B's callback is absent from the graph, so
  // B's emission vector is empty where B's compiled source emits one row.
  it('rejects a graph that omits the return edge', async () => {
    const built = await buildCycleGraph('missingReturnEdge');
    expect(built.transcript.participantEmissionsHex[1]).toBe('');
    expect(built.transcript.plan.participants[0].invocations).toEqual([0]);
    expectRejectionAtInput(built, built.participantInputs[1]);
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
  }, 600_000);
});
