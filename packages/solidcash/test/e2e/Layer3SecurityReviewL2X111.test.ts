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

/**
 * SEC-18 closure gap. Same three handlers, but the guard reaches the journalled slot through a
 * FUNCTION POINTER. `computeScalarJournalClosures`'s `scan` records a callee only from
 * `FunctionCallNode.resolvedFunction.functionId` (`GenerateTargetTraversal.ts:1685`) and explicitly
 * skips the `functionReference` key (`:1689`), so neither `checkFloor` nor its caller enters the
 * widened closure. No `msg.sender`, so this is NOT an emission clone and X111's gate is silent.
 *
 * Measured against 1cd218c9^: the plain-read spelling costs +15 B and the pointer spelling costs
 * +0 B, i.e. is byte-identical to the pre-SEC-18 build.
 */
const VAULT_POINTER = `pragma solidcash >=0.8.0;
    contract Vault() {
      bigint balance;
      bigint other;
      function checkFloor(bigint floor) internal {
        require(this.balance >= floor);
      }
      function withdraw(bigint amount) public {
        this.balance = this.balance - amount;
        require(amount >= 0);
      }
      function bumpOther(bigint n) public {
        this.other = this.other + n;
        require(n >= 0);
      }
      function assertFloor(bigint floor, address expectedSender) public {
        function(bigint) internal probe = checkFloor;
        probe(floor);
        require(expectedSender.length >= 0);
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
  /**
   * Which vault source. `sender` is X111's emission-clone subject, `pointer` is SEC-18's closure gap,
   * `plainRead` is the same guard spelled as a direct read, which SEC-18 does journal.
   */
  vault?: 'sender' | 'pointer' | 'plainRead';
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
    artifact: participant.artifact,
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
  executions.forEach((execution, owner) => {
    const completionPositions = globalByOwner[owner].map((index) => subtreeEnds[index] + 1);
    Object.assign(execution, {
      executionKind: 0,
      executorOffset: null,
      executorInputIndex: 0xffff,
      executorLockingBytecode: '',
      routeInputs: participants[owner].artifact.hiddenBatch!.route.inputs,
      settlementBoundary: Math.max(...completionPositions),
      completionPositions,
    });
  });
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
    hiddenBatch: true,
    messageBusController: controller.lockingBytecode,
    messageBusControllerCategory: controllerCategory,
  };
  const VAULT_SOURCES = {
    sender: VAULT_SENDER,
    pointer: VAULT_POINTER,
    // `VAULT_POINTER` with the pointer hop removed. One differing construct, same read, same rows.
    plainRead: VAULT_POINTER
      .replace('function(bigint) internal probe = checkFloor;\n        probe(floor);', 'checkFloor(floor);'),
  } as const;
  const vaultArtifact = compileString(VAULT_SOURCES[spec.vault ?? 'sender'], options);
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

  it('L2-A1 was a real bypass and the COVENANT now refuses it', async () => {
    // INVERTED WHEN THE COMPILER REPAIR LANDED. This recorded a genuine hole: the gate refuses at
    // witness-construction time, so a plan assembled without ever calling the planner settled the exploit
    // bytes. opening 100 -> closing 20, and `assertFloor(50)` is TRUE of 100 and FALSE of 20. X111's scalar
    // half is now closed at CONSENSUS - the emission clone loads through the journal, so the refusal comes
    // from the covenant at the vault master rather than from any SDK decision. L2-A1n below is unchanged and
    // is the guard on the attacked field.
    const built = await buildGuardGraph({
      constructor: 'handAssembled', opening: 100n, rows: HOSTILE,
    });
    expect(built.closing).toBe(20n);
    expect(failingInput(built.builder)).toBe(built.vaultInput);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(/mandatory-script-verify-flag-failed/);
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

  it('L2-A2 was a real bypass and the COVENANT now refuses it', async () => {
    // INVERTED alongside L2-A1, and this one is the sharper of the pair. The gate's ONLY decision input is
    // `artifact.invocationAnalysis.functions`, and nothing in the transaction commits to it, so a plan built
    // from a footprint missing the clone produced identical covenant bytes and settled. That is why an SDK
    // gate could never close this row: its input is attacker-supplied. The covenant refuses regardless of
    // what the spender publishes, which is the property that actually closes it.
    //
    // NOTE the residual this does NOT cover, filed as X138: the DYNAMIC half is still open, and there the
    // gate is still defeatable by publishing one nonexistent write.
    const built = await buildGuardGraph({
      constructor: 'decoyAnalysis', opening: 100n, rows: HOSTILE,
    });
    expect(built.closing).toBe(20n);
    expect(failingInput(built.builder)).toBe(built.vaultInput);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(/mandatory-script-verify-flag-failed/);
  }, 300_000);

  it('L2-F3 was a LIVE EXPLOIT and is now refused at the vault master', async () => {
    // INVERTED WHEN THE FIX LANDED, and the exploit it recorded was real. No bypass, no tampering: the
    // GUARDED planner admitted this, because the guard is not an emission clone. `withdraw(80)` on an
    // opening 100 then `assertFloor(50)`: 50 is true of 100 and false of the 20 this transaction commits,
    // and it SETTLED. The tell was byte-identical output to 1cd218c9^ - the widening never reached it,
    // because the callee was recorded only from `FunctionCallNode.resolvedFunction` while the
    // `functionReference` key was skipped. Pointer spelling was 1,623 B against 1,643 for the same read by
    // name: twenty bytes CHEAPER, because it paid no journal at all. Now 1,641 and refused.
    const built = await buildGuardGraph({
      constructor: 'planner', vault: 'pointer', opening: 100n, rows: HOSTILE,
    });
    expect(built.closing).toBe(20n);
    expect(failingInput(built.builder)).toBe(built.vaultInput);
    await expect(built.provider.sendRawTransaction(built.transaction))
      .rejects.toThrow(/mandatory-script-verify-flag-failed/);
  }, 300_000);

  it('L2-F3p POSITIVE CONTROL: the SAME guard spelled as a direct read is refused at the vault', async () => {
    // `VAULT_PLAIN`-style direct read is what SEC-18 fixed, so the identical row set against the
    // direct spelling must NOT settle. This is the pair that makes L2-F3 a closure gap rather than a
    // claim that the guard was always vacuous. Differs from L2-F3 only in how the read is reached.
    const built = await buildGuardGraph({
      constructor: 'planner', vault: 'plainRead', opening: 100n, rows: HOSTILE,
    } as Spec & { vault: 'plainRead' });
    expect(failingInput(built.builder)).toBe(built.vaultInput);
  }, 300_000);

  it('L2-F3L LIVENESS: the pointer guard is refused on a floor false of BOTH balances', async () => {
    // 150 is false of the opening 100 too, so L2-F3 is a stale READ and not a dead require.
    const built = await buildGuardGraph({
      constructor: 'planner',
      vault: 'pointer',
      opening: 100n,
      rows: [{ fn: 'withdraw', value: 80n }, { fn: 'assertFloor', value: 150n }],
    });
    expect(failingInput(built.builder)).toBe(built.vaultInput);
  }, 300_000);

  it('L2-A3 both bypass constructors produce canonical, distinct transcript roots from one fixture', async () => {
    // Delegate/settlement framing makes planner metadata part of the transcript, so the intentionally
    // hand-assembled bypass and the planner-with-decoy-analysis bypass no longer claim byte identity.
    // Both remain canonical roots derived inside this one build, and the selected constructor is exact.
    const built = await buildGuardGraph({ constructor: 'handAssembled', opening: 100n, rows: HOSTILE });
    expect(built.rootsByConstructor.handAssembled).toMatch(/^[0-9a-f]{64}$/);
    expect(built.rootsByConstructor.decoyAnalysis).toMatch(/^[0-9a-f]{64}$/);
    expect(built.rootsByConstructor.handAssembled).not.toBe(built.rootsByConstructor.decoyAnalysis);
    expect(built.root).toBe(built.rootsByConstructor.handAssembled);
  }, 300_000);
});

// ---------------------------------------------------------------------------------------------------
// Planner-level attacks. `planCompiledGraph` needs no provider, so the gate can be attacked directly
// with synthetic locking bytecodes. Nothing here claims settlement; each case reports the gate's answer.
// ---------------------------------------------------------------------------------------------------

const BUS_OPTIONS = {
  forceStateful: true,
  hiddenBatch: true,
  messageBusController: `aa20${'11'.repeat(32)}87`,
  messageBusControllerCategory: '22'.repeat(32),
} as const;

const ROUTER_LBC = `aa20${'33'.repeat(32)}87`;
const VAULT_LBC = `aa20${'44'.repeat(32)}87`;
const lbc = (hex: string): Uint8Array => hexToBin(hex);

/** Compile a router whose own body emits `rows` in order against one vault interface. */
function routerFor(rows: readonly Handler[], signatures: Readonly<Record<string, string>>): any {
  const calls = rows.map((fn, index) => (fn === 'assertFloor'
    ? `IVault(vault).assertFloor(a${index}, sender);`
    : `IVault(vault).${fn}(a${index});`)).join('\n      ');
  const params = [...rows.map((_fn, index) => `bigint a${index}`), 'address sender'].join(', ');
  const iface = [...new Set(rows)].map((fn) => signatures[fn]).join(' ');
  return compileString(`pragma solidcash >=0.8.0;
    interface IVault { ${iface} }
    contract GuardRouter(int brand, address vault) {
      function route(${params}) public {
      ${calls}
        require(true);
      }
    }`, BUS_OPTIONS);
}

/** Plan `rows` against one vault artifact and report the gate's answer as a string. */
function planAnswer(
  vaultArtifact: any, rows: readonly Handler[],
  signatures: Readonly<Record<string, string>> = SIGNATURES,
  unboundRouteWitnesses?: Record<string, any>,
): string {
  const participants = [
    { artifact: routerFor(rows, signatures), lockingBytecode: ROUTER_LBC },
    { artifact: vaultArtifact, lockingBytecode: VAULT_LBC, ...(unboundRouteWitnesses && { unboundRouteWitnesses }) },
  ];
  const invocations = [
    {
      parent: null,
      callee: 0,
      function: 'route',
      args: [...rows.map((_fn, index) => BigInt(10 * (index + 1))), lbc(ROUTER_LBC)],
    },
    ...rows.map((fn, index) => ({
      parent: 0,
      callee: 1,
      function: fn,
      args: fn === 'assertFloor' ? [BigInt(10 * (index + 1)), lbc(ROUTER_LBC)] : [BigInt(10 * (index + 1))],
    })),
  ];
  try {
    layer3.planCompiledGraph(participants as any, invocations as any);
    return 'ADMITTED';
  } catch (error) {
    return `REFUSED: ${(error as Error).message}`;
  }
}

/** Deep-copy an artifact so a footprint mutation cannot leak into another case. */
const copy = (artifact: any): any => JSON.parse(JSON.stringify(artifact));

describe('L2 review of X111 - the gate as a decision procedure', () => {
  it('L2-F1b HOSTILE: a __scb_resource_ emission clone is invisible to the gate', () => {
    // `compiler.ts:1465` sets `graphEmissionHandler` on the RESOURCE-shaped clone too when its source
    // handler is a graphTailHandler, so `GenerateTargetTraversal.ts:1773` excludes it from SEC-18's
    // journal exactly as it excludes a `__scb_graph_` clone. The gate's lookup key is only the
    // `__scb_graph_` prefix, so it never finds this one and stays silent on the hostile order.
    const vaultArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Vault() {
        bigint balance;
        mapping(address => bigint) ledger;
        function withdraw(bigint amount, address who) public {
          require(this.ledger[who] >= 0);
          this.balance = this.balance - amount;
          require(amount >= 0);
        }
        function assertFloor(bigint floor, address who, address other) public {
          require(this.ledger[who] >= 0);
          require(this.ledger[other] >= 0);
          require(this.balance >= floor);
          require(msg.sender == who);
        }
      }`, BUS_OPTIONS);
    const names = vaultArtifact.invocationAnalysis!.functions.map((entry: any) => entry.name);
    expect(names).toContain('__scb_resource_assertFloor');
    expect(names).not.toContain('__scb_graph_assertFloor');

    const signatures = {
      withdraw: 'function withdraw(bigint v, address w);',
      assertFloor: 'function assertFloor(bigint v, address s, address o);',
    };
    const participants = [
      { artifact: routerFor(['withdraw', 'assertFloor'], signatures), lockingBytecode: ROUTER_LBC },
      {
        artifact: vaultArtifact,
        lockingBytecode: VAULT_LBC,
        unboundRouteWitnesses: { __scb_key_ledger_0_row_r0: lbc(ROUTER_LBC) },
      },
    ];
    const rowsOf = (artifact: any): readonly any[] => [
      { parent: null, callee: 0, function: 'route', args: [10n, 20n, lbc(ROUTER_LBC)] },
      { parent: 0, callee: 1, function: 'withdraw', args: [10n, lbc(ROUTER_LBC)] },
      { parent: 0, callee: 1, function: 'assertFloor', args: [20n, lbc(ROUTER_LBC), lbc(ROUTER_LBC)] },
    ].map((row) => ({ ...row, __artifact: artifact }));
    // Hostile: writer of `balance` at local row 0, excluded clone reading `balance` at local row 1.
    expect(() => layer3.planCompiledGraph(participants as any, rowsOf(vaultArtifact) as any)).not.toThrow();

    // GUARD on the ATTACKED FIELD. The only thing changed is the clone's published NAME - same reads,
    // same writes, same rows, same order. The gate fires, which isolates the PREFIX as the blind spot
    // rather than anything about this contract's footprint.
    const renamed = copy(vaultArtifact);
    renamed.invocationAnalysis.functions
      .find((entry: any) => entry.name === '__scb_resource_assertFloor').name = '__scb_graph_assertFloor';
    expect(() => layer3.planCompiledGraph(
      [participants[0], { ...participants[1], artifact: renamed }] as any, rowsOf(renamed) as any,
    )).toThrow(STALE);
  }, 120_000);

  it('L2-A4 the unknown-footprint arm fails CLOSED, and no compiler output reaches it', () => {
    const vaultArtifact = compileString(VAULT_SENDER, BUS_OPTIONS);
    // The arm is unreachable from the compiler: `footprint.unknown` refuses the handler before it can
    // be cloned (`compiler.ts:1464`), so nothing the compiler publishes carries `unknown: true`.
    expect(vaultArtifact.invocationAnalysis!.functions.filter((entry: any) => entry.unknown)).toEqual([]);

    // Reached through the data instead. An unknown clone has no enumerable read set, so ANY earlier
    // writer refuses it - including a writer of a slot it never names. Fail closed.
    const unknown = copy(vaultArtifact);
    Object.assign(
      unknown.invocationAnalysis.functions.find((entry: any) => entry.name === '__scb_graph_assertFloor'),
      { unknown: true, reads: [], writes: [] },
    );
    expect(planAnswer(unknown, ['bumpOther', 'assertFloor'])).toMatch(/read-only graph emission clone/);
    // GUARD on ORDER: the same unknown clone with no earlier writer is admitted, so the arm is not a
    // blanket refusal of every unknown clone.
    expect(planAnswer(unknown, ['assertFloor', 'bumpOther'])).toBe('ADMITTED');
  }, 120_000);

  it('L2-A4w an unknown clone escapes the conservative arm by publishing ANY write', () => {
    // `writtenVariablesOf(clone).length > 0` is tested BEFORE `clone.unknown` (graph.ts:1327-1330), so
    // an unknown footprint that names one unrelated write short-circuits out of the conservative arm.
    // The published write is the spender's data, not the compiler's `writerIds`, so it is not evidence
    // the clone joined the journal. Same rows and order as L2-A4's refused case.
    const vaultArtifact = compileString(VAULT_SENDER, BUS_OPTIONS);
    const escape = copy(vaultArtifact);
    Object.assign(
      escape.invocationAnalysis.functions.find((entry: any) => entry.name === '__scb_graph_assertFloor'),
      { unknown: true, reads: [], writes: ['state:nosuchslot'] },
    );
    expect(planAnswer(escape, ['withdraw', 'assertFloor'])).toBe('ADMITTED');
  }, 120_000);

  it('L2-A5 the gate refuses every writer-then-guard order, which is the honest one', () => {
    // Cost of the refusal, enumerated rather than asserted. Row set: one writer of `balance`, one
    // writer of a DIFFERENT slot, one emission clone reading `balance`. Of the six orders, the three
    // refused are exactly those where the `balance` writer precedes the guard - i.e. every
    // "act, then assert the post-condition" composition. The three admitted ones all read the guard
    // before the write it is meant to check.
    const vaultArtifact = compileString(VAULT_SENDER, BUS_OPTIONS);
    const orders: Handler[][] = [
      ['withdraw', 'bumpOther', 'assertFloor'],
      ['withdraw', 'assertFloor', 'bumpOther'],
      ['bumpOther', 'withdraw', 'assertFloor'],
      ['bumpOther', 'assertFloor', 'withdraw'],
      ['assertFloor', 'withdraw', 'bumpOther'],
      ['assertFloor', 'bumpOther', 'withdraw'],
    ];
    const answers = orders.map((order) => planAnswer(vaultArtifact, order));
    const refused = orders.filter((order, index) => answers[index] !== 'ADMITTED');
    expect(refused.map((order) => order.join('>'))).toEqual([
      'withdraw>bumpOther>assertFloor', 'withdraw>assertFloor>bumpOther', 'bumpOther>withdraw>assertFloor',
    ]);
    // Every refused order has the balance writer before the guard; every admitted one does not.
    orders.forEach((order, index) => {
      const writerFirst = order.indexOf('withdraw') < order.indexOf('assertFloor');
      expect(answers[index] !== 'ADMITTED').toBe(writerFirst);
    });
  }, 180_000);

  it('L2-A6 two writers of the same slot: the gate names the EARLIEST, not the nearest', () => {
    // Attack angle: more than one writer of one slot on one route. The rule keys on the earliest
    // writer, which is the correct choice - a clone after two writes is stale with respect to both.
    const vaultArtifact = compileString(VAULT_SENDER, BUS_OPTIONS);
    expect(planAnswer(vaultArtifact, ['withdraw', 'withdraw', 'assertFloor']))
      .toMatch(/row 2 'assertFloor'.*which row 0 'withdraw'/);
  }, 120_000);

  it('L2-A7 a clone reading a slot NO row writes is admitted', () => {
    // `bumpOther` writes `other`; the clone reads `balance`. Nothing on this route writes `balance`,
    // so there is no earlier write to have missed and refusing would be a false refusal.
    const vaultArtifact = compileString(VAULT_SENDER, BUS_OPTIONS);
    expect(planAnswer(vaultArtifact, ['bumpOther', 'assertFloor'])).toBe('ADMITTED');
  }, 120_000);
});
