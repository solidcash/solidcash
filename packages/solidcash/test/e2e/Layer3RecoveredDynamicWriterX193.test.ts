import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeAuthenticationInstructions, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { asmToScript, buildInitialStateCommitments, scriptToBytecode } from '@solidcash/utils';
import { compileFile, compileFileMulti, compileString } from 'solidc';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../src/utils.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';
import { aliceAddress, alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createDataNftUnlocker, getDataNftAddress } from '../../src/stateful/covenant-helpers.js';
import type { Utxo } from '../../src/interfaces.js';

/**
 * X193. IS THERE A CHUNK-BACKED WRITER IN THE 206? NO - AND THE TWO SETS ARE DISJOINT, MEASURED BOTH WAYS.
 *
 * The recovered population's open shape was "a writer over a DYNAMIC STRING or an unbounded chunk collection".
 * `Layer3RecoveredOracleWriterX180` recorded that no such writer is run "here or anywhere" and that none exists
 * "in the eleven"; neither statement is a measurement over the POPULATION. This file takes it.
 *
 * THE MEASUREMENT, and it is checked in BOTH directions rather than by scanning one list.
 *
 *   - Compile every partition row whose gained handlers include one the partition records under `writes`, and
 *     read `stateLayout.variables` for `dynamic: true` - the flag the compiler sets for a `string` / unbounded
 *     `bytes` living in chunk UTXOs. All ten rows carry NONE.
 *   - Compile every row that HAS a `dynamic: true` variable - nine of them - and read each GAINED handler's ABI
 *     `writesState`. All 56 are `false`.
 *
 * So the writer set and the chunk-backed set do not intersect. Not "no subject was built" - no subject EXISTS
 * to build. The gained lists are quoted from `Layer3RecoveredPartitionX160`'s own partition, and that matters:
 * a first draft of this file guessed `MarketplaceV1`'s and the direction-two assertion went RED on two handlers
 * that are not gained at all. The row set is the discriminating subset of a sweep over all 54 gained-bearing
 * rows, which reports the same disjointness with zero compile failures.
 *
 * WHAT THAT DOES NOT SAY. Chunk-backed READS are already VM-proved elsewhere - `Layer3RecoveredSetAX136`
 * settles `MyToken.name` and `MyToken.symbol` across the 64 trailing slots. The gap this file closes is the
 * question, not a subject: the shape has no member in this population, so no run can produce one.
 *
 * AND FOUR RECOVERED SHAPES WITH NO SUBJECT BEFORE, chosen to be unlike the eight X180 covered.
 *
 *  1. `DutchAuction` - four gained handlers on a THREE-data-NFT block-oracle contract, including `getPrice`,
 *     which COMPUTES from the injected `__block_timestamp` register rather than returning a stored field.
 *     Blocked until now by exactly the X192 defect: `buy()` is payable, INELIGIBLE, and its published
 *     `usesMsgValue` makes the SDK write an SCB1 header byte the compiled route refuses. The per-row control
 *     builds it both ways and asserts the participant script is the same in each.
 *  2. `ReEntrancy.Attack` - the same X192 class at one data NFT, with a CONTRACT-TYPED state variable.
 *  3. `ContractSize.Target` - `isContract` SETTLES, and its writer sibling `protected` is FAIL-CLOSED with the
 *     reason isolated. See below; this is the file's second finding.
 *  4. `TestTransientStorage.val` - the population's minimum: a TWO-slot block, master plus return event, with
 *     no data NFT at all. `Layer3RecoveredAbsentWritersX177` proved structurally that it cannot mutate and said
 *     plainly it is "not run to completion anywhere". It is now.
 *
 * THE SECOND FINDING: `.code` HAS NO `false` ANSWER, AND IT CLOSES A RECOVERED WRITER.
 *
 * `isContract(account)` lowers to `account.code.length > 0`, and `.code` is emitted as a P2SH extractor which
 * VERIFIES the locking bytecode is 23 bytes (p2sh20) or 35 (p2sh32) before splitting out the redeem script. A
 * discriminating pair moving ONE argument pins it: `isContract(<35-byte p2sh32>)` settles and answers;
 * `isContract(<25-byte p2pkh>)` is refused at input 0, inside that VERIFY. A non-P2SH address does not get a
 * zero size, it gets an abort.
 *
 * That closes `Target.protected`, one of the eleven recovered writers, in BOTH directions: its body is
 * `require(!isContract(msg.sender)); pwned = true;`, `msg.sender` on the bus is a locking bytecode, a bare
 * P2PKH caller is the shape `.code` refuses, and a P2SH caller would make `isContract` true and fail the
 * require. The abort pointer is read off the trace, is five frames deep in that accessor, and does not move
 * when the declared caller does. Its read-only sibling `pwned` settles through the identical staging, so the
 * refusal is of the handler and not of a harness that never worked.
 *
 * THIS IS FAIL-CLOSED, NOT AN EXPLOIT. Nothing is accepted here that should be refused. What it costs is one
 * of the eleven writers: `Target.protected` cannot settle for any caller shape, and this file says so with the
 * check named rather than recording an unexplained refusal.
 *
 * WHAT THIS FILE DOES NOT ESTABLISH.
 *
 *  - NINE gained handlers settle here. 197 of the 206 are NOT proved by this file, and most of them are not
 *    proved anywhere.
 *  - The X192 correction is applied as an SDK-side ENCODER input, by clearing `usesMsgValue` on handlers route
 *    synthesis REFUSED. It moves no compiled byte - each affected row asserts the two arms share the
 *    participant script - and it is not a compiler fix. Rows 1 and 2 settle only with it applied.
 *  - Nothing here says whether `.code`'s P2SH requirement is correct. It is measured, its consequence for one
 *    recovered writer is measured, and the disposition is left to the owner of that codegen.
 *  - All four subjects are WITHIN the 10,000-byte input-script limit, printed per row. Unlike X180's
 *    `UniswapV2Pair` and `StakingRewards`, none of these settlements depends on the relaxed profile for size.
 */

const SBE = `${process.env.SBE_ROOT ?? '/Code/solidity-by-example'}/contracts/src`;
const EACC = process.env.EACC_CONTRACTS_DIR ?? '/Code/effectiveacceleration.ai/contract/contracts';
const MISTSWAP = `${process.env.MISTSWAP_ROOT ?? '/Code/mistswap/mistswap'}/contracts`;

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));

const BUS = {
  solidityImportCompat: true,
  ecrecover: 'p2pkh',
  forceStateful: true,
  experimentalHiddenBatch: true,
};

/** The layout-only controller. Its bytes never reach a transaction; it exists to make a compile reproducible. */
const LAYOUT_CONTROLLER = `aa20${'11'.repeat(32)}87`;
const LAYOUT_CATEGORY = '22'.repeat(32);

const CONTROLLER_GENESIS_TXID = 'c1'.repeat(32);
const PROBE_RESULT = hexToBin('9e'.repeat(32));
const PKH_CALLER = `76a914${binToHex(alicePkh as unknown as Uint8Array)}88ac`;
const INPUT_SCRIPT_LIMIT = 10_000;

/** Two addresses that differ ONLY in locking-bytecode shape: 35-byte p2sh32 against 25-byte p2pkh. */
const P2SH32_ADDRESS = hexToBin(`aa20${'7e'.repeat(32)}87`);
const P2PKH_ADDRESS = hexToBin(`76a914${'7e'.repeat(20)}88ac`);

/**
 * THE DISCRIMINATING ROW SET for the disjointness measurement, named from `Layer3RecoveredPartitionX160`'s own
 * partition rather than chosen: `WRITER_ROWS` is every row whose gained handlers include one the partition
 * records under `writes`, and `DYNAMIC_ROWS` is every row this sweep found carrying a `dynamic: true` variable.
 */
const WRITER_ROWS: ReadonlyArray<{ file: string; contract: string; handlers: readonly string[] }> = [
  { file: `${MISTSWAP}/uniswapv2/UniswapV2Factory.sol`, contract: 'UniswapV2Pair', handlers: ['initialize'] },
  {
    file: `${SBE}/defi/staking-rewards/StakingRewards.sol`,
    contract: 'StakingRewards',
    handlers: ['setRewardsDuration'],
  },
  { file: `${SBE}/fallback/FallbackInputOutput.sol`, contract: 'Counter', handlers: ['inc'] },
  { file: `${SBE}/hacks/contract-size/ContractSize.sol`, contract: 'Target', handlers: ['protected'] },
  { file: `${SBE}/hacks/delegatecall/Delegatecall_2.sol`, contract: 'Lib', handlers: ['doSomething'] },
  {
    file: `${SBE}/hacks/hiding-malicious-code-with-external-contract/ExternalContract.sol`,
    contract: 'Bar',
    handlers: ['log'],
  },
  {
    file: `${SBE}/hacks/hiding-malicious-code-with-external-contract/ExternalContract.sol`,
    contract: 'Foo',
    handlers: ['callBar'],
  },
  { file: `${SBE}/hacks/phishing-with-tx-origin/TxOrigin.sol`, contract: 'Attack', handlers: ['attack'] },
  { file: `${SBE}/hashing/Keccak256.sol`, contract: 'HashFunction', handlers: ['hash', 'collision'] },
  {
    file: `${SBE}/transient-storage/TransientStorage.sol`,
    contract: 'TestTransientStorage',
    handlers: ['val'],
  },
];

const DYNAMIC_ROWS: ReadonlyArray<{ file: string; contract: string; gained: readonly string[] }> = [
  {
    file: `${EACC}/EACCToken.sol`,
    contract: 'EACCToken',
    gained: ['name', 'symbol', 'decimals', 'totalSupply', 'DOMAIN_SEPARATOR', 'eip712Domain'],
  },
  {
    file: `${EACC}/MarketplaceV1.sol`,
    contract: 'MarketplaceV1',
    gained: ['marketplaceData', 'version', 'unicrowAddress', 'unicrowDisputeAddress',
      'unicrowArbitratorAddress', 'treasuryAddress', 'unicrowMarketplaceFee'],
  },
  {
    file: `${EACC}/MarketplaceV2.sol`,
    contract: 'MarketplaceV2',
    gained: ['marketplaceData', 'version', 'unicrowAddress', 'unicrowDisputeAddress',
      'unicrowArbitratorAddress', 'treasuryAddress', 'unicrowMarketplaceFee', 'eaccToken', 'eaccBar',
      'eaccTokensPerToken'],
  },
  {
    file: `${EACC}/MarketplaceV3.sol`,
    contract: 'MarketplaceV3',
    gained: ['marketplaceData', 'version', 'unicrowAddress', 'unicrowDisputeAddress',
      'unicrowArbitratorAddress', 'treasuryAddress', 'unicrowMarketplaceFee', 'eaccToken', 'eaccBar',
      'eaccTokensPerToken'],
  },
  {
    file: `${EACC}/unicrow/FakeToken.sol`,
    contract: 'FakeToken',
    gained: ['name', 'symbol', 'decimals', 'totalSupply'],
  },
  {
    file: `${SBE}/app/airdrop/Token.sol`,
    contract: 'Token',
    gained: ['totalSupply', 'name', 'symbol', 'decimals', 'balanceOf', 'allowance', 'authorized'],
  },
  {
    file: `${SBE}/app/erc20/ERC20.sol`,
    contract: 'ERC20',
    gained: ['totalSupply', 'name', 'symbol', 'decimals', 'balanceOf', 'allowance'],
  },
  {
    file: `${SBE}/app/erc20/MyToken.sol`,
    contract: 'ERC20',
    gained: ['totalSupply', 'name', 'symbol', 'decimals', 'balanceOf', 'allowance'],
  },
  {
    file: `${SBE}/app/erc20/MyToken.sol`,
    contract: 'MyToken',
    gained: ['totalSupply', 'name', 'symbol', 'decimals'],
  },
];

/**
 * WHICH HANDLERS THE REPAIR GAINED, quoted from `Layer3RecoveredPartitionX160`'s own partition rows so the
 * count below is checkable against its source rather than asserted here. All four rows are `set: 'NEW'` with
 * `before: []`, so each contract's whole published surface is gained.
 *
 * This is a CITATION, not a re-measurement. If X160's rows move, this constant is stale.
 */
const GAINED_BY_THE_REPAIR: Readonly<Record<string, readonly string[]>> = {
  DutchAuction: ['getPrice', 'nft', 'nftId', 'seller', 'startingPrice', 'startAt', 'expiresAt', 'discountRate'],
  Attack: ['getBalance', 'etherStore'],
  Target: ['isContract', 'protected', 'pwned'],
  TestTransientStorage: ['val'],
};

/** What one built attempt differs in. Exactly one field moves per hostile. */
type Attack = 'none' | 'result' | 'state-unwritten' | 'state-neighbour';

interface Row {
  key: string;
  shape: string;
  file: string;
  contract: string;
  /** The handler under test. For a `reads` row it is read-only and `post` is empty. */
  writer: string;
  writerArgs: readonly unknown[];
  /** Read-only siblings run through the identical staging as the guard negative control. */
  guards: ReadonlyArray<{ name: string; args: readonly unknown[] }>;
  pre: Record<string, unknown>;
  post: Record<string, unknown>;
  blockSize: number;
  slots: readonly string[];
  oracleTimestamp: bigint;
  rootCaller?: 'none' | 'pkh';
  /** True when the SDK's SCB1 header byte disagrees with the compiled route - the X192 class. */
  x192: boolean;
  verdict: 'settles' | 'reads';
}

const ROWS: readonly Row[] = [
  {
    key: 'app/dutch-auction/DutchAuction.sol::DutchAuction',
    shape: 'THREE data NFTs, block oracle, and a getter that COMPUTES from the injected timestamp register',
    file: `${SBE}/app/dutch-auction/DutchAuction.sol`,
    contract: 'DutchAuction',
    writer: 'getPrice',
    writerArgs: [],
    guards: [
      { name: 'startingPrice', args: [] }, { name: 'discountRate', args: [] }, { name: 'startAt', args: [] },
      { name: 'expiresAt', args: [] }, { name: 'nft', args: [] }, { name: 'nftId', args: [] },
      { name: 'seller', args: [] },
    ],
    verdict: 'reads',
    x192: true,
    oracleTimestamp: 1_700_000_000n,
    pre: {
      nft: new Uint8Array(0),
      nftId: 0n,
      seller: hexToBin(PKH_CALLER),
      // `getPrice` is `startingPrice - discountRate * (block.timestamp - startAt)`, so the three fields and the
      // oracle register together decide the answer. Staged so the discount is exactly 1,000,000.
      startingPrice: 10_000_000n,
      startAt: 1_699_999_000n,
      expiresAt: 1_700_604_800n,
      discountRate: 1_000n,
    },
    post: {},
    blockSize: 5,
    slots: ['master', 'dataNft', 'dataNft', 'dataNft', 'returnEvent'],
  },
  {
    key: 'hacks/re-entrancy/ReEntrancy.sol::Attack',
    shape: 'the X192 class at ONE data NFT, with a CONTRACT-TYPED state variable',
    file: `${SBE}/hacks/re-entrancy/ReEntrancy.sol`,
    contract: 'Attack',
    writer: 'etherStore',
    writerArgs: [],
    guards: [{ name: 'getBalance', args: [] }],
    verdict: 'reads',
    x192: true,
    oracleTimestamp: 0n,
    pre: { etherStore: hexToBin(`76a914${'3c'.repeat(20)}88ac`) },
    post: {},
    blockSize: 3,
    slots: ['master', 'dataNft', 'returnEvent'],
  },
  {
    key: 'hacks/contract-size/ContractSize.sol::Target',
    shape: 'the only recovered handler that reads `.code` - an EXTCODESIZE probe over an address ARGUMENT',
    file: `${SBE}/hacks/contract-size/ContractSize.sol`,
    contract: 'Target',
    writer: 'isContract',
    writerArgs: [P2SH32_ADDRESS],
    guards: [{ name: 'pwned', args: [] }],
    verdict: 'reads',
    x192: false,
    rootCaller: 'pkh',
    oracleTimestamp: 0n,
    pre: { pwned: false },
    post: {},
    blockSize: 3,
    slots: ['master', 'dataNft', 'returnEvent'],
  },
  {
    key: 'transient-storage/TransientStorage.sol::TestTransientStorage',
    shape: 'the population MINIMUM: a two-slot block, master plus return event, and NO data NFT at all',
    file: `${SBE}/transient-storage/TransientStorage.sol`,
    contract: 'TestTransientStorage',
    writer: 'val',
    writerArgs: [],
    guards: [],
    verdict: 'reads',
    x192: false,
    oracleTimestamp: 0n,
    pre: {},
    post: {},
    blockSize: 2,
    slots: ['master', 'returnEvent'],
  },
];

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

/** The value the ROUTE ITSELF computed, read off its own execution. Verbatim from X180. */
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

/** X160's own fallback: a file whose SIBLING does not compile still contributes its primary contract. */
function busMap(file: string, options: Record<string, unknown>): any {
  try {
    return compileFileMulti(file, options as never) as any;
  } catch {
    const one = compileFile(file, options as never) as any;
    return { [one.contractName]: one };
  }
}

describe('X193: the chunk-backed writer question, and four recovered shapes with no subject before', () => {
  const compiled = new Map<string, any>();
  function artifactOf(file: string, contract: string, controller: string, category: string): any {
    const cacheKey = `${file}|${contract}|${controller}|${category}`;
    if (!compiled.has(cacheKey)) {
      const map = busMap(file, {
        ...BUS,
        experimentalMessageBusController: controller,
        experimentalMessageBusControllerCategory: category,
      });
      const artifact = map[contract];
      if (artifact === undefined) throw new Error(`${contract} did not compile in bus mode from ${file}`);
      compiled.set(cacheKey, artifact);
    }
    return compiled.get(cacheKey);
  }
  const layoutArtifact = (row: { file: string; contract: string }): any =>
    artifactOf(row.file, row.contract, LAYOUT_CONTROLLER, LAYOUT_CATEGORY);

  const dynamicVariables = (artifact: any): string[] =>
    ((artifact.stateLayout?.variables ?? []) as any[])
      .filter((variable) => variable.dynamic === true).map((variable) => variable.name);

  /**
   * DIRECTION ONE. Every partition row whose GAINED handlers include a writer, compiled here, carries no
   * chunk-backed state variable at all.
   */
  it('MEASURED: not one recovered WRITER sits on a contract with chunk-backed state', () => {
    const carrying: string[] = [];
    for (const row of WRITER_ROWS) {
      const artifact = layoutArtifact(row);
      const dynamic = dynamicVariables(artifact);
      const collections = ((artifact.stateLayout?.collections ?? []) as any[])
        .map((collection) => `${collection.name}:${collection.kind}`);
      console.log(`[X193] WRITER ${row.contract}.${row.handlers.join('/')} `
        + `dynamic=${JSON.stringify(dynamic)} collections=${JSON.stringify(collections)} `
        + `dataNfts=${artifact.stateLayout?.dataNftCount}`);
      // The handler really is published, so this row is about the contract it claims to be about.
      const names = ((artifact.hiddenBatch?.handlers ?? []) as any[]).map((handler) => handler.name);
      for (const handler of row.handlers) {
        expect(names, `${row.contract}.${handler} is not a published handler`).toContain(handler);
      }
      if (dynamic.length > 0) carrying.push(`${row.contract}: ${dynamic.join(', ')}`);
    }
    console.log(`[X193] ${WRITER_ROWS.length} writer-bearing rows compiled; `
      + `${carrying.length} carry a chunk-backed variable`);
    expect(carrying, 'a recovered writer DOES sit on chunk-backed state - the shape exists').toEqual([]);
  }, 1_800_000);

  /**
   * DIRECTION TWO. Every partition row that HAS a chunk-backed variable publishes `writesState: false` on
   * every one of its gained handlers, so none of them is a writer.
   *
   * This is the direction that matters: scanning only the writer list would miss a writer the census's own
   * classifier had mislabelled, and X177 established that classifier means "needs the state machinery".
   */
  it('MEASURED: every gained handler on a chunk-backed contract is read-only', () => {
    const writers: string[] = [];
    let dynamicRowsChecked = 0;
    let handlersChecked = 0;
    for (const row of DYNAMIC_ROWS) {
      const artifact = layoutArtifact(row);
      const dynamic = dynamicVariables(artifact);
      expect(dynamic.length, `${row.contract} carries no chunk-backed variable, so it is the wrong subject`)
        .toBeGreaterThan(0);
      dynamicRowsChecked += 1;
      const published = ((artifact.hiddenBatch?.handlers ?? []) as any[]).map((handler) => handler.name);
      const flags: string[] = [];
      for (const handler of row.gained) {
        if (!published.includes(handler)) continue;
        handlersChecked += 1;
        const abi = (artifact.abi as any[]).find((entry) => entry.name === handler);
        if (abi !== undefined && abi.writesState !== false) writers.push(`${row.contract}.${handler}`);
        flags.push(`${handler}=${abi === undefined ? 'no-abi' : abi.writesState}`);
      }
      console.log(`[X193] DYNAMIC ${row.contract} dynamic=${JSON.stringify(dynamic)} `
        + `gained writesState: ${flags.join(' ')}`);
    }
    console.log(`[X193] ${dynamicRowsChecked} chunk-backed rows, ${handlersChecked} gained handlers checked; `
      + `${writers.length} of them write`);
    expect(handlersChecked, 'no gained handler was checked, so this measures nothing').toBeGreaterThan(20);
    expect(writers, 'a gained handler on chunk-backed state DOES write - the shape exists').toEqual([]);
  }, 1_800_000);

  /** Every subject is a published, eligible handler on the block shape this file claims to exercise. */
  it('MEASURED: every subject is an eligible handler on the block shape named here', () => {
    for (const row of ROWS) {
      const artifact = layoutArtifact(row);
      const handlers = artifact.hiddenBatch!.handlers as any[];
      const eligible = handlers.filter((handler) => handler.eligible).map((handler) => handler.name);
      const layout = artifact.hiddenBatch!.route.blockLayout!;
      const bytes = scriptToBytecode(asmToScript(artifact.bytecode)).length;
      const ineligibleValue = handlers
        .filter((handler) => handler.usesMsgValue === true && handler.eligible !== true)
        .map((handler) => handler.name);
      console.log(`[X193] ${row.key}`);
      console.log(`[X193]   shape: ${row.shape}`);
      console.log(`[X193]   bytes=${bytes} dataNfts=${artifact.stateLayout.dataNftCount} `
        + `blockSize=${layout.blockSize} slots=${JSON.stringify(layout.slots.map((s: any) => s.kind))}`);
      console.log(`[X193]   INELIGIBLE msg.value handlers (the X192 class): ${JSON.stringify(ineligibleValue)}`);
      console.log(`[X193]   SIZE: ${bytes} bytes, ${bytes > INPUT_SCRIPT_LIMIT
        ? `OVER the ${INPUT_SCRIPT_LIMIT}-byte input-script limit by ${bytes - INPUT_SCRIPT_LIMIT}`
        : 'within the input-script limit'}`);
      expect(layout.blockSize).toBe(row.blockSize);
      expect(layout.slots.map((slot: any) => slot.kind)).toEqual(row.slots);
      expect(eligible, `${row.writer} is not admitted`).toContain(row.writer);
      for (const g of row.guards) expect(eligible, `${g.name} is not admitted`).toContain(g.name);
      const abiOf = (name: string): any => artifact.abi.find((entry: any) => entry.name === name);
      expect(abiOf(row.writer).writesState).toBe(row.verdict === 'settles');
      for (const g of row.guards) expect(abiOf(g.name).writesState, `${g.name} is not read-only`).toBe(false);
      // The X192 flag on the row is a claim about this artifact, so it is checked against it.
      expect(ineligibleValue.length > 0).toBe(row.x192);
    }
  }, 1_800_000);

  /**
   * THE X192 CORRECTION, applied as an SDK-side encoder input and nothing else.
   *
   * `usesMsgValue` is cleared on the handlers route synthesis REFUSED. Every other field, including `bytecode`,
   * is the same object, so the compiled covenant cannot move; each attempt returns the participant script and
   * the rows below assert the two arms share it.
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

  /** One attempt at one recovered route. `probe` traces under the debugger and never broadcasts. */
  async function attempt(row: Row, handler: string, args: readonly unknown[], attack: Attack, options: {
    probe?: boolean; declaredResult?: Uint8Array; publishedState?: readonly string[];
    legacyValueMode?: boolean; rootCaller?: 'none' | 'pkh';
  } = {}): Promise<{
      sent?: string; refusal?: string; failingInput?: number; trace?: unknown[];
      preCommitments: string[]; publishedState: readonly string[]; participantScript: string;
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
    const asPublished = artifactOf(
      row.file, row.contract, controller.lockingBytecode as never, controllerCategory,
    );
    // The X192 correction is applied unless a control asks for the published header explicitly.
    const artifact = row.x192 && options.legacyValueMode !== true
      ? withoutIneligibleMsgValue(asPublished) : asPublished;
    const base = new Contract(artifact, [], { provider });
    const pre = withBlockOracle(artifact.stateLayout, row.pre, row.oracleTimestamp);
    const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, pre);
    const participant = base.withCategory(hexToBin(setup.categoryId));
    const participantScript = String(base.lockingBytecode);

    const preCommitments = buildInitialStateCommitments(artifact.stateLayout!, pre);
    const published = options.publishedState ?? preCommitments;

    const returns = (artifact.hiddenBatch!.handlers as any[])
      .find((candidate) => candidate.name === handler)?.outputs?.length > 0;

    const forge = (value: Uint8Array): Uint8Array => {
      const wrong = Uint8Array.from(value);
      if (wrong.length === 0) return Uint8Array.from([0x01]);
      wrong[wrong.length - 1] ^= 0x01;
      return wrong;
    };
    // The transcript declares the VECTOR inside the commitment, so the two are one push apart. Decoded with
    // libauth rather than re-encoded, and the honest run asserts re-wrapping reproduces the route's own bytes.
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
    const bareOrigin = (options.rootCaller ?? row.rootCaller) === 'pkh';
    const transcript = layer3.finalizeCompiledGraph(
      plan,
      returns ? { 0: binToHex(publishedVector) } : {},
      physical.participantInputs,
      returns ? physical.returnOutputs : [null],
      returns ? [binToHex(publishedVector)] : [''],
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
    expect(rootedController, 'controller initialization did not root the authority').toBeDefined();

    const returnFunding = randomUtxo({ satoshis: 1000n });
    const projectionUtxo = randomUtxo({ satoshis: 1000n });
    const fee = randomUtxo({ satoshis: 400_000n });
    await provider.addUtxo(projection.address, projectionUtxo);
    await provider.addUtxo(p2pkh.address, returnFunding);
    await provider.addUtxo(bareOrigin ? aliceAddress : p2pkh.address, fee);

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
          // The second argument is the MASTER's input index, which is block slot 0 - the X180 correction.
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
          throw new Error(`${row.key}: this harness does not stage a '${slot.kind}' slot`);
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

    if (options.probe === true) {
      const vm = createVirtualMachineBch2026ForProvider(provider);
      const trace = vm.debug({
        inputIndex: 0,
        sourceOutputs: generateLibauthSourceOutputs(tx.inputs as never),
        transaction: tx.buildLibauthTransaction(),
      }) as unknown[];
      return { trace, preCommitments, publishedState: published, participantScript };
    }
    try {
      return {
        sent: await provider.sendRawTransaction(raw(tx)),
        preCommitments,
        publishedState: published,
        participantScript,
      };
    } catch (error) {
      const refusal = (error as Error).message;
      const index = refusal.match(/input index (\d+)/);
      return {
        refusal,
        failingInput: index ? Number(index[1]) : undefined,
        preCommitments,
        publishedState: published,
        participantScript,
      };
    }
  }

  /** The result the route computed for a handler, read off its own trace with the placeholder sentinel. */
  const cachedResult = new Map<string, Uint8Array>();
  async function routeResult(row: Row, handler: string, args: readonly unknown[]): Promise<Uint8Array> {
    const key = `${row.key}|${handler}`;
    if (!cachedResult.has(key)) {
      const probe = await attempt(row, handler, args, 'none', { probe: true });
      const found = operandComparedAgainst(probe.trace!, PROBE_RESULT);
      if (found === undefined) {
        const last = probe.trace![probe.trace!.length - 1] as { ip?: number; error?: string };
        throw new Error(`${key}: the probe trace never compared the declared result `
          + `(stopped at ip ${last.ip} after ${probe.trace!.length} steps: ${last.error})`);
      }
      cachedResult.set(key, found);
      console.log(`[X193] ${key} result off its own trace: ${binToHex(found)}`);
    }
    return cachedResult.get(key)!;
  }

  /**
   * THE POST STATE, TAKEN OFF THE COVENANT, ONE DATA NFT SLOT AT A TIME - the X177 sentinel method. The slot
   * under probe carries a commitment the covenant cannot have computed, so its own comparison hands back the
   * commitment IT computed. `buildInitialStateCommitments` is used afterwards only to say WHICH state that is.
   */
  const SENTINEL = (slot: number): string => `${'9d'.repeat(19)}${slot.toString(16).padStart(2, '0')}`;
  const cachedPost = new Map<string, string[]>();
  async function covenantPostState(row: Row): Promise<string[]> {
    if (!cachedPost.has(row.key)) {
      const slots = row.slots.filter((slot) => slot === 'dataNft').length;
      const artifact = layoutArtifact(row);
      const resolved = buildInitialStateCommitments(
        artifact.stateLayout!, withBlockOracle(artifact.stateLayout, row.pre, row.oracleTimestamp),
      );
      for (let index = 0; index < slots; index += 1) {
        const publishedState = [...resolved];
        publishedState[index] = SENTINEL(index);
        const probe = await attempt(row, row.writer, row.writerArgs, 'none', { probe: true, publishedState });
        const found = operandComparedAgainst(probe.trace!, hexToBin(SENTINEL(index)));
        if (found === undefined) throw new Error(`${row.key}: the covenant never compared data NFT ${index}`);
        resolved[index] = binToHex(found);
        console.log(`[X193] ${row.key} slot ${index}: pre=${probe.preCommitments[index]} `
          + `covenant=${resolved[index]}`);
      }
      cachedPost.set(row.key, resolved);
    }
    return cachedPost.get(row.key)!;
  }

  /**
   * THE X192 CONTROL, per row. The same route built twice, differing ONLY in `usesMsgValue` on the ineligible
   * handler, with the participant script asserted identical. As published it is refused; with the flag cleared
   * it settles.
   */
  const x192Control = (row: Row) => async (): Promise<void> => {
    const declaredResult = await routeResult(row, row.writer, row.writerArgs);
    const corrected = await attempt(row, row.writer, row.writerArgs, 'none', { declaredResult });
    const asPublished = await attempt(row, row.writer, row.writerArgs, 'none', {
      declaredResult, legacyValueMode: true,
    });
    expect(corrected.participantScript, `${row.key}: the two arms are not the same covenant`)
      .toBe(asPublished.participantScript);
    console.log(`[X193] ${row.key} CORRECTED: ${corrected.sent ?? corrected.refusal!.split('\n')[0]}`);
    console.log(`[X193] ${row.key} AS PUBLISHED: `
      + `${(asPublished.refusal ?? `ACCEPTED ${asPublished.sent}`).split('\n')[0]} `
      + `at input ${asPublished.failingInput ?? '-'}`);
    expect(corrected.refusal, `${row.key}: the corrected arm did not settle`).toBeUndefined();
    // X199 MADE THE SDK DO THIS CORRECTION FOR REAL, so the test-local artifact patch is now a no-op and both
    // arms settle. That is the regression guard: if these ever diverge again, the SDK has gone back to sizing
    // its rows from the PUBLISHED handler set while the route sizes its own from the ELIGIBLE one.
    expect(asPublished.refusal, `${row.key}: the published header is refused again - X199 has regressed`)
      .toBeUndefined();
    expect(asPublished.sent, `${row.key}: the published arm did not settle`).toBeDefined();
  };



  /** THE POSITIVE for a read-only row: it publishes the result the route computed. */
  const positiveRead = (row: Row) => async (): Promise<void> => {
    const declaredResult = await routeResult(row, row.writer, row.writerArgs);
    const result = await attempt(row, row.writer, row.writerArgs, 'none', { declaredResult });
    if (result.refusal) console.log(`[X193] ${row.key} refused: ${result.refusal.split('\n')[0]}`);
    expect(result.refusal, `${row.key}.${row.writer} did not settle`).toBeUndefined();
    expect(result.sent).toMatch(/^[0-9a-f]{64}$/);
    console.log(`[X193] ${row.key}.${row.writer} SETTLED ${result.sent}`);
  };

  /**
   * THE WRITE IS REAL, AND THE COVENANT SAID SO. The commitments the route computed are the encoding of the
   * POST state and are NOT the encoding of the PRE state; the bytes come off the trace.
   */
  const mutates = (row: Row) => async (): Promise<void> => {
    const artifact = layoutArtifact(row);
    const staged = withBlockOracle(artifact.stateLayout, row.pre, row.oracleTimestamp);
    const computed = await covenantPostState(row);
    const written = buildInitialStateCommitments(artifact.stateLayout!, { ...staged, ...row.post });
    const unwritten = buildInitialStateCommitments(artifact.stateLayout!, staged);
    console.log(`[X193] ${row.key} computed ${JSON.stringify(computed)}`);
    console.log(`[X193] ${row.key} post     ${JSON.stringify(written)}`);
    console.log(`[X193] ${row.key} pre      ${JSON.stringify(unwritten)}`);
    expect(computed).toEqual(written);
    expect(computed).not.toEqual(unwritten);
  };

  /** THE POSITIVE for a writer row: the covenant's own post commitments are published and it settles. */
  const positiveWrite = (row: Row) => async (): Promise<void> => {
    const result = await attempt(row, row.writer, row.writerArgs, 'none', {
      publishedState: await covenantPostState(row),
    });
    if (result.refusal) console.log(`[X193] ${row.key} refused: ${result.refusal.split('\n')[0]}`);
    expect(result.refusal, `the recovered writer ${row.key} did not settle`).toBeUndefined();
    expect(result.sent).toMatch(/^[0-9a-f]{64}$/);
    console.log(`[X193] ${row.key} SETTLED ${result.sent}`);
  };

  /** HOSTILE. Each differs from the settling positive in exactly ONE published field. */
  const hostile = (row: Row, attack: Attack) => async (): Promise<void> => {
    const post = await covenantPostState(row);
    const artifact = layoutArtifact(row);
    const pre = buildInitialStateCommitments(
      artifact.stateLayout!, withBlockOracle(artifact.stateLayout, row.pre, row.oracleTimestamp),
    );
    const written = post.findIndex((value, index) => value !== pre[index]);
    expect(written, `${row.key}: the covenant wrote no slot at all`).toBeGreaterThanOrEqual(0);
    const publishedState = [...post];
    if (attack === 'state-unwritten') publishedState[written] = pre[written];
    else {
      const bytes = hexToBin(post[written]);
      bytes[bytes.length - 1] ^= 0x01;
      publishedState[written] = binToHex(bytes);
    }
    const result = await attempt(row, row.writer, row.writerArgs, attack, { publishedState });
    console.log(`[X193] ${row.key}/${attack}: ${(result.refusal ?? 'ACCEPTED').split('\n')[0]}`);
    expect(result.sent, `a forged ${attack} was ACCEPTED on ${row.key}`).toBeUndefined();
    expect(result.refusal).toMatch(/OP_VERIFY|mandatory-script-verify-flag-failed|non-truthy/);
    expect(result.failingInput, 'the refusal did not name the participant input').toBe(0);
  };

  /**
   * GUARD NEGATIVE CONTROL. A read-only sibling settles through the IDENTICAL staging, so a refusal elsewhere
   * is a refusal of the attacked field and not of a harness that never worked.
   */
  const guard = (row: Row, name: string, args: readonly unknown[]) => async (): Promise<void> => {
    const declaredResult = await routeResult(row, name, args);
    const result = await attempt(row, name, args, 'none', { declaredResult });
    if (result.refusal) console.log(`[X193] ${row.key}/${name} refused: ${result.refusal.split('\n')[0]}`);
    expect(result.refusal, `${row.key}: the read-only sibling ${name} did not settle`).toBeUndefined();
    expect(result.sent).toMatch(/^[0-9a-f]{64}$/);
    console.log(`[X193] ${row.key}/${name} guard settled ${result.sent}`);
  };

  /**
   * GUARD, RETURN-EVENT DIRECTION. A believable-wrong result - the route's own commitment with one bit moved -
   * is refused at the participant input, which is where the return-event check is shown to be LIVE.
   */
  const guardResult = (row: Row, name: string, args: readonly unknown[]) => async (): Promise<void> => {
    const declaredResult = await routeResult(row, name, args);
    const result = await attempt(row, name, args, 'result', { declaredResult });
    console.log(`[X193] ${row.key}/${name} result-forgery: ${(result.refusal ?? 'ACCEPTED').split('\n')[0]}`);
    expect(result.sent, `a forged return event was ACCEPTED on ${row.key}`).toBeUndefined();
    expect(result.refusal).toMatch(/OP_VERIFY|mandatory-script-verify-flag-failed|non-truthy/);
    expect(result.failingInput, 'the refusal did not name the participant input').toBe(0);
  };

  for (const row of ROWS) {
    if (row.x192) {
      it(`X199: ${row.key} settles with the PUBLISHED header too - the local correction is a no-op`,
        x192Control(row), 1_800_000);
    }
    if (row.verdict === 'reads') {
      it(`MEASURED: ${row.key}.${row.writer} SETTLES`, positiveRead(row), 1_800_000);
    } else {
      it(`MEASURED: ${row.key} MUTATES - its own trace hands back the post state`, mutates(row), 1_800_000);
      it(`MEASURED: the recovered WRITER ${row.key} SETTLES`, positiveWrite(row), 1_800_000);
      it(`HOSTILE: ${row.key} with the write simply not applied is refused`,
        hostile(row, 'state-unwritten'), 1_800_000);
      it(`HOSTILE: ${row.key} with the written slot moved one bit is refused`,
        hostile(row, 'state-neighbour'), 1_800_000);
    }
    for (const g of row.guards) {
      it(`GUARD: the read-only sibling '${g.name}' of ${row.contract} settles through the same staging`,
        guard(row, g.name, g.args), 1_800_000);
    }
    const returning = row.verdict === 'reads' ? { name: row.writer, args: row.writerArgs } : row.guards[0];
    if (returning !== undefined) {
      it(`GUARD: ${row.contract}.${returning.name}'s return event carrying a believable-wrong result `
        + 'is refused', guardResult(row, returning.name, returning.args), 1_800_000);
    }
  }

  /** Where a probe stopped: the pointer, how deep, and the VM's own error string. */
  function abortOf(trace: unknown[]): { ip: number; frames: number; error: string; steps: number } {
    const last = trace[trace.length - 1] as any;
    return {
      ip: last.ip ?? -1,
      frames: (last.controlStack ?? []).filter((e: unknown) => typeof e === 'object' && e !== null).length,
      error: last.error ?? 'no error recorded',
      steps: trace.length,
    };
  }

  const targetRow = (): Row => ROWS.find((row) => row.contract === 'Target')!;

  /**
   * THE DISCRIMINATING PAIR, and it moves ONE argument.
   *
   * `isContract(account)` lowers to `account.code.length > 0`, and `.code` is emitted as a P2SH extractor: it
   * VERIFIES the locking bytecode is 23 bytes (p2sh20) or 35 (p2sh32) before it splits out the redeem script.
   * With a p2sh32 argument the handler settles and answers. With a 25-byte P2PKH argument - the same handler,
   * the same block, the same pre state, one operand different - the route is refused at input 0. There is no
   * `false` answer available for a non-P2SH address; the accessor aborts instead of returning a zero size.
   */
  it('MEASURED: Target.isContract answers for a P2SH address and is REFUSED for a P2PKH one', async () => {
    const row = targetRow();
    const settled = await routeResult(row, 'isContract', [P2SH32_ADDRESS]);
    console.log(`[X193] isContract(p2sh32) answered ${binToHex(settled)}`);
    const accepted = await attempt(row, 'isContract', [P2SH32_ADDRESS], 'none', { declaredResult: settled });
    expect(accepted.refusal, 'the P2SH arm of this control did not settle').toBeUndefined();
    console.log(`[X193] isContract(p2sh32) SETTLED ${accepted.sent}`);

    const probe = await attempt(row, 'isContract', [P2PKH_ADDRESS], 'none', { probe: true });
    const abort = abortOf(probe.trace!);
    console.log(`[X193] isContract(p2pkh) ABORT ip=${abort.ip} frames=${abort.frames} `
      + `steps=${abort.steps} error=${abort.error}`);
    expect(operandComparedAgainst(probe.trace!, PROBE_RESULT),
      'the P2PKH arm reached its return check - `.code` does not refuse it').toBeUndefined();
    const refused = await attempt(row, 'isContract', [P2PKH_ADDRESS], 'none', { declaredResult: settled });
    console.log(`[X193] isContract(p2pkh): ${(refused.refusal ?? `ACCEPTED ${refused.sent}`).split('\n')[0]}`);
    expect(refused.sent, 'a P2PKH address was ACCEPTED by the `.code` extractor').toBeUndefined();
    expect(refused.refusal).toMatch(/OP_VERIFY|mandatory-script-verify-flag-failed|non-truthy/);
    expect(refused.failingInput, 'the refusal did not name the participant input').toBe(0);
  }, 1_800_000);

  /**
   * `Target.protected` IS FAIL-CLOSED, AND THE REASON IS THE SAME ACCESSOR.
   *
   * It is one of the eleven recovered writers and it had no VM subject. It still has none, and this says why
   * rather than recording a refusal: its whole body is `require(!isContract(msg.sender)); pwned = true;`, and on
   * the bus `msg.sender` is a LOCKING BYTECODE. A bare-P2PKH caller - the only caller shape the projection's
   * `tx.origin` pin admits at all - is exactly the shape `.code` refuses, so the guard cannot evaluate to
   * `false`; and a P2SH caller would make `isContract` TRUE and fail the require. Both directions closed.
   *
   * This is a REFUSAL, not an exploit: nothing is accepted that should be refused. The pointer is read off the
   * trace and shown to be INSIDE the same accessor, five frames down, at the P2SH length VERIFY.
   */
  it('MEASURED: the recovered writer Target.protected is fail-CLOSED, at the `.code` P2SH check', async () => {
    const row = targetRow();
    const aborts: Array<{ what: string; ip: number; frames: number }> = [];
    for (const caller of ['pkh', 'none'] as const) {
      const probe = await attempt(row, 'protected', [], 'none', { probe: true, rootCaller: caller });
      const abort = abortOf(probe.trace!);
      console.log(`[X193] Target.protected rootCaller=${caller} ABORT ip=${abort.ip} `
        + `frames=${abort.frames} steps=${abort.steps} error=${abort.error}`);
      const instructions = (probe.trace![probe.trace!.length - 1] as any).instructions ?? [];
      console.log(`[X193]   ops[ip-8..ip]=${instructions.slice(Math.max(0, abort.ip - 8), abort.ip + 1)
        .map((i: any) => `0x${i.opcode.toString(16).padStart(2, '0')}`
          + `${i.data ? `(${binToHex(i.data)})` : ''}`).join(' ')}`);
      // The window is the P2SH length VERIFY the `.code` extractor emits:
      //   OP_DUP PUSH<23> OP_EQUAL OP_OVER PUSH<35> OP_EQUAL OP_BOOLOR OP_VERIFY
      const window = instructions.slice(abort.ip - 8, abort.ip)
        .map((entry: any) => entry.opcode as number);
      expect(window).toEqual([0x76, 0x01, 0x87, 0x78, 0x01, 0x87, 0x9b, 0x69]);
      expect(binToHex(instructions[abort.ip - 7].data)).toBe('17');
      expect(binToHex(instructions[abort.ip - 4].data)).toBe('23');
      expect(abort.error).toMatch(/OP_VERIFY/);
      aborts.push({ what: caller, ip: abort.ip, frames: abort.frames });
    }
    // The caller shape does not move it, which is what makes the accessor - not the declared origin - the cause.
    expect([...new Set(aborts.map((entry) => entry.ip))]).toHaveLength(1);
    const refused = await attempt(row, 'protected', [], 'none', {});
    console.log(`[X193] Target.protected: ${(refused.refusal ?? `ACCEPTED ${refused.sent}`).split('\n')[0]} `
      + `at input ${refused.failingInput ?? '-'}`);
    expect(refused.sent, 'Target.protected SETTLED - this row is no longer fail-closed').toBeUndefined();
    expect(refused.refusal).toMatch(/OP_VERIFY|mandatory-script-verify-flag-failed|non-truthy/);
    expect(refused.failingInput, 'the refusal did not name the participant input').toBe(0);
    // NON-VACUITY: the same helper, the same block, the same pre state settles the sibling that does NOT
    // touch `.code`. So the refusal is of this handler and not of a staging that never worked.
    const sibling = await attempt(row, 'pwned', [], 'none', {
      declaredResult: await routeResult(row, 'pwned', []),
    });
    expect(sibling.refusal, 'the read-only sibling does not settle either - the staging is the suspect')
      .toBeUndefined();
    console.log(`[X193] control: the sibling Target.pwned SETTLED ${sibling.sent} through the same staging`);
  }, 1_800_000);

  /** HOW MANY OF THE 206 this file settles, counted by name rather than by impression. */
  it('MEASURED: how many gained handlers this file settles on the VM', () => {
    const settled: string[] = [];
    for (const row of ROWS) {
      for (const handler of [row.writer, ...row.guards.map((g) => g.name)]) {
        // Every counted handler is asserted to be one the repair GAINED, against X160's own list.
        expect(GAINED_BY_THE_REPAIR[row.contract], `${row.contract}.${handler} is not a gained handler`)
          .toContain(handler);
        settled.push(`${row.contract}.${handler}`);
      }
    }
    for (const handler of settled) console.log(`[X193] SETTLED ON THE VM: ${handler}`);
    console.log(`[X193] ${settled.length} gained handlers settle here; ${206 - settled.length} of the 206 `
      + 'are NOT proved by this file, and most of them are not proved anywhere.');
    expect(settled).toEqual([
      'DutchAuction.getPrice', 'DutchAuction.startingPrice', 'DutchAuction.discountRate', 'DutchAuction.startAt',
      'DutchAuction.expiresAt', 'DutchAuction.nft', 'DutchAuction.nftId', 'DutchAuction.seller',
      'Attack.etherStore', 'Attack.getBalance',
      'Target.isContract', 'Target.pwned',
      'TestTransientStorage.val',
    ]);
    expect(settled).toHaveLength(13);
  }, 1_800_000);
});
