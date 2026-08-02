import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeAuthenticationInstructions, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { buildInitialStateCommitments, scriptToBytecode } from '@solidcash/utils';
import { compileFileMulti, compileString } from 'solidc';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../src/utils.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';
import { aliceAddress, alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import {
  createDataNftUnlocker, getDataNftAddress,
} from '../../src/stateful/covenant-helpers.js';
import type { Utxo } from '../../src/interfaces.js';
import { addRouteEntrySlot, stageEmptyRouteEntries } from './layer3-route-entry-fixture.js';

/**
 * X192. WHERE `EnglishAuction`'s ROUTE ABORTS, MAPPED BACK TO ITS `require` - AND IT IS THE SDK's BLOB HEADER.
 *
 * X180 measured the abort and declined to name it: three handlers and a fully ZEROED pre-state all stop at the
 * same instruction pointer, so it is neither the handler nor the declared state, and that file did not map the
 * pointer to source. This file does that mapping and the abort is NOT the covenant refusing the shape.
 *
 * THE POINTER. The trace stops at `ip=167` with ONE frame on the control stack, so it is inside an OP_INVOKE'd
 * body - the route body, selector `53434231` ("SCB1"). Libauth registers an error on the instruction AFTER the
 * one that raised it, so the failing instruction is 166, and `artifact.debug.functionDebug['53434231'].requires`
 * carries an entry at exactly that pointer. The instructions decode without ambiguity:
 *
 *     [163] OP_5 [164] OP_SPLIT ... [165] PUSH<00> [166] OP_EQUALVERIFY
 *
 * which is `require(batchBlob.slice(5, 6) == hex"00")` - the SCB1 header's LOGICAL VALUE MODE byte, checked in
 * the route preamble before any row is parsed and long before any handler dispatch. That is why three handlers
 * and a zeroed pre-state all stop in the same place.
 *
 * THE CAUSE IS TWO FLAGS COMPUTED OVER TWO DIFFERENT HANDLER SETS.
 *
 *   - The COMPILER emits the demanded byte from `logicalValueMode = graphMsgValueHandlers.size > 0`, and a
 *     handler only joins that set when `!reason` - that is, when it is ELIGIBLE.
 *   - The SDK writes the byte from `valueMode = capability.handlers.some((h) => h.usesMsgValue)` in
 *     `layer3/hidden-batch.ts`, over EVERY published handler, eligible or not.
 *
 * `EnglishAuction.bid()` is `payable`, uses `msg.value`, and is REFUSED by route synthesis. So the artifact
 * publishes `usesMsgValue: true` on an INELIGIBLE handler, the SDK reads it, writes `01` where this route
 * demands `00` - and also widens every row from 12 bytes to 21 - and the route refuses in its preamble.
 *
 * THE CONTROL BUILDS THE SUBJECT TWICE, DIFFERING IN EXACTLY ONE FIELD. Arm A is the artifact as published.
 * Arm B clears `usesMsgValue` on the INELIGIBLE handlers only; `bytecode` is the same string object in both
 * arms and the two participant addresses are asserted byte-identical, so nothing about the covenant moves.
 * Arm A aborts at ip 167. Arm B does not, and `highestBid` SETTLES and broadcasts.
 *
 * SO THE ABORT IS STAGING, NOT THE COVENANT. What it is NOT: this file does not claim the covenant would admit
 * anything it currently refuses. The flag it corrects is an SDK-side ENCODER input, the route's own check is
 * doing exactly what it was written to do, and the corrected arm still passes through every check the honest
 * arm would have. The compiler-side fix belongs to a sibling's lease and is not attempted here.
 */

const SBE = `${process.env.SBE_ROOT ?? '/Code/solidity-by-example'}/contracts/src`;

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));

const BUS = {
  solidityImportCompat: true,
  ecrecover: 'p2pkh',
  forceStateful: true,
  hiddenBatch: true,
};

const CONTROLLER_GENESIS_TXID = 'c0'.repeat(32);
const PROBE_RESULT = hexToBin('9e'.repeat(32));
const PKH_CALLER = `76a914${binToHex(alicePkh as unknown as Uint8Array)}88ac`;

const FILE = `${SBE}/app/english-auction/EnglishAuction.sol`;
const CONTRACT = 'EnglishAuction';

/**
 * WHAT THE REPAIR GAINED ON THIS CONTRACT, quoted from `Layer3RecoveredPartitionX160`'s own row - `set: 'A'`,
 * `before: ['bids']` - so the three names this file settles are checkable against their source. A CITATION,
 * not a re-measurement.
 */
const GAINED_BY_THE_REPAIR: readonly string[] = [
  'nft', 'nftId', 'seller', 'endAt', 'started', 'ended', 'highestBidder', 'highestBid',
];

/**
 * The value the ROUTE ITSELF computed, read off its own execution, or `undefined` when it never compared the
 * declared value against a different one. Taken verbatim from `Layer3RecoveredOracleWriterX180`.
 */
function operandComparedAgainst(trace: unknown[], placeholder: Uint8Array): Uint8Array | undefined {
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
  return found;
}

/** The X180 row's pre-state, verbatim, so this file measures the same subject. */
const PRE: Record<string, unknown> = {
  nft: new Uint8Array(0),
  nftId: 0n,
  seller: hexToBin(PKH_CALLER),
  endAt: 1_700_000_500n,
  started: true,
  ended: false,
  highestBidder: new Uint8Array(0),
  highestBid: 4_242n,
};
const ORACLE_TIMESTAMP = 1_700_000_000n;

function withBlockOracle(
  layout: { variables: ReadonlyArray<{ name: string; type: string }> },
  pre: Record<string, unknown>,
  timestamp: bigint,
): Record<string, unknown> {
  const staged: Record<string, unknown> = { ...pre };
  for (const variable of layout.variables) {
    if (variable.name === '__blockOracleOwner') staged[variable.name] = alicePub;
    else if (variable.name.startsWith('__block_')) {
      staged[variable.name] = variable.type === 'address' ? new Uint8Array(0) : timestamp;
    }
  }
  return staged;
}

describe('X192: the EnglishAuction abort, mapped through the route source map', () => {
  const compiled = new Map<string, any>();
  function artifactOf(controllerLockingBytecode: string, controllerCategory: string): any {
    const cacheKey = `${controllerLockingBytecode}|${controllerCategory}`;
    if (!compiled.has(cacheKey)) {
      const map = compileFileMulti(FILE, {
        ...BUS,
        messageBusController: controllerLockingBytecode,
        messageBusControllerCategory: controllerCategory,
      } as never) as any;
      const artifact = map[CONTRACT];
      if (artifact === undefined) throw new Error(`${CONTRACT} did not compile in bus mode`);
      compiled.set(cacheKey, artifact);
    }
    return compiled.get(cacheKey);
  }

  /**
   * ARM B OF THE CONTROL, and it moves exactly one field.
   *
   * The published artifact is returned with `usesMsgValue` cleared on the handlers route synthesis REFUSED,
   * and on nothing else. `bytecode`, `stateLayout`, `hiddenBatch.route` and every eligible handler are the same
   * objects, so the compiled covenant - the thing under test - cannot move. Only the SDK's blob-header input
   * changes.
   */
  function withoutIneligibleMsgValue(artifact: any): any {
    const handlers = (artifact.hiddenBatch.handlers as any[]).map((handler) => {
      if (handler.eligible === true || handler.usesMsgValue !== true) return handler;
      const rest = { ...handler };
      delete rest.usesMsgValue;
      return rest;
    });
    return { ...artifact, hiddenBatch: { ...artifact.hiddenBatch, handlers } };
  }

  /** One traced attempt at the recovered route, at input 0 - the participant covenant. */
  async function trace(handler: string, options: {
    rootCaller?: boolean; preOverride?: Record<string, unknown>; correctValueMode?: boolean;
    send?: boolean; declaredResult?: Uint8Array;
  } = {}): Promise<{
      trace?: any[]; artifact: any; sent?: string; refusal?: string; failingInput?: number;
      blobHeader: string; participantAddress: string;
    }> {
    const provider = createLayer3SemanticTestProvider();
    const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const projection = new Contract(compileString(layer3.generateGraphProjectionVerifier()), [], { provider });
    const controller = new Contract(
      compileString(layer3.generateGraphRootController(projection.lockingBytecode)), [alicePkh], { provider },
    );
    const controllerCategory = CONTROLLER_GENESIS_TXID;
    const controllerGenesis: Utxo = await (provider as any).addUtxo(controller.tokenAddress, {
      txid: CONTROLLER_GENESIS_TXID,
      vout: 0,
      satoshis: 3000n,
      token: { category: controllerCategory, amount: 0n, nft: { capability: 'mutable', commitment: '' } },
    });
    const published0 = artifactOf(controller.lockingBytecode as never, controllerCategory);
    const artifact = options.correctValueMode === true ? withoutIneligibleMsgValue(published0) : published0;
    const base = new Contract(artifact, [], { provider });
    const pre = options.preOverride
      ?? withBlockOracle(artifact.stateLayout, PRE, ORACLE_TIMESTAMP);
    const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, pre);
    const participant = base.withCategory(hexToBin(setup.categoryId));
    const stagedEntries = await stageEmptyRouteEntries(
      provider as never, participant, setup.categoryId, artifact.hiddenBatch!.route,
    );
    const published = buildInitialStateCommitments(artifact.stateLayout!, pre);

    const returns = (artifact.hiddenBatch!.handlers as any[])
      .find((candidate) => candidate.name === handler)?.outputs?.length > 0;

    // The transcript declares the VECTOR inside the commitment, so the two are one push apart. The payload is
    // DECODED with libauth rather than re-encoded here, and the honest run asserts that re-wrapping the decoded
    // vector reproduces the covenant's own bytes exactly, so no encoding is ever guessed. Verbatim from X180.
    const innerVector = options.declaredResult === undefined ? PROBE_RESULT : (() => {
      const [instruction, ...rest] = decodeAuthenticationInstructions(options.declaredResult!);
      const data = (instruction as { data?: Uint8Array }).data;
      if (data === undefined || rest.length !== 0) {
        throw new Error('the route\'s return commitment is not a single push');
      }
      return data;
    })();
    const publishedCommitment = options.declaredResult === undefined
      ? PROBE_RESULT : scriptToBytecode([innerVector]);
    if (returns && options.declaredResult !== undefined) {
      expect(binToHex(publishedCommitment), 're-wrapping the decoded vector did not reproduce the commitment '
        + 'the route computed').toBe(binToHex(options.declaredResult));
    }

    const unboundRouteWitnesses: Record<string, Uint8Array | bigint> = {};
    const zeroWitness = (name: string): Uint8Array | bigint => {
      const declaredType = (artifact.hiddenBatch!.route.inputs as any[])
        .find((input) => input.name === name)?.type;
      if (declaredType === undefined) throw new Error(`the route declares no witness '${name}'`);
      return /^(u?int|bigint)/.test(declaredType) ? 0n : new Uint8Array(32);
    };
    let plan: any;
    for (let index = 0; ; index += 1) {
      try {
        plan = layer3.planCompiledGraph(
          [{ artifact, lockingBytecode: participant.lockingBytecode, unboundRouteWitnesses }],
          [{ parent: null, callee: 0, function: handler, args: [] }],
        );
        break;
      } catch (error) {
        const named = (error as Error).message.match(/Missing SCB1 route witness '([^']+)'/);
        if (!named || index > 16) throw error;
        unboundRouteWitnesses[named[1]] = zeroWitness(named[1]);
      }
    }
    const physical = layer3.compiledGraphPhysicalLayout(plan);
    const bareOrigin = options.rootCaller !== false;
    const transcript = layer3.finalizeCompiledGraph(
      plan,
      returns ? { 0: binToHex(innerVector) } : {},
      physical.participantInputs,
      returns ? physical.returnOutputs : [null],
      returns ? [binToHex(innerVector)] : [''],
      physical.projectionInputs,
      bareOrigin ? PKH_CALLER : '',
    );

    const initFee = randomUtxo({ satoshis: 20_000n });
    await provider.addUtxo(p2pkh.address, initFee);
    const initialize = new TransactionBuilder({ provider });
    initialize.addInput(
      controllerGenesis, controller.unlock.initialize(hexToBin(transcript.root), alicePub, signature()),
    );
    initialize.addInput(initFee, p2pkh.unlock.spend(alicePub, signature()));
    initialize.addOutput({
      to: controller.tokenAddress,
      amount: controllerGenesis.satoshis,
      token: {
        category: controllerCategory, amount: 0n, nft: { capability: 'mutable', commitment: transcript.root },
      },
    });
    initialize.addOutput({ to: p2pkh.address, amount: 15_000n });
    await provider.sendRawTransaction(raw(initialize));
    const rootedController = (await provider.getUtxos(controller.tokenAddress))
      .find((utxo: any) => utxo.token?.nft?.commitment === transcript.root);

    const returnFunding = randomUtxo({ satoshis: 1000n });
    const projectionUtxo = randomUtxo({ satoshis: 1000n });
    const fee = randomUtxo({ satoshis: 400_000n });
    await provider.addUtxo(projection.address, projectionUtxo);
    await provider.addUtxo(p2pkh.address, returnFunding);
    await provider.addUtxo(bareOrigin ? aliceAddress : p2pkh.address, fee);

    const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
    let dataNftCursor = 0;
    let entryCursor = 0;
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
          tx.addInput(setup.dataNftUtxos[index], createDataNftUnlocker(participant, 0, setup.categoryId));
          tx.addOutput({
            to: getDataNftAddress(participant, setup.categoryId),
            amount: setup.dataNftUtxos[index].satoshis,
            token: {
              category: setup.categoryId,
              amount: 0n,
              nft: { capability: 'mutable', commitment: published[index] },
            },
          });
          break;
        }
        case 'entry':
          addRouteEntrySlot(
            tx, participant, setup.categoryId, artifact.hiddenBatch!.route, stagedEntries, entryCursor,
          );
          entryCursor += 1;
          break;
        case 'returnEvent':
          tx.addInput(returnFunding, p2pkh.unlock.spend(alicePub, signature()));
          tx.addOutput({
            to: hexToBin('51'),
            amount: 1000n,
            token: {
              category: setup.categoryId,
              amount: 0n,
              nft: {
                capability: 'none',
                commitment: returns
                  ? binToHex(publishedCommitment)
                  : binToHex(scriptToBytecode([new Uint8Array(0)])),
              },
            },
          });
          break;
        default:
          throw new Error(`this probe does not stage a '${slot.kind}' slot`);
      }
    }
    tx.addInput(projectionUtxo, projection.unlock.verify(
      transcript.bytes, BigInt(physical.controllerInput), 0n,
    ));
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
    tx.addInput(rootedController!, controller.unlock.attest(transcript.bytes));
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
    tx.addInput(fee, bareOrigin ? signature().unlockP2PKH() : p2pkh.unlock.spend(alicePub, signature()));
    tx.addOutput({ to: bareOrigin ? aliceAddress : p2pkh.address, amount: 350_000n });

    // The SCB1 blob's own first seven bytes, read off the plan the SDK built rather than assumed.
    const asHex = (value: unknown): string =>
      (typeof value === 'string' ? value : binToHex(value as Uint8Array));
    const blobHeader = asHex(plan.participants[0].batch.blob).slice(0, 14);
    // The CATEGORY-FREE locking bytecode. `withCategory` mixes in a per-provider random genesis outpoint, so
    // the categorised address differs between two independently staged arms for reasons that have nothing to
    // do with the field under test. This is the script the two arms must share.
    const participantAddress = asHex(base.lockingBytecode);

    if (options.send === true) {
      try {
        const sent = await provider.sendRawTransaction(raw(tx));
        return { sent, artifact, blobHeader, participantAddress };
      } catch (error) {
        const refusal = (error as Error).message;
        const index = refusal.match(/input index (\d+)/);
        return {
          refusal, failingInput: index ? Number(index[1]) : undefined,
          artifact, blobHeader, participantAddress,
        };
      }
    }
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const steps = vm.debug({
      inputIndex: 0,
      sourceOutputs: generateLibauthSourceOutputs(tx.inputs as never),
      transaction: tx.buildLibauthTransaction(),
    }) as any[];
    return { trace: steps, artifact, blobHeader, participantAddress };
  }

  /** Where a probe stopped: the pointer, the frame depth, and the VM's own error string. */
  function abortOf(steps: any[]): { ip: number; frames: number; error: string; steps: number } {
    const last = steps[steps.length - 1];
    return {
      ip: last.ip ?? -1,
      frames: (last.controlStack ?? []).filter((e: unknown) => typeof e === 'object' && e !== null).length,
      error: last.error ?? 'no error recorded',
      steps: steps.length,
    };
  }

  /**
   * X199 CLOSED THE SUBJECT OF THIS TEST. It used to map the abort pointer through the route's own debug
   * metadata and land on the SCB1 header's logical-value-mode require, generated-source line 60 - accounting
   * for libauth registering an error on the instruction AFTER the one that raised it, so the failing
   * instruction is 166 and the recorded pointer 167. That mapping is preserved in section 4.131 of the board.
   *
   * What is left here is the guard: the route must reach its RETURN-EVENT check rather than stopping in the
   * preamble. The sentinel probe declares a placeholder result, so an abort at the return check is the probe
   * working; an abort at 167 is X199 regressing.
   */
  it('X199: the route no longer stops in its preamble', async () => {
    const { trace: steps } = await trace('highestBid');
    const last = steps![steps!.length - 1];
    const ip: number = last.ip;
    console.log(`[X192] highestBid stops at ip=${ip} steps=${steps.length} error=${last.error}`);
    expect(ip, 'the route aborts at the logical-value-mode require again - X199 has regressed').not.toBe(167);
    expect(steps.length, 'the route stopped earlier than the recorded preamble abort').toBeGreaterThan(3377);
  }, 1_800_000);

  it('MEASURED: the msg.value flag is published on an INELIGIBLE handler, and only there', async () => {
    const { artifact, blobHeader } = await trace('highestBid');
    const handlers = artifact.hiddenBatch.handlers as any[];
    const withValue = handlers.filter((handler) => handler.usesMsgValue === true);
    const eligibleWithValue = withValue.filter((handler) => handler.eligible === true);
    for (const handler of withValue) {
      console.log(`[X192] usesMsgValue handler '${handler.name}' eligible=${handler.eligible === true} `
        + `reason=${handler.rejectionReason ?? '-'}`);
    }
    console.log(`[X192] SDK valueMode input: ${withValue.length} handlers publish usesMsgValue, `
      + `${eligibleWithValue.length} of them ELIGIBLE`);
    console.log(`[X192] the SCB1 header the SDK wrote: ${blobHeader} (byte 5 = ${blobHeader.slice(10, 12)})`);
    // THE ABI SIDE IS UNCHANGED AND MUST STAY THAT WAY. `bid()` is payable, uses `msg.value`, and is refused
    // by route synthesis - so a handler publishing `usesMsgValue` while INELIGIBLE is the normal, correct
    // state of this artifact. The defect was never the publication; it was that the SDK sized its rows from
    // the published set while the route sized its own from the eligible set. This row is now the REGRESSION
    // GUARD for X199: the disagreeing input is still present, and the header must no longer follow it.
    expect(withValue.length, 'no handler publishes usesMsgValue - the guard has lost its subject')
      .toBeGreaterThan(0);
    expect(eligibleWithValue, 'an ELIGIBLE handler uses msg.value, so the guard has lost its subject')
      .toEqual([]);
    expect(blobHeader.slice(10, 12), 'the SDK sized rows from the PUBLISHED set again - X199 has regressed')
      .toBe('00');
  }, 1_800_000);

  /**
   * THE CONTROL. Two builds of the same route, differing in exactly one artifact field.
   *
   * The participant locking bytecode is asserted IDENTICAL across the arms, so the covenant under test is the
   * same script in both. Arm A - the artifact as published - aborts at ip 167. Arm B - `usesMsgValue` cleared
   * on the INELIGIBLE handlers only - does not.
   */
  it('X199: both arms now agree - the test-local correction is a no-op', async () => {
    const armA = await trace('highestBid');
    const armB = await trace('highestBid', { correctValueMode: true });
    expect(armA.participantAddress, 'the two arms are not the same covenant')
      .toBe(armB.participantAddress);
    expect(armA.artifact.bytecode, 'the two arms do not share the compiled bytecode')
      .toBe(armB.artifact.bytecode);
    console.log(`[X192] ARM A (published artifact) header=${armA.blobHeader}`);
    console.log(`[X192] ARM B (usesMsgValue cleared on ineligible) header=${armB.blobHeader}`);
    // THE CONTROL HAS BECOME THE PROOF. This file's arm B cleared `usesMsgValue` on the ineligible handlers
    // as a TEST-LOCAL artifact patch, and that single field moved the abort. X199 made the SDK do the same
    // intersection for real, so the patch now changes nothing - the two arms produce the same header. If they
    // ever diverge again, the SDK has gone back to sizing rows from the published set.
    expect(armA.blobHeader.slice(10, 12)).toBe('00');
    expect(armB.blobHeader).toBe(armA.blobHeader);
    // Both arms still stop, and that is the SENTINEL working rather than a wall: this probe declares the
    // `9e..` placeholder as its result, so the route reaches its RETURN-EVENT check and disagrees there. The
    // reading is that neither stops at 167 any more - the preamble pointer the value-mode byte used to abort
    // at. The settlement tests below publish the route's own computed commitment and broadcast.
    const abortA = abortOf(armA.trace!);
    const abortB = abortOf(armB.trace!);
    console.log(`[X192] ARM A abort ip=${abortA.ip} steps=${abortA.steps} error=${abortA.error}`);
    console.log(`[X192] ARM B abort ip=${abortB.ip} steps=${abortB.steps} error=${abortB.error}`);
    expect(abortA.ip, 'the route aborts at the X192 preamble pointer again - X199 has regressed').not.toBe(167);
    expect(abortB.ip).toBe(abortA.ip);
  }, 1_800_000);

  /** The result the route computed for a handler, read off its own trace with the placeholder sentinel. */
  const cachedResult = new Map<string, Uint8Array>();
  async function routeResult(handler: string): Promise<Uint8Array> {
    if (!cachedResult.has(handler)) {
      const probe = await trace(handler, { correctValueMode: true });
      const found = operandComparedAgainst(probe.trace!, PROBE_RESULT);
      if (found === undefined) {
        const abort = abortOf(probe.trace!);
        throw new Error(`${handler}: the route never compared the declared result `
          + `(stopped after ${abort.steps} steps at ip ${abort.ip}: ${abort.error})`);
      }
      cachedResult.set(handler, found);
      console.log(`[X192] ${handler} result off its own trace: ${binToHex(found)}`);
    }
    return cachedResult.get(handler)!;
  }

  /**
   * AND THE ROUTE RUNS. With the one flag corrected, each handler publishes the result the route computed and
   * the transaction BROADCASTS. Before this, no `EnglishAuction` handler had ever reached a return check.
   *
   * The three names are X160's own gained list for this contract minus `bids`, which was already in `before`.
   */
  const settles = (handler: string) => async (): Promise<void> => {
    expect(GAINED_BY_THE_REPAIR, `${handler} is not a handler the repair gained`).toContain(handler);
    const declaredResult = await routeResult(handler);
    const sent = await trace(handler, { correctValueMode: true, send: true, declaredResult });
    if (sent.refusal) console.log(`[X192] ${handler} refused: ${sent.refusal.split('\n')[0]}`);
    expect(sent.refusal, `EnglishAuction.${handler} did not settle`).toBeUndefined();
    expect(sent.sent).toMatch(/^[0-9a-f]{64}$/);
    console.log(`[X192] EnglishAuction.${handler} SETTLED ${sent.sent}`);
  };

  for (const handler of ['highestBid', 'endAt', 'started']) {
    it(`MEASURED: with the header corrected, EnglishAuction.${handler} SETTLES`,
      settles(handler), 1_800_000);
  }

  /**
   * GUARD NEGATIVE CONTROL, RETURN-EVENT DIRECTION. The identical staging carrying a BELIEVABLE-WRONG result -
   * the route's own commitment with one bit moved, not a random blob - is refused at the PARTICIPANT input.
   * Without this the settlement above would only say the harness can build a transaction.
   */
  it('GUARD: a believable-wrong return event on the corrected staging is refused at input 0', async () => {
    const honest = await routeResult('highestBid');
    const forged = Uint8Array.from(honest);
    forged[forged.length - 1] ^= 0x01;
    console.log(`[X192] honest commitment ${binToHex(honest)} -> forged ${binToHex(forged)}`);
    const result = await trace('highestBid', {
      correctValueMode: true, send: true, declaredResult: forged,
    });
    console.log(`[X192] result-forgery: ${(result.refusal ?? 'ACCEPTED').split('\n')[0]}`);
    expect(result.sent, 'a forged return event was ACCEPTED').toBeUndefined();
    expect(result.refusal).toMatch(/OP_VERIFY|mandatory-script-verify-flag-failed|non-truthy/);
    expect(result.failingInput, 'the refusal did not name the participant input').toBe(0);
  }, 1_800_000);
});
