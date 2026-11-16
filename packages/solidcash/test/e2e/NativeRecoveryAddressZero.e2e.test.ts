/**
 * A native recovery the EVM's precompile refuses answers `ecrecoverEvm`'s zero, 20 zero bytes, while a native
 * `address(0)` is the empty value. The address comparisons of a native program that recovers an EVM address read the
 * two as one zero, as Solidity's do: `require(who != address(0))` refuses every input the precompile refuses and passes
 * a signer's, and `who == address(0)`, or `who` against an address never set, holds for each refused input and fails
 * for a signer's address, stateful and stateless, straight-line and through a helper. A Solidity port under evmCompat,
 * the control, keeps its recovery's 20 zero bytes and compares them equal to address(0) by its own identity rule, also
 * when it compares the recovery's answer with address(0) directly.
 *
 * On the production profile, and each sent transaction is checked by the VM. The refused inputs are those of
 * EcrecoverEvmConformance.e2e (stateful) and of EcrecoverRecovery's stateless describe, which also builds them around
 * a signature whose ladder splits over two side-cars.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeTransactionUnsafe, encodeLockingBytecodeP2pkh, hexToBin, lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import { secp256k1 } from '@noble/curves/secp256k1';
import { ethers } from 'ethers';
import {
  SHARED_LIBRARY_SALT, ecrecoverComputeLockingBytecode, keccakComputeLockingBytecode, type Artifact,
} from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { Contract, SignatureTemplate, Signer, TransactionBuilder } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { randomUtxo, solidCashOutputToLibauthOutput } from '../../src/utils.js';
import { computeEcrecoverWitness } from '../../src/ecrecover/ecrecoverRecovery.js';
import { probeEcrecoverSplit } from '../../src/ecrecover/ecrecoverComputeSidecar.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';

const N = secp256k1.CURVE.n;
const P = secp256k1.CURVE.p;
const ZERO = '00'.repeat(20);
/** A failing require: a VERIFY that fails, or a final one that leaves false. */
const REFUSED = /failed an OP_[A-Z]*VERIFY|non-truthy/;

/** A value below 2^256 as a 32-byte big-endian word, the EVM's order. */
const beWord = (value: bigint): Uint8Array => hexToBin(value.toString(16).padStart(64, '0'));
/** A value below 2^256 as a 32-byte little-endian word, the order the native recovery reads. */
const leWord = (value: bigint): Uint8Array => beWord(value).reverse();

const power = (base: bigint, exponent: bigint, modulus: bigint): bigint => {
  let result = 1n;
  for (let b = base % modulus, e = exponent; e > 0n; b = (b * b) % modulus, e >>= 1n) {
    if (e & 1n) result = (result * b) % modulus;
  }
  return result;
};

/** One call's arguments in the EVM's order: a 32-byte digest and the precompile's v, r and s. */
interface EvmInput {
  readonly label: string; readonly h: Uint8Array; readonly v: bigint; readonly r: bigint; readonly s: bigint;
}

/** A signature by a random key over a random message, with the address ethers.js recovers from it. */
async function signedByRandomKey(index: number): Promise<{ input: EvmInput; address: string }> {
  const wallet = ethers.Wallet.createRandom();
  const message = `native zero ${index} ${binToHex(ethers.randomBytes(16))}`;
  const signature = await wallet.signMessage(message);
  const parsed = ethers.Signature.from(signature);
  return {
    input: { label: `random key ${index}`, h: hexToBin(ethers.hashMessage(message).slice(2)), v: BigInt(parsed.v),
      r: BigInt(parsed.r), s: BigInt(parsed.s) },
    address: wallet.address.slice(2).toLowerCase(),
  };
}

/** The twelve inputs EcrecoverEvmConformance.e2e has the precompile refuse, around one signature. */
function refusedAround(base: EvmInput): EvmInput[] {
  let offCurve = 1n;
  while (power(offCurve ** 3n + 7n, (P - 1n) / 2n, P) === 1n) offCurve += 1n;
  let onCurveAboveN = N;
  while (power(onCurveAboveN ** 3n + 7n, (P - 1n) / 2n, P) !== 1n) onCurveAboveN += 1n;
  // R = (z/s) G, so that s R = z G and the key is the point at infinity.
  const z = 0x5d7f9e1c3a5b7d9f1e3c5a7b9d1f3e5c7a9b1d3f5e7c9a1b3d5f7e9c1a3b5d7fn, zs = 0x9e37n;
  const point = secp256k1.ProjectivePoint.BASE.multiply((z * power(zs, N - 2n, N)) % N).toAffine();
  return [
    { ...base, label: 'v = 0', v: 0n }, { ...base, label: 'v = 29', v: 29n }, { ...base, label: 'v = 26', v: 26n },
    { ...base, label: 'r = 0', r: 0n }, { ...base, label: 'r = n', r: N },
    { ...base, label: 'r an x in [n, p)', v: 27n, r: onCurveAboveN },
    { ...base, label: 'r = 2^256 - 1', r: 2n ** 256n - 1n },
    { ...base, label: 's = 0', s: 0n }, { ...base, label: 's = n', s: N }, { ...base, label: 's = 2^256 - 1', s: 2n ** 256n - 1n },
    { ...base, label: 'r with no curve point', v: 27n, r: offCurve },
    { label: 'a key at infinity', h: beWord(z), v: 27n + (point.y & 1n), r: point.x, s: zs },
  ];
}

/** The scalars of an input as the native builtins take them: little-endian words. */
const native = ({ h, v, r, s }: EvmInput): unknown[] => [Uint8Array.from(h).reverse(), v, leWord(r), leWord(s)];
/** The scalars of an input as a Solidity port takes them: big-endian words. */
const bigEndian = ({ h, v, r, s }: EvmInput): unknown[] => [h, v, beWord(r), beWord(s)];

type Sent = { transaction: ReturnType<typeof decodeTransactionUnsafe>; sourceOutputs: unknown[] };

const COMPILE = { deployer: true, genesisCalls: true, messageBus: false } as const;

/**
 * A stateful contract on the production profile with its recovery pool, `poolCoins` coins of each role, a wallet and a
 * record of what it sent.
 */
async function deployed(artifact: Artifact, poolCoins = 1): Promise<{
  call(args: unknown[]): Promise<void>;
  state(): Promise<Record<string, unknown>>;
  sent: Sent[];
  verify(sent: Sent): unknown;
}> {
  const provider = new MockNetworkProvider({ profile: 'production' });
  const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
  const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
  if (typeof change === 'string') throw new Error(change);
  const fundingUtxo = { txid: 'c0'.repeat(32), vout: 0, satoshis: 2_000_000n };
  await provider.seedUtxo(binToHex(authorLock), fundingUtxo);
  const { contract, categoryId } = await StatefulContract.deploy(artifact, [] as never, {
    provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(), changeAddress: change.address,
    senderLockingBytecode: authorLock,
  } as never);
  // The contract's own (branded) pool: a coin of each recovery role and of the stateful keccak side-car.
  const salt = hexToBin(categoryId).slice().reverse();
  const locks = [
    ...(['A', 'B2', 'M', 'B3'] as const).map((role) => ecrecoverComputeLockingBytecode(salt, role)),
    keccakComputeLockingBytecode(salt, true),
  ];
  for (const [index, lock] of locks.entries()) {
    for (let copy = 0; copy < poolCoins; copy += 1) {
      await provider.seedUtxo(binToHex(lock), {
        txid: `c1${index}${copy}`.padEnd(64, '0'), vout: 0, satoshis: 100_000n,
        token: { category: 'ed'.repeat(31) + '15', amount: 0n, nft: { capability: 'mutable', commitment: '' } },
      });
    }
  }
  const signer = new Signer(alicePriv, provider);
  for (let index = 0; index < 8; index += 1) {
    await provider.seedUtxo(signer.getAddress(), { txid: `c2${index}`.padEnd(64, '0'), vout: 0, satoshis: 200_000n });
  }
  const sent: Sent[] = [];
  const send = provider.sendRawTransaction.bind(provider);
  (provider as unknown as { sendRawTransaction(hex: string): Promise<string> }).sendRawTransaction = async (hex) => {
    const transaction = decodeTransactionUnsafe(hexToBin(hex));
    const sourceOutputs = await Promise.all(transaction.inputs.map(async (input) => {
      const spent = await provider.getLedgerOutput(binToHex(input.outpointTransactionHash), input.outpointIndex);
      if (spent === undefined) throw new Error('an input of the transaction is not on the ledger');
      return solidCashOutputToLibauthOutput({
        to: spent.lockingBytecode, amount: spent.satoshis, ...(spent.token === undefined ? {} : { token: spent.token }),
      });
    }));
    sent.push({ transaction, sourceOutputs });
    return send(hex);
  };
  const connected = contract.connect(signer) as unknown as {
    call: { f(...args: unknown[]): { send(): Promise<unknown> } };
  };
  return {
    sent,
    call: async (args) => { await connected.call.f(...args).send(); },
    state: async () => (await contract.getState()) as Record<string, unknown>,
    verify: (transaction) => createVirtualMachineBch2026ForProvider(provider).verify(transaction as never),
  };
}

const NATIVE = `pragma solidcash ^0.51.0;
  contract G { int n;
    function f(bytes32 h, int v, bytes32 r, bytes32 s) external returns (bool) {
      address who = ecrecoverEvm(h, v, r, s); require(who != address(0)); n = n + 1; return true; } }
  contract R { bool isZero; bool matchesNobody; address nobody; int n;
    function f(bytes32 h, int v, bytes32 r, bytes32 s) external returns (bool) {
      address who = ecrecoverEvm(h, v, r, s); isZero = who == address(0); matchesNobody = who == nobody; n = n + 1;
      return true; } }
  contract H { bool isZero; int n;
    function signer(bytes32 d, int vv, bytes32 rr, bytes32 ss) private pure returns (address) {
      return ecrecoverEvm(d, vv, rr, ss); }
    function f(bytes32 h, int v, bytes32 r, bytes32 s) external returns (bool) {
      isZero = signer(h, v, r, s) == address(0); n = n + 1; return true; } }`;

describe('a refused native ecrecoverEvm compares equal to address(0), stateful', () => {
  it('require(who != address(0)) refuses every refused input before sending and passes a signature', async () => {
    const { input } = await signedByRandomKey(0);
    const contract = await deployed(compileString(NATIVE, { ...COMPILE, primaryContractName: 'G' } as never));
    for (const refused of refusedAround(input)) {
      await expect(contract.call(native(refused)), refused.label).rejects.toThrow(REFUSED);
    }
    expect(contract.sent).toHaveLength(0);
    await contract.call(native(input));
    expect(contract.sent).toHaveLength(1);
    expect(contract.verify(contract.sent[0]!)).toBe(true);
    expect((await contract.state()).n).toBe(1n);
  });

  it('who == address(0), and who against an address never set, hold for every refused input and fail for a signer',
    async () => {
      const { input } = await signedByRandomKey(1);
      const contract = await deployed(compileString(NATIVE, { ...COMPILE, primaryContractName: 'R' } as never));
      const cases = [
        ...refusedAround(input).map((refused) => ({ input: refused, zero: true })),
        { input, zero: false },
      ];
      for (const [index, { input: args, zero }] of cases.entries()) {
        await contract.call(native(args));
        expect(contract.verify(contract.sent[contract.sent.length - 1]!), args.label).toBe(true);
        const state = await contract.state();
        expect(state.isZero, args.label).toBe(zero);
        expect(state.matchesNobody, args.label).toBe(zero);
        expect(state.n).toBe(BigInt(index + 1));
      }
    });

  it('a helper that returns the recovered address compares it equal to address(0) for a refused input', async () => {
    const { input } = await signedByRandomKey(2);
    // Two coins of each role, as StraightLineRecovery's refused-through-a-helper case seeds: the run learns the arguments.
    const contract = await deployed(compileString(NATIVE, { ...COMPILE, primaryContractName: 'H' } as never), 2);
    const refused = refusedAround(input)
      .filter((candidate) => ['v = 0', 'r with no curve point', 'a key at infinity'].includes(candidate.label));
    expect(refused).toHaveLength(3);
    for (const [index, { input: args, zero }] of [
      ...refused.map((candidate) => ({ input: candidate, zero: true })), { input, zero: false },
    ].entries()) {
      await contract.call(native(args));
      expect(contract.verify(contract.sent[contract.sent.length - 1]!), args.label).toBe(true);
      const state = await contract.state();
      expect(state.isZero, args.label).toBe(zero);
      expect(state.n).toBe(BigInt(index + 1));
    }
  });
});

describe('a refused native ecrecoverEvm compares equal to address(0), stateless', () => {
  /** A signature by a fresh key whose ladder splits over two side-cars, as a stateless recovery needs. */
  const splitting = async (prefix: string): Promise<{ h: Uint8Array; v: bigint; r: Uint8Array; s: Uint8Array }> => {
    const coin = (vout: number): never => ({
      txid: (vout ? 'bb' : 'aa').repeat(32), vout, satoshis: 100_000n,
      token: { category: 'ee'.repeat(31) + '11', amount: 0n, nft: { capability: 'mutable', commitment: '' } },
    }) as never;
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const wallet = ethers.Wallet.createRandom();
      const message = `${prefix}-${attempt}`;
      const parsed = ethers.Signature.from(await wallet.signMessage(message));
      const little = (hex: string): Uint8Array => hexToBin(hex.slice(2)).reverse();
      const signed = {
        h: little(ethers.hashMessage(message)), v: BigInt(parsed.v), r: little(parsed.r), s: little(parsed.s),
      };
      try {
        probeEcrecoverSplit(computeEcrecoverWitness(signed.h, Number(signed.v), signed.r, signed.s), SHARED_LIBRARY_SALT,
          coin(0), coin(1));
        return signed;
      } catch {
        // A width-0 signature, which no two side-cars serve: sign again.
      }
    }
    throw new Error(`no signature of "${prefix}" splits over two side-cars in 24 tries`);
  };
  /** An x below n that no curve point has. */
  const offCurveX = (): bigint => {
    let x = 1n;
    while (power(x ** 3n + 7n, (P - 1n) / 2n, P) === 1n) x += 1n;
    return x;
  };
  /** Arguments whose key is the point at infinity, R = (z/s) G, as EcrecoverRecovery's stateless describe draws them. */
  const atInfinity = (): [Uint8Array, bigint, Uint8Array, Uint8Array] => {
    const z = 0x2c4e6a8b0d1f3e5c7a9b1d3f5e7c9a0b2d4f6e8c0a1b3d5f7e9c1a3b5d7f9e1dn, s = 0x71dn;
    const point = secp256k1.ProjectivePoint.BASE.multiply((z * power(s, N - 2n, N)) % N).toAffine();
    expect(point.x < N).toBe(true);
    return [leWord(z), 27n + (point.y & 1n), leWord(point.x), leWord(s)];
  };
  const SOURCE = `
  contract S() {
      function guard(bytes32 h, int v, bytes32 r, bytes32 s) {
          address who = ecrecoverEvm(h, v, r, s);
          require(who != address(0));
      }
      function atZero(bytes32 h, int v, bytes32 r, bytes32 s) {
          address who = ecrecoverEvm(h, v, r, s);
          require(who == address(0));
      }
  }`;
  /** One spend of a fresh copy of the contract beside one recovery pair and one keccak side-car of the shared pool. */
  const spend = async (artifact: Artifact, name: 'guard' | 'atZero', args: unknown[]): Promise<void> => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const contract = new Contract(artifact, [] as never, { provider });
    await provider.seedUtxo(contract.address, { ...randomUtxo({ satoshis: 2_000_000n }) });
    for (const [roleIndex, role] of (['A', 'B'] as const).entries()) {
      await provider.seedUtxo(binToHex(ecrecoverComputeLockingBytecode(SHARED_LIBRARY_SALT, role)), {
        txid: `f1${roleIndex}`.padEnd(64, '0'), vout: 0, satoshis: 100_000n,
        token: { category: 'ee'.repeat(32), amount: 0n, nft: { capability: 'mutable', commitment: '' } },
      });
    }
    await provider.seedUtxo(binToHex(keccakComputeLockingBytecode(SHARED_LIBRARY_SALT, false)), {
      txid: 'f2'.padEnd(64, '0'), vout: 0, satoshis: 100_000n,
      token: { category: 'ee'.repeat(32), amount: 0n, nft: { capability: 'mutable', commitment: '' } },
    });
    let checked: unknown;
    const send = provider.sendRawTransaction.bind(provider);
    (provider as unknown as { sendRawTransaction(hex: string): Promise<string> }).sendRawTransaction = async (hex) => {
      const transaction = decodeTransactionUnsafe(hexToBin(hex));
      const sourceOutputs = await Promise.all(transaction.inputs.map(async (input) => {
        const spent = await provider.getLedgerOutput(binToHex(input.outpointTransactionHash), input.outpointIndex);
        if (spent === undefined) throw new Error('an input of the transaction is not on the ledger');
        return solidCashOutputToLibauthOutput({
          to: spent.lockingBytecode, amount: spent.satoshis, ...(spent.token === undefined ? {} : { token: spent.token }),
        });
      }));
      checked = createVirtualMachineBch2026ForProvider(provider).verify({ transaction, sourceOutputs } as never);
      return send(hex);
    };
    const unlock = (contract.unlock as unknown as Record<string, (...values: unknown[]) => never>)[name]!;
    await new TransactionBuilder({ provider })
      .addInputs(await contract.getUtxos(), unlock(...args))
      .addOutput({ to: contract.address, amount: 1_800_000n })
      .send();
    expect(checked).toBe(true);
  };

  it('guard refuses and atZero passes every refused input; a signature passes guard and fails atZero', async () => {
    const g = await splitting('native-zero-stateless');
    const artifact = compileString(SOURCE);
    const refused: Array<[string, unknown[]]> = [
      ['v = 0', [g.h, 0n, g.r, g.s]], ['s = n', [g.h, g.v, g.r, leWord(N)]], ['r = 0', [g.h, g.v, leWord(0n), g.s]],
      ['r with no curve point', [g.h, 27n, leWord(offCurveX()), g.s]], ['a key at infinity', atInfinity()],
    ];
    for (const [label, args] of refused) {
      await spend(artifact, 'atZero', args);
      await expect(spend(artifact, 'guard', args), label).rejects.toThrow(REFUSED);
    }
    const signature = [g.h, g.v, g.r, g.s];
    await spend(artifact, 'guard', signature);
    await expect(spend(artifact, 'atZero', signature)).rejects.toThrow(REFUSED);
  });
});

describe('the evmCompat control', () => {
  it('a Solidity port keeps its recovery\'s 20 zero bytes, which equal address(0) by its own rule', async () => {
    const { input, address } = await signedByRandomKey(3);
    const source = 'pragma solidity ^0.8.0; contract P { address public who; bool public isZero; uint256 public n; '
      + 'function f(bytes32 h, uint8 v, bytes32 r, bytes32 s) external returns (bool) { '
      + 'who = ecrecover(h, v, r, s); isZero = who == address(0); n = n + 1; return true; } }';
    const contract = await deployed(compileString(source, {
      ...COMPILE, primaryContractName: 'P', ecrecover: 'evm', evmCompat: true,
    } as never));
    const cases = [
      ...refusedAround(input).map((refused) => ({ input: refused, who: ZERO, zero: true })),
      { input, who: address, zero: false },
    ];
    for (const [index, { input: args, who, zero }] of cases.entries()) {
      await contract.call(bigEndian(args));
      expect(contract.verify(contract.sent[contract.sent.length - 1]!), args.label).toBe(true);
      const state = await contract.state();
      expect(binToHex((state.who as Uint8Array | undefined) ?? new Uint8Array()), args.label).toBe(who);
      expect(state.isZero, args.label).toBe(zero);
      expect(state.n).toBe(BigInt(index + 1));
    }
  });

  it('a Solidity port that compares the recovery with address(0) directly sees it equal for every refused input',
    async () => {
      // `ecrecover(..) == address(0)`: the call's answer, a 20-byte identity that converts to an address, is read by
      // the port's identity rule as the other operand is, so a refused recovery's 20 zero bytes equal address(0).
      const { input } = await signedByRandomKey(4);
      const source = 'pragma solidity ^0.8.0; contract PD { bool public isZero; uint256 public n; '
        + 'function f(bytes32 h, uint8 v, bytes32 r, bytes32 s) external returns (bool) { '
        + 'isZero = ecrecover(h, v, r, s) == address(0); n = n + 1; return true; } }';
      const contract = await deployed(compileString(source, {
        ...COMPILE, primaryContractName: 'PD', ecrecover: 'evm', evmCompat: true,
      } as never));
      const cases = [
        ...refusedAround(input).map((refused) => ({ input: refused, zero: true })),
        { input, zero: false },
      ];
      for (const [index, { input: args, zero }] of cases.entries()) {
        await contract.call(bigEndian(args));
        expect(contract.verify(contract.sent[contract.sent.length - 1]!), args.label).toBe(true);
        const state = await contract.state();
        expect(state.isZero, args.label).toBe(zero);
        expect(state.n).toBe(BigInt(index + 1));
      }
    });
});
