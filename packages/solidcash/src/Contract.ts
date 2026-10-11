import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { bigIntToVmNumber } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
import {
  type AbiFunction,
  type Artifact,
  asmToScript,
  bytecodeToScript,
  countOpcodes,
  generateContractBytecodeScript,
  hash256,
  Op,
  scriptToBytecode,
  type StateLayout,
} from '@solidcash/utils';
import {
  type ConstructorArgument, encodeFunctionArgument, encodeConstructorArguments, type FunctionArgument,
  isDeferredSignatureArgument,
} from './Argument.js';
import type {
  Unlocker, ContractOptions, GenerateUnlockingBytecodeOptions, Utxo, AddressType, ContractUnlocker, LibauthOutput,
} from './interfaces.js';
import type NetworkProvider from './network/NetworkProvider.js';
import {
  addressToLockScript, createUnlockingBytecode, createSighashPreimage, scriptToAddress,
} from './utils.js';
import SignatureTemplate from './SignatureTemplate.js';
import type { ParamsToTuple, AbiToFunctionMap } from './types/type-inference.js';
import {
  buildOpaqueLoopCallTransaction, deriveOpaqueLoopCoSpends,
  type OpaqueLoopCallContext, type OpaqueLoopContractCall, type OpaqueLoopCoSpend, type ExternalTargetEntry,
} from './loop-call.js';
import type { TransactionBuilder } from './TransactionBuilder.js';
import semver from 'semver';
import { ConsensusBch2026 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-consensus.js';
import { decodeKernelEntryJournalAccesses } from './stateful/KernelEntryJournal.js';

const KERNEL_ROUTE_DENSITY_BASE_RESERVE_BYTES = 520;
// Each target/predecessor selector scans exactly through its zero-based record ordinal. The emitted selector uses
// at most 25 priced scan/decode operations per visited record at BCH's 100-unit base operation price. The fixed
// header, identity, ordinal, and commitment checks fit in a conservative 17,000-unit envelope per access.
const KERNEL_ROUTE_OPERATION_COST_PER_RECORD_SCAN = 25 * 100;
const KERNEL_ROUTE_FIXED_OPERATION_COST_PER_ACCESS = 17_000;
const KERNEL_ROUTE_DENSITY_MAX_RESERVE_BYTES = ConsensusBch2026.maximumStackItemLength;

/**
 * Size the existing discarded kernel-route reserve from the physical access program the composer supplied.
 * Record selection cost grows with these fixed-width entries, while a constant 520-byte reserve does not. The
 * route covenant still authenticates every stream and its declared count; malformed public arguments cannot gain
 * authority by increasing this budget, and the result is capped at BCH-2026's stack-item limit.
 */
/** @internal Exported for exact boundary tests; not re-exported from the package API. */
export function kernelRouteDensityReserveBytes(accessStreams: FunctionArgument | undefined): number {
  if (!Array.isArray(accessStreams)) return KERNEL_ROUTE_DENSITY_BASE_RESERVE_BYTES;
  let accessCount = 0;
  let recordScanCount = 0;
  const visit = (value: FunctionArgument): void => {
    if (value instanceof Uint8Array) {
      try {
        const accesses = decodeKernelEntryJournalAccesses(value);
        accessCount += accesses.length;
        for (const access of accesses) {
          recordScanCount += access.targetRecordOrdinal + 1;
          if (access.predecessorRecordOrdinal !== undefined) {
            recordScanCount += access.predecessorRecordOrdinal + 1;
          }
        }
      } catch {
        // Malformed public arguments have no authority and fail in the route covenant. They must not allocate
        // density padding merely because their byte length resembles an access stream.
      }
      return;
    }
    if (Array.isArray(value)) value.forEach(visit);
  };
  accessStreams.forEach(visit);
  const operationCost = accessCount * KERNEL_ROUTE_FIXED_OPERATION_COST_PER_ACCESS
    + recordScanCount * KERNEL_ROUTE_OPERATION_COST_PER_RECORD_SCAN;
  return Math.min(
    KERNEL_ROUTE_DENSITY_MAX_RESERVE_BYTES,
    KERNEL_ROUTE_DENSITY_BASE_RESERVE_BYTES
      + Math.ceil(operationCost / ConsensusBch2026.operationCostBudgetPerByte),
  );
}

// A kernel row-loop route reserves its complete effect band up front and walks the frame's whole dispatch loop
// on every invocation, so its input-0 operation cost is a property of the reserved site count, not of the rows
// actually dispatched. MEASURED on the kernel event route (sites 255): the complete input-0 cost is ~3.86M
// against a 1.91M budget, so the density length must grow by ~2.4 KB for the program to finish at all; a
// one-byte reserve (the size the reported overrun suggests) does not. The journal-access reserve above does not
// apply here because an effect-only route publishes no access streams. Size an envelope per reserved site, like
// the access reserve, so only a route that reserves an effect band is padded by this much.
const KERNEL_ROUTE_EFFECT_OPERATION_COST_PER_SITE = 8_000;

/**
 * Size the discarded density reserve for a kernel row-loop effect route from its reserved effect band. Only a
 * route that reserves events, BCH transfers, token transfers or child deployments needs it; every other route
 * keeps the zero-length reserve, so unrelated pinned unlocking-bytecode lengths are unaffected.
 */
/** @internal Exported for exact boundary tests; not re-exported from the package API. */
export function kernelRouteEffectDensityReserveBytes(
  abiFunction: AbiFunction, convention: string | undefined,
): number {
  if (convention !== 'kernel-row-loop') return 0;
  const frame = abiFunction.graphEffectFrame;
  if (frame === undefined) return 0;
  const reservesEffectBand = frame.eventWidth > 0 || frame.transferWidth > 0
    || frame.tokenTransferWidth > 0 || (frame.deployWidth ?? 0) > 0;
  if (!reservesEffectBand || !Number.isSafeInteger(frame.sites) || frame.sites < 1) return 0;
  return Math.min(
    KERNEL_ROUTE_DENSITY_MAX_RESERVE_BYTES,
    Math.ceil((frame.sites * KERNEL_ROUTE_EFFECT_OPERATION_COST_PER_SITE)
      / ConsensusBch2026.operationCostBudgetPerByte),
  );
}

// A kernel row-loop route that reserves signature-row witness leaves carries the reconstruction and CHECKSIG
// program for those leaves, and that program IS the input's density control length. The framed outline pass
// shrinks the program, so a route can lose budget without losing the reserved verification work it must still
// perform. MEASURED on the composite-signature route (2 reserved leaves): the outline removed 14 script bytes,
// i.e. 11,200 units of budget, for only 8,957 units of cost, leaving input 0 53 units over; a one-byte reserve
// does not help because turning the discarded OP_0 slot into a non-empty push costs about 800 units by itself.
// Price one reserved signature check per leaf instead, as the journal and effect reserves price their work.
const KERNEL_ROUTE_SIGNATURE_ROW_INPUT = /^__message_bus_sig_\d+_\d+(?:_\d+)?_rows$/;

/**
 * Size the discarded density reserve for a kernel row-loop route that reserves signature-row witness leaves.
 * Only a route whose ABI declares those leaves needs it; every other route keeps the zero-length reserve, so
 * unrelated pinned unlocking-bytecode lengths are unaffected.
 */
/** @internal Exported for exact boundary tests; not re-exported from the package API. */
export function kernelRouteSignatureDensityReserveBytes(
  abiFunction: AbiFunction, convention: string | undefined,
): number {
  if (convention !== 'kernel-row-loop') return 0;
  const leaves = abiFunction.inputs
    .filter((input) => KERNEL_ROUTE_SIGNATURE_ROW_INPUT.test(input.name)).length;
  if (leaves < 1) return 0;
  return Math.min(
    KERNEL_ROUTE_DENSITY_MAX_RESERVE_BYTES,
    Math.ceil((leaves * ConsensusBch2026.signatureCheckCost)
      / ConsensusBch2026.operationCostBudgetPerByte),
  );
}

/** Attach the V5 canonical manifest to the root compiler-route frame, without changing its ABI arguments. */
export function withCompilerRouteMessageEnvelope(
  unlocker: ContractUnlocker, messageEnvelope: Uint8Array, maximumInputBytes: number,
  executorInputIndex = 0,
): ContractUnlocker {
  const capability = unlocker.contract.artifact.messageBus;
  const envelopeLocation = capability?.atomicMessageBus?.messageEnvelope as
    | { region?: string; canonicalInput?: string; unlockingPush?: number } | undefined;
  const directRoot = executorInputIndex === 0;
  const transport = directRoot ? 'root-route' : 'proxy-forward';
  const canonicalInput = directRoot ? 'root-participant-master' : 'root-proxy-master';
  if (capability?.verifierProgram?.envelopeTransport !== transport
    || envelopeLocation?.region !== transport
    || envelopeLocation.canonicalInput !== canonicalInput
    || envelopeLocation.unlockingPush !== 1
    || !Number.isSafeInteger(executorInputIndex) || executorInputIndex < 0
    || !Number.isSafeInteger(maximumInputBytes) || maximumInputBytes < 1
    || messageEnvelope.length < 1
    || messageEnvelope.length > 0xffff
    || messageEnvelope.length > ConsensusBch2026.maximumStackItemLength) {
    throw new Error('messageBus: compiler-route envelope requires a supported V5 artifact and bounded carrier');
  }
  // The selector is a fixed push4 at bytes 0..4. Inserting exactly one PUSHDATA2 at byte 5 leaves the
  // historical positional batch and reserve pushes, followed by the ABI frame, in their original order.
  const carrier = new Uint8Array(3 + messageEnvelope.length);
  carrier[0] = 0x4d;
  carrier[1] = messageEnvelope.length & 0xff;
  carrier[2] = messageEnvelope.length >>> 8;
  carrier.set(messageEnvelope, 3);
  return {
    ...unlocker,
    generateUnlockingBytecode(options): Uint8Array {
      if (options.inputIndex !== executorInputIndex) {
        throw new Error(`messageBus: V5 route envelope must occupy input ${executorInputIndex}`);
      }
      const ordinary = unlocker.generateUnlockingBytecode(options);
      if (ordinary.length < 5 || ordinary[0] !== 4
        || binToHex(ordinary.slice(1, 5)) !== '53434231') {
        throw new Error('messageBus: V5 root input 0 must use the SCB1 compiler route');
      }
      const length = ordinary.length + carrier.length;
      if (length > maximumInputBytes) {
        throw new Error(
          `messageBus: V5 root carrier requires ${length} unlocking-bytecode bytes; maximum is ${maximumInputBytes}`,
        );
      }
      const result = new Uint8Array(length);
      result.set(ordinary.slice(0, 5), 0);
      result.set(carrier, 5);
      result.set(ordinary.slice(5), 5 + carrier.length);
      return result;
    },
  };
}

/** Mirror the root executor's SCB1 + envelope prefix in an unchanged baked proxy's `__forward(bytes)` arg. */
export function withProxyForwardMessageEnvelope(
  unlocker: ContractUnlocker, messageEnvelope: Uint8Array, maximumInputBytes: number,
  executorInputIndex: number,
): ContractUnlocker {
  const inputs = unlocker.abiFunction?.inputs ?? [];
  const maximumStackItemBytes = unlocker.contract.provider.consensusLimits?.maximumStackItemBytes
    ?? ConsensusBch2026.maximumStackItemLength;
  if (unlocker.abiFunction?.name !== '__forward'
    || inputs.length !== 2 || inputs[0]?.name !== 'input' || inputs[0].type !== 'bytes'
    || inputs[1]?.name !== '__internal__delegateInputIndex' || inputs[1].type !== 'bigint'
    || !Number.isSafeInteger(executorInputIndex) || executorInputIndex < 1
    || !Number.isSafeInteger(maximumInputBytes) || maximumInputBytes < 1
    || messageEnvelope.length < 1 || messageEnvelope.length > 0xffff
    || messageEnvelope.length + 7 > Math.min(
      maximumStackItemBytes, ConsensusBch2026.maximumStackItemLength,
    )) {
    throw new Error('messageBus: proxy-forward envelope requires a bounded baked __forward(bytes) frame');
  }
  const payload = new Uint8Array(7 + messageEnvelope.length);
  payload.set([0x53, 0x43, 0x42, 0x31, 0x4d,
    messageEnvelope.length & 0xff, messageEnvelope.length >>> 8]);
  payload.set(messageEnvelope, 7);
  const expectedIndex = scriptToBytecode([bigIntToVmNumber(BigInt(executorInputIndex))]);
  let cachedOrdinary: Uint8Array | undefined;
  let cachedForward: Uint8Array | undefined;
  return {
    ...unlocker,
    generateUnlockingBytecode(options): Uint8Array {
      if (options.inputIndex !== 0) {
        throw new Error('messageBus: proxy-forward envelope must occupy input 0');
      }
      const ordinary = unlocker.generateUnlockingBytecode(options);
      if (ordinary === cachedOrdinary && cachedForward !== undefined) return cachedForward;
      const frame = bytecodeToScript(ordinary);
      if (frame.length !== 3 || !(frame[1] instanceof Uint8Array)
        || binToHex(frame[1]) !== '53434231' || !(frame[2] instanceof Uint8Array)
        || binToHex(scriptToBytecode([frame[0]!])) !== binToHex(expectedIndex)) {
        throw new Error('messageBus: proxy-forward root must pin SCB1 to its actual executor input');
      }
      const result = scriptToBytecode([frame[0]!, payload, frame[2]]);
      if (result.length > maximumInputBytes) {
        throw new Error(
          `messageBus: proxy-forward carrier requires ${result.length} unlocking-bytecode bytes; maximum is ${maximumInputBytes}`,
        );
      }
      cachedOrdinary = ordinary;
      cachedForward = result;
      return result;
    },
  };
}

// Large generated contracts can carry multi-megabyte ASM listings. Stateful deployment and proxy wiring create
// several Contract instances from the exact same artifact (withCategory, logical-address attachment, delegates).
// Parsing that immutable listing for every instance retains enormous duplicate instruction/data graphs. Cache only
// the artifact's category-independent base script; constructor arguments, category pins, salts, and library pads are
// still composed independently below.
const parsedArtifactScripts = new WeakMap<object, ReturnType<typeof asmToScript>>();
const parsedBytecodeScripts = new Map<string, ReturnType<typeof asmToScript>>();
const composedBytecodeScripts = new Map<string, Map<string, ReturnType<typeof asmToScript>>>();
interface ComposedContractMetrics {
  address: string;
  tokenAddress: string;
  bytecode: string;
  bytecodeBin: Uint8Array;
  lockingBytecode: string;
  bytesize: number;
  opcount: number;
}
const composedContractMetrics = new Map<string, Map<string, ComposedContractMetrics>>();
const parsedFunctionBodies = new Map<string, Uint8Array>();

function parsedFunctionBody(body: string): Uint8Array {
  let parsed = parsedFunctionBodies.get(body);
  if (!parsed) {
    parsed = hexToBin(body);
    parsedFunctionBodies.set(body, parsed);
  }
  return parsed;
}

function parsedArtifactScript(artifact: Artifact): ReturnType<typeof asmToScript> {
  const key = artifact as object;
  let script = parsedArtifactScripts.get(key);
  if (!script) {
    script = parsedBytecodeScripts.get(artifact.bytecode);
    if (!script) {
      script = asmToScript(artifact.bytecode);
      parsedBytecodeScripts.set(artifact.bytecode, script);
    }
    parsedArtifactScripts.set(key, script);
  }
  return script;
}

export class Contract<
  TArtifact extends Artifact = Artifact,
  TResolved extends {
    constructorInputs: ConstructorArgument[];
    unlock: Record<string, any>;
  }
  = {
    constructorInputs: ParamsToTuple<TArtifact['constructorInputs']>;
    unlock: AbiToFunctionMap<TArtifact['abi'], Unlocker>;
  },
> {
  name: string;
  address: string;
  tokenAddress: string;
  lockingBytecode: string;
  bytecode: string;
  private bytecodeBin: Uint8Array;
  bytesize: number;
  opcount: number;
  unlock: TResolved['unlock'];
  provider: NetworkProvider;
  addressType: AddressType;
  isStateful: boolean;
  usesExternalLibraries: boolean;
  salt?: Uint8Array;
  category?: Uint8Array;

  encodedConstructorArgs: Uint8Array[];
  private rawConstructorArgs: TResolved['constructorInputs'];

  // Unified external-target registry (address-keyed): the single store for both the typed array external-call
  // path (IFoo(arr[i]).m(), grouped by interfaceName) and opaque loop dispatch (contract.multiCall, by address).
  // Plus a funder for the opaque path's return-event sats + fee.
  private externalTargets: ExternalTargetEntry[] = [];
  private loopFunder?: { utxo: Utxo; unlocker: Unlocker };

  constructor(
    public artifact: TArtifact,
    public constructorArgs: TResolved['constructorInputs'],
    private options: ContractOptions,
  ) {
    this.provider = this.options.provider;
    this.addressType = this.options.addressType ?? 'p2sh32';
    this.salt = this.options.salt;
    if (this.salt && this.salt.length > 520) {
      throw new Error('Salt must be 520 bytes or less');
    }
    this.category = this.options.category;
    this.rawConstructorArgs = constructorArgs;

    const expectedProperties = ['abi', 'bytecode', 'constructorInputs', 'contractName', 'compiler'];
    if (!expectedProperties.every((property) => property in artifact)) {
      throw new Error('Invalid or incomplete artifact provided');
    }

    if (!semver.satisfies(artifact.compiler.version, '>=0.7.0', { includePrerelease: true })) {
      throw new Error(`Artifact compiled with unsupported compiler version: ${artifact.compiler.version}, required >=0.7.0`);
    }

    if (artifact.constructorInputs.length !== constructorArgs.length) {
      throw new Error(`Incorrect number of arguments passed to ${artifact.contractName} constructor. Expected ${artifact.constructorInputs.length} arguments (${artifact.constructorInputs.map((input) => input.type)}) but got ${constructorArgs.length}`);
    }

    // Encode arguments (this also performs type checking)
    this.encodedConstructorArgs = encodeConstructorArguments(artifact, constructorArgs);

    // Populate the 'unlock' object with the contract's functions
    // (with a special case for single function, which has no "function selector") - EXCEPT a single DELEGATE
    // function on a proxy impl keeps its selector, mirroring the compiler dispatch, so a proxy delegatecall (which
    // verifies the impl calldata begins with the selector) matches. Ordinary libraries are selector-less, but
    // split facets are branded library-shaped artifacts whose delegate dispatcher deliberately retains it.
    this.unlock = {};
    const soleFn = artifact.abi.length === 1 ? artifact.abi[0] : undefined;
    const soleFnIsProxyImpl = soleFn?.modifiers?.includes('delegate')
      && (!artifact.isLibrary || artifact.delegateOnly === true);
    // A compiler-owned message-bus route is intentionally absent from the public ABI, but it is still a second
    // executable selector in the redeem script. Treating the sole source function as selectorless then places its
    // first argument in the dispatch-selector position and the covenant rejects before either function executes.
    // `available` is additive metadata. Older artifacts with `messageBus` omitted the field but still contain the
    // executable SCB1 selector, so only an explicit false means there is no hidden route in the redeem script.
    const soleFnSharesCompilerRoute = artifact.messageBus !== undefined
      && artifact.messageBus.available !== false
      && artifact.messageBus.routeInBytecode !== false;
    if (soleFn && !soleFnIsProxyImpl && !soleFnSharesCompilerRoute) {
      // @ts-ignore TODO: see if we can use generics to make TypeScript happy
      this.unlock[soleFn.name] = this.createUnlocker(soleFn);
    } else {
      // Group ABI entries by name to detect overloads
      const nameGroups = new Map<string, { func: AbiFunction }[]>();
      artifact.abi.forEach((f) => {
        const group = nameGroups.get(f.name) ?? [];
        group.push({ func: f });
        nameGroups.set(f.name, group);
      });

      for (const [name, group] of nameGroups) {
        // Register special fallback/receive unlockers
        if (group.length === 1 && group[0].func.isReceive) {
          // receive(): push NO args and NO selector - the redeemScript already pushes constructor args,
          // so stack depth == M (constructor param count) triggers receive dispatch
          const f = group[0].func;
          // @ts-ignore TODO: see if we can use generics to make TypeScript happy
          this.unlock.receive = () => {
            const generateUnlockingBytecode = (): Uint8Array => (
              createUnlockingBytecode(this.addressType, this.bytecodeBin, [], undefined)
            );
            // p2s (raw-script) contracts carry their hex address as the raw bytecode, which addressToLockScript
            // cannot parse as a CashAddress; the raw bytes already exist on the contract.
            const generateLockingBytecode = (): Uint8Array => (
              this.addressType === 'p2s' ? this.bytecodeBin : addressToLockScript(this.address)
            );
            return {
              generateUnlockingBytecode, generateLockingBytecode, contract: this, params: [], abiFunction: f,
            } as ContractUnlocker;
          };
          continue;
        }
        if (group.length === 1 && group[0].func.isFallback) {
          // fallback(): normal unlocker with fallback's own selector
          const f = group[0].func;
          const selector = f.selector ? hexToBin(f.selector) : undefined;
          // @ts-ignore TODO: see if we can use generics to make TypeScript happy
          this.unlock.fallback = this.createUnlocker(f, selector);
          continue;
        }
        if (group.length === 1) {
          // Non-overloaded: register by plain name
          const selector = group[0].func.selector ? hexToBin(group[0].func.selector) : undefined;
          // @ts-ignore TODO: see if we can use generics to make TypeScript happy
          this.unlock[name] = this.createUnlocker(group[0].func, selector);
        } else {
          // Overloaded: register each by explicit signature
          for (const { func } of group) {
            const sig = `${func.name}(${func.inputs.map((inp) => inp.type).join(',')})`;
            const selector = func.selector ? hexToBin(func.selector) : undefined;
            // @ts-ignore TODO: see if we can use generics to make TypeScript happy
            this.unlock[sig] = this.createUnlocker(func, selector);
          }

          // Check if all overloads have different argument counts
          const argCounts = group.map((g) => g.func.inputs.length);
          const uniqueArgCounts = new Set(argCounts);
          if (uniqueArgCounts.size === group.length) {
            // All overloads have different arg counts - register a smart dispatcher on the plain name
            const countMap = new Map(group.map((g) => [g.func.inputs.length, g]));
            // @ts-ignore TODO: see if we can use generics to make TypeScript happy
            this.unlock[name] = (...args: FunctionArgument[]) => {
              const entry = countMap.get(args.length);
              if (!entry) {
                const available = group.map((g) => `${g.func.name}(${g.func.inputs.map((inp) => inp.type).join(',')})`);
                throw new Error(
                  `No overload of function '${name}' accepts ${args.length} arguments. `
                  + `Available signatures: ${available.join(', ')}`,
                );
              }
              const sel = entry.func.selector ? hexToBin(entry.func.selector) : undefined;
              return this.createUnlocker(entry.func, sel)(...args);
            };
          } else {
            // Same argument count overloads exist - plain name throws helpful error
            // @ts-ignore TODO: see if we can use generics to make TypeScript happy
            this.unlock[name] = (..._args: FunctionArgument[]) => {
              const available = group.map((g) => `${g.func.name}(${g.func.inputs.map((inp) => inp.type).join(',')})`);
              throw new Error(
                `Ambiguous call to overloaded function '${name}'. `
                + `Use explicit signature: ${available.join(', ')}`,
              );
            };
          }
        }
      }
    }

    // Contracts using an INLINE-model external library (e.g. keccak256) are spent with a budget pad pushed
    // on top of the unlocking; the redeem drops it before any logic runs (see budgetPad / co-spend wiring).
    // Result-NFT (compute-and-commit) libraries need no pad: the side-car runs keccak in its OWN budget, so
    // the contract only reads the result by introspection (no blob loader, no OP_DROP).
    this.usesExternalLibraries = !!artifact.externalLibraries?.some((l) => !l.resultNft);
    this.isStateful = !!artifact.stateLayout;

    const compositionKey = [
      this.encodedConstructorArgs.map(binToHex).join(','),
      this.usesExternalLibraries ? 'library-pad' : '',
      this.isStateful && this.category ? binToHex(this.category) : '',
      this.salt === undefined ? 'no-salt' : `salt:${binToHex(this.salt)}`,
    ].join('|');
    let compositions = composedBytecodeScripts.get(artifact.bytecode);
    if (!compositions) {
      compositions = new Map();
      composedBytecodeScripts.set(artifact.bytecode, compositions);
    }
    let contractBytecodeScript = compositions.get(compositionKey);
    if (!contractBytecodeScript) {
      contractBytecodeScript = generateContractBytecodeScript(
        parsedArtifactScript(this.artifact), this.encodedConstructorArgs,
      );
      if (this.usesExternalLibraries) {
        contractBytecodeScript = [Op.OP_DROP, ...contractBytecodeScript];
      }

      // Category self-pin (stateful contracts): bake the category and verify the spent UTXO's category equals
      // it, so the address commits to the category (address => genuine state). This reworks the former dead
      // `<salt> OP_DROP` into a live check. It is the script prologue (runs before constructor args + dispatch),
      // so it is one contract-level check covering every function, including selfdestruct/unsafe.
      //
      // A stateful contract's spent UTXO is always its master = the MINTING NFT (capability 0x02), and
      // capabilities never change, so OP_UTXOTOKENCATEGORY returns `category(32) || 0x02`. We bake that exact
      // 33-byte value (internal byte order + the 0x02 minting capability) and compare directly - no need to
      // split off the capability byte. This also pins the capability, rejecting a same-category UTXO with the
      // wrong capability. See docs/external-contract-calls.md.
      if (this.isStateful && this.category && this.category.length > 0) {
        const catWithCapability = Uint8Array.from([...this.category.slice().reverse(), 0x02]);
        contractBytecodeScript = [
          catWithCapability, Op.OP_INPUTINDEX, Op.OP_UTXOTOKENCATEGORY, Op.OP_EQUALVERIFY,
          ...contractBytecodeScript,
        ];
      }

      // User CREATE2 salt (optional, any contract): a dead push baked into the script for deterministic /
      // counterfactual address control. Separate, outermost segment (distinct from the category self-pin).
      if (this.salt !== undefined) {
        contractBytecodeScript = [this.salt, Op.OP_DROP, ...contractBytecodeScript];
      }
      compositions.set(compositionKey, contractBytecodeScript);
    }

    const metricsKey = `${this.provider.network}|${this.addressType}|${compositionKey}`;
    let metricsByComposition = composedContractMetrics.get(artifact.bytecode);
    if (!metricsByComposition) {
      metricsByComposition = new Map();
      composedContractMetrics.set(artifact.bytecode, metricsByComposition);
    }
    let metrics = metricsByComposition.get(metricsKey);
    if (!metrics) {
      const serialized = scriptToBytecode(contractBytecodeScript);
      const bytecode = binToHex(serialized);
      const address = scriptToAddress(contractBytecodeScript, this.provider.network, this.addressType, false);
      metrics = {
        address,
        tokenAddress: scriptToAddress(contractBytecodeScript, this.provider.network, this.addressType, true),
        bytecode,
        bytecodeBin: serialized,
        lockingBytecode: this.addressType === 'p2s' ? bytecode : binToHex(addressToLockScript(address)),
        bytesize: serialized.byteLength,
        opcount: countOpcodes(contractBytecodeScript),
      };
      metricsByComposition.set(metricsKey, metrics);
    }
    this.name = artifact.contractName;
    this.address = metrics.address;
    this.tokenAddress = metrics.tokenAddress;
    this.bytecode = metrics.bytecode;
    this.bytecodeBin = metrics.bytecodeBin;
    this.lockingBytecode = metrics.lockingBytecode;
    this.bytesize = metrics.bytesize;
    this.opcount = metrics.opcount;

    // Expose opaque loop-dispatch functions (the MultiCall pattern) as direct fluent methods, so a caller can
    // write `contract.multiCall({ callerUtxo, targets, funder })` instead of buildOpaqueLoopCallTransaction(...).
    // Detected from the ABI: an external call with an opaque return over a calldata/param address array. Skipped
    // when the name would shadow a built-in member.
    for (const fn of artifact.abi) {
      const isLoopDispatch = fn.externalCalls?.some(
        (ec) => ec.opaqueReturn && ec.loopArrayVar && fn.inputs.some((inp) => inp.name === ec.loopArrayVar),
      );
      if (isLoopDispatch && !(fn.name in this)) {
        // contract.multiCall(targets, data, ctx?) - targets/data mirror the Solidity signature; ctx is optional.
        // When omitted, cospends derive from registerLoopTargets, funder from registerLoopFunder, and callerUtxo
        // from the contract's own UTXOs - so a fully-registered caller can write contract.multiCall(targets, data).
        const fnName = fn.name;
        (this as any)[fnName] = (
          targets: Uint8Array[], data: Uint8Array[], ctx: OpaqueLoopCallContext = {},
        ): Promise<TransactionBuilder> => this.dispatchOpaqueLoop(fnName, targets, data, ctx);
      }
    }
  }

  get stateLayout(): StateLayout | undefined {
    return this.artifact.stateLayout;
  }

  async getBalance(): Promise<bigint> {
    const utxos = await this.getUtxos();
    return utxos.reduce((acc, utxo) => acc + utxo.satoshis, 0n);
  }

  async getUtxos(): Promise<Utxo[]> {
    if (this.addressType === 'p2s') {
      return this.provider.getUtxosForLockingBytecode(this.bytecode);
    }

    // Token-aware address so a contract sees all its UTXOs (plain + CashToken) at its script.
    return this.provider.getUtxos(this.tokenAddress);
  }

  withSalt(salt: Uint8Array): Contract<TArtifact, TResolved> {
    return new Contract(this.artifact, this.rawConstructorArgs, { ...this.options, salt }) as any;
  }

  // Bake the contract's state-NFT category (display byte order) as the self-pin prologue (stateful contracts).
  withCategory(category: Uint8Array): Contract<TArtifact, TResolved> {
    return new Contract(this.artifact, this.rawConstructorArgs, { ...this.options, category }) as any;
  }

  /**
   * The same contract compiled as a proxy implementation: its state writes target a co-spent proxy master
   * instead of its own UTXO. Source never marks this (Solidity has no `delegate` keyword); the compiler emits
   * the variant alongside the standalone one. Deploy THIS contract as the implementation behind a proxy - it is
   * a different script, so it has a different address than the standalone contract.
   */
  asDelegate(): Contract<TArtifact, TResolved> {
    const delegateArtifact = this.artifact.delegateArtifact;
    if (!delegateArtifact) {
      throw new Error(
        `${this.artifact.contractName} has no delegate variant, so it cannot serve as a proxy implementation. A `
        + 'function qualifies when it is externally callable, touches state the proxy owns (a state write, an '
        + 'emit, or a low-level call), and carries no view/pure/internal/private/unsafe/upgrade/deploy/'
        + 'selfdestruct/split/merge modifier. Value transfers and token-container operations are excluded: they '
        + 'do not execute in delegate mode. See packages/solidc/docs/delegatecall.md.',
      );
    }
    return new Contract(delegateArtifact, this.rawConstructorArgs, this.options) as any;
  }

  static generateSalt(length: number = 32): Uint8Array {
    const salt = new Uint8Array(length);
    crypto.getRandomValues(salt);
    return salt;
  }

  // --- Unified external-target registry API (shared by the typed array path + opaque loop dispatch) ---

  /** Add an entry to the unified external-target registry (keyed by address). */
  registerExternalTarget(entry: ExternalTargetEntry): this {
    this.externalTargets.push(entry);
    return this;
  }

  /** Look up a registered external target by address (locking bytecode hex). */
  getExternalTargetByAddress(addressHex: string): ExternalTargetEntry | undefined {
    return this.externalTargets.find((e) => e.address === addressHex);
  }

  /** The registered instances for a typed array external call `IFoo(arr[i]).m()`, in registration order. */
  getExternalTargetInstancesByInterface(interfaceName: string): unknown[] {
    return this.externalTargets.filter((e) => e.interfaceName === interfaceName).map((e) => e.instance);
  }

  /** The registered entries (instance + optional per-element method) for a typed array call, in order. */
  getExternalTargetEntriesByInterface(interfaceName: string): ExternalTargetEntry[] {
    return this.externalTargets.filter((e) => e.interfaceName === interfaceName);
  }

  /** All registry entries (used to copy the registry across connect()). */
  getExternalTargetEntries(): ExternalTargetEntry[] {
    return this.externalTargets;
  }

  /**
   * Register known target contracts for opaque loop dispatch (contract.multiCall). BCH must know a co-spent
   * contract to satisfy its script, so this is where the artifact/category come in; once registered, multiCall's
   * cospends auto-derive (UTXO via the category-pinned address, unlocker from the artifact, return from state).
   */
  registerLoopTargets(calls: OpaqueLoopContractCall[]): this {
    for (const call of calls) this.registerExternalTarget({ address: call.contract.lockingBytecode, coSpend: call });
    return this;
  }

  /** Register the funding UTXO for opaque loop dispatch (pays the return-event sats + fee). */
  registerLoopFunder(utxo: Utxo, unlocker: Unlocker): this {
    this.loopFunder = { utxo, unlocker };
    return this;
  }

  private async dispatchOpaqueLoop(
    fnName: string, targets: Uint8Array[], data: Uint8Array[], ctx: OpaqueLoopCallContext,
  ): Promise<TransactionBuilder> {
    let cospends: OpaqueLoopCoSpend[] | undefined = ctx.cospends;
    if (!cospends) {
      const calls = targets.map((t) => {
        const spec = this.getExternalTargetByAddress(binToHex(t))?.coSpend;
        if (!spec) {
          throw new Error(`${fnName}: target ${binToHex(t)} not registered; call registerLoopTargets or pass ctx.cospends`);
        }
        return spec;
      });
      ({ cospends } = await deriveOpaqueLoopCoSpends(calls));
    }
    const funder = ctx.funder ?? this.loopFunder;
    if (!funder) throw new Error(`${fnName}: no funder; call registerLoopFunder or pass ctx.funder`);
    let callerUtxo = ctx.callerUtxo;
    if (!callerUtxo) {
      const plain = (await this.getUtxos()).filter((u) => !u.token).sort((a, b) => Number(b.satoshis - a.satoshis));
      if (plain.length === 0) throw new Error(`${fnName}: no plain caller UTXO at ${this.address}; pass ctx.callerUtxo`);
      [callerUtxo] = plain;
    }
    return buildOpaqueLoopCallTransaction({
      provider: this.provider, contract: this, functionName: fnName, targets, data, cospends, funder, callerUtxo,
      returnDust: ctx.returnDust, changeLockingBytecode: ctx.changeLockingBytecode, fee: ctx.fee,
    });
  }

  private createUnlocker(abiFunction: AbiFunction, selector?: Uint8Array): ContractFunctionUnlocker {
    return (...args: FunctionArgument[]) => {
      // __internal__ params (e.g. the blockhash co-spend index) are SDK-filled. Stateless callers pass only
      // the visible args and the unlocker fills the internals; the stateful orchestrator passes the full
      // list already filled. Accept either shape.
      const visibleInputs = abiFunction.inputs.filter((input) => !input.name.startsWith('__internal__'));
      if (args.length !== visibleInputs.length && args.length !== abiFunction.inputs.length) {
        throw new Error(`Incorrect number of arguments passed to function ${abiFunction.name}. Expected ${visibleInputs.length} arguments (${visibleInputs.map((input) => input.type)}) but got ${args.length}`);
      }
      const internalsProvided = args.length === abiFunction.inputs.length
        && abiFunction.inputs.length !== visibleInputs.length;
      const argInputs = internalsProvided ? abiFunction.inputs : visibleInputs;

      const bytecode = this.bytecodeBin;

      // For multi-function contracts with OP_INVOKE dispatch, OP_CHECKSIG inside an
      // OP_INVOKE'd function uses the function body as coveredBytecode (not the full
      // redeemScript). Use the function body bytecode for signature computation.
      const selectorHex = selector ? binToHex(selector) : undefined;
      const signingBytecode = (selectorHex && this.artifact.functionBodies?.[selectorHex])
        ? parsedFunctionBody(this.artifact.functionBodies[selectorHex])
        : bytecode;
      const signingBytecodeForArgument = (inputName: string): Uint8Array => {
        const match = /^__message_bus_sig_(\d+)_(\d+)(?:_(\d+))?(?:_r\d+|_rows)$/.exec(inputName);
        if (!match) return signingBytecode;
        // Witness handler ordinals index the route's eligible dispatch set. The compiler publishes each eligible
        // handler's stable ordinal, so this never re-derives (and disagrees on) the filtered eligible ordering.
        const ordinal = Number(match[1]);
        const handlers = this.artifact.messageBus?.handlers ?? [];
        const handler = handlers.find((candidate) => candidate.witnessOrdinal === ordinal)
          ?? handlers.filter((candidate) => candidate.eligible)[ordinal];
        const parameterBody = handler?.transactionSignaturePolicy?.coveredBytecodes
          ?.find((candidate) => candidate.parameterIndex === Number(match[2])
            && candidate.leafIndex === Number(match[3] ?? 0))?.bytecode;
        if (parameterBody) return parsedFunctionBody(parameterBody);
        const handlerBody = handler?.signatureBytecode;
        if (!handlerBody) {
          // A signature parameter may only be forwarded by this participant;
          // its child owns the CHECKSIG and receives its own per-input
          // signature. The forwarding route still needs a well-typed 65-byte
          // witness, so sign its ordinary route body. If this participant
          // performs CHECKSIG, the compiler always publishes signatureBytecode.
          return signingBytecode;
        }
        return parsedFunctionBody(handlerBody);
      };

      const structs = this.artifact.structs ?? this.artifact.stateLayout?.structs;
      // Coerce ethers-v5 BigNumber / wrapEthersBN objects before encode (MistSwap removeCollateral share).
      const coerceArg = (arg: unknown): unknown => {
        if (arg && typeof arg === 'object' && !(arg instanceof Uint8Array) && !Array.isArray(arg)) {
          const o = arg as { toBigInt?: () => bigint; _value?: unknown };
          if (typeof o.toBigInt === 'function') {
            try { const bi = o.toBigInt(); if (typeof bi === 'bigint') return bi; } catch { /* keep */ }
          }
          if (typeof o._value === 'bigint') return o._value;
        }
        if (Array.isArray(arg)) return arg.map(coerceArg);
        return arg;
      };
      let encodedArgs = args.map((arg, i) => {
        try {
          return encodeFunctionArgument(coerceArg(arg) as never, argInputs[i].type, structs);
        } catch (error) {
          throw new Error(
            `Could not encode argument '${argInputs[i].name}' at index ${i} as ${argInputs[i].type}: `
            + `${error instanceof Error ? error.message : String(error)}`,
            { cause: error },
          );
        }
      });

      // Transaction builders call each unlocker repeatedly while deriving state commitments, fees, and the
      // finalized transaction. Most covenant inputs have no signatures and already include every synthesized
      // internal argument, so their unlocking bytecode is identical in every pass. Large delegate artifacts can
      // otherwise copy and serialize hundreds of kilobytes per input on every probe.
      const hasSignatures = encodedArgs.some(
        (arg) => isDeferredSignatureArgument(arg),
      );
      const needsBlockhashIndex = !internalsProvided && abiFunction.inputs.some(
        (input) => input.name === '__internal__blockhashInputIndex',
      );
      const cacheUnlockingBytecode = !hasSignatures && !needsBlockhashIndex;
      let cachedUnlockingBytecode: Uint8Array | undefined;
      // Redeem push is stable across probe-local ReturnOutputIdx edits; keep it so arg-only
      // rebuilds do not reserialize multi-megabyte redeem scripts every probe.
      let cachedRedeemPush: Uint8Array | undefined;

      // Probe-local layout fixes may mutate `params` (same array as `args`) after construction.
      // Re-encode changed slots and drop the unlocking-bytecode cache so OUTCOMMIT indices stay live.
      const syncEncodedArgsFromParams = (onlyIndices?: readonly number[]): void => {
        const indices = onlyIndices ?? args.map((_, index) => index);
        for (const i of indices) {
          try {
            encodedArgs[i] = encodeFunctionArgument(coerceArg(args[i]) as never, argInputs[i].type, structs);
          } catch (error) {
            throw new Error(
              `Could not encode argument '${argInputs[i].name}' at index ${i} as ${argInputs[i].type}: `
              + `${error instanceof Error ? error.message : String(error)}`,
              { cause: error },
            );
          }
        }
        cachedUnlockingBytecode = undefined;
      };

      const generateUnlockingBytecode = (
        { transaction, sourceOutputs, inputIndex }: GenerateUnlockingBytecodeOptions,
      ): Uint8Array => {
        if (cacheUnlockingBytecode && cachedUnlockingBytecode) return cachedUnlockingBytecode;
        const completeArgs = encodedArgs.map((arg, index) => {
          if (!isDeferredSignatureArgument(arg)) return arg;

          // Generate transaction signature from SignatureTemplate
          const coveredBytecode = signingBytecodeForArgument(argInputs[index].name);
          const sign = (template: SignatureTemplate): Uint8Array => template.generateSignature(hash256(
            createSighashPreimage(
              transaction, sourceOutputs, inputIndex, coveredBytecode, template.sighashType,
            ),
          ));
          const finalize = (value: unknown): ConstructorArgument => {
            if (value instanceof SignatureTemplate) return sign(value);
            if (Array.isArray(value)) return value.map(finalize);
            throw new Error(`Invalid deferred signature argument '${argInputs[index].name}'`);
          };
          if (arg instanceof SignatureTemplate) return sign(arg);
          return encodeFunctionArgument(finalize(arg), argInputs[index].type, structs) as Uint8Array;
        });

        // Fill the synthesized blockhash co-spend index (locate the C_oracle UTXO among the spent inputs);
        // composition-safe - the reader does not assume the last input. Appended after the visible args.
        // Skipped when the caller already provided the full arg list (stateful orchestrator).
        const synthArgs = internalsProvided ? [] : this.resolveBlockhashIndexArgs(abiFunction, sourceOutputs, args);

        // External-library contracts get a budget pad pushed on top (dropped by the redeem's OP_DROP),
        // sizing the per-input op budget to the keccak computation.
        const finalArgs = this.usesExternalLibraries
          ? [this.budgetPad(abiFunction, args), ...completeArgs, ...synthArgs]
          : [...completeArgs, ...synthArgs];

        let unlockingBytecode: Uint8Array;
        if (this.addressType === 'p2s') {
          unlockingBytecode = createUnlockingBytecode(this.addressType, bytecode, finalArgs, selector);
        } else {
          const unlockScript = [...finalArgs].reverse();
          if (selector !== undefined) unlockScript.unshift(selector);
          const argsBytecode = scriptToBytecode(unlockScript);
          if (cachedRedeemPush === undefined) {
            cachedRedeemPush = scriptToBytecode([bytecode]);
          }
          unlockingBytecode = new Uint8Array(argsBytecode.length + cachedRedeemPush.length);
          unlockingBytecode.set(argsBytecode, 0);
          unlockingBytecode.set(cachedRedeemPush, argsBytecode.length);
        }
        if (cacheUnlockingBytecode) cachedUnlockingBytecode = unlockingBytecode;
        return unlockingBytecode;
      };

      // p2s (raw-script) contracts carry their hex address as the raw bytecode, which addressToLockScript cannot
      // parse as a CashAddress; the raw bytes already exist on the contract.
      const generateLockingBytecode = (): Uint8Array => (
        this.addressType === 'p2s' ? this.bytecodeBin : addressToLockScript(this.address)
      );

      return {
        generateUnlockingBytecode,
        generateLockingBytecode,
        contract: this,
        params: args,
        abiFunction,
        syncEncodedArgsFromParams,
      };
    };
  }

  /** @internal Construct an unlocker for a compiler-owned physical route
   * which is advertised outside the source ABI (for example message-bus batch). */
  createCompilerRouteUnlocker(
    abiFunction: AbiFunction, selector: Uint8Array,
  ): ContractFunctionUnlocker {
    const base = this.createUnlocker(abiFunction, selector);
    const batchBlobIndex = abiFunction.inputs.findIndex((input) => input.name === 'batchBlob');
    if (binToHex(selector) !== '53434231' || batchBlobIndex < 0) return base;
    return (...args: FunctionArgument[]) => {
      const unlocker = base(...args);
      const blob = args[batchBlobIndex];
      if (!(blob instanceof Uint8Array)) throw new Error('message-bus batch batchBlob must encode as bytes');
      const positionalPush = scriptToBytecode([blob]);
      // Preserve the historical positional frame without carrying the callManifest in the master. The
      // artifact-specialized verifier inputs carry the canonical callManifest. Kernel journal routes retain a
      // bounded payload in this already-discarded slot: their record scans can otherwise exceed BCH-2026's
      // operation-density budget despite remaining below every absolute operation and script-size limit.
      const kernelJournalRoute = abiFunction.inputs.some(
        (input) => input.name === '__internal__kernelJournalAccessStreams',
      );
      const kernelJournalAccessIndex = abiFunction.inputs.findIndex(
        (input) => input.name === '__internal__kernelJournalAccessStreams',
      );
      const reservedPositionalPush = scriptToBytecode([
        new Uint8Array(kernelJournalRoute
          ? kernelRouteDensityReserveBytes(args[kernelJournalAccessIndex])
          : kernelRouteEffectDensityReserveBytes(abiFunction, this.artifact.messageBus?.convention)
            + kernelRouteSignatureDensityReserveBytes(abiFunction, this.artifact.messageBus?.convention)),
      ]);
      let cachedOrdinary: Uint8Array | undefined;
      let cachedCompilerRoute: Uint8Array | undefined;
      const generateUnlockingBytecode = (
        options: GenerateUnlockingBytecodeOptions,
      ): Uint8Array => {
        const ordinary = unlocker.generateUnlockingBytecode(options);
        // The base unlocker returns the same byte-array instance when its witnesses are transaction-independent.
        // Reuse the corresponding compiler-route frame too; otherwise every probe recopies the complete P2SH
        // redeem script merely to insert two small positional pushes.
        if (ordinary === cachedOrdinary && cachedCompilerRoute !== undefined) return cachedCompilerRoute;
        // The selector is always the minimal push4 frame (5 bytes). Duplicate
        // the executable blob here as the canonical positional second push;
        // the message-bus batch covenant proves this copy equals its decoded batchBlob arg. Both historical
        // positional items stay below the complete ABI frame, so the route can discard them uniformly before
        // any hidden argument is addressed.
        cachedOrdinary = ordinary;
        cachedCompilerRoute = new Uint8Array([
          ...ordinary.slice(0, 5),
          ...positionalPush,
          ...reservedPositionalPush,
          ...ordinary.slice(5),
        ]);
        return cachedCompilerRoute;
      };
      // message-bus batch is a compiler-owned covenant even when the source handler has no state slots. Mark the master
      // unlocker itself so zero-state participant blocks receive the same best-effort artifact-debug treatment
      // as routes which happen to include a data/container covenant input; finalized-byte preflight remains the
      // authoritative broadcast gate in both cases.
      return { ...unlocker, generateUnlockingBytecode, covenantUnlocker: true };
    };
  }

  /** @internal Construct an unlocker from an enriched ABI entry while preserving this artifact's
   * selector-dispatch policy. Stateful composition adds compiler-owned inputs after Contract construction,
   * so its final ABI entry can be newer than the name-based unlocker captured by the constructor. */
  createAbiUnlocker(abiFunction: AbiFunction): ContractFunctionUnlocker {
    const soleFn = this.artifact.abi.length === 1 ? this.artifact.abi[0] : undefined;
    const soleFnIsProxyImpl = soleFn?.modifiers?.includes('delegate')
      && (!this.artifact.isLibrary || this.artifact.delegateOnly === true);
    const soleFnSharesCompilerRoute = this.artifact.messageBus !== undefined
      && this.artifact.messageBus.available !== false
      && this.artifact.messageBus.routeInBytecode !== false;
    const selector = soleFn && !soleFnIsProxyImpl && !soleFnSharesCompilerRoute
      ? undefined
      : abiFunction.selector ? hexToBin(abiFunction.selector) : undefined;
    return this.createUnlocker(abiFunction, selector);
  }

  // blockhash(n) brands its (n->hash) oracle to the contract's OWN category (master-bound), so a reader is
  // always STATEFUL and its co-spend is resolved by StatefulContract via the blockhashOracle block-layout
  // slot. Returns [] when the function reads no blockhash; otherwise reaching this base-Contract path means
  // the call was not built through StatefulContract, which is unsupported - fail loudly.
  private resolveBlockhashIndexArgs(
    abiFunction: AbiFunction, _sourceOutputs: LibauthOutput[], _args: FunctionArgument[],
  ): Uint8Array[] {
    const bhIdx = abiFunction.inputs.find((inp) => inp.name === '__internal__blockhashInputIndex');
    if (!bhIdx) return [];
    // blockhash(n) brands its (n->hash) oracle to the contract's own category, so a reader is always STATEFUL
    // and its co-spend is resolved by StatefulContract (via the blockhashOracle block-layout slot). Reaching
    // the base Contract/TransactionBuilder path means the reader was not built through StatefulContract.
    throw new Error('blockhash(n) is only supported in stateful contracts; build the call via StatefulContract.');
  }

  // Size the budget pad for a call. keccak256 functions need the per-input op budget raised
  // (~800 op/unlocking byte; ~2.25M op per 136-byte block); ~2900 unlocking bytes cover one block.
  // Non-keccak functions of a keccak-using contract still need a 1-byte pad to satisfy the redeem OP_DROP.
  private budgetPad(abiFunction: AbiFunction, args: FunctionArgument[]): Uint8Array {
    if (!abiFunction.externalLibraries?.includes('keccak256')) return new Uint8Array(1);
    const inputBytes = args.reduce((max: number, arg, i) => {
      const type = abiFunction.inputs[i]?.type ?? '';
      return (arg instanceof Uint8Array && (type === 'bytes' || type.startsWith('bytes')))
        ? Math.max(max, arg.length) : max;
    }, 0);
    // Each keccak256 call costs ~1 block of budget per its message block(s); size the pad to the total
    // across all call sites (~2900 unlocking bytes fund one block), so keccak256(keccak256(x)) and
    // multiple keccak256(...) calls are funded. The per-input ~3-block budget limit caps what can fit, so
    // beyond that the tx fails on budget regardless.
    const blocksFramed = Math.max(1, Math.floor(inputBytes / 136) + 1);
    const calls = abiFunction.externalLibraryCalls?.keccak256 ?? 1;
    const totalBlocks = Math.min(3, calls * blocksFramed);
    return new Uint8Array(totalBlocks * 2900);
  }
}

type ContractFunctionUnlocker = (...args: FunctionArgument[]) => ContractUnlocker;
