import { describe, it, expect } from 'vitest';
import { compileString } from '../src/index.js';

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

  it('does not mark a single fixed upsert as a batch', () => {
    const artifact = compileString(`contract C {
      mapping(int => int) m;
      function f(int k, int v) external { m[k] = v; require(true); }
    }`, { forceStateful: true });
    expect(artifact.abi.find((f) => f.name === 'f')?.sortedBatchInfo).toBeUndefined();
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
    expect(accesses.every((a) => a.aliasCondDeleteSlot === undefined)).toBe(true);
  });
});
