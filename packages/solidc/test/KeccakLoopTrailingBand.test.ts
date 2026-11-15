import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';
import { KeccakLoopSideCarError } from '../src/generation/GenerateTargetTraversal.js';

/**
 * A keccak256 loop reads side-car k from the input master + blockSize + k and recreates it at the output of that index.
 * A collection walk reads its entries from the inputs right after the block, and a write of dynamic state checks its
 * new chunks at the outputs right after the block. Neither counts the side-cars and the loop counts neither, so an
 * entry with the loop and either run is refused by name. The chunks an entry only reads are found through its
 * `__internal__dynamicChunkInputBase` witness and follow the side-cars, so a loop beside a read compiles.
 */
const LOOP = 'bytes32 x = 0x; for (int i = 0; i < k; i++) { x = keccak256(b); } h = x;';

const BESIDE_WALK = `contract T { bytes32 h; int total; enumerable mapping(bytes20 => int) bal;
  function put(bytes20 k, int v) public { bal[k] = v; }
  function f(bytes b, int k) public { ${LOOP} int sum = 0; for (int value of this.bal) { sum = sum + value; } total = sum; }
}`;

const BESIDE_WRITE = `contract T { bytes32 h; int[] a;
  function f(bytes b, int k) public { ${LOOP} a.push(k); }
}`;

const BESIDE_READ = `contract T { bytes32 h; int[] a; int seen;
  function put(int x) public { a.push(x); }
  function f(bytes b, int k) public { int v = a[0]; ${LOOP} seen = v; }
}`;

/** The refusal, or `undefined` if the fixture compiled. */
function refusalOf(source: string): KeccakLoopSideCarError | undefined {
  try {
    compileString(source);
    return undefined;
  } catch (error) {
    if (error instanceof KeccakLoopSideCarError) return error;
    throw error;
  }
}

describe('a keccak256 loop beside a run that takes the indexes after the block', () => {
  it('refuses the loop beside a collection walk, naming the function and the walk', () => {
    const refusal = refusalOf(BESIDE_WALK);
    expect(refusal?.reason).toBe('keccak-loop-shares-trailing-band');
    expect(refusal?.message).toContain('\'f\' hashes in a keccak256 loop, which reads side-car k from the input '
      + 'master + blockSize + k');
    expect(refusal?.message).toContain('walks the collection \'bal\', whose entries it reads from the inputs right '
      + 'after its block, where the loop reads its side-cars');
  });

  it('refuses the loop beside a write of dynamic state, naming the function and the state', () => {
    const refusal = refusalOf(BESIDE_WRITE);
    expect(refusal?.reason).toBe('keccak-loop-shares-trailing-band');
    expect(refusal?.message).toContain('\'f\' hashes in a keccak256 loop');
    expect(refusal?.message).toContain('writes the dynamic state \'a\', whose new chunks it checks at the outputs '
      + 'right after its block, where the loop recreates its side-cars');
  });

  it('compiles the loop beside a read of dynamic state, whose chunks follow the side-cars', () => {
    expect(refusalOf(BESIDE_READ)).toBeUndefined();
    const artifact = compileString(BESIDE_READ) as unknown as {
      abi: Array<{ name: string; keccakLoopReads?: boolean; dynamicReads?: string[]; dynamicWrites?: string[] }>;
    };
    const entry = artifact.abi.find((row) => row.name === 'f')!;
    expect(entry.keccakLoopReads).toBe(true);
    expect(entry.dynamicReads).toEqual(['a']);
    expect(entry.dynamicWrites ?? []).toEqual([]);
  });
});
