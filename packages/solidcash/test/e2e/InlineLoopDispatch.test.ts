import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { hexToBin, binToHex } from '@bitauth/libauth';
import { encodePushdataValue } from '@solidcash/utils';
import {
  Contract, SignatureTemplate, TransactionBuilder, deriveOpaqueLoopCoSpends,
} from '../../src/index.js';
import { createTestProvider, verifyTransaction, createFeeFunder } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';

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

// A real category-pinned target contract whose UTXO is Fulcrum-discoverable from its artifact + category. Its
// co-spend function is unsafe(0) (zero covenant) so it PERMITS the multiCall's output structure (preserved
// target + minted return event). A strict stateful covenant would reject that extra minted output of its
// category - the one genuine residual constraint on auto-deriving the return.
const TARGET_SRC = `pragma solidcash >=0.8.0;
contract Target() {
  int value;
  function cospend(pubkey pk, sig s) unsafe(0) { require(checkSig(s, pk)); }
}`;

const OP_TRUE = hexToBin('51'); // anyone-can-spend
const C0 = 'a0'.repeat(32);
const C1 = 'b1'.repeat(32);

// The real solidity-by-example MultiCall: stateless, returns bytes[]. The function-return event is skipped
// by passing __internal__returnOutputIdx = -1 (standalone call), so it reuses the same dispatch covenant.
const MULTICALL_SRC = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;
contract MultiCall {
    function multiCall(address[] calldata targets, bytes[] calldata data)
        external view returns (bytes[] memory) {
        require(targets.length == data.length, "target length != data length");
        bytes[] memory results = new bytes[](data.length);
        for (uint256 i; i < targets.length; i++) {
            (bool success, bytes memory result) = targets[i].staticcall(data[i]);
            require(success, "call failed");
            results[i] = result;
        }
        return results;
    }
}`;

// trivial co-spend unlocker for an anyone-can-spend (OP_TRUE) UTXO
function trueUnlocker(): { generateLockingBytecode: () => Uint8Array; generateUnlockingBytecode: () => Uint8Array } {
  return {
    generateLockingBytecode: (): Uint8Array => OP_TRUE,
    generateUnlockingBytecode: (): Uint8Array => new Uint8Array([]),
  };
}

// Build the multi-call transaction. `targetsArg` is what the witness CLAIMS the targets are (the address[]
// the covenant verifies each co-spent input against); the co-spent inputs are always the two real OP_TRUE
// token UTXOs. Passing a mismatching targetsArg proves the identity binding rejects. `makeUnlock` produces
// the contract unlocker from the encoded (targets, data) args - lets each contract supply its own arg shape.
async function buildTx(
  src: string,
  makeUnlock: (contract: Contract, targets: Uint8Array, data: Uint8Array) => unknown,
  targetsArg: Uint8Array[],
): Promise<TransactionBuilder> {
  const art = compileString(src, { solidityImportCompat: true });
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
  tb.addInput(contractUtxo, makeUnlock(contract, targets, data) as any);
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

const miniUnlock = (c: Contract, t: Uint8Array, d: Uint8Array): unknown => c.unlock.run(t, d, 1n, 3n);
// MultiCall: (targets, data, externalCallInputBase, returnOutputIdx=-1 (skip fn return event), externalReturnOutputIdx)
const multiUnlock = (c: Contract, t: Uint8Array, d: Uint8Array): unknown => c.unlock.multiCall(t, d, 1n, -1n, 3n);

describe('Inline loop-indexed external dispatch (MultiCall covenant)', () => {
  it('co-spends N witness targets + mints N return events (staticcall)', async () => {
    const tb = await buildTx(SRC, miniUnlock, [OP_TRUE, OP_TRUE]);
    verifyTransaction(tb);
    expect(tb.inputs.length).toBe(4);
  });

  it('rejects a co-spent input whose bytecode != the claimed target[i] (identity binding)', async () => {
    // claim targets[0] is a different locking bytecode than the co-spent input[1] (which is OP_TRUE)
    const wrong = hexToBin('5152'); // OP_1 OP_2 - not equal to the co-spent OP_TRUE input
    const tb = await buildTx(SRC, miniUnlock, [wrong, OP_TRUE]);
    expect(() => verifyTransaction(tb)).toThrow();
  });

  it('the real solidity-by-example MultiCall verifies end-to-end (returns bytes[])', async () => {
    const tb = await buildTx(MULTICALL_SRC, multiUnlock, [OP_TRUE, OP_TRUE]);
    verifyTransaction(tb);
    expect(tb.inputs.length).toBe(4);
  });

  it('contract.multiCall(targets, data, ctx) - Solidity-faithful, auto-derives callerUtxo', async () => {
    const art = compileString(MULTICALL_SRC, { solidityImportCompat: true });
    const provider = createTestProvider();
    const contract = new Contract(art, [], { provider });
    // register the caller's own UTXO so callerUtxo is auto-derived (omitted from ctx below)
    await provider.addUtxo(contract.address, { txid: 'cc'.repeat(32), vout: 0, satoshis: 100000n });
    const t0 = {
      txid: '01'.repeat(32), vout: 0, satoshis: 1200n,
      token: { category: C0, amount: 0n, nft: { capability: 'minting' as const, commitment: '' } },
    };
    const t1 = {
      txid: '02'.repeat(32), vout: 0, satoshis: 1200n,
      token: { category: C1, amount: 0n, nft: { capability: 'minting' as const, commitment: '' } },
    };
    const funder = await createFeeFunder(provider, 10000n);

    // Mirrors Solidity's multiCall(address[] targets, bytes[] data); ctx carries the BCH co-spend context.
    // callerUtxo is omitted - auto-derived from the contract's own UTXOs.
    const tb = await (contract as any).multiCall(
      [OP_TRUE, OP_TRUE],                          // address[] targets
      [new Uint8Array([]), new Uint8Array([])],    // bytes[] data
      {
        cospends: [
          { utxo: t0, unlocker: trueUnlocker(), returnData: hexToBin('deadbeef') },
          { utxo: t1, unlocker: trueUnlocker(), returnData: hexToBin('cafe') },
        ],
        funder,
      },
    ) as TransactionBuilder;
    verifyTransaction(tb);
    expect(tb.inputs.length).toBe(4);
  });

  it('deriveOpaqueLoopCoSpends: cospends auto-derived from real category-pinned target contracts', async () => {
    const provider = createTestProvider();
    const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);
    const callerArt = compileString(MULTICALL_SRC, { solidityImportCompat: true });
    const targetArt = compileString(TARGET_SRC);

    const caller = new Contract(callerArt, [], { provider });
    await provider.addUtxo(caller.address, { txid: 'cc'.repeat(32), vout: 0, satoshis: 100000n });

    // two real targets, each category-pinned so its master UTXO is discoverable from the artifact + category
    // (Contract.withCategory bakes the category self-pin -> a deterministic locking bytecode -> Fulcrum lookup).
    const makeTarget = async (categoryHex: string, txidByte: string): Promise<Contract> => {
      const t = new Contract(targetArt, [], { provider }).withCategory(hexToBin(categoryHex));
      await provider.addUtxo(t.tokenAddress, {
        txid: txidByte.repeat(32), vout: 0, satoshis: 1200n,
        token: { category: categoryHex, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      });
      return t;
    };
    const t0 = await makeTarget(C0, '01');
    const t1 = await makeTarget(C1, '02');

    // the user said this is fundamentally available on BCH: utxo (Fulcrum lookup) + unlocker (artifact) +
    // returnData (on-chain state) all derived from the known contracts.
    const { targets, cospends } = await deriveOpaqueLoopCoSpends([
      { contract: t0, fn: 'cospend', args: [alicePub, sig()] },
      { contract: t1, fn: 'cospend', args: [alicePub, sig()] },
    ]);
    expect(targets.length).toBe(2);
    expect(cospends.every((c) => c.utxo.token?.nft?.capability === 'minting')).toBe(true);

    const funder = await createFeeFunder(provider, 10000n);
    const tb = await (caller as any).multiCall(
      targets,
      [new Uint8Array([]), new Uint8Array([])],
      { cospends, funder },
    ) as TransactionBuilder;
    verifyTransaction(tb);
    expect(tb.inputs.length).toBe(4);
  });
});
