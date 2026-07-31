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
 * X179. IS A DROPPED EXTERNAL CALL AN ADMITTED OUTCOME?
 *
 * `Layer3RecoveredVoidWriterX177.test.ts` settles `Attack.attack` - one participant, one invocation, emissions
 * `['']` - while the handler's whole body is `wallet.transfer(..)`. It declined to say whether the bus is
 * SUPPOSED to require a co-spent counterparty for an admitted external call, because `Attack`'s counterparty
 * `Wallet` is refused from the bus by `LowLevelCallShapeError` and so no correct co-spend exists to compare
 * against.
 *
 * THIS FILE ANSWERS IT WITH A SUBJECT WHOSE COUNTERPARTY IS ADMITTED. The pair is minimal and both halves
 * compile in bus mode, so the honest co-spend is constructible and the ONLY field that moves between the two
 * runs is whether the child invocation is planned.
 *
 * WHAT IT MEASURES.
 *
 *  1. CO-SPENT SETTLES. Two participants, two invocations, one emission row - broadcast.
 *  2. DROPPED IS REFUSED AT INPUT 0 - the caller's own master - with `OP_SPLIT ... invalid index ... stack
 *     item length: 0`. That is the caller's route partitioning its authenticated emission vector and finding
 *     nothing to split: the same `VECTOR_EXHAUSTED` signature `Layer3OccurrenceExhaustion.test.ts` records for
 *     a transcript that omits a reached occurrence.
 *  3. BOTH ARGUMENT SHAPES BEHAVE THE SAME. A callsite whose argument is FORWARDED and one whose argument is a
 *     compiler-labelled EXPRESSION - `Attack.attack`'s shape, and the shape the plan-time gates treat most
 *     loosely - are refused identically when their child is dropped.
 *
 * SO A DROPPED EXTERNAL CALL IS NOT AN ADMITTED OUTCOME. The boundary exists, it is the caller covenant's own
 * emission partition, and it is enforced for the ordinary straight-line `once` callsite. Whatever lets
 * `Attack.attack` settle is an ESCAPE from this boundary, not the boundary's intended shape.
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

const KNOB = 3n;
const FORWARD_VALUE = 4n;

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);

/** Which caller shape is under test. */
type Shape = 'forward' | 'expression';
/** The ONE field that moves: whether the callsite's child invocation is planned and co-spent. */
type Edge = 'co-spent' | 'dropped';

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
  const calleeArtifact = compileString(CALLEE, options);
  const calleeBase = new Contract(calleeArtifact, [7n], { provider });
  const calleeSetup = await setupStatefulUtxos(provider, calleeBase, calleeArtifact.stateLayout!, {});
  const callee = calleeBase.withCategory(hexToBin(calleeSetup.categoryId));

  const callerArtifact = compileString(
    shape === 'forward' ? FORWARD_CALLER : EXPRESSION_CALLER, options,
  );
  // The callsite publishes `addressStateVar: 'callee_IX179Callee'` - the external-call lowering's internal
  // name - while the STATE LAYOUT still calls the slot `callee`. Seeding by the ABI name silently leaves the
  // slot empty and the covenant then recomputes an empty emission target, so the layout is the authority here.
  const targetVariable = callerArtifact.stateLayout!.variables
    .find((variable: any) => variable.type === 'address')?.name;
  const callerState = shape === 'forward'
    ? {} : { [targetVariable!]: hexToBin(callee.lockingBytecode) as never, knob: KNOB };
  const callerBase = new Contract(
    callerArtifact, shape === 'forward' ? [callee.lockingBytecode] : [], { provider },
  );
  const callerSetup = await setupStatefulUtxos(
    provider, callerBase, callerArtifact.stateLayout!, callerState,
  );
  const caller = callerBase.withCategory(hexToBin(callerSetup.categoryId));

  const participants = [
    { artifact: callerArtifact, lockingBytecode: caller.lockingBytecode },
    { artifact: calleeArtifact, lockingBytecode: callee.lockingBytecode },
  ];
  const callArgs = shape === 'forward' ? [FORWARD_VALUE] : [KNOB + 1n];
  const invocations = [
    { parent: null, callee: 0, function: 'ping', args: shape === 'forward' ? [FORWARD_VALUE] : [] },
    { parent: 0, callee: 1, function: 'tick', args: callArgs },
  ];
  const plan = layer3.planCompiledGraph(
    edge === 'co-spent' ? participants : [participants[0]],
    (edge === 'co-spent' ? invocations : [invocations[0]]) as never,
  );
  const layout = layer3.compiledGraphPhysicalLayout(plan);
  const transcript = layer3.finalizeCompiledGraph(
    plan, {}, layout.participantInputs, layout.returnOutputs,
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
          tx.addInput(setup.dataNftUtxos[nft], createDataNftUnlocker(contract, nft, setup.categoryId));
          // Neither handler writes state, so the post-state is the seeded state. Taken from the seeded UTXO
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

describe('X179: a straight-line `once` external call requires its counterparty to be co-spent', () => {
  describe.each(['forward', 'expression'] as const)('the %s-argument callsite', (shape) => {
    /** The POSITIVE this row needs: without it a refusal below would discriminate nothing. */
    it('GUARD: the honest co-spent graph settles', async () => {
      const result = await attempt(shape, 'co-spent');
      console.log(`[X179] ${shape} co-spent: ${result.sent ?? result.refusal?.split('\n')[0]} `
        + `block=${result.callerBlockSize} participants=${result.participants} `
        + `invocations=${result.invocations} emissions=${JSON.stringify(result.emissions)}`);
      expect(result.refusal, 'the honest co-spend did not settle').toBeUndefined();
      expect(result.sent).toMatch(/^[0-9a-f]{64}$/);
      expect(result.participants).toBe(2);
      expect(result.invocations).toBe(2);
      // The emission row exists and is non-empty; the row below removes exactly this.
      expect(result.emissions[0]).not.toBe('');
    }, 900_000);

    /**
     * ONE FIELD MOVES: the child invocation is not planned, so the counterparty is not co-spent and the
     * caller's emission vector is empty. Everything else - artifacts, state, staging, controller root - is
     * rebuilt identically.
     */
    it('HOSTILE: dropping the child invocation is refused at input 0, the caller master', async () => {
      const result = await attempt(shape, 'dropped');
      console.log(`[X179] ${shape} dropped: ${result.sent ?? result.refusal?.split('\n')[0]} `
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
