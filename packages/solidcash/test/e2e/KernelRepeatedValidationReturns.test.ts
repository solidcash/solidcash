import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

describe('kernel repeated validation returns', () => {
  it('validates distinct loop returns without treating them as one scalar argument result', async () => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface ILabels { function labels(uint key) external view returns (uint); }
      interface ITicker { function tick() external returns (uint); }
      contract Ticker {
        uint public count;
        function tick() public returns (uint) { this.count += 1; return this.count; }
      }
      contract Labels {
        mapping(uint => uint) public labels;
        function seed(uint key, uint weight) public { this.labels[key] = weight; }
      }
      contract Validator {
        uint public count;
        function initialize() public { this.count = 0; }
        function validate(address source, address ticker, uint[] memory keys) public {
          uint nonce = ITicker(ticker).tick();
          require(nonce > 0);
          uint recognized = 0;
          for (uint i = 0; i < keys.length; i++) {
            if (ILabels(source).labels(keys[i]) != 0) { recognized++; }
          }
          require(recognized == 1, "exactly one label required");
          this.count += 1;
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true, sortedMappingsAll: false });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x68), provider);
    for (let index = 0; index < 12; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const labels = await getContractFactory(artifacts.Labels, signer).deploy();
    const ticker = await getContractFactory(artifacts.Ticker, signer).deploy();
    const validator = await upgrades.deployProxy(getContractFactory(artifacts.Validator, signer), []);
    validator.implementation._registerResolvedExternal('ILabels', labels);
    validator.implementation._registerResolvedExternal('ITicker', ticker);
    await labels.call.seed(1n, 1n).send();
    await expect(validator.forward('validate', [labels.inner.lockingBytecode, ticker.inner.lockingBytecode, [1n, 1n]]).send())
      .rejects.toThrow();
    expect((await validator.proxy.getState()).count).toBe(0n);
    expect((await ticker.getState()).count).toBe(0n);
    await validator.forward('validate', [labels.inner.lockingBytecode, ticker.inner.lockingBytecode, [1n, 2n]]).send();
    expect((await validator.proxy.getState()).count).toBe(1n);
    expect((await ticker.getState()).count).toBe(1n);
  }, 180_000);
});
