/**
 * Bridge from the harness mock chain to Solidity `block.*` (HARDHAT-PARITY.md WS6). SolidCash contracts read
 * `block.timestamp` / `block.number` from the commitment of one shared block-oracle covenant, which its owner's
 * BlockOracleUpdater keeps current. The mock chain writes its own clock into that commitment when it mines, so
 * `time.increase(...)` / `mine(...)` move block.* as Hardhat's do. `mockBlockOracleRpc(provider)` is an RpcLike
 * whose height/time come from the mock provider, for running that keeper against the mock chain.
 */
import type { RpcLike } from '@solidcash/solidcash/oracle';

interface BlockTimeProvider {
  getBlockHeight(): Promise<number>;
  getBlockTime(): number;
}

/** Build a BCHN-JSON-RPC-shaped stub whose block height/timestamp track the mock provider's simulated chain. */
export function mockBlockOracleRpc(provider: BlockTimeProvider): RpcLike {
  const coinbaseHex = `76a914${'00'.repeat(20)}88ac`;
  return {
    request: async (method: string, ...params: unknown[]): Promise<any> => {
      const height = await provider.getBlockHeight();
      const time = provider.getBlockTime();
      switch (method) {
        case 'getblockcount':
          return height;
        case 'getblockhash':
          return `mockhash_${params[0]}`;
        case 'getblock':
          // block subsidy (50 BCH pre-halving) as the sole coinbase output => totalFees resolves to 0.
          return {
            height,
            time,
            // The mock stamps the last 11 headers with the tip time, so that is also its median time past.
            mediantime: time,
            bits: '1d00ffff',
            size: 1000,
            tx: [{ vout: [{ value: 50, scriptPubKey: { hex: coinbaseHex } }] }],
          };
        default:
          throw new Error(`mockBlockOracleRpc: unexpected rpc method "${method}"`);
      }
    },
  };
}

export { BlockOracleUpdater, fetchBlockOracleFields } from '@solidcash/solidcash/dist/oracle/blockOracleUpdater.js';
export type { RpcLike, BlockOracleFields } from '@solidcash/solidcash/dist/oracle/blockOracleUpdater.js';
