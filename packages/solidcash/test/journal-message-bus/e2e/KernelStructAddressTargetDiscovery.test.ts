import { hexToBin, hash160 } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import {
  StatefulContract,
  registerDeployment,
} from '../../../src/stateful/index.js';
import { setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';
import { messageBusVmAccepts } from './vm-accepts.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true, messageBusGraphContext: true,
  evmCompat: true, maximumInputBytes: 1_000_000, suppressWarnings: true,
} as const;

describe('kernel struct address target discovery', () => {
  it.each([false, true])('discovers a transitive ABI-word struct target (raw call: %s)', async (raw) => {
    const provider = createMessageBusCapstoneTestProvider();
    const seed = async (source: string, args: string[] = []): Promise<StatefulContract> => {
      const artifact = compileString(source, KERNEL);
      const base = new Contract(artifact, args, { provider });
      const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    };
    const target = await seed(`pragma solidity ^0.8.0;
      contract ValueStore {
        uint public stored;
        function store(uint value) public { stored = value; require(true); }
      }`);
    registerDeployment(provider, {
      contractName: 'ValueStore', address: target.target,
      lockingBytecode: target.inner.lockingBytecode, contract: target,
    });
    const router = await seed(`pragma solidity ^0.8.0;
      struct Route { address destination; uint value; }
      interface IValue { function store(uint value) external; }
      contract Router {
        function run(Route memory input) public {
          ${raw ? 'address destination = input.destination;' : ''}
          require(input.destination != address(0));
          ${raw ? 'destination.call(abi.encodeCall(IValue.store, (input.value)));'
    : 'IValue(input.destination).store(input.value);'}
          require(true);
        }
      }`);
    const relay = await seed(`pragma solidity ^0.8.0;
      struct Route { address destination; uint value; }
      interface IRouter { function run(Route memory input) external; }
      contract Relay(address router) {
        function relay(Route memory input) public { IRouter(router).run(input); require(true); }
      }`, [router.inner.lockingBytecode]);
    relay._registerResolvedExternal('IRouter', router);
    const root = await seed(`pragma solidity ^0.8.0;
      contract Root(address implementation) {
        function execute(bytes payload) public { implementation.delegatecall(payload); require(true); }
      }`, [relay.inner.lockingBytecode]);
    const word = new Uint8Array(32);
    word.set(hash160(hexToBin(target.inner.lockingBytecode)), 12);
    const payload = hexToBin(relay.inner.artifact.abi.find((entry) => entry.name === 'relay')!.selector!);
    const call = root.call.execute(payload)
      .withCallerIdentity(hexToBin(root.inner.lockingBytecode), root.categoryId)
      .withCall(relay, 'relay', [{ destination: word, value: 41n }]);
    const builder = await call.build();
    expect(builder.inputs.some((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === 'ValueStore')).toBe(true);
    expect(messageBusVmAccepts(builder)).toBe(true);
    const routerInput = builder.inputs.find((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === 'Router')!;
    const originalUnlocker = routerInput.unlocker;
    if (!('params' in originalUnlocker)) throw new Error('router input has no parameters');
    const malformed = word.slice();
    malformed[0] = 1;
    const wrongTarget = word.slice();
    wrongTarget[31] ^= 1;
    try {
      for (const destination of [malformed, wrongTarget]) {
        routerInput.unlocker = router.inner.unlock.run(
          { destination, value: 41n }, ...originalUnlocker.params.slice(1),
        );
        expect(messageBusVmAccepts(builder)).toBe(false);
      }
    } finally {
      routerInput.unlocker = originalUnlocker;
    }
    await expect(call.send()).resolves.toHaveProperty('txid');
    expect((await target.getState()).stored).toBe(41n);
  }, 180_000);
});
