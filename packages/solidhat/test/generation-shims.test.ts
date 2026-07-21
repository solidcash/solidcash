import hardhat2, { ethers as hardhat2Ethers } from '../src/hardhat2.js';
import hardhat3, { network as hardhat3Network } from '../src/hardhat3.js';
import { BigNumber, utils } from '../src/ethers5.js';
import { getCreateAddress, toUtf8Bytes } from '../src/ethers6.js';

describe('generation-specific compatibility entry points', () => {
  it('provides the Hardhat 2 singleton HRE and direct ethers helpers', async () => {
    expect(hardhat2.network.name).toBe('mock');
    expect(await hardhat2Ethers.getSigners(1)).toHaveLength(1);
  });

  it('provides the Hardhat 3 network.connect API', async () => {
    expect(hardhat3.network.connect).toBeTypeOf('function');
    const connection = await hardhat3Network.connect();
    expect(connection.name).toBe('mock');
    expect(connection.ethers.getContractFactory).toBeTypeOf('function');
  });

  it('keeps Ethers 5 namespaces isolated in the ethers5 entry point', () => {
    expect(BigNumber.from(2).mul(3).toString()).toBe('6');
    expect(utils.parseUnits('1', 2)).toBe(100n);
  });

  it('exposes the Ethers 6 function surface separately', () => {
    expect(toUtf8Bytes('solidcash')).toBeInstanceOf(Uint8Array);
    expect(getCreateAddress({ from: 'bitcoincash:qexample', nonce: 0 })).toMatch(/^bitcoincash:/);
  });
});
