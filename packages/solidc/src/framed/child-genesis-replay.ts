/**
 * The genesis a framed creator replays for the child it creates (docs/framed/CREATE2_IDENTITY.md, "The genesis
 * replay").
 *
 * A framed `create2` mints the child's genesis in the creating transaction, and whoever composes that transaction
 * lays the outputs down. The creating body therefore requires them to be the genesis the folded construction
 * produces: the child's constructor (state-variable initializers included), with the creator's own address as its
 * `msg.sender`, then the initializer the creator calls on it, with the creator's arguments. This module folds that
 * construction, with the compiler's own deploy folder, into what the creating body emits: each data record's
 * commitment as bytes the compile fixes and values the body computes, and how many sorted collections get an empty
 * head. A construction the folder cannot reduce to that, or a child state it cannot encode, is refused by name rather
 * than replayed approximately.
 */

import {
  AddressType, BytesType, CHILD_COLLECTION_CAPACITY, EnumType, IntType, PrimitiveType, abiTypeString,
  encodeNftIndexTag, encodePushdataValue, getDefaultStateValue, isDynamicStorageType,
  type CompilerOptions, type StateValue, type Type,
} from '@solidcash/utils';
import {
  BoolLiteralNode, ContractNode, ExpressionNode, FunctionDefinitionNode, HexLiteralNode, IdentifierNode,
  InstantiationNode, IntLiteralNode, NullaryOpNode, UnaryOpNode,
} from '../ast/AST.js';
import { NullaryOperator, UnaryOperator } from '../ast/Operator.js';
import { cloneNode } from '../ast/clone.js';
import { SolidcDiagnosticError } from '../Errors.js';
import SymbolTableTraversal from '../semantic/SymbolTableTraversal.js';
import { packedStateLayoutVariables } from '../semantic/packedStateLayout.js';

/** A part of a record's commitment: bytes the compile fixes, or a value the creating body computes and encodes. */
export type FramedGenesisRecordPart =
  | { readonly kind: 'constant'; readonly bytes: Uint8Array }
  | { readonly kind: 'value'; readonly expression: ExpressionNode; readonly type: Type };

/** The child's genesis, as its creating body replays it. */
export interface FramedChildGenesisReplay {
  readonly contractName: string;
  /** Each data record's commitment, in record order. */
  readonly records: readonly (readonly FramedGenesisRecordPart[])[];
  /** How many sorted collections of the child its genesis mints an empty head for. */
  readonly collections: number;
}

/** The initializer the creating body calls on the child, with the creator's argument expressions. */
export interface FramedGenesisInitializer {
  readonly callee: FunctionDefinitionNode;
  readonly args: readonly ExpressionNode[];
}

/** The names the folder sees for the initializer's arguments, so a folded field names the argument it takes. */
const ARGUMENT_STAND_IN = '__framedGenesisArgument';

function refuse(child: ContractNode, detail: string): never {
  throw new SolidcDiagnosticError(
    'FRAMED_CODEGEN_UNAVAILABLE',
    `a framed creator replays the genesis of the "${child.name}" it creates, and ${detail}`,
    { requested: 'framed', reason: 'create2-genesis-replay', contract: child.name },
  );
}

/** The physical type string a record encodes a field with, as the artifact publishes it. */
function fieldTypeString(type: Type): string {
  return type instanceof EnumType ? 'bigint' : abiTypeString(type);
}

/** A scalar the creator can encode as the child's record stores it. */
function replayableFieldType(type: Type): boolean {
  if (isDynamicStorageType(type)) return false;
  if (type instanceof EnumType || type instanceof IntType || type instanceof AddressType) return true;
  if (type === PrimitiveType.BOOL || type === PrimitiveType.INT || type === PrimitiveType.BIGINT) return true;
  return type instanceof BytesType && type.bound !== undefined && type.bound >= 1 && type.bound <= 32;
}

/** Whether two types encode a value the same way in a record: a widened integer keeps its VM number. */
function sameEncoding(field: Type, value: Type | undefined): boolean {
  if (value === undefined) return false;
  const integer = (type: Type): boolean => type instanceof IntType || type instanceof EnumType
    || type === PrimitiveType.INT || type === PrimitiveType.BIGINT;
  if (integer(field)) return integer(value);
  if (field instanceof AddressType) return value instanceof AddressType;
  return fieldTypeString(field) === fieldTypeString(value);
}

/** True for the creator's own address, the fold of the child's `msg.sender`. */
function isCreatorAddress(expression: ExpressionNode): boolean {
  return expression instanceof UnaryOpNode && expression.operator === UnaryOperator.INPUT_LOCKING_BYTECODE
    && expression.expression instanceof NullaryOpNode && expression.expression.operator === NullaryOperator.INPUT_INDEX;
}

/**
 * The genesis of `child` as the creating body replays it.
 *
 * `isContractType` answers whether a type name the child's state declares is a contract or an interface (an address
 * on the wire); any other unresolved name (a struct, an enum or a value type) is refused, since the child's own compile
 * resolves it and the creator's record layout could differ.
 */
export function framedChildGenesisReplay(options: {
  readonly child: ContractNode;
  readonly compilerOptions: CompilerOptions;
  readonly initializer?: FramedGenesisInitializer;
  readonly isContractType: (name: string) => boolean;
}): FramedChildGenesisReplay {
  const { child, compilerOptions, initializer } = options;
  for (const state of child.stateVariables) {
    if (state.contractTypeName !== undefined && !options.isContractType(state.contractTypeName)) {
      refuse(child, `its state variable "${state.name}" has the type "${state.contractTypeName}", whose record `
        + 'encoding the creator does not resolve');
    }
    if (state.isDynamic || state.isPacked || !replayableFieldType(state.type)) {
      refuse(child, `its state variable "${state.name}" is not a scalar the creator encodes as the child's record does`);
    }
  }
  if (child.collections.length > CHILD_COLLECTION_CAPACITY) {
    refuse(child, `it has ${child.collections.length} collections, more than the ${CHILD_COLLECTION_CAPACITY} empty `
      + 'heads a creator replays');
  }

  // The constructor's writes (its state-variable initializers among them), with the creator as `msg.sender`, then
  // the initializer's, with the creator's arguments standing in by name.
  const deployment = new InstantiationNode(new IdentifierNode(child.name), []);
  deployment.location = child.location;
  deployment.referencedContract = child;
  const folder = new SymbolTableTraversal(compilerOptions);
  folder.tryFoldChildConstructor(deployment);
  if (deployment.constructorStateFoldComplete !== true || deployment.ctorFoldFailed === true) {
    refuse(child, 'its constructor does not fold into state the creator can compute');
  }
  if ((deployment.foldedConstructorPredicates?.length ?? 0) > 0) {
    refuse(child, 'its constructor guards its writes with conditions the creator does not replay');
  }
  const standIns = (initializer?.args ?? []).map((argument, index) => {
    const standIn = new IdentifierNode(`${ARGUMENT_STAND_IN}${index}`);
    standIn.location = argument.location;
    standIn.type = argument.type;
    return standIn;
  });
  if (initializer !== undefined
    && !folder.tryFoldFramedChildInitializer(deployment, initializer.callee, standIns)) {
    refuse(child, `its "${initializer.callee.name}" call does not fold into state the creator can compute`);
  }
  if ((deployment.foldedCollectionEntries?.length ?? 0) > 0) {
    refuse(child, 'its construction writes a collection, whose nodes the creator does not replay');
  }

  const layout = packedStateLayoutVariables(
    child, compilerOptions.commitmentLimit ?? 128, compilerOptions.tagSingletonDataNfts === true,
  );
  const recordCount = layout.length === 0 ? 0 : Math.max(...layout.map((variable) => variable.nftIndex)) + 1;
  // The child's own compile tags every record of a multi-record layout, and a single record when the option says so.
  const tagged = recordCount > 1 || (recordCount === 1 && compilerOptions.tagSingletonDataNfts === true);
  const fieldPart = (state: ContractNode['stateVariables'][number]): FramedGenesisRecordPart => {
    const typeString = fieldTypeString(state.type);
    const constant = (value: StateValue): FramedGenesisRecordPart => ({
      kind: 'constant', bytes: encodePushdataValue(value, typeString),
    });
    const folded = deployment.foldedStateInit?.get(state.name);
    if (folded === undefined) return constant(getDefaultStateValue(typeString));
    if (folded instanceof IntLiteralNode && !(state.type instanceof AddressType) && state.type !== PrimitiveType.BOOL
      && !(state.type instanceof BytesType)) {
      return constant(folded.value);
    }
    if (folded instanceof BoolLiteralNode && state.type === PrimitiveType.BOOL) return constant(folded.value);
    if (folded instanceof HexLiteralNode && state.type instanceof BytesType) return constant(folded.value);
    if (isCreatorAddress(folded) && state.type instanceof AddressType) {
      return { kind: 'value', expression: cloneNode(folded), type: state.type };
    }
    if (folded instanceof IdentifierNode && folded.name.startsWith(ARGUMENT_STAND_IN) && initializer !== undefined) {
      const argument = initializer.args[Number(folded.name.slice(ARGUMENT_STAND_IN.length))];
      if (argument !== undefined && sameEncoding(state.type, argument.type)) {
        return { kind: 'value', expression: cloneNode(argument), type: state.type };
      }
    }
    return refuse(child, `its genesis value of "${state.name}" is not one the creator computes (a constant, the `
      + 'creator\'s own address or an argument of its initializer)');
  };
  const records: FramedGenesisRecordPart[][] = [];
  for (let index = 0; index < recordCount; index += 1) {
    const parts: FramedGenesisRecordPart[] = tagged ? [{ kind: 'constant', bytes: encodeNftIndexTag(index) }] : [];
    for (const variable of layout.filter((candidate) => candidate.nftIndex === index)
      .sort((left, right) => left.fieldIndex - right.fieldIndex)) {
      const part = fieldPart(variable.state);
      const last = parts[parts.length - 1];
      if (part.kind === 'constant' && last?.kind === 'constant') {
        parts[parts.length - 1] = { kind: 'constant', bytes: Uint8Array.from([...last.bytes, ...part.bytes]) };
      } else {
        parts.push(part);
      }
    }
    records.push(parts);
  }
  return {
    contractName: child.name,
    records,
    collections: child.collections.length,
  };
}
