import {
  lockingBytecodeToCashAddress,
  hexToBin,
  Transaction,
  binToHex,
  encodeTransaction,
} from '@bitauth/libauth';
import { createTxVerifier } from '@mem-cash/validation';
import { buildInitialStateCommitments, type StateLayout } from '@solidcash/utils';
import { Output, Network, Utxo } from '../src/interfaces.js';
import {
  Contract, TransactionBuilder, HDSigner, signersFromMnemonic,
} from '../src/index.js';
import { MockNetworkProvider, RegtestNetworkProvider } from '../src/index.js';
import { getDataNftAddress, getTokenContainerAddress } from '../src/stateful/covenant-helpers.js';
import { network as defaultNetwork } from './fixture/vars.js';
import { generateLibauthSourceOutputs, getNetworkPrefix, libauthOutputToSolidCashOutput } from '../src/utils.js';
import { utxoComparator } from '../src/utils.js';

type TestProvider = MockNetworkProvider | RegtestNetworkProvider;

/**
 * Genesis a stateful contract's master (minting) + data (mutable) NFTs under one real category.
 * Works on mock and regtest: the category is the genesis txid, and addresses derive from it (no
 * synthetic category assumptions).
 */
export async function genesisStatefulMaster(
  provider: TestProvider,
  contract: Contract,
  stateLayout: StateLayout,
  stateValues: Record<string, bigint>,
): Promise<{ categoryId: string; masterUtxo: Utxo; dataNftUtxo: Utxo; dataNftAddress: string }> {
  const commitments = buildInitialStateCommitments(stateLayout, stateValues);
  const { categoryId, utxos } = await provider.addTokenUtxosDynamic((cat) => [
    { address: contract.tokenAddress, satoshis: 10000n, token: { nft: { capability: 'minting', commitment: '' } } },
    {
      address: getDataNftAddress(contract, cat), satoshis: 10000n,
      token: { nft: { capability: 'mutable', commitment: commitments[0] } },
    },
  ]);
  return {
    categoryId, masterUtxo: utxos[0], dataNftUtxo: utxos[1],
    dataNftAddress: getDataNftAddress(contract, categoryId),
  };
}

/** Genesis an FT token and fund the contract's container address for that category. */
export async function genesisFtContainer(
  provider: TestProvider, contract: Contract, masterCategoryId: string, amounts: bigint[],
): Promise<{ category: string; address: string; utxos: Utxo[] }> {
  const { categoryId, utxos } = await provider.addTokenUtxosDynamic((cat) => {
    const address = getTokenContainerAddress(contract, masterCategoryId, cat);
    return amounts.map((amount) => ({ address, satoshis: 1200n, token: { amount } }));
  });
  return { category: categoryId, address: getTokenContainerAddress(contract, masterCategoryId, categoryId), utxos };
}

/** Genesis NFTs and fund the contract's container address for that category. */
export async function genesisNftContainer(
  provider: TestProvider, contract: Contract, masterCategoryId: string,
  commitments: string[], capability: 'none' | 'mutable' | 'minting' = 'none',
): Promise<{ category: string; address: string; utxos: Utxo[] }> {
  const { categoryId, utxos } = await provider.addTokenUtxosDynamic((cat) => {
    const address = getTokenContainerAddress(contract, masterCategoryId, cat);
    return commitments.map((commitment) => ({
      address, satoshis: 1200n, token: { amount: 0n, nft: { capability, commitment } },
    }));
  });
  return { category: categoryId, address: getTokenContainerAddress(contract, masterCategoryId, categoryId), utxos };
}

// Unified mem-cash verifier for covenant build() output. skipFeePolicy skips the min-relay/absurd-fee
// POLICY only (the fee funder is added at send()); scripts, CashToken consensus, value balance, and
// the token-aware dust limit (fixed dust relay fee) all still run. createTxVerifier is sync in
// mem-cash 0.0.6, so verifyTransaction stays synchronous.
const txVerifier = createTxVerifier({ vmVersion: 'BCH_2026_05', standard: true, skipFeePolicy: true });
const VERIFY_CHAIN_STATE = { height: 133700, medianTimePast: 1700000000 };

export function getTxOutputs(tx: Transaction, network: Network = defaultNetwork): Output[] {
  return tx.outputs.map((o) => {
    const OP_RETURN = '6a';
    const scriptHex = binToHex(o.lockingBytecode);

    if (scriptHex.startsWith(OP_RETURN)) {
      return { to: hexToBin(scriptHex), amount: 0n };
    }

    const prefix = getNetworkPrefix(network);
    const solidcashOutput = libauthOutputToSolidCashOutput(o);
    const hasTokens = Boolean(solidcashOutput.token);
    const result = lockingBytecodeToCashAddress({ bytecode: hexToBin(scriptHex), prefix, tokenSupport: hasTokens });
    // Fall back to raw hex for non-standard locking bytecodes (e.g. raw bytes20)
    const address = typeof result === 'string' ? scriptHex : result.address;

    return {
      to: address,
      amount: o.valueSatoshis,
      token: solidcashOutput.token,
    };
  });
}

/**
 * Verify a covenant build() transaction with the mem-cash verifier: scripts + CashToken consensus,
 * value balance, and the token-aware dust limit. Fee policy (min-relay/absurd-fee) is skipped since
 * this is the pre-fee build output (the fee funder is added at send()). Works with both standard and
 * custom unlockers (data NFTs, containers, etc.). Throws if verification fails.
 */
export function verifyTransaction(builder: TransactionBuilder): void {
  const rawHex = binToHex(encodeTransaction(builder.buildLibauthTransaction()));
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const result = txVerifier.verify(rawHex, sourceOutputs, VERIFY_CHAIN_STATE);
  if (!result.success) {
    const detail = result.debugMessage ? `${result.error}: ${result.debugMessage}` : result.error;
    throw new Error(`Transaction verification failed [code ${result.code}]: ${detail}`);
  }
}

export function getLargestUtxo(utxos: Utxo[]): Utxo {
  return [...utxos].sort(utxoComparator).reverse()[0];
}

/**
 * Create a fee funder input for manual TransactionBuilder tests.
 * Registers a P2SH32 OP_TRUE UTXO with the mocknet provider and returns
 * the UTXO + unlocker ready to be passed to builder.addInput().
 */
export async function createFeeFunder(
  provider: { addUtxo: (lbc: string, utxo: Utxo) => void | Promise<Utxo> },
  satoshis: bigint = 10000n,
): Promise<{ utxo: Utxo; unlocker: any }> {
  const DUMMY_LBC = new Uint8Array([
    0xaa, 0x20,
    0x95, 0x3c, 0xcf, 0xa5, 0x96, 0xa6, 0xc6, 0xd3, 0x9e, 0x59, 0x80, 0x19, 0x45, 0x39, 0x12, 0x4f,
    0xdc, 0xff, 0x11, 0x6a, 0x57, 0x14, 0x55, 0xa2, 0x12, 0xba, 0xed, 0x81, 0x1f, 0x58, 0x5e, 0xe0,
    0x87,
  ]);
  const DUMMY_UNLOCK = new Uint8Array([0x01, 0x51]);

  const txid = '00'.repeat(31) + (0xfe).toString(16);
  const utxo: Utxo = { txid, vout: 0, satoshis };
  await provider.addUtxo(binToHex(DUMMY_LBC), utxo);

  return {
    utxo,
    unlocker: {
      generateLockingBytecode: () => DUMMY_LBC,
      generateUnlockingBytecode: () => DUMMY_UNLOCK,
    },
  };
}

export function gatherUtxos(
  utxos: Utxo[],
  options?: { amount?: bigint, fee?: bigint },
): { utxos: Utxo[], total: bigint, changeAmount: bigint } {
  const targetUtxos: Utxo[] = [];
  let total = 0n;

  // Fee must cover 1 sat/byte minimum relay fee. Default 5000 sats covers
  // transactions up to ~5 KB, sufficient for most non-stateful contract tests.
  const { amount = 0n, fee = 5000n } = options ?? {};

  const minChangeAmount = 1000n;

  for (const utxo of utxos) {
    if (total - fee - minChangeAmount > amount) break;
    total += utxo.satoshis;
    targetUtxos.push(utxo);
  }

  const changeAmount = total - amount - fee;

  if (changeAmount < minChangeAmount) {
    throw new Error('Not enough funds to cover transaction');
  }

  return {
    utxos: targetUtxos,
    total,
    changeAmount,
  };
}

// Singleton regtest provider - regtest tests must never run concurrently
// because they share a single BCHN wallet and Fulcrum WebSocket connection.
let regtestSingleton: RegtestNetworkProvider | undefined;

/**
 * Create the appropriate test network provider based on environment variables.
 *
 * - TESTS_USE_REGTEST=true  -> RegtestNetworkProvider (real BCHN + Fulcrum)
 * - (default)               -> MockNetworkProvider (in-memory)
 *
 * For regtest mode, returns a shared singleton to avoid exhausting wallet
 * UTXOs and Fulcrum connections across tests. MockNetworkProvider creates
 * a fresh instance each time so tests get isolated UTXO sets.
 */
export function createTestProvider(): MockNetworkProvider | RegtestNetworkProvider {
  if (process.env.TESTS_USE_REGTEST) {
    if (!regtestSingleton) {
      regtestSingleton = new RegtestNetworkProvider({
        rpcUrl: process.env.REGTEST_RPC_URL ?? 'http://localhost:18443',
        rpcUser: process.env.REGTEST_RPC_USER ?? 'user',
        rpcPassword: process.env.REGTEST_RPC_PASSWORD ?? 'password',
        electrumHost: process.env.REGTEST_ELECTRUM_HOST ?? 'localhost',
        electrumPort: Number(process.env.REGTEST_ELECTRUM_PORT ?? '50003'),
      });
    }
    return regtestSingleton;
  }

  return new MockNetworkProvider();
}

// The default hardhat dev mnemonic (a valid BIP-39 phrase). Shared with MockNetworkProvider.getSigners.
export const DEFAULT_TEST_MNEMONIC = MockNetworkProvider.DEFAULT_MNEMONIC;

let fundingNonce = 0x1000;
function nextFundingTxid(): string {
  return (fundingNonce++).toString(16).padStart(64, '0');
}

async function fundAddress(
  provider: TestProvider, address: string, utxoCount: number, satoshis: bigint,
): Promise<void> {
  for (let i = 0; i < utxoCount; i++) {
    await provider.addUtxo(address, { txid: nextFundingTxid(), vout: 0, satoshis });
  }
}

/**
 * The hardhat `ethers.getSigners()` analogue: `count` HD signers derived from DEFAULT_TEST_MNEMONIC
 * (m/44'/145'/0'/0/i), each pre-funded with a genesis-valid UTXO on a shared provider. Destructure the famous
 * way: `const [owner, addr1, addr2] = await getSigners();`. Each is an HDSigner - a drop-in ContractFactory
 * runner. `fundingUtxos > 1` gives every account multiple funding UTXOs (for accounts that deploy repeatedly).
 */
export async function getSigners(
  count = 20,
  opts: { provider?: TestProvider; satoshis?: bigint; mnemonic?: string; fundingUtxos?: number } = {},
): Promise<HDSigner[]> {
  const provider = opts.provider ?? createTestProvider();
  if (provider instanceof MockNetworkProvider) return provider.getSigners(count, opts);
  const signers = signersFromMnemonic(opts.mnemonic ?? DEFAULT_TEST_MNEMONIC, provider, { count });
  for (const signer of signers) {
    await fundAddress(provider, signer.getAddress(), opts.fundingUtxos ?? 1, opts.satoshis ?? 1_000_000n);
  }
  return signers;
}

/** A single pre-funded HD signer at `index` (hardhat `ethers.getSigner`). */
export async function getSigner(
  index = 0,
  opts: { provider?: TestProvider; satoshis?: bigint } = {},
): Promise<HDSigner> {
  const provider = opts.provider ?? createTestProvider();
  if (provider instanceof MockNetworkProvider) return provider.getSigner(index, opts);
  const [signer] = signersFromMnemonic(DEFAULT_TEST_MNEMONIC, provider, { initialIndex: index, count: 1 });
  await fundAddress(provider, signer.getAddress(), 1, opts.satoshis ?? 1_000_000n);
  return signer;
}

/**
 * A single pre-funded signer (account 0) with `count` funding UTXOs - the common shortcut for a
 * ContractFactory runner: `getContractFactory(artifact, await fundedSigner()).deploy(...)`. Each funding UTXO
 * backs one `factory.deploy()` (its txid becomes the token category); pass `count > 1` to deploy repeatedly.
 */
export async function fundedSigner(count = 1, satoshis = 1_000_000n): Promise<HDSigner> {
  const provider = createTestProvider();
  if (provider instanceof MockNetworkProvider) {
    return (await provider.getSigners(1, { fundingUtxos: count, satoshis }))[0];
  }
  const [signer] = signersFromMnemonic(DEFAULT_TEST_MNEMONIC, provider, { count: 1 });
  await fundAddress(provider, signer.getAddress(), count, satoshis);
  return signer;
}

export interface StatefulUtxoSetup {
  categoryId: string;
  masterUtxo: Utxo;
  dataNftUtxos: Utxo[];
  dataNftAddresses: string[];
  extraUtxos?: Utxo[];
}

/**
 * Set up the master + data NFT UTXOs for a stateful contract.
 *
 * On mocknet: creates synthetic UTXOs with a random categoryId.
 * On regtest: creates a real token genesis transaction, returning the real categoryId.
 *
 * @param provider - The test provider (mock or regtest)
 * @param contract - The contract instance (optionally salted)
 * @param stateLayout - The state layout from the artifact
 * @param initialState - Initial state values (e.g., `{ counter: 0n }`)
 * @param opts - Optional overrides for satoshi amounts
 */
export async function setupStatefulUtxos(
  provider: MockNetworkProvider | RegtestNetworkProvider,
  contract: Contract,
  stateLayout: StateLayout,
  initialState: Record<string, any>,
  opts?: {
    masterSatoshis?: bigint; dataNftSatoshis?: bigint; saltContract?: boolean; categoryOverride?: string;
    // Extra token UTXOs to genesis under the SAME category (e.g. a blockhash (n->hash) oracle NFT branded to
    // the contract). Receives the resolved categoryId; the seeded UTXOs are returned as `extraUtxos`.
    extraOutputs?: (categoryId: string) => Array<{ address: string; satoshis: bigint; token: any }>;
  },
): Promise<StatefulUtxoSetup> {
  const masterSatoshis = opts?.masterSatoshis ?? 10000n;
  const dataNftSatoshis = opts?.dataNftSatoshis ?? 10000n;
  const commitments = buildInitialStateCommitments(stateLayout, initialState);
  const dataNftCount = commitments.length;

  // Chosen-category genesis (mock only): seed master+data at txid=categoryId via addUtxo. Needed when a
  // category must be known BEFORE building a dependent contract - e.g. a branded library whose __brand is the
  // owning consumer's category, which the consumer also links to (otherwise a deploy-time circular dependency).
  if (opts?.categoryOverride) {
    const categoryId = opts.categoryOverride;
    const pinnedContract = contract.category ? contract : contract.withCategory(hexToBin(categoryId));
    const masterUtxo = await (provider as any).addUtxo(pinnedContract.tokenAddress, {
      txid: categoryId, vout: 0, satoshis: masterSatoshis,
      token: { category: categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    });
    const dataNftUtxos: Utxo[] = [];
    const dataNftAddresses: string[] = [];
    for (let i = 0; i < commitments.length; i++) {
      const addr = getDataNftAddress(pinnedContract, categoryId);
      dataNftAddresses.push(addr);
      dataNftUtxos.push(await (provider as any).addUtxo(addr, {
        txid: categoryId, vout: i + 1, satoshis: dataNftSatoshis,
        token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: commitments[i] } },
      }));
    }
    return { categoryId, masterUtxo, dataNftUtxos, dataNftAddresses };
  }

  // Use addTokenUtxosDynamic for proper genesis on both providers.
  // The callback receives the categoryId and returns addresses derived from it.
  const result = await (provider as any).addTokenUtxosDynamic((categoryId: string) => {
    // Stateful contracts self-pin to their category (see docs/external-contract-calls.md), so the master
    // must be seeded at the category-pinned address (matching StatefulContract.withCategory).
    const pinnedContract = contract.category ? contract : contract.withCategory(hexToBin(categoryId));
    const masterAddress = pinnedContract.tokenAddress;

    return [
      { address: masterAddress, satoshis: masterSatoshis,
        token: { amount: 0n, nft: { capability: 'minting' as const, commitment: '' } } },
      ...commitments.map((_commitment, i) => ({
        address: getDataNftAddress(pinnedContract, categoryId),
        satoshis: dataNftSatoshis,
        token: { amount: 0n, nft: { capability: 'mutable' as const, commitment: commitments[i] } },
      })),
      ...(opts?.extraOutputs ? opts.extraOutputs(categoryId) : []),
    ];
  });

  const categoryId = result.categoryId;
  const pinnedContract = contract.category ? contract : contract.withCategory(hexToBin(categoryId));
  const dataNftAddresses: string[] = [];
  for (let i = 0; i < dataNftCount; i++) {
    dataNftAddresses.push(getDataNftAddress(pinnedContract, categoryId));
  }

  return {
    categoryId,
    masterUtxo: result.utxos[0],
    dataNftUtxos: result.utxos.slice(1, 1 + dataNftCount),
    dataNftAddresses,
    extraUtxos: result.utxos.slice(1 + dataNftCount),
  };
}
