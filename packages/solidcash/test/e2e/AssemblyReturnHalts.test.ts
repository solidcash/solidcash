import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

/**
 * An assembly `return(ptr, size)` halts the call: nothing after it runs. Code generation emits no jump for a return,
 * so one under a condition ended no path: the statements after it ran, and their result was the function's. Each
 * function below runs with the assembly return taken and not taken; `x` shows which statements ran.
 */
const HALTS = `pragma solidity ^0.8.0;
contract Halts {
  uint256 public x;
  function tail(uint256 a) public returns (uint256) { x = 1; assembly { mstore(0, a) return(0, 32) } }
  function word(uint256 a, uint256 c) public returns (uint256) {
    assembly { if c { mstore(0, a) return(0, 32) } }
    x = 777;
    return 5;
  }
  function flag(uint256 c) public returns (bool) {
    assembly { if c { mstore(0, 1) return(0, 32) } }
    x = 9;
    return false;
  }
  function empty(uint256 c) public {
    assembly { if c { return(0, 0) } }
    x = 3;
  }
}`;

const halts = compileString(HALTS, { solidityImportCompat: true });

/** The result of `entry` (none for a void one) from a fresh deployment, and the `x` the call settles. */
async function run(entry: string, ...args: unknown[]): Promise<{ result: unknown; x: bigint }> {
  const sc: any = await getContractFactory(halts, await fundedSigner()).deploy();
  const returns = (halts.abi.find((fn) => fn.name === entry)?.outputs ?? []).length > 0;
  const result = returns ? await sc.call[entry](...args).staticCall() : undefined;
  await sc[entry](...args);
  return { result, x: (await sc.getState()).x };
}

describe('an assembly return halts the call (direct convention)', () => {
  it('returns the assembly word at the tail of a body', async () => {
    expect(await run('tail', 42n)).toStrictEqual({ result: 42n, x: 1n });
  }, 120_000);

  it('settles to the assembly word on its path and runs the statements after it only on the other', async () => {
    expect(await run('word', 42n, 1n)).toStrictEqual({ result: 42n, x: 0n });
    expect(await run('word', 42n, 0n)).toStrictEqual({ result: 5n, x: 777n });
  }, 120_000);

  it('reads the word as a non-word result, as a Yul assignment to it does', async () => {
    expect(await run('flag', 1n)).toStrictEqual({ result: true, x: 0n });
    expect(await run('flag', 0n)).toStrictEqual({ result: false, x: 9n });
  }, 120_000);

  it('ends a void body at an assembly return of raw bytes', async () => {
    expect(await run('empty', 1n)).toStrictEqual({ result: undefined, x: 0n });
    expect(await run('empty', 0n)).toStrictEqual({ result: undefined, x: 3n });
  }, 120_000);
});
