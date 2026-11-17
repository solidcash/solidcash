// Construction on both VMs: base constructor arguments and a base constructor's parameters. Each source declares
// `C`; solc runs it, and SolidCash must compute the same.
import { describe, it } from 'vitest';
import { assertConformant, contractCase } from './harness.js';

const TIMEOUT = 600_000;

describe('construction: a base constructor\'s parameters are its own locals', () => {
  // A function of the base with a parameter of the constructor parameter's name reads its own parameter.
  const AFTER_DEPLOYMENT = 'a base function whose parameter is named like the constructor\'s, called after deployment';
  it(AFTER_DEPLOYMENT, () => assertConformant(contractCase({
    label: 'base-function-parameter-named-like-constructor-parameter',
    source: `
contract B {
  constructor(uint v) {}
  function twice(uint v) internal pure returns (uint) { return v * 2; }
}
contract C is B(5) {
  function f(uint a) public pure returns (uint) { return twice(a); }
}`,
    params: 'uint a',
    retType: 'uint',
    args: [3n],
  })), TIMEOUT);
});
