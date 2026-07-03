import { binToHex, hexToBin, isHex } from '@bitauth/libauth';
import { sha256 } from '@solidcash/utils';
import { createIndexer, type Indexer } from '@mem-cash/electrum';
import { createTxVerifier } from '@mem-cash/validation';
import { Utxo, Network, VmTarget, TokenDetails } from '../interfaces.js';
import NetworkProvider from './NetworkProvider.js';
import { addressToLockScript, randomUtxo } from '../utils.js';
import { DEFAULT_VM_TARGET } from '../libauth-template/utils.js';
import { HDSigner, signersFromMnemonic } from '../HDSigner.js';

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

  // The default hardhat dev mnemonic (a valid BIP-39 phrase); its accounts are the ones getSigners funds.
  static readonly DEFAULT_MNEMONIC = 'test test test test test test test test test test test junk';

  private fundingNonce = 0x1000;

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

  // Test helper mirroring RegtestNetworkProvider: advance the simulated chain tip so height-mode locktimes
  // become final and each mined height is fresh.
  async mine(count: number = 1): Promise<void> {
    this.setBlockHeight(this.blockHeight + count);
  }

  async getBlockHash(height: number): Promise<string> {
    const buf = new Uint8Array(4);
    new DataView(buf.buffer).setUint32(0, height >>> 0, true);
    return binToHex(sha256(buf)); // deterministic synthetic hash - the mock chain has no real blocks
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

  private nextFundingTxid(): string {
    return (this.fundingNonce++).toString(16).padStart(64, '0');
  }

  /**
   * The hardhat `ethers.getSigners()` analogue: `count` HD signers derived from {@link DEFAULT_MNEMONIC}
   * (m/44'/145'/0'/0/i), each pre-funded with a genesis-valid UTXO on this provider. Destructure the famous
   * way: `const [owner, addr1] = await provider.getSigners();`. Each is an HDSigner - a drop-in ContractFactory
   * runner. `fundingUtxos > 1` gives every account multiple funding UTXOs (for accounts that deploy repeatedly).
   */
  async getSigners(
    count = 20,
    opts: { satoshis?: bigint; mnemonic?: string; fundingUtxos?: number } = {},
  ): Promise<HDSigner[]> {
    const satoshis = opts.satoshis ?? 1_000_000n;
    const fundingUtxos = opts.fundingUtxos ?? 1;
    const signers = signersFromMnemonic(opts.mnemonic ?? MockNetworkProvider.DEFAULT_MNEMONIC, this, { count });
    for (const signer of signers) {
      for (let i = 0; i < fundingUtxos; i++) {
        await this.addUtxo(signer.getAddress(), { txid: this.nextFundingTxid(), vout: 0, satoshis });
      }
    }
    return signers;
  }

  /** A single pre-funded HD signer at `index` (hardhat `ethers.getSigner`). */
  async getSigner(index = 0, opts: { satoshis?: bigint; mnemonic?: string } = {}): Promise<HDSigner> {
    const [signer] = signersFromMnemonic(
      opts.mnemonic ?? MockNetworkProvider.DEFAULT_MNEMONIC, this, { initialIndex: index, count: 1 },
    );
    await this.addUtxo(signer.getAddress(), {
      txid: this.nextFundingTxid(), vout: 0, satoshis: opts.satoshis ?? 1_000_000n,
    });
    return signer;
  }
}

// Test helper: a MockNetworkProvider whose sendRawTransaction always fails.
export class FailingMockNetworkProvider extends MockNetworkProvider {
  async sendRawTransaction(_txHex: string): Promise<string> {
    throw new Error('broadcast failed');
  }
}
