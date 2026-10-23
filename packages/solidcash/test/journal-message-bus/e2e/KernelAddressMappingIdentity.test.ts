import { hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract,
  Signer,
} from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { addressToLockScript } from '../../../src/utils.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';
import { messageBusVmAccepts } from './vm-accepts.js';

describe('kernel address mapping identity across graph calls', () => {
  it.each([false, true])('reads a sender-keyed entry (Solidity compatibility: %s)', async (compat) => {
    const options = {
      forceStateful: true, messageBus: true, messageBusKernel: true,
      evmCompat: compat, maximumInputBytes: 1_000_000, suppressWarnings: true,
    } as const;
    const artifact = compileString(`contract Store() {
      mapping(address => int) records;
      function record() public { this.records[msg.sender] = 42; require(true); }
      function lookup(address who) public view returns (int) { return this.records[who]; }
    }`, options);
    expect(artifact.stateLayout!.collections![0].addressKeyEncoding).toBe(compat ? 'identity20' : undefined);
    const callerArtifact = compileString(`interface IStore {
      function lookup(address who) external returns (int);
    }
      contract Caller() {
        function inspect(address store, address who) public {
          require(IStore(store).lookup(who) == 42);
        }
      }`, options);
    const provider = createMessageBusCapstoneTestProvider();
    const connect = async (input: typeof artifact): Promise<StatefulContract> => {
      const base = new Contract(input, [], { provider });
      const seeded = await setupStatefulUtxos(provider, base, input.stateLayout!, {}, { saltContract: true });
      return StatefulContract.withCategory(base.withCategory(hexToBin(seeded.categoryId)), seeded.categoryId);
    };
    const store = await connect(artifact);
    const caller = await connect(callerArtifact);
    caller._registerResolvedExternal('IStore', store);
    const signer = new Signer(new Uint8Array(32).fill(0x61), provider);
    for (let index = 0; index < 8; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 100).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
      });
    }
    await store.connect(signer).call.record().send();
    const native = addressToLockScript(signer.getAddress());
    // A nested struct/return value can already contain the Solidity ABI word before the SDK plans
    // the child invocation. It must identify the entry originally written using native msg.sender.
    const who = compat ? Uint8Array.of(...new Uint8Array(12), ...native.slice(3, 23)) : native;
    const callsiteId = callerArtifact.abi.find((fn) => fn.name === 'inspect')!.externalCalls![0].callsiteId;
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        { contract: caller, functionName: 'inspect', args: [store.inner.lockingBytecode, who] },
        { contract: store, functionName: 'lookup', args: [who], callsiteId },
      ],
      funder, changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    expect(messageBusVmAccepts(await composition.build())).toBe(true);
    await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/u) });
  }, 180_000);
});
