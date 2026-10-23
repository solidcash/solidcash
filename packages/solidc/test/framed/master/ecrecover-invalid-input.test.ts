import { describe, expect, it, beforeAll } from 'vitest';
import {
  binToHex, createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh,
  encodeLockingBytecodeP2sh32, hash256, hexToBin,
} from '@bitauth/libauth';
import {
  asmToScript, ecrecoverComputeLockingBytecode, encodeWitnessBlock, keccakComputeLockingBytecode,
  scriptToBytecode, sha256, SHARED_LIBRARY_SALT, validatorAddress, type ArtifactMap, type WitnessBlock,
} from '@solidcash/utils';
import { ethers } from 'ethers';
import { compileString, compileStringMulti } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { buildKeccakComputeSidecar } from '../../../../solidcash/src/keccak/keccakComputeSidecar.js';
import { buildEcrecoverComputeSidecars, probeEcrecoverSplit }
  from '../../../../solidcash/src/ecrecover/ecrecoverComputeSidecar.js';
import { computeEcrecoverWitness, type EcrecoverWitness }
  from '../../../../solidcash/src/ecrecover/ecrecoverRecovery.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { REAL_VALIDATOR_PROGRAM, categorySlotValue, seededCategory } from './validator-input.js';
import { publishedRefusals } from './refused-entry.js';

/**
 * `ecrecover` and the EVM's invalid-input rule, on the framed path.
 *
 * The EVM's `ecrecover(hash, v, r, s)` returns `address(0)` for every invalid input - an empty or malformed
 * signature, an out-of-range `s`, a `v` that is not 27/28 - and only aborts on a genuine execution failure. A
 * source that ports `require(ecrecover(...) == expected)` therefore relies on the zero result to make the require
 * evaluate false rather than halt the script.
 *
 * On the framed path the recovery value comes from a co-spent side-car pair: A checkpoints the GLV ladder and B
 * commits the recovered compressed key, and the master reads that key from B's output. The pair is placed
 * immediately after the master's own input, so the body locates A at `OP_INPUTINDEX + 1` and B at `+ 2` (a
 * `ecrecoverEvm` keccak side-car rides at `+ 3`) rather than through an SDK operand. The cases below compile each
 * input shape and drive a real spend on the BCH-2026 machine, with the machine's own verdict as the assertion.
 *
 * The side-car is signature-independent and self-verifying: as docs/ecrecover.md records, it commits whatever key
 * its witnessed `(hash, v, r, s)` recover, and the master compares that key against the source's. No pair recovers
 * from the arguments the precompile refuses (a `v` outside 27/28 fails the checkpoint covenant's parity binding, an
 * `r` of 0 has no square root), so the framed body tests them itself: for a `v` outside 27/28, or an `r` or `s`
 * outside [1, n), it answers the zero address, empty as `address(0)` is, without reading the pair the composer
 * co-spends there. An `r` in range but off the curve has no pair either: side-car A's pad then opens with w, whose
 * square is -(r^3 + 7) mod p, which the body checks before it answers the zero address. A recovery at infinity is
 * still open.
 *
 * The direct-convention control compiles the same valid source, where the call is served and marked as recovery
 * compute - so what the framed cases below show is the framed convention's own behaviour.
 */

/** A standard compressed pubkey the recovery result is compared against. */
const SIGNER = '0x021111111111111111111111111111111111111111111111111111111111111111';

/** A P2PKH locking bytecode the projections are compared against. */
const SIGNER_P2PKH = '0x76a914' + '11'.repeat(20) + '88ac';

/** A valid recovery used normally: the recovered key is compared with the signer. */
const VALID_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Auth {'
  + '   function check(bytes32 h, int v, bytes32 r, bytes32 s) {'
  + `     require(ecrecoverPubKey(h, v, r, s) == pubkey(${SIGNER}));`
  + '   }'
  + ' }';

/**
 * An empty or short signature. The native builtin takes four scalars, so this is the shape a port writes: the
 * signature arrives as `bytes`, its length is the caller's check, and `r`/`s`/`v` are sliced out and handed to the
 * builtin. Whether the blob is empty, short or well-formed is a run-time fact of the argument.
 */
const SHORT_SIGNATURE_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Verifier {'
  + '   function verify(bytes32 hash, bytes signature) {'
  + '     bytes32 r = bytes32(signature.slice(0, 32));'
  + '     bytes32 s = bytes32(signature.slice(32, 64));'
  + '     int v = int(signature.slice(64, 65));'
  + `     require(ecrecoverPubKey(hash, v, r, s) == pubkey(${SIGNER}));`
  + '   }'
  + ' }';

/** The EVM-address projection: `ecrecoverEvm(hash, v, r, s)` returns a 20-byte address. */
const EVM_PROJECTION_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Auth {'
  + '   function check(bytes32 h, int v, bytes32 r, bytes32 s) {'
  + `     require(ecrecoverEvm(h, v, r, s) == bytes20(${'0x' + '11'.repeat(20)}));`
  + '   }'
  + ' }';

/** The bare Solidity name, which the `ecrecover` option maps to the P2PKH projection. */
const BARE_NAME_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Auth {'
  + '   function check(bytes32 h, int v, bytes32 r, bytes32 s) {'
  + `     require(ecrecover(h, v, r, s) == address(${SIGNER_P2PKH}));`
  + '   }'
  + ' }';

const compileFramed = (source: string, options: Record<string, unknown> = {}): ArtifactMap =>
  compileStringMulti(source, { composition: 'framed', ...options } as never);

/** The refusal a framed compile publishes, as `entry: reason`, or '' when every body is served. */
const refusalMessage = (source: string, options: Record<string, unknown> = {}): string =>
  publishedRefusals(compileFramed(source, options))
    .map((refused) => `${refused.functionName}: ${refused.reason}`).join(' | ');

/** True when the contract's entry is marked as a recovery compute. */
const marksRecoveryCompute = (source: string, options: Record<string, unknown> = {}): boolean => {
  const artifacts = compileFramed(source, options);
  return Object.values(artifacts).some((artifact) =>
    (artifact.abi ?? []).some((entry) => entry.ecrecoverCompute === true));
};

const CASES = [
  { name: 'a valid recovery used normally', source: VALID_SOURCE, options: {} },
  { name: 'an empty or short signature', source: SHORT_SIGNATURE_SOURCE, options: {} },
  { name: 'the EVM-address projection', source: EVM_PROJECTION_SOURCE, options: {} },
  { name: 'the bare name in P2PKH mode', source: BARE_NAME_SOURCE, options: { ecrecover: 'p2pkh' } },
] as const;

describe('ecrecover on the framed path is admitted for every input shape', () => {
  for (const { name, source, options } of CASES) {
    it(`emits the body for ${name}`, () => {
      expect(refusalMessage(source, options)).toBe('');
      expect(marksRecoveryCompute(source, options)).toBe(true);
    });
  }
});

describe('the direct convention serves the same recovery', () => {
  it('compiles a valid recovery and marks it as recovery compute', () => {
    const artifact = compileString(VALID_SOURCE);
    const fn = artifact.abi.find((entry) => entry.name === 'check');
    expect(fn?.ecrecoverCompute).toBe(true);
    expect(fn?.ecrecoverArgParams).toEqual([['h', 'v', 'r', 's']]);
  });

  it('compiles the bare name once the ecrecover option selects the projection', () => {
    const artifact = compileString(BARE_NAME_SOURCE, { ecrecover: 'p2pkh' });
    const fn = artifact.abi.find((entry) => entry.name === 'check');
    expect(fn?.ecrecoverCompute).toBe(true);
  });
});

describe('the admission is a property of the body that makes the call', () => {
  it('serves the sibling body and the recovery body together', () => {
    const source = 'pragma solidcash ^0.14.0;'
      + ' contract Mixed {'
      + '   function good() { require(true); }'
      + '   function bad(bytes32 h, int v, bytes32 r, bytes32 s) {'
      + `     require(ecrecoverPubKey(h, v, r, s) == pubkey(${SIGNER}));`
      + '   }'
      + ' }';
    expect(publishedRefusals(compileFramed(source))).toStrictEqual([]);
  });
});

/* --------------------------------------------------------------------------------------------------------- */

/**
 * The machine fixture: a compiled master entered by a user, co-spent with its recovery side-car pair (and, for the
 * EVM projection, a keccak side-car). The pair sits immediately after the master's own input, which is where the
 * body reads it; every verdict below is the BCH-2026 machine's own.
 */

const CATEGORY = seededCategory('framed ecrecover recovery');
const CONTRACT_ADDRESS = validatorAddress(CATEGORY, REAL_VALIDATOR_PROGRAM);
const TEMPLATE_HASH = sha256(REAL_VALIDATOR_PROGRAM);
const SIDECAR_CAT = hexToBin('ee'.repeat(31) + '11');
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));

/** Master input indices: the master, its A/B pair (and keccak K), then the user. */
const MASTER_INDEX = 0;
const A_INDEX = 1;
const B_INDEX = 2;
const K_INDEX = 3;

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmSourceOutput = VmProgram['sourceOutputs'][number];

/** A signer whose signature decomposes into a two-covenant split, with the LE scalars the builtin takes. */
interface Recovery {
  readonly h: Uint8Array;
  readonly v: number;
  readonly r: Uint8Array;
  readonly s: Uint8Array;
  readonly owner: Uint8Array;
  readonly address: Uint8Array;
  readonly witness: EcrecoverWitness;
  /** The ladder split the probe found for the witness, so the pair is built without probing again. */
  readonly chunkA: number;
}

const token = (
  category: Uint8Array, capability: 'minting' | 'mutable' | 'none', commitment: Uint8Array = new Uint8Array(0),
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable' | 'none'; commitment: Uint8Array } } =>
  ({ category, amount: 0n, nft: { capability, commitment } });

/** A dummy side-car UTXO for building and probing a pair (only its index and token matter to the covenants). */
const dummySideCar = (odd: boolean): { txid: string; vout: number; satoshis: bigint; token: unknown } =>
  ({
    txid: (odd ? 'bb'.repeat(31) + '44' : 'aa'.repeat(31) + '55'), vout: 1, satoshis: 100_000n,
    token: { category: 'ee'.repeat(31) + '11', amount: 0n, nft: { capability: 'mutable', commitment: '' } },
  });

const leBytes = (hex: string): Uint8Array => hexToBin(hex.replace(/^0x/, '')).slice().reverse();

/**
 * Signs one message with a fresh random wallet and returns the LE scalars, the recovered signer, the recovery
 * witnesses and the split they fit. A small share of signatures have a GLV ladder too long for the two-covenant
 * split, so the wallet is re-drawn until the split probe accepts - the same remedy the shipped e2e fixture uses.
 * The first draw is a key known to split, because a refused probe tries every split and costs seconds.
 */
async function splittableSigner(): Promise<Recovery> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const wallet = attempt === 0
      ? new ethers.Wallet(ethers.sha256(ethers.toUtf8Bytes('framed ecrecover key 1'))) : ethers.Wallet.createRandom();
    const message = `framed ecrecover ${attempt}`;
    const signature = await wallet.signMessage(message);
    const digest = ethers.hashMessage(message);
    const { r, s, v } = ethers.Signature.from(signature);
    const h = leBytes(digest), rLe = leBytes(r), sLe = leBytes(s);
    const owner = hexToBin(ethers.SigningKey
      .computePublicKey(ethers.SigningKey.recoverPublicKey(digest, signature), true).slice(2));
    const witness = computeEcrecoverWitness(h, v, rLe, sLe);
    const chunkA = splitOf(witness);
    if (chunkA === undefined) continue; // a width-0 signature; draw another
    return { h, v, r: rLe, s: sLe, owner, address: hexToBin(wallet.address.slice(2)), witness, chunkA };
  }
  throw new Error('no signature with a two-covenant split after 200 draws');
}

/** The finished bytes of a compiled contract's master program, with its deployment slots filled. */
function masterProgram(artifacts: ArtifactMap, name: string): Uint8Array {
  const artifact = artifacts[name]!;
  return fillPlaceholders(scriptToBytecode(asmToScript(artifact.bytecode)), artifact.composition!.placeholders, {
    category: categorySlotValue(CATEGORY), contractAddress: CONTRACT_ADDRESS, templateHash: TEMPLATE_HASH,
  });
}

/** The witness block a user's root frame carries into the master. */
function rootBlock(userIndex: number): WitnessBlock {
  return {
    kind: 0, callerRef: userIndex, originRef: userIndex, validatorRef: 0xffff, sender: USER_LOCK,
    self: CONTRACT_ADDRESS, value: 0n, retval: new Uint8Array(0), calls: [], segments: [[]], events: [], sends: [],
  };
}

/** One side-car input/output pair, recreated at its own index. */
interface SideCar {
  readonly unlockingBytecode: Uint8Array;
  readonly lock: Uint8Array;
  readonly commitment: Uint8Array;
}

const sideCarOutput = (car: SideCar): VmSourceOutput => ({
  lockingBytecode: car.lock, valueSatoshis: 100_000n, token: token(SIDECAR_CAT, 'mutable', car.commitment),
}) as VmSourceOutput;

const sideCarSource = (car: SideCar): VmSourceOutput => ({
  lockingBytecode: car.lock, valueSatoshis: 100_000n, token: token(SIDECAR_CAT, 'mutable'),
}) as VmSourceOutput;

/** The split at which a witness's GLV ladder fits the two-covenant pair, or undefined when none does. */
function splitOf(witness: EcrecoverWitness): number | undefined {
  try {
    return probeEcrecoverSplit(witness, SHARED_LIBRARY_SALT, dummySideCar(false) as never, dummySideCar(true) as never);
  } catch {
    return undefined;
  }
}

/** Builds the A/B recovery pair for a signer at the split its search found. */
function recoveryPair(recovery: Recovery): { readonly a: SideCar; readonly b: SideCar } {
  return pairAt(recovery.witness, recovery.chunkA);
}

/** Builds the A/B recovery pair for a witness at the given split, without probing viability. */
function pairAt(
  witness: EcrecoverWitness, chunkA: number, padPrefix?: Uint8Array,
): { readonly a: SideCar; readonly b: SideCar } {
  const { unlockerA, recreateA, unlockerB, recreateB } = buildEcrecoverComputeSidecars(
    witness, chunkA, SHARED_LIBRARY_SALT, dummySideCar(false) as never, dummySideCar(true) as never, padPrefix,
  );
  return {
    a: {
      unlockingBytecode: unlockerA.generateUnlockingBytecode({} as never),
      lock: ecrecoverComputeLockingBytecode(SHARED_LIBRARY_SALT, 'A'),
      commitment: hexToBin(recreateA.token!.nft!.commitment),
    },
    b: {
      unlockingBytecode: unlockerB.generateUnlockingBytecode({} as never),
      lock: ecrecoverComputeLockingBytecode(SHARED_LIBRARY_SALT, 'B'),
      commitment: hexToBin(recreateB.token!.nft!.commitment),
    },
  };
}

/** The keccak side-car the EVM projection reads its address from, on the stateful covenant a framed frame checks. */
function keccakCar(preimage: Uint8Array): SideCar {
  const { unlocker, recreate } = buildKeccakComputeSidecar(
    preimage, SHARED_LIBRARY_SALT, dummySideCar(false) as never, true,
  );
  return {
    unlockingBytecode: unlocker.generateUnlockingBytecode({} as never),
    lock: keccakComputeLockingBytecode(SHARED_LIBRARY_SALT, true),
    commitment: hexToBin(recreate.token!.nft!.commitment),
  };
}

/**
 * Builds the transaction: the master at input 0, its side-car pair (and keccak) immediately after, then the user.
 * The published outputs recreate every input at its own index, so a self-preserving side-car's coordinate is its
 * own index.
 */
function buildSpend(program: Uint8Array, cars: readonly SideCar[]): { transaction: VmTransaction; sourceOutputs: VmProgram['sourceOutputs'] } {
  const userIndex = 1 + cars.length;
  const masterLock = encodeLockingBytecodeP2sh32(hash256(program));
  const masterToken = token(CATEGORY, 'minting');
  const inputs = [
    {
      outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(1), sequenceNumber: 0xffffffff,
      unlockingBytecode: new Uint8Array([
        ...encodeDataPush(encodeWitnessBlock(rootBlock(userIndex))), ...encodeDataPush(program),
      ]),
    },
    ...cars.map((car, offset) => ({
      outpointIndex: 1, outpointTransactionHash: new Uint8Array(32).fill(offset + 2), sequenceNumber: 0xffffffff,
      unlockingBytecode: car.unlockingBytecode,
    })),
    {
      outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(0x44), sequenceNumber: 0xffffffff,
      unlockingBytecode: callerUnlockingBytecode(),
    },
  ];
  const outputs = [
    { lockingBytecode: masterLock, valueSatoshis: 20_000n, token: masterToken },
    ...cars.map(sideCarOutput),
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
  ];
  const sourceOutputs = [
    { lockingBytecode: masterLock, valueSatoshis: 20_000n, token: masterToken },
    ...cars.map(sideCarSource),
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
  ] as VmProgram['sourceOutputs'];
  return { transaction: { version: 2, inputs, outputs, locktime: 0 } as VmTransaction, sourceOutputs };
}

/** Each input's machine verdict, keyed by input index. */
function verdicts(spend: { transaction: VmTransaction; sourceOutputs: VmProgram['sourceOutputs'] }, indices: readonly number[]): Record<number, boolean> {
  const vm = compositionMachine();
  return Object.fromEntries(indices.map((index) => [
    index,
    vm.stateSuccess(vm.evaluate({
      inputIndex: index, sourceOutputs: spend.sourceOutputs, transaction: spend.transaction,
    })) === true,
  ]));
}

/** Compiles one recovery source with the given literal `(h, v, r, s)` and comparison, and returns its master. */
function compileRecoverySource(args: { h: Uint8Array; v: number; r: Uint8Array; s: Uint8Array }, comparison: string, projection: 'pubkey' | 'evm'): Uint8Array {
  const call = projection === 'pubkey' ? 'ecrecoverPubKey' : 'ecrecoverEvm';
  const source = 'pragma solidcash ^0.14.0;'
    + ' contract Auth {'
    + '   function check() {'
    + `     require(${call}(bytes32(0x${binToHex(args.h)}), ${args.v}, `
    + `bytes32(0x${binToHex(args.r)}), bytes32(0x${binToHex(args.s)})) == ${comparison});`
    + '   }'
    + ' }';
  const artifacts = compileFramed(source);
  expect(publishedRefusals(artifacts)).toStrictEqual([]);
  return masterProgram(artifacts, 'Auth');
}

let signer: Recovery;

beforeAll(async () => {
  signer = await splittableSigner();
}, 120_000);

let signerPair: { readonly a: SideCar; readonly b: SideCar } | undefined;
/** The signer's pair, built once: the cases below co-spend the same one. */
const signerPairOnce = (): { readonly a: SideCar; readonly b: SideCar } =>
  (signerPair ??= recoveryPair(signer));

describe('a framed body that recovers a signer', () => {
  it('is accepted at every input when the co-spent pair recovers the expected key', () => {
    const program = compileRecoverySource(signer, `pubkey(0x${binToHex(signer.owner)})`, 'pubkey');
    const { a, b } = signerPairOnce();
    const spend = buildSpend(program, [a, b]);
    expect(verdicts(spend, [MASTER_INDEX, A_INDEX, B_INDEX])).toStrictEqual({
      [MASTER_INDEX]: true, [A_INDEX]: true, [B_INDEX]: true,
    });
  });

  it('is refused when the source expects a different signer', () => {
    // The key the pair commits is the real one, so the source's own comparison is what refuses: the master fails
    // and the side-car inputs, which do not read the expected signer, still accept.
    const other = Uint8Array.from(signer.owner);
    other[1] ^= 0xff;
    const program = compileRecoverySource(signer, `pubkey(0x${binToHex(other)})`, 'pubkey');
    const { a, b } = signerPairOnce();
    const spend = buildSpend(program, [a, b]);
    expect(verdicts(spend, [MASTER_INDEX, A_INDEX, B_INDEX])).toStrictEqual({
      [MASTER_INDEX]: false, [A_INDEX]: true, [B_INDEX]: true,
    });
  });

  it('is accepted when the EVM projection reads the address from its keccak side-car', () => {
    const program = compileRecoverySource(signer, `bytes20(0x${binToHex(signer.address)})`, 'evm');
    const { a, b } = signerPairOnce();
    const spend = buildSpend(program, [a, b, keccakCar(signer.witness.uncompressedPubkey)]);
    expect(verdicts(spend, [MASTER_INDEX, A_INDEX, B_INDEX, K_INDEX])).toStrictEqual({
      [MASTER_INDEX]: true, [A_INDEX]: true, [B_INDEX]: true, [K_INDEX]: true,
    });
  });
});

/** The secp256k1 group order. */
const ORDER = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

/** A 32-byte little-endian word, the form the builtin takes its scalars in. */
function leWord(value: bigint): Uint8Array {
  const word = new Uint8Array(32);
  for (let index = 0; index < 32; index += 1, value >>= 8n) word[index] = Number(value & 0xffn);
  return word;
}

/** A master whose body requires its recovery to answer the zero address. */
const zeroProgram = (args: { h: Uint8Array; v: number; r: Uint8Array; s: Uint8Array }): Uint8Array =>
  compileRecoverySource(args, 'pubkey(0x)', 'pubkey');

describe('the EVM invalid-input rule on the framed path', () => {
  it('answers the zero address for a recovery id outside 27/28, binding no pair', () => {
    // The body reads no pair here, so the signer's own pair holds the place, unbound, and accepts on its own.
    const { a, b } = signerPairOnce();
    const spend = buildSpend(zeroProgram({ ...signer, v: 0 }), [a, b]);
    expect(verdicts(spend, [MASTER_INDEX, A_INDEX, B_INDEX])).toStrictEqual({
      [MASTER_INDEX]: true, [A_INDEX]: true, [B_INDEX]: true,
    });
    // The control: the recovery the precompile accepts answers the signer's key.
    expect(verdicts(buildSpend(zeroProgram(signer), [a, b]), [MASTER_INDEX])).toStrictEqual({ [MASTER_INDEX]: false });
  });

  it('answers the zero address for an r or s outside [1, n), and reads the pair at n - 1', () => {
    const { a, b } = signerPairOnce();
    const outside = [
      { ...signer, s: new Uint8Array(32).fill(0xff) }, { ...signer, s: leWord(ORDER) }, { ...signer, r: leWord(ORDER) },
      { ...signer, s: leWord(0n) }, { ...signer, r: leWord(0n) },
    ];
    for (const args of outside) {
      expect(verdicts(buildSpend(zeroProgram(args), [a, b]), [MASTER_INDEX])).toStrictEqual({ [MASTER_INDEX]: true });
    }
    // In range, the body binds the pair, which recovers the signer's own arguments rather than these.
    const inRange = buildSpend(zeroProgram({ ...signer, s: leWord(ORDER - 1n) }), [a, b]);
    expect(verdicts(inRange, [MASTER_INDEX])).toStrictEqual({ [MASTER_INDEX]: false });
  });

  it('answers the zero address for the all-zero digest and words, from which no pair recovers', () => {
    const zero = new Uint8Array(32);
    expect(() => computeEcrecoverWitness(zero, 0, zero, zero)).toThrow(/Cannot find square root/);
    const { a, b } = signerPairOnce();
    const spend = buildSpend(zeroProgram({ h: zero, v: 0, r: zero, s: zero }), [a, b]);
    expect(verdicts(spend, [MASTER_INDEX, A_INDEX, B_INDEX])).toStrictEqual({
      [MASTER_INDEX]: true, [A_INDEX]: true, [B_INDEX]: true,
    });
  });

  it('answers address(0) through the bare name in P2PKH mode, as a Solidity port compares it', () => {
    const word = `bytes32(0x${'11'.repeat(31) + 'ee'})`;
    const artifacts = compileFramed('pragma solidity ^0.8.0;'
      + ' contract Auth {'
      + '   function check() public pure {'
      + `     require(ecrecover(${word}, 0, ${word}, ${word}) == address(0));`
      + '   }'
      + ' }', { evmCompat: true, ecrecover: 'p2pkh' });
    expect(publishedRefusals(artifacts)).toStrictEqual([]);
    const { a, b } = signerPairOnce();
    expect(verdicts(buildSpend(masterProgram(artifacts, 'Auth'), [a, b]), [MASTER_INDEX]))
      .toStrictEqual({ [MASTER_INDEX]: true });
  });

  it('answers the zero address for an r in range but off the curve, which side-car A\'s pad proves', () => {
    // No y has y^2 = r^3 + 7, so no pair recovers; w with w^2 = -(r^3 + 7) mod p proves it, -1 being no square.
    let x = 1n;
    const offCurve = (): boolean => {
      try {
        computeEcrecoverWitness(signer.h, 27, leWord(x), signer.s);
        return false;
      } catch (error) {
        return /Cannot find square root/.test(String(error));
      }
    };
    while (!offCurve()) x += 1n;
    const prime = 2n ** 256n - 2n ** 32n - 977n;
    const power = (base: bigint, exponent: bigint): bigint => {
      let result = 1n;
      for (let b = base % prime, e = exponent; e > 0n; b = (b * b) % prime, e >>= 1n) {
        if ((e & 1n) === 1n) result = (result * b) % prime;
      }
      return result;
    };
    const w = power(prime - ((x ** 3n + 7n) % prime), (prime + 1n) / 4n);
    const proven = pairAt(signer.witness, signer.chunkA, leWord(w));
    const program = zeroProgram({ ...signer, v: 27, r: leWord(x) });
    expect(verdicts(buildSpend(program, [proven.a, proven.b]), [MASTER_INDEX, A_INDEX, B_INDEX])).toStrictEqual({
      [MASTER_INDEX]: true, [A_INDEX]: true, [B_INDEX]: true,
    });
    // Without the proof the body binds the pair, which recovers other arguments; a w that does not square to
    // -(r^3 + 7) is refused, and so is a proof beside an r a point has, where the recovery is the signer's.
    const { a, b } = signerPairOnce();
    expect(verdicts(buildSpend(program, [a, b]), [MASTER_INDEX])).toStrictEqual({ [MASTER_INDEX]: false });
    const wrong = pairAt(signer.witness, signer.chunkA, leWord(w + 1n));
    expect(verdicts(buildSpend(program, [wrong.a, wrong.b]), [MASTER_INDEX])).toStrictEqual({ [MASTER_INDEX]: false });
    expect(verdicts(buildSpend(zeroProgram(signer), [proven.a, proven.b]), [MASTER_INDEX]))
      .toStrictEqual({ [MASTER_INDEX]: false });
  });

  it('has no pair for a recovery id outside 27/28: the checkpoint covenant refuses it', () => {
    // Side-car A verifies `Ry mod 2 == v - 27` whatever the split, so a recovery id outside 27/28 fails `OP_VERIFY`
    // at a split both covenants fit. B alone re-derives no parity, so its own script accepts - but the transaction
    // that spends the pair cannot validate while A fails, which is why the body answers such an id itself (above).
    // Every such id fails the same way, so `v = 0` stands for them.
    const v = 0;
    const witness = computeEcrecoverWitness(signer.h, v, signer.r, signer.s);
    const { a, b } = pairAt(witness, 59);
    const spend = buildSpend(compileRecoverySource({ ...signer, v }, `pubkey(0x${binToHex(signer.owner)})`, 'pubkey'), [a, b]);
    expect(verdicts(spend, [A_INDEX, B_INDEX])).toStrictEqual({ [A_INDEX]: false, [B_INDEX]: true });
  });

});
