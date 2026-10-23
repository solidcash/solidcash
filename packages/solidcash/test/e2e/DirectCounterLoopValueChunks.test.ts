import { bigIntToVmNumber, binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { keyToSlotMulti } from '../../src/stateful/SortedList.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

/**
 * A counter loop whose old value is runtime-typed takes no value-chunk lock witness, so a direct call of it had no
 * lock list: the mutable-output check refused the honest chunk outputs of a value grown past the inline limit. The
 * entry now keeps its own list, as a route without the witness does.
 */

const SOURCE = `pragma solidcash ^0.14.0;
contract CounterLoopChunkedValues() {
  mapping(int => bytes32[]) values;
  function pushMany(int n, bytes32 value) public {
    for (int i = 0; i < n; i = i + 1) { this.values[i].push(value); }
    require(true);
  }
}`;

const KERNEL = { forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000 } as const;

describe('a direct counter-loop call that grows a value past the inline limit', () => {
  it('settles the value chunks and reads the grown values back', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, KERNEL);
    const inputs = artifact.abi.find((fn) => fn.name === 'pushMany')!.inputs.map((input) => input.name);
    expect(inputs.some((name) => name.startsWith('__internal__vmapCounterOld_'))).toBe(true);
    expect(inputs).not.toContain('__internal__valueChunkOutputBase');

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const first = hexToBin('11'.repeat(32));
    const second = hexToBin('22'.repeat(32));
    // The first call writes inline values; the second grows each to two elements, past the inline limit.
    for (const value of [first, second]) {
      await expect(StatefulContract.withCategory(inner, categoryId).call.pushMany(2n, value).send())
        .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    }

    const entries = await StatefulContract.withCategory(inner, categoryId).getEntries('values');
    for (let key = 0n; key < 2n; key += 1n) {
      const value = entries.find((entry) =>
        binToHex(entry.slot) === binToHex(keyToSlotMulti([bigIntToVmNumber(key)])))?.value;
      expect((value as Uint8Array[]).map(binToHex)).toEqual([binToHex(first), binToHex(second)]);
    }
  }, 180_000);
});
