import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { getContractFactory } from '../../src/stateful/index.js';
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

/**
 * The rest of the family. A halt in a function called internally ends its caller too: the helper is inlined, so its
 * assembly return is the caller's. A `this.f()` call is a frame of its own, so a halt in it ends only that frame.
 * `stop()` halts with no data. A switch arm that reverts fails the script, so the other arm's return is the
 * function's, here raw bytes.
 */
const MORE = `pragma solidity ^0.8.0;
contract MoreHalts {
  uint256 public x;
  uint256 public y;
  function _word(uint256 c) internal pure { assembly { if c { mstore(0, 9) return(0, 32) } } }
  function viaHelper(uint256 c) public returns (uint256) { _word(c); x = 4; return 5; }
  function frame(uint256 c) public { y = 1; assembly { if c { return(0, 0) } } y = 2; }
  function viaFrame(uint256 c) public returns (uint256) { x = 1; this.frame(c); x = x + 1; return x; }
  function stops(uint256 c) public { x = 1; assembly { if c { stop() } } x = 2; }
  function _stop(uint256 c) internal pure { assembly { if c { stop() } } }
  function viaStop(uint256 c) public { x = 6; _stop(c); x = 7; }
  function raw(uint256 a, uint256 n) public returns (bytes memory) {
    x = a;
    assembly {
      mstore(0, a)
      switch lt(a, 10)
      case 0 { revert(0, 0) }
      default { return(0, n) }
    }
  }
}`;

const halts = compileString(HALTS, { solidityImportCompat: true });
const more = compileString(MORE, { solidityImportCompat: true });

/** A fresh deployment of `artifact`. */
async function deploy(artifact: typeof halts): Promise<any> {
  return getContractFactory(artifact, await fundedSigner()).deploy();
}

/** The result of `entry` (none for a void one) from a fresh deployment, and the `x` the call settles. */
async function runOn(artifact: typeof halts, entry: string, ...args: unknown[]): Promise<{ result: unknown; x: bigint }> {
  const sc = await deploy(artifact);
  const returns = (artifact.abi.find((fn) => fn.name === entry)?.outputs ?? []).length > 0;
  const result = returns ? await sc.call[entry](...args).staticCall() : undefined;
  await sc[entry](...args);
  return { result, x: (await sc.getState()).x };
}

const run = (entry: string, ...args: unknown[]): ReturnType<typeof runOn> => runOn(halts, entry, ...args);

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

describe('an assembly halt ends the whole call, the functions it is called through included', () => {
  it('settles the caller to the word a helper returns, and runs the caller on only when it does not', async () => {
    expect(await runOn(more, 'viaHelper', 1n)).toStrictEqual({ result: 9n, x: 0n });
    expect(await runOn(more, 'viaHelper', 0n)).toStrictEqual({ result: 5n, x: 4n });
  }, 120_000);

  it('ends only the frame of a `this.f()` call, whose caller runs on', async () => {
    for (const [c, y] of [[1n, 1n], [0n, 2n]]) {
      const sc = await deploy(more);
      expect(await sc.call.viaFrame(c).staticCall()).toBe(2n);
      await sc.viaFrame(c);
      expect(await sc.getState()).toMatchObject({ x: 2n, y });
    }
  }, 120_000);

  it('halts at stop(), in its own body and in a helper it is called through', async () => {
    expect(await runOn(more, 'stops', 1n)).toStrictEqual({ result: undefined, x: 1n });
    expect(await runOn(more, 'stops', 0n)).toStrictEqual({ result: undefined, x: 2n });
    expect(await runOn(more, 'viaStop', 1n)).toStrictEqual({ result: undefined, x: 6n });
    expect(await runOn(more, 'viaStop', 0n)).toStrictEqual({ result: undefined, x: 7n });
  }, 120_000);

  it('returns the bytes of a switch arm beside one that reverts, and fails on the reverting arm', async () => {
    // The assembly memory model stores a word little-endian, so the bytes of `mstore(0, 7)` start with 7.
    expect(await runOn(more, 'raw', 7n, 3n)).toStrictEqual({ result: Uint8Array.from([7, 0, 0]), x: 7n });
    const sc = await deploy(more);
    await expect(sc.raw(12n, 3n)).rejects.toThrow();
    expect((await sc.getState()).x).toBe(0n);
  }, 120_000);
});
