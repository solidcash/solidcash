import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';
import { KeccakLoopSideCarError } from '../src/generation/GenerateTargetTraversal.js';

/**
 * A keccak256 loop reads side-car k from the input master + blockSize + k and recreates it at the output of that index.
 * A collection walk reads its entries from the inputs right after the block, and a write of dynamic state checks its
 * new chunks at the outputs right after the block. Neither counts the side-cars and the loop counts neither, so an
 * entry with the loop and either run is refused by name. The chunks an entry only reads are found through its
 * `__internal__dynamicChunkInputBase` witness and follow the side-cars, so a loop beside a read compiles. Beside such a
 * read, a loop that runs after a mapping loop starts its counter past the mapping loop's inputs, which the mapping loop
 * takes past the chunks: that order is refused, and the loop that runs first compiles.
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

const MAPPING_LOOP = 'for (int j = 0; j < keys.length; j++) { this.values[keys[j]] = 1; }';

/** A read, then a mapping loop, then the keccak256 loop: the loop's counter starts past the mapping loop's inputs. */
const READ_AFTER_MAPPING_LOOP = `contract T { bytes32 h; int[] a; int seen; mapping(int => int) values;
  function put(int x) public { a.push(x); }
  function f(bytes b, int k, int[] keys) public { int v = a[0]; ${MAPPING_LOOP} ${LOOP} seen = v; }
}`;

/** A read, then the keccak256 loop, then a mapping loop, which counts the side-cars and the chunks. */
const READ_BEFORE_MAPPING_LOOP = `contract T { bytes32 h; int[] a; int seen; mapping(int => int) values;
  function put(int x) public { a.push(x); }
  function f(bytes b, int k, int[] keys) public { int v = a[0]; ${LOOP} ${MAPPING_LOOP} seen = v; }
}`;

/** A read, the keccak256 loop and a fixed write of a sorted mapping: a sorted batch, which is no mapping loop. */
const READ_BESIDE_FIXED_MAPPING_WRITE = `contract T { bytes32 h; int[] a; int seen; mapping(int => int) values;
  function put(int x) public { a.push(x); }
  function f(bytes b, int k, int key) public { int v = a[0]; ${LOOP} this.values[key] = 1; seen = v; }
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

  it('refuses the loop after a mapping loop beside a read, naming the function, the mapping and the state', () => {
    const refusal = refusalOf(READ_AFTER_MAPPING_LOOP);
    expect(refusal?.reason).toBe('keccak-loop-shares-trailing-band');
    expect(refusal?.message).toContain('\'f\' hashes in a keccak256 loop that runs after a loop over the mapping '
      + '\'values\', and reads the dynamic state \'a\'');
    expect(refusal?.message).toContain('reads side-car k from the input master + blockSize + m + k, past the m inputs of '
      + 'the mapping loop but not past the chunks');
    expect(refusal?.message).toContain('Hash in a loop that runs before the mapping loop, or read \'a\' in a function '
      + 'of its own');
  });

  it('compiles the loop before a mapping loop beside a read, whose chunks follow the side-cars', () => {
    expect(refusalOf(READ_BEFORE_MAPPING_LOOP)).toBeUndefined();
    const artifact = compileString(READ_BEFORE_MAPPING_LOOP) as unknown as {
      abi: Array<{ name: string; keccakLoopReads?: boolean; keccakLoopPrecedesTrailingUser?: boolean;
        dynamicReads?: string[] }>;
    };
    const entry = artifact.abi.find((row) => row.name === 'f')!;
    expect(entry.keccakLoopReads).toBe(true);
    expect(entry.keccakLoopPrecedesTrailingUser).toBe(true);
    expect(entry.dynamicReads).toEqual(['a']);
  });

  it('compiles the loop beside a read and a fixed write of a sorted mapping, a batch that no loop runs', () => {
    expect(refusalOf(READ_BESIDE_FIXED_MAPPING_WRITE)).toBeUndefined();
    const artifact = compileString(READ_BESIDE_FIXED_MAPPING_WRITE) as unknown as {
      abi: Array<{ name: string; keccakLoopReads?: boolean; keccakLoopPrecedesTrailingUser?: boolean;
        dynamicReads?: string[]; sortedBatchInfo?: Array<{ collection: string }>; sortedUpsertLoopInfo?: unknown[] }>;
    };
    const entry = artifact.abi.find((row) => row.name === 'f')!;
    expect(entry.keccakLoopReads).toBe(true);
    expect(entry.keccakLoopPrecedesTrailingUser).toBeUndefined();
    expect(entry.dynamicReads).toEqual(['a']);
    expect(entry.sortedBatchInfo?.map((batch) => batch.collection)).toEqual(['values']);
    expect(entry.sortedUpsertLoopInfo).toBeUndefined();
  });
});
