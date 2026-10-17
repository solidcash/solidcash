// Shared-subset conformance: ONE source string compiles under BOTH solc and solidc. The source is a
// Solidity-spelled `contract C` whose body is a self-contained require-covenant; solidc accepts the Solidity
// pragma/contract/visibility spellings (evmCompat), so no per-dialect template is generated.
import { describe, it } from 'vitest';
import { assertSharedSourceAccepts, sharedSourceCase } from './harness.js';

const run = (params: string, body: string, args: unknown[], label?: string): Promise<void> =>
  assertSharedSourceAccepts(
    sharedSourceCase({ params, body, args, label }).source, 'f', args,
  );

describe('shared-subset source: identical text on solc + solidc', () => {
  it('abi.decode round-trip of an int is its exact inverse on both VMs', () => {
    return run('int a', 'require(abi.decode(abi.encode(a), (int)) == a);', [12345n], 'decode<int>');
  });

  it('a checked arithmetic covenant holds on both VMs', () => {
    return run('int a, int b', 'require((a + b) - b == a);', [7n, 1000n], 'checked add/sub');
  });

  it('a multi-word decode round-trip holds on both VMs', () => {
    const body = '(uint x, uint y) = abi.decode(abi.encode(a, b), (uint, uint));\n'
      + '    require(x == a && y == b);';
    return run('uint a, uint b', body, [42n, 999n], 'decode<(uint,uint)>');
  });
});
