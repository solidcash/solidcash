import { describe, expect, it } from 'vitest';
import { encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import {
  compileFramed, deployPlain, deployProxied, enterPlain, enterProxied, newWorld, refusedVerdicts,
  type PlainDeployment, type World,
} from '../ahead/composition-world.js';

/**
 * A proxied root that pays three payees through a payer contract, each payment a call-free token transfer.
 *
 * The token is OpenZeppelin-style: `_update` moves the balances inside `unchecked { }` blocks and keeps the supply in
 * its data record behind the mint and burn guards. Its artifact publishes the list of the transfer's writes, the
 * balances and that record each in the frame's only segment, so every transfer frame declares the record as one it
 * rewrites, and the three frames chain it: each starts from the view the one before it closed with. Each payment is
 * its own payer frame, so the hop settles the third payer's subtree while the first two transfers run outside it. The
 * writer that third transfer starts from starts from the first one's close in turn, so the hop derives the chain of
 * writers in the order the frames run before it judges the frame; a hop that derived only the nearest writer left
 * the third transfer starting from a view no run had learned, and its derivation stalled at its only close.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'interface IToken {',
  '  function transfer(address to, uint256 value) external returns (bool);',
  '}',
  'interface IPayer {',
  '  function pay(address to, uint256 amount) external;',
  '}',
  'contract Token {',
  '  error InsufficientBalance(address sender, uint256 balance, uint256 needed);',
  '  mapping(address => uint256) private _balances;',
  '  uint256 private _totalSupply;',
  '  function mint(address to, uint256 value) external { _update(address(0), to, value); }',
  '  function balanceOf(address account) external view returns (uint256) { return _balances[account]; }',
  '  function totalSupply() external view returns (uint256) { return _totalSupply; }',
  '  function transfer(address to, uint256 value) external returns (bool) {',
  '    _update(msg.sender, to, value);',
  '    return true;',
  '  }',
  '  function _update(address from, address to, uint256 value) internal {',
  '    if (from == address(0)) {',
  '      _totalSupply += value;',
  '    } else {',
  '      uint256 fromBalance = _balances[from];',
  '      if (fromBalance < value) revert InsufficientBalance(from, fromBalance, value);',
  '      unchecked { _balances[from] = fromBalance - value; }',
  '    }',
  '    if (to == address(0)) {',
  '      unchecked { _totalSupply -= value; }',
  '    } else {',
  '      unchecked { _balances[to] += value; }',
  '    }',
  '  }',
  '}',
  'contract Payer {',
  '  IToken public token;',
  '  constructor(IToken token_) { token = token_; }',
  '  function pay(address to, uint256 amount) external { token.transfer(to, amount); }',
  '}',
  'contract Desk {',
  '  address public implementation;',
  '  IPayer public payer;',
  '  function initialize(IPayer payer_) public { payer = payer_; }',
  '  function payout(address a, address b, address c, uint256 amount) external {',
  '    payer.pay(a, amount);',
  '    payer.pay(b, amount);',
  '    payer.pay(c, amount);',
  '  }',
  '}',
].join('\n');

const units = compileFramed(SOURCE);

/** Three payees, each holding a balance before the payout, so each payment rewrites its node in place. */
const PAYEES = [0x31, 0x32, 0x33].map((fill) => encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(fill)));

/** A plain entry that has to settle, reaching nothing. */
async function enter(world: World, root: PlainDeployment, functionName: string, args: readonly FunctionArgument[]):
Promise<void> {
  const outcome = await enterPlain(world, root, functionName, args);
  expect(outcome.error).toBeUndefined();
  expect(refusedVerdicts(outcome.result!)).toBeUndefined();
}

/** A view's value, read from the token's records and nodes through the read path. */
async function view(world: World, token: PlainDeployment, functionName: string, args: readonly FunctionArgument[]):
Promise<unknown> {
  const read = await readFramedEntry({
    provider: world.network, artifact: token.artifact, categoryId: token.categoryId, functionName,
    args: [...args], vm: compositionMachine(),
  });
  expect(read.accepted, read.objection).toBe(true);
  return read.value;
}

describe('a proxied root that pays three payees through a payer, each a call-free token transfer', () => {
  it('publishes the transfer\'s writes, the balances and the supply\'s record, in its only segment', () => {
    const transfer = units.Token!.composition?.stopSites?.entries
      .find((entry) => entry.functionName === 'Token.transfer()');
    const writes = transfer?.writeSegments ?? [];
    expect(writes.some((write) => write.collection === '_balances' && write.segment === 0)).toBe(true);
    expect(writes.some((write) => write.record !== undefined && write.segment === 0)).toBe(true);
  });

  it('settles the three transfers, each starting from the record the one before it left, and reads them back',
    async () => {
      const world = await newWorld(0x7b);
      const token = await deployPlain(world, units.Token!);
      const payer = await deployPlain(world, units.Payer!, [token.address]);
      const desk = await deployProxied(world, units.Desk!, [payer.address]);
      await enter(world, token, 'mint', [payer.address, 100n]);
      for (const payee of PAYEES) await enter(world, token, 'mint', [payee, 1n]);

      const outcome = await enterProxied(world, desk, 'payout', [...PAYEES, 10n], {
        Payer: { artifact: payer.artifact, categoryId: payer.categoryId },
        Token: { artifact: token.artifact, categoryId: token.categoryId },
      });
      expect(outcome.error).toBeUndefined();
      expect(refusedVerdicts(outcome.result!)).toBeUndefined();
      expect(outcome.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);

      expect(await view(world, token, 'balanceOf', [payer.address])).toBe(70n);
      for (const payee of PAYEES) expect(await view(world, token, 'balanceOf', [payee])).toBe(11n);
      expect(await view(world, token, 'totalSupply', [])).toBe(103n);
    }, 900_000);
});
