import {
  binToHex,
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
} from '@solidcash/utils';
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
}

const DEFAULT_SEQUENCE = 0xfffffffe;
const DEFAULT_MAX_FEE_SATS_PER_BYTE = 1000;

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
      validateOutput(output);
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
    // Auto co-spend the blockhash(n) oracle (last input) before sidecars, which would otherwise claim it.
    await this.addRequiredBlockhashCoSpends();
    // Co-spend any required external-library side-cars (e.g. keccak256) before building.
    await this.addRequiredSidecars();

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
