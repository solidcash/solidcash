import { describe, it, expect, vi } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, bobPriv } from '../fixture/vars.js';

// On a covenant script failure, send() emits an accurate op-level VM trace (Bch2026, the mocknet VM) of the
// submitted tx, pinpointing the failing opcode + stack - unlike the source-map best-effort which mis-maps
// optimised subroutine bytecode.
const FAILING = `pragma solidcash >=0.8.0;
contract Failing() {
  bigint x;
  function bump(pubkey pk, sig s) {
    require(checkSig(s, pk));
    this.x = this.x + 1;
  }
}`;

describe('covenant failure VM trace', () => {
  const provider = createTestProvider();

  it('logs an accurate op-level trace when a covenant fails', async () => {
    const art = compileString(FAILING);
    const c = new Contract(art, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, c, art.stateLayout!, { x: 0n }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(c, categoryId);

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Wrong sig: signed by bob, checked against alicePub -> checkSig fails on-chain at submission.
    await expect(sc.bump(alicePub, new SignatureTemplate(bobPriv)).send()).rejects.toThrow();
    const logged = errSpy.mock.calls.map((args) => args.join(' ')).join('\n');
    errSpy.mockRestore();

    expect(logged).toContain('[covenant VM trace]');
    expect(logged).toMatch(/op=0x[0-9a-f]{2}/);
    expect(logged).toContain('FAILS HERE');
  });
});
