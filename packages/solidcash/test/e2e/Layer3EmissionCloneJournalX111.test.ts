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
 * X111 CLOSED AT CONSENSUS - the graph emission clone now loads through the live scalar journal.
 *
 * `computeScalarJournalClosures` used to drop every `graphEmissionHandler` from SEC-18's route-reachable
 * widening, so a clone that reads a scalar slot and writes none re-read the pre-transaction NFT commitment.
 * The gate in `layer3/graph.ts` refused that composition at WITNESS-CONSTRUCTION time only, which the L2
 * review falsified with two constructors that never call `planCompiledGraph`. This file re-runs both of those
 * constructors and requires the COVENANT to refuse, at a named input index.
 *
 * Every hostile case here is built by a bypass constructor, so nothing in the SDK is between the bytes and
 * the VM. Each is paired with a guard negative control differing in exactly one field.
 */

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);

/** X111's subject, verbatim. `assertFloor` reads `balance`, writes nothing, and reads msg.sender. */
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

/** How the plan handed to `finalizeCompiledGraph` is produced. Both bypasses come from the L2 review. */
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
  /** The clone the repair must journal, as the compiler publishes it. */
  cloneReads: readonly string[];
  cloneWrites: readonly string[];
}

/**
 * L2-A1's constructor: reproduce `planCompiledGraph`'s output for a two-participant, root-plus-N-void-rows
 * graph without calling it. Every field `finalizeCompiledGraph` reads comes from the same `encodeHiddenBatch`
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

/** L2-A2's constructor: strip one emission clone from the published footprint. Covenant-irrelevant. */
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

  // The ROUTER emits every row from its own body, so the hostile order is not a spender's choice.
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
  const clone = vaultArtifact.invocationAnalysis!.functions
    .find((entry) => entry.name === '__scb_graph_assertFloor');
  return {
    provider,
    builder,
    transaction: raw(builder),
    closing,
    vaultInput: layout.participantInputs[1],
    cloneReads: (clone?.reads ?? []).filter((resource) => resource.startsWith('state:')),
    cloneWrites: (clone?.writes ?? []).filter((resource) => resource.startsWith('state:')),
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

const HOSTILE: Row[] = [{ fn: 'withdraw', value: 80n }, { fn: 'assertFloor', value: 50n }];

describe('X111 at consensus - the emission clone reads the journal, not the pre-state', () => {
  it('the subject is still a read-only emission clone, so the repair is not a shape change', async () => {
    // If this stops holding, every hostile case below is attacking a different contract.
    const built = await buildGuardGraph({ constructor: 'handAssembled', opening: 100n, rows: HOSTILE });
    expect(built.cloneReads).toEqual(['state:balance']);
    expect(built.cloneWrites).toEqual([]);
  }, 300_000);

  it('X111-V1 HOSTILE: the hand-assembled bypass is refused BY THE COVENANT at the vault master', async () => {
    // L2-A1's constructor verbatim - `planCompiledGraph` is never called, so the SDK gate cannot fire.
    // opening 100 -> closing 20. `assertFloor(50)` is TRUE of the pre-state and FALSE of the post-state.
    // Before the repair these exact bytes SETTLED.
    const built = await buildGuardGraph({ constructor: 'handAssembled', opening: 100n, rows: HOSTILE });
    expect(built.closing).toBe(20n);
    expect(failingInput(built.builder)).toBe(built.vaultInput);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(/mandatory-script-verify-flag-failed/);
  }, 300_000);

  it('X111-V1n GUARD on the ATTACKED FIELD: the same bypass with a floor TRUE of the POST-state', async () => {
    // Differs from V1 in the floor value ONLY: 10 is true of the closing 20, 50 is not. So V1 is refused
    // because the guard now reads 20, not because the hand-assembled route stopped settling at all.
    const built = await buildGuardGraph({
      constructor: 'handAssembled',
      opening: 100n,
      rows: [{ fn: 'withdraw', value: 80n }, { fn: 'assertFloor', value: 10n }],
    });
    expect(built.closing).toBe(20n);
    expect(failingInput(built.builder)).toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 300_000);

  it('X111-V2 HOSTILE: dropping the clone from invocationAnalysis no longer buys settlement', async () => {
    // L2-A2's constructor. The gate's only decision input is `invocationAnalysis.functions`, and nothing in
    // the transaction commits to it - which is exactly why a witness-construction refusal could not close the
    // row. The covenant does not read that field at all, so silencing the gate changes nothing now.
    const built = await buildGuardGraph({ constructor: 'decoyAnalysis', opening: 100n, rows: HOSTILE });
    expect(built.closing).toBe(20n);
    expect(failingInput(built.builder)).toBe(built.vaultInput);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(/mandatory-script-verify-flag-failed/);
  }, 300_000);

  it('X111-V3 LIVENESS: a floor false of BOTH balances is still refused at the vault', async () => {
    // 150 is false of the opening 100 and of the closing 20. Without this, V1 could be a require that went
    // vacuous rather than a read that moved.
    const built = await buildGuardGraph({
      constructor: 'handAssembled',
      opening: 100n,
      rows: [{ fn: 'withdraw', value: 80n }, { fn: 'assertFloor', value: 150n }],
    });
    expect(failingInput(built.builder)).toBe(built.vaultInput);
  }, 300_000);

  it('X111-V4 ORDER: reader-first still settles, so the repair is not a blanket refusal', async () => {
    // The clone at local row 0 reads the opening 100, which 50 is true of. A repair that simply broke the
    // clone would fail here too.
    const built = await buildGuardGraph({
      constructor: 'handAssembled',
      opening: 100n,
      rows: [{ fn: 'assertFloor', value: 50n }, { fn: 'withdraw', value: 80n }],
    });
    expect(built.closing).toBe(20n);
    expect(failingInput(built.builder)).toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 300_000);

  it('X111-V5 SLOT: an earlier writer of a DISJOINT slot still settles', async () => {
    // `bumpOther` writes `other`; the clone reads `balance`. The journal is per slot, so this must not move.
    const built = await buildGuardGraph({
      constructor: 'handAssembled',
      opening: 100n,
      rows: [{ fn: 'bumpOther', value: 7n }, { fn: 'assertFloor', value: 50n }],
    });
    expect(built.closing).toBe(100n);
    expect(failingInput(built.builder)).toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 300_000);

  it('X111-V6 the honest act-then-assert order the SDK gate refuses now SETTLES through the planner', async () => {
    // The composition an honest author writes: withdraw, then assert the POST-condition. `assertFloor(10)` is
    // false of nothing here - it is true of the closing 20 and the guard now reads the closing 20. The SDK
    // gate refuses this order categorically, so this case is built through the hand-assembled constructor;
    // with the gate removed the planner would admit it too.
    const built = await buildGuardGraph({
      constructor: 'handAssembled',
      opening: 100n,
      rows: [{ fn: 'withdraw', value: 90n }, { fn: 'assertFloor', value: 10n }],
    });
    expect(built.closing).toBe(10n);
    expect(failingInput(built.builder)).toBe(null);
    await expect(built.provider.sendRawTransaction(built.transaction)).resolves.toBeTypeOf('string');
  }, 300_000);
});

// ---------------------------------------------------------------------------------------------------
// THE RESIDUAL. The repair takes the SCALAR half. A clone whose stale read is on a chunk-backed DYNAMIC
// slot is still not journalled, because journalling a dynamic slot replaces a chunk read with a threaded
// (header, value) pair while the ELEMENTS keep coming from the chunk loop - two sources for one array.
// These cases are COMPILE and PLANNER LEVEL ONLY. No settlement is claimed either way: they record where
// the repair stops and what is left standing in front of it, so a later widening has something to move.
// ---------------------------------------------------------------------------------------------------

const BUS_OPTIONS = {
  forceStateful: true,
  experimentalHiddenBatch: true,
  experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
  experimentalMessageBusControllerCategory: '22'.repeat(32),
} as const;

const ROUTER_LBC = `aa20${'33'.repeat(32)}87`;
const VAULT_LBC = `aa20${'44'.repeat(32)}87`;

/** Deep-copy an artifact so a footprint mutation cannot leak into another case. */
const copyArtifact = (artifact: any): any => JSON.parse(JSON.stringify(artifact));

/**
 * Plan `rows` against one vault artifact through a router that emits them in order, and report the gate's
 * answer as a string. No provider: `planCompiledGraph` needs none.
 */
function planAnswer(
  vaultArtifact: any,
  rows: readonly { fn: string; types: readonly string[]; args: readonly any[] }[],
  signatures: Readonly<Record<string, string>>,
  unboundRouteWitnesses?: Record<string, any>,
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
    }`, BUS_OPTIONS);
  const participants = [
    { artifact: router, lockingBytecode: ROUTER_LBC },
    {
      artifact: vaultArtifact,
      lockingBytecode: VAULT_LBC,
      ...(unboundRouteWitnesses && { unboundRouteWitnesses }),
    },
  ];
  const invocations = [
    { parent: null, callee: 0, function: 'route', args: rows.flatMap((row) => [...row.args]) },
    ...rows.map((row) => ({ parent: 0, callee: 1, function: row.fn, args: [...row.args] })),
  ];
  try {
    layer3.planCompiledGraph(participants as any, invocations as any);
    return 'ADMITTED';
  } catch (error) {
    return `REFUSED: ${(error as Error).message}`;
  }
}

/** The C2 hub, reduced to the two handlers that matter: a `legs` writer and the emission clone reading it. */
const DYNAMIC_HUB = `pragma solidcash >=0.8.0;
interface ICycleLeg { function credit(uint value); }
contract CycleHub() {
  function(uint) external[] legs;
  uint total;
  function registerCredit(address target) public { this.legs.push(ICycleLeg(target).credit); require(true); }
  function fireAll(uint value) public {
    require(legs.length <= 2);
    for (int i = 0; i < legs.length; i = i + 1) { legs[i](value); }
    require(value >= 0);
  }
}`;

/** A RESOURCE-shaped clone (a mapping is present) whose stale read is on a chunk-backed dynamic array. */
const DYNAMIC_RESOURCE = `pragma solidcash >=0.8.0;
contract Vault() {
  bigint[] notes;
  mapping(address => bigint) ledger;
  function append(bigint n, address who) public {
    require(this.ledger[who] >= 0);
    this.notes.push(n);
    require(n >= 0);
  }
  function assertCount(bigint atMost, address who, address other) public {
    require(this.ledger[who] >= 0);
    require(this.ledger[other] >= 0);
    require(this.notes.length <= atMost);
    require(msg.sender == who);
  }
}`;

const STALE = /read-only graph emission clone reading/;

describe('X111 residual - the dynamic half, and what is left in front of it', () => {
  it('R1 the dynamic-slot clone is outside the repair, and the SDK gate is what refuses it', () => {
    // Same shape as the repaired one - a read-only emission clone, an earlier writer of the slot it reads -
    // but the slot is chunk-backed, so the compiler leaves it reading the pre-state and only the planner
    // stands in front of it. That refusal is witness-side, which is exactly what did not close X111.
    const hub = compileString(DYNAMIC_HUB, BUS_OPTIONS);
    const clone = hub.invocationAnalysis!.functions.find((entry) => entry.name === '__scb_graph_fireAll');
    expect(clone!.reads).toContain('state:legs');
    expect(clone!.writes.filter((resource: string) => resource.startsWith('state:'))).toEqual([]);
    const signatures = {
      registerCredit: 'function registerCredit(address t);', fireAll: 'function fireAll(uint v);',
    };
    const rows = [
      { fn: 'registerCredit', types: ['address'], args: [hexToBin(ROUTER_LBC)] },
      { fn: 'fireAll', types: ['uint'], args: [1n] },
    ];
    expect(planAnswer(hub, rows, signatures)).toMatch(STALE);
    // GUARD on ORDER: reader-first has no earlier write to have missed, so it must not be refused.
    expect(planAnswer(hub, [rows[1], rows[0]], signatures)).toBe('ADMITTED');
  }, 180_000);

  it('R2 L2-F1b is STILL REACHABLE, narrowed to the dynamic half', () => {
    // The prefix blind spot no longer matters for a scalar read - the covenant refuses that itself now. It
    // still matters here: a `__scb_resource_` clone reading a chunk-backed array is journalled by neither the
    // compiler nor seen by the gate, and the planner admits the hostile order with nothing behind it.
    // PLANNER LEVEL ONLY - no settlement is claimed for this composition.
    const vault = compileString(DYNAMIC_RESOURCE, BUS_OPTIONS);
    const names = vault.invocationAnalysis!.functions.map((entry) => entry.name);
    expect(names).toContain('__scb_resource_assertCount');
    expect(names).not.toContain('__scb_graph_assertCount');
    const clone = vault.invocationAnalysis!.functions
      .find((entry) => entry.name === '__scb_resource_assertCount');
    expect(clone!.reads).toEqual(['state:notes']);
    expect(clone!.writes).toEqual([]);

    const signatures = {
      append: 'function append(bigint n, address w);',
      assertCount: 'function assertCount(bigint m, address w, address o);',
    };
    const rows = [
      { fn: 'append', types: ['bigint', 'address'], args: [1n, hexToBin(ROUTER_LBC)] },
      {
        fn: 'assertCount',
        types: ['bigint', 'address', 'address'],
        args: [5n, hexToBin(ROUTER_LBC), hexToBin(ROUTER_LBC)],
      },
    ];
    const witnesses = { __scb_key_ledger_0_row_r0: hexToBin(ROUTER_LBC) };
    expect(planAnswer(vault, rows, signatures, witnesses)).toBe('ADMITTED');

    // GUARD on the ATTACKED FIELD: the only thing changed is the clone's published NAME. Same reads, same
    // writes, same rows, same order. The gate fires, which isolates the PREFIX rather than this footprint.
    const renamed = copyArtifact(vault);
    renamed.invocationAnalysis.functions
      .find((entry: any) => entry.name === '__scb_resource_assertCount').name = '__scb_graph_assertCount';
    expect(planAnswer(renamed, rows, signatures, witnesses)).toMatch(STALE);
  }, 180_000);

  it('R3 L2-F1c can no longer ADMIT on a dynamic slot, which is where it was load-bearing', () => {
    // INVERTED BY X138. The published write is the SPENDER's data, not the compiler's `writerIds`, so
    // publishing one nonexistent write used to short-circuit the whole rule and buy the dynamic stale read.
    // The claim is now honoured only for a plain scalar slot - where it is not load-bearing, since the
    // compiler journals a clone's scalars regardless and the covenant refuses the stale scalar composition
    // itself - and refused outright on a slot `stateLayout` declares dynamic.
    //
    // Why `stateLayout` and not `invocationAnalysis`: the participant's own covenant rebuilds and compares
    // the state commitment, so a lie about dynamism cannot settle. Nothing commits to `invocationAnalysis`,
    // which X138-V1c proves byte-for-byte - the honest and escaped artifacts share a script and an address.
    //
    // This does NOT close X138. A spender who never calls the planner is bound by no witness-side rule, and
    // X138's own settlement half still settles through a hand-assembled constructor.
    const hub = compileString(DYNAMIC_HUB, BUS_OPTIONS);
    const signatures = {
      registerCredit: 'function registerCredit(address t);', fireAll: 'function fireAll(uint v);',
    };
    const rows = [
      { fn: 'registerCredit', types: ['address'], args: [hexToBin(ROUTER_LBC)] },
      { fn: 'fireAll', types: ['uint'], args: [1n] },
    ];
    // Guard: the honest artifact, same rows, same order.
    expect(planAnswer(hub, rows, signatures)).toMatch(STALE);
    const escaped = copyArtifact(hub);
    Object.assign(
      escaped.invocationAnalysis.functions.find((entry: any) => entry.name === '__scb_graph_fireAll'),
      { writes: ['state:nosuchslot'] },
    );
    expect(planAnswer(escaped, rows, signatures)).toMatch(STALE);
  }, 180_000);
});
