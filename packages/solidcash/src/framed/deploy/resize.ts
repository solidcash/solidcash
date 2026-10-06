/**
 * Resizing a per-call contract's master pool, the remedy for an exhausted pool (spec R2b, 12, 21).
 *
 * The admin's `split(n)` spends one master and mints `n` byte-identical ones beside its recreation; `merge(n)` spends a
 * surviving master and `n` more, and recreates only the survivor. The master's lifecycle arm checks both against the
 * admin's signature (`solidc/src/per-call/master/lifecycle.ts`), so this module only lays the transaction out.
 */

import {
  bigIntToVmNumber, binToHex, encodeDataPush, encodeTransaction, hash256, hexToBin,
} from '@bitauth/libauth';
import { perCallLifecycle, perCallValidator } from 'solidc';
import type { Artifact } from '@solidcash/utils';
import type { TransactionDetails, Unlocker, Utxo } from '../../interfaces.js';
import type NetworkProvider from '../../network/NetworkProvider.js';
import type SignatureTemplate from '../../SignatureTemplate.js';
import { createSighashPreimage } from '../../utils.js';
import { deployMaster } from './material.js';
import { readPerCallDeployment } from './records.js';

/** Raised when a resize cannot be laid out from the artifact, the pool or the options. */
export class PerCallResizeError extends Error {
  public readonly name = 'PerCallResizeError';

  public constructor(message: string) {
    super(message);
  }
}

/** What a resize spends and signs with. */
export interface PerCallResizeOptions {
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
        const preimage = createSighashPreimage(transaction, sourceOutputs, inputIndex, code, admin.getHashType());
        const signature = admin.generateSignature(hash256(preimage));
        args.push(encodeDataPush(bigIntToVmNumber(BigInt(count))), encodeDataPush(signature));
      }
      return Uint8Array.from([...args.flatMap((push) => [...push]), ...encodeDataPush(code)]);
    },
  };
}

/** `StatefulContract.split` / `merge` options, read for a per-call contract: the count and the admin's template. */
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
): PerCallResizeOptions {
  const { artifact } = call.contract.inner;
  const entry = artifact.composition?.lifecycle?.[kind];
  if (entry === undefined || entry.name !== call.functionName) {
    throw new PerCallResizeError(`'${call.functionName}' is not the ${kind}(n) function of "${artifact.contractName}"`);
  }
  const countIndex = entry.inputs.findIndex((input) => input.name === entry.countParameter);
  const admin = call.args[1 - countIndex] as SignatureTemplate | undefined;
  if (typeof admin?.generateSignature !== 'function') {
    throw new PerCallResizeError(`'${call.functionName}' takes the admin's SignatureTemplate`);
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
export async function resizePerCallPool(
  kind: 'split' | 'merge', options: PerCallResizeOptions,
): Promise<TransactionDetails> {
  const { provider, artifact, categoryId, count } = options;
  if (artifact.composition?.lifecycle?.[kind] === undefined) {
    throw new PerCallResizeError(`contract "${artifact.contractName}" declares no ${kind}(n) function`);
  }
  if (artifact.stateLayout === undefined) {
    throw new PerCallResizeError(`contract "${artifact.contractName}" is not a stateful contract`);
  }
  if (!Number.isInteger(count) || count < 1) throw new PerCallResizeError(`a ${kind} counts at least one master`);
  const validatorProgram = options.validatorProgram ?? perCallValidator.buildValidatorProgram();
  const deployed = deployMaster(artifact, hexToBin(categoryId), validatorProgram);
  const { masters } = await readPerCallDeployment(provider, categoryId, artifact.stateLayout);
  const outpoint = (utxo: Utxo): string => `${utxo.txid}:${utxo.vout}`;
  const retired = kind === 'merge' ? (options.retire ?? masters.slice(-count)) : [];
  const keeper = masters.find((master) => !retired.some((utxo) => outpoint(utxo) === outpoint(master)));
  if (keeper === undefined) {
    throw new PerCallResizeError(`category ${categoryId} holds no master to keep beside the ${kind}`);
  }
  if (kind === 'merge' && retired.length !== count) {
    throw new PerCallResizeError(`a merge of ${count} retires ${count} master(s), but ${retired.length} were named`);
  }

  const { TransactionBuilder } = await import('../../TransactionBuilder.js');
  // A merge burns the retired masters' minting NFTs, which is the point of it.
  const builder = new TransactionBuilder({ provider, skipAutomaticCoSpends: true, allowImplicitNftBurn: kind === 'merge' });
  const { SPLIT, MERGE, RETIRE } = perCallLifecycle.LIFECYCLE_MODE;
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

  // A master's program is wider than the standard per-input ceiling the builder's own send gate applies.
  const transaction = builder.buildLibauthTransaction();
  const rawBytes = encodeTransaction(transaction);
  const rawHex = binToHex(rawBytes);
  const txid = await provider.sendRawTransaction(rawHex);
  const { attachWait } = await import('../../wait.js');
  return attachWait({ ...transaction, txid, hex: rawHex } as TransactionDetails, provider);
}
