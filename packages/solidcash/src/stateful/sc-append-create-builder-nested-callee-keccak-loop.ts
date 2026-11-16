/**
 * phase-boundary extract: SC _createBuilder extract — the shared side-cars a direct callee's keccak256 loop reads.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { keccakComputeLockingBytecode, type AbiFunction } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { Output, UnlockableUtxo, Unlocker, Utxo } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { defaultInternalFunctionArg } from './kernel-journal-helpers.js';
import type { KeccakLoopTrailingSuccessors } from './sc-resolve-stateful-keccak-loop.js';

/** The callee contract, as its own loop resolver probes it. */
export interface NestedCalleeKeccakLoopContract {
  readonly inner: {
    readonly provider: NetworkProvider;
    readonly artifact: { readonly contractName: string };
    createAbiUnlocker(abiFunction: AbiFunction): (...args: FunctionArgument[]) => Unlocker;
  };
  _resolveStatefulKeccakLoop(
    abiFunction: AbiFunction, masterUtxo: Utxo, stateInputUnlocker: Unlocker,
    dataNftUtxos: Utxo[], dataNftUnlockers: Unlocker[],
    frontRegionInputs: UnlockableUtxo[], locktime: number,
    trailingPredecessors: { inputs: UnlockableUtxo[]; outputs: Output[] },
    sharedSidecarPool: NetworkProvider,
    trailingSuccessors?: KeccakLoopTrailingSuccessors,
  ): Promise<{ sideCars: UnlockableUtxo[]; recreates: Output[] }>;
}

/** Block slots that hold no state input: the probe stands a plain coin in for each. */
const OUTPUT_ONLY_SLOT_KINDS: ReadonlySet<string> = new Set([
  'returnEvent', 'event', 'eventChunk', 'transfer', 'tcTransfer',
]);

/** The witness naming the first chunk of dynamic state a function reads, as an absolute input index. */
const DYNAMIC_READ_BASE = '__internal__dynamicChunkInputBase';

// Why a run beside the loop is refused. The loop reads side-car k at master + blockSize + k and recreates it at that
// index. A walk, and the new chunks a write makes, sit at fixed indexes from the same base, and the compiler counts
// neither past the side-cars. The chunks a function only reads are found through DYNAMIC_READ_BASE, so they follow.
const OVERLAPS_INPUTS = ', which its covenant reads from the inputs after its block, where the loop reads its '
  + 'side-cars';
const OVERLAPS_OUTPUTS = ', which its covenant checks at the outputs after its block, where the loop recreates its '
  + 'side-cars';
const NOT_LAID_OUT = ', and the SDK lays out a callee\'s loop side-cars beside no run but the chunks of dynamic state '
  + 'it only reads';

/**
 * What else a function can read or write after its block, each by the ABI field that publishes it, and why it is not
 * laid out beside the loop. The chunks of dynamic state the function only reads are laid out after the side-cars.
 */
export const TRAILING_BAND_USERS: ReadonlyArray<readonly [keyof AbiFunction, string, string]> = [
  ['collectionIterations', 'a collection walk', OVERLAPS_INPUTS],
  ['dynamicWrites', 'the chunks of dynamic state it writes', OVERLAPS_OUTPUTS],
  ['entryLoopWrites', 'the entries a loop writes', NOT_LAID_OUT],
  ['sortedInsertLoops', 'the entries a loop inserts', NOT_LAID_OUT],
  ['sortedInsertLoopInfo', 'the entries a loop inserts', NOT_LAID_OUT],
  ['sortedUpsertLoopInfo', 'the entries a loop writes', NOT_LAID_OUT],
  ['runtimeLoopTransfers', 'the payments of a loop', NOT_LAID_OUT],
  ['runtimeLoopEvents', 'the events of a loop', NOT_LAID_OUT],
  ['keccakChainReads', 'a keccak256 chain', NOT_LAID_OUT],
  ['ecrecoverTrailingLoop', 'a recovery loop', NOT_LAID_OUT],
  ['ecrecoverLoopReads', 'a recovery loop', NOT_LAID_OUT],
  ['externalCalls', 'the blocks of the contracts it calls', NOT_LAID_OUT],
  ['lowLevelCalls', 'the blocks of the contracts it calls', NOT_LAID_OUT],
];

/** The first run of TRAILING_BAND_USERS that `fn` publishes, if any. */
export function keccakLoopBandSharer(fn: AbiFunction): (typeof TRAILING_BAND_USERS)[number] | undefined {
  return TRAILING_BAND_USERS.find(([field]) => {
    const value = fn[field];
    return Array.isArray(value) ? value.length > 0 : value === true;
  });
}

/**
 * The runs after the block that a direct call's keccak256 loop is laid out beside when it runs first: the compiler's
 * shared cursors start a mapping loop, per-turn payments and events past the loop's side-cars, and past the chunks of
 * dynamic state the function only reads, which they count too.
 */
const COUNTED_AFTER_LOOP: ReadonlySet<keyof AbiFunction> = new Set<keyof AbiFunction>([
  'entryLoopWrites', 'sortedInsertLoops', 'sortedInsertLoopInfo', 'sortedUpsertLoopInfo',
  'runtimeLoopTransfers', 'runtimeLoopEvents',
]);

/**
 * Whether a direct call of `fn` lays out the chunks of dynamic state it only reads right after the keccak256 side-cars
 * that open the band after its block. The function finds the chunks through DYNAMIC_READ_BASE, so they can follow the
 * side-cars; the side-cars cannot move. A keccak256 chain reads its FINAL side-car at master + blockSize + n/136 for an
 * n-byte value, after one side-car per full 136-byte block, and nothing else may use the band. A keccak256 loop reads
 * side-car k at master + blockSize + k when no mapping loop runs before it (`keccakLoopPrecedesTrailingUser`); a mapping
 * loop, per-turn payments or events then follow the side-cars and the chunks (COUNTED_AFTER_LOOP). A fixed sorted batch
 * rewrites its predecessors at the band's start and is laid out beside neither, nor is anything else of
 * TRAILING_BAND_USERS. A callee's loop lays out its read chunks the same way, in its own block, beside nothing else
 * (appendCreateBuilderNestedCalleeKeccakLoop).
 */
export function readChunksFollowKeccakSideCars(fn: AbiFunction): boolean {
  if ((fn.dynamicReads?.length ?? 0) === 0 || !fn.inputs.some((parameter) => parameter.name === DYNAMIC_READ_BASE)
    || (fn.sortedBatchInfo?.length ?? 0) > 0) {
    return false;
  }
  const publishes = (field: keyof AbiFunction): boolean => {
    const value = fn[field];
    return Array.isArray(value) ? value.length > 0 : value === true;
  };
  if (fn.keccakChainReads === true) {
    return TRAILING_BAND_USERS.every(([field]) => field === 'keccakChainReads' || !publishes(field));
  }
  return fn.keccakLoopReads === true && TRAILING_BAND_USERS.every(([field]) => !publishes(field)
    || (COUNTED_AFTER_LOOP.has(field) && fn.keccakLoopPrecedesTrailingUser === true));
}

/**
 * The chunks of dynamic state a function only reads, as the run its loop's probe lays out after the side-cars: each is
 * recreated at its own index, as its read-only covenant keeps it, and `unlockerAt` names the first chunk's input.
 */
export function keccakLoopReadSuccessors(
  reads: readonly UnlockableUtxo[], unlockerAt: (firstInputIndex: number) => Unlocker,
): KeccakLoopTrailingSuccessors {
  return {
    inputs: [...reads],
    outputs: reads.map((chunk) => ({
      to: chunk.unlocker.generateLockingBytecode(), amount: chunk.satoshis, ...(chunk.token && { token: chunk.token }),
    })),
    unlockerAt,
  };
}

const coinKey = (utxo: Pick<Utxo, 'txid' | 'vout'>): string => `${utxo.txid.toLowerCase()}:${utxo.vout}`;

/**
 * `provider` as a build lists a shared side-car pool (salt 0) through it: a coin of `spent`, which the transaction already
 * spends, is not offered again, and no coin is minted on demand, as a fixed side-car of a callee is never minted either.
 */
export function sharedSidecarPoolWithout(
  provider: NetworkProvider, spent: Iterable<Pick<Utxo, 'txid' | 'vout'>>,
): NetworkProvider {
  const taken = new Set([...spent].map(coinKey));
  return new Proxy(provider, {
    get(target, property, receiver): unknown {
      if (property === 'addUtxo') return undefined;
      if (property === 'getUtxosForLockingBytecode') {
        return async (lock: Uint8Array): Promise<Utxo[]> => (await target.getUtxosForLockingBytecode(lock))
          .filter((utxo) => !taken.has(coinKey(utxo)));
      }
      return Reflect.get(target, property, receiver);
    },
  });
}

/**
 * Append the side-cars a direct callee's keccak256 loop reads to its block: one per iteration, read at the callee's
 * master + its trailing base + the counter and recreated at its own index with the digest.
 *
 * A side-car under the callee's brand is spendable only beside input 0 of the callee's category, which a callee's
 * master never is, so the loop takes coins of the shared pool (salt 0), as a fixed side-car of a callee does. The
 * callee binds each side-car by its covenant bytes and the preimage it reads from the side-car's input, and reads the
 * digest from the recreation the side-car's own covenant computes; the salt only limits who may spend the coin.
 *
 * The loop's iteration count and preimages come from the callee's own loop probe, which runs its function with its
 * master at input 0, its records after it, and a plain coin for each output-only slot before the side-cars. A block
 * that holds anything else before the side-cars, or that is not as wide as the base the callee reads from, is refused
 * before anything is built.
 *
 * The chunks of dynamic state the function only reads (`trailingReads`) follow the side-cars: the callee reads them
 * from the input its `__internal__dynamicChunkInputBase` names, which the build sets to the first chunk's index, and
 * the probe lays them out past its own side-cars with that witness, so a read made before the loop reaches it. Every
 * other run after the block is refused by name (TRAILING_BAND_USERS).
 */
export async function appendCreateBuilderNestedCalleeKeccakLoop(input: {
  bBlockInputs: UnlockableUtxo[];
  bAbiFunc: AbiFunction;
  bSc: NestedCalleeKeccakLoopContract;
  masterUtxo: Utxo;
  bDataNfts: UnlockableUtxo[];
  /** The call's visible arguments. */
  args: FunctionArgument[];
  /** Coins this build already spends: the loop takes none of them. */
  spent: Iterable<Pick<Utxo, 'txid' | 'vout'>>;
  /** The view a build lists the shared pool through, when it has one (a creation's); the callee's provider else. */
  sharedPool?: NetworkProvider;
  /** The read-only chunks the build places right after the side-cars, in the order the callee reads them. */
  trailingReads?: readonly UnlockableUtxo[];
  functionLabel: string;
}): Promise<{ bBlockInputs: UnlockableUtxo[]; start: number; recreates: Output[] }> {
  const { bAbiFunc, bSc, masterUtxo, bDataNfts, args, spent, functionLabel } = input;
  const trailingReads = input.trailingReads ?? [];
  const refuse = (what: string): never => {
    throw new Error(`The call of ${functionLabel} cannot be laid out: ${what}`);
  };
  const sharer = keccakLoopBandSharer(bAbiFunc);
  if (sharer !== undefined) {
    refuse(`its keccak256 loop shares the inputs after its block with ${sharer[1]}${sharer[2]}`);
  }
  if (trailingReads.length > 0 && !bAbiFunc.inputs.some((parameter) => parameter.name === DYNAMIC_READ_BASE)) {
    refuse(`its keccak256 loop shares the inputs after its block with the chunks of dynamic state it reads${
      OVERLAPS_INPUTS}, as it takes no ${DYNAMIC_READ_BASE} witness to find them past the side-cars`);
  }
  const layout = bAbiFunc.blockLayout;
  const start = layout?.trailingBase ?? layout?.blockSize ?? 1;
  if (input.bBlockInputs.length !== start) {
    refuse(`its keccak256 loop reads its side-cars ${start} inputs past its master, and its block holds `
      + `${input.bBlockInputs.length}`);
  }
  const frontSlots = (layout?.slots ?? []).filter((slot) => slot.offset >= 1 + bDataNfts.length && slot.offset < start);
  const other = frontSlots.find((slot) => !OUTPUT_ONLY_SLOT_KINDS.has(slot.kind));
  if (other !== undefined) {
    refuse(`its keccak256 loop follows its ${other.kind} slot, which the loop's probe cannot stand a coin in for`);
  }
  if (layout?.slots.some((slot) => slot.kind === 'dataNft' && slot.offset > bDataNfts.length) === true) {
    refuse('its records do not follow its master, where the loop\'s probe places them');
  }
  // The frame the probe runs: the call's arguments, the record at its slot of a block whose master is input 0, the
  // first read chunk where the probe places it, and every other witness at its default. The loop reads only its
  // arguments and the side-cars.
  const visible = bAbiFunc.inputs.filter((parameter) => !parameter.name.startsWith('__internal__'));
  if (visible.length !== args.length) refuse('its arguments do not match its function');
  const recordOffset = layout?.slots.find((slot) => slot.kind === 'returnEvent')?.offset;
  const unlockerAt = (firstRead: number | undefined): Unlocker => {
    let visibleIndex = 0;
    const frame = bAbiFunc.inputs.map((parameter): FunctionArgument => {
      if (!parameter.name.startsWith('__internal__')) return args[visibleIndex++]!;
      if (parameter.name === '__internal__returnOutputIdx') return BigInt(recordOffset ?? -1);
      if (parameter.name === DYNAMIC_READ_BASE && firstRead !== undefined) return BigInt(firstRead);
      return defaultInternalFunctionArg(parameter);
    });
    return bSc.inner.createAbiUnlocker(bAbiFunc)(...frame);
  };
  const unlocker = unlockerAt(undefined);
  const successors = trailingReads.length === 0 ? undefined : keccakLoopReadSuccessors(trailingReads, unlockerAt);
  const plainCoin = (index: number): UnlockableUtxo => ({
    txid: `${'00'.repeat(28)}${(index + 1).toString(16).padStart(8, '0')}`,
    vout: 0,
    satoshis: 1000n,
    unlocker: {
      generateLockingBytecode: () => Uint8Array.of(0x51),
      generateUnlockingBytecode: () => new Uint8Array(),
    },
  });
  const pool = sharedSidecarPoolWithout(input.sharedPool ?? bSc.inner.provider, spent);
  // The probe adds each coin with the unlocker it is given, so the coins go in bare.
  const bare = ({ txid, vout, satoshis, token }: Utxo): Utxo => ({ txid, vout, satoshis, ...(token && { token }) });
  let loop: { sideCars: UnlockableUtxo[]; recreates: Output[] };
  try {
    loop = await bSc._resolveStatefulKeccakLoop(
      bAbiFunc, bare(masterUtxo), unlocker, bDataNfts.map(bare), bDataNfts.map((utxo) => utxo.unlocker),
      frontSlots.map((_, index) => plainCoin(index)), 0, { inputs: [], outputs: [] }, pool, successors,
    );
  } catch (error) {
    const message = (error as Error).message;
    const short = message.match(/needs >= (\d+) compute side-car UTXOs at the branded address; found (\d+)/);
    if (short !== null) {
      const lock = binToHex(keccakComputeLockingBytecode(new Uint8Array(32), true));
      refuse(`its keccak256 loop needs ${short[1]} side-car coins of the shared pool (salt 0, lock ${lock}), and `
        + `the pool holds ${short[2]} this transaction does not already spend`);
    }
    throw error;
  }
  return { bBlockInputs: [...input.bBlockInputs, ...loop.sideCars], start, recreates: loop.recreates };
}
