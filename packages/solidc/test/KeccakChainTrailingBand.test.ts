import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';
import { KeccakChainSideCarError } from '../src/generation/GenerateTargetTraversal.js';

/**
 * A keccak256 chain of an unbounded parameter reads its FINAL side-car from the input master + blockSize + n/136, after
 * one side-car per full 136-byte block, and recreates each at the output of its own index. A collection walk reads its
 * entries from the inputs right after the block, and a write of dynamic state checks its new chunks at the outputs right
 * after the block. Neither counts the chain's side-cars and the chain counts neither, so an entry with the chain and
 * either run is refused by name. The chunks an entry only reads are found through its
 * `__internal__dynamicChunkInputBase` witness, so a chain beside a read compiles.
 */
const CHAIN = 'h = keccak256(b);';

const BESIDE_WALK = `contract T { bytes32 h; int total; enumerable mapping(bytes20 => int) bal;
  function put(bytes20 k, int v) public { bal[k] = v; }
  function f(bytes b) public { ${CHAIN} int sum = 0; for (int value of this.bal) { sum = sum + value; } total = sum; }
}`;

const BESIDE_WRITE = `contract T { bytes32 h; int[] a;
  function f(bytes b, int k) public { ${CHAIN} a.push(k); }
}`;

const BESIDE_READ = `contract T { bytes32 h; int[] a; int seen;
  function put(int x) public { a.push(x); }
  function f(bytes b) public { int v = a[0]; ${CHAIN} seen = v; }
}`;

/** The refusal, or `undefined` if the fixture compiled. */
function refusalOf(source: string): KeccakChainSideCarError | undefined {
  try {
    compileString(source);
    return undefined;
  } catch (error) {
    if (error instanceof KeccakChainSideCarError) return error;
    throw error;
  }
}

describe('a keccak256 chain beside a run that takes the indexes after the block', () => {
  it('refuses the chain beside a collection walk, naming the function and the walk', () => {
    const refusal = refusalOf(BESIDE_WALK);
    expect(refusal?.reason).toBe('keccak-chain-shares-trailing-band');
    expect(refusal?.message).toContain('\'f\' hashes an unbounded parameter in a keccak256 chain, which reads its FINAL '
      + 'side-car from the input master + blockSize + n/136');
    expect(refusal?.message).toContain('walks the collection \'bal\', whose entries it reads from the inputs right '
      + 'after its block, where the chain reads its side-cars');
    expect(refusal?.message).toContain('Hash the value in a function of its own, or move the walk into one');
  });

  it('refuses the chain beside a write of dynamic state, naming the function and the state', () => {
    const refusal = refusalOf(BESIDE_WRITE);
    expect(refusal?.reason).toBe('keccak-chain-shares-trailing-band');
    expect(refusal?.message).toContain('\'f\' hashes an unbounded parameter in a keccak256 chain');
    expect(refusal?.message).toContain('writes the dynamic state \'a\', whose new chunks it checks at the outputs '
      + 'right after its block, where the chain recreates its side-cars');
    expect(refusal?.message).toContain('or move the write into one');
  });

  it('compiles the chain beside a read of dynamic state, whose chunks follow the side-cars', () => {
    expect(refusalOf(BESIDE_READ)).toBeUndefined();
    const artifact = compileString(BESIDE_READ) as unknown as {
      abi: Array<{ name: string; keccakChainReads?: boolean; dynamicReads?: string[]; dynamicWrites?: string[] }>;
    };
    const entry = artifact.abi.find((row) => row.name === 'f')!;
    expect(entry.keccakChainReads).toBe(true);
    expect(entry.dynamicReads).toEqual(['a']);
    expect(entry.dynamicWrites ?? []).toEqual([]);
  });
});
