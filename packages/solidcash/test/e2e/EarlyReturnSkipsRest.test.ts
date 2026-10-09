import { describe, expect, it } from 'vitest';
import { binToHex, encodeTransaction } from '@bitauth/libauth';
import { buildPushdataCommitment, parsePushdataCommitment } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract, TransactionBuilder, getContractFactory } from '../../src/index.js';
import {
  createFeeFunder, createTestProvider, expectScriptRejection, fundedSigner, setupStatefulUtxos,
} from '../test-util.js';

/**
 * A return the early-return nesting did not reach. Code generation emits no jump for a return: a void `return;`
 * emits nothing, so the statements after it ran unless the nesting had moved them into the other arm of the branch
 * it ends. It did not for a return under a further condition, and it did not visit `receive()` or `fallback()` at
 * all: `if (a) { if (b) return; } x = 777;` compiled to an empty IF and a write that always ran. Each body below
 * runs with its return taken and not taken, and the state it settles is read back; a spend whose record holds the
 * other path's `x` is refused.
 */
const GUARDED = `pragma solidity ^0.8.0;
contract Guarded {
  uint256 public x;
  uint256 public y;
  function f(bool a, bool b) public { if (a) { if (b) return; } x = 777; }
  receive() external payable { if (y == 1) return; x = 777; }
  fallback() external { if (y > 0) { if (y == 2) return; } x = 777; }
}`;

const guarded = compileString(GUARDED, { evmCompat: true });

const raw = (builder: TransactionBuilder): string => binToHex(encodeTransaction(builder.buildLibauthTransaction()));

interface Spend {
  readonly outcome: string;
  readonly x?: bigint;
}

type Output = { token?: { category: string; nft?: { capability: string; commitment: string } } };

/** Spends `entry` from a fresh deployment holding `y`, with its record forged to hold `forged` when one is given. */
async function spend(entry: string, args: readonly unknown[], y: bigint, forged?: bigint): Promise<Spend> {
  const provider = createTestProvider();
  const contract = new Contract(guarded, [], { provider });
  const layout = guarded.stateLayout!;
  const { categoryId } = await setupStatefulUtxos(provider, contract, layout, { x: 0n, y }, { saltContract: true });
  const builder = await (StatefulContract.withCategory(contract, categoryId) as any)[entry](...args).build();
  const { utxo, unlocker } = await createFeeFunder(provider, 20_000n);
  builder.addInput(utxo, unlocker);
  const outputs = (builder as any).outputs as Output[];
  const at = outputs.findIndex((output) => output.token?.category === categoryId
    && output.token.nft?.capability === 'mutable');
  if (forged !== undefined) {
    const { token } = outputs[at]!;
    const commitment = buildPushdataCommitment(layout, { x: forged, y }, 0);
    outputs[at] = { ...outputs[at], token: { ...token!, nft: { ...token!.nft!, commitment } } };
  }
  try {
    await provider.sendRawTransaction(raw(builder));
  } catch (error) {
    return { outcome: `REJECTED: ${(error as Error).message}` };
  }
  return { outcome: 'ACCEPTED', x: parsePushdataCommitment(outputs[at]!.token!.nft!.commitment, layout, 0).x as bigint };
}

describe('a return the early-return nesting did not reach (direct convention)', () => {
  it('nested ifs: the taken return skips the write and the untaken one makes it', async () => {
    expect(await spend('f', [true, true], 0n)).toStrictEqual({ outcome: 'ACCEPTED', x: 0n });
    expect(await spend('f', [true, false], 0n)).toStrictEqual({ outcome: 'ACCEPTED', x: 777n });
    expect(await spend('f', [false, true], 0n)).toStrictEqual({ outcome: 'ACCEPTED', x: 777n });
  }, 120_000);

  it('nested ifs: a spend that settles the other path is refused', async () => {
    expectScriptRejection((await spend('f', [true, true], 0n, 777n)).outcome, 0);
    expectScriptRejection((await spend('f', [true, false], 0n, 0n)).outcome, 0);
  }, 120_000);

  it('receive(): the taken return skips the write, and a spend that makes it is refused', async () => {
    expect(await spend('__receive', [], 1n)).toStrictEqual({ outcome: 'ACCEPTED', x: 0n });
    expect(await spend('__receive', [], 3n)).toStrictEqual({ outcome: 'ACCEPTED', x: 777n });
    expectScriptRejection((await spend('__receive', [], 1n, 777n)).outcome, 0);
    expectScriptRejection((await spend('__receive', [], 3n, 0n)).outcome, 0);
  }, 120_000);

  it('fallback(): the taken return skips the write, and a spend that makes it is refused', async () => {
    expect(await spend('__fallback', [], 2n)).toStrictEqual({ outcome: 'ACCEPTED', x: 0n });
    expect(await spend('__fallback', [], 3n)).toStrictEqual({ outcome: 'ACCEPTED', x: 777n });
    expectScriptRejection((await spend('__fallback', [], 2n, 777n)).outcome, 0);
    expectScriptRejection((await spend('__fallback', [], 3n, 0n)).outcome, 0);
  }, 120_000);
});

/**
 * A return in a function body leaves the body, and one in a modifier leaves that modifier: Solidity then runs the
 * statements after the `_` of the modifier around it. Expanded verbatim, such a return left the whole function and
 * skipped them. `x` records the order of effects as decimal digits, one per statement.
 */
const ORDERED = `pragma solidity ^0.8.0;
contract Ordered {
  uint256 public x;
  modifier outer() { x = x * 10 + 1; _; x = x * 10 + 5; }
  modifier inner(bool g) { x = x * 10 + 2; if (g) return; _; x = x * 10 + 4; }
  function f(bool g, bool a) public outer inner(g) returns (uint256) {
    x = x * 10 + 3;
    if (a) return 7;
    x = x * 10 + 9;
    return 8;
  }
}`;

const LOCKED = `pragma solidity ^0.8.0;
contract Locked {
  uint256 public x;
  uint256 status;
  modifier nonReentrant() { require(status == 0); status = 1; _; status = 0; }
  function f(bool a) public nonReentrant { if (a) return; x = 777; }
}`;

describe('a return inside a modifier\'s placeholder or a modifier (direct convention)', () => {
  it('runs the statements after `_` of every modifier around the return, in the EVM\'s order', async () => {
    const ordered = compileString(ORDERED, { evmCompat: true });
    const run = async (g: boolean, a: boolean): Promise<{ x: bigint; result: unknown }> => {
      const sc: any = await getContractFactory(ordered, await fundedSigner()).deploy();
      const result = await sc.call.f(g, a).staticCall();
      await sc.f(g, a);
      return { x: (await sc.getState()).x, result };
    };
    expect(await run(false, false)).toStrictEqual({ x: 123945n, result: 8n });
    expect(await run(false, true)).toStrictEqual({ x: 12345n, result: 7n });
    expect(await run(true, false)).toStrictEqual({ x: 125n, result: 0n });
  }, 120_000);

  it('releases a reentrancy lock on the path the body returns from', async () => {
    const sc: any = await getContractFactory(compileString(LOCKED, { evmCompat: true }), await fundedSigner())
      .deploy();
    await sc.f(true);
    expect((await sc.getState()).x).toBe(0n);
    await sc.f(false);
    expect((await sc.getState()).x).toBe(777n);
  }, 120_000);
});
