/**
 * The acceptance gate of docs/ecrecover.md ("Conformance requirement: ethers.js == solc == solidc"), as a standing
 * differential test on the production profile: BCH's 2026 limits, the standard relay policy, and no coin the network
 * does not already hold. A stateful contract keeps what its recovery answers, through real SDK calls, and each answer
 * is compared with the EVM precompile's, as ethers.js and @noble/curves give it: the signer's address for random keys
 * and messages with v in {27, 28}, the same address for each signature's high-S counterpart (the precompile has no
 * low-S rule), the golden vector, and the zero address, not an abort, for every input the precompile refuses: a bad v,
 * an r or s outside [1, n), an r no curve point has, and a key at infinity. Each sent transaction is checked by the VM.
 * It runs for ecrecoverEvm, for bare ecrecover in evm mode, and for a Solidity port compiled with evmCompat, whose
 * big-endian words the compiled recovery reverses.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeTransactionUnsafe, encodeLockingBytecodeP2pkh, hexToBin, lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 as keccak256 } from '@noble/hashes/sha3.js';
import { ethers } from 'ethers';
import { compileString } from '../direct-compile.js';
import { SignatureTemplate, Signer } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { solidCashOutputToLibauthOutput } from '../../src/utils.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Artifact } from '@solidcash/utils';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';

const N = secp256k1.CURVE.n;
const P = secp256k1.CURVE.p;
const ZERO = '00'.repeat(20);

/** A value below 2^256 as a 32-byte big-endian word, the EVM's order. */
const beWord = (value: bigint): Uint8Array => hexToBin(value.toString(16).padStart(64, '0'));

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

/**
 * What the EVM's ecrecover precompile answers, read from @noble/curves: the signer's address, or the zero address for
 * a v other than 27 or 28, an r or s outside [1, n), an r no curve point has, and a key at infinity.
 */
function precompile({ h, v, r, s }: EvmInput): string {
  if (v !== 27n && v !== 28n) return ZERO;
  if (r < 1n || r >= N || s < 1n || s >= N) return ZERO;
  try {
    const key = new secp256k1.Signature(r, s).addRecoveryBit(Number(v - 27n)).recoverPublicKey(h);
    return binToHex(keccak256(key.toRawBytes(false).slice(1)).slice(12));
  } catch {
    return ZERO;
  }
}

/** A signature by a random key over a random message, with the address ethers.js recovers from it. */
async function signedByRandomKey(index: number): Promise<{ input: EvmInput; address: string }> {
  const wallet = ethers.Wallet.createRandom();
  const message = `conformance ${index} ${binToHex(ethers.randomBytes(16))}`;
  const signature = await wallet.signMessage(message);
  const digest = ethers.hashMessage(message);
  const parsed = ethers.Signature.from(signature);
  expect(ethers.recoverAddress(digest, signature)).toBe(wallet.address);
  return {
    input: { label: `random key ${index}`, h: hexToBin(digest.slice(2)), v: BigInt(parsed.v), r: BigInt(parsed.r),
      s: BigInt(parsed.s) },
    address: wallet.address.slice(2).toLowerCase(),
  };
}

/** The high-S counterpart of a signature: s' = n - s with the recovery id flipped recovers the same key. */
const highS = (input: EvmInput): EvmInput => ({ ...input, label: `${input.label}, high-S`, s: N - input.s,
  v: 55n - input.v });

/** The golden vector of docs/ecrecover.md, itself high-S. */
const GOLDEN: EvmInput = {
  label: 'the golden vector',
  h: hexToBin('18c547e4f7b0f325ad1e56f57e26c745b09a3e503d86e00e5255ff7f715d3d1c'),
  v: 28n,
  r: 0x73b1693892219d736caba55bdb67216e485557ea6b6af75f37096c9aa6a5a75fn,
  s: 0xeeb940b1d03b21e36b0e47e79769f095fe2ab855bd91e3a38756b7d75a9c4549n,
};
const GOLDEN_ADDRESS = 'a94f5374fce5edbc8e2a8697c15331677e6ebf0b';

/** Inputs the precompile refuses, around one signature. */
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

type Sent = { transaction: ReturnType<typeof decodeTransactionUnsafe>; sourceOutputs: unknown[] };

/** A contract deployed on the production profile with a recovery pool, a wallet and a record of what it sent. */
async function deployed(artifact: Artifact): Promise<{
  call(args: unknown[]): Promise<Sent>; who(): Promise<string>; provider: MockNetworkProvider;
}> {
  const { ecrecoverComputeLockingBytecode, keccakComputeLockingBytecode } = await import('@solidcash/utils');
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
  // The contract's own (branded) pool, one coin of each recovery role and of the stateful keccak side-car: each
  // recreates itself, so every call takes the same coins.
  const salt = hexToBin(categoryId).slice().reverse();
  const locks = [
    ...(['A', 'B2', 'M', 'B3'] as const).map((role) => ecrecoverComputeLockingBytecode(salt, role)),
    keccakComputeLockingBytecode(salt, true),
  ];
  for (const [index, lock] of locks.entries()) {
    await provider.seedUtxo(binToHex(lock), {
      txid: `c1${index}`.padEnd(64, '0'), vout: 0, satoshis: 100_000n,
      token: { category: 'ed'.repeat(31) + '15', amount: 0n, nft: { capability: 'mutable', commitment: '' } },
    });
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
    provider,
    call: async (args) => {
      await connected.call.f(...args).send();
      return sent[sent.length - 1]!;
    },
    who: async () => binToHex(((await contract.getState()) as { who?: Uint8Array }).who ?? new Uint8Array()),
  };
}

const COMPILE = { deployer: true, genesisCalls: true } as const;

/** The scalars of an input as the native builtins take them: little-endian words. */
const native = ({ h, v, r, s }: EvmInput): unknown[] => [
  Uint8Array.from(h).reverse(), v, beWord(r).reverse(), beWord(s).reverse(),
];

describe('ecrecover conformance: ethers.js == the EVM precompile == solidc, on the production profile', () => {
  const projections = [
    {
      name: 'ecrecoverEvm',
      source: 'pragma solidcash ^0.52.0; contract G { bytes20 who; int n; '
        + 'function f(bytes32 h, int v, bytes32 r, bytes32 s) external returns (bool) { '
        + 'who = ecrecoverEvm(h, v, r, s); n = n + 1; return true; } }',
      options: { ...COMPILE, primaryContractName: 'G' },
    },
    {
      name: 'bare ecrecover in evm mode',
      source: 'pragma solidcash ^0.52.0; contract G { bytes20 who; int n; '
        + 'function f(bytes32 h, int v, bytes32 r, bytes32 s) external returns (bool) { '
        + 'who = ecrecover(h, v, r, s); n = n + 1; return true; } }',
      options: { ...COMPILE, primaryContractName: 'G', ecrecover: 'evm' },
    },
    {
      // A port's scalars are big-endian words, which the compiled recovery reverses, so the SDK learns the words the
      // call binds from its run. Its `who` is an `address`, whose SDK encoding spells 20 zero bytes as address(0)'s
      // empty push: a refused recovery stores the 20 bytes, and the SDK publishes the record as the run derived it.
      name: 'a Solidity port under evmCompat',
      source: 'pragma solidity ^0.8.0; contract G { address public who; uint256 public n; '
        + 'function f(bytes32 h, uint8 v, bytes32 r, bytes32 s) external returns (bool) { '
        + 'who = ecrecover(h, v, r, s); n = n + 1; return true; } }',
      options: { ...COMPILE, primaryContractName: 'G', ecrecover: 'evm', evmCompat: true },
      bigEndian: true,
    },
  ] as const;

  for (const projection of projections) {
    it(`${projection.name}: random keys, their high-S counterparts, the golden vector and every refused input`,
      async () => {
        const signed = await Promise.all([0, 1, 2, 3].map((index) => signedByRandomKey(index)));
        const inputs: Array<{ input: EvmInput; expected: string }> = [
          ...signed.map(({ input, address }) => ({ input, expected: address })),
          ...signed.slice(0, 2).map(({ input, address }) => ({ input: highS(input), expected: address })),
          { input: GOLDEN, expected: GOLDEN_ADDRESS },
          ...refusedAround(signed[0]!.input).map((input) => ({ input, expected: ZERO })),
        ];
        const contract = await deployed(compileString(projection.source, projection.options as never));
        for (const { input, expected } of inputs) {
          // The oracle agrees with what the input should answer.
          expect(precompile(input), input.label).toBe(expected);
          const sent = await contract.call('bigEndian' in projection
            ? [input.h, input.v, beWord(input.r), beWord(input.s)] : native(input));
          expect(createVirtualMachineBch2026ForProvider(contract.provider).verify(sent as never), input.label).toBe(true);
          expect(await contract.who(), input.label).toBe(expected);
        }
      });
  }
});
