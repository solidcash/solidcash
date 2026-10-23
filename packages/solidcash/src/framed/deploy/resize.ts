/**
 * Resizing a framed contract's master pool, the remedy for an exhausted pool (spec R2b, 12, 21).
 *
 * The admin's `split(n)` spends one master and mints `n` byte-identical ones beside its recreation; `merge(n)` spends a
 * surviving master and `n` more, and recreates only the survivor. The master's lifecycle arm checks both against the
 * admin's signature (`solidc/src/framed/master/lifecycle.ts`), so this module only lays the transaction out.
 */

import { hash256 } from '@bitauth/libauth/build/lib/crypto/combinations.js';
import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { encodeTransaction } from '@bitauth/libauth/build/lib/message/transaction-encoding.js';
import { bigIntToVmNumber } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
import { encodeDataPush } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/push.js';
import { framedLifecycle, framedValidator } from '@solidcash/solidc/runtime';
import type { Artifact, FunctionSplitBundle } from '@solidcash/utils';
import type { Output, TransactionDetails, Unlocker, Utxo } from '../../interfaces.js';
import { createVirtualMachineBch2026ForProvider } from '../../network/createVirtualMachine.js';
import type NetworkProvider from '../../network/NetworkProvider.js';
import type SignatureTemplate from '../../SignatureTemplate.js';
import { createSighashPreimage, generateLibauthSourceOutputs } from '../../utils.js';
import { requireFramedFunderSighash } from '../sighash.js';
import { mastersForEntry, requireFunctionSplitShardBySelector } from './entry-pool.js';
import { deployMaster } from './material.js';
import { readFramedDeployment } from './records.js';

/** Raised when a resize cannot be laid out from the artifact, the pool or the options. */
export class FramedResizeError extends Error {
  public readonly name = 'FramedResizeError';

  public constructor(message: string) {
    super(message);
  }
}

/** What a resize spends and signs with. */
export interface FramedResizeOptions {
  readonly provider: NetworkProvider;
  readonly artifact: Artifact;
  readonly categoryId: string;
  /** The masters a split mints or a merge retires. */
  readonly count: number;
  /** The key the lifecycle function's `checkSig` names. Its hash type must have base type ALL. */
  readonly admin: SignatureTemplate;
  readonly fundingUtxos: readonly Utxo[];
  readonly funder: Unlocker;
  readonly changeAddress: string | Uint8Array;
  /** Satoshis each new master holds, the deployment's 1,200 by default. */
  readonly masterAmount?: bigint;
  /** The masters a merge retires, the pool's last `count` by default. */
  readonly retire?: readonly Utxo[];
  readonly validatorProgram?: Uint8Array;
  /**
   * The entry whose pool a function-split resize mints or burns.
   *
   * With {@link split}, minted and burned outputs use that entry's filled lock. Another entry's masters are
   * left in place.
   */
  readonly selector?: string;
  /** The `split: 'func'` bundle `selector` names an entry of. */
  readonly split?: FunctionSplitBundle;
}

const MINTING = (categoryId: string): NonNullable<Utxo['token']> => ({
  category: categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' },
});

/** A master's unlocking for the arm: `<mode> [<n> <sig>] <code>`, signed over the transaction it spends in. */
function lifecycleUnlocker(
  lock: Uint8Array, code: Uint8Array, mode: number, count?: number, admin?: SignatureTemplate,
): Unlocker {
  return {
    generateLockingBytecode: () => lock,
    generateUnlockingBytecode: ({ transaction, sourceOutputs, inputIndex }) => {
      const args = [encodeDataPush(Uint8Array.of(mode))];
      if (count !== undefined && admin !== undefined) {
        const preimage = createSighashPreimage(transaction, sourceOutputs, inputIndex, code, admin.sighashType);
        const signature = admin.generateSignature(hash256(preimage));
        args.push(encodeDataPush(bigIntToVmNumber(BigInt(count))), encodeDataPush(signature));
      }
      return Uint8Array.from([...args.flatMap((push) => [...push]), ...encodeDataPush(code)]);
    },
  };
}

/** The NFT an output or coin carries, keyed as the builder's burn check keys it. */
function nftKey(token: Utxo['token']): string | undefined {
  if (token?.nft === undefined) return undefined;
  const category = token.category.toLowerCase();
  return token.nft.capability === 'none'
    ? `${category}:none:${token.nft.commitment.toLowerCase()}`
    : `${category}:${token.nft.capability}`;
}

/** A merge burns only the `count` retired masters' minting NFTs: every other NFT an input carries is recreated. */
function requireRetiredBurnOnly(
  inputs: readonly Utxo[], outputs: readonly Output[], categoryId: string, count: number,
): void {
  const lost = new Map<string, number>();
  for (const { token } of inputs) {
    const key = nftKey(token);
    if (key !== undefined) lost.set(key, (lost.get(key) ?? 0) + 1);
  }
  for (const { token } of outputs) {
    const key = nftKey(token);
    if (key !== undefined) lost.set(key, (lost.get(key) ?? 0) - 1);
  }
  const retired = `${categoryId.toLowerCase()}:minting`;
  for (const [key, net] of lost) {
    if (net > (key === retired ? count : 0)) {
      throw new FramedResizeError(
        `a merge of ${count} would burn ${net} NFT(s) of ${key}; only the retired masters' minting NFTs may go`,
      );
    }
  }
}

/** `StatefulContract.split` / `merge` options, read for a framed contract: the count and the admin's template. */
export function resizeOptionsFromCall(
  kind: 'split' | 'merge',
  call: {
    readonly provider: NetworkProvider;
    readonly contract: { readonly inner: { readonly artifact: Artifact }; readonly categoryId: string };
    readonly functionName: string;
    readonly args: readonly unknown[];
    readonly fundingUtxos: Utxo[];
    readonly funder: Unlocker;
    readonly changeAddress: string;
    readonly masterAmount?: bigint;
    readonly retire?: readonly Utxo[];
  },
): FramedResizeOptions {
  const { artifact } = call.contract.inner;
  const entry = artifact.composition?.lifecycle?.[kind];
  if (entry === undefined || entry.name !== call.functionName) {
    throw new FramedResizeError(`'${call.functionName}' is not the ${kind}(n) function of "${artifact.contractName}"`);
  }
  const countIndex = entry.inputs.findIndex((input) => input.name === entry.countParameter);
  const admin = call.args[1 - countIndex] as SignatureTemplate | undefined;
  if (typeof admin?.generateSignature !== 'function') {
    throw new FramedResizeError(`'${call.functionName}' takes the admin's SignatureTemplate`);
  }
  return {
    provider: call.provider,
    artifact,
    categoryId: call.contract.categoryId,
    count: Number(call.args[countIndex]),
    admin,
    fundingUtxos: call.fundingUtxos,
    funder: call.funder,
    changeAddress: call.changeAddress,
    ...(call.masterAmount === undefined ? {} : { masterAmount: call.masterAmount }),
    ...(call.retire === undefined ? {} : { retire: call.retire }),
  };
}

/** Mints `count` masters beside one recreated in place, or retires `count` beside a survivor. */
export async function resizeFramedPool(
  kind: 'split' | 'merge', options: FramedResizeOptions,
): Promise<TransactionDetails> {
  const { provider, artifact, categoryId, count } = options;
  if (artifact.composition?.lifecycle?.[kind] === undefined) {
    throw new FramedResizeError(`contract "${artifact.contractName}" declares no ${kind}(n) function`);
  }
  if (artifact.stateLayout === undefined) {
    throw new FramedResizeError(`contract "${artifact.contractName}" is not a stateful contract`);
  }
  if (!Number.isInteger(count) || count < 1) throw new FramedResizeError(`a ${kind} counts at least one master`);
  requireFramedFunderSighash(options.admin);
  requireFramedFunderSighash(options.funder);
  if (kind === 'merge' && options.fundingUtxos.some((utxo) => utxo.token !== undefined)) {
    throw new FramedResizeError(
      'a merge is funded by tokenless coins; a token on a funding input would be burned',
    );
  }
  const validatorProgram = options.validatorProgram ?? framedValidator.buildValidatorProgram();
  let deployed = deployMaster(artifact, hexToBin(categoryId), validatorProgram);
  const { masters } = await readFramedDeployment(provider, categoryId, artifact.stateLayout);
  let pool = masters;
  if (options.selector !== undefined || options.split !== undefined) {
    if (options.selector === undefined || options.split === undefined) {
      throw new FramedResizeError('a function split or merge names the entry selector and the split bundle');
    }
    let shard;
    try {
      shard = requireFunctionSplitShardBySelector(options.split, options.selector);
    } catch (error) {
      throw new FramedResizeError((error as Error).message);
    }
    deployed = deployMaster(shard.artifact, hexToBin(categoryId), validatorProgram);
    try {
      pool = mastersForEntry(masters, deployed.lockingBytecode, shard.function);
    } catch (error) {
      throw new FramedResizeError((error as Error).message);
    }
    if (pool.length === 0) {
      throw new FramedResizeError(`function "${shard.function}" has no master in its pool`);
    }
  }
  const outpoint = (utxo: Utxo): string => `${utxo.txid}:${utxo.vout}`;
  const retired = kind === 'merge' ? (options.retire ?? pool.slice(-count)) : [];
  const keeper = pool.find((master) => !retired.some((utxo) => outpoint(utxo) === outpoint(master)));
  if (keeper === undefined) {
    throw new FramedResizeError(`category ${categoryId} holds no master to keep beside the ${kind}`);
  }
  if (kind === 'merge' && retired.length !== count) {
    throw new FramedResizeError(`a merge of ${count} retires ${count} master(s), but ${retired.length} were named`);
  }

  const { TransactionBuilder } = await import('../../TransactionBuilder.js');
  // A merge burns the retired masters' minting NFTs, which is the point of it; `requireRetiredBurnOnly` bounds it.
  const builder = new TransactionBuilder({ provider, skipAutomaticCoSpends: true, allowImplicitNftBurn: kind === 'merge' });
  const { SPLIT, MERGE, RETIRE } = framedLifecycle.LIFECYCLE_MODE;
  builder.addInput(keeper, lifecycleUnlocker(
    deployed.lockingBytecode, deployed.script, kind === 'split' ? SPLIT : MERGE, count, options.admin,
  ));
  for (const utxo of retired) {
    builder.addInput(utxo, lifecycleUnlocker(deployed.lockingBytecode, deployed.script, RETIRE));
  }
  for (const utxo of options.fundingUtxos) builder.addInput(utxo, options.funder);
  builder.addOutput({ to: deployed.lockingBytecode, amount: keeper.satoshis, token: MINTING(categoryId) });
  for (let index = 0; kind === 'split' && index < count; index += 1) {
    builder.addOutput({ to: deployed.lockingBytecode, amount: options.masterAmount ?? 1200n, token: MINTING(categoryId) });
  }
  builder.addBchChangeOutputIfNeeded({ to: options.changeAddress, feeRate: 1 });
  if (kind === 'merge') requireRetiredBurnOnly(builder.inputs, builder.outputs, categoryId, count);

  // A master's program is wider than the standard per-input ceiling the builder's own send gate applies, so the
  // provider's BCH-2026 machine judges every input here instead, before anything is broadcast.
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(provider);
  transaction.inputs.forEach((_input, inputIndex) => {
    const verdict = vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction }));
    if (verdict !== true) {
      throw new FramedResizeError(`the ${kind} is refused before broadcast at input index ${inputIndex}: ${verdict}`);
    }
  });
  const rawBytes = encodeTransaction(transaction);
  const rawHex = binToHex(rawBytes);
  const txid = await provider.sendRawTransaction(rawHex);
  const { attachWait } = await import('../../wait.js');
  return attachWait({ ...transaction, txid, hex: rawHex } as TransactionDetails, provider);
}
