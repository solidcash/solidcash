/**
 * B7.2: the constants a deployer program takes from C's own compile.
 *
 * They are pure data: C's code, the data-record count, the collection hashes and empty HEAD commitments, and the
 * container shape. The deployer computes category-dependent locks at run time from these bytes and from X and M.
 */
import { asmToScript, computeCollectionHash, scriptToBytecode } from '@solidcash/utils';
import type { Artifact } from '@solidcash/utils';
import type { ContractNode } from '../ast/AST.js';

export interface DeployerCollectionConstant {
  readonly name: string;
  readonly signature: string;
  /** The value the entry covenant compares against its category-derived key. */
  readonly hash: Uint8Array;
  readonly sorted: boolean;
  /** The empty sorted-list HEAD (slot 0, next 0, zero value padding), for a sorted collection. */
  readonly headCommitment?: Uint8Array;
}

export interface DeployerConstants {
  /** C's master code, the bytes after pin(X) and the contract arguments. */
  readonly code: Uint8Array;
  readonly dataNftCount: number;
  readonly collections: readonly DeployerCollectionConstant[];
  readonly keepsSatoshiContainer: boolean;
  readonly singleSatoshiContainer: boolean;
  readonly singleTokenContainer: boolean;
  readonly tokenContainerCount: number;
  /** Contract parameters that name a token container the contract keeps single (A8). */
  readonly singleTokenContainerKeys: readonly string[];
}

/** The empty sorted-list HEAD: slot 0, next key 0, and the 64-byte empty-value pad. */
export const EMPTY_HEAD_COMMITMENT: Uint8Array = new Uint8Array(128);

export function deployerConstantsOf(artifact: Artifact, contract: ContractNode): DeployerConstants {
  const code = /^[0-9a-f]*$/i.test(artifact.bytecode) && artifact.bytecode.length % 2 === 0
    ? Uint8Array.from(artifact.bytecode.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16))
    : scriptToBytecode(asmToScript(artifact.bytecode));
  const layout = artifact.stateLayout;
  const collections = (layout?.collections ?? []).map((collection): DeployerCollectionConstant => ({
    name: collection.name,
    signature: collection.signature,
    hash: computeCollectionHash(collection.signature),
    sorted: collection.sorted === true,
    ...(collection.sorted === true && { headCommitment: EMPTY_HEAD_COMMITMENT }),
  }));
  const parameterNames = new Set(contract.parameters.map((parameter) => parameter.name));
  const functions = [contract.constructorDef, contract.fallbackDef, contract.receiveDef, ...contract.functions]
    .filter((fn): fn is NonNullable<typeof fn> => fn !== undefined);
  const singleTokenContainerKeys = contract.singleTokenContainer
    ? [...new Set(functions.flatMap((fn) => fn.tokenContainerAccesses ?? [])
      .filter((access) => access.keySource === 'param' && parameterNames.has(access.keyParam))
      .map((access) => access.keyParam))]
    : [];
  return {
    code,
    dataNftCount: layout?.dataNftCount ?? 0,
    collections,
    keepsSatoshiContainer: contract.keepsSatoshiContainer,
    singleSatoshiContainer: contract.singleSatoshiContainer,
    singleTokenContainer: contract.singleTokenContainer,
    tokenContainerCount: contract.tokenContainerCount,
    singleTokenContainerKeys,
  };
}
