import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { compileString } from 'solidc';
import { getContractFactory } from '../../src/stateful/index.js';
import { fundedSigner } from '../test-util.js';

// IfConvertConditionalEntryOp merges an if/else of entry writes into one predicated write per target,
// `m[k] = cond ? ifValue : elseValue`. It took each arm's last write to a target, so an arm that wrote one entry twice
// lost the earlier write: `m[j] = 1; m[j] = m[j] + 1` stored the pre-branch value plus one, and a check in the dropped
// value never ran. Such an arm now keeps its branch as written. An invariant key never reaches the merge (the entry
// cache folds its writes into one local); a key the cache cannot hold, a local declared in a nested block, does.

const HEAD = `contract C {
  mapping(uint256 => uint256) m;
  mapping(uint256 => uint256) n;
  function put(uint256 k, uint256 v) external { m[k] = v; require(true); }
  function chk(uint256 k, uint256 ev) external { require(m[k] == ev); }
  function chkN(uint256 k, uint256 ev) external { require(n[k] == ev); }
`;
const src = (body: string): string =>
  `${HEAD}  function f(uint256 k, uint256 a, bool c) external { ${body} require(true); }\n}`;
const sha = (body: string, options: Record<string, unknown>): string => createHash('sha256')
  .update(compileString(src(body), { forceStateful: true, ...options }).bytecode).digest('hex');

describe('if/else entry writes: an arm that writes one entry twice', () => {
  it('stores 2 on the true arm and 5 on the false arm', async () => {
    const sc: any = await getContractFactory(compileString(
      src('if (c) { m[k] = 1; m[k] = m[k] + 1; } else { m[k] = 5; }'), { forceStateful: true },
    ), await fundedSigner(8)).deploy();
    await sc.put(4n, 10n).send();
    await sc.f(4n, 0n, true).send();
    await expect(sc.chk(4n, 11n).send()).rejects.toThrow();
    await sc.chk(4n, 2n).send();
    await sc.f(4n, 0n, false).send();
    await sc.chk(4n, 5n).send();
  });

  it('no longer drops the first write: the read after it is refused', () => {
    // The merge compiled this to `m[j] = c ? m[j] + 1 : 5`, which stored 11 over 10.
    expect(() => compileString(
      src('if (a > 0) { uint256 j = k + 1; if (c) { m[j] = 1; m[j] = m[j] + 1; } else { m[j] = 5; } }'),
      { forceStateful: true },
    )).toThrow('a read of `m[j]` after its write in a branch arm is not supported on the direct convention');
  });

  it('refuses a value only the dropped write checked', async () => {
    // The merge compiled this to `m[j] = c ? 7 : 5`: `a - 10` never ran, so a = 3 stored 7.
    const sc: any = await getContractFactory(compileString(
      src('if (a > 0) { uint256 j = k + 1; if (c) { m[j] = a - 10; m[j] = 7; } else { m[j] = 5; } }'),
      { forceStateful: true },
    ), await fundedSigner(8)).deploy();
    await sc.put(5n, 10n).send();
    await expect(sc.f(4n, 3n, true).send()).rejects.toThrow();
    await sc.chk(5n, 10n).send();
    await sc.f(4n, 1n, false).send();
    await sc.chk(5n, 5n).send();
    // The twice-written arm stores the source's value or fails closed, never another.
    const sent = await sc.f(4n, 20n, true).send().then(() => true, () => false);
    await sc.chk(5n, sent ? 7n : 5n).send();
  });

  it('leaves a single write per arm byte-identical', () => {
    // Bytecode of the pre-fix build (958fb0120); the default and direct conventions compile these alike.
    const before: Record<string, string> = {
      'k = k + 1; if (c) { m[k] = a; } else { m[k] = 5; }':
        '31412ace540dbb79548fbd975c0cfcfe82f2bf96cff9786f7c2341e4c604c95b',
      'if (c) { m[k] = a; } else { n[k] = 5; }':
        '496ae871b493b23bf4655a4af7a97db5311308afa3f6c0c81bbd32edc4f592af',
      'k = k + 1; if (c) { m[k] = a; n[k] = 1; } else { m[k] = 5; }':
        'c5f857767736ad24a66c75e256ace8b15b46557d25df5881fd8b4d11f8ba3277',
    };
    for (const [body, hash] of Object.entries(before)) {
      expect(sha(body, {}), body).toBe(hash);
      expect(sha(body, { messageBus: false }), body).toBe(hash);
    }
    // The merged arms compile as the predicated write the source could spell itself.
    expect(sha('k = k + 1; bool cc = c; m[k] = cc ? a : 5;', {}))
      .toBe(sha('k = k + 1; if (c) { m[k] = a; } else { m[k] = 5; }', {}));
  });
});
