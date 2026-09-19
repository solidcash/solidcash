import ConfigArbOne from "../../scripts/config.arb-one.json";
import ConfigArbSepolia from "../../scripts/config.arb-sepolia.json";
import ConfigLocal from "../../scripts/config.local.json";
// names are strictly the same as in the wagmi config
const networkConfigs = {
    "Arbitrum One": ConfigArbOne,
    "Arbitrum Sepolia": ConfigArbSepolia,
    "Hardhat": ConfigLocal,
};
export const Config = (networkName) => {
    if (!networkConfigs[networkName]) {
        throw new Error(`Config not found for network: ${networkName}`);
    }
    return networkConfigs[networkName];
};
//# sourceMappingURL=config.js.map