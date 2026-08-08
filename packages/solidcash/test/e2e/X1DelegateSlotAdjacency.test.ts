import { binToHex, encodeTransaction } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileStringSplit } from '../direct-compile.js';
import { parsePushdataCommitment } from '@solidcash/utils';
import { Signer, SplitContractBundle } from '../../src/index.js';
import { alicePriv } from '../fixture/vars.js';
import {
  createTestProvider, expectScriptRejection, getTxOutputs,
} from '../test-util.js';

/**
 * X1 - the delegate implementation slot and the proxy's output-only funder slots claimed the same position.
 *
 * The delegate covenant requires `_proxyMasterIndex == OP_INPUTINDEX - (1 + dataNftCount)`, so the
 * implementation must be co-spent immediately after the proxy's master/data-NFT region. The block layout
 * reserved no slot for it in the direct (non-graph) route, so that position was free only by accident. Any
 * output-only funder slot the SDK materializes inside the proxy block - a `returns` function's returnEvent,
 * an `emit`, or a value transfer - took the position first, the implementation was pushed one input later,
 * and the covenant's subtraction disagreed with the witness.
 *
 * The layout now reserves the slot next to the data NFTs and every other slot follows it. These cases drive
 * each funder kind through a delegated call, since one green shape does not prove the class.
 */

const RETURNING = `
contract SplitReturning() {
    int x;
    int y;
    function setX(int value) { this.x = value; require(value >= 0); }
    function setXReturning(int value) returns (int) { this.x = value; require(value >= 0); return value; }
    function setY(int value) { this.y = value; require(value >= 0); }
    function getX() view returns (int) { return this.x; }
}
`;

const EMITTING = `
contract SplitEmitting() {
    int x;
    int y;
    event Changed(int value);
    function setX(int value) { this.x = value; require(value >= 0); }
    function setXEmitting(int value) { this.x = value; emit Changed(value); require(value >= 0); }
    function setXEmittingReturning(int value) returns (int) {
      this.x = value; emit Changed(value); require(value >= 0); return value;
    }
    function setY(int value) { this.y = value; require(value >= 0); }
    function getX() view returns (int) { return this.x; }
}
`;

async function fundedSigner(): Promise<{ signer: Signer; provider: any }> {
  const provider = createTestProvider();
  const signer = new Signer(alicePriv, provider);
  for (const byte of ['a1', 'b2', 'c3', 'd4', 'e5', 'f6']) {
    await provider.addUtxo(signer.getAddress(), { txid: byte.repeat(32), vout: 0, satoshis: 1_000_000n });
  }
  return { signer, provider };
}

function stateFromTx(tx: any, category: string, layout: any): Record<string, bigint> {
  const output = getTxOutputs(tx).find(
    (candidate: any) => candidate.token?.category === category
      && candidate.token?.nft?.capability === 'mutable',
  );
  return parsePushdataCommitment(output!.token!.nft!.commitment, layout, 0) as Record<string, bigint>;
}

async function deploySplit(source: string): Promise<{ deployed: any; compiled: any; provider: any }> {
  const { signer, provider } = await fundedSigner();
  const compiled = compileStringSplit(source, { forceSplit: true });
  const deployed = await SplitContractBundle.from(compiled, signer)
    .deploy([], { initialState: { x: 1n, y: 2n } });
  return { deployed, compiled, provider };
}

describe('X1 delegate implementation slot adjacency', () => {
  it('reserves the implementation slot before the returnEvent slot in the published layout', () => {
    const compiled = compileStringSplit(RETURNING, { forceSplit: true });
    const abi = compiled.root.abi as Array<{ name: string; blockLayout?: { slots: Array<{ kind: string }> } }>;
    const kinds = (name: string): string[] =>
      (abi.find((entry) => entry.name === name)?.blockLayout?.slots ?? []).map((slot) => slot.kind);
    // The implementation input is now represented, and it precedes every output-only funder slot.
    expect(kinds('setX')).toEqual(['master', 'dataNft', 'lowLevelCall']);
    expect(kinds('setXReturning')).toEqual(['master', 'dataNft', 'lowLevelCall', 'returnEvent']);
    // `getX` is a view function the splitter keeps in the root, so it delegates to nothing and reserves
    // nothing - the slot is added for a real delegate implementation, not for every returning function.
    expect(kinds('getX')).toEqual(['master', 'dataNft', 'returnEvent']);
  });

  it('settles a delegated returning call, its emitReturn channel, and its staticCall', async () => {
    const { deployed, compiled } = await deploySplit(RETURNING);
    const plain = await deployed.call.setXReturning(15n).send();
    expect(stateFromTx(plain, deployed.categoryId, compiled.root.stateLayout).x).toBe(15n);
    const emitted = await deployed.call.setXReturning(17n).emitReturn().send();
    expect(stateFromTx(emitted, deployed.categoryId, compiled.root.stateLayout).x).toBe(17n);
    expect(await deployed.call.setXReturning(19n).staticCall()).toBe(19n);
    // A non-returning delegated call in the same deployment keeps working, so the reserved slot did not
    // disturb the shape that already had no funder competing for it.
    const plainSet = await deployed.call.setX(21n).send();
    expect(stateFromTx(plainSet, deployed.categoryId, compiled.root.stateLayout).x).toBe(21n);
  }, 300_000);

  // X12. This was the OPEN shape recorded here, and it now settles. The cause was never the graft: the
  // implementation's own `dataNft` slots are PROXY-resident, so an implementation-relative output-only offset
  // that counted them read one index too high per data NFT - the covenant looked at implInput + 2 while the
  // only position after the implementation was implInput + 1. Fixed in emitBlockSlotIndex.
  it('settles a delegated call that materializes an event funder slot', async () => {
    const { deployed, compiled } = await deploySplit(EMITTING);
    const tx = await deployed.call.setXEmitting(23n).send();
    expect(stateFromTx(tx, deployed.categoryId, compiled.root.stateLayout).x).toBe(23n);
  }, 300_000);

  // The same implementation called WITHOUT .emitReturn(): its event settles too, so the emit funder is not
  // conditional on the function being non-returning.
  it('settles a delegated emitting call that also returns, when the return channel is not used', async () => {
    const { deployed, compiled } = await deploySplit(EMITTING);
    const tx = await deployed.call.setXEmittingReturning(31n).send();
    expect(stateFromTx(tx, deployed.categoryId, compiled.root.stateLayout).x).toBe(31n);
    // .staticCall() reads the value through a probe that is never broadcast, so it is unaffected.
    expect(await deployed.call.setXEmittingReturning(41n).staticCall()).toBe(41n);
  }, 300_000);

  /**
   * X56, the shape X12 named and refused at build time, now settling.
   *
   * The implementation resolves EVERY output-only slot implementation-relative, its event and its own
   * returnEvent alike, and computeBlockLayout always orders events before the returnEvent. The forwarder had
   * reserved its returnEvent at the index the implementation's event resolves to, and the SDK appended the
   * return channel immediately after the facet master - so the event NFT landed one output too late and the
   * implementation rejected at input 2. Two changes, both SDK-side: the reservation now admits an
   * implementation `returnEvent` and RELOCATES the forwarder's slot to it (rather than appending a second one,
   * which would lose to the forwarder's in a first-match lookup), and the return channel is emitted after the
   * event outputs. The compiler side needed nothing: X12's split-facet subtraction was already right for both.
   */
  it('settles .emitReturn() on a delegated call that also emits, and reads the value back', async () => {
    const { deployed, compiled } = await deploySplit(EMITTING);
    const tx = await deployed.call.setXEmittingReturning(25n).emitReturn().send();
    expect(stateFromTx(tx, deployed.categoryId, compiled.root.stateLayout).x).toBe(25n);
    // Exactly TWO own-category immutable NFTs, in the order the implementation's covenant resolves: its event
    // NFT at the position the forwarder had reserved for the return, then the anyone-can-spend OP_TRUE return
    // channel the witnessed index points at. If the two had collided one of the checks would have rejected.
    const outputs = getTxOutputs(tx);
    const immutables = outputs.filter((candidate: any) => candidate.token?.category === deployed.categoryId
      && candidate.token?.nft?.capability === 'none');
    expect(immutables).toHaveLength(2);
    expect(outputs.indexOf(immutables[0])).toBe(3);
    expect(outputs.indexOf(immutables[1])).toBe(4);
    expect(immutables[1].to).toBe('51');
    expect(immutables[0].to).not.toBe('51');
  }, 300_000);

  /**
   * GUARD NEGATIVE CONTROL for X56. Deferring the return channel past the event outputs must not move it for an
   * implementation with no event: `deferredDelegateReturnEvents` is empty there, so the plain returning
   * delegate keeps the exact index it had. Without this the settlement above could be credited to a
   * route-wide reordering that happens to work for one shape.
   */
  it('leaves a returning delegate WITHOUT an emit at its original return index', async () => {
    const { deployed, compiled } = await deploySplit(RETURNING);
    const tx = await deployed.call.setXReturning(27n).emitReturn().send();
    expect(stateFromTx(tx, deployed.categoryId, compiled.root.stateLayout).x).toBe(27n);
    const outputs = getTxOutputs(tx);
    const immutables = outputs.filter((candidate: any) => candidate.token?.category === deployed.categoryId
      && candidate.token?.nft?.capability === 'none');
    expect(immutables).toHaveLength(1);
    // master, dataNft, facet master, then the return channel - the position the forwarder's own layout names.
    expect(outputs.indexOf(immutables[0])).toBe(3);
  }, 300_000);

  /**
   * HOSTILE, pinned to input 2 - the implementation's own input, the covenant that resolves both indices - AND
   * pinned to the REASON. The X56 relocation moved the two positions SEC-13's own-category immutable pin
   * admits, so the pin has to still name exactly those two. `own` appends a third own-category immutable NFT
   * and must be refused; `plain` appends an output of the same size and value carrying NO token and must be
   * ACCEPTED. Without the second row the refusal could be a value, fee or output-count fault that has nothing
   * to do with the pin, and would be evidence for nothing.
   */
  it.each([
    ['a third own-category immutable NFT', 'own', 'REJECTED'],
    ['a plain untokened output of the same size', 'plain', 'ACCEPTED'],
  ] as const)('appending %s beside the emitReturn pair: %s', async (_label, kind, expected) => {
    const { deployed, provider } = await deploySplit(EMITTING);
    const builder = await deployed.call.setXEmittingReturning(29n).emitReturn().build();
    builder.addOutput(kind === 'own' ? {
      to: new Uint8Array([0x51]),
      amount: 800n,
      token: {
        amount: 0n,
        category: deployed.categoryId,
        nft: { capability: 'none', commitment: '0119' },
      },
    } : { to: new Uint8Array([0x51]), amount: 800n });
    const outcome = await provider
      .sendRawTransaction(binToHex(encodeTransaction(builder.buildLibauthTransaction())))
      .then(() => 'ACCEPTED')
      .catch((error: Error) => `REJECTED ${(error as Error).message}`);
    if (expected === 'ACCEPTED') {
      expect(outcome).toBe('ACCEPTED');
      return;
    }
    expectScriptRejection(outcome, 2);
    expect(outcome).toContain('OP_VERIFY');
  }, 300_000);
});
