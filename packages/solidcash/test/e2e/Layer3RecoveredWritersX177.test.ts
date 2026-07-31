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
 * argument, no counterparty, no collection. The risk lives in the shapes it is not - and those shapes are
 * the machinery every security row on this board has been about. This file runs the writers that HAVE those
 * shapes, one settled transaction each, and every one of them is measured, never assumed:
 *
 *   subject                                shape                                        block
 *   Lib.doSomething(uint256)               scalar written from an ARGUMENT              3   master dataNft returnEvent
 *   Target.protected()                     bool write behind a msg.sender guard         3   master dataNft returnEvent
 *   UniswapV2Pair.initialize(addr,addr)    TWO fields, FOUR data NFTs, mapping layout   6   master dataNft x4 returnEvent
 *   StakingRewards.setRewardsDuration(u256) FOUR data NFTs + THREE mapping ENTRY slots  9   master dataNft x4 entry x3 returnEvent
 *
 * WHAT EACH ROW ESTABLISHES.
 *
 *  1. POSITIVE. The route co-spends its master, its data NFTs and (where the block has them) its collection
 *     entry NFTs, recreates the data NFTs with the POST state, and settles.
 *  2. THE WRITE IS REAL, READ OFF THE COVENANT. The probe run publishes the PRE state as the post state - the
 *     mistake an honest builder makes when it forgets the assignment - and the route's own trace hands back
 *     the commitment IT computed, PER DATA NFT SLOT. A slot whose computed commitment equals the declared one
 *     is UNCHANGED and is reported as such; a slot that differs is the written one. Nothing here computes a
 *     post state and then agrees with itself: `buildInitialStateCommitments` is used only afterwards, to say
 *     WHICH value the covenant's own bytes are.
 *  3. HOSTILE. The post state left at the PRE value is refused, at a pinned input index.
 *  4. HOSTILE. The post state moved to a believable neighbour - same length, same encoding, one bit - is
 *     refused, at a pinned input index.
 *  5. HOSTILE. A return event carrying a believable-wrong result is refused, at a pinned input index.
 *  6. GUARD NEGATIVE CONTROL. Every hostile differs from a settling positive in exactly ONE field, that
 *     positive is rebuilt by the same helper in the same file, and a READ-ONLY sibling of the same contract
 *     settles through the identical staging - so a refusal discriminates the attacked field, and an
 *     acceptance is not an evaluation that never ran.
 *
 * WHAT IS NOT ESTABLISHED.
 *
 *  - This file speaks for the handlers it runs and for nothing else. The 206 are not proved by four of them.
 *  - `Foo.callBar` (the remaining EXTERNAL-CALL writer) and the four ABSENT-flag handlers are the subject of
 *    `Layer3RecoveredWriterShapesX177.test.ts`; neither is claimed here.
 *  - No recovered writer over a DYNAMIC string or an unbounded chunk collection is run anywhere. That shape
 *    has no subject in the eleven and is explicitly still open.
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
type Attack = 'none' | 'result' | 'state-unwritten' | 'state-neighbour';

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
}

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
    pre: { token0: new Uint8Array(0), token1: new Uint8Array(0) },
    post: { token0: TOKEN0, token1: TOKEN1 },
    blockSize: 6,
    slots: ['master', 'dataNft', 'dataNft', 'dataNft', 'dataNft', 'returnEvent'],
  },
  {
    key: 'defi/staking-rewards/StakingRewards.sol::StakingRewards.setRewardsDuration',
    shape: 'FOUR data NFTs plus THREE co-spent mapping ENTRY slots',
    file: `${SBE}/defi/staking-rewards/StakingRewards.sol`,
    contract: 'StakingRewards',
    writer: 'setRewardsDuration',
    writerArgs: [86_400n],
    guards: [{ name: 'duration', args: [] }, { name: 'rewardRate', args: [] }],
    pre: { duration: 3_600n },
    post: { duration: 86_400n },
    blockSize: 9,
    slots: ['master', 'dataNft', 'dataNft', 'dataNft', 'dataNft', 'entry', 'entry', 'entry', 'returnEvent'],
    entryCollections: ['balanceOf', 'userRewardPerTokenPaid', 'rewards'],
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
   * `declaredResult` undefined selects the PROBE run: it is traced under the VM debugger and never broadcast.
   * `publishedState` undefined publishes the PRE state, which is both the state probe and the
   * `state-unwritten` hostile - the same bytes, differing only in whether the attempt is traced or sent.
   */
  async function attempt(row: Row, handler: string, args: readonly unknown[], attack: Attack, options: {
    declaredResult?: Uint8Array; publishedState?: readonly string[];
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
    if (options.declaredResult !== undefined && attack !== 'result') {
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
          tx.addInput(setup.dataNftUtxos[index], createDataNftUnlocker(participant, index, setup.categoryId));
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

    if (options.declaredResult === undefined) {
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
   * THE POST STATE, TAKEN OFF THE COVENANT, PER DATA NFT SLOT.
   *
   * The probe publishes the PRE state for every slot - what an honest builder produces when it forgets the
   * assignment - so for a slot the handler WRITES the route's own comparison puts its computed commitment
   * next to the declared one on the stack, and that is the value read here. For a slot the handler leaves
   * alone the two agree and nothing is found, which is reported as UNCHANGED rather than as a failure.
   */
  const cachedPost = new Map<string, string[]>();
  async function covenantPostState(row: Row): Promise<string[]> {
    if (!cachedPost.has(row.key)) {
      const probe = await attempt(row, row.writer, row.writerArgs, 'none', {});
      // Two slots seeded to identical bytes would make the adjacency search ambiguous. Asserted, not assumed.
      expect(new Set(probe.preCommitments).size, `${row.key}: the pre-state commitments are not distinct`)
        .toBe(probe.preCommitments.length);
      const out = probe.preCommitments.map((pre, index) => {
        const found = operandComparedAgainst(probe.trace!, hexToBin(pre));
        console.log(`[X177] ${row.key} slot ${index}: pre=${pre} `
          + `covenant=${found === undefined ? 'UNCHANGED' : binToHex(found)}`);
        return found === undefined ? pre : binToHex(found);
      });
      cachedPost.set(row.key, out);
    }
    return cachedPost.get(row.key)!;
  }

  /** The declared result the route computes for one handler, read off its own trace with the post state set. */
  const cachedResult = new Map<string, Uint8Array>();
  async function routeResult(row: Row, handler: string, args: readonly unknown[]): Promise<Uint8Array> {
    const key = `${row.key}|${handler}`;
    if (!cachedResult.has(key)) {
      const publishedState = handler === row.writer ? await covenantPostState(row) : undefined;
      const probe = await attempt(row, handler, args, 'none', { publishedState });
      const found = operandComparedAgainst(probe.trace!, PROBE_RESULT);
      if (found === undefined) throw new Error(`${key}: the probe trace never compared the declared result`);
      cachedResult.set(key, found);
      console.log(`[X177] ${key} result off its own trace: ${binToHex(found)}`);
    }
    return cachedResult.get(key)!;
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
    console.log(`[X177] ${row.key} computed  ${JSON.stringify(computed)}`);
    console.log(`[X177] ${row.key} post      ${JSON.stringify(written)}`);
    console.log(`[X177] ${row.key} pre       ${JSON.stringify(unwritten)}`);
    expect(computed).toEqual(written);
    expect(computed).not.toEqual(unwritten);
  };

  /** THE POSITIVE, built by the same helper that builds every hostile. */
  const positive = (row: Row) => async (): Promise<void> => {
    const result = await attempt(row, row.writer, row.writerArgs, 'none', {
      declaredResult: await routeResult(row, row.writer, row.writerArgs),
      publishedState: await covenantPostState(row),
    });
    if (result.refusal) console.log(`[X177] ${row.key} refused: ${result.refusal.split('\n')[0]}`);
    expect(result.refusal, `the recovered writer ${row.key} did not settle`).toBeUndefined();
    expect(result.sent).toMatch(/^[0-9a-f]{64}$/);
    console.log(`[X177] ${row.key} SETTLED ${result.sent}`);
  };

  /**
   * GUARD NEGATIVE CONTROL. A read-only sibling settles through the IDENTICAL staging, so a refusal below is
   * a refusal of the attacked field and not of a harness that never worked.
   */
  const guard = (row: Row, name: string, args: readonly unknown[]) => async (): Promise<void> => {
    const result = await attempt(row, name, args, 'none', {
      declaredResult: await routeResult(row, name, args),
    });
    if (result.refusal) console.log(`[X177] ${row.key}/${name} refused: ${result.refusal.split('\n')[0]}`);
    expect(result.refusal, `${row.key}: the read-only sibling ${name} did not settle`).toBeUndefined();
    expect(result.sent).toMatch(/^[0-9a-f]{64}$/);
    console.log(`[X177] ${row.key}/${name} guard settled ${result.sent}`);
  };

  /**
   * HOSTILES. Each differs from the settling positive in exactly ONE field, matched on the refusal text and
   * pinned to the input index that produced it. `state-unwritten` is the mistake an honest builder makes;
   * `state-neighbour` is the one an attacker makes; `result` leaves the state correct and lies about what
   * was returned.
   */
  const hostile = (row: Row, attack: Attack) => async (): Promise<void> => {
    const post = await covenantPostState(row);
    const pre = buildInitialStateCommitments(
      (compileFileMulti(row.file, {
        ...BUS,
        experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
        experimentalMessageBusControllerCategory: '22'.repeat(32),
      } as never) as any)[row.contract].stateLayout!,
      row.pre,
    );
    // The neighbour moves the ONE slot the covenant actually wrote, and only that slot.
    const movedSlot = post.findIndex((value, index) => value !== pre[index]);
    expect(movedSlot, `${row.key}: the covenant wrote no slot at all`).toBeGreaterThanOrEqual(0);
    const neighbour = [...post];
    neighbour[movedSlot] = binToHex(((): Uint8Array => {
      const bytes = hexToBin(post[movedSlot]);
      bytes[bytes.length - 1] ^= 0x01;
      return bytes;
    })());
    const publishedState = attack === 'state-unwritten' ? pre
      : attack === 'state-neighbour' ? neighbour : post;
    const result = await attempt(row, row.writer, row.writerArgs, attack, {
      declaredResult: await routeResult(row, row.writer, row.writerArgs), publishedState,
    });
    console.log(`[X177] ${row.key}/${attack}: ${(result.refusal ?? 'ACCEPTED').split('\n')[0]}`);
    console.log(`[X177] ${row.key}/${attack} published ${JSON.stringify(result.publishedState)}`);
    expect(result.sent, `a forged ${attack} was ACCEPTED on ${row.key}`).toBeUndefined();
    expect(result.refusal).toBeDefined();
    expect(result.refusal).toMatch(/OP_VERIFY|mandatory-script-verify-flag-failed|non-truthy/);
    expect(result.failingInput, 'the refusal did not name the participant input').toBe(0);
  };

  for (const row of ROWS) {
    it(`MEASURED: ${row.key} MUTATES - its own trace hands back the post state`, mutates(row), 1_800_000);
    it(`MEASURED: the recovered WRITER ${row.key} SETTLES`, positive(row), 1_800_000);
    for (const g of row.guards) {
      it(`GUARD: the read-only sibling '${g.name}' of ${row.contract} settles through the same staging`,
        guard(row, g.name, g.args), 1_800_000);
    }
    it(`HOSTILE: ${row.key} with the write simply not applied is refused`,
      hostile(row, 'state-unwritten'), 1_800_000);
    it(`HOSTILE: ${row.key} with the post state moved one bit is refused`,
      hostile(row, 'state-neighbour'), 1_800_000);
    it(`HOSTILE: ${row.key} with a believable-wrong return event is refused`,
      hostile(row, 'result'), 1_800_000);
  }
});
