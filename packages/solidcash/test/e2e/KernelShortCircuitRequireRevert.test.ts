import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

let compiled: ReturnType<typeof compileStringMulti> | undefined;
const artifacts = (): ReturnType<typeof compileStringMulti> => compiled ??= compileStringMulti(`pragma solidity ^0.8.20;
  interface ITarget {
    function probe() external view returns (uint);
    function run(uint value) external;
  }
  contract Target {
    uint public total;
    function probe() public view returns (uint) { return total + 1; }
    function run(uint value) public { this.total += value; }
  }
  contract Controller {
    uint public count;
    function initialize() public { require(true); }
    function act(address target, uint value) public {
      require(target.code.length > 0 && ITarget(target).probe() > 0, "bad target");
      ITarget(target).run(value);
      this.count += 1;
    }
  }`, { forceStateful: true, evmCompat: true, messageBus: true,
  messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
  suppressWarnings: true, optimizeForCompilationSpeed: true });

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
async function deploy() {
  const provider = createMessageBusCapstoneTestProvider();
  const signer = new Signer(new Uint8Array(32).fill(0x6d), provider);
  for (let index = 0; index < 20; index += 1) await provider.addUtxo(signer.getAddress(), {
    txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
  });
  const target = await getContractFactory(artifacts().Target, signer).deploy();
  const controller = await upgrades.deployProxy(getContractFactory(artifacts().Controller, signer), []);
  controller.implementation._registerResolvedExternal('ITarget', target);
  return { target, controller };
}

describe('kernel calls past a short-circuit guarded require', () => {
  it('reverts with the source reason when the guard skips the producer', async () => {
    const { target, controller } = await deploy();
    await expect(controller.forward('act', [`0x${'00'.repeat(20)}`, 5n]).send()).rejects.toThrow(/bad target/);
    expect(await target.getState()).toMatchObject({ total: 0n });
  }, 180_000);

  it('reaches the calls through a code-bearing target', async () => {
    const { target, controller } = await deploy();
    await controller.forward('act', [target.inner.lockingBytecode, 5n]).send();
    expect(await target.getState()).toMatchObject({ total: 5n });
    expect(await controller.proxy.getState()).toMatchObject({ count: 1n });
  }, 180_000);
});
