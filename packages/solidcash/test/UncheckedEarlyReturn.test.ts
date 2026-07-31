import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../src/index.js';
import type { FunctionArgument } from '../src/index.js';
import { createTestProvider, setupStatefulUtxos } from './test-util.js';

// An early return inside an `unchecked` block (OZ Math.tryAdd shape) must nest into if/else so codegen does not
// desync the fall-through stack. This drives BOTH branches and requires the exact returned values, so a control-flow
// desync (wrong branch value / lost local) rejects the transaction. Verifies the fix produces CORRECT values, not
// just that it compiles.
const SRC = `contract C {
  int counter;
  function tryAdd(uint256 a, uint256 b) internal pure returns (bool, uint256) {
    unchecked { uint256 c = a + b; if (c < a) return (false, 0); return (true, c); }
  }
  function checkOk(uint256 a, uint256 b, uint256 expected) public {
    (bool ok, uint256 r) = tryAdd(a, b);
    require(ok);
    require(r == expected);
  }
}`;

async function call(method: string, args: FunctionArgument[]): Promise<void> {
  const provider = createTestProvider();
  const artifact = compileString(SRC, { solidityImportCompat: true });
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
  );
  const sc = StatefulContract.withCategory(contract, categoryId);
  await (sc as unknown as Record<string, (...a: FunctionArgument[]) => { send(): Promise<unknown> }>)[method](...args)
    .send();
}

describe('unchecked-block early return (OZ Math.tryAdd) produces correct values at runtime', () => {
  it('the non-overflowing fall-through path returns (true, a + b)', async () => {
    await call('checkOk', [3n, 4n, 7n]); // c = 7 >= 3, so return (true, 7)
  });
  it('rejects a wrong expected sum (the returned local c is exact)', async () => {
    await expect(call('checkOk', [3n, 4n, 8n])).rejects.toThrow(
      /mandatory-script-verify-flag-failed .*input index 0: Program failed an OP_VERIFY operation/,
    );
  });
});
