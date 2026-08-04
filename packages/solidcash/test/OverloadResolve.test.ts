import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';
import { Contract, TransactionBuilder } from '../src/index.js';
import { randomUtxo } from '../src/utils.js';
import { createTestProvider, verifyTransaction } from './test-util.js';

// VM-verify overload resolution picks the RIGHT overload at runtime. The 1-arg pick adds 100; the 2-arg pick
// adds its two args. If pick(5,7) mistakenly matched the 1-arg overload it would return 105 and the require
// would fail.
const SAME_CONTRACT = `
contract OverloadSame() {
    function pick(int a) internal pure returns (int) { return a + 100; }
    function pick(int a, int b) internal pure returns (int) { return a + b; }
    function check() {
        require(pick(5) == 105);
        require(pick(5, 7) == 12);
    }
}`;

// The same on PUBLIC overloads called internally - exercises the entry-point synthetic returnOutputIdx param
// in BOTH overload matching and the internal-call subroutine return cleanup.
const PUBLIC_CONTRACT = `
contract OverloadPublic() {
    function pick(int a) public pure returns (int) { return a + 100; }
    function pick(int a, int b) public pure returns (int) { return a + b; }
    function check() {
        require(pick(5) == 105);
        require(pick(5, 7) == 12);
    }
}`;

// Inherited overloads: both f overloads live on the base and must survive inheritance flattening. The merge
// used to key by name only and drop the second same-name overload as a spurious "diamond duplicate".
const INHERIT = `
contract Base {
    function f(int a) internal pure returns (int) { return a + 100; }
    function f(int a, int b) internal pure returns (int) { return a + b; }
}
contract OverloadInherit() is Base {
    function check() {
        require(f(5) == 105);
        require(f(5, 7) == 12);
    }
}`;

describe('function overload resolution picks the correct overload (VM-verified)', () => {
  const run = async (src: string): Promise<void> => {
    const provider = createTestProvider();
    const contract = new Contract(compileString(src), [], { provider });
    const utxo = randomUtxo();
    await provider.addUtxo(contract.address, utxo);
    const tx = new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.check())
      .addOutput({ to: contract.address, amount: 10000n });
    expect(() => verifyTransaction(tx)).not.toThrow();
  };

  it('resolves 1-arg vs 2-arg overloads within a contract at runtime', async () => {
    await run(SAME_CONTRACT);
  });

  it('resolves public overloads called internally at runtime', async () => {
    await run(PUBLIC_CONTRACT);
  });

  it('resolves inherited overloads that survived inheritance flattening', async () => {
    await run(INHERIT);
  });
});
