import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { bigIntToVmNumber } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
import {
  type AbiFunction,
  type Artifact,
  asmToScript,
  CALL_RECORD_NO_READER,
  CALL_RECORD_READER_INPUT,
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
import {
  bindArtifactOraclePool, boundOraclePool, isPoolInfoOutput, isPoolSlotOutput, withOraclePoolArgument,
} from './oracle/pool/reader.js';
import semver from 'semver';

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

/** What a run no caller reads takes for each witness its caller would name: no record, no reader, no genesis call. */
const STANDALONE_WITNESSES: ReadonlyMap<string, () => FunctionArgument> = new Map([
  ['__internal__returnOutputIdx', (): FunctionArgument => -1n],
  [CALL_RECORD_READER_INPUT, (): FunctionArgument => CALL_RECORD_NO_READER],
  ['__internal__genesisCall', (): FunctionArgument => new Uint8Array()],
]);

/**
 * A physical frame naming every input but the standalone witnesses (a delegate entry's proxy master, say), completed
 * with their standalone values at their ABI positions. Any other frame is returned as given.
 */
function completeStandaloneFrame(
  abiFunction: AbiFunction, args: FunctionArgument[], visibleCount: number,
): FunctionArgument[] {
  const named = abiFunction.inputs.filter((input) => !STANDALONE_WITNESSES.has(input.name)).length;
  if (args.length === abiFunction.inputs.length || args.length === visibleCount || args.length !== named) return args;
  let next = 0;
  return abiFunction.inputs.map((input) => {
    const standalone = STANDALONE_WITNESSES.get(input.name);
    return standalone === undefined ? args[next++] : standalone();
  });
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
  /** The oracle pool a block.* reader binds (its category, display order), from its `__oraclePool` argument. */
  oraclePool?: string;

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

    const expectedProperties = ['abi', 'bytecode', 'constructorInputs', 'contractName', 'compiler'];
    if (!expectedProperties.every((property) => property in artifact)) {
      throw new Error('Invalid or incomplete artifact provided');
    }

    if (!semver.satisfies(artifact.compiler.version, '>=0.7.0', { includePrerelease: true })) {
      throw new Error(`Artifact compiled with unsupported compiler version: ${artifact.compiler.version}, required >=0.7.0`);
    }

    // A block.* reader takes its pool binding as the last input, which the SDK fills: callers leave it out.
    const completeArgs = withOraclePoolArgument(
      artifact, constructorArgs, () => this.options.oraclePool ?? this.provider.oraclePoolCategory,
    ) as TResolved['constructorInputs'];
    this.constructorArgs = completeArgs;
    this.rawConstructorArgs = completeArgs;

    if (artifact.constructorInputs.length !== completeArgs.length) {
      throw new Error(`Incorrect number of arguments passed to ${artifact.contractName} constructor. Expected ${artifact.constructorInputs.length} arguments (${artifact.constructorInputs.map((input) => input.type)}) but got ${completeArgs.length}`);
    }

    // Encode arguments (this also performs type checking)
    this.encodedConstructorArgs = encodeConstructorArguments(artifact, completeArgs);
    this.oraclePool = boundOraclePool(artifact, this.encodedConstructorArgs);
    if (this.oraclePool !== undefined) {
      if (this.options.oraclePool !== undefined && this.options.oraclePool.toLowerCase() !== this.oraclePool) {
        throw new Error(
          `${artifact.contractName}'s __oraclePool argument binds pool ${this.oraclePool}, not the oraclePool `
          + `${this.options.oraclePool}`,
        );
      }
      bindArtifactOraclePool(artifact, this.oraclePool);
    }

    // Populate the 'unlock' object with the contract's functions
    // (with a special case for single function, which has no "function selector") - EXCEPT a single DELEGATE
    // function on a proxy impl keeps its selector, mirroring the compiler dispatch, so a proxy delegatecall (which
    // verifies the impl calldata begins with the selector) matches. Ordinary libraries are selector-less, but
    // split facets are branded library-shaped artifacts whose delegate dispatcher deliberately retains it.
    this.unlock = {};
    const soleFn = artifact.abi.length === 1 ? artifact.abi[0] : undefined;
    const soleFnIsProxyImpl = soleFn?.modifiers?.includes('delegate')
      && (!artifact.isLibrary || artifact.delegateOnly === true);
    // The multi-call entry is a second selector in the redeem script.
    const soleFnSharesCallBatch = typeof artifact.callBatch === 'object';
    if (soleFn && !soleFnIsProxyImpl && !soleFnSharesCallBatch) {
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
    return (...supplied: FunctionArgument[]) => {
      // __internal__ params (e.g. the blockhash co-spend index) are SDK-filled. Stateless callers pass only
      // the visible args and the unlocker fills the internals; the stateful orchestrator passes the full
      // list already filled; a hand-built physical frame may leave out the standalone witnesses, which take
      // their standalone values. Accept each shape.
      const visibleInputs = abiFunction.inputs.filter((input) => !input.name.startsWith('__internal__'));
      const args = completeStandaloneFrame(abiFunction, supplied, visibleInputs.length);
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
;

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
      const needsOracleIndex = !internalsProvided && abiFunction.inputs.some(
        (input) => input.name === '__internal__blockOracleInputIndex',
      );
      const cacheUnlockingBytecode = !hasSignatures && !needsBlockhashIndex && !needsOracleIndex;
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
          const coveredBytecode = signingBytecode;
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

        // Fill the synthesized pool co-spend indices (locate the pool's coins among the spent inputs);
        // composition-safe - the reader does not assume the last input. Appended after the visible args, in ABI order.
        // Skipped when the caller already provided the full arg list (stateful orchestrator).
        const synthArgs = internalsProvided ? [] : abiFunction.inputs.flatMap((input): Uint8Array[] => {
          if (input.name === '__internal__blockhashInputIndex') {
            return this.resolveBlockhashIndexArgs(abiFunction, sourceOutputs);
          }
          if (input.name === '__internal__blockOracleInputIndex') {
            return this.resolveBlockOracleIndexArgs(abiFunction, sourceOutputs);
          }
          // A spend no caller made names no record, and no reader.
          if (input.name === '__internal__returnOutputIdx') return [bigIntToVmNumber(-1n)];
          if (input.name === CALL_RECORD_READER_INPUT) return [bigIntToVmNumber(CALL_RECORD_NO_READER)];
          // An ordinary call does not answer a constructor's genesis call.
          if (input.name === '__internal__genesisCall') return [new Uint8Array()];
          return [];
        });

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

  /**
   * @internal The unlocker of one ABI entry. A name's dispatcher picks an overload by its input count, hidden
   * witnesses included, so two overloads taking as many inputs are told apart only by the entry itself.
   */
  unlockerFor(abiFunction: AbiFunction): ContractFunctionUnlocker {
    const overloaded = this.artifact.abi.filter((entry) => entry.name === abiFunction.name).length > 1;
    const byName = this.unlock[abiFunction.name] as ContractFunctionUnlocker | undefined;
    if (!overloaded && byName !== undefined) return byName;
    return this.createUnlocker(abiFunction, abiFunction.selector ? hexToBin(abiFunction.selector) : undefined);
  }

  

  /**
   * An unlocker for the multi-call entry (`artifact.callBatch`): one spend of the master runs `frames` in order,
   * frame k settling its call record under ordinal k. A frame names a `callBatchRow` entry and its complete ABI
   * argument list, hidden witnesses included. The unlocking bytecode is `<sel> [frame 0]..[frame K-1] <K>`, a frame
   * being the entry's standalone pushes, then its selector.
   */
  createCallBatchUnlocker(
    frames: readonly { readonly abiFunction: AbiFunction; readonly args: readonly FunctionArgument[] }[],
  ): ContractUnlocker {
    const batch = this.artifact.callBatch;
    if (typeof batch !== 'object') throw new Error(`${this.artifact.contractName} carries no multi-call entry`);
    if (frames.length === 0) throw new Error('A multi-call spend runs at least one frame');
    if (this.addressType === 'p2s') throw new Error('The multi-call entry is spent through its redeem script');
    const structs = this.artifact.structs ?? this.artifact.stateLayout?.structs;
    const pushes: Uint8Array[] = [];
    for (const { abiFunction, args } of frames) {
      if (abiFunction.callBatchRow !== true || abiFunction.selector === undefined) {
        throw new Error(`'${abiFunction.name}' cannot run as a frame of the multi-call entry`);
      }
      if (args.length !== abiFunction.inputs.length) {
        throw new Error(`A '${abiFunction.name}' frame takes all ${abiFunction.inputs.length} of its ABI arguments`);
      }
      const encoded = args.map((arg, index) => encodeFunctionArgument(arg, abiFunction.inputs[index].type, structs));
      if (!encoded.every((value): value is Uint8Array => value instanceof Uint8Array)) {
        throw new Error(`A '${abiFunction.name}' frame takes no signature`);
      }
      pushes.push(...encoded.reverse(), hexToBin(abiFunction.selector));
    }
    const unlockingBytecode = Uint8Array.from([
      ...scriptToBytecode([hexToBin(batch.selector), ...pushes, bigIntToVmNumber(BigInt(frames.length))]),
      ...scriptToBytecode([this.bytecodeBin]),
    ]);
    return {
      generateUnlockingBytecode: (): Uint8Array => unlockingBytecode,
      generateLockingBytecode: (): Uint8Array => addressToLockScript(this.address),
      contract: this,
      params: [],
      abiFunction: { name: 'callBatch', selector: batch.selector, inputs: [] },
      covenantUnlocker: true,
    };
  }

  /** @internal Construct an unlocker from an enriched ABI entry while preserving this artifact's
   * selector-dispatch policy. Stateful composition adds compiler-owned inputs after Contract construction,
   * so its final ABI entry can be newer than the name-based unlocker captured by the constructor. */
  createAbiUnlocker(abiFunction: AbiFunction): ContractFunctionUnlocker {
    const soleFn = this.artifact.abi.length === 1 ? this.artifact.abi[0] : undefined;
    const soleFnIsProxyImpl = soleFn?.modifiers?.includes('delegate')
      && (!this.artifact.isLibrary || this.artifact.delegateOnly === true);
    const soleFnSharesCallBatch = typeof this.artifact.callBatch === 'object';
    const selector = soleFn && !soleFnIsProxyImpl && !soleFnSharesCallBatch
      ? undefined
      : abiFunction.selector ? hexToBin(abiFunction.selector) : undefined;
    return this.createUnlocker(abiFunction, selector);
  }

  /**
   * The base index of a stateless reader's blockhash reads: the first ring slot of the pool this contract binds, found
   * by category and flags. Its reads' slots follow it in order.
   */
  private resolveBlockhashIndexArgs(abiFunction: AbiFunction, sourceOutputs: LibauthOutput[]): Uint8Array[] {
    const wanted = abiFunction.inputs.some((input) => input.name === '__internal__blockhashInputIndex');
    if (!wanted) return [];
    const pool = this.oraclePool;
    if (pool === undefined) throw new Error(`${this.name} reads blockhash(n), and binds no oracle pool`);
    const index = sourceOutputs.findIndex((output) => isPoolSlotOutput(output, pool));
    if (index < 0) throw new Error(`${this.name} reads blockhash(n), and the transaction spends no slot of pool ${pool}`);
    return [bigIntToVmNumber(BigInt(index))];
  }

  /** The co-spend index of a block-info coin of the pool this contract binds, found by category and flags. */
  private resolveBlockOracleIndexArgs(
    abiFunction: AbiFunction, sourceOutputs: LibauthOutput[],
  ): Uint8Array[] {
    const wanted = abiFunction.inputs.some((input) => input.name === '__internal__blockOracleInputIndex');
    if (!wanted) return [];
    const pool = this.oraclePool;
    if (pool === undefined) throw new Error(`${this.name} reads the block oracle, and binds no oracle pool`);
    const index = sourceOutputs.findIndex((output) => isPoolInfoOutput(output, pool));
    if (index < 0) {
      throw new Error(`${this.name} reads the block oracle, and the transaction spends no info coin of pool ${pool}`);
    }
    return [bigIntToVmNumber(BigInt(index))];
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
