import { describe, expect, it, vi } from 'vitest';
import type { Artifact } from '@solidcash/utils';
import { compileString } from './direct-compile.js';

/**
 * A call on a computed target takes its callee from a witness the spender supplies, and nothing compares the two
 * (docs/array-external-calls.md, "Computed per-iteration targets"). The compiler keeps that witness, so routers work,
 * and warns at every such call so the author knows the callee and its answers are the spender's. A view call through a
 * loop local computed with keccak256 is not made at all: its answer is a witness too, and it warns. Several calls
 * through any other loop local cannot share one master input, so the compile refuses them.
 */
const CODE = 'computed-call-target-unverified';
const STORED_ADVICE = 'call through an address the contract stores (a registry lookup) instead of';

// A straight-line keccak256 target: hoisted into an `__extaddr_` local and pinned against
// `__internal__computedCallTarget<N>`, as the Sushi router's `IUniswapV2Pair(UniswapV2Library.pairFor(..))`.
const STRAIGHT_LINE = `pragma solidity ^0.8.20;
interface IPair {
  function sync() external;
}
library PairLib {
  function pairFor(address factory, address tokenA, address tokenB) internal pure returns (address) {
    return address(uint160(uint256(keccak256(abi.encodePacked(factory, tokenA, tokenB)))));
  }
}
contract Router {
  address factory;
  function touch(address tokenA, address tokenB) external {
    IPair(PairLib.pairFor(factory, tokenA, tokenB)).sync();
  }
}`;

// A target computed without a hash, the helper of the per-turn fixtures.
const ARITHMETIC_LIB = `library L {
  function at(address f, address a) internal pure returns (address) {
    return address(uint160(uint256(uint160(f)) + uint256(uint160(a))));
  }
}`;

const KECCAK_LIB = `library PairLib {
  function pairFor(address tokenA, address tokenB) internal pure returns (address) {
    return address(uint160(uint256(keccak256(abi.encodePacked(tokenA, tokenB)))));
  }
}`;

// A per-turn target the caller chooses: read from `__internal__loopTargets<n>[i]`.
const PER_ITERATION = `pragma solidity ^0.8.0;
interface IFoo {
  function m(uint256 x) external;
}
${ARITHMETIC_LIB}
contract C {
  address factory;
  function f(address[] memory path) public {
    for (uint i; i < path.length; i++) {
      IFoo(L.at(factory, path[i])).m(5);
    }
  }
}`;

// The same per-turn target through a returning low-level call, which lowers to an opaque `__raw__` call.
const LOW_LEVEL = `pragma solidity ^0.8.0;
${ARITHMETIC_LIB}
contract C {
  address factory;
  function f(address[] memory path, bytes memory data) public {
    for (uint i; i < path.length; i++) {
      (bool ok, ) = address(L.at(factory, path[i])).call(data);
      require(ok);
    }
  }
}`;

// The per-turn call written in a helper's loop (Router02's `_swap`): inlined into `f`, and its definition is kept.
const INLINED_HELPER = `pragma solidity ^0.8.0;
interface IFoo {
  function m(uint256 x) external;
}
${ARITHMETIC_LIB}
contract C {
  address factory;
  function hopAll(address[] memory path) internal {
    for (uint i; i < path.length; i++) {
      IFoo(L.at(factory, path[i])).m(5);
    }
  }
  function f(address[] memory path) public {
    hopAll(path);
  }
}`;

// A view and a swap through one loop local computed with keccak256 (the Router02 swap loop): the view's answer is a
// witness, and the swap's callee is.
const VIEW_AND_SWAP = `pragma solidity ^0.8.20;
interface IPair {
  function getReserve() external view returns (uint256);
  function swap(uint256 amount) external;
}
${KECCAK_LIB}
contract Router {
  function swapAlong(address[] memory path) external {
    for (uint i = 0; i < path.length - 1; i++) {
      IPair pair = IPair(PairLib.pairFor(path[i], path[i + 1]));
      uint256 reserve = pair.getReserve();
      pair.swap(reserve);
    }
  }
}`;

// Only views through such a local: no call is made at all.
const ALL_VIEW = `pragma solidity ^0.8.20;
interface IPair {
  function reserve0() external view returns (uint256);
  function reserve1() external view returns (uint256);
}
${KECCAK_LIB}
contract Quoter {
  function sumAlong(address[] memory path) external view returns (uint256 acc) {
    for (uint i = 0; i < path.length - 1; i++) {
      IPair pair = IPair(PairLib.pairFor(path[i], path[i + 1]));
      acc = acc + pair.reserve0() + pair.reserve1();
    }
  }
}`;

// Two views through a loop local on a plain element of a parameter array.
const PLAIN_ELEMENT = `pragma solidity ^0.8.20;
interface IOracle {
  function price() external view returns (uint256);
  function decimals() external view returns (uint256);
}
contract Settler {
  uint256 public total;
  function settle(address[] memory oracles) external {
    uint256 acc = 0;
    for (uint i = 0; i < oracles.length; i++) {
      IOracle o = IOracle(oracles[i]);
      acc = acc + o.price() * o.decimals();
    }
    total = acc;
  }
}`;

// A view and a swap through a loop local whose target is computed without a hash.
const ARITHMETIC_VIEW_AND_SWAP = `pragma solidity ^0.8.20;
interface IPair {
  function getReserve() external view returns (uint256);
  function swap(uint256 amount) external;
}
${ARITHMETIC_LIB}
contract Router {
  function swapAlong(address[] memory path) external {
    for (uint i = 0; i < path.length - 1; i++) {
      IPair pair = IPair(L.at(path[i], path[i + 1]));
      uint256 reserve = pair.getReserve();
      pair.swap(reserve);
    }
  }
}`;

const STATE_AND_PARAMETER = `pragma solidity ^0.8.20;
interface IFoo {
  function m(uint256 x) external;
}
contract Caller {
  IFoo public stored;
  function viaState(uint256 x) external {
    stored.m(x);
  }
  function viaParameter(IFoo target, uint256 x) external {
    target.m(x);
  }
}`;

// A computed target with no hash is a lock the contract computes, and the covenant compares the callee with it.
const PINNED_COMPUTATION = `pragma solidity ^0.8.0;
interface IFoo {
  function m(uint256 x) external;
}
${ARITHMETIC_LIB}
contract C {
  address factory;
  function f(address t) public {
    IFoo(L.at(factory, t)).m(5);
  }
}`;

function compileCollecting(
  source: string, options: { suppressWarnings?: boolean } = {},
): { artifact: Artifact; warnings: string[] } {
  const warnings: string[] = [];
  const artifact = compileString(source, {
    evmCompat: true,
    ...options,
    warningListener: (warning) => { warnings.push(warning.message); },
  });
  return { artifact, warnings: warnings.filter((message) => message.includes(`[${CODE}]`)) };
}

function inputNames(artifact: Artifact, functionName: string): string[] {
  return artifact.abi.find((entry) => entry.name === functionName)?.inputs.map((input) => input.name) ?? [];
}

function lineOf(source: string, text: string): number {
  return source.split('\n').findIndex((line) => line.includes(text)) + 1;
}

describe(`${CODE} warning`, () => {
  it('warns once at a straight-line computed target, naming the call and what to call through instead', () => {
    const { artifact, warnings } = compileCollecting(STRAIGHT_LINE);
    // The fixture reaches the witness the warning is about.
    expect(inputNames(artifact, 'touch').some((name) => name.startsWith('__internal__computedCallTarget'))).toBe(true);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].startsWith(`Warning: [${CODE}] the call IPair.sync in function 'touch' `
      + `at line ${lineOf(STRAIGHT_LINE, '.sync()')} has a computed target`)).toBe(true);
    expect(warnings[0]).toContain('from a witness the spender supplies and never compares it with the computed value');
    expect(warnings[0]).toContain('the spender may name any contract as the callee, and its answers are the spender\'s');
    expect(warnings[0]).toContain(`${STORED_ADVICE} a computed one.`);
  });

  it('warns once at a per-iteration computed target, saying view answers in such a loop are the spender\'s', () => {
    const { artifact, warnings } = compileCollecting(PER_ITERATION);
    expect(inputNames(artifact, 'f').some((name) => name.startsWith('__internal__loopTargets'))).toBe(true);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].startsWith(`Warning: [${CODE}] the call IFoo.m in function 'f' `
      + `at line ${lineOf(PER_ITERATION, '.m(5)')} has a target the caller's arguments choose on each loop turn`))
      .toBe(true);
    expect(warnings[0]).toContain('as are the answers of view calls in such a loop');
    expect(warnings[0]).toContain(`${STORED_ADVICE} one the caller's arguments choose.`);
  });

  it('warns at a returning low-level call on a per-iteration computed target', () => {
    const { artifact, warnings } = compileCollecting(LOW_LEVEL);
    expect(inputNames(artifact, 'f').some((name) => name.startsWith('__internal__loopTargets'))).toBe(true);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].startsWith(`Warning: [${CODE}] the low-level .call() in function 'f' `
      + `at line ${lineOf(LOW_LEVEL, '.call(data)')} has a target the caller's arguments choose`)).toBe(true);
  });

  it('names the entry function for a call written in a helper it inlines, once', () => {
    const { artifact, warnings } = compileCollecting(INLINED_HELPER);
    expect(inputNames(artifact, 'f').some((name) => name.startsWith('__internal__loopTargets'))).toBe(true);
    expect(warnings).toHaveLength(1);
    // The helper's own definition is kept and holds the call too; the entry function comes first either way.
    expect(warnings[0]).toMatch(new RegExp(`^Warning: \\[${CODE}\\] the call IFoo\\.m in `
      + `(function 'f'|functions 'f' and 'hopAll') at line ${lineOf(INLINED_HELPER, '.m(5)')} `));
  });

  it('warns at each view call a keccak256-computed loop local answers from a witness, and at the swap', () => {
    const { artifact, warnings } = compileCollecting(VIEW_AND_SWAP);
    const inputs = inputNames(artifact, 'swapAlong');
    expect(inputs.filter((name) => name.startsWith('__internal__viewReturn'))).toHaveLength(1);
    expect(inputs.some((name) => name.startsWith('__internal__loopTargets'))).toBe(true);
    expect(warnings).toHaveLength(2);
    const view = warnings.find((message) => message.includes('IPair.getReserve'));
    expect(view?.startsWith(`Warning: [${CODE}] the call IPair.getReserve in function 'swapAlong' `
      + `at line ${lineOf(VIEW_AND_SWAP, '.getReserve()')} is not made: its loop local's target is computed with `
      + 'keccak256')).toBe(true);
    expect(view).toContain('the answer is the spender\'s');
    expect(view).toContain(`${STORED_ADVICE} a computed one.`);
    const swap = warnings.find((message) => message.includes('IPair.swap'));
    expect(swap?.startsWith(`Warning: [${CODE}] the call IPair.swap in function 'swapAlong' `
      + `at line ${lineOf(VIEW_AND_SWAP, '.swap(reserve)')} has a target the caller's arguments choose`)).toBe(true);
  });

  it('warns at every view call of a loop that makes only view calls', () => {
    const { artifact, warnings } = compileCollecting(ALL_VIEW);
    expect(inputNames(artifact, 'sumAlong').filter((name) => name.startsWith('__internal__viewReturn')))
      .toHaveLength(2);
    expect(warnings).toHaveLength(2);
    const line = lineOf(ALL_VIEW, '.reserve0()');
    for (const call of ['IPair.reserve0', 'IPair.reserve1']) {
      expect(warnings.some((message) => message.startsWith(`Warning: [${CODE}] the call ${call} in function `
        + `'sumAlong' at line ${line} is not made`))).toBe(true);
    }
  });

  it('refuses several calls through a loop local on a plain parameter element', () => {
    expect(() => compileCollecting(PLAIN_ELEMENT)).toThrow(new RegExp('function \'settle\' makes 2 calls through the '
      + 'loop local \'o\', whose target is not computed with keccak256\\. One master input runs one call per '
      + 'transaction, so these calls could only read answers the spender supplies, which nothing would check\\. Call '
      + 'each callee once per loop turn, through separate locals or targets, or read the callee\'s state instead'));
  });

  it('refuses several calls through a loop local computed without a hash', () => {
    expect(() => compileCollecting(ARITHMETIC_VIEW_AND_SWAP)).toThrow(
      /function 'swapAlong' makes 2 calls through the loop local 'pair', whose target is not computed with keccak256/,
    );
  });

  it('does not warn for a state-variable or a parameter target', () => {
    expect(compileCollecting(STATE_AND_PARAMETER).warnings).toEqual([]);
  });

  it('does not warn for a computed target the contract compares with the callee', () => {
    const { artifact, warnings } = compileCollecting(PINNED_COMPUTATION);
    expect(inputNames(artifact, 'f').some((name) => name.startsWith('__internal__computedCallTarget'))).toBe(false);
    expect(warnings).toEqual([]);
  });

  it('is silenced by suppressWarnings', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      expect(compileCollecting(STRAIGHT_LINE, { suppressWarnings: true }).warnings).toEqual([]);
      expect(compileCollecting(ALL_VIEW, { suppressWarnings: true }).warnings).toEqual([]);
      expect(log.mock.calls.flat().join(' ')).not.toContain(CODE);
    } finally {
      log.mockRestore();
    }
  });
});
