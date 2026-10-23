import { decodeCashAddress } from '@bitauth/libauth';
import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
  interface IToken { function transfer(address to, uint amount) external returns (bool); }
  interface IVault {
    function settle(uint amount) external;
    function sendShare(address recipient, uint amount, address currency) external;
  }
  interface IClaim { function claim(address currency, address recipient) external returns (uint[5] memory); }
  interface IReferee {
    function decide(address currency, address recipient, uint amount) external returns (uint[5] memory);
  }
  contract Token {
    uint public totalSent;
    address public lastRecipient;
    function transfer(address to, uint amount) public returns (bool) {
      require(to != address(0) && amount > 0);
      this.totalSent += amount;
      this.lastRecipient = to;
      return true;
    }
  }
  contract Vault {
    uint public settled;
    uint public shares;
    function settle(uint amount) public { this.settled += amount; }
    function sendShare(address recipient, uint amount, address currency) public {
      require(currency != address(0));
      this.shares += 1;
      require(IToken(currency).transfer(recipient, amount));
    }
  }
  contract Claim(address vault) {
    function claim(address currency, address recipient) public returns (uint[5] memory) {
      uint[5] memory amounts = [uint(5), uint(6), uint(7), uint(8), uint(9)];
      for (uint i = 0; i < 5; i = i + 1) {
        if (amounts[i] > 0) IVault(vault).sendShare(recipient, amounts[i], currency);
      }
      return amounts;
    }
  }
  contract Referee(address vault, address claim) {
    function decide(address currency, address recipient, uint amount) public returns (uint[5] memory) {
      IVault(vault).settle(amount);
      uint[5] memory amounts = IClaim(claim).claim(currency, recipient);
      return amounts;
    }
  }
  contract Root {
    uint public result;
    function initialize() public { this.result = 0; }
    function run(address referee, address currency, address recipient) public {
      uint[5] memory amounts = IReferee(referee).decide(currency, recipient, 5);
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

describe('kernel nested token payout', () => {
  it('routes five dynamic-currency transfers beneath a returned decision vector', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x7e), provider);
    for (let index = 0; index < 40; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const token = await getContractFactory(artifacts.Token, signer).deploy();
    const vault = await getContractFactory(artifacts.Vault, signer).deploy();
    const claim = await getContractFactory(artifacts.Claim, signer).deploy(vault.inner.address);
    const referee = await getContractFactory(artifacts.Referee, signer)
      .deploy(vault.inner.address, claim.inner.address);
    const root = await upgrades.deployProxy(getContractFactory(artifacts.Root, signer), []);
    vault._registerResolvedExternal('IToken', token);
    claim._registerResolvedExternal('IVault', vault);
    referee._registerResolvedExternal('IVault', vault);
    referee._registerResolvedExternal('IClaim', claim);
    root.implementation._registerResolvedExternal('IReferee', referee);

    await root.forward('run', [referee.inner.address, token.inner.address, signer.getAddress()]).send();
    expect((await token.getState()).totalSent).toBe(35n);
    const decodedRecipient = decodeCashAddress(signer.getAddress());
    if (typeof decodedRecipient === 'string') throw new Error(decodedRecipient);
    expect((await token.getState()).lastRecipient.slice(-20)).toEqual(decodedRecipient.payload);
    expect((await vault.getState()).settled).toBe(5n);
    expect((await vault.getState()).shares).toBe(5n);
    expect((await root.proxy.getState()).result).toBe(14n);
  }, 240_000);
});
