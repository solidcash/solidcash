import { describe, it, expect } from 'vitest';
import { binToHex, utf8ToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { getContractFactory } from '../../src/stateful/index.js';
import { fundedSigner } from '../test-util.js';

// A constructor that writes a sorted-mapping value over 60 bytes keeps it in value-chunk NFTs at the address of
// (category, collection, slot, sha256(value)). The deploy probe never reserved those outputs and the genesis never
// created them, so the covenant's chunk-count pin found none, nothing new was learned, and the derivation was refused
// as an oscillation. The probe learns each run from its pin and the genesis materializes it.
const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const BLOB = Array.from({ length: 300 }, (_, i) => ALPHABET[(i * 7 + 3) % ALPHABET.length]).join(''); // three chunks
const WIDE = 2n ** 200n; // keeps the array value over 60 bytes in any element encoding
const LIST = [WIDE + 11n, WIDE + 22n, WIDE + 33n];

const SRC = `contract C {
  mapping(uint256 => bytes) blobs;
  mapping(uint256 => uint256[]) lists;
  constructor() {
    blobs[7] = "${BLOB}";
    lists[3].push(${LIST[0]});
    lists[3].push(${LIST[1]});
    lists[3].push(${LIST[2]});
  }
  function check(uint256 len, uint256 third) public {
    require(blobs[7].length == len);
    require(lists[3][2] == third);
  }
}`;

interface Call { send: () => Promise<unknown> }
interface Handle {
  check: (len: bigint, third: bigint) => Call;
  getEntries: (collection: string) => Promise<Array<{ value: unknown }>>;
}

describe('constructor-written mapping values over 60 bytes (VM-derived deploy)', () => {
  it('materializes each value-chunk run at genesis and reads it back in later spends', async () => {
    const artifact = compileString(SRC, { evmCompat: true });
    const sc = await getContractFactory(artifact, await fundedSigner(8)).deploy() as unknown as Handle;
    const [blob] = await sc.getEntries('blobs');
    expect(binToHex(blob.value as Uint8Array)).toBe(binToHex(utf8ToBin(BLOB)));
    const [list] = await sc.getEntries('lists');
    expect([...(list.value as bigint[])]).toEqual(LIST);
    await sc.check(300n, LIST[2]).send();
    // The reads are real: a wrong length or element reverts.
    await expect(sc.check(299n, LIST[2]).send()).rejects.toThrow();
    await expect(sc.check(300n, LIST[1]).send()).rejects.toThrow();
  });
});
