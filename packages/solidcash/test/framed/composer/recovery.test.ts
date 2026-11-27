import { describe, expect, it, beforeAll } from 'vitest';
import { layoutWithFacets } from '../shapes/harness.js';
import {
  binToHex, decodeAuthenticationInstructions, encodeLockingBytecodeP2sh32, hash256, hexToBin,
} from '@bitauth/libauth';
import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3.js';
import {
  FrameKind, asmToScript, buildPushdataCommitment, encodeIntegerValue, scriptToBytecode, sha256,
  validatorAddress, type FrameKindValue,
} from '@solidcash/utils';
import { ethers } from 'ethers';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { fillPlaceholders } from '../../../../solidc/src/framed/master/placeholders.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import {
  REAL_VALIDATOR_PROGRAM, categorySlotValue, seededCategory,
} from '../../../../solidc/test/framed/master/validator-input.js';
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
 * composer reads the scalars from those argument pushes, builds the recovery side-car (and, for the EVM projection,
 * the keccak side-car), and `layoutTransaction` places them immediately after the master's input. The machine's
 * verdict on every contract input - the master and each side-car - is the assertion; no coordinate is supplied by
 * the test. A digest the body computes, whose side-car is learned from the body's bind, is driven through the shipped
 * call path in `call/side-car-call.test.ts`, and so is the placeholder side-car the EVM invalid-input rule co-spends
 * (`master/ecrecover-invalid-input.test.ts` pins each range the body tests).
 */

const CATEGORY = seededCategory('composer recovery');
const CONTRACT_ADDRESS = validatorAddress(CATEGORY, REAL_VALIDATOR_PROGRAM);
const TEMPLATE_HASH = sha256(REAL_VALIDATOR_PROGRAM);
const MASTER_ID = 'auth-1';

/** A signature, with the little-endian scalars the builtin takes. */
interface Signer {
  readonly h: Uint8Array;
  readonly v: number;
  readonly r: Uint8Array;
  readonly s: Uint8Array;
  readonly owner: Uint8Array;
  readonly address: Uint8Array;
}

const leBytes = (hex: string): Uint8Array => hexToBin(hex.replace(/^0x/, '')).slice().reverse();

/** One message signed by the key `key` names. */
async function signerOf(key: string): Promise<Signer> {
  const wallet = new ethers.Wallet(ethers.sha256(ethers.toUtf8Bytes(key)));
  const message = `composer recovery ${key}`;
  const digest = ethers.hashMessage(message);
  const signature = await wallet.signMessage(message);
  const { r, s, v } = ethers.Signature.from(signature);
  const owner = hexToBin(ethers.SigningKey
    .computePublicKey(ethers.SigningKey.recoverPublicKey(digest, signature), true).slice(2));
  return { h: leBytes(digest), v, r: leBytes(r), s: leBytes(s), owner, address: hexToBin(wallet.address.slice(2)) };
}

let signer: Signer;

beforeAll(async () => {
  signer = await signerOf('composer recovery key 1');
});

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
  return 'pragma solidcash ^0.53.0;'
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
    expect(test.ids).toHaveLength(2); // the recovery side-car plus one keccak side-car
  });

  it('is accepted with one side-car per call when the entry makes two recoveries', async () => {
    const second = await signerOf('composer recovery key 2');
    const test = buildCase([
      { scalars: signer, comparison: `pubkey(0x${binToHex(signer.owner)})`, evm: false },
      { scalars: second, comparison: `pubkey(0x${binToHex(second.owner)})`, evm: false },
    ]);
    expect(test.ids).toStrictEqual([`${MASTER_ID}/recovery-V0`, `${MASTER_ID}/recovery-V1`]);
    const { layout } = composeDraft(test.plan);
    expect(layout.participants.map((placed) => [placed.id, placed.index])).toStrictEqual([
      [MASTER_ID, 0], [`${MASTER_ID}/recovery-V0`, 1], [`${MASTER_ID}/recovery-V1`, 2],
    ]);
    const verdicts = verdictsOf(test);
    expect(verdicts[MASTER_ID]).toStrictEqual({ accepted: true });
    for (const id of test.ids) expect(verdicts[id]!.accepted, id).toBe(true);
  });
});

describe('a composed framed recovery in a frame that runs on its caller\'s records', () => {
  it('reads every side-car after its own input, not after the records\' owner', () => {
    // A proxy delegates into an implementation entry that hashes and recovers: the frame's records are the proxy's,
    // and its recovery side-car, the projection's keccak side-car and its own keccak side-car follow its own input.
    const data = new TextEncoder().encode('proxied side-cars');
    const { artifacts, contracts } = compileAndDeploy('pragma solidcash ^0.53.0;'
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
      ['proxy-1', 'validator', 'validator/1', 'validator/2', 'record', 'impl-1', ...ids]);
  }, 120_000);
});

/** secp256k1's group order. */
const ORDER = secp256k1.CURVE.n;

/** A 32-byte little-endian word. */
const leWord = (value: bigint): Uint8Array =>
  Uint8Array.from({ length: 32 }, (_unused, index) => Number((value >> BigInt(8 * index)) & 0xffn));

/** A little-endian word read as an unsigned number. */
const unsignedOf = (word: Uint8Array): bigint => word.reduceRight((value, byte) => (value << 8n) | BigInt(byte), 0n);

/** k^-1 mod n, for a k in [1, n). */
function inverseModOrder(k: bigint): bigint {
  let result = 1n;
  for (let base = k % ORDER, exponent = ORDER - 2n; exponent > 0n; base = (base * base) % ORDER, exponent >>= 1n) {
    if ((exponent & 1n) === 1n) result = (result * base) % ORDER;
  }
  return result;
}

/** The scalars the builtin recovers from, little-endian. */
interface Scalars {
  readonly h: Uint8Array;
  readonly v: number;
  readonly r: Uint8Array;
  readonly s: Uint8Array;
}

/**
 * Scalars whose key is the point at infinity: R = (z/s) G, so that s R = z G and (s R - z G) / r is no point. A draw
 * whose R has an x-coordinate of n or more, which `r` cannot name, is redrawn.
 */
function infinityScalars(): Scalars {
  for (let draw = 0; ; draw += 1) {
    const drawn = (part: string): bigint =>
      BigInt(`0x${binToHex(sha256(new TextEncoder().encode(`composer recovery at infinity ${part} ${draw}`)))}`) % ORDER;
    const z = drawn('z') || 1n;
    const s = drawn('s') || 1n;
    const point = secp256k1.ProjectivePoint.BASE.multiply((z * inverseModOrder(s)) % ORDER).toAffine();
    if (point.x < ORDER) return { h: leWord(z), v: 27 + Number(point.y & 1n), r: leWord(point.x), s: leWord(s) };
  }
}

/** The blob the side-car of a key at infinity recovers from: the digest shifted to z - 2^128 r mod n, then v, r, s. */
const shiftedBlob = (scalars: Scalars): Uint8Array => Uint8Array.from([
  ...leWord((((unsignedOf(scalars.h) - (unsignedOf(scalars.r) << 128n)) % ORDER) + ORDER) % ORDER),
  scalars.v, ...scalars.r, ...scalars.s,
]);

/** The blob a side-car's unlocking pushes after its pad: the one it recovers from. */
const sideCarBlob = (unlockingBytecode: Uint8Array): Uint8Array =>
  (decodeAuthenticationInstructions(unlockingBytecode)[1] as { readonly data: Uint8Array }).data;

/** 2^128 G as a standard compressed key. */
const SHIFT_POINT = secp256k1.ProjectivePoint.BASE.multiply(1n << 128n).toRawBytes(true);

describe('a composed framed recovery at infinity', () => {
  it('co-spends a side-car over the shifted digest, which commits 2^128 G, and the body answers the zero address', () => {
    const atInfinity = infinityScalars();
    const test = recoveryCase(atInfinity, 'pubkey(0x)', 'pubkey');
    const input = test.plan.inputs[`${MASTER_ID}/recovery-V0`]!;
    expect(binToHex(sideCarBlob(input.unlockingBytecode!))).toBe(binToHex(shiftedBlob(atInfinity)));
    // The commitment is parity || Qx as a 33-byte little-endian number.
    const commitment = input.output!.token!.nft!.commitment;
    expect(binToHex(Uint8Array.from([commitment[0]!, ...commitment.slice(1, 33).reverse()]))).toBe(binToHex(SHIFT_POINT));
    const verdicts = verdictsOf(test);
    expect(verdicts[MASTER_ID]).toStrictEqual({ accepted: true });
    for (const id of test.ids) expect(verdicts[id]!.accepted, id).toBe(true);
  });

  it('settles a side-car the body computes over the shifted digest, learning the arguments from the body\'s bind', () => {
    // The call is handed to the composer as computed, so it co-spends a placeholder side-car, which the body's bind
    // refuses with the body's own blob under the placeholder's: the close the derivation learns the blob from.
    const atInfinity = infinityScalars();
    const calls = [{ scalars: atInfinity, comparison: 'pubkey(0x)', evm: false }];
    const { artifacts, program, abiFunction } = compiled(recoverySource(calls));
    const pushes = argumentPushes(hexToBin(abiFunction.selector!), calls);
    const test = caseOf(artifacts, program, pushes, buildRecoverySideCars(MASTER_ID, [{ computed: true, evm: false }]));
    const draft = composeDraft(test.plan, { vm: compositionMachine() });
    draft.learnUnstatedViews();
    const built = draft.programFor(MASTER_ID);
    const sideCar = participant(draft.layout, `${MASTER_ID}/recovery-V0`).index;
    expect(binToHex(sideCarBlob(built.transaction.inputs[sideCar]!.unlockingBytecode)))
      .toBe(binToHex(shiftedBlob(atInfinity)));
    const vm = compositionMachine();
    for (const placed of draft.layout.participants) {
      const state = vm.evaluate({
        inputIndex: placed.index, sourceOutputs: built.sourceOutputs, transaction: built.transaction,
      });
      expect(vm.stateSuccess(state), placed.id).toBe(true);
    }
  });
});

// One side-car per call, right after the master: the two-recovery case above and `layout.test.ts`.
describe('the recovery side-cars the composer places', () => {
  it('are one side-car plus a keccak side-car for the EVM projection', () => {
    const test = signerCase();
    expect(test.ids).toStrictEqual([`${MASTER_ID}/recovery-V0`, `${MASTER_ID}/recovery-K0`]);
    const { layout } = composeDraft(test.plan);
    expect(layout.participants.map((placed) => placed.index)).toStrictEqual([0, 1, 2]);
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
