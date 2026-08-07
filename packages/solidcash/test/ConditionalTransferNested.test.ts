import { describe, it, expect } from 'vitest';
import { compileString as compileMessageBus } from 'solidc';
import { compileString } from './direct-compile.js';

// A value-transfer in a NESTED/else-if branch used to CRASH codegen with an internal error ("__internal__transfer_lb_N
// does not exist on the stack"): visitBranch pre-allocated a transfer slot per branch keyed by pendingTransfers.length,
// so a nested branch over-allocated a slot that was pushed only conditionally and then missing at the epilogue co-spend.
// Fixed by (1) a min/max transfer-count model (branchOps.countTransfersMinMax): mutually-exclusive arms take max (not
// sum) for the slot count and min for conditionality, so nested/else-if transfers reserve the right slots and mark the
// conditional ones correctly; (2) nested branches skip transfer pre-allocation (GTT transferPreallocDepth), reusing the
// enclosing branch's slots via the (already-correct, shared) semantic transfer index. Flat if/else is byte-identical
// (no nested branch => min===max===count). These pin the crash-fix; the co-spend epilogue itself is exercised green by
// the value-transfer e2e suite (Mecenas/Composability/TokenContainer/...), which this change does not regress.
describe('value-transfer in a nested/else-if branch compiles (was an internal stack crash)', () => {
  const cc = (body: string): string =>
    `contract C { function f(uint c, address payable dst) { ${body} require(true); } }`;
  const ok = (body: string): void =>
    expect(compileString(cc(body), { solidityImportCompat: true }).contractName).toBe('C');

  it('single transfer nested in an else-if chain', () => {
    ok('if (c == 0) {} else if (c == 1) { dst.transfer(1000); } else if (c == 2) {}');
  });
  it('two mutually-exclusive transfers across else-if arms (share one slot)', () => {
    ok('if (c == 1) { dst.transfer(1000); } else if (c == 2) { dst.transfer(2000); }');
  });
  it('sequential transfers in one arm, one of them nested (two slots)', () => {
    ok('if (c == 1) { dst.transfer(1000); if (c == 1) { dst.transfer(2000); } }');
  });
  it('deeply nested else-if with a single transfer at the tail', () => {
    ok('if (c==0){} else if (c==1){} else if (c==2){} else if (c==3){ dst.transfer(1000); } else if (c==4){}');
  });
  it('the original corpus shape: mixed value/non-value external calls in a 6-branch else-if chain', () => {
    const src = 'interface I { function a() external pure; function b() external; function c() external payable;'
      + ' function x() external returns (uint); }'
      + ' contract C { I i = I(address(0xcafecafe)); constructor() payable {}'
      + ' function f(uint c) external returns (uint) { if (c==0) i.a(); else if (c==1) i.b(); else if (c==2) i.c();'
      + ' else if (c==3) i.c{value: 1}(); else if (c==4) i.x(); return 1 + c; } }';
    expect(compileMessageBus(src, { solidityImportCompat: true }).contractName).toBe('C');
  });

  it('fails with a stable source diagnostic when a modifier guard cannot preserve a send frame', () => {
    const src = 'contract C { modifier owner(bool allowed) { if (allowed) _; }'
      + ' function f(bool allowed, address payable refund) public owner(allowed) {'
      + ' if (!refund.send(1)) revert(); require(true); } }';
    expect(() => compileString(src, { solidityImportCompat: true }))
      .toThrow(/TransferFrameUnavailableError|cannot preserve its covenant frame/);
  });
});
