import { describe, expect, it } from 'vitest';
// Exercise this worktree's compiler source. A shared monorepo node_modules can otherwise point at the main
// checkout's built solidc package while this test is run from a linked worktree.
import { compileString } from '../../../solidc/src/index.js';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

// Runtime adaptation of Solidity's semantic fixture:
// test/libsolidity/semanticTests/enums/enum_referencing.sol
//
// Its semantic trailer expects interface Direction.Right == 3 and library Direction.Right == 1, including a
// library helper returning the interface enum. Keeping both same-named enum scopes in one spend catches namespace
// erasure that compile-only coverage cannot observe.
const SOURCE = `
interface I { enum Direction { A, B, Left, Right } }
library L {
  enum Direction { Left, Right }
  function f() public pure returns (Direction) { return Direction.Right; }
  function g() public pure returns (I.Direction) { return I.Direction.Right; }
}
contract C is I {
  function verify() public {
    require(uint(Direction.Right) == 3);
    require(uint(I.Direction.Right) == 3);
    require(uint(L.Direction.Right) == 1);
    require(uint(L.f()) == 1);
    require(uint(L.g()) == 3);
  }
  function verifyWrong() public { require(uint(L.Direction.Right) == 0); }
}
`;

const artifact = compileString(SOURCE, { forceStateful: true, solidityImportCompat: true });

describe('Solidity enum_referencing semantic fixture', () => {
  it('spends with the qualified Solidity enum ordinals', async () => {
    const contract = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expect(contract.verify()).resolves.toBeDefined();
  });

  it('rejects a deliberately incorrect enum ordinal', async () => {
    const contract = await getContractFactory(artifact, await fundedSigner()).deploy();
    await expect(contract.verifyWrong()).rejects.toThrow();
  });
});
