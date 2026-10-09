/**
 * Electrum network provider surface.
 *
 * Kept on its own subpath (`solidcash/network/electrum`) so importing the package root does not load the
 * `@electrum-cash/network` client.
 */

export { default as ElectrumNetworkProvider } from '../ElectrumNetworkProvider.js';
