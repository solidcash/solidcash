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
 * THE UNANSWERED ROW. Not "the callee was removed from the plan" - "the caller's row is present and
 * authenticated, and no participant answers it".
 *
 * X179 and X187 both refused at `OP_SPLIT` on an EMPTY emission vector: the whole participant was dropped from
 * the PLAN, so the caller's own vector had no row to split. That leaves a strictly harder case unbuilt, and it
 * is the one that would re-open the same escape in a different spelling:
 *
 *     the transcript declares BOTH participants, the caller's authenticated emission vector contains the row,
 *     the caller's route consumes it - and the callee's transaction input is not the callee.
 *
 * If only the caller's covenant bound the edge, that would settle: the caller proves what it EMITTED, never
 * that anyone RECEIVED it. This file builds it and names what refuses.
 *
 * THE ARMS, one field moved each, all against the same transcript and the same input positions:
 *
 *   co-spent      the honest graph. Settles. Without it the refusals below are unreadable.
 *   substituted   the callee's participant block is spent from an unrelated P2PKH instead. Input COUNT and
 *                 every other input's position are unchanged, so no offset in the transcript moves; the block's
 *                 output is retargeted with it, because a token output has no input to carry its category.
 *
 * WHAT IS NOT VARIED. The transcript is built ONCE from the honest plan and reused byte-for-byte in both arms,
 * so the controller root, the caller's emission vector and every declared offset are identical. Only the
 * transaction differs.
 */

const CALLEE = `pragma solidcash >=0.8.0;
contract V1Callee(int brand) {
  function tick(int value) public pure { require(value > 0); }
}`;

const CALLER = `pragma solidcash >=0.8.0;
interface IV1Callee { function tick(int value); }
contract V1Caller() {
  address callee;
  int knob;
  function ping() { IV1Callee(callee).tick(knob + 1); require(true); }
}`;

const KNOB = 3n;

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));
const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);

type Arm = 'co-spent' | 'substituted';

interface Attempt {
  sent?: string;
  refusal?: string;
  failingInput?: number;
  calleeBlockInputs: readonly number[];
  projectionInputs: readonly number[];
  controllerInput: number;
  emissions: readonly string[];
}

async function attempt(arm: Arm): Promise<Attempt> {
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

  const callerArtifact: any = compileString(CALLER, options);
  const targetVariable = callerArtifact.stateLayout!.variables
    .find((variable: any) => variable.type === 'address')!.name;
  const callerBase = new Contract(callerArtifact, [], { provider });
  const callerSetup = await setupStatefulUtxos(provider, callerBase, callerArtifact.stateLayout!, {
    [targetVariable]: hexToBin(callee.lockingBytecode) as never, knob: KNOB,
  });
  const caller = callerBase.withCategory(hexToBin(callerSetup.categoryId));

  // ONE plan, ONE transcript, both arms. The callee is a full participant in both.
  const plan = layer3.planCompiledGraph(
    [
      { artifact: callerArtifact, lockingBytecode: caller.lockingBytecode },
      { artifact: calleeArtifact, lockingBytecode: callee.lockingBytecode },
    ],
    [
      { parent: null, callee: 0, function: 'ping', args: [] },
      { parent: 0, callee: 1, function: 'tick', args: [KNOB + 1n] },
    ] as never,
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
  const calleeBlockInputs: number[] = [];
  for (let index = 0; index < plan.participants.length; index += 1) {
    const artifact = index === 0 ? callerArtifact : calleeArtifact;
    const contract = index === 0 ? caller : callee;
    const setup = index === 0 ? callerSetup : calleeSetup;
    // THE ONE FIELD. The callee's block keeps its input COUNT and its positions; only what is spent there
    // changes, and its output changes with it because a token output cannot exist without its input.
    const substitute = arm === 'substituted' && index === 1;
    let dataNftCursor = 0;
    for (const slot of artifact.hiddenBatch!.route.blockLayout!.slots as any[]) {
      if (index === 1) calleeBlockInputs.push(tx.inputs.length);
      if (substitute) {
        const filler = randomUtxo({ satoshis: 2000n });
        await provider.addUtxo(p2pkh.address, filler);
        tx.addInput(filler, p2pkh.unlock.spend(alicePub, signature()));
        tx.addOutput({ to: p2pkh.address, amount: 1000n });
        dataNftCursor += 1;
        continue;
      }
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
    calleeBlockInputs,
    projectionInputs: layout.projectionInputs as readonly number[],
    controllerInput: layout.controllerInput as number,
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

describe('the unanswered emission row: a present row with no participant behind it', () => {
  it('CONTROL: the honest two-participant graph settles, and the caller emits one row', async () => {
    const honest = await attempt('co-spent');
    console.log(`[V1] honest emissions=${JSON.stringify(honest.emissions)}`);
    console.log(`[V1] callee block inputs=${JSON.stringify(honest.calleeBlockInputs)} `
      + `projections=${JSON.stringify(honest.projectionInputs)} controller=${honest.controllerInput}`);
    if (honest.refusal) console.log(`[V1] honest refused: ${honest.refusal.split('\n')[0]}`);
    expect(honest.refusal, 'the honest co-spend did not settle, so no refusal below is readable')
      .toBeUndefined();
    expect(honest.sent).toMatch(/^[0-9a-f]{64}$/);
    // The caller's emission vector is NOT empty here - which is what makes the hostile arm a different case
    // from X179/X187, where the vector was empty and OP_SPLIT refused on exhaustion.
    expect(honest.emissions[0], 'the caller emitted no row, so the subject does not exist').not.toBe('');
  }, 1_800_000);

  /**
   * MEASURED: THE PROJECTION VERIFIER CLOSES IT, AND THE CALLER DOES NOT.
   *
   * The refusal lands on a PROJECTION input, not on the caller's own route input. That is the whole reading:
   * the caller's covenant proves what it EMITTED and its own vector is intact, so input 0 is satisfied and the
   * caller alone would have let this through. What refuses is the projection verifier's participant loop -
   * `require(tx.inputs[participantInput].lockingBytecode == frame.slice(6, 6 + lbcLength))` - which pins EVERY
   * declared participant's script at its declared input index, for every projection input, not just its own.
   *
   * Two further checks stand behind it and are NOT what fired here, so they are named rather than claimed: the
   * controller's `attest` requires each participant input's unlocking bytecode to begin `0453434231` (the SCB1
   * push), and the projection verifier's `usedMask` requires every declared participant to be some
   * invocation's callee.
   */
  it('SUBJECT: the row stays, the callee input does not, and a PROJECTION input refuses', async () => {
    const hostile = await attempt('substituted');
    console.log(`[V1] substituted callee block inputs=${JSON.stringify(hostile.calleeBlockInputs)} `
      + `projections=${JSON.stringify(hostile.projectionInputs)}`);
    console.log(`[V1] refusal=${(hostile.refusal ?? 'ACCEPTED').split('\n')[0]} `
      + `at input ${hostile.failingInput}`);
    expect(hostile.sent, 'an emission row with NO participant answering it was ACCEPTED').toBeUndefined();
    expect(hostile.refusal).toMatch(/OP_VERIFY|mandatory-script-verify-flag-failed|non-truthy/);
    expect(hostile.failingInput, 'the refusal did not name an input index').toBeTypeOf('number');
    expect(hostile.projectionInputs, 'the refusal did not land on a projection input')
      .toContain(hostile.failingInput);
    expect(hostile.failingInput, 'the CALLER refused, which would make this a different finding')
      .not.toBe(0);
    expect(hostile.calleeBlockInputs, 'the refusal landed inside the substituted block itself')
      .not.toContain(hostile.failingInput);
  }, 1_800_000);
});
