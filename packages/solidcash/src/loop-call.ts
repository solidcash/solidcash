import { binToHex } from '@bitauth/libauth';
import { encodePushdataValue } from '@solidcash/utils';
import type { Contract } from './Contract.js';
import { TransactionBuilder } from './TransactionBuilder.js';
import { NetworkProvider } from './network/index.js';
import { Utxo, Unlocker } from './interfaces.js';

const OP_TRUE = new Uint8Array([0x51]);

/** Per-target co-spend context for an opaque loop dispatch, aligned by index with `targets`/`data`. */
export interface OpaqueLoopCoSpend {
  /** The UTXO to co-spend. Must carry a minting NFT - its category backs the minted return event. */
  utxo: Utxo;
  /** Unlocker for the co-spent UTXO. */
  unlocker: Unlocker;
  /** Claimed opaque return for this target; becomes the return-event commitment (read into results[i]). */
  returnData: Uint8Array;
}

/** BCH execution context for an opaque loop dispatch (everything not in the Solidity signature). */
export interface OpaqueLoopCallContext {
  /** The caller contract's own UTXO; self-preserved at output 0. Auto-derived from the contract when omitted. */
  callerUtxo?: Utxo;
  /** Per-target co-spend info, aligned with `targets`/`data`. */
  cospends: OpaqueLoopCoSpend[];
  /** Funds the return-event satoshis + fee (the self-preserved caller value cannot be drawn down). */
  funder: { utxo: Utxo; unlocker: Unlocker };
  /** Per return-event output value (default 1000). */
  returnDust?: bigint;
  /** Locking bytecode for the change output (default anyone-can-spend OP_TRUE). */
  changeLockingBytecode?: Uint8Array;
  /** Flat fee in satoshis (default 1000). */
  fee?: bigint;
}

export interface BuildOpaqueLoopCallOptions extends OpaqueLoopCallContext {
  provider: NetworkProvider;
  /** The stateless caller contract whose function does the loop dispatch. */
  contract: Contract;
  /** The loop-dispatch function name. */
  functionName: string;
  /** address[] - the locking bytecodes the covenant verifies each co-spent input against (Solidity arg 1). */
  targets: Uint8Array[];
  /** bytes[] - per-target payloads; advisory in the opaque model (Solidity arg 2). */
  data: Uint8Array[];
  /** Required here (the sync builder does no lookups); contract.multiCall(...) auto-derives it when omitted. */
  callerUtxo: Utxo;
}

/**
 * Build a transaction for a stateless opaque loop-dispatch function (the MultiCall pattern):
 * `targets[i].call/staticcall(data[i])` over a calldata address array. The `targets` (address[]) and `data`
 * (bytes[]) arguments mirror the Solidity signature; `ctx.cospends` supplies the BCH-specific co-spend info
 * (UTXO + unlocker + claimed return) aligned by index, since BCH co-spends rather than executes.
 *
 * Places everything by the fixed convention the inline covenant
 * (GenerateTargetTraversal.emitInlineLoopExternalCall) expects:
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
    provider, contract, functionName, targets, data, callerUtxo, cospends, funder,
  } = opts;
  const n = targets.length;
  if (n === 0) throw new Error('buildOpaqueLoopCallTransaction: at least one target is required');
  if (data.length !== n || cospends.length !== n) {
    throw new Error('buildOpaqueLoopCallTransaction: targets, data and cospends must have the same length');
  }
  const returnDust = opts.returnDust ?? 1000n;
  const fee = opts.fee ?? 1000n;
  const changeLbc = opts.changeLockingBytecode ?? OP_TRUE;

  // Source args, pre-encoded to the framed blobs the covenant decodes.
  const targetsArg = encodePushdataValue(targets, 'address[]');
  const dataArg = encodePushdataValue(data, 'bytes[]');

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
  for (const c of cospends) tb.addInput(c.utxo, c.unlocker);
  tb.addInput(funder.utxo, funder.unlocker);

  // output 0: self-preserved caller (covenant pins bytecode + value + category + commitment)
  tb.addOutput({ to: contract.address, amount: callerUtxo.satoshis, token: callerUtxo.token });
  // outputs 1..N: preserved targets (staticcall: bytecode + category + commitment unchanged)
  for (let i = 0; i < n; i += 1) {
    tb.addOutput({ to: targets[i], amount: cospends[i].utxo.satoshis, token: cospends[i].utxo.token });
  }
  // outputs N+1..2N: return events (immutable NFT of the target's category; commitment = claimed return)
  for (let i = 0; i < n; i += 1) {
    const category = cospends[i].utxo.token?.category;
    if (!category) {
      throw new Error('buildOpaqueLoopCallTransaction: each target UTXO must carry a (minting) NFT '
        + 'to back its return event');
    }
    tb.addOutput({
      to: OP_TRUE,
      amount: returnDust,
      token: { category, amount: 0n, nft: { capability: 'none', commitment: binToHex(cospends[i].returnData) } },
    });
  }

  // change from the funder (the caller value is fixed by self-preservation)
  const targetSats = cospends.reduce((s, c) => s + c.utxo.satoshis, 0n);
  const inTotal = callerUtxo.satoshis + targetSats + funder.utxo.satoshis;
  const outTotal = callerUtxo.satoshis + targetSats + returnDust * BigInt(n);
  const change = inTotal - outTotal - fee;
  if (change > 546n) tb.addOutput({ to: changeLbc, amount: change });
  return tb;
}
