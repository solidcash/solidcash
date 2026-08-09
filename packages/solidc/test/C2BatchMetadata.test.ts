import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';

describe('C2 fixed-write batch metadata', () => {
  it('groups distinct fixed writes to one collection by final entry slot', () => {
    const artifact = compileString(`contract C {
      mapping(int => int) m;
      function f(int a, int b, int v) external {
        m[a] = m[a] - v;
        m[b] = m[b] + v;
        require(true);
      }
    }`, { forceStateful: true });
    const fn = artifact.abi.find((f) => f.name === 'f');
    expect(fn?.sortedBatchInfo).toEqual([{ collection: 'm', slotIndices: [0, 1] }]);
  });

  // A single fixed upsert IS batched now, deliberately. The old `> 1` gate left a lone C2 insert - ERC20Mock's
  // constructor `_balances[msg.sender] = supply` - on the scalar path, which carries no batch witnesses and
  // fails constructor derivation with OP_EQUALVERIFY against an empty key. The batch path is the shape mint and
  // transfer already use successfully, so constructors take it too. See SymbolTableTraversal.
  it('marks a single fixed upsert as a batch, so a lone C2 insert can derive', () => {
    const artifact = compileString(`contract C {
      mapping(int => int) m;
      function f(int k, int v) external { m[k] = v; require(true); }
    }`, { forceStateful: true });
    expect(artifact.abi.find((f) => f.name === 'f')?.sortedBatchInfo)
      .toEqual([{ collection: 'm', slotIndices: [0] }]);
  });

  it('marks only a computed write followed by an actual delete as an alias candidate', () => {
    const artifact = compileString(`contract C {
      address[] keys;
      mapping(address => int) m;
      function remove(address key) external {
        address lastKey = keys[keys.length - 1];
        m[lastKey] = m[key];
        delete m[key];
        require(true);
      }
    }`, { forceStateful: true, chunkedArrays: true });
    const accesses = artifact.abi.find((f) => f.name === 'remove')?.entryAccesses ?? [];
    expect(accesses.find((a) => a.keySources?.some((s) => s.kind === 'stateArrayLast'))?.aliasCondDeleteSlot)
      .toBe(accesses.findIndex((a) => a.keyParams.includes('key')));
  });

  it('does not mark an ordinary state-array-last write plus read as an alias candidate', () => {
    const artifact = compileString(`contract C {
      address[] keys;
      mapping(address => int) m;
      function update(address key, int value) external {
        address lastKey = keys[keys.length - 1];
        int old = m[key];
        m[lastKey] = value + old;
        require(true);
      }
    }`, { forceStateful: true, chunkedArrays: true });
    const accesses = artifact.abi.find((f) => f.name === 'update')?.entryAccesses ?? [];
    // `[].every(...)` is `true`, and the reader defaults to `[]`, so without this the guard would pass on an
    // artifact that published no entry accesses at all. Measured at this commit: 2.
    expect(accesses, 'no entry accesses published, so the alias check below has no subject').toHaveLength(2);
    expect(accesses.every((a) => a.aliasCondDeleteSlot === undefined)).toBe(true);
  });
});
