import {
  cashAddressToLockingBytecode,
  decodeCashAddress,
  addressContentsToLockingBytecode,
  lockingBytecodeToCashAddress,
  binToHex,
  Transaction,
  generateSigningSerializationBch,
  utf8ToBin,
  hexToBin,
  LockingBytecodeType,
  encodeTransactionOutput,
  isHex,
  bigIntToCompactUint,
  NonFungibleTokenCapability,
  bigIntToVmNumber,
  encodeLockingBytecodeP2pkh,
} from '@bitauth/libauth';
import {
  hash160,
  hash256,
  sha256,
  Op,
  Script,
  scriptToBytecode,
  encodeNullDataScript,
} from '@solidcash/utils';
import {
  Utxo,
  Output,
  Network,
  LibauthOutput,
  TokenDetails,
  AddressType,
  UnlockableUtxo,
  LibauthTokenDetails,
} from './interfaces.js';
import { VERSION_SIZE, LOCKTIME_SIZE } from './constants.js';
import {
  OutputSatoshisTooSmallError,
  OutputTokenAmountTooSmallError,
  TokensToNonTokenAddressError,
  UndefinedInputError,
  OutputBchChangeLockedError,
  OutputTokenChangeLockedError,
} from './Errors.js';

// ////////// PARAMETER VALIDATION ////////////////////////////////////////////
export function validateChangeLocks(changeLocks: Record<string, boolean>, category?: string): void {
  if (changeLocks.BCH) {
    throw new OutputBchChangeLockedError();
  }

  if (category && changeLocks[category]) {
    throw new OutputTokenChangeLockedError(category);
  }
}

export function validateInput(utxo: Utxo): void {
  if (!utxo) {
    throw new UndefinedInputError();
  }

  if (typeof utxo.txid !== 'string' || !isHex(utxo.txid) || utxo.txid.length !== 64) {
    throw new Error(`Invalid input txid: expected a 64-character hex string, got '${utxo.txid}'`);
  }

  if (!Number.isInteger(utxo.vout) || utxo.vout < 0) {
    throw new Error(`Invalid input vout: expected a non-negative integer, got ${utxo.vout}`);
  }

  if (typeof utxo.satoshis !== 'bigint' || utxo.satoshis < 0n) {
    throw new Error(`Invalid input satoshis: expected a non-negative bigint, got ${utxo.satoshis}`);
  }

  if (utxo.token) {
    if (typeof utxo.token.category !== 'string' || !isHex(utxo.token.category) || utxo.token.category.length !== 64) {
      throw new Error(`Invalid input token category: expected a 64-character hex string, got '${utxo.token.category}'`);
    }

    if (utxo.token.amount < 0n) {
      throw new Error(`Invalid input token amount: expected a non-negative bigint, got ${utxo.token.amount}`);
    }

    if (utxo.token.nft && (typeof utxo.token.nft.commitment !== 'string' || !isHex(utxo.token.nft.commitment))) {
      throw new Error(`Invalid input NFT commitment: expected a hex string, got '${utxo.token.nft.commitment}'`);
    }

    if (utxo.token.nft) {
      const validCapabilities: string[] = ['none', 'mutable', 'minting'];
      if (!validCapabilities.includes(utxo.token.nft.capability)) {
        throw new Error(`Invalid input NFT capability: expected one of ${validCapabilities.join(', ')}, got '${utxo.token.nft.capability}'`);
      }
    }
  }
}

export function validateOutput(output: Output, enforceDust = true): void {
  // Universal validations (apply to both string addresses and bytecode outputs)
  if (output.amount < 0n) {
    throw new OutputSatoshisTooSmallError(output.amount, 0n);
  }

  if (output.token && output.token.amount < 0n) {
    throw new OutputTokenAmountTooSmallError(output.token.amount);
  }

  // Dust check for all non-OP_RETURN outputs (both string addresses and raw bytecode)
  const isOpReturn = output.to instanceof Uint8Array && output.to.length > 0 && output.to[0] === 0x6a;
  if (enforceDust && !isOpReturn) {
    const minimumAmount = calculateDust(output);
    if (output.amount < minimumAmount) {
      throw new OutputSatoshisTooSmallError(output.amount, BigInt(minimumAmount));
    }
  }

  // String-address-only validations (token-address check)
  if (typeof output.to === 'string') {
    if (output.token) {
      if (!isTokenAddress(output.to)) {
        throw new TokensToNonTokenAddressError(output.to);
      }
    }
  }
}

export function calculateDust(output: Output): number {
  const outputSize = getOutputSize(output);
  // Formula used to calculate the minimum allowed output
  const dustAmount = 444 + outputSize * 3;
  return dustAmount;
}

export function getOutputSize(output: Output): number {
  const encodedOutput = encodeOutput(output);
  return encodedOutput.byteLength;
}

export function encodeOutput(output: Output): Uint8Array {
  return encodeTransactionOutput(solidCashOutputToLibauthOutput(output));
}

export function solidCashOutputToLibauthOutput(output: Output): LibauthOutput {
  if (output.token) {
    if (typeof output.token.category !== 'string' || !isHex(output.token.category)) {
      throw new Error(`Provided token category ${output.token?.category} is not a hex string`);
    }

    if (output.token.nft && (typeof output.token.nft.commitment !== 'string' || !isHex(output.token.nft.commitment))) {
      throw new Error(`Provided token commitment ${output.token.nft?.commitment} is not a hex string`);
    }
  }

  return {
    lockingBytecode: typeof output.to === 'string' ? addressToLockScript(output.to) : output.to,
    valueSatoshis: output.amount,
    token: output.token && {
      ...output.token,
      category: hexToBin(output.token.category),
      nft: output.token.nft && {
        ...output.token.nft,
        commitment: hexToBin(output.token.nft.commitment),
      },
    },
  };
}

export function libauthOutputToSolidCashOutput(output: LibauthOutput): Output {
  return {
    to: output.lockingBytecode,
    amount: output.valueSatoshis,
    token: output.token && libauthTokenDetailsToSolidCashTokenDetails(output.token),
  };
}

export function libauthTokenDetailsToSolidCashTokenDetails(token: LibauthTokenDetails): TokenDetails {
  return {
    ...token,
    category: binToHex(token.category),
    nft: token.nft && {
      ...token.nft,
      commitment: binToHex(token.nft.commitment),
    },
  };
}

export function generateLibauthSourceOutputs(inputs: UnlockableUtxo[]): LibauthOutput[] {
  const sourceOutputs = inputs.map((input) => {
    const sourceOutput = {
      amount: input.satoshis,
      to: input.unlocker.generateLockingBytecode(),
      token: input.token,
    };

    return solidCashOutputToLibauthOutput(sourceOutput);
  });
  return sourceOutputs;
}

function isTokenAddress(address: string): boolean {
  const result = decodeCashAddress(address);
  if (typeof result === 'string') throw new Error(result);
  const supportsTokens = (result.type === 'p2pkhWithTokens' || result.type === 'p2shWithTokens');
  return supportsTokens;
}

// ////////// SIZE CALCULATIONS ///////////////////////////////////////////////
export function getInputSize(inputScript: Uint8Array): number {
  const scriptSize = inputScript.byteLength;
  const varIntSize = scriptSize > 252 ? 3 : 1;
  return 32 + 4 + varIntSize + scriptSize + 4;
}

export function getTxSizeWithoutInputs(outputs: Output[]): number {
  // Transaction format:
  // Version (4 Bytes)
  // TxIn Count (1 ~ 9B)
  // For each TxIn:
  //   Outpoint (36B)
  //   Script Length (1 ~ 9B)
  //   ScriptSig(?)
  //   Sequence (4B)
  // TxOut Count (1 ~ 9B)
  // For each TxOut:
  //   Value (8B)
  //   Script Length(1 ~ 9B)*
  //   Script (?)*
  // LockTime (4B)

  let size = VERSION_SIZE + LOCKTIME_SIZE;
  size += outputs.reduce((acc, output) => acc + getOutputSize(output), 0);
  // Add tx-out count (accounting for a potential change output)
  size += bigIntToCompactUint(BigInt(outputs.length + 1)).byteLength;

  return size;
}

// ////////// BUILD OBJECTS ///////////////////////////////////////////////////
export function createUnlockingBytecode(
  addressType: AddressType,
  contractBytecode: Uint8Array,
  encodedArgs: Uint8Array[],
  selector?: Uint8Array,
): Uint8Array {
  const unlockScript = [...encodedArgs].reverse();
  if (selector !== undefined) unlockScript.unshift(selector);

  // P2S inputs do not need to provide the redeem script
  if (addressType === 'p2s') return scriptToBytecode(unlockScript);

  // Create input script and compile it to bytecode
  const inputScript = [...unlockScript, contractBytecode];
  return scriptToBytecode(inputScript);
}

export function createOpReturnOutput(
  opReturnData: string[],
): Output {
  const script = [
    Op.OP_RETURN,
    ...opReturnData.map((output: string) => toBin(output)),
  ];

  return { to: encodeNullDataScript(script), amount: 0n };
}

function toBin(output: string): Uint8Array {
  const data = output.replace(/^0x/, '');
  const encode = data === output ? utf8ToBin : hexToBin;
  return encode(data);
}

export function createSighashPreimage(
  transaction: Transaction,
  sourceOutputs: LibauthOutput[],
  inputIndex: number,
  coveredBytecode: Uint8Array,
  hashtype: number,
): Uint8Array {
  const context = { inputIndex, sourceOutputs, transaction };
  const signingSerializationType = new Uint8Array([hashtype]);

  const sighashPreimage = generateSigningSerializationBch(context, { coveredBytecode, signingSerializationType });

  return sighashPreimage;
}

export function toRegExp(reasons: string[]): RegExp {
  return new RegExp(reasons.join('|').replace(/\(/g, '\\(').replace(/\)/g, '\\)'));
}

export function scriptToAddress(
  script: Script, network: string, addressType: AddressType, tokenSupport: boolean,
): string {
  if (addressType === 'p2s') return binToHex(scriptToBytecode(script));

  const bytecode = scriptToLockingBytecode(script, addressType);
  const prefix = getNetworkPrefix(network);

  const result = lockingBytecodeToCashAddress({ bytecode, prefix, tokenSupport });
  if (typeof result === 'string') throw new Error(result);

  return result.address;
}

export function scriptToLockingBytecode(script: Script, addressType: AddressType): Uint8Array {
  if (addressType === 'p2s') return scriptToBytecode(script);

  const scriptBytecode = scriptToBytecode(script);
  const scriptHash = (addressType === 'p2sh20') ? hash160(scriptBytecode) : hash256(scriptBytecode);
  const addressContents = { payload: scriptHash, type: LockingBytecodeType[addressType] };
  const lockingBytecode = addressContentsToLockingBytecode(addressContents);
  return lockingBytecode;
}

export function publicKeyToP2PKHLockingBytecode(publicKey: Uint8Array): Uint8Array {
  return encodeLockingBytecodeP2pkh(hash160(publicKey));
}

export function utxoComparator(a: Utxo, b: Utxo): number {
  if (a.satoshis > b.satoshis) return 1;
  if (a.satoshis < b.satoshis) return -1;
  return 0;
}

export function utxoTokenComparator(a: Utxo, b: Utxo): number {
  if (!a.token || !b.token) throw new Error('UTXO does not have token data');
  if (!a.token.category !== !b.token.category) throw new Error('UTXO token categories do not match');
  if (a.token.amount > b.token.amount) return 1;
  if (a.token.amount < b.token.amount) return -1;
  return 0;
}

/**
* Helper function to convert an address to a locking script
*
* @param address   Address to convert to locking script
*
* @returns a locking script corresponding to the passed address
*/
export function addressToLockScript(address: string): Uint8Array {
  const result = cashAddressToLockingBytecode(address);
  if (typeof result === 'string') throw new Error(result);

  return result.bytecode;
}

export function getNetworkPrefix(network: string): 'bitcoincash' | 'bchtest' | 'bchreg' {
  switch (network) {
    case Network.MAINNET:
      return 'bitcoincash';
    case Network.TESTNET4:
    case Network.TESTNET3:
    case Network.CHIPNET:
    case Network.MOCKNET:
      return 'bchtest';
    case Network.REGTEST:
      return 'bchreg';
    default:
      return 'bitcoincash';
  }
}

const randomInt = (): bigint => BigInt(Math.floor(Math.random() * 10000));

// Outpoint uniqueness is a correctness property of a fixture, not a statistical one. A purely random txid
// seeded from Math.random() * 10000 with 10 vouts spans only 100,000 outpoints, so fixtures that co-spend many
// inputs collided by birthday and surfaced as "Duplicate input detected" - indistinguishable from a real
// regression during integration. Mixing a monotonic counter into the seed makes every outpoint unique within a
// process while keeping the value unpredictable across runs.
let outpointCounter = 0n;
const uniqueTxid = (): string => {
  outpointCounter += 1n;
  const seed = new Uint8Array(16);
  seed.set(bigIntToVmNumber(outpointCounter), 0);
  seed.set(bigIntToVmNumber(randomInt()), 8);
  return binToHex(sha256(seed));
};

export const randomUtxo = (defaults?: Partial<Utxo>): Utxo => ({
  ...{
    txid: uniqueTxid(),
    vout: Math.floor(Math.random() * 10),
    satoshis: 100_000n + randomInt(),
  },
  ...defaults,
});

export const randomToken = (defaults?: Partial<TokenDetails>): TokenDetails => ({
  ...{
    category: binToHex(sha256(bigIntToVmNumber(randomInt()))),
    amount: 100_000n + randomInt(),
  },
  ...defaults,
});

export const randomNFT = (defaults?: Partial<TokenDetails>): TokenDetails => ({
  ...{
    category: binToHex(sha256(bigIntToVmNumber(randomInt()))),
    amount: 0n,
    nft: {
      commitment: binToHex(sha256(bigIntToVmNumber(randomInt()))).slice(0, 8),
      capability: NonFungibleTokenCapability.none,
    },
  },
  ...defaults,
});

// https://stackoverflow.com/questions/40929260/find-last-index-of-element-inside-array-by-certain-condition
export function findLastIndex<T>(array: Array<T>, predicate: (value: T, index: number, obj: T[]) => boolean): number {
  let l = array.length;
  while (l--) {
    if (predicate(array[l], l, array)) return l;
  }
  return -1;
}

// JSON.stringify version that can serialize otherwise unsupported types (bigint and Uint8Array)
export const extendedStringify = (obj: any, spaces?: number): string => JSON.stringify(
  obj,
  (_, v) => {
    if (typeof v === 'bigint') {
      return `${v.toString()}`;
    }
    if (v instanceof Uint8Array) {
      return `${binToHex(v)}`;
    }
    return v;
  },
  spaces,
);

export const zip = <T, U>(a: readonly T[], b: readonly U[]): [T, U][] => (
  Array.from(Array(Math.max(b.length, a.length)), (_, i) => [a[i], b[i]])
);

export const isFungibleTokenUtxo = (utxo: Utxo): boolean => (
  utxo.token !== undefined && utxo.token.amount > 0n && utxo.token.nft === undefined
);

export const isNonTokenUtxo = (utxo: Utxo): boolean => utxo.token === undefined;

export const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * ethers-v5 BigNumber-compatible wrapper for bigint state/view returns.
 * MistSwap kashipair uses `.sub()/.lt()/.gt()` on mapping getters (userBorrowPart, etc.).
 */
export interface EthersBigNumberish {
  _isBigNumber: true;
  _value: bigint;
  _hex: string;
  add(o: bigint | number | string | EthersBigNumberish): EthersBigNumberish;
  sub(o: bigint | number | string | EthersBigNumberish): EthersBigNumberish;
  mul(o: bigint | number | string | EthersBigNumberish): EthersBigNumberish;
  div(o: bigint | number | string | EthersBigNumberish): EthersBigNumberish;
  mod(o: bigint | number | string | EthersBigNumberish): EthersBigNumberish;
  abs(): EthersBigNumberish;
  eq(o: bigint | number | string | EthersBigNumberish): boolean;
  lt(o: bigint | number | string | EthersBigNumberish): boolean;
  lte(o: bigint | number | string | EthersBigNumberish): boolean;
  gt(o: bigint | number | string | EthersBigNumberish): boolean;
  gte(o: bigint | number | string | EthersBigNumberish): boolean;
  isZero(): boolean;
  toBigInt(): bigint;
  toNumber(): number;
  toString(): string;
  toHexString(): string;
  valueOf(): bigint;
}

function toBig(o: bigint | number | string | EthersBigNumberish): bigint {
  if (typeof o === 'bigint') return o;
  if (typeof o === 'number') return BigInt(o);
  if (typeof o === 'string') return BigInt(o);
  if (o && typeof o === 'object' && typeof (o as EthersBigNumberish)._value === 'bigint') {
    return (o as EthersBigNumberish)._value;
  }
  return BigInt(String(o));
}

export function wrapEthersBN(value: bigint): EthersBigNumberish {
  const self: EthersBigNumberish = {
    _isBigNumber: true,
    _value: value,
    get _hex(): string {
      const h = value < 0n ? (-value).toString(16) : value.toString(16);
      return value < 0n ? `-0x${h}` : `0x${h}`;
    },
    add: (o) => wrapEthersBN(value + toBig(o)),
    sub: (o) => wrapEthersBN(value - toBig(o)),
    mul: (o) => wrapEthersBN(value * toBig(o)),
    div: (o) => wrapEthersBN(value / toBig(o)),
    mod: (o) => wrapEthersBN(value % toBig(o)),
    abs: () => wrapEthersBN(value < 0n ? -value : value),
    eq: (o) => value === toBig(o),
    lt: (o) => value < toBig(o),
    lte: (o) => value <= toBig(o),
    gt: (o) => value > toBig(o),
    gte: (o) => value >= toBig(o),
    isZero: () => value === 0n,
    toBigInt: () => value,
    toNumber: () => Number(value),
    toString: () => value.toString(),
    toHexString: () => self._hex,
    valueOf: () => value,
  };
  return self;
}

/** Wrap bigint leaves so ethers-v5-style method chains work on view/mapping returns. */
export function wrapNumericForEthers(value: unknown): unknown {
  if (typeof value === 'bigint') return wrapEthersBN(value);
  if (Array.isArray(value)) return value.map(wrapNumericForEthers);
  if (value && typeof value === 'object' && !(value instanceof Uint8Array)) {
    const obj = value as Record<string, unknown>;
    // Struct-like: wrap numeric fields in place for .amount / .base access
    if (!('_isBigNumber' in obj)) {
      const out: Record<string, unknown> = { ...obj };
      for (const [k, v] of Object.entries(out)) {
        if (typeof v === 'bigint') out[k] = wrapEthersBN(v);
      }
      return out;
    }
  }
  return value;
}
