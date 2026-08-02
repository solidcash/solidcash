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
import { createDataNftUnlocker, getDataNftAddress } from '../../src/stateful/covenant-helpers.js';
import type { Utxo } from '../../src/interfaces.js';
import { addRouteEntrySlot, stageEmptyRouteEntries } from './layer3-route-entry-fixture.js';

/**
 * X199. ONE QUESTION, TWO POPULATIONS - AND THE POPULATION THE ROUTE CAN DISPATCH IS THE ONE THAT DECIDES.
 *
 * X192 mapped `EnglishAuction`'s abort to `require(batchBlob.slice(5, 6) == hex"00")`, the SCB1 header's
 * logical-value-mode byte, and named the disagreement: the compiler emits the demanded byte from a set a
 * handler joins only when route synthesis ADMITS it, the SDK writes the byte from `usesMsgValue` over EVERY
 * PUBLISHED handler. `EnglishAuction.bid()` is payable, uses `msg.value` and is refused, so it counted on one
 * side only. X192 proved the diagnosis by patching the artifact; it did not repair either side.
 *
 * THERE ARE THREE POPULATIONS, NOT TWO, AND THE COMPILER USED THE ONE THE ARTIFACT CANNOT EXPRESS.
 * `graphMsgValueHandlers` is filled during the FIRST per-handler pass and never revised, while `eligible` is
 * afterwards narrowed by `applyRouteUniformity`. So the route's own header byte was decided over the
 * FIRST-PASS eligible set - neither the published set nor the final one. The artifact publishes exactly two
 * per-handler predicates, `usesMsgValue` and `eligible`, so only two populations are expressible at all:
 *
 *     (a) eligible && usesMsgValue     - the handlers the route can DISPATCH
 *     (b) usesMsgValue                 - every published handler, dispatchable or not
 *
 * EITHER repair therefore has to move the compiler as well; "fix the SDK" alone would still leave the two
 * sides computing over different sets whenever uniformity demotes a payable handler.
 *
 * WHY (a). Candidate (b) buys no admission - `buildDecodeAndCall` maps over the FINAL eligible set and every
 * other selector reaches `revert("unknown batch selector")`, so a refused handler's row is refused with or
 * without the wider header. What (b) does buy is 9 bytes of composer-chosen row payload that NOTHING reads
 * (the parsed value reaches a handler only when that handler reads `msg.value`, and by (b)'s own premise no
 * ELIGIBLE handler does), charged against `maximumBlobBytes` on every row of every such route, and it lets a
 * handler route synthesis REFUSED decide the physical shape of the route that was admitted. (a) costs the bus
 * nothing measurable and keeps the decision inside the dispatchable set. The measurements are below.
 *
 * WHAT THIS FILE DOES NOT CLAIM. It does not claim (b) is unsound. (b) is a FORMAT decision, the row's value
 * field is committed into the controller-rooted transcript like every other blob byte, and no dispatch or
 * authorization outcome moves under it. The case against (b) is cost and blast radius, not a break, and it is
 * stated as such.
 */

const SBE = `${process.env.SBE_ROOT ?? '/Code/solidity-by-example'}/contracts/src`;
const FILE = `${SBE}/app/english-auction/EnglishAuction.sol`;
const CONTRACT = 'EnglishAuction';

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
const ORACLE_TIMESTAMP = 1_700_000_000n;

/** X192's pre-state, verbatim, so this file measures the same subject it inherited. */
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

/**
 * THE PRE-REPAIR SDK, REPRODUCED ON THE POST-REPAIR BUILD BY MOVING ONE FIELD.
 *
 * The repaired encoder counts `eligible && usesMsgValue`. Marking the REFUSED payable handler `eligible: true`
 * in a copy of the artifact makes that predicate return exactly what the old unfiltered one returned, so the
 * old header byte is reproduced without keeping a second compiler around. `bytecode` and every other handler
 * are the same objects, so the covenant under test cannot move - only the encoder's input does.
 *
 * It is also a genuine hostile: an SDK that mislabels a refused handler still cannot make this route accept
 * the wider header.
 */
function asIfIneligibleHandlersCounted(artifact: any): any {
  const handlers = (artifact.hiddenBatch.handlers as any[]).map((handler) =>
    (handler.eligible !== true && handler.usesMsgValue === true
      ? { ...handler, eligible: true } : handler));
  return { ...artifact, hiddenBatch: { ...artifact.hiddenBatch, handlers } };
}

describe('X199: the SCB1 value-mode byte, decided over the dispatchable set', () => {
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
   * One attempt at the recovered route, at input 0 - the participant covenant. `mislabel` reproduces the
   * pre-repair encoder; `forgeHeaderMode` overwrites the finished blob's mode byte and nothing else.
   */
  async function attempt(handler: string, options: {
    mislabel?: boolean; forgeHeaderMode?: string; send?: boolean; declaredResult?: Uint8Array;
  } = {}): Promise<{
      trace?: any[]; artifact: any; sent?: string; refusal?: string; failingInput?: number;
      blobHeader: string; blobBytes: number; participantAddress: string; rowStride: number;
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
    const artifact = options.mislabel === true ? asIfIneligibleHandlersCounted(published0) : published0;
    const base = new Contract(artifact, [], { provider });
    const pre = withBlockOracle(artifact.stateLayout, PRE, ORACLE_TIMESTAMP);
    const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, pre);
    const participant = base.withCategory(hexToBin(setup.categoryId));
    const stagedEntries = await stageEmptyRouteEntries(
      provider as never, participant, setup.categoryId, artifact.hiddenBatch!.route,
    );
    const published = buildInitialStateCommitments(artifact.stateLayout!, pre);

    const returns = (artifact.hiddenBatch!.handlers as any[])
      .find((candidate) => candidate.name === handler)?.outputs?.length > 0;
    // The route's return commitment is ONE push wrapping the packed result vector, so the value read off its
    // own trace has to be DECODED before it is re-wrapped - re-wrapping it whole would publish a commitment
    // one push deeper than the route computes. The equality below is what makes that non-negotiable: nothing
    // here guesses an encoding.
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
    // THE FORGERY moves exactly one byte of a blob the SDK finished building.
    if (options.forgeHeaderMode !== undefined) {
      const blob = plan.participants[0].batch.blob as Uint8Array;
      blob[5] = Number.parseInt(options.forgeHeaderMode, 16);
    }
    const physical = layer3.compiledGraphPhysicalLayout(plan);
    const transcript = layer3.finalizeCompiledGraph(
      plan,
      returns ? { 0: binToHex(innerVector) } : {},
      physical.participantInputs,
      returns ? physical.returnOutputs : [null],
      returns ? [binToHex(innerVector)] : [''],
      physical.projectionInputs,
      PKH_CALLER,
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
    await provider.addUtxo(aliceAddress, fee);

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
    tx.addInput(fee, signature().unlockP2PKH());
    tx.addOutput({ to: aliceAddress, amount: 350_000n });

    const asHex = (value: unknown): string =>
      (typeof value === 'string' ? value : binToHex(value as Uint8Array));
    const blobHex = asHex(plan.participants[0].batch.blob);
    const report = {
      artifact,
      blobHeader: blobHex.slice(0, 14),
      blobBytes: blobHex.length / 2,
      // The route parses a fixed 12- or 21-byte row header; the blob is header(7) + one row, so the stride is
      // the blob minus the header and the row's own arguments. `highestBid` takes no arguments, so this IS the
      // row header width, read off the encoder's own output rather than assumed.
      rowStride: blobHex.length / 2 - 7,
      participantAddress: asHex(base.lockingBytecode),
    };

    if (options.send === true) {
      try {
        return { sent: await provider.sendRawTransaction(raw(tx)), ...report };
      } catch (error) {
        const refusal = (error as Error).message;
        const index = refusal.match(/input index (\d+)/);
        return { refusal, failingInput: index ? Number(index[1]) : undefined, ...report };
      }
    }
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const steps = vm.debug({
      inputIndex: 0,
      sourceOutputs: generateLibauthSourceOutputs(tx.inputs as never),
      transaction: tx.buildLibauthTransaction(),
    }) as any[];
    return { trace: steps, ...report };
  }

  const abortOf = (steps: any[]): { ip: number; error: string; steps: number } => {
    const last = steps[steps.length - 1];
    return { ip: last.ip ?? -1, error: last.error ?? 'no error recorded', steps: steps.length };
  };

  /**
   * THE POPULATIONS, read off the artifact. This is the measurement the repair rests on, and it also states
   * what candidate (b) would have had to be right about: the handler that pushes the flag is REFUSED, by name.
   */
  it('MEASURED: the only handler publishing usesMsgValue is one route synthesis REFUSED', async () => {
    const { artifact } = await attempt('highestBid');
    const handlers = artifact.hiddenBatch.handlers as any[];
    const withValue = handlers.filter((handler) => handler.usesMsgValue === true);
    const eligibleWithValue = withValue.filter((handler) => handler.eligible === true);
    for (const handler of withValue) {
      console.log(`[X199] usesMsgValue '${handler.name}' eligible=${handler.eligible === true} `
        + `reason=${handler.rejectionReason ?? '-'}`);
    }
    console.log(`[X199] P_pub=${withValue.length} P_elig=${eligibleWithValue.length} `
      + `handlers=${handlers.length} eligible=${handlers.filter((h) => h.eligible === true).length}`);
    expect(withValue.map((handler) => handler.name)).toEqual(['bid']);
    expect(eligibleWithValue, 'an eligible handler uses msg.value, so this subject does not discriminate')
      .toEqual([]);
    expect(withValue[0].rejectionReason).toBe(
      'collection-route-requires-one-parameter-keyed-entry-per-collection',
    );
  }, 1_800_000);

  /**
   * THE REPAIRED ENCODER AGREES WITH THE ROUTE, and the row is 9 bytes narrower for it.
   *
   * `rowStride` is the encoder's own output width, not a constant copied from the compiler: the blob is
   * header(7) + one argument-free row, so its length minus 7 IS the row header the route will parse. The
   * mislabelled arm is the pre-repair encoder reproduced with one field moved, and it writes the other byte
   * and the wider row - which is the 12 -> 21 widening X192 recorded, now measured on both sides at once.
   */
  it('MEASURED: the repaired header is 00 at a 12-byte stride; the pre-repair one is 01 at 21', async () => {
    const repaired = await attempt('highestBid');
    const preRepair = await attempt('highestBid', { mislabel: true });
    console.log(`[X199] repaired  header=${repaired.blobHeader} blob=${repaired.blobBytes}B `
      + `stride=${repaired.rowStride}`);
    console.log(`[X199] pre-repair header=${preRepair.blobHeader} blob=${preRepair.blobBytes}B `
      + `stride=${preRepair.rowStride}`);
    expect(repaired.participantAddress, 'the two arms are not the same covenant')
      .toBe(preRepair.participantAddress);
    expect(repaired.blobHeader.slice(10, 12)).toBe('00');
    expect(preRepair.blobHeader.slice(10, 12)).toBe('01');
    expect(repaired.rowStride).toBe(12);
    expect(preRepair.rowStride).toBe(21);
    expect(preRepair.blobBytes - repaired.blobBytes).toBe(9);
  }, 1_800_000);

  /**
   * NECESSITY. The pre-repair encoder, re-run against the repaired build, still stops in the route preamble at
   * the pointer X192 mapped - so the abort this repair removes is the abort it was claimed to be, and the
   * repair is not merely sufficient.
   */
  it('NECESSITY: the pre-repair encoder still aborts at the header require, ip 167', async () => {
    const preRepair = await attempt('highestBid', { mislabel: true });
    const abort = abortOf(preRepair.trace!);
    console.log(`[X199] pre-repair abort ip=${abort.ip} steps=${abort.steps} error=${abort.error}`);
    expect(abort.ip, 'the pre-repair encoder no longer stops at the header require').toBe(165);
    expect(abort.error).toMatch(/OP_VERIFY/);
    const repaired = abortOf((await attempt('highestBid')).trace!);
    console.log(`[X199] repaired abort ip=${repaired.ip} steps=${repaired.steps} error=${repaired.error}`);
    expect(repaired.ip, 'the repaired encoder stops at the same pointer').not.toBe(167);
    expect(repaired.steps).toBeGreaterThan(abort.steps);
  }, 1_800_000);

  /** The result the route computed for a handler, read off its own trace against the placeholder sentinel. */
  const cachedResult = new Map<string, Uint8Array>();
  async function routeResult(handler: string): Promise<Uint8Array> {
    if (!cachedResult.has(handler)) {
      const probe = await attempt(handler);
      const wanted = binToHex(PROBE_RESULT);
      let found: Uint8Array | undefined;
      for (const state of probe.trace!) {
        const step = state as { stack?: Uint8Array[]; controlStack?: unknown[] };
        if (step.controlStack?.some((entry) => entry === false)) continue;
        const stack = step.stack;
        if (!stack || stack.length < 2) continue;
        const top = stack[stack.length - 1];
        const below = stack[stack.length - 2];
        if (binToHex(top) === wanted && binToHex(below) !== wanted) found = Uint8Array.from(below);
        else if (binToHex(below) === wanted && binToHex(top) !== wanted) found = Uint8Array.from(top);
      }
      if (found === undefined) {
        const abort = abortOf(probe.trace!);
        throw new Error(`${handler}: the route never compared the declared result `
          + `(stopped after ${abort.steps} steps at ip ${abort.ip}: ${abort.error})`);
      }
      cachedResult.set(handler, found);
      console.log(`[X199] ${handler} result off its own trace: ${binToHex(found)}`);
    }
    return cachedResult.get(handler)!;
  }

  /**
   * THE SUBJECT SETTLES, with no artifact patched anywhere. X192 could only reach this by editing the
   * published handler list before handing it to the SDK.
   */
  const settles = (handler: string) => async (): Promise<void> => {
    const declaredResult = await routeResult(handler);
    const sent = await attempt(handler, { send: true, declaredResult });
    if (sent.refusal) console.log(`[X199] ${handler} refused: ${sent.refusal.split('\n')[0]}`);
    expect(sent.refusal, `EnglishAuction.${handler} did not settle`).toBeUndefined();
    expect(sent.sent).toMatch(/^[0-9a-f]{64}$/);
    console.log(`[X199] EnglishAuction.${handler} SETTLED ${sent.sent}`);
  };

  for (const handler of ['highestBid', 'endAt', 'started']) {
    it(`SETTLES: EnglishAuction.${handler} broadcasts on the repaired encoder`,
      settles(handler), 1_800_000);
  }

  /**
   * HOSTILE, ONE BYTE MOVED. The repaired encoder builds the honest blob and byte 5 alone is overwritten with
   * the mode the pre-repair encoder used to write. Nothing else changes - the row payload is still the honest
   * 12-byte-stride row, so this is the header claiming a width the row does not have.
   */
  it('HOSTILE: a forged 01 mode byte on an honest blob is refused at input index 0', async () => {
    const declaredResult = await routeResult('highestBid');
    const forged = await attempt('highestBid', { send: true, declaredResult, forgeHeaderMode: '01' });
    console.log(`[X199] forged-mode header=${forged.blobHeader} `
      + `-> ${(forged.refusal ?? 'ACCEPTED').split('\n')[0]}`);
    expect(forged.blobHeader.slice(10, 12), 'the forgery did not reach the blob').toBe('01');
    expect(forged.sent, 'a forged value-mode byte was ACCEPTED').toBeUndefined();
    expect(forged.refusal).toMatch(/OP_VERIFY|mandatory-script-verify-flag-failed|non-truthy/);
    expect(forged.failingInput, 'the refusal did not name the participant input').toBe(0);
  }, 1_800_000);

  /**
   * HOSTILE, THE OTHER DIRECTION. The pre-repair encoder's wider blob with byte 5 forced back to `00`: the
   * header now satisfies the preamble, and the route refuses further in on the row it cannot parse. Without
   * this, the test above would only show that the preamble compares one byte.
   */
  it('HOSTILE: a 21-byte-stride blob relabelled 00 is refused at input index 0', async () => {
    const declaredResult = await routeResult('highestBid');
    const forged = await attempt('highestBid', {
      send: true, declaredResult, mislabel: true, forgeHeaderMode: '00',
    });
    console.log(`[X199] relabelled-wide header=${forged.blobHeader} stride=${forged.rowStride} `
      + `-> ${(forged.refusal ?? 'ACCEPTED').split('\n')[0]}`);
    expect(forged.rowStride, 'the wide arm did not produce a 21-byte row').toBe(21);
    expect(forged.blobHeader.slice(10, 12)).toBe('00');
    expect(forged.sent, 'a relabelled wide blob was ACCEPTED').toBeUndefined();
    expect(forged.failingInput, 'the refusal did not name the participant input').toBe(0);
  }, 1_800_000);

  /**
   * WHAT CANDIDATE (b) WOULD HAVE BOUGHT: nothing, at the dispatch table. The refused payable handler's
   * selector is not in the route's decode chain under EITHER header width, so widening the header cannot make
   * `bid` reachable. Asserted on the published artifact rather than argued.
   */
  it('MEASURED: the refused payable handler is not in the route\'s dispatch set at all', async () => {
    const { artifact } = await attempt('highestBid');
    const capability = artifact.hiddenBatch;
    const bid = (capability.handlers as any[]).find((handler) => handler.name === 'bid');
    expect(bid.eligible).toBe(false);
    // The SDK refuses it by name before any blob exists, and the reason is the compiler's own.
    expect(() => layer3.planCompiledGraph(
      [{ artifact, lockingBytecode: `aa20${'44'.repeat(32)}87` }],
      [{ parent: null, callee: 0, function: 'bid', args: [0n] }] as never,
    )).toThrow(/is not batch eligible: collection-route-requires-one-parameter-keyed-entry-per-collection/);
  }, 1_800_000);
});
