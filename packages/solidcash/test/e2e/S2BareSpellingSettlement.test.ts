import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { binToHex, decodeTransactionUnsafe, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { Contract, StatefulContract } from '../../src/index.js';
import { alicePkh } from '../fixture/vars.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

/**
 * The deciding evidence for round-11's "S2 UNDETERMINED - the boundary is dialect-dependent".
 *
 * It is not the dialect. `this.note = tag` is a `StateAssignNode` from the parser; the bare `note = tag` is an
 * `AssignNode` over an `IdentifierNode` until symbol resolution, which runs AFTER these lowerings. So
 * `analyseFunctionFootprint` never records `state:note` for the bare spelling, no `__scb_dynamic_<handler>`
 * clone is synthesized, `LowerDynamicStateJournalHelpers` converts nothing, and S2's guard - which fires on a
 * `__dj_` first parameter - never sees the handler. Solidity syntax spelled `this.note` is refused and `.scash`
 * spelled bare is admitted, which is what rules the front end out. The compile-side matrix is pinned in
 * `packages/solidc/test/MixedJournalBoundaryReviewB11.test.ts`.
 *
 * This file answers the part that matters: IS THE ADMITTED FORM SOUND. It is. The same handler writes a
 * chunk-backed unbounded `string` and a C2 collection entry, and both legs are physically present and
 * independently authenticated - forging either one, dropping the chunk, or minting a second chunk at the
 * dynamic address all reject at input 0, while the unmutated derivation broadcasts.
 *
 * So the refusal is the over-strict side. It is over-strict because the `this.` spelling reaches the
 * dj-converted clone, whose raw collection accesses genuinely cannot code-generate - NOT because the shape is
 * unsupportable. The measured route to removing the boundary is recorded in the round-12 report: declining the
 * dynamic journal for a helper that also reaches a collection makes the `this.` program compile BYTE-IDENTICAL
 * to the bare one settled here. That is proven for the plain path only; the message-bus clone leg differs and
 * is NOT settled, so the boundary is kept.
 */

const BARE = `pragma solidcash >=0.8.0;
contract BareSpellingMixed() {
  string note;
  mapping(bytes20 => bigint) balances;
  function set(bytes20 who, bigint amount, string t) public {
    helper(who, amount, t);
    require(true);
  }
  function helper(bytes20 who, bigint amount, string t) internal {
    note = t;
    balances[who] = balances[who] + amount;
  }
  function checkNote(string e) public { require(this.note == e); }
  function checkBalance(bytes20 who, bigint e) public { require(this.balances[who] == e); }
}`;

// Measured physical layout of the honest transaction.
const OUT = { master: 0, dataNft: 1, predecessor: 2, chunk: 3, entryNew: 4 } as const;

type Provider = ReturnType<typeof createTestProvider>;

async function deploy(): Promise<{ provider: Provider; sc: StatefulContract<any> }> {
  const provider = createTestProvider();
  const artifact = compileString(BARE, { forceStateful: true });
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, {}, { saltContract: true },
  );
  return { provider, sc: StatefulContract.withCategory(contract, categoryId) };
}

/** Derive and capture the honest transaction without broadcasting it, leaving every input unspent. */
async function honestCapture(): Promise<{ provider: Provider; hex: string }> {
  const { provider, sc } = await deploy();
  let captured = '';
  const send = provider.sendRawTransaction.bind(provider);
  (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
    captured = hex;
    throw new Error('capture-only');
  };
  await expect(sc.set(alicePkh, 7n, 'hi').send()).rejects.toThrow('capture-only');
  (provider as any).sendRawTransaction = send;
  expect(captured).not.toBe('');
  return { provider, hex: captured };
}

function mutate(hex: string, apply: (tx: any) => void): string {
  const tx = decodeTransactionUnsafe(hexToBin(hex));
  apply(tx);
  return binToHex(encodeTransaction(tx));
}

async function expectRejection(provider: Provider, hex: string): Promise<void> {
  const outcome = await provider.sendRawTransaction(hex)
    .then(() => 'ACCEPTED').catch((error: Error) => error.message);
  expect(outcome).toContain('mandatory-script-verify-flag-failed');
  expect(outcome).toContain('error in evaluating input index 0');
}

describe('S2 bare-spelling admitted form: unbounded write plus a collection write in one handler', () => {
  it('settles and reads back both the dynamic value and the entry value', async () => {
    const { sc } = await deploy();
    await sc.set(alicePkh, 7n, 'hi').send();
    await sc.checkNote('hi').send();
    await sc.checkBalance(alicePkh, 7n).send();
  }, 180_000);

  it('carries both legs physically: a chunk output beside the C2 insert node', async () => {
    const { hex } = await honestCapture();
    const tx = decodeTransactionUnsafe(hexToBin(hex));
    // '0002' is the chunk header for a 2-byte value; '6869' is "hi".
    expect(binToHex(tx.outputs[OUT.chunk].token!.nft!.commitment)).toBe('00026869');
    expect(binToHex(tx.outputs[OUT.entryNew].lockingBytecode))
      .toBe(binToHex(tx.outputs[OUT.predecessor].lockingBytecode));
  }, 180_000);

  it('rejects a forged dynamic chunk', async () => {
    const { provider, hex } = await honestCapture();
    await expectRejection(provider, mutate(hex, (tx) => {
      tx.outputs[OUT.chunk].token.nft.commitment = hexToBin('00026868');
    }));
  }, 180_000);

  it('rejects a forged collection entry value', async () => {
    // The dynamic chunk stays honest, so this rejection is the collection leg on its own.
    const { provider, hex } = await honestCapture();
    await expectRejection(provider, mutate(hex, (tx) => {
      const commitment = tx.outputs[OUT.entryNew].token.nft.commitment.slice();
      commitment[commitment.length - 1] = 0x63;
      tx.outputs[OUT.entryNew].token.nft.commitment = commitment;
    }));
  }, 180_000);

  it('rejects the dynamic chunk output being dropped', async () => {
    const { provider, hex } = await honestCapture();
    await expectRejection(provider, mutate(hex, (tx) => { tx.outputs.splice(OUT.chunk, 1); }));
  }, 180_000);

  it('rejects an extra chunk minted at the dynamic variable address', async () => {
    const { provider, hex } = await honestCapture();
    await expectRejection(provider, mutate(hex, (tx) => {
      const source = tx.outputs[OUT.chunk];
      tx.outputs[tx.outputs.length - 1].valueSatoshis = 1n;
      tx.outputs.push({
        ...source,
        valueSatoshis: 1n,
        lockingBytecode: source.lockingBytecode.slice(),
        token: {
          ...source.token,
          nft: { ...source.token.nft, commitment: source.token.nft.commitment.slice() },
        },
      });
    }));
  }, 180_000);

  it('accepts the unmutated derivation', async () => {
    const { provider, hex } = await honestCapture();
    await expect(provider.sendRawTransaction(hex)).resolves.toBeTypeOf('string');
  }, 180_000);
});
