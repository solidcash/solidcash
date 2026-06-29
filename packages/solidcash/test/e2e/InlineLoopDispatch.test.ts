import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { hexToBin, binToHex } from '@bitauth/libauth';
import { encodePushdataValue } from '@solidcash/utils';
import { Contract, TransactionBuilder } from '../../src/index.js';
import { createTestProvider, verifyTransaction, createFeeFunder } from '../test-util.js';

// Minimal isolation of the inline loop-indexed external dispatch (the MultiCall covenant): a stateless
// contract that staticcalls each element of a calldata address array and consumes the per-element return,
// WITHOUT returning a bytes[] (so no __internal__returnOutputIdx - pure covenant isolation).
const SRC = `
pragma solidcash >=0.8.0;
contract MiniMultiCall() {
    function run(address[] targets, bytes[] data) {
        int total = 0;
        for (uint i = 0; i < targets.length; i++) {
            bool ok, bytes r = targets[i].staticcall(data[i]);
            require(ok);
            total = total + r.length;
        }
        require(total >= 0);
    }
}`;

const OP_TRUE = hexToBin('51'); // anyone-can-spend
const C0 = 'a0'.repeat(32);
const C1 = 'b1'.repeat(32);

// trivial co-spend unlocker for an anyone-can-spend (OP_TRUE) UTXO
function trueUnlocker(): { generateLockingBytecode: () => Uint8Array; generateUnlockingBytecode: () => Uint8Array } {
  return {
    generateLockingBytecode: (): Uint8Array => OP_TRUE,
    generateUnlockingBytecode: (): Uint8Array => new Uint8Array([]),
  };
}

// Build the multi-call transaction. `targetsArg` is what the witness CLAIMS the targets are (the address[]
// the covenant verifies each co-spent input against); the co-spent inputs are always the two real OP_TRUE
// token UTXOs. Passing a mismatching targetsArg proves the identity binding rejects.
async function buildTx(targetsArg: Uint8Array[]): Promise<TransactionBuilder> {
  const art = compileString(SRC, { solidityImportCompat: true });
  const provider = createTestProvider();
  const contract = new Contract(art, [], { provider });

  const contractUtxo = { txid: 'cc'.repeat(32), vout: 0, satoshis: 100000n };
  const t0 = {
    txid: '01'.repeat(32), vout: 0, satoshis: 1200n,
    token: { category: C0, amount: 0n, nft: { capability: 'minting' as const, commitment: '' } },
  };
  const t1 = {
    txid: '02'.repeat(32), vout: 0, satoshis: 1200n,
    token: { category: C1, amount: 0n, nft: { capability: 'minting' as const, commitment: '' } },
  };

  const targets = encodePushdataValue(targetsArg, 'address[]');
  const data = encodePushdataValue([new Uint8Array([]), new Uint8Array([])], 'bytes[]');
  const feeFunder = await createFeeFunder(provider, 10000n);

  // base=1 (targets at input 1,2), externalReturnOutputIdx=3 (return events at output 3,4)
  const tb = new TransactionBuilder({ provider });
  tb.addInput(contractUtxo, contract.unlock.run(targets, data, 1n, 3n));
  tb.addInput(t0, trueUnlocker());
  tb.addInput(t1, trueUnlocker());
  tb.addInput(feeFunder.utxo, feeFunder.unlocker);

  // output 0: preserved caller (self-preservation pins bytecode+category+value+commitment); outputs 1,2:
  // preserved targets; outputs 3,4: return events (minted from each target's category); output 5: change
  tb.addOutput({ to: contract.address, amount: 100000n });
  tb.addOutput({ to: OP_TRUE, amount: 1200n, token: { category: C0, amount: 0n, nft: { capability: 'minting', commitment: '' } } });
  tb.addOutput({ to: OP_TRUE, amount: 1200n, token: { category: C1, amount: 0n, nft: { capability: 'minting', commitment: '' } } });
  tb.addOutput({ to: OP_TRUE, amount: 1000n, token: { category: C0, amount: 0n, nft: { capability: 'none', commitment: 'deadbeef' } } });
  tb.addOutput({ to: OP_TRUE, amount: 1000n, token: { category: C1, amount: 0n, nft: { capability: 'none', commitment: 'cafe' } } });
  tb.addOutput({ to: OP_TRUE, amount: 7000n });
  return tb;
}

describe('Inline loop-indexed external dispatch (MultiCall covenant)', () => {
  it('co-spends N witness targets + mints N return events (staticcall)', async () => {
    const tb = await buildTx([OP_TRUE, OP_TRUE]);
    verifyTransaction(tb);
    expect(tb.inputs.length).toBe(4);
  });

  it('rejects a co-spent input whose bytecode != the claimed target[i] (identity binding)', async () => {
    // claim targets[0] is a different locking bytecode than the co-spent input[1] (which is OP_TRUE)
    const wrong = hexToBin('5152'); // OP_1 OP_2 - not equal to the co-spent OP_TRUE input
    const tb = await buildTx([wrong, OP_TRUE]);
    expect(() => verifyTransaction(tb)).toThrow();
  });
});
