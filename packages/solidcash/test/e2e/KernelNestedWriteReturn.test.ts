import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
  interface ILeaf {
    function advance(uint amount) external returns (uint[2] memory);
  }
  interface IRelay {
    function advance(uint amount) external returns (uint[2] memory);
  }
  contract Leaf {
    uint public total;
    function advance(uint amount) public returns (uint[2] memory) {
      this.total += amount;
      return [this.total, this.total + 1];
    }
  }
  contract Relay(address leaf) {
    uint public total;
    function advance(uint amount) public returns (uint[2] memory) {
      uint[2] memory values = ILeaf(leaf).advance(amount);
      this.total += values[1];
      return [values[0], this.total];
    }
  }
  contract Root {
    uint public result;
    function initialize() public { this.result = 0; }
    function run(address relay, uint amount) public {
      uint[2] memory values = IRelay(relay).advance(amount);
      this.result = values[0] + values[1];
    }
  }
  contract RelayForwarded {
    uint public total;
    function advance(address leaf, uint amount) public returns (uint[2] memory) {
      uint[2] memory values = ILeaf(leaf).advance(amount);
      this.total += values[1];
      return [values[0], this.total];
    }
  }
  interface IRelayForwarded {
    function advance(address leaf, uint amount) external returns (uint[2] memory);
  }
  contract RootForwarded {
    uint public result;
    function initialize() public { this.result = 0; }
    function run(address relay, address leaf, uint amount) public {
      uint[2] memory values = IRelayForwarded(relay).advance(leaf, amount);
      this.result = values[0] + values[1];
    }
  }
  contract RelayRepeated(address leaf) {
    uint public total;
    function advance(uint amount) public returns (uint[2] memory) {
      uint[2] memory first = ILeaf(leaf).advance(amount);
      uint[2] memory second = ILeaf(leaf).advance(first[1]);
      this.total += first[0] + second[0];
      return [first[0], second[0]];
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

describe('kernel nested write-dependent returns', () => {
  it('passes an array through two state-writing foreign calls into the caller state', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x79), provider);
    for (let index = 0; index < 20; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const leaf = await getContractFactory(artifacts.Leaf, signer).deploy();
    const relay = await getContractFactory(artifacts.Relay, signer).deploy(leaf.inner.address);
    const root = await upgrades.deployProxy(getContractFactory(artifacts.Root, signer), []);
    relay._registerResolvedExternal('ILeaf', leaf);
    root.implementation._registerResolvedExternal('IRelay', relay);

    await root.forward('run', [relay.inner.address, 5n]).send();
    expect((await leaf.getState()).total).toBe(5n);
    expect((await relay.getState()).total).toBe(6n);
    expect((await root.proxy.getState()).result).toBe(11n);
  }, 180_000);

  it('preserves a forwarded dynamic callee address across nested write-and-return calls', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x7a), provider);
    for (let index = 0; index < 20; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const leaf = await getContractFactory(artifacts.Leaf, signer).deploy();
    const relay = await getContractFactory(artifacts.RelayForwarded, signer).deploy();
    const root = await upgrades.deployProxy(getContractFactory(artifacts.RootForwarded, signer), []);
    relay._registerResolvedExternal('ILeaf', leaf);
    root.implementation._registerResolvedExternal('IRelayForwarded', relay);

    await root.forward('run', [relay.inner.address, leaf.inner.address, 5n]).send();
    expect((await leaf.getState()).total).toBe(5n);
    expect((await relay.getState()).total).toBe(6n);
    expect((await root.proxy.getState()).result).toBe(11n);
  }, 180_000);

  it('binds two same-callee write-and-return vectors to their distinct occurrences', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x7b), provider);
    for (let index = 0; index < 20; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const leaf = await getContractFactory(artifacts.Leaf, signer).deploy();
    const relay = await getContractFactory(artifacts.RelayRepeated, signer).deploy(leaf.inner.address);
    const root = await upgrades.deployProxy(getContractFactory(artifacts.Root, signer), []);
    relay._registerResolvedExternal('ILeaf', leaf);
    root.implementation._registerResolvedExternal('IRelay', relay);

    await root.forward('run', [relay.inner.address, 5n]).send();
    expect((await leaf.getState()).total).toBe(11n);
    expect((await relay.getState()).total).toBe(16n);
    expect((await root.proxy.getState()).result).toBe(16n);
  }, 180_000);
});
