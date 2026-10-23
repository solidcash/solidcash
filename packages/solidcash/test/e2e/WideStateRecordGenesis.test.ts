import { describe, it, expect } from 'vitest';
import { compileString } from '@solidcash/solidc';
import { getContractFactory } from '../../src/stateful/index.js';
import { fundedSigner } from '../test-util.js';

// A `packed` bounded value array is one data-NFT field (unmarked, this size would chunk-pack), so under a relaxed
// commitment limit its record is far wider than the 252-byte output the fixed 1200-satoshi amount covers. The
// data-NFT covenant pins a record's value on every spend, so the genesis funds it at its own dust floor; at 1200
// satoshis the finalized byte gate refused the genesis `output-dust`. Mocknet only: a commitment past 128 bytes is
// consensus-invalid on a node.
const SRC = `contract C {
  uint256[24] packed values;
  uint256 count;
  constructor() { values[3] = 42; values[23] = 7; count = 2; }
  function check(uint256 i, uint256 e) public { require(values[i] == e); }
  function set(uint256 i, uint256 v) public { values[i] = v; count += 1; }
  function checkCount(uint256 e) public { require(count == e); }
}`;

interface Call { send: () => Promise<unknown> }
type Handle = Record<'check' | 'set' | 'checkCount', (...args: bigint[]) => Call>;

describe.skipIf(Boolean(process.env.TESTS_USE_REGTEST))('wide state record genesis (VM-verified, stateful)', () => {
  it('deploys a constructor-written wide array record and reads it back in later spends', async () => {
    const factory = getContractFactory(compileString(SRC, { evmCompat: true }), await fundedSigner(8));
    const sc = await factory.deploy() as unknown as Handle;
    await sc.check(3n, 42n).send();
    await sc.check(23n, 7n).send();
    await sc.check(0n, 0n).send();
    await expect(sc.check(3n, 41n).send()).rejects.toThrow();
    // An element write keeps the record at its fixed stride, so the pinned genesis value still covers its floor.
    const wide = 2n ** 255n + 1n;
    await sc.set(5n, wide).send();
    await sc.check(5n, wide).send();
    await sc.check(3n, 42n).send();
    await sc.checkCount(3n).send();
  });
});
