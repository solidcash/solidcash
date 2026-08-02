import { describe, it, expect, vi } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, bobPriv } from '../fixture/vars.js';

// A signature failure is rejected by the BCH-2026 preflight before submission, so it must not be mislabeled as
// a later submission trace.
const nullfail = 'layer3: BCH-2026 preflight failed at input 0: Program failed a signature verification '
  + 'with a non-null signature (violating the "NULLFAIL" rule). Algorithm used: Schnorr.';
const FAILING = `pragma solidcash >=0.8.0;
contract Failing() {
  bigint x;
  function bump(pubkey pk, sig s) {
    require(checkSig(s, pk));
    this.x = this.x + 1;
  }
}`;

describe('covenant failure boundary', () => {
  const provider = createTestProvider();

  it('names a signature preflight refusal without claiming a submission trace', async () => {
    const art = compileString(FAILING);
    const c = new Contract(art, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, c, art.stateLayout!, { x: 0n }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(c, categoryId);

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Wrong sig: signed by bob, checked against alicePub -> checkSig fails during preflight.
    await expect(sc.bump(alicePub, new SignatureTemplate(bobPriv)).send()).rejects.toThrow(nullfail);
    const logged = errSpy.mock.calls.map((args) => args.join(' ')).join('\n');
    errSpy.mockRestore();

    expect(logged).toBe('');
  });
});
