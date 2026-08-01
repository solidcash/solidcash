import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { buildInitialStateCommitments } from '@solidcash/utils';
import {
  Contract, SignatureTemplate, TransactionBuilder, layer3,
} from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createDataNftUnlocker, getDataNftAddress } from '../../src/stateful/covenant-helpers.js';

/**
 * Round-13 independent hostile review (Worker C): G3's SCOPED note, G2 against the X36 entry point, and the
 * structural guard C1's SEC-6 reshape rests on. Worker C implemented none of these rows.
 *
 * SEMANTIC evidence only, on the named `layer3-bch2026-semantic-relaxed-v1` profile.
 *
 * WHAT THIS FILE ATTACKS
 *
 * 1. G3 SCOPED. `Layer3OccurrenceExhaustion` records that a loop the source never bounds publishes no
 *    `maximumOccurrences`, so the planner admits any count up to the global 24-invocation ceiling, and asserts
 *    - in prose, with no VM case - that "the caller covenant still emits exactly the rows the source executes,
 *    so an inflated count is rejected on-chain". That is the claim the scope rests on and it was untested.
 *
 * 2. X36 vs G2. `planCompiledGraph` did not enforce occurrence bounds, so N children could bind one `once`
 *    callsite. G2's own hostile evidence is built through that same entry point, so the question is whether
 *    G2's exhaustion guarantee survives it. It does - the enforcement is the caller covenant, not the planner.
 *    CLOSED SINCE: the entry point now applies the published bound too, so the over-count is refused at plan
 *    time and the covenant refusal this file measured is shadowed rather than removed.
 *
 * 3. CALLEE MULTIPLICITY. Every G2 occurrence case reaches a DISTINCT participant (its fixture co-spends
 *    `[...new Set(reached)]`), so "exact occurrence exhaustion" is only ever demonstrated on the caller's row
 *    vector. A participant reached by several occurrences - one co-spent block serving N rows - is absent from
 *    the shipped set. It is bound: settling fewer executions than rows rejects at the callee's own master.
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

/** The G3 SCOPED shape verbatim: a loop over an unbounded state variable, so no ceiling can be proven. */
const UNBOUNDED_LOOP = `pragma solidcash >=0.8.0;
interface IFoo { function bar(uint value); }
contract UnboundedLoopPlainCall() {
  int n;
  function fireAll(uint value, address target) public {
    for (int i = 0; i < n; i = i + 1) { IFoo(target).bar(value); }
    require(value >= 0);
  }
}`;

/** A `once` callsite: exactly one compiled dispatch, whatever the plan says. */
const ONCE_CALLER = `pragma solidcash >=0.8.0;
interface IFoo { function bar(uint value); }
contract OnceCaller() {
  int n;
  function fire(uint value, address target) public {
    IFoo(target).bar(value);
    this.n = this.n + 1;
    require(value >= 0);
  }
}`;

/** A callee whose post-state counts its own executions, so occurrence collapse is observable. */
const COUNTING_TARGET = `pragma solidcash >=0.8.0;
contract CountingTarget() {
  int hits;
  function bar(uint value) public { this.hits = this.hits + 1; require(value > 0); }
}`;

type SemanticProvider = ReturnType<typeof createLayer3SemanticTestProvider>;

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

interface BuildOptions {
  /** Caller source. The state variable `n` is the only thing that decides how many rows it really emits. */
  callerSource: string;
  /** The caller's persisted trip count. */
  persistedN: bigint;
  /** How many child rows the transcript claims. Only the PLAN varies; the caller covenant never sees it. */
  plannedRows: number;
  /** What the callee's settled post-state claims it executed. Honest is `plannedRows`. */
  settledHits: bigint;
  /** `derive` uses the published bound; `plan` is the X36 entry point that enforces none. */
  entryPoint: 'derive' | 'plan';
  /** The caller's own settled scalar, for the `once` shape which increments it. */
  callerScalar?: Record<string, bigint>;
}

/**
 * One balanced two-participant transaction. Everything except the named field is derived from the artifacts,
 * and the controller commits the RE-DERIVED root, so only a covenant can reject.
 */
async function buildTwoParty(options: BuildOptions): Promise<any> {
  const provider = createLayer3SemanticTestProvider();
  const outpoints = new Set<string>();
  const {
    projection, controller, categoryId: controllerCategory, genesisUtxo,
  } = await createGraphAuthority(provider);
  const busOptions = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: controller.lockingBytecode,
    experimentalMessageBusControllerCategory: controllerCategory,
  };
  const targetArtifact = compileString(COUNTING_TARGET, busOptions);
  const targetBase = new Contract(targetArtifact, [], { provider });
  const targetSetup = await setupStatefulUtxos(provider, targetBase, targetArtifact.stateLayout!, { hits: 0n });
  const target = targetBase.withCategory(hexToBin(targetSetup.categoryId));

  const callerArtifact = compileString(options.callerSource, busOptions);
  const callerBase = new Contract(callerArtifact, [], { provider });
  const isLoop = options.callerSource === UNBOUNDED_LOOP;
  const callerSetup = await setupStatefulUtxos(
    provider, callerBase, callerArtifact.stateLayout!, { n: options.persistedN },
  );
  const caller = callerBase.withCategory(hexToBin(callerSetup.categoryId));

  const rootParticipant = { artifact: callerArtifact, lockingBytecode: caller.lockingBytecode };
  const targetParticipant = { artifact: targetArtifact, lockingBytecode: target.lockingBytecode };
  const entryFunction = isLoop ? 'fireAll' : 'fire';
  const plan = options.entryPoint === 'derive'
    ? layer3.deriveCompiledGraphPlan({
      root: rootParticipant,
      function: entryFunction,
      args: [4n, target.lockingBytecode],
      targets: { IFoo: targetParticipant },
      occurrence: ({ kind }: any) => (kind === 'loop' ? options.plannedRows : 0),
    })
    : layer3.planCompiledGraph([rootParticipant, targetParticipant], [
      { parent: null, callee: 0, function: entryFunction, args: [4n, target.lockingBytecode] },
      ...Array.from({ length: options.plannedRows }, () => ({
        parent: 0, callee: 1, function: 'bar', args: [4n], callMode: 'call' as const,
      })),
    ]);
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

  const callerRoute = caller.createCompilerRouteUnlocker(
    callerArtifact.hiddenBatch!.route, hexToBin(callerArtifact.hiddenBatch!.selector),
  );
  const targetRoute = target.createCompilerRouteUnlocker(
    targetArtifact.hiddenBatch!.route, hexToBin(targetArtifact.hiddenBatch!.selector),
  );
  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  tx.addInput(
    callerSetup.masterUtxo,
    callerRoute(...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as any),
  );
  tx.addInput(
    callerSetup.dataNftUtxos[0],
    createDataNftUnlocker(caller, layout.participantInputs[0], callerSetup.categoryId),
  );
  tx.addInput(
    targetSetup.masterUtxo,
    targetRoute(...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput) as any),
  );
  tx.addInput(
    targetSetup.dataNftUtxos[0],
    createDataNftUnlocker(target, layout.participantInputs[1], targetSetup.categoryId),
  );
  projections.forEach((proof, participant) => tx.addInput(
    proof, projection.unlock.verify(transcript.bytes, BigInt(layout.controllerInput), BigInt(participant)),
  ));
  tx.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));

  tx.addOutput({
    to: caller.tokenAddress, amount: callerSetup.masterUtxo.satoshis, token: callerSetup.masterUtxo.token,
  });
  tx.addOutput({
    to: getDataNftAddress(caller, callerSetup.categoryId),
    amount: callerSetup.dataNftUtxos[0].satoshis,
    token: options.callerScalar
      ? {
        category: callerSetup.categoryId,
        amount: 0n,
        nft: {
          capability: 'mutable' as const,
          commitment: buildInitialStateCommitments(callerArtifact.stateLayout!, options.callerScalar)[0],
        },
      }
      : callerSetup.dataNftUtxos[0].token,
  });
  tx.addOutput({
    to: target.tokenAddress, amount: targetSetup.masterUtxo.satoshis, token: targetSetup.masterUtxo.token,
  });
  tx.addOutput({
    to: getDataNftAddress(target, targetSetup.categoryId),
    amount: targetSetup.dataNftUtxos[0].satoshis,
    token: {
      category: targetSetup.categoryId,
      amount: 0n,
      nft: {
        capability: 'mutable' as const,
        commitment: buildInitialStateCommitments(targetArtifact.stateLayout!, { hits: options.settledHits })[0],
      },
    },
  });
  for (let index = 0; index < projections.length + 1; index++) {
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
  }
  tx.addOutput({ to: p2pkh.address, amount: 10_000n });
  return {
    provider, builder: tx, transaction: raw(tx), transcript, plan, layout,
  };
}

const preflight = (built: any): string => {
  try {
    layer3.preflightLayer3Transaction(built.builder);
    return 'ACCEPTED';
  } catch (error) {
    return (error as Error).message;
  }
};

const settles = async (built: any): Promise<boolean> => {
  try {
    await built.provider.sendRawTransaction(built.transaction);
    return true;
  } catch {
    return false;
  }
};

describe('Layer-3 round-13 review: G3 SCOPED and G2 against the X36 entry point (SEMANTIC)', () => {
  /**
   * G3's SCOPED note, on the VM. The published artifact carries NO ceiling for this shape, so `plannedRows` is
   * pure witness data - the source's own `n` is the only thing that decides how many rows the covenant
   * partitions. Every row below shares one honest control (n == planned) that settles and broadcasts.
   */
  it.each([1, 2, 3, 6])(
    'G3 CLOSED: an unbounded loop is transcript-ineligible even with %i caller-planned rows',
    async (plannedRows) => {
      const artifact = compileString(UNBOUNDED_LOOP, {
        forceStateful: true,
        experimentalHiddenBatch: true,
        experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
        experimentalMessageBusControllerCategory: '22'.repeat(32),
      });
      // No finite ceiling is published, so neither planner may trust a caller-supplied row count.
      expect(artifact.abi.find((fn) => fn.name === 'fireAll')!.externalCalls![0].maximumOccurrences)
        .toBeUndefined();
      await expect(buildTwoParty({
        callerSource: UNBOUNDED_LOOP,
        persistedN: 2n,
        plannedRows,
        settledHits: BigInt(plannedRows),
        entryPoint: 'derive',
      })).rejects.toThrow(
        'layer3 [L3_UNBOUNDED_EXTERNAL_CALL_LOOP]: unbounded-external-call-loop-transcript-ineligible: callsite 0',
      );
    },
    300_000,
  );

  /**
   * X36 against G2. This review measured `planCompiledGraph` accepting two and three children on a callsite
   * the artifact publishes as `once` with `maximumOccurrences: 1`, and recorded that the caller covenant
   * refused all of them at input 0 - so G2's guarantee was the covenant's, not the planner's.
   *
   * CLOSED. `planCompiledGraph` now applies the same bound `deriveCompiledGraphPlan` does, so the over-count
   * is named before a transaction exists. The covenant rejection this review demonstrated has not moved; it is
   * shadowed by an earlier guard that names the fault precisely instead of failing as a row-partition
   * mismatch. The one-child row is unchanged and still carries the honest VM control.
   */
  it.each([
    { children: 1, settles: true },
    { children: 2, settles: false },
    { children: 3, settles: false },
  ])('X36: $children children bound to one `once` callsite', async ({ children, settles: expectSettle }) => {
    const artifact = compileString(ONCE_CALLER, {
      forceStateful: true,
      experimentalHiddenBatch: true,
      experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
      experimentalMessageBusControllerCategory: '22'.repeat(32),
    });
    const call = artifact.abi.find((fn) => fn.name === 'fire')!.externalCalls![0];
    expect(call.occurrence).toBe('once');
    expect(call.maximumOccurrences).toBe(1);
    const build = (): Promise<any> => buildTwoParty({
      callerSource: ONCE_CALLER,
      persistedN: 0n,
      plannedRows: children,
      settledHits: BigInt(children),
      entryPoint: 'plan',
      callerScalar: { n: 1n },
    });
    if (!expectSettle) {
      await expect(build()).rejects.toThrow(
        `layer3: callsite 0 is a once callsite reached at most once, but ${children} occurrences were planned`,
      );
      return;
    }
    const built = await build();
    expect(built.plan.invocations).toHaveLength(children + 1);
    expect(preflight(built)).toBe('ACCEPTED');
    await expect(settles(built)).resolves.toBe(true);
  }, 300_000);

  /**
   * CALLEE MULTIPLICITY, which G2's fixture cannot express: one co-spent participant block answering N
   * occurrences. The honest settlement is `hits == n`; a collapse to a single execution is refused at input 2,
   * the callee's own master, with the caller's rows and the whole transcript honest.
   */
  it.each([1n, 2n, 3n])(
    'the low-level planner also refuses an unbounded caller with %s proposed occurrences',
    async (persistedN) => {
      await expect(buildTwoParty({
        callerSource: UNBOUNDED_LOOP,
        persistedN,
        plannedRows: Number(persistedN),
        settledHits: persistedN,
        entryPoint: 'plan',
      })).rejects.toThrow(
        'layer3 [L3_UNBOUNDED_EXTERNAL_CALL_LOOP]: unbounded-external-call-loop-transcript-ineligible: callsite 0',
      );
    },
    300_000,
  );
});

/**
 * C1's SEC-6 structural guard asserts that no calling participant carries an owner-local physical slot, and
 * justifies reading it off `route.blockLayout` with: "each of them is what makes the route wrapper reserve an
 * owner-local event / transfer / tcTransfer slot. So the published block layout is an exact, SDK-visible proxy
 * for the compiler-internal predicate: a participant with an outgoing edge and an owner-local physical slot is
 * the forgeable shape."
 *
 * Measured at this commit, the layout is NOT equivalent to `keepsGraphEmissionBinding`, and the defect model
 * is the pre-X29 one. The guard is still SAFE - every shape it fails to distinguish is refused elsewhere or is
 * bound - but "exact proxy" and "is the forgeable shape" are both false as written.
 *
 * The one-variable matrix below varies only the body of `report`, the entry point that is NOT the graph edge.
 * `notify` - the calling handler - is byte-identical in every row.
 */
describe('C1 review: route.blockLayout is not equivalent to keepsGraphEmissionBinding', () => {
  const BUS_OPTIONS = {
    forceStateful: true,
    experimentalHiddenBatch: true,
    experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
    experimentalMessageBusControllerCategory: '22'.repeat(32),
  };
  /** `verifyGraphEmissionRow`'s target||len||mode frame construction; 0 is the flattened, unbound form. */
  const MARK = '76827752807c7e';
  const PHYSICAL = new Set(['event', 'transfer', 'tcTransfer']);

  const sibling = (reportBody: string): string => `pragma solidcash >=0.8.0;
interface IC1Leg { function credit(bigint amount); }
contract SiblingVariant(address leg, bytes recipient) {
  bigint total;
  event Fired(bigint amount);
  function notify(bigint amount) public {
    this.total = this.total + amount;
    IC1Leg(leg).credit(amount);
    require(amount > 0);
  }
${reportBody}
}`;

  const measure = (source: string): {
    marks: number; physicalSlots: number; eligible: boolean | undefined; reason: string | undefined;
  } => {
    const artifact = compileString(source, BUS_OPTIONS) as any;
    const kinds = (artifact.hiddenBatch?.route?.blockLayout?.slots ?? []).map((slot: any) => slot.kind);
    const notify = artifact.hiddenBatch?.handlers?.find((handler: any) => handler.name === 'notify');
    return {
      marks: (artifact.debug!.bytecode as string).split(MARK).length - 1,
      physicalSlots: kinds.filter((kind: string) => PHYSICAL.has(kind)).length,
      eligible: notify?.eligible,
      reason: notify?.rejectionReason,
    };
  };

  const PLAIN_SIBLING = `  function report(bigint amount) public {
    this.total = this.total + amount;
    require(amount > 0);
  }`;

  /**
   * The baseline both halves of the claim are measured against: an effect-free calling handler in a contract
   * with an effect-free sibling. Binding present, no physical slot - the shape C1's guard is written for.
   */
  it('baseline: an effect-free caller is bound and declares no physical slot', () => {
    const withSibling = measure(sibling(PLAIN_SIBLING));
    expect(withSibling.marks).toBeGreaterThan(0);
    expect(withSibling.physicalSlots).toBe(0);
    expect(withSibling.eligible).toBe(true);
  }, 120_000);

  /**
   * NOT SUFFICIENT. X29 repaired exactly the shape the guard names: an effect on the CALLING handler, with an
   * outgoing edge, keeps its clone behind OP_INVOKE and keeps its emission binding - while declaring the very
   * slots the guard treats as the signature of forgery. C1's guard would reject C1's own pre-reshape Router,
   * which at this commit is bound and eligible.
   */
  it('a physical slot on a CALLING handler no longer implies lost binding', () => {
    const selfEmit = measure(`pragma solidcash >=0.8.0;
interface IC1Leg { function credit(bigint amount); }
contract SelfEmitter(address leg, bytes recipient) {
  bigint total;
  event Fired(bigint amount);
  function notify(bigint amount) public {
    this.total = this.total + amount;
    IC1Leg(leg).credit(amount);
    emit Fired(amount);
    require(amount > 0);
  }
}`);
    expect(selfEmit.physicalSlots).toBe(8);
    // The guard would call this the forgeable shape. It is bound, and eligible.
    expect(selfEmit.marks).toBeGreaterThan(0);
    expect(selfEmit.eligible).toBe(true);
  }, 120_000);

  /**
   * NOT ATTRIBUTABLE. A slot in the route layout does not say which handler owns it. Adding one `transfer` to
   * the NON-calling sibling gives the participant eight `transfer` slots plus a satoshi container while the
   * calling handler stays effect-free and bound - so "a CALLING participant carries an owner-local physical
   * slot" cannot be read off `blockLayout` at all. The per-handler projection
   * (`hiddenBatch.handlers[].emits/.transfers`) does carry that attribution, and the SDK already uses it.
   */
  it('a physical slot cannot be attributed to the calling handler from the layout', () => {
    const control = measure(sibling(PLAIN_SIBLING));
    const siblingTransfer = measure(sibling(`  function report(bigint amount) public {
    this.total = this.total + amount;
    this.transfer(recipient, 10);
    require(amount > 0);
  }`));
    // Differs from the control by exactly one `this.transfer` in a handler with NO outgoing edge.
    expect(control.physicalSlots).toBe(0);
    expect(siblingTransfer.physicalSlots).toBe(8);
    expect(siblingTransfer.marks).toBe(control.marks);
    expect(siblingTransfer.eligible).toBe(true);
  }, 120_000);

  /**
   * The one row where the marks DO fall to zero, and it is a compiler refusal rather than an escape: an `emit`
   * on the edge-free sibling makes the CALLING handler ineligible by name, and both graph planner entry points
   * refuse to plan it. Recorded so a future reader does not mistake `marks == 0` here for SEC-6's flattening.
   */
  it('an emitting sibling makes the calling handler INELIGIBLE, and both planners refuse it', () => {
    const source = sibling(`  function report(bigint amount) public {
    this.total = this.total + amount;
    emit Fired(amount);
    require(amount > 0);
  }`);
    const emitting = measure(source);
    expect(emitting.marks).toBe(0);
    expect(emitting.physicalSlots).toBe(8);
    expect(emitting.eligible).toBe(false);
    expect(emitting.reason).toBe('event-route-requires-uniform-events-and-at-most-one-value-transfer');

    const artifact = compileString(source, BUS_OPTIONS);
    const leg = compileString(`pragma solidcash >=0.8.0;
contract Leg() {
  bigint credited;
  function credit(bigint amount) public { this.credited = this.credited + amount; require(amount > 0); }
}`, BUS_OPTIONS);
    const participants = [
      { artifact, lockingBytecode: '51' }, { artifact: leg, lockingBytecode: '52' },
    ];
    const refusal = /not batch eligible: event-route-requires-uniform-events/;
    expect(() => layer3.planCompiledGraph(participants as any, [
      { parent: null, callee: 0, function: 'notify', args: [7n] },
      { parent: 0, callee: 1, function: 'credit', args: [7n], callMode: 'call' },
    ])).toThrow(refusal);
    expect(() => layer3.deriveCompiledGraphPlan({
      root: participants[0] as any, function: 'notify', args: [7n], targets: { IC1Leg: participants[1] as any },
      target: () => participants[1] as any,
    })).toThrow(refusal);
  }, 120_000);

  /**
   * The guard's genuine blind spot - a physical effect the layout does NOT reveal - is currently unreachable,
   * and by a compiler throw rather than by the proxy. `Layer3EmissionEffectEscape` records the shape as
   * `[master, dataNft]` for a container transfer with no container read; at this commit it does not compile.
   */
  it('the slotless container transfer the proxy could not see is refused at compile time', () => {
    expect(() => compileString(`pragma solidcash >=0.8.0;
contract TcOnly() {
  int total;
  function fireAll(bytes32 category, bytes20 recipient, int value) public {
    this.tokens[category].transfer(recipient, value);
    this.total = this.total + value;
    require(true);
  }
}`, BUS_OPTIONS)).toThrow(/performs a token-container operation, which the route reserves no output slot for/);
  }, 120_000);
});
