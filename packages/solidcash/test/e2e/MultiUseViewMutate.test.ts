import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { hexToBin } from '@bitauth/libauth';
import { encodePushdataValue } from '@solidcash/utils';
import {
  Contract,
  TransactionBuilder,
} from '../../src/index.js';
import { buildTypedLoopCallTransaction } from '../../src/loop-call.js';
import { createTestProvider, verifyTransaction, createFeeFunder } from '../test-util.js';
import { trivialCallee } from '../trivial-callee.js';

// R11 multi-use view+mutate: `IPair pair = IPair(pairFor(p[i], p[i+1])); int r = pair.getReserve(); pair.swap(r)`.
// The compiler replaces the VIEW getReserve() with a caller-provided per-iteration witness `__internal__viewReturn0[i]`
// and keeps swap as the single co-spend (loopTargets0). This VM-proves the covenant: it reads viewReturn0[i],
// co-spends each swap target (identity, selector and argument), and preserves it. Soundness is caller-permissive - a
// wrong witness feeds wrong values into swap, whose co-spent covenant would reject (Router02 K-invariant); the trivial
// targets here have no covenant, so this exercises the MECHANISM (witness read + co-spend + selector), not the
// downstream bound.
const SRC = `pragma solidcash >=0.8.0;
interface IPair { function getReserve() external view returns (int); function swap(int a) external; }
library L { function pairFor(address a, address b) internal pure returns (address) {
  return address(uint160(uint256(uint160(a)) + uint256(uint160(b)))); } }
contract C() {
  function run(address[] p) {
    for (uint i = 0; i < p.length - 1; i++) {
      IPair pair = IPair(L.pairFor(p[i], p[i+1]));
      int r = pair.getReserve();
      pair.swap(r);
    }
  }
}`;

// swap(int)'s selector, which the caller bakes in, taken from a callee that declares the method.
const SEL = hexToBin(compileString('pragma solidcash >=0.8.0;\ncontract P() { function swap(int a) { require(a >= 0); } '
  + 'function getReserve() { require(true); } }').abi.find((entry) => entry.name === 'swap')!.selector!);
const OP_TRUE = hexToBin('51');

// A trivial co-spend target that runs `swap(amount)` behind `sel`: the caller checks both against its unlocking.
const swapCallee = (amount: bigint, sel: Uint8Array = SEL): ReturnType<typeof trivialCallee> =>
  trivialCallee([amount], sel);
// Every stand-in pushes three items, so all share one lock.
const TARGET = swapCallee(0n).lock;

async function buildTx(sels: [Uint8Array, Uint8Array]): Promise<TransactionBuilder> {
  const art = compileString(SRC);
  const provider = createTestProvider();
  const contract = new Contract(art, [], { provider });
  const callerUtxo = { txid: 'cc'.repeat(32), vout: 0, satoshis: 100000n };
  const t0 = { txid: '01'.repeat(32), vout: 0, satoshis: 1500n };
  const t1 = { txid: '02'.repeat(32), vout: 0, satoshis: 1500n };
  const funder = await createFeeFunder(provider, 10000n);

  const p = encodePushdataValue(
    [hexToBin('aa'.repeat(20)), hexToBin('bb'.repeat(20)), hexToBin('cc'.repeat(20))], 'address[]',
  );
  const viewReturn0 = encodePushdataValue([10n, 20n], 'int[]');
  const loopTargets = encodePushdataValue([TARGET, TARGET], 'address[]');

  const tb = new TransactionBuilder({ provider });
  tb.addInput(callerUtxo, contract.unlock.run(p, viewReturn0, 1n, loopTargets, 1n, SEL) as never);
  tb.addInput(t0, swapCallee(10n, sels[0]).unlocker);
  tb.addInput(t1, swapCallee(20n, sels[1]).unlocker);
  tb.addInput(funder.utxo, funder.unlocker);
  tb.addOutput({ to: contract.address, amount: 100000n });
  tb.addOutput({ to: TARGET, amount: 1500n }); // preserved swap targets (bytecode + category)
  tb.addOutput({ to: TARGET, amount: 1500n });
  tb.addOutput({ to: OP_TRUE, amount: 7000n }); // change
  return tb;
}

// The REAL Router02 shape: a TUPLE-return view (getReserves returns 3) + a mutate. Each return value becomes its own
// per-iteration witness array (__internal__viewReturn0/1/2), and swap is the single co-spend.
const SRC_TUPLE = `pragma solidcash >=0.8.0;
interface IPair { function getReserves() external view returns (int, int, int); function swap(int a) external; }
library L { function pairFor(address a, address b) internal pure returns (address) {
  return address(uint160(uint256(uint160(a)) + uint256(uint160(b)))); } }
contract C() {
  function run(address[] p) {
    for (uint i = 0; i < p.length - 1; i++) {
      IPair pair = IPair(L.pairFor(p[i], p[i+1]));
      (int r0, int r1,) = pair.getReserves();
      pair.swap(r0 + r1);
    }
  }
}`;

describe('R11 multi-use view+mutate: view-witness read + swap co-spend (mechanism)', () => {
  it('reads the __internal__viewReturn0 witness per iteration and co-spends each swap target', async () => {
    const tb = await buildTx([SEL, SEL]);
    verifyTransaction(tb);
    expect(tb.inputs.length).toBe(4); // caller + 2 swap targets + funder
  });

  it('handles a TUPLE-return view (getReserves -> 3 witnesses) + swap co-spend (Router02 shape)', async () => {
    const art = compileString(SRC_TUPLE);
    const provider = createTestProvider();
    const contract = new Contract(art, [], { provider });
    const callerUtxo = { txid: 'cc'.repeat(32), vout: 0, satoshis: 100000n };
    const t0 = { txid: '01'.repeat(32), vout: 0, satoshis: 1500n };
    const t1 = { txid: '02'.repeat(32), vout: 0, satoshis: 1500n };
    const funder = await createFeeFunder(provider, 10000n);
    const p = encodePushdataValue(
      [hexToBin('aa'.repeat(20)), hexToBin('bb'.repeat(20)), hexToBin('cc'.repeat(20))], 'address[]');
    const vr = encodePushdataValue([10n, 20n], 'int[]');
    const loopTargets = encodePushdataValue([TARGET, TARGET], 'address[]');
    const tb = new TransactionBuilder({ provider });
    // run(p, viewReturn0, viewReturn1, viewReturn2, externalCallInputBase, loopTargets0, stride, selector)
    tb.addInput(callerUtxo, contract.unlock.run(p, vr, vr, vr, 1n, loopTargets, 1n, SEL) as never);
    tb.addInput(t0, swapCallee(20n).unlocker);
    tb.addInput(t1, swapCallee(40n).unlocker);
    tb.addInput(funder.utxo, funder.unlocker);
    tb.addOutput({ to: contract.address, amount: 100000n });
    tb.addOutput({ to: TARGET, amount: 1500n });
    tb.addOutput({ to: TARGET, amount: 1500n });
    tb.addOutput({ to: OP_TRUE, amount: 7000n });
    verifyTransaction(tb);
    expect(tb.inputs.length).toBe(4);
  });

  it('rejects when a co-spent target selector != the bound swap selector', async () => {
    const tb = await buildTx([SEL, hexToBin('00000000')]); // second target has the wrong selector
    expect(() => verifyTransaction(tb)).toThrow();
  });

  it('is buildable via buildTypedLoopCallTransaction (viewReturns + selector filled ergonomically)', async () => {
    const art = compileString(SRC_TUPLE);
    const provider = createTestProvider();
    const contract = new Contract(art, [], { provider });
    const callerUtxo = { txid: 'cc'.repeat(32), vout: 0, satoshis: 100000n };
    const t0 = { txid: '01'.repeat(32), vout: 0, satoshis: 1500n };
    const t1 = { txid: '02'.repeat(32), vout: 0, satoshis: 1500n };
    const funder = await createFeeFunder(provider, 10000n);
    const tb = buildTypedLoopCallTransaction({
      provider,
      contract,
      functionName: 'run',
      userArgs: [encodePushdataValue(
        [hexToBin('aa'.repeat(20)), hexToBin('bb'.repeat(20)), hexToBin('cc'.repeat(20))], 'address[]',
      )],
      targets: [TARGET, TARGET],
      callerUtxo,
      cospends: [{ utxo: t0, unlocker: swapCallee(20n).unlocker }, { utxo: t1, unlocker: swapCallee(40n).unlocker }],
      funder,
      viewReturns: [[10n, 20n], [10n, 20n], [10n, 20n]], // reserve0/1/2 per iteration
      selector: SEL,
    });
    verifyTransaction(tb);
    expect(tb.inputs.length).toBe(4);
  });
});
