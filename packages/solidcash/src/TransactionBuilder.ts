import {
  binToHex,
  createVirtualMachineBch2026,
  decodeTransaction,
  decodeTransactionUnsafe,
  encodeTransaction,
  hexToBin,
  Transaction as LibauthTransaction,
  WalletTemplate,
} from '@bitauth/libauth';
import {
  Unlocker,
  Output,
  BchChangeOutputOptions,
  TokenChangeOutputOptions,
  TransactionDetails,
  UnlockableUtxo,
  Utxo,
  InputOptions,
  isUnlockableUtxo,
  isStandardUnlockableUtxo,
  StandardUnlockableUtxo,
  VmResourceUsage,
  isContractUnlocker,
  isCovenantUnlocker,
} from './interfaces.js';
import { NetworkProvider } from './network/index.js';
import {
  hash256, scriptToBytecode, buildSidecarRedeem, sidecarLockingBytecode, resolveLibraryBlob,
  SHARED_LIBRARY_SALT, ExternalLibraryAbi,
  buildKeccakComputeRedeem, keccakComputeLockingBytecode, KECCAK256_COMPUTE_COVENANT_HASH,
  ecrecoverComputeLockingBytecode,
} from '@solidcash/utils';
import { keccak_256 } from '@noble/hashes/sha3.js';
import {
  pushDataBytes, buildKeccakComputeSidecar, extractKeccakPreimageFromTrace,
  OP_INPUTBYTECODE, leSmallNumber,
} from './keccak/keccakComputeSidecar.js';
import { buildEcrecoverComputeSidecars, computeEcrecoverWitness, probeEcrecoverSplit } from './ecrecover/ecrecoverComputeSidecar.js';
import type { EcrecoverWitness } from './ecrecover/ecrecoverRecovery.js';
import {
  solidCashOutputToLibauthOutput,
  createOpReturnOutput,
  delay,
  generateLibauthSourceOutputs,
  validateInput,
  validateOutput,
  validateChangeLocks,
  getOutputSize,
  calculateDust,
} from './utils.js';
import { FailedTransactionError } from './Errors.js';
import { assertFinalizedBytesWithCovenant, inputSubjectsOfBuilder } from './layer3/preflight.js';
import { DebugResults } from './debugging.js';
import { debugLibauthTemplate, getLibauthTemplate, getBitauthUri } from './libauth-template/LibauthTemplate.js';
import { getWcContractInfo, WcSourceOutput, WcTransactionOptions } from './walletconnect-utils.js';
import semver from 'semver';
import { WcTransactionObject } from './walletconnect-utils.js';
import { attachWait } from './wait.js';

export interface TransactionBuilderOptions {
  provider: NetworkProvider;
  maximumFeeSatoshis?: bigint;
  maximumFeeSatsPerByte?: number;
  allowImplicitFungibleTokenBurn?: boolean;
  allowImplicitNftBurn?: boolean;
  /** The caller has already assembled every compiler-required oracle/compute input at exact positions. */
  skipAutomaticCoSpends?: boolean;
}

const DEFAULT_SEQUENCE = 0xfffffffe;
const DEFAULT_MAX_FEE_SATS_PER_BYTE = 1000;

let keccakProbeVm: ReturnType<typeof createVirtualMachineBch2026> | undefined;

/**
 * EVERY keccak256 side-car read in a contract's VM trace whose index lands in the window [base, base+n). The
 * stack at OP_INPUTBYTECODE is [.., arg, idx], so a read's slot is idx - base and the argument it is about to be
 * bound against is one below. extractKeccakPreimageFromTrace returns only the LAST such read (the one that
 * aborted); the mixed shape needs the whole set, because the slots the trace never touches are exactly the ones
 * reserved for the in-loop calls, which read forward from the master instead.
 */
/** Budget/standardness cap on runtime keccak side-cars per transaction (matches the pure dynamic-loop path). */
const MAX_KECCAK_LOOP_ITERS = 64;

function bytesEqual(a: Uint8Array | undefined, b: Uint8Array): boolean {
  return a !== undefined && a.length === b.length && a.every((byte, i) => byte === b[i]);
}

/**
 * Does this contract read a keccak256 side-car COUNT-RELATIVE (offset from the end)? That reading is the only
 * thing that bakes the STATELESS compute covenant's hash: a stateful contract compares the STATEFUL hash and a
 * dynamic loop byte-compares the STATEFUL covenant inline. So its presence alongside `keccakLoopReads` is
 * exactly the mixed straight-line + in-loop shape, and its absence leaves the pure dynamic loop untouched.
 */
function hasCountRelativeKeccakReads(unlocker: Unlocker): boolean {
  const asm = (unlocker as unknown as { contract?: { artifact?: { bytecode?: string } } }).contract?.artifact?.bytecode;
  return typeof asm === 'string' && asm.split(' ').includes(KECCAK256_COMPUTE_COVENANT_HASH);
}

function scanKeccakSideCarReads(trace: unknown[], base: number, n: number): { slot: number; arg: Uint8Array }[] {
  const reads: { slot: number; arg: Uint8Array }[] = [];
  for (const s of trace) {
    const step = s as { ip: number; stack: Uint8Array[]; instructions?: { opcode: number }[]; controlStack?: unknown[] };
    if (step.controlStack?.some((c) => c === false)) continue;
    if (step.instructions?.[step.ip]?.opcode !== OP_INPUTBYTECODE) continue;
    if (step.stack.length < 2) continue;
    const idx = leSmallNumber(step.stack[step.stack.length - 1]);
    if (idx < base || idx >= base + n) continue;
    reads.push({ slot: idx - base, arg: Uint8Array.from(step.stack[step.stack.length - 2]) });
  }
  return reads;
}

export class TransactionBuilder {
  public provider: NetworkProvider;
  public inputs: UnlockableUtxo[] = [];
  public outputs: Output[] = [];

  public locktime: number = 0;
  public options: TransactionBuilderOptions;

  constructor(
    options: TransactionBuilderOptions,
  ) {
    this.provider = options.provider;
    this.options = {
      ...options,
      allowImplicitFungibleTokenBurn: options.allowImplicitFungibleTokenBurn ?? false,
      allowImplicitNftBurn: options.allowImplicitNftBurn ?? false,
    };
  }

  private changeLocks: Record<string, boolean> = {};

  addInput(utxo: Utxo, unlocker: Unlocker, options?: InputOptions): this {
    return this.addInputs([utxo], unlocker, options);
  }

  addInputs(utxos: Utxo[], unlocker: Unlocker, options?: InputOptions): this;
  addInputs(utxos: UnlockableUtxo[]): this;

  addInputs(utxos: Utxo[] | UnlockableUtxo[], unlocker?: Unlocker, options?: InputOptions): this {
    utxos.forEach((utxo) => {
      validateInput(utxo);
      validateChangeLocks(this.changeLocks, utxo.token?.category);
    });

    // Check for duplicate inputs (same txid:vout)
    const existingOutpoints = new Set(this.inputs.map((input) => `${input.txid.toLowerCase()}:${input.vout}`));
    for (const utxo of utxos) {
      const outpoint = `${utxo.txid.toLowerCase()}:${utxo.vout}`;
      if (existingOutpoints.has(outpoint)) {
        throw new Error(`Duplicate input detected: ${outpoint} is already included in the transaction`);
      }
      existingOutpoints.add(outpoint);
    }

    if (
      (!unlocker && utxos.some((utxo) => !isUnlockableUtxo(utxo)))
      || (unlocker && utxos.some((utxo) => isUnlockableUtxo(utxo)))
    ) {
      throw new Error('Either all UTXOs must have an individual unlocker specified, or no UTXOs must have an individual unlocker specified and a shared unlocker must be provided');
    }

    if (!unlocker) {
      this.inputs = this.inputs.concat(utxos as UnlockableUtxo[]);
      return this;
    }

    this.inputs = this.inputs.concat(utxos.map(((utxo) => ({ ...utxo, unlocker, options }))));
    return this;
  }

  /**
   * One-time deploy of an external-library side-car: adds an output creating the side-car UTXO if it
   * does not exist yet. Call when deploying/funding a library-using contract (idempotent). Pass `salt` =
   * the contract's token category for a branded (per-contract) side-car; omit for the shared one.
   * Returns the side-car amount added (0n if it already exists).
   */
  async addSidecarDeployIfNeeded(
    blob: Uint8Array, amount: bigint = 2000n, salt: Uint8Array = SHARED_LIBRARY_SALT,
  ): Promise<bigint> {
    const sidecarLock = sidecarLockingBytecode(blob, salt);
    const existing = await this.provider.getUtxosForLockingBytecode(sidecarLock);
    if (existing.length > 0) return 0n;
    this.addOutput({ to: sidecarLock, amount });
    return amount;
  }

  /**
   * Co-spend the external-library side-car required by any library-using contract input. The side-car
   * is appended as the LAST input and recreated as the LAST output (it self-preserves against the last
   * output). The blob lives once on-chain; this loads it for the spend and keeps it reusable. Auto-invoked
   * by send(); call it explicitly before build()/debug() for library contracts. The loader reads the last
   * input and verifies the blob by hash, so one side-car serves one library per transaction.
   */
  async addRequiredSidecars(): Promise<this> {
    // Collect (library descriptor, salt) for every external library a contract input's spent function uses.
    const required: { lib: ExternalLibraryAbi; salt: Uint8Array }[] = [];
    for (const input of this.inputs) {
      if (!isUnlockableUtxo(input) || !isContractUnlocker(input.unlocker)) continue;
      const used = input.unlocker.abiFunction.externalLibraries ?? [];
      const descriptors = input.unlocker.contract.artifact.externalLibraries ?? [];
      for (const name of used) {
        const lib = descriptors.find((l) => l.name === name);
        if (!lib || lib.inline) continue; // inline libraries are baked into the contract; no side-car
        if (lib.resultNft) continue; // compute-and-commit side-car co-spent via addRequiredKeccakComputeSidecar
        if (lib.branded && !input.token?.category) {
          throw new Error(`Branded ${name} side-car requires the spent contract input to carry its token category.`);
        }
        required.push({ lib, salt: lib.branded ? hexToBin(input.token!.category!) : SHARED_LIBRARY_SALT });
      }
    }
    if (required.length === 0) return this;

    // A single last-input side-car holds one blob; distinct (blob, salt) side-cars cannot share it.
    const distinct = new Map<string, { blob: Uint8Array; salt: Uint8Array }>();
    for (const { lib, salt } of required) {
      const blob = resolveLibraryBlob(lib);
      distinct.set(`${binToHex(hash256(blob))}:${binToHex(salt)}`, { blob, salt });
    }
    if (distinct.size > 1) {
      throw new Error('Multiple distinct external-library side-cars in one transaction are not supported.');
    }
    const { blob, salt } = [...distinct.values()][0];

    const sidecarRedeem = buildSidecarRedeem(blob, salt);
    const sidecarLock = sidecarLockingBytecode(blob, salt);
    const utxos = await this.provider.getUtxosForLockingBytecode(sidecarLock);
    if (utxos.length === 0) {
      throw new Error('External-library side-car UTXO not found; deploy it before spending a library contract.');
    }
    const sidecarOutpoints = new Set(utxos.map((u) => `${u.txid}:${u.vout}`));
    if (this.inputs.some((i) => sidecarOutpoints.has(`${i.txid}:${i.vout}`))) return this; // already co-spent

    const sidecar = utxos[0];
    const unlocker: Unlocker = {
      generateUnlockingBytecode: () => scriptToBytecode([sidecarRedeem]), // PUSHDATA(redeem)
      generateLockingBytecode: () => sidecarLock,
    };
    this.addInput(sidecar, unlocker);                              // last input (the loader reads it)
    this.addOutput({ to: sidecarLock, amount: sidecar.satoshis }); // last output (self-preservation)
    return this;
  }

  /**
   * Co-spend a keccak256 "compute-and-commit" side-car (result-NFT model). The branded side-car input runs
   * keccak in its OWN op budget and returns keccak256(preimage) in its recreated NFT commitment; a
   * result-NFT contract reads it by introspection. Appends the side-car as the LAST input (feeding the
   * preimage + a budget pad) and its recreation as the LAST output carrying the committed hash. `salt` (the
   * side-car branding) defaults to the first token-carrying contract input's category. The side-car mutable
   * NFT must already exist at keccakComputeLockingBytecode(salt). Call after adding the contract input(s),
   * before send(). See docs/keccak-result-nft.md.
   */
  async addKeccakComputeCoSpend(preimage: Uint8Array, opts?: { salt?: Uint8Array }): Promise<this> {
    const salt = opts?.salt ?? this.brandedComputeSalt();
    const lock = keccakComputeLockingBytecode(salt);
    const utxos = await this.provider.getUtxosForLockingBytecode(lock);
    // Pick a side-car UTXO not already co-spent (an N-call function co-spends N distinct side-cars at this
    // address, one per keccak256 call - deploy one mutable-NFT side-car per call).
    const sidecar = utxos.find((u) => !this.inputs.some((i) => i.txid === u.txid && i.vout === u.vout));
    if (!sidecar) {
      throw new Error('keccak256 compute side-car UTXO not available; deploy one mutable-NFT side-car per '
        + 'keccak256 call in the spent function.');
    }
    const { unlocker, recreate } = buildKeccakComputeSidecar(preimage, salt, sidecar);
    this.addInput(sidecar, unlocker);                    // LAST input
    this.addOutput(recreate);                            // LAST output: side-car recreation carrying the result
    return this;
  }

  // Compute-side-car salt = the first token-carrying contract input's category (BRANDED, stateful) or the
  // shared 32-zero salt (SHARED, a stateless contract with no category). The covenant brand-checks only when
  // the salt is non-zero, so a stateless contract co-spends the shared side-car without carrying a token.
  private brandedComputeSalt(): Uint8Array {
    for (const input of this.inputs) {
      if (isUnlockableUtxo(input) && isContractUnlocker(input.unlocker) && input.token?.category) {
        return hexToBin(input.token.category);
      }
    }
    return SHARED_LIBRARY_SALT;
  }

  /**
   * Transparent compute co-spend, auto-invoked by send(): for every contract input whose spent function uses
   * the compute-and-commit keccak model (`abiFunction.keccakCompute`), read the preimage from the recorded
   * parameter and co-spend the side-car. A function that hashes a non-parameter expression has no recorded
   * param; call addKeccakComputeCoSpend(preimage) explicitly for those.
   */
  async addRequiredKeccakComputeCoSpends(): Promise<this> {
    // Snapshot: addKeccakComputeCoSpend appends inputs; the appended side-cars are custom (non-contract)
    // unlockers, but snapshot anyway so we only process the original contract inputs.
    for (const input of [...this.inputs]) {
      if (!isUnlockableUtxo(input) || !isContractUnlocker(input.unlocker)) continue;
      const abiFn = input.unlocker.abiFunction;
      if (!abiFn.keccakCompute) continue;
      const salt = input.token?.category ? hexToBin(input.token.category) : SHARED_LIBRARY_SALT;
      // A dynamic (runtime-bound) keccak loop reads N absolute-forward side-cars right after the master, one per
      // iteration - resolved by a progressive probe, not the fixed one-per-call path. A function that ALSO has a
      // straight-line keccak256 call mixes that with a second, count-relative index family and needs both funded
      // in one pass (either can execute first, so neither probe converges without the other's side-cars).
      if (abiFn.keccakLoopReads) {
        const params = abiFn.keccakPreimageParams ?? [];
        if (params.length > 0 && hasCountRelativeKeccakReads(input.unlocker)) {
          await this.addMixedKeccakCoSpends(input, salt, params);
        } else {
          await this.addStatelessKeccakLoopCoSpends(input, salt);
        }
        continue;
      }
      // Resolve each keccak256 call's preimage (direct params from args; complex/nested via a VM probe), then
      // co-spend one side-car per call in call order (the contract reads call i from the i-th of the last N).
      const preimages = await this.resolveKeccakPreimages(input, salt, abiFn.keccakPreimageParams ?? []);
      for (const preimage of preimages) await this.addKeccakComputeCoSpend(preimage, { salt });
    }
    return this;
  }

  /**
   * Transparent recovery co-spend, auto-invoked by send(): for every contract input whose spent function uses
   * ecrecoverPubKey (`abiFunction.ecrecoverCompute`), resolve each call's (hash, v, r, s) direct params, compute the
   * GLV recovery witnesses, and co-spend the recovery side-car PAIR (A checkpoints, B commits the pubkey). The split
   * point is a witnessed liveness parameter the SDK sizes deterministically; see docs/ecrecover.md.
   */
  async addRequiredEcrecoverComputeCoSpends(): Promise<this> {
    for (const input of [...this.inputs]) {
      if (!isUnlockableUtxo(input) || !isContractUnlocker(input.unlocker)) continue;
      const abiFn = input.unlocker.abiFunction as typeof input.unlocker.abiFunction
      & { ecrecoverCompute?: boolean; ecrecoverArgParams?: readonly (readonly (string | null)[])[];
        ecrecoverEvmFlags?: readonly boolean[]; ecrecoverLoopReads?: boolean };
      if (!abiFn.ecrecoverCompute) continue;
      const salt = input.token?.category ? hexToBin(input.token.category) : SHARED_LIBRARY_SALT;
      // Dynamic loop: one recovery PAIR per iteration, read forward from [master+1+2k]. Co-spend N (= sig-array length).
      // Loop side-cars are ALWAYS shared-salt: the per-iteration integrity check is an OP_UTXOBYTECODE == baked shared
      // lock (branding is not needed for soundness - the argBlob bind + A->B hash chain secures the recovered value).
      if (abiFn.ecrecoverLoopReads) { await this.addStatelessEcrecoverLoopCoSpends(input, SHARED_LIBRARY_SALT); continue; }
      const unlocker = input.unlocker as unknown as {
        abiFunction: { inputs: readonly { name: string }[] }; params: unknown[];
      };
      const raw = (name: string): unknown =>
        unlocker.params[unlocker.abiFunction.inputs.findIndex((x) => x.name === name)];
      // "h" -> the h param; "h[3]" (unrolled loop) -> element 3 of the h array param.
      const paramAt = (p: string | null): unknown => {
        if (!p) return undefined;
        const m = p.match(/^(\w+)\[(\d+)\]$/);
        if (m) { const arr = raw(m[1]); return Array.isArray(arr) ? arr[Number(m[2])] : undefined; }
        return raw(p);
      };
      const bytesAt = (p: string | null): Uint8Array | undefined => {
        const v = paramAt(p);
        return v instanceof Uint8Array ? v : undefined;
      };
      const calls = abiFn.ecrecoverArgParams ?? [];
      const evmFlags = abiFn.ecrecoverEvmFlags ?? [];
      const evmPreimages: Uint8Array[] = [];   // uncompressed keys for the trailing keccak side-cars (one per evm call)
      for (let c = 0; c < calls.length; c++) {
        const [hp, vp, rp, sp] = calls[c];
        const hash = bytesAt(hp), r = bytesAt(rp), s = bytesAt(sp), vRaw = paramAt(vp);
        const v = typeof vRaw === 'bigint' ? Number(vRaw) : (vRaw instanceof Uint8Array ? vRaw[0] : NaN);
        if (!hash || !r || !s || Number.isNaN(v)) {
          throw new Error('ecrecoverPubKey requires direct (hash, v, r, s) parameters for the auto co-spend; '
            + 'a computed argument needs an explicit recovery co-spend.');
        }
        const wit = computeEcrecoverWitness(hash, v, r, s);
        await this.addEcrecoverComputeCoSpend(wit, salt);
        if (evmFlags[c]) evmPreimages.push(wit.uncompressedPubkey);
      }
      // ecrecoverEvm: after ALL recovery pairs, co-spend one keccak side-car per evm call (over the uncompressed key),
      // in evm-call order. The contract binds compress(preimage) == the recovered key and reads keccak256(key)[12:].
      for (const preimage of evmPreimages) await this.addKeccakComputeCoSpend(preimage, { salt });
    }
    return this;
  }

  private async addEcrecoverComputeCoSpend(wit: EcrecoverWitness, salt: Uint8Array): Promise<void> {
    const [lockA, lockB] = [ecrecoverComputeLockingBytecode(salt, 'A'), ecrecoverComputeLockingBytecode(salt, 'B')];
    const [utxosA, utxosB] = await Promise.all([
      this.provider.getUtxosForLockingBytecode(lockA), this.provider.getUtxosForLockingBytecode(lockB),
    ]);
    const free = (utxos: Utxo[]): Utxo | undefined => utxos.find(
      (u) => !this.inputs.some((i) => i.txid === u.txid && i.vout === u.vout),
    );
    const scA = free(utxosA), scB = free(utxosB);
    if (!scA || !scB) {
      throw new Error('ecrecover recovery side-car A/B UTXOs not available; deploy a recovery pair per '
        + 'ecrecoverPubKey call in the spent function.');
    }
    // Deterministic split point: the number of ladder steps A runs. op-cost is a pure function of (covenant, witness),
    // so the SDK VM-probes both covenants across candidate splits and picks the one where both inputs fit their ~8M
    // budget with the smallest peak. chunkA is a liveness parameter (A<->B are bound by the A->B hash), never soundness:
    // a wrong split simply fails to spend, it can never yield a wrong Q. See docs/ecrecover.md.
    const chunkA = probeEcrecoverSplit(wit, salt, scA, scB);
    const { unlockerA, recreateA, unlockerB, recreateB } = buildEcrecoverComputeSidecars(wit, chunkA, salt, scA, scB);
    this.addInput(scA, unlockerA); this.addOutput(recreateA);   // A: checkpoint
    this.addInput(scB, unlockerB); this.addOutput(recreateB);   // B: recovered pubkey
  }

  /**
   * Dynamic (runtime-bound) ecrecover loop `for (i<n) ecrecoverPubKey(h[i],..)`: co-spend one recovery PAIR per
   * iteration in the forward region [master+1+2k]. N = the sig-array length (the loop iterates the arrays); the
   * contract reads pair k at [master+1+2k]/[master+2+2k] (self-preserving) and BINDS its argBlob == (h[k],v[k],r[k],
   * s[k]), so extra/missing pairs fail closed. Splices the pairs + recreations right after the master (input idx ==
   * output idx). Mirrors addStatelessKeccakLoopCoSpends but for a 2-side-car pair per iteration.
   */
  private async addStatelessEcrecoverLoopCoSpends(input: UnlockableUtxo, salt: Uint8Array): Promise<void> {
    const contractIdx = this.inputs.indexOf(input);
    const base = contractIdx + 1; // absolute-forward: pairs/recreations at [master+1 ..]
    if (base > this.outputs.length) {
      throw new Error('stateless dynamic ecrecover loop needs the spent contract near the front of the tx (its input '
        + `index + 1 must be <= the output count; got index ${contractIdx}, ${this.outputs.length} outputs).`);
    }
    const unlocker = input.unlocker as unknown as {
      abiFunction: { inputs: readonly { name: string }[]; ecrecoverArgParams?: readonly (readonly (string | null)[])[];
        ecrecoverEvmFlags?: readonly boolean[] };
      params: unknown[];
    };
    // ecrecoverEvm in the loop projects each recovered key to its EVM address, so each iteration ALSO co-spends a
    // keccak side-car over the uncompressed key. Layout is then stride 3: [A, B, K] per iteration (else stride 2).
    const isEvm = unlocker.abiFunction.ecrecoverEvmFlags?.[0] === true;
    // The single syntactic loop call records its args as "h[]" (array-indexed by the loop var); read those arrays.
    const [hp, vp, rp, sp] = (unlocker.abiFunction.ecrecoverArgParams ?? [[]])[0] ?? [];
    const arrOf = (ref: string | null | undefined): unknown[] => {
      const m = typeof ref === 'string' ? ref.match(/^(\w+)\[\]$/) : null;
      if (!m) throw new Error('ecrecover loop requires direct array-element args h[i] (v/r/s the same); a computed '
        + 'argument needs an explicit recovery co-spend.');
      const v = unlocker.params[unlocker.abiFunction.inputs.findIndex((x) => x.name === m[1])];
      if (!Array.isArray(v)) throw new Error(`ecrecover loop arg "${m[1]}" is not an array.`);
      return v;
    };
    const hs = arrOf(hp), vs = arrOf(vp), rs = arrOf(rp), ss = arrOf(sp);
    const N = hs.length;
    const [lockA, lockB] = [ecrecoverComputeLockingBytecode(salt, 'A'), ecrecoverComputeLockingBytecode(salt, 'B')];
    // Loop keccak side-cars ride the STATEFUL covenant (forward self-preserving), at the shared salt (matches the
    // baked KECCAK256_COMPUTE_STATEFUL_SHARED_LOCK the contract checks via OP_UTXOBYTECODE).
    const lockK = keccakComputeLockingBytecode(salt, true);
    const [utxosA, utxosB, utxosK] = await Promise.all([
      this.provider.getUtxosForLockingBytecode(lockA), this.provider.getUtxosForLockingBytecode(lockB),
      isEvm ? this.provider.getUtxosForLockingBytecode(lockK) : Promise.resolve([] as Utxo[]),
    ]);
    const spent = (u: Utxo): boolean => this.inputs.some((i) => i.txid === u.txid && i.vout === u.vout);
    const freeA = utxosA.filter((u) => !spent(u)), freeB = utxosB.filter((u) => !spent(u));
    const freeK = utxosK.filter((u) => !spent(u) && u.token?.nft?.capability === 'mutable');
    if (freeA.length < N || freeB.length < N || (isEvm && freeK.length < N)) {
      throw new Error(`dynamic ecrecover loop needs ${N} A + ${N} B${isEvm ? ` + ${N} keccak` : ''} side-car UTXOs; `
        + `found ${freeA.length} A + ${freeB.length} B${isEvm ? ` + ${freeK.length} keccak` : ''}. Deploy one `
        + `${isEvm ? 'A+B+keccak triple' : 'A+B pair'} per loop iteration.`);
    }
    const sideCars: UnlockableUtxo[] = [];
    const recreates: Output[] = [];
    for (let k = 0; k < N; k++) {
      const hash = hs[k] as Uint8Array, r = rs[k] as Uint8Array, s = ss[k] as Uint8Array;
      const v = typeof vs[k] === 'bigint' ? Number(vs[k]) : Number(vs[k]);
      const wit = computeEcrecoverWitness(hash, v, r, s);
      const chunkA = probeEcrecoverSplit(wit, salt, freeA[k], freeB[k]);
      const {
        unlockerA, recreateA, unlockerB, recreateB,
      } = buildEcrecoverComputeSidecars(wit, chunkA, salt, freeA[k], freeB[k]);
      sideCars.push({ ...freeA[k], unlocker: unlockerA }, { ...freeB[k], unlocker: unlockerB });
      recreates.push(recreateA, recreateB);
      if (isEvm) {
        // K keccak side-car over the 64-byte uncompressed key; the contract binds compress(preimage) == recovered Q.
        const { unlocker: unlockerK, recreate: recreateK } = buildKeccakComputeSidecar(
          wit.uncompressedPubkey, salt, freeK[k], true,
        );
        sideCars.push({ ...freeK[k], unlocker: unlockerK });
        recreates.push(recreateK);
      }
    }
    this.inputs.splice(base, 0, ...sideCars);
    this.outputs.splice(base, 0, ...recreates);
  }


  /**
   * Resolve every keccak256 call's preimage for a compute-model function. Direct-parameter args come straight
   * from the call args; a complex/nested arg (`keccakPreimageParams[i] === null`, e.g. keccak256(abi.encodePacked
   * (..)) or keccak256(keccak256(x))) is extracted by a VM debug probe: N side-cars are co-spent with the
   * resolved preimages (placeholders for the not-yet-resolved), the contract input is evaluated, and the arg is
   * read off the stack at that call's OP_INPUTBYTECODE step (captured before the binding OP_EQUALVERIFY aborts).
   * Nulls resolve one per probe in call order, so a resolved call's real side-car lets execution reach the next.
   */
  private async resolveKeccakPreimages(
    input: UnlockableUtxo, salt: Uint8Array, params: readonly (string | null)[],
  ): Promise<Uint8Array[]> {
    const unlocker = input.unlocker as unknown as {
      abiFunction: { inputs: readonly { name: string }[]; name: string }; params: unknown[];
    };
    const abiFn = unlocker.abiFunction;
    const argFor = (p: string): Uint8Array | null => {
      const v = unlocker.params[abiFn.inputs.findIndex((x) => x.name === p)];
      return v instanceof Uint8Array ? v : null;
    };
    const preimages: (Uint8Array | null)[] = params.map((p) => (p ? argFor(p) : null));
    if (preimages.every((p) => p !== null)) return preimages as Uint8Array[]; // all direct params - no probe
    const n = params.length;
    const lock = keccakComputeLockingBytecode(salt);
    const redeem = buildKeccakComputeRedeem(salt);
    const scUtxos = await this.provider.getUtxosForLockingBytecode(lock);
    if (scUtxos.length < n) {
      throw new Error(`keccak256 preimage extraction needs ${n} compute side-car UTXOs (one per call); found ${scUtxos.length}.`);
    }
    const category = scUtxos[0].token?.category ?? binToHex(new Uint8Array(32));
    const contractIdx = this.inputs.indexOf(input);
    const base = this.inputs.length; // side-car inputs are appended after the current inputs
    keccakProbeVm ??= createVirtualMachineBch2026();
    const savedInputs = [...this.inputs];
    const savedOutputs = [...this.outputs];
    try {
      // Each probe co-spends N side-cars (real preimage/commitment for resolved calls, placeholders for the
      // rest) and reads the LAST in-range side-car read off the contract's trace: the call whose binding
      // OP_EQUALVERIFY aborts on the placeholder. Nested calls abort inner-to-outer, so one null resolves per
      // probe (by its slot index, not emission order). Loop until every preimage is known.
      let guard = 0;
      while (preimages.some((p) => p === null)) {
        if (guard++ > n) throw new Error('keccak256 preimage extraction did not converge.');
        this.inputs = [...savedInputs];
        this.outputs = [...savedOutputs];
        for (let j = 0; j < n; j++) {
          const resolved = preimages[j];
          const pm = resolved ?? new Uint8Array(0);
          const commit = resolved ? keccak_256(resolved) : new Uint8Array(32);
          this.inputs.push({
            ...scUtxos[j],
            unlocker: {
              generateUnlockingBytecode: () => Uint8Array.from(
                [...pushDataBytes(new Uint8Array(1)), ...pushDataBytes(pm), ...pushDataBytes(redeem)],
              ),
              generateLockingBytecode: () => lock,
            },
          });
          this.outputs.push({ to: lock, amount: scUtxos[j].satoshis,
            token: { category, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(commit) } } });
        }
        const transaction = this.buildLibauthTransaction(true);
        const sourceOutputs = generateLibauthSourceOutputs(this.inputs);
        const trace = keccakProbeVm.debug({ inputIndex: contractIdx, sourceOutputs, transaction }) as unknown[];
        const { callIndex, preimage } = extractKeccakPreimageFromTrace(trace, base, n);
        preimages[callIndex] = preimage;
      }
    } finally {
      this.inputs = savedInputs;
      this.outputs = savedOutputs;
    }
    return preimages as Uint8Array[];
  }

  /**
   * Resolve a stateless DYNAMIC keccak256 loop (`for (..) h = keccak256(..)`, runtime iteration count). The
   * contract reads iteration `k`'s side-car absolute-forward at input `masterIndex + 1 + k` and its result at the
   * matching output (the STATEFUL self-preserving covenant: input idx == output idx), so the side-cars sit
   * contiguously right after the master and their recreations at the parallel output positions. The iteration
   * count is unknown statically, so probe progressively: co-spend k side-cars (real preimages for resolved
   * iterations, one placeholder), evaluate the master, and read the newly-aborted iteration's preimage off the
   * trace. Converges when the k-th placeholder is never read (the loop exited) - N = resolved count. Fails closed:
   * each iteration BINDS its side-car preimage == the running value, so a wrong/missing side-car aborts.
   */
  private async addStatelessKeccakLoopCoSpends(input: UnlockableUtxo, salt: Uint8Array): Promise<void> {
    const contractIdx = this.inputs.indexOf(input);
    const base = contractIdx + 1; // absolute-forward: side-cars/recreations at [master+1 ..] (blockSize 1)
    if (base > this.outputs.length) {
      throw new Error('stateless dynamic keccak256 loop needs the spent contract near the front of the tx (its '
        + `input index + 1 must be <= the output count; got index ${contractIdx}, ${this.outputs.length} outputs).`);
    }
    const lock = keccakComputeLockingBytecode(salt, true); // STATEFUL covenant (self-preserve via OP_INPUTINDEX)
    const scUtxos = (await this.provider.getUtxosForLockingBytecode(lock))
      .filter((u) => u.token?.nft?.capability === 'mutable');
    keccakProbeVm ??= createVirtualMachineBch2026();
    const savedInputs = [...this.inputs];
    const savedOutputs = [...this.outputs];
    const MAX_ITERS = 64; // budget/standardness cap on runtime keccak side-cars per tx
    const preimages: Uint8Array[] = [];
    const spliceSideCars = (k: number): { sideCars: UnlockableUtxo[]; recreates: Output[] } => {
      const sideCars: UnlockableUtxo[] = [];
      const recreates: Output[] = [];
      for (let j = 0; j < k; j++) {
        const { unlocker, recreate } = buildKeccakComputeSidecar(
          j < preimages.length ? preimages[j] : new Uint8Array(0), salt, scUtxos[j], true,
        );
        sideCars.push({ ...scUtxos[j], unlocker });
        recreates.push(recreate);
      }
      return { sideCars, recreates };
    };
    try {
      for (let k = 1; k <= MAX_ITERS + 1; k++) {
        if (scUtxos.length < k) {
          throw new Error(`stateless dynamic keccak256 loop needs >= ${k} compute side-car UTXOs at the branded `
            + `address; found ${scUtxos.length}. Deploy more mutable-NFT side-cars.`);
        }
        this.inputs = [...savedInputs];
        this.outputs = [...savedOutputs];
        const { sideCars, recreates } = spliceSideCars(k);
        this.inputs.splice(base, 0, ...sideCars);
        this.outputs.splice(base, 0, ...recreates);
        const transaction = this.buildLibauthTransaction(true);
        const sourceOutputs = generateLibauthSourceOutputs(this.inputs);
        const trace = keccakProbeVm.debug({ inputIndex: contractIdx, sourceOutputs, transaction }) as unknown[];
        const { callIndex, preimage } = extractKeccakPreimageFromTrace(trace, base, k);
        if (callIndex === preimages.length) preimages.push(preimage); // the k-th placeholder aborted -> new iter
        else break; // the placeholder was never read -> loop exited -> N = preimages.length
        if (k > MAX_ITERS) throw new Error(`stateless dynamic keccak256 loop exceeds ${MAX_ITERS} iterations.`);
      }
    } finally {
      this.inputs = savedInputs;
      this.outputs = savedOutputs;
    }
    const { sideCars, recreates } = spliceSideCars(preimages.length);
    this.inputs.splice(base, 0, ...sideCars);
    this.outputs.splice(base, 0, ...recreates);
  }

  /**
   * MIXED keccak256 shape: a function with a straight-line keccak256 call AND one inside a dynamic loop, in a
   * STATELESS contract (a stateful one is refused at compile time - no block-layout slot is reserved for the
   * unlooped call). The two calls read DIFFERENT index families off the same transaction:
   *
   *   straight-line call p  input NI - (n - p), output NO - (n - p), STATELESS covenant (hash256 compare)
   *   in-loop call          input/output masterIndex + 1 + counter, STATEFUL covenant (inline byte compare)
   *
   * `n` is the function's STATIC keccak256 call count, so codegen reserves n trailing slots even though only the
   * S straight-line calls read them; the L = n - S in-loop calls read forward instead and leave holes in the
   * trailing window. Fill the whole window: a resolved side-car in every straight-line slot, and an occupant in
   * every hole (an existing trailing input/output first, else a pad side-car, since a hole is never read).
   *
   * NI and NO are free, so the two families need not collide - but they DO collide when the window would reach
   * back into the forward loop block, which is the SDK's natural minimal layout (NI - 2 == masterIndex + 1 + 0).
   * That case is refused BY NAME rather than built wrong.
   */
  private async addMixedKeccakCoSpends(
    input: UnlockableUtxo, salt: Uint8Array, params: readonly (string | null)[],
  ): Promise<void> {
    const n = params.length;
    const contractIdx = this.inputs.indexOf(input);
    if (contractIdx + 1 > this.outputs.length) {
      throw new Error('mixed keccak256 shape needs the spent contract near the front of the tx (its input index '
        + `+ 1 must be <= the output count; got index ${contractIdx}, ${this.outputs.length} outputs).`);
    }
    const spent = (u: Utxo): boolean => this.inputs.some((i) => i.txid === u.txid && i.vout === u.vout);
    const free = async (lock: Uint8Array): Promise<Utxo[]> => (await this.provider.getUtxosForLockingBytecode(lock))
      .filter((u) => u.token?.nft?.capability === 'mutable' && !spent(u));
    const loopUtxos = await free(keccakComputeLockingBytecode(salt, true)); // forward block: STATEFUL covenant
    const winUtxos = await free(keccakComputeLockingBytecode(salt));        // trailing window: STATELESS covenant
    // Direct-parameter preimages come straight from the call args; complex/nested ones fall out of the probe.
    const unlocker = input.unlocker as unknown as {
      abiFunction: { inputs: readonly { name: string }[] }; params: unknown[];
    };
    const direct = params.map((p) => {
      if (!p) return null;
      const v = unlocker.params[unlocker.abiFunction.inputs.findIndex((x) => x.name === p)];
      return v instanceof Uint8Array ? v : null;
    });

    const { loopPreimages, found } = await this.probeMixedKeccakLayout(contractIdx, salt, n, direct, loopUtxos, winUtxos);
    const K = loopPreimages.length;
    const S = found.size;
    const L = n - S;                 // trailing slots reserved for the in-loop calls; read by nobody
    if (S === 0 || L < 0) {
      throw new Error(`mixed keccak256 shape: the probe resolved ${S} of the ${n} reserved trailing slots and `
        + `${K} loop iteration(s), which does not describe a fundable layout. This function mixes a straight-line `
        + 'keccak256 with one inside a loop; co-spend its side-cars explicitly.');
    }
    if (loopUtxos.length < K) {
      throw new Error(`mixed keccak256 shape needs ${K} STATEFUL compute side-car UTXO(s) for its ${K} loop `
        + `iteration(s); found ${loopUtxos.length} at the branded address. Deploy more mutable-NFT side-cars.`);
    }
    // Splice the forward loop block right after the master (input index == output index: it self-preserves via
    // OP_INPUTINDEX), then lay the trailing window out behind it.
    const loopIn: UnlockableUtxo[] = [];
    const loopOut: Output[] = [];
    for (let j = 0; j < K; j++) {
      const { unlocker: scUnlocker, recreate } = buildKeccakComputeSidecar(loopPreimages[j], salt, loopUtxos[j], true);
      loopIn.push({ ...loopUtxos[j], unlocker: scUnlocker });
      loopOut.push(recreate);
    }
    this.inputs.splice(contractIdx + 1, 0, ...loopIn);
    this.outputs.splice(contractIdx + 1, 0, ...loopOut);

    const loopEnd = contractIdx + K;  // last forward side-car (== the master itself when the loop never ran)
    // A hole can be occupied by an existing trailing input/output pair sitting AFTER the loop block; each hole
    // needs one of each, so the usable count is the smaller side. The rest are padded with extra side-cars.
    const userFills = Math.max(0, Math.min(L, this.inputs.length - 1 - loopEnd, this.outputs.length - 1 - loopEnd));
    const padFills = L - userFills;
    if (winUtxos.length < S + padFills) {
      throw new Error(`mixed keccak256 shape (${S} straight-line call(s) + ${L} in-loop call(s)) needs `
        + `${S + padFills} STATELESS compute side-car UTXO(s) - ${S} read by the straight-line call(s), `
        + `${padFills} padding the reserved in-loop slot(s) - besides the ${K} STATEFUL loop side-car(s); found `
        + `${winUtxos.length} at the branded address. Deploy one mutable-NFT stateless side-car per slot, or add `
        + 'a funding input and a change output so the reserved slots are occupied by them instead.');
    }
    const winStartIn = this.inputs.length - userFills;
    const winStartOut = this.outputs.length - userFills;
    // Defensive invariant, not the live guard: the userFills clamp above already keeps the window past the loop
    // block, and the shortfall refusal above is what actually fires. Kept so that if any of that arithmetic ever
    // changes, the colliding layout (NI-2 == masterIndex+1+0) is refused rather than emitted.
    if (winStartIn <= loopEnd || winStartOut <= loopEnd) {
      throw new Error(`mixed keccak256 shape (${S} straight-line call(s) + ${L} in-loop call(s)) cannot be funded `
        + `at this layout: the straight-line call(s) read the last ${n} inputs/outputs count-relative while the `
        + `loop reads forward from the master at [${contractIdx + 1}..${loopEnd}], and the trailing window would `
        + `start at input ${winStartIn} / output ${winStartOut}, colliding with the loop block. Add a funding `
        + 'input and a change output (or deploy more stateless side-cars) so the two index families sit at '
        + 'distinct indices.');
    }
    // Pull the hole occupants off the tail, then rebuild the window slot by slot.
    const tailIn = this.inputs.splice(winStartIn);
    const tailOut = this.outputs.splice(winStartOut);
    let fill = 0;
    let sc = 0;
    for (let p = 0; p < n; p++) {
      const preimage = found.get(p);
      if (!preimage && fill < tailIn.length) {
        this.inputs.push(tailIn[fill]);
        this.outputs.push(tailOut[fill]);
        fill++;
        continue;
      }
      // A straight-line slot gets its resolved preimage; a padded hole is never read, so it commits keccak256("").
      const utxo = winUtxos[sc];
      sc++;
      const { unlocker: scUnlocker, recreate } = buildKeccakComputeSidecar(preimage ?? new Uint8Array(0), salt, utxo);
      this.inputs.push({ ...utxo, unlocker: scUnlocker });
      this.outputs.push(recreate);
    }
  }

  /**
   * One progressive VM probe resolving BOTH keccak256 index families of a mixed function at once. Either family
   * can execute first (source order decides), so resolving them in sequence deadlocks: the straight-line call
   * aborts before the loop probe can see an iteration, and vice versa. Each round lays out the FULL candidate
   * transaction - the forward loop block after the master with one extra placeholder (so another iteration is
   * detectable), the n reserved slots at the tail - evaluates the master, and reads every side-car index off the
   * trace. A wrong preimage aborts at the binding OP_EQUALVERIFY, but the read already put the true argument on
   * the stack, so each round learns at least one value; repeat to a fixpoint. Trailing slots the trace never
   * touches are the in-loop calls' reserved holes. Both families sit at the same relative offsets here as in the
   * final layout (forward from the master; the window is always the last n), so the resolved slots transfer.
   * Missing side-car UTXOs are stood in for - the probe only evaluates the master, so a stand-in's outpoint is
   * never checked - and the real counts are enforced by the caller once K and S are known.
   */
  private async probeMixedKeccakLayout(
    contractIdx: number, salt: Uint8Array, n: number,
    direct: readonly (Uint8Array | null)[], loopUtxos: Utxo[], winUtxos: Utxo[],
  ): Promise<{ loopPreimages: Uint8Array[]; found: Map<number, Uint8Array> }> {
    const loopPreimages: Uint8Array[] = [];
    const found = new Map<number, Uint8Array>();
    const savedInputs = [...this.inputs];
    const savedOutputs = [...this.outputs];
    const standIn = (pool: Utxo[], j: number, tag: string): Utxo => pool[j] ?? {
      txid: tag.repeat(32),
      vout: j,
      satoshis: 1_000n,
      token: {
        category: pool[0]?.token?.category ?? binToHex(new Uint8Array(32)),
        amount: 0n,
        nft: { capability: 'mutable' as const, commitment: '' },
      },
    };
    keccakProbeVm ??= createVirtualMachineBch2026();
    try {
      for (let round = 0; round <= MAX_KECCAK_LOOP_ITERS + n + 1; round++) {
        const k = loopPreimages.length + 1; // one extra placeholder: if it is read, the loop has another iteration
        this.inputs = [...savedInputs];
        this.outputs = [...savedOutputs];
        const loopIn: UnlockableUtxo[] = [];
        const loopOut: Output[] = [];
        for (let j = 0; j < k; j++) {
          const utxo = standIn(loopUtxos, j, 'ee');
          const preimage = loopPreimages[j] ?? new Uint8Array(0);
          const { unlocker, recreate } = buildKeccakComputeSidecar(preimage, salt, utxo, true);
          loopIn.push({ ...utxo, unlocker });
          loopOut.push(recreate);
        }
        this.inputs.splice(contractIdx + 1, 0, ...loopIn);
        this.outputs.splice(contractIdx + 1, 0, ...loopOut);
        const winBase = this.inputs.length; // the window is appended, so it is always the last n
        for (let p = 0; p < n; p++) {
          const utxo = standIn(winUtxos, p, 'dd');
          const preimage = found.get(p) ?? direct[p] ?? new Uint8Array(0);
          const { unlocker, recreate } = buildKeccakComputeSidecar(preimage, salt, utxo);
          this.inputs.push({ ...utxo, unlocker });
          this.outputs.push(recreate);
        }
        const transaction = this.buildLibauthTransaction(true);
        const sourceOutputs = generateLibauthSourceOutputs(this.inputs);
        const trace = keccakProbeVm.debug({ inputIndex: contractIdx, sourceOutputs, transaction }) as unknown[];
        let changed = false;
        for (const { slot, arg } of scanKeccakSideCarReads(trace, contractIdx + 1, k)) {
          if (slot === loopPreimages.length) { loopPreimages.push(arg); changed = true; continue; }
          if (bytesEqual(loopPreimages[slot], arg)) continue;
          loopPreimages[slot] = arg;
          changed = true;
        }
        for (const { slot, arg } of scanKeccakSideCarReads(trace, winBase, n)) {
          if (bytesEqual(found.get(slot), arg)) continue;
          found.set(slot, arg);
          changed = true;
        }
        if (!changed) break;
        if (loopPreimages.length > MAX_KECCAK_LOOP_ITERS) {
          throw new Error(`mixed keccak256 shape exceeds ${MAX_KECCAK_LOOP_ITERS} loop iterations.`);
        }
      }
    } finally {
      this.inputs = savedInputs;
      this.outputs = savedOutputs;
    }
    return { loopPreimages, found };
  }

  /**
   * Guard: blockhash(n) brands its (n->hash) oracle to the contract's OWN category (master-bound, so the
   * reader is stateful), which means the co-spend rides a StatefulContract block-layout slot, not a base
   * TransactionBuilder append. A blockhash reader reaching this builder means the call was NOT built through
   * StatefulContract, so fail loudly. Auto-invoked by send() before sidecars.
   */
  async addRequiredBlockhashCoSpends(): Promise<this> {
    // blockhash(n) brands its (n->hash) oracle to the contract's OWN category (master-bound, stateful), so the
    // co-spend is resolved by StatefulContract via the blockhashOracle block-layout slot. A blockhash reader in
    // the base TransactionBuilder means the call was not built through StatefulContract.
    for (const input of this.inputs) {
      if (!isUnlockableUtxo(input) || !isContractUnlocker(input.unlocker)) continue;
      if ((input.unlocker.abiFunction.blockhashReads ?? []).length > 0) {
        throw new Error('blockhash(n) is only supported in stateful contracts; build the call via StatefulContract.');
      }
    }
    return this;
  }

  addOutput(output: Output): this {
    return this.addOutputs([output]);
  }

  addOutputs(outputs: Output[]): this {
    outputs.forEach((output) => {
      validateOutput(output, this.provider.policy?.enforceDust ?? true);
      validateChangeLocks(this.changeLocks, output.token?.category);
    });
    this.outputs = this.outputs.concat(outputs);
    return this;
  }

  /**
   * Add a BCH change output sending the input surplus (minus fee at the given rate) to the
   * provided address, if the surplus exceeds the dust threshold. Locks BCH change afterwards.
   */
  addBchChangeOutputIfNeeded(changeOutputOptions: BchChangeOutputOptions): this {
    const totalBchInputAmount = this.inputs.reduce((total, input) => total + input.satoshis, 0n);
    const totalBchOutputAmount = this.outputs.reduce((total, output) => total + output.amount, 0n);

    const tentativeSurplus = totalBchInputAmount - totalBchOutputAmount;
    const tentativeTransactionSize = this.getTransactionSize();
    const tentativeFee = BigInt(Math.ceil(changeOutputOptions.feeRate * Number(tentativeTransactionSize)));
    const tentativeChangeAmount = tentativeSurplus - tentativeFee;

    if (tentativeChangeAmount < 0n) {
      throw new Error(`Transaction does not have enough funds to cover the transaction fee rate of ${changeOutputOptions.feeRate} even without adding a change output. Current surplus: ${tentativeSurplus}, current fee: ${tentativeFee}, current change amount: ${tentativeChangeAmount}`);
    }

    const changeOutputSize = getOutputSize({ to: changeOutputOptions.to, amount: tentativeSurplus });
    const transactionSize = tentativeTransactionSize + BigInt(changeOutputSize);
    const calculatedFee = BigInt(Math.ceil(changeOutputOptions.feeRate * Number(transactionSize)));

    const changeAmount = tentativeSurplus - calculatedFee;
    const changeOutput = { to: changeOutputOptions.to, amount: changeAmount };

    if (changeAmount < calculateDust(changeOutput)) {
      this.changeLocks.BCH = true;
      return this;
    }

    this.addOutput(changeOutput);
    this.changeLocks.BCH = true;
    return this;
  }

  /**
   * Add a fungible token change output for the configured category if inputs carry more tokens of
   * that category than outputs. The change output carries the dust-minimum BCH amount.
   * Call after all explicit token outputs for the category and before addBchChangeOutputIfNeeded.
   */
  addTokenChangeOutputIfNeeded(changeOutputOptions: TokenChangeOutputOptions): this {
    const { category, to } = changeOutputOptions;

    const inputAmount = this.inputs
      .filter((input) => input.token?.category === category)
      .reduce((total, input) => total + input.token!.amount, 0n);
    const outputAmount = this.outputs
      .filter((output) => output.token?.category === category)
      .reduce((total, output) => total + output.token!.amount, 0n);

    const changeAmount = inputAmount - outputAmount;
    if (changeAmount <= 0n) {
      this.changeLocks[category] = true;
      return this;
    }

    const changeOutput: Output = { to, amount: 0n, token: { amount: changeAmount, category } };
    changeOutput.amount = BigInt(calculateDust(changeOutput));

    this.addOutput(changeOutput);
    this.changeLocks[category] = true;
    return this;
  }

  getTransactionSize(): bigint {
    const transaction = this.buildLibauthTransaction(true);
    return BigInt(encodeTransaction(transaction).byteLength);
  }

  // TODO: allow uint8array for chunks
  addOpReturnOutput(chunks: string[]): this {
    this.outputs.push(createOpReturnOutput(chunks));
    return this;
  }

  setLocktime(locktime: number): this {
    this.locktime = locktime;
    return this;
  }

  protected checkMaxFee(transaction: LibauthTransaction): void {
    const totalInputAmount = this.inputs.reduce((total, input) => total + input.satoshis, 0n);
    const totalOutputAmount = this.outputs.reduce((total, output) => total + output.amount, 0n);
    const fee = totalInputAmount - totalOutputAmount;

    if (fee < 0n) {
      throw new Error(
        `Transaction outputs (${totalOutputAmount}) exceed inputs (${totalInputAmount}). `
        + 'This transaction is invalid.',
      );
    }

    if (this.options.maximumFeeSatoshis !== undefined && fee > this.options.maximumFeeSatoshis) {
      throw new Error(`Transaction fee of ${fee} is higher than max fee of ${this.options.maximumFeeSatoshis}`);
    }

    const maxFeePerByte = this.options.maximumFeeSatsPerByte ?? DEFAULT_MAX_FEE_SATS_PER_BYTE;
    const transactionSize = encodeTransaction(transaction).byteLength;
    const feePerByte = Number(fee) / transactionSize;

    if (feePerByte > maxFeePerByte) {
      throw new Error(
        `Transaction fee per byte of ${feePerByte.toFixed(2)} is higher than max fee per byte of ${maxFeePerByte}. `
        + 'This may indicate a missing change output. Set maximumFeeSatsPerByte to override.',
      );
    }
  }

  protected checkFungibleTokenBurn(): void {
    if (this.options.allowImplicitFungibleTokenBurn) return;

    const tokenInputAmounts: Record<string, bigint> = {};
    const tokenOutputAmounts: Record<string, bigint> = {};

    for (const input of this.inputs) {
      if (input.token?.amount) {
        tokenInputAmounts[input.token.category] = (tokenInputAmounts[input.token.category] || 0n) + input.token.amount;
      }
    }
    for (const output of this.outputs) {
      if (output.token?.amount) {
        tokenOutputAmounts[output.token.category] = (tokenOutputAmounts[output.token.category] || 0n) + output.token.amount;
      }
    }

    for (const [category, inputAmount] of Object.entries(tokenInputAmounts)) {
      const outputAmount = tokenOutputAmounts[category] || 0n;
      if (outputAmount < inputAmount) {
        throw new Error(`Implicit burning of fungible tokens for category ${category} is not allowed (input amount: ${inputAmount}, output amount: ${outputAmount}). If this is intended, set allowImplicitFungibleTokenBurn to true.`);
      }
    }
  }

  protected checkNftBurn(): void {
    if (this.options.allowImplicitNftBurn) return;

    // For mutable/minting NFTs, commitments can legitimately change (e.g. state updates),
    // so we track by category:capability only. For immutable NFTs, the commitment is
    // fixed and part of the NFT's identity, so we include it in the key.
    const nftKey = (category: string, capability: string, commitment: string): string => (
      capability === 'none'
        ? `${category}:${capability}:${commitment}`
        : `${category}:${capability}`
    );

    const inputNfts: Map<string, number> = new Map();
    const outputNfts: Map<string, number> = new Map();

    for (const input of this.inputs) {
      if (!input.token?.nft) continue;
      const key = nftKey(input.token.category, input.token.nft.capability, input.token.nft.commitment);
      inputNfts.set(key, (inputNfts.get(key) ?? 0) + 1);
    }

    for (const output of this.outputs) {
      if (!output.token?.nft) continue;
      const key = nftKey(output.token.category, output.token.nft.capability, output.token.nft.commitment);
      outputNfts.set(key, (outputNfts.get(key) ?? 0) + 1);
    }

    for (const [key, inputCount] of inputNfts) {
      const outputCount = outputNfts.get(key) ?? 0;
      if (outputCount < inputCount) {
        const parts = key.split(':');
        const category = parts[0];
        const capability = parts[1];
        throw new Error(
          `Implicit burning of NFT for category ${category} is not allowed `
          + `(capability: ${capability}, `
          + `input count: ${inputCount}, output count: ${outputCount}). `
          + 'If this is intended, set allowImplicitNftBurn to true.',
        );
      }
    }
  }

  buildLibauthTransaction(skipChecks: boolean = false): LibauthTransaction {
    if (!skipChecks) {
      this.checkFungibleTokenBurn();
      this.checkNftBurn();
    }

    const inputs: LibauthTransaction['inputs'] = this.inputs.map((utxo) => ({
      outpointIndex: utxo.vout,
      outpointTransactionHash: hexToBin(utxo.txid),
      sequenceNumber: utxo.options?.sequence ?? DEFAULT_SEQUENCE,
      unlockingBytecode: new Uint8Array(),
    }));

    const outputs = this.outputs.map(solidCashOutputToLibauthOutput);

    const transaction = {
      inputs,
      locktime: this.locktime,
      outputs,
      version: 2,
    };

    // Generate source outputs from inputs (for signing with SIGHASH_UTXOS)
    const sourceOutputs = generateLibauthSourceOutputs(this.inputs);

    const inputScripts = this.inputs.map((input, inputIndex) => (
      input.unlocker.generateUnlockingBytecode({ transaction, sourceOutputs, inputIndex })
    ));

    inputScripts.forEach((script, i) => {
      transaction.inputs[i].unlockingBytecode = script;
    });

    return transaction;
  }

  build(): string {
    if (this.inputs.length === 0) {
      throw new Error('Transaction must have at least one input');
    }
    if (this.outputs.length === 0) {
      throw new Error('Transaction must have at least one output');
    }

    const transaction = this.buildLibauthTransaction();
    this.checkMaxFee(transaction);
    return binToHex(encodeTransaction(transaction));
  }

  debug(): DebugResults {
    if (this.inputs.some((input) => !isStandardUnlockableUtxo(input))) {
      throw new Error('Cannot debug a transaction with custom unlocker');
    }

    // We can typecast this because we check that all inputs are standard unlockable in the check above
    const contractVersions = (this.inputs as StandardUnlockableUtxo[])
      .map((input) => 'contract' in input.unlocker ? input.unlocker.contract.artifact.compiler.version : null)
      .filter((version) => version !== null);

    if (!contractVersions.every((version) => semver.satisfies(version, '>=0.11.0'))) {
      console.warn('For the best debugging experience, please recompile your contract with solidc version 0.11.0 or newer.');
    }

    return debugLibauthTemplate(this.getLibauthTemplate(), this);
  }

  getVmResourceUsage(verbose: boolean = false): Array<VmResourceUsage> {
    // Note that only StandardUnlockableUtxo inputs are supported for debugging, so any transaction with custom unlockers
    // cannot be debugged (and therefore cannot return VM resource usage)
    const results = this.debug();
    const vmResourceUsage: Array<VmResourceUsage> = [];
    const tableData: Array<Record<string, any>> = [];

    const formatMetric = (value: number, total: number, withPercentage: boolean = false): string =>
      `${formatNumber(value)} / ${formatNumber(total)}${withPercentage ? ` (${(value / total * 100).toFixed(0)}%)` : ''}`;
    const formatNumber = (value: number): string => value.toLocaleString('en');

    const resultEntries = Object.entries(results);
    for (const [index, input] of this.inputs.entries()) {
      const [, result] = resultEntries.find(([entryKey]) => entryKey.includes(`input${index}`)) ?? [];
      const metrics = result?.at(-1)?.metrics;

      // Should not happen
      if (!metrics) throw new Error('VM resource could not be calculated');

      vmResourceUsage.push(metrics);
      tableData.push({
        'Contract - Function': isContractUnlocker(input.unlocker) ? `${input.unlocker.contract.name} - ${input.unlocker.abiFunction.name}` : 'P2PKH Input',
        Ops: metrics.evaluatedInstructionCount,
        'Op Cost Budget Usage': formatMetric(metrics.operationCost, metrics.maximumOperationCost, true),
        SigChecks: formatMetric(metrics.signatureCheckCount, metrics.maximumSignatureCheckCount),
        Hashes: formatMetric(metrics.hashDigestIterations, metrics.maximumHashDigestIterations),
      });
    }

    if (verbose) {
      console.log('VM Resource usage by inputs:');
      console.table(tableData);
    }

    return vmResourceUsage;
  }

  getBitauthUri(): string {
    console.warn('WARNING: it is unsafe to use this Bitauth URI when using real private keys as they are included in the transaction template');
    return getBitauthUri(this.getLibauthTemplate());
  }

  getLibauthTemplate(): WalletTemplate {
    return getLibauthTemplate(this);
  }

  async send(): Promise<TransactionDetails>;
  async send(raw: true): Promise<string>;
  async send(raw?: true): Promise<TransactionDetails | string> {
    if (!this.options.skipAutomaticCoSpends) {
      // Auto co-spend the blockhash(n) oracle (last input) before sidecars, which would otherwise claim it.
      await this.addRequiredBlockhashCoSpends();
      // Auto co-spend keccak256 compute-and-commit side-cars (the default keccak model) from the recorded param.
      await this.addRequiredKeccakComputeCoSpends();
      // Auto co-spend ecrecoverPubKey recovery side-car pairs (A checkpoints, B commits the recovered pubkey).
      await this.addRequiredEcrecoverComputeCoSpends();
      // Co-spend any required INLINE external-library side-cars (multi-call keccak, user libraries) before building.
      await this.addRequiredSidecars();
    }

    // Build the transaction, then debug (for script-level errors), then check fees.
    // This order ensures FailedRequireError takes precedence over fee validation errors.
    const transaction = this.buildLibauthTransaction();

    const allStandard = this.inputs.every((input) => isStandardUnlockableUtxo(input));
    const hasCovenant = this.inputs.some((input) => isUnlockableUtxo(input) && isCovenantUnlocker(input.unlocker));
    if (allStandard) {
      if (hasCovenant) {
        // Covenant inputs are debugged on a best-effort basis: the debug template correctly
        // evaluates covenant scripts, but mock network providers may not supply production-quality
        // UTXO data (value balance, token categories), so errors are not propagated.
        try { this.debug(); } catch (_e) { /* best-effort */ }
      } else {
        this.debug();
      }
    }

    this.checkMaxFee(transaction);
    const tx = binToHex(encodeTransaction(transaction));

    // X131, the finalized-bytes gate at `TransactionBuilder.send`, one of the seven live broadcast sites in
    // `src/`. It reads the DECODED broadcast bytes rather than a
    // re-derived shape, so it judges exactly what `sendRawTransaction` is about to receive.
    //
    // IT SPEAKS LAST, deliberately. `debug()` above already refused every script-level failure it can see, so a
    // transaction that cannot execute still reports its semantic cause; only bytes that would execute reach a
    // relay or consensus verdict here. That ordering is what keeps the gate from masking a covenant diagnostic
    // with whichever size or dust observation happens to be true of the same transaction.
    //
    // MEASURED BEFORE LANDING, not assumed: 1,170 sends through this site across the whole SDK e2e population,
    // 1,159 of which the provider accepted, and the byte rules refuse NONE of them. See
    // `test/e2e/layer3-gatesite-probe.ts` for the per-site table and `test/e2e/X131SendFinalizedBytesGate.test.ts`
    // for the throw census that confirms it after the gate was applied.
    //
    // IT DOES NOT READ `provider.policy`, AND MUST NOT START (X157, decided). The observation that prompted the
    // question - `addOutput` admits a below-dust output when `enforceDust` is false, so the dust rule is only
    // reachable where the provider then accepts the same bytes - reads as the gate refusing more than the
    // network does, and it is not. Measured at 100/472/473/474/475 satoshis, the SAME mock told to model relay
    // policy refuses exactly the set the gate refuses, to the satoshi; `enforceDust: false` sets
    // `standard: false` and `dustRelayFeePerKb: 0n`, which is a harness that models no relay policy at all.
    // `MockNetworkProvider` is also the only provider in `src/network/` that publishes `policy`, so wiring it
    // in here would soften the gate on the test harness and on nothing else. Only the caller's explicit
    // `allowNonRelayable` may suppress a policy refusal.
    //
    // X158. THE OVER-LIMIT REFUSAL LIVES HERE, and this is the only place it can. `solidc` warns when the
    // un-constructed script passes 10,000 bytes and cannot do better: it does not know the constructor
    // arguments, the redeem push prefix or the call arguments, and consensus limits their SUM. Measured on one
    // contract family, the true boundary is 122 bytes below the compiler's threshold, so contracts that
    // compile without a diagnostic are refused here. `inputSubjectsOfBuilder` gives the refusal the contract
    // name the input index alone does not carry.
    //
    // X186. THE TWO RESIDUAL WINDOWS ABOVE ARE CLOSED HERE, not by reordering. `debug()` speaks first only for
    // a STANDARD NON-COVENANT transaction; a covenant input is debugged best-effort and the result SWALLOWED
    // (see the try/catch above), and a custom unlocker is not debugged at all. On those two paths the gate was
    // the first decider to speak, which is the shape that absorbs a hostile's real cause into a dust message -
    // exactly how the seventh vacuous guard on this effort was made. `assertFinalizedBytesWithCovenant` asks
    // the covenant WHENEVER the bytes are refused and reports both, so neither can mask the other and the
    // ordering decides nothing. It costs nothing on the admitted path: the bytes are assessed first and an
    // admitted verdict returns before the VM is touched, so all 1,159 accepted sends the X126 probe measured
    // through this site are byte-for-byte unaffected.
    assertFinalizedBytesWithCovenant(this, decodeTransactionUnsafe(hexToBin(tx)), inputSubjectsOfBuilder(this));

    let txid: string;
    try {
      txid = await this.provider.sendRawTransaction(tx);
    } catch (e: any) {
      const reason = e.error ?? e.message;
      let bitauthUri: string;
      try { bitauthUri = this.getBitauthUri(); } catch { bitauthUri = ''; }
      throw new FailedTransactionError(reason, bitauthUri);
    }

    // Verify the returned txid matches the locally computed hash (outside try/catch
    // so mismatch errors are not swallowed into FailedTransactionError with bitauthUri)
    const txBin = hexToBin(tx);
    const expectedTxid = binToHex(hash256(txBin).reverse());
    if (txid !== expectedTxid) {
      throw new Error(
        `Txid mismatch: provider returned '${txid}', expected '${expectedTxid}'. `
        + 'The network provider may be compromised.',
      );
    }

    try {
      return raw ? await this.getTxDetails(txid, raw) : await this.getTxDetails(txid);
    } catch (e: any) {
      const reason = e.error ?? e.message;
      let bitauthUri: string;
      try { bitauthUri = this.getBitauthUri(); } catch { bitauthUri = ''; }
      throw new FailedTransactionError(reason, bitauthUri);
    }
  }

  private async getTxDetails(txid: string): Promise<TransactionDetails>;
  private async getTxDetails(txid: string, raw: true): Promise<string>;
  private async getTxDetails(txid: string, raw?: true): Promise<TransactionDetails | string> {
    for (let retries = 0; retries < 1200; retries += 1) {
      await delay(500);
      try {
        const hex = await this.provider.getRawTransaction(txid);

        // Verify the fetched transaction matches the expected txid
        const fetchedTxid = binToHex(hash256(hexToBin(hex)).reverse());
        if (fetchedTxid !== txid) {
          throw new Error(
            `getTxDetails: fetched transaction hash '${fetchedTxid}' does not match expected txid '${txid}'.`,
          );
        }

        if (raw) return hex;

        const libauthTransaction = decodeTransaction(hexToBin(hex)) as LibauthTransaction;
        return attachWait({ ...libauthTransaction, txid, hex }, this.provider);
      } catch (e: any) {
        // Propagate txid mismatch errors immediately - they indicate provider tampering
        if (e?.message?.includes('does not match expected txid')) {
          throw e;
        }
        // Other errors (network timeout, tx not yet indexed) are retriable
      }
    }

    // Should not happen
    throw new Error(`Could not retrieve transaction details for txid '${txid}' after 1200 retries (~10 minutes). The transaction may not have been accepted by the network.`);
  }

  generateWcTransactionObject(options?: WcTransactionOptions): WcTransactionObject {
    const encodedTransaction = this.build();
    const transaction = decodeTransactionUnsafe(hexToBin(encodedTransaction));

    const libauthSourceOutputs = generateLibauthSourceOutputs(this.inputs);
    const sourceOutputs: WcSourceOutput[] = libauthSourceOutputs.map((sourceOutput, index) => {
      return {
        ...sourceOutput,
        ...transaction.inputs[index],
        ...getWcContractInfo(this.inputs[index]),
      };
    });
    return { ...options, transaction, sourceOutputs };
  }
}
