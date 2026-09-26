/**
 * Which contract shapes a per-call master program can be emitted for.
 *
 * A master's head is one prefix that runs before the entry bodies. When the contract has a single entry point the
 * whole program is the head followed by that inlined body; with several, the head is followed by a selector
 * dispatcher that OP_DEFINEs each entry body with its four-byte selector and OP_INVOKEs the one the unlocking
 * bytecode's leading selector names.
 *
 * Everything else is refused with a named reason rather than compiled into a program that claims the per-call
 * convention while violating its frame rules.
 */

import { ContractNode } from '../../ast/AST.js';

/**
 * Synthetic parameters that carry the direct path's transaction-level sender category.
 *
 * A per-call master takes `msg.sender` from its witness block instead, so these parameters are not part of its
 * frame and must not be expected on the stack (nor offered to the SDK as inputs).
 */
const FRAME_PARAMETERS = new Set(['__internal__msgSenderCategory', '__internal__msgSenderAnchorIdx']);

/** Removes the frame parameters a master does not take, from every function and so from the published ABI. */
export function stripFrameParameters(contract: ContractNode): void {
  const functions = [
    contract.constructorDef, contract.fallbackDef, contract.receiveDef, ...contract.functions,
  ];
  for (const fn of functions) {
    if (!fn) continue;
    fn.parameters = fn.parameters.filter((parameter) => !FRAME_PARAMETERS.has(parameter.name));
  }
}

export interface PerCallMasterShapeInput {
  readonly contract: ContractNode;
  /** File-level (free/library) functions in the compiled unit; a head must be the first thing emitted. */
  readonly freeFunctionCount: number;
  readonly importCount: number;
  readonly needsExternalCallLowering: boolean;
  readonly hasContractInstantiation: boolean;
  readonly hasFunctionPointers: boolean;
  readonly needsInlineAssembly: boolean;
  readonly emitsEvent: boolean;
}

export interface PerCallMasterShapeAssessment {
  readonly supported: boolean;
  /** Why the shape is refused, phrased as a fact about the contract. */
  readonly reason?: string;
}

/** Assesses whether the contract can be emitted as a per-call master program. */
export function assessPerCallMasterShape(input: PerCallMasterShapeInput): PerCallMasterShapeAssessment {
  const { contract } = input;
  const refuse = (reason: string): PerCallMasterShapeAssessment => ({ supported: false, reason });
  if (input.freeFunctionCount > 0) {
    return refuse('a per-call master is one program, so free functions that would be emitted before it are not supported');
  }
  if (input.importCount > 0) {
    return refuse('imported definitions are emitted before the master head, so imports are not supported');
  }
  if (contract.constructorDef) {
    return refuse('a constructor body makes the contract dispatch by selector, which the master head cannot precede');
  }
  if (contract.fallbackDef || contract.receiveDef) {
    return refuse('fallback and receive make the contract dispatch by selector, which the master head cannot precede');
  }
  const entryPoints = contract.functions.filter((fn) => fn.isEntryPoint);
  if (entryPoints.length === 0) {
    return refuse('a master is reached by dispatching a selector, so a contract with no entry point is not supported');
  }
  if (input.needsExternalCallLowering || entryPoints.some((entry) => (entry.externalCalls?.length ?? 0) > 0)) {
    return refuse('an external call needs the witness `calls[]` checks, which are not emitted yet');
  }
  if (entryPoints.some((entry) => (entry.lowLevelCalls?.length ?? 0) > 0)) {
    return refuse('a low-level call needs the witness `calls[]` checks, which are not emitted yet');
  }
  if (input.hasContractInstantiation) {
    return refuse('contract creation needs the witness `CREATE` checks, which are not emitted yet');
  }
  if (input.hasFunctionPointers) {
    return refuse('a function pointer needs a call kind the frame does not carry yet');
  }
  if (input.needsInlineAssembly) {
    return refuse('inline assembly is not composed per-call');
  }
  if (input.emitsEvent) {
    return refuse('an emitted event needs the witness `events[]` checks, which are not emitted yet');
  }
  for (const entry of entryPoints) {
    if (entry.returnTypes.length > 0) {
      return refuse(`the entry point '${entry.name}' returns a value, which is settled against the witness `
        + '`retval` field, which is not emitted yet');
    }
    // A hidden parameter is an operand the direct path expects from the SDK or from a co-spent input. The head
    // supplies the frame values itself, so any other hidden operand would be read from the wrong stack position.
    const hidden = entry.parameters.filter((parameter) =>
      parameter.name.startsWith('__internal__') && !FRAME_PARAMETERS.has(parameter.name));
    if (hidden.length > 0) {
      return refuse(`the entry point '${entry.name}' carries the hidden parameter '${hidden[0].name}', `
        + 'which the master head does not supply');
    }
    if (entry.usesBlockhash || contract.usesBlockhash) {
      return refuse('a blockhash read needs a co-spent oracle input the master head does not locate');
    }
    if (entry.keccakCompute || entry.ecrecoverCompute) {
      return refuse('a compute side-car needs co-spent inputs the master head does not locate');
    }
  }
  return { supported: true };
}
