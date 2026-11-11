import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { FrameKind } from '@solidcash/utils';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { readSatoshiContainers, satoshiContainerLockingBytecode } from '../../../src/framed/deploy/records.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import {
  compileFramed, deployPlain, enterPlain, newWorld, refusedVerdicts, type Outcome, type PlainDeployment, type World,
} from '../ahead/composition-world.js';
import type { FramedCallResult } from '../../../src/framed/call/index.js';

/**
 * A plain callee whose artifact counts a value send on a branch its call does not take, on the plain call path
 * (`callFramedEntry`).
 *
 * `Vault.pay` pays the native coin when the token it is named is the zero address, and otherwise moves the token
 * through `IERC20(token).transfer`. The send's row publishes the branch's condition, which the call's own facts
 * decide as they decide an emit's (`skippedSends`): named a real token, the body skips the send, so the vault's frame
 * lists none, and the payout settles with the token's balances read back. Named the zero address, the send is one the
 * call reaches, which the vault's frame lists as the entry lists its own: its output pays the recipient's lock, and
 * the vault's containers pay it, the change kept in the container its run of sends starts with. A vault whose
 * containers hold less than it sends is refused by name before anything is spent, as the EVM's transfer reverts. The
 * vault keeps one field its payout never reads, which makes it a stateful contract to deploy.
 */

const SOURCE = [
  'pragma solidity ^0.8.0;',
  'interface IERC20 {',
  '  function transfer(address to, uint256 amount) external returns (bool);',
  '}',
  'interface IVault {',
  '  function pay(address token, address to, uint256 amount) external;',
  '}',
  'contract Token {',
  '  mapping(address => uint256) public balanceOf;',
  '  event Transfer(address indexed from, address indexed to, uint256 value);',
  '  function mint(address to, uint256 amount) external { balanceOf[to] += amount; }',
  '  function transfer(address to, uint256 amount) external returns (bool) {',
  '    require(balanceOf[msg.sender] >= amount, "balance");',
  '    balanceOf[msg.sender] -= amount;',
  '    balanceOf[to] += amount;',
  '    emit Transfer(msg.sender, to, amount);',
  '    return true;',
  '  }',
  '}',
  'contract Vault {',
  '  uint256 public serial;',
  '  function pay(address token, address to, uint256 amount) external {',
  '    if (token == address(0)) payable(to).transfer(amount);',
  '    else IERC20(token).transfer(to, amount);',
  '  }',
  '}',
  'contract Desk {',
  '  IVault public vault;',
  '  constructor(IVault vault_) { vault = vault_; }',
  '  function payOut(address token, address to, uint256 amount) external { vault.pay(token, to, amount); }',
  '}',
].join('\n');

const artifacts = compileFramed(SOURCE);

/** The zero address, which the compiler spells as the empty byte string. */
const ZERO_ADDRESS = new Uint8Array(0);
/** A user the vault pays, whose key the token's list does not hold yet. */
const RECIPIENT = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x44));

interface Chain {
  readonly world: World;
  readonly token: PlainDeployment;
  readonly vault: PlainDeployment;
  readonly desk: PlainDeployment;
}

let chainRun: Promise<Chain> | undefined;
/** The desk, the vault it pays from and the token, each deployed plain, with 1000 of the token minted to the vault. */
function chain(): Promise<Chain> {
  chainRun ??= (async (): Promise<Chain> => {
    const world = await newWorld(0x63);
    const token = await deployPlain(world, artifacts.Token!);
    const vault = await deployPlain(world, artifacts.Vault!);
    const desk = await deployPlain(world, artifacts.Desk!, [vault.address]);
    const minted = await enterPlain(world, token, 'mint', [vault.address, 1000n]);
    expect(minted.error).toBeUndefined();
    expect(refusedVerdicts(minted.result!)).toBeUndefined();
    return { world, token, vault, desk };
  })();
  return chainRun;
}

/** The desk's payout of `amount` of `token` to `to`, which reaches the vault and, for a real token, the token. */
function payOut(c: Chain, token: Uint8Array, to: Uint8Array, amount: bigint): Promise<Outcome<FramedCallResult>> {
  return enterPlain(c.world, c.desk, 'payOut', [token, to, amount], {
    Vault: { artifact: c.vault.artifact, categoryId: c.vault.categoryId },
    Token: { artifact: c.token.artifact, categoryId: c.token.categoryId },
  });
}

/** One holder's token balance, read from the token's nodes through the read path. */
async function balanceOf(c: Chain, holder: Uint8Array): Promise<unknown> {
  const read = await readFramedEntry({
    provider: c.world.network, artifact: c.token.artifact, categoryId: c.token.categoryId, functionName: 'balanceOf',
    args: [holder], vm: compositionMachine(),
  });
  expect(read.accepted, read.objection).toBe(true);
  return read.value;
}

describe('a plain callee that sends value on a branch its call does not take', () => {
  it('pays through the token it is named, with no send listed, and the balances read back', async () => {
    const c = await chain();
    const paid = await payOut(c, c.token.address, RECIPIENT, 30n);
    expect(paid.error).toBeUndefined();
    expect(refusedVerdicts(paid.result!)).toBeUndefined();
    expect(paid.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    const frames = paid.result!.completed.map((frame) => [frame.functionName, frame.kind]);
    expect(frames).toHaveLength(3);
    expect(frames).toEqual(expect.arrayContaining([
      ['Desk.payOut()', FrameKind.ROOT], ['Vault.pay()', FrameKind.CALL], ['Token.transfer()', FrameKind.CALL],
    ]));
    // The native branch is not taken: no output pays the recipient's lock.
    expect(paid.result!.transaction.outputs
      .some((output) => binToHex(output.lockingBytecode) === binToHex(RECIPIENT))).toBe(false);
    expect([await balanceOf(c, c.vault.address), await balanceOf(c, RECIPIENT)]).toStrictEqual([970n, 30n]);
  }, 600_000);

  it('refuses by name a payout the vault\'s containers do not cover, before anything is spent', async () => {
    const c = await chain();
    const before = [await balanceOf(c, c.vault.address), await balanceOf(c, RECIPIENT)];
    const refused = await payOut(c, ZERO_ADDRESS, RECIPIENT, 1n);
    expect(refused.result).toBeUndefined();
    expect(refused.error?.message).toContain('contract "Vault" holds 0 satoshis in its containers, and the callee '
      + '"Vault.pay()" sends 1 more than it receives');
    expect(refused.coinSpent).toBe(false);
    expect([await balanceOf(c, c.vault.address), await balanceOf(c, RECIPIENT)]).toStrictEqual(before);
  }, 600_000);

  it('pays the native coin from the vault\'s containers, the send listed in the vault\'s own frame', async () => {
    const c = await chain();
    // A payment to the vault's container lock is the coin the vault holds, as an EVM contract's balance.
    await c.world.network.addUtxo(binToHex(satoshiContainerLockingBytecode(c.vault.categoryId)),
      { txid: '5c'.repeat(32), vout: 0, satoshis: 10_000n });
    const paid = await payOut(c, ZERO_ADDRESS, RECIPIENT, 2_500n);
    expect(paid.error?.message).toBeUndefined();
    expect(refusedVerdicts(paid.result!)).toBeUndefined();
    expect(paid.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    const frames = paid.result!.completed.map((frame) => [frame.functionName, frame.kind]);
    expect(frames).toEqual(expect.arrayContaining([['Desk.payOut()', FrameKind.ROOT], ['Vault.pay()', FrameKind.CALL]]));
    const payments = paid.result!.transaction.outputs
      .filter((output) => binToHex(output.lockingBytecode) === binToHex(RECIPIENT));
    expect(payments.map((output) => output.valueSatoshis)).toStrictEqual([2_500n]);
    const kept = await readSatoshiContainers(c.world.network, c.vault.categoryId);
    expect(kept.reduce((sum, utxo) => sum + utxo.satoshis, 0n)).toBe(7_500n);
    expect(await balanceOf(c, RECIPIENT)).toBe(30n);
  }, 600_000);
});
