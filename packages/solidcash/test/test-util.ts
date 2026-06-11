import {
  lockingBytecodeToCashAddress,
  hexToBin,
  Transaction,
  binToHex,
  createVirtualMachineBch2026,
} from '@bitauth/libauth';
import { buildInitialStateCommitments, type StateLayout } from '@solidcash/utils';
import { Output, Network, Utxo } from '../src/interfaces.js';
import { Contract, TransactionBuilder } from '../src/index.js';
import { MockNetworkProvider, RegtestNetworkProvider } from '../src/index.js';
import { getDataNftAddress } from '../src/stateful/covenant-helpers.js';
import { network as defaultNetwork } from './fixture/vars.js';
import { generateLibauthSourceOutputs, getNetworkPrefix, libauthOutputToSolidCashOutput } from '../src/utils.js';
import { utxoComparator } from '../src/utils.js';

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
 * Validate all scripts in a transaction using the BCH VM.
 * Works with both standard and custom unlockers (data NFTs, containers, etc.).
 * Throws if any input script fails validation.
 */
export function verifyTransaction(builder: TransactionBuilder): void {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026();
  const result = vm.verify({ sourceOutputs, transaction });
  if (typeof result === 'string') {
    // Find the failing input and print debug info
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex++) {
      const singleResult = (vm as any).debug?.({ sourceOutputs, transaction, inputIndex });
      if (singleResult && Array.isArray(singleResult)) {
        const failStep = singleResult.findIndex((t: any) => t.error);
        if (failStep >= 0) {
          const start = Math.max(0, failStep - 10);
          const lines: string[] = [`Input[${inputIndex}] fails at step ${failStep}/${singleResult.length}:`];
          for (let i = start; i <= Math.min(failStep + 1, singleResult.length - 1); i++) {
            const t = singleResult[i];
            const stack = (t.stack || []).map((s: Uint8Array) => {
              const hex = binToHex(s);
              return hex === '' ? '(empty)' : hex.length > 16 ? hex.slice(0, 8) + '..' + `(${hex.length / 2}B)` : hex;
            });
            const ip = t.ip;
            const instrs = t.instructions;
            let opName = `ip=${ip}`;
            if (instrs && ip > 0) {
              const prev = instrs[ip - 1];
              if (prev?.opcode !== undefined) {
                opName = `op=${prev.opcode}`;
              }
            }
            lines.push(`  [${i}] ${opName.padEnd(12)} stack=[${stack.join(', ')}]${t.error ? ` ERR: ${t.error}` : ''}`);
          }
          console.error(lines.join('\n'));
        }
      }
    }
    throw new Error(`Script verification failed: ${result}`);
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

export interface StatefulUtxoSetup {
  categoryId: string;
  masterUtxo: Utxo;
  dataNftUtxos: Utxo[];
  dataNftAddresses: string[];
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
  opts?: { masterSatoshis?: bigint; dataNftSatoshis?: bigint; saltContract?: boolean },
): Promise<StatefulUtxoSetup> {
  const masterSatoshis = opts?.masterSatoshis ?? 10000n;
  const dataNftSatoshis = opts?.dataNftSatoshis ?? 10000n;
  const commitments = buildInitialStateCommitments(stateLayout, initialState);
  const dataNftCount = commitments.length;

  // Use addTokenUtxosDynamic for proper genesis on both providers.
  // The callback receives the categoryId and returns addresses derived from it.
  const result = await (provider as any).addTokenUtxosDynamic((categoryId: string) => {
    const saltedContract = contract.salt ? contract : contract.withSalt(hexToBin(categoryId));
    const masterContract = opts?.saltContract ? saltedContract : contract;
    const masterAddress = masterContract.tokenAddress;

    return [
      { address: masterAddress, satoshis: masterSatoshis,
        token: { amount: 0n, nft: { capability: 'minting' as const, commitment: '' } } },
      ...commitments.map((_commitment, i) => ({
        address: getDataNftAddress(saltedContract, categoryId),
        satoshis: dataNftSatoshis,
        token: { amount: 0n, nft: { capability: 'mutable' as const, commitment: commitments[i] } },
      })),
    ];
  });

  const categoryId = result.categoryId;
  const saltedContract = contract.salt ? contract : contract.withSalt(hexToBin(categoryId));
  const dataNftAddresses: string[] = [];
  for (let i = 0; i < dataNftCount; i++) {
    dataNftAddresses.push(getDataNftAddress(saltedContract, categoryId));
  }

  return {
    categoryId,
    masterUtxo: result.utxos[0],
    dataNftUtxos: result.utxos.slice(1),
    dataNftAddresses,
  };
}
