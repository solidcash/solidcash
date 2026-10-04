import { describe, expect, it } from 'vitest';
import {
  USER_LOCK, compilePerCall, deployPlain, deployProxied, enterPlain, enterProxied, newWorld, refusedVerdicts,
} from './composition-world.js';

/**
 * Walls ahead: a mapping write keyed by a value the body read out of another mapping, the escrow and marketplace
 * pattern "credit the party the record names" (`owed[deal.payee] += deal.amount`, a sale crediting
 * `proceeds[listing.seller]`, OpenZeppelin ERC721 debiting `_balances[_ownerOf(id)]`). The release of a deal is
 * served in both spellings, through the hop, and a key read out of an address mapping on the plain path too
 * (`call/stored-value-keyed-write.test.ts`). Two walls stand:
 *
 * 1. The ERC721 transfer reads its key out of a node the same body then writes (`_balances[_ownerOf(id)] -= 1; ...
 *    _owners[id] = to;`). The master derives every target slot where the body begins, and a node the body's own
 *    batch writes is read through the operands that derivation produces, so the key is no value the derivation can
 *    read: the compiler refuses the entry by name (`support.ts`, `keyOperandUnavailable`). Serving it means deriving
 *    the batch the key reads out of first, then emitting the key, then deriving the rest.
 * 2. On the plain call path a struct record cannot be opened: the value chunks, and the call does not declare the
 *    created node's chunk records, so a release keyed by the record's field has no deal to read there.
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

/** Why the compiler refuses the transfer. */
const TRANSFER_REASON = 'the body writes a mapping at slot 2 whose key 0 \'map:_owners(id:id)\' reads the mapping '
  + 'entry \'_owners\' at a node the body also writes, which is read through the operands the derivation produces, '
  + 'and a master derives a target slot only from a bare parameter, the frame\'s sender, a value of its own record, '
  + 'or a compile-time value the body holds at its start';

describe.runIf(process.env.PER_CALL_AHEAD === '1')('ahead: a write keyed by a value read from another mapping', () => {
  it('refuses the ERC721-shaped transfer by name: its key is a node it then writes (should compile once fixed)', () => {
    expect(compilePerCall(LEDGER).Ledger!.composition?.refusedEntries).toStrictEqual([
      { functionName: 'Ledger.transfer()', reason: TRANSFER_REASON },
    ]);
  }, 300_000);

  it('through the hop: mints (control), then refuses the transfer (should settle once served)', async () => {
    const world = await newWorld(0x53);
    const ledger = await deployProxied(world, compilePerCall(LEDGER).Ledger!, []);
    const minted = await enterProxied(world, ledger, 'mint', [USER_LOCK, 7n]);
    expect(minted.error).toBeUndefined();
    expect(refusedVerdicts(minted.result!)).toBeUndefined();
    const moved = await enterProxied(world, ledger, 'transfer', [USER_LOCK, 7n]);
    expect(moved.error?.message).toBe('the implementation\'s "transfer" entry is refused by the compiler '
      + `(Ledger.transfer()): ${TRANSFER_REASON}`);
    expect(moved.coinSpent).toBe(false);
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
