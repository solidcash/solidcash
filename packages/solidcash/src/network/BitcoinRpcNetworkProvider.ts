import { type Utxo, Network } from '../interfaces.js';
import type NetworkProvider from './NetworkProvider.js';
import {
  BchnRpcClient,
  type GetBlockCount,
  type GetRawTransactionVerbosity0,
  type ListUnspent,
  type SendRawTransaction,
} from '@mr-zwets/bchn-api-wrapper';

interface GetBlockHash {
  method: 'getblockhash';
  params: [height: number];
  response: string;
}

interface GetBlockHeaderTime {
  method: 'getblockheader';
  params: [hash: string, verbosity: true];
  response: { mediantime: number };
}

export default class BitcoinRpcNetworkProvider implements NetworkProvider {
  private rpcClient: BchnRpcClient;

  constructor(
    public network: Network,
    url: string,
    opts: {
      rpcUser: string;
      rpcPassword: string;
    },
  ) {
    this.rpcClient = new BchnRpcClient({ url, ...opts });
  }

  async getUtxos(address: string): Promise<Utxo[]> {
    const result = await this.rpcClient.request<ListUnspent>('listunspent', 0, 9999999, [address]);

    const utxos = result.map((utxo) => ({
      txid: utxo.txid,
      vout: utxo.vout,
      // Parse from string to avoid floating-point precision loss with * 1e8
      satoshis: BigInt(utxo.amount.toFixed(8).replace('.', '')),
      confirmations: utxo.confirmations,
    }));

    return utxos;
  }

  async getUtxosForLockingBytecode(_lockingBytecode: Uint8Array | string): Promise<Utxo[]> {
    throw new Error('BitcoinRpcNetworkProvider does not support getUtxosForLockingBytecode');
  }

  async getBlockHeight(): Promise<number> {
    return this.rpcClient.request<GetBlockCount>('getblockcount');
  }

  async getMedianTimePast(): Promise<number> {
    const height = await this.rpcClient.request<GetBlockCount>('getblockcount');
    const hash = await this.rpcClient.request<GetBlockHash>('getblockhash', height);
    const header = await this.rpcClient.request<GetBlockHeaderTime>('getblockheader', hash, true);
    return header.mediantime;
  }

  async getRawTransaction(txid: string): Promise<string> {
    return this.rpcClient.request<GetRawTransactionVerbosity0>('getrawtransaction', txid, 0);
  }

  async sendRawTransaction(txHex: string): Promise<string> {
    return this.rpcClient.request<SendRawTransaction>('sendrawtransaction', txHex);
  }

  getClient(): BchnRpcClient {
    return this.rpcClient;
  }
}
