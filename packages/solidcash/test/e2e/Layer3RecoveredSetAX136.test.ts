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
import { encodeEntryCommitment, keyToSlot, keyToSlotMulti } from '../../src/stateful/index.js';
import type { Utxo } from '../../src/interfaces.js';

/**
 * X136 CONTINUED. RUNNING THE RECOVERED HANDLERS - SET A, AND MyToken'S 69-SLOT ROUTE.
 *
 * The L2-F2 repair made 112 handlers newly buildable across three sets. Before this file FOUR of them had ever
 * been executed: `Airdrop.getLeafHash` settles (Set B, keccak side-car), `Attack.owner` and `Attack.wallet`
 * settle (NEW set), and `Attack.attack` - the population's only writer - was proved NOT to, fail-closed.
 * SET A, 11 contracts and the largest share of the 112, had never been run at all, and neither had the route
 * `MyToken` was left with after it LOST a covenant slot.
 *
 * THIS FILE SETTLES SEVEN MORE, each its own broadcast transaction:
 *
 *   ERC20Bank.token          set A   blockSize 3   master dataNft                   returnEvent
 *   Vault.token              set A   blockSize 4   master dataNft entry             returnEvent
 *   Vault.totalSupply        set A   blockSize 4   master dataNft entry             returnEvent
 *   MyToken.totalSupply      set B   blockSize 68  master dataNft entry returnEvent + 64 trailing
 *   MyToken.decimals         set B   blockSize 68  "
 *   MyToken.name             set B   blockSize 68  "
 *   MyToken.symbol           set B   blockSize 68  "
 *
 * WHICH HANDLERS ARE "GAINED", MEASURED RATHER THAN ASSUMED. The partition counts handlers the repair ADDED,
 * not handlers a contract publishes, so both sides were compiled - `a2885464^` = `c988817e` in a dedicated
 * worktree, and this branch. The difference per contract:
 *
 *   contract           before -> after   GAINED BY THE REPAIR
 *   ERC20Bank          1      ->  2      token
 *   Vault              1      ->  3      token, totalSupply
 *   MyToken            2      ->  6      totalSupply, name, symbol, decimals
 *
 * Every subject below is from the GAINED column, so a settling row is a RECOVERED handler settling and not a
 * handler that always worked. `MyToken`'s four are its entire gained set.
 *
 * MyToken WAS REPORTED AS THE SLOT-LOSS ROW, BUT THAT CLAIM IS NO LONGER TRUE. The function-wide transfer
 * frame repair re-derived blockSize 69 with both `balanceOf` and `allowance` identities. This file runs that
 * current shape to completion on all four gained handlers, with one authenticated entry NFT per published
 * identity and the 64-slot trailing region materialized.
 *
 * THE RESULT IS NEVER RE-DERIVED HERE. Each row's declared return value is read off the ROUTE'S OWN VM TRACE by
 * `routeResultFromTrace`, exactly as the Airdrop proof reads its keccak preimage off the trace rather than
 * recomputing `abi.encode`; the honest run then asserts that re-wrapping the DECODED vector reproduces the
 * covenant's own commitment bytes exactly. A harness that guessed the encoding wrong could not accidentally
 * agree with the covenant, because it never writes an encoding down.
 *
 * THE 112 IS STALE. `Layer3RecoveredPartitionX160.test.ts` re-takes this partition at HEAD against the same
 * `c988817e` and measures 206 gained, 0 lost. Set A's total is unchanged at 53 - it read 50 only while
 * `StableSwap` had stopped compiling - so every per-contract figure below still holds.
 *
 * WHAT IS NOT ESTABLISHED, and it is most of the population.
 *
 *  - SEVEN of 112. That is what this file adds; it does not speak for the other rows.
 *  - Every subject here is `writesState: false`. Set A's gained population is read-only, so this is a read
 *    surface. The one recovered WRITER is the separate, negative `Layer3RecoveredWriterX136.test.ts`.
 *  - `CrowdFund` and `EnglishAuction` are Set A rows this file does NOT run, and THE REASON GIVEN HERE FOR
 *    `CrowdFund` WAS WRONG. This file blamed a block oracle and cited the refusal at input index 2 - "its
 *    ORACLE data NFT" - as the evidence. `Layer3RecoveredOracleWriterX180.test.ts` shows input 2 is simply
 *    the SECOND data NFT, and that this file was passing the data NFT's slot index where
 *    `createDataNftUnlocker` takes the MASTER's input index; any route with two or more data NFTs is refused
 *    there, oracle or not. `CrowdFund.count` SETTLES once the master index is right and the oracle registers
 *    are named in the pre-state. The unlocker argument is corrected below. `EnglishAuction` is still
 *    unproven: X180 measures its route aborting at a fixed instruction pointer before any handler dispatch,
 *    unchanged by the handler, by the declared state and by the caller shape, and does not say what it is.
 *  - `MarketplaceV1/V2/V3`, `FakeToken`, `UnicrowArbitrator`, `UnicrowDispute` and `StableSwap` are Set A
 *    members this file does not run at all.
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
  /** Which X136 partition this contract belongs to. */
  partition: 'A' | 'B';
  file: string;
  /** Handlers this contract GAINED in the repair, measured against `c988817e`. */
  gained: readonly string[];
  /** Gained handlers this file runs to completion, one settled transaction each. */
  subjects: readonly string[];
  /** The one subject the two hostiles are built against. */
  hostileSubject: string;
  state: Record<string, unknown>;
  /** The post-state hostile: exactly ONE persisted field, moved to a believable neighbour. */
  stateTamper: Record<string, unknown>;
  blockSize: number;
  slots: readonly string[];
}

const ROWS: readonly Row[] = [
  {
    name: 'ERC20Bank',
    partition: 'A',
    file: `${SBE}/hacks/weth-permit/ERC20Bank.sol`,
    gained: ['token'],
    subjects: ['token'],
    hostileSubject: 'token',
    state: { token: hexToBin(`aa20${'55'.repeat(32)}87`) },
    stateTamper: { token: hexToBin(`aa20${'55'.repeat(31)}5687`) },
    blockSize: 4,
    slots: ['master', 'dataNft', 'entry', 'returnEvent'],
  },
  {
    name: 'Vault',
    partition: 'A',
    file: `${SBE}/defi/vault/Vault.sol`,
    gained: ['token', 'totalSupply'],
    subjects: ['token', 'totalSupply'],
    hostileSubject: 'totalSupply',
    state: { token: hexToBin(`aa20${'55'.repeat(32)}87`), totalSupply: 4_242n },
    stateTamper: { totalSupply: 4_243n },
    blockSize: 4,
    slots: ['master', 'dataNft', 'entry', 'returnEvent'],
  },
  {
    // SET B, and the one row in this file that is not Set A. `MyToken` LOST a covenant slot in the repair
    // was once reported as losing an entry slot. The function-wide transfer-frame repair re-derived the live
    // route as 69 slots with BOTH `balanceOf` and `allowance` identities; this runs that current shape rather
    // than retaining the reverted X201-era 68-slot claim.
    //
    // Its block is also the only one here with a TRAILING REGION: 64 reserved slots, materialized as ordinary
    // funding in and dust out, because `blockSize` includes them and both the projection verifier and the root
    // controller step the next participant by `blockSize`. `name` and `symbol` are DYNAMIC strings and are
    // seeded empty, so no chunk UTXO is required and no dynamic write runs.
    name: 'MyToken',
    partition: 'B',
    file: `${SBE}/app/erc20/MyToken.sol`,
    gained: ['totalSupply', 'name', 'symbol', 'decimals'],
    subjects: ['totalSupply', 'decimals', 'name', 'symbol'],
    hostileSubject: 'totalSupply',
    state: { totalSupply: 1_000_000n, name: '', symbol: '', decimals: 18n },
    stateTamper: { totalSupply: 1_000_001n },
    blockSize: 69,
    slots: [
      'master', 'dataNft', 'entry', 'entry', 'returnEvent',
      ...Array.from({ length: 64 }, () => 'trailing'),
    ],
  },
];

describe('X136: recovered routes run to completion - Set A, and MyToken after transfer-frame re-derivation', () => {
  /**
   * THE PARTITION TEST, from this run's own compiles. It states that each subject really is a handler the
   * repair ADDED and that the block shape is the one this file claims to be exercising, so the rows below are
   * known to be running recovered routes rather than routes that always worked.
   */
  it('MEASURED: every subject is a GAINED handler on the block shape this file names', () => {
    for (const row of ROWS) {
      const artifact = compileFile(row.file, {
        ...BUS,
        messageBusController: `aa20${'11'.repeat(32)}87`,
        messageBusControllerCategory: '22'.repeat(32),
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
      for (const subject of row.subjects) {
        expect(row.gained, `${row.name}: ${subject} is not one of the gained handlers`).toContain(subject);
      }
      expect(row.subjects, `${row.name}: the hostile subject is not run as a positive`)
        .toContain(row.hostileSubject);
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
  async function attempt(row: Row, handler: string, attack: Attack, declared: Uint8Array | undefined):
  Promise<{ sent?: string; refusal?: string; failingInput?: number; discovered?: Uint8Array }> {
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
      messageBusController: controller.lockingBytecode,
      messageBusControllerCategory: controllerCategory,
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
    // caller - the documented `unboundRouteWitnesses` case. The compiler now publishes those identities as
    // entry slots, so the SDK names each missing key exactly and the staging below funds each named identity.
    const unboundRouteWitnesses: Record<string, Uint8Array | bigint> = {};
    // The zero value of the type the ROUTE declares for that witness, read from the route's own inputs. An
    // integer-keyed collection wants a number and a byte-keyed one wants bytes; neither is guessed here.
    const zeroWitness = (name: string): Uint8Array | bigint => {
      const declaredType = (artifact.hiddenBatch!.route.inputs as any[])
        .find((input) => input.name === name)?.type;
      if (declaredType === undefined) throw new Error(`${row.name}: the route declares no witness '${name}'`);
      return /^(u?int|bigint)/.test(declaredType) ? 0n : new Uint8Array(32);
    };
    const planOnce = (): any => layer3.planCompiledGraph(
      [{ artifact, lockingBytecode: participant.lockingBytecode, unboundRouteWitnesses }],
      [{ parent: null, callee: 0, function: handler, args: [] as never[] }],
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
      ? buildInitialStateCommitments(artifact.stateLayout!, { ...row.state, ...row.stateTamper })
      : commitments;

    // Stage one authenticated membership NFT per compiler-published entry identity. The route surface can
    // gain getter identities independently of this file's subjects (ERC20Bank gained balanceOf; MyToken now
    // carries both balanceOf and allowance), so a row-level single collection pin is necessarily stale.
    const entryAccesses = (artifact.hiddenBatch!.route.entryAccesses ?? []) as any[];
    const entryUtxos: Array<{ collection: string; address: string; utxo: Utxo }> = [];
    for (const [index, access] of entryAccesses.entries()) {
      const keys = (access.keyParams ?? []).map((param: string) => {
        const name = String(param).replace(/^id:/, '');
        const value = unboundRouteWitnesses[name];
        if (!(value instanceof Uint8Array)) {
          throw new Error(`${row.name}: entry slot ${index} has no byte identity witness '${name}'`);
        }
        return value;
      });
      if (keys.length === 0) throw new Error(`${row.name}: entry slot ${index} publishes no key identity`);
      const slot = keys.length === 1 ? keyToSlot(keys[0]) : keyToSlotMulti(keys);
      const address = getEntryNftAddress(participant, setup.categoryId, access.collection);
      const utxo = await (provider as any).addUtxo(address, {
        ...randomUtxo({ satoshis: 10_000n }),
        token: {
          category: setup.categoryId,
          amount: 0n,
          nft: {
            capability: 'mutable',
            commitment: binToHex(encodeEntryCommitment(slot, new Uint8Array(32), new Uint8Array(0))),
          },
        },
      });
      entryUtxos.push({ collection: access.collection, address, utxo });
    }

    const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
    let dataNftCursor = 0;
    let entryCursor = 0;
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
              nft: { capability: 'mutable', commitment: tamperedState[index] },
            },
          });
          break;
        }
        case 'entry': {
          const entry = entryUtxos[entryCursor++];
          if (entry === undefined) throw new Error(`${row.name}: route entry slot was not staged`);
          tx.addInput(entry.utxo, createEntryNftUnlocker(
            participant, 0, setup.categoryId, entry.collection,
          ));
          tx.addOutput({
            to: entry.address,
            amount: entry.utxo.satoshis,
            token: {
              category: setup.categoryId,
              amount: 0n,
              nft: { capability: 'mutable', commitment: entry.utxo.token!.nft!.commitment },
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
        case 'trailing': {
          // A RESERVED region, materialized but unconstrained. `blockSize` includes all 64 slots, and the
          // projection verifier and the root controller both step the next participant by `blockSize`, so the
          // inputs and outputs must exist. Nothing in the route reads them when no dynamic write runs - the
          // chunk verification is emitted only for a handler with a pending dynamic write - so ordinary
          // funding in and dust out is the whole requirement. Same idiom as Layer3DynamicChunksS3.
          const filler = randomUtxo({ satoshis: 1500n });
          await provider.addUtxo(p2pkh.address, filler);
          tx.addInput(filler, p2pkh.unlock.spend(alicePub, signature()));
          tx.addOutput({ to: p2pkh.address, amount: 1000n });
          break;
        }
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
  async function routeResult(row: Row, handler: string): Promise<Uint8Array> {
    const key = `${row.name}.${handler}`;
    if (!cached.has(key)) {
      const probe = await attempt(row, handler, 'none', undefined);
      cached.set(key, probe.discovered!);
      console.log(`[X136A] ${key} result off its own trace: ${binToHex(probe.discovered!)}`);
    }
    return cached.get(key)!;
  }

  /**
   * THE POSITIVE. One settled transaction per GAINED handler, built by the same helper that builds the
   * hostiles, so an acceptance cannot be an evaluation that never ran.
   */
  const positive = (row: Row, subject: string) => async (): Promise<void> => {
    const result = await attempt(row, subject, 'none', await routeResult(row, subject));
    if (result.refusal) {
      console.log(`[X136A] ${row.name}.${subject} refused: ${result.refusal.split('\n')[0]}`);
    }
    expect(result.refusal, `the recovered ${row.name}.${subject} row did not settle`).toBeUndefined();
    expect(result.sent).toMatch(/^[0-9a-f]{64}$/);
    console.log(`[X136A] ${row.name}.${subject} settled ${result.sent}`);
  };

  /**
   * GUARD NEGATIVE CONTROL. Each differs from the settling positive in exactly one field - the declared
   * result, or one persisted state field - and that positive is rebuilt by this same helper in this same
   * file, so a refusal is a refusal of the attacked field and not of a builder that never worked.
   */
  const hostile = (row: Row, attack: Attack) => async (): Promise<void> => {
    const result = await attempt(row, row.hostileSubject, attack, await routeResult(row, row.hostileSubject));
    console.log(`[X136A] ${row.name}/${attack}: ${(result.refusal ?? 'ACCEPTED').split('\n')[0]}`);
    expect(result.sent, `a forged ${row.name} ${attack} was ACCEPTED`).toBeUndefined();
    expect(result.refusal).toBeDefined();
    expect(result.refusal).toMatch(/OP_VERIFY|mandatory-script-verify-flag-failed|non-truthy/);
    expect(result.failingInput, 'the refusal did not name the participant input').toBe(0);
  };

  for (const row of ROWS) {
    for (const subject of row.subjects) {
      it(`MEASURED: recovered ${row.name} (set ${row.partition}) SETTLES its gained '${subject}' row`,
        positive(row, subject), 900_000);
    }
    it(`HOSTILE: ${row.name}'s return event carrying a believable-wrong result is refused`,
      hostile(row, 'result'), 900_000);
    it(`HOSTILE: ${row.name}'s post-state carrying one mutated field is refused`,
      hostile(row, 'state'), 900_000);
  }
});
