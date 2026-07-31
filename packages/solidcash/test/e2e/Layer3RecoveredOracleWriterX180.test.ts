import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeAuthenticationInstructions, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { asmToScript, buildInitialStateCommitments, scriptToBytecode } from '@solidcash/utils';
import { compileFileMulti, compileString } from 'solidc';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../src/utils.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';
import { aliceAddress, alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import {
  createDataNftUnlocker, createEntryNftUnlocker, getDataNftAddress, getEntryNftAddress,
} from '../../src/stateful/covenant-helpers.js';
import type { Utxo } from '../../src/interfaces.js';

/**
 * X180. THE "BLOCK ORACLE WALL" WAS NOT A BLOCK ORACLE. THREE OF THE FOUR BLOCKED ROWS RUN.
 *
 * Four rows of the recovered population were carried as BLOCKED for several rounds, each on the same stated
 * reason: the route carries a block oracle - a compiler-injected `__block_timestamp` register plus an
 * IMMUTABLE `__blockOracleOwner` pubkey in a data NFT of its own - that the recovered-writer staging "does not
 * reproduce". `Layer3RecoveredSetAX136` records `CrowdFund.count` refused at INPUT INDEX 2, "its ORACLE data
 * NFT", and `Layer3RecoveredWritersX177` names the same wall for `UniswapV2Pair.initialize` and
 * `StakingRewards.setRewardsDuration`.
 *
 * THE WALL IS ONE ARGUMENT IN THE HARNESS, AND IT HAS NOTHING TO DO WITH ORACLES.
 *
 * `createDataNftUnlocker(contract, masterInputIndex, categoryId)` takes the input index of the MASTER, which
 * the data NFT covenant's write path reads to check a minting NFT is co-spent. The three recovered-population
 * files pass the data NFT's own SLOT index instead - `createDataNftUnlocker(participant, index, ...)`. That
 * names the master only for slot 0. Every route with TWO OR MORE data NFTs therefore fails the covenant's
 * `OP_2 OP_EQUALVERIFY` capability check at its SECOND data NFT, which sits at input index 2, whether or not
 * it carries an oracle. No oracle-free multi-data-NFT route was ever run to notice, and every route that
 * happened to carry an oracle also happened to have more than one data NFT.
 *
 * The three recovered-population files were the only ones in this suite passing the slot index; every other
 * Layer-3 file passes the master (`layout.participantInputs[0]`). All three are corrected on this branch, a
 * no-op for their live rows because every one of those has a single data NFT.
 *
 * CONTROL A PINS IT, one variable at a time. The same route is built twice, differing ONLY in that argument:
 * with the master index it SETTLES and is broadcast; with the slot index it is refused at input index 2, the
 * index X136 recorded and attributed to the oracle.
 *
 * WHAT THE ORACLE STAGING IS ACTUALLY FOR. The injected registers are ORDINARY state variables in ordinary
 * data NFTs - no oracle covenant, no separate address, no side-car UTXO. But a pre-state that never NAMES them
 * encodes `__block_timestamp` as 0 and `__blockOracleOwner` as 33 zero bytes, and the route recomputes neither.
 * `withBlockOracle` reads the registers off the contract's OWN published state layout and seeds them; CONTROL
 * B drops each register on its own, everything else held identical, and reads the verdict and failing input
 * index per register. Both walls had to fall for any of these rows to run.
 *
 * A THIRD THING THE STAGING NEEDED: A REAL TRANSACTION ORIGIN. A transcript that declares a root caller is
 * pinned by the projection to `tx.origin`, which the compiler emits as a scan for the first NON-TOKEN input
 * whose locking bytecode is a bare 25-byte `76a914..88ac`. The harness's `p2pkh` fixture is a CONTRACT, so its
 * inputs are p2sh and the scan matches nothing, fails its own closing OP_VERIFY, and aborts the PROJECTION
 * input - at index 9, nowhere near the participant covenant. Rows that declare a caller are funded from a bare
 * P2PKH address here. Without it no `onlyOwner`-shaped handler is reachable at all.
 *
 * WHAT THIS FILE ESTABLISHES.
 *
 *  1. `StakingRewards.setRewardsDuration(uint256)` SETTLES - `onlyOwner`, behind `finishAt < block.timestamp`,
 *     with FOUR data NFTs co-spent and rebuilt and THREE sorted-mapping ENTRY NFTs riding the same block.
 *  2. `UniswapV2Pair.initialize(address,address)` SETTLES - TWO fields written, four data NFTs, a
 *     three-mapping layout, behind `msg.sender == factory`.
 *  3. `CrowdFund.count()` SETTLES - the row recorded as refused at input 2.
 *  4. THE WRITE IS REAL, READ OFF THE COVENANT, ONE SLOT AT A TIME, by the sentinel method X177 introduced:
 *     each data NFT slot is probed with a commitment the covenant cannot have computed, so the route's own
 *     comparison hands back the commitment IT computed. `buildInitialStateCommitments` is used afterwards
 *     only to say WHICH state those bytes are.
 *  5. THE UNTOUCHED-DATA-NFT HOSTILE FINALLY HAS A SUBJECT. `Counter.inc` cannot test it - it has one data
 *     NFT. Here a data NFT the handler does NOT write is moved one bit and the route refuses at input 0, so
 *     the covenant pins EVERY data NFT in its block and not only the slot it writes.
 *  6. THE ENTRY SLOTS ARE AUTHENTICATED. A co-spent sorted-collection entry NFT moved one bit is refused at
 *     input 0, so the three mapping entry NFTs are checked rather than merely present.
 *
 * WHAT IS NOT ESTABLISHED, and it bounds every sentence above.
 *
 *  - EIGHT handlers of the 206 gain VM evidence here - three subjects and five read-only siblings, each its
 *    own broadcast transaction, each checked against X160's own gained list below. 198 of the 206 are NOT
 *    proved by this file, and most of them are not proved anywhere. Nothing here speaks for a handler this
 *    file does not run.
 *  - `EnglishAuction`'s read surface is STILL unproven. Its route aborts at a fixed instruction pointer before
 *    any handler dispatch; three different handlers and a fully ZEROED pre-state all stop at the same pointer,
 *    so the abort is neither the handler nor the declared state - and this file does not say what it is.
 *    That is not evidence the covenant rejects the shape, and not evidence it accepts it.
 *  - SEMANTIC PROFILE ONLY, and the numbers are printed. `UniswapV2Pair` is 17,224 bytes and `StakingRewards`
 *    12,972 against BCH's 10,000-byte input-script limit; the compiler emits its own error for both. These
 *    routes execute only because `createLayer3SemanticTestProvider` relaxes `maximumInputBytes`. A real node
 *    would refuse these inputs on SIZE before running a single opcode. Nothing here is deployability, relay
 *    or consensus-fit evidence.
 *  - No recovered writer over a DYNAMIC string or an unbounded chunk collection is run here or anywhere.
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
   *  - `unproven`  the route aborts before it publishes anything, and this file could not isolate why. NOT
   *                evidence in either direction, and the abort is measured rather than described.
   */
  verdict: 'settles' | 'reads' | 'unproven';
}

/**
 * The two token addresses `initialize` writes. They are 25-byte P2PKH-shaped locking bytecodes rather than
 * p2sh32: `UniswapV2Pair` packs seven fields into data NFT 0 and the post state has to fit the layout's own
 * 128-byte commitment limit, which two 35-byte addresses would blow.
 */
const TOKEN0 = hexToBin(`76a914${'a0'.repeat(20)}88ac`);
const TOKEN1 = hexToBin(`76a914${'b1'.repeat(20)}88ac`);

const ROWS: readonly Row[] = [
  {
    key: 'defi/staking-rewards/StakingRewards.sol::StakingRewards.setRewardsDuration',
    shape: 'FOUR data NFTs plus THREE co-spent sorted-mapping ENTRY slots, behind a block-oracle guard',
    file: `${SBE}/defi/staking-rewards/StakingRewards.sol`,
    contract: 'StakingRewards',
    writer: 'setRewardsDuration',
    writerArgs: [86_400n],
    guards: [
      { name: 'duration', args: [] }, { name: 'rewardRate', args: [] },
      { name: 'balanceOf', args: [hexToBin(PKH_CALLER)] },
      { name: 'earned', args: [hexToBin(PKH_CALLER)] },
      { name: 'finishAt', args: [] }, { name: 'lastTimeRewardApplicable', args: [] },
      { name: 'owner', args: [] }, { name: 'rewardPerToken', args: [] },
      { name: 'rewardPerTokenStored', args: [] },
      { name: 'rewardsToken', args: [] }, { name: 'stakingToken', args: [] },
      { name: 'totalSupply', args: [] }, { name: 'updatedAt', args: [] },
    ],
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
    shape: 'read surface of a THREE-data-NFT oracle contract - unblocked by X199',
    file: `${SBE}/app/english-auction/EnglishAuction.sol`,
    contract: 'EnglishAuction',
    writer: 'highestBid',
    writerArgs: [],
    guards: [{ name: 'endAt', args: [] }, { name: 'started', args: [] }],
    // X199 CLOSED THE ABORT THIS ROW WAS BLOCKED ON, and the abort was never the covenant. `bid()` is payable
    // and REFUSED by route synthesis, but the SDK computed its value mode over EVERY PUBLISHED handler while
    // the compiler computed the route's over the ELIGIBLE ones - so the SDK wrote a `01` header byte into a
    // route demanding `00`, and every row aborted in the preamble before any dispatch. Both sides now compute
    // `eligible && usesMsgValue`. The row moves from `unproven` to the full settle-and-hostile battery.
    verdict: 'reads',
    rootCaller: 'pkh',
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
    writerArgs: [TOKEN0, TOKEN1],
    guards: [
      { name: 'token0', args: [] }, { name: 'kLast', args: [] },
      { name: 'DOMAIN_SEPARATOR', args: [] }, { name: 'factory', args: [] },
      { name: 'getReserves', args: [] },
      { name: 'price0CumulativeLast', args: [] }, { name: 'price1CumulativeLast', args: [] },
      { name: 'token1', args: [] }, { name: 'totalSupply', args: [] },
    ],
    verdict: 'settles',
    // `require(msg.sender == factory)`, so the factory field is the harness's own transaction origin.
    rootCaller: 'pkh',
    oracleTimestamp: 1_700_000_000n,
    pre: {
      totalSupply: 0n,
      DOMAIN_SEPARATOR: new Uint8Array(32),
      factory: hexToBin(PKH_CALLER),
      token0: new Uint8Array(0),
      token1: new Uint8Array(0),
      reserve0: 0n,
      reserve1: 0n,
      blockTimestampLast: 0n,
      price0CumulativeLast: 0n,
      price1CumulativeLast: 0n,
      kLast: 0n,
      unlocked: 1n,
    },
    post: { token0: TOKEN0, token1: TOKEN1 },
    blockSize: 6,
    slots: ['master', 'dataNft', 'dataNft', 'dataNft', 'dataNft', 'returnEvent'],
  },
];

/** The BCH consensus limit on an input script. A contract above it is invalid at every spend. */
const INPUT_SCRIPT_LIMIT = 10_000;

/**
 * WHICH HANDLERS THE REPAIR GAINED, quoted from `Layer3RecoveredPartitionX160.test.ts`'s own PARTITION rows so
 * the count below is checkable against its source rather than asserted here.
 *
 * A gained handler is one in a row's `after` list and not in its `before` list. `UniswapV2Pair` and
 * `StakingRewards` are `set: 'NEW'` with `before: []`, so their whole surface is gained; `CrowdFund` is set A
 * with `before: ['pledgedAmount']`; `EnglishAuction` is set A with `before: ['bids']`.
 *
 * This is a CITATION, not a re-measurement. This file does not re-take the partition, and if X160's rows move
 * this constant is stale.
 */
const GAINED_BY_THE_REPAIR: Readonly<Record<string, readonly string[]>> = {
  UniswapV2Pair: [
    'getReserves', 'initialize', 'totalSupply', 'DOMAIN_SEPARATOR', 'factory', 'token0', 'token1',
    'price0CumulativeLast', 'price1CumulativeLast', 'kLast', 'balanceOf', 'allowance', 'nonces',
  ],
  StakingRewards: [
    'lastTimeRewardApplicable', 'rewardPerToken', 'earned', 'setRewardsDuration', 'stakingToken',
    'rewardsToken', 'owner', 'duration', 'finishAt', 'updatedAt', 'rewardRate', 'rewardPerTokenStored',
    'totalSupply', 'userRewardPerTokenPaid', 'rewards', 'balanceOf',
  ],
  CrowdFund: ['token', 'count'],
  EnglishAuction: [
    'nft', 'nftId', 'seller', 'endAt', 'started', 'ended', 'highestBidder', 'highestBid',
  ],
};

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
      const bytes = scriptToBytecode(asmToScript(artifact.bytecode)).length;
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
  /**
   * HOW MANY OF THE 206, and no rounding. Every handler this file runs to a BROADCAST settlement is checked
   * against X160's own gained list, so the figure is a count of named rows rather than an impression.
   */
  it('MEASURED: how many of the 206 gained handlers this file settles on the VM', () => {
    const settled: string[] = [];
    const notSettled: string[] = [];
    for (const row of ROWS) {
      const gained = GAINED_BY_THE_REPAIR[row.contract] ?? [];
      for (const handler of [row.writer, ...row.guards.map((g) => g.name)]) {
        const label = `${row.contract}.${handler}`;
        if (!gained.includes(handler)) continue;
        (row.verdict === 'unproven' ? notSettled : settled).push(label);
      }
    }
    for (const handler of settled) console.log(`[X180] SETTLED ON THE VM: ${handler}`);
    for (const handler of notSettled) console.log(`[X180] STILL UNPROVEN: ${handler}`);
    console.log(`[X180] ${settled.length} gained handlers settle here; ${206 - settled.length} of the 206 `
      + 'are NOT proved by this file, and most of them are not proved anywhere.');
    // X199 ADDED THE ENGLISHAUCTION THREE. They were recorded here as `unproven` because every handler on the
    // route aborted in the preamble at one pointer, before any dispatch - which this file measured carefully
    // and correctly declined to attribute. The cause was not the covenant: the SDK wrote a `01` logical-value
    // header into a route demanding `00`, because it computed value mode over EVERY PUBLISHED handler while
    // the compiler computed the route's over the ELIGIBLE ones, and `bid()` is payable and refused. With both
    // sides on `eligible && usesMsgValue` the row runs the full settle-and-hostile battery.
    expect(settled).toEqual([
      'StakingRewards.setRewardsDuration', 'StakingRewards.duration', 'StakingRewards.rewardRate',
      'StakingRewards.balanceOf', 'StakingRewards.earned', 'StakingRewards.finishAt',
      'StakingRewards.lastTimeRewardApplicable', 'StakingRewards.owner', 'StakingRewards.rewardPerToken',
      'StakingRewards.rewardPerTokenStored', 'StakingRewards.rewardsToken',
      'StakingRewards.stakingToken', 'StakingRewards.totalSupply', 'StakingRewards.updatedAt',
      'CrowdFund.count', 'CrowdFund.token',
      'EnglishAuction.highestBid', 'EnglishAuction.endAt', 'EnglishAuction.started',
      'UniswapV2Pair.initialize', 'UniswapV2Pair.token0', 'UniswapV2Pair.kLast',
      'UniswapV2Pair.DOMAIN_SEPARATOR', 'UniswapV2Pair.factory', 'UniswapV2Pair.getReserves',
      'UniswapV2Pair.price0CumulativeLast', 'UniswapV2Pair.price1CumulativeLast',
      'UniswapV2Pair.token1', 'UniswapV2Pair.totalSupply',
    ]);
    expect(notSettled).toEqual([]);
  }, 1_800_000);

  /** The contract's real redeem-script length. `artifact.bytecode` is ASM, so it is assembled, not divided. */
  const scriptBytes = (row: Row): number =>
    scriptToBytecode(asmToScript(artifactForLayout(row).bytecode)).length;

  it('MEASURED: what these subjects would cost a real node - the ones over the input-script limit', () => {
    for (const row of ROWS) {
      const bytes = scriptBytes(row);
      const over = bytes - INPUT_SCRIPT_LIMIT;
      console.log(`[X180] SIZE ${row.contract}: ${bytes} bytes, `
        + `${over > 0 ? `OVER the ${INPUT_SCRIPT_LIMIT}-byte input-script limit by ${over}` : 'within limit'}`);
    }
    // The relaxed-capacity profile is what lets the two big routes execute at all. Saying so with a number is
    // the difference between "settles" and "settles, and a real node would refuse the input on size alone".
    const over = ROWS.filter((row) => scriptBytes(row) > INPUT_SCRIPT_LIMIT);
    console.log(`[X180] ${over.length} of ${ROWS.length} subjects exceed the BCH input-script limit `
      + `(${over.map((row) => row.contract).join(', ')}), so THEIR settlements are SEMANTIC evidence under `
      + 'the relaxed profile and NOT deployability evidence.');
    expect(over.length).toBeGreaterThan(0);
  }, 1_800_000);

  /**
   * One attempt at one recovered route.
   *
   * `probe` traces the attempt under the VM debugger and never broadcasts it. `oracle: false` stages the row
   * with the oracle registers OMITTED - the old staging - and is the control that pins the wall.
   */
  async function attempt(row: Row, handler: string, args: readonly unknown[], attack: Attack, options: {
    probe?: boolean; declaredResult?: Uint8Array; publishedState?: readonly string[]; oracle?: boolean;
    entryOverride?: { slot: number; commitment: string }; legacyMasterIndex?: boolean;
    preOverride?: Record<string, unknown>;
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
    const pre = options.preOverride
      ?? (options.oracle === false ? row.pre : stagedPre(row, artifact));
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
    const bareOrigin = row.rootCaller === 'pkh';
    await provider.addUtxo(p2pkh.address, returnFunding);
    await provider.addUtxo(bareOrigin ? aliceAddress : p2pkh.address, fee);

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
          // THE SECOND ARGUMENT IS THE MASTER'S INPUT INDEX, NOT THE DATA NFT'S SLOT. The data NFT covenant's
          // write path reads `tx.inputs[masterInputIndex]` and requires a MINTING NFT there; the master sits
          // at block slot 0. `legacyMasterIndex` reproduces the recovered-writer harness's argument - the slot
          // index - which is only ever the master for slot 0 and is what refused every 2+ data NFT route.
          tx.addInput(
            setup.dataNftUtxos[index],
            createDataNftUnlocker(participant, options.legacyMasterIndex === true ? index : 0, setup.categoryId),
          );
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
    // THE TRANSACTION ORIGIN, and it is the second half of the block-oracle staging story.
    //
    // The projection pins a declared root caller to `tx.origin`, which the compiler emits as a scan for the
    // first NON-TOKEN input whose locking bytecode is a 25-byte `76a914..88ac` - a BARE P2PKH. The harness's
    // `p2pkh` fixture is a CONTRACT, so its inputs are p2sh and the scan matches nothing; the scan then fails
    // its own final OP_VERIFY and the PROJECTION input aborts. Nothing about the participant covenant is
    // involved. So a row that declares a caller is funded from a bare P2PKH address and spends it with a
    // plain signature; a row that declares none never evaluates `tx.origin` and keeps the contract fee input.
    tx.addInput(fee, bareOrigin ? signature().unlockP2PKH() : p2pkh.unlock.spend(alicePub, signature()));
    tx.addOutput({ to: bareOrigin ? aliceAddress : p2pkh.address, amount: 350_000n });

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
  interface Abort { ip: number; ops: string; steps: number; error: string }

  /**
   * WHERE a probe stopped, not just that it did.
   *
   * A route that aborts before its return-event check publishes no result, and X136 recorded exactly that for
   * `EnglishAuction` without being able to say where. This reads the abort off the trace: the instruction
   * pointer, the eight instructions leading to it with any pushed data, and the VM's own error string. Two
   * aborts with the same `ip` are the same abort, which is what makes "every handler stops in the same place"
   * a measurement.
   */
  function abortOf(trace: unknown[]): Abort {
    const last = trace[trace.length - 1] as {
      error?: string; ip?: number; instructions?: Array<{ opcode: number; data?: Uint8Array }>;
    };
    const ip = last.ip ?? -1;
    const ops = (last.instructions ?? []).slice(Math.max(0, ip - 8), ip + 1)
      .map((instruction) => `${instruction.opcode.toString(16).padStart(2, '0')}`
        + `${instruction.data ? `(${binToHex(instruction.data)})` : ''}`).join(' ');
    return { ip, ops, steps: trace.length, error: last.error ?? 'no error recorded' };
  }

  /** The result the route computed, or the abort that stopped it before it computed one. */
  async function probeOutcome(row: Row, handler: string, args: readonly unknown[], options: {
    preOverride?: Record<string, unknown>;
  } = {}): Promise<{ result?: Uint8Array; abort?: Abort }> {
    const probe = await attempt(row, handler, args, 'none', { probe: true, ...options });
    const found = operandComparedAgainst(probe.trace!, PROBE_RESULT);
    return found === undefined ? { abort: abortOf(probe.trace!) } : { result: found };
  }

  const cachedResult = new Map<string, Uint8Array>();
  async function routeResult(row: Row, handler: string, args: readonly unknown[]): Promise<Uint8Array> {
    const key = `${row.key}|${handler}`;
    if (!cachedResult.has(key)) {
      const outcome = await probeOutcome(row, handler, args);
      if (outcome.result === undefined) {
        const abort = outcome.abort!;
        console.log(`[X180] ${key} ABORT ip=${abort.ip} steps=${abort.steps} ops=${abort.ops}`);
        throw new Error(`${key}: the probe trace never compared the declared result `
          + `(stopped after ${abort.steps} steps at ip ${abort.ip}: ${abort.error})`);
      }
      cachedResult.set(key, outcome.result);
      console.log(`[X180] ${key} result off its own trace: ${binToHex(outcome.result)}`);
    }
    return cachedResult.get(key)!;
  }

  /** The PRE commitments, from the layout, used only to say WHICH state the covenant's own bytes are. */
  function preCommitmentsOf(row: Row): string[] {
    const artifact = artifactForLayout(row);
    return buildInitialStateCommitments(artifact.stateLayout!, stagedPre(row, artifact));
  }

  /**
   * CONTROL A: THE WALL, AND IT IS NOT THE ORACLE.
   *
   * The identical route, differing from the settling subject in EXACTLY ONE argument - the master input index
   * handed to the data NFT covenant - is refused, at input index 2, the SECOND data NFT. That index is the
   * reading `Layer3RecoveredSetAX136` recorded for `CrowdFund.count` and attributed to the block oracle.
   *
   * The covenant's write path reads `tx.inputs[masterInputIndex]` and requires a MINTING NFT there. The
   * recovered-writer harnesses pass the data NFT's own SLOT index instead, which names the master only for
   * slot 0 - so every route with two or more data NFTs was refused at input 2 whether or not it carried an
   * oracle, and no oracle-free multi-NFT route was ever run to notice.
   */
  const legacyMasterIndexControl = (row: Row) => async (): Promise<void> => {
    const subject = await attempt(row, row.writer, row.writerArgs, 'none', {
      publishedState: row.verdict === 'settles' ? await covenantPostState(row) : undefined,
      declaredResult: row.verdict === 'reads'
        ? await routeResult(row, row.writer, row.writerArgs) : undefined,
    });
    expect(subject.refusal, `${row.key}: the subject arm of this control did not settle`).toBeUndefined();
    const control = await attempt(row, row.writer, row.writerArgs, 'none', {
      publishedState: row.verdict === 'settles' ? await covenantPostState(row) : undefined,
      declaredResult: row.verdict === 'reads'
        ? await routeResult(row, row.writer, row.writerArgs) : undefined,
      legacyMasterIndex: true,
    });
    console.log(`[X180] ${row.key} CONTROL-A subject (masterInputIndex=0) SETTLED ${subject.sent}`);
    console.log(`[X180] ${row.key} CONTROL-A control (masterInputIndex=slot): `
      + `${(control.refusal ?? `ACCEPTED ${control.sent}`).split('\n')[0]}`);
    expect(control.sent, `${row.key} settled with the legacy master index - it is not the wall`).toBeUndefined();
    expect(control.refusal).toMatch(/OP_VERIFY|mandatory-script-verify-flag-failed|non-truthy/);
    console.log(`[X180] ${row.key} CONTROL-A refused at input index ${control.failingInput}`);
    expect(control.failingInput, 'the refusal did not name the SECOND data NFT input').toBe(2);
  };

  /**
   * CONTROL B: WHAT THE ORACLE STAGING IS ACTUALLY FOR, ONE REGISTER AT A TIME.
   *
   * Omitting all the registers at once and reading a refusal would say nothing about WHICH one mattered. So
   * each injected register is dropped on its own - left at the encoder's zero, which is exactly what a
   * pre-state that never named it produces - with every other field, the master input index and the published
   * commitments identical to the settling subject. The verdict and the failing INPUT INDEX are printed per
   * register, and the run asserts what it measured: the registers are load-bearing, and the whole-oracle
   * omission is refused at the PARTICIPANT input rather than at the data NFT the earlier files blamed.
   */
  const oracleRegisterControl = (row: Row) => async (): Promise<void> => {
    const artifact = artifactForLayout(row);
    const registers = blockOracleRegisters(artifact.stateLayout);
    const seededPre = stagedPre(row, artifact);
    const omitted = buildInitialStateCommitments(artifact.stateLayout!, row.pre);
    const seeded = preCommitmentsOf(row);
    const differing = seeded
      .map((value, index) => (value === omitted[index] ? '.' : index)).filter((entry) => entry !== '.');
    console.log(`[X180] ${row.key} CONTROL-B registers=${JSON.stringify(registers.map((r) => r.name))}`);
    console.log(`[X180] ${row.key} CONTROL-B omitted  ${JSON.stringify(omitted)}`);
    console.log(`[X180] ${row.key} CONTROL-B seeded   ${JSON.stringify(seeded)}`);
    console.log(`[X180] ${row.key} CONTROL-B data NFT slots that differ: ${JSON.stringify(differing)}`);
    // The two stagings must differ ONLY in the oracle registers' own NFTs, which is what makes this a control.
    expect(differing.sort()).toEqual([...new Set(registers.map((r) => r.nftIndex))].sort());
    let refusedByOneRegister = 0;
    for (const register of registers) {
      const preOverride = { ...seededPre };
      delete preOverride[register.name];
      const result = await attempt(row, row.writer, row.writerArgs, 'none', { preOverride });
      console.log(`[X180] ${row.key} CONTROL-B drop ${register.name} (nft ${register.nftIndex}): `
        + `${(result.refusal ?? `ACCEPTED ${result.sent}`).split('\n')[0]} `
        + `at input ${result.failingInput ?? '-'}`);
      if (result.refusal !== undefined) {
        refusedByOneRegister += 1;
        expect(result.refusal).toMatch(/OP_VERIFY|mandatory-script-verify-flag-failed|non-truthy/);
        expect(result.failingInput, `${register.name}: the refusal did not name the participant input`).toBe(0);
      }
    }
    expect(refusedByOneRegister, `${row.key}: no single oracle register changed the verdict, so seeding them `
      + 'is not what this staging bought').toBeGreaterThan(0);
    const all = await attempt(row, row.writer, row.writerArgs, 'none', { oracle: false });
    console.log(`[X180] ${row.key} CONTROL-B drop ALL: `
      + `${(all.refusal ?? `ACCEPTED ${all.sent}`).split('\n')[0]} at input ${all.failingInput ?? '-'}`);
    expect(all.sent, `${row.key} settled with every oracle register omitted`).toBeUndefined();
    expect(all.refusal).toMatch(/OP_VERIFY|mandatory-script-verify-flag-failed|non-truthy/);
    // The index is the whole point: X136 read a refusal at the ORACLE DATA NFT and blamed the oracle. Staged
    // correctly, an oracle-shaped refusal names input 0 - the participant - and never a data NFT.
    expect(all.failingInput, 'the refusal did not name the participant input').toBe(0);
  };

  /**
   * AN ABORT THIS FILE COULD NOT ISOLATE, STATED AS SUCH.
   *
   * `EnglishAuction`'s route stops before it publishes anything, so there is nothing to attack and nothing to
   * settle. What CAN be measured is that the abort is not the row's declared state and not the caller shape:
   *
   *  - EVERY handler tried stops at the SAME instruction pointer, and that pointer is reached before any
   *    handler-specific dispatch, so it is a property of the route preamble and not of `highestBid`.
   *  - A FULLY ZEROED pre-state - the suspected cause removed entirely - aborts at the same pointer. That is
   *    the method `Layer3RecoveredVoidWriterX177` earned the hard way: a shape that refuses is only evidence
   *    once the refusal survives deleting what you think caused it.
   *
   * So this row is NOT evidence that the covenant rejects a three-data-NFT oracle read surface, and it is not
   * evidence that it accepts one. What it would take to close: mapping this instruction pointer back through
   * the route's source map to the `require` it belongs to, which this file does not do.
   */
  const unresolvedAbort = (row: Row) => async (): Promise<void> => {
    const aborts: Array<{ what: string; abort: Abort }> = [];
    for (const handler of [row.writer, ...row.guards.map((g) => g.name)]) {
      const outcome = await probeOutcome(row, handler, []);
      expect(outcome.result, `${row.key}/${handler} reached its return check - this row is no longer unproven`)
        .toBeUndefined();
      aborts.push({ what: handler, abort: outcome.abort! });
    }
    // The suspected cause REMOVED: no declared state at all, every field left at the encoder's zero.
    const zeroed = await probeOutcome(row, row.writer, [], { preOverride: {} });
    expect(zeroed.result, `${row.key}: a zeroed pre-state reached the return check`).toBeUndefined();
    aborts.push({ what: 'ZEROED pre-state', abort: zeroed.abort! });
    for (const entry of aborts) {
      console.log(`[X180] ${row.key} ABORT (${entry.what}): ip=${entry.abort.ip} `
        + `steps=${entry.abort.steps} error=${entry.abort.error}`);
    }
    console.log(`[X180] ${row.key} ABORT ops[ip-8..ip]=${aborts[0].abort.ops}`);
    const pointers = [...new Set(aborts.map((entry) => entry.abort.ip))];
    console.log(`[X180] ${row.key} distinct abort pointers across `
      + `${aborts.length} attempts: ${JSON.stringify(pointers)}`);
    expect(pointers, `${row.key}: the abort moved, so it IS a function of the handler or the declared state`)
      .toHaveLength(1);
    expect(aborts.every((entry) => /OP_VERIFY/.test(entry.abort.error))).toBe(true);
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
    if (row.verdict === 'unproven') {
      it(`MEASURED: ${row.key} ABORTS in its route preamble - no VM subject, and this file cannot say why`,
        unresolvedAbort(row), 1_800_000);
      continue;
    }
    it(`CONTROL A: ${row.key} with the legacy master input index is REFUSED at the second data NFT`,
      legacyMasterIndexControl(row), 1_800_000);
    it(`CONTROL B: ${row.key} with each oracle register dropped on its own`,
      oracleRegisterControl(row), 1_800_000);
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
