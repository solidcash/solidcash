import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';

describe('vmap fixed-write batch metadata', () => {
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

  // A single fixed upsert IS batched now, deliberately. The old `> 1` gate left a lone vmap insert - ERC20Mock's
  // constructor `_balances[msg.sender] = supply` - on the scalar path, which carries no batch witnesses and
  // fails constructor derivation with OP_EQUALVERIFY against an empty key. The batch path is the shape mint and
  // transfer already use successfully, so constructors take it too. See SymbolTableTraversal.
  it('marks a single fixed upsert as a batch, so a lone vmap insert can derive', () => {
    const artifact = compileString(`contract C {
      mapping(int => int) m;
      function f(int k, int v) external { m[k] = v; require(true); }
    }`, { forceStateful: true });
    expect(artifact.abi.find((f) => f.name === 'f')?.sortedBatchInfo)
      .toEqual([{ collection: 'm', slotIndices: [0] }]);
  });

  it('does not mislabel a constructed chunkable value as its first element parameter', () => {
    const artifact = compileString(`contract C {
      mapping(int => bytes32[]) m;
      function set(int k, bytes32 a, bytes32 b) external {
        m[k] = [a, b];
        require(true);
      }
      function direct(int k, bytes32[] value) external {
        m[k] = value;
        require(true);
      }
    }`, { forceStateful: true });
    expect(artifact.abi.find((f) => f.name === 'set')?.entryAccesses?.[0]?.valueParam).toBeUndefined();
    expect(artifact.abi.find((f) => f.name === 'direct')?.entryAccesses?.[0]?.valueParam).toBe('value');
  });

  it('keeps a delegate write scalar because its collection topology belongs to the proxy', () => {
    const artifact = compileString(`library L {
      mapping(int => int) m;
      function f(int k, int v) public { m[k] = v; }
    }`, { forceStateful: true });
    const fn = artifact.abi.find((entry) => entry.name === 'f');
    expect(fn?.modifiers).toContain('delegate');
    expect(fn?.entryAccesses).toHaveLength(1);
    expect(fn?.sortedBatchInfo).toBeUndefined();
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
