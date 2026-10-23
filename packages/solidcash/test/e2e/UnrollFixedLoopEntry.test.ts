import { describe, it, expect } from 'vitest';
import { bigIntToVmNumber, binToHex } from '@bitauth/libauth';
import { compileString as _csRawSolidc } from '@solidcash/solidc';
const compileString = (s: string, o: Record<string, unknown> = {}): ReturnType<typeof _csRawSolidc> => _csRawSolidc(s, o);
import {
  Contract,
  SignatureTemplate,
} from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { alicePriv, alicePub } from '../fixture/vars.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { keyToSlotMulti } from '../../src/stateful/SortedList.js';

// A fixed-bound loop that writes a mapping unrolls to N static writes. This proves BOTH entries land (not just the
// last, which is what the runtime-loop path would wrongly produce) - the soundness invariant for the unroll.
const SRC = `contract C() {
  mapping(int => int) bal;
  function setAll(int[2] ks, int[2] vs, pubkey pk, sig sg) {
    require(checkSig(sg, pk));
    for (int i = 0; i < 2; i = i + 1) { bal[ks[i]] = vs[i]; }
  }
  function check(int k, int e, pubkey pk, sig sg) { require(checkSig(sg, pk)); require(bal[k] == e); }
}`;

describe('fixed-bound loop mapping write (unrolled to N static entry writes)', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);

  it('writes BOTH entries the loop assigns (bal[10]=111, bal[20]=222), each readable back', async () => {
    const art = compileString(SRC);
    // The write function must NOT hit EntryWriteInLoopError (proves the unroll fired).
    expect(art.abi.find((f) => f.name === 'setAll')).toBeDefined();

    const contract = new Contract(art, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, contract, art.stateLayout!, {}, { saltContract: true });
    let sc = StatefulContract.withCategory(contract, categoryId);

    const tx = await sc.setAll([10n, 20n], [111n, 222n], alicePub, sig).send();
    expect(tx.txid).toBeDefined();
    expect(sc.lastDerivationIterations).toBe(1);

    // Both entries are readable back off the persisted state.
    sc = StatefulContract.withCategory(contract, categoryId);
    expect((await sc.check(10n, 111n, alicePub, sig).send()).txid).toBeDefined();
    sc = StatefulContract.withCategory(contract, categoryId);
    expect((await sc.check(20n, 222n, alicePub, sig).send()).txid).toBeDefined();
    // A wrong value is rejected (the entry genuinely holds 111/222, not a stale/last-only value).
    sc = StatefulContract.withCategory(contract, categoryId);
    await expect(sc.check(10n, 999n, alicePub, sig).send())
      .rejects.toThrow('messageBus: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.');
  });

  it('preserves source-order writes around statically selected continue and break sites', async () => {
    const artifact = compileString(`contract StaticEscapeWrites() {
      mapping(int => int) values;
      function write(pubkey pk, sig authorization) public {
        require(checkSig(authorization, pk));
        for (int i = 1; i < 10; i = i + 2) {
          this.values[i] = i;
          if (i == 3) continue;
          this.values[i + 100] = i + 10;
          if (i == 7) break;
          this.values[i + 200] = i + 20;
        }
        require(true);
      }
    }`, {
      forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000,
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: true });

    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, {}, { saltContract: true },
    );
    const stateful = StatefulContract.withCategory(contract, categoryId);
    await expect(stateful.call.write(alicePub, sig).send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    const valuesBySlot = new Map((await stateful.getEntries('values')).map((entry) => [
      binToHex(entry.slot), entry.value,
    ]));
    for (const [key, expected] of [
      [1n, 1n], [3n, 3n], [5n, 5n], [7n, 7n],
      [101n, 11n], [105n, 15n], [107n, 17n],
      [201n, 21n], [205n, 25n],
    ] as const) {
      expect(valuesBySlot.get(binToHex(keyToSlotMulti([bigIntToVmNumber(key)])))).toBe(expected);
    }
    expect(valuesBySlot.size).toBe(9);
  });
});
