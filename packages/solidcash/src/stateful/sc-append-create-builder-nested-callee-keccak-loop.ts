/**
 * phase-boundary extract: SC _createBuilder extract — the shared side-cars a direct callee's keccak256 loop reads.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { keccakComputeLockingBytecode, type AbiFunction } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { Output, UnlockableUtxo, Unlocker, Utxo } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { defaultInternalFunctionArg } from './kernel-journal-helpers.js';

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
  ): Promise<{ sideCars: UnlockableUtxo[]; recreates: Output[] }>;
}

/** Block slots that hold no state input: the probe stands a plain coin in for each. */
const OUTPUT_ONLY_SLOT_KINDS: ReadonlySet<string> = new Set([
  'returnEvent', 'event', 'eventChunk', 'transfer', 'tcTransfer',
]);

/** What else a function can read or write after its block, each by the ABI field that publishes it. */
const TRAILING_BAND_USERS: ReadonlyArray<readonly [keyof AbiFunction, string]> = [
  ['collectionIterations', 'a collection walk'],
  ['dynamicWrites', 'the chunks of dynamic state it writes'],
  ['dynamicReads', 'the chunks of dynamic state it reads'],
  ['entryLoopWrites', 'the entries a loop writes'],
  ['sortedInsertLoops', 'the entries a loop inserts'],
  ['sortedInsertLoopInfo', 'the entries a loop inserts'],
  ['sortedUpsertLoopInfo', 'the entries a loop writes'],
  ['runtimeLoopTransfers', 'the payments of a loop'],
  ['runtimeLoopEvents', 'the events of a loop'],
  ['keccakChainReads', 'a keccak256 chain'],
  ['ecrecoverTrailingLoop', 'a recovery loop'],
  ['ecrecoverLoopReads', 'a recovery loop'],
  ['externalCalls', 'the blocks of the contracts it calls'],
  ['lowLevelCalls', 'the blocks of the contracts it calls'],
];

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
  functionLabel: string;
}): Promise<{ bBlockInputs: UnlockableUtxo[]; start: number; recreates: Output[] }> {
  const { bAbiFunc, bSc, masterUtxo, bDataNfts, args, spent, functionLabel } = input;
  const refuse = (what: string): never => {
    throw new Error(`The call of ${functionLabel} cannot be laid out: ${what}`);
  };
  // The loop's side-cars are the only run this layout places after the callee's block.
  const sharer = TRAILING_BAND_USERS.find(([field]) => {
    const value = bAbiFunc[field];
    return Array.isArray(value) ? value.length > 0 : value === true;
  });
  if (sharer !== undefined) {
    refuse(`its keccak256 loop shares the inputs after its block with ${sharer[1]}, and the SDK lays out a callee's `
      + 'loop side-cars only as the one run there');
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
  // The frame the probe runs: the call's arguments, the record at its slot of a block whose master is input 0, and
  // every other witness at its default. The loop reads only its arguments and the side-cars.
  const visible = bAbiFunc.inputs.filter((parameter) => !parameter.name.startsWith('__internal__'));
  if (visible.length !== args.length) refuse('its arguments do not match its function');
  const recordOffset = layout?.slots.find((slot) => slot.kind === 'returnEvent')?.offset;
  let visibleIndex = 0;
  const frame = bAbiFunc.inputs.map((parameter): FunctionArgument => {
    if (!parameter.name.startsWith('__internal__')) return args[visibleIndex++]!;
    if (parameter.name === '__internal__returnOutputIdx') return BigInt(recordOffset ?? -1);
    return defaultInternalFunctionArg(parameter);
  });
  const unlocker = bSc.inner.createAbiUnlocker(bAbiFunc)(...frame);
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
      frontSlots.map((_, index) => plainCoin(index)), 0, { inputs: [], outputs: [] }, pool,
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
