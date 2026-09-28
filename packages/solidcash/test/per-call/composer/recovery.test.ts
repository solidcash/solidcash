import { describe, expect, it, beforeAll } from 'vitest';
import { binToHex, encodeLockingBytecodeP2sh32, hash256, hexToBin } from '@bitauth/libauth';
import {
  FrameKind, SHARED_LIBRARY_SALT, asmToScript, encodeIntegerValue, scriptToBytecode, sha256, validatorAddress,
} from '@solidcash/utils';
import { ethers } from 'ethers';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { fillPlaceholders } from '../../../../solidc/src/per-call/master/placeholders.js';
import {
  REAL_VALIDATOR_PROGRAM, categorySlotValue, seededCategory,
} from '../../../../solidc/test/per-call/master/validator-input.js';
import { computeEcrecoverWitness } from '../../../src/ecrecover/ecrecoverRecovery.js';
import { probeEcrecoverSplit } from '../../../src/ecrecover/ecrecoverComputeSidecar.js';
import {
  buildRecoverySideCars, composeDraft, recoveryCallsOf, type CompositionDraftPlan, type DraftMaster,
} from '../../../src/per-call/composer/index.js';
import { USER_LOCK, composeAndDerive, rootOf, userInput } from '../shapes/harness.js';

/**
 * A per-call master that recovers a signer, composed and derived by the shipped composer.
 *
 * The entry takes the four scalars as arguments and compares the recovered key against a compile-time owner. The
 * master dispatches over two entries, so a user enters it with the call data `selector || h || v || r || s`; the
 * composer reads the scalars from those argument pushes, builds the recovery side-car pair (and, for the EVM
 * projection, the keccak side-car), and `layoutTransaction` places them immediately after the master's input. The
 * machine's verdict on every contract input - the master and each side-car - is the assertion; no coordinate is
 * supplied by the test.
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
  txid: (odd ? 'bb' : 'aa').repeat(32), vout: 1, satoshis: 100_000n,
  token: { category: 'ee'.repeat(32), amount: 0n, nft: { capability: 'mutable', commitment: '' } },
}) as never;

/** Signs one message with a fresh wallet, re-drawing until the shipped split probe accepts the signature. */
async function splittableSigner(): Promise<Signer> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const wallet = ethers.Wallet.createRandom();
    const message = `composer recovery ${attempt}`;
    const signature = await wallet.signMessage(message);
    const digest = ethers.hashMessage(message);
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
  signer = await splittableSigner();
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
  return 'pragma solidcash ^0.13.0;'
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

/**
 * Compiles an entry, reads its recovery calls from the argument pushes, builds the side-cars, and lays the plan out.
 * Nothing here states an index: the side-car ids come from the composer, and the layout places them.
 */
function buildCase(calls: readonly CallSpec[]): RecoveryCase {
  const artifacts = compileStringMulti(recoverySource(calls), { composition: 'per-call' });
  const artifact = artifacts.Auth!;
  const program = fillPlaceholders(
    scriptToBytecode(asmToScript(artifact.bytecode)),
    artifact.composition!.placeholders,
    { category: categorySlotValue(CATEGORY), contractAddress: CONTRACT_ADDRESS, templateHash: TEMPLATE_HASH },
  );
  const abiFunction = artifact.abi.find((row) => row.name === 'check')!;
  const selector = hexToBin(abiFunction.selector!);
  const pushes = argumentPushes(selector, calls);
  const decoded = recoveryCallsOf(abiFunction, pushes, 1); // one leading push: the dispatcher selector
  const sideCars = buildRecoverySideCars(MASTER_ID, decoded);
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
  };
  return { plan, artifacts, ids: sideCars.ids };
}

/** The one-call case most of the tests below use. */
const recoveryCase = (
  scalars: { h: Uint8Array; v: number; r: Uint8Array; s: Uint8Array },
  comparison: string,
  projection: 'pubkey' | 'evm',
): RecoveryCase => buildCase([{ scalars, comparison, evm: projection === 'evm' }]);

/** Composes, derives and evaluates a case; returns each participant's machine verdict by identity. */
function verdictsOf(test: RecoveryCase): Record<string, { accepted: boolean; objection?: string }> {
  const outcome = composeAndDerive(test.plan, [test.artifacts.Auth!], [rootOf('Auth', 'check', MASTER_ID)]);
  return Object.fromEntries(outcome.verdicts.map((verdict) => [verdict.participant, {
    accepted: verdict.accepted, ...(verdict.objection === undefined ? {} : { objection: verdict.objection }),
  }]));
}

/** The machine verdicts of a composed-but-underived case, for a body the derivation cannot settle. */
function rawVerdicts(test: RecoveryCase): Record<string, boolean> {
  const draft = composeDraft(test.plan);
  const program = draft.programFor(MASTER_ID);
  const vm = compositionMachine();
  return Object.fromEntries(draft.layout.participants.map((placed) => [placed.id,
    vm.stateSuccess(vm.evaluate({
      inputIndex: placed.index, sourceOutputs: program.sourceOutputs, transaction: program.transaction,
    })) === true,
  ]));
}

describe('a composed per-call recovery', () => {
  it('is accepted at the master input and every recovery side-car input', () => {
    const test = recoveryCase(signer, `pubkey(0x${binToHex(signer.owner)})`, 'pubkey');
    const verdicts = verdictsOf(test);
    expect(verdicts[MASTER_ID]).toStrictEqual({ accepted: true });
    for (const id of test.ids) expect(verdicts[id]!.accepted, id).toBe(true);
    expect(test.ids).toHaveLength(2); // one A/B pair, no keccak side-car
  });

  it('is accepted when the EVM projection reads its address from a keccak side-car', () => {
    const test = recoveryCase(signer, `bytes20(0x${binToHex(signer.address)})`, 'evm');
    const verdicts = verdictsOf(test);
    expect(verdicts[MASTER_ID]).toStrictEqual({ accepted: true });
    for (const id of test.ids) expect(verdicts[id]!.accepted, id).toBe(true);
    expect(test.ids).toHaveLength(3); // the A/B pair plus one keccak side-car
  });

  it('is accepted with one A/B pair per call when the entry makes two recoveries', async () => {
    const second = await splittableSigner();
    const test = buildCase([
      { scalars: signer, comparison: `pubkey(0x${binToHex(signer.owner)})`, evm: false },
      { scalars: second, comparison: `pubkey(0x${binToHex(second.owner)})`, evm: false },
    ]);
    expect(test.ids).toStrictEqual([
      `${MASTER_ID}/recovery-A0`, `${MASTER_ID}/recovery-B0`,
      `${MASTER_ID}/recovery-A1`, `${MASTER_ID}/recovery-B1`,
    ]);
    const layout = composeAndDerive(test.plan, [test.artifacts.Auth!], []).draft.layout;
    expect(layout.participants.map((placed) => [placed.id, placed.index])).toStrictEqual([
      [MASTER_ID, 0], [`${MASTER_ID}/recovery-A0`, 1], [`${MASTER_ID}/recovery-B0`, 2],
      [`${MASTER_ID}/recovery-A1`, 3], [`${MASTER_ID}/recovery-B1`, 4],
    ]);
    const verdicts = verdictsOf(test);
    expect(verdicts[MASTER_ID]).toStrictEqual({ accepted: true });
    for (const id of test.ids) expect(verdicts[id]!.accepted, id).toBe(true);
  });
});

describe('the recovery side-cars the composer places', () => {
  it('are one A/B pair per call, immediately after the master input', () => {
    const test = recoveryCase(signer, `pubkey(0x${binToHex(signer.owner)})`, 'pubkey');
    const layout = composeAndDerive(test.plan, [test.artifacts.Auth!], []).draft.layout;
    expect(test.ids).toStrictEqual([`${MASTER_ID}/recovery-A0`, `${MASTER_ID}/recovery-B0`]);
    expect(layout.participants.map((placed) => [placed.id, placed.index, placed.kind])).toStrictEqual([
      [MASTER_ID, 0, 'master'],
      [`${MASTER_ID}/recovery-A0`, 1, 'recovery'],
      [`${MASTER_ID}/recovery-B0`, 2, 'recovery'],
    ]);
    expect(layout.funderInputBase).toBe(3);
  });

  it('are a pair plus a keccak side-car for the EVM projection', () => {
    const test = recoveryCase(signer, `bytes20(0x${binToHex(signer.address)})`, 'evm');
    expect(test.ids).toStrictEqual([
      `${MASTER_ID}/recovery-A0`, `${MASTER_ID}/recovery-B0`, `${MASTER_ID}/recovery-K0`,
    ]);
    const layout = composeAndDerive(test.plan, [test.artifacts.Auth!], []).draft.layout;
    expect(layout.participants.map((placed) => placed.index)).toStrictEqual([0, 1, 2, 3]);
  });
});

describe('the EVM invalid-input rule through the composer', () => {
  it('refuses to build a pair for a recovery id outside 27/28', () => {
    // Side-car A verifies `Ry mod 2 == v - 27`, so no split fits; the composer cannot co-spend the pair and says so.
    for (const v of [0, 1]) {
      expect(() => recoveryCase({ ...signer, v }, `pubkey(0x${binToHex(signer.owner)})`, 'pubkey'))
        .toThrow(/no ladder split fits/);
    }
  });

  it('refuses to build a pair for the all-zero digest and words', () => {
    const zero = new Uint8Array(32);
    expect(() => recoveryCase({ h: zero, v: 0, r: zero, s: zero }, `pubkey(0x${binToHex(signer.owner)})`, 'pubkey'))
      .toThrow(/Cannot find square root/);
  });

  it('recovers a non-matching key for an out-of-range s, so the master rejects', () => {
    // `s` above the curve order is used verbatim: the pair is built and the composer places it, but the key it
    // commits is not the expected signer. The machine refuses the master input and accepts the side-cars, and the
    // derivation reports the body it cannot settle rather than a spend.
    const outOfRange = new Uint8Array(32).fill(0xff);
    const test = recoveryCase({ ...signer, s: outOfRange }, `pubkey(0x${binToHex(signer.owner)})`, 'pubkey');
    const verdicts = rawVerdicts(test);
    expect(verdicts[MASTER_ID]).toBe(false);
    for (const id of test.ids) expect(verdicts[id], id).toBe(true);
    expect(() => verdictsOf(test)).toThrow(/PER_CALL_DERIVATION_STALLED/);
  });
});
