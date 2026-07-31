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
 * X180. THE BLOCK-ORACLE STAGING, AND THE FIRST MAPPING / MULTI-DATA-NFT RECOVERED WRITER EVER RUN.
 *
 * FOUR rows of the recovered population were BLOCKED on one harness gap, not on the covenant. Every recovered
 * route that carries a block oracle - a compiler-injected `__block_timestamp` register plus an IMMUTABLE
 * `__blockOracleOwner` pubkey in a data NFT of its own - was refused by the recovered-writer staging:
 *
 *   subject                                  named blocked in                       shape
 *   StakingRewards.setRewardsDuration(u256)  Layer3RecoveredWritersX177             4 data NFTs + 3 entry slots
 *   UniswapV2Pair.initialize(addr,addr)      Layer3RecoveredWritersX177             4 data NFTs, 3 mappings
 *   CrowdFund.count()                        Layer3RecoveredSetAX136                2 data NFTs, refused at 2
 *   EnglishAuction (its read surface)        Layer3RecoveredSetAX136                3 data NFTs
 *
 * WHAT THE GAP ACTUALLY WAS, measured rather than assumed. The oracle registers are ORDINARY state variables
 * living in ordinary data NFTs - there is no oracle covenant, no separate address and no side-car UTXO to
 * stage. What the earlier staging did was never NAME them in the row's declared pre-state, so
 * `buildInitialStateCommitments` filled `__block_timestamp` with 0 and `__blockOracleOwner` with 33 zero
 * bytes, and those commitments are not the ones the route recomputes. The fix is one helper,
 * `withBlockOracle`, which reads the injected registers off the contract's OWN published state layout and
 * seeds them. Nothing else about the staging changes.
 *
 * THAT CLAIM IS TESTED IN BOTH DIRECTIONS, because "a shape refuses" is worth nothing until the refusal is
 * pinned on the right thing. For each oracle-bearing row this file runs the SAME route twice, differing in
 * exactly the oracle registers and in nothing else:
 *
 *   CONTROL   the oracle registers omitted from the pre-state - the OLD staging - is REFUSED, at a pinned
 *             input index, with the refusal text quoted.
 *   SUBJECT   the oracle registers seeded - the NEW staging - SETTLES, as its own broadcast transaction.
 *
 * A row that only settled would leave open that the old wall was something else; a row that only refused
 * would be the trap `Layer3RecoveredVoidWriterX177` documents, where a staging defect was read for four
 * rounds as a covenant property.
 *
 * WHAT THIS FILE ESTABLISHES, and it is the first of its kind on this board.
 *
 *  1. `StakingRewards.setRewardsDuration` SETTLES. It is the FIRST recovered writer run on the VM that is not
 *     a single scalar in a single data NFT: FOUR data NFTs are co-spent and rebuilt and THREE sorted-mapping
 *     entry NFTs ride the same block. Every prior proved writer (`Counter.inc`, `Lib.doSomething`) is one
 *     scalar in one data NFT with no collection anywhere.
 *  2. THE WRITE IS REAL, READ OFF THE COVENANT, ONE SLOT AT A TIME, by the sentinel method X177 introduced:
 *     each data NFT slot is probed with a commitment the covenant cannot have computed, so the route's own
 *     comparison hands back the commitment IT computed. `buildInitialStateCommitments` is used afterwards
 *     only to say WHICH state those bytes are.
 *  3. THE UNTOUCHED-DATA-NFT HOSTILE FINALLY HAS A SUBJECT. `Counter.inc` cannot test it - it has one data
 *     NFT. Here a data NFT the handler does NOT write is moved one bit and the route refuses, so the covenant
 *     pins EVERY data NFT in its block and not only the slot it writes.
 *  4. THE ENTRY SLOTS ARE LIVE. A co-spent sorted-collection entry NFT moved one bit is refused, so the three
 *     mapping entry NFTs are authenticated rather than merely present.
 *  5. `CrowdFund.count` and `EnglishAuction.highestBid` SETTLE through the same staging, closing the two
 *     read-surface rows X136 left open.
 *
 * WHAT IS NOT ESTABLISHED, and it bounds every sentence above.
 *
 *  - `UniswapV2Pair.initialize` HAS NO VM SUBJECT, and the block oracle is not why. Compiled in bus mode at
 *    this commit the contract is 17,224 bytes against BCH's 10,000-byte input-script limit; the compiler
 *    itself refuses it ("cannot be deployed without splitting"). No staging can run it, so its two-field /
 *    four-NFT / three-mapping shape stays unproven. That is measured below, not asserted.
 *  - THREE handlers of the 206 are added here. The population remains overwhelmingly unproven.
 *  - Semantic profile only. `createLayer3SemanticTestProvider` relaxes capacity; this is not deployability,
 *    relay or consensus-fit evidence.
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

/**
 * A FIXED controller genesis outpoint, which is what makes this file affordable.
 *
 * The controller's category is a COMPILE input, so a random genesis - what `addTokenUtxosDynamic` hands back -
 * forces a fresh compile per attempt, and `StakingRewards` costs about eleven seconds each. Seeding the
 * genesis UTXO at a chosen outpoint makes the category constant across every attempt in the run, so the
 * compile is done once per contract. Each attempt still builds a FRESH provider, so no two attempts share a
 * UTXO set; only the bytes being executed are shared, which is the point.
 */
const CONTROLLER_GENESIS_TXID = 'c0'.repeat(32);

/** A distinctive placeholder result: the probe declares it, so the trace's OTHER operand is the real one. */
const PROBE_RESULT = hexToBin('9e'.repeat(32));

/** `tx.origin` in this staging: the first P2PKH non-token input is the harness's own funding coin. */
const PKH_CALLER = `76a914${binToHex(alicePkh as unknown as Uint8Array)}88ac`;

/**
 * The value the ROUTE ITSELF computed, read off its own execution, or `undefined` when it never compared the
 * declared value against a different one. `undefined` is a MEANINGFUL answer for a data NFT slot: it says the
 * covenant never contradicted the declared commitment, which is what an UNWRITTEN slot looks like.
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

/**
 * THE BLOCK-ORACLE STAGING CAPABILITY, and it is this function.
 *
 * A contract that reads `block.*` gets compiler-injected registers in its own state - one `uint32` per
 * referenced field (`__block_coinbase` is an address instead) plus an IMMUTABLE `__blockOracleOwner` pubkey
 * that gates the injected `__updateBlockOracle` path. They are ordinary state variables in ordinary data
 * NFTs; what they are NOT is optional. A pre-state that omits them encodes the oracle timestamp as 0 and the
 * owner key as 33 zero bytes, and the route recomputes neither.
 *
 * The registers are read off the contract's OWN published layout rather than listed here, so a contract that
 * reads a different set of `block.*` fields is staged correctly without this file naming them.
 */
function withBlockOracle(
  layout: { variables: ReadonlyArray<{ name: string; type: string }> },
  pre: Record<string, unknown>,
  timestamp: bigint,
): Record<string, unknown> {
  const staged: Record<string, unknown> = { ...pre };
  for (const variable of layout.variables) {
    if (variable.name === '__blockOracleOwner') {
      staged[variable.name] = alicePub;
    } else if (variable.name.startsWith('__block_')) {
      // The coinbase register is a locking bytecode; every other field is a uint32 the keeper reports.
      staged[variable.name] = variable.type === 'address' ? new Uint8Array(0) : timestamp;
    }
  }
  return staged;
}

/** The injected registers a layout carries, for the console reading and for the omit-them control. */
function blockOracleRegisters(
  layout: { variables: ReadonlyArray<{ name: string; type: string; nftIndex: number }> },
): Array<{ name: string; nftIndex: number }> {
  return layout.variables
    .filter((variable) => variable.name === '__blockOracleOwner' || variable.name.startsWith('__block_'))
    .map((variable) => ({ name: variable.name, nftIndex: variable.nftIndex }));
}

/** What one built attempt differs in. Exactly one field moves per hostile. */
type Attack = 'none' | 'result' | 'state-unwritten' | 'state-neighbour' | 'state-untouched' | 'entry';

interface Row {
  /** The partition key, exactly as the recovered-population files print it. */
  key: string;
  /** The shape this row exists to cover. */
  shape: string;
  file: string;
  contract: string;
  /** The handler under test. For a `reads` row it is a read-only getter and `post` is empty. */
  writer: string;
  writerArgs: readonly unknown[];
  /** Read-only siblings run through the identical staging as the guard negative control. */
  guards: ReadonlyArray<{ name: string; args: readonly unknown[] }>;
  /** The contract's own fields. The oracle registers are added by `withBlockOracle`, never listed here. */
  pre: Record<string, unknown>;
  /** What the covenant's own computed commitments are asserted to BE - never what is published. */
  post: Record<string, unknown>;
  blockSize: number;
  slots: readonly string[];
  /** The oracle timestamp this row is staged at. Its guards depend on it, so it is per-row. */
  oracleTimestamp: bigint;
  rootCaller?: 'none' | 'pkh';
  /**
   *  - `settles`   a state-CHANGING handler runs to completion and the post state is read off the covenant.
   *  - `reads`     a read-only handler settles and publishes the result the route computed.
   *  - `unstageable` the shape has no VM subject at all, for a reason measured on the row.
   */
  verdict: 'settles' | 'reads' | 'unstageable';
}

const ROWS: readonly Row[] = [
  {
    key: 'defi/staking-rewards/StakingRewards.sol::StakingRewards.setRewardsDuration',
    shape: 'FOUR data NFTs plus THREE co-spent sorted-mapping ENTRY slots, behind a block-oracle guard',
    file: `${SBE}/defi/staking-rewards/StakingRewards.sol`,
    contract: 'StakingRewards',
    writer: 'setRewardsDuration',
    writerArgs: [86_400n],
    guards: [{ name: 'duration', args: [] }, { name: 'rewardRate', args: [] }],
    verdict: 'settles',
    // `setRewardsDuration` is `onlyOwner` - `require(msg.sender == owner)` - and on the bus `msg.sender` is a
    // LOCKING BYTECODE the projection pins to `tx.origin`. So the owner field is the harness's own P2PKH.
    rootCaller: 'pkh',
    oracleTimestamp: 1_700_000_000n,
    pre: {
      stakingToken: new Uint8Array(0),
      rewardsToken: new Uint8Array(0),
      owner: hexToBin(PKH_CALLER),
      duration: 3_600n,
      // `require(finishAt < block.timestamp)` is the oracle guard: it reads the injected register, so this row
      // is unsatisfiable at the 0 the old staging left there and satisfiable at the seeded value.
      finishAt: 0n,
      updatedAt: 0n,
      rewardRate: 0n,
      rewardPerTokenStored: 0n,
      totalSupply: 0n,
    },
    post: { duration: 86_400n },
    blockSize: 9,
    slots: ['master', 'dataNft', 'dataNft', 'dataNft', 'dataNft', 'entry', 'entry', 'entry', 'returnEvent'],
  },
  {
    key: 'app/crowd-fund/CrowdFund.sol::CrowdFund.count',
    shape: 'read surface of a two-data-NFT oracle contract - the row X136 recorded refused at input 2',
    file: `${SBE}/app/crowd-fund/CrowdFund.sol`,
    contract: 'CrowdFund',
    writer: 'count',
    writerArgs: [],
    guards: [{ name: 'token', args: [] }],
    verdict: 'reads',
    oracleTimestamp: 1_700_000_000n,
    pre: { token: new Uint8Array(0), count: 7n },
    post: {},
    blockSize: 4,
    slots: ['master', 'dataNft', 'dataNft', 'returnEvent'],
  },
  {
    key: 'app/english-auction/EnglishAuction.sol::EnglishAuction.highestBid',
    shape: 'read surface of a THREE-data-NFT oracle contract - the row X136 says never reached its return check',
    file: `${SBE}/app/english-auction/EnglishAuction.sol`,
    contract: 'EnglishAuction',
    writer: 'highestBid',
    writerArgs: [],
    guards: [{ name: 'endAt', args: [] }],
    verdict: 'reads',
    oracleTimestamp: 1_700_000_000n,
    pre: {
      nft: new Uint8Array(0),
      nftId: 0n,
      seller: hexToBin(PKH_CALLER),
      endAt: 1_700_000_500n,
      started: true,
      ended: false,
      highestBidder: new Uint8Array(0),
      highestBid: 4_242n,
    },
    post: {},
    blockSize: 5,
    slots: ['master', 'dataNft', 'dataNft', 'dataNft', 'returnEvent'],
  },
  {
    key: 'uniswapv2/UniswapV2Factory.sol::UniswapV2Pair.initialize',
    shape: 'TWO fields written across FOUR data NFTs, in a three-mapping layout',
    file: `${MISTSWAP}/uniswapv2/UniswapV2Factory.sol`,
    contract: 'UniswapV2Pair',
    writer: 'initialize',
    writerArgs: [],
    guards: [],
    verdict: 'unstageable',
    oracleTimestamp: 1_700_000_000n,
    pre: {},
    post: {},
    blockSize: 6,
    slots: ['master', 'dataNft', 'dataNft', 'dataNft', 'dataNft', 'returnEvent'],
  },
];

/** The BCH consensus limit on an input script. A contract above it is invalid at every spend. */
const INPUT_SCRIPT_LIMIT = 10_000;

describe('X180: the block-oracle staging, and the mapping / multi-data-NFT recovered writer', () => {
  /**
   * ONE COMPILE PER (contract, controller). The controller genesis is pinned, so the compile inputs are
   * constant across a row's attempts and this cache is what keeps the file to minutes rather than an hour.
   */
  const compiled = new Map<string, any>();
  function artifactOf(row: Row, controllerLockingBytecode: string, controllerCategory: string): any {
    const cacheKey = `${row.file}|${row.contract}|${controllerLockingBytecode}|${controllerCategory}`;
    if (!compiled.has(cacheKey)) {
      const map = compileFileMulti(row.file, {
        ...BUS,
        experimentalMessageBusController: controllerLockingBytecode,
        experimentalMessageBusControllerCategory: controllerCategory,
      } as never) as any;
      const artifact = map[row.contract];
      if (artifact === undefined) throw new Error(`${row.key}: ${row.contract} did not compile in bus mode`);
      compiled.set(cacheKey, artifact);
    }
    return compiled.get(cacheKey);
  }

  /** The layout-only compile, used for pre/post commitments. Its controller never reaches a transaction. */
  const layoutController = `aa20${'11'.repeat(32)}87`;
  const layoutCategory = '22'.repeat(32);
  const artifactForLayout = (row: Row): any => artifactOf(row, layoutController, layoutCategory);

  /** The staged pre-state: the row's own fields plus the oracle registers its layout declares. */
  const stagedPre = (row: Row, artifact: any): Record<string, unknown> =>
    withBlockOracle(artifact.stateLayout, row.pre, row.oracleTimestamp);

  /**
   * THE PARTITION TEST. Every subject is asserted to be a handler the repair published, on the block shape
   * this file claims to exercise, from this run's own compile - and every oracle-bearing row is asserted to
   * actually carry the oracle registers, which is what makes it a subject for this file at all.
   */
  it('MEASURED: every subject is a published handler carrying the block oracle this file stages', () => {
    for (const row of ROWS) {
      const artifact = artifactForLayout(row);
      const eligible = (artifact.hiddenBatch!.handlers as any[])
        .filter((handler) => handler.eligible).map((handler) => handler.name);
      const layout = artifact.hiddenBatch!.route.blockLayout!;
      const registers = blockOracleRegisters(artifact.stateLayout);
      const bytes = artifact.bytecode.length / 2;
      console.log(`[X180] ${row.key}`);
      console.log(`[X180]   shape: ${row.shape}`);
      console.log(`[X180]   bytes=${bytes} dataNftCount=${artifact.stateLayout.dataNftCount} `
        + `blockSize=${layout.blockSize} slots=${JSON.stringify(layout.slots.map((s: any) => s.kind))}`);
      console.log(`[X180]   collections=${JSON.stringify(
        (artifact.stateLayout.collections ?? []).map((c: any) => c.name))} `
        + `entrySlots=${JSON.stringify((artifact.hiddenBatch!.route.entryAccesses ?? [])
          .map((e: any) => e.collection))}`);
      console.log(`[X180]   ORACLE REGISTERS: ${JSON.stringify(registers)}`);
      expect(registers.map((register) => register.name), `${row.key} carries no block oracle`)
        .toContain('__blockOracleOwner');
      expect(registers.some((register) => register.name === '__block_timestamp')).toBe(true);
      expect(layout.blockSize).toBe(row.blockSize);
      expect(layout.slots.map((slot: any) => slot.kind)).toEqual(row.slots);
      if (row.verdict === 'unstageable') continue;
      expect(eligible, `${row.writer} is not admitted`).toContain(row.writer);
      for (const g of row.guards) expect(eligible, `${g.name} is not admitted`).toContain(g.name);
      const abiOf = (name: string): any => artifact.abi.find((entry: any) => entry.name === name);
      expect(abiOf(row.writer).writesState).toBe(row.verdict === 'settles');
      for (const g of row.guards) expect(abiOf(g.name).writesState, `${g.name} is not read-only`).toBe(false);
    }
  }, 1_800_000);

  /**
   * THE OTHER WALL, AND IT IS NOT THE ORACLE. `UniswapV2Pair` is over BCH's input-script limit in bus mode, so
   * no staging reaches its covenant. Reading the figure here is what turns "blocked by the harness" into
   * "has no VM subject, and here is the number".
   */
  it('MEASURED: UniswapV2Pair has NO VM subject - it exceeds the BCH input-script limit', () => {
    const row = ROWS.find((candidate) => candidate.verdict === 'unstageable')!;
    const artifact = artifactForLayout(row);
    const bytes = artifact.bytecode.length / 2;
    console.log(`[X180] ${row.key}: ${bytes} bytes vs the ${INPUT_SCRIPT_LIMIT}-byte input-script limit `
      + `(over by ${bytes - INPUT_SCRIPT_LIMIT})`);
    console.log('[X180]   so the block-oracle staging does NOT unblock this row: every spend of this '
      + 'contract is invalid at consensus, and the compiler refuses it independently of any staging.');
    expect(bytes).toBeGreaterThan(INPUT_SCRIPT_LIMIT);
  }, 1_800_000);

  /**
   * One attempt at one recovered route.
   *
   * `probe` traces the attempt under the VM debugger and never broadcasts it. `oracle: false` stages the row
   * with the oracle registers OMITTED - the old staging - and is the control that pins the wall.
   */
  async function attempt(row: Row, handler: string, args: readonly unknown[], attack: Attack, options: {
    probe?: boolean; declaredResult?: Uint8Array; publishedState?: readonly string[]; oracle?: boolean;
    entryOverride?: { slot: number; commitment: string };
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
    // The pinned genesis outpoint: chosen rather than random, so the controller category - a COMPILE input -
    // is the same on every attempt and the compile cache above is usable.
    const controllerCategory = CONTROLLER_GENESIS_TXID;
    const controllerGenesis: Utxo = await (provider as any).addUtxo(controller.tokenAddress, {
      txid: CONTROLLER_GENESIS_TXID,
      vout: 0,
      satoshis: 3000n,
      token: {
        category: controllerCategory, amount: 0n, nft: { capability: 'mutable', commitment: '' },
      },
    });
    const artifact = artifactOf(row, controller.lockingBytecode as never, controllerCategory);
    const base = new Contract(artifact, [], { provider });
    const pre = options.oracle === false ? row.pre : stagedPre(row, artifact);
    const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, pre);
    const participant = base.withCategory(hexToBin(setup.categoryId));

    const preCommitments = buildInitialStateCommitments(artifact.stateLayout!, pre);
    const published = options.publishedState ?? preCommitments;

    // A BELIEVABLE WRONG: the same bytes with one bit moved, not a random blob.
    const forge = (value: Uint8Array): Uint8Array => {
      const wrong = Uint8Array.from(value);
      if (wrong.length === 0) return Uint8Array.from([0x01]);
      wrong[wrong.length - 1] ^= 0x01;
      return wrong;
    };
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

    // THE UNBOUND ROUTE WITNESSES, taken from the SDK rather than guessed: it names each missing key exactly.
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
      row.rootCaller === 'pkh' ? PKH_CALLER : '',
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
    const rootedController: Utxo | undefined = (await provider.getUtxos(controller.tokenAddress))
      .find((utxo: any) => utxo.token?.nft?.commitment === transcript.root);
    expect(rootedController, 'controller initialization did not root the authority').toBeDefined();

    const returnFunding = randomUtxo({ satoshis: 1000n });
    const projectionUtxo = randomUtxo({ satoshis: 1000n });
    const fee = randomUtxo({ satoshis: 400_000n });
    await provider.addUtxo(projection.address, projectionUtxo);
    for (const utxo of [returnFunding, fee]) await provider.addUtxo(p2pkh.address, utxo);

    // The entry slot -> collection map is read off the ROUTE's own published entry accesses, in slot order,
    // rather than listed in this file: slot i is `route.entryAccesses[i].collection` by construction.
    const entryCollections = ((artifact.hiddenBatch!.route.entryAccesses ?? []) as any[])
      .map((access) => access.collection as string);

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
          const index = entryCursor;
          entryCursor += 1;
          const collection = entryCollections[index];
          if (collection === undefined) throw new Error(`${row.key}: the route names no entry slot ${index}`);
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
              nft: {
                capability: 'mutable',
                commitment: options.entryOverride?.slot === index
                  ? options.entryOverride.commitment
                  : utxo.token!.nft!.commitment,
              },
            },
          });
          break;
        }
        case 'returnEvent':
          // A VOID row still fills this slot with a return-event NFT: the covenant checks the slot's
          // commitment against the result vector it computed, and for a void handler that vector is EMPTY.
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
   * Each slot is resolved with a SENTINEL the covenant cannot have computed: the slots already resolved are
   * published correctly, the slot under probe carries the sentinel, and the route's own comparison then puts
   * its computed commitment beside it. Resolving in slot order matters - the route stops at the first data
   * NFT that disagrees - and it reads EVERY slot off the covenant, which is what makes "slot 2 is UNCHANGED"
   * a measurement rather than an omission.
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
        console.log(`[X180] ${row.key} slot ${index}: pre=${probe.preCommitments[index]} `
          + `covenant=${resolved[index]}`);
      }
      cachedPost.set(row.key, resolved);
    }
    return cachedPost.get(row.key)!;
  }

  /** The declared result the route computes for a RETURNING handler, read off its own trace. */
  const cachedResult = new Map<string, Uint8Array>();
  async function routeResult(row: Row, handler: string, args: readonly unknown[]): Promise<Uint8Array> {
    const key = `${row.key}|${handler}`;
    if (!cachedResult.has(key)) {
      const probe = await attempt(row, handler, args, 'none', { probe: true });
      const found = operandComparedAgainst(probe.trace!, PROBE_RESULT);
      if (found === undefined) throw new Error(`${key}: the probe trace never compared the declared result`);
      cachedResult.set(key, found);
      console.log(`[X180] ${key} result off its own trace: ${binToHex(found)}`);
    }
    return cachedResult.get(key)!;
  }

  /** The PRE commitments, from the layout, used only to say WHICH state the covenant's own bytes are. */
  function preCommitmentsOf(row: Row): string[] {
    const artifact = artifactForLayout(row);
    return buildInitialStateCommitments(artifact.stateLayout!, stagedPre(row, artifact));
  }

  /**
   * THE CONTROL THAT PINS THE WALL ON THE STAGING. The identical route, differing from the settling subject in
   * EXACTLY the oracle registers - `__block_timestamp` left at 0 and `__blockOracleOwner` left at 33 zero
   * bytes, which is what the earlier staging published - is refused, at a pinned input index.
   */
  const oracleOmitted = (row: Row) => async (): Promise<void> => {
    const artifact = artifactForLayout(row);
    const registers = blockOracleRegisters(artifact.stateLayout);
    const omitted = buildInitialStateCommitments(artifact.stateLayout!, row.pre);
    const seeded = preCommitmentsOf(row);
    const differing = seeded
      .map((value, index) => (value === omitted[index] ? '.' : index)).filter((entry) => entry !== '.');
    console.log(`[X180] ${row.key} CONTROL registers=${JSON.stringify(registers.map((r) => r.name))}`);
    console.log(`[X180] ${row.key} CONTROL omitted  ${JSON.stringify(omitted)}`);
    console.log(`[X180] ${row.key} CONTROL seeded   ${JSON.stringify(seeded)}`);
    console.log(`[X180] ${row.key} CONTROL data NFT slots that differ: ${JSON.stringify(differing)}`);
    // The two stagings must differ ONLY in the oracle registers' own NFTs, which is what makes this a control.
    expect(differing.sort()).toEqual([...new Set(registers.map((r) => r.nftIndex))].sort());
    const result = await attempt(row, row.writer, row.writerArgs, 'none', { oracle: false });
    console.log(`[X180] ${row.key} CONTROL (oracle omitted): `
      + `${(result.refusal ?? `ACCEPTED ${result.sent}`).split('\n')[0]}`);
    expect(result.sent, `${row.key} settled WITHOUT the oracle staged - the wall was not the oracle`)
      .toBeUndefined();
    expect(result.refusal).toMatch(/OP_VERIFY|mandatory-script-verify-flag-failed|non-truthy/);
    console.log(`[X180] ${row.key} CONTROL refused at input index ${result.failingInput}`);
    expect(result.failingInput).toBeGreaterThanOrEqual(0);
  };

  /**
   * THE WRITE IS REAL, AND THE COVENANT SAID SO. The commitments the route computed for its own data NFTs are
   * the encoding of the POST state and are NOT the encoding of the PRE state. Nothing here encodes a post
   * state and then agrees with itself: the bytes come off the trace.
   */
  const mutates = (row: Row) => async (): Promise<void> => {
    const artifact = artifactForLayout(row);
    const layout = artifact.stateLayout!;
    const staged = stagedPre(row, artifact);
    const computed = await covenantPostState(row);
    const written = buildInitialStateCommitments(layout, { ...staged, ...row.post });
    const unwritten = buildInitialStateCommitments(layout, staged);
    const moved = computed.map((value, index) => (value === unwritten[index] ? '.' : index)).filter(
      (entry) => entry !== '.',
    );
    console.log(`[X180] ${row.key} computed  ${JSON.stringify(computed)}`);
    console.log(`[X180] ${row.key} post      ${JSON.stringify(written)}`);
    console.log(`[X180] ${row.key} pre       ${JSON.stringify(unwritten)}`);
    console.log(`[X180] ${row.key} slots the covenant MOVED: ${JSON.stringify(moved)}`);
    expect(computed).toEqual(written);
    expect(computed).not.toEqual(unwritten);
    expect(moved.length, `${row.key}: the covenant moved no data NFT slot`).toBeGreaterThan(0);
    // The multi-NFT claim, measured: at least one data NFT the handler does NOT write rides the same block.
    expect(computed.length, `${row.key}: this is not a multi-data-NFT route`).toBeGreaterThan(1);
    expect(moved.length, `${row.key}: every data NFT moved, so there is no untouched one`)
      .toBeLessThan(computed.length);
  };

  /** THE POSITIVE, built by the same helper that builds every hostile. */
  const positive = (row: Row) => async (): Promise<void> => {
    const result = await attempt(row, row.writer, row.writerArgs, 'none', {
      publishedState: await covenantPostState(row),
    });
    if (result.refusal) console.log(`[X180] ${row.key} refused: ${result.refusal.split('\n')[0]}`);
    expect(result.refusal, `the recovered writer ${row.key} did not settle`).toBeUndefined();
    expect(result.sent).toMatch(/^[0-9a-f]{64}$/);
    console.log(`[X180] ${row.key} SETTLED ${result.sent}`);
  };

  /** THE POSITIVE for a read-only row: it publishes the result the route computed. */
  const positiveRead = (row: Row) => async (): Promise<void> => {
    const result = await attempt(row, row.writer, row.writerArgs, 'none', {
      declaredResult: await routeResult(row, row.writer, row.writerArgs),
    });
    if (result.refusal) console.log(`[X180] ${row.key} refused: ${result.refusal.split('\n')[0]}`);
    expect(result.refusal, `the recovered handler ${row.key} did not settle`).toBeUndefined();
    expect(result.sent).toMatch(/^[0-9a-f]{64}$/);
    console.log(`[X180] ${row.key} SETTLED ${result.sent}`);
  };

  /**
   * GUARD NEGATIVE CONTROL. A READ-ONLY sibling settles through the IDENTICAL staging with the state left at
   * PRE, so a refusal below is a refusal of the attacked field and not of a harness that never worked.
   */
  const guard = (row: Row, name: string, args: readonly unknown[]) => async (): Promise<void> => {
    const result = await attempt(row, name, args, 'none', {
      declaredResult: await routeResult(row, name, args),
    });
    if (result.refusal) console.log(`[X180] ${row.key}/${name} refused: ${result.refusal.split('\n')[0]}`);
    expect(result.refusal, `${row.key}: the read-only sibling ${name} did not settle`).toBeUndefined();
    expect(result.sent).toMatch(/^[0-9a-f]{64}$/);
    console.log(`[X180] ${row.key}/${name} guard settled ${result.sent}`);
  };

  /**
   * GUARD, RETURN-EVENT DIRECTION. The read-only sibling's return event carrying a believable-wrong result is
   * refused at the participant input - which is where the return-event check is shown to be LIVE.
   */
  const guardResult = (row: Row, name: string, args: readonly unknown[]) => async (): Promise<void> => {
    const result = await attempt(row, name, args, 'result', {
      declaredResult: await routeResult(row, name, args),
    });
    console.log(`[X180] ${row.key}/${name} result-forgery: ${(result.refusal ?? 'ACCEPTED').split('\n')[0]}`);
    expect(result.sent, `a forged return event was ACCEPTED on ${row.key}/${name}`).toBeUndefined();
    expect(result.refusal).toBeDefined();
    expect(result.refusal).toMatch(/OP_VERIFY|mandatory-script-verify-flag-failed|non-truthy/);
    expect(result.failingInput, 'the refusal did not name the participant input').toBe(0);
  };

  /**
   * HOSTILES. Each differs from the settling positive in exactly ONE published field.
   *
   *  - `state-unwritten`   the write simply not applied - the mistake an honest builder makes.
   *  - `state-neighbour`   the written slot moved one bit - the mistake an attacker makes.
   *  - `state-untouched`   a data NFT the handler does NOT write, moved one bit. This is the multi-NFT risk,
   *                        and this file is the first place on the board with a subject for it.
   *  - `entry`             a co-spent sorted-collection entry NFT moved one bit.
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
    let entryOverride: { slot: number; commitment: string } | undefined;
    if (attack === 'state-unwritten') publishedState[written] = pre[written];
    if (attack === 'state-neighbour') publishedState[written] = bump(post[written]);
    if (attack === 'state-untouched') {
      expect(untouched, `${row.key}: every data NFT slot is written, so there is no untouched one`)
        .toBeGreaterThanOrEqual(0);
      publishedState[untouched] = bump(post[untouched]);
    }
    if (attack === 'entry') {
      // The head sentinel the collection is staged with, moved one bit. Read off the probe rather than
      // written down: the honest run publishes the entry NFT's own input commitment unchanged.
      const probe = await attempt(row, row.writer, row.writerArgs, 'none', { probe: true, publishedState });
      expect(probe.trace).toBeDefined();
      entryOverride = { slot: 0, commitment: bump(await stagedEntryCommitment(row)) };
      console.log(`[X180] ${row.key}/entry moved commitment -> ${entryOverride.commitment}`);
    }
    const result = await attempt(row, row.writer, row.writerArgs, attack, { publishedState, entryOverride });
    console.log(`[X180] ${row.key}/${attack}: ${(result.refusal ?? 'ACCEPTED').split('\n')[0]}`);
    console.log(`[X180] ${row.key}/${attack} published ${JSON.stringify(result.publishedState)}`);
    expect(result.sent, `a forged ${attack} was ACCEPTED on ${row.key}`).toBeUndefined();
    expect(result.refusal).toBeDefined();
    expect(result.refusal).toMatch(/OP_VERIFY|mandatory-script-verify-flag-failed|non-truthy/);
    expect(result.failingInput, 'the refusal did not name the participant input').toBe(0);
  };

  /** The commitment the first entry slot is staged with, read off the staged UTXO rather than assumed. */
  const cachedEntry = new Map<string, string>();
  async function stagedEntryCommitment(row: Row): Promise<string> {
    if (!cachedEntry.has(row.key)) {
      const provider = createLayer3SemanticTestProvider();
      const artifact = artifactForLayout(row);
      const base = new Contract(artifact, [], { provider });
      const setup = await setupStatefulUtxos(
        provider, base, artifact.stateLayout!, stagedPre(row, artifact),
      );
      const participant = base.withCategory(hexToBin(setup.categoryId));
      const collection = ((artifact.hiddenBatch!.route.entryAccesses ?? []) as any[])[0].collection as string;
      const address = getEntryNftAddress(participant, setup.categoryId, collection);
      const utxo = (await provider.getUtxos(address))[0];
      cachedEntry.set(row.key, utxo.token!.nft!.commitment);
    }
    return cachedEntry.get(row.key)!;
  }

  for (const row of ROWS) {
    if (row.verdict === 'unstageable') continue;
    it(`CONTROL: ${row.key} staged WITHOUT the oracle registers - the old staging - is REFUSED`,
      oracleOmitted(row), 1_800_000);
    if (row.verdict === 'reads') {
      it(`MEASURED: ${row.key} SETTLES once the block oracle is staged`, positiveRead(row), 1_800_000);
      for (const g of row.guards) {
        it(`GUARD: the read-only sibling '${g.name}' of ${row.contract} settles through the same staging`,
          guard(row, g.name, g.args), 1_800_000);
      }
      it(`GUARD: ${row.contract}'s return event carrying a believable-wrong result is refused`,
        guardResult(row, row.writer, row.writerArgs), 1_800_000);
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
    it(`HOSTILE: ${row.key} with an UNTOUCHED data NFT moved one bit is refused`,
      hostile(row, 'state-untouched'), 1_800_000);
    if (row.slots.includes('entry')) {
      it(`HOSTILE: ${row.key} with a co-spent mapping ENTRY NFT moved one bit is refused`,
        hostile(row, 'entry'), 1_800_000);
    }
  }
});
