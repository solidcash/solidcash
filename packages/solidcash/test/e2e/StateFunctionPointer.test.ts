import { describe, it, expect } from 'vitest';
import { compileString } from '@solidcash/solidc';
import { getContractFactory } from '../../src/stateful/index.js';
import { fundedSigner } from '../test-util.js';

// A function pointer held in contract state is its target's integer functionId in the data-NFT commitment. The SDK
// rebuilds that commitment from decoded state, so its codec must read and write the field as an int, as the
// compiler does: a byte-string round trip (`52` -> `0102`) failed the covenant's commitment check on every spend.
const SRC = `contract C {
  function(uint256) internal returns (uint256) x;
  function() internal returns (uint256) y;
  function() external returns (uint256) z;
  constructor() { x = double; }
  function double(uint256 v) internal pure returns (uint256) { return v * 2; }
  function seven() internal pure returns (uint256) { return 7; }
  function eight() public pure returns (uint256) { return 8; }
  function useX(uint256 v, uint256 e) public { require(x(v) == e); }
  function set() public { y = seven; z = this.eight; require(y() == 7); }
  function callY(uint256 e) public { require(y() == e); }
  function callZ(uint256 e) public { require(z() == e); }
  function clear() public { delete y; }
}`;

interface Call { send: () => Promise<unknown> }
type Handle = Record<'useX' | 'set' | 'callY' | 'callZ' | 'clear', (...args: bigint[]) => Call>;

describe('function pointers held in contract state (VM-verified, stateful)', () => {
  it('keep their functionId across spends: constructor store, write + call, later reads, delete', async () => {
    const factory = getContractFactory(compileString(SRC, { evmCompat: true }), await fundedSigner(8));
    const sc = await factory.deploy() as unknown as Handle;
    // The constructor-stored pointer, read in a spend that keeps the commitment.
    await sc.useX(3n, 6n).send();
    // Write and call in one spend, then read both pointers back in later spends.
    await sc.set().send();
    await sc.callY(7n).send();
    await sc.callZ(8n).send();
    // The dispatch is real: a wrong expectation reverts.
    await expect(sc.callY(8n).send()).rejects.toThrow(/OP_VERIFY/);
    // A deleted pointer is the 4-byte invalid id: it round-trips through the commitment and fails when called.
    await sc.clear().send();
    await sc.useX(4n, 8n).send();
    await expect(sc.callY(7n).send()).rejects.toThrow(/undefined function identifier|mandatory-script-verify/);
  });
});
