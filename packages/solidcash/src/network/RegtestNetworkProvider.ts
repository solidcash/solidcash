import {
  BchnRpcClient,
  type GenerateToAddress,
  type GetBlockCount,
  type GetBlockHash,
  type GetNewAddress,
  type FundRawTransaction,
  type SignRawTransactionWithWallet,
  type SendRawTransaction,
  type GetRawTransactionVerbosity0,
  type GetTxOut,
  type ListUnspent,
  type ListUnspentItem,
  type ImportAddress,
} from '@mr-zwets/bchn-api-wrapper';
import { cashAddressToLockingBytecode, lockingBytecodeToCashAddress } from '@bitauth/libauth/build/lib/address/locking-bytecode.js';
import { hexToBin, binToHex, isHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { decodeTransactionUnsafe, encodeTransaction } from '@bitauth/libauth/build/lib/message/transaction-encoding.js';
import { type Utxo, Network, type TokenDetails } from '../interfaces.js';
import type NetworkProvider from './NetworkProvider.js';
import type { ConsensusLimits, NetworkPolicy } from './NetworkProvider.js';
import type { SnapshotRestorer } from './MockNetworkProvider.js';
import { getNetworkPrefix } from '../utils.js';

export interface RegtestProviderOptions {
  rpcUrl?: string;
  rpcUser?: string;
  rpcPassword?: string;
  /** Published SDK limits for preflight. The node's limits must be configured to match. */
  consensusLimits?: ConsensusLimits;
  policy?: NetworkPolicy;
}

interface GetBlockHeaderTime {
  method: 'getblockheader';
  params: [hashOrHeight: string | number, verbosity: true];
  // `mediantime` is BCHN's median-time-past, the value `LOCKTIME_MEDIAN_TIME_PAST` checks against.
  response: { hash: string; height: number; time: number; mediantime: number };
}

interface ClearMempool {
  method: 'clearmempool';
  params: [];
  response: boolean;
}

interface SetMockTime {
  method: 'setmocktime';
  params: [timestamp: number];
  response: null;
}

interface InvalidateBlock {
  method: 'invalidateblock';
  params: [blockhash: string];
  response: null;
}

interface RegtestSnapshotState {
  height: number;
  hash: string;
  mockTime: number;
  tipTime: number;
  pendingBlockTimestamp: number | undefined;
  retainedMinting: Map<string, { txid: string; vout: number; satoshis: bigint }>;
  categoryOfLabel: Map<string, string>;
  importedAddresses: Set<string>;
  tokenUtxos: Map<string, Map<string, Utxo>>;
}

export interface TokenGenesisOutput {
  address: string;
  satoshis: bigint;
  token?: Omit<TokenDetails, 'category'>;
}

export default class RegtestNetworkProvider implements NetworkProvider {
  public network: Network = Network.REGTEST;
  public consensusLimits?: ConsensusLimits;
  public policy?: NetworkPolicy;

  private rpc: BchnRpcClient;
  private readRpc: BchnRpcClient;
  private probeRpc: BchnRpcClient;
  private miningAddress: string = '';
  private ready: Promise<void> | undefined;
  private importedAddresses = new Set<string>();
  private snapshotNonce = 0;
  private snapshotRestorers = new Map<string, SnapshotRestorer>();
  /** Local mock time; zero means the node's system clock is in use. */
  private mockTime = 0;
  /** Latest known tip timestamp, used while mock time is unset. */
  private tipTime = 0;
  /** Timestamp applied to the next mined block by `evm_setNextBlockTimestamp`. */
  private pendingBlockTimestamp: number | undefined;

  // X74. Category bookkeeping. A CashTokens category exists only where a transaction spent its own genesis
  // outpoint, so the provider cannot conjure one on request; what it CAN do is keep the category's minting NFT
  // and co-spend it later. `retainedMinting` holds that NFT per real on-chain category, and `categoryOfLabel`
  // maps every category the caller has ASKED for to the real category serving it (identity for real ones).
  // Together they give one invariant: the provider never serves two different real categories for one
  // requested category, and never substitutes for a category it can actually mint into.
  private retainedMinting = new Map<string, { txid: string; vout: number; satoshis: bigint }>();
  private categoryOfLabel = new Map<string, string>();
  // BCHN's wallet cannot enumerate UTXOs by token category. Track the category-bearing outputs this
  // process broadcasts; that is the set framed deployments use to tell masters, validators and records apart.
  private tokenUtxos = new Map<string, Map<string, Utxo>>();
  private retainAddress: string = '';
  private retainLockingBytecode: Uint8Array = new Uint8Array();
  private static readonly RETAINED_MINT_SATOSHIS = 2_000n;
  // Comfortably above the `minimumAmount: 1` BCH filter in `pickLiveFundingInput`.
  private static readonly VOUT0_FUNDING_SATOSHIS = 200_000_000n;

  constructor(options: RegtestProviderOptions = {}) {
    const {
      rpcUrl = 'http://localhost:18443',
      rpcUser = 'user',
      rpcPassword = 'password',
    } = options;

    this.consensusLimits = options.consensusLimits;
    this.policy = options.policy;

    // 60s (vs the wrapper's 5s default): resource-heavy live transactions can occasionally keep one BCHN RPC
    // request active for slightly more than 30s. This remains below the 180s per-test regtest budget.
    this.rpc = new BchnRpcClient({
      url: rpcUrl, rpcUser, rpcPassword, timeoutMs: 60_000,
    });
    // Read requests are idempotent and state derivation can issue many of them, so retry a transient dropped
    // connection. Mutation requests deliberately stay on the non-retrying client above.
    this.readRpc = new BchnRpcClient({
      url: rpcUrl, rpcUser, rpcPassword, timeoutMs: 60_000, maxRetries: 2, retryDelayMs: 250,
    });
    // A second client for probes whose FAILURE is the answer. The wrapper logs every failed request through
    // its logger, and `categoryExistsOnChain` misses once per seeded placeholder UTXO, so those misses would
    // otherwise print an error line each. Same endpoint, same timeout, silent.
    const quiet = {
      error: (): void => {}, warn: (): void => {}, log: (): void => {},
      info: (): void => {}, debug: (): void => {},
    };
    this.probeRpc = new BchnRpcClient({
      url: rpcUrl, rpcUser, rpcPassword, timeoutMs: 30_000, logger: quiet as never,
    });
  }

  // ---------------------------------------------------------------------------
  // NetworkProvider interface - all via BCHN RPC
  // ---------------------------------------------------------------------------

  async getUtxos(address: string): Promise<Utxo[]> {
    await this.ensureReady();
    await this.importAddressIfNeeded(address);
    // Always request token UTXOs. The CashAddress token-support flag describes the ADDRESS ENCODING, not what
    // the script underneath may hold: a p2sh32 covenant is addressable in both forms and the locking bytecode is
    // identical, so gating the query on that flag hid real token UTXOs. `deriveLogicalCreateAddress` encodes
    // `type: 'p2sh'`, so every logical CREATE anchor - which is an immutable NFT - was invisible here and
    // `resolveLogicalIdentity` reported "found 0" for an anchor that existed on chain. MockNetworkProvider
    // returns token UTXOs regardless, which is why this only ever failed against a live node.
    const result = await this.readRpc.request<ListUnspent>(
      'listunspent', 0, 9999999, [address], false, { includeTokens: true },
    );
    const merged = new Map(result.map((u) => {
      const utxo = this.listUnspentItemToUtxo(u);
      return [`${utxo.txid}:${utxo.vout}`, utxo] as const;
    }));
    // The wallet cannot rescan history for an address imported after its outputs were mined. Serve the
    // category-bearing outputs this provider already broadcast for that lock.
    for (const utxo of this.trackedAt(binToHex(this.toLockingBytecode(address)))) {
      merged.set(`${utxo.txid}:${utxo.vout}`, utxo);
    }
    return [...merged.values()];
  }

  async getUtxosByTokenCategory(categoryId: string): Promise<Utxo[]> {
    await this.ensureReady();
    const wanted = new Set([categoryId.toLowerCase()]);
    try {
      wanted.add(binToHex(hexToBin(categoryId).reverse()).toLowerCase());
    } catch { /* not a byte string; exact match only */ }
    const found: Utxo[] = [];
    for (const [category, bucket] of this.tokenUtxos) {
      if (wanted.has(category.toLowerCase())) found.push(...bucket.values());
    }
    return found;
  }

  async getUtxosForLockingBytecode(lockingBytecode: Uint8Array | string): Promise<Utxo[]> {
    const bin = typeof lockingBytecode === 'string' ? hexToBin(lockingBytecode) : lockingBytecode;
    const prefix = getNetworkPrefix(this.network);
    // Try both token and non-token address variants
    const addresses: string[] = [];
    for (const tokenSupport of [false, true]) {
      const result = lockingBytecodeToCashAddress({ bytecode: bin, prefix, tokenSupport });
      if (typeof result !== 'string') addresses.push(result.address);
    }
    if (addresses.length === 0) {
      // Non-standard script - the wallet cannot list it, but a broadcast output can still be tracked.
      return this.trackedAt(binToHex(bin));
    }
    const utxos: Utxo[] = [];
    for (const addr of addresses) {
      utxos.push(...await this.getUtxos(addr));
    }
    // Token-aware and ordinary CashAddresses encode the same locking bytecode. BCHN's wallet therefore returns
    // the same outpoint for both queries; expose a UTXO set, not a duplicated concatenation of those two views.
    return [...new Map(utxos.map((utxo) => [`${utxo.txid}:${utxo.vout}`, utxo])).values()];
  }

  private trackedAt(lockingBytecodeHex: string): Utxo[] {
    const found: Utxo[] = [];
    for (const bucket of this.tokenUtxos.values()) {
      for (const utxo of bucket.values()) {
        if (utxo.lockingBytecode !== undefined && binToHex(utxo.lockingBytecode) === lockingBytecodeHex) {
          found.push(utxo);
        }
      }
    }
    return found;
  }

  async getBlockHeight(): Promise<number> {
    await this.ensureReady();
    return this.readRpc.request<GetBlockCount>('getblockcount');
  }

  async getBlockHash(height: number): Promise<string> {
    await this.ensureReady();
    return this.readRpc.request<GetBlockHash>('getblockhash', height);
  }

  async getRawTransaction(txid: string): Promise<string> {
    await this.ensureReady();
    return this.readRpc.request<GetRawTransactionVerbosity0>('getrawtransaction', txid, false);
  }

  async sendRawTransaction(txHex: string): Promise<string> {
    await this.ensureReady();
    const txid = await this.rpc.request<SendRawTransaction>('sendrawtransaction', txHex);
    this.trackTokenOutputs(txHex, txid);
    await this.mine(1);
    return txid;
  }

  // ---------------------------------------------------------------------------
  // Test helper: addUtxo
  // ---------------------------------------------------------------------------

  // Keyed by requested value: the caller's fee funder size is part of what it asked for, so a pool serving one
  // fixed size would silently over-fund it. See `addUtxo`.
  private feeFunderPool = new Map<bigint, Utxo[]>();
  private feeFunderRefill = new Map<bigint, Promise<void>>();
  private feeFunderSizeRequests = new Map<bigint, number>();
  // Cached `listunspent` candidates for `pickLiveFundingInput`; `undefined` forces a re-list.
  private fundingCandidates: ListUnspentItem[] | undefined;
  private static readonly DUMMY_FUNDER_LBC = 'aa20953ccfa596a6c6d39e5980194539124fdcff116a571455a212baed811f585ee087';

  async addUtxo(address: string, utxo: Utxo): Promise<Utxo> {
    await this.ensureReady();

    // Fast path: serve pre-created fee funders for the STB dummy pattern
    if (address === RegtestNetworkProvider.DUMMY_FUNDER_LBC && !utxo.token) {
      // Serve the size the CALLER asked for. Serving one fixed size instead handed a 100,000-satoshi coin to a
      // builder that requested 5,000; where the covenant cannot emit a change output the excess becomes fee, and
      // a co-spend then failed with "fee of 99000 satoshis exceeds the maximum fee cap of 50000".
      const wanted = utxo.satoshis < 546n ? 546n : utxo.satoshis;
      if ((this.feeFunderPool.get(wanted)?.length ?? 0) === 0) {
        if (!this.feeFunderRefill.has(wanted)) {
          this.feeFunderRefill.set(wanted, this.refillFeeFunderPool(wanted).finally(() => {
            this.feeFunderRefill.delete(wanted);
          }));
        }
        await this.feeFunderRefill.get(wanted);
      }
      const pool = this.feeFunderPool.get(wanted);
      if (pool !== undefined && pool.length > 0) {
        const pooled = pool.pop()!;
        utxo.txid = pooled.txid;
        utxo.vout = pooled.vout;
        utxo.satoshis = pooled.satoshis;
        return pooled;
      }
    }

    if (!isHex(address)) await this.importAddressIfNeeded(address);

    const satoshis = utxo.satoshis < 546n ? 546n : utxo.satoshis;
    const lbc = this.toLockingBytecode(address);

    // X74. A requested category is HONOURED, never quietly swapped. If the provider already serves that
    // category it mints into it by co-spending the retained minting NFT; if it serves it but has lost the
    // minting NFT, or the request needs a fungible amount that only a genesis can create, it THROWS.
    const requested = utxo.token ? RegtestNetworkProvider.normalizeCategory(utxo.token.category) : '';
    if (requested && this.categoryOfLabel.has(requested)) {
      return this.mintIntoExistingCategory(lbc, utxo, this.categoryOfLabel.get(requested)!, satoshis);
    }
    // A category this instance did not create, but which EXISTS on this chain - the second run against a
    // chain the first run already seeded. The index of retained minting NFTs is in-memory, so this instance
    // cannot mint into it, and genesising a replacement would be exactly the substitution X74 exists to kill.
    if (requested && await this.categoryExistsOnChain(requested)) {
      throw new Error(
        `RegtestNetworkProvider.addUtxo cannot mint into category ${requested}: it exists on this chain but `
        + 'was not created by this provider instance, so no minting NFT is retained for it. It is NOT served '
        + 'with a different category. Create the category in this run (addTokenUtxosDynamic / '
        + 'setupStatefulUtxos) and request the category it returns.',
      );
    }

    let fundingInput: ListUnspentItem;
    try {
      fundingInput = await this.pickLiveFundingInput(!!utxo.token);
    } catch (e) {
      if (utxo.token) { await this.createVout0Utxo(); return this.addUtxo(address, utxo); }
      throw e;
    }
    let txid: string;

    if (utxo.token) {
      // No such category exists on this chain, so there is nothing to mint into and nothing being displaced:
      // this is a genesis. Its real category is reported back on the returned UTXO, and both it and the
      // requested label are recorded so every later request for the same label lands in this same category.
      const category = fundingInput.txid;
      const unsignedTx = this.buildLibauthTx(fundingInput, [{
        lockingBytecode: lbc,
        valueSatoshis: satoshis,
        token: {
          category: hexToBin(category),
          amount: utxo.token.amount,
          nft: utxo.token.nft ? {
            capability: utxo.token.nft.capability,
            commitment: hexToBin(utxo.token.nft.commitment),
          } : undefined,
        },
      }, this.retainedMintingOutput(category)]);
      txid = await this.fundSignSend(unsignedTx);
      await this.mine(1);
      this.recordCategory(category, txid, 1, requested);
    } else {
      const unsignedTx = this.buildLibauthTx(fundingInput, [{
        lockingBytecode: lbc, valueSatoshis: satoshis,
      }]);
      txid = await this.fundSignSend(unsignedTx);
      await this.mine(1);
    }

    const result = await this.decodeOutputAt(txid, 0);
    utxo.txid = result.txid;
    utxo.vout = result.vout;
    utxo.satoshis = result.satoshis;
    if (result.token) utxo.token = result.token;
    return result;
  }

  /**
   * X74. Mint one NFT into a category that already exists on this chain, by co-spending the minting NFT the
   * provider retained when it created that category. The minting NFT is recreated at the provider's own
   * address in the same transaction, so the capability survives for the next request.
   *
   * Fungible amounts are deliberately NOT served here: CashTokens fixes a category's fungible supply at
   * genesis, so a request for one is refused by name rather than rounded down to zero.
   */
  private async mintIntoExistingCategory(
    lockingBytecode: Uint8Array, utxo: Utxo, category: string, satoshis: bigint,
  ): Promise<Utxo> {
    const token = utxo.token!;
    if (!token.nft) {
      throw new Error(
        'RegtestNetworkProvider.addUtxo cannot serve a fungible-only output in the existing category '
        + `${category}: CashTokens fixes fungible supply at genesis. Seed it in the genesis transaction `
        + '(addTokenUtxosDynamic) instead.',
      );
    }
    if (token.amount !== 0n) {
      throw new Error(
        `RegtestNetworkProvider.addUtxo cannot add ${token.amount} fungible tokens to the existing category `
        + `${category}: a minting NFT creates NFTs only, never new fungible supply. Seed the amount in the `
        + 'genesis transaction (addTokenUtxosDynamic) instead.',
      );
    }
    const retained = this.retainedMinting.get(category);
    if (!retained) {
      throw new Error(
        `RegtestNetworkProvider.addUtxo cannot mint into category ${category}: no minting NFT is retained for `
        + 'it, so the request cannot be satisfied. It is NOT served with a different category.',
      );
    }

    const unsignedTx = this.buildLibauthTx(retained, [{
      lockingBytecode,
      valueSatoshis: satoshis,
      token: {
        category: hexToBin(category),
        amount: 0n,
        nft: {
          capability: token.nft.capability,
          commitment: hexToBin(token.nft.commitment),
        },
      },
    }, this.retainedMintingOutput(category)]);
    const txid = await this.fundSignSend(unsignedTx);
    await this.mine(1);
    this.recordCategory(category, txid, 1);

    const result = await this.decodeOutputAt(txid, 0);
    utxo.txid = result.txid;
    utxo.vout = result.vout;
    utxo.satoshis = result.satoshis;
    if (result.token) utxo.token = result.token;
    return result;
  }

  /** The minting NFT this provider keeps for `category`, at its own wallet address. */
  private retainedMintingOutput(category: string): {
    lockingBytecode: Uint8Array; valueSatoshis: bigint; token: any;
  } {
    return {
      lockingBytecode: this.retainLockingBytecode,
      valueSatoshis: RegtestNetworkProvider.RETAINED_MINT_SATOSHIS,
      token: {
        category: hexToBin(category),
        amount: 0n,
        nft: { capability: 'minting' as const, commitment: new Uint8Array() },
      },
    };
  }

  private recordCategory(category: string, txid: string, vout: number, requestedLabel?: string): void {
    this.retainedMinting.set(category, {
      txid, vout, satoshis: RegtestNetworkProvider.RETAINED_MINT_SATOSHIS,
    });
    this.categoryOfLabel.set(category, category);
    if (requestedLabel) this.categoryOfLabel.set(requestedLabel, category);
  }

  /**
   * Does this category exist on this chain? Answerable EXACTLY, because a CashTokens category id is the txid
   * of the transaction whose output 0 the genesis spent - so every real category id is a real txid, and a
   * placeholder label like `'77'.repeat(32)` is not. A node without `txindex` answers "no" for old
   * transactions, which degrades to the pre-X74 genesis path rather than to a wrong mint.
   */
  private async categoryExistsOnChain(category: string): Promise<boolean> {
    try {
      await this.probeRpc.request<GetRawTransactionVerbosity0>('getrawtransaction', category, false);
      return true;
    } catch {
      return false;
    }
  }

  private static normalizeCategory(category: string | undefined): string {
    if (typeof category !== 'string') return '';
    const lower = category.toLowerCase();
    return lower.length === 64 && isHex(lower) ? lower : '';
  }

  // ---------------------------------------------------------------------------
  // Test helper: addTokenUtxos / addTokenUtxosDynamic
  // ---------------------------------------------------------------------------

  async addTokenUtxos(
    outputs: TokenGenesisOutput[],
  ): Promise<{ categoryId: string; utxos: Utxo[] }> {
    return this.addTokenUtxosDynamic(() => outputs);
  }

  async addTokenUtxosDynamic(
    outputsFactory: (categoryId: string) => TokenGenesisOutput[],
  ): Promise<{ categoryId: string; utxos: Utxo[] }> {
    await this.ensureReady();
    await this.rpc.request<GenerateToAddress>('generatetoaddress', 1, this.miningAddress);

    // The genesis input must be VALIDATED LIVE, not merely listed. `listunspent` on this shared wallet reports
    // coins it still believes unspent, so taking the first one produced two different failures on two
    // consecutive runs - `Input not found or already spent` when signing, and `txn-mempool-conflict` when a
    // rapid second genesis reached for the same coin. `pickLiveFundingInput` confirms each candidate with
    // `gettxout` including the mempool, which is the same rule the funding path already follows.
    let genesisInput: ListUnspentItem;
    try {
      genesisInput = await this.pickLiveFundingInput(true);
    } catch {
      await this.createVout0Utxo();
      genesisInput = await this.pickLiveFundingInput(true);
    }
    const categoryId = genesisInput.txid;
    const outputs = outputsFactory(categoryId);
    for (const out of outputs) await this.importAddressIfNeeded(out.address);

    const categoryBin = hexToBin(categoryId);
    const libauthOutputs = outputs.map((out) => ({
      lockingBytecode: this.toLockingBytecode(out.address),
      valueSatoshis: out.satoshis < 546n ? 546n : out.satoshis,
      token: out.token ? {
        category: categoryBin,
        amount: out.token.amount,
        nft: out.token.nft ? {
          capability: out.token.nft.capability,
          commitment: hexToBin(out.token.nft.commitment),
        } : undefined,
      } : undefined,
    }));

    // X74. The genesis keeps a minting NFT for this category at the provider's own address, so a later
    // addUtxo can mint INTO the category instead of substituting a fresh one. It is appended after every
    // requested output, so the caller's vouts are unchanged; `collectCreatedUtxos` skips it by vout.
    const retainedVout = libauthOutputs.length;
    const unsignedTx = this.buildLibauthTx(
      genesisInput, [...libauthOutputs, this.retainedMintingOutput(categoryId)],
    );
    const txid = await this.fundSignSend(unsignedTx);
    await this.mine(1);
    this.recordCategory(categoryId, txid, retainedVout);

    return this.collectCreatedUtxos(txid, categoryId, outputs, retainedVout);
  }

  // ---------------------------------------------------------------------------
  // Test helper: mine / reset / snapshots / time travel
  // ---------------------------------------------------------------------------

  async mine(count: number = 1): Promise<void> {
    await this.ensureReady();
    if (this.pendingBlockTimestamp !== undefined) {
      await this.setMockTime(this.pendingBlockTimestamp);
      this.mockTime = this.pendingBlockTimestamp;
      this.tipTime = this.pendingBlockTimestamp;
      this.pendingBlockTimestamp = undefined;
    }
    await this.rpc.request<GenerateToAddress>('generatetoaddress', count, this.miningAddress);
    // BCHN admits an nLocktime only below median-time-past, and the SDK stamps one second behind
    // `getBlockTime()`. Track the node's MTP rather than the newest header's wall-clock time.
    this.tipTime = await this.readTipTime();
    this.fundingCandidates = undefined;
  }

  /**
   * Clear provider caches without rewinding the chain. Fixture snapshots own chain rewinds; a reset that
   * invalidated blocks would also invalidate those snapshots, so the chain is left alone here.
   */
  async reset(): Promise<void> {
    this.fundingCandidates = undefined;
    this.feeFunderPool.clear();
    this.feeFunderRefill.clear();
    this.feeFunderSizeRequests.clear();
    this.pendingBlockTimestamp = undefined;
    this.mockTime = 0;
    await this.setMockTime(0);
    this.tipTime = await this.readTipTime();
  }

  /** Median-time-past of the tip, which is the node's time basis for nLocktime finality. */
  getBlockTime(): number {
    return this.tipTime || Math.floor(Date.now() / 1000);
  }

  /** Apply a timestamp to the next mined block. The node is only changed when that block is mined. */
  setNextBlockTimestamp(timestamp: number | bigint): void {
    this.pendingBlockTimestamp = Number(timestamp);
  }

  /**
   * Advance the node's mock clock. Median-time-past only moves after several blocks, so mine a full
   * median window (11 blocks) at the new time; the SDK's stamp and the node's finality check then agree.
   */
  async increaseTime(seconds: number | bigint): Promise<number> {
    const base = this.tipTime || Math.floor(Date.now() / 1000);
    const timestamp = Math.max(0, base + Number(seconds));
    await this.setMockTime(timestamp);
    this.mockTime = timestamp;
    await this.mine(11);
    return timestamp;
  }

  async takeSnapshot(): Promise<SnapshotRestorer> {
    await this.ensureReady();
    const height = await this.readRpc.request<GetBlockCount>('getblockcount');
    const hash = await this.readRpc.request<GetBlockHash>('getblockhash', height);
    const snapshotId = `regtest-${this.snapshotNonce++}`;
    const state: RegtestSnapshotState = {
      height,
      hash,
      mockTime: this.mockTime,
      tipTime: this.tipTime,
      pendingBlockTimestamp: this.pendingBlockTimestamp,
      retainedMinting: new Map(this.retainedMinting),
      categoryOfLabel: new Map(this.categoryOfLabel),
      importedAddresses: new Set(this.importedAddresses),
      tokenUtxos: new Map([...this.tokenUtxos].map(([category, bucket]) => [category, new Map(bucket)])),
    };
    return {
      snapshotId,
      restore: async (): Promise<void> => {
        await this.restoreSnapshot(state);
      },
    };
  }

  /**
   * Hardhat's raw JSON-RPC surface. The EVM time helpers map to BCHN's regtest mock clock; snapshot and mine
   * map to the same primitives `loadFixture` uses.
   */
  async send(method: string, params: unknown[] = []): Promise<unknown> {
    switch (method) {
      case 'evm_snapshot': {
        const restorer = await this.takeSnapshot();
        this.snapshotRestorers.set(restorer.snapshotId, restorer);
        return restorer.snapshotId;
      }
      case 'evm_revert': {
        const restorer = this.snapshotRestorers.get(String(params[0]));
        if (!restorer) return false;
        await restorer.restore();
        return true;
      }
      case 'evm_mine':
        await this.mine(1);
        return '0x0';
      case 'evm_increaseTime':
        return this.increaseTime(Number(params[0]));
      case 'evm_setNextBlockTimestamp':
        this.setNextBlockTimestamp(Number(params[0]));
        return null;
      case 'evm_setAutomine':
      case 'evm_setIntervalMining':
        return null; // every broadcast already mines one block
      case 'eth_blockNumber':
        return `0x${(await this.getBlockHeight()).toString(16)}`;
      case 'eth_chainId':
      case 'net_version':
        return '0x0';
      default:
        throw new Error(`RegtestNetworkProvider.send: unsupported JSON-RPC method '${method}'.`);
    }
  }

  /**
   * Rewind to a snapshot by invalidating the first block above it. BCHN returns the disconnected
   * transactions to the mempool, so `clearmempool` drops them before the next test starts.
   */
  private async restoreSnapshot(state: RegtestSnapshotState): Promise<void> {
    const height = await this.readRpc.request<GetBlockCount>('getblockcount');
    if (height < state.height) {
      throw new Error(
        `regtest snapshot restore: chain is at ${height}, below snapshot height ${state.height}`,
      );
    }
    if (height > state.height) {
      const firstAbove = await this.readRpc.request<GetBlockHash>('getblockhash', state.height + 1);
      await this.rpc.request<InvalidateBlock>('invalidateblock', firstAbove);
    }
    const restoredHash = await this.readRpc.request<GetBlockHash>('getblockhash', state.height);
    if (restoredHash !== state.hash) {
      throw new Error(
        `regtest snapshot restore: block ${state.height} is ${restoredHash}, expected ${state.hash}`,
      );
    }
    await this.rpc.request<ClearMempool>('clearmempool');

    this.retainedMinting = new Map(state.retainedMinting);
    this.categoryOfLabel = new Map(state.categoryOfLabel);
    this.importedAddresses = new Set(state.importedAddresses);
    this.tokenUtxos = new Map(
      [...state.tokenUtxos].map(([category, bucket]) => [category, new Map(bucket)]),
    );
    this.fundingCandidates = undefined;
    this.feeFunderPool.clear();
    this.feeFunderRefill.clear();
    this.feeFunderSizeRequests.clear();
    this.pendingBlockTimestamp = state.pendingBlockTimestamp;
    this.mockTime = state.mockTime;
    this.tipTime = state.tipTime;
    await this.setMockTime(state.mockTime);
  }

  private async readTipTime(): Promise<number> {
    const height = await this.readRpc.request<GetBlockCount>('getblockcount');
    const hash = await this.readRpc.request<GetBlockHash>('getblockhash', height);
    const header = await this.readRpc.request<GetBlockHeaderTime>('getblockheader', hash, true);
    return header.mediantime;
  }

  private async setMockTime(timestamp: number): Promise<void> {
    await this.rpc.request<SetMockTime>('setmocktime', timestamp);
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private trackTokenOutputs(txHex: string, txid: string): void {
    const tx = decodeTransactionUnsafe(hexToBin(txHex));
    for (const input of tx.inputs) {
      const key = `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`;
      for (const bucket of this.tokenUtxos.values()) bucket.delete(key);
    }
    tx.outputs.forEach((output, vout) => {
      if (output.token === undefined) return;
      const category = binToHex(output.token.category);
      const utxo: Utxo = {
        txid,
        vout,
        satoshis: output.valueSatoshis,
        lockingBytecode: output.lockingBytecode.slice(),
        confirmations: 1,
        token: {
          amount: output.token.amount,
          category,
          nft: output.token.nft ? {
            capability: output.token.nft.capability,
            commitment: binToHex(output.token.nft.commitment),
          } : undefined,
        },
      };
      let bucket = this.tokenUtxos.get(category);
      if (!bucket) {
        bucket = new Map();
        this.tokenUtxos.set(category, bucket);
      }
      bucket.set(`${txid}:${vout}`, utxo);
    });
  }

  private buildLibauthTx(
    input: { txid: string; vout: number },
    outputs: Array<{ lockingBytecode: Uint8Array; valueSatoshis: bigint; token?: any }>,
  ): string {
    return binToHex(encodeTransaction({
      version: 2,
      inputs: [{
        outpointTransactionHash: hexToBin(input.txid),
        outpointIndex: input.vout,
        unlockingBytecode: new Uint8Array(),
        sequenceNumber: 0xfffffffe,
      }],
      outputs,
      locktime: 0,
    }));
  }

  // Query only large coins (mature coinbases): the shared wallet can list spent small coins as
  // spendable, which fundrawtransaction then picks, breaking broadcast with "Missing inputs".
  //
  // `listunspent` scans the WHOLE wallet, and a long suite grows it without bound: measured at 18 ms on a fresh
  // chain and 4,690 ms once the wallet reached about 20,000 UTXOs, called at every genesis and every funder
  // refill. Cache the candidate list instead and re-list only when it runs out. Correctness does not rest on the
  // cache being fresh: every candidate is still confirmed live with `gettxout` before use, and a stale entry is
  // simply dropped, which is the same check this function always made.
  private async pickLiveFundingInput(vout0Only: boolean): Promise<ListUnspentItem> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (this.fundingCandidates === undefined) {
        this.fundingCandidates = (await this.readRpc.request<ListUnspent>(
          'listunspent', 1, 9999999, [], true, { minimumAmount: 1 },
        ))
          .filter((u) => u.spendable)
          .sort((a, b) => (a.amount < b.amount ? 1 : -1));
      }
      const pool = this.fundingCandidates;
      for (let i = 0; i < pool.length; i += 1) {
        const u = pool[i];
        if (vout0Only && u.vout !== 0) continue;
        // eslint-disable-next-line no-await-in-loop
        const out = await this.readRpc.request<GetTxOut>('gettxout', u.txid, u.vout, true) as
          GetTxOut['response'] | null;
        pool.splice(i, 1);
        if (out) return u;
        i -= 1;
      }
      // Nothing usable left in the cache. Re-list once; a second miss is a real exhaustion.
      this.fundingCandidates = undefined;
    }
    throw new Error('No live wallet UTXOs available (>=1 BCH). Mine more blocks.');
  }

  private async fundSignSend(unsignedHex: string): Promise<string> {
    // Count outputs to place change after them
    const decoded = decodeTransactionUnsafe(hexToBin(unsignedHex));
    const funded = await this.rpc.request<FundRawTransaction>(
      'fundrawtransaction', unsignedHex, { changePosition: decoded.outputs.length },
    );
    const signed = await this.rpc.request<SignRawTransactionWithWallet>(
      'signrawtransactionwithwallet', funded.hex,
    );
    if (!signed.complete) {
      throw new Error(`Failed to sign: ${signed.errors?.map((e) => e.error).join(', ')}`);
    }
    const txid = await this.rpc.request<SendRawTransaction>('sendrawtransaction', signed.hex);
    this.trackTokenOutputs(signed.hex, txid);
    return txid;
  }

  // The requested output is always built first and `fundSignSend` appends change AFTER every output it was
  // given, so the caller's output is at a known vout rather than one searched for by satoshi value.
  private async decodeOutputAt(txid: string, vout: number): Promise<Utxo> {
    const rawHex = await this.readRpc.request<GetRawTransactionVerbosity0>('getrawtransaction', txid, false);
    const decoded = decodeTransactionUnsafe(hexToBin(rawHex));
    const match = decoded.outputs[vout];
    return {
      txid, vout,
      satoshis: match.valueSatoshis,
      token: match.token ? {
        amount: match.token.amount,
        category: binToHex(match.token.category),
        nft: match.token.nft ? {
          capability: match.token.nft.capability as 'none' | 'mutable' | 'minting',
          commitment: binToHex(match.token.nft.commitment),
        } : undefined,
      } : undefined,
    };
  }

  private async collectCreatedUtxos(
    txid: string, categoryId: string, outputs: TokenGenesisOutput[], retainedVout?: number,
  ): Promise<{ categoryId: string; utxos: Utxo[] }> {
    const rawHex = await this.readRpc.request<GetRawTransactionVerbosity0>('getrawtransaction', txid, false);
    const decoded = decodeTransactionUnsafe(hexToBin(rawHex));

    const tokenOutputs = decoded.outputs
      .map((o, i) => ({ output: o, vout: i }))
      .filter(({ vout }) => vout !== retainedVout)
      .filter(({ output }) => output.token && binToHex(output.token.category) === categoryId)
      .map(({ output, vout }) => ({
        txid, vout,
        satoshis: output.valueSatoshis,
        token: output.token ? {
          amount: output.token.amount,
          category: binToHex(output.token.category),
          nft: output.token.nft ? {
            capability: output.token.nft.capability as 'none' | 'mutable' | 'minting',
            commitment: binToHex(output.token.nft.commitment),
          } : undefined,
        } : undefined,
      }));

    const utxos: Utxo[] = [];
    const used = new Set<number>();
    for (let i = 0; i < outputs.length; i++) {
      const m = tokenOutputs.find((u) => !used.has(u.vout));
      if (!m) throw new Error(`Token UTXO not found (txid=${txid}, cat=${categoryId}, ${tokenOutputs.length}/${outputs.length})`);
      used.add(m.vout);
      utxos.push(m);
    }
    return { categoryId, utxos };
  }

  // CashTokens genesis must spend an outpoint at index 0, so the wallet needs coins at vout 0 worth at least
  // the `minimumAmount: 1` that `pickLiveFundingInput` filters on. Mining cannot supply them: regtest halves the
  // subsidy every 150 blocks, so past roughly height 2,500 every coinbase is worth zero. `sendtoaddress` cannot
  // either - it picks the change position itself, and on this fragmented wallet it puts small change at vout 0
  // and the payment at vout 1, satisfying neither filter. Build the transaction explicitly instead: the
  // requested output takes vout 0 and `fundSignSend` appends change after it.
  private async createVout0Utxo(): Promise<void> {
    const addr = await this.rpc.request<GetNewAddress>('getnewaddress', 'vout0');
    await this.importAddressIfNeeded(addr);
    const fundingInput = await this.pickLiveFundingInput(false);
    const unsignedHex = this.buildLibauthTx(fundingInput, [{
      lockingBytecode: this.toLockingBytecode(addr),
      valueSatoshis: RegtestNetworkProvider.VOUT0_FUNDING_SATOSHIS,
    }]);
    await this.fundSignSend(unsignedHex);
    await this.mine(1);
    // The coin just minted is not in the cached list, and the caller is about to ask for exactly it.
    this.fundingCandidates = undefined;
  }

  // One builder path asks for `neededFee + DUST + deficit`, which differs almost every call, so batching 20 coins
  // for every distinct value would mint 20 to spend 1 and bloat the wallet - and `pickLiveFundingInput` is
  // already O(wallet). Batch only values that have been asked for before; mint exactly one the first time.
  private async refillFeeFunderPool(satoshis: bigint): Promise<void> {
    const seen = (this.feeFunderSizeRequests.get(satoshis) ?? 0) + 1;
    this.feeFunderSizeRequests.set(satoshis, seen);
    const POOL_SIZE = seen > 1 ? 20 : 1;
    const pool = this.feeFunderPool.get(satoshis) ?? [];
    if (pool.length >= POOL_SIZE) return;
    const needed = POOL_SIZE - pool.length;
    const lbc = hexToBin(RegtestNetworkProvider.DUMMY_FUNDER_LBC);

    // Seed with one validated-live coin so fundrawtransaction never reaches for stale
    // small coins. Funders land at vouts 0..needed-1; fundSignSend appends change after them.
    const fundingInput = await this.pickLiveFundingInput(false);
    const unsignedHex = this.buildLibauthTx(
      fundingInput,
      Array.from({ length: needed }, () => ({ lockingBytecode: lbc, valueSatoshis: satoshis })),
    );
    const txid = await this.fundSignSend(unsignedHex);
    await this.mine(1);
    for (let i = 0; i < needed; i++) pool.push({ txid, vout: i, satoshis });
    this.feeFunderPool.set(satoshis, pool);
  }

  private async ensureReady(): Promise<void> {
    if (!this.ready) this.ready = this.initialize();
    return this.ready;
  }

  private async initialize(): Promise<void> {
    this.miningAddress = await this.rpc.request<GetNewAddress>('getnewaddress', 'mining');
    // X74. A dedicated wallet address holds the retained minting NFTs. It is never mined to and never handed
    // out as a funding coin (`pickLiveFundingInput` and `fundrawtransaction` both skip token UTXOs), so the
    // capability survives for the life of the provider.
    this.retainAddress = await this.rpc.request<GetNewAddress>('getnewaddress', 'retained-minting');
    this.retainLockingBytecode = this.toLockingBytecode(this.retainAddress);
    const height = await this.readRpc.request<GetBlockCount>('getblockcount');
    if (height < 200) {
      await this.rpc.request<GenerateToAddress>('generatetoaddress', 200 - height, this.miningAddress);
    }
    this.tipTime = await this.readTipTime();
  }

  private toLockingBytecode(addressOrHex: string): Uint8Array {
    if (isHex(addressOrHex)) return hexToBin(addressOrHex);
    const result = cashAddressToLockingBytecode(addressOrHex);
    if (typeof result === 'string') throw new Error(`Invalid address: ${addressOrHex}`);
    return result.bytecode;
  }

  private async importAddressIfNeeded(address: string): Promise<void> {
    if (this.importedAddresses.has(address)) return;
    try { await this.rpc.request<ImportAddress>('importaddress', address, '', false); } catch { /* */ }
    this.importedAddresses.add(address);
  }

  private listUnspentItemToUtxo(u: ListUnspentItem): Utxo {
    return {
      txid: u.txid,
      vout: u.vout,
      satoshis: BigInt(u.amount.toFixed(8).replace('.', '')),
      lockingBytecode: hexToBin(u.scriptPubKey),
      confirmations: u.confirmations,
      token: u.tokenData ? {
        amount: BigInt(u.tokenData.amount),
        category: u.tokenData.category,
        nft: u.tokenData.nft,
      } : undefined,
    };
  }
}
