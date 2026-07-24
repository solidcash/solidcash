// Layer-3 transcript builder (production SDK derivation). Given the co-spent participants and the transcript
// shape, derive the transaction: canonical ordering, index assignment, blob encoding, participant inputs
// (compiler route unlockers), and owner-preserving recreation outputs. The application adds its effects
// (settlements, records, resource-state transitions) to the returned builder.
import { hexToBin } from '@bitauth/libauth';
import type { Utxo } from './../interfaces.js';
import { Contract } from './../Contract.js';
import { TransactionBuilder } from './../TransactionBuilder.js';
import type { InvocationSpec } from './covenant.js';
import { encodeTranscriptBlob, participantArgs } from './codec.js';

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
      token: { category: p.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
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
