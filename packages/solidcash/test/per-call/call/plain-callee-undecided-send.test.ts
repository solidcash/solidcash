import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { FrameKind } from '@solidcash/utils';
import { compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { PerCallCallResult } from '../../../src/per-call/call/index.js';
import { readPerCallEntry } from '../../../src/per-call/read/index.js';
import {
  compilePerCall, deployPlain, enterPlain, newWorld, refusedVerdicts, type Outcome, type PlainDeployment, type World,
} from '../ahead/composition-world.js';

/**
 * A plain callee whose value send the call's own facts do not decide, on the plain call path (`callPerCallEntry`).
 *
 * `Vault.share` pays the native coin through a low-level call when the token it is named is the zero address, and
 * otherwise moves the token. `Vault.refund` reads a deal into memory and branches on the deal's token the same way:
 * a guard over a memory copy of a record is one the send's row does not reproduce. A send the facts do not decide
 * is listed by none, as the hop's callee frames list none, and its body settles it: for a real token the body skips
 * the send and moves the token, the payouts settle and the token balances read back. For the zero address the body
 * reaches a send its frame lists no output for, and the send is refused before anything is spent.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'struct Deal { address payer; address tok; uint256 amt; }',
  'interface IToken {',
  '  function transfer(address to, uint256 amount) external returns (bool);',
  '}',
  'contract Token {',
  '  mapping(address => uint256) public balanceOf;',
  '  function mint(address to, uint256 amount) external { balanceOf[to] += amount; }',
  '  function transfer(address to, uint256 amount) external returns (bool) {',
  '    require(balanceOf[msg.sender] >= amount, "balance");',
  '    balanceOf[msg.sender] -= amount;',
  '    balanceOf[to] += amount;',
  '    return true;',
  '  }',
  '}',
  'contract Vault {',
  '  mapping(uint256 => Deal) internal deals;',
  '  function open(uint256 id, address payer, address tok, uint256 amt) external {',
  '    deals[id] = Deal(payer, tok, amt);',
  '  }',
  '  function share(address to, uint256 a, address tok) external {',
  '    if (tok == address(0)) { to.call{value: a, gas: 5000}(""); }',
  '    else IToken(tok).transfer(to, a);',
  '  }',
  '  function refund(uint256 id) external {',
  '    Deal memory d = deals[id];',
  '    require(d.amt > 0, "none");',
  '    if (d.tok == address(0)) {',
  '      (bool ok,) = d.payer.call{value: d.amt}("");',
  '      require(ok, "send");',
  '    } else IToken(d.tok).transfer(d.payer, d.amt);',
  '  }',
  '}',
  'contract Desk {',
  '  Vault public vault;',
  '  constructor(Vault vault_) { vault = vault_; }',
  '  function payOut(address to, uint256 a, address tok) external { vault.share(to, a, tok); }',
  '  function refundDeal(uint256 id) external { vault.refund(id); }',
  '}',
].join('\n');

const artifacts = compilePerCall(SOURCE);

/** The zero address, which the compiler spells as the empty byte string. */
const ZERO_ADDRESS = new Uint8Array(0);
/** Users the vault pays, none of whose keys the token's list holds yet. */
const RECIPIENT = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x51));
const PAYER = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x52));
/** A deal in the token, and one in the native coin. */
const TOKEN_DEAL = 7n;
const NATIVE_DEAL = 8n;

interface Chain {
  readonly world: World;
  readonly token: PlainDeployment;
  readonly vault: PlainDeployment;
  readonly desk: PlainDeployment;
}

/** One entry of `root` that has to settle, entered by the user. */
async function settle(
  world: World, root: PlainDeployment, functionName: string, args: readonly FunctionArgument[],
): Promise<void> {
  const outcome = await enterPlain(world, root, functionName, args);
  expect(outcome.error?.message).toBeUndefined();
  expect(refusedVerdicts(outcome.result!)).toBeUndefined();
}

let chainRun: Promise<Chain> | undefined;
/** The desk, the vault it pays from and the token, each deployed plain, with 1000 of the token minted to the vault. */
function chain(): Promise<Chain> {
  chainRun ??= (async (): Promise<Chain> => {
    const world = await newWorld(0x6d);
    const token = await deployPlain(world, artifacts.Token!);
    const vault = await deployPlain(world, artifacts.Vault!);
    const desk = await deployPlain(world, artifacts.Desk!, [vault.address]);
    await settle(world, token, 'mint', [vault.address, 1000n]);
    return { world, token, vault, desk };
  })();
  return chainRun;
}

/** One entry of the desk, which reaches the vault and, for a real token, the token. */
function enterDesk(
  c: Chain, functionName: string, args: readonly FunctionArgument[],
): Promise<Outcome<PerCallCallResult>> {
  return enterPlain(c.world, c.desk, functionName, args, {
    Vault: { artifact: c.vault.artifact, categoryId: c.vault.categoryId },
    Token: { artifact: c.token.artifact, categoryId: c.token.categoryId },
  });
}

/** One holder's token balance, read from the token's nodes through the read path. */
async function balanceOf(c: Chain, holder: Uint8Array): Promise<unknown> {
  const read = await readPerCallEntry({
    provider: c.world.network, artifact: c.token.artifact, categoryId: c.token.categoryId, functionName: 'balanceOf',
    args: [holder], vm: compositionMachine(),
  });
  expect(read.accepted, read.objection).toBe(true);
  return read.value;
}

/** A settled call through the root, the vault entry and the token, which pays `lock` no native output. */
function expectTokenBranch(
  paid: Outcome<PerCallCallResult>, root: string, vault: string, lock: Uint8Array,
): void {
  expect(paid.error?.message).toBeUndefined();
  expect(refusedVerdicts(paid.result!)).toBeUndefined();
  expect(paid.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  const frames = paid.result!.completed.map((frame) => [frame.functionName, frame.kind]);
  expect(frames).toHaveLength(3);
  expect(frames).toEqual(expect.arrayContaining([
    [root, FrameKind.ROOT], [vault, FrameKind.CALL], ['Token.transfer()', FrameKind.CALL],
  ]));
  expect(paid.result!.transaction.outputs
    .some((output) => binToHex(output.lockingBytecode) === binToHex(lock))).toBe(false);
}

/** A call refused before anything is spent: by name, or by the verdict of the frame whose body reached the send. */
function expectRefused(refused: Outcome<PerCallCallResult>): void {
  expect(refused.result?.broadcast).toBeUndefined();
  expect(refused.error !== undefined || refusedVerdicts(refused.result!) !== undefined).toBe(true);
  expect(refused.coinSpent).toBe(false);
}

describe('a plain callee whose value send its call does not decide', () => {
  it('shares through the token it is named, with no send listed, and the balances read back', async () => {
    const c = await chain();
    const vaultBefore = await balanceOf(c, c.vault.address) as bigint;
    const paid = await enterDesk(c, 'payOut', [RECIPIENT, 30n, c.token.address]);
    expectTokenBranch(paid, 'Desk.payOut()', 'Vault.share()', RECIPIENT);
    expect([await balanceOf(c, c.vault.address), await balanceOf(c, RECIPIENT)])
      .toStrictEqual([vaultBefore - 30n, 30n]);
  }, 600_000);

  it('refunds a deal read into memory through its token, and the balances read back', async () => {
    const c = await chain();
    await settle(c.world, c.vault, 'open', [TOKEN_DEAL, PAYER, c.token.address, 50n]);
    const vaultBefore = await balanceOf(c, c.vault.address) as bigint;
    const refunded = await enterDesk(c, 'refundDeal', [TOKEN_DEAL]);
    expectTokenBranch(refunded, 'Desk.refundDeal()', 'Vault.refund()', PAYER);
    expect([await balanceOf(c, c.vault.address), await balanceOf(c, PAYER)])
      .toStrictEqual([vaultBefore - 50n, 50n]);
  }, 600_000);

  it('refuses a share and a refund whose body reaches its send, before anything is spent', async () => {
    const c = await chain();
    await settle(c.world, c.vault, 'open', [NATIVE_DEAL, PAYER, ZERO_ADDRESS, 50n]);
    const before = [await balanceOf(c, c.vault.address), await balanceOf(c, RECIPIENT), await balanceOf(c, PAYER)];
    expectRefused(await enterDesk(c, 'payOut', [RECIPIENT, 1n, ZERO_ADDRESS]));
    expectRefused(await enterDesk(c, 'refundDeal', [NATIVE_DEAL]));
    expect([await balanceOf(c, c.vault.address), await balanceOf(c, RECIPIENT), await balanceOf(c, PAYER)])
      .toStrictEqual(before);
  }, 600_000);
});
