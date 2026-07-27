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
 * Three independently compiled contracts compose one graph transaction:
 *
 *   inv0  root -> HUB.fireAll          (HUB local row 0)
 *   inv1  HUB  -> LEG_B.credit         (dispatched through HUB's persisted pointer table, slot 0)
 *   inv2  LEG_B -> HUB.absorb          (the RETURN EDGE; HUB local row 1; produces the only result)
 *   inv3  HUB  -> LEG_C.debit          (dispatched through the same table, slot 1)
 *
 * HUB is reached twice logically and co-spent once physically, so the A -> B -> A cycle is structural rather
 * than two separate participants agreeing on a label. The dispatch is the G1 runtime-sized pointer table: both
 * the target and the selector of each occurrence come from persisted dynamic state, and the compiler publishes
 * three possible target/selector pairs for the single callsite, so neither field is implied by the other.
 *
 * Every hostile case below plans its tampered graph, re-encodes the canonical transcript bytes and commits the
 * RE-DERIVED root. Nothing is mutated after derivation, so an accepted transcript is internally consistent and
 * only a covenant can reject it. Each negative names the exact failing input.
 *
 * SEMANTIC evidence only, on the named layer3-bch2026-semantic-relaxed-v1 profile (BCH-2026 opcode,
 * introspection and 128-byte-commitment behaviour, relaxed capacity). Not consensus-fit or policy-fit.
 */

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);
const packedResult = (value: bigint): Uint8Array => scriptToBytecode([bigIntToVmNumber(value)]);
const aggregateResult = (value: bigint): Uint8Array => scriptToBytecode([packedResult(value)]);

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

/** Participant A. Dispatches through a persisted runtime-sized pointer table and re-enters on `absorb`. */
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
  function absorb(uint credited) public returns (uint) {
    this.total = this.total + credited;
    require(credited > 0);
    return this.total;
  }
}`;

/** Participant B. Closes the cycle by calling back into the hub and consuming the hub's authenticated result. */
const CYCLE_LEG_B = `pragma solidcash >=0.8.0;
interface ICycleHub { function absorb(uint credited) returns (uint); }
contract CycleLegB(address hub) {
  uint seen;
  function credit(uint value) public {
    this.seen = this.seen + value;
    uint running = ICycleHub(hub).absorb(value);
    require(running >= value);
  }
}`;

/** Participant C. The second target/selector pair; two same-shape handlers make a selector attack meaningful. */
const CYCLE_LEG_C = `pragma solidcash >=0.8.0;
contract CycleLegC(int brand) {
  uint burned;
  function debit(uint value) public {
    this.burned = this.burned + value;
    require(value > 0 && brand >= 0);
  }
  function debitAlt(uint value) public {
    this.burned = this.burned + value + 1;
    require(value > 0 && brand >= 0);
  }
}`;

const CALL_VALUE = 4n;
/** A locking bytecode no participant owns; used to substitute a persisted table target. */
const FOREIGN_TARGET = `aa20${'44'.repeat(32)}87`;

type SemanticProvider = ReturnType<typeof createLayer3SemanticTestProvider>;

/**
 * The one field each hostile case attacks. Every mode differs from `none` in exactly one authenticated field;
 * everything else - the sources, the compiled artifacts, the physical layout and the other three fields - is
 * byte-identical to the honest control.
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
  hubArtifact: any;
  legBArtifact: any;
  legCArtifact: any;
  /** Physical master input of each participant, in participant order. */
  participantInputs: readonly number[];
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

  const hubBase = new Contract(hubArtifact, [], { provider });
  const hubSetup = await setupStatefulUtxos(
    provider, hubBase, hubArtifact.stateLayout!, { total: 0n, legs: [], __fnsel_legs: [] },
  );
  const hub = hubBase.withCategory(hexToBin(hubSetup.categoryId));
  // B is constructed against the hub's final locking bytecode; the hub reaches B only through persisted state,
  // so the two independently compiled types have no circular compile-time dependency.
  const legBBase = new Contract(legBArtifact, [hub.lockingBytecode], { provider });
  const legBSetup = await setupStatefulUtxos(provider, legBBase, legBArtifact.stateLayout!, { seen: 0n });
  const legB = legBBase.withCategory(hexToBin(legBSetup.categoryId));
  const legCBase = new Contract(legCArtifact, [7n], { provider });
  const legCSetup = await setupStatefulUtxos(provider, legCBase, legCArtifact.stateLayout!, { burned: 0n });
  const legC = legCBase.withCategory(hexToBin(legCSetup.categoryId));

  // Persist the dispatch table. Slot 0 -> (B, credit) and slot 1 -> (C, debit): distinct targets AND distinct
  // selectors, so neither field can stand in for the other. The 'target' attack persists a foreign target in
  // slot 1 while registering the SAME selector, leaving every other authenticated field untouched.
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
  ];
  const legFunction = tamper === 'selector' ? 'debitAlt' : 'debit';
  const legArgs = [tamper === 'argument' ? CALL_VALUE + 1n : CALL_VALUE];
  const cycleEdges: layer3.CompiledGraphInvocation[] = [
    { parent: 0, callee: 1, function: 'credit', args: [CALL_VALUE], callMode: 'call' },
    { parent: 1, callee: 0, function: 'absorb', args: [CALL_VALUE], callMode: 'call' },
  ];
  const legEdge: layer3.CompiledGraphInvocation = {
    parent: 0, callee: 2, function: legFunction, args: legArgs, callMode: 'call',
  };
  // 'reordered' exchanges the two table occurrences, moving the B -> A return edge from occurrence 0 to
  // occurrence 1. 'missingReturnEdge' drops the B -> A edge entirely.
  const invocations: layer3.CompiledGraphInvocation[] = [
    { parent: null, callee: 0, function: 'fireAll', args: [CALL_VALUE] },
    ...(tamper === 'reordered' ? [legEdge, ...cycleEdges]
      : tamper === 'missingReturnEdge' ? [cycleEdges[0], legEdge]
      : [...cycleEdges, legEdge]),
  ];
  const plan = layer3.planCompiledGraph(participants, invocations);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const hubReturning = plan.participants[0].batch.results.length > 0;
  const hubTotal = CALL_VALUE;
  const claimedResult = tamper === 'result' ? hubTotal + 1n : hubTotal;
  const returnOutputs = hubReturning ? layout.returnOutputs! : [null, null, null];
  const resultVectors = hubReturning
    ? [binToHex(packedResult(claimedResult)), '', '']
    : ['', '', ''];
  const invocationResults: Record<number, string> = {};
  plan.invocations.forEach((invocation) => {
    if (invocation.resultTypes.length > 0) invocationResults[invocation.index] = binToHex(packedResult(claimedResult));
  });
  const transcript = layer3.finalizeCompiledGraph(
    plan, invocationResults, layout.participantInputs, returnOutputs, resultVectors, layout.projectionInputs,
  );

  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const rootedController = await initializeGraphAuthority(
    provider, controller, genesisUtxo, controllerCategory, transcript.root, p2pkh, outpoints,
  );
  const projections = plan.participants.map(() => uniqueUtxo(outpoints, { satoshis: 1000n }));
  for (const proof of projections) await provider.addUtxo(projection.address, proof);
  const fee = uniqueUtxo(outpoints, { satoshis: 200_000n });
  await provider.addUtxo(p2pkh.address, fee);

  // The hub's persisted table lives in chunk UTXOs inside the hub's own trailing region.
  const dynamicVariables = hubArtifact.stateLayout!.variables.filter((variable: any) => variable.dynamic);
  const chunks: { variable: any; utxo: any; address: string }[] = [];
  for (const variable of dynamicVariables) {
    const address = getDynamicChunkAddress(hub, hubSetup.categoryId, variable.name, variable.type);
    for (const utxo of await provider.getUtxos(address)) chunks.push({ variable, utxo, address });
  }
  const hubLayout = hubArtifact.hiddenBatch!.route.blockLayout!;
  const trailingCapacity = hubLayout.trailingCapacity ?? 0;
  expect(chunks.length).toBeLessThanOrEqual(trailingCapacity);
  const returnSlotFunding = uniqueUtxo(outpoints, { satoshis: 1000n });
  await provider.addUtxo(p2pkh.address, returnSlotFunding);
  const trailingFunding = Array.from(
    { length: trailingCapacity - chunks.length }, () => uniqueUtxo(outpoints, { satoshis: 1000n }),
  );
  for (const funding of trailingFunding) await provider.addUtxo(p2pkh.address, funding);

  const hubRoute = hub.createCompilerRouteUnlocker(
    hubArtifact.hiddenBatch!.route, hexToBin(hubArtifact.hiddenBatch!.selector),
  );
  const legBRoute = legB.createCompilerRouteUnlocker(
    legBArtifact.hiddenBatch!.route, hexToBin(legBArtifact.hiddenBatch!.selector),
  );
  const legCRoute = legC.createCompilerRouteUnlocker(
    legCArtifact.hiddenBatch!.route, hexToBin(legCArtifact.hiddenBatch!.selector),
  );

  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  // Hub block: master, data NFT, return-event slot (funded on the input side), then the trailing chunk region.
  tx.addInput(hubSetup.masterUtxo && currentHub.masterUtxo, hubRoute(
    ...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any,
    BigInt(returnOutputs[0] ?? -1),
  ));
  tx.addInput(
    currentHub.dataNftUtxos[0],
    createDataNftUnlocker(hub, layout.participantInputs[0], hubSetup.categoryId),
  );
  tx.addInput(returnSlotFunding, p2pkh.unlock.spend(alicePub, signature()));
  for (const { variable, utxo } of chunks) {
    tx.addInput(utxo, createReadOnlyDynamicChunkUnlocker(
      hub, layout.participantInputs[0], hubSetup.categoryId, variable.name, variable.type,
    ));
  }
  for (const funding of trailingFunding) tx.addInput(funding, p2pkh.unlock.spend(alicePub, signature()));
  // Leg blocks.
  tx.addInput(legBSetup.masterUtxo, legBRoute(
    ...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput) as any,
  ));
  tx.addInput(
    legBSetup.dataNftUtxos[0],
    createDataNftUnlocker(legB, layout.participantInputs[1], legBSetup.categoryId),
  );
  tx.addInput(legCSetup.masterUtxo, legCRoute(
    ...layer3.compiledGraphRouteArgs(transcript, 2, layout.controllerInput) as any,
  ));
  tx.addInput(
    legCSetup.dataNftUtxos[0],
    createDataNftUnlocker(legC, layout.participantInputs[2], legCSetup.categoryId),
  );
  projections.forEach((proof, participant) => tx.addInput(
    proof, projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), BigInt(participant)),
  ));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));

  const legValue = tamper === 'argument' ? CALL_VALUE + 1n : CALL_VALUE;
  const legCBurned = legFunction === 'debitAlt' ? legValue + 1n : legValue;
  // The hub's data NFT commitment is one minimally encoded pushdata per state field, and the cycle writes only
  // the leading scalar; the two dynamic table fields carry chunk headers no initial-state builder reproduces.
  // So the post-state is the CURRENT commitment with exactly the scalar field replaced.
  const currentHubCommitment: string = currentHub.dataNftUtxos[0].token.nft.commitment;
  const zeroFieldHex = binToHex(scriptToBytecode([bigIntToVmNumber(0n)]));
  expect(currentHubCommitment.startsWith(zeroFieldHex)).toBe(true);
  const hubNext = binToHex(scriptToBytecode([
    bigIntToVmNumber(tamper === 'hubPostState' ? hubTotal + 1n : hubTotal),
  ])) + currentHubCommitment.slice(zeroFieldHex.length);
  const legBNext = buildInitialStateCommitments(legBArtifact.stateLayout!, {
    seen: tamper === 'legPostState' ? CALL_VALUE + 1n : CALL_VALUE,
  })[0];
  const legCNext = buildInitialStateCommitments(legCArtifact.stateLayout!, { burned: legCBurned })[0];

  tx.addOutput({
    to: hub.tokenAddress, amount: currentHub.masterUtxo.satoshis,
    token: { category: hubSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: getDataNftAddress(hub, hubSetup.categoryId), amount: currentHub.dataNftUtxos[0].satoshis,
    token: {
      category: hubSetup.categoryId, amount: 0n, nft: { capability: 'mutable', commitment: hubNext },
    },
  });
  if (hubReturning) {
    tx.addOutput({
      to: hexToBin('51'), amount: 1000n,
      token: {
        category: hubSetup.categoryId, amount: 0n,
        nft: { capability: 'none', commitment: binToHex(aggregateResult(claimedResult)) },
      },
    });
  } else {
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
  }
  for (const { address, utxo } of chunks) tx.addOutput({ to: address, amount: utxo.satoshis, token: utxo.token });
  for (const funding of trailingFunding) tx.addOutput({ to: p2pkh.address, amount: funding.satoshis });
  tx.addOutput({
    to: legB.tokenAddress, amount: legBSetup.masterUtxo.satoshis,
    token: { category: legBSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: getDataNftAddress(legB, legBSetup.categoryId), amount: legBSetup.dataNftUtxos[0].satoshis,
    token: {
      category: legBSetup.categoryId, amount: 0n, nft: { capability: 'mutable', commitment: legBNext },
    },
  });
  tx.addOutput({
    to: legC.tokenAddress, amount: legCSetup.masterUtxo.satoshis,
    token: { category: legCSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({
    to: getDataNftAddress(legC, legCSetup.categoryId), amount: legCSetup.dataNftUtxos[0].satoshis,
    token: {
      category: legCSetup.categoryId, amount: 0n, nft: { capability: 'mutable', commitment: legCNext },
    },
  });
  for (let slot = 0; slot < projections.length + 1; slot += 1) {
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
  }
  tx.addOutput({ to: p2pkh.address, amount: 20_000n });

  return {
    provider,
    builder: tx,
    transaction: raw(tx),
    transcript,
    hubArtifact,
    legBArtifact,
    legCArtifact,
    participantInputs: layout.participantInputs,
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

describe('Layer-3 C2 heterogeneous cycle capstone (SEMANTIC)', () => {
  it('settles one A -> B -> A cycle across three independently compiled participants', async () => {
    const built = await buildCycleGraph();
    const { transcript, hubArtifact, legBArtifact, legCArtifact } = built;

    // Three distinct compiled types, each with its own bytecode and its own physical master input.
    const identities = new Set([
      hubArtifact.bytecode, legBArtifact.bytecode, legCArtifact.bytecode,
    ]);
    expect(identities.size).toBe(3);
    expect(transcript.plan.participants).toHaveLength(3);
    expect(built.participantInputs).toHaveLength(3);

    // The cycle: the hub owns two local rows and one physical input; each leg owns one.
    expect(transcript.plan.participants[0].invocations).toEqual([0, 2]);
    expect(transcript.plan.participants[1].invocations).toEqual([1]);
    expect(transcript.plan.participants[2].invocations).toEqual([3]);
    expect(transcript.plan.invocations[2].callee).toBe(0);
    expect(transcript.plan.invocations[2].caller).toBe(1);

    // Two possible target/selector pairs are reached, and the compiler published the disjunction.
    const hubRows = decodeEmissionRows(transcript.participantEmissionsHex[0]);
    expect(hubRows).toHaveLength(2);
    expect(hubRows[0].targetHex).toBe(transcript.plan.participants[1].lockingBytecode);
    expect(hubRows[1].targetHex).toBe(transcript.plan.participants[2].lockingBytecode);
    expect(new Set(hubRows.map((row) => row.targetHex)).size).toBe(2);
    expect(new Set(hubRows.map((row) => row.selectorHex)).size).toBe(2);
    const fireAll = hubArtifact.abi.find((entry: any) => entry.name === 'fireAll');
    expect(fireAll.externalCalls).toHaveLength(1);
    expect(fireAll.externalCalls[0].selectorArrayVar).toBe('__fnsel_legs');
    expect(fireAll.externalCalls[0].possibleTargets.length).toBeGreaterThanOrEqual(2);

    // The return edge carries the only result, and it is the hub's own authenticated post-state value.
    const legRows = decodeEmissionRows(transcript.participantEmissionsHex[1]);
    expect(legRows).toHaveLength(1);
    expect(legRows[0].targetHex).toBe(transcript.plan.participants[0].lockingBytecode);
    expect(legRows[0].resultHex).toBe(binToHex(packedResult(CALL_VALUE)));
    expect(transcript.participantEmissionsHex[2]).toBe('');
    expect(legCArtifact.abi.find((entry: any) => entry.name === 'debit')).toBeDefined();

    layer3.preflightLayer3Transaction(built.builder);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 600_000);

  it('publishes the compiler-proven occurrence ceiling the cycle dispatch relies on', async () => {
    const built = await buildCycleGraph();
    const callsite = built.hubArtifact.abi
      .find((entry: any) => entry.name === 'fireAll').externalCalls[0];
    expect(callsite.occurrence).toBe('loop');
    expect(callsite.maximumOccurrences).toBe(2);
    expect(callsite.occurrenceBoundSource).toBe('guard');
    // A runtime-sized table can reach zero occurrences, so no floor is published for this shape. The capstone
    // states the ceiling it has and claims no minimum.
    expect(callsite.minimumOccurrences).toBeUndefined();
  }, 600_000);

  // TARGET. Slot 1 of the persisted table names a locking bytecode no participant owns, while the SAME
  // registration wrote the honest `debit` selector. Every selector, argument and result in the transcript is
  // byte-identical to the honest control.
  it('rejects a substituted dispatch target with every selector honest', async () => {
    const built = await buildCycleGraph('target');
    const honest = await buildCycleGraph();
    const rows = decodeEmissionRows(built.transcript.participantEmissionsHex[0]);
    const honestRows = decodeEmissionRows(honest.transcript.participantEmissionsHex[0]);
    expect(rows.map((row) => row.selectorHex)).toEqual(honestRows.map((row) => row.selectorHex));
    expect(rows.map((row) => row.argsHex)).toEqual(honestRows.map((row) => row.argsHex));
    expectRejectionAtInput(built, built.participantInputs[0]);
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
  }, 600_000);

  // SELECTOR. Occurrence 1 answers `debitAlt` while the persisted table slot still holds `debit`. Both targets
  // are the honest participants, and the callee genuinely implements the substituted method, so the graph is
  // internally consistent everywhere except the hub's own recomputation.
  it('rejects a substituted selector with every target honest', async () => {
    const built = await buildCycleGraph('selector');
    const honest = await buildCycleGraph();
    const rows = decodeEmissionRows(built.transcript.participantEmissionsHex[0]);
    const honestRows = decodeEmissionRows(honest.transcript.participantEmissionsHex[0]);
    expect(rows.map((row) => row.targetHex)).toEqual(honestRows.map((row) => row.targetHex));
    expect(rows[1].selectorHex).not.toBe(honestRows[1].selectorHex);
    expectRejectionAtInput(built, built.participantInputs[0]);
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
  }, 600_000);

  // ARGUMENT. Same participant, same selector, same position; only the forwarded argument vector differs.
  it('rejects a substituted argument vector with target and selector honest', async () => {
    const built = await buildCycleGraph('argument');
    const honest = await buildCycleGraph();
    const rows = decodeEmissionRows(built.transcript.participantEmissionsHex[0]);
    const honestRows = decodeEmissionRows(honest.transcript.participantEmissionsHex[0]);
    expect(rows.map((row) => row.targetHex)).toEqual(honestRows.map((row) => row.targetHex));
    expect(rows.map((row) => row.selectorHex)).toEqual(honestRows.map((row) => row.selectorHex));
    expect(rows[1].argsHex).not.toBe(honestRows[1].argsHex);
    expectRejectionAtInput(built, built.participantInputs[0]);
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
  }, 600_000);

  // RESULT. The return edge claims a value the hub never computed. The hub's post-state is the honest one, so
  // this attacks the result field alone rather than the state it was derived from.
  it('rejects a substituted result on the return edge with post-state honest', async () => {
    const built = await buildCycleGraph('result');
    const honest = await buildCycleGraph();
    const legRows = decodeEmissionRows(built.transcript.participantEmissionsHex[1]);
    const honestLegRows = decodeEmissionRows(honest.transcript.participantEmissionsHex[1]);
    expect(legRows[0].targetHex).toBe(honestLegRows[0].targetHex);
    expect(legRows[0].selectorHex).toBe(honestLegRows[0].selectorHex);
    expect(legRows[0].argsHex).toBe(honestLegRows[0].argsHex);
    expect(legRows[0].resultHex).not.toBe(honestLegRows[0].resultHex);
    expectRejectionAtInput(built, built.participantInputs[0]);
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
  }, 600_000);

  // POST-STATE, re-entered participant. The transcript is byte-identical to the honest control; only the hub's
  // settled data NFT commitment differs.
  it('rejects a forged post-state on the twice-reached participant', async () => {
    const built = await buildCycleGraph('hubPostState');
    const honest = await buildCycleGraph();
    expect(built.transcript.participantEmissionsHex).toEqual(honest.transcript.participantEmissionsHex);
    expectRejectionAtInput(built, built.participantInputs[0]);
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
  }, 600_000);

  // POST-STATE, cycle-closing participant.
  it('rejects a forged post-state on the participant that closes the cycle', async () => {
    const built = await buildCycleGraph('legPostState');
    const honest = await buildCycleGraph();
    expect(built.transcript.participantEmissionsHex).toEqual(honest.transcript.participantEmissionsHex);
    expectRejectionAtInput(built, built.participantInputs[1]);
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
  }, 600_000);

  // REORDERED RETURN EDGE. The same three edges, the same targets, selectors and arguments, but the return
  // edge now hangs off occurrence 1 instead of occurrence 0. The persisted table fixes which occurrence must
  // answer which slot, so the reordering is what rejects.
  it('rejects a reordered return edge', async () => {
    const built = await buildCycleGraph('reordered');
    const honest = await buildCycleGraph();
    const rows = decodeEmissionRows(built.transcript.participantEmissionsHex[0]);
    const honestRows = decodeEmissionRows(honest.transcript.participantEmissionsHex[0]);
    expect(rows.map((row) => row.selectorHex).sort())
      .toEqual(honestRows.map((row) => row.selectorHex).sort());
    expect(rows[0].selectorHex).toBe(honestRows[1].selectorHex);
    expect(built.transcript.plan.participants[0].invocations).toEqual([0, 3]);
    expectRejectionAtInput(built, built.participantInputs[0]);
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
  }, 600_000);

  // MISSING RETURN EDGE. The hub still dispatches to both legs, but B's callback is absent from the graph.
  it('rejects a graph that omits the return edge', async () => {
    const built = await buildCycleGraph('missingReturnEdge');
    expect(built.transcript.participantEmissionsHex[1]).toBe('');
    expectRejectionAtInput(built, built.participantInputs[1]);
    await expect(built.provider.sendRawTransaction(built.transaction)).rejects.toThrow();
  }, 600_000);
});
