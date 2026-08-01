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
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import {
  createDataNftUnlocker, createEntryNftUnlocker, getDataNftAddress, getEntryNftAddress,
} from '../../src/stateful/covenant-helpers.js';
import type { Utxo } from '../../src/interfaces.js';

/**
 * X177. THE RECOVERED POPULATION'S REMAINING WRITERS, RUN ON SHAPES `Counter.inc` DOES NOT SPEAK FOR.
 *
 * `Layer3RecoveredPartitionX160.test.ts` re-took the L2-F2 partition properly - 206 handlers gained, 0 lost,
 * both directions checked - and found ELEVEN of the 206 state-changing under the census's own classifier.
 * Two carry VM evidence: `Counter.inc` SETTLES (`Layer3RecoveredWriterSettlesX160.test.ts`) and
 * `Attack.attack` is proved NOT to, fail-closed with a bus-inadmissible counterparty
 * (`Layer3RecoveredWriterX136.test.ts`). NINE were unproven either way.
 *
 * `Counter.inc` DOES NOT GENERALIZE and its own docblock says so: one `uint256` scalar, one data NFT, no
 * argument, no counterparty, no collection. The risk lives in the shapes it is not. This file takes the four
 * remaining EXPLICIT writers and says what each one is, measured:
 *
 *   subject                                 shape                                verdict
 *   Lib.doSomething(uint256)                scalar written from an ARGUMENT      SETTLES
 *   Target.protected()                      bool behind a msg.sender guard       REFUSED, fail-closed
 *   UniswapV2Pair.initialize(addr,addr)     2 fields / 4 data NFTs / 3 entries   BLOCKED by this harness
 *   StakingRewards.setRewardsDuration(u256) 4 data NFTs + 5 entry identities    BLOCKED by this harness
 *
 * EVERY WRITER HERE IS VOID, and `Counter.inc` is not - it returns `count`. A void row still fills its
 * return-event slot, with an NFT carrying the EMPTY result vector's single push. A PLAIN output there is
 * refused at input 0, and that refusal is a property of the staging rather than of the handler. That is not
 * a footnote: see `Layer3RecoveredVoidWriterX177.test.ts`, which shows the same substitution flips
 * `Attack.attack` from refused to SETTLED.
 *
 * WHAT THE `SETTLES` ROW ESTABLISHES.
 *
 *  1. POSITIVE. The route co-spends its master and data NFT, recreates the data NFT with the POST state, and
 *     settles.
 *  2. THE WRITE IS REAL, READ OFF THE COVENANT, ONE SLOT AT A TIME. Each data NFT slot is probed with a
 *     SENTINEL commitment the covenant cannot have computed, so the route's own comparison hands back the
 *     commitment IT computed for that slot. `buildInitialStateCommitments` is used only afterwards, to say
 *     WHICH state those bytes are.
 *  3. HOSTILE. The write simply not applied is refused, at input 0.
 *  4. HOSTILE. The written slot moved one bit is refused, at input 0.
 *  5. GUARD. A read-only sibling settles through the identical staging, and ITS return event carrying a
 *     believable-wrong result is refused at input 0 - which is where the return-event check is shown to be
 *     LIVE, since the writer itself is void and publishes no result.
 *
 * WHAT THE `REFUSED` ROW ESTABLISHES, and it is fail-CLOSED rather than an exploit. `Target.protected` is
 * `require(!isContract(msg.sender)); pwned = true;`. The bus's `msg.sender` is a locking bytecode, and the
 * route's own caller binding accepts only the p2sh32 shape - which `isContract` reads as a contract. Both
 * shapes are run: a p2sh32 caller passes the binding and fails `!isContract`, a P2PKH caller fails the
 * binding itself. There is no caller this handler can be called by, and nothing is accepted.
 *
 * WHAT IS NOT ESTABLISHED.
 *
 *  - The two BLOCKED rows are not evidence in either direction, and THE REASON THIS FILE ORIGINALLY GAVE FOR
 *    THEM WAS WRONG. It said both carry a block oracle this staging cannot reproduce. `X180` ran both and
 *    both SETTLE: the wall was this file passing the data NFT's SLOT index where `createDataNftUnlocker`
 *    takes the MASTER's input index, which refuses any route with two or more data NFTs at input 2 whether or
 *    not an oracle is present. That argument is corrected below; the rows stay BLOCKED here only so they are
 *    not run twice. The multi-data-NFT and mapping-entry writers, and the UNTOUCHED-data-NFT hostile this
 *    file implements without a subject, all live in `Layer3RecoveredOracleWriterX180.test.ts` now.
 *  - This file speaks for the handlers it runs and for nothing else.
 *  - No recovered writer over a DYNAMIC string or an unbounded chunk collection is run anywhere. That shape
 *    has no subject in the eleven at all.
 */

const SBE = `${process.env.SBE_ROOT ?? '/Code/solidity-by-example'}/contracts/src`;
const MISTSWAP = `${process.env.MISTSWAP_ROOT ?? '/Code/mistswap/mistswap'}/contracts`;

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));

const BUS = {
  solidityImportCompat: true,
  ecrecover: 'p2pkh',
  forceStateful: true,
  experimentalHiddenBatch: true,
};

/** A distinctive placeholder result: the probe declares it, so the trace's OTHER operand is the real one. */
const PROBE_RESULT = hexToBin('9e'.repeat(32));

/**
 * The value the ROUTE ITSELF computed, read off its own execution, or `undefined` when it never compared the
 * declared value against a different one.
 *
 * The route puts what it computed next to what the transaction carries; this finds the last step where those
 * two are the top two stack items - identified by the declared value being one of them - and returns the
 * OTHER one. `undefined` is a MEANINGFUL answer for a data NFT slot: it says the covenant never contradicted
 * the declared commitment, which is what an UNWRITTEN slot looks like.
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

/** What one built attempt differs in. Exactly one field moves per hostile. */
type Attack = 'none' | 'result' | 'state-unwritten' | 'state-neighbour' | 'state-untouched';

interface Row {
  /** The partition key, exactly as `Layer3RecoveredPartitionX160.test.ts` prints it. */
  key: string;
  /** The shape this row exists to cover, and the reason `Counter.inc` does not speak for it. */
  shape: string;
  file: string;
  contract: string;
  writer: string;
  writerArgs: readonly unknown[];
  /** Read-only siblings run through the identical staging as the guard negative control. */
  guards: ReadonlyArray<{ name: string; args: readonly unknown[] }>;
  pre: Record<string, unknown>;
  /** What the covenant's own computed commitments are asserted to BE - never what is published. */
  post: Record<string, unknown>;
  blockSize: number;
  slots: readonly string[];
  /** The sorted collections whose head-sentinel entry NFTs fill the block's `entry` slots, in slot order. */
  entryCollections?: readonly string[];
  /**
   * The transcript's ROOT CALLER, which is what `msg.sender` resolves to for the outermost invocation. A
   * handler behind a `msg.sender` guard is unsatisfiable without it, and that is a property of the handler,
   * not of the covenant: `Target.protected` refuses CONTRACT callers by design, so the root caller has to be
   * a plain P2PKH. `alice` selects the harness's own P2PKH locking bytecode.
   */
  rootCaller?: 'none' | 'contract' | 'pkh';
  /**
   * What this row is evidence FOR.
   *
   *  - `settles`   the writer runs to completion and the post state is read off the covenant.
   *  - `refuses`   the writer is UNSATISFIABLE on the bus and every caller shape is refused. Fail-closed, and
   *                not an exploit: nothing is accepted that should not be.
   *  - `blocked`   the harness cannot stage this route. NOT evidence either way, and named as such.
   */
  verdict: 'settles' | 'refuses' | 'blocked';
  /** Why a `blocked` row is not run. Empty for every other row. */
  blockedBy?: string;
}

/**
 * THE ROOT CALLER, and it is the whole story for `Target.protected`.
 *
 * `msg.sender` on the bus is a LOCKING BYTECODE. `contract` hands the route a p2sh32 - the only shape the
 * route's own caller binding accepts - and `pkh` hands it a plain P2PKH, which the binding refuses on length.
 * A handler that requires its caller NOT to be a contract therefore has no satisfiable caller at all.
 */
const PKH_CALLER = `76a914${binToHex(alicePkh as unknown as Uint8Array)}88ac`;

const rootCallerFor = (row: Row, participantLockingBytecode: Uint8Array | string): string => {
  if (row.rootCaller === 'pkh') return PKH_CALLER;
  if (row.rootCaller !== 'contract') return '';
  return typeof participantLockingBytecode === 'string'
    ? participantLockingBytecode : binToHex(participantLockingBytecode);
};

const TOKEN0 = hexToBin(`aa20${'a0'.repeat(32)}87`);
const TOKEN1 = hexToBin(`aa20${'b1'.repeat(32)}87`);

const ROWS: readonly Row[] = [
  {
    key: 'hacks/delegatecall/Delegatecall_2.sol::Lib.doSomething',
    shape: 'scalar written from a handler ARGUMENT (Counter.inc takes none)',
    file: `${SBE}/hacks/delegatecall/Delegatecall_2.sol`,
    contract: 'Lib',
    writer: 'doSomething',
    writerArgs: [777n],
    guards: [{ name: 'someNumber', args: [] }],
    verdict: 'settles',
    pre: { someNumber: 41n },
    post: { someNumber: 777n },
    blockSize: 3,
    slots: ['master', 'dataNft', 'returnEvent'],
  },
  {
    key: 'hacks/contract-size/ContractSize.sol::Target.protected',
    shape: 'bool write behind a msg.sender guard',
    file: `${SBE}/hacks/contract-size/ContractSize.sol`,
    contract: 'Target',
    writer: 'protected',
    writerArgs: [],
    guards: [{ name: 'pwned', args: [] }],
    verdict: 'refuses',
    rootCaller: 'contract',
    pre: { pwned: false },
    post: { pwned: true },
    blockSize: 3,
    slots: ['master', 'dataNft', 'returnEvent'],
  },
  {
    key: 'uniswapv2/UniswapV2Factory.sol::UniswapV2Pair.initialize',
    shape: 'TWO fields written across FOUR data NFTs, in a three-mapping layout',
    file: `${MISTSWAP}/uniswapv2/UniswapV2Factory.sol`,
    contract: 'UniswapV2Pair',
    writer: 'initialize',
    writerArgs: [TOKEN0, TOKEN1],
    guards: [{ name: 'token0', args: [] }, { name: 'kLast', args: [] }],
    verdict: 'blocked',
    blockedBy: 'SUPERSEDED by Layer3RecoveredOracleWriterX180, which RUNS this handler: it SETTLES. The wall '
      + 'was never the block oracle - it was this file passing the data NFT SLOT index where '
      + 'createDataNftUnlocker takes the MASTER input index, which refuses every 2+ data NFT route at input '
      + '2. Kept BLOCKED here only to avoid duplicating X180; not evidence about the covenant.',
    pre: { token0: new Uint8Array(0), token1: new Uint8Array(0) },
    post: { token0: TOKEN0, token1: TOKEN1 },
    blockSize: 9,
    slots: [
      'master', 'dataNft', 'dataNft', 'dataNft', 'dataNft',
      'entry', 'entry', 'entry', 'returnEvent',
    ],
  },
  {
    key: 'defi/staking-rewards/StakingRewards.sol::StakingRewards.setRewardsDuration',
    shape: 'FOUR data NFTs plus FIVE co-spent mapping ENTRY identities',
    file: `${SBE}/defi/staking-rewards/StakingRewards.sol`,
    contract: 'StakingRewards',
    writer: 'setRewardsDuration',
    writerArgs: [86_400n],
    guards: [{ name: 'duration', args: [] }, { name: 'rewardRate', args: [] }],
    verdict: 'blocked',
    blockedBy: 'SUPERSEDED by Layer3RecoveredOracleWriterX180, which RUNS this handler: it SETTLES, with all '
      + 'four data NFTs and all five published mapping entry identities co-spent. What it needed was the MASTER input index '
      + 'in the data NFT unlocker, the oracle registers named in the pre-state, and a BARE P2PKH input so the '
      + "projection's tx.origin check has an origin to find. Kept BLOCKED here only to avoid duplicating X180.",
    pre: { duration: 3_600n },
    post: { duration: 86_400n },
    blockSize: 11,
    slots: [
      'master', 'dataNft', 'dataNft', 'dataNft', 'dataNft',
      'entry', 'entry', 'entry', 'entry', 'entry', 'returnEvent',
    ],
    entryCollections: ['balanceOf', 'userRewardPerTokenPaid', 'rewards', 'userRewardPerTokenPaid', 'balanceOf'],
  },
];

describe('X177: the recovered writers whose shape Counter.inc does not cover', () => {
  /**
   * THE PARTITION TEST. Every row is asserted to be a handler the repair ADDED and published
   * `writesState: true`, on the block shape this file claims to exercise, from this run's own compile.
   */
  it('MEASURED: every subject is a published writer on the block shape this file names', () => {
    for (const row of ROWS) {
      const map = compileFileMulti(row.file, {
        ...BUS,
        experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
        experimentalMessageBusControllerCategory: '22'.repeat(32),
      } as never) as any;
      const artifact = map[row.contract];
      expect(artifact, `${row.contract} did not compile in bus mode`).toBeDefined();
      const eligible = (artifact.hiddenBatch!.handlers as any[])
        .filter((handler) => handler.eligible).map((handler) => handler.name);
      const layout = artifact.hiddenBatch!.route.blockLayout!;
      console.log(`[X177] ${row.key}`);
      console.log(`[X177]   shape: ${row.shape}`);
      console.log(`[X177]   blockSize=${layout.blockSize} `
        + `slots=${JSON.stringify(layout.slots.map((slot: any) => slot.kind))}`);
      console.log(`[X177]   dataNftCount=${artifact.stateLayout.dataNftCount} `
        + `collections=${JSON.stringify((artifact.stateLayout.collections ?? []).map((c: any) => c.name))}`);
      expect(eligible, `${row.writer} is not admitted`).toContain(row.writer);
      for (const guard of row.guards) expect(eligible, `${guard.name} is not admitted`).toContain(guard.name);
      expect(layout.blockSize).toBe(row.blockSize);
      expect(layout.slots.map((slot: any) => slot.kind)).toEqual(row.slots);
      const abiOf = (name: string): any => artifact.abi.find((entry: any) => entry.name === name);
      expect(abiOf(row.writer).writesState, `${row.writer} is not a published writer`).toBe(true);
      for (const guard of row.guards) {
        expect(abiOf(guard.name).writesState, `${guard.name} is not read-only`).toBe(false);
      }
    }
  }, 1_800_000);

  /**
   * One attempt at one recovered route.
   *
   * `probe` traces the attempt under the VM debugger and never broadcasts it. `publishedState` undefined
   * publishes the PRE state, which is both the state probe and the `state-unwritten` hostile - the same
   * bytes, differing only in whether the attempt is traced or sent.
   */
  async function attempt(row: Row, handler: string, args: readonly unknown[], attack: Attack, options: {
    probe?: boolean; declaredResult?: Uint8Array; publishedState?: readonly string[];
  }): Promise<{
      sent?: string; refusal?: string; failingInput?: number; trace?: unknown[];
      preCommitments: string[]; publishedState: readonly string[];
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
    const map = compileFileMulti(row.file, {
      ...BUS,
      experimentalMessageBusController: controller.lockingBytecode,
      experimentalMessageBusControllerCategory: controllerCategory,
    } as never) as any;
    const artifact = map[row.contract];
    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, row.pre);
    const participant = base.withCategory(hexToBin(setup.categoryId));

    const preCommitments = buildInitialStateCommitments(artifact.stateLayout!, row.pre);
    const published = options.publishedState ?? preCommitments;

    // A BELIEVABLE WRONG: the same bytes with one bit moved, not a random blob.
    const forge = (value: Uint8Array): Uint8Array => {
      const wrong = Uint8Array.from(value);
      if (wrong.length === 0) return Uint8Array.from([0x01]);
      wrong[wrong.length - 1] ^= 0x01;
      return wrong;
    };
    // EVERY WRITER IN THIS FILE IS VOID, and `Counter.inc` is not - it returns `count`. A void row declares no
    // result at all, so its return-event slot carries a plain output and the transcript's result vector is
    // empty; the returning READ-ONLY siblings below take the other branch and publish a real return-event NFT.
    const returns = (artifact.hiddenBatch!.handlers as any[])
      .find((candidate) => candidate.name === handler)?.outputs?.length > 0;
    // The transcript declares the VECTOR inside the commitment, so the two are one push apart. The payload is
    // DECODED with libauth rather than re-encoded here, and the honest run asserts that re-wrapping the
    // decoded vector reproduces the covenant's own bytes exactly, so no encoding is ever guessed.
    const innerVector = options.declaredResult === undefined ? PROBE_RESULT : (() => {
      const [instruction, ...rest] = decodeAuthenticationInstructions(options.declaredResult!);
      const data = (instruction as { data?: Uint8Array }).data;
      if (data === undefined || rest.length !== 0) {
        throw new Error(`${row.key}: the route's return commitment is not a single push`);
      }
      return data;
    })();
    const publishedVector = attack === 'result' ? forge(innerVector) : innerVector;
    const publishedCommitment = options.declaredResult === undefined
      ? PROBE_RESULT : scriptToBytecode([publishedVector]);
    if (returns && options.declaredResult !== undefined && attack !== 'result') {
      expect(binToHex(publishedCommitment), `${row.key}: re-wrapping the decoded vector did not reproduce `
        + 'the commitment the route computed').toBe(binToHex(options.declaredResult));
    }

    // THE UNBOUND ROUTE WITNESSES, taken from the SDK rather than guessed. A route declares the shared entry
    // key of every collection handler it admits; a handler that binds none leaves those keys for the caller.
    // The SDK names each missing key exactly, so this supplies precisely the named set and never a guessed one.
    const unboundRouteWitnesses: Record<string, Uint8Array | bigint> = {};
    const zeroWitness = (name: string): Uint8Array | bigint => {
      const declaredType = (artifact.hiddenBatch!.route.inputs as any[])
        .find((input) => input.name === name)?.type;
      if (declaredType === undefined) throw new Error(`${row.key}: the route declares no witness '${name}'`);
      return /^(u?int|bigint)/.test(declaredType) ? 0n : new Uint8Array(32);
    };
    let plan: any;
    for (let index = 0; ; index += 1) {
      try {
        plan = layer3.planCompiledGraph(
          [{ artifact, lockingBytecode: participant.lockingBytecode, unboundRouteWitnesses }],
          [{ parent: null, callee: 0, function: handler, args: args as never[] }],
        );
        break;
      } catch (error) {
        const named = (error as Error).message.match(/Missing SCB1 route witness '([^']+)'/);
        if (!named || index > 16) throw error;
        unboundRouteWitnesses[named[1]] = zeroWitness(named[1]);
      }
    }
    const physical = layer3.compiledGraphPhysicalLayout(plan);
    const transcript = layer3.finalizeCompiledGraph(
      plan,
      returns ? { 0: binToHex(publishedVector) } : {},
      physical.participantInputs,
      returns ? physical.returnOutputs : [null],
      returns ? [binToHex(publishedVector)] : [''],
      physical.projectionInputs,
      rootCallerFor(row, participant.lockingBytecode as never),
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
    const fee = randomUtxo({ satoshis: 400_000n });
    await provider.addUtxo(projection.address, projectionUtxo);
    for (const utxo of [returnFunding, fee]) await provider.addUtxo(p2pkh.address, utxo);

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
              nft: { capability: 'mutable', commitment: published[index] },
            },
          });
          break;
        }
        case 'entry': {
          const collection = row.entryCollections![entryCursor];
          entryCursor += 1;
          const address = getEntryNftAddress(participant, setup.categoryId, collection);
          const utxo = (await provider.getUtxos(address))[0];
          if (utxo === undefined) throw new Error(`${row.key}: the ${collection} entry NFT was not staged`);
          tx.addInput(utxo, createEntryNftUnlocker(participant, 0, setup.categoryId, collection));
          tx.addOutput({
            to: address,
            amount: utxo.satoshis,
            token: {
              category: setup.categoryId,
              amount: 0n,
              nft: { capability: 'mutable', commitment: utxo.token!.nft!.commitment },
            },
          });
          break;
        }
        case 'returnEvent':
          // A VOID row still fills this slot with a return-event NFT: the covenant checks the slot's
          // commitment against the result vector it computed, and for a void handler that vector is EMPTY,
          // so the commitment is the empty vector's single push. A plain output here is refused at input 0.
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
          throw new Error(`${row.key}: this harness does not stage a '${slot.kind}' slot`);
      }
    }
    tx.addInput(projectionUtxo, projection.unlock.verify(
      transcript.bytes, BigInt(physical.controllerInput), 0n,
    ));
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
    tx.addInput(rootedController!, controller.unlock.attest(transcript.bytes));
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
    tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
    tx.addOutput({ to: p2pkh.address, amount: 350_000n });

    if (options.probe === true) {
      const vm = createVirtualMachineBch2026ForProvider(provider);
      const trace = vm.debug({
        inputIndex: 0,
        sourceOutputs: generateLibauthSourceOutputs(tx.inputs as never),
        transaction: tx.buildLibauthTransaction(),
      }) as unknown[];
      return { trace, preCommitments, publishedState: published };
    }
    try {
      return {
        sent: await provider.sendRawTransaction(raw(tx)), preCommitments, publishedState: published,
      };
    } catch (error) {
      const refusal = (error as Error).message;
      const index = refusal.match(/input index (\d+)/);
      return {
        refusal, failingInput: index ? Number(index[1]) : undefined, preCommitments, publishedState: published,
      };
    }
  }

  /**
   * THE POST STATE, TAKEN OFF THE COVENANT, ONE DATA NFT SLOT AT A TIME.
   *
   * Publishing the PRE state and looking for the slot the covenant contradicts only works when every pre
   * commitment is a distinctive value; a `bool false` slot is the EMPTY string and an uninitialized `address`
   * slot is empty too, and an empty placeholder matches half the stack. So each slot is resolved with a
   * SENTINEL instead: the slots already resolved are published correctly, the slot under probe carries a
   * value the covenant cannot possibly have computed, and the route's own comparison then puts its computed
   * commitment beside that sentinel. The run is traced and never broadcast.
   *
   * Resolving in slot order matters: the route checks its data NFTs in order and stops at the first one that
   * disagrees, so slot `i` is only reached once slots `0..i-1` carry what the covenant wants. This reads
   * EVERY slot off the covenant, not just the written one - which is what makes "slot 2 is UNCHANGED" a
   * measurement rather than an omission.
   */
  const SENTINEL = (slot: number): string => `${'9d'.repeat(19)}${slot.toString(16).padStart(2, '0')}`;

  const cachedPost = new Map<string, string[]>();
  async function covenantPostState(row: Row): Promise<string[]> {
    if (!cachedPost.has(row.key)) {
      const slots = row.slots.filter((slot) => slot === 'dataNft').length;
      const resolved = preCommitmentsOf(row);
      for (let index = 0; index < slots; index += 1) {
        const publishedState = [...resolved];
        publishedState[index] = SENTINEL(index);
        const probe = await attempt(row, row.writer, row.writerArgs, 'none', {
          probe: true, publishedState,
        });
        const found = operandComparedAgainst(probe.trace!, hexToBin(SENTINEL(index)));
        if (found === undefined) {
          throw new Error(`${row.key}: the covenant never compared data NFT slot ${index}`);
        }
        resolved[index] = binToHex(found);
        console.log(`[X177] ${row.key} slot ${index}: pre=${probe.preCommitments[index]} `
          + `covenant=${resolved[index]}`);
      }
      cachedPost.set(row.key, resolved);
    }
    return cachedPost.get(row.key)!;
  }

  /** The declared result the route computes for a RETURNING handler, read off its own trace. */
  const cachedResult = new Map<string, Uint8Array>();
  async function routeResult(row: Row, handler: string, args: readonly unknown[]): Promise<Uint8Array> {
    const key = `${row.key}|${handler}|${row.rootCaller ?? 'none'}`;
    if (!cachedResult.has(key)) {
      const probe = await attempt(row, handler, args, 'none', { probe: true });
      const found = operandComparedAgainst(probe.trace!, PROBE_RESULT);
      if (found === undefined) throw new Error(`${key}: the probe trace never compared the declared result`);
      cachedResult.set(key, found);
      console.log(`[X177] ${key} result off its own trace: ${binToHex(found)}`);
    }
    return cachedResult.get(key)!;
  }

  /** The PRE commitments, from the layout, used only to say WHICH state the covenant's own bytes are. */
  function preCommitmentsOf(row: Row): string[] {
    const map = compileFileMulti(row.file, {
      ...BUS,
      experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
      experimentalMessageBusControllerCategory: '22'.repeat(32),
    } as never) as any;
    return buildInitialStateCommitments(map[row.contract].stateLayout!, row.pre);
  }

  /**
   * THE WRITE IS REAL, AND THE COVENANT SAID SO. The commitments the route computed for its own data NFTs are
   * the encoding of the POST state and are NOT the encoding of the PRE state. This file never encoded a post
   * state and then agreed with itself: the bytes come off the trace, and `buildInitialStateCommitments` is
   * used afterwards only to say WHICH state they are.
   */
  const mutates = (row: Row) => async (): Promise<void> => {
    const map = compileFileMulti(row.file, {
      ...BUS,
      experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
      experimentalMessageBusControllerCategory: '22'.repeat(32),
    } as never) as any;
    const layout = map[row.contract].stateLayout!;
    const computed = await covenantPostState(row);
    const written = buildInitialStateCommitments(layout, { ...row.pre, ...row.post });
    const unwritten = buildInitialStateCommitments(layout, row.pre);
    const moved = computed.map((value, index) => (value === unwritten[index] ? '.' : index)).filter(
      (entry) => entry !== '.',
    );
    console.log(`[X177] ${row.key} computed  ${JSON.stringify(computed)}`);
    console.log(`[X177] ${row.key} post      ${JSON.stringify(written)}`);
    console.log(`[X177] ${row.key} pre       ${JSON.stringify(unwritten)}`);
    console.log(`[X177] ${row.key} slots the covenant MOVED: ${JSON.stringify(moved)}`);
    expect(computed).toEqual(written);
    expect(computed).not.toEqual(unwritten);
    expect(moved.length, `${row.key}: the covenant moved no data NFT slot`).toBeGreaterThan(0);
  };

  /** THE POSITIVE, built by the same helper that builds every hostile. */
  const positive = (row: Row) => async (): Promise<void> => {
    const result = await attempt(row, row.writer, row.writerArgs, 'none', {
      publishedState: await covenantPostState(row),
    });
    if (result.refusal) console.log(`[X177] ${row.key} refused: ${result.refusal.split('\n')[0]}`);
    expect(result.refusal, `the recovered writer ${row.key} did not settle`).toBeUndefined();
    expect(result.sent).toMatch(/^[0-9a-f]{64}$/);
    console.log(`[X177] ${row.key} SETTLED ${result.sent}`);
  };

  /**
   * GUARD NEGATIVE CONTROL, and the discriminator. A READ-ONLY sibling settles through the IDENTICAL staging
   * with the state left at PRE, so a refusal below is a refusal of the attacked field and not of a harness
   * that never worked - and the writer's acceptance is not a property of the row being easy.
   */
  const guard = (row: Row, name: string, args: readonly unknown[]) => async (): Promise<void> => {
    // A `refuses` row's guard runs with NO declared caller. That is deliberate and it is the point: the
    // caller is the one field under test on that row, so the control has to take it out of the picture -
    // otherwise a settling guard would be evidence about the caller rather than about the staging.
    const staged: Row = row.verdict === 'refuses' ? { ...row, rootCaller: 'none' } : row;
    const result = await attempt(staged, name, args, 'none', {
      declaredResult: await routeResult(staged, name, args),
    });
    if (result.refusal) console.log(`[X177] ${row.key}/${name} refused: ${result.refusal.split('\n')[0]}`);
    expect(result.refusal, `${row.key}: the read-only sibling ${name} did not settle`).toBeUndefined();
    expect(result.sent).toMatch(/^[0-9a-f]{64}$/);
    console.log(`[X177] ${row.key}/${name} guard settled ${result.sent}`);
  };

  /**
   * GUARD, RETURN-EVENT DIRECTION. The read-only sibling's return event carrying a believable-wrong result is
   * refused at the participant input. Every writer here is VOID, so this is where the return-event check is
   * shown to be LIVE in this staging: without it, the void rows' plain return-event output would be evidence
   * of nothing.
   */
  const guardResult = (row: Row, name: string, args: readonly unknown[]) => async (): Promise<void> => {
    const staged: Row = row.verdict === 'refuses' ? { ...row, rootCaller: 'none' } : row;
    const result = await attempt(staged, name, args, 'result', {
      declaredResult: await routeResult(staged, name, args),
    });
    console.log(`[X177] ${row.key}/${name} result-forgery: ${(result.refusal ?? 'ACCEPTED').split('\n')[0]}`);
    expect(result.sent, `a forged return event was ACCEPTED on ${row.key}/${name}`).toBeUndefined();
    expect(result.refusal).toBeDefined();
    expect(result.refusal).toMatch(/OP_VERIFY|mandatory-script-verify-flag-failed|non-truthy/);
    expect(result.failingInput, 'the refusal did not name the participant input').toBe(0);
  };

  /**
   * HOSTILES. Each differs from the settling positive in exactly ONE data NFT slot, matched on the refusal
   * text and pinned to the input index that produced it.
   *
   *  - `state-unwritten`   the write simply not applied - the mistake an honest builder makes.
   *  - `state-neighbour`   the written slot moved one bit - the mistake an attacker makes.
   *  - `state-untouched`   a data NFT the handler does NOT write, moved one bit. This is the multi-NFT risk
   *                        and the one `Counter.inc` cannot test at all: does the covenant pin EVERY data NFT
   *                        in its block, or only the slot it happens to write?
   */
  const hostile = (row: Row, attack: Attack) => async (): Promise<void> => {
    const post = await covenantPostState(row);
    const pre = preCommitmentsOf(row);
    const bump = (value: string): string => {
      const bytes = hexToBin(value);
      if (bytes.length === 0) return '01';
      bytes[bytes.length - 1] ^= 0x01;
      return binToHex(bytes);
    };
    const written = post.findIndex((value, index) => value !== pre[index]);
    expect(written, `${row.key}: the covenant wrote no slot at all`).toBeGreaterThanOrEqual(0);
    const untouched = post.findIndex((value, index) => value === pre[index]);
    const publishedState = [...post];
    if (attack === 'state-unwritten') publishedState[written] = pre[written];
    if (attack === 'state-neighbour') publishedState[written] = bump(post[written]);
    if (attack === 'state-untouched') {
      expect(untouched, `${row.key}: every data NFT slot is written, so there is no untouched one`)
        .toBeGreaterThanOrEqual(0);
      publishedState[untouched] = bump(post[untouched]);
    }
    const result = await attempt(row, row.writer, row.writerArgs, attack, { publishedState });
    console.log(`[X177] ${row.key}/${attack}: ${(result.refusal ?? 'ACCEPTED').split('\n')[0]}`);
    console.log(`[X177] ${row.key}/${attack} published ${JSON.stringify(result.publishedState)}`);
    expect(result.sent, `a forged ${attack} was ACCEPTED on ${row.key}`).toBeUndefined();
    expect(result.refusal).toBeDefined();
    expect(result.refusal).toMatch(/OP_VERIFY|mandatory-script-verify-flag-failed|non-truthy/);
    expect(result.failingInput, 'the refusal did not name the participant input').toBe(0);
  };

  /**
   * THE NEGATIVE, and it is fail-CLOSED. `Target.protected` is `require(!isContract(msg.sender)); pwned = true;`
   * and the bus's `msg.sender` is a LOCKING BYTECODE that the route's own caller binding accepts only in the
   * p2sh32 shape - which `isContract` reads as a contract. Both shapes are run:
   *
   *   caller shape   what happens
   *   p2sh32         the caller binding passes and `!isContract(msg.sender)` fails
   *   P2PKH          the caller binding itself fails, on the 25-vs-35 length comparison
   *
   * So there is no caller this handler can be called by, and NOTHING IS ACCEPTED. This is the X115 shape - a
   * published-but-dead admission - and it is not an exploit: the covenant refuses.
   */
  const unsatisfiable = (row: Row, caller: 'contract' | 'pkh') => async (): Promise<void> => {
    const shaped: Row = { ...row, rootCaller: caller };
    for (const publishedState of [
      preCommitmentsOf(row),
      preCommitmentsOf(row).map((_value, index) => (index === 0 ? SENTINEL(0) : _value)),
    ]) {
      const result = await attempt(shaped, row.writer, row.writerArgs, 'none', { publishedState });
      console.log(`[X177] ${row.key} caller=${caller} published=${JSON.stringify(publishedState)}: `
        + `${(result.refusal ?? `ACCEPTED ${result.sent}`).split('\n')[0]}`);
      expect(result.sent, `${row.key} was ACCEPTED with a ${caller} caller`).toBeUndefined();
      expect(result.refusal).toMatch(/OP_VERIFY|mandatory-script-verify-flag-failed|non-truthy/);
      expect(result.failingInput, 'the refusal did not name the participant input').toBe(0);
    }
  };

  /** A BLOCKED row is named, not run, and not counted as evidence in either direction. */
  const blocked = (row: Row) => (): void => {
    console.log(`[X177] BLOCKED ${row.key}: ${row.blockedBy}`);
    expect(row.blockedBy).toBeTruthy();
  };

  for (const row of ROWS) {
    if (row.verdict === 'blocked') {
      it(`BLOCKED: ${row.key} is not run - ${row.blockedBy}`, blocked(row));
      continue;
    }
    if (row.verdict === 'refuses') {
      for (const caller of ['contract', 'pkh'] as const) {
        it(`MEASURED: ${row.key} is REFUSED with a ${caller} msg.sender - fail-closed, not an exploit`,
          unsatisfiable(row, caller), 1_800_000);
      }
      for (const g of row.guards) {
        it(`GUARD: the read-only sibling '${g.name}' of ${row.contract} settles through the same staging`,
          guard(row, g.name, g.args), 1_800_000);
      }
      it(`GUARD: ${row.contract}'s return event carrying a believable-wrong result is refused`,
        guardResult(row, row.guards[0].name, row.guards[0].args), 1_800_000);
      continue;
    }
    it(`MEASURED: ${row.key} MUTATES - its own trace hands back the post state`, mutates(row), 1_800_000);
    it(`MEASURED: the recovered WRITER ${row.key} SETTLES`, positive(row), 1_800_000);
    for (const g of row.guards) {
      it(`GUARD: the read-only sibling '${g.name}' of ${row.contract} settles through the same staging`,
        guard(row, g.name, g.args), 1_800_000);
    }
    it(`GUARD: ${row.contract}'s return event carrying a believable-wrong result is refused`,
      guardResult(row, row.guards[0].name, row.guards[0].args), 1_800_000);
    it(`HOSTILE: ${row.key} with the write simply not applied is refused`,
      hostile(row, 'state-unwritten'), 1_800_000);
    it(`HOSTILE: ${row.key} with the written slot moved one bit is refused`,
      hostile(row, 'state-neighbour'), 1_800_000);
    if (row.slots.filter((slot) => slot === 'dataNft').length > 1) {
      it(`HOSTILE: ${row.key} with an UNTOUCHED data NFT moved one bit is refused`,
        hostile(row, 'state-untouched'), 1_800_000);
    }
  }
});
