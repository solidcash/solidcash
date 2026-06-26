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
    // (with a special case for single function, which has no "function selector")
    this.unlock = {};
    if (artifact.abi.length === 1) {
      const f = artifact.abi[0];
      // @ts-ignore TODO: see if we can use generics to make TypeScript happy
      this.unlock[f.name] = this.createUnlocker(f);
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

    // Contracts using an external library (e.g. keccak256) are spent with a budget pad pushed on top
    // of the unlocking; the redeem drops it before any logic runs (see budgetPad / co-spend wiring).
    this.usesExternalLibraries = !!artifact.externalLibraries?.length;
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

  static generateSalt(length: number = 32): Uint8Array {
    const salt = new Uint8Array(length);
    crypto.getRandomValues(salt);
    return salt;
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
      const internalsProvided = args.length === abiFunction.inputs.length && abiFunction.inputs.length !== visibleInputs.length;
      const argInputs = internalsProvided ? abiFunction.inputs : visibleInputs;

      const bytecode = hexToBin(this.bytecode);

      // For multi-function contracts with OP_INVOKE dispatch, OP_CHECKSIG inside an
      // OP_INVOKE'd function uses the function body as coveredBytecode (not the full
      // redeemScript). Use the function body bytecode for signature computation.
      const selectorHex = selector ? binToHex(selector) : undefined;
      const signingBytecode = (selectorHex && this.artifact.functionBodies?.[selectorHex])
        ? hexToBin(this.artifact.functionBodies[selectorHex])
        : bytecode;

      const encodedArgs = args
        .map((arg, i) => encodeFunctionArgument(arg, argInputs[i].type));

      const generateUnlockingBytecode = (
        { transaction, sourceOutputs, inputIndex }: GenerateUnlockingBytecodeOptions,
      ): Uint8Array => {
        const completeArgs = encodedArgs.map((arg) => {
          if (!(arg instanceof SignatureTemplate)) return arg;

          // Generate transaction signature from SignatureTemplate
          const preimage = createSighashPreimage(transaction, sourceOutputs, inputIndex, signingBytecode, arg.getHashType());
          const sighash = hash256(preimage);
          return arg.generateSignature(sighash);
        });

        // Fill the synthesized blockhash co-spend index (locate the C_oracle UTXO among the spent inputs);
        // composition-safe - the reader does not assume the last input. Appended after the visible args.
        // Skipped when the caller already provided the full arg list (stateful orchestrator).
        const synthArgs = internalsProvided ? [] : this.resolveBlockhashIndexArgs(abiFunction, sourceOutputs);

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

  // Resolve the synthesized blockhash co-spend index: locate the co-spent (n->hash) oracle UTXO (token
  // category == blockhashOracleCategory) among the spent inputs and return its index as the
  // __internal__blockhashInputIndex arg. Empty when the function reads no blockhash. The VM re-verifies
  // category + commitment.n, so a wrong index just fails the script (sound regardless of placement).
  private resolveBlockhashIndexArgs(abiFunction: AbiFunction, sourceOutputs: LibauthOutput[]): Uint8Array[] {
    const bhIdx = abiFunction.inputs.find((inp) => inp.name === '__internal__blockhashInputIndex');
    if (!bhIdx) return [];
    const category = this.artifact.compiler.options?.blockhashOracleCategory;
    if (!category) throw new Error('blockhash(n): contract compiled without blockhashOracleCategory');
    const index = sourceOutputs.findIndex((so) => so.token && binToHex(so.token.category) === category);
    if (index < 0) {
      throw new Error(`blockhash(n): no (n->hash) oracle UTXO co-spent (token category ${category}); add it `
        + 'via the TransactionBuilder auto-injection or resolveBlockhashCoSpend.');
    }
    return [encodeFunctionArgument(BigInt(index), bhIdx.type) as Uint8Array];
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
    const blocks = Math.min(3, Math.max(1, Math.floor(inputBytes / 136) + 1));
    return new Uint8Array(blocks * 2900);
  }
}

type ContractFunctionUnlocker = (...args: FunctionArgument[]) => ContractUnlocker;
