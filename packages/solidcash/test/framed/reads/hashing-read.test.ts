import { describe, expect, it } from 'vitest';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import { deploy } from '../call/value-harness.js';

/**
 * A read of an entry that hashes, which reads one keccak256 side-car per hash right after its own input.
 *
 * `link` hashes its argument with a state field, so the preimage is the body's to compute; `chainOf` hashes once per
 * turn of a loop its argument bounds, each turn over the digest the turn before left. A read co-spends the side-cars
 * a call would, as many as the loop's turns, and learns each preimage from the body's own bind, so the answer is the
 * body's digest.
 */

const SEED = 7n;

const SOURCE = 'pragma solidity ^0.8.0;'
  + ` contract Chain { uint256 public seed = ${SEED};`
  + '   function link(uint256 x) external view returns (bytes32) { return keccak256(abi.encodePacked(x, seed)); }'
  + '   function chainOf(uint256 n) external view returns (bytes32 d) {'
  + '     for (uint256 i = 0; i < n; i++) { d = keccak256(abi.encodePacked(d, i, seed)); } } }';

const chain = compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true } as never).Chain!;

/** A uint256 as `abi.encodePacked` lays it out: 32 big-endian bytes. */
function word(value: bigint): Uint8Array {
  return Uint8Array.from(Buffer.from(value.toString(16).padStart(64, '0'), 'hex'));
}

/** `keccak256(abi.encodePacked(...parts))`. */
function packedKeccak(...parts: readonly Uint8Array[]): Uint8Array {
  return keccak_256(Uint8Array.from(parts.flatMap((part) => [...part])));
}

describe('a read of an entry that hashes', () => {
  it('reads the digest of a preimage the body computes from its state', async () => {
    const deployed = await deploy(chain);
    const read = await readFramedEntry({
      provider: deployed.provider, artifact: chain, categoryId: deployed.categoryId, functionName: 'link',
      args: [5n], vm: compositionMachine(),
    });
    expect(read.accepted).toBe(true);
    expect(read.value).toStrictEqual(packedKeccak(word(5n), word(SEED)));
  });

  it('reads the digest a loop chains, one side-car per turn', async () => {
    const deployed = await deploy(chain);
    const read = await readFramedEntry({
      provider: deployed.provider, artifact: chain, categoryId: deployed.categoryId, functionName: 'chainOf',
      args: [3n], vm: compositionMachine(),
    });
    let digest: Uint8Array = new Uint8Array(32);
    for (let turn = 0n; turn < 3n; turn += 1n) digest = packedKeccak(digest, word(turn), word(SEED));
    expect(read.accepted).toBe(true);
    expect(read.value).toStrictEqual(digest);
  });
});
