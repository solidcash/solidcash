import { describe, expect, it } from 'vitest';
import { binToHex, encodeTransaction } from '@bitauth/libauth';
import { compileString, compileStringSplit } from '../direct-compile.js';
import { parsePushdataCommitment } from '@solidcash/utils';
import {
  Contract, Signer, SplitContractBundle, StatefulContract, readEventsFromChain,
} from '../../src/index.js';
import { alicePriv } from '../fixture/vars.js';
import { createTestProvider, expectScriptRejection, getTxOutputs, setupStatefulUtxos } from '../test-util.js';

/**
 * X12 - the `emit`-funder delegate class.
 *
 * A delegated call that materializes an event funder slot did not settle. The cause was an
 * implementation-relative output index that counted slots occupying nothing: a delegate's own `dataNft` slots
 * are PROXY-resident (the delegate co-spends the proxy's data NFTs, never its own), so
 * `OP_INPUTINDEX + layoutOffset` read one index too high per data NFT. The covenant looked at
 * implementationInput + 2 while the only position after the implementation was implementationInput + 1.
 * emitBlockSlotIndex now subtracts the data-NFT slots below the offset for delegate output-only slots, and
 * emitOwnCategoryImmutableNftOutputPin shifts its admitted offsets by the same amount so SEC-13's pin still
 * names exactly the position an honest emit can occupy.
 */
const EMITTING = `
contract SplitEmitting() {
    int x;
    int y;
    event Changed(int value);
    function setX(int value) { this.x = value; require(value >= 0); }
    function setXEmitting(int value) { this.x = value; emit Changed(value); require(value >= 0); }
    function setY(int value) { this.y = value; require(value >= 0); }
    function getX() view returns (int) { return this.x; }
}
`;

/** The same source unsplit: an ordinary (non-delegate) emitting contract, for the guard control. */
const PLAIN = `pragma solidcash >=0.8.0;
contract PlainEmitting() {
  bigint x;
  event Changed(bigint value);
  function setX(bigint value) { this.x = value; emit Changed(value); require(value >= 0); }
}`;

async function fundedSigner(): Promise<{ signer: Signer; provider: any }> {
  const provider = createTestProvider();
  const signer = new Signer(alicePriv, provider);
  for (const byte of ['a1', 'b2', 'c3', 'd4', 'e5', 'f6']) {
    await provider.addUtxo(signer.getAddress(), { txid: byte.repeat(32), vout: 0, satoshis: 1_000_000n });
  }
  return { signer, provider };
}

async function deploySplit(): Promise<{ deployed: any; compiled: any; provider: any }> {
  const { signer, provider } = await fundedSigner();
  const compiled = compileStringSplit(EMITTING, { forceSplit: true });
  const deployed = await SplitContractBundle.from(compiled, signer)
    .deploy([], { initialState: { x: 1n, y: 2n } });
  return { deployed, compiled, provider };
}

const raw = (builder: any): string => binToHex(encodeTransaction(builder.buildLibauthTransaction()));

describe('X12: emit funder inside a delegated call', () => {
  /**
   * GUARD NEGATIVE CONTROL, on the published layout. The facet still publishes the event at layout offset 2 -
   * the fix moved the EMITTED arithmetic, not the layout - so a green result below cannot be credited to the
   * layout having been renumbered, and the SDK's grafting still sees the offsets it always saw.
   */
  it('leaves the published facet layout untouched', () => {
    const compiled: any = compileStringSplit(EMITTING, { forceSplit: true });
    const facet = Object.values<any>(compiled.facets)[0];
    const fn = (facet.abi as any[]).find((f) => f.name === 'setXEmitting');
    expect(fn.blockLayout.slots).toEqual([
      { kind: 'master', offset: 0 },
      { kind: 'dataNft', offset: 1, nftIndex: 0 },
      { kind: 'event', offset: 2, slotIndex: 0 },
    ]);
  });

  // HONEST POSITIVE CONTROL: the state write lands AND the emit reads back as a genuine log.
  it('settles the delegated emit and the event reads back from chain', async () => {
    const { deployed, compiled, provider } = await deploySplit();
    const tx = await deployed.call.setXEmitting(23n).send();
    const stateOut = getTxOutputs(tx).find(
      (o: any) => o.token?.category === deployed.categoryId && o.token?.nft?.capability === 'mutable',
    );
    expect(parsePushdataCommitment(stateOut!.token!.nft!.commitment, compiled.root.stateLayout, 0).x).toBe(23n);

    // The event NFT is the only own-category output with `none` capability; take its address from the
    // settled transaction rather than recomputing it, so the read cannot disagree with what was written.
    const eventOut = getTxOutputs(tx).find(
      (o: any) => o.token?.category === deployed.categoryId && o.token?.nft?.capability === 'none',
    );
    expect(eventOut).toBeDefined();
    const eventAddress = eventOut!.to as string;
    const logs = await readEventsFromChain(
      provider, eventAddress, deployed.categoryId, compiled.root.events![0],
    );
    expect(logs.map((log: any) => log.values.value)).toEqual([23n]);
  }, 300_000);

  /**
   * HOSTILE, pinned to an index. Tamper ONLY the event NFT's commitment. The IMPLEMENTATION owns that
   * commitment (the event slot is implementation-relative), so it must reject at input 2 - the facet's own
   * input, not the proxy's.
   */
  it('rejects a tampered event commitment at the implementation input', async () => {
    const { deployed, provider } = await deploySplit();
    const builder: any = await deployed.call.setXEmitting(23n).build();
    const eventOut = builder.outputs.find((o: any) => o.token?.nft?.capability === 'none');
    expect(eventOut).toBeDefined();
    eventOut.token.nft.commitment = binToHex(new Uint8Array([0x03, 0x3f, 0x42, 0x0f]));
    const outcome = await provider.sendRawTransaction(raw(builder))
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expectScriptRejection(outcome, 2);
  }, 300_000);

  /**
   * HOSTILE, and the SEC-13 regression guard. `emitOwnCategoryImmutableNftOutputPin` had its admitted offsets
   * shifted by this fix; if the shift were wrong in the other direction the pin would name a position no emit
   * occupies and an APPENDED own-category immutable NFT - a forged log - would sail through. It does not.
   */
  it('still refuses an appended forged event NFT on the delegate path', async () => {
    const { deployed, provider } = await deploySplit();
    const builder: any = await deployed.call.setXEmitting(23n).build();
    const honestEvent = builder.outputs.find((o: any) => o.token?.nft?.capability === 'none');
    builder.outputs.push({
      to: honestEvent.to,
      amount: 1000n,
      token: {
        category: deployed.categoryId,
        amount: 0n,
        nft: { capability: 'none', commitment: binToHex(new Uint8Array([0x03, 0x3f, 0x42, 0x0f])) },
      },
    });
    const outcome = await provider.sendRawTransaction(raw(builder))
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expect(outcome).not.toBe('ACCEPTED');
    expect(outcome).toContain('mandatory-script-verify-flag-failed');
  }, 300_000);

  /**
   * GUARD NEGATIVE CONTROL, behavioural. The subtraction applies to delegate functions only. An ordinary
   * emitting contract with a data NFT keeps its master-relative event index: it settles, and a tampered event
   * commitment is still refused at input 0.
   */
  it('leaves the ordinary (non-delegate) emit path alone', async () => {
    const provider = createTestProvider();
    const artifact = compileString(PLAIN);
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { x: 0n }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);
    expect((await (sc as any).setX(23n).send()).txid).toBeDefined();

    const sc2 = StatefulContract.withCategory(contract, categoryId);
    const builder: any = await (sc2 as any).setX(24n).build();
    const eventOut = builder.outputs.find((o: any) => o.token?.nft?.capability === 'none');
    eventOut.token.nft.commitment = binToHex(new Uint8Array([0x03, 0x3f, 0x42, 0x0f]));
    const outcome = await provider.sendRawTransaction(raw(builder))
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expectScriptRejection(outcome, 0);
  }, 300_000);
});
