import { describe, expect, it } from 'vitest';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { buildInitialStateCommitments, scriptToBytecode } from '@solidcash/utils';
import { compileFile, compileFileMulti, compileString } from 'solidc';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createDataNftUnlocker, getDataNftAddress } from '../../src/stateful/covenant-helpers.js';
import type { Utxo } from '../../src/interfaces.js';

/**
 * X177. THE `Attack.attack` NEGATIVE IS A HARNESS ARTIFACT, AND THE HANDLER SETTLES.
 *
 * The board carries `Attack.attack` - `TxOrigin.sol`'s recovered writer - as "proved NOT to settle,
 * fail-closed, its counterparty bus-inadmissible", from `Layer3RecoveredWriterX136.test.ts`. That file is
 * careful in every other respect: it names the compiler gate that refuses `Wallet`, it moves exactly one
 * field per hostile, and it settles the contract's read-only siblings through the same helper as a guard.
 *
 * THE GUARD DOES NOT COVER THE FIELD THAT MATTERS. `attack` is VOID and its siblings `owner` and `wallet`
 * RETURN, and that harness branches on exactly that:
 *
 *   const returns = handler !== 'attack';
 *   tx.addOutput(returns ? { ...return-event NFT... } : { to: p2pkh.address, amount: 1000n });
 *
 * So the `attack` row is the only row in the file that puts a PLAIN output in the block's return-event slot,
 * and no row controls for it. The route checks that slot's commitment against the result vector it computed;
 * for a void handler that vector is EMPTY, so the slot must carry an NFT whose commitment is the empty
 * vector's single push. A plain output is refused - at input 0, with OP_VERIFY, which is exactly the refusal
 * the file records and attributes to the counterparty.
 *
 * WHAT THIS FILE MEASURES.
 *
 *  1. THE REFUSAL IS REPRODUCED. `attack` with a PLAIN return-event output is refused at input 0.
 *  2. THE REFUSAL IS NOT ABOUT `attack`. `Lib.doSomething` - a recovered void writer with NO external call,
 *     NO counterparty and NO msg.sender - is refused identically, at input 0, when its return-event slot is
 *     staged the same way. Same substitution, same refusal, different contract.
 *  3. `attack` SETTLES. With the return-event slot carrying the empty result vector and nothing else changed,
 *     the transaction is accepted and broadcast.
 *  4. THE COVENANT IS STILL LIVE ON THE SETTLING RUN. The same transaction with ONE persisted field moved to
 *     a believable neighbour is refused at input 0. So the acceptance is not an evaluation that never ran.
 *  5. AND THE COUNTERPARTY IS STILL INADMISSIBLE. `Wallet` is still refused from the bus by the same named
 *     compiler gate, re-measured here and not quoted.
 *
 * SO WHAT IS THE STANDING OF `Attack.attack`?
 *
 * `attack`'s whole body is `wallet.transfer(owner, address(wallet).balance)`. The settling transaction
 * co-spends ONE participant, plans ONE invocation, and declares no emission and no caller - so the external
 * call is admitted into the route and then not performed, and the only contract it could have called cannot
 * be a participant. The bus ACCEPTS a transaction asserting that `attack()` executed while the call it
 * consists of did not happen. That is the X115 published-but-dead admission shape with the "dead" removed.
 *
 * X179 ANSWERED THE QUESTION THIS FILE LEFT OPEN, AND THE ANSWER IS THAT DROPPING IS NOT AN OUTCOME.
 * `Layer3DroppedEdgeX179.test.ts` builds an INTERFACE-CAST caller with an admissible counterparty: the
 * co-spent graph settles, and removing only the child invocation is refused at the caller's own master input
 * with the emission vector exhausted. `Layer3OccurrenceExhaustion.test.ts` and C2's `omits the return edge`
 * row record the same signature. So the caller covenant DOES require the co-spend, and what this file
 * measures is `Attack.attack` ESCAPING that requirement - not the requirement's intended shape.
 *
 * AND THE ESCAPE IS NOT ABOUT `Wallet`. The same X179 file reproduces it on a clean pair whose counterparty
 * the bus ADMITS, from the same source shape as `attack`: a method call on a CONTRACT-TYPED state variable
 * (`X179SolBar bar; ... bar.log();`). It settles with an empty emission vector, with its own honest co-spend
 * settling in the same harness. Adding a trailing `require(true)` does not change it, so the receiver
 * spelling is the variable that survives - stated as the shape that reproduces, not as a mechanism.
 *
 * TWO CONSEQUENCES FOR THIS FILE.
 *
 *  - `planCompiledGraph` now REFUSES the one-participant plan by name (`assertHandlerRowFloor`), so the rows
 *    below reach the VM through `bypass`: the artifact copy the PLANNER reads has the published callsite
 *    stripped, while the contract, its locking bytecode, its compiled route and its batch blob are the real
 *    ones. That is what an untrusted composer does, and it weakens nothing here - the covenant under test is
 *    unchanged, and the CONTROL has no callsite to strip so it is not touched at all.
 *  - The settlement is therefore still real, and it is the finding: for THIS handler shape the caller's route
 *    does not bind its own outgoing edge, so the SDK refusal is the only thing in the way. Closing it is
 *    compiler-side.
 *
 * WHAT THIS FILE DOES NOT CLAIM. It does not show value or authority moving. Nothing here demonstrates a
 * theft primitive. What it does establish is narrower and it is enough to matter: the recorded NEGATIVE is
 * not a covenant property, and the row's arithmetic - "one proved NOT to settle" - does not hold.
 */

const SBE = `${process.env.SBE_ROOT ?? '/Code/solidity-by-example'}/contracts/src`;
const TX_ORIGIN = `${SBE}/hacks/phishing-with-tx-origin/TxOrigin.sol`;
const DELEGATECALL_2 = `${SBE}/hacks/delegatecall/Delegatecall_2.sol`;

const OWNER = `aa20${'66'.repeat(32)}87`;
const WALLET = `aa20${'55'.repeat(32)}87`;

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));

const BUS = {
  solidityImportCompat: true,
  ecrecover: 'p2pkh',
  forceStateful: true,
  experimentalHiddenBatch: true,
};

/** The return-event slot staging under test. Exactly one field moves between the two. */
type ReturnSlot = 'plain' | 'empty-vector-nft';

interface Subject {
  label: string;
  file: string;
  contract: string;
  handler: string;
  args: readonly unknown[];
  state: Record<string, unknown>;
  /** ONE persisted field moved to a believable neighbour, for the liveness control. */
  tamper: Record<string, unknown>;
}

const ATTACK: Subject = {
  label: 'TxOrigin.Attack.attack',
  file: TX_ORIGIN,
  contract: 'Attack',
  handler: 'attack',
  args: [],
  state: { owner: hexToBin(OWNER), wallet: hexToBin(WALLET) },
  tamper: { owner: hexToBin(`aa20${'66'.repeat(31)}6787`) },
};

/** The CONTROL. A void recovered writer with no external call at all, so the substitution is the only thing. */
const CONTROL: Subject = {
  label: 'Delegatecall_2.Lib.doSomething',
  file: DELEGATECALL_2,
  contract: 'Lib',
  handler: 'doSomething',
  args: [777n],
  state: { someNumber: 41n },
  tamper: { someNumber: 42n },
};

/**
 * `TxOrigin.sol` cannot be compiled with `compileFileMulti` in bus mode at all - its sibling `Wallet` is the
 * refused contract - so the subject is taken from the single-contract compile, exactly as
 * `Layer3RecoveredWriterX136.test.ts` takes it. That refusal is re-measured on its own below.
 */
function compileSubject(subject: Subject, controllerLbc: never, controllerCategory: string): any {
  const options = {
    ...BUS,
    experimentalMessageBusController: controllerLbc,
    experimentalMessageBusControllerCategory: controllerCategory,
  } as never;
  try {
    const map = compileFileMulti(subject.file, options) as any;
    if (map[subject.contract]) return map[subject.contract];
  } catch {
    // fall through to the single-contract compile
  }
  const artifact = compileFile(subject.file, options) as any;
  if (artifact.contractName !== subject.contract) {
    throw new Error(`${subject.label}: the single-contract compile is '${artifact.contractName}'`);
  }
  return artifact;
}

describe('X177: the recorded `Attack.attack` negative is a return-event staging artifact', () => {
  /**
   * One attempt. `slot` selects how the block's return-event slot is filled and is the ONLY thing that moves
   * between the two runs of the same subject; `post` is the data NFT commitment set, defaulting to the state
   * the covenant should compute.
   */
  async function attempt(subject: Subject, slot: ReturnSlot, post?: Record<string, unknown>, plan?: {
    bypass?: boolean;
  }): Promise<{
      sent?: string; refusal?: string; failingInput?: number; participants: number; invocations: number;
      emissions: readonly string[]; callers: readonly string[];
    }> {
    const provider = createLayer3SemanticTestProvider();
    const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);
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
    const artifact = compileSubject(subject, controller.lockingBytecode as never, controllerCategory);
    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, subject.state);
    const participant = base.withCategory(hexToBin(setup.categoryId));

    // X179 BYPASS. `assertHandlerRowFloor` refuses a plan that drops a published callsite's row, which is what
    // a one-participant `attack` plan is. Only the ABI copy the PLANNER reads is stripped; the participant,
    // its locking bytecode and the batch blob below all come from the real artifact, so the covenant under
    // test is byte-identical. The CONTROL publishes no callsite, so this is a no-op for it.
    const planned = plan?.bypass !== true ? artifact : {
      ...artifact,
      abi: artifact.abi.map((entry: any) => (entry.name === subject.handler
        ? { ...entry, externalCalls: undefined } : entry)),
    };
    const compiledPlan = layer3.planCompiledGraph(
      [{ artifact: planned, lockingBytecode: participant.lockingBytecode }],
      [{ parent: null, callee: 0, function: subject.handler, args: subject.args as never[] }],
    );
    const layout = layer3.compiledGraphPhysicalLayout(compiledPlan);
    // VOID: no result, no return output, no result vector. That is what `finalizeCompiledGraph` demands and
    // it is not in question here - what is in question is what the OUTPUT in that slot has to look like.
    const transcript = layer3.finalizeCompiledGraph(
      compiledPlan, {}, layout.participantInputs, [null], [''], layout.projectionInputs, '',
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
    const rootedController: Utxo | undefined = (await provider.getUtxos(controller.tokenAddress))
      .find((utxo: any) => utxo.token?.nft?.commitment === transcript.root);
    expect(rootedController, 'controller initialization did not root the authority').toBeDefined();

    const returnFunding = randomUtxo({ satoshis: 1000n });
    const projectionUtxo = randomUtxo({ satoshis: 1000n });
    const fee = randomUtxo({ satoshis: 200_000n });
    await provider.addUtxo(projection.address, projectionUtxo);
    for (const utxo of [returnFunding, fee]) await provider.addUtxo(p2pkh.address, utxo);

    const commitments = buildInitialStateCommitments(
      artifact.stateLayout!, { ...subject.state, ...(post ?? {}) },
    );

    const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
    let dataNftCursor = 0;
    for (const blockSlot of artifact.hiddenBatch!.route.blockLayout!.slots as any[]) {
      switch (blockSlot.kind) {
        case 'master':
          tx.addInput(setup.masterUtxo, participant.createCompilerRouteUnlocker(
            artifact.hiddenBatch!.route, hexToBin(artifact.hiddenBatch!.selector),
          )(
            ...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as never[],
            BigInt(layout.returnOutputs![0]!),
          ));
          tx.addOutput({
            to: participant.tokenAddress,
            amount: setup.masterUtxo.satoshis,
            token: { category: setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
          });
          break;
        case 'dataNft': {
          const index = dataNftCursor;
          dataNftCursor += 1;
          tx.addInput(setup.dataNftUtxos[index], createDataNftUnlocker(participant, index, setup.categoryId));
          tx.addOutput({
            to: getDataNftAddress(participant, setup.categoryId),
            amount: setup.dataNftUtxos[index].satoshis,
            token: {
              category: setup.categoryId,
              amount: 0n,
              nft: { capability: 'mutable', commitment: commitments[index] },
            },
          });
          break;
        }
        case 'returnEvent':
          tx.addInput(returnFunding, p2pkh.unlock.spend(alicePub, signature()));
          tx.addOutput(slot === 'plain' ? { to: p2pkh.address, amount: 1000n } : {
            to: hexToBin('51'),
            amount: 1000n,
            token: {
              category: setup.categoryId,
              amount: 0n,
              nft: {
                capability: 'none',
                commitment: binToHex(scriptToBytecode([new Uint8Array(0)])),
              },
            },
          });
          break;
        default:
          throw new Error(`${subject.label}: this harness does not stage a '${blockSlot.kind}' slot`);
      }
    }
    tx.addInput(projectionUtxo, projection.unlock.verify(
      transcript.bytes, BigInt(layout.controllerInput), 0n,
    ));
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
    tx.addInput(rootedController!, controller.unlock.attest(transcript.bytes));
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
    tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
    tx.addOutput({ to: p2pkh.address, amount: 150_000n });

    const shape = {
      participants: compiledPlan.participants.length,
      invocations: compiledPlan.invocations.length,
      emissions: (transcript as any).participantEmissionsHex as readonly string[],
      callers: (transcript as any).participantCallersHex as readonly string[],
    };
    try {
      return { sent: await provider.sendRawTransaction(raw(tx)), ...shape };
    } catch (error) {
      const refusal = (error as Error).message;
      const index = refusal.match(/input index (\d+)/);
      return { refusal, failingInput: index ? Number(index[1]) : undefined, ...shape };
    }
  }

  /**
   * THE REFUSAL, REPRODUCED - and reproduced on a subject with no external call, which is what makes it a
   * property of the staging rather than of `attack`.
   */
  const plainIsRefused = (subject: Subject) => async (): Promise<void> => {
    const result = await attempt(subject, 'plain', undefined, { bypass: true });
    console.log(`[X177V] ${subject.label} plain: ${(result.refusal ?? `ACCEPTED ${result.sent}`)
      .split('\n')[0]} input=${result.failingInput}`);
    expect(result.sent, `${subject.label} settled with a plain return-event output`).toBeUndefined();
    expect(result.refusal).toMatch(/OP_VERIFY|mandatory-script-verify-flag-failed|non-truthy/);
    expect(result.failingInput, 'the refusal did not name the participant input').toBe(0);
  };

  it('MEASURED: `Attack.attack` with a PLAIN return-event output is refused at input 0 - the recorded result',
    plainIsRefused(ATTACK), 900_000);
  it('CONTROL: a void writer with NO external call is refused identically with a PLAIN output',
    plainIsRefused(CONTROL), 900_000);

  /**
   * X179. THE SDK NOW REFUSES THE PLAN, BY NAME, before any of this reaches a VM. `attack` publishes one
   * unconditional `once` callsite and the plan answers it with no row, which is the count
   * `deriveCompiledGraphPlan` cannot produce and `occurrenceBoundOf` already publishes a floor for.
   */
  it('X179: the one-participant `Attack.attack` plan is refused by name at plan time', async () => {
    let refusal: string | undefined;
    try {
      await attempt(ATTACK, 'empty-vector-nft');
    } catch (error) {
      refusal = (error as Error).message;
    }
    console.log(`[X177V] attack plan: ${refusal ?? 'ADMITTED'}`);
    expect(refusal, '`Attack.attack` was still planned with its edge dropped').toBeDefined();
    expect(refusal).toContain('layer3: callsite 0 was planned with 0 occurrences, below the 1 proven');
  }, 900_000);

  /**
   * THE FLIP. One field moves - the return-event slot - and the recorded negative becomes a settlement. Built
   * through the X179 bypass, so what it measures is the covenant and not the SDK refusal above.
   */
  it('MEASURED: `Attack.attack` SETTLES once its void return-event slot carries the empty result vector',
    async () => {
      const result = await attempt(ATTACK, 'empty-vector-nft', undefined, { bypass: true });
      console.log(`[X177V] attack empty-vector-nft: ${result.sent ?? result.refusal?.split('\n')[0]}`);
      console.log(`[X177V] attack graph: participants=${result.participants} `
        + `invocations=${result.invocations} emissions=${JSON.stringify(result.emissions)} `
        + `callers=${JSON.stringify(result.callers)}`);
      expect(result.refusal, '`Attack.attack` did not settle').toBeUndefined();
      expect(result.sent).toMatch(/^[0-9a-f]{64}$/);
      // The whole body of `attack` is one external call, and the settling transaction carries no counterparty
      // and declares no emission. Measured off the plan and the transcript, not asserted.
      expect(result.participants).toBe(1);
      expect(result.invocations).toBe(1);
      expect(result.emissions).toEqual(['']);
    }, 900_000);

  /**
   * LIVENESS CONTROL. The settling transaction with ONE persisted field moved is refused at input 0, so the
   * acceptance above is a covenant that ran and agreed, not a covenant that was never reached.
   */
  it('GUARD: the settling `Attack.attack` with one persisted field moved is refused at input 0', async () => {
    const result = await attempt(ATTACK, 'empty-vector-nft', ATTACK.tamper, { bypass: true });
    console.log(`[X177V] attack tampered: ${(result.refusal ?? `ACCEPTED ${result.sent}`).split('\n')[0]} `
      + `input=${result.failingInput}`);
    expect(result.sent, 'a moved persisted field was ACCEPTED').toBeUndefined();
    expect(result.refusal).toMatch(/OP_VERIFY|mandatory-script-verify-flag-failed|non-truthy/);
    expect(result.failingInput).toBe(0);
  }, 900_000);

  /**
   * AND THE COUNTERPARTY IS STILL INADMISSIBLE, re-measured rather than quoted. `Wallet` cannot be a bus
   * participant, so the external call `attack` consists of has no constructible co-spend - which is what
   * makes the settlement above an acceptance of a call that cannot have happened.
   */
  it('MEASURED: the counterparty `Wallet` is still refused from the bus by a named gate', () => {
    let refusal: Error | undefined;
    try {
      compileFileMulti(TX_ORIGIN, {
        ...BUS,
        experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
        experimentalMessageBusControllerCategory: '22'.repeat(32),
      } as never);
    } catch (error) {
      refusal = error as Error;
    }
    expect(refusal, 'Wallet compiled in bus mode').toBeDefined();
    console.log(`[X177V] Wallet refusal: ${refusal!.name}: ${refusal!.message.split(' at Line')[0]}`);
    expect(refusal!.name).toBe('LowLevelCallShapeError');
    expect(refusal!.message).toContain("function 'transfer' issues a low-level 'call'");
  }, 300_000);

  /** `attack` is still a published writer, so what settles above is a state-changing recovered handler. */
  it('MEASURED: `attack` is still published writesState TRUE and still admitted by the route', () => {
    const artifact = compileFile(TX_ORIGIN, {
      ...BUS,
      experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
      experimentalMessageBusControllerCategory: '22'.repeat(32),
    } as never) as any;
    const eligible = (artifact.hiddenBatch!.handlers as any[])
      .filter((handler) => handler.eligible).map((handler) => handler.name);
    console.log(`[X177V] eligible ${JSON.stringify(eligible)}`);
    expect(eligible).toEqual(['attack', 'owner', 'wallet']);
    expect(artifact.abi.find((entry: any) => entry.name === 'attack').writesState).toBe(true);
  }, 300_000);
});
