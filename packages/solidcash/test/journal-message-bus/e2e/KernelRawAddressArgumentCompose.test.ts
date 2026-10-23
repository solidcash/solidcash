import { hexToBin } from '@bitauth/libauth';
import { addressToGraphEmissionBytes } from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';
import { messageBusVmAccepts } from './vm-accepts.js';

const OPTIONS = {
  forceStateful: true, messageBus: true, messageBusKernel: true, messageBusGraphContext: true,
  evmCompat: true, maximumInputBytes: 1_000_000, suppressWarnings: true,
} as const;

describe('kernel raw address argument composition', () => {
  it('authenticates native address(this) against a decoded ABI-word argument', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const seed = async (source: string, args: string[] = []): Promise<StatefulContract> => {
      const artifact = compileString(source, OPTIONS);
      const base = new Contract(artifact, args, { provider });
      const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    };
    const target = await seed(`pragma solidity ^0.8.0;
      contract Receiver {
        uint public hits;
        function accept(address who) public returns (bool) {
          require(who != address(0)); hits = hits + 1; return true;
        }
      }`);
    const caller = await seed(`pragma solidity ^0.8.0;
      interface IReceiver { function accept(address who) external returns (bool); }
      contract Sender(address target) {
        function invoke() public {
          target.call(abi.encodeCall(IReceiver.accept, (address(this)))); require(true);
        }
      }`, [target.inner.lockingBytecode]);
    const word = addressToGraphEmissionBytes(hexToBin(caller.inner.lockingBytecode));
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const compose = (argument: Uint8Array): ReturnType<typeof messageBus.compose> => messageBus.compose({
      calls: [caller.call.invoke(), target.call.accept(argument)],
      funder, changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    const different = word.slice();
    different[31] ^= 1;
    await expect(compose(different).build()).rejects.toThrow(/decoded arguments disagree/);
    const call = compose(word);
    expect(messageBusVmAccepts(await call.build())).toBe(true);
    await expect(call.send()).resolves.toHaveProperty('txid');
    expect((await target.getState()).hits).toBe(1n);
  }, 180_000);

  it('settles an automatically admitted typed call reached through a using-for helper', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const seed = async (
      source: string, args: string[] = [], graphLeaf = false,
    ): Promise<StatefulContract> => {
      const artifact = compileString(source, {
        forceStateful: true, evmCompat: true, maximumInputBytes: 1_000_000,
        suppressWarnings: true, ...(graphLeaf && { messageBus: true }),
      });
      const base = new Contract(artifact, args, { provider });
      const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    };
    const target = await seed(`pragma solidity ^0.8.0;
      contract Sink {
        uint public hits;
        function ping(uint value) public returns (bool) {
          hits = hits + value;
          return true;
        }
      }`, [], true);
    const caller = await seed(`pragma solidity ^0.8.0;
      interface ISink { function ping(uint value) external returns (bool); }
      library Forward {
        function forward(ISink sink, uint value) internal { require(sink.ping(value)); }
      }
      contract Caller(address sink) {
        using Forward for ISink;
        function invoke(uint value) public {
          ISink target = ISink(sink);
          target.forward(value);
        }
      }`, [target.inner.lockingBytecode]);
    expect(caller.inner.artifact.messageBus?.handlers.find((handler) => handler.name === 'invoke')?.eligible)
      .toBe(true);
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composed = messageBus.compose({
      calls: [caller.call.invoke(3n), target.call.ping(3n)],
      funder, changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    expect(messageBusVmAccepts(await composed.build())).toBe(true);
    await expect(composed.send()).resolves.toHaveProperty('txid');
    expect((await target.getState()).hits).toBe(3n);
  }, 180_000);
});
