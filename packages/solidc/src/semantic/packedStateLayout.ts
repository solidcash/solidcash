import { ArrayType, IntType, StructType, isDynamicStorageType } from '@solidcash/utils';
import { type ContractNode, StateVariableVisibility } from '../ast/AST.js';
import {
  getMaxPushdataEncodedSizeForType, getMaxStateFieldBytes, stateNftPackingLimit,
} from './maxEncodedSize.js';

/** A state variable of a contract this compile unit holds, at the record and field its own compile places it. */
export interface PackedStateVariable {
  readonly state: ContractNode['stateVariables'][number];
  readonly nftIndex: number;
  readonly fieldIndex: number;
}

/**
 * The record layout a contract's own compile gives its state variables, computed from its declaration: the same
 * bin-packing the symbol pass applies to the contract it compiles. A creator holds its child's declaration but not its
 * compile, so it reads the child's records from here (child deployment sites, a framed creator's genesis replay).
 */
export function packedStateLayoutVariables(
  contract: ContractNode, commitmentLimit: number, tagSingletonDataNfts = false,
): PackedStateVariable[] {
  const result: PackedStateVariable[] = [];
  let nftIndex = 0;
  let fieldIndex = 0;
  let currentNftUsed = 0;
  for (const state of contract.stateVariables) {
    let maxSize = getMaxStateFieldBytes(state.type);
    if (state.isDynamic || isDynamicStorageType(state.type)) {
      maxSize = getMaxPushdataEncodedSizeForType(new IntType(false, 32));
    }
    const unboundedPackedArray = state.isPacked
      && state.type instanceof ArrayType
      && !state.type.bound;
    const isolated = state.isolatedNft
      || state.visibility === StateVariableVisibility.EXTERNAL
      || unboundedPackedArray;
    const terminal = state.type instanceof StructType
      || (state.isPacked && state.type instanceof ArrayType && Boolean(state.type.bound));
    if (isolated) {
      if (currentNftUsed > 0) { nftIndex += 1; fieldIndex = 0; currentNftUsed = 0; }
      result.push({ state, nftIndex, fieldIndex: 0 });
      nftIndex += 1;
      fieldIndex = 0;
    } else {
      if (currentNftUsed + maxSize > stateNftPackingLimit(commitmentLimit, nftIndex, tagSingletonDataNfts)
        && currentNftUsed > 0) {
        nftIndex += 1;
        fieldIndex = 0;
        currentNftUsed = 0;
      }
      result.push({ state, nftIndex, fieldIndex });
      fieldIndex += 1;
      currentNftUsed += maxSize;
      if (terminal) { nftIndex += 1; fieldIndex = 0; currentNftUsed = 0; }
    }
  }
  return result;
}
