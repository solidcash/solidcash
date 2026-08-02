import { describe, expect, it } from 'vitest';
import { binToHex, decodeAuthenticationInstructions, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { asmToScript, buildInitialStateCommitments, scriptToBytecode } from '@solidcash/utils';
import { compileFile, compileFileMulti, compileString } from 'solidc';
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
 * X177/X180 BREADTH. HOW MANY OF THE 206 RECOVERED HANDLERS ACTUALLY REACH A SETTLED TRANSACTION.
 *
 * The board's VM-proved figure has always been a small hand count carried between files. Everything else in
 * the 206 is COMPILER-ADMITTED, which is not proof: `eligible: true` says route synthesis accepted the
 * handler, not that any covenant ever ran on a transaction that carried it. This file moves handlers from
 * "admitted" to "settled, with a hostile refused at a named input index", in bulk.
 *
 * WHAT ONE ROW COSTS, AND WHY THAT IS THE WHOLE DESIGN.
 *
 *  - POSITIVE. One broadcast transaction per subject handler, built by the SAME helper that builds the
 *    hostiles, so an acceptance cannot be an evaluation that never ran.
 *  - HOSTILE (result). The return-event slot carries a BELIEVABLE-WRONG commitment - the covenant's own bytes
 *    with one bit moved - and everything else is byte-identical. Refused at input 0.
 *  - HOSTILE (state). Exactly ONE persisted field moved to a believable neighbour, everything else identical.
 *    Refused at input 0.
 *
 * NOTHING HERE ENCODES A RESULT. For a handler that RETURNS, the return-event commitment is read off the
 * route's OWN execution: a probe run declares a value the covenant cannot derive, is traced under the VM
 * debugger and never broadcast, and the step where the placeholder sits beside the computed value hands back
 * the other operand. A harness that guessed the encoding wrong could not accidentally agree with it.
 *
 * ABSENT AND EMPTY ARE DIFFERENT, which is the X177 lesson and which most of these rows depend on. A VOID
 * handler's result vector is EMPTY, not missing, so its return-event slot still needs an NFT committing to
 * the empty vector's single push. A plain output there is refused, and that refusal is about the staging
 * rather than about the handler - which is exactly what made one row read as fail-closed for four rounds.
 *
 * THE POST-STATE IS THE HANDLER'S ACTUAL POST-STATE. Every subject below is read-only - each was checked
 * against its DIRECT artifact's `writesState`, and the two that publish it TRUE are named in the row that
 * asserts it - so publishing the pre-state is correct here rather than accidentally correct. A writer staged
 * this way would be a different claim and is not made.
 *
 * WHAT THIS FILE DOES NOT ESTABLISH.
 *
 *  - It is SEMANTIC evidence at relaxed capacity limits. Every subject's real redeem-script length is printed
 *    below and every one of them is under the 10,000-byte input limit, so unlike the two X190 writers these
 *    would not be refused on size - but a settlement here is still not a deployability claim.
 *  - It says nothing about the handlers it does not run. The count is printed, not rounded.
 *  - Read-only breadth is NOT writer evidence. `writesState` is published FALSE for every subject here.
 *  - ONE ROW IS RECORDED AS UNPROVEN IN BOTH DIRECTIONS and is not counted: `ReEntrancy.sol::Attack`, whose
 *    two gained handlers are run below and whose route this harness cannot obtain a result from. It is kept
 *    in the file rather than deleted, because deleting it would have made the original 38 read as 40.
 *  - X236 extends the same scalar-row harness across corpus roots. `TreasurySplit` is the first backlog
 *    shard lifted this way: all three getters settle, while result and state mutations still fail at input 0.
 */

const SBE = `${process.env.SBE_ROOT ?? '/Code/solidity-by-example'}/contracts/src`;
const EACC = process.env.EACC_CONTRACTS_DIR ?? '/Code/effectiveacceleration.ai/contract/contracts';

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));

const BUS = {
  solidityImportCompat: true,
  ecrecover: 'p2pkh',
  forceStateful: true,
  hiddenBatch: true,
};
const DIRECT = { solidityImportCompat: true, ecrecover: 'p2pkh' };

/** A distinctive placeholder result: the probe declares it, so the trace's OTHER operand is the real one. */
const PROBE_RESULT = hexToBin('9e'.repeat(32));

/** A p2sh32 address literal, which is the only address shape a stateful SolidCash contract accepts. */
const addr = (fill: string): Uint8Array => hexToBin(`aa20${fill.repeat(32)}87`);
/** The same address with its last content byte moved - a believable neighbour, not a random blob. */
const addrNear = (fill: string): Uint8Array => hexToBin(`aa20${fill.repeat(31)}${fill === '55' ? '56' : '67'}87`);

/**
 * THE GAINED LISTS, quoted from `Layer3RecoveredPartitionX160.test.ts`'s own PARTITION rows rather than
 * reconstructed. A subject that is not in its row's list here is not a recovered handler and the assertion
 * below refuses it.
 */
const GAINED_BY_THE_REPAIR: Readonly<Record<string, readonly string[]>> = {
  'view-and-pure-functions/ViewAndPureFunctions.sol::ViewAndPure': ['addToX', 'add', 'x'],
  'ether-units/EtherUnits.sol::EtherUnits':
    ['oneWei', 'isOneWei', 'oneGwei', 'isOneGwei', 'oneEther', 'isOneEther'],
  'immutable/Immutable.sol::Immutable': ['myAddr', 'myUint'],
  'error/Error.sol::Error': ['testRequire', 'testRevert', 'testAssert', 'testCustomError', 'num'],
  'transient-storage/TransientStorage.sol::TestStorage': ['val'],
  'transient-storage/TransientStorage.sol::Callback': ['val'],
  'transient-storage/TransientStorage.sol::MaliciousCallback': ['count'],
  'hacks/delegatecall/Delegatecall_2.sol::HackMe': ['lib', 'owner', 'someNumber'],
  'app/create2/Create2.sol::TestContract': ['getBalance', 'owner', 'foo'],
  'app/ether-wallet/EtherWallet.sol::EtherWallet': ['getBalance', 'owner'],
  'hacks/contract-size/ContractSize.sol::Hack': ['isContract', 'addr'],
  'app/english-auction/EnglishAuction.sol::EnglishAuction': [
    'ended', 'highestBidder', 'nft', 'nftId', 'seller',
  ],
  'hacks/denial-of-service/DenialOfService.sol::Attack': ['kingOfEther'],
  'hacks/overflow/Overflow.sol::Attack': ['timeLock'],
  'hacks/self-destruct/ForceEther.sol::Attack': ['etherGame'],
  'hacks/re-entrancy/ReEntrancy.sol::Attack': ['getBalance', 'etherStore'],
  'hacks/phishing-with-tx-origin/TxOrigin.sol::Attack': ['attack', 'owner', 'wallet'],
  'hacks/hiding-malicious-code-with-external-contract/ExternalContract.sol::Foo': ['callBar', 'bar'],
  'fallback/FallbackInputOutput.sol::FallbackInputOutput': ['target'],
  'try-catch/TryCatch.sol::Foo': ['myFunc', 'owner'],
  'try-catch/TryCatch.sol::Bar': ['foo'],
  'TreasurySplit.sol::TreasurySplit': [
    'eaccTreasuryAddress', 'arbiusTreasuryAddress', 'eaccTreasuryPercentage',
  ],
};

interface Subject {
  handler: string;
  args?: readonly (bigint | Uint8Array)[];
}

interface Row {
  /** Corpus root. Omitted for the original solidity-by-example rows. */
  root?: string;
  /** Path relative to `root` (or the pinned solidity-by-example checkout), and the PARTITION row's key. */
  rel: string;
  contract: string;
  subjects: readonly Subject[];
  /** The one subject the two hostiles are built against. */
  hostileSubject: string;
  state: Record<string, unknown>;
  /** The post-state hostile: exactly ONE persisted field, moved to a believable neighbour. */
  stateTamper: Record<string, unknown>;
  slots: readonly string[];
}

const ROWS: readonly Row[] = [
  {
    rel: 'app/english-auction/EnglishAuction.sol',
    contract: 'EnglishAuction',
    subjects: [
      { handler: 'ended' }, { handler: 'highestBidder' }, { handler: 'nft' },
      { handler: 'nftId' }, { handler: 'seller' },
    ],
    hostileSubject: 'nftId',
    state: {
      nft: addr('55'), nftId: 7n, seller: addr('66'), endAt: 1_000n, started: true, ended: false,
      highestBidder: addr('77'), highestBid: 50n, __block_timestamp: 900n, __blockOracleOwner: alicePub,
    },
    stateTamper: { nftId: 8n },
    slots: ['master', 'dataNft', 'dataNft', 'dataNft', 'entry', 'returnEvent'],
  },
  {
    root: EACC,
    rel: 'TreasurySplit.sol',
    contract: 'TreasurySplit',
    subjects: [
      { handler: 'eaccTreasuryAddress' },
      { handler: 'arbiusTreasuryAddress' },
      { handler: 'eaccTreasuryPercentage' },
    ],
    hostileSubject: 'eaccTreasuryPercentage',
    state: {
      eaccTreasuryAddress: addr('55'),
      arbiusTreasuryAddress: addr('66'),
      eaccTreasuryPercentage: 500_000_000_000_000_000n,
    },
    stateTamper: { eaccTreasuryPercentage: 500_000_000_000_000_001n },
    slots: ['master', 'dataNft', 'returnEvent'],
  },
  {
    rel: 'view-and-pure-functions/ViewAndPureFunctions.sol',
    contract: 'ViewAndPure',
    subjects: [{ handler: 'addToX', args: [11n] }, { handler: 'add', args: [3n, 4n] }, { handler: 'x' }],
    hostileSubject: 'addToX',
    state: { x: 1n },
    stateTamper: { x: 2n },
    slots: ['master', 'dataNft', 'returnEvent'],
  },
  {
    rel: 'ether-units/EtherUnits.sol',
    contract: 'EtherUnits',
    subjects: [
      { handler: 'oneWei' }, { handler: 'isOneWei' }, { handler: 'oneGwei' },
      { handler: 'isOneGwei' }, { handler: 'oneEther' }, { handler: 'isOneEther' },
    ],
    hostileSubject: 'oneGwei',
    state: {
      oneWei: 1n, isOneWei: true, oneGwei: 1_000_000_000n, isOneGwei: true,
      oneEther: 1_000_000_000_000_000_000n, isOneEther: true,
    },
    stateTamper: { oneGwei: 1_000_000_001n },
    slots: ['master', 'dataNft', 'returnEvent'],
  },
  {
    rel: 'immutable/Immutable.sol',
    contract: 'Immutable',
    subjects: [{ handler: 'myAddr' }, { handler: 'myUint' }],
    hostileSubject: 'myUint',
    state: { myAddr: addr('55'), myUint: 4_242n },
    stateTamper: { myUint: 4_243n },
    slots: ['master', 'dataNft', 'returnEvent'],
  },
  {
    // FOUR VOID HANDLERS in one row, and they are the shape X177 showed the harness had never staged: a void
    // result is EMPTY, not absent. `testRequire(11)` and `testRevert(11)` take the passing branch by
    // construction (both demand `_i > 10`); `testAssert` demands `num == 0`, which is the staged pre-state;
    // `testCustomError(0)` takes the non-reverting branch for any balance.
    rel: 'error/Error.sol',
    contract: 'Error',
    subjects: [
      { handler: 'testRequire', args: [11n] }, { handler: 'testRevert', args: [11n] },
      { handler: 'testAssert' }, { handler: 'testCustomError', args: [0n] }, { handler: 'num' },
    ],
    hostileSubject: 'num',
    state: { num: 0n },
    stateTamper: { num: 1n },
    slots: ['master', 'dataNft', 'returnEvent'],
  },
  {
    rel: 'hacks/delegatecall/Delegatecall_2.sol',
    contract: 'HackMe',
    subjects: [{ handler: 'lib' }, { handler: 'owner' }, { handler: 'someNumber' }],
    hostileSubject: 'someNumber',
    state: { lib: addr('55'), owner: addr('66'), someNumber: 41n },
    stateTamper: { someNumber: 42n },
    slots: ['master', 'dataNft', 'returnEvent'],
  },
  {
    rel: 'app/create2/Create2.sol',
    contract: 'TestContract',
    subjects: [{ handler: 'getBalance' }, { handler: 'owner' }, { handler: 'foo' }],
    hostileSubject: 'foo',
    state: { owner: addr('55'), foo: 7n },
    stateTamper: { foo: 8n },
    slots: ['master', 'dataNft', 'returnEvent'],
  },
  {
    rel: 'app/ether-wallet/EtherWallet.sol',
    contract: 'EtherWallet',
    subjects: [{ handler: 'getBalance' }, { handler: 'owner' }],
    hostileSubject: 'owner',
    state: { owner: addr('55') },
    stateTamper: { owner: addrNear('55') },
    slots: ['master', 'dataNft', 'returnEvent'],
  },
  {
    rel: 'transient-storage/TransientStorage.sol',
    contract: 'TestStorage',
    subjects: [{ handler: 'val' }],
    hostileSubject: 'val',
    state: { val: 123n },
    stateTamper: { val: 124n },
    slots: ['master', 'dataNft', 'returnEvent'],
  },
  {
    rel: 'transient-storage/TransientStorage.sol',
    contract: 'Callback',
    subjects: [{ handler: 'val' }],
    hostileSubject: 'val',
    state: { val: 9n },
    stateTamper: { val: 10n },
    slots: ['master', 'dataNft', 'returnEvent'],
  },
  {
    rel: 'transient-storage/TransientStorage.sol',
    contract: 'MaliciousCallback',
    subjects: [{ handler: 'count' }],
    hostileSubject: 'count',
    state: { count: 3n },
    stateTamper: { count: 4n },
    slots: ['master', 'dataNft', 'returnEvent'],
  },
  {
    rel: 'hacks/contract-size/ContractSize.sol',
    contract: 'Hack',
    subjects: [{ handler: 'isContract' }, { handler: 'addr' }],
    hostileSubject: 'addr',
    state: { isContract: false, addr: addr('55') },
    stateTamper: { addr: addrNear('55') },
    slots: ['master', 'dataNft', 'returnEvent'],
  },
  {
    rel: 'hacks/denial-of-service/DenialOfService.sol',
    contract: 'Attack',
    subjects: [{ handler: 'kingOfEther' }],
    hostileSubject: 'kingOfEther',
    state: { kingOfEther: addr('55') },
    stateTamper: { kingOfEther: addrNear('55') },
    slots: ['master', 'dataNft', 'returnEvent'],
  },
  {
    rel: 'hacks/overflow/Overflow.sol',
    contract: 'Attack',
    subjects: [{ handler: 'timeLock' }],
    hostileSubject: 'timeLock',
    state: { timeLock: addr('55') },
    stateTamper: { timeLock: addrNear('55') },
    slots: ['master', 'dataNft', 'returnEvent'],
  },
  {
    rel: 'hacks/self-destruct/ForceEther.sol',
    contract: 'Attack',
    subjects: [{ handler: 'etherGame' }],
    hostileSubject: 'etherGame',
    state: { etherGame: addr('55') },
    stateTamper: { etherGame: addrNear('55') },
    slots: ['master', 'dataNft', 'returnEvent'],
  },
  {
    // THE TWO SURVIVING SIBLINGS of the handler X187 retired. `attack` is refused at compile time now
    // (`batched-handler-forward-call-not-enabled`); `owner` and `wallet` are ordinary recovered getters on the
    // same contract and had never been run to a settlement of their own.
    rel: 'hacks/phishing-with-tx-origin/TxOrigin.sol',
    contract: 'Attack',
    subjects: [{ handler: 'owner' }, { handler: 'wallet' }],
    hostileSubject: 'wallet',
    state: { owner: addr('66'), wallet: addr('55') },
    stateTamper: { wallet: addrNear('55') },
    slots: ['master', 'dataNft', 'returnEvent'],
  },
  {
    rel: 'hacks/hiding-malicious-code-with-external-contract/ExternalContract.sol',
    contract: 'Foo',
    subjects: [{ handler: 'bar' }],
    hostileSubject: 'bar',
    state: { bar: addr('55') },
    stateTamper: { bar: addrNear('55') },
    slots: ['master', 'dataNft', 'returnEvent'],
  },
  {
    rel: 'fallback/FallbackInputOutput.sol',
    contract: 'FallbackInputOutput',
    subjects: [{ handler: 'target' }],
    hostileSubject: 'target',
    state: { target: addr('55') },
    stateTamper: { target: addrNear('55') },
    slots: ['master', 'dataNft', 'returnEvent'],
  },
  {
    rel: 'try-catch/TryCatch.sol',
    contract: 'Foo',
    subjects: [{ handler: 'myFunc', args: [1n] }, { handler: 'owner' }],
    hostileSubject: 'owner',
    state: { owner: addr('55') },
    stateTamper: { owner: addrNear('55') },
    slots: ['master', 'dataNft', 'returnEvent'],
  },
  {
    rel: 'try-catch/TryCatch.sol',
    contract: 'Bar',
    subjects: [{ handler: 'foo' }],
    hostileSubject: 'foo',
    state: { foo: addr('55') },
    stateTamper: { foo: addrNear('55') },
    slots: ['master', 'dataNft', 'returnEvent'],
  },
];

/**
 * THE ROW THIS HARNESS CANNOT DRIVE, KEPT RATHER THAN DROPPED.
 *
 * `ReEntrancy.sol::Attack` compiles to the SAME block shape as five rows above it - `master dataNft
 * returnEvent`, 2,471 B, both gained handlers admitted - and its two subjects are structurally the same
 * shapes that settle there: an address getter and an `address(this).balance` getter, both of which settle on
 * `DenialOfService.Attack` and on `TestContract`/`EtherWallet` respectively. It is nonetheless the one row
 * whose route never puts the declared result beside a computed one, so the probe hands back nothing and no
 * honest commitment can be published for it.
 *
 * It is run below as a RECORDED NEGATIVE with an expectation that turns RED if it ever settles, rather than
 * removed to make the file green. Removing it would have made the original 38 read as 40. It is not counted as proved and
 * it is not counted as refused: the covenant's verdict on it is unknown, and this harness is the reason.
 */
const RECORDED_NEGATIVE: Row = {
  rel: 'hacks/re-entrancy/ReEntrancy.sol',
  contract: 'Attack',
  subjects: [{ handler: 'getBalance' }, { handler: 'etherStore' }],
  hostileSubject: 'etherStore',
  state: { etherStore: addr('55') },
  stateTamper: { etherStore: addrNear('55') },
  slots: ['master', 'dataNft', 'returnEvent'],
};

const key = (row: Row): string => `${row.rel}::${row.contract}`;

/**
 * Several of these files carry a sibling the bus REFUSES (a low-level `.call` shape, a `create2` assembly
 * block), so the multi-contract compile raises and the subject has to come from the single-contract compile -
 * exactly as `Layer3RecoveredWriterX136` and `Layer3RecoveredVoidWriterX177` take theirs. The fallback is
 * checked, not assumed: it refuses unless the single compile really is the contract the row names.
 */
function compileRow(row: Row, controllerLbc: string, controllerCategory: string): any {
  const options = {
    ...BUS,
    messageBusController: controllerLbc,
    messageBusControllerCategory: controllerCategory,
  } as never;
  const path = `${row.root ?? SBE}/${row.rel}`;
  try {
    const map = compileFileMulti(path, options) as any;
    if (map[row.contract]) return map[row.contract];
  } catch {
    // fall through to the single-contract compile
  }
  const artifact = compileFile(path, { ...options, primaryContractName: row.contract }) as any;
  if (artifact.contractName !== row.contract) {
    throw new Error(`${key(row)}: the single-contract compile is '${artifact.contractName}'`);
  }
  return artifact;
}

/** What one built attempt differs in. Exactly one field moves per hostile. */
type Attack = 'none' | 'result' | 'state';

describe('X177/X180 breadth: recovered handlers that reach a settled transaction', () => {
  /**
   * The route's return-event commitment, read off its own execution.
   *
   * The probe declares `PROBE_RESULT` and is never broadcast; the route reaches its return-event check and
   * puts what it computed beside what the output carries. This finds the step where both operands are on the
   * stack - identified by the placeholder being one of them - and returns the OTHER one.
   */
  function routeResultFromTrace(trace: unknown[], placeholder: Uint8Array, label: string): Uint8Array {
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
    if (found === undefined) throw new Error(`${label}: the probe trace never compared the declared result`);
    return found;
  }

  /**
   * THE ADMISSIBILITY TEST, from this run's own compiles, and it is what makes every row below evidence about
   * RECOVERED handlers rather than about handlers that always worked. It states three things per subject: it
   * is in X160's own gained list, the route admits it, and its DIRECT artifact publishes `writesState: false`
   * - which is what licenses publishing the pre-state as the post-state.
   */
  it('MEASURED: every subject is a GAINED, ADMITTED, READ-ONLY handler on the block shape this file names',
    () => {
      let subjects = 0;
      for (const row of [...ROWS, RECORDED_NEGATIVE]) {
        const artifact = compileRow(row, `aa20${'11'.repeat(32)}87`, '22'.repeat(32));
        const handlers = artifact.hiddenBatch!.handlers as any[];
        const eligible = handlers.filter((handler) => handler.eligible).map((handler) => handler.name);
        const layout = artifact.hiddenBatch!.route.blockLayout!;
        console.log(`[V2B] ${key(row).padEnd(72)} blockSize=${layout.blockSize} `
          + `slots=${JSON.stringify(layout.slots.map((slot: any) => slot.kind))}`);
        expect(layout.slots.map((slot: any) => slot.kind), `${key(row)} block shape moved`).toEqual(row.slots);
        const path = `${row.root ?? SBE}/${row.rel}`;
        let direct: any;
        try { direct = (compileFileMulti(path, DIRECT as never) as any)[row.contract]; } catch { direct = undefined; }
        if (!direct) direct = compileFile(path, DIRECT as never) as any;
        for (const subject of row.subjects) {
          subjects += 1;
          expect(GAINED_BY_THE_REPAIR[key(row)], `${key(row)}: ${subject.handler} is not a gained handler`)
            .toContain(subject.handler);
          expect(eligible, `${key(row)}: ${subject.handler} is not admitted`).toContain(subject.handler);
          const abi = direct.abi.find((entry: any) => entry.name === subject.handler);
          expect(abi?.writesState, `${key(row)}.${subject.handler} is not read-only`).toBe(false);
        }
        expect(row.subjects.map((subject) => subject.handler),
          `${key(row)}: the hostile subject is not run as a positive`).toContain(row.hostileSubject);
      }
      console.log(`[V2B] ${subjects} subject handlers across ${ROWS.length} rows`);
      expect(subjects).toBeGreaterThan(0);
    }, 1_800_000);

  /**
   * WHAT A REAL NODE WOULD SAY ABOUT THE SIZE. `artifact.bytecode` is an ASM LISTING, so it is ASSEMBLED here
   * and not divided by two. Unlike the two X190 writer subjects (17,224 B and 12,972 B), every subject in this
   * file is under the 10,000-byte per-input script limit - which does not make a settlement here a
   * deployability claim, but does remove size as the reason it is not one.
   */
  it('MEASURED: every subject fits the 10,000-byte input-script limit, printed per row', () => {
    const oversize: string[] = [];
    for (const row of [...ROWS, RECORDED_NEGATIVE]) {
      const artifact = compileRow(row, `aa20${'11'.repeat(32)}87`, '22'.repeat(32));
      const bytes = scriptToBytecode(asmToScript(artifact.bytecode)).length;
      const fits = bytes <= 10_000;
      console.log(`[V2B] ${key(row).padEnd(72)} ${String(bytes).padStart(6)} B  ${fits ? 'FITS' : 'OVER'}`);
      if (!fits) oversize.push(`${key(row)}=${bytes}`);
    }
    expect(oversize, 'a subject exceeds the input-script limit and its settlement would be size-refused')
      .toEqual([]);
  }, 1_800_000);

  /**
   * One attempt at one recovered route. `attack` moves exactly one field; `declared` is `undefined` for the
   * PROBE run, which is traced under the VM debugger and never broadcast. A VOID handler never probes: its
   * result vector is EMPTY by construction, and the commitment is that empty vector's single push.
   */
  async function attempt(row: Row, subject: Subject, attack: Attack, declared: Uint8Array | undefined):
  Promise<{ sent?: string; refusal?: string; failingInput?: number; discovered?: Uint8Array; isVoid: boolean }> {
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
    const artifact = compileRow(row, controller.lockingBytecode as string, controllerCategory);
    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, row.state);
    const participant = base.withCategory(hexToBin(setup.categoryId));

    const published = (artifact.hiddenBatch!.handlers as any[])
      .find((handler) => handler.name === subject.handler);
    const isVoid = (published?.outputs ?? []).length === 0;

    // A BELIEVABLE WRONG: the same bytes with one bit moved, not a random blob.
    const forge = (value: Uint8Array): Uint8Array => {
      const wrong = Uint8Array.from(value);
      if (wrong.length === 0) return Uint8Array.from([0x01]);
      wrong[wrong.length - 1] ^= 0x01;
      return wrong;
    };
    // `declared` is the full return-event COMMITMENT the route computes, read off its own trace. The
    // transcript declares the vector INSIDE it, so the two are one push apart; the payload is DECODED with
    // libauth rather than re-encoded here, and the honest run asserts the re-wrap reproduces the covenant's
    // own bytes exactly, so no encoding is ever guessed.
    const innerVector = isVoid ? new Uint8Array(0) : (declared === undefined ? PROBE_RESULT : (() => {
      const [instruction, ...rest] = decodeAuthenticationInstructions(declared);
      const data = (instruction as { data?: Uint8Array }).data;
      if (data === undefined || rest.length !== 0) {
        throw new Error(`${key(row)}: the route's return commitment is not a single push`);
      }
      return data;
    })());
    const publishedVector = attack === 'result' ? forge(innerVector) : innerVector;
    const publishedCommitment = (!isVoid && declared === undefined)
      ? PROBE_RESULT : scriptToBytecode([publishedVector]);
    if (!isVoid && declared !== undefined && attack !== 'result') {
      expect(binToHex(publishedCommitment), `${key(row)}: re-wrapping the decoded vector did not reproduce `
        + 'the commitment the route computed').toBe(binToHex(declared));
    }

    // THE UNBOUND ROUTE WITNESSES, taken from the SDK rather than guessed. A route declares the shared entry
    // key of every collection handler it admits; a getter that binds none leaves those keys for the caller,
    // and the SDK names each missing one exactly. This supplies precisely the named set.
    const unboundRouteWitnesses: Record<string, Uint8Array | bigint> = {};
    const zeroWitness = (name: string): Uint8Array | bigint => {
      const declaredType = (artifact.hiddenBatch!.route.inputs as any[])
        .find((input) => input.name === name)?.type;
      if (declaredType === undefined) throw new Error(`${key(row)}: the route declares no witness '${name}'`);
      return /^(u?int|bigint)/.test(declaredType) ? 0n : new Uint8Array(32);
    };
    const planOnce = (): any => layer3.planCompiledGraph(
      [{ artifact, lockingBytecode: participant.lockingBytecode, unboundRouteWitnesses }],
      [{ parent: null, callee: 0, function: subject.handler, args: (subject.args ?? []) as never[] }],
    );
    let plan: any;
    for (let attemptIndex = 0; ; attemptIndex += 1) {
      try {
        plan = planOnce();
        break;
      } catch (error) {
        const named = (error as Error).message.match(/Missing SCB1 route witness '([^']+)'/);
        if (!named || attemptIndex > 16) throw error;
        unboundRouteWitnesses[named[1]] = zeroWitness(named[1]);
      }
    }
    const layout = layer3.compiledGraphPhysicalLayout(plan);
    // VOID: no result and no return output in the transcript, but the return-event OUTPUT still exists and
    // still commits to the empty vector. Absent and empty are different, which is the whole X177 finding.
    const transcript = isVoid
      ? layer3.finalizeCompiledGraph(
        plan, {}, layout.participantInputs, [null], [''], layout.projectionInputs, '',
      )
      : layer3.finalizeCompiledGraph(
        plan, { 0: binToHex(publishedVector) }, layout.participantInputs, layout.returnOutputs,
        [binToHex(publishedVector)], layout.projectionInputs, '',
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

    // Every subject is read-only, so the post-state the covenant must accept IS the pre-state. The `state`
    // hostile moves exactly one persisted field and nothing else.
    const commitments = buildInitialStateCommitments(artifact.stateLayout!, row.state);
    const tamperedState = attack === 'state'
      ? buildInitialStateCommitments(artifact.stateLayout!, { ...row.state, ...row.stateTamper })
      : commitments;

    const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
    let dataNftCursor = 0;
    for (const slot of artifact.hiddenBatch!.route.blockLayout!.slots as any[]) {
      switch (slot.kind) {
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
          // X180: the second argument is the MASTER's input index, not the data NFT's slot. Passing the slot
          // names the master only for slot 0, so any route with two or more data NFTs fails at input 2 - the
          // reading four rows recorded as an oracle wall.
          tx.addInput(setup.dataNftUtxos[index], createDataNftUnlocker(participant, 0, setup.categoryId));
          tx.addOutput({
            to: getDataNftAddress(participant, setup.categoryId),
            amount: setup.dataNftUtxos[index].satoshis,
            token: {
              category: setup.categoryId,
              amount: 0n,
              nft: { capability: 'mutable', commitment: tamperedState[index] },
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
        case 'entry': {
          const collection = (artifact.hiddenBatch!.route.entryAccesses as any[])[slot.slotIndex ?? 0]
            ?.collection as string;
          if (collection === undefined) throw new Error(`${key(row)}: the route names no entry collection`);
          const entryAddress = getEntryNftAddress(participant, setup.categoryId, collection);
          const entryUtxo = (await provider.getUtxos(entryAddress))[0];
          if (entryUtxo === undefined) throw new Error(`${key(row)}: the ${collection} entry NFT is unstaged`);
          tx.addInput(entryUtxo, createEntryNftUnlocker(participant, 0, setup.categoryId, collection));
          tx.addOutput({
            to: entryAddress,
            amount: entryUtxo.satoshis,
            token: {
              category: setup.categoryId,
              amount: 0n,
              nft: { capability: 'mutable', commitment: entryUtxo.token!.nft!.commitment },
            },
          });
          break;
        }
        default:
          throw new Error(`${key(row)}: this harness does not stage a '${slot.kind}' slot`);
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

    if (!isVoid && declared === undefined) {
      const vm = createVirtualMachineBch2026ForProvider(provider);
      const trace = vm.debug({
        inputIndex: 0,
        sourceOutputs: generateLibauthSourceOutputs(tx.inputs as never),
        transaction: tx.buildLibauthTransaction(),
      }) as unknown[];
      return { discovered: routeResultFromTrace(trace, PROBE_RESULT, `${key(row)}.${subject.handler}`), isVoid };
    }
    try {
      return { sent: await provider.sendRawTransaction(raw(tx)), isVoid };
    } catch (error) {
      const refusal = (error as Error).message;
      const index = refusal.match(/input index (\d+)/);
      return { refusal, failingInput: index ? Number(index[1]) : undefined, isVoid };
    }
  }

  /** Is the handler VOID? Read off the route's published outputs, memoized so it costs one compile per row. */
  const shapes = new Map<string, any>();
  const isVoidHandler = (row: Row, subject: Subject): boolean => {
    if (!shapes.has(key(row))) shapes.set(key(row), compileRow(row, `aa20${'11'.repeat(32)}87`, '22'.repeat(32)));
    const published = (shapes.get(key(row)).hiddenBatch.handlers as any[])
      .find((handler) => handler.name === subject.handler);
    return (published?.outputs ?? []).length === 0;
  };

  /** The route's own result, read once off its trace and reused by the positive and both hostiles. */
  const cached = new Map<string, Uint8Array | null>();
  async function routeResult(row: Row, subject: Subject): Promise<Uint8Array | undefined> {
    const cacheKey = `${key(row)}.${subject.handler}`;
    if (!cached.has(cacheKey)) {
      if (isVoidHandler(row, subject)) {
        cached.set(cacheKey, null);
        console.log(`[V2B] ${cacheKey} is VOID: the result vector is EMPTY, not absent - no probe needed`);
      } else {
        const probe = await attempt(row, subject, 'none', undefined);
        cached.set(cacheKey, probe.discovered!);
        console.log(`[V2B] ${cacheKey} result off its own trace: ${binToHex(probe.discovered!)}`);
      }
    }
    return cached.get(cacheKey) ?? undefined;
  }

  /** Every settled txid this file produced, printed at the end so the count is read rather than estimated. */
  const settled: string[] = [];

  const positive = (row: Row, subject: Subject) => async (): Promise<void> => {
    const result = await attempt(row, subject, 'none', await routeResult(row, subject));
    if (result.refusal) {
      console.log(`[V2B] ${key(row)}.${subject.handler} refused: ${result.refusal.split('\n')[0]} `
        + `input=${result.failingInput}`);
    }
    expect(result.refusal, `the recovered ${key(row)}.${subject.handler} row did not settle`).toBeUndefined();
    expect(result.sent).toMatch(/^[0-9a-f]{64}$/);
    settled.push(`${row.rel}::${row.contract}.${subject.handler} ${result.sent}`);
    console.log(`[V2B] SETTLED ${key(row)}.${subject.handler} ${result.sent}`);
  };

  /**
   * GUARD NEGATIVE CONTROL. Each differs from the settling positive in exactly one field, that positive is
   * rebuilt by this same helper in this same file, and the refusal must NAME the participant input - never a
   * bare throw.
   */
  const hostile = (row: Row, attack: Attack) => async (): Promise<void> => {
    const subject = row.subjects.find((entry) => entry.handler === row.hostileSubject)!;
    const result = await attempt(row, subject, attack, await routeResult(row, subject));
    console.log(`[V2B] ${key(row)}/${attack}: ${(result.refusal ?? 'ACCEPTED').split('\n')[0]} `
      + `input=${result.failingInput}`);
    expect(result.sent, `a forged ${key(row)} ${attack} was ACCEPTED`).toBeUndefined();
    expect(result.refusal).toBeDefined();
    expect(result.refusal).toMatch(/OP_VERIFY|mandatory-script-verify-flag-failed|non-truthy/);
    expect(result.failingInput, 'the refusal did not name the participant input').toBe(0);
  };

  for (const row of ROWS) {
    for (const subject of row.subjects) {
      it(`MEASURED: recovered ${key(row)}.${subject.handler} SETTLES`, positive(row, subject), 1_800_000);
    }
    it(`HOSTILE: ${key(row)} return event carrying a believable-wrong result is refused`,
      hostile(row, 'result'), 1_800_000);
    it(`HOSTILE: ${key(row)} post-state carrying one mutated field is refused`,
      hostile(row, 'state'), 1_800_000);
  }

  /**
   * THE RECORDED NEGATIVE, RUN RATHER THAN REMOVED. This row's route never puts the declared result beside a
   * computed one, so the probe hands back nothing and no honest commitment can be published for it. What is
   * recorded is both halves: the probe's own failure, and where a settle attempt carrying the SENTINEL - a
   * value the covenant cannot have computed - stops.
   *
   * THIS IS NOT EVIDENCE THAT THE COVENANT REFUSES THE HANDLER. A sentinel result SHOULD be refused, so the
   * refusal below discriminates nothing on its own; without a settling positive for this row there is no
   * control. It is recorded so the row is visible as UNPROVEN IN BOTH DIRECTIONS, and the positive
   * expectation turns red the day it settles.
   */
  it('X199: `ReEntrancy.sol::Attack` PROBES now, and a sentinel result is still refused', async () => {
    const subject = RECORDED_NEGATIVE.subjects
      .find((entry) => entry.handler === RECORDED_NEGATIVE.hostileSubject)!;
    let probeFailure: string | undefined;
    try {
      await attempt(RECORDED_NEGATIVE, subject, 'none', undefined);
    } catch (error) {
      probeFailure = (error as Error).message;
    }
    console.log(`[V2B] ${key(RECORDED_NEGATIVE)}.${subject.handler} probe: ${probeFailure ?? 'SUCCEEDED'}`);
    // X199 CLOSED THE REASON THIS ROW WAS UNPROVEN IN BOTH DIRECTIONS. The probe used to hand back nothing -
    // the route stopped in its preamble on the SCB1 logical-value-mode byte, because the SDK sized rows from
    // the PUBLISHED handler set while the route sized its own from the ELIGIBLE one, and `ReEntrancy`'s
    // payable handler is refused by synthesis. With both sides on `eligible && usesMsgValue` the probe runs,
    // so the sentinel refusal below now HAS its control and discriminates.
    expect(probeFailure, 'the probe stopped working again - X199 may have regressed').toBeUndefined();
    const result = await attempt(RECORDED_NEGATIVE, subject, 'none', scriptToBytecode([PROBE_RESULT]));
    console.log(`[V2B] ${key(RECORDED_NEGATIVE)}.${subject.handler} sentinel settle: `
      + `${(result.refusal ?? `ACCEPTED ${result.sent}`).split('\n')[0]} input=${result.failingInput}`);
    expect(result.sent, 'a sentinel result was ACCEPTED').toBeUndefined();
    expect(result.failingInput, 'the refusal did not name the participant input').toBe(0);
  }, 1_800_000);

  /** THE COUNT, read off what actually settled rather than off the row table. */
  it('MEASURED: how many of the 206 gained handlers this file settles on the VM', () => {
    for (const entry of settled) console.log(`[V2B] SETTLED ON THE VM: ${entry}`);
    const unproved = RECORDED_NEGATIVE.subjects
      .map((subject) => `${key(RECORDED_NEGATIVE)}.${subject.handler}`);
    for (const entry of unproved) console.log(`[V2B] UNPROVEN IN BOTH DIRECTIONS: ${entry}`);
    console.log(`[V2B] ${settled.length} gained handlers settle in this file; ${unproved.length} more are `
      + `run and recorded as unproven; ${206 - settled.length} of the 206 are NOT proved here.`);
    expect(settled.length).toBe(ROWS.reduce((total, row) => total + row.subjects.length, 0));
    expect(settled.length).toBe(47);
  });
});
