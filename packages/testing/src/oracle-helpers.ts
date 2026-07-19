/**
 * Bridge from the harness mock chain to Solidity `block.*` (HARDHAT-PARITY.md WS6). SolidCash contracts read
 * `block.timestamp` / `block.number` from oracle-backed state registers maintained off-chain by a
 * BlockOracleUpdater. `mockBlockOracleRpc(provider)` is an RpcLike whose height/time come from the mock provider,
 * so after `time.increase(...)` / `mine(...)` a `updater.syncOnce()` pushes the advanced block.timestamp/number
 * into the contract - the same way Hardhat's `time.increase` moves `block.timestamp` for ported contracts.
 */
import type { RpcLike } from 'solidcash';

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

export { BlockOracleUpdater, fetchBlockOracleFields } from 'solidcash';
export type { RpcLike, BlockOracleFields } from 'solidcash';
