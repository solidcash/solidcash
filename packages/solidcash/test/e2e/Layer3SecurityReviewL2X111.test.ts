import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { buildInitialStateCommitments } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import type { FunctionArgument } from '../../src/Argument.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createDataNftUnlocker, getDataNftAddress } from '../../src/stateful/covenant-helpers.js';

/**
 * L2 ADVERSARIAL REVIEW of X111 (`packages/solidcash/src/layer3/graph.ts`
 * `assertNoStaleEmissionCloneReads`) and of SEC-18's emission-clone exclusion
 * (`GenerateTargetTraversal.ts:1780`).
 *
 * The author's own headline is that the gate refuses at WITNESS-CONSTRUCTION time and that the
 * exploit bytes still settle if any other constructor produces them. This file tests that claim as
 * a claim, not as a caveat, by producing the identical hostile transaction through constructors
 * that never call `planCompiledGraph`:
 *
 *   L2-A1  hand-assembled `CompiledGraphPlan` -> `finalizeCompiledGraph`. No planner call at all.
 *   L2-A2  the real artifact with the clone entry dropped from `invocationAnalysis.functions`.
 *          Nothing in the transaction commits to that field, so the covenant bytes are unchanged.
 *
 * Both are compared against a POSITIVE CONTROL (the planner refusing the same row set) and a GUARD
 * NEGATIVE CONTROL that differs from the hostile case in exactly the attacked field.
 */

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);

/** Subject vault, copied verbatim from the X111 fixture so the two files attack one shape. */
const VAULT_SENDER = `pragma solidcash >=0.8.0;
    contract Vault() {
      bigint balance;
      bigint other;
      function withdraw(bigint amount) public {
        this.balance = this.balance - amount;
        require(amount >= 0);
      }
      function bumpOther(bigint n) public {
        this.other = this.other + n;
        require(n >= 0);
      }
      function assertFloor(bigint floor, address expectedSender) public {
        require(this.balance >= floor);
        require(msg.sender == expectedSender);
      }
    }`;

type Handler = 'withdraw' | 'bumpOther' | 'assertFloor';
interface Row { fn: Handler; value: bigint }

const SIGNATURES: Readonly<Record<Handler, string>> = {
  withdraw: 'function withdraw(bigint v);',
  bumpOther: 'function bumpOther(bigint v);',
  assertFloor: 'function assertFloor(bigint v, address s);',
};

/** How the plan handed to `finalizeCompiledGraph` is produced. */
type Constructor = 'planner' | 'handAssembled' | 'decoyAnalysis';

interface Spec {
  rows: Row[];
  opening: bigint;
  constructor: Constructor;
}

interface Built {
  provider: ReturnType<typeof createTestProvider>;
  builder: TransactionBuilder;
  transaction: string;
  closing: bigint;
  vaultInput: number;
  root: string;
  /** Vault locking bytecode, to prove the covenant is byte-identical across constructors. */
  vaultLbc: string;
  /**
   * Transcript root each bypass constructor produces from THIS fixture's artifacts. Computed inside one
   * setup because every build randomises its token categories, so roots are only comparable within one.
   */
  rootsByConstructor: Readonly<Record<'handAssembled' | 'decoyAnalysis', string>>;
}

/**
 * Reproduce `planCompiledGraph`'s output for a two-participant, root-plus-N-void-rows graph without
 * calling it. Every field `finalizeCompiledGraph` reads is derived from the same `encodeHiddenBatch`
 * the planner uses, so the transcript is the planner's transcript - only the gate is absent.
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
  // Canonical depth-first subtree ends, exactly as the planner walks them.
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

/** Strip one emission clone from the published footprint. Covenant-irrelevant by construction. */
function withoutClone(artifact: any, cloneName: string): any {
  return {
    ...artifact,
    invocationAnalysis: {
      ...artifact.invocationAnalysis,
      functions: artifact.invocationAnalysis.functions
        .filter((entry: any) => entry.name !== cloneName),
    },
  };
}

async function buildGuardGraph(spec: Spec): Promise<Built> {
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
  const vaultArtifact = compileString(VAULT_SENDER, options);
  const vaultBase = new Contract(vaultArtifact, [], { provider });
  const vaultSetup = await setupStatefulUtxos(
    provider, vaultBase, vaultArtifact.stateLayout!, { balance: spec.opening, other: 0n },
  );
  const vault = vaultBase.withCategory(hexToBin(vaultSetup.categoryId));

  const calls = spec.rows.map((row, index) => (row.fn === 'assertFloor'
    ? `        IVault(vault).assertFloor(a${index}, sender);`
    : `        IVault(vault).${row.fn}(a${index});`)).join('\n');
  const params = [...spec.rows.map((_row, index) => `bigint a${index}`), 'address sender'].join(', ');
  const iface = [...new Set(spec.rows.map((row) => row.fn))].map((fn) => SIGNATURES[fn]).join(' ');
  const routerArtifact = compileString(`pragma solidcash >=0.8.0;
    interface IVault { ${iface} }
    contract GuardRouter(int brand, address vault) {
      function route(${params}) public {
${calls}
        require(true);
      }
    }`, options);
  const routerBase = new Contract(routerArtifact, [1n, vault.lockingBytecode], { provider });
  const routerSetup = await setupStatefulUtxos(provider, routerBase, routerArtifact.stateLayout!, {});
  const router = routerBase.withCategory(hexToBin(routerSetup.categoryId));

  const graphParticipants = [
    { artifact: routerArtifact, lockingBytecode: router.lockingBytecode },
    { artifact: vaultArtifact, lockingBytecode: vault.lockingBytecode },
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
      args: row.fn === 'assertFloor'
        ? [row.value, hexToBin(router.lockingBytecode)]
        : [row.value],
    })),
  ];

  let plan: any;
  if (spec.constructor === 'planner') {
    plan = layer3.planCompiledGraph(graphParticipants as any, graphInvocations as any);
  } else if (spec.constructor === 'handAssembled') {
    plan = handAssemblePlan(graphParticipants, graphInvocations as any);
  } else {
    plan = layer3.planCompiledGraph([
      graphParticipants[0],
      { ...graphParticipants[1], artifact: withoutClone(vaultArtifact, '__scb_graph_assertFloor') },
    ] as any, graphInvocations as any);
  }

  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs, ['', ''], layout.projectionInputs,
  );
  // Same fixture, both bypass constructors, so the roots are comparable.
  const rootOf = (candidate: any): string => {
    const candidateLayout = layer3.compiledGraphPhysicalLayout(candidate);
    return layer3.finalizeCompiledGraph(
      candidate, {}, candidateLayout.participantInputs, candidateLayout.returnOutputs,
      ['', ''], candidateLayout.projectionInputs,
    ).root;
  };
  const rootsByConstructor = {
    handAssembled: rootOf(handAssemblePlan(graphParticipants, graphInvocations as any)),
    decoyAnalysis: rootOf(layer3.planCompiledGraph([
      graphParticipants[0],
      { ...graphParticipants[1], artifact: withoutClone(vaultArtifact, '__scb_graph_assertFloor') },
    ] as any, graphInvocations as any)),
  };
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
  const fee = randomUtxo({ satoshis: 50_000n });
  await provider.addUtxo(p2pkh.address, fee);

  const closing = spec.rows.reduce(
    (running, row) => (row.fn === 'withdraw' ? running - row.value : running), spec.opening,
  );
  const otherClosing = spec.rows.reduce(
    (running, row) => (row.fn === 'bumpOther' ? running + row.value : running), 0n,
  );
  const routeUnlocker = (contract: Contract<any, any>, artifact: any): any =>
    contract.createCompilerRouteUnlocker(artifact.hiddenBatch!.route, hexToBin(artifact.hiddenBatch!.selector));

  const builder = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  builder.addInput(routerSetup.masterUtxo, routeUnlocker(router, routerArtifact)(
    ...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as FunctionArgument[] as any,
  ));
  builder.addInput(vaultSetup.masterUtxo, routeUnlocker(vault, vaultArtifact)(
    ...layer3.compiledGraphRouteArgs(transcript, 1, layout.controllerInput) as FunctionArgument[] as any,
  ));
  builder.addInput(
    vaultSetup.dataNftUtxos[0],
    createDataNftUnlocker(vault, layout.participantInputs[1], vaultSetup.categoryId),
  );
  projectionUtxos.forEach((proof: any, participant: number) =>
    builder.addInput(proof, projection.unlock.verify(
      transcript.bytes, BigInt(layout.controllerInput), BigInt(participant),
    )));
  builder.addInput(rootedController, controller.unlock.attest(transcript.bytes));
  builder.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));

  const dataNftOffset = plan.participants[1].blockLayout.slots
    .find((slot: any) => slot.kind === 'dataNft')!.offset;
  const placed = new Map<number, () => void>([
    [layout.participantInputs[0], () => builder.addOutput({
      to: router.tokenAddress, amount: routerSetup.masterUtxo.satoshis,
      token: { category: routerSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    })],
    [layout.participantInputs[1], () => builder.addOutput({
      to: vault.tokenAddress, amount: vaultSetup.masterUtxo.satoshis,
      token: { category: vaultSetup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    })],
    [layout.participantInputs[1] + dataNftOffset, () => builder.addOutput({
      to: getDataNftAddress(vault, vaultSetup.categoryId), amount: vaultSetup.dataNftUtxos[0].satoshis,
      token: {
        category: vaultSetup.categoryId, amount: 0n,
        nft: {
          capability: 'mutable',
          commitment: buildInitialStateCommitments(
            vaultArtifact.stateLayout!, { balance: closing, other: otherClosing },
          )[0],
        },
      },
    })],
  ]);
  for (let slot = 0; slot < layout.totalSlots; slot += 1) {
    const place = placed.get(slot);
    if (place) place();
    else builder.addOutput({ to: p2pkh.address, amount: slot === layout.totalSlots - 1 ? 20_000n : 1000n });
  }
  return {
    provider,
    builder,
    transaction: raw(builder),
    closing,
    vaultInput: layout.participantInputs[1],
    root: transcript.root,
    vaultLbc: vault.lockingBytecode,
    rootsByConstructor,
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

const STALE = /read-only graph emission clone reading 'balance'/;

const HOSTILE: Row[] = [{ fn: 'withdraw', value: 80n }, { fn: 'assertFloor', value: 50n }];

describe('L2 review of X111 - is the gate a soundness fix or a client-side lint?', () => {
  it('L2-P0 POSITIVE CONTROL: the guarded planner does refuse the hostile row set', async () => {
    await expect(buildGuardGraph({ constructor: 'planner', opening: 100n, rows: HOSTILE }))
      .rejects.toThrow(STALE);
  }, 300_000);

  it('L2-A1 HOSTILE: a hand-assembled plan never calls the planner, and the bytes SETTLE', async () => {
    // opening 100 -> closing 20. `assertFloor(50)` is TRUE of 100 and FALSE of 20.
    const built = await buildGuardGraph({
      constructor: 'handAssembled', opening: 100n, rows: HOSTILE,
    });
    expect(built.closing).toBe(20n);
    expect(failingInput(built.builder)).toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 300_000);

  it('L2-A1n GUARD on the ATTACKED FIELD: the same hand-assembled route with a TRUE floor', async () => {
    // Differs from L2-A1 in the floor value ONLY. 50 is false of the post-balance 20; 10 is true of it.
    // Both are admitted by the hand-assembled constructor, so L2-A1 settling is not the covenant being dead:
    // this case settles because the guard is genuinely satisfied, and the next case shows the covenant bites.
    const built = await buildGuardGraph({
      constructor: 'handAssembled',
      opening: 100n,
      rows: [{ fn: 'withdraw', value: 80n }, { fn: 'assertFloor', value: 10n }],
    });
    expect(built.closing).toBe(20n);
    expect(failingInput(built.builder)).toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 300_000);

  it('L2-A1L LIVENESS: a floor false of BOTH balances is refused at the vault input', async () => {
    // 150 is false of the opening 100 and of the closing 20, so the guard row is not vacuous under the
    // hand-assembled constructor either. This is what makes L2-A1 a stale READ rather than a dead require.
    const built = await buildGuardGraph({
      constructor: 'handAssembled',
      opening: 100n,
      rows: [{ fn: 'withdraw', value: 80n }, { fn: 'assertFloor', value: 150n }],
    });
    expect(failingInput(built.builder)).toBe(built.vaultInput);
  }, 300_000);

  it('L2-A2 HOSTILE: dropping the clone from invocationAnalysis silences the gate, and it SETTLES', async () => {
    // The gate's only decision input is `artifact.invocationAnalysis.functions`. Nothing in the transaction
    // commits to it, so a plan built from a footprint missing the clone produces the same covenant bytes.
    const built = await buildGuardGraph({
      constructor: 'decoyAnalysis', opening: 100n, rows: HOSTILE,
    });
    expect(built.closing).toBe(20n);
    expect(failingInput(built.builder)).toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 300_000);

  it('L2-A3 both bypass constructors produce ONE transcript root from one fixture', async () => {
    // If the roots agree, the two constructors are producing the same transaction, so neither is an artefact
    // of its own encoder. Compared inside one build because each build randomises its token categories.
    const built = await buildGuardGraph({ constructor: 'handAssembled', opening: 100n, rows: HOSTILE });
    expect(built.rootsByConstructor.handAssembled).toBe(built.rootsByConstructor.decoyAnalysis);
    expect(built.root).toBe(built.rootsByConstructor.handAssembled);
  }, 300_000);
});
