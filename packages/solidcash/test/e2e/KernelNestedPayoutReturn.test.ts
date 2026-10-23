import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
  interface IPayout { function distribute(uint amount) external; }
  interface IClaim { function claim(uint amount) external returns (uint[5] memory); }
  contract Payout {
    uint public total;
    function distribute(uint amount) public { this.total += amount; }
  }
  contract Claim(address payout) {
    uint public calls;
    function claim(uint amount) public returns (uint[5] memory) {
      uint[5] memory amounts = [amount, amount + 1, amount + 2, amount + 3, amount + 4];
      for (uint i = 0; i < 5; i = i + 1) {
        if (amounts[i] > 0) IPayout(payout).distribute(amounts[i]);
      }
      this.calls += 1;
      return amounts;
    }
  }
  contract Root {
    uint public result;
    function initialize() public { this.result = 0; }
    function run(address claim, uint amount) public {
      uint[5] memory amounts = IClaim(claim).claim(amount);
      this.result = amounts[0] + amounts[4];
    }
  }
  interface IVault {
    function settle(uint amount) external;
    function read() external view returns (uint);
    function distribute(uint amount) external;
  }
  interface ISettlementClaim { function claim() external returns (uint[5] memory); }
  interface IReferee { function decide(uint amount) external returns (uint[5] memory); }
  contract Vault {
    uint public total;
    function settle(uint amount) public { this.total += amount; }
    function read() public view returns (uint) { return this.total; }
    function distribute(uint amount) public { this.total += amount; }
  }
  contract SettlementClaim(address vault) {
    function claim() public returns (uint[5] memory) {
      uint amount = IVault(vault).read();
      uint[5] memory amounts = [amount, uint(1), uint(2), uint(3), uint(4)];
      for (uint i = 0; i < 5; i = i + 1) {
        if (amounts[i] > 0) IVault(vault).distribute(amounts[i]);
      }
      return amounts;
    }
  }
  contract Referee(address vault, address claim) {
    function decide(uint amount) public returns (uint[5] memory) {
      IVault(vault).settle(amount);
      uint[5] memory amounts = ISettlementClaim(claim).claim();
      return amounts;
    }
  }
  contract SettlementRoot {
    uint public result;
    function initialize() public { this.result = 0; }
    function run(address referee, uint amount) public {
      uint[5] memory amounts = IReferee(referee).decide(amount);
      this.result = amounts[0] + amounts[4];
    }
  }`, {
  forceStateful: true,
  evmCompat: true,
  messageBus: true,
  messageBusKernel: true,
  messageBusGraphContext: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
  optimizeForCompilationSpeed: true,
  sortedMappingsAll: false,
});

describe('kernel nested payout return', () => {
  it('commits a five-word return after conditional same-callee writes in a loop', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x7c), provider);
    for (let index = 0; index < 30; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const payout = await getContractFactory(artifacts.Payout, signer).deploy();
    const claim = await getContractFactory(artifacts.Claim, signer).deploy(payout.inner.address);
    const root = await upgrades.deployProxy(getContractFactory(artifacts.Root, signer), []);
    claim._registerResolvedExternal('IPayout', payout);
    root.implementation._registerResolvedExternal('IClaim', claim);

    await root.forward('run', [claim.inner.address, 5n]).send();
    expect((await payout.getState()).total).toBe(35n);
    expect((await claim.getState()).calls).toBe(1n);
    expect((await root.proxy.getState()).result).toBe(14n);
  }, 180_000);

  it('returns settlement amounts after a prior write, post-write getter, and five payouts', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x7d), provider);
    for (let index = 0; index < 35; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const vault = await getContractFactory(artifacts.Vault, signer).deploy();
    const claim = await getContractFactory(artifacts.SettlementClaim, signer).deploy(vault.inner.address);
    const referee = await getContractFactory(artifacts.Referee, signer)
      .deploy(vault.inner.address, claim.inner.address);
    const root = await upgrades.deployProxy(getContractFactory(artifacts.SettlementRoot, signer), []);
    claim._registerResolvedExternal('IVault', vault);
    referee._registerResolvedExternal('IVault', vault);
    referee._registerResolvedExternal('ISettlementClaim', claim);
    root.implementation._registerResolvedExternal('IReferee', referee);

    await root.forward('run', [referee.inner.address, 5n]).send();
    expect((await vault.getState()).total).toBe(20n);
    expect((await root.proxy.getState()).result).toBe(9n);
  }, 180_000);
});
