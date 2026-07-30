import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeAuthenticationInstructions, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { buildInitialStateCommitments, scriptToBytecode } from '@solidcash/utils';
import { compileFile, compileString } from 'solidc';
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
 * X136 CONTINUED. SET A - THE LARGEST PARTITION, AND THE LEAST EXAMINED.
 *
 * The L2-F2 repair made 112 handlers newly buildable across three sets. Set A is 11 contracts and 53 of those
 * handlers, and it is the set whose ROUTE BLOCK SHAPE did not move while every redeem script GREW. That
 * combination is why it is worth running: a settling row here is evidence about the recovery generally, not
 * about one contract that happened to gain a slot.
 *
 * Before this file, three of the 112 had been executed - `Airdrop.getLeafHash` (Set B, a keccak side-car
 * route) and `Attack.owner`/`Attack.wallet` (NEW set) - and one, `Attack.attack`, had been proved NOT to
 * settle. NOTHING IN SET A HAD EVER BEEN RUN.
 *
 * WHICH HANDLERS ARE ACTUALLY "GAINED", MEASURED RATHER THAN ASSUMED. The partition counts handlers the repair
 * ADDED, not handlers a contract publishes. Both sides were compiled - `a2885464^` = `c988817e` in a dedicated
 * worktree, and this branch - and the per-contract difference is what the rows below name:
 *
 *   contract           before ->  after   GAINED BY THE REPAIR
 *   ERC20Bank          1      ->  2       token
 *   Vault              1      ->  3       token, totalSupply
 *   CrowdFund          1      ->  3       token, count
 *   EnglishAuction     1      ->  9       nft, nftId, seller, endAt, started, ended, highestBidder, highestBid
 *
 * Each row below invokes a handler from the GAINED column, so a settling row is a recovered handler settling
 * and not a handler that always worked.
 *
 * THE FOUR CONTRACTS ARE FOUR DISTINCT BLOCK SHAPES, which is what makes this a sample rather than a repeat:
 *
 *   ERC20Bank        blockSize 3   master dataNft                     returnEvent
 *   Vault            blockSize 4   master dataNft  entry              returnEvent
 *   CrowdFund        blockSize 4   master dataNft  dataNft            returnEvent
 *   EnglishAuction   blockSize 5   master dataNft  dataNft  dataNft   returnEvent
 *
 * `Airdrop` and `Attack` were both single-dataNft blocks with no entry slot, so a co-spent ENTRY input and a
 * multi-data-NFT block are both shapes no recovered route had been run on at all.
 *
 * THE RESULT IS NEVER RE-DERIVED HERE. Every row's declared return value is read off the ROUTE'S OWN VM TRACE
 * by `routeResultFromTrace` below, exactly as the Airdrop proof reads its keccak preimage off the trace rather
 * than recomputing `abi.encode`. A harness that guessed the result encoding wrong could not accidentally agree
 * with the covenant, because it never writes an encoding down.
 *
 * WHAT IS NOT ESTABLISHED. Every handler in this file is `writesState: false`; Set A's gained population is
 * read-only, so this is a read surface, and the one recovered WRITER is the separate, negative
 * `Layer3RecoveredWriterX136.test.ts`. `MarketplaceV1/V2/V3`, `FakeToken`, `UnicrowArbitrator`,
 * `UnicrowDispute` and `StableSwap` are Set A members this file does not run.
 */

const SBE = `${process.env.SBE_ROOT ?? '/Code/solidity-by-example'}/contracts/src`;

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));

const BUS = {
  solidityImportCompat: true,
  ecrecover: 'p2pkh',
  forceStateful: true,
  experimentalHiddenBatch: true,
};

/** A distinctive placeholder result: the probe run declares it, so the trace's OTHER operand is the real one. */
const PROBE_RESULT = hexToBin('9e'.repeat(32));

/**
 * The return-event commitment the ROUTE ITSELF computes, read off its own execution.
 *
 * The probe declares `PROBE_RESULT` and is never broadcast; the route reaches its return-event check and
 * compares what it computed against what the output carries. This finds the step where those two operands are
 * both on the stack - identified by the placeholder being one of them - and returns the OTHER one. So the
 * value every row below commits to is the value the covenant produced, and nothing here encodes a result.
 */
function routeResultFromTrace(trace: unknown[], placeholder: Uint8Array): Uint8Array {
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
  if (found === undefined) {
    throw new Error('route result extraction: the probe trace never compared the declared result');
  }
  return found;
}

/** What one built attempt differs in. Exactly one field moves per hostile. */
type Attack = 'none' | 'result' | 'state';

interface Row {
  name: string;
  file: string;
  /** Handlers this contract GAINED in the repair, measured against `c988817e`. */
  gained: readonly string[];
  /** The gained handler this file runs to completion. */
  subject: string;
  state: Record<string, unknown>;
  blockSize: number;
  slots: readonly string[];
  /** The sorted collection whose head-sentinel entry NFT fills the block's `entry` slot, when it has one. */
  entryCollection?: string;
}

const ROWS: readonly Row[] = [
  {
    name: 'ERC20Bank',
    file: `${SBE}/hacks/weth-permit/ERC20Bank.sol`,
    gained: ['token'],
    subject: 'token',
    state: { token: hexToBin(`aa20${'55'.repeat(32)}87`) },
    blockSize: 3,
    slots: ['master', 'dataNft', 'returnEvent'],
  },
  {
    name: 'Vault',
    file: `${SBE}/defi/vault/Vault.sol`,
    gained: ['token', 'totalSupply'],
    subject: 'totalSupply',
    state: { token: hexToBin(`aa20${'55'.repeat(32)}87`), totalSupply: 4_242n },
    blockSize: 4,
    slots: ['master', 'dataNft', 'entry', 'returnEvent'],
    entryCollection: 'balanceOf',
  },
  {
    name: 'CrowdFund',
    file: `${SBE}/app/crowd-fund/CrowdFund.sol`,
    gained: ['token', 'count'],
    subject: 'count',
    state: {
      token: hexToBin(`aa20${'55'.repeat(32)}87`),
      count: 7n,
      __block_timestamp: 0n,
      __blockOracleOwner: alicePub,
    },
    blockSize: 4,
    slots: ['master', 'dataNft', 'dataNft', 'returnEvent'],
  },
  {
    name: 'EnglishAuction',
    file: `${SBE}/app/english-auction/EnglishAuction.sol`,
    gained: [
      'nft', 'nftId', 'seller', 'endAt', 'started', 'ended', 'highestBidder', 'highestBid',
    ],
    subject: 'seller',
    state: {
      nft: hexToBin(`aa20${'33'.repeat(32)}87`),
      nftId: 9n,
      seller: hexToBin(`aa20${'77'.repeat(32)}87`),
      endAt: 0n,
      started: false,
      ended: false,
      highestBidder: hexToBin(`aa20${'00'.repeat(32)}87`),
      highestBid: 0n,
      __block_timestamp: 0n,
      __blockOracleOwner: alicePub,
    },
    blockSize: 5,
    slots: ['master', 'dataNft', 'dataNft', 'dataNft', 'returnEvent'],
  },
];

describe('X136: Set A, the partition whose block shape did not move', () => {
  /**
   * THE PARTITION TEST, from this run's own compiles. It states that each subject really is a handler the
   * repair ADDED and that the block shape is the one this file claims to be exercising, so the rows below are
   * known to be running recovered routes rather than routes that always worked.
   */
  it('MEASURED: every subject is a GAINED handler on the block shape this file names', () => {
    for (const row of ROWS) {
      const artifact = compileFile(row.file, {
        ...BUS,
        experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
        experimentalMessageBusControllerCategory: '22'.repeat(32),
      } as never) as any;
      const handlers = artifact.hiddenBatch!.handlers as any[];
      const eligible = handlers.filter((handler) => handler.eligible).map((handler) => handler.name);
      const layout = artifact.hiddenBatch!.route.blockLayout!;
      console.log(`[X136A] ${row.name.padEnd(15)} blockSize=${layout.blockSize} `
        + `slots=${JSON.stringify(layout.slots.map((slot: any) => slot.kind))}`);
      console.log(`[X136A]   eligible=${JSON.stringify(eligible)} gained=${JSON.stringify(row.gained)}`);
      expect(layout.blockSize, `${row.name} block size moved`).toBe(row.blockSize);
      expect(layout.slots.map((slot: any) => slot.kind)).toEqual(row.slots);
      for (const gained of row.gained) {
        expect(eligible, `${row.name}: ${gained} is not admitted`).toContain(gained);
      }
      expect(row.gained, `${row.name}: the subject is not one of the gained handlers`)
        .toContain(row.subject);
      // Set A's gained population is read-only. Stated, not assumed - it bounds what this file establishes.
      for (const gained of row.gained) {
        const abi = artifact.abi.find((entry: any) => entry.name === gained);
        expect(abi?.writesState, `${row.name}.${gained} is not read-only`).toBe(false);
      }
    }
  }, 900_000);

  /**
   * One attempt at one recovered route. `attack` moves exactly one field; `declared` is `undefined` for the
   * PROBE run, which is traced under the VM debugger and never broadcast.
   */
  async function attempt(row: Row, attack: Attack, declared: Uint8Array | undefined): Promise<{
    sent?: string; refusal?: string; failingInput?: number; discovered?: Uint8Array;
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
    const artifact = compileFile(row.file, {
      ...BUS,
      experimentalMessageBusController: controller.lockingBytecode,
      experimentalMessageBusControllerCategory: controllerCategory,
    } as never) as any;
    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, row.state);
    const participant = base.withCategory(hexToBin(setup.categoryId));

    // A BELIEVABLE WRONG: the same bytes with one bit moved, not a random blob - the value an honest builder
    // would have produced for a neighbouring state.
    const forge = (value: Uint8Array): Uint8Array => {
      const wrong = Uint8Array.from(value);
      if (wrong.length === 0) return Uint8Array.from([0x01]);
      wrong[wrong.length - 1] ^= 0x01;
      return wrong;
    };
    // `declared` is the full return-event COMMITMENT the route computes, read off its own trace. The
    // transcript declares the vector INSIDE it, so the two are one push apart; the payload is DECODED with
    // libauth rather than re-encoded here, and the honest run asserts the re-wrap reproduces the covenant's
    // own bytes exactly (`rewrap` below), so no encoding is ever guessed.
    const innerVector = declared === undefined ? PROBE_RESULT : (() => {
      const [instruction, ...rest] = decodeAuthenticationInstructions(declared);
      const data = (instruction as { data?: Uint8Array }).data;
      if (data === undefined || rest.length !== 0) {
        throw new Error(`${row.name}: the route's return commitment is not a single push`);
      }
      return data;
    })();
    const publishedVector = attack === 'result' ? forge(innerVector) : innerVector;
    const publishedCommitment = declared === undefined
      ? PROBE_RESULT : scriptToBytecode([publishedVector]);
    if (declared !== undefined && attack !== 'result') {
      expect(binToHex(publishedCommitment), `${row.name}: re-wrapping the decoded vector did not reproduce `
        + 'the commitment the route computed').toBe(binToHex(declared));
    }
    const published = publishedVector;

    // THE UNBOUND ROUTE WITNESSES, taken from the SDK rather than guessed. A route declares the shared entry
    // key of every collection handler it admits, and a getter that binds none leaves those keys for the
    // caller - the documented `unboundRouteWitnesses` case, and not a hole: the block carries no entry slot
    // for them, so nothing is read through them on this transaction. The SDK names each missing key exactly,
    // so this supplies precisely the named set and never a guessed one.
    const unboundRouteWitnesses: Record<string, Uint8Array> = {};
    const planOnce = (): any => layer3.planCompiledGraph(
      [{ artifact, lockingBytecode: participant.lockingBytecode, unboundRouteWitnesses }],
      [{ parent: null, callee: 0, function: row.subject, args: [] as never[] }],
    );
    let plan: any;
    for (let attemptIndex = 0; ; attemptIndex += 1) {
      try {
        plan = planOnce();
        break;
      } catch (error) {
        const named = (error as Error).message.match(/Missing SCB1 route witness '([^']+)'/);
        if (!named || attemptIndex > 16) throw error;
        unboundRouteWitnesses[named[1]] = new Uint8Array(32);
      }
    }
    const layout = layer3.compiledGraphPhysicalLayout(plan);
    const transcript = layer3.finalizeCompiledGraph(
      plan, { 0: binToHex(published) }, layout.participantInputs, layout.returnOutputs,
      [binToHex(published)], layout.projectionInputs, '',
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

    // The post-state the covenant must accept: no admitted handler on any of these routes assigns a state
    // variable, so it is the pre-state. The `state` hostile mutates one persisted field and nothing else.
    const commitments = buildInitialStateCommitments(artifact.stateLayout!, row.state);
    const tamperedState = attack === 'state'
      ? buildInitialStateCommitments(artifact.stateLayout!, {
        ...row.state,
        ...(typeof Object.values(row.state)[1] === 'bigint'
          ? { [Object.keys(row.state)[1]]: (Object.values(row.state)[1] as bigint) + 1n }
          : { [Object.keys(row.state)[0]]: forge(Object.values(row.state)[0] as Uint8Array) }),
      })
      : commitments;

    const entryAddress = row.entryCollection === undefined ? undefined
      : getEntryNftAddress(participant, setup.categoryId, row.entryCollection);
    const entryUtxo = entryAddress === undefined ? undefined
      : (await provider.getUtxos(entryAddress))[0];
    if (row.entryCollection !== undefined && entryUtxo === undefined) {
      throw new Error(`${row.name}: the ${row.entryCollection} entry NFT was not staged`);
    }

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
          tx.addInput(setup.dataNftUtxos[index], createDataNftUnlocker(participant, index, setup.categoryId));
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
        case 'entry':
          tx.addInput(entryUtxo!, createEntryNftUnlocker(
            participant, 0, setup.categoryId, row.entryCollection!,
          ));
          tx.addOutput({
            to: entryAddress!,
            amount: entryUtxo!.satoshis,
            token: {
              category: setup.categoryId,
              amount: 0n,
              nft: { capability: 'mutable', commitment: entryUtxo!.token!.nft!.commitment },
            },
          });
          break;
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
          throw new Error(`${row.name}: this harness does not stage a '${slot.kind}' slot`);
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

    if (declared === undefined) {
      // PROBE. Trace the route's own execution and read the result IT computes; never broadcast.
      const vm = createVirtualMachineBch2026ForProvider(provider);
      const trace = vm.debug({
        inputIndex: 0,
        sourceOutputs: generateLibauthSourceOutputs(tx.inputs as never),
        transaction: tx.buildLibauthTransaction(),
      }) as unknown[];
      return { discovered: routeResultFromTrace(trace, PROBE_RESULT) };
    }
    try {
      return { sent: await provider.sendRawTransaction(raw(tx)) };
    } catch (error) {
      const refusal = (error as Error).message;
      const index = refusal.match(/input index (\d+)/);
      return { refusal, failingInput: index ? Number(index[1]) : undefined };
    }
  }

  /** The route's own result, read once off its trace and reused by every row for that contract. */
  const cached = new Map<string, Uint8Array>();
  async function routeResult(row: Row): Promise<Uint8Array> {
    if (!cached.has(row.name)) {
      const probe = await attempt(row, 'none', undefined);
      cached.set(row.name, probe.discovered!);
      console.log(`[X136A] ${row.name}.${row.subject} result off its own trace: `
        + `${binToHex(probe.discovered!)}`);
    }
    return cached.get(row.name)!;
  }

  for (const row of ROWS) {
    /**
     * THE POSITIVE, and the guard negative control for both hostiles: the same builder, the same block, the
     * same staging - only the attacked field differs below.
     */
    it(`MEASURED: the recovered ${row.name} route SETTLES its gained '${row.subject}' row`, async () => {
      const result = await attempt(row, 'none', await routeResult(row));
      if (result.refusal) console.log(`[X136A] ${row.name} refused: ${result.refusal.split('\n')[0]}`);
      expect(result.refusal, `the recovered ${row.name} route did not settle`).toBeUndefined();
      expect(result.sent).toMatch(/^[0-9a-f]{64}$/);
      console.log(`[X136A] ${row.name}.${row.subject} settled ${result.sent}`);
    }, 900_000);

    it(`HOSTILE: ${row.name}'s return event carrying a believable-wrong result is refused`, async () => {
      const result = await attempt(row, 'result', await routeResult(row));
      console.log(`[X136A] ${row.name}/result: ${(result.refusal ?? 'ACCEPTED').split('\n')[0]}`);
      expect(result.sent, `a forged ${row.name} result was ACCEPTED`).toBeUndefined();
      expect(result.refusal).toBeDefined();
      expect(result.refusal).toMatch(/OP_VERIFY|mandatory-script-verify-flag-failed|non-truthy/);
      expect(result.failingInput, 'the refusal did not name the participant input').toBe(0);
    }, 900_000);

    it(`HOSTILE: ${row.name}'s post-state carrying a mutated field is refused`, async () => {
      const result = await attempt(row, 'state', await routeResult(row));
      console.log(`[X136A] ${row.name}/state: ${(result.refusal ?? 'ACCEPTED').split('\n')[0]}`);
      expect(result.sent, `a forged ${row.name} post-state was ACCEPTED`).toBeUndefined();
      expect(result.refusal).toBeDefined();
      expect(result.failingInput, 'the refusal did not name the participant input').toBe(0);
    }, 900_000);
  }
});
