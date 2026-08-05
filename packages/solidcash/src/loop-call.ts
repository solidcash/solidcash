import { binToHex, hexToBin } from '@bitauth/libauth';
import { encodePushdataValue } from '@solidcash/utils';
import type { Contract } from './Contract.js';
import { TransactionBuilder } from './TransactionBuilder.js';
import { NetworkProvider } from './network/index.js';
import { Utxo, Unlocker } from './interfaces.js';

const OP_TRUE = new Uint8Array([0x51]);

/**
 * One entry in the unified external-target registry (keyed by address = locking bytecode hex). Serves both the
 * typed array external-call path (IFoo(arr[i]).m(), grouped by interfaceName + instance) and opaque loop
 * dispatch (contract.multiCall, by address + coSpend). A registration populates whichever fields apply.
 */
export interface ExternalTargetEntry {
  /** Locking bytecode hex - the canonical key (address <-> category <-> instance are 1:1). */
  address: string;
  /** Typed array external call grouping (`IFoo(arr[i]).m()` resolves its instances by this). */
  interfaceName?: string;
  /** The instance used by the typed array path (a ConnectedStatefulContract; opaque entries omit it). */
  instance?: unknown;
  /** Per-element method for a varying-method dispatch table (`function(P) external[]` with differing methods);
   * omitted for a fixed-method array (which uses the ABI slot's single functionName). */
  method?: string;
  /** Opaque loop-dispatch co-spend spec (contract.multiCall); typed-only entries omit it. */
  coSpend?: OpaqueLoopContractCall;
}

/** A co-spendable contract instance: enough of Contract/StatefulContract to derive its co-spend. */
export interface CoSpendableContract {
  address: string;
  lockingBytecode: string;
  unlock: Record<string, (...args: any[]) => Unlocker>;
  getUtxos: () => Promise<Utxo[]>;
}

/** A known-contract call to co-spend in an opaque loop dispatch. */
export interface OpaqueLoopContractCall {
  /** The target contract instance (artifact + category-pinned address - so its UTXO is Fulcrum-discoverable). */
  contract: CoSpendableContract;
  /** Function to co-spend it with. For a staticcall it must preserve the target (e.g. an unsafe(0) co-spend). */
  fn: string;
  /** Args for that function (incl. any auth the target requires). */
  args: any[];
  /** Override the derived return (default: the target's current NFT commitment - i.e. its on-chain state). */
  returnData?: Uint8Array;
}

/**
 * Derive (targets, cospends) for an opaque loop dispatch from known contract instances: each target's locking
 * bytecode, its UTXO (provider lookup), its unlocker (artifact + chosen fn/args), and its return (on-chain
 * state). Picks the minting-NFT master UTXO, needed to mint the return event.
 */
export async function deriveOpaqueLoopCoSpends(
  calls: OpaqueLoopContractCall[],
): Promise<{ targets: Uint8Array[]; cospends: OpaqueLoopCoSpend[] }> {
  const targets: Uint8Array[] = [];
  const cospends: OpaqueLoopCoSpend[] = [];
  for (const call of calls) {
    const utxos = await call.contract.getUtxos();
    const utxo = utxos.find((u) => u.token?.nft?.capability === 'minting') ?? utxos.find((u) => u.token) ?? utxos[0];
    if (!utxo) throw new Error(`deriveOpaqueLoopCoSpends: no co-spendable UTXO at ${call.contract.address}`);
    const unlockFactory = call.contract.unlock[call.fn];
    if (!unlockFactory) throw new Error(`deriveOpaqueLoopCoSpends: no unlocker '${call.fn}' on the target`);
    targets.push(hexToBin(call.contract.lockingBytecode));
    cospends.push({
      utxo,
      unlocker: unlockFactory(...call.args),
      returnData: call.returnData ?? hexToBin(utxo.token?.nft?.commitment ?? ''),
    });
  }
  return { targets, cospends };
}

/** Per-target co-spend context for an opaque loop dispatch, aligned by index with `targets`/`data`. */
export interface OpaqueLoopCoSpend {
  /** The UTXO to co-spend. Must carry a minting NFT - its category backs the minted return event. */
  utxo: Utxo;
  /** Unlocker for the co-spent UTXO. */
  unlocker: Unlocker;
  /** Claimed opaque return for this target; becomes the return-event commitment (read into results[i]). */
  returnData: Uint8Array;
}

/**
 * Optional BCH execution context for `contract.multiCall(targets, data, ctx?)`. Every field is derivable, so
 * ctx may be omitted entirely once targets + a funder are registered (registerLoopTargets / registerLoopFunder):
 * callerUtxo from the contract's UTXOs, cospends from the registered targets, funder from the registered funder.
 */
export interface OpaqueLoopCallContext {
  /** The caller contract's own UTXO; self-preserved at output 0. Auto-derived from the contract when omitted. */
  callerUtxo?: Utxo;
  /** Per-target co-spend info aligned with targets/data. Derived from registered targets when omitted. */
  cospends?: OpaqueLoopCoSpend[];
  /** Funds the return-event satoshis + fee. Falls back to the registered funder when omitted. */
  funder?: { utxo: Utxo; unlocker: Unlocker };
  /** Per return-event output value (default 1000). */
  returnDust?: bigint;
  /** Locking bytecode for the change output. Defaults to the funder's own locking bytecode (never anyone-can-spend). */
  changeLockingBytecode?: Uint8Array;
  /** Flat fee in satoshis (default 1000). */
  fee?: bigint;
}

/** Fully-resolved options for the sync builder buildOpaqueLoopCallTransaction (no lookups - everything present). */
export interface BuildOpaqueLoopCallOptions {
  provider: NetworkProvider;
  /** The stateless caller contract whose function does the loop dispatch. */
  contract: Contract;
  /** The loop-dispatch function name. */
  functionName: string;
  /** address[] - the locking bytecodes the covenant verifies each co-spent input against (Solidity arg 1). */
  targets: Uint8Array[];
  /** bytes[] - per-target payloads; advisory in the opaque model (Solidity arg 2). */
  data: Uint8Array[];
  /** The caller contract's own UTXO; self-preserved at output 0. */
  callerUtxo: Utxo;
  /** Per-target co-spend info, aligned with targets/data. */
  cospends: OpaqueLoopCoSpend[];
  /** Funds the return-event satoshis + fee (the self-preserved caller value cannot be drawn down). */
  funder: { utxo: Utxo; unlocker: Unlocker };
  /** Per return-event output value (default 1000). */
  returnDust?: bigint;
  /** Locking bytecode for the change output. Defaults to the funder's own locking bytecode (never anyone-can-spend). */
  changeLockingBytecode?: Uint8Array;
  /** Flat fee in satoshis (default 1000). */
  fee?: bigint;
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
  // H4: default change to the FUNDER's own locking bytecode, never an anyone-can-spend OP_TRUE output (which a
  // mempool bot / miner would sweep -> silent fund loss). The surplus belongs to whoever funded it.
  const changeLbc = opts.changeLockingBytecode ?? funder.unlocker.generateLockingBytecode();

  // Source args, pre-encoded to the framed blobs the covenant decodes.
  const targetsArg = encodePushdataValue(targets, 'address[]');
  const dataArg = encodePushdataValue(data, 'bytes[]');

  // Synthetic params by ABI shape: base = 1 (targets at inputs 1..N), return base = N+1, skip fn return event.
  const abiFn = contract.artifact.abi.find((f) => f.name === functionName);
  if (!abiFn) throw new Error(`buildOpaqueLoopCallTransaction: function '${functionName}' not found`);
  const internalArgs: bigint[] = [];
  for (const inp of abiFn.inputs) {
    if (inp.name === '__internal__externalCallInputBase') internalArgs.push(1n);
    // Loop dispatch pins each callee against the on-chain target list, so identity takes the direct proof.
    else if (inp.name.startsWith('__internal__extcallAnchorIdx')) internalArgs.push(-1n);
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

/** Per-target co-spend for a TYPED (void) loop dispatch. No return-event (the call returns nothing), so unlike
 * OpaqueLoopCoSpend there is no returnData and the target UTXO need not carry a minting NFT. */
export interface TypedLoopCoSpend {
  /** The UTXO to co-spend; preserved (bytecode + category) at the aligned output. */
  utxo: Utxo;
  /** Unlocker for the co-spent UTXO. */
  unlocker: Unlocker;
}

/** Fully-resolved options for buildTypedLoopCallTransaction (no lookups - everything present). */
export interface BuildTypedLoopCallOptions {
  provider: NetworkProvider;
  /** The stateless caller contract whose function does the typed per-iteration dispatch. */
  contract: Contract;
  /** The dispatch function name. */
  functionName: string;
  /** The user-facing args in ABI order (e.g. [path, x]), EXCLUDING synthetic `__internal__` params. */
  userArgs: unknown[];
  /** address[] - the co-spend locking bytecodes. Fills the synthesized `__internal__loopTargets<n>` witness AND
   *  is verified by the covenant against each co-spent input's bytecode (identity binding). */
  targets: Uint8Array[];
  /** The caller contract's own UTXO; preserved at output 0. */
  callerUtxo: Utxo;
  /** Per-target co-spend info, aligned with targets. */
  cospends: TypedLoopCoSpend[];
  /** Funds the fee (the preserved caller/target values cannot be drawn down). */
  funder: { utxo: Utxo; unlocker: Unlocker };
  /** Per view-return witness, in `__internal__viewReturn<n>` ABI order: the per-iteration values a multi-use
   *  view+mutate loop reads (`(r0,r1,)=pair.getReserves()` -> one entry per return value). Caller-permissive - a
   *  wrong value feeds wrong args into the mutate, whose co-spent covenant rejects (Router02 K-invariant). Encoded
   *  by the param's ABI array type. Required iff the ABI has `__internal__viewReturn` params. */
  viewReturns?: unknown[][];
  /** The callee method's 4-byte selector, for a multi-method callee (`__internal__externalCallSelector`). Required
   *  iff the ABI has that param (a single-method interface omits it). */
  selector?: Uint8Array;
  /** Locking bytecode for the change output. Defaults to the funder's own locking bytecode. */
  changeLockingBytecode?: Uint8Array;
  /** Flat fee in satoshis (default 1000). */
  fee?: bigint;
}

/**
 * Build a transaction for a stateless TYPED per-iteration loop-dispatch function `IFoo(targets[i]).m(..)` (or a
 * computed target `IFoo(pairFor(.., path[i], ..)).m(..)` whose target the compiler rewrote to a synthesized
 * `__internal__loopTargets<n>[i]` witness param). Unlike the opaque MultiCall builder there is no return-event:
 * the covenant only verifies each co-spent input's bytecode == the claimed target (identity) and preserves it.
 *
 *   input 0      caller (preserved)          output 0        preserved caller (bytecode + value + token)
 *   inputs 1..N  co-spent targets            outputs 1..N    preserved targets (bytecode + category + value)
 *   input  N+1   funder                      output N+1      change
 *
 * Fills the synthetic params by name: `__internal__externalCallInputBase` = 1, and any
 * `__internal__loopTargets<n>` = the encoded `targets` witness the SDK derived for the computed target (the
 * caller chooses the targets and co-spends them; a mismatching claim is rejected by the covenant's identity
 * check, so this is caller-permissive and sound - the same argument as the opaque MultiCall path).
 */
export function buildTypedLoopCallTransaction(opts: BuildTypedLoopCallOptions): TransactionBuilder {
  const {
    provider, contract, functionName, userArgs, targets, callerUtxo, cospends, funder,
  } = opts;
  const n = targets.length;
  if (n === 0) throw new Error('buildTypedLoopCallTransaction: at least one target is required');
  if (cospends.length !== n) {
    throw new Error('buildTypedLoopCallTransaction: targets and cospends must have the same length');
  }
  const fee = opts.fee ?? 1000n;
  const changeLbc = opts.changeLockingBytecode ?? funder.unlocker.generateLockingBytecode();

  const targetsArg = encodePushdataValue(targets, 'address[]');
  const abiFn = contract.artifact.abi.find((f) => f.name === functionName);
  if (!abiFn) throw new Error(`buildTypedLoopCallTransaction: function '${functionName}' not found`);

  // Assemble the full unlock args in ABI order: user args in sequence, synthetic params filled by name.
  const fullArgs: unknown[] = [];
  let userCursor = 0;
  let viewCursor = 0;
  for (const inp of abiFn.inputs) {
    if (inp.name === '__internal__externalCallInputBase') fullArgs.push(1n);
    else if (inp.name.startsWith('__internal__extcallAnchorIdx')) fullArgs.push(-1n);
    else if (inp.name.startsWith('__internal__loopTargets')) fullArgs.push(targetsArg);
    else if (inp.name.startsWith('__internal__viewReturn')) {
      const vals = opts.viewReturns?.[viewCursor];
      viewCursor += 1;
      if (!vals) throw new Error(`buildTypedLoopCallTransaction: missing viewReturns[${viewCursor - 1}] for '${inp.name}'`);
      fullArgs.push(encodePushdataValue(vals as never, inp.type));
    } else if (inp.name.startsWith('__internal__externalCallSelector')) {
      if (!opts.selector) throw new Error(`buildTypedLoopCallTransaction: '${inp.name}' needs a selector option`);
      fullArgs.push(opts.selector);
    } else if (inp.name.startsWith('__internal__')) {
      throw new Error(`buildTypedLoopCallTransaction: unsupported synthetic param '${inp.name}'`);
    } else {
      if (userCursor >= userArgs.length) {
        throw new Error(`buildTypedLoopCallTransaction: missing user arg for '${inp.name}'`);
      }
      fullArgs.push(userArgs[userCursor]);
      userCursor += 1;
    }
  }
  const unlockerFactory = contract.unlock[functionName];
  if (!unlockerFactory) throw new Error(`buildTypedLoopCallTransaction: no unlocker for '${functionName}'`);
  const callerUnlocker = unlockerFactory(...fullArgs);

  const tb = new TransactionBuilder({ provider });
  tb.addInput(callerUtxo, callerUnlocker);
  for (const c of cospends) tb.addInput(c.utxo, c.unlocker);
  tb.addInput(funder.utxo, funder.unlocker);

  // output 0: preserved caller; outputs 1..N: preserved targets (covenant pins bytecode + category; value mirrored
  // so the tx balances). No return events (typed void).
  tb.addOutput({ to: contract.address, amount: callerUtxo.satoshis, token: callerUtxo.token });
  for (let i = 0; i < n; i += 1) {
    tb.addOutput({ to: targets[i], amount: cospends[i].utxo.satoshis, token: cospends[i].utxo.token });
  }

  const targetSats = cospends.reduce((s, c) => s + c.utxo.satoshis, 0n);
  const inTotal = callerUtxo.satoshis + targetSats + funder.utxo.satoshis;
  const outTotal = callerUtxo.satoshis + targetSats;
  const change = inTotal - outTotal - fee;
  if (change > 546n) tb.addOutput({ to: changeLbc, amount: change });
  return tb;
}

/**
 * Derive (targets, cospends) for a TYPED (void) loop dispatch from known target contract instances - the
 * autoderivation the SDK does for a computed-target loop `IFoo(pairFor(.., path[i], ..)).m()` once the caller
 * registers the route's target contracts: each target's locking bytecode (fills the synthesized
 * `__internal__loopTargets<n>` witness), its UTXO (provider lookup), and its unlocker (artifact + chosen fn/args).
 * Unlike deriveOpaqueLoopCoSpends there is no return-event, so no minting NFT is required - any co-spendable UTXO
 * works, and the caller's fn/args must PRESERVE the target (the covenant pins its master bytecode + category).
 * Feed the result straight into buildTypedLoopCallTransaction (targets + cospends).
 */
export async function deriveTypedLoopCoSpends(
  calls: OpaqueLoopContractCall[],
): Promise<{ targets: Uint8Array[]; cospends: TypedLoopCoSpend[] }> {
  const targets: Uint8Array[] = [];
  const cospends: TypedLoopCoSpend[] = [];
  for (const call of calls) {
    const utxos = await call.contract.getUtxos();
    const utxo = utxos.find((u) => u.token) ?? utxos[0];
    if (!utxo) throw new Error(`deriveTypedLoopCoSpends: no co-spendable UTXO at ${call.contract.address}`);
    const unlockFactory = call.contract.unlock[call.fn];
    if (!unlockFactory) throw new Error(`deriveTypedLoopCoSpends: no unlocker '${call.fn}' on the target`);
    targets.push(hexToBin(call.contract.lockingBytecode));
    cospends.push({ utxo, unlocker: unlockFactory(...call.args) });
  }
  return { targets, cospends };
}
