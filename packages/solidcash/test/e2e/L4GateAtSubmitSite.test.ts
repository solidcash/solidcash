import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

/**
 * X126. THE FINALIZED-BYTES GATE IS WIRED INTO THE STATEFUL SUBMIT PATH, and refuses there.
 *
 * `L4FinalizedBytesGate.test.ts` decides the RULES against hostile byte pairs. This file decides one
 * different thing: that the gate is actually reached from `StatefulTransactionBuilder`'s Phase 5, the site
 * 2,535 of the suite's 5,370 broadcasts pass through. A rule set nothing calls refuses nothing, and the
 * assertion that catches that is not "it threw" but "the provider was never asked".
 *
 * THE DISCRIMINATING PAIR IS ONE SATOSHI WIDE. A bare `OP_1` recipient serializes to a 10-byte output
 * (8 value + 1 length + 1 script), so BCHN's floor is 3 * (10 + 148) = 474 satoshis. 473 is refused and 474
 * is accepted, and the two runs differ in that single field and nothing else. Both are counted at the
 * provider: the refused one must reach it ZERO times, the admitted one exactly once. Without the counter a
 * covenant failure, a fee check, or the mock's own verdict would all read the same as a gate refusal.
 *
 * NOT A SECURITY BOUNDARY. The SDK is an untrusted witness constructor; this refuses at witness-construction
 * time a shape the network refuses anyway, so the composer reads the arithmetic here instead of `64: dust`
 * off a peer. Nothing about it is load-bearing for a covenant.
 */

const SOURCE = `pragma solidcash >=0.8.0;
contract GateAtSubmitSite() {
  bigint calls;
  function pay(bytes recipient, bigint amount) public {
    this.transfer(recipient, amount);
    this.calls = this.calls + 1;
    require(amount >= 0);
  }
}`;

const artifact = compileString(SOURCE, { forceStateful: true });

/** A fresh deployment and a broadcast counter, so the two runs share nothing but the code under test. */
async function deploy(): Promise<{ contract: StatefulContract; broadcasts: () => number }> {
  const provider = createTestProvider();
  const inner = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, inner, artifact.stateLayout!, { calls: 0n }, { saltContract: true },
  );
  const contract = StatefulContract.withCategory(inner, categoryId);
  await provider.addUtxo(contract.getSatoshiContainerAddress(), {
    txid: '77'.repeat(32), vout: 0, satoshis: 5000n,
  });
  let broadcasts = 0;
  const original = provider.sendRawTransaction.bind(provider);
  (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
    broadcasts += 1;
    return original(hex);
  };
  return { contract, broadcasts: () => broadcasts };
}

describe('X126 finalized-bytes gate at the stateful submit site', () => {
  it('refuses a below-dust payment before the provider is asked', async () => {
    const { contract, broadcasts } = await deploy();
    const failure = await contract.pay(Uint8Array.of(0x51), 473n).send()
      .then(() => undefined, (error: Error) => error);
    expect(failure).toBeInstanceOf(Error);
    // The exact arithmetic, not a substring: 473 is one short of 3 * (10 + 148).
    expect(failure!.message).toMatch(
      /\[policy\] output-dust at output \d+: 473 satoshis is 1 short of the 474-satoshi dust threshold /,
    );
    expect(failure!.message).toMatch(/for a 10-byte output \(3 \* \(10 \+ 148\)\); a node refuses `64: dust`/);
    // Exactly one rule fired. A refusal that also trips size or push-only would prove nothing about dust.
    expect(failure!.message).toMatch(/refused by 1 byte rule\(s\)/);
    // THE POINT: the gate is at the submit site, so the network never saw these bytes.
    expect(broadcasts()).toBe(0);
  });

  it('admits the same payment at exactly the threshold', async () => {
    const { contract, broadcasts } = await deploy();
    await expect(contract.pay(Uint8Array.of(0x51), 474n).send()).resolves.toBeDefined();
    expect(broadcasts()).toBe(1);
    expect((await contract.getState()).calls).toBe(1n);
  });

  it('leaves an ordinary p2pkh-sized payment untouched', async () => {
    // A guard that refuses the common case would be caught here rather than by the 400 files downstream.
    const { contract, broadcasts } = await deploy();
    await expect(contract.pay(Uint8Array.of(0x51), 1000n).send()).resolves.toBeDefined();
    expect(broadcasts()).toBe(1);
  });
});
