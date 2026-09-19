/** Build a BCHN-JSON-RPC-shaped stub whose block height/timestamp track the mock provider's simulated chain. */
export function mockBlockOracleRpc(provider) {
    const coinbaseHex = `76a914${'00'.repeat(20)}88ac`;
    return {
        request: async (method, ...params) => {
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
//# sourceMappingURL=oracle-helpers.js.map