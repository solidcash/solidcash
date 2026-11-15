import { describe, expect, it, vi } from 'vitest';
import type { Artifact } from '@solidcash/utils';
import { compileString } from './direct-compile.js';

/**
 * A call on a computed target takes its callee from a witness the spender supplies, and nothing compares the two
 * (docs/array-external-calls.md, "Computed per-iteration targets"). The compiler keeps that witness, so routers work,
 * and warns at every such call so the author checks the callee before relying on its answer.
 */
const CODE = 'computed-call-target-unverified';

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

// A per-turn target the caller chooses: read from `__internal__loopTargets<n>[i]`.
const PER_ITERATION = `pragma solidity ^0.8.0;
interface IFoo {
  function m(uint256 x) external;
}
library L {
  function at(address f, address a) internal pure returns (address) {
    return address(uint160(uint256(uint160(f)) + uint256(uint160(a))));
  }
}
contract C {
  address factory;
  function f(address[] memory path) public {
    for (uint i; i < path.length; i++) {
      IFoo(L.at(factory, path[i])).m(5);
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
library L {
  function at(address f, address a) internal pure returns (address) {
    return address(uint160(uint256(uint160(f)) + uint256(uint160(a))));
  }
}
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
  it('warns once at a straight-line computed target, naming the call and how to protect funds', () => {
    const { artifact, warnings } = compileCollecting(STRAIGHT_LINE);
    // The fixture reaches the witness the warning is about.
    expect(inputNames(artifact, 'touch').some((name) => name.startsWith('__internal__computedCallTarget'))).toBe(true);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].startsWith(`Warning: [${CODE}] the call IPair.sync in function 'touch' `
      + `at line ${lineOf(STRAIGHT_LINE, '.sync()')} has a computed target`)).toBe(true);
    expect(warnings[0]).toContain('from a witness the spender supplies and never compares it with the computed value');
    expect(warnings[0]).toContain('the spender may name any contract as the callee');
    expect(warnings[0]).toContain('check the callee against a registry the contract stores or another value it trusts');
  });

  it('warns once at a per-iteration computed target', () => {
    const { artifact, warnings } = compileCollecting(PER_ITERATION);
    expect(inputNames(artifact, 'f').some((name) => name.startsWith('__internal__loopTargets'))).toBe(true);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].startsWith(`Warning: [${CODE}] the call IFoo.m in function 'f' `
      + `at line ${lineOf(PER_ITERATION, '.m(5)')} has a target computed on each loop turn`)).toBe(true);
    expect(warnings[0]).toContain('the spender may name any contract as the callee');
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
      expect(log.mock.calls.flat().join(' ')).not.toContain(CODE);
    } finally {
      log.mockRestore();
    }
  });
});
