import { describe, expect, it, beforeAll } from 'vitest';
import { layoutWithFacets } from '../shapes/harness.js';
import { binToHex, encodeLockingBytecodeP2sh32, hash256, hexToBin } from '@bitauth/libauth';
import { keccak_256 } from '@noble/hashes/sha3.js';
import {
  FrameKind, SHARED_LIBRARY_SALT, asmToScript, buildPushdataCommitment, encodeIntegerValue, scriptToBytecode, sha256,
  validatorAddress, type FrameKindValue,
} from '@solidcash/utils';
import { ethers } from 'ethers';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { fillPlaceholders } from '../../../../solidc/src/framed/master/placeholders.js';
import {
  REAL_VALIDATOR_PROGRAM, categorySlotValue, seededCategory,
} from '../../../../solidc/test/framed/master/validator-input.js';
import { computeEcrecoverWitness } from '../../../src/ecrecover/ecrecoverRecovery.js';
import { probeEcrecoverSplit } from '../../../src/ecrecover/ecrecoverComputeSidecar.js';
import { stateRecordLockingBytecode, stateRecordUnlockingBytecode } from '../../../src/framed/deploy/index.js';
import {
  buildKeccakSideCars, buildRecoverySideCars, composeDraft, keccakPreimagesOf, participant,
  recoveryCallsOf, type CompositionDraftPlan, type DraftMaster, type RecoverySideCars,
} from '../../../src/framed/composer/index.js';
import {
  USER_LOCK, compileAndDeploy, composeAndDerive, master as shapeMaster, masterInput, rootOf, token, userInput, userInputs,
  validatorFor,
} from '../shapes/harness.js';

/**
 * A framed master that recovers a signer, composed and derived by the shipped composer.
 *
 * The entry takes the four scalars as arguments and compares the recovered key against a compile-time owner. The
 * master dispatches over two entries, so a user enters it with the call data `selector || h || v || r || s`; the
 * composer reads the scalars from those argument pushes, builds the recovery side-car pair (and, for the EVM
 * projection, the keccak side-car), and `layoutTransaction` places them immediately after the master's input. The
 * machine's verdict on every contract input - the master and each side-car - is the assertion; no coordinate is
 * supplied by the test. A digest the body computes, whose pair is learned from the body's bind, is driven through the
 * shipped call path in `call/side-car-call.test.ts`, and so is the placeholder pair the EVM invalid-input rule
 * co-spends (`master/ecrecover-invalid-input.test.ts` pins each range the body tests).
 */

const CATEGORY = seededCategory('composer recovery');
const CONTRACT_ADDRESS = validatorAddress(CATEGORY, REAL_VALIDATOR_PROGRAM);
const TEMPLATE_HASH = sha256(REAL_VALIDATOR_PROGRAM);
const MASTER_ID = 'auth-1';

/** A signature that decomposes into a two-covenant split, with the little-endian scalars the builtin takes. */
interface Signer {
  readonly h: Uint8Array;
  readonly v: number;
  readonly r: Uint8Array;
  readonly s: Uint8Array;
  readonly owner: Uint8Array;
  readonly address: Uint8Array;
  readonly witness: ReturnType<typeof computeEcrecoverWitness>;
}

const leBytes = (hex: string): Uint8Array => hexToBin(hex.replace(/^0x/, '')).slice().reverse();

/** A dummy side-car UTXO, used only to probe whether a signature has a valid two-covenant split. */
const dummyUtxo = (odd: boolean): never => ({
  txid: (odd ? 'bb'.repeat(31) + '44' : 'aa'.repeat(31) + '55'), vout: 1, satoshis: 100_000n,
  token: { category: 'ee'.repeat(31) + '11', amount: 0n, nft: { capability: 'mutable', commitment: '' } },
}) as never;

/**
 * Signs one message, re-drawing fresh wallets until the shipped split probe accepts the signature. The first draw is
 * the key `firstKey` names, known to split, because a refused probe tries every split and costs seconds.
 */
async function splittableSigner(firstKey: string): Promise<Signer> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const wallet = attempt === 0
      ? new ethers.Wallet(ethers.sha256(ethers.toUtf8Bytes(firstKey))) : ethers.Wallet.createRandom();
    const message = `composer recovery ${attempt}`;
    const digest = ethers.hashMessage(message);
    const signature = await wallet.signMessage(message);
    const { r, s, v } = ethers.Signature.from(signature);
    const h = leBytes(digest), rLe = leBytes(r), sLe = leBytes(s);
    const owner = hexToBin(ethers.SigningKey
      .computePublicKey(ethers.SigningKey.recoverPublicKey(digest, signature), true).slice(2));
    const witness = computeEcrecoverWitness(h, v, rLe, sLe);
    try {
      probeEcrecoverSplit(witness, SHARED_LIBRARY_SALT, dummyUtxo(false), dummyUtxo(true));
    } catch {
      continue;
    }
    return { h, v, r: rLe, s: sLe, owner, address: hexToBin(wallet.address.slice(2)), witness };
  }
  throw new Error('no signature with a two-covenant split after 200 draws');
}

let signer: Signer;

beforeAll(async () => {
  signer = await splittableSigner('composer recovery key 1');
}, 120_000);

/** One recovery call the entry makes: the scalars, the value it compares against, and its projection. */
interface CallSpec {
  readonly scalars: { readonly h: Uint8Array; readonly v: number; readonly r: Uint8Array; readonly s: Uint8Array };
  readonly comparison: string;
  readonly evm: boolean;
}

/** The source of an entry whose parameters are the calls' scalars and whose body compares each recovery. */
function recoverySource(calls: readonly CallSpec[]): string {
  const params = calls.map((_, index) => `bytes32 h${index}, int v${index}, bytes32 r${index}, bytes32 s${index}`);
  const body = calls.map((call, index) => {
    const builtin = call.evm ? 'ecrecoverEvm' : 'ecrecoverPubKey';
    return `require(${builtin}(h${index}, v${index}, r${index}, s${index}) == ${call.comparison});`;
  });
  return 'pragma solidcash ^0.14.0;'
    + ' contract Auth {'
    + `   function check(${params.join(', ')}) { ${body.join(' ')} }`
    + '   function idle() { require(true); }'
    + ' }';
}

/** The argument pushes a dispatcher master's unlocking carries: the selector, then the call data in wire order. */
function argumentPushes(selector: Uint8Array, calls: readonly CallSpec[]): readonly Uint8Array[] {
  // The wire carries the first parameter's push last, so the calls' scalars go out in reverse call order.
  const callData = [...calls].reverse().flatMap(({ scalars }) => [
    scalars.s, scalars.r, encodeIntegerValue(BigInt(scalars.v)), scalars.h,
  ]);
  return [selector, ...callData];
}

/** One composed recovery case: the plan, the artifacts the host reads, and the composer's own side-car ids. */
interface RecoveryCase {
  readonly plan: CompositionDraftPlan;
  readonly artifacts: ReturnType<typeof compileStringMulti>;
  readonly ids: readonly string[];
}

/** Compiles an `Auth` source, fills its master program's slots, and reads the ABI row of `check`. */
function compiled(source: string): {
  readonly artifacts: ReturnType<typeof compileStringMulti>;
  readonly program: Uint8Array;
  readonly abiFunction: ReturnType<typeof compileStringMulti>[string]['abi'][number];
} {
  const artifacts = compileStringMulti(source, { composition: 'framed' });
  const artifact = artifacts.Auth!;
  const program = fillPlaceholders(
    scriptToBytecode(asmToScript(artifact.bytecode)),
    artifact.composition!.placeholders,
    { category: categorySlotValue(CATEGORY), contractAddress: CONTRACT_ADDRESS, templateHash: TEMPLATE_HASH },
  );
  return { artifacts, program, abiFunction: artifact.abi.find((row) => row.name === 'check')! };
}

/** Compiles an entry, reads its recovery calls from the argument pushes, builds the side-cars, and lays the plan out. */
function buildCase(calls: readonly CallSpec[]): RecoveryCase {
  const { artifacts, program, abiFunction } = compiled(recoverySource(calls));
  const pushes = argumentPushes(hexToBin(abiFunction.selector!), calls);
  const decoded = recoveryCallsOf(abiFunction, pushes, 1); // one leading push: the dispatcher selector
  return caseOf(artifacts, program, pushes, buildRecoverySideCars(MASTER_ID, decoded));
}

/**
 * The plan for one call of `Auth.check` with `pushes`, co-spending `sideCars`. Nothing here states an index: the
 * side-car ids come from the composer, and the layout places them.
 */
function caseOf(
  artifacts: ReturnType<typeof compileStringMulti>,
  program: Uint8Array,
  pushes: readonly Uint8Array[],
  sideCars: Omit<RecoverySideCars, 'utxos'>,
): RecoveryCase {
  const master: DraftMaster = {
    master: MASTER_ID,
    contract: 'Auth',
    functionName: 'Auth.check()',
    program,
    facts: {
      contract: 'Auth', functionName: 'check', kind: FrameKind.ROOT,
      callerIsUser: true, originEqualsCaller: true, makesExternalCall: false, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: CONTRACT_ADDRESS, value: 0n },
    enteredBy: 'user',
    origin: 'user',
    calls: [],
    retval: new Uint8Array(0),
    segments: [[]],
    events: [],
    sends: [],
    argumentPushes: pushes,
    dispatches: true,
    redeemScript: program,
  };
  const plan: CompositionDraftPlan = {
    blocks: [{ contract: 'Auth', masters: [MASTER_ID], state: [], recovery: { [MASTER_ID]: sideCars.ids } }],
    userInputs: [{ id: 'user', index: 1 + sideCars.ids.length }],
    masters: [master],
    inputs: {
      [MASTER_ID]: {
        source: {
          lockingBytecode: encodeLockingBytecodeP2sh32(hash256(program)), valueSatoshis: 20_000n,
          token: { category: CATEGORY, amount: 0n, nft: { capability: 'minting', commitment: new Uint8Array(0) } },
        },
      },
      ...sideCars.inputs,
      user: userInput(),
    },
    computedWitnesses: sideCars.computedWitnesses,
  };
  return { plan, artifacts, ids: sideCars.ids };
}

/** The one-call case most of the tests below use. */
const recoveryCase = (
  scalars: { h: Uint8Array; v: number; r: Uint8Array; s: Uint8Array },
  comparison: string,
  projection: 'pubkey' | 'evm',
): RecoveryCase => buildCase([{ scalars, comparison, evm: projection === 'evm' }]);

let evmCase: RecoveryCase | undefined;

/** The signer's one-call EVM-projection case, built once: the cases that read it change nothing in it. */
function signerCase(): RecoveryCase {
  evmCase ??= recoveryCase(signer, `bytes20(0x${binToHex(signer.address)})`, 'evm');
  return evmCase;
}

/** Composes, derives and evaluates a case; returns each participant's machine verdict by identity. */
function verdictsOf(test: RecoveryCase): Record<string, { accepted: boolean; objection?: string }> {
  const outcome = composeAndDerive(test.plan, [test.artifacts.Auth!], [rootOf('Auth', 'check', MASTER_ID)]);
  return Object.fromEntries(outcome.verdicts.map((verdict) => [verdict.participant, {
    accepted: verdict.accepted, ...(verdict.objection === undefined ? {} : { objection: verdict.objection }),
  }]));
}

describe('a composed framed recovery', () => {
  it('is accepted when the EVM projection reads its address from a keccak side-car', () => {
    // A trailing output, as an event or a send adds: the side-car must recreate at its own index, not at an offset
    // from the end of the outputs.
    const evm = signerCase();
    const test = { ...evm, plan: { ...evm.plan, trailingOutputs: [{ lockingBytecode: USER_LOCK, valueSatoshis: 1_000n }] } };
    const verdicts = verdictsOf(test);
    expect(verdicts[MASTER_ID]).toStrictEqual({ accepted: true });
    for (const id of test.ids) expect(verdicts[id]!.accepted, id).toBe(true);
    expect(test.ids).toHaveLength(3); // the A/B pair plus one keccak side-car
  });

  it('is accepted with one A/B pair per call when the entry makes two recoveries', async () => {
    const second = await splittableSigner('composer recovery key 2');
    const test = buildCase([
      { scalars: signer, comparison: `pubkey(0x${binToHex(signer.owner)})`, evm: false },
      { scalars: second, comparison: `pubkey(0x${binToHex(second.owner)})`, evm: false },
    ]);
    expect(test.ids).toStrictEqual([
      `${MASTER_ID}/recovery-A0`, `${MASTER_ID}/recovery-B0`,
      `${MASTER_ID}/recovery-A1`, `${MASTER_ID}/recovery-B1`,
    ]);
    const { layout } = composeDraft(test.plan);
    expect(layout.participants.map((placed) => [placed.id, placed.index])).toStrictEqual([
      [MASTER_ID, 0], [`${MASTER_ID}/recovery-A0`, 1], [`${MASTER_ID}/recovery-B0`, 2],
      [`${MASTER_ID}/recovery-A1`, 3], [`${MASTER_ID}/recovery-B1`, 4],
    ]);
    const verdicts = verdictsOf(test);
    expect(verdicts[MASTER_ID]).toStrictEqual({ accepted: true });
    for (const id of test.ids) expect(verdicts[id]!.accepted, id).toBe(true);
  });
});

describe('a composed framed recovery in a frame that runs on its caller\'s records', () => {
  it('reads every side-car after its own input, not after the records\' owner', () => {
    // A proxy delegates into an implementation entry that hashes and recovers: the frame's records are the proxy's,
    // and its recovery pair, the projection's keccak side-car and its own keccak side-car follow its own input.
    const data = new TextEncoder().encode('proxied side-cars');
    const { artifacts, contracts } = compileAndDeploy('pragma solidcash ^0.14.0;'
      + ' contract Impl {'
      + '   address public implementation;'
      + '   int public counter;'
      + '   function check(bytes data, bytes32 expected, bytes32 h, int v, bytes32 r, bytes32 s) {'
      + '     require(keccak256(data) == expected);'
      + `     require(ecrecoverEvm(h, v, r, s) == bytes20(0x${binToHex(signer.address)}));`
      + '     require(this.counter >= 0);'
      + '   }'
      + ' }'
      + ' contract Proxy {'
      + '   address public implementation;'
      + '   int public counter;'
      + '   fallback(bytes input) external { this.implementation.delegatecall(input); require(true); }'
      + ' }', { Proxy: 'proxied recovery proxy', Impl: 'proxied recovery implementation' });
    const proxy = contracts.Proxy!;
    const impl = contracts.Impl!;
    const state = hexToBin(
      buildPushdataCommitment(artifacts.Proxy!.stateLayout!, { implementation: impl.address, counter: 5n }, 0));
    const abiFunction = artifacts.Impl!.abi.find((row) => row.name === 'check')!;
    const pushes = [
      hexToBin(abiFunction.selector!), signer.s, signer.r, encodeIntegerValue(BigInt(signer.v)), signer.h,
      keccak_256(data), data,
    ];
    const recovery = buildRecoverySideCars('impl-1', recoveryCallsOf(abiFunction, pushes, 1));
    const keccak = buildKeccakSideCars('impl-1', keccakPreimagesOf(abiFunction, pushes, 1));
    const ids = [...recovery.ids, ...keccak.ids];
    const blocks: CompositionDraftPlan['blocks'] = [
      { contract: 'Proxy', masters: ['proxy-1'], validator: { id: 'validator', settles: [] }, state: ['record'] },
      { contract: 'Impl', masters: ['impl-1'], state: [], recovery: { 'impl-1': ids } },
    ];
    const layout = layoutWithFacets(blocks);
    const read = { in: participant(layout, 'record').index, out: participant(layout, 'record').index,
      viewIn: state, viewOut: state };
    const frameFacts = (contract: string, entry: string, kind: FrameKindValue): DraftMaster['facts'] => ({
      contract, functionName: entry, kind, callerIsUser: kind === FrameKind.ROOT,
      originEqualsCaller: kind === FrameKind.ROOT, makesExternalCall: kind === FrameKind.ROOT, mastersOfContract: 1,
    });
    const categoryHex = binToHex(proxy.category);
    const recordSource = {
      lockingBytecode: stateRecordLockingBytecode(categoryHex), valueSatoshis: 20_000n,
      token: token(proxy.category, 'mutable', state),
    };
    const validator = validatorFor(proxy.category);
    const plan: CompositionDraftPlan = {
      blocks,
      userInputs: userInputs(['user'], layout.participantCount),
      masters: [
        shapeMaster({
          master: 'proxy-1', contract: 'Proxy', entry: '__fallback', program: proxy.program,
          facts: frameFacts('Proxy', '__fallback', FrameKind.ROOT),
          frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: proxy.address, value: 0n },
          enteredBy: 'user', origin: 'user',
          calls: [{ kind: FrameKind.DELEGATE, callee: 'impl-1', target: impl.address, value: 0n, argumentPushes: pushes }],
          segments: [[read], [read]], argumentPushes: pushes, dispatches: true,
        }),
        shapeMaster({
          master: 'impl-1', contract: 'Impl', entry: 'check', program: impl.program,
          facts: frameFacts('Impl', 'check', FrameKind.DELEGATE),
          frame: { kind: FrameKind.DELEGATE, sender: USER_LOCK, self: proxy.address, value: 0n },
          enteredBy: 'proxy-1', origin: 'user', segments: [[read]], argumentPushes: pushes,
        }),
      ],
      inputs: {
        'proxy-1': { source: masterInput(proxy) },
        'impl-1': { source: masterInput(impl) },
        validator: {
          source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(proxy.category, 'mutable') },
        },
        record: {
          source: recordSource,
          output: recordSource,
          unlockingBytecode: stateRecordUnlockingBytecode(categoryHex, participant(layout, 'proxy-1').index, 1),
        },
        ...recovery.inputs,
        ...keccak.inputs,
        user: userInput(),
      },
      validator: {
        id: 'validator', covers: ['Impl'],
        settles: [{ category: proxy.category, stateInputs: ['record'] }],
        redeemScript: validator.redeem,
      },
    };
    // The records' owner sits before the implementation's input; every side-car follows the implementation's own.
    const implIndex = participant(layout, 'impl-1').index;
    expect(participant(layout, 'proxy-1').index).toBeLessThan(implIndex);
    expect(ids.map((id) => participant(layout, id).index)).toStrictEqual(ids.map((_, offset) => implIndex + 1 + offset));
    const outcome = composeAndDerive(plan, [artifacts.Proxy!, artifacts.Impl!], [rootOf('Proxy', '__fallback', 'proxy-1')]);
    for (const verdict of outcome.verdicts) expect(verdict.accepted, verdict.participant).toBe(true);
    expect(outcome.verdicts.map((verdict) => verdict.participant)).toStrictEqual(
      ['proxy-1', 'validator', 'validator/1', 'record', 'impl-1', ...ids]);
  }, 120_000);
});

// One A/B pair per call, right after the master: the two-recovery case above and `layout.test.ts`.
describe('the recovery side-cars the composer places', () => {
  it('are a pair plus a keccak side-car for the EVM projection', () => {
    const test = signerCase();
    expect(test.ids).toStrictEqual([
      `${MASTER_ID}/recovery-A0`, `${MASTER_ID}/recovery-B0`, `${MASTER_ID}/recovery-K0`,
    ]);
    const { layout } = composeDraft(test.plan);
    expect(layout.participants.map((placed) => placed.index)).toStrictEqual([0, 1, 2, 3]);
  });
});

describe('the recovery calls an entry publishes', () => {
  const row = (flags: readonly boolean[], parameterCount = 1): never => ({
    inputs: Array.from({ length: parameterCount }, (_unused, index) => ({ name: `p${index}`, type: 'bytes' })),
    ...(flags.length === 0 ? {} : { ecrecoverEvmFlags: flags }),
  }) as never;

  it('names one call per published flag, computed, where the argument sources are not published', () => {
    expect(recoveryCallsOf(row([false, true]), [new Uint8Array([0x11])])).toStrictEqual([
      { computed: true, evm: false }, { computed: true, evm: true },
    ]);
  });

  it('reads a fully named call from the pushes, in wire order, with the flag as its EVM marker', () => {
    const named = {
      inputs: [{ name: 'h' }, { name: 'v' }, { name: 'r' }, { name: 's' }],
      ecrecoverArgParams: [['h', 'v', 'r', 's']], ecrecoverEvmFlags: [true],
    } as never;
    const h = new Uint8Array(32).fill(0x11);
    const v = Uint8Array.from([27]);
    const r = new Uint8Array(32).fill(0x33);
    const s = new Uint8Array(32).fill(0x44);
    expect(recoveryCallsOf(named, [s, r, v, h])).toStrictEqual([{ hash: h, v: 27, r, s, evm: true }]);
  });

  it('makes no call where neither the sources nor the flags publish one', () => {
    expect(recoveryCallsOf(row([]), [new Uint8Array([0x11])])).toStrictEqual([]);
  });
});
