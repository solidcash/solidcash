import { describe, expect, it } from 'vitest';
import { binToHex, decodeAuthenticationInstructions, encodeTransaction, hexToBin } from '@bitauth/libauth';
import {
  asmToScript, buildInitialStateCommitments, encodePushdataValue, scriptToBytecode,
} from '@solidcash/utils';
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
import { encodeEntryCommitment, keyToSlot } from '../../src/stateful/SortedList.js';

/**
 * X177/X180 BREADTH: RECOVERED HANDLERS THAT READ A SORTED COLLECTION, AN ARRAY, OR FOUR DATA NFTS.
 *
 * The breadth already taken is on SCALAR rows: `master dataNft returnEvent`, one data NFT, no collection
 * touched. Three shapes in the 206 are not that, and none of their handlers had ever been driven to a
 * transaction:
 *
 *   contract     block                                       what is new
 *   StableSwap   master + 4 dataNft + entry + returnEvent     FOUR data NFTs AND a packed ARRAY getter
 *   Token        master + dataNft + entry + returnEvent       a sorted-collection entry NFT is co-spent
 *   ERC20        the same + 64 trailing                       a MAPPING GETTER, keyed, one and two keys deep
 *
 * WHY THE MAPPING GETTERS MATTER SEPARATELY. Every settled recovered handler so far reads a field out of a
 * data NFT commitment. `balanceOf(addr)` and `allowance(a, b)` read a SORTED COLLECTION through a co-spent
 * entry NFT, on a key that is not in it - so the route must produce an EXCLUSION proof, and the return-event
 * commitment it computes has to be the encoding of zero rather than a stored value. That is a different
 * covenant path, and the hostile below moves the value it produces.
 *
 * WHY FOUR DATA NFTS MATTERS SEPARATELY. `createDataNftUnlocker`'s second argument is the MASTER's input
 * index, not the data NFT's own slot index; passing the slot names the master only for slot 0, so any route
 * with two or more data NFTs fails at input 2. Four rows were recorded as an "oracle wall" for that one
 * argument. StableSwap has four data NFTs AND an entry slot, so it exercises the corrected argument on the
 * widest recovered block that is not over the input-script limit.
 *
 * WHAT EACH ROW COSTS. One settled transaction per subject, plus two hostiles built by the same helper: the
 * return-event commitment with one bit moved, and exactly one persisted field moved to a believable
 * neighbour. Both must be refused AT INPUT 0. No result is ever encoded here - for every returning handler
 * the commitment is read off the route's own traced execution.
 *
 * X236 adds the source-distinct `MyToken.sol` ERC20 row and closes both formerly unproved `balanceOf` getters.
 * The shared route used to publish only `allowance` in `entryAccesses` while still accepting a balance key;
 * giving each collection identity its own physical entry slot makes the one-key and two-key getters both
 * observable and authenticated. Source-digest attribution keeps `MyToken.sol` distinct from `ERC20.sol`.
 *
 * WHAT IS NOT CLAIMED. Every subject is read-only (`writesState: false`, asserted below from the DIRECT
 * artifact), so publishing the pre-state as the post-state is correct rather than accidentally correct. The
 * dynamic `name`/`symbol` fields are seeded EMPTY, so no chunk UTXO is staged and no dynamic write runs -
 * this is not chunk-backed evidence, and X193 already measured that no recovered WRITER sits on a
 * chunk-backed variable at all. Evidence is SEMANTIC: the sizes are printed and all fit the 10,000-byte
 * input limit, but that is not a deployability claim.
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
const DIRECT = { solidityImportCompat: true, ecrecover: 'p2pkh' };

/** A distinctive placeholder result: the probe declares it, so the trace's OTHER operand is the real one. */
const PROBE_RESULT = hexToBin('9e'.repeat(32));

const addr = (fill: string): Uint8Array => hexToBin(`aa20${fill.repeat(32)}87`);

/**
 * THE GAINED LISTS, quoted from `Layer3RecoveredPartitionX160.test.ts`'s own PARTITION rows.
 */
const GAINED_BY_THE_REPAIR: Readonly<Record<string, readonly string[]>> = {
  'defi/stable-swap-amm/StableSwap.sol::StableSwap': ['tokens', 'balances', 'totalSupply'],
  'hacks/vault-inflation/VaultInflation.sol::Token': ['totalSupply', 'decimals'],
  'app/erc20/ERC20.sol::ERC20': ['totalSupply', 'name', 'symbol', 'decimals', 'balanceOf', 'allowance'],
  'app/erc20/MyToken.sol::ERC20': ['totalSupply', 'name', 'symbol', 'decimals', 'balanceOf', 'allowance'],
};

interface Subject {
  handler: string;
  args?: readonly (bigint | Uint8Array)[];
}

interface Row {
  rel: string;
  contract: string;
  subjects: readonly Subject[];
  /** The one subject the two hostiles are built against. It MUST be one that settles, or nothing is bound. */
  hostileSubject: string;
  /** Gained handlers this harness runs but cannot drive to a settlement. Recorded, never silently dropped. */
  unproven?: readonly Subject[];
  state: Record<string, unknown>;
  stateTamper: Record<string, unknown>;
  /** Optional authenticated nondefault mapping entries, keyed by collection name. */
  presentEntries?: Readonly<Record<string, { key: Uint8Array; value: bigint; valueType: string }>>;
  /** Exact route-computed commitment for nondefault-result controls. */
  expectedResultCommitments?: Readonly<Record<string, string>>;
  slots: readonly string[];
}

const TRAILING = Array.from({ length: 64 }, () => 'trailing');

const ROWS: readonly Row[] = [
  {
    rel: 'app/erc20/MyToken.sol',
    contract: 'ERC20',
    subjects: [
      { handler: 'totalSupply' }, { handler: 'name' }, { handler: 'symbol' }, { handler: 'decimals' },
      { handler: 'allowance', args: [addr('55'), addr('66')] },
      { handler: 'balanceOf', args: [addr('55')] },
    ],
    hostileSubject: 'balanceOf',
    presentEntries: { balanceOf: { key: addr('55'), value: 42n, valueType: 'uint256' } },
    expectedResultCommitments: { balanceOf: '0302012a' },
    state: { totalSupply: 1_000_000n, name: '', symbol: '', decimals: 18n },
    stateTamper: { totalSupply: 1_000_001n },
    slots: ['master', 'dataNft', 'entry', 'entry', 'returnEvent', ...TRAILING],
  },
  {
    rel: 'defi/stable-swap-amm/StableSwap.sol',
    contract: 'StableSwap',
    subjects: [
      { handler: 'tokens', args: [0n] }, { handler: 'balances', args: [1n] }, { handler: 'totalSupply' },
    ],
    hostileSubject: 'balances',
    state: {
      tokens: [addr('55'), addr('66'), addr('77')],
      multipliers: [1n, 1_000_000_000_000n, 1_000_000_000_000n],
      balances: [100n, 200n, 300n],
      totalSupply: 600n,
    },
    stateTamper: { balances: [100n, 201n, 300n] },
    slots: ['master', 'dataNft', 'dataNft', 'dataNft', 'dataNft', 'entry', 'returnEvent'],
  },
  {
    rel: 'hacks/vault-inflation/VaultInflation.sol',
    contract: 'Token',
    subjects: [{ handler: 'totalSupply' }, { handler: 'decimals' }],
    hostileSubject: 'totalSupply',
    state: { totalSupply: 1_000_000n, decimals: 18n },
    stateTamper: { totalSupply: 1_000_001n },
    slots: ['master', 'dataNft', 'entry', 'returnEvent'],
  },
  {
    rel: 'app/erc20/ERC20.sol',
    contract: 'ERC20',
    subjects: [
      { handler: 'totalSupply' }, { handler: 'name' }, { handler: 'symbol' }, { handler: 'decimals' },
      { handler: 'allowance', args: [addr('55'), addr('66')] },
      { handler: 'balanceOf', args: [addr('55')] },
    ],
    // The formerly unproved one-key getter now reads an authenticated present entry with value 42.
    hostileSubject: 'balanceOf',
    presentEntries: { balanceOf: { key: addr('55'), value: 42n, valueType: 'uint256' } },
    expectedResultCommitments: { balanceOf: '0302012a' },
    state: { totalSupply: 1_000_000n, name: '', symbol: '', decimals: 18n },
    stateTamper: { totalSupply: 1_000_001n },
    slots: ['master', 'dataNft', 'entry', 'entry', 'returnEvent', ...TRAILING],
  },
];

const key = (row: Row): string => `${row.rel}::${row.contract}`;

function compileRow(row: Row, controllerLbc: string, controllerCategory: string): any {
  const options = {
    ...BUS,
    experimentalMessageBusController: controllerLbc,
    experimentalMessageBusControllerCategory: controllerCategory,
  } as never;
  const path = `${SBE}/${row.rel}`;
  try {
    const map = compileFileMulti(path, options) as any;
    if (map[row.contract]) return map[row.contract];
  } catch {
    // fall through to the single-contract compile
  }
  const artifact = compileFile(path, options) as any;
  if (artifact.contractName !== row.contract) {
    throw new Error(`${key(row)}: the single-contract compile is '${artifact.contractName}'`);
  }
  return artifact;
}

type Attack = 'none' | 'result' | 'state';

describe('X177/X180 breadth: recovered collection, array and multi-data-NFT readers', () => {
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

  it('MEASURED: every subject is a GAINED, ADMITTED, READ-ONLY handler on the block shape this file names',
    () => {
      for (const row of ROWS) {
        const artifact = compileRow(row, `aa20${'11'.repeat(32)}87`, '22'.repeat(32));
        const layout = artifact.hiddenBatch!.route.blockLayout!;
        const eligible = (artifact.hiddenBatch!.handlers as any[])
          .filter((handler) => handler.eligible).map((handler) => handler.name);
        const bytes = scriptToBytecode(asmToScript(artifact.bytecode)).length;
        console.log(`[V2C] ${key(row).padEnd(50)} ${String(bytes).padStart(5)} B `
          + `${bytes <= 10_000 ? 'FITS' : 'OVER'} blockSize=${layout.blockSize} `
          + `dataNfts=${artifact.stateLayout?.dataNftCount} `
          + `entry=${JSON.stringify(artifact.hiddenBatch!.route.entryAccesses?.map((e: any) => e.collection))}`);
        expect(layout.slots.map((slot: any) => slot.kind), `${key(row)} block shape moved`).toEqual(row.slots);
        expect(bytes, `${key(row)} exceeds the input-script limit`).toBeLessThanOrEqual(10_000);
        const path = `${SBE}/${row.rel}`;
        let direct: any;
        try { direct = (compileFileMulti(path, DIRECT as never) as any)[row.contract]; } catch { direct = undefined; }
        if (!direct) direct = compileFile(path, DIRECT as never) as any;
        for (const subject of [...row.subjects, ...(row.unproven ?? [])]) {
          expect(GAINED_BY_THE_REPAIR[key(row)], `${key(row)}: ${subject.handler} is not gained`)
            .toContain(subject.handler);
          expect(eligible, `${key(row)}: ${subject.handler} is not admitted`).toContain(subject.handler);
          expect(direct.abi.find((entry: any) => entry.name === subject.handler)?.writesState,
            `${key(row)}.${subject.handler} is not read-only`).toBe(false);
        }
      }
    }, 1_800_000);

  /** One attempt at one recovered route. `declared` undefined selects the traced PROBE run. */
  async function attempt(row: Row, subject: Subject, attack: Attack, declared: Uint8Array | undefined):
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
    const artifact = compileRow(row, controller.lockingBytecode as string, controllerCategory);
    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, row.state);
    const participant = base.withCategory(hexToBin(setup.categoryId));
    const presentEntryUtxos = new Map<string, Utxo>();
    for (const [collection, entry] of Object.entries(row.presentEntries ?? {})) {
      const commitment = encodeEntryCommitment(
        keyToSlot(entry.key), new Uint8Array(32), encodePushdataValue(entry.value, entry.valueType),
      );
      const entryAddress = getEntryNftAddress(participant, setup.categoryId, collection);
      const utxo = await provider.addUtxo(entryAddress, randomUtxo({
        satoshis: 10_000n,
        token: {
          category: setup.categoryId,
          amount: 0n,
          nft: { capability: 'mutable', commitment: binToHex(commitment) },
        },
      }));
      presentEntryUtxos.set(collection, utxo);
    }

    const forge = (value: Uint8Array): Uint8Array => {
      const wrong = Uint8Array.from(value);
      if (wrong.length === 0) return Uint8Array.from([0x01]);
      wrong[wrong.length - 1] ^= 0x01;
      return wrong;
    };
    const innerVector = declared === undefined ? PROBE_RESULT : (() => {
      const [instruction, ...rest] = decodeAuthenticationInstructions(declared);
      const data = (instruction as { data?: Uint8Array }).data;
      if (data === undefined || rest.length !== 0) {
        throw new Error(`${key(row)}: the route's return commitment is not a single push`);
      }
      return data;
    })();
    const publishedVector = attack === 'result' ? forge(innerVector) : innerVector;
    const publishedCommitment = declared === undefined
      ? PROBE_RESULT : scriptToBytecode([publishedVector]);
    if (declared !== undefined && attack !== 'result') {
      expect(binToHex(publishedCommitment), `${key(row)}: re-wrapping the decoded vector did not reproduce `
        + 'the commitment the route computed').toBe(binToHex(declared));
    }

    // The route names every witness it needs; this supplies exactly the named set and never a guessed one.
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
    const transcript = layer3.finalizeCompiledGraph(
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
    const fee = randomUtxo({ satoshis: 400_000n });
    await provider.addUtxo(projection.address, projectionUtxo);
    for (const utxo of [returnFunding, fee]) await provider.addUtxo(p2pkh.address, utxo);

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
          // X180: the MASTER's input index, not the data NFT's slot. StableSwap has four of these, so a slot
          // index here would refuse the row at input 2 - the reading recorded as an oracle wall.
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
          // WHICH collection this slot belongs to is read off the route's own `entryAccesses`, never guessed.
          const collection = (artifact.hiddenBatch!.route.entryAccesses as any[])[slot.slotIndex ?? 0]
            ?.collection as string;
          if (collection === undefined) throw new Error(`${key(row)}: the route names no entry collection`);
          const entryAddress = getEntryNftAddress(participant, setup.categoryId, collection);
          const entryUtxo = presentEntryUtxos.get(collection) ?? (await provider.getUtxos(entryAddress))[0];
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
          // A RESERVED region, materialized but unconstrained: `blockSize` counts it and both the projection
          // verifier and the root controller step the next participant by `blockSize`.
          const filler = randomUtxo({ satoshis: 1500n });
          await provider.addUtxo(p2pkh.address, filler);
          tx.addInput(filler, p2pkh.unlock.spend(alicePub, signature()));
          tx.addOutput({ to: p2pkh.address, amount: 1000n });
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
    tx.addOutput({ to: p2pkh.address, amount: 300_000n });

    if (declared === undefined) {
      const vm = createVirtualMachineBch2026ForProvider(provider);
      const trace = vm.debug({
        inputIndex: 0,
        sourceOutputs: generateLibauthSourceOutputs(tx.inputs as never),
        transaction: tx.buildLibauthTransaction(),
      }) as unknown[];
      return { discovered: routeResultFromTrace(trace, PROBE_RESULT, `${key(row)}.${subject.handler}`) };
    }
    try {
      return { sent: await provider.sendRawTransaction(raw(tx)) };
    } catch (error) {
      const refusal = (error as Error).message;
      const index = refusal.match(/input index (\d+)/);
      return { refusal, failingInput: index ? Number(index[1]) : undefined };
    }
  }

  const cached = new Map<string, Uint8Array>();
  async function routeResult(row: Row, subject: Subject): Promise<Uint8Array> {
    const cacheKey = `${key(row)}.${subject.handler}`;
    if (!cached.has(cacheKey)) {
      const probe = await attempt(row, subject, 'none', undefined);
      const expected = row.expectedResultCommitments?.[subject.handler];
      if (expected !== undefined) {
        expect(binToHex(probe.discovered!), `${cacheKey}: authenticated nondefault result moved`).toBe(expected);
      }
      cached.set(cacheKey, probe.discovered!);
      console.log(`[V2C] ${cacheKey} result off its own trace: ${binToHex(probe.discovered!)}`);
    }
    return cached.get(cacheKey)!;
  }

  const settled: string[] = [];

  const positive = (row: Row, subject: Subject) => async (): Promise<void> => {
    const result = await attempt(row, subject, 'none', await routeResult(row, subject));
    if (result.refusal) {
      console.log(`[V2C] ${key(row)}.${subject.handler} refused: ${result.refusal.split('\n')[0]} `
        + `input=${result.failingInput}`);
    }
    expect(result.refusal, `the recovered ${key(row)}.${subject.handler} row did not settle`).toBeUndefined();
    expect(result.sent).toMatch(/^[0-9a-f]{64}$/);
    settled.push(`${key(row)}.${subject.handler} ${result.sent}`);
    console.log(`[V2C] SETTLED ${key(row)}.${subject.handler} ${result.sent}`);
  };

  const hostile = (row: Row, attack: Attack) => async (): Promise<void> => {
    const subject = row.subjects.find((entry) => entry.handler === row.hostileSubject)!;
    const result = await attempt(row, subject, attack, await routeResult(row, subject));
    console.log(`[V2C] ${key(row)}/${attack}: ${(result.refusal ?? 'ACCEPTED').split('\n')[0]} `
      + `input=${result.failingInput}`);
    expect(result.sent, `a forged ${key(row)} ${attack} was ACCEPTED`).toBeUndefined();
    expect(result.refusal).toMatch(/OP_VERIFY|mandatory-script-verify-flag-failed|non-truthy/);
    expect(result.failingInput, 'the refusal did not name the participant input').toBe(0);
  };

  /**
   * A RECORDED NEGATIVE, RUN RATHER THAN REMOVED. The probe hands back nothing for this subject, so no honest
   * commitment can be published; a settle attempt carrying the SENTINEL records where it stops instead. That
   * refusal discriminates NOTHING on its own - a sentinel result should be refused - so this row is unproven
   * in BOTH directions, and the expectation turns red the day the probe starts working.
   */
  const recorded = (row: Row, subject: Subject) => async (): Promise<void> => {
    let probeFailure: string | undefined;
    try {
      await attempt(row, subject, 'none', undefined);
    } catch (error) {
      probeFailure = (error as Error).message;
    }
    console.log(`[V2C] ${key(row)}.${subject.handler} probe: ${probeFailure ?? 'SUCCEEDED'}`);
    expect(probeFailure, 'the probe now returns a result - this row can be promoted to a positive')
      .toContain('the probe trace never compared the declared result');
    const result = await attempt(row, subject, 'none', scriptToBytecode([PROBE_RESULT]));
    console.log(`[V2C] ${key(row)}.${subject.handler} sentinel settle: `
      + `${(result.refusal ?? `ACCEPTED ${result.sent}`).split('\n')[0]} input=${result.failingInput}`);
    expect(result.sent, 'a sentinel result was ACCEPTED').toBeUndefined();
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
    for (const subject of row.unproven ?? []) {
      it(`RECORDED: ${key(row)}.${subject.handler} cannot be driven to a settlement by this harness`,
        recorded(row, subject), 1_800_000);
    }
  }

  it('MEASURED: how many of the 206 gained handlers this file settles on the VM', () => {
    for (const entry of settled) console.log(`[V2C] SETTLED ON THE VM: ${entry}`);
    for (const row of ROWS) {
      for (const subject of row.unproven ?? []) {
        console.log(`[V2C] UNPROVEN IN BOTH DIRECTIONS: ${key(row)}.${subject.handler}`);
      }
    }
    console.log(`[V2C] ${settled.length} gained handlers settle in this file; `
      + `${ROWS.reduce((n, row) => n + (row.unproven?.length ?? 0), 0)} more are run and recorded unproven`);
    expect(settled.length).toBe(ROWS.reduce((total, row) => total + row.subjects.length, 0));
    expect(settled.length).toBe(17);
  });
});
