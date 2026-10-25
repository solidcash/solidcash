import { describe, it, expect } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { encodePushdataValue } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { Contract, TransactionBuilder } from '../../src/index.js';
import { createTestProvider, verifyTransaction, createFeeFunder } from '../test-util.js';

// A loop's per-iteration callee is read from a witness, since a loop-local receiver cannot reach the epilogue. Only a
// target the caller chooses (an element of a parameter) may be replaced by that witness; one the contract fixes keeps
// its on-chain value, which the witness must equal (packages/solidc/docs/array-external-calls.md).
const IFACE = 'interface IPair { function r0() external view returns (bigint); function r1() external view returns'
  + ' (bigint); function swap(int a) external; }';
const FIXED = `pragma solidcash >=0.8.0;
${IFACE}
contract Fixed(address a, address b) {
  function go() {
    address[2] memory ps = [a, b];
    for (uint i = 0; i < 2; i++) { IPair pair = IPair(ps[i]); pair.swap(1); }
  }
}`;

// `OP_DROP OP_1` and `OP_DROP OP_1 OP_NOP`: two trivial callees that drop the selector their unlocking pushes.
const TARGET = hexToBin('7551');
const OTHER = hexToBin('755161');
const OP_TRUE = hexToBin('51');

const swapSelector = (): Uint8Array => {
  const pair = compileString('pragma solidcash >=0.8.0;\ncontract P() { function swap(int a) { require(a >= 0); } '
    + 'function r0() { require(true); } }');
  return hexToBin(pair.abi.find((entry) => entry.name === 'swap')!.selector!);
};

function unlocker(lock: Uint8Array, selector: Uint8Array): never {
  return {
    generateLockingBytecode: (): Uint8Array => lock,
    generateUnlockingBytecode: (): Uint8Array => new Uint8Array([0x04, ...selector]),
  } as never;
}

/** `Fixed(TARGET, TARGET).go()` whose loop-target witness and co-spent callees name `callee`. */
async function spend(callee: Uint8Array): Promise<TransactionBuilder> {
  const provider = createTestProvider();
  const artifact = compileString(FIXED);
  const contract = new Contract(artifact, [TARGET, TARGET], { provider });
  const selector = swapSelector();
  const funder = await createFeeFunder(provider, 10000n);
  const builder = new TransactionBuilder({ provider });
  builder.addInput({ txid: 'cc'.repeat(32), vout: 0, satoshis: 100000n },
    contract.unlock.go(1n, encodePushdataValue([callee, callee], 'address[]'), selector) as never);
  builder.addInput({ txid: '01'.repeat(32), vout: 0, satoshis: 1500n }, unlocker(callee, selector));
  builder.addInput({ txid: '02'.repeat(32), vout: 0, satoshis: 1500n }, unlocker(callee, selector));
  builder.addInput(funder.utxo, funder.unlocker);
  builder.addOutput({ to: contract.address, amount: 100000n });
  builder.addOutput({ to: callee, amount: 1500n });
  builder.addOutput({ to: callee, amount: 1500n });
  builder.addOutput({ to: OP_TRUE, amount: 7000n });
  return builder;
}

describe('loop targets a contract fixes', () => {
  it('binds a loop-local receiver over the contract\'s own addresses to them', async () => {
    const go = compileString(FIXED).abi.find((entry) => entry.name === 'go')!;
    expect(go.inputs.map((input) => input.name)).toEqual([
      '__internal__externalCallInputBase', '__internal__loopTargets0', '__internal__externalCallSelector',
    ]);
    verifyTransaction(await spend(TARGET));
    // The same spend through callees the spender picked: the witness no longer equals the contract's address.
    const forged = await spend(OTHER);
    expect(() => verifyTransaction(forged)).toThrow();
  });

  it('keeps view witnesses for a callee the caller chooses and runs a fixed callee\'s views as calls', () => {
    const body = (target: string): string => `pragma solidcash >=0.8.0;
${IFACE}
contract Views(address a, address b) {
  bigint total;
  function sum(address[] chosen) public {
    address[2] memory own = [a, b];
    bigint acc = 0;
    for (bigint i = 0; i < 2; i = i + 1) { IPair p = IPair(${target}); acc = acc + p.r0() + p.r1(); }
    this.total = acc;
  }
}`;
    const inputs = (target: string, messageBus?: boolean): string[] => compileString(body(target),
      { messageBus, suppressWarnings: true }).abi.find((entry) => entry.name === 'sum')!.inputs.map((i) => i.name);
    // Caller-chosen targets: any value the witness gives, a callee the caller passes could return as well.
    expect(inputs('chosen[i]').filter((name) => name.startsWith('__internal__viewReturn'))).toHaveLength(2);
    // The contract's own addresses: each view is a call on that callee, which runs once per spend, so a direct
    // compile refuses the pair and a default one leaves it to the message bus.
    expect(() => compileString(body('own[i]'), { messageBus: false, suppressWarnings: true }))
      .toThrow(/MESSAGE_BUS_REQUIRED.*repeats calls to the same state owner \(IPair\.r0 -> IPair\.r1\)/);
    expect(inputs('own[i]', undefined).some((name) => name.startsWith('__internal__viewReturn'))).toBe(false);
  });
});
