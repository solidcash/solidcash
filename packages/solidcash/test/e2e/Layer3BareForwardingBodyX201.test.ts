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
 * X201. THE BARE FORWARDING BODY - one call, no trailing require - ADMITTED AND BOUND.
 *
 * X187 closed a real escape by REFUSAL: a body that is one outgoing call with no trailing `require` became
 * `batched-handler-forward-call-not-enabled` in BOTH spellings rather than being admitted with an unframed
 * edge. That retired three recorded subjects, including the only recovered writer whose external call could
 * carry a sound co-spend. X201 asks whether the shape can be admitted AND BOUND instead.
 *
 * WHY IT LANDS IN THE RIGHT FORM, which is the whole reason this is a repair and not a re-opening.
 * `graphTailStatement` requires two statements AND a trailing `require(true)`, so a body whose last statement
 * is the call has it FALSE unconditionally - and `graphRuntimeHandlers` membership follows from exactly that.
 * The runtime form authenticates the emission row AT THE CALL SITE, where the synthesized `__extaddr_*` local
 * naming the callee is in scope. The wrapper-epilogue form cannot name that local (it looks it up on the ROUTE
 * stack and throws `Expected variable '__extaddr_bar' does not exist on the stack`), so the widened predicate
 * makes `graphRuntimeHandlers` membership a PRECONDITION rather than a consequence, and `directMethodCallCount`
 * is left alone.
 *
 * WHAT THE WIDENING DOES NOT ADMIT, measured and kept:
 *   - a LOW-LEVEL `callee.call(payload);` bare body. Admitting it routed the shape to the raw-calldata graph
 *     lowering, which aborts with an INTERNAL throw where the handler previously got a NAMED refusal.
 *   - a MULTI-EDGE bare body. Two bare calls compile and publish two edges, but only the single-edge shape is
 *     VM-proved below, and admitting an unproven emission shape is the exact failure X187 closed.
 *   - a bare call followed by any non-call statement. Still refused, by name.
 *
 * THE BAR THIS FILE HAS TO CLEAR is not admission. It is that the bound edge REFUSES a dropped-callee
 * transaction at a named input index on the BARE shape, with the honest co-spend settling as the control.
 */

const CALLEE = `pragma solidcash >=0.8.0;
contract X201Callee(int brand) {
  function tick(int value) public pure { require(value > 0); }
}`;

/** The interface-cast spelling, bare: one call, no trailing require. */
const CAST_BARE = `pragma solidcash >=0.8.0;
interface IX201Callee { function tick(int value); }
contract X201Caller() {
  address callee;
  int knob;
  function ping() { IX201Callee(callee).tick(knob + 1); }
}`;

/** The contract-typed-receiver spelling of the same bare body - the shape X187 bound and then refused. */
const RECEIVER_BARE = CAST_BARE
  .replace('address callee;', 'IX201Callee callee;')
  .replace('IX201Callee(callee).tick', 'callee.tick');

/** The require-tailed control, admitted before X201 and unchanged by it. */
const CAST_TAILED = CAST_BARE.replace('.tick(knob + 1); }', '.tick(knob + 1); require(true); }');

const KNOB = 3n;

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);

/** The caller's route ran out of authenticated emission rows mid-partition - X187's own signature. */
const VECTOR_EXHAUSTED = 'Program called an OP_SPLIT operation with an invalid index';

const BUS_OPTIONS = {
  forceStateful: true,
  experimentalHiddenBatch: true,
  experimentalMessageBusController: 'aa'.repeat(35),
  experimentalMessageBusControllerCategory: 'ab'.repeat(32),
} as never;

type Shape = 'cast-bare' | 'receiver-bare';
const SOURCES: Record<Shape, string> = { 'cast-bare': CAST_BARE, 'receiver-bare': RECEIVER_BARE };
type Edge = 'co-spent' | 'dropped-bypass';

interface Attempt {
  sent?: string;
  refusal?: string;
  failingInput?: number;
  participants: number;
  invocations: number;
  emissions: readonly string[];
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
  // The state LAYOUT is the authority for the target slot: the published ABI name is the external-call
  // lowering's internal one for the cast spelling and the source name for the receiver spelling.
  const targetVariable = callerArtifact.stateLayout!.variables
    .find((variable: any) => variable.type === 'address')!.name;
  const callerBase = new Contract(callerArtifact, [], { provider });
  const callerSetup = await setupStatefulUtxos(provider, callerBase, callerArtifact.stateLayout!, {
    [targetVariable]: hexToBin(callee.lockingBytecode) as never, knob: KNOB,
  });
  const caller = callerBase.withCategory(hexToBin(callerSetup.categoryId));

  // THE BYPASS, verbatim from X187: the PLANNER is handed a caller ABI publishing no callsite, so the SDK's
  // own row floor has nothing to require. The contract, its locking bytecode and its compiled route are the
  // real ones, so the VM still evaluates the real caller covenant.
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
          tx.addInput(setup.dataNftUtxos[nft], createDataNftUnlocker(
            contract, layout.participantInputs[index], setup.categoryId,
          ));
          // Neither handler writes state, so the post-state is the seeded UTXO's own token, taken rather than
          // recomputed - a staging mismatch cannot then masquerade as a covenant refusal.
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

  const report = {
    participants: plan.participants.length,
    invocations: plan.invocations.length,
    emissions: (transcript as any).participantEmissionsHex as readonly string[],
  };
  try {
    return { sent: await provider.sendRawTransaction(raw(tx)), ...report };
  } catch (error) {
    const refusal = (error as Error).message;
    const index = refusal.match(/input index (\d+)/);
    return { refusal, failingInput: index ? Number(index[1]) : undefined, ...report };
  }
}

const verdict = (source: string): { eligible?: boolean; rejectionReason?: string } =>
  (compileString(source, BUS_OPTIONS) as any).hiddenBatch?.handlers
    ?.find((entry: any) => entry.name === 'ping');

describe('X201: a bare forwarding body is admitted and its edge is bound', () => {
  it('ADMISSION: both bare spellings are admitted, and they compile to the same size', () => {
    expect(verdict(CAST_BARE).eligible).toBe(true);
    expect(verdict(RECEIVER_BARE).eligible).toBe(true);
    const cast = compileString(CAST_BARE, BUS_OPTIONS) as any;
    const receiver = compileString(RECEIVER_BARE, BUS_OPTIONS) as any;
    expect(RECEIVER_BARE).not.toBe(CAST_BARE);
    expect(receiver.debug.bytecode.length).toBe(cast.debug.bytecode.length);
    expect(receiver.hiddenBatch.route.blockLayout).toEqual(cast.hiddenBatch.route.blockLayout);
    // Both publish the same single outgoing edge, which is what the covenant below has to frame.
    const edgeOf = (artifact: any): unknown => artifact.abi.find((entry: any) => entry.name === 'ping')
      .externalCalls.map((call: any) => [call.functionName, call.occurrence]);
    expect(edgeOf(cast)).toEqual([['tick', 'once']]);
    expect(edgeOf(receiver)).toEqual(edgeOf(cast));
  });

  /**
   * THE BOUNDARIES, each asserted as a NAMED refusal rather than described. A widening whose edges are not
   * pinned is a widening nobody can review.
   */
  it('BOUNDARY: the shapes the widening deliberately leaves refused', () => {
    // A bare call followed by any non-call statement.
    const trailing = `pragma solidcash >=0.8.0;
interface IX201Callee { function tick(int value); }
contract X201Trail() {
  address callee;
  int knob;
  function ping() { IX201Callee(callee).tick(knob + 1); knob = knob + 1; }
  function peek() public { require(knob >= 0); }
}`;
    expect(verdict(trailing).rejectionReason).toBe('batched-handler-forward-call-not-enabled');
    // Two bare edges: compiles, publishes two callsites, still refused pending a VM proof of the shape.
    const multi = `pragma solidcash >=0.8.0;
interface IX201Callee { function tick(int value); }
contract X201Two() {
  address a;
  address b;
  int knob;
  function ping() { IX201Callee(a).tick(knob + 1); IX201Callee(b).tick(knob + 2); }
  function peek() public { require(knob >= 0); }
}`;
    expect(verdict(multi).rejectionReason).toBe('batched-handler-forward-call-not-enabled');
  });

  it('REGRESSION: the require-tailed control is unchanged and still admitted', () => {
    expect(verdict(CAST_TAILED).eligible).toBe(true);
    const tailed = compileString(CAST_TAILED, BUS_OPTIONS) as any;
    const bare = compileString(CAST_BARE, BUS_OPTIONS) as any;
    // The bare body is the tailed one minus `require(true)`, and that is the only difference in the script.
    expect(bare.debug.bytecode.length).toBeLessThan(tailed.debug.bytecode.length);
  });

  describe.each([
    { shape: 'cast-bare' as Shape, label: 'interface-cast bare body' },
    { shape: 'receiver-bare' as Shape, label: 'contract-typed-receiver bare body' },
  ])('$label', ({ shape }) => {
    /** The POSITIVE the hostile needs: without it a refusal discriminates nothing. */
    it('CONTROL: the honest co-spent graph settles', async () => {
      const result = await attempt(shape, 'co-spent');
      console.log(`[X201] ${shape} co-spent: ${result.sent ?? result.refusal?.split('\n')[0]} `
        + `participants=${result.participants} invocations=${result.invocations} `
        + `emissions=${JSON.stringify(result.emissions)}`);
      expect(result.refusal, 'the honest co-spend did not settle').toBeUndefined();
      expect(result.sent).toMatch(/^[0-9a-f]{64}$/);
      expect(result.participants).toBe(2);
      expect(result.invocations).toBe(2);
      // The emission row exists and is non-empty; the hostile below removes exactly this.
      expect(result.emissions[0]).not.toBe('');
    }, 900_000);

    /**
     * THE BAR. One field moves: the child invocation is not planned, and the published callsite is stripped
     * from the artifact copy the PLANNER reads so the SDK's own row floor cannot answer for it. What is left
     * to answer is the caller's compiled route, byte-identical in both runs.
     */
    it('COVENANT: the dropped callee is refused at input index 0', async () => {
      const result = await attempt(shape, 'dropped-bypass');
      console.log(`[X201] ${shape} dropped-bypass: ${result.sent ?? result.refusal?.split('\n')[0]} `
        + `input=${result.failingInput} emissions=${JSON.stringify(result.emissions)}`);
      expect(result.participants).toBe(1);
      expect(result.invocations).toBe(1);
      expect(result.emissions).toEqual(['']);
      expect(result.sent, 'a dropped external call on a BARE body SETTLED').toBeUndefined();
      expect(result.refusal).toContain(VECTOR_EXHAUSTED);
      expect(result.failingInput, 'the refusal did not name the caller master input').toBe(0);
    }, 900_000);
  });
});
