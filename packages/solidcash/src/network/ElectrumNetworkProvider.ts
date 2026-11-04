import { binToHex, hexToBin, isHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { sha256 } from '@solidcash/utils';
import {
  ElectrumClient,
  type RequestResponse,
  type ElectrumClientEvents,
} from '@electrum-cash/network';
import { ElectrumWebSocket } from '@electrum-cash/web-socket';
import { type Utxo, Network } from '../interfaces.js';
import type NetworkProvider from './NetworkProvider.js';
import { addressToLockScript } from '../utils.js';


interface OptionsBase {
  manualConnectionManagement?: boolean;
  /** Category of the default oracle pool a block.* reader binds, 64 hex characters in display byte order. */
  oraclePoolCategory?: string;
}

interface CustomHostNameOptions extends OptionsBase {
  hostname: string;
}

interface CustomElectrumOptions extends OptionsBase {
  electrum: ElectrumClient<ElectrumClientEvents>;
}

type Options = OptionsBase | CustomHostNameOptions | CustomElectrumOptions;

// Electrum protocol 1.5.0 introduced both the `include_tokens` filter on blockchain.scripthash.listunspent
// and blockchain.headers.get_tip, so this is the lowest version the provider's requests are defined for.
const ELECTRUM_PROTOCOL_VERSION = '1.5.0';

export default class ElectrumNetworkProvider implements NetworkProvider {
  private electrum: ElectrumClient<ElectrumClientEvents>;
  private concurrentRequests: number = 0;
  private manualConnectionManagement: boolean;
  readonly oraclePoolCategory?: string;

  constructor(public network: Network = Network.MAINNET, options: Options = {}) {
    if (options.oraclePoolCategory !== undefined) {
      if (!/^[0-9a-fA-F]{64}$/.test(options.oraclePoolCategory)) {
        throw new Error('oraclePoolCategory must be 32 bytes of hex');
      }
      this.oraclePoolCategory = options.oraclePoolCategory.toLowerCase();
    }
    this.electrum = this.instantiateElectrumClient(network, options);
    this.manualConnectionManagement = options?.manualConnectionManagement ?? false;
  }

  private instantiateElectrumClient(network: Network, options: Options): ElectrumClient<ElectrumClientEvents> {
    if ('electrum' in options) return options.electrum;
    const server = 'hostname' in options ? options.hostname : this.getServerForNetwork(network);
    // 4.4 moved the old disableBrowserVisibilityHandling flag onto the websocket, where the
    // page-hidden disconnect now defaults on. Keep the provider from dropping the socket when a tab is hidden.
    const socket = new ElectrumWebSocket(server, { enforceConsistentBrowserBehavior: false });
    return new ElectrumClient('SolidCash Application', ELECTRUM_PROTOCOL_VERSION, socket);
  }

  // Get Electrum server based on network
  private getServerForNetwork(network: Network): string {
    switch (network) {
      case Network.MAINNET:
        return 'bch.imaginary.cash';
      case Network.TESTNET3:
        return 'testnet.imaginary.cash';
      case Network.TESTNET4:
        return 'testnet4.imaginary.cash';
      case Network.CHIPNET:
        return 'chipnet.bch.ninja';
      default:
        throw new Error(`Unsupported network: ${network}`);
    }
  }

  async getUtxos(address: string): Promise<Utxo[]> {
    const lockingBytecode = addressToLockScript(address);
    return this.getUtxosForLockingBytecode(lockingBytecode);
  }

  async getUtxosForLockingBytecode(lockingBytecode: Uint8Array | string): Promise<Utxo[]> {
    if (typeof lockingBytecode === 'string' && !isHex(lockingBytecode)) {
      throw new Error(`Invalid locking bytecode: ${lockingBytecode} is not a valid hex string`);
    }

    const lockingBytecodeBin = typeof lockingBytecode === 'string' ? hexToBin(lockingBytecode) : lockingBytecode;
    const scriptHash = lockingBytecodeToElectrumScriptHash(lockingBytecodeBin);
    const filteringOption = 'include_tokens';
    const result = await this.performRequest('blockchain.scripthash.listunspent', scriptHash, filteringOption) as ElectrumUtxo[];

    const utxos = result.map((utxo) => ({
      txid: utxo.tx_hash,
      vout: utxo.tx_pos,
      satoshis: BigInt(utxo.value),
      blockHeight: utxo.height,
      token: utxo.token_data ? {
        ...utxo.token_data,
        amount: BigInt(utxo.token_data.amount),
      } : undefined,
    }));

    return utxos;
  }

  async getBlockHeight(): Promise<number> {
    const { height } = await this.performRequest('blockchain.headers.get_tip') as BlockHeader;
    return height;
  }

  async getRawTransaction(txid: string): Promise<string> {
    return await this.performRequest('blockchain.transaction.get', txid) as string;
  }

  async sendRawTransaction(txHex: string): Promise<string> {
    return await this.performRequest('blockchain.transaction.broadcast', txHex) as string;
  }

  async connect(): Promise<void> {
    if (!this.manualConnectionManagement) {
      throw new Error('Manual connection management is disabled');
    }

    return this.electrum.connect();
  }

  async disconnect(): Promise<boolean> {
    if (!this.manualConnectionManagement) {
      throw new Error('Manual connection management is disabled');
    }

    return this.electrum.disconnect();
  }

  async performRequest(
    name: string,
    ...parameters: (string | number | boolean)[]
  ): Promise<RequestResponse> {
    // Increment before any async work, so a request finishing meanwhile does not disconnect this one.
    this.concurrentRequests += 1;

    try {
      // Every request awaits the connection: one started while another was still connecting found the socket down.
      // The client's connect is serialized and returns at once on an open socket.
      if (!this.manualConnectionManagement) {
        await this.electrum.connect();
      }

      const result = await this.electrum.request(name, ...parameters);

      if (result instanceof Error) throw result;

      return result;
    } finally {
      this.concurrentRequests -= 1;

      // Disconnect when no other concurrent requests are running
      if (this.concurrentRequests === 0 && !this.manualConnectionManagement) {
        await this.electrum.disconnect();
      }
    }
  }

}

interface ElectrumUtxo {
  tx_pos: number;
  value: number;
  tx_hash: string;
  height: number;
  token_data?: {
    amount: string;
    category: string;
    nft?: {
      capability: 'none' | 'mutable' | 'minting';
      commitment: string;
    };
  };
}

interface BlockHeader {
  height: number;
  hex: string;
}

function lockingBytecodeToElectrumScriptHash(lockingBytecode: Uint8Array): string {
  const scriptHash = sha256(lockingBytecode);
  scriptHash.reverse();
  return binToHex(scriptHash);
}
