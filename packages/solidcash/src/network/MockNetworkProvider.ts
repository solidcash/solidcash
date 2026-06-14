import { binToHex, hexToBin, isHex } from '@bitauth/libauth';
import { sha256 } from '@solidcash/utils';
import { createIndexer, type Indexer } from '@mem-cash/electrum';
import { createTxVerifier } from '@mem-cash/validation';
import { Utxo, Network, VmTarget, TokenDetails } from '../interfaces.js';
import NetworkProvider from './NetworkProvider.js';
import { addressToLockScript, randomUtxo } from '../utils.js';
import { DEFAULT_VM_TARGET } from '../libauth-template/utils.js';

export interface TokenGenesisOutput {
  address: string;
  satoshis: bigint;
  token?: Omit<TokenDetails, 'category'>;
}

export interface MockNetworkProviderOptions {
  updateUtxoSet: boolean;
  vmTarget?: VmTarget;
}

export default class MockNetworkProvider implements NetworkProvider {
  public indexer: Indexer;
  public network: Network = Network.MOCKNET;
  public blockHeight: number = 133700;
  public options: MockNetworkProviderOptions;
  public vmTarget: VmTarget;

  constructor(options?: Partial<MockNetworkProviderOptions>) {
    this.options = { updateUtxoSet: true, ...options };
    this.vmTarget = this.options.vmTarget ?? DEFAULT_VM_TARGET;

    const verifier = createTxVerifier({
      vmVersion: this.vmTarget, standard: true, minRelayFeePerKb: 1000n, maxFee: 10_000_000n,
    });
    this.indexer = createIndexer({ verifier });
    this.indexer.setChainTip(this.blockHeight, 1700000000);
  }

  async getUtxos(address: string): Promise<Utxo[]> {
    const lockingBytecode = addressToLockScript(address);
    return this.getUtxosForLockingBytecode(lockingBytecode);
  }

  async getUtxosForLockingBytecode(lockingBytecode: Uint8Array | string): Promise<Utxo[]> {
    const bin = typeof lockingBytecode === 'string' ? hexToBin(lockingBytecode) : lockingBytecode;
    const scriptHash = binToHex(sha256(bin));
    return this.indexer.getUtxos(scriptHash).map((entry) => ({
      txid: entry.outpoint.txid,
      vout: entry.outpoint.vout,
      satoshis: entry.satoshis,
      token: entry.tokenData ? {
        amount: entry.tokenData.amount,
        category: entry.tokenData.category,
        nft: entry.tokenData.nft,
      } : undefined,
    }));
  }

  setBlockHeight(newBlockHeight: number): void {
    this.blockHeight = newBlockHeight;
    this.indexer.setChainTip(newBlockHeight, 1700000000);
  }

  async getBlockHeight(): Promise<number> {
    return this.blockHeight;
  }

  async getRawTransaction(txid: string): Promise<string> {
    return this.indexer.getRawTx(txid)!;
  }

  async sendRawTransaction(txHex: string): Promise<string> {
    if (!this.options.updateUtxoSet) {
      const bin = hexToBin(txHex);
      const txid = binToHex(sha256(sha256(bin)).reverse());
      this.indexer.storage.storeRawTx(txid, txHex);
      return txid;
    }

    const result = this.indexer.submitTransaction(txHex);
    if (!result.success) {
      throw new Error(result.debugMessage ? `${result.error}: ${result.debugMessage}` : result.error);
    }

    // Mine a block to confirm the transaction immediately. This moves outputs
    // from the mempool to the confirmed UTXO set and clears mempool spend
    // tracking, matching the old MockNetworkProvider's simple UTXO-array behavior.
    this.indexer.mine();

    return result.txid;
  }

  async addUtxo(addressOrLockingBytecode: string, utxo: Utxo): Promise<Utxo> {
    const lockingBytecodeBin = isHex(addressOrLockingBytecode)
      ? hexToBin(addressOrLockingBytecode)
      : addressToLockScript(addressOrLockingBytecode);

    const scriptHash = binToHex(sha256(lockingBytecodeBin));

    this.indexer.addUtxo({
      txid: utxo.txid,
      vout: utxo.vout,
      satoshis: utxo.satoshis,
      scriptHash,
      height: 100,
      lockingBytecode: lockingBytecodeBin,
      tokenData: utxo.token ? {
        category: utxo.token.category,
        amount: utxo.token.amount,
        nft: utxo.token.nft,
      } : undefined,
    });

    return utxo;
  }

  async addTokenUtxos(
    outputs: TokenGenesisOutput[],
  ): Promise<{ categoryId: string; utxos: Utxo[] }> {
    return this.addTokenUtxosDynamic(() => outputs);
  }

  async addTokenUtxosDynamic(
    outputsFactory: (categoryId: string) => TokenGenesisOutput[],
  ): Promise<{ categoryId: string; utxos: Utxo[] }> {
    // Generate a random non-palindrome category ID (simulates a real genesis txid)
    const categoryId = randomUtxo().txid;
    const outputs = outputsFactory(categoryId);

    const utxos: Utxo[] = [];
    for (let i = 0; i < outputs.length; i++) {
      const out = outputs[i];
      const utxo: Utxo = {
        txid: categoryId,
        vout: i,
        satoshis: out.satoshis,
        token: out.token ? {
          category: categoryId,
          amount: out.token.amount ?? 0n,
          nft: out.token.nft,
        } : undefined,
      };
      await this.addUtxo(out.address, utxo);
      utxos.push(utxo);
    }

    return { categoryId, utxos };
  }

  reset(): void {
    this.indexer.reset();
    this.indexer.setChainTip(this.blockHeight, 1700000000);
  }
}

// Test helper: a MockNetworkProvider whose sendRawTransaction always fails.
export class FailingMockNetworkProvider extends MockNetworkProvider {
  async sendRawTransaction(_txHex: string): Promise<string> {
    throw new Error('broadcast failed');
  }
}
