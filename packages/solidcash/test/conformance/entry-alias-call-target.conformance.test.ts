/**
 * A call through a mapping entry's field after a write of that field, against the EVM (evmCompat). The field write
 * `book[j].token = t` is cached (`__vmapcache_book_<n>`, read where the function starts and written back at its
 * end, after the call). On the EVM a call through `book[k].token` after it goes to `t` when `j == k` and to the stored
 * token otherwise.
 *
 * Under another key the call binds entry k as the function's top read it. When `j == k` that would be the token
 * before the write, so the spend must not settle: the read of `k` cannot take the node the write of `j` spends, since
 * a read that borrows another slot's proof input must name a key no batch write targets (emitSharedProofRedirect).
 * Under the same key the call reads the cache, the written value, and is published as written first, so a builder
 * does not resolve its callee from the stored entry.
 */
import { binToHex, hexToBin } from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { Contract, ExternalCallTargetWrittenBeforeCallError } from '../../src/index.js';
import { StatefulContract, registerDeployment } from '../../src/stateful/index.js';
import { compileStringMulti } from '../direct-compile.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { deployEvmSystem } from './evm.js';

const SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
library SafeTransfer {
  function safeTransfer(address token, address to, uint256 value) internal {
    (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0xa9059cbb, to, value));
    require(success && (data.length == 0 || abi.decode(data, (bool))), "TRANSFER_FAILED");
  }
}
contract Token {
  uint256 public moved;
  function transfer(address, uint256 amount) external returns (bool) { moved += amount; return true; }
}
contract Book {
  struct Job { uint8 state; address token; uint256 amount; }
  mapping(uint256 => Job) book;
  function open(uint256 k, address token) external { book[k] = Job(0, token, 5); }
  function retokenOther(uint256 j, uint256 k, address t) external {
    book[j].token = t;
    (bool ok, bytes memory data) = book[k].token.call(abi.encodeWithSelector(0xa9059cbb, address(this), 5));
    require(ok && (data.length == 0 || abi.decode(data, (bool))), "PAY_FAILED");
  }
  function retokenSame(uint256 k, address t) external {
    book[k].token = t;
    (bool ok, bytes memory data) = book[k].token.call(abi.encodeWithSelector(0xa9059cbb, address(this), 5));
    require(ok && (data.length == 0 || abi.decode(data, (bool))), "PAY_FAILED");
  }
  function retokenSameHelper(uint256 k, address t) external {
    book[k].token = t;
    SafeTransfer.safeTransfer(book[k].token, address(this), 5);
  }
}`;

type Name = 'first' | 'second';

/** The token the EVM's call goes to: entries 0 and 1 opened on `first`, then `entry(...args(second))`. */
async function evmCallee(entry: string, args: (second: string) => unknown[]): Promise<Name> {
  const evm = await deployEvmSystem(SOURCE, { first: 'Token', second: 'Token', book: 'Book' });
  await evm.call('book', 'open', [0n, evm.address('first')]);
  await evm.call('book', 'open', [1n, evm.address('first')]);
  await evm.call('book', entry, args(evm.address('second')));
  const [first] = await evm.call('first', 'moved');
  const [second] = await evm.call('second', 'moved');
  expect([first, second].filter((moved) => moved === 5n)).toHaveLength(1);
  return first === 5n ? 'first' : 'second';
}

type Deployed = { contract: any; address: Uint8Array };

async function deploy(provider: ReturnType<typeof createTestProvider>, artifact: Artifact): Promise<Deployed> {
  const base = new Contract(artifact, [], { provider });
  const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {});
  const address = hexToBin(base.withCategory(hexToBin(setup.categoryId)).lockingBytecode);
  const contract = StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
  registerDeployment(provider, {
    contractName: artifact.contractName, address: contract.target, lockingBytecode: binToHex(address), contract,
  });
  return { contract, address };
}

describe('a call through an entry\'s field after a write of that field, against the EVM (evmCompat)', () => {
  const artifacts = compileStringMulti(SOURCE, { evmCompat: true, forceStateful: true });

  /** Two tokens and a book whose entries 0 and 1 hold the first. */
  async function setUp(): Promise<{ tokens: Record<Name, Deployed>; book: Deployed }> {
    const provider = createTestProvider();
    const first = await deploy(provider, artifacts.Token!);
    const second = await deploy(provider, artifacts.Token!);
    const book = await deploy(provider, artifacts.Book!);
    await book.contract.open(0n, first.address).send();
    await book.contract.open(1n, first.address).send();
    return { tokens: { first, second }, book };
  }

  /** The spend of `entry` naming `callee`'s transfer, sent on a fresh set-up. */
  async function spend(entry: string, args: (second: Uint8Array) => unknown[], callee: Name): Promise<{
    sent: Promise<unknown>; tokens: Record<Name, Deployed>;
  }> {
    const { tokens, book } = await setUp();
    const sent = book.contract[entry](...args(tokens.second.address))
      .withExternalCall(tokens[callee].contract, 'transfer', [book.address, 5n]).send();
    return { sent, tokens };
  }

  it.each([
    ['another key', 'retokenOther', (second: unknown): unknown[] => [0n, 1n, second], 'first'],
    ['the same key', 'retokenSame', (second: unknown): unknown[] => [0n, second], 'second'],
    ['the same key, through a helper', 'retokenSameHelper', (second: unknown): unknown[] => [0n, second], 'second'],
  ] as const)('calls the token the EVM does after a write under %s', async (_key, entry, args, expected) => {
    expect(await evmCallee(entry, args as (second: string) => unknown[])).toBe(expected);
    const other: Name = expected === 'first' ? 'second' : 'first';
    const accepted = await spend(entry, args, expected);
    await accepted.sent;
    expect((await accepted.tokens[expected].contract.getState()).moved).toBe(5n);
    const refused = await spend(entry, args, other);
    await expect(refused.sent).rejects.toThrow(/input 0\b/);
    expect((await refused.tokens[other].contract.getState()).moved).toBe(0n);
  }, 300_000);

  it('does not settle a write of entry j and a call through entry k when j == k', async () => {
    // The EVM's call goes to the written token.
    expect(await evmCallee('retokenOther', (second) => [0n, 0n, second])).toBe('second');
    for (const callee of ['first', 'second'] as const) {
      const { sent, tokens } = await spend('retokenOther', (second) => [0n, 0n, second], callee);
      await expect(sent).rejects.toThrow();
      expect((await tokens.first.contract.getState()).moved).toBe(0n);
      expect((await tokens.second.contract.getState()).moved).toBe(0n);
    }
  }, 300_000);

  it.each(['retokenSame', 'retokenSameHelper'])('refuses by name to resolve %s\'s callee from the stored entry',
    async (entry) => {
      const { tokens, book } = await setUp();
      const sent = book.contract[entry](0n, tokens.second.address).send();
      await expect(sent).rejects.toThrow(ExternalCallTargetWrittenBeforeCallError);
      await expect(sent).rejects.toThrow(new RegExp(`'${entry}' writes the target of its call`));
    }, 300_000);
});
