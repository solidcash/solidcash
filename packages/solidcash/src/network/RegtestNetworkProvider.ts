import {
  BchnRpcClient,
  type GenerateToAddress,
  type GetBlockCount,
  type GetBlockHash,
  type GetNewAddress,
  type SendToAddress,
  type FundRawTransaction,
  type SignRawTransactionWithWallet,
  type SendRawTransaction,
  type GetRawTransactionVerbosity0,
  type GetTxOut,
  type ListUnspent,
  type ListUnspentItem,
  type ImportAddress,
} from '@mr-zwets/bchn-api-wrapper';
import {
  hexToBin, binToHex, isHex, decodeTransactionUnsafe, encodeTransaction,
  cashAddressToLockingBytecode, lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import { Utxo, Network, TokenDetails } from '../interfaces.js';
import NetworkProvider from './NetworkProvider.js';
import { getNetworkPrefix } from '../utils.js';

export interface RegtestProviderOptions {
  rpcUrl?: string;
  rpcUser?: string;
  rpcPassword?: string;
}

export interface TokenGenesisOutput {
  address: string;
  satoshis: bigint;
  token?: Omit<TokenDetails, 'category'>;
}

export default class RegtestNetworkProvider implements NetworkProvider {
  public network: Network = Network.REGTEST;

  private rpc: BchnRpcClient;
  private miningAddress: string = '';
  private ready: Promise<void> | undefined;
  private importedAddresses = new Set<string>();

  constructor(options: RegtestProviderOptions = {}) {
    const {
      rpcUrl = 'http://localhost:18443',
      rpcUser = 'user',
      rpcPassword = 'password',
    } = options;

    // 30s (vs the wrapper's 5s default): network-heavy flows like external-call auto-derivation make many
    // sequential getUtxos round-trips against a live node, which can exceed the default per-request timeout.
    this.rpc = new BchnRpcClient({
      url: rpcUrl, rpcUser, rpcPassword, timeoutMs: 30_000,
    });
  }

  // ---------------------------------------------------------------------------
  // NetworkProvider interface - all via BCHN RPC
  // ---------------------------------------------------------------------------

  async getUtxos(address: string): Promise<Utxo[]> {
    await this.ensureReady();
    await this.importAddressIfNeeded(address);
    // Token-aware addresses request token UTXOs; plain addresses skip them (shared-node safety).
    const decoded = isHex(address) ? undefined : cashAddressToLockingBytecode(address);
    const includeTokens = typeof decoded === 'object' ? decoded.tokenSupport : true;
    const result = includeTokens
      ? await this.rpc.request<ListUnspent>('listunspent', 0, 9999999, [address], false, { includeTokens: true })
      : await this.rpc.request<ListUnspent>('listunspent', 0, 9999999, [address], false);
    return result.map((u) => this.listUnspentItemToUtxo(u));
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
      // Non-standard script - can't convert to address for listunspent
      return [];
    }
    const utxos: Utxo[] = [];
    for (const addr of addresses) {
      utxos.push(...await this.getUtxos(addr));
    }
    return utxos;
  }

  async getBlockHeight(): Promise<number> {
    await this.ensureReady();
    return this.rpc.request<GetBlockCount>('getblockcount');
  }

  async getBlockHash(height: number): Promise<string> {
    await this.ensureReady();
    return this.rpc.request<GetBlockHash>('getblockhash', height);
  }

  async getRawTransaction(txid: string): Promise<string> {
    await this.ensureReady();
    return this.rpc.request<GetRawTransactionVerbosity0>('getrawtransaction', txid, false);
  }

  async sendRawTransaction(txHex: string): Promise<string> {
    await this.ensureReady();
    const txid = await this.rpc.request<SendRawTransaction>('sendrawtransaction', txHex);
    await this.mine(1);
    return txid;
  }

  // ---------------------------------------------------------------------------
  // Test helper: addUtxo
  // ---------------------------------------------------------------------------

  private feeFunderPool: Utxo[] = [];
  private static readonly DUMMY_FUNDER_LBC = 'aa20953ccfa596a6c6d39e5980194539124fdcff116a571455a212baed811f585ee087';

  async addUtxo(address: string, utxo: Utxo): Promise<Utxo> {
    await this.ensureReady();

    // Fast path: serve pre-created fee funders for the STB dummy pattern
    if (address === RegtestNetworkProvider.DUMMY_FUNDER_LBC && !utxo.token) {
      if (this.feeFunderPool.length === 0) await this.refillFeeFunderPool();
      if (this.feeFunderPool.length > 0) {
        const pooled = this.feeFunderPool.pop()!;
        utxo.txid = pooled.txid;
        utxo.vout = pooled.vout;
        utxo.satoshis = pooled.satoshis;
        return pooled;
      }
    }

    if (!isHex(address)) await this.importAddressIfNeeded(address);

    const satoshis = utxo.satoshis < 546n ? 546n : utxo.satoshis;
    let fundingInput: ListUnspentItem;
    try {
      fundingInput = await this.pickLiveFundingInput(!!utxo.token);
    } catch (e) {
      if (utxo.token) { await this.createVout0Utxo(); return this.addUtxo(address, utxo); }
      throw e;
    }
    const lbc = this.toLockingBytecode(address);
    let txid: string;

    if (utxo.token) {
      const unsignedTx = this.buildLibauthTx(fundingInput, [{
        lockingBytecode: lbc,
        valueSatoshis: satoshis,
        token: {
          category: hexToBin(fundingInput.txid),
          amount: utxo.token.amount,
          nft: utxo.token.nft ? {
            capability: utxo.token.nft.capability,
            commitment: hexToBin(utxo.token.nft.commitment),
          } : undefined,
        },
      }]);
      txid = await this.fundSignSend(unsignedTx);
    } else {
      const unsignedTx = this.buildLibauthTx(fundingInput, [{
        lockingBytecode: lbc, valueSatoshis: satoshis,
      }]);
      txid = await this.fundSignSend(unsignedTx);
    }

    await this.mine(1);
    const result = await this.decodeOurOutput(txid, satoshis, !!utxo.token);
    utxo.txid = result.txid;
    utxo.vout = result.vout;
    utxo.satoshis = result.satoshis;
    if (result.token) utxo.token = result.token;
    return result;
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

    const walletUtxos = (await this.rpc.request<ListUnspent>('listunspent', 1, 9999999))
      .filter((u) => u.spendable && u.vout === 0);
    if (walletUtxos.length === 0) {
      await this.createVout0Utxo();
      return this.addTokenUtxosDynamic(outputsFactory);
    }

    const genesisInput = walletUtxos[0];
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

    const unsignedTx = this.buildLibauthTx(genesisInput, libauthOutputs);
    const txid = await this.fundSignSend(unsignedTx);
    await this.mine(1);

    return this.collectCreatedUtxos(txid, categoryId, outputs);
  }

  // ---------------------------------------------------------------------------
  // Test helper: mine / reset
  // ---------------------------------------------------------------------------

  async mine(count: number = 1): Promise<void> {
    await this.ensureReady();
    await this.rpc.request<GenerateToAddress>('generatetoaddress', count, this.miningAddress);
  }

  // eslint-disable-next-line class-methods-use-this
  async reset(): Promise<void> { /* no-op on regtest */ }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private buildLibauthTx(
    input: ListUnspentItem,
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
  private async pickLiveFundingInput(vout0Only: boolean): Promise<ListUnspentItem> {
    const candidates = (await this.rpc.request<ListUnspent>(
      'listunspent', 1, 9999999, [], true, { minimumAmount: 1 },
    ))
      .filter((u) => u.spendable && (!vout0Only || u.vout === 0))
      .sort((a, b) => (a.amount < b.amount ? 1 : -1));
    for (const u of candidates) {
      const out = await this.rpc.request<GetTxOut>('gettxout', u.txid, u.vout, true) as
        GetTxOut['response'] | null;
      if (out) return u;
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
    return this.rpc.request<SendRawTransaction>('sendrawtransaction', signed.hex);
  }

  private async decodeOurOutput(txid: string, satoshis: bigint, hasToken: boolean): Promise<Utxo> {
    const rawHex = await this.rpc.request<GetRawTransactionVerbosity0>('getrawtransaction', txid, false);
    const decoded = decodeTransactionUnsafe(hexToBin(rawHex));
    const match = decoded.outputs.find((o) => !!o.token === hasToken && o.valueSatoshis === satoshis)
      ?? decoded.outputs[0];
    const vout = decoded.outputs.indexOf(match);
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
    txid: string, categoryId: string, outputs: TokenGenesisOutput[],
  ): Promise<{ categoryId: string; utxos: Utxo[] }> {
    const rawHex = await this.rpc.request<GetRawTransactionVerbosity0>('getrawtransaction', txid, false);
    const decoded = decodeTransactionUnsafe(hexToBin(rawHex));

    const tokenOutputs = decoded.outputs
      .map((o, i) => ({ output: o, vout: i }))
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

  private async createVout0Utxo(): Promise<void> {
    const addr = await this.rpc.request<GetNewAddress>('getnewaddress', 'vout0');
    await this.rpc.request<SendToAddress>('sendtoaddress', addr, 1.0);
    await this.mine(1);
  }

  private async refillFeeFunderPool(): Promise<void> {
    const POOL_SIZE = 20;
    if (this.feeFunderPool.length >= POOL_SIZE) return;
    const needed = POOL_SIZE - this.feeFunderPool.length;
    const lbc = hexToBin(RegtestNetworkProvider.DUMMY_FUNDER_LBC);
    const satoshis = 100000n;

    // Seed with one validated-live coin so fundrawtransaction never reaches for stale
    // small coins. Funders land at vouts 0..needed-1; fundSignSend appends change after them.
    const fundingInput = await this.pickLiveFundingInput(false);
    const unsignedHex = this.buildLibauthTx(
      fundingInput,
      Array.from({ length: needed }, () => ({ lockingBytecode: lbc, valueSatoshis: satoshis })),
    );
    const txid = await this.fundSignSend(unsignedHex);
    await this.mine(1);
    for (let i = 0; i < needed; i++) this.feeFunderPool.push({ txid, vout: i, satoshis });
  }

  private async ensureReady(): Promise<void> {
    if (!this.ready) this.ready = this.initialize();
    return this.ready;
  }

  private async initialize(): Promise<void> {
    this.miningAddress = await this.rpc.request<GetNewAddress>('getnewaddress', 'mining');
    const height = await this.rpc.request<GetBlockCount>('getblockcount');
    if (height < 200) {
      await this.rpc.request<GenerateToAddress>('generatetoaddress', 200 - height, this.miningAddress);
    }
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
      token: u.tokenData ? {
        amount: BigInt(u.tokenData.amount),
        category: u.tokenData.category,
        nft: u.tokenData.nft,
      } : undefined,
    };
  }
}
