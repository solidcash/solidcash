import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { hexToBin } from '@bitauth/libauth';
import { encodePushdataValue } from '@solidcash/utils';
import { Contract, buildTypedLoopCallTransaction } from '../../src/index.js';
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

async function buildTx(witnessTargets: Uint8Array[]): Promise<ReturnType<typeof buildTypedLoopCallTransaction>> {
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
