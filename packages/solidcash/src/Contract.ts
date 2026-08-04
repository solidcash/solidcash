import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  AbiFunction,
  Artifact,
  asmToScript,
  calculateBytesize,
  countOpcodes,
  generateContractBytecodeScript,
  hash256,
  Op,
  scriptToBytecode,
  StateLayout,
} from '@solidcash/utils';
import {
  ConstructorArgument, encodeFunctionArgument, encodeConstructorArguments, FunctionArgument,
  isSignatureTemplateArray,
} from './Argument.js';
import {
  Unlocker, ContractOptions, GenerateUnlockingBytecodeOptions, Utxo, AddressType, ContractUnlocker, LibauthOutput,
} from './interfaces.js';
import NetworkProvider from './network/NetworkProvider.js';
import {
  addressToLockScript, createUnlockingBytecode, createSighashPreimage, scriptToAddress,
} from './utils.js';
import SignatureTemplate from './SignatureTemplate.js';
import { ParamsToTuple, AbiToFunctionMap } from './types/type-inference.js';
import {
  buildOpaqueLoopCallTransaction, deriveOpaqueLoopCoSpends,
  type OpaqueLoopCallContext, type OpaqueLoopContractCall, type OpaqueLoopCoSpend, type ExternalTargetEntry,
} from './loop-call.js';
import type { TransactionBuilder } from './TransactionBuilder.js';
import semver from 'semver';

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
    // verifies the impl calldata begins with the selector) matches. Libraries are excluded (selector-less path).
    this.unlock = {};
    const soleFn = artifact.abi.length === 1 ? artifact.abi[0] : undefined;
    const soleFnIsProxyImpl = soleFn?.modifiers?.includes('delegate') && !artifact.isLibrary;
    if (soleFn && !soleFnIsProxyImpl) {
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
              createUnlockingBytecode(this.addressType, hexToBin(this.bytecode), [], undefined)
            );
            const generateLockingBytecode = (): Uint8Array => addressToLockScript(this.address);
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

    let contractBytecodeScript = generateContractBytecodeScript(
      asmToScript(this.artifact.bytecode), this.encodedConstructorArgs,
    );

    // Contracts using an INLINE-model external library (e.g. keccak256) are spent with a budget pad pushed
    // on top of the unlocking; the redeem drops it before any logic runs (see budgetPad / co-spend wiring).
    // Result-NFT (compute-and-commit) libraries need no pad: the side-car runs keccak in its OWN budget, so
    // the contract only reads the result by introspection (no blob loader, no OP_DROP).
    this.usesExternalLibraries = !!artifact.externalLibraries?.some((l) => !l.resultNft);
    if (this.usesExternalLibraries) {
      contractBytecodeScript = [Op.OP_DROP, ...contractBytecodeScript];
    }

    this.isStateful = !!artifact.stateLayout;

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
    if (this.salt && this.salt.length > 0) {
      contractBytecodeScript = [this.salt, Op.OP_DROP, ...contractBytecodeScript];
    }

    this.name = artifact.contractName;
    this.address = scriptToAddress(contractBytecodeScript, this.provider.network, this.addressType, false);
    this.tokenAddress = scriptToAddress(contractBytecodeScript, this.provider.network, this.addressType, true);
    this.bytecode = binToHex(scriptToBytecode(contractBytecodeScript));
    this.lockingBytecode = this.addressType === 'p2s' ? this.bytecode : binToHex(addressToLockScript(this.address));
    this.bytesize = calculateBytesize(contractBytecodeScript);
    this.opcount = countOpcodes(contractBytecodeScript);

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

      const bytecode = hexToBin(this.bytecode);

      // For multi-function contracts with OP_INVOKE dispatch, OP_CHECKSIG inside an
      // OP_INVOKE'd function uses the function body as coveredBytecode (not the full
      // redeemScript). Use the function body bytecode for signature computation.
      const selectorHex = selector ? binToHex(selector) : undefined;
      const signingBytecode = (selectorHex && this.artifact.functionBodies?.[selectorHex])
        ? hexToBin(this.artifact.functionBodies[selectorHex])
        : bytecode;
      const signingBytecodeForArgument = (inputName: string): Uint8Array => {
        const match = /^__message_bus_sig_(\d+)_\d+_r\d+$/.exec(inputName);
        if (!match) return signingBytecode;
        const handler = this.artifact.messageBus?.handlers[Number(match[1])];
        const handlerBody = handler?.signatureBytecode;
        if (!handlerBody) {
          // A signature parameter may only be forwarded by this participant;
          // its child owns the CHECKSIG and receives its own per-input
          // signature. The forwarding route still needs a well-typed 65-byte
          // witness, so sign its ordinary route body. If this participant
          // performs CHECKSIG, the compiler always publishes signatureBytecode.
          return signingBytecode;
        }
        return hexToBin(handlerBody);
      };

      const structs = this.artifact.structs ?? this.artifact.stateLayout?.structs;
      const encodedArgs = args
        .map((arg, i) => encodeFunctionArgument(arg, argInputs[i].type, structs));

      const generateUnlockingBytecode = (
        { transaction, sourceOutputs, inputIndex }: GenerateUnlockingBytecodeOptions,
      ): Uint8Array => {
        const completeArgs = encodedArgs.map((arg, index) => {
          if (!(arg instanceof SignatureTemplate) && !isSignatureTemplateArray(arg)) return arg;

          // Generate transaction signature from SignatureTemplate
          const coveredBytecode = signingBytecodeForArgument(argInputs[index].name);
          const sign = (template: SignatureTemplate): Uint8Array => template.generateSignature(hash256(
            createSighashPreimage(
              transaction, sourceOutputs, inputIndex, coveredBytecode, template.getHashType(),
            ),
          ));
          if (arg instanceof SignatureTemplate) return sign(arg);
          return encodeFunctionArgument(arg.map(sign), argInputs[index].type, structs) as Uint8Array;
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

        const unlockingBytecode = createUnlockingBytecode(this.addressType, hexToBin(this.bytecode), finalArgs, selector);
        return unlockingBytecode;
      };

      const generateLockingBytecode = (): Uint8Array => addressToLockScript(this.address);

      return { generateUnlockingBytecode, generateLockingBytecode, contract: this, params: args, abiFunction };
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
      // artifact-specialized verifier inputs carry the canonical callManifest.
      const messageEnvelopePlaceholder = scriptToBytecode([new Uint8Array()]);
      const generateUnlockingBytecode = (
        options: GenerateUnlockingBytecodeOptions,
      ): Uint8Array => {
        const ordinary = unlocker.generateUnlockingBytecode(options);
        // The selector is always the minimal push4 frame (5 bytes). Duplicate
        // the executable blob here as the canonical positional second push;
        // the message-bus batch covenant proves this copy equals its decoded batchBlob arg.
        return new Uint8Array([
          ...ordinary.slice(0, 5),
          ...positionalPush,
          ...messageEnvelopePlaceholder,
          ...ordinary.slice(5),
        ]);
      };
      // message-bus batch is a compiler-owned covenant even when the source handler has no state slots. Mark the master
      // unlocker itself so zero-state participant blocks receive the same best-effort artifact-debug treatment
      // as routes which happen to include a data/container covenant input; finalized-byte preflight remains the
      // authoritative broadcast gate in both cases.
      return { ...unlocker, generateUnlockingBytecode, covenantUnlocker: true };
    };
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
    const blocksPerCall = Math.max(1, Math.floor(inputBytes / 136) + 1);
    const calls = abiFunction.externalLibraryCalls?.keccak256 ?? 1;
    const totalBlocks = Math.min(3, calls * blocksPerCall);
    return new Uint8Array(totalBlocks * 2900);
  }
}

type ContractFunctionUnlocker = (...args: FunctionArgument[]) => ContractUnlocker;
