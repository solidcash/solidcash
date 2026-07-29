import { describe, expect, it } from 'vitest';
import { compileStringSplit } from 'solidc';
import { parsePushdataCommitment } from '@solidcash/utils';
import { Signer, SplitContractBundle } from '../../src/index.js';
import { alicePriv } from '../fixture/vars.js';
import { createTestProvider, getTxOutputs } from '../test-util.js';

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

async function fundedSigner(): Promise<Signer> {
  const provider = createTestProvider();
  const signer = new Signer(alicePriv, provider);
  for (const byte of ['a1', 'b2', 'c3', 'd4', 'e5', 'f6']) {
    await provider.addUtxo(signer.getAddress(), { txid: byte.repeat(32), vout: 0, satoshis: 1_000_000n });
  }
  return signer;
}

function stateFromTx(tx: any, category: string, layout: any): Record<string, bigint> {
  const output = getTxOutputs(tx).find(
    (candidate: any) => candidate.token?.category === category
      && candidate.token?.nft?.capability === 'mutable',
  );
  return parsePushdataCommitment(output!.token!.nft!.commitment, layout, 0) as Record<string, bigint>;
}

async function deploySplit(source: string): Promise<{ deployed: any; compiled: any }> {
  const signer = await fundedSigner();
  const compiled = compileStringSplit(source, { forceSplit: true });
  const deployed = await SplitContractBundle.from(compiled, signer)
    .deploy([], { initialState: { x: 1n, y: 2n } });
  return { deployed, compiled };
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

  // STILL OPEN, now named rather than opaque. With .emitReturn() the implementation's event NFT takes the
  // output index this forwarder reserved for the return event, and the return event moves one later; the two
  // offsets disagree and the implementation rejected at input 2. Without an `emit` they coincide, which is
  // why the plain returning delegate above settles. Refused at build time with that reason.
  it('refuses .emitReturn() on a delegated call that also emits, with a named reason', async () => {
    const { deployed } = await deploySplit(EMITTING);
    const outcome = await deployed.call.setXEmittingReturning(25n).emitReturn().send()
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expect(outcome).toContain('which both emits an event and returns a value');
    expect(outcome).toContain('Call it without .emitReturn()');
  }, 300_000);
});
