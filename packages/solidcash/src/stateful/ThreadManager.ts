import { Artifact } from '@solidcash/utils';
import { StatefulFunctionCall, ConnectedStatefulContract } from './StatefulContract.js';
import { StateReader } from './StateReader.js';
import { TransactionDetails, Utxo } from '../interfaces.js';
import { FunctionArgument } from '../Argument.js';

export interface SplitOptions {
  /** Name of the non-stateful gate function (e.g. 'authorize') */
  functionName: string;
  /** Arguments for the gate function (e.g. [pubkey, sig]) */
  args: FunctionArgument[];
  /** Number of threads to create */
  threadCount: number;
  /** Optional explicit partition assignment: partitions[i] is the array of data NFT indices for thread i.
   *  If omitted, round-robin partitioning is used. */
  partitions?: number[][];
  fee?: bigint;
  /** Maximum allowed fee (throws if exceeded). Default: 10000n */
  maxFee?: bigint;
}

export interface MergeOptions {
  /** Name of the non-stateful gate function (e.g. 'authorize') */
  functionName: string;
  /** Arguments for the gate function (e.g. [pubkey, sig]) */
  args: FunctionArgument[];
  fee?: bigint;
  /** Maximum allowed fee (throws if exceeded). Default: 10000n */
  maxFee?: bigint;
}

export class ThreadHandle {
  constructor(
    public readonly threadId: number,
    public masterUtxo: Utxo,
    public readonly dataNftIndices: number[],
    private contract: ConnectedStatefulContract,
  ) {}

  /**
   * Call a stateful function scoped to this thread's master and partition.
   * Validates that the function's requiredNftIndices are within this thread's partition.
   */
  call(functionName: string, ...args: any[]): StatefulFunctionCall {
    const abiFunction = this.contract.inner.artifact.abi.find((f) => f.name === functionName);
    if (!abiFunction) {
      throw new Error(`Function '${functionName}' not found in contract ABI`);
    }

    const stateLayout = this.contract.inner.stateLayout!;
    const requiredNftIndices = abiFunction.requiredNftIndices
      ?? Array.from({ length: stateLayout.dataNftCount }, (_, i) => i);

    // Validate that all required NFT indices are within this thread's partition
    for (const idx of requiredNftIndices) {
      if (!this.dataNftIndices.includes(idx)) {
        throw new Error(
          `Function '${functionName}' requires data NFT index ${idx}, `
          + `but thread ${this.threadId} only owns indices [${this.dataNftIndices.join(', ')}]`,
        );
      }
    }

    const builderPromise = this.contract._createBuilder(functionName, args, {
      masterUtxo: this.masterUtxo,
    });

    return new StatefulFunctionCall(builderPromise);
  }

  /**
   * Re-fetch master UTXO from chain.
   */
  async refresh(): Promise<void> {
    const stateLayout = this.contract.inner.stateLayout!;
    const reader = new StateReader(stateLayout);
    const utxos = await this.contract.inner.provider.getUtxos(this.contract.tokenAddress);
    const masterUtxos = reader.findMasterUtxos(utxos, this.contract.categoryId);

    const match = masterUtxos.find(
      (u) => u.txid === this.masterUtxo.txid && u.vout === this.masterUtxo.vout,
    );

    if (!match) {
      // Master may have been spent and recreated - find by thread position
      if (this.threadId < masterUtxos.length) {
        this.masterUtxo = masterUtxos[this.threadId];
      } else {
        throw new Error(
          `Could not find master UTXO for thread ${this.threadId} on-chain`,
        );
      }
    } else {
      this.masterUtxo = match;
    }
  }
}

export class ThreadManager<T extends Artifact = Artifact> {
  private threads: ThreadHandle[] = [];

  constructor(private contract: ConnectedStatefulContract<T>) {
    if (!contract.inner.stateLayout) {
      throw new Error(`Contract ${contract.name} is not a stateful contract`);
    }
  }

  /**
   * Discover all minting NFTs on-chain and create thread handles with
   * round-robin data NFT partitioning.
   */
  async discover(): Promise<ThreadHandle[]> {
    const stateLayout = this.contract.inner.stateLayout!;
    const reader = new StateReader(stateLayout);
    const utxos = await this.contract.inner.provider.getUtxos(this.contract.tokenAddress);
    const masterUtxos = reader.findMasterUtxos(utxos, this.contract.categoryId);

    if (masterUtxos.length === 0) {
      throw new Error('No minting NFTs found on-chain for this contract');
    }

    const partitions = this.roundRobinPartition(masterUtxos.length, stateLayout.dataNftCount);

    // Validate that each function's requiredNftIndices can be served by at least one thread
    this.validateFunctionCoverage(partitions);

    this.threads = masterUtxos.map((utxo, i) => new ThreadHandle(
      i,
      utxo,
      partitions[i],
      this.contract as ConnectedStatefulContract,
    ));

    return this.threads;
  }

  /**
   * Split one minting NFT into N threads via a non-stateful gate function.
   * The gate function (e.g. 'authorize(pubkey, sig)') must exist in the contract.
   * Non-stateful functions have no minting NFT uniqueness check, allowing
   * the transaction to create multiple minting NFT outputs.
   */
  async split(options: SplitOptions): Promise<{ threads: ThreadHandle[]; tx: TransactionDetails }> {
    const { functionName, args, threadCount, fee = 1000n, maxFee = 10000n } = options;

    if (threadCount < 2) {
      throw new Error('threadCount must be at least 2 for split');
    }

    const stateLayout = this.contract.inner.stateLayout!;

    // Find the current master UTXO
    const utxos = await this.contract.inner.provider.getUtxos(this.contract.tokenAddress);
    const reader = new StateReader(stateLayout);
    const masterUtxos = reader.findMasterUtxos(utxos, this.contract.categoryId);

    if (masterUtxos.length !== 1) {
      throw new Error(
        `Split requires exactly 1 minting NFT, found ${masterUtxos.length}. `
        + 'Use merge() first to consolidate, or discover() if already split.',
      );
    }

    const masterUtxo = masterUtxos[0];

    // Validate partitions
    const partitions = options.partitions
      ?? this.roundRobinPartition(threadCount, stateLayout.dataNftCount);

    this.validatePartitions(partitions, stateLayout.dataNftCount);

    // Build the split transaction using the non-stateful gate function
    const { TransactionBuilder } = await import('../TransactionBuilder.js');
    const builder = new TransactionBuilder({
      provider: this.contract.provider,
      maximumFeeSatoshis: maxFee,
    });

    // Unlock master via the non-stateful gate function
    const unlocker = (this.contract.inner.unlock as any)[functionName](...args);
    builder.addInput(masterUtxo, unlocker);

    // Create N minting NFT outputs (same bytecode, same category)
    // Add division remainder to the first thread to avoid burning sats as extra fee
    const available = masterUtxo.satoshis - fee;
    const amountPerThread = available / BigInt(threadCount);
    const remainder = available % BigInt(threadCount);
    for (let i = 0; i < threadCount; i++) {
      builder.addOutput({
        to: this.contract.tokenAddress,
        amount: i === 0 ? amountPerThread + remainder : amountPerThread,
        token: {
          amount: 0n,
          category: this.contract.categoryId,
          nft: { capability: 'minting', commitment: '' },
        },
      });
    }

    const tx = await builder.send();

    // Verify txid matches locally computed hash to detect compromised providers
    const { hexToBin: localHexToBin, hash256, binToHex } = await import('@bitauth/libauth');
    const rawTxBin = localHexToBin(tx.hex);
    const expectedTxid = binToHex(hash256(rawTxBin).reverse());
    if (tx.txid !== expectedTxid) {
      throw new Error(
        `Txid mismatch: provider returned '${tx.txid}', expected '${expectedTxid}'. `
        + 'The network provider may be compromised.',
      );
    }

    // Create thread handles from the new outputs
    this.threads = partitions.map((indices, i) => new ThreadHandle(
      i,
      { txid: tx.txid, vout: i, satoshis: amountPerThread, token: {
        amount: 0n,
        category: this.contract.categoryId,
        nft: { capability: 'minting', commitment: '' },
      } },
      indices,
      this.contract as ConnectedStatefulContract,
    ));

    return { threads: this.threads, tx };
  }

  /**
   * Merge multiple threads back into a single master minting NFT.
   * All thread minting NFTs are inputs, each unlocked via the same
   * non-stateful gate function. A single minting NFT output is created.
   */
  async merge(
    threads: ThreadHandle[],
    options: MergeOptions,
  ): Promise<{ thread: ThreadHandle; tx: TransactionDetails }> {
    const { functionName, args, fee = 1000n, maxFee = 10000n } = options;

    if (threads.length < 2) {
      throw new Error('merge() requires at least 2 threads');
    }

    // Build the merge transaction
    const { TransactionBuilder } = await import('../TransactionBuilder.js');
    const builder = new TransactionBuilder({
      provider: this.contract.provider,
      maximumFeeSatoshis: maxFee,
    });

    // Add all thread minting NFTs as inputs, each unlocked via the gate function
    let totalSatoshis = 0n;
    for (const thread of threads) {
      const unlocker = (this.contract.inner.unlock as any)[functionName](...args);
      builder.addInput(thread.masterUtxo, unlocker);
      totalSatoshis += thread.masterUtxo.satoshis;
    }

    const outputAmount = totalSatoshis - fee;

    // Single minting NFT output
    builder.addOutput({
      to: this.contract.tokenAddress,
      amount: outputAmount,
      token: {
        amount: 0n,
        category: this.contract.categoryId,
        nft: { capability: 'minting', commitment: '' },
      },
    });

    const tx = await builder.send();

    // Verify txid matches locally computed hash to detect compromised providers
    const { hexToBin: localHexToBin, hash256, binToHex } = await import('@bitauth/libauth');
    const rawTxBin = localHexToBin(tx.hex);
    const expectedTxid = binToHex(hash256(rawTxBin).reverse());
    if (tx.txid !== expectedTxid) {
      throw new Error(
        `Txid mismatch: provider returned '${tx.txid}', expected '${expectedTxid}'. `
        + 'The network provider may be compromised.',
      );
    }

    // Combine all partitions
    const allIndices = threads
      .flatMap((t) => t.dataNftIndices)
      .sort((a, b) => a - b);

    const mergedThread = new ThreadHandle(
      0,
      { txid: tx.txid, vout: 0, satoshis: outputAmount, token: {
        amount: 0n,
        category: this.contract.categoryId,
        nft: { capability: 'minting', commitment: '' },
      } },
      allIndices,
      this.contract as ConnectedStatefulContract,
    );

    this.threads = [mergedThread];

    return { thread: mergedThread, tx };
  }

  /**
   * Get the current set of thread handles.
   */
  getThreads(): ThreadHandle[] {
    return [...this.threads];
  }

  /**
   * Round-robin partition: distribute dataNftCount indices across threadCount threads.
   */
  private roundRobinPartition(threadCount: number, dataNftCount: number): number[][] {
    const partitions: number[][] = Array.from({ length: threadCount }, () => []);
    for (let i = 0; i < dataNftCount; i++) {
      partitions[i % threadCount].push(i);
    }
    return partitions;
  }

  /**
   * Validate that each ABI function's requiredNftIndices can be served
   * by at least one thread partition. If no single partition contains all
   * indices a function needs, it can never be called.
   */
  private validateFunctionCoverage(partitions: number[][]): void {
    const abi = this.contract.inner.artifact.abi;
    for (const fn of abi) {
      // Skip functions without explicit requiredNftIndices
      if (fn.requiredNftIndices === undefined) continue;
      if (fn.requiredNftIndices.length === 0) continue;
      // Skip unsafe/gate functions - they are invoked outside the
      // thread system (e.g. via ThreadManager.split/merge)
      if (fn.modifiers?.includes('unsafe')) continue;
      // Skip split/merge modifier functions
      if (fn.modifiers?.includes('split')) continue;
      if (fn.modifiers?.includes('merge')) continue;
      // Skip selfdestruct functions
      if (fn.modifiers?.includes('selfdestruct')) continue;
      const required = fn.requiredNftIndices;
      const canServe = partitions.some((partition) => {
        const pSet = new Set(partition);
        return required.every((idx) => pSet.has(idx));
      });
      if (!canServe) {
        throw new Error(
          `Function '${fn.name}' requires data NFT indices `
          + `[${required.join(', ')}], but no single thread `
          + 'partition contains all of them. Reduce the thread '
          + 'count or provide a custom partition.',
        );
      }
    }
  }

  /**
   * Validate that partitions are disjoint and cover all data NFT indices.
   */
  private validatePartitions(partitions: number[][], dataNftCount: number): void {
    const seen = new Set<number>();
    for (let t = 0; t < partitions.length; t++) {
      for (const idx of partitions[t]) {
        if (idx < 0 || idx >= dataNftCount) {
          throw new Error(
            `Partition for thread ${t} contains invalid data NFT index ${idx} `
            + `(contract has ${dataNftCount} data NFTs)`,
          );
        }
        if (seen.has(idx)) {
          throw new Error(
            `Partition overlap: data NFT index ${idx} is assigned to multiple threads`,
          );
        }
        seen.add(idx);
      }
    }

    if (seen.size !== dataNftCount) {
      const missing = Array.from({ length: dataNftCount }, (_, i) => i)
        .filter((i) => !seen.has(i));
      throw new Error(
        `Partitions do not cover all data NFT indices. Missing: [${missing.join(', ')}]`,
      );
    }
  }
}
