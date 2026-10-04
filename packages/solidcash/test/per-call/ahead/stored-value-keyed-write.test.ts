import { describe, expect, it } from 'vitest';
import { encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { bobPkh } from '../../fixture/vars.js';
import {
  USER_LOCK, compilePerCall, deployPlain, deployProxied, enterPlain, enterProxied, newWorld, refusedVerdicts,
} from './composition-world.js';

/**
 * Walls ahead: a mapping write keyed by a value the body read out of another mapping, the escrow and marketplace
 * pattern "credit the party the record names" (`owed[deal.payee] += deal.amount`, a sale crediting
 * `proceeds[listing.seller]`, OpenZeppelin ERC721 debiting `_balances[_ownerOf(id)]`). The release of a deal is
 * served in both spellings, through the hop, and a key read out of an address mapping on the plain path too
 * (`call/stored-value-keyed-write.test.ts`).
 *
 * The ERC721 transfer, whose key is read out of a node the same body then writes (`_balances[_ownerOf(id)] -= 1;
 * ... _owners[id] = to;`), is served (`call/written-node-keyed-write.test.ts`): the master derives the batch the key
 * reads out of first, then emits the key from that node's view as its group begins it, then derives the rest. One
 * wall stands: on the plain call path a struct record cannot be opened, since the value chunks and the call does not
 * declare the created node's chunk records, so a release keyed by the record's field has no deal to read there.
 *
 * The file runs only under `PER_CALL_AHEAD=1`.
 */

const LEDGER = [
  'pragma solidity ^0.8.20;',
  'contract Ledger {',
  '  address public implementation;',
  '  mapping(uint256 => address) private _owners;',
  '  mapping(address => uint256) private _balances;',
  '  function initialize() public {}',
  '  function _ownerOf(uint256 id) internal view returns (address) { return _owners[id]; }',
  '  function mint(address to, uint256 id) external {',
  '    require(_ownerOf(id) == address(0), "minted");',
  '    _owners[id] = to;',
  '    _balances[to] += 1;',
  '  }',
  '  function transfer(address to, uint256 id) external {',
  '    require(_ownerOf(id) == msg.sender, "not owner");',
  '    _balances[_ownerOf(id)] -= 1;',
  '    _balances[to] += 1;',
  '    _owners[id] = to;',
  '  }',
  '}',
].join('\n');

const ESCROW = [
  'pragma solidity ^0.8.20;',
  'contract Escrow {',
  '  struct Deal { address payee; uint256 amount; }',
  '  mapping(uint256 => Deal) private deals;',
  '  mapping(address => uint256) private owed;',
  '  function open(uint256 id, address payee, uint256 amount) external { deals[id] = Deal(payee, amount); }',
  '  function release(uint256 id) external {',
  '    require(deals[id].amount > 0, "empty");',
  '    owed[deals[id].payee] += deals[id].amount;',
  '  }',
  '}',
].join('\n');

describe.runIf(process.env.PER_CALL_AHEAD === '1')('ahead: a write keyed by a value read from another mapping', () => {
  it('compiles the ERC721-shaped transfer, whose key is a node it then writes', () => {
    expect(compilePerCall(LEDGER).Ledger!.composition?.refusedEntries ?? []).toStrictEqual([]);
  }, 300_000);

  it('through the hop: mints (control), then settles the transfer', async () => {
    const world = await newWorld(0x53);
    const ledger = await deployProxied(world, compilePerCall(LEDGER).Ledger!, []);
    const minted = await enterProxied(world, ledger, 'mint', [USER_LOCK, 7n]);
    expect(minted.error).toBeUndefined();
    expect(refusedVerdicts(minted.result!)).toBeUndefined();
    const moved = await enterProxied(world, ledger, 'transfer', [encodeLockingBytecodeP2pkh(bobPkh), 7n]);
    expect(moved.error).toBeUndefined();
    expect(refusedVerdicts(moved.result!)).toBeUndefined();
    expect(moved.coinSpent).toBe(true);
  }, 600_000);

  it('through the plain path: refuses to open a struct record (should settle once served)', async () => {
    const world = await newWorld(0x54);
    const escrow = await deployPlain(world, compilePerCall(ESCROW).Escrow!);
    const opened = await enterPlain(world, escrow, 'open', [1n, USER_LOCK, 50n]);
    expect(opened.error?.message).toBe('entry "open" writes mapping "deals", whose values chunk, so the created '
      + 'node\'s run of chunk records cannot be declared from the call alone');
    expect(opened.coinSpent).toBe(false);
  }, 600_000);
});
