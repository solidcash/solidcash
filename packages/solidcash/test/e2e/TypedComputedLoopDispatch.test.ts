import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { hexToBin, binToHex } from '@bitauth/libauth';
import { encodePushdataValue } from '@solidcash/utils';
import { Contract, buildTypedLoopCallTransaction, deriveTypedLoopCoSpends } from '../../src/index.js';
import { createTestProvider, verifyTransaction, createFeeFunder } from '../test-util.js';

// A COMPUTED per-iteration external-call target `IFoo(pairFor(path[i], path[i+1])).m(x)` in a loop (the Router02
// swap shape). SEAL cannot hoist the target (a leaf is loop-dependent), so the compiler rewrites it to read a
// SYNTHESIZED witness `address[] __internal__loopTargets0[i]` param and reuses the typed inline-loop dispatch
// (identity co-spend + preservation, no return-event). The SDK fills that witness with the co-spend pair addresses
// it derived for the route (here: the caller supplies them) - a mismatching claim is rejected by the covenant's
// per-iteration identity check, so it is caller-permissive and sound. buildTypedLoopCallTransaction co-spends each.
const SRC = `pragma solidcash >=0.8.0;
contract C() {
    function run(address[] path, int x) {
        for (uint i = 0; i < path.length - 1; i++) { IFoo(L.pairFor(path[i], path[i+1])).m(x); }
    }
}
interface IFoo { function m(int x) external; }
library L {
    function pairFor(address a, address b) internal pure returns (address) {
        return address(uint160(uint256(uint160(a)) + uint256(uint160(b))));
    }
}`;

const OP_TRUE = hexToBin('51');

// 3 dummy path tokens -> path.length - 1 = 2 loop iterations -> 2 co-spent pairs. The path VALUES are irrelevant to
// the covenant (the rewrite bypassed the on-chain pairFor); only path.length drives the loop bound.
function dummyPath(): Uint8Array[] {
  return [hexToBin('aa'.repeat(20)), hexToBin('bb'.repeat(20)), hexToBin('cc'.repeat(20))];
}

// Loop-body LOCAL receiver holding the computed target `IPair pair = IPair(pairFor(path[i], path[i+1]));
// pair.swap(x, x)` (single use). The compiler rewrites the call to the same witness AND neutralizes the dead
// pairFor initializer (reads the witness instead of recomputing on-chain), so the co-spend is identical to the
// direct form. A multi-use local (pair used by two calls) is left to fail closed.
const PAIRLOCAL_SRC = `pragma solidcash >=0.8.0;
contract C() {
    function run(address[] path, int x) {
        for (uint i = 0; i < path.length - 1; i++) {
            IPair pair = IPair(L.pairFor(path[i], path[i+1]));
            pair.swap(x, x);
        }
    }
}
interface IPair { function swap(int a, int b) external; }
library L {
    function pairFor(address a, address b) internal pure returns (address) {
        return address(uint160(uint256(uint160(a)) + uint256(uint160(b))));
    }
}`;

async function buildTx(
  witnessTargets: Uint8Array[], src: string = SRC,
): Promise<ReturnType<typeof buildTypedLoopCallTransaction>> {
  const art = compileString(src);
  const provider = createTestProvider();
  const contract = new Contract(art, [], { provider });

  const callerUtxo = { txid: 'cc'.repeat(32), vout: 0, satoshis: 100000n };
  const t0 = { txid: '01'.repeat(32), vout: 0, satoshis: 1500n };
  const t1 = { txid: '02'.repeat(32), vout: 0, satoshis: 1500n };
  const funder = await createFeeFunder(provider, 10000n);

  const trueUnlocker = {
    generateLockingBytecode: (): Uint8Array => OP_TRUE,
    generateUnlockingBytecode: (): Uint8Array => new Uint8Array([]),
  } as never;

  return buildTypedLoopCallTransaction({
    provider,
    contract,
    functionName: 'run',
    userArgs: [encodePushdataValue(dummyPath(), 'address[]'), 7n],
    targets: witnessTargets, // fills the synthesized __internal__loopTargets0 witness
    callerUtxo,
    cospends: [{ utxo: t0, unlocker: trueUnlocker }, { utxo: t1, unlocker: trueUnlocker }],
    funder,
  });
}

describe('typed COMPUTED per-iteration external dispatch (IFoo(pairFor(path[i], path[i+1])).m(x))', () => {
  it('SDK fills the synthesized witness + co-spends the derived targets; covenant validates identity', async () => {
    // The two co-spent inputs ARE OP_TRUE, so the witness must claim OP_TRUE for each - identity holds.
    const tb = await buildTx([OP_TRUE, OP_TRUE]);
    verifyTransaction(tb);
    expect(tb.inputs.length).toBe(4); // caller + 2 pairs + funder
  });

  it('rejects when the witness claims a target whose co-spent input bytecode differs (identity binding)', async () => {
    const wrong = hexToBin('5152'); // OP_1 OP_2 - not the co-spent OP_TRUE input at index 0
    const tb = await buildTx([wrong, OP_TRUE]);
    expect(() => verifyTransaction(tb)).toThrow();
  });
});

describe('computed-target loop rewrite - collect-phase robustness (compile + witness synthesis)', () => {
  const PRE = `pragma solidcash >=0.8.0;
interface IFoo { function m(int x) external; }
interface IPair { function swap(int a, int b) external; }
library L { function pairFor(address a, address b) internal pure returns (address) {
  return address(uint160(uint256(uint160(a)) + uint256(uint160(b)))); } }`;
  const witnesses = (src: string): string[] => {
    const art = compileString(src);
    return [...new Set(art.abi.flatMap((f) => (f.inputs ?? []).map((i) => i.name)
      .filter((n) => n.startsWith('__internal__loopTargets'))))];
  };
  it('two computed-target loops in one function get independent witnesses (loopTargets0 + loopTargets1)', () => {
    expect(witnesses(`${PRE}\ncontract C() { function run(address[] p, int x) {`
      + ' for (uint i=0;i<p.length-1;i++){ IFoo(L.pairFor(p[i],p[i+1])).m(x); }'
      + ' for (uint j=0;j<p.length-1;j++){ IFoo(L.pairFor(p[j],p[j+1])).m(x); } } }'))
      .toEqual(['__internal__loopTargets0', '__internal__loopTargets1']);
  });
  it('single-use pair-local resolves a tuple-bind receiver ((input,output)=(p[i],p[i+1]))', () => {
    expect(witnesses(`${PRE}\ncontract C() { function run(address[] p, int x) {`
      + ' for (uint i=0;i<p.length-1;i++){ (address input,address output)=(p[i],p[i+1]);'
      + ' IPair pair = IPair(L.pairFor(input,output)); pair.swap(x,x); } } }'))
      .toEqual(['__internal__loopTargets0']);
  });
  it('a computed-target loop coexists with a separate direct external call (only the loop is rewritten)', () => {
    expect(witnesses(`${PRE}\ncontract C() { address other; function run(address[] p, int x) {`
      + ' for (uint i=0;i<p.length-1;i++){ IFoo(L.pairFor(p[i],p[i+1])).m(x); } IFoo(other).m(x); } }'))
      .toEqual(['__internal__loopTargets0']);
  });
  it('two single-use pair-locals in one loop get independent witnesses', () => {
    expect(witnesses(`${PRE}\ncontract C() { function run(address[] p, int x) {`
      + ' for (uint i=0;i<p.length-1;i++){'
      + ' IPair pair0 = IPair(L.pairFor(p[i],p[i+1])); pair0.swap(x,x);'
      + ' IPair pair1 = IPair(L.pairFor(p[i+1],p[i])); pair1.swap(x,x); } } }'))
      .toEqual(['__internal__loopTargets0', '__internal__loopTargets1']);
  });
});

describe('typed COMPUTED loop, single-use LOCAL receiver (IPair pair = IPair(pairFor(..)); pair.swap())', () => {
  it('rewrites the call + neutralizes the dead init to the same witness; co-spends + validates', async () => {
    const tb = await buildTx([OP_TRUE, OP_TRUE], PAIRLOCAL_SRC);
    verifyTransaction(tb);
    expect(tb.inputs.length).toBe(4);
  });

  it('rejects a mismatched witness target (identity binding holds through the local)', async () => {
    const tb = await buildTx([hexToBin('5152'), OP_TRUE], PAIRLOCAL_SRC);
    expect(() => verifyTransaction(tb)).toThrow();
  });
});

describe('typed computed loop autoderivation (deriveTypedLoopCoSpends from registered target contracts)', () => {
  it('derives the witness + typed-void cospends from target instances, then builds + verifies', async () => {
    const art = compileString(SRC);
    const provider = createTestProvider();
    const contract = new Contract(art, [], { provider });

    const callerUtxo = { txid: 'cc'.repeat(32), vout: 0, satoshis: 100000n };
    const t0 = { txid: '01'.repeat(32), vout: 0, satoshis: 1500n };
    const t1 = { txid: '02'.repeat(32), vout: 0, satoshis: 1500n };
    const funder = await createFeeFunder(provider, 10000n);
    const trueUnlocker = {
      generateLockingBytecode: (): Uint8Array => OP_TRUE,
      generateUnlockingBytecode: (): Uint8Array => new Uint8Array([]),
    };
    // A registered co-spendable target contract (here an OP_TRUE pair) exposing a preserving co-spend fn.
    const mkTarget = (utxo: typeof t0): any => ({
      address: 'op-true', lockingBytecode: binToHex(OP_TRUE),
      unlock: { noop: () => trueUnlocker }, getUtxos: async () => [utxo],
    });

    // The autoderivation: witness targets + typed-void cospends fall out of the registered target instances.
    const { targets, cospends } = await deriveTypedLoopCoSpends([
      { contract: mkTarget(t0), fn: 'noop', args: [] },
      { contract: mkTarget(t1), fn: 'noop', args: [] },
    ]);
    expect(targets.map(binToHex)).toEqual([binToHex(OP_TRUE), binToHex(OP_TRUE)]);

    const tb = buildTypedLoopCallTransaction({
      provider, contract, functionName: 'run',
      userArgs: [encodePushdataValue(dummyPath(), 'address[]'), 7n],
      targets, callerUtxo, cospends, funder,
    });
    verifyTransaction(tb);
    expect(tb.inputs.length).toBe(4);
  });
});
