import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

const SOURCE = `pragma solidcash >=0.8.0;
contract BatchCounter() {
  int counter;
  function add(int n) public { this.counter = this.counter + n; require(n >= 0); }
  function reset() public { this.counter = 0; require(true); }
  function signed(sig s, pubkey pk) public { require(checkSig(s, pk)); }
}`;

describe('Release 4 compiler-hidden local batch', () => {
  it('advertises SCB1 without exposing a source ABI function', () => {
    const artifact = compileString(SOURCE, {
      forceStateful: true,
      experimentalHiddenBatch: true,
    });
    expect(artifact.hiddenBatch).toMatchObject({
      version: 1,
      selector: '53434231',
      maximumRows: 8,
    });
    expect(artifact.abi.some((fn) => fn.name === '__scb1')).toBe(false);
    expect(artifact.hiddenBatch?.route.selector).toBe('53434231');
    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'add')?.eligible).toBe(true);
    expect(artifact.hiddenBatch?.handlers.find((handler) => handler.name === 'signed')).toMatchObject({
      eligible: false,
      rejectionReason: 'transaction-signature-route-binding-required',
    });
  });

  it('leaves artifacts byte-identical when the experimental capability is disabled', () => {
    const baseline = compileString(SOURCE, { forceStateful: true });
    const explicitOff = compileString(SOURCE, {
      forceStateful: true,
      experimentalHiddenBatch: false,
    });
    expect(explicitOff.bytecode).toBe(baseline.bytecode);
    expect(explicitOff.hiddenBatch).toBeUndefined();
  });
});
