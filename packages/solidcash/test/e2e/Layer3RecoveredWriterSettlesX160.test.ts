import { describe, expect, it } from 'vitest';
import { binToHex, decodeAuthenticationInstructions, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { buildInitialStateCommitments, scriptToBytecode } from '@solidcash/utils';
import { compileFile, compileString } from 'solidc';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../src/utils.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createDataNftUnlocker, getDataNftAddress } from '../../src/stateful/covenant-helpers.js';
import type { Utxo } from '../../src/interfaces.js';

/**
 * X160 CONTINUED. A RECOVERED HANDLER THAT MUTATES STATE, RUN TO COMPLETION.
 *
 * `Layer3RecoveredWriterX136.test.ts` searched the recovered population for a WRITER, found exactly one -
 * `TxOrigin.sol`'s `Attack.attack` - proved it does NOT settle because its counterparty is bus-inadmissible,
 * and said plainly what that leaves open: "the positive case has no subject in this corpus at all". That
 * sentence was true of the population as it was then measured. It is no longer true of the population.
 *
 * THE POPULATION WAS RE-TAKEN AND IT IS BIGGER. Both sides of the repair were compiled in two dedicated
 * worktrees - `c988817e` (= `a2885464^`, pre-repair) and this branch - over mistswap, EA and
 * solidity-by-example, 179 files, one probe binary copied to both sides so only the compiler differs.
 * 206 handlers gained, 0 lost, over 135 rows and 54 moved contracts. ELEVEN of the 206 are state-changing
 * under the census's own classifier (`writesState` anything but false), not one - and SEVEN of those
 * eleven publish `writesState: true` outright, the other four publishing it absent.
 *
 * `solidity-by-example/fallback/FallbackInputOutput.sol` contract `Counter` is the cleanest of the eleven and
 * is the subject here:
 *
 *   before  BUS-FAIL   Missing journal context '__internal__state_write_target' while invoking 'target'
 *   after   blockSize 3  [master, dataNft, returnEvent]   eligible get, inc, count
 *
 * `inc` is `count += 1; return count;` - one scalar write and a return value, and NO external call, so unlike
 * `Attack.attack` it needs no counterparty and nothing about it is bus-inadmissible.
 *
 * WHAT THIS FILE ESTABLISHES.
 *
 *  1. POSITIVE, and it is the answer Row B existed to get: a recovered handler that MUTATES state settles.
 *     The route co-spends its master and data NFT, recreates the data NFT with the POST state, and publishes
 *     the new count in the return-event NFT.
 *  2. THE WRITE IS REAL, read off the covenant rather than asserted. The probe run publishes the PRE state as
 *     the post state - the mistake an honest builder makes when it forgets the increment - and the route's own
 *     trace hands back the commitment IT computed. That commitment is the encoding of `count = 42`, and it
 *     is NOT the encoding of `count = 41`. Nothing here computed a post state and then agreed with itself.
 *  3. HOSTILE. The post state left at the pre-state value is refused, at a pinned input index.
 *  4. HOSTILE. The post state moved to a believable neighbour (`count = 43`, the same length and encoding)
 *     is refused, at a pinned input index.
 *  5. HOSTILE. A return event carrying a believable-wrong result is refused, at a pinned input index.
 *  6. GUARD NEGATIVE CONTROL. Every hostile differs from a settling positive in exactly ONE field, that
 *     positive is rebuilt by the same helper in the same file, and the read-only siblings `get` and `count`
 *     settle through the identical staging - so a refusal discriminates the attacked field, and an acceptance
 *     is not an evaluation that never ran.
 *
 * WHAT IS NOT ESTABLISHED, and it is most of the population.
 *
 *  - THREE of the 206 gained handlers are run here - `inc`, `get`, `count`, all on `Counter`. This file
 *    does not speak for the other 203.
 *  - ONE of the ELEVEN gained writers. `Attack.attack` remains proved NOT to settle - fail-closed, a
 *    published-but-dead admission - WHICH X177 FALSIFIED: that refusal was the harness's return-event
 *    staging, and with the slot corrected `attack` settles. The other nine remain unproven either way.
 *  - `Counter` writes ONE uint256 scalar into one data NFT. A recovered writer over a mapping, a sorted
 *    collection, a dynamic string or several data NFTs is a different covenant and is not evidence here.
 */

const FALLBACK_IO = `${process.env.SBE_ROOT ?? '/Code/solidity-by-example'}`
  + '/contracts/src/fallback/FallbackInputOutput.sol';

/**
 * THE PRE-REPAIR SIDE IS A RECORD, NOT A RECOMPILE, and is stamped so it can never be read as a measurement
 * this run took: one process cannot host two compilers. The post-repair side below is recompiled by the test.
 */
const PRE_REPAIR_COMMIT = 'c988817e';
const PRE_REPAIR_BUS_ERROR = "Missing journal context '__internal__state_write_target' while invoking 'target'";

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));

const BUS = {
  solidityImportCompat: true,
  ecrecover: 'p2pkh',
  forceStateful: true,
  hiddenBatch: true,
};

/** A distinctive placeholder result: the probe declares it, so the trace's OTHER operand is the real one. */
const PROBE_RESULT = hexToBin('9e'.repeat(32));

/** `count` starts here, so the covenant's own post state must be the encoding of PRE_COUNT + 1. */
const PRE_COUNT = 41n;
const POST_COUNT = 42n;

/**
 * The value the ROUTE ITSELF computed, read off its own execution.
 *
 * The route puts what it computed next to what the transaction carries; this finds the last step where those
 * two are the top two stack items - identified by the declared value being one of them - and returns the
 * OTHER one. So every byte this file commits to is a byte the covenant produced, and a harness that guessed
 * the encoding wrong could not accidentally agree with it.
 *
 * It reports ADJACENCY, not the opcode. For the result that is unambiguous: `PROBE_RESULT` is a value the
 * covenant cannot derive, so the only way it lands beside the computed one is the route's own check. For the
 * post state the declared value is the PRE state, which the route legitimately handles while computing - so
 * the caller cross-checks the answer against what `count + 1` encodes to, which is the assertion that makes
 * the extraction meaningful rather than the extraction itself.
 */
function operandComparedAgainst(trace: unknown[], placeholder: Uint8Array, what: string): Uint8Array {
  const wanted = binToHex(placeholder);
  let found: Uint8Array | undefined;
  for (const state of trace) {
    const step = state as { stack?: Uint8Array[]; controlStack?: unknown[] };
    if (step.controlStack?.some((entry) => entry === false)) continue;
    const stack = step.stack;
    if (!stack || stack.length < 2) continue;
    const top = stack[stack.length - 1];
    const below = stack[stack.length - 2];
    if (binToHex(top) === wanted && binToHex(below) !== wanted) found = Uint8Array.from(below);
    else if (binToHex(below) === wanted && binToHex(top) !== wanted) found = Uint8Array.from(top);
  }
  if (found === undefined) throw new Error(`${what}: the probe trace never compared the declared value`);
  return found;
}

/** What one built attempt differs in. Exactly one field moves per hostile. */
type Attack = 'none' | 'result' | 'state-unwritten' | 'state-neighbour';

describe('X160: the recovered population has a WRITER that settles', () => {
  /**
   * THE PARTITION TEST, and it is the reason this subject is admissible evidence at all: it states that
   * `Counter` is a handler set the repair ADDED and that `inc` is published state-changing, from this run's
   * own compile. The pre-repair side is quoted as a stamped record and labelled as one.
   */
  it('MEASURED: the recovered route admits `inc`, and `inc` is published writesState TRUE', () => {
    // The subject is a SIBLING declaration in the file, so the multi-contract map is what is read.
    const counter = compileFile(FALLBACK_IO, {
      ...BUS,
      messageBusController: `aa20${'11'.repeat(32)}87`,
      messageBusControllerCategory: '22'.repeat(32),
      primaryContractName: 'Counter',
    } as never) as any;
    const handlers = counter.hiddenBatch!.handlers as any[];
    const eligible = handlers.filter((handler) => handler.eligible).map((handler) => handler.name);
    console.log(`[X160W] pre-repair (${PRE_REPAIR_COMMIT}, RECORDED): BUS-FAIL ${PRE_REPAIR_BUS_ERROR}`);
    console.log(`[X160W] eligible ${JSON.stringify(eligible)}`);
    expect(eligible).toEqual(['get', 'inc', 'count']);
    const abiOf = (name: string): any => counter.abi.find((entry: any) => entry.name === name);
    expect(abiOf('inc').writesState).toBe(true);
    expect(abiOf('get').writesState).toBe(false);
    expect(abiOf('count').writesState).toBe(false);
    const layout = counter.hiddenBatch!.route.blockLayout!;
    console.log(`[X160W] route blockSize=${layout.blockSize} `
      + `slots=${JSON.stringify(layout.slots.map((slot: any) => slot.kind))}`);
    expect(layout.blockSize).toBe(3);
    expect(layout.slots.map((slot: any) => slot.kind)).toEqual(['master', 'dataNft', 'returnEvent']);
    // No counterparty and no unbound entry key: this is why `inc` has a positive case where `attack` has none.
    expect(abiOf('inc').inputs.map((input: any) => input.name)).toEqual(['__internal__returnOutputIdx']);
    expect(counter.hiddenBatch!.route.entryAccesses).toBeUndefined();
    expect(counter.stateLayout.dataNftCount).toBe(1);
  }, 900_000);

  /**
   * One attempt at the recovered route.
   *
   * `declaredResult` undefined selects the PROBE run: it is traced under the VM debugger and never broadcast.
   * `postState` undefined publishes the PRE state, which is both the state probe and the `state-unwritten`
   * hostile - the same bytes, differing only in whether the attempt is traced or sent.
   */
  async function attempt(handler: 'inc' | 'get' | 'count', attack: Attack, options: {
    declaredResult?: Uint8Array; postCount?: bigint;
  }): Promise<{
      sent?: string; refusal?: string; failingInput?: number; trace?: unknown[];
      preCommitments: string[]; publishedState: string[];
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
    const artifact = compileFile(FALLBACK_IO, {
      ...BUS,
      messageBusController: controller.lockingBytecode,
      messageBusControllerCategory: controllerCategory,
      primaryContractName: 'Counter',
    } as never) as any;
    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, { count: PRE_COUNT });
    const participant = base.withCategory(hexToBin(setup.categoryId));

    const preCommitments = buildInitialStateCommitments(artifact.stateLayout!, { count: PRE_COUNT });
    const publishedState = options.postCount === undefined
      ? preCommitments
      : buildInitialStateCommitments(artifact.stateLayout!, { count: options.postCount });

    // A BELIEVABLE WRONG RESULT: the same bytes with one bit moved, not a random blob.
    const forge = (value: Uint8Array): Uint8Array => {
      const wrong = Uint8Array.from(value);
      if (wrong.length === 0) return Uint8Array.from([0x01]);
      wrong[wrong.length - 1] ^= 0x01;
      return wrong;
    };
    // The transcript declares the VECTOR inside the commitment, so the two are one push apart. The payload is
    // DECODED with libauth rather than re-encoded here, and the honest run asserts that re-wrapping the
    // decoded vector reproduces the covenant's own bytes exactly, so no encoding is ever guessed.
    const innerVector = options.declaredResult === undefined ? PROBE_RESULT : (() => {
      const [instruction, ...rest] = decodeAuthenticationInstructions(options.declaredResult!);
      const data = (instruction as { data?: Uint8Array }).data;
      if (data === undefined || rest.length !== 0) {
        throw new Error("the route's return commitment is not a single push");
      }
      return data;
    })();
    const publishedVector = attack === 'result' ? forge(innerVector) : innerVector;
    const publishedCommitment = options.declaredResult === undefined
      ? PROBE_RESULT : scriptToBytecode([publishedVector]);
    if (options.declaredResult !== undefined && attack !== 'result') {
      expect(binToHex(publishedCommitment), 're-wrapping the decoded vector did not reproduce the commitment '
        + 'the route computed').toBe(binToHex(options.declaredResult));
    }

    const plan = layer3.planCompiledGraph(
      [{ artifact, lockingBytecode: participant.lockingBytecode }],
      [{ parent: null, callee: 0, function: handler, args: [] as never[] }],
    );
    const physical = layer3.compiledGraphPhysicalLayout(plan);
    const transcript = layer3.finalizeCompiledGraph(
      plan, { 0: binToHex(publishedVector) }, physical.participantInputs, physical.returnOutputs,
      [binToHex(publishedVector)], physical.projectionInputs, '',
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

    const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
    let dataNftCursor = 0;
    for (const slot of artifact.hiddenBatch!.route.blockLayout!.slots as any[]) {
      switch (slot.kind) {
        case 'master':
          tx.addInput(setup.masterUtxo, participant.createCompilerRouteUnlocker(
            artifact.hiddenBatch!.route, hexToBin(artifact.hiddenBatch!.selector),
          )(
            ...layer3.compiledGraphRouteArgs(transcript, 0, physical.controllerInput) as never[],
            BigInt(physical.returnOutputs![0]!),
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
          // X180: the second argument is the MASTER's input index, not the data NFT's slot. The covenant's
          // write path requires a minting NFT at that index and the master sits at block slot 0. Passing the
          // slot index refuses every route with two or more data NFTs at input 2 - the reading this file's
          // BLOCKED rows recorded and attributed to a block oracle.
          tx.addInput(setup.dataNftUtxos[index], createDataNftUnlocker(participant, 0, setup.categoryId));
          tx.addOutput({
            to: getDataNftAddress(participant, setup.categoryId),
            amount: setup.dataNftUtxos[index].satoshis,
            token: {
              category: setup.categoryId,
              amount: 0n,
              nft: { capability: 'mutable', commitment: publishedState[index] },
            },
          });
          break;
        }
        case 'returnEvent':
          tx.addInput(returnFunding, p2pkh.unlock.spend(alicePub, signature()));
          tx.addOutput({
            to: hexToBin('51'),
            amount: 1000n,
            token: {
              category: setup.categoryId,
              amount: 0n,
              nft: { capability: 'none', commitment: binToHex(publishedCommitment) },
            },
          });
          break;
        default:
          throw new Error(`this harness does not stage a '${slot.kind}' slot`);
      }
    }
    tx.addInput(projectionUtxo, projection.unlock.verify(
      transcript.bytes, BigInt(physical.controllerInput), 0n,
    ));
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
    tx.addInput(rootedController!, controller.unlock.attest(transcript.bytes));
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
    tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
    tx.addOutput({ to: p2pkh.address, amount: 150_000n });

    if (options.declaredResult === undefined) {
      const vm = createVirtualMachineBch2026ForProvider(provider);
      const trace = vm.debug({
        inputIndex: 0,
        sourceOutputs: generateLibauthSourceOutputs(tx.inputs as never),
        transaction: tx.buildLibauthTransaction(),
      }) as unknown[];
      return { trace, preCommitments, publishedState };
    }
    try {
      return { sent: await provider.sendRawTransaction(raw(tx)), preCommitments, publishedState };
    } catch (error) {
      const refusal = (error as Error).message;
      const index = refusal.match(/input index (\d+)/);
      return {
        refusal, failingInput: index ? Number(index[1]) : undefined, preCommitments, publishedState,
      };
    }
  }

  /**
   * THE POST STATE, TAKEN OFF THE COVENANT. The probe publishes the PRE state as the post state - what an
   * honest builder produces when it forgets the increment - so the route's own comparison puts its computed
   * commitment next to it on the stack, and that is the value read here. Cached: the trace is deterministic
   * and the run is expensive.
   */
  let cachedPostState: Uint8Array | undefined;
  async function postStateFromCovenant(): Promise<Uint8Array> {
    if (cachedPostState === undefined) {
      const probe = await attempt('inc', 'none', {});
      cachedPostState = operandComparedAgainst(
        probe.trace!, hexToBin(probe.preCommitments[0]), 'post state',
      );
      console.log(`[X160W] pre state  ${probe.preCommitments[0]}`);
      console.log(`[X160W] post state off the route's own trace: ${binToHex(cachedPostState)}`);
    }
    return cachedPostState;
  }

  /** The declared result the route computes for one handler, read off its own trace with the post state set. */
  const cachedResult = new Map<string, Uint8Array>();
  async function routeResult(handler: 'inc' | 'get' | 'count'): Promise<Uint8Array> {
    if (!cachedResult.has(handler)) {
      const postCount = handler === 'inc' ? POST_COUNT : undefined;
      const probe = await attempt(handler, 'none', { postCount });
      const found = operandComparedAgainst(probe.trace!, PROBE_RESULT, `${handler} result`);
      cachedResult.set(handler, found);
      console.log(`[X160W] ${handler} result off its own trace: ${binToHex(found)}`);
    }
    return cachedResult.get(handler)!;
  }

  /**
   * THE WRITE IS REAL, AND THE COVENANT SAID SO. The commitment the route computed for its own data NFT is
   * the encoding of `count = 42` and is NOT the encoding of `count = 41`. This file never encoded a post
   * state and then agreed with itself: the bytes come off the trace, and `buildInitialStateCommitments` is
   * used afterwards only to say WHICH count they are.
   */
  it('MEASURED: the covenant computes a post state that is count+1, not the pre state', async () => {
    const counter = compileFile(FALLBACK_IO, {
      ...BUS,
      messageBusController: `aa20${'11'.repeat(32)}87`,
      messageBusControllerCategory: '22'.repeat(32),
      primaryContractName: 'Counter',
    } as never) as any;
    const layout = counter.stateLayout!;
    const computed = binToHex(await postStateFromCovenant());
    const written = buildInitialStateCommitments(layout, { count: POST_COUNT })[0];
    const unwritten = buildInitialStateCommitments(layout, { count: PRE_COUNT })[0];
    console.log(`[X160W] computed=${computed} count+1=${written} count=${unwritten}`);
    expect(computed).toBe(written);
    expect(computed).not.toBe(unwritten);
  }, 900_000);

  /**
   * THE POSITIVE, and the answer to the row. Built by the same helper that builds every hostile below, with
   * the post state read off the covenant and the result read off the covenant.
   */
  it('MEASURED: the recovered WRITER `Counter.inc` SETTLES', async () => {
    const result = await attempt('inc', 'none', {
      declaredResult: await routeResult('inc'), postCount: POST_COUNT,
    });
    if (result.refusal) console.log(`[X160W] inc refused: ${result.refusal.split('\n')[0]}`);
    expect(result.refusal, 'the recovered writer did not settle').toBeUndefined();
    expect(result.sent).toMatch(/^[0-9a-f]{64}$/);
    console.log(`[X160W] inc settled ${result.sent}`);
  }, 900_000);

  /**
   * GUARD NEGATIVE CONTROL, and the discriminator. The two read-only siblings settle through the IDENTICAL
   * staging, so a refusal below is a refusal of the attacked field and not of a harness that never worked -
   * and the writer's acceptance is not a property of `Counter` being easy, since these prove the staging is
   * sound for the non-writing rows too.
   */
  const guard = (handler: 'get' | 'count') => async (): Promise<void> => {
    const result = await attempt(handler, 'none', { declaredResult: await routeResult(handler) });
    if (result.refusal) console.log(`[X160W] ${handler} refused: ${result.refusal.split('\n')[0]}`);
    expect(result.refusal, `${handler} did not settle`).toBeUndefined();
    expect(result.sent).toMatch(/^[0-9a-f]{64}$/);
    console.log(`[X160W] ${handler} settled ${result.sent}`);
  };
  for (const handler of ['get', 'count'] as const) {
    it(`GUARD: the read-only sibling '${handler}' settles through the same staging`, guard(handler), 900_000);
  }

  /**
   * HOSTILES. Each differs from the settling positive in exactly ONE field, matched on the refusal text and
   * pinned to the input index that produced it. `state-unwritten` is the mistake an honest builder makes;
   * `state-neighbour` is the one an attacker makes; `result` leaves the state correct and lies about what was
   * returned.
   */
  const HOSTILES: Array<[Attack, string, bigint | undefined]> = [
    ['state-unwritten', 'the post state left at the PRE value - the increment simply not applied', undefined],
    ['state-neighbour', 'the post state moved one past the truth (count = 43)', POST_COUNT + 1n],
    ['result', 'the return event carrying a believable-wrong result', POST_COUNT],
  ];
  const hostile = (attack: Attack, postCount: bigint | undefined) => async (): Promise<void> => {
    const result = await attempt('inc', attack, { declaredResult: await routeResult('inc'), postCount });
    console.log(`[X160W] ${attack}: ${(result.refusal ?? 'ACCEPTED').split('\n')[0]}`);
    console.log(`[X160W] ${attack} published state ${JSON.stringify(result.publishedState)}`);
    expect(result.sent, `a forged ${attack} was ACCEPTED`).toBeUndefined();
    expect(result.refusal).toBeDefined();
    expect(result.refusal).toMatch(/OP_VERIFY|mandatory-script-verify-flag-failed|non-truthy/);
    expect(result.failingInput, 'the refusal did not name the participant input').toBe(0);
  };
  for (const [attack, description, postCount] of HOSTILES) {
    it(`HOSTILE: ${description} is refused`, hostile(attack, postCount), 900_000);
  }
});
