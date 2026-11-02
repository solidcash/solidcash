/**
 * The refusal of a call that pays native value below the dust threshold of the output that would carry it.
 *
 * A contract's body computes what it sends: a router refunds what a deposit left over, a wrapper pays out what it
 * unwrapped, a call carries value into a contract. On BCH each such amount is an output, and a node relays no output
 * worth less than its dust threshold (`../composer/dust.ts`), so an amount below it cannot be paid at all. The plan
 * that pays it is the right one, since every participant accepts it, which is why the call is refused here by name
 * rather than at the broadcast: there the builder's refusal reads as a plan that failed, the call is planned again
 * under other assumptions about the calls it makes, and the refusal it reports names a frame that never runs that way.
 */

import { lockingBytecodeToCashAddress } from '@bitauth/libauth/build/lib/address/locking-bytecode.js';
import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { getNetworkPrefix } from '../../utils.js';
import type { NativePaymentBelowDust } from '../composer/dust.js';
import type { CompositionDraft, DraftSourceOutput } from '../composer/index.js';

/** Raised for a call whose accepted plan pays native value into an output below that output's dust threshold. */
export class FramedSendBelowDustError extends Error {
  public readonly name = 'FramedSendBelowDustError';

  /** The stable code the message leads with. */
  public readonly code = 'FRAMED_SEND_BELOW_DUST';

  public constructor(
    /** The frame that sends, as `Contract.entry()`. */
    public readonly frame: string,
    /** Whom it pays: the user's address, or the contract whose container the value goes to. */
    public readonly recipient: string,
    public readonly amount: bigint,
    /** The dust threshold of the output that would carry the amount. */
    public readonly threshold: bigint,
    /** That output's index in the composed transaction. */
    public readonly outputIndex: number,
  ) {
    super(`FRAMED_SEND_BELOW_DUST: ${frame} sends ${amount} satoshi${amount === 1n ? '' : 's'} to ${recipient}, `
      + `below the ${threshold}-satoshi dust threshold of the output that would carry it, which no node relays, so `
      + 'the call is refused');
  }
}

/**
 * The refusal of an accepted plan that pays `short` below its dust threshold, naming the frame that pays it and whom.
 *
 * A send to a user's lock is the frame's whose block lists the output among its sends. Any other output is a
 * contract's container taking the value a call carries into it, so its recipient is the contract `containerOwners`
 * names for the lock, and its sender the frame whose call record carries that value into a frame of the contract; the
 * root frame where no record says.
 */
export function sendBelowDustRefusal(options: {
  readonly draft: CompositionDraft;
  readonly outputs: readonly DraftSourceOutput[];
  readonly short: NativePaymentBelowDust;
  readonly network: string;
  /** The root frame, as `Contract.entry()`. */
  readonly rootFrame: string;
  /** The contract each satoshi-container lock of the call's frames belongs to, by the lock as hex. */
  readonly containerOwners: ReadonlyMap<string, string>;
}): FramedSendBelowDustError {
  const { draft, short } = options;
  const lock = options.outputs[short.index]!.lockingBytecode;
  const runs = draft.runs.map((run) => ({ run, block: draft.blockOf(run.master) }));
  const contractOf = (functionName: string): string => functionName.slice(0, functionName.indexOf('.'));
  const sender = runs.find(({ block }) => block.sends.includes(short.index));
  const owner = sender === undefined ? options.containerOwners.get(binToHex(lock)) : undefined;
  const calleeContract = (inputIndex: number): string | undefined => {
    const placed = draft.layout.participants.find((each) => each.index === inputIndex);
    const callee = runs.find(({ run }) => run.master === placed?.id);
    return callee === undefined ? undefined : contractOf(callee.run.functionName);
  };
  const caller = owner === undefined ? undefined : runs.find(({ block }) => block.calls
    .some((call) => call.value === short.amount && calleeContract(call.calleeRef) === owner));
  const address = lockingBytecodeToCashAddress({ bytecode: lock, prefix: getNetworkPrefix(options.network) });
  const recipient = owner ?? (typeof address === 'string' ? binToHex(lock) : address.address);
  return new FramedSendBelowDustError(
    (sender ?? caller)?.run.functionName ?? options.rootFrame, recipient, short.amount, short.threshold, short.index,
  );
}
