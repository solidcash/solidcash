import { AuthenticationProgramStateResourceLimits, type Transaction } from '@bitauth/libauth';
import type { NetworkProvider } from './network/index.js';
import type SignatureTemplate from './SignatureTemplate.js';
import { Contract } from './Contract.js';
import { AbiFunction } from '@solidcash/utils';
import { FunctionArgument } from './Argument.js';

export interface Utxo {
  txid: string;
  vout: number;
  satoshis: bigint;
  token?: TokenDetails;
}

export interface UnlockableUtxo extends Utxo {
  unlocker: Unlocker;
  options?: InputOptions;
}

export interface StandardUnlockableUtxo extends UnlockableUtxo {
  unlocker: StandardUnlocker;
}

export function isUnlockableUtxo(utxo: Utxo): utxo is UnlockableUtxo {
  return 'unlocker' in utxo;
}

export function isStandardUnlockableUtxo(utxo: UnlockableUtxo): utxo is StandardUnlockableUtxo {
  return isStandardUnlocker(utxo.unlocker);
}

export interface InputOptions {
  sequence?: number;
}

export interface GenerateUnlockingBytecodeOptions {
  transaction: Transaction;
  sourceOutputs: LibauthOutput[];
  inputIndex: number;
}

export interface Unlocker {
  generateLockingBytecode: () => Uint8Array;
  generateUnlockingBytecode: (options: GenerateUnlockingBytecodeOptions) => Uint8Array;
}

export interface ContractUnlocker extends Unlocker {
  contract: Contract;
  params: FunctionArgument[];
  abiFunction: AbiFunction;
  covenantUnlocker?: boolean;
}

export interface P2PKHUnlocker extends Unlocker {
  template: SignatureTemplate;
}

export type StandardUnlocker = ContractUnlocker | P2PKHUnlocker;

export type PlaceholderP2PKHUnlocker = Unlocker & { placeholder: true };


export function isContractUnlocker(unlocker: Unlocker): unlocker is ContractUnlocker {
  return 'contract' in unlocker;
}

export function isP2PKHUnlocker(unlocker: Unlocker): unlocker is P2PKHUnlocker {
  return 'template' in unlocker;
}

export function isStandardUnlocker(unlocker: Unlocker): unlocker is StandardUnlocker {
  return isContractUnlocker(unlocker) || isP2PKHUnlocker(unlocker);
}

export function isCovenantUnlocker(unlocker: Unlocker): boolean {
  return isContractUnlocker(unlocker) && !!unlocker.covenantUnlocker;
}

export function isPlaceholderUnlocker(unlocker: Unlocker): unlocker is PlaceholderP2PKHUnlocker {
  return 'placeholder' in unlocker;
}

export interface Recipient {
  to: string;
  amount: bigint;
  token?: TokenDetails;
}

export interface Output {
  to: string | Uint8Array;
  amount: bigint;
  token?: TokenDetails;
}

export interface BchChangeOutputOptions {
  to: string | Uint8Array;
  feeRate: number;
}

export interface TokenChangeOutputOptions {
  category: string;
  to: string | Uint8Array;
}

export interface TokenDetails {
  amount: bigint;
  category: string;
  nft?: {
    capability: 'none' | 'mutable' | 'minting';
    commitment: string;
  };
}

export interface NftObject {
  category: string;
  capability: 'none' | 'mutable' | 'minting';
  commitment: string;
}

export interface LibauthOutput {
  lockingBytecode: Uint8Array;
  valueSatoshis: bigint;
  token?: LibauthTokenDetails;
}

export interface LibauthTokenDetails {
  amount: bigint; // the amount cannot be a JSON numeric and is instead written as a decimal string in the JSON output
  category: Uint8Array;
  nft?: {
    capability: 'none' | 'mutable' | 'minting';
    commitment: Uint8Array;
  };
}

export enum SignatureAlgorithm {
  ECDSA = 0x00,
  SCHNORR = 0x01,
}

export enum HashType {
  SIGHASH_ALL = 0x01,
  SIGHASH_NONE = 0x02,
  SIGHASH_SINGLE = 0x03,
  SIGHASH_UTXOS = 0x20,
  SIGHASH_ANYONECANPAY = 0x80,
}

// Weird setup to allow both Enum parameters, as well as literal strings
// https://stackoverflow.com/questions/51433319/typescript-constructor-accept-string-for-enum
const literal = <L extends string>(l: L): L => l;
export const Network = {
  MAINNET: literal('mainnet'),
  TESTNET3: literal('testnet3'),
  TESTNET4: literal('testnet4'),
  CHIPNET: literal('chipnet'),
  MOCKNET: literal('mocknet'),
  REGTEST: literal('regtest'),
};

export type Network = (typeof Network)[keyof typeof Network];

export const VmTarget = {
  BCH_2023_05: literal('BCH_2023_05'),
  BCH_2025_05: literal('BCH_2025_05'),
  BCH_2026_05: literal('BCH_2026_05'),
  BCH_SPEC: literal('BCH_SPEC'),
};

export type VmTarget = (typeof VmTarget)[keyof typeof VmTarget];

/** An ethers-v5-style decoded log on a transaction receipt (`(await tx.wait()).events[i]`). */
export interface ReceiptEvent {
  event: string;            // event name, e.g. "PairCreated"
  eventSignature: string;   // full signature, e.g. "PairCreated(bytes,bytes,bytes)"
  // Decoded params keyed by name (ethers `.args.pair`); also carries non-enumerable numeric indices
  // (`.args[0]`) and a `toObject()` for array-like / typechain parity.
  args: Record<string, unknown>;
}

export interface TransactionDetails extends Transaction {
  txid: string;
  hex: string;
  // Wait until the transaction is confirmed (ethers `tx.wait`). Resolves once the provider knows the tx (mined);
  // for `confirmations > 1` it additionally waits that many blocks. Instant on MockNetworkProvider (mined on
  // send). Present on results from `.send()` / a deploy; optional so hand-built TransactionDetails stay valid.
  wait?: (confirmations?: number) => Promise<TransactionDetails>;
  // Decoded event logs emitted by this tx (ethers v5 `receipt.events` / `receipt.logs`), populated on a stateful
  // `.send()` result by decoding this tx's own event NFT outputs against the artifact's event ABI.
  events?: ReceiptEvent[];
  logs?: ReceiptEvent[];
}

export interface ContractOptions {
  provider: NetworkProvider,
  addressType?: AddressType,
  // User CREATE2-style salt: a dead push baked into the script for deterministic / counterfactual address
  // control (EVM `new C{salt}` / create2). Distinct from the category self-pin below.
  salt?: Uint8Array,
  // Category self-pin (stateful contracts): the contract's own state-NFT category (display byte order). When
  // set, the script prologue verifies the spent UTXO's category equals this baked value, so the address
  // commits to the category (address => genuine state). See docs/external-contract-calls.md.
  category?: Uint8Array,
}

export type AddressType = 'p2sh20' | 'p2sh32' | 'p2s';

export type VmResourceUsage = AuthenticationProgramStateResourceLimits['metrics'];
