/**
 * Native value through a proxy hop (spec 4b, V5, V7).
 *
 * A delegate frame passes its caller's value through and pays from its caller's containers, as the EVM's
 * `delegatecall` keeps `msg.value` and spends the proxy's balance. So the call's value is the proxy's root frame's,
 * paid by the caller into a satoshi container of the proxy, and the implementation's frame carries the same value
 * as its `msg.value`, which the validator binds to the root's (V5). The implementation's sends follow a container of
 * the proxy, in a run, and are paid from the proxy's containers: each send's lock and amount are learned from the
 * body's own pin, as the plain call path learns them (`call/call.ts`), the containers cover what the call does not
 * bring, and the one before the sends keeps the change. The validator weighs the proxy's frames together (V7): its
 * containers grow by at least what the root frame brings less what the frames pay. A send the containers cannot
 * cover is refused by name, as the EVM reverts it, and so is a send to a contract, whose call into the recipient's
 * `receive()` the hop does not plan yet.
 */

import {
  bigIntToVmNumber, binToHex, encodeLockingBytecodeP2pkh, utf8ToBin, vmNumberToBigInt,
} from '@bitauth/libauth';
import { bytesEqual, sha256, type Artifact, type StateValue } from '@solidcash/utils';
import type { FunctionArgument } from '../../Argument.js';
import type { Utxo } from '../../interfaces.js';
import type NetworkProvider from '../../network/NetworkProvider.js';
import type { DraftInput, DraftSourceOutput } from '../composer/index.js';
import type { ReadDeclaration } from '../deploy/declaration.js';
import {
  readSatoshiContainers, satoshiContainerLockingBytecode, satoshiContainerUnlockingBytecode,
} from '../deploy/records.js';
import { sendRecipient } from '../call/send-recipient.js';
import { FramedProxyDeployError } from './errors.js';

/** The least the container before the sends keeps; the caller tops it up past the change. */
const CONTAINER_MINIMUM_SATOSHIS = 1_000n;

/** The amount a send output carries until the body's own pin hands back the one it computed. */
const SEND_AMOUNT_SENTINEL = 1_234_567_891n;

/** One send the implementation's frame lists: its lock and amount, each once the body's own pin handed it back. */
export interface HopSend {
  readonly lock?: Uint8Array;
  readonly amount?: bigint;
}

/** The value a hop carries in, and the sends its implementation frame pays out of the proxy's containers. */
export interface HopValue {
  /** The call's value: the proxy's root frame's, and the implementation frame's `msg.value`. */
  readonly value: bigint;
  /** The proxy's category, as hex: its containers hold the balance the implementation's frame pays from. */
  readonly categoryId: string;
  /** The implementation and the entry, which name the refusals and the sentinels. */
  readonly contract: string;
  readonly functionName: string;
  /** How many sends the frame lists at first: every one the entry can make. */
  readonly sendCount: number;
  /** The sends no branch decides, which every run makes. */
  readonly unconditionalSends: number;
  /** The proxy's live containers the sends are paid from. */
  readonly containers: readonly Utxo[];
  /** True for an entry that reads its balance: it spends every container, which makes the read the whole balance. */
  readonly readsBalance: boolean;
}

/** The containers a hop spends to pay its sends, and what the container before them keeps. */
export interface HopPaying {
  readonly spent: readonly Utxo[];
  readonly kept: bigint;
}

/**
 * The value an entry's hop carries and the sends it pays, or undefined for a hop with neither.
 *
 * Refuses by name a value for an entry that is not payable, as the EVM's call-value check does, and a send whose
 * published recipient is a contract. `loopSends` is how many sends the entry's loops make (`entryLoopTurns`), which
 * replaces the published sends' count for a body that sends from a loop.
 */
export async function planHopValue(options: {
  readonly provider: NetworkProvider;
  readonly artifact: Artifact;
  readonly functionName: string;
  readonly args: readonly FunctionArgument[];
  readonly value: bigint;
  readonly loopSends: number | undefined;
  /** The proxy's category, as hex, whose containers pay the sends. */
  readonly categoryId: string;
  /** The caller's lock: the delegate frame's `msg.sender`, which its caller's frame passes through. */
  readonly callerLockingBytecode: Uint8Array;
  /** The proxy's record values, which a recipient read from state names. */
  readonly state: Readonly<Record<string, StateValue>>;
}): Promise<HopValue | undefined> {
  const { artifact, functionName, value } = options;
  const entry = artifact.abi.find((candidate) => candidate.name === functionName);
  const label = `the implementation's "${functionName}" entry`;
  if (entry === undefined) {
    throw new FramedProxyDeployError(`implementation "${artifact.contractName}" publishes no entry "${functionName}"`);
  }
  if (value < 0n) throw new FramedProxyDeployError(`a call carries no negative value; got ${value}`);
  if (value > 0n && !(entry.modifiers ?? []).includes('payable')) {
    throw new FramedProxyDeployError(`${label} is not payable, so a call to it carries no value`);
  }
  const transfers = entry.transfers ?? [];
  // The body chooses by the lock: a user's is a listed send, and any other is a call into the recipient's
  // `receive()`, which the hop does not place. A recipient only the running code holds is taken to be a user's.
  if (options.loopSends === undefined) {
    const context = {
      args: options.args, inputs: entry.inputs, structs: artifact.stateLayout?.structs ?? artifact.structs,
      callerLock: options.callerLockingBytecode, state: [options.state as Record<string, StateValue>],
    };
    for (const transfer of transfers) {
      const lock = sendRecipient(transfer.recipientRecipe, context);
      if (lock !== undefined && lock.length !== 25) {
        throw new FramedProxyDeployError(
          `${label} sends to the contract at ${binToHex(lock)}, which a call through a proxy does not pay yet`,
        );
      }
    }
  }
  const sendCount = options.loopSends ?? transfers.length;
  const readsBalance = (
    (artifact.composition as { balanceReaders?: readonly string[] } | undefined)?.balanceReaders ?? []
  ).includes(`${artifact.contractName}.${functionName}()`);
  if (value === 0n && sendCount === 0 && !readsBalance) return undefined;
  return {
    value,
    categoryId: options.categoryId,
    contract: artifact.contractName,
    functionName,
    sendCount,
    // A loop's sends are made on every turn it runs; a published send on a branch is made only when it runs.
    unconditionalSends: options.loopSends ?? transfers.filter((transfer) => transfer.condition === undefined).length,
    containers: sendCount > 0 || readsBalance ? await readSatoshiContainers(options.provider, options.categoryId) : [],
    readsBalance,
  };
}

/** Every send the frame lists at first, none of them learned. */
export function unlearnedHopSends(hop: HopValue | undefined): readonly HopSend[] {
  return Array.from({ length: hop?.sendCount ?? 0 }, (): HopSend => ({}));
}

/** The lock a send output carries until the body's own pin hands back the lock it computed. */
export function hopSendLockSentinel(hop: HopValue, position: number): Uint8Array {
  return encodeLockingBytecodeP2pkh(sha256(utf8ToBin(
    `framed hop send lock\u0000${hop.contract}\u0000${hop.functionName}\u0000${position}`,
  )).slice(0, 20));
}

/** The amount a send output carries until the body's own pin hands back the amount it computed. */
function hopSendAmountSentinel(position: number): bigint {
  return SEND_AMOUNT_SENTINEL + BigInt(position);
}

/**
 * The sends with the lock or the amount a failing pin handed back, or undefined when the close names no send.
 *
 * A send's lock is compared with the output's on top, and its amount with the output's value on top, so the
 * declaration is the sentinel the plan wrote and the value below it is what the body computed.
 */
export function learnHopSend(
  hop: HopValue, sends: readonly HopSend[], reading: ReadDeclaration,
): readonly HopSend[] | undefined {
  const lockAt = sends.findIndex((_send, position) => bytesEqual(reading.declared, hopSendLockSentinel(hop, position)));
  if (lockAt >= 0) {
    return sends.map((send, position) => (position === lockAt ? { ...send, lock: Uint8Array.from(reading.computed) }
      : send));
  }
  const amountAt = sends.findIndex((_send, position) =>
    bytesEqual(reading.declared, bigIntToVmNumber(hopSendAmountSentinel(position))));
  const amount = vmNumberToBigInt(reading.computed);
  if (amountAt < 0 || typeof amount !== 'bigint') return undefined;
  return sends.map((send, position) => (position === amountAt ? { ...send, amount } : send));
}

/**
 * The sends a run that stopped short of the plan's count made, or undefined when it did not stop that way.
 *
 * A run that made fewer sends than the plan lists stops at its count, having pinned the ones it made in order: the
 * listed sends past them are on branches it did not take, so the plan drops them. Each drop shrinks the plan.
 */
export function madeHopSends(hop: HopValue, sends: readonly HopSend[]): readonly HopSend[] | undefined {
  const made = sends.findIndex((send) => send.lock === undefined || send.amount === undefined);
  if (made < 0 || made < hop.unconditionalSends) return undefined;
  if (!sends.slice(made).every((send) => send.lock === undefined && send.amount === undefined)) return undefined;
  return sends.slice(0, made);
}

/**
 * The containers the sends are paid from once every amount is known, and what the container before them keeps:
 * the change of the containers spent, or the call's value on its own. Refuses by name a send the proxy's containers
 * cannot cover, as the EVM reverts it.
 */
export function hopPaying(hop: HopValue, sends: readonly HopSend[], proxyName: string): HopPaying {
  const atLeastMinimum = (kept: bigint): bigint => (kept > CONTAINER_MINIMUM_SATOSHIS ? kept : CONTAINER_MINIMUM_SATOSHIS);
  const settle = (kept: bigint): bigint => (sends.length > 0 || kept > 0n ? atLeastMinimum(kept) : 0n);
  const every = hop.readsBalance ? hop.containers : [];
  const everyTotal = every.reduce<bigint>((sum, utxo) => sum + utxo.satoshis, 0n);
  if (sends.some((send) => send.amount === undefined)) return { spent: every, kept: settle(everyTotal + hop.value) };
  const need = sends.reduce<bigint>((sum, send) => sum + send.amount!, 0n) - hop.value;
  const refuse = (total: bigint): never => {
    throw new FramedProxyDeployError(
      `proxy "${proxyName}" holds ${total} satoshis in its containers, and the implementation's "${hop.functionName}" `
      + `entry sends ${need} more than the call brings`,
    );
  };
  if (hop.readsBalance) {
    if (everyTotal < need) refuse(everyTotal);
    return { spent: every, kept: settle(everyTotal - need) };
  }
  if (need <= 0n) return { spent: [], kept: settle(-need) };
  const spent: Utxo[] = [];
  let total = 0n;
  for (const utxo of [...hop.containers].sort((left, right) => (left.satoshis > right.satoshis ? -1 : 1))) {
    if (total >= need) break;
    spent.push(utxo);
    total += utxo.satoshis;
  }
  if (total < need) refuse(total);
  return { spent, kept: settle(total - need) };
}

/**
 * The outputs a hop's value takes: the run the implementation's sends make, a container of the proxy and then one
 * output per send, and the container the call's value is paid into when no send follows it.
 */
export function hopValueOutputs(
  hop: HopValue, sends: readonly HopSend[], paying: HopPaying,
): { readonly run: readonly DraftSourceOutput[]; readonly kept: readonly DraftSourceOutput[] } {
  const container: DraftSourceOutput[] = paying.kept > 0n
    ? [{ lockingBytecode: satoshiContainerLockingBytecode(hop.categoryId), valueSatoshis: paying.kept }]
    : [];
  if (sends.length === 0) return { run: [], kept: container };
  return {
    run: [...container, ...sends.map((send, position): DraftSourceOutput => ({
      lockingBytecode: send.lock ?? hopSendLockSentinel(hop, position),
      valueSatoshis: send.amount ?? hopSendAmountSentinel(position),
    }))],
    kept: [],
  };
}

/** The identity of the `position`-th container of the proxy a hop spends. */
export function hopContainerId(position: number): string {
  return `proxy-container-${position}`;
}

/** The proxy's containers a hop spends, each opened by the proxy's master at `masterIndex` and consumed. */
export function hopContainerInputs(
  hop: HopValue, spent: readonly Utxo[], masterIndex: number,
): Record<string, DraftInput> {
  return Object.fromEntries(spent.map((utxo, position) => [hopContainerId(position), {
    source: { lockingBytecode: satoshiContainerLockingBytecode(hop.categoryId), valueSatoshis: utxo.satoshis },
    unlockingBytecode: satoshiContainerUnlockingBytecode(hop.categoryId, masterIndex),
    consumed: true,
  }]));
}
