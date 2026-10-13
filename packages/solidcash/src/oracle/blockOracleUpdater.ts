import { secp256k1 } from '@bitauth/libauth/build/lib/crypto/default-crypto-instances.js';
import { hexToBin, binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { BchnRpcClient } from '@mr-zwets/bchn-api-wrapper';
import {
  type Artifact, blockhashOracleLockingBytecode, buildBlockhashCommitment, buildBlockhashOracleCovenantScript,
  buildPushdataCommitment, scriptToBytecode, encodeInt, hash160, hash256, type StateVariableInfo,
  blockhashKeeperBatonLockingBytecode, buildBlockhashKeeperBatonScript,
} from '@solidcash/utils';
import type { Contract } from '../Contract.js';
import type { Utxo, Unlocker, GenerateUnlockingBytecodeOptions } from '../interfaces.js';
import { createSighashPreimage } from '../utils.js';
import { readFramedState, type FramedState } from '../framed/deploy/records.js';
import SignatureTemplate from '../SignatureTemplate.js';
import type NetworkProvider from '../network/NetworkProvider.js';

/**
 * Off-chain keeper for a contract's block.* oracles (docs/block-and-transaction-properties.md). It subscribes to Fulcrum
 * block-header notifications and, on each new tip, maintains only the oracle(s) the contract actually uses:
 *
 *  - block-info register (block.number/timestamp/...): present iff the artifact has `__updateBlockOracle`.
 *    Reads the block from a BCHN JSON-RPC and pushes a signed + freshness-bound `__updateBlockOracle` when
 *    the chain is ahead of the on-chain register.
 *  - n->hash oracle (blockhash(n)): present iff the artifact stamps usesBlockhash. Mints the per-block
 *    (n->hash) UTXO under the project-global oracle category. (Sweeping the one that aged out of the
 *    256-block window is a keeper follow-up; the covenant's permissionless tx.time>=n+256 wipe is in place.)
 *
 * The keeper/operator private key signs both (the contract's baked `__blockOracleOwner` for block-info,
 * and the n->hash mint).
 */

// Any JSON-RPC client exposing `request(method, ...params)` (BchnRpcClient satisfies this).
export interface RpcLike {
  request: (method: string, ...params: any[]) => Promise<any>;
}

export interface BlockOracleFields {
  number: bigint; // height
  timestamp: bigint; // header time (unix seconds)
  difficulty: bigint; // nBits as uint32
  size: bigint; // block size in bytes
  totalFees: bigint; // sum of tx fees, satoshis
  coinbase: Uint8Array; // coinbase output 0 locking bytecode
  medianTime?: bigint; // median time past at this block, when the rpc reports it
}

// EVM-parity blockhash window.
export const BLOCKHASH_WINDOW = 256;

// User-land defaults: mainnet -> public BCHN, regtest -> the docker stack (see docker-compose.regtest.yml).
export const DEFAULT_RPC_URL: Record<string, string> = {
  mainnet: 'https://bchn.pat.mn',
  regtest: 'http://localhost:18443',
};

export function createRpcClient(
  network: keyof typeof DEFAULT_RPC_URL,
  opts: { url?: string; rpcUser?: string; rpcPassword?: string } = {},
): BchnRpcClient {
  const url = opts.url ?? DEFAULT_RPC_URL[network];
  return new BchnRpcClient({ url, rpcUser: opts.rpcUser ?? '', rpcPassword: opts.rpcPassword ?? '' });
}

// BCH/BTC block subsidy in sats: 50 BCH halving every 210000 blocks (0 after 64 halvings).
function blockSubsidySats(height: number): bigint {
  const halvings = Math.floor(height / 210000);
  return halvings >= 64 ? 0n : 5_000_000_000n >> BigInt(halvings);
}

// Convert a BCH amount (RPC returns a JSON number) to sats without float drift.
function bchToSats(bch: number): bigint {
  return BigInt(bch.toFixed(8).replace('.', ''));
}

/**
 * Read a block's oracle fields from BCHN in a single `getblock` verbosity-2 call: it inlines the full
 * coinbase tx, so the payout script is `tx[0].vout[0].scriptPubKey.hex` and the total fee is
 * `sum(coinbase outputs) - subsidy(height)` (= the miner-claimed fee; equals the realized fee unless a
 * miner under-claims). This drops the separate `getblockstats` + coinbase `getrawtransaction` calls.
 * (Verbosity 3 would give a per-tx `fee` directly, but it is a Bitcoin Core 25 feature BCHN may lack.)
 */
export async function fetchBlockOracleFields(rpc: RpcLike, hash: string): Promise<BlockOracleFields> {
  const block = await rpc.request('getblock', hash, 2);
  const coinbase = block.tx[0];
  const coinbaseSum = coinbase.vout.reduce((sum: bigint, out: any) => sum + bchToSats(out.value), 0n);
  return {
    number: BigInt(block.height),
    timestamp: BigInt(block.time),
    difficulty: BigInt(Number.parseInt(block.bits, 16)),
    size: BigInt(block.size),
    totalFees: coinbaseSum - blockSubsidySats(block.height),
    coinbase: hexToBin(coinbase.vout[0].scriptPubKey.hex),
    ...(block.mediantime !== undefined && { medianTime: BigInt(block.mediantime) }),
  };
}

function updateWritesTimestampOnly(contract: Contract): boolean {
  const inputs = contract.artifact.abi.find((fn) => fn.name === '__updateBlockOracle')?.inputs ?? [];
  return inputs.some((input) => input.name === '__set_timestamp')
    && !inputs.some((input) => input.name === '__set_number');
}

/**
 * A timestamp-only update CLTVs its timestamp under a time-type locktime, and that locktime is final only below
 * the median time past. Publish at most the last final second.
 */
function finalTimestamp(fields: BlockOracleFields): bigint {
  if (fields.medianTime === undefined) return fields.timestamp;
  const last = fields.medianTime - 1n;
  return fields.timestamp < last ? fields.timestamp : last;
}

// Map fetched fields to the contract's injected registers, in the ABI order of __updateBlockOracle. Only
// the registers the contract actually references are written (a contract may use a subset of block.*).
function buildUpdate(
  contract: Contract,
  fields: BlockOracleFields,
): { args: Array<bigint | Uint8Array>; state: Record<string, bigint | Uint8Array> } {
  const byRegister: Record<string, bigint | Uint8Array> = {
    __block_number: fields.number,
    __block_timestamp: fields.timestamp,
    __block_difficulty: fields.difficulty,
    __block_size: fields.size,
    __block_totalFees: fields.totalFees,
    __block_coinbase: fields.coinbase,
  };
  const updateAbi = contract.artifact.abi.find((fn) => fn.name === '__updateBlockOracle');
  if (!updateAbi) throw new Error('contract does not use block.* (no __updateBlockOracle in the ABI)');

  const args: Array<bigint | Uint8Array> = [];
  const state: Record<string, bigint | Uint8Array> = {};
  for (const input of updateAbi.inputs) {
    if (input.name === '__blockOracleSig') continue; // signature supplied separately
    const register = `__block_${input.name.slice('__set_'.length)}`;
    const value = byRegister[register];
    if (value === undefined) throw new Error(`unexpected oracle setter param: ${input.name}`);
    args.push(value);
    state[register] = value;
  }
  return { args, state };
}

export interface BlockOracleUpdaterConfig {
  contract: Contract;
  categoryId: string;
  // Operator/keeper private key. Signs the block-info `__updateBlockOracle` (vs the baked
  // `__blockOracleOwner`) and the n->hash oracle mints.
  keeperKey: Uint8Array;
  rpc: RpcLike;
  electrumHost?: string; // Fulcrum host for blockchain.headers.subscribe
  // Project-global blockhash (n->hash) oracle token category. Required only for blockhash() consumers.
  blockhashOracleCategory?: string;
  // Override for the keeper's minting baton. By default it is the UTXO at the keeper baton covenant
  // (blockhashKeeperBatonLockingBytecode(category, keeper public key)), spent with blockhashKeeperBatonUnlocker.
  blockhashOracleMaster?: { utxo: Utxo; unlocker: Unlocker };
}

/** Unlocks the keeper baton covenant (audit CRYPTO-4) with `<keeper signature> <redeem>`. */
export function blockhashKeeperBatonUnlocker(categoryId: string, keeperKey: Uint8Array): Unlocker {
  const keeper = new SignatureTemplate(keeperKey);
  const category = hexToBin(categoryId);
  const redeem = scriptToBytecode(buildBlockhashKeeperBatonScript(category, keeper.publicKey));
  const lock = blockhashKeeperBatonLockingBytecode(category, keeper.publicKey);
  return {
    generateLockingBytecode: (): Uint8Array => lock,
    generateUnlockingBytecode: ({ transaction, sourceOutputs, inputIndex }: GenerateUnlockingBytecodeOptions)
    : Uint8Array => {
      const preimage = createSighashPreimage(transaction, sourceOutputs, inputIndex, redeem, keeper.sighashType);
      return scriptToBytecode([keeper.generateSignature(hash256(preimage)), redeem]);
    },
  };
}

export class BlockOracleUpdater {
  constructor(private readonly cfg: BlockOracleUpdaterConfig) {}

  /** The contract writes a current-block register set (block.number/timestamp/...). */
  static usesBlockInfo(artifact: Artifact): boolean {
    return artifact.abi.some((fn) => fn.name === '__updateBlockOracle');
  }

  /**
   * The contract reads blockhash(n), so it needs the project-global (n->hash) oracle. The compiler stamps
   * this marker on the artifact when blockhash() is referenced (see docs/block-and-transaction-properties.md).
   */
  static usesBlockhash(artifact: Artifact): boolean {
    return artifact.usesBlockhash === true;
  }

  /** Current block-info oracle height from the on-chain __block_number register (0 if absent). */
  async oracleHeight(): Promise<bigint> {
    return this.oracleRegister('__block_number');
  }

  private async oracleRegister(name: string): Promise<bigint> {
    const { StatefulContract } = await import('../stateful/StatefulContract.js');
    const sc = StatefulContract.withCategory(this.cfg.contract, this.cfg.categoryId);
    const state = await sc.getState();
    return BigInt((state[name] as bigint | undefined) ?? 0n);
  }

  /** Push a signed + freshness-bound block-info update for the given block fields. Returns the txid. */
  async pushUpdate(fields: BlockOracleFields): Promise<string> {
    const { StatefulContract } = await import('../stateful/StatefulContract.js');
    const timestampOnly = updateWritesTimestampOnly(this.cfg.contract);
    const published = timestampOnly ? { ...fields, timestamp: finalTimestamp(fields) } : fields;
    const { args, state } = buildUpdate(this.cfg.contract, published);
    const sc = StatefulContract.withCategory(this.cfg.contract, this.cfg.categoryId);
    // Freshness: require(tx.time >= number), or tx.time >= timestamp under a time-type locktime without a height.
    const call = (sc as any).__updateBlockOracle(new SignatureTemplate(this.cfg.keeperKey), ...args)
      .setState(state)
      .setLocktime(Number(timestampOnly ? published.timestamp : fields.number));
    const tx = await call.send();
    return tx.txid;
  }

  /**
   * Mint the (n -> hash) oracle UTXO at addr(n) under the oracle category, spending + recreating the
   * keeper's minting baton. Returns the mint txid.
   */
  async mintBlockhashPair(n: bigint, hash: Uint8Array): Promise<string> {
    const catHex = this.cfg.blockhashOracleCategory;
    if (!catHex) throw new Error('blockhashOracleCategory is required to mint (n->hash) pairs');
    const master = this.cfg.blockhashOracleMaster ?? await this.keeperBaton(catHex);
    const addrN = blockhashOracleLockingBytecode(hexToBin(catHex), n);
    const commitment = binToHex(buildBlockhashCommitment(n, hash));
    const mintSats = 1000n;
    const fee = 1000n;
    const { TransactionBuilder } = await import('../TransactionBuilder.js');
    const tx = await new TransactionBuilder({ provider: this.cfg.contract.provider })
      .addInput(master.utxo, master.unlocker)
      .addOutput({
        to: master.unlocker.generateLockingBytecode(),
        amount: master.utxo.satoshis - mintSats - fee,
        token: master.utxo.token,
      }) // recreate the minting master
      .addOutput({
        to: addrN,
        amount: mintSats,
        token: { category: catHex, amount: 0n, nft: { capability: 'none', commitment } },
      }) // mint the (n,hash) oracle NFT
      .setLocktime(Number(n)) // the baton covenant requires tx.time >= n
      .send();
    return tx.txid;
  }

  // The keeper's minting baton of the category at the keeper baton covenant.
  private async keeperBaton(catHex: string): Promise<{ utxo: Utxo; unlocker: Unlocker }> {
    const unlocker = blockhashKeeperBatonUnlocker(catHex, this.cfg.keeperKey);
    const utxos = await this.cfg.contract.provider.getUtxosForLockingBytecode(unlocker.generateLockingBytecode());
    const utxo = utxos.find((u) => u.token?.category === catHex && u.token.nft?.capability === 'minting');
    if (!utxo) throw new Error(`no keeper baton of category ${catHex} at the blockhash keeper covenant`);
    return { utxo, unlocker };
  }

  /**
   * Sweep (burn) the (n->hash) oracle UTXO that aged out of the 256-block window, reclaiming its dust to
   * the keeper's P2PKH. Best-effort: returns null if nothing sits at addr(n). Spends the covenant wipe
   * path (flag 1) under tx.time >= n+256 - mineable once the chain reaches n+256. The covenant also lets
   * anyone wipe, so this is a keeper convenience (reclaim dust), not a liveness dependency.
   */
  async sweepBlockhashPair(n: bigint): Promise<string | null> {
    const catHex = this.cfg.blockhashOracleCategory;
    if (!catHex) throw new Error('blockhashOracleCategory is required to sweep (n->hash) pairs');
    const cat = hexToBin(catHex);
    const addrN = blockhashOracleLockingBytecode(cat, n);
    const utxos = await this.cfg.contract.provider.getUtxosForLockingBytecode(addrN);
    if (utxos.length === 0) return null;

    const redeem = scriptToBytecode(buildBlockhashOracleCovenantScript(cat, n));
    const wipeUnlock = scriptToBytecode([encodeInt(1n), redeem]); // flag 1 = wipe branch
    const unlocker = {
      generateLockingBytecode: (): Uint8Array => addrN,
      generateUnlockingBytecode: (): Uint8Array => wipeUnlock,
    };

    const { TransactionBuilder } = await import('../TransactionBuilder.js');
    const builder = new TransactionBuilder({ provider: this.cfg.contract.provider, allowImplicitNftBurn: true });
    let reclaimed = 0n;
    for (const utxo of utxos) {
      builder.addInput(utxo, unlocker);
      reclaimed += utxo.satoshis;
    }
    const fee = 1000n;
    const tx = await builder
      .addOutput({ to: this.keeperP2pkh(), amount: reclaimed - fee })
      .setLocktime(Number(n + BigInt(BLOCKHASH_WINDOW)))
      .send();
    return tx.txid;
  }

  // The keeper's own P2PKH locking bytecode (reclaim destination for swept dust).
  private keeperP2pkh(): Uint8Array {
    const pub = secp256k1.derivePublicKeyCompressed(this.cfg.keeperKey);
    if (typeof pub === 'string') throw new Error(`invalid keeper key: ${pub}`);
    return Uint8Array.from([0x76, 0xa9, 0x14, ...hash160(pub), 0x88, 0xac]);
  }

  /**
   * Maintain the project-global (n->hash) oracle on a new tip: mint the tip's (n, hash) pair and sweep the
   * pair that just aged out of the 256-block window (best-effort dust reclaim).
   */
  private async maintainBlockhashWindow(tip: number): Promise<void> {
    const hashHex: string = await this.cfg.rpc.request('getblockhash', tip);
    await this.mintBlockhashPair(BigInt(tip), hexToBin(hashHex));
    if (tip > BLOCKHASH_WINDOW) await this.sweepBlockhashPair(BigInt(tip - BLOCKHASH_WINDOW));
  }

  /**
   * Fetch the tip and maintain whichever oracle(s) this contract uses. Returns the block-info update txid
   * (or null if the block-info oracle is absent or already current).
   */
  async syncOnce(): Promise<string | null> {
    const tip = Number(await this.cfg.rpc.request('getblockcount'));
    const { artifact } = this.cfg.contract;

    let blockInfoTxid: string | null = null;
    if (BlockOracleUpdater.usesBlockInfo(artifact) && updateWritesTimestampOnly(this.cfg.contract)) {
      // No height register: the oracle is behind while the last final second is past the stored timestamp.
      const hash: string = await this.cfg.rpc.request('getblockhash', tip);
      const fields = await fetchBlockOracleFields(this.cfg.rpc, hash);
      if (finalTimestamp(fields) > await this.oracleRegister('__block_timestamp')) {
        blockInfoTxid = await this.pushUpdate(fields);
      }
    } else if (BlockOracleUpdater.usesBlockInfo(artifact) && BigInt(tip) > (await this.oracleHeight())) {
      const hash: string = await this.cfg.rpc.request('getblockhash', tip);
      blockInfoTxid = await this.pushUpdate(await fetchBlockOracleFields(this.cfg.rpc, hash));
    }
    if (BlockOracleUpdater.usesBlockhash(artifact)) {
      await this.maintainBlockhashWindow(tip);
    }
    return blockInfoTxid;
  }

  /**
   * Subscribe to Fulcrum header notifications and sync on every new tip. Returns a stop() that
   * unsubscribes and disconnects. Does an initial sync before returning.
   */
  async start(): Promise<() => Promise<void>> {
    if (!this.cfg.electrumHost) throw new Error('electrumHost is required to subscribe to headers');
    // Load the Electrum client lazily: it is only needed for header subscriptions, not for one-shot syncs.
    const { ElectrumClient } = await import('@electrum-cash/network');
    const electrum = new ElectrumClient('SolidCash BlockOracleUpdater', '1.4.1', this.cfg.electrumHost);
    await electrum.connect();
    await electrum.subscribe('blockchain.headers.subscribe');
    electrum.on('notification', () => {
      // blockchain.headers.subscribe fires on every new tip; re-sync (errors are logged, not thrown).
      this.syncOnce().catch((err) => console.error('[block-oracle-updater] sync failed:', err?.message ?? err));
    });
    await this.syncOnce();
    return async () => {
      await electrum.unsubscribe('blockchain.headers.subscribe');
      await electrum.disconnect();
    };
  }
}

/** Block-info registers the mock tip can refresh without a signed `__updateBlockOracle` spend. */
const MOCK_ORACLE_REGISTERS = [
  '__block_number',
  '__block_timestamp',
  '__block_difficulty',
  '__block_size',
  '__block_totalFees',
  '__block_coinbase',
] as const;

/**
 * Map a mock provider's height/time onto the same field record `fetchBlockOracleFields` returns.
 * Used when `evm_increaseTime` / `mine` must advance `__block_timestamp` without a keeper key.
 */
export function mockProviderBlockFields(provider: {
  getBlockHeight(): Promise<number>;
  getBlockTime(): number;
}): Promise<BlockOracleFields> {
  const coinbase = hexToBin(`76a914${'00'.repeat(20)}88ac`);
  return provider.getBlockHeight().then((height) => ({
    number: BigInt(height),
    timestamp: BigInt(provider.getBlockTime()),
    difficulty: 0n,
    size: 1000n,
    totalFees: 0n,
    coinbase,
  }));
}

type MockUtxoStorage = {
  getUtxoByOutpoint: (key: string) => {
    outpoint: { txid: string; vout: number };
    satoshis: bigint;
    scriptHash: string;
    height: number;
    lockingBytecode: Uint8Array;
    isCoinbase?: boolean;
    tokenData?: {
      category: string;
      amount: bigint;
      nft?: { commitment: string; capability: 'none' | 'mutable' | 'minting' };
    };
  } | undefined;
  _test?: {
    utxo: {
      add: (params: {
        txid: string; vout: number; satoshis: bigint; scriptHash: string; height: number;
        lockingBytecode?: Uint8Array; isCoinbase?: boolean;
        tokenData?: {
          category: string; amount: bigint;
          nft?: { commitment: string; capability: 'none' | 'mutable' | 'minting' };
        };
      }) => void;
      remove: (params: { txid: string; vout: number }) => void;
    };
  };
};

type OracleTarget = {
  categoryId: string;
  layout: NonNullable<Artifact['stateLayout']>;
  /** The direct convention's handle; a framed target has none, its records are found by category. */
  contract?: Contract;
};

function oracleTargetsFromDeployment(deployment: { contract: unknown }): OracleTarget[] {
  const found: OracleTarget[] = [];
  const seen = new Set<string>();
  const addTarget = (categoryId: string | undefined, layout: Artifact['stateLayout'], contract?: Contract): void => {
    if (!categoryId || !layout) return;
    if (!layout.variables.some((variable) => (
      (MOCK_ORACLE_REGISTERS as readonly string[]).includes(variable.name)
    ))) return;
    const key = `${categoryId}:${layout.variables.map((variable) => variable.name).join(',')}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ categoryId, layout, ...(contract === undefined ? {} : { contract }) });
  };
  // A direct target is read through its handle.
  const push = (
    contract: Contract | undefined, categoryId: string | undefined, layout: Artifact['stateLayout'],
  ): void => {
    if (contract) addTarget(categoryId, layout, contract);
  };
  const wrapped = deployment.contract as {
    inner?: Contract;
    categoryId?: string;
    implementation?: { inner?: Contract; categoryId?: string };
    proxy?: { inner?: Contract; categoryId?: string };
    framedProxy?: unknown;
  };
  // Per-call: a proxy registers the implementation's artifact beside the proxy's category, whose records hold the
  // application state (the registers included) under the implementation's layout; a plain deployment registers its
  // stateful handle.
  const innerArtifact = wrapped.inner?.artifact;
  if (innerArtifact?.composition?.convention === 'framed') {
    const categoryId = wrapped.framedProxy === undefined ? wrapped.categoryId : wrapped.proxy?.categoryId;
    addTarget(categoryId, innerArtifact.stateLayout);
    return found;
  }
  const implArtifact = wrapped.implementation?.inner?.artifact;
  // OZ proxy: application state (including __block_timestamp) lives on the proxy category
  // under the implementation layout. The implementation artifact owns `__updateBlockOracle`.
  if (implArtifact && BlockOracleUpdater.usesBlockInfo(implArtifact)) {
    push(wrapped.proxy?.inner, wrapped.proxy?.categoryId, implArtifact.stateLayout);
    push(wrapped.implementation?.inner, wrapped.implementation?.categoryId, implArtifact.stateLayout);
  }
  push(wrapped.inner, wrapped.categoryId, wrapped.inner?.artifact.stateLayout);
  return found;
}

function replaceMockNftCommitment(
  storage: MockUtxoStorage, utxo: Utxo, commitment: string,
): boolean {
  const key = `${utxo.txid}:${utxo.vout}`;
  // A full storage snapshot clones every chain and mempool entry. The indexed outpoint reader returns the
  // same confirmed NFT as an isolated copy, without cloning the whole chain for each oracle register.
  const entry = storage.getUtxoByOutpoint(key);
  if (!entry?.tokenData?.nft || entry.height <= 0 || !storage._test) return false;
  if (entry.tokenData.nft.commitment === commitment) return false;
  storage._test.utxo.remove({ txid: utxo.txid, vout: utxo.vout });
  storage._test.utxo.add({
    txid: utxo.txid,
    vout: utxo.vout,
    satoshis: entry.satoshis,
    scriptHash: entry.scriptHash,
    height: entry.height,
    lockingBytecode: entry.lockingBytecode,
    isCoinbase: entry.isCoinbase,
    tokenData: {
      category: entry.tokenData.category,
      amount: entry.tokenData.amount,
      nft: { capability: entry.tokenData.nft.capability, commitment },
    },
  });
  return true;
}

/**
 * Rewrites a framed deployment's register records in place: read by category and decoded as its entries read
 * them, re-encoded with the shipped pushdata encoder. A deployment whose records do not classify is left alone.
 */
async function syncFramedRegisters(
  provider: NetworkProvider,
  storage: MockUtxoStorage,
  target: OracleTarget,
  touched: readonly StateVariableInfo[],
  byRegister: Readonly<Record<string, bigint | Uint8Array>>,
): Promise<number> {
  const { categoryId, layout } = target;
  let onChain: FramedState;
  try {
    onChain = await readFramedState(provider, categoryId, layout);
  } catch {
    return 0;
  }
  let updated = 0;
  for (const nftIndex of new Set(touched.map((variable) => variable.nftIndex))) {
    const next = { ...onChain.byNft[nftIndex] };
    for (const variable of touched) {
      if (variable.nftIndex === nftIndex) next[variable.name] = byRegister[variable.name]!;
    }
    const commitment = buildPushdataCommitment(layout, next, nftIndex);
    if (replaceMockNftCommitment(storage, onChain.records[nftIndex]!, commitment)) updated += 1;
  }
  return updated;
}

/**
 * Hardhat `evm_increaseTime` / `mine` analogue: write the mock tip into every deployed
 * contract's `__block_*` registers. Official `syncOnce()` needs a keeper signature the
 * unmodified suites never start; this uses the same field mapping and the live data-NFT
 * commitments the covenant actually reads.
 */
async function syncMockBlockOracleDeployments(
  provider: NetworkProvider,
  deployments: Iterable<{ contract: unknown }>,
  keeperRule = false,
): Promise<number> {
  const storage = (provider as { indexer?: { storage?: MockUtxoStorage } }).indexer?.storage;
  if (!storage?._test) return 0;
  const { getContractState, getDataNftAddress } = await import('../stateful/covenant-helpers.js');
  const { StateReader } = await import('../stateful/StateReader.js');
  const fields = await mockProviderBlockFields({
    getBlockHeight: () => provider.getBlockHeight(),
    getBlockTime: () => (provider as unknown as { getBlockTime: () => number }).getBlockTime(),
  });
  const byRegister: Record<string, bigint | Uint8Array> = {
    __block_number: fields.number,
    __block_timestamp: fields.timestamp,
    __block_difficulty: fields.difficulty,
    __block_size: fields.size,
    __block_totalFees: fields.totalFees,
    __block_coinbase: fields.coinbase,
  };
  let updated = 0;
  for (const deployment of deployments) {
    for (const target of oracleTargetsFromDeployment(deployment)) {
      const { contract, categoryId, layout } = target;
      const touched = layout.variables.filter((variable) => (
        (MOCK_ORACLE_REGISTERS as readonly string[]).includes(variable.name)
      ));
      if (touched.length === 0) continue;
      if (contract === undefined) {
        updated += await syncFramedRegisters(provider, storage, target, touched, byRegister);
        continue;
      }
      let onChain;
      try {
        const dataNftAddr = getDataNftAddress(contract, categoryId);
        const addresses = [contract.tokenAddress, dataNftAddr];
        onChain = await new StateReader(layout).readStateFromChain(
          contract.provider, categoryId, addresses, addresses,
        );
      } catch {
        try {
          onChain = await getContractState(contract, categoryId);
        } catch {
          continue;
        }
      }
      // The production keeper (`syncOnce`) pushes only when the chain is ahead of the oracle, and an implicit
      // refresh follows the same rule. A register at or past the tip height stands as it would on chain: state
      // seeded for a fixed block, or a signed owner update the covenant admitted (it requires tx.time >= number).
      // Without this the refresh before every call replaced an owner's update with the mock tip's fields. A layout
      // without a height register carries no freshness and is always refreshed, and an explicit tip move (mine,
      // evm_increaseTime) refreshes unconditionally.
      if (keeperRule) {
        const recorded = onChain.state.__block_number;
        if (typeof recorded === 'bigint' && recorded >= fields.number) continue;
      }
      const next = { ...onChain.state };
      for (const variable of touched) {
        next[variable.name] = byRegister[variable.name];
      }
      const nftIndices = new Set(touched.map((variable) => variable.nftIndex));
      for (const nftIndex of nftIndices) {
        const utxo = onChain.dataNftUtxos[nftIndex];
        if (!utxo?.token?.nft) continue;
        const commitment = buildPushdataCommitment(layout, next, nftIndex);
        if (replaceMockNftCommitment(storage, utxo, commitment)) updated += 1;
      }
    }
  }
  return updated;
}

/**
 * Refresh only one contract graph (including proxy/implementation pairs), as the keeper would: a direct contract
 * whose height register is already at or past the tip is left alone.
 */
export async function syncMockBlockOracleDeployment(
  provider: NetworkProvider,
  deployment: { contract: unknown },
): Promise<number> {
  return syncMockBlockOracleDeployments(provider, [deployment], true);
}

export async function syncMockBlockOracles(provider: NetworkProvider): Promise<number> {
  const { listDeployments } = await import('../stateful/deployment-registry.js');
  return syncMockBlockOracleDeployments(provider, listDeployments(provider));
}
