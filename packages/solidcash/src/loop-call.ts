import { binToHex } from '@bitauth/libauth';
import { encodePushdataValue } from '@solidcash/utils';
import { Contract } from './Contract.js';
import { TransactionBuilder } from './TransactionBuilder.js';
import { NetworkProvider } from './network/index.js';
import { Utxo, Unlocker } from './interfaces.js';

const OP_TRUE = new Uint8Array([0x51]);

/** One target of an opaque loop dispatch (`targets[i].call/staticcall(data[i])`). */
export interface OpaqueLoopCallTarget {
  /** The UTXO to co-spend. Must carry a minting NFT - its category backs the minted return event. */
  utxo: Utxo;
  /** Unlocker for the co-spent UTXO. */
  unlocker: Unlocker;
  /** Locking bytecode of the target - the `address[]` element verified against OP_UTXOBYTECODE(input). */
  lockingBytecode: Uint8Array;
  /** Per-target payload (`data[i]`); advisory in the opaque model. */
  data: Uint8Array;
  /** Claimed opaque return for this target; becomes the return-event commitment (read into results[i]). */
  returnData: Uint8Array;
}

export interface BuildOpaqueLoopCallOptions {
  provider: NetworkProvider;
  /** The stateless caller contract whose function does the loop dispatch. */
  contract: Contract;
  /** The loop-dispatch function name (its `address[]` + `bytes[]` params come first). */
  functionName: string;
  /** The caller contract's own UTXO; self-preserved at output 0. */
  callerUtxo: Utxo;
  /** Targets, aligned in dispatch order. */
  targets: OpaqueLoopCallTarget[];
  /** Funds the return-event satoshis + fee (the self-preserved caller value cannot be drawn down). */
  funder: { utxo: Utxo; unlocker: Unlocker };
  /** Per return-event output value (default 1000). */
  returnDust?: bigint;
  /** Locking bytecode for the change output (default anyone-can-spend OP_TRUE). */
  changeLockingBytecode?: Uint8Array;
  /** Flat fee in satoshis (default 1000). */
  fee?: bigint;
}

/**
 * Build a transaction for a stateless opaque loop-dispatch function (the MultiCall pattern):
 * `targets[i].call/staticcall(data[i])` over a calldata address array. Places everything by the fixed
 * convention the inline covenant (see GenerateTargetTraversal.emitInlineLoopExternalCall) expects:
 *
 *   input 0      caller (self-preserved)        output 0        self-preserved caller (bytecode+value+token)
 *   inputs 1..N  co-spent targets               outputs 1..N    preserved targets (staticcall)
 *   input  N+1   funder                         outputs N+1..2N return events (minted per target category)
 *                                               output 2N+1     change
 *
 * and fills the synthetic params: __internal__externalCallInputBase = 1,
 * __internal__externalReturnOutputIdx = N+1, and (when present) __internal__returnOutputIdx = -1 (the function
 * return event is skipped - the loop returns are read from the per-target events). Each target UTXO must carry
 * a minting NFT so its return-event NFT can be minted while the target itself is preserved for the staticcall.
 */
export function buildOpaqueLoopCallTransaction(opts: BuildOpaqueLoopCallOptions): TransactionBuilder {
  const {
    provider, contract, functionName, callerUtxo, targets, funder,
  } = opts;
  const n = targets.length;
  if (n === 0) throw new Error('buildOpaqueLoopCallTransaction: at least one target is required');
  const returnDust = opts.returnDust ?? 1000n;
  const fee = opts.fee ?? 1000n;
  const changeLbc = opts.changeLockingBytecode ?? OP_TRUE;

  // Source args, pre-encoded to the framed blobs the covenant decodes.
  const targetsArg = encodePushdataValue(targets.map((t) => t.lockingBytecode), 'address[]');
  const dataArg = encodePushdataValue(targets.map((t) => t.data), 'bytes[]');

  // Synthetic params by ABI shape: base = 1 (targets at inputs 1..N), return base = N+1, skip fn return event.
  const abiFn = contract.artifact.abi.find((f) => f.name === functionName);
  if (!abiFn) throw new Error(`buildOpaqueLoopCallTransaction: function '${functionName}' not found`);
  const internalArgs: bigint[] = [];
  for (const inp of abiFn.inputs) {
    if (inp.name === '__internal__externalCallInputBase') internalArgs.push(1n);
    else if (inp.name === '__internal__externalReturnOutputIdx') internalArgs.push(BigInt(1 + n));
    else if (inp.name === '__internal__returnOutputIdx') internalArgs.push(-1n);
  }
  const unlockerFactory = contract.unlock[functionName];
  if (!unlockerFactory) throw new Error(`buildOpaqueLoopCallTransaction: no unlocker for '${functionName}'`);
  const callerUnlocker = unlockerFactory(targetsArg, dataArg, ...internalArgs);

  const tb = new TransactionBuilder({ provider });
  tb.addInput(callerUtxo, callerUnlocker);
  for (const t of targets) tb.addInput(t.utxo, t.unlocker);
  tb.addInput(funder.utxo, funder.unlocker);

  // output 0: self-preserved caller (covenant pins bytecode + value + category + commitment)
  tb.addOutput({ to: contract.address, amount: callerUtxo.satoshis, token: callerUtxo.token });
  // outputs 1..N: preserved targets (staticcall: bytecode + category + commitment unchanged)
  for (const t of targets) {
    tb.addOutput({ to: t.lockingBytecode, amount: t.utxo.satoshis, token: t.utxo.token });
  }
  // outputs N+1..2N: return events (immutable NFT of the target's category; commitment = claimed return)
  for (const t of targets) {
    const category = t.utxo.token?.category;
    if (!category) {
      throw new Error('buildOpaqueLoopCallTransaction: each target UTXO must carry a (minting) NFT '
        + 'to back its return event');
    }
    tb.addOutput({
      to: OP_TRUE,
      amount: returnDust,
      token: { category, amount: 0n, nft: { capability: 'none', commitment: binToHex(t.returnData) } },
    });
  }

  // change from the funder (the caller value is fixed by self-preservation)
  const targetSats = targets.reduce((s, t) => s + t.utxo.satoshis, 0n);
  const inTotal = callerUtxo.satoshis + targetSats + funder.utxo.satoshis;
  const outTotal = callerUtxo.satoshis + targetSats + returnDust * BigInt(n);
  const change = inTotal - outTotal - fee;
  if (change > 546n) tb.addOutput({ to: changeLbc, amount: change });
  return tb;
}
