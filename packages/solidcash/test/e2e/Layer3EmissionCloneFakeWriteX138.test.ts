import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { buildChunkCommitment, buildInitialStateCommitments } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import type { FunctionArgument } from '../../src/Argument.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import {
  createDataNftUnlocker, createDynamicChunkUnlocker, getDataNftAddress, getDynamicChunkAddress,
} from '../../src/stateful/covenant-helpers.js';

/**
 * X138. THE GATE READS THE ATTACKER'S OWN HOMEWORK, AND WHAT IS BEHIND IT SETTLES.
 *
 * X111's scalar half is closed at consensus: `computeScalarJournalClosures` admits a graph emission clone for
 * its PLAIN SCALAR slots, so a clone reading `state:<scalar>` loads through the live journal and the covenant
 * refuses the stale composition whoever builds the bytes. The DYNAMIC half is not closed. A clone whose stale
 * read is on a chunk-backed slot is admitted for no slot at all, so it reads the pre-transaction data NFT, and
 * the only thing in front of it is `assertNoStaleEmissionCloneReads` in `layer3/graph.ts` - a
 * witness-construction refusal.
 *
 * That refusal short-circuits on `writtenVariablesOf(clone).length > 0`, and `clone.writes` is a field of the
 * artifact the SPENDER hands the planner. `Layer3EmissionCloneJournalX111.test.ts` R3 recorded that ONE
 * published nonexistent write flips the planner from REFUSED to ADMITTED, and left it there: "PLANNER LEVEL
 * ONLY - no settlement is claimed either way".
 *
 * This file settles it, in two halves.
 *
 * FIRST HALF - the claim-driven ADMISSION is removed. The gate now reads `stateLayout` for the slot's
 * dynamism and refuses a chunk-backed stale read whatever `clone.writes` says. The scalar contrast keeps that
 * statement scoped: there the claim is still honoured, because the compiler journals a clone's scalar slots
 * regardless and the covenant refuses the stale scalar composition itself.
 *
 * SECOND HALF - and it changes nothing at consensus. The residual is reached by hand-assembling the plan, so
 * `planCompiledGraph` is never called and no witness-side rule applies. Those bytes preflight clean under
 * BCH-2026 and broadcast, carrying a guard row TRUE of the pre-state and FALSE of the state the same
 * transaction commits. The fake write also leaves `bytecode`, `hiddenBatch` and `stateLayout` byte-identical,
 * so the covenant cannot tell the honest artifact from the escaped one either. A rule reading spender metadata
 * is a diagnostic; only the compiler can make this a boundary.
 */

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);
const CHUNK = 120;

/**
 * `note` is chunk-backed (`bytes`), so `assertShort` reads `state:note` through the chunk loop, and
 * `msg.sender` is what makes it a GRAPH EMISSION CLONE (`__scb_graph_assertShort`) rather than an ordinary
 * route handler. An ordinary handler reading the same slot is already journalled - S3 pins that - so the
 * emission-clone spelling is the whole of the exposure.
 */
const DYN_GUARD = `pragma solidcash >=0.8.0;
    contract DynNote() {
      bytes note;
      function setNote(bytes t) public {
        this.note = t;
        require(true);
      }
      function assertShort(bytes probe, address who) public {
        require(this.note.length <= probe.length);
        require(msg.sender == who);
      }
    }`;

const CLONE = '__scb_graph_assertShort';

type Handler = 'setNote' | 'assertShort';
interface Row { fn: Handler; value: Uint8Array }

interface Spec {
  rows: Row[];
  initial: Uint8Array;
  /** Post-state value of `note`. The rows do not always name it, so it is stated. */
  final: Uint8Array;
  /** `honest` publishes the compiler's footprint; `fakeWrite` adds one nonexistent write to the clone. */
  footprint: 'honest' | 'fakeWrite';
  /**
   * How the plan handed to `finalizeCompiledGraph` is produced. `handAssembled` reproduces
   * `planCompiledGraph`'s output without calling it, so nothing in the SDK stands between the bytes and the
   * VM - the constructor L2-A1 used against X111, which no witness-side rule can be subject to.
   */
  constructor?: 'planner' | 'handAssembled';
}

/**
 * L2-A1's constructor, verbatim from `Layer3EmissionCloneJournalX111.test.ts`: reproduce the planner's output
 * for a root-plus-N-void-rows graph without calling it. Every field `finalizeCompiledGraph` reads comes from
 * the same `encodeHiddenBatch` the planner uses, so the transcript is the planner's transcript.
 */
function handAssemblePlan(
  participants: readonly { artifact: any; lockingBytecode: string }[],
  invocations: readonly { parent: number | null; callee: number; function: string; args: any[] }[],
): any {
  const perOwner: any[][] = participants.map(() => []);
  const globalByOwner: number[][] = participants.map(() => []);
  invocations.forEach((invocation, index) => {
    perOwner[invocation.callee].push({
      function: invocation.function,
      args: invocation.args,
      ...(invocation.parent !== null && {
        logicalCaller: hexToBin(participants[invocations[invocation.parent].callee].lockingBytecode),
      }),
    });
    globalByOwner[invocation.callee].push(index);
  });
  const executions = participants.map((participant, owner) => ({
    participant: owner,
    lockingBytecode: participant.lockingBytecode.toLowerCase(),
    batch: layer3.encodeHiddenBatch(participant.artifact, perOwner[owner]),
    invocations: globalByOwner[owner],
    blockLayout: participant.artifact.hiddenBatch!.route.blockLayout!,
  }));
  const subtreeEnds = invocations.map((_invocation, index) => index);
  const active: number[] = [];
  invocations.forEach((invocation, index) => {
    if (index === 0) active.push(0);
    else {
      while (active.length > 0 && active[active.length - 1] !== invocation.parent) active.pop();
      for (const ancestor of active) subtreeEnds[ancestor] = index;
      active.push(index);
    }
  });
  const localCursor = participants.map(() => 0);
  const depths = invocations.map(() => 0);
  for (let index = 1; index < invocations.length; index += 1) {
    depths[index] = depths[invocations[index].parent!] + 1;
  }
  const planned = invocations.map((invocation, index) => {
    const execution = executions[invocation.callee];
    const localRow = localCursor[invocation.callee];
    localCursor[invocation.callee] += 1;
    const row = execution.batch.rows[localRow];
    const result = execution.batch.results.find((candidate: any) => candidate.row === localRow);
    return {
      index,
      parent: invocation.parent,
      caller: invocation.parent === null ? null : invocations[invocation.parent].callee,
      callee: invocation.callee,
      subtreeEnd: subtreeEnds[index],
      localRow,
      depth: depths[index],
      function: row.function,
      selectorHex: row.selectorHex,
      callMode: 'call' as const,
      callOptions: 0,
      argsHex: row.argsHex,
      resultTypes: [...(result?.types ?? [])],
      resultDependencies: [],
    };
  });
  return { participants: executions, invocations: planned };
}

interface Built {
  provider: ReturnType<typeof createTestProvider>;
  builder: TransactionBuilder;
  transaction: string;
  dynInput: number;
  /** Proof that the escape is metadata-only: the published bytecode and address the covenant sees. */
  bytecode: string;
  lockingBytecode: string;
}

/** Deep-copy an artifact so a footprint mutation cannot leak into another case. */
const copyArtifact = (artifact: any): any => JSON.parse(JSON.stringify(artifact));

/** L2-F1c's escape, verbatim: one write naming a slot that does not exist. */
function withFakeWrite(artifact: any): any {
  const escaped = copyArtifact(artifact);
  Object.assign(
    escaped.invocationAnalysis.functions.find((entry: any) => entry.name === CLONE),
    { writes: ['state:nosuchslot'] },
  );
  return escaped;
}

async function buildDynGuardGraph(spec: Spec): Promise<Built> {
  const provider = createTestProvider();
  const projection = new Contract(compileString(layer3.generateGraphProjectionVerifier()), [], { provider });
  const controller = new Contract(
    compileString(layer3.generateGraphRootController(projection.lockingBytecode)), [alicePkh], { provider },
  );
  const genesis = await (provider as any).addTokenUtxosDynamic(() => [{
    address: controller.tokenAddress,
    satoshis: 3000n,
    token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } },
  }]);
  const controllerCategory = genesis.categoryId as string;
  const options = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  };
  const honestArtifact = compileString(DYN_GUARD, options);
  const dynBase = new Contract(honestArtifact, [], { provider });
  const dynSetup = await setupStatefulUtxos(
    provider, dynBase, honestArtifact.stateLayout!, { note: spec.initial },
  );
  const dyn = dynBase.withCategory(hexToBin(dynSetup.categoryId));
  const chunkAddress = getDynamicChunkAddress(dyn, dynSetup.categoryId, 'note', 'bytes');
  const oldChunks: any[] = [];
  for (let i = 0; i < Math.ceil(spec.initial.length / CHUNK); i++) {
    const utxo = randomUtxo({
      satoshis: 1200n,
      token: {
        category: dynSetup.categoryId,
        amount: 0n,
        nft: {
          capability: 'mutable' as const,
          commitment: buildChunkCommitment(i, spec.initial.slice(i * CHUNK, (i + 1) * CHUNK)),
        },
      },
    });
    await provider.addUtxo(chunkAddress, utxo);
    oldChunks.push(utxo);
  }

  // The ROUTER emits every row from its own body, so the hostile order is not a spender's choice.
  const calls = spec.rows.map((row, index) => (row.fn === 'assertShort'
    ? `        IDynNote(note0).assertShort(v${index}, who);`
    : `        IDynNote(note0).setNote(v${index});`)).join('\n');
  const params = [...spec.rows.map((_row, index) => `bytes v${index}`), 'address who'].join(', ');
  const iface = [...new Set(spec.rows.map((row) => row.fn))]
    .map((fn) => (fn === 'assertShort' ? 'function assertShort(bytes p, address w);' : 'function setNote(bytes t);'))
    .join(' ');
  const routerArtifact = compileString(`pragma solidcash >=0.8.0;
    interface IDynNote { ${iface} }
    contract DynRouter(int brand, address note0) {
      function route(${params}) public {
${calls}
        require(true);
      }
    }`, options);
  const routerBase = new Contract(routerArtifact, [1n, dyn.lockingBytecode], { provider });
  const routerSetup = await setupStatefulUtxos(provider, routerBase, routerArtifact.stateLayout!, {});
  const router = routerBase.withCategory(hexToBin(routerSetup.categoryId));

  const published = spec.footprint === 'honest' ? honestArtifact : withFakeWrite(honestArtifact);
  const graphParticipants = [
    { artifact: routerArtifact, lockingBytecode: router.lockingBytecode },
    { artifact: published, lockingBytecode: dyn.lockingBytecode },
  ];
  const graphInvocations = [
    {
      parent: null as number | null,
      callee: 0,
      function: 'route',
      args: [...spec.rows.map((row) => row.value), hexToBin(router.lockingBytecode)],
    },
    ...spec.rows.map((row) => ({
      parent: 0 as number | null,
      callee: 1,
      function: row.fn,
      args: row.fn === 'assertShort' ? [row.value, hexToBin(router.lockingBytecode)] : [row.value],
    })),
  ];
  const plan = spec.constructor === 'handAssembled'
    ? handAssemblePlan(graphParticipants, graphInvocations as any)
    : layer3.planCompiledGraph(graphParticipants as any, graphInvocations as any);
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, ['', ''], layout.projectionInputs,
  );
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

  const seedFee = randomUtxo({ satoshis: 20_000n });
  await provider.addUtxo(p2pkh.address, seedFee);
  const seedTx = new TransactionBuilder({ provider });
  seedTx.addInput(
    genesis.utxos[0], controller.unlock.initialize(hexToBin(transcript.root), alicePub, signature()),
  );
  seedTx.addInput(seedFee, p2pkh.unlock.spend(alicePub, signature()));
  seedTx.addOutput({
    to: controller.tokenAddress,
    amount: genesis.utxos[0].satoshis,
    token: {
      category: controllerCategory, amount: 0n,
      nft: { capability: 'mutable', commitment: transcript.root },
    },
  });
  seedTx.addOutput({ to: p2pkh.address, amount: 15_000n });
  await provider.sendRawTransaction(raw(seedTx));
  const rootedController = (await provider.getUtxos(controller.tokenAddress))
    .find((utxo: any) => utxo.token?.nft?.commitment === transcript.root);

  const projectionUtxos = plan.participants.map(() => randomUtxo({ satoshis: 1000n }));
  for (const proof of projectionUtxos) await provider.addUtxo(projection.address, proof);
  const fee = randomUtxo({ satoshis: 400_000n });
  await provider.addUtxo(p2pkh.address, fee);

  const routeUnlocker = (contract: Contract<any, any>, artifact: any): any =>
    contract.createCompilerRouteUnlocker(artifact.hiddenBatch!.route, hexToBin(artifact.hiddenBatch!.selector));
  const region = layout.trailingRegions.find((entry) => entry.participant === 1)!;

  const builder = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  builder.addInput(routerSetup.masterUtxo, routeUnlocker(router, routerArtifact)(
    ...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as FunctionArgument[] as any,
  ));
  builder.addInput(dynSetup.masterUtxo, routeUnlocker(dyn, honestArtifact)(
    ...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput) as FunctionArgument[] as any,
  ));
  builder.addInput(
    dynSetup.dataNftUtxos[0],
    createDataNftUnlocker(dyn, layout.participantInputs[1], dynSetup.categoryId),
  );
  for (const chunk of oldChunks) {
    builder.addInput(chunk, createDynamicChunkUnlocker(
      dyn, layout.participantInputs[1], dynSetup.categoryId, 'note', 'bytes',
    ));
  }
  for (let i = oldChunks.length; i < region.capacity; i++) {
    const funder = randomUtxo({ satoshis: 1500n });
    await provider.addUtxo(p2pkh.address, funder);
    builder.addInput(funder, p2pkh.unlock.spend(alicePub, signature()));
  }
  projectionUtxos.forEach((proof: any, participant: number) =>
    builder.addInput(proof, projection.unlock.verify(
      transcript.bytes, BigInt(layout.controllerInput), BigInt(participant),
    )));
  builder.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  builder.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));

  builder.addOutput({
    to: router.tokenAddress, amount: routerSetup.masterUtxo.satoshis,
    token: { category: routerSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  builder.addOutput({
    to: dyn.tokenAddress, amount: dynSetup.masterUtxo.satoshis,
    token: { category: dynSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  builder.addOutput({
    to: getDataNftAddress(dyn, dynSetup.categoryId), amount: dynSetup.dataNftUtxos[0].satoshis,
    token: {
      category: dynSetup.categoryId, amount: 0n,
      nft: {
        capability: 'mutable',
        commitment: buildInitialStateCommitments(honestArtifact.stateLayout!, { note: spec.final })[0],
      },
    },
  });
  const pieces = Math.ceil(spec.final.length / CHUNK);
  for (let i = 0; i < pieces; i++) {
    builder.addOutput({
      to: chunkAddress, amount: 1200n,
      token: {
        category: dynSetup.categoryId, amount: 0n,
        nft: {
          capability: 'mutable',
          commitment: buildChunkCommitment(i, spec.final.slice(i * CHUNK, (i + 1) * CHUNK)),
        },
      },
    });
  }
  for (let i = pieces; i < region.capacity; i++) builder.addOutput({ to: p2pkh.address, amount: 1000n });
  for (let i = 0; i < plan.participants.length; i++) {
    builder.addOutput({ to: p2pkh.address, amount: 1000n });
  }
  builder.addOutput({ to: p2pkh.address, amount: 1000n });
  builder.addOutput({ to: p2pkh.address, amount: 20_000n });

  return {
    provider,
    builder,
    transaction: raw(builder),
    dynInput: layout.participantInputs[1],
    bytecode: published.bytecode,
    lockingBytecode: dyn.lockingBytecode,
  };
}

/** Report the first input whose BCH-2026 evaluation fails, so a hostile case names one exact covenant. */
function failingInput(builder: TransactionBuilder): number | null {
  try {
    layer3.preflightLayer3Transaction(builder);
    return null;
  } catch (error) {
    const match = /failed at input (\d+)/.exec((error as Error).message);
    if (!match) throw error;
    return Number(match[1]);
  }
}

const bytes = (length: number, fill: number): Uint8Array => new Uint8Array(length).fill(fill);
const write = (value: Uint8Array): Row => ({ fn: 'setNote', value });
const assertShort = (probeLength: number): Row => ({ fn: 'assertShort', value: bytes(probeLength, 0x21) });

const STALE = /read-only graph emission clone reading 'note'/;

/** A plain SCALAR guard, so the scope of the gate's remaining write claim can be pinned against a contrast. */
const SCALAR_GUARD = `pragma solidcash >=0.8.0;
    contract Vault() {
      bigint balance;
      function withdraw(bigint amount) public {
        this.balance = this.balance - amount;
        require(amount >= 0);
      }
      function assertFloor(bigint floor, address who) public {
        require(this.balance >= floor);
        require(msg.sender == who);
      }
    }`;

const PROBE_OPTIONS = {
  forceStateful: true,
  experimentalHiddenBatch: true,
  experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
  experimentalMessageBusControllerCategory: '22'.repeat(32),
} as const;

const ROUTER_LBC = `aa20${'33'.repeat(32)}87`;
const VAULT_LBC = `aa20${'44'.repeat(32)}87`;

/** Plan two rows against one vault artifact through a router that emits them in order. No provider needed. */
function planAnswer(
  vaultArtifact: any,
  rows: readonly { fn: string; types: readonly string[]; args: readonly any[] }[],
  signatures: Readonly<Record<string, string>>,
): string {
  const calls = rows.map((row, index) =>
    `IV(v).${row.fn}(${row.args.map((_arg, slot) => `p${index}_${slot}`).join(', ')});`).join('\n      ');
  const params = rows.flatMap((row, index) =>
    row.types.map((type, slot) => `${type} p${index}_${slot}`)).join(', ');
  const iface = [...new Set(rows.map((row) => row.fn))].map((fn) => signatures[fn]).join(' ');
  const router = compileString(`pragma solidcash >=0.8.0;
    interface IV { ${iface} }
    contract R(int brand, address v) {
      function route(${params}) public {
      ${calls}
        require(true);
      }
    }`, PROBE_OPTIONS);
  try {
    layer3.planCompiledGraph([
      { artifact: router, lockingBytecode: ROUTER_LBC },
      { artifact: vaultArtifact, lockingBytecode: VAULT_LBC },
    ] as any, [
      { parent: null, callee: 0, function: 'route', args: rows.flatMap((row) => [...row.args]) },
      ...rows.map((row) => ({ parent: 0, callee: 1, function: row.fn, args: [...row.args] })),
    ] as any);
    return 'ADMITTED';
  } catch (error) {
    return `REFUSED: ${(error as Error).message}`;
  }
}

describe('X138 - the gate no longer ADMITS on a published claim', () => {
  const dynRows = [
    { fn: 'setNote', types: ['bytes'], args: [bytes(40, 0x41)] },
    { fn: 'assertShort', types: ['bytes', 'address'], args: [bytes(30, 0x21), hexToBin(ROUTER_LBC)] },
  ];
  const dynSignatures = {
    setNote: 'function setNote(bytes t);', assertShort: 'function assertShort(bytes p, address w);',
  };
  const scalarRows = [
    { fn: 'withdraw', types: ['bigint'], args: [80n] },
    { fn: 'assertFloor', types: ['bigint', 'address'], args: [50n, hexToBin(ROUTER_LBC)] },
  ];
  const scalarSignatures = {
    withdraw: 'function withdraw(bigint v);', assertFloor: 'function assertFloor(bigint v, address w);',
  };

  it('X138-C1 the fake write no longer buys admission on a CHUNK-BACKED slot', () => {
    // R3 of `Layer3EmissionCloneJournalX111.test.ts` recorded this exact artifact as ADMITTED. The gate now
    // reads `stateLayout` for the slot's dynamism and refuses the claim outright where it is load-bearing.
    const vault = compileString(DYN_GUARD, PROBE_OPTIONS);
    expect(planAnswer(vault, dynRows, dynSignatures)).toMatch(STALE);
    expect(planAnswer(withFakeWrite(vault), dynRows, dynSignatures)).toMatch(STALE);
    // GUARD on ORDER, differing in nothing else: reader-first has no earlier write, so it stays admitted.
    expect(planAnswer(withFakeWrite(vault), [dynRows[1], dynRows[0]], dynSignatures)).toBe('ADMITTED');
  }, 180_000);

  it('X138-C2 the claim is still honoured on a PLAIN SCALAR slot, so the change is scoped', () => {
    // The compiler journals a clone's scalar slots whether or not it writes, and the covenant refuses the
    // stale scalar composition itself - X111-V1/V2 broadcast that refusal - so believing a liar here costs a
    // diagnostic and nothing more. This contrast is what keeps X138-C1 a statement about DYNAMIC slots.
    const vault = compileString(SCALAR_GUARD, PROBE_OPTIONS);
    const escaped = JSON.parse(JSON.stringify(vault));
    Object.assign(
      escaped.invocationAnalysis.functions.find((entry: any) => entry.name === '__scb_graph_assertFloor'),
      { writes: ['state:nosuchslot'] },
    );
    expect(vault.stateLayout!.variables.find((v) => v.name === 'balance')!.dynamic).toBeUndefined();
    expect(planAnswer(vault, scalarRows, scalarSignatures))
      .toMatch(/read-only graph emission clone reading 'balance'/);
    expect(planAnswer(escaped, scalarRows, scalarSignatures)).toBe('ADMITTED');
  }, 180_000);
});

describe('X138 - the dynamic residual settles anyway, because no witness-side rule is a boundary', () => {
  it('the subject is a read-only emission clone on a CHUNK-BACKED slot, so this is X111\'s residual', () => {
    const artifact = compileString(DYN_GUARD, {
      forceStateful: true,
      experimentalHiddenBatch: true,
      experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
      experimentalMessageBusControllerCategory: '22'.repeat(32),
    });
    const clone = artifact.invocationAnalysis!.functions.find((entry) => entry.name === CLONE);
    expect(clone).toBeDefined();
    expect(clone!.reads).toEqual(['state:note']);
    expect(clone!.writes).toEqual([]);
    // The slot the clone reads is the chunk-backed one, which is what the compiler refuses to journal.
    expect(artifact.stateLayout!.variables.find((v) => v.name === 'note')!.dynamic).toBe(true);
  }, 180_000);

  it('X138-G GUARD: the planner refuses this exact row set, honest footprint or fake write', async () => {
    // Same contract, same rows, same order. Whichever footprint is published, no plan comes out of the
    // planner - so every settling case below has to be built without it.
    await expect(buildDynGuardGraph({
      rows: [write(bytes(40, 0x41)), assertShort(30)],
      initial: bytes(30, 0x39),
      final: bytes(40, 0x41),
      footprint: 'honest',
    })).rejects.toThrow(STALE);
    await expect(buildDynGuardGraph({
      rows: [write(bytes(40, 0x41)), assertShort(30)],
      initial: bytes(30, 0x39),
      final: bytes(40, 0x41),
      footprint: 'fakeWrite',
    })).rejects.toThrow(STALE);
  }, 300_000);

  it('X138-V1 HOSTILE: the hand-assembled bypass SETTLES a guard false of the post-state', async () => {
    // L2-A1's constructor, so `planCompiledGraph` is never called and no witness-side rule applies. Pre-state
    // note is 30 bytes; row 0 writes 40; row 1 requires `note.length <= 30` - TRUE of the pre-state (30 <= 30)
    // and FALSE of the state this transaction commits (40 <= 30). The scalar equivalent of this composition
    // is refused by the covenant since X111; the chunk-backed one is not.
    const built = await buildDynGuardGraph({
      rows: [write(bytes(40, 0x41)), assertShort(30)],
      initial: bytes(30, 0x39),
      final: bytes(40, 0x41),
      footprint: 'honest',
      constructor: 'handAssembled',
    });
    // INVERTED BY X146. This settled when it was written, and that was the exploit. The dynamic half is now
    // closed AT CONSENSUS: the emission clone's journal was PARTIAL, because a function-pointer table's arrays
    // are named on the external-call slot rather than in the body, so the trailing chunk loop addressed the
    // wrong chunk by one slot. With the journal completed the clone reads live and the covenant refuses here.
    expect(failingInput(built.builder)).toBe(1);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(/mandatory-script-verify-flag-failed/);
  }, 300_000);

  it('X138-V1c the fake write costs NOTHING on chain, which is why no rule reading it can be a boundary',
    async () => {
      // The escaped artifact deploys to the same address and runs the same script. `invocationAnalysis` is
      // metadata no output commits to, so the covenant cannot tell the two apart, and neither can the row set.
      const honest = compileString(DYN_GUARD, PROBE_OPTIONS);
      const escaped = withFakeWrite(honest);
      expect(escaped.bytecode).toBe(honest.bytecode);
      expect(JSON.stringify(escaped.hiddenBatch)).toBe(JSON.stringify(honest.hiddenBatch));
      expect(JSON.stringify(escaped.stateLayout)).toBe(JSON.stringify(honest.stateLayout));
    }, 180_000);

  it('X138-V2 LIVENESS: a probe false of BOTH lengths is refused AT THE DYNAMIC MASTER', async () => {
    // 10 is false of the pre-state 30 and of the post-state 40. Without this, V1 could be a `require` that
    // went vacuous rather than a read that stayed pre-transaction. Differs from V1 in the probe only.
    const built = await buildDynGuardGraph({
      rows: [write(bytes(40, 0x41)), assertShort(10)],
      initial: bytes(30, 0x39),
      final: bytes(40, 0x41),
      footprint: 'honest',
      constructor: 'handAssembled',
    });
    expect(failingInput(built.builder)).toBe(built.dynInput);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(/mandatory-script-verify-flag-failed/);
  }, 300_000);

  it('X138-V3 the read is the PRE value: shrinking the value makes a LIVE read pass and it is REFUSED',
    async () => {
      // Row 0 writes 10 bytes over a 30-byte pre-state and the probe is 10. A live read passes (10 <= 10);
      // a pre-transaction read fails (30 <= 10). It is refused, so the clone demonstrably reads the pre value.
      const built = await buildDynGuardGraph({
        rows: [write(bytes(10, 0x41)), assertShort(10)],
        initial: bytes(30, 0x39),
        final: bytes(10, 0x41),
        footprint: 'honest',
        constructor: 'handAssembled',
      });
      // INVERTED BY X146, and this direction is the one that DISCRIMINATES. A repair that merely broke the
      // clone would leave this refused; it settles, which is what proves the read is LIVE. C2 alone cannot
      // tell the two apart - an unsound basis-only variant also takes C2 to 23/2 while leaving a live array
      // beside a stale chunk-read one, so this pair is the check that matters.
      expect(failingInput(built.builder)).toBe(null);
      await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
    }, 300_000);

  it('X138-V4 ORDER: reader-first is the sequentially correct read and settles', async () => {
    // The clone at local row 0 has no earlier write to have missed, so nothing here is stale. A repair that
    // simply broke the clone would fail this too.
    const built = await buildDynGuardGraph({
      rows: [assertShort(30), write(bytes(40, 0x41))],
      initial: bytes(30, 0x39),
      final: bytes(40, 0x41),
      footprint: 'honest',
      constructor: 'handAssembled',
    });
    expect(failingInput(built.builder)).toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 300_000);
});
