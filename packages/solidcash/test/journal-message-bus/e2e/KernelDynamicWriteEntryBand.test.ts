import { bigIntToVmNumber, hexToBin, vmNumberToBigInt } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract, SortedList, getEntryNftAddress } from '../../../src/index.js';
import { keyToSlot } from '../../../src/stateful/SortedList.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  solidityImportCompat: true,
  suppressWarnings: true,
} as const;

/**
 * A handler that writes a chunk-backed dynamic array AND writes a runtime mapping in the same call.
 *
 * The compiler places the runtime mapping entry outputs after the read-only dynamic chunks that the SDK
 * co-spends at the trailing head, but a dynamic resource the SAME call writes publishes its replacement chunks
 * at the suffix and must therefore not shift that base. When it did, the covenant pinned the entry record one
 * chunk-run too far right - onto the written array's continuation output - and the entry-address check refused
 * the SDK's (correctly ordered) composition. The second call is the discriminating one: the first has no
 * preserved chunks to co-spend, so both orderings agree there.
 */
describe('runtime mapping entries beside a same-call dynamic write', () => {
  const SOURCE = `pragma solidity ^0.8.0;
    contract DynamicWriteBand {
      bytes[] labels;
      mapping(uint256 => uint256) scores;
      function note(bytes label) public {
        this.labels.push(label);
        require(true);
      }
      function score(uint256[] keys, uint256[] values, bytes label) public {
        this.labels.push(label);
        for (uint256 i = 0; i < keys.length; i = i + 1) {
          this.scores[keys[i]] = values[i];
        }
        require(true);
      }
    }`;

  it('settles the second write when the dynamic array already holds chunks', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(SOURCE, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'score'))
      .toMatchObject({ eligible: true });
    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(
      provider, base, artifact.stateLayout!, {}, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(
      base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
    );

    await sc.call.note(hexToBin('aa')).send();
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const call = sc.call.score([1n], [7n], hexToBin('bb'));
    call.addInput(funder.utxo, funder.unlocker);
    await expect(call.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });

    const entryAddress = getEntryNftAddress(sc.inner, setup.categoryId, 'scores');
    const entry = SortedList.fromUtxos(await provider.getUtxos(entryAddress))
      .find(keyToSlot(bigIntToVmNumber(1n)));
    expect(entry).toBeDefined();
    expect(vmNumberToBigInt(entry!.value, { requireMinimalEncoding: false })).toBe(7n);
  }, 180_000);
});

/**
 * The same gap on the COMPOSED side: contract A's view calls contract B's view, and B's view verifies its own
 * chunk-backed dynamic run. The composition must (a) co-spend B's chunks in B's trailing band and (b) resolve the
 * read to a value rather than sending a no-op transaction, because the compiled call graph writes no state.
 */
describe('an external view over a callee\'s own dynamic chunk run', () => {
  const CALLEE = `pragma solidity ^0.8.0;
    contract LabelStore {
      bytes[] labels;
      function note(bytes label) public {
        this.labels.push(label);
        require(true);
      }
      function labelCount() public view returns (uint256) {
        return labels.length;
      }
    }`;

  const CALLER = `pragma solidity ^0.8.0;
    interface ILabelStore {
      function labelCount() external view returns (uint256);
    }
    contract LabelReader(ILabelStore store) {
      function readCount() public view returns (uint256) {
        return store.labelCount();
      }
    }`;

  it('reads the callee value instead of sending, with the callee chunks co-spent', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const calleeArt = compileString(CALLEE, KERNEL);
    const callerArt = compileString(CALLER, KERNEL);

    const callee = new Contract(calleeArt, [], { provider });
    const calleeSetup = await setupStatefulUtxos(
      provider, callee, calleeArt.stateLayout!, {}, { saltContract: true },
    );
    const calleeSc = StatefulContract.withCategory(callee, calleeSetup.categoryId);

    // One label, so the callee's view has a real chunk run to authenticate.
    await calleeSc.call.note(hexToBin('aa')).send();

    const caller = new Contract(callerArt, [hexToBin(calleeSc.inner.lockingBytecode)], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, caller, callerArt.stateLayout!, {}, { saltContract: true },
    );
    const callerSc = StatefulContract.withCategory(caller, callerSetup.categoryId, {
      externals: { ILabelStore: calleeSc },
    });

    // Awaiting a view resolves to its decoded value (ethers semantics) and must not send a transaction.
    await expect(callerSc.call.readCount()).resolves.toBe(1n);
  }, 180_000);
});
