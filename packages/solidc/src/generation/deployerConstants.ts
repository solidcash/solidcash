/**
 * B7.2: the constants a deployer program takes from C's own compile.
 *
 * They are pure data: C's code, the data-record count, the collection hashes and empty HEAD commitments, and the
 * container shape. The deployer computes category-dependent locks at run time from these bytes and from X and M.
 */
import {
  asmToScript, computeCollectionHash, containerKeepsTokenless, containerMasterRetires, scriptToBytecode,
} from '@solidcash/utils';
import type { Artifact } from '@solidcash/utils';
import type { ContractNode } from '../ast/AST.js';

/** The two protocol selectors of A4.2, independent of `evmCompat`. */
export const DEPLOYER_SELECTOR_CREATE: Uint8Array = Uint8Array.from([0xaf, 0x34, 0x14, 0x13]);
export const DEPLOYER_SELECTOR_SWEEP: Uint8Array = Uint8Array.from([0x74, 0x0b, 0x42, 0x3a]);

export interface DeployerCollectionConstant {
  readonly name: string;
  readonly signature: string;
  /** The value the entry covenant compares against its category-derived key. */
  readonly hash: Uint8Array;
  readonly sorted: boolean;
  /** The empty sorted-list HEAD (slot 0, next 0, zero value padding), for a sorted collection. */
  readonly headCommitment?: Uint8Array;
}

/** The options a direct container covenant takes (`buildSatoshiContainerCovenantScript`, `W/utils/src/state.ts`). */
export interface DeployerContainerOptions {
  readonly masterRetires: boolean;
  readonly keepsTokenless: boolean;
}

export type DeployerContainerKind = 'satoshiContainer' | 'tokenContainer';

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
  /**
   * A4.4, "Container locks use C's own options": the options of C's container locks, read off the entries C's
   * artifact publishes, as the SDK derives the same locks (`directContainerOptions`). The deployer program keeps
   * none of C's entries, so it must not derive them from its own.
   */
  readonly containerOptions: Readonly<Record<DeployerContainerKind, DeployerContainerOptions>>;
  /**
   * O2's second derivation of the same options, from C's source as C's own code derives the locks it checks
   * (`boundContainerOptions`, GTT). The generator refuses to pin a container lock when the two differ.
   */
  readonly sourceContainerOptions: Readonly<Record<DeployerContainerKind, DeployerContainerOptions>>;
}

/** C's container options as C's own code computes them (`boundContainerOptions`): from its entries and pragmas. */
function containerOptionsFromSource(contract: ContractNode, kind: DeployerContainerKind): DeployerContainerOptions {
  const entries = [
    ...contract.functions.filter((fn) => fn.visibility !== 'internal' && fn.visibility !== 'private'),
    ...(contract.constructorDef ? [contract.constructorDef] : []),
    ...(contract.fallbackDef ? [contract.fallbackDef] : []),
  ].map((fn) => ({ modifiers: fn.modifiers.map(String), lowLevelCalls: fn.lowLevelCalls }));
  if (contract.receiveDef) entries.push({ modifiers: ['payable'], lowLevelCalls: contract.receiveDef.lowLevelCalls });
  return {
    masterRetires: containerMasterRetires(entries),
    keepsTokenless: containerKeepsTokenless([{
      blockLayout: {
        singleSatoshiContainer: contract.singleSatoshiContainer, singleTokenContainer: contract.singleTokenContainer,
      },
    }], kind),
  };
}

/** C's container options as the SDK reads them from C's artifact (`directContainerOptions`). */
function containerOptionsFromAbi(artifact: Artifact, kind: DeployerContainerKind): DeployerContainerOptions {
  const abi = artifact.abi ?? [];
  return { masterRetires: containerMasterRetires(abi), keepsTokenless: containerKeepsTokenless(abi, kind) };
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
  // A8: C keeps its satoshi container single when the pragma is set and a function of C has a satoshi container
  // slot in its block layout. A contract that carries the pragma but never uses the container keeps nothing, so its
  // deployer neither requires nor seeds one.
  const usesSatoshiContainer = (artifact.abi ?? []).some((fn) => (fn.blockLayout?.slots ?? [])
    .some((slot) => slot.kind === 'satoshiContainer'));
  return {
    code,
    dataNftCount: layout?.dataNftCount ?? 0,
    collections,
    keepsSatoshiContainer: contract.keepsSatoshiContainer,
    singleSatoshiContainer: contract.singleSatoshiContainer === true && usesSatoshiContainer,
    singleTokenContainer: contract.singleTokenContainer,
    tokenContainerCount: contract.tokenContainerCount,
    singleTokenContainerKeys,
    containerOptions: {
      satoshiContainer: containerOptionsFromAbi(artifact, 'satoshiContainer'),
      tokenContainer: containerOptionsFromAbi(artifact, 'tokenContainer'),
    },
    sourceContainerOptions: {
      satoshiContainer: containerOptionsFromSource(contract, 'satoshiContainer'),
      tokenContainer: containerOptionsFromSource(contract, 'tokenContainer'),
    },
  };
}
