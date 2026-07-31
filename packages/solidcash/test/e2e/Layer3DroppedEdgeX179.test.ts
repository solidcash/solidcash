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
 * THIS FILE ANSWERS IT WITH SUBJECTS WHOSE COUNTERPARTY IS ADMITTED. Three caller shapes, all minimal, all
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
 * ANSWER 2: AND THE COVENANT DOES ENFORCE IT - for two of the three shapes. Both interface-cast callers,
 * forwarded argument and expression argument, are refused at input 0 with the vector exhausted.
 *
 * ANSWER 3: THE THIRD SHAPE ESCAPES, AND IT IS `Attack.attack`'s SHAPE. A method call on a CONTRACT-TYPED
 * STATE VARIABLE with no interface cast - `X179SolBar bar; ... bar.log();` - settles with an EMPTY emission
 * vector, no co-spent counterparty and one participant. Its honest co-spend settles in the same harness, and
 * its two siblings are refused by the same harness, so this is a property of the compiled caller and not of
 * the staging. `Attack.attack` is therefore not a curiosity of a bus-inadmissible counterparty: the escape
 * reproduces on a clean pair where the counterparty is admitted.
 *
 * WHAT CLOSED, AND WHAT DID NOT. The SDK now refuses all three dropped plans by name at plan time
 * (`assertHandlerRowFloor`), which is the same statement `deriveCompiledGraphPlan` already made. That is a
 * diagnostic, NOT a boundary - the SDK is an untrusted witness constructor, and `dropped-bypass` below shows
 * exactly how a composer walks past it. For the escaping shape the caller covenant does not bind its own
 * outgoing edge at all, so nothing on chain refuses it. Closing that is compiler-side.
 *
 * NOT CLAIMED. No value or authority is shown moving, on any shape. The escaping caller's callee is simply
 * absent from the transaction; nothing here demonstrates a theft primitive, and no mechanism inside the
 * compiler is named - only the source shape that reproduces it.
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

const KNOB = 3n;
const FORWARD_VALUE = 4n;
/** A void handler's return-event slot carries the empty result vector's single push. */
const EMPTY_VECTOR = binToHex(scriptToBytecode([new Uint8Array(0)]));

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);

/** Which caller shape is under test. */
type Shape = 'forward' | 'expression' | 'solidity';
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
  const solidity = shape === 'solidity'
    ? compileStringMulti(SOLIDITY_PAIR, { ...options, solidityImportCompat: true, ecrecover: 'p2pkh' } as never)
    : undefined;
  const calleeArtifact: any = solidity ? (solidity as any).X179SolBar : compileString(CALLEE, options);
  const calleeBase = new Contract(calleeArtifact, solidity ? [] : [7n], { provider });
  const calleeSetup = await setupStatefulUtxos(provider, calleeBase, calleeArtifact.stateLayout!, {});
  const callee = calleeBase.withCategory(hexToBin(calleeSetup.categoryId));

  const callerArtifact: any = solidity ? (solidity as any).X179SolFoo : compileString(
    shape === 'forward' ? FORWARD_CALLER : EXPRESSION_CALLER, options,
  );
  const handler = shape === 'solidity' ? 'callBar' : 'ping';
  // The callsite publishes `addressStateVar: 'callee_IX179Callee'` - the external-call lowering's internal
  // name - while the STATE LAYOUT still calls the slot `callee`. Seeding by the ABI name silently leaves the
  // slot empty and the covenant then recomputes an empty emission target, so the layout is the authority here.
  const targetVariable = callerArtifact.stateLayout!.variables
    .find((variable: any) => variable.type === 'address')?.name;
  const callerState = shape === 'forward' ? {}
    : shape === 'solidity' ? { [targetVariable!]: hexToBin(callee.lockingBytecode) as never }
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
  const callArgs = shape === 'forward' ? [FORWARD_VALUE] : shape === 'solidity' ? [] : [KNOB + 1n];
  const invocations = [
    { parent: null, callee: 0, function: handler, args: shape === 'forward' ? [FORWARD_VALUE] : [] },
    { parent: 0, callee: 1, function: shape === 'solidity' ? 'log' : 'tick', args: callArgs },
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

/**
 * The three subjects, and whether the CALLER COVENANT binds its own outgoing edge on each. Every other field
 * of the harness is identical, so `covenantBinds` is the measurement this file exists to take.
 */
const SUBJECTS = [
  { shape: 'forward', label: 'interface cast, forwarded argument', covenantBinds: true },
  { shape: 'expression', label: 'interface cast, expression argument, state-var target', covenantBinds: true },
  { shape: 'solidity', label: 'CONTRACT-TYPED state variable, no interface cast', covenantBinds: false },
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
        if (covenantBinds) {
          expect(result.sent, 'a dropped external call SETTLED').toBeUndefined();
          expect(result.refusal).toContain(VECTOR_EXHAUSTED);
          expect(result.failingInput, 'the refusal did not name the caller master').toBe(0);
          return;
        }
        // THE ESCAPE, and it is the row. `Attack.attack`'s source shape settles a transaction asserting a
        // call that did not happen, against a co-spend that is not there - with a settling positive above
        // proving the harness builds this contract correctly, and two sibling shapes proving the covenant
        // binds this edge when the call is spelled as an interface cast.
        expect(result.refusal, 'the escape closed - promote this shape to covenantBinds').toBeUndefined();
        expect(result.sent).toMatch(/^[0-9a-f]{64}$/);
      }, 900_000);
  });
});
