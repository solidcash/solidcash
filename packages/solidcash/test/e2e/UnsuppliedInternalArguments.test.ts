import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { MockNetworkProvider } from '../../src/network/mock/index.js';
import { Contract } from '../../src/Contract.js';
import { TransactionBuilder } from '../../src/TransactionBuilder.js';
import { randomUtxo } from '../../src/utils.js';

// An external call carries compiler-owned witness inputs that only StatefulContract transaction building fills. A
// plain unlock must say so instead of failing inside the debug template with an undefined value.
const SRC = `pragma solidity ^0.8.0;
interface Source { function value() external pure returns (uint256); }
contract Reader is Source {
    function read() public view returns (uint256) { Source s = this; return s.value(); }
    function value() public pure returns (uint256) { return 7; }
    function check(uint256 expected) public view { require(read() == expected); }
}`;

describe('unsupplied compiler-owned arguments', () => {
  it('names the missing external-call witness', async () => {
    const provider = new MockNetworkProvider();
    const contract = new Contract(compileString(SRC, { evmCompat: true }), [], { provider });
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
    const [utxo] = await contract.getUtxos();
    await expect(new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.check(7n))
      .addOutput({ to: contract.address, amount: 990_000n })
      .send()).rejects.toThrow(/No value for '__internal__.*filled by StatefulContract transaction building/);
  });
});
