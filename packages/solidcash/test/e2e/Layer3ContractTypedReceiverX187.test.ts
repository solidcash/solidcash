import { describe, expect, it } from 'vitest';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createDataNftUnlocker, getDataNftAddress } from '../../src/stateful/covenant-helpers.js';

/**
 * X187. THE RECEIVER SPELLING, AND THE ONE-VARIABLE PAIR THAT NAMES IT.
 *
 * `Layer3DroppedEdgeX179.test.ts` isolated a caller whose outgoing edge the covenant did not bind, and left
 * exactly one variable standing: how the callee is named. Its escaping subject was a Solidity pair compiled
 * under `solidityImportCompat`, so the shape still carried a compile mode that its bound siblings did not.
 *
 * THIS FILE REMOVES THAT LAST CONFOUND. The two subjects below are the same contract, in plain SolidCash, with
 * no compat mode, differing in ONE token:
 *
 *     interface-cast   `address callee;      ... IX187Callee(callee).tick(knob + 1); require(true);`
 *     receiver         `IX187Callee callee;  ...              callee.tick(knob + 1); require(true);`
 *
 * Same state layout, same block layout, same argument expression, same tail. Both are staged by one harness
 * against one callee, and each settles its honest co-spend before any hostile row runs.
 *
 * WHY THE TWO USED TO DIFFER, at a name. `callee.tick(..)` parses as a NAMESPACED FunctionCall (`callee.tick`),
 * never as a MethodCall - `SymbolTableTraversal` turns it into an `ExternalFunctionCallNode` only in the
 * semantic pass, reading the receiver's declared type. `synthesizeHiddenBatchRoute` freezes its per-handler
 * verdict BEFORE that pass and tested three node kinds, none of them this one, so the handler was admitted as
 * a plain scalar handler rather than a graph tail handler and its route framed no emission for the edge it
 * published in its own ABI. Route synthesis now recovers the call from the same declared type, so the two
 * spellings reach the same verdict.
 *
 * WHAT IS NOT CLAIMED. Nothing here shows value or authority moving on either spelling: the unbound edge's
 * callee was simply absent from the transaction. The parameter-receiver spelling is asserted at ADMISSION only
 * - its emission target is a per-call witness rather than self-pinned state, which is a separate question this
 * file does not open.
 */

const CALLEE = `pragma solidcash >=0.8.0;
contract X187Callee(int brand) {
  function tick(int value) public pure { require(value > 0); }
}`;

/** THE CONTROL: the spelling X179 proved binds. */
const CAST_CALLER = `pragma solidcash >=0.8.0;
interface IX187Callee { function tick(int value); }
contract X187Caller() {
  address callee;
  int knob;
  function ping() { IX187Callee(callee).tick(knob + 1); require(true); }
}`;

/** THE SUBJECT: one token different - the receiver is the contract-typed state variable itself. */
const RECEIVER_CALLER = CAST_CALLER
  .replace('address callee;', 'IX187Callee callee;')
  .replace('IX187Callee(callee).tick', 'callee.tick');

/** The same receiver spelling one step removed, through a contract-typed LOCAL bound from the same state. */
const LOCAL_CALLER = CAST_CALLER.replace(
  'function ping() { IX187Callee(callee).tick(knob + 1); require(true); }',
  'function ping() { IX187Callee target = IX187Callee(callee); target.tick(knob + 1); require(true); }',
);

const KNOB = 3n;

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);

type Shape = 'cast' | 'receiver' | 'local';
const SOURCES: Record<Shape, string> = {
  cast: CAST_CALLER, receiver: RECEIVER_CALLER, local: LOCAL_CALLER,
};

/** The ONE field that moves per subject: whether the callsite's child invocation is planned and co-spent. */
type Edge = 'co-spent' | 'dropped-bypass';

interface Attempt {
  sent?: string;
  refusal?: string;
  failingInput?: number;
  participants: number;
  invocations: number;
  emissions: readonly string[];
  callerBytes: number;
}

async function attempt(shape: Shape, edge: Edge): Promise<Attempt> {
  const provider = createLayer3SemanticTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
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
  const calleeArtifact: any = compileString(CALLEE, options);
  const calleeBase = new Contract(calleeArtifact, [7n], { provider });
  const calleeSetup = await setupStatefulUtxos(provider, calleeBase, calleeArtifact.stateLayout!, {});
  const callee = calleeBase.withCategory(hexToBin(calleeSetup.categoryId));

  const callerArtifact: any = compileString(SOURCES[shape], options);
  // The published `addressStateVar` is the external-call lowering's internal name for the interface-cast
  // spelling (`callee_IX187Callee`) and the source name for the receiver spelling, while the STATE LAYOUT
  // calls the slot `callee` in both. Seeding by the ABI name leaves the slot empty and the covenant then
  // recomputes an empty emission target, so the layout is the authority.
  const targetVariable = callerArtifact.stateLayout!.variables
    .find((variable: any) => variable.type === 'address')!.name;
  const callerBase = new Contract(callerArtifact, [], { provider });
  const callerSetup = await setupStatefulUtxos(provider, callerBase, callerArtifact.stateLayout!, {
    [targetVariable]: hexToBin(callee.lockingBytecode) as never, knob: KNOB,
  });
  const caller = callerBase.withCategory(hexToBin(callerSetup.categoryId));

  // The BYPASS: the plan is handed a caller artifact whose ABI publishes no callsite, so the SDK's own row
  // floor has nothing to require. Only the ABI copy the PLANNER reads changes - the contract, its locking
  // bytecode and its compiled route are the real ones, so the VM still evaluates the real caller covenant.
  const plannedCallerArtifact = edge === 'dropped-bypass'
    ? {
      ...callerArtifact,
      abi: callerArtifact.abi.map((entry: any) =>
        (entry.name === 'ping' ? { ...entry, externalCalls: undefined } : entry)),
    }
    : callerArtifact;
  const participants = [
    { artifact: plannedCallerArtifact, lockingBytecode: caller.lockingBytecode },
    { artifact: calleeArtifact, lockingBytecode: callee.lockingBytecode },
  ];
  const invocations = [
    { parent: null, callee: 0, function: 'ping', args: [] },
    { parent: 0, callee: 1, function: 'tick', args: [KNOB + 1n] },
  ];
  const plan = layer3.planCompiledGraph(
    edge === 'co-spent' ? participants : [participants[0]],
    (edge === 'co-spent' ? invocations : [invocations[0]]) as never,
  );
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs,
    plan.participants.map((participant, index) =>
      (participant.batch.results.length > 0 ? layout.returnOutputs![index] : null)),
    plan.participants.map(() => ''), layout.projectionInputs, '',
  );

  const initFee = randomUtxo({ satoshis: 20_000n });
  await provider.addUtxo(p2pkh.address, initFee);
  const initialize = new TransactionBuilder({ provider });
  initialize.addInput(
    genesis.utxos[0], controller.unlock.initialize(hexToBin(transcript.root), alicePub, signature()),
  );
  initialize.addInput(initFee, p2pkh.unlock.spend(alicePub, signature()));
  initialize.addOutput({
    to: controller.tokenAddress,
    amount: genesis.utxos[0].satoshis,
    token: {
      category: controllerCategory, amount: 0n, nft: { capability: 'mutable', commitment: transcript.root },
    },
  });
  initialize.addOutput({ to: p2pkh.address, amount: 15_000n });
  await provider.sendRawTransaction(raw(initialize));
  const rootedController = (await provider.getUtxos(controller.tokenAddress))
    .find((utxo: any) => utxo.token?.nft?.commitment === transcript.root);
  expect(rootedController, 'controller initialization did not root the authority').toBeDefined();

  const projectionUtxos = [];
  for (let index = 0; index < plan.participants.length; index += 1) {
    const utxo = randomUtxo({ satoshis: 1000n });
    await provider.addUtxo(projection.address, utxo);
    projectionUtxos.push(utxo);
  }
  const fee = randomUtxo({ satoshis: 400_000n });
  await provider.addUtxo(p2pkh.address, fee);

  const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
  for (let index = 0; index < plan.participants.length; index += 1) {
    const artifact = index === 0 ? callerArtifact : calleeArtifact;
    const contract = index === 0 ? caller : callee;
    const setup = index === 0 ? callerSetup : calleeSetup;
    let dataNftCursor = 0;
    for (const slot of artifact.hiddenBatch!.route.blockLayout!.slots as any[]) {
      switch (slot.kind) {
        case 'master':
          tx.addInput(setup.masterUtxo, contract.createCompilerRouteUnlocker(
            artifact.hiddenBatch!.route, hexToBin(artifact.hiddenBatch!.selector),
          )(
            ...layer3.compiledGraphRouteArgs(transcript, index, layout.controllerInput) as never[],
            ...(layout.returnOutputs![index] === null
              ? [] : [BigInt(layout.returnOutputs![index]!)]) as never[],
          ));
          tx.addOutput({
            to: contract.tokenAddress,
            amount: setup.masterUtxo.satoshis,
            token: { category: setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
          });
          break;
        case 'dataNft': {
          const nft = dataNftCursor;
          dataNftCursor += 1;
          // The second argument is the MASTER INPUT INDEX, not the data-NFT index.
          tx.addInput(setup.dataNftUtxos[nft], createDataNftUnlocker(
            contract, layout.participantInputs[index], setup.categoryId,
          ));
          // Neither handler writes state, so the post-state is the seeded state - taken from the seeded UTXO
          // rather than recomputed, so a staging mismatch cannot masquerade as a covenant refusal.
          tx.addOutput({
            to: getDataNftAddress(contract, setup.categoryId),
            amount: setup.dataNftUtxos[nft].satoshis,
            token: setup.dataNftUtxos[nft].token,
          });
          break;
        }
        default:
          throw new Error(`this harness does not stage a '${slot.kind}' slot`);
      }
    }
  }
  projectionUtxos.forEach((utxo, participant) => {
    tx.addInput(utxo, projection.unlock.verify(
      transcript.bytes, BigInt(layout.controllerInput), BigInt(participant),
    ));
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
  });
  tx.addInput(rootedController!, controller.unlock.attest(transcript.bytes));
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
  tx.addOutput({ to: p2pkh.address, amount: 350_000n });

  const shapeReport = {
    participants: plan.participants.length,
    invocations: plan.invocations.length,
    emissions: (transcript as any).participantEmissionsHex as readonly string[],
    callerBytes: (callerArtifact.bytecode as string).length,
  };
  try {
    return { sent: await provider.sendRawTransaction(raw(tx)), ...shapeReport };
  } catch (error) {
    const refusal = (error as Error).message;
    const index = refusal.match(/input index (\d+)/);
    return { refusal, failingInput: index ? Number(index[1]) : undefined, ...shapeReport };
  }
}

/** The caller's route ran out of authenticated emission rows mid-partition. */
const VECTOR_EXHAUSTED = 'Program called an OP_SPLIT operation with an invalid index';

const BUS_OPTIONS = {
  forceStateful: true,
  experimentalHiddenBatch: true,
  experimentalMessageBusController: 'aa'.repeat(35),
  experimentalMessageBusControllerCategory: 'ab'.repeat(32),
} as never;

const routeVerdict = (source: string): { eligible?: boolean; rejectionReason?: string } => {
  const artifact = compileString(source, BUS_OPTIONS) as any;
  return artifact.hiddenBatch!.handlers!.find((entry: any) => entry.name === 'ping');
};

const SUBJECTS = [
  { shape: 'cast', label: 'CONTROL: interface cast' },
  { shape: 'receiver', label: 'SUBJECT: contract-typed state-variable receiver' },
  { shape: 'local', label: 'SUBJECT: contract-typed local receiver' },
] as const;

describe('X187: does the receiver spelling change whether a `once` edge is bound?', () => {
  it('the pair differs in one token and compiles to the same size and the same block layout', () => {
    const cast = compileString(CAST_CALLER, BUS_OPTIONS) as any;
    const receiver = compileString(RECEIVER_CALLER, BUS_OPTIONS) as any;
    expect(RECEIVER_CALLER).not.toBe(CAST_CALLER);
    expect(receiver.bytecode.length).toBe(cast.bytecode.length);
    expect(receiver.hiddenBatch.route.blockLayout).toEqual(cast.hiddenBatch.route.blockLayout);
    expect(receiver.stateLayout.variables.map((variable: any) => [variable.name, variable.type]))
      .toEqual(cast.stateLayout.variables.map((variable: any) => [variable.name, variable.type]));
    // Both publish the same single outgoing edge; only the internal target name differs.
    const edgeOf = (artifact: any): unknown => artifact.abi.find((entry: any) => entry.name === 'ping')
      .externalCalls.map((call: any) => [call.interfaceName, call.functionName, call.occurrence]);
    expect(edgeOf(receiver)).toEqual(edgeOf(cast));
  });

  /**
   * The ADMISSION half, both directions, and the property is PARITY rather than the verdict. X187 refused the
   * bare body in both spellings; X201 admits it in both, with the edge bound at the call site. Either value is
   * acceptable here - what is not is a change that moves one spelling and leaves the other behind.
   */
  it('admits the two spellings together, bare or require-tailed', () => {
    expect(routeVerdict(CAST_CALLER).eligible).toBe(true);
    expect(routeVerdict(RECEIVER_CALLER).eligible).toBe(true);
    const bare = (source: string): string => source
      .replace('.tick(knob + 1); require(true); }', '.tick(knob + 1); }')
      // A refused sole handler leaves no route at all, so keep one eligible sibling for the verdict to hang on.
      .replace(/}$/, '  function peek() returns (int) { return knob; }\n}');
    const bareCast = routeVerdict(bare(CAST_CALLER));
    const bareReceiver = routeVerdict(bare(RECEIVER_CALLER));
    console.log(`[X187] bare cast eligible=${bareCast.eligible} receiver eligible=${bareReceiver.eligible}`);
    expect(bareReceiver.eligible).toBe(bareCast.eligible);
    expect(bareReceiver.rejectionReason).toBe(bareCast.rejectionReason);
    // X201's value, pinned so a silent revert to refusal is visible rather than passing as parity.
    expect(bareCast.eligible).toBe(true);
  });

  /** The parameter-receiver spelling is recovered too. Admission only - see the header's NOT CLAIMED. */
  it('recovers the parameter-receiver spelling at admission', () => {
    const source = `pragma solidcash >=0.8.0;
interface IX187Callee { function tick(int value); }
contract X187Param() {
  int knob;
  function ping(IX187Callee target) { target.tick(knob + 1); require(true); }
  function peek() returns (int) { return knob; }
}`;
    const entry = (compileString(source, BUS_OPTIONS) as any).abi.find((a: any) => a.name === 'ping');
    expect(entry.externalCalls).toHaveLength(1);
    expect(entry.externalCalls[0].functionName).toBe('tick');
  });

  describe.each(SUBJECTS)('$label', ({ shape }) => {
    /** The POSITIVE the hostile row needs: without it a refusal below would discriminate nothing. */
    it('GUARD: the honest co-spent graph settles', async () => {
      const result = await attempt(shape, 'co-spent');
      console.log(`[X187] ${shape} co-spent: ${result.sent ?? result.refusal?.split('\n')[0]} `
        + `bytes=${result.callerBytes} participants=${result.participants} `
        + `invocations=${result.invocations} emissions=${JSON.stringify(result.emissions)}`);
      expect(result.refusal, 'the honest co-spend did not settle').toBeUndefined();
      expect(result.sent).toMatch(/^[0-9a-f]{64}$/);
      expect(result.participants).toBe(2);
      expect(result.invocations).toBe(2);
      // The emission row exists and is non-empty; the hostile below removes exactly this.
      expect(result.emissions[0]).not.toBe('');
    }, 900_000);

    /**
     * ONE FIELD MOVES: the child invocation is not planned, and the published callsite is stripped from the
     * artifact copy the PLANNER reads so the SDK's own row floor cannot answer. What is left to answer is the
     * caller's compiled route, which is byte-identical in both runs.
     */
    it('COVENANT: the artifact-stripped dropped edge is refused at input 0', async () => {
      const result = await attempt(shape, 'dropped-bypass');
      console.log(`[X187] ${shape} dropped-bypass: ${result.sent ?? result.refusal?.split('\n')[0]} `
        + `input=${result.failingInput} participants=${result.participants} `
        + `invocations=${result.invocations} emissions=${JSON.stringify(result.emissions)}`);
      expect(result.participants).toBe(1);
      expect(result.invocations).toBe(1);
      expect(result.emissions).toEqual(['']);
      expect(result.sent, 'a dropped external call SETTLED').toBeUndefined();
      expect(result.refusal).toContain(VECTOR_EXHAUSTED);
      expect(result.failingInput, 'the refusal did not name the caller master').toBe(0);
    }, 900_000);
  });
});
