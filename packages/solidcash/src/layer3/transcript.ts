// Layer-3 transcript builder (production SDK derivation). Given the co-spent participants and the transcript
// shape, derive the transaction: canonical ordering, index assignment, blob encoding, participant inputs
// (compiler route unlockers), and owner-preserving recreation outputs. The application adds its effects
// (settlements, records, resource-state transitions) to the returned builder.
import { binToHex, hexToBin, sha256 } from '@bitauth/libauth';
import { hash160 } from '@solidcash/utils';
import type { Utxo } from './../interfaces.js';
import { Contract } from './../Contract.js';
import { TransactionBuilder } from './../TransactionBuilder.js';
import { randomUtxo } from './../utils.js';
import {
  EXEC_DOMAIN, type ExecutionEvent, type ExecutionInvocation, type InvocationSpec, type TranscriptSpec,
  type TypedTransition, opReturnPrefix, transcriptLayout,
} from './covenant.js';
import { encodeTranscriptBlob, participantArgs } from './codec.js';

/** Apply a TypedTransition to a commitment hex: add delta to the width-byte LE field at offset, preserving the rest. */
export function applyTypedTransition(commitmentHex: string, t: TypedTransition): string {
  const bytes = hexToBin(commitmentHex);
  let field = 0n;
  for (let i = 0; i < t.width; i += 1) field += BigInt(bytes[t.offset + i] ?? 0) << BigInt(8 * i);
  field += BigInt(t.delta);
  const out = new Uint8Array(bytes);
  for (let i = 0; i < t.width; i += 1) out[t.offset + i] = Number((field >> BigInt(8 * i)) & 0xffn);
  return binToHex(out);
}

const concatBin = (parts: Uint8Array[]): Uint8Array => {
  const buf = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let c = 0;
  for (const p of parts) { buf.set(p, c); c += p.length; }
  return buf;
};

/** The participant-SET root (membership only): sha256(ordered participant locking bytecodes). */
export function participantSetRoot(orderedLbcs: string[]): string {
  return binToHex(sha256.hash(concatBin(orderedLbcs.map((l) => hexToBin(l)))));
}

/**
 * The canonical EXECUTION root (R2): sha256(domain || participant lbcs || ordered (caller_lbc, callee_lbc,
 * selector) edges). The deployer sets the controller commitment to this so the controller attests the call
 * graph, matching what every participant recomputes on-chain.
 */
export function executionRoot(
  orderedLbcs: string[], invocations: ExecutionInvocation[], events: ExecutionEvent[] = [],
): string {
  const parts: Uint8Array[] = [hexToBin(EXEC_DOMAIN), ...orderedLbcs.map((l) => hexToBin(l))];
  for (const inv of invocations) {
    parts.push(hexToBin(orderedLbcs[inv.caller]), hexToBin(orderedLbcs[inv.callee]), hexToBin(inv.selectorHex));
  }
  for (const ev of events) parts.push(hexToBin(orderedLbcs[ev.emitter]), hexToBin(ev.topicHex));
  return binToHex(sha256.hash(concatBin(parts)));
}

export interface TranscriptParticipant {
  /** The participant contract (branded with the controller salt and sharing the transcript artifact). */
  contract: Contract;
  /** The participant's co-spent master (minting) UTXO. */
  master: Utxo;
  /** The participant's token category id (display-order hex). */
  categoryId: string;
}

export interface DeriveTranscriptOptions {
  provider: any;
  /** The compiler hidden-batch route and selector from the compiled transcript artifact. */
  route: any;
  sel: Uint8Array;
  /** The `__layer3_bind` handler's SCB1 row selector (artifact.hiddenBatch.handlers[i].selector). */
  handlerSelector: string;
  /** Co-spent participants, in ANY order - they are sorted canonically here. */
  participants: TranscriptParticipant[];
}

export interface DeriveTranscriptResult {
  builder: TransactionBuilder;
  /** Participants in canonical order; index i is at input i and output i. */
  ordered: TranscriptParticipant[];
  blob: Uint8Array;
}

/** Canonical participant order: ascending big-endian locking bytecode (matches the covenant's byte-lex check). */
export function sortParticipants(participants: TranscriptParticipant[]): TranscriptParticipant[] {
  return [...participants].sort(
    (x, y) => (BigInt(`0x${x.contract.lockingBytecode}`) < BigInt(`0x${y.contract.lockingBytecode}`) ? -1 : 1),
  );
}

/** The M4 intent commitment a caller's master must carry to authorize a callee: hash160(callee lockingBytecode). */
export function intentCommitment(calleeLockingBytecode: string): string {
  return binToHex(hash160(hexToBin(calleeLockingBytecode)));
}

/**
 * The M4 master-commitment each participant must carry, in canonical order: a caller commits to
 * hash160(its callee lockingBytecode); a non-caller stays uncommitted (''). Pure and provider-agnostic - a
 * real-network app mints each participant's master (genesis) with `commitments[i]`; the mock helper
 * `authorizeParticipants` uses it directly. Index i corresponds to the canonical order (input i / output i).
 */
export function deriveIntentCommitments(participants: TranscriptParticipant[], spec: TranscriptSpec): string[] {
  const ordered = sortParticipants(participants);
  const commitments = ordered.map(() => '');
  for (const inv of spec.invocations ?? []) {
    commitments[inv.caller] = intentCommitment(ordered[inv.callee].contract.lockingBytecode);
  }
  return commitments;
}

/**
 * Mock/local-dev helper: mint each participant's master with its M4 intent authorization (from
 * deriveIntentCommitments) via the provider's addUtxo. Mutates each participant's `master` to the authorized
 * UTXO and returns the participants. Call after instantiation, before buildTranscriptTransaction. On a real
 * network the app instead mints each master (genesis) with the corresponding deriveIntentCommitments entry.
 */
export async function authorizeParticipants(
  provider: any, participants: TranscriptParticipant[], spec: TranscriptSpec,
): Promise<TranscriptParticipant[]> {
  const ordered = sortParticipants(participants);
  const commitments = deriveIntentCommitments(participants, spec);
  for (let i = 0; i < ordered.length; i += 1) {
    const p = ordered[i];
    const master = randomUtxo({
      satoshis: p.master.satoshis,
      token: { category: p.categoryId, amount: 0n, nft: { capability: 'minting', commitment: commitments[i] } },
    });
    await provider.addUtxo(p.contract.tokenAddress, master);
    p.master = master;
  }
  return participants;
}

/**
 * Derive the transcript transaction's binding half: sorted participant inputs + owner-preserving recreation
 * outputs, unlocked by the shared transcript blob. The caller adds the fee input and application effects
 * (msg.sender OP_RETURNs, resource state NFTs, settlements) matching the spec the covenant was generated for.
 */
export function deriveTranscriptTransaction(opts: DeriveTranscriptOptions): DeriveTranscriptResult {
  const ordered = sortParticipants(opts.participants);
  const blob = encodeTranscriptBlob(opts.handlerSelector, participantArgs(ordered.length));

  const builder = new TransactionBuilder({ provider: opts.provider });
  for (const p of ordered) {
    builder.addInput(p.master, p.contract.createCompilerRouteUnlocker(opts.route, opts.sel)(blob));
  }
  for (const p of ordered) {
    builder.addOutput({
      to: p.contract.tokenAddress,
      amount: p.master.satoshis,
      // Preserve the master's actual commitment (the caller's M4 intent authorization rides here).
      token: {
        category: p.categoryId, amount: 0n,
        nft: { capability: 'minting', commitment: p.master.token?.nft?.commitment ?? '' },
      },
    });
  }
  return { builder, ordered, blob };
}

/**
 * Append the msg.sender records the invocations bind: for each invocation an OP_RETURN
 * `6a23 <caller lockingBytecode>` output. Call after deriveTranscriptTransaction so the outputs land at the
 * indices the covenant expects (the invocations' `senderOutput` must match this order, i.e. participant
 * count + invocation index). Returns the output index of the first record added.
 */
export function appendInvocationRecords(
  builder: TransactionBuilder, ordered: TranscriptParticipant[], invocations: InvocationSpec[],
): void {
  for (const inv of invocations) {
    const sender = hexToBin(ordered[inv.caller].contract.lockingBytecode);
    const opReturn = new Uint8Array(2 + sender.length);
    opReturn.set([0x6a, 0x23], 0);
    opReturn.set(sender, 2);
    builder.addOutput({ to: opReturn, amount: 0n });
  }
}

/** A co-spent resource state NFT instance (owner-branded), with its guard unlocker and post-state commitment. */
export interface ResourceInstance {
  /** The state NFT input UTXO (its category must be the owner participant's category). */
  utxo: Utxo;
  /** The guard unlocker for the state NFT (P2PKH signer, or a data-NFT write unlocker). */
  unlocker: any;
  /** The token address to recreate the state NFT at (its own address - the covenant preserves it). */
  address: string;
  /** The application-computed post-transition commitment (hex). */
  outputCommitment: string;
}

export interface BuildTranscriptOptions extends DeriveTranscriptOptions {
  /** The spec the covenant was generated from (drives the layout). */
  spec: TranscriptSpec;
  /** Resource state NFTs in resource-spec order. */
  resources?: ResourceInstance[];
  /** Settlement values in effect-spec order (recipient is the effect's consumer participant). */
  effects?: bigint[];
  /** Fee input. */
  fee: { utxo: Utxo; unlocker: any };
  /** Optional change output (added last). */
  change?: { address: string; satoshis: bigint };
}

/**
 * Build the COMPLETE transcript transaction from a spec: participant + resource inputs, fee, participant
 * recreations, invocation msg.sender records, resource state transitions, and effect settlements - in the
 * canonical layout the covenant was generated for. The application supplies only per-instance data
 * (resource guards + post-state commitments, settlement values); the module assembles the transaction.
 */
export function buildTranscriptTransaction(opts: BuildTranscriptOptions): DeriveTranscriptResult {
  const layout = transcriptLayout(opts.spec);
  const resources = opts.resources ?? [];
  const effects = opts.effects ?? [];
  if (resources.length !== layout.resources) throw new Error('layer3: resource instance count mismatch');
  if (effects.length !== layout.effects) throw new Error('layer3: effect value count mismatch');

  const { builder, ordered, blob } = deriveTranscriptTransaction(opts); // participant inputs + recreations
  for (const r of resources) builder.addInput(r.utxo, r.unlocker); // resource state inputs
  builder.addInput(opts.fee.utxo, opts.fee.unlocker); // fee input

  appendInvocationRecords(builder, ordered, opts.spec.invocations ?? []); // sender records
  resources.forEach((r, k) => { // resource state: preserved by default, transitioned only if opted in
    const resSpec = opts.spec.resources![k];
    const ownerCat = ordered[resSpec.owner].categoryId;
    const inCommit = r.utxo.token?.nft?.commitment ?? '';
    // Fail-closed: a non-transition resource recreates with its INPUT commitment; a TypedTransition is
    // computed by the module (R6); only a raw `transition: true` uses the app-supplied post-state commitment.
    let commitment: string;
    if (!resSpec.transition) commitment = inCommit;
    else if (typeof resSpec.transition === 'object') commitment = applyTypedTransition(inCommit, resSpec.transition);
    else commitment = r.outputCommitment;
    builder.addOutput({
      to: r.address, amount: r.utxo.satoshis,
      token: { category: ownerCat, amount: 0n, nft: { capability: 'mutable', commitment } },
    });
  });
  effects.forEach((value, m) => { // effect settlements, recipient = consumer participant
    builder.addOutput({ to: ordered[opts.spec.effects![m].consumer].contract.address, amount: value });
  });
  (opts.spec.events ?? []).forEach((ev) => { // authenticated event logs, provenance = emitter participant
    const emitter = hexToBin(ordered[ev.emitter].contract.lockingBytecode);
    const topic = hexToBin(ev.topicHex);
    const prefix = hexToBin(opReturnPrefix(emitter.length + topic.length));
    const opReturn = new Uint8Array(prefix.length + emitter.length + topic.length);
    opReturn.set(prefix, 0);
    opReturn.set(emitter, prefix.length);
    opReturn.set(topic, prefix.length + emitter.length);
    builder.addOutput({ to: opReturn, amount: 0n });
  });
  if (opts.change) builder.addOutput({ to: opts.change.address, amount: opts.change.satoshis });
  return { builder, ordered, blob };
}
