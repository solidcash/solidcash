import { describe, expect, it } from 'vitest';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';
import { compileString, compileStringMulti } from 'solidc';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createDataNftUnlocker, getDataNftAddress } from '../../src/stateful/covenant-helpers.js';

/**
 * X179. IS A DROPPED EXTERNAL CALL AN ADMITTED OUTCOME?
 *
 * `Layer3RecoveredVoidWriterX177.test.ts` settles `Attack.attack` - one participant, one invocation, emissions
 * `['']` - while the handler's whole body is `wallet.transfer(..)`. It declined to say whether the bus is
 * SUPPOSED to require a co-spent counterparty for an admitted external call, because `Attack`'s counterparty
 * `Wallet` is refused from the bus by `LowLevelCallShapeError` and so no correct co-spend exists to compare
 * against.
 *
 * THIS FILE ANSWERS IT WITH SUBJECTS WHOSE COUNTERPARTY IS ADMITTED. Five caller shapes, all minimal, all
 * compiled in bus mode against the same callee, all staged by the same harness. Each settles its honest
 * co-spend first, so every negative below discriminates against a positive; then the ONLY field that moves is
 * whether the child invocation is planned.
 *
 * ANSWER 1: NO, DROPPING IS NOT AN OUTCOME - the design says so twice. `deriveCompiledGraphPlan` expands every
 * `once` callsite unconditionally and `takeTarget` THROWS when no participant answers it, so the derivation
 * entry point cannot produce a dropped edge at all. `occurrenceBoundOf` publishes `minimum: 1` for that class.
 * And the caller route partitions its authenticated emission vector row by row, so a dropped row leaves it
 * nothing to split - the `VECTOR_EXHAUSTED` signature `Layer3OccurrenceExhaustion.test.ts` records for a
 * transcript that omits a reached occurrence, and C2 for a graph that omits its return edge.
 *
 * ANSWER 2: AND THE COVENANT DOES ENFORCE IT - for all three INTERFACE-CAST callers, `IX179Callee(addr).m()`.
 * Forwarded argument, expression argument, and the same caller compiled under `solidityImportCompat` with a
 * return-event slot in its block: all three are refused at input 0 with the vector exhausted.
 *
 * ANSWER 3, AND X187 CLOSED IT. The two shapes that escaped were `Attack.attack`'s: a method call on a
 * CONTRACT-TYPED STATE VARIABLE - `X179SolBar bar; ... bar.log();` - settled with an EMPTY emission vector, no
 * co-spent counterparty and one participant, on a clean pair whose counterparty the bus admits. The isolation
 * left exactly one variable standing, the RECEIVER SPELLING, and that is what it was: `bar.log()` parses as a
 * NAMESPACED FunctionCall (`bar.log`), not a MethodCall, and only becomes an `ExternalFunctionCallNode` in the
 * semantic pass that runs AFTER route synthesis has frozen its verdict. `synthesizeHiddenBatchRoute`'s
 * conservative call rejection tested three node kinds and none of them was this one, so the handler was
 * admitted as a plain scalar handler - never a graph tail handler - and its route framed no emission for the
 * edge it published in its own ABI. Route synthesis now recovers the call from the receiver's declared type,
 * the same type the semantic pass reads, so both spellings reach the same verdict.
 *
 * WHAT THAT MEANS FOR EACH SHAPE. `solidity-require` now BINDS: refused at input 0 with the vector exhausted,
 * with its honest co-spend still settling as the positive. `solidity` - one call statement, no trailing
 * require - is now refused from the bus BY NAME, which is what the interface-cast spelling of that same body
 * has always been (see the X187 block at the bottom, which asserts both halves).
 *
 * ON THE SDK. The SDK refuses every dropped plan by name at plan time (`assertHandlerRowFloor`), the same
 * statement `deriveCompiledGraphPlan` already made. That is a diagnostic, NOT a boundary - the SDK is an
 * untrusted witness constructor, and `dropped-bypass` below is exactly how a composer walks past it. What
 * answers it now is the caller's own compiled route.
 *
 * NOT CLAIMED. No value or authority was ever shown moving, on any shape: the escaping caller's callee was
 * simply absent from the transaction, and nothing here demonstrated a theft primitive. Nothing is claimed
 * about receiver spellings this file does not build - a contract-typed local, parameter or struct field.
 */

const CALLEE = `pragma solidcash >=0.8.0;
contract X179Callee(int brand) {
  function tick(int value) public pure { require(value > 0); }
}`;

/** FORWARDED argument, constructor-pinned target. The plainest possible straight-line `once` callsite. */
const FORWARD_CALLER = `pragma solidcash >=0.8.0;
interface IX179Callee { function tick(int value); }
contract X179Forward(bytes calleeAddr) {
  function ping(int value) { IX179Callee(calleeAddr).tick(value); require(value > 0); }
}`;

/**
 * EXPRESSION argument, state-variable target - `Attack.attack`'s published callsite shape
 * (`addressStateVar` plus `argSources: [{kind:'expression'}]`), which the plan-time gates cannot re-derive.
 */
const EXPRESSION_CALLER = `pragma solidcash >=0.8.0;
interface IX179Callee { function tick(int value); }
contract X179Expression() {
  address callee;
  int knob;
  function ping() { IX179Callee(callee).tick(knob + 1); require(true); }
}`;

/**
 * THE SAME CALLER WITH THE OTHER TWO CONFOUNDS TURNED ON: compiled under `solidityImportCompat`, and given a
 * returning getter sibling so its route is in result mode and its block carries a return-event slot - which is
 * what the escaping pair below has and the two shapes above do not. Everything else is byte-identical to
 * `EXPRESSION_CALLER`, so if this still binds, the receiver spelling is the only variable left standing.
 */
const EXPRESSION_COMPAT_CALLER = `${EXPRESSION_CALLER.slice(0, -2)}
  function peek() returns (int) { return knob; }
}`;

/**
 * `Attack.attack`'s EXACT source shape, with a counterparty the bus admits: a CONTRACT-TYPED state variable,
 * a body that is one bare method call with no trailing require, and a returning getter sibling that puts a
 * return-event slot in the block. Nothing here is Solidity-specific except the spelling.
 */
const SOLIDITY_PAIR = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract X179SolBar {
    uint256 public n;
    function log() public { n = n; }
}

contract X179SolFoo {
    X179SolBar bar;
    constructor(address _bar) { bar = X179SolBar(_bar); }
    function callBar() public { bar.log(); }
}`;

/**
 * THE ONE-VARIABLE ISOLATION, and it eliminated the candidate it was written to test. Byte-for-byte the pair
 * above with a trailing `require(true)` added - the shape of the tail statement is one of the things the
 * route's handler eligibility reads. It escapes IDENTICALLY, so the missing tail require is not what makes
 * the pair above escape; the CONTRACT-TYPED receiver is the variable that survives.
 *
 * The interface-cast spelling cannot be varied the other way to complete the square: without a trailing
 * require it is not an eligible handler at all, and with an `address` state variable under
 * `solidityImportCompat` it fails to compile with an internal
 * `Expected variable '__extaddr_bar_IBar' does not exist on the stack`. Both are recorded, neither is a
 * claim about the mechanism.
 */
const SOLIDITY_PAIR_REQUIRE = SOLIDITY_PAIR.replace(
  'function callBar() public { bar.log(); }',
  'function callBar() public { bar.log(); require(true); }',
);

const KNOB = 3n;
const FORWARD_VALUE = 4n;
/** A void handler's return-event slot carries the empty result vector's single push. */
const EMPTY_VECTOR = binToHex(scriptToBytecode([new Uint8Array(0)]));

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);

/** Which caller shape is under test. */
type Shape = 'forward' | 'expression' | 'expression-compat' | 'solidity' | 'solidity-require';
/**
 * The ONE field that moves: whether the callsite's child invocation is planned and co-spent. `dropped-bypass`
 * additionally strips the published callsite from the artifact copy the PLANNER reads, which is how an
 * untrusted composer gets past the SDK's own floor - the VM sees the unchanged compiled route either way.
 */
type Edge = 'co-spent' | 'dropped' | 'dropped-bypass';

interface Attempt {
  sent?: string;
  refusal?: string;
  failingInput?: number;
  participants: number;
  invocations: number;
  emissions: readonly string[];
  callerBlockSize: number;
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
  const solidity = shape === 'solidity' || shape === 'solidity-require'
    ? compileStringMulti(
      shape === 'solidity' ? SOLIDITY_PAIR : SOLIDITY_PAIR_REQUIRE,
      { ...options, solidityImportCompat: true, ecrecover: 'p2pkh' } as never,
    )
    : undefined;
  const calleeArtifact: any = solidity ? (solidity as any).X179SolBar : compileString(CALLEE, options);
  const calleeBase = new Contract(calleeArtifact, solidity ? [] : [7n], { provider });
  const calleeSetup = await setupStatefulUtxos(provider, calleeBase, calleeArtifact.stateLayout!, {});
  const callee = calleeBase.withCategory(hexToBin(calleeSetup.categoryId));

  const callerArtifact: any = solidity ? (solidity as any).X179SolFoo
    : shape === 'expression-compat'
      ? compileString(EXPRESSION_COMPAT_CALLER,
        { ...options, solidityImportCompat: true, ecrecover: 'p2pkh' } as never)
      : compileString(shape === 'forward' ? FORWARD_CALLER : EXPRESSION_CALLER, options);
  const handler = solidity ? 'callBar' : 'ping';
  // The callsite publishes `addressStateVar: 'callee_IX179Callee'` - the external-call lowering's internal
  // name - while the STATE LAYOUT still calls the slot `callee`. Seeding by the ABI name silently leaves the
  // slot empty and the covenant then recomputes an empty emission target, so the layout is the authority here.
  const targetVariable = callerArtifact.stateLayout!.variables
    .find((variable: any) => variable.type === 'address')?.name;
  const callerState = shape === 'forward' ? {}
    : solidity ? { [targetVariable!]: hexToBin(callee.lockingBytecode) as never }
      : { [targetVariable!]: hexToBin(callee.lockingBytecode) as never, knob: KNOB };
  const callerBase = new Contract(
    callerArtifact, shape === 'forward' ? [callee.lockingBytecode] : [], { provider },
  );
  const callerSetup = await setupStatefulUtxos(
    provider, callerBase, callerArtifact.stateLayout!, callerState,
  );
  const caller = callerBase.withCategory(hexToBin(callerSetup.categoryId));

  // The BYPASS: the plan is handed a caller artifact whose ABI publishes no callsite, so the SDK's floor has
  // nothing to require. Only the ABI copy the PLANNER reads changes - the contract, its locking bytecode, its
  // compiled route and its batch blob are the real ones, so the VM still evaluates the real caller covenant.
  const plannedCallerArtifact = edge === 'dropped-bypass'
    ? {
      ...callerArtifact,
      abi: callerArtifact.abi.map((entry: any) =>
        (entry.name === handler ? { ...entry, externalCalls: undefined } : entry)),
    }
    : callerArtifact;
  const participants = [
    { artifact: plannedCallerArtifact, lockingBytecode: caller.lockingBytecode },
    { artifact: calleeArtifact, lockingBytecode: callee.lockingBytecode },
  ];
  const callArgs = shape === 'forward' ? [FORWARD_VALUE] : solidity ? [] : [KNOB + 1n];
  const invocations = [
    { parent: null, callee: 0, function: handler, args: shape === 'forward' ? [FORWARD_VALUE] : [] },
    { parent: 0, callee: 1, function: solidity ? 'log' : 'tick', args: callArgs },
  ];
  const plan = layer3.planCompiledGraph(
    edge === 'co-spent' ? participants : [participants[0]],
    (edge === 'co-spent' ? invocations : [invocations[0]]) as never,
  );
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  // A block can carry a return-event SLOT while its planned rows return nothing - a void handler with a
  // returning getter sibling puts the route in result mode. `layout.returnOutputs` is the physical slot; the
  // transcript's is null unless the participant's own rows actually produce a result vector.
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
          // The second argument is the MASTER INPUT INDEX, not the data-NFT index. They coincide only for
          // participant 0, which is why a one-participant harness never notices.
          tx.addInput(setup.dataNftUtxos[nft], createDataNftUnlocker(
            contract, layout.participantInputs[index], setup.categoryId,
          ));
          // Neither handler writes state, so the post-state is the seeded state. Taken from the seeded UTXO
          // rather than recomputed, so a staging mismatch cannot masquerade as a covenant refusal.
          tx.addOutput({
            to: getDataNftAddress(contract, setup.categoryId),
            amount: setup.dataNftUtxos[nft].satoshis,
            token: setup.dataNftUtxos[nft].token,
          });
          break;
        }
        case 'returnEvent': {
          const funding = randomUtxo({ satoshis: 1000n });
          await provider.addUtxo(p2pkh.address, funding);
          tx.addInput(funding, p2pkh.unlock.spend(alicePub, signature()));
          tx.addOutput({
            to: hexToBin('51'),
            amount: 1000n,
            token: {
              category: setup.categoryId,
              amount: 0n,
              nft: { capability: 'none', commitment: EMPTY_VECTOR },
            },
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
    callerBlockSize: callerArtifact.hiddenBatch!.route.blockLayout!.blockSize,
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

/** The bus refuses a handler whose outgoing edge it cannot frame, before any transaction is built. */
const NOT_ELIGIBLE = 'is not batch eligible: batched-handler-forward-call-not-enabled';

/**
 * The subjects the bus ADMITS, and whether the CALLER COVENANT binds its own outgoing edge on each. Every other
 * field of the harness is identical, so `covenantBinds` is the measurement this file exists to take.
 *
 * X187 CLOSED THE LAST ROW HERE. `solidity-require` was the escaping shape this file isolated; it now binds,
 * refused at input 0 with the same exhausted vector as the interface-cast subjects. See the X187 block below
 * for the bare-body shape, which the bus no longer admits at all.
 */
const SUBJECTS = [
  { shape: 'forward', label: 'interface cast, forwarded argument', covenantBinds: true },
  { shape: 'expression', label: 'interface cast, expression argument, state-var target', covenantBinds: true },
  { shape: 'expression-compat', label: 'interface cast, compat mode, return-event slot', covenantBinds: true },
  { shape: 'solidity-require', label: 'CONTRACT-TYPED state variable, trailing require', covenantBinds: true },
] as const;

describe('X179: does a straight-line `once` external call require its counterparty to be co-spent?', () => {
  describe.each(SUBJECTS)('$label', ({ shape, covenantBinds }) => {
    /** The POSITIVE every row below needs: without it a refusal here would discriminate nothing. */
    it('GUARD: the honest co-spent graph settles', async () => {
      const result = await attempt(shape, 'co-spent');
      console.log(`[X179] ${shape} co-spent: ${result.sent ?? result.refusal?.split('\n')[0]} `
        + `block=${result.callerBlockSize} participants=${result.participants} `
        + `invocations=${result.invocations} emissions=${JSON.stringify(result.emissions)}`);
      expect(result.refusal, 'the honest co-spend did not settle').toBeUndefined();
      expect(result.sent).toMatch(/^[0-9a-f]{64}$/);
      expect(result.participants).toBe(2);
      expect(result.invocations).toBe(2);
      // The emission row exists and is non-empty; every hostile below removes exactly this.
      expect(result.emissions[0]).not.toBe('');
    }, 900_000);

    /**
     * ONE FIELD MOVES: the child invocation is not planned. The SDK refuses that plan by name, against the
     * callsite the missing row belongs to, on the same published bound `deriveCompiledGraphPlan` expands.
     * This is uniform across all three shapes - it reads the ARTIFACT, not the covenant.
     */
    it('SDK: dropping the child invocation is refused by name at plan time', async () => {
      let refusal: string | undefined;
      try {
        await attempt(shape, 'dropped');
      } catch (error) {
        refusal = (error as Error).message;
      }
      console.log(`[X179] ${shape} dropped plan: ${refusal ?? 'ADMITTED'}`);
      expect(refusal, 'a dropped external call was still planned').toBeDefined();
      expect(refusal).toContain('layer3: callsite 0 was planned with 0 occurrences, below the 1 proven');
    }, 900_000);

    /**
     * AND THE SDK IS NOT THE BOUNDARY. The same dropped plan, with the published callsite stripped from the
     * artifact copy the planner reads, is admitted by the SDK - so what answers is the caller's own compiled
     * route, which is byte-identical in both runs. THIS is where the three shapes separate.
     */
    it(`COVENANT: the artifact-stripped bypass ${covenantBinds ? 'is refused at input 0' : 'SETTLES'}`,
      async () => {
        const result = await attempt(shape, 'dropped-bypass');
        console.log(`[X179] ${shape} dropped-bypass: ${result.sent ?? result.refusal?.split('\n')[0]} `
          + `input=${result.failingInput} participants=${result.participants} `
          + `invocations=${result.invocations} emissions=${JSON.stringify(result.emissions)}`);
        expect(result.participants).toBe(1);
        expect(result.invocations).toBe(1);
        expect(result.emissions).toEqual(['']);
        expect(covenantBinds, 'every admitted subject must bind its own outgoing edge').toBe(true);
        expect(result.sent, 'a dropped external call SETTLED').toBeUndefined();
        expect(result.refusal).toContain(VECTOR_EXHAUSTED);
        expect(result.failingInput, 'the refusal did not name the caller master').toBe(0);
      }, 900_000);
  });

  /**
   * X187. THE BARE-BODY SHAPE IS NOW REFUSED FROM THE BUS BY NAME, and that refusal is PARITY rather than a
   * loss: the interface-cast spelling of the same body - one external-call statement, no trailing require - has
   * always been refused with this exact reason. Route synthesis could not see the contract-typed-receiver
   * spelling at all (it parses as a namespaced FunctionCall, not a MethodCall), so it admitted the handler as a
   * plain scalar one and framed no emission for the edge; the two spellings now reach the same verdict.
   *
   * Both halves are asserted here so a future change that re-admits one and not the other is a failure.
   */
  describe('CONTRACT-TYPED state variable, bare call body', () => {
    it('the bus refuses the handler by name, before any transaction exists', async () => {
      await expect(attempt('solidity', 'co-spent')).rejects.toThrow(`Handler 'callBar' ${NOT_ELIGIBLE}`);
    }, 900_000);

    /**
     * The PARITY control: same body shape, interface-cast spelling, refused with the same reason. The getter
     * sibling is `X179SolBar bar`'s published getter, and it is what keeps a route in existence for the
     * refused handler's verdict to be read off - without one the contract has no route at all.
     */
    it('and refuses the interface-cast spelling of the same body identically', () => {
      const artifact = compileString(`pragma solidcash >=0.8.0;
interface IX179Callee { function tick(int value); }
contract X179BareCast() {
  address callee;
  function ping() { IX179Callee(callee).tick(1); }
  function peek() returns (address) { return callee; }
}`, {
        forceStateful: true,
        experimentalHiddenBatch: true,
        experimentalMessageBusController: 'aa'.repeat(35),
        experimentalMessageBusControllerCategory: 'ab'.repeat(32),
      } as never) as any;
      const handler = artifact.hiddenBatch!.handlers!.find((entry: any) => entry.name === 'ping');
      expect(handler.eligible).toBe(false);
      expect(handler.rejectionReason).toBe('batched-handler-forward-call-not-enabled');
    });
  });
});
