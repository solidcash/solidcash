import { describe, expect, it } from 'vitest';
import { binToHex, hexToBin, sha256 } from '@bitauth/libauth';
import type { ElectrumClient, ElectrumClientEvents } from '@electrum-cash/network';
import { HDSigner } from '../../src/HDSigner.js';
import { Network } from '../../src/interfaces.js';
import ElectrumNetworkProvider from '../../src/network/ElectrumNetworkProvider.js';
import { buildLogicalIdentityCommitment, deriveLogicalCreateAddress } from '../../src/stateful/logical-identity.js';
import { addressToLockScript } from '../../src/utils.js';

/**
 * What the provider owes a reader that an Electrum server does not state: the lock a listing was made at, and a
 * listing that holds a transaction the provider just broadcast. A server's index takes its node's mempool on a poll,
 * so right after a broadcast it still lists the coins the transaction spent.
 */

const LOCK = hexToBin(`aa20${'11'.repeat(32)}87`);
const SCRIPT_HASH = binToHex(sha256.hash(LOCK).reverse());
const TXID = 'ab'.repeat(32);
const RAW = '0200';

interface Server {
  readonly requests: { method: string; params: unknown[] }[];
  /** Polls until the server's index holds a broadcast transaction; never, when undefined. */
  indexedAfter: number | undefined;
  polled: number;
}

function electrumServer(): { server: Server; client: ElectrumClient<ElectrumClientEvents> } {
  const server: Server = { requests: [], indexedAfter: 0, polled: 0 };
  const client = {
    connect: async () => undefined,
    disconnect: async () => true,
    request: async (method: string, ...params: unknown[]) => {
      server.requests.push({ method, params });
      switch (method) {
        case 'blockchain.scripthash.listunspent':
          return params[0] === SCRIPT_HASH ? [{
            tx_hash: TXID, tx_pos: 3, value: 2_000, height: 0,
            token_data: { amount: '7', category: 'cd'.repeat(32) },
          }] : [];
        case 'blockchain.transaction.broadcast': return TXID;
        case 'blockchain.transaction.get': return RAW;
        case 'blockchain.transaction.get_height':
          server.polled += 1;
          if (server.indexedAfter === undefined || server.polled <= server.indexedAfter) {
            return new Error('No transaction matching the requested hash was found');
          }
          return 0;
        default: throw new Error(`unexpected ${method}`);
      }
    },
  } as unknown as ElectrumClient<ElectrumClientEvents>;
  return { server, client };
}

describe('the Electrum provider', () => {
  it('states the lock it listed at, which the server does not repeat', async () => {
    const { client } = electrumServer();
    const provider = new ElectrumNetworkProvider(Network.REGTEST, { electrum: client });
    const [coin] = await provider.getUtxosForLockingBytecode(LOCK);
    expect(coin).toMatchObject({ txid: TXID, vout: 3, satoshis: 2_000n, token: { amount: 7n } });
    expect(coin!.lockingBytecode).toStrictEqual(LOCK);
    const [byHex] = await provider.getUtxosForLockingBytecode(binToHex(LOCK));
    expect(byHex!.lockingBytecode).toStrictEqual(LOCK);
  });

  it('answers a broadcast once the server\'s index holds it, so a read sees what the caller wrote', async () => {
    const { server, client } = electrumServer();
    server.indexedAfter = 3;
    const provider = new ElectrumNetworkProvider(Network.REGTEST, { electrum: client });
    await expect(provider.sendRawTransaction('00')).resolves.toBe(TXID);
    expect(server.polled).toBe(4);
    expect(server.requests.at(0)?.method).toBe('blockchain.transaction.broadcast');
  });

  it('returns the accepted transaction even when the index never catches up', async () => {
    const { server, client } = electrumServer();
    server.indexedAfter = undefined;
    const provider = new ElectrumNetworkProvider(Network.REGTEST, { electrum: client, indexWaitMilliseconds: 150 });
    await expect(provider.sendRawTransaction('00')).resolves.toBe(TXID);
    expect(server.polled).toBeGreaterThan(0);
  });

  it('asks for an immutable transaction once, its own broadcast included', async () => {
    const { server, client } = electrumServer();
    const provider = new ElectrumNetworkProvider(Network.REGTEST, { electrum: client });
    const asked = (): number => server.requests.filter(({ method }) => method === 'blockchain.transaction.get').length;
    await expect(provider.getRawTransaction('cd'.repeat(32))).resolves.toBe(RAW);
    await expect(provider.getRawTransaction('CD'.repeat(32))).resolves.toBe(RAW);
    expect(asked()).toBe(1);
    await provider.sendRawTransaction('feed');
    await expect(provider.getRawTransaction(TXID)).resolves.toBe('feed');
    expect(asked()).toBe(1);
  });

  it('shares a listing in flight, and never one that left before a broadcast', async () => {
    const { server, client } = electrumServer();
    const provider = new ElectrumNetworkProvider(Network.REGTEST, { electrum: client, listingCacheMilliseconds: 0 });
    const listed = (): number => server.requests
      .filter(({ method }) => method === 'blockchain.scripthash.listunspent').length;
    await Promise.all([provider.getUtxosForLockingBytecode(LOCK), provider.getUtxosForLockingBytecode(LOCK)]);
    expect(listed()).toBe(1);
    await provider.getUtxosForLockingBytecode(LOCK);
    expect(listed()).toBe(2);
    const before = provider.getUtxosForLockingBytecode(LOCK);
    await provider.sendRawTransaction('00');
    const after = provider.getUtxosForLockingBytecode(LOCK);
    await Promise.all([before, after]);
    expect(listed()).toBe(4);
  });

  it('serves a repeat read from a recent listing until a broadcast or its time is up', async () => {
    const { server, client } = electrumServer();
    const provider = new ElectrumNetworkProvider(Network.REGTEST, { electrum: client, listingCacheMilliseconds: 80 });
    const listed = (): number => server.requests
      .filter(({ method }) => method === 'blockchain.scripthash.listunspent').length;
    const [first] = await provider.getUtxosForLockingBytecode(LOCK);
    const [second] = await provider.getUtxosForLockingBytecode(LOCK);
    expect(listed()).toBe(1);
    expect(second).toStrictEqual(first);
    expect(second).not.toBe(first);

    await provider.sendRawTransaction('00');
    await provider.getUtxosForLockingBytecode(LOCK);
    expect(listed()).toBe(2);

    await new Promise((resolve) => { setTimeout(resolve, 100); });
    await provider.getUtxosForLockingBytecode(LOCK);
    expect(listed()).toBe(3);
  });

  it('does not keep a listing a broadcast overtook', async () => {
    const { server, client } = electrumServer();
    let release: (() => void) | undefined;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const slow = {
      ...client,
      connect: client.connect,
      disconnect: client.disconnect,
      request: async (method: string, ...params: unknown[]) => {
        if (method === 'blockchain.scripthash.listunspent' && server.requests.length === 0) {
          const answer = client.request(method, ...params as string[]);
          await held;
          return answer;
        }
        return client.request(method, ...params as string[]);
      },
    } as unknown as ElectrumClient<ElectrumClientEvents>;
    const provider = new ElectrumNetworkProvider(Network.REGTEST, { electrum: slow });
    const before = provider.getUtxosForLockingBytecode(LOCK);
    await provider.sendRawTransaction('00');
    release!();
    await before;
    await provider.getUtxosForLockingBytecode(LOCK);
    expect(server.requests.filter(({ method }) => method === 'blockchain.scripthash.listunspent')).toHaveLength(2);
  });

  it('reopens a socket a caller opened when it drops, as a long composition makes it', async () => {
    const { client } = electrumServer();
    let up = false;
    let reopened = 0;
    const dropping = {
      ...client,
      connect: async () => { up = true; reopened += 1; },
      disconnect: async () => { up = false; return true; },
      request: async (method: string, ...params: unknown[]) => {
        if (!up) throw new Error("Unable to send request to a disconnected server '127.0.0.1'.");
        return client.request(method, ...params as string[]);
      },
    } as unknown as ElectrumClient<ElectrumClientEvents>;
    const provider = new ElectrumNetworkProvider(Network.REGTEST, { electrum: dropping, manualConnectionManagement: true });
    await provider.connect();
    await expect(provider.getRawTransaction('01'.repeat(32))).resolves.toBe(RAW);
    up = false;
    await expect(provider.getRawTransaction('02'.repeat(32))).resolves.toBe(RAW);
    expect(reopened).toBeGreaterThan(1);
    await provider.disconnect();
    await expect(provider.getRawTransaction('03'.repeat(32))).rejects.toThrow('disconnected');
  });

  it('asks for a request again when the socket drops under it', async () => {
    const { client } = electrumServer();
    let lost = 1;
    const dropping = {
      ...client,
      connect: async () => undefined,
      disconnect: async () => true,
      request: async (method: string, ...params: unknown[]) => {
        if (lost > 0) { lost -= 1; return new Error('Connection lost'); }
        return client.request(method, ...params as string[]);
      },
    } as unknown as ElectrumClient<ElectrumClientEvents>;
    const provider = new ElectrumNetworkProvider(Network.REGTEST, { electrum: dropping });
    await expect(provider.sendRawTransaction('00')).resolves.toBe(TXID);
  });

  it('seeds a signer\'s CREATE nonce from the anchors the chain already holds', async () => {
    const { client } = electrumServer();
    const anchored = new Map<string, string>();
    const anchoring = {
      ...client,
      connect: client.connect,
      disconnect: client.disconnect,
      request: async (method: string, ...params: unknown[]) => {
        const commitment = anchored.get(params[0] as string);
        if (method === 'blockchain.scripthash.listunspent' && commitment !== undefined) {
          return [{
            tx_hash: TXID, tx_pos: 0, value: 1_000, height: 1,
            token_data: { amount: '0', category: 'cd'.repeat(32), nft: { capability: 'none', commitment } },
          }];
        }
        return client.request(method, ...params as string[]);
      },
    } as unknown as ElectrumClient<ElectrumClientEvents>;
    const provider = new ElectrumNetworkProvider(Network.REGTEST, { electrum: anchoring, listingCacheMilliseconds: 0 });
    const signer = HDSigner.fromPhrase('test test test test test test test test test test test junk', provider);
    const deployer = signer.getAddress();
    for (const nonce of [0n, 1n]) {
      const address = deriveLogicalCreateAddress(deployer, nonce);
      anchored.set(
        binToHex(sha256.hash(addressToLockScript(address)).reverse()),
        buildLogicalIdentityCommitment(deployer, nonce, address),
      );
    }
    await provider.prepareSigner(signer);
    expect(signer._getTransactionNonceState()).toBe(2n);
  });

  it('passes a server refusal on, without waiting for an index', async () => {
    const { server, client } = electrumServer();
    const refusing = {
      ...client,
      connect: client.connect,
      disconnect: client.disconnect,
      request: async () => new Error('the transaction was rejected by network rules.\n\ntx-size'),
    } as unknown as ElectrumClient<ElectrumClientEvents>;
    const provider = new ElectrumNetworkProvider(Network.REGTEST, { electrum: refusing });
    await expect(provider.sendRawTransaction('00')).rejects.toThrow('tx-size');
    expect(server.polled).toBe(0);
  });
});
