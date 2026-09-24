/**
 * phase-boundary extract: compose recipe / materialization helpers (phase-boundary extract from compose.ts).
 * Child-deployment recipes, fixed BCH transfer materialization, EVM/native provisional results,
 * computed value-chunk claim predicates, and sticky scalar leftover writes.
 */

import {
  bigIntToVmNumber, binToHex, binToUtf8, hexToBin, sha1, utf8ToBin, vmNumberToBigInt,
} from '@bitauth/libauth';
import {
  BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX,
  decodePushdataValue, encodePushdataValue,
  buildEntryCommitment, buildPushdataCommitment, bytecodeToScript, scriptToAsm,
  AddressType, BytesType, FixedType, IntType,
  parseArrayTypeString, parsePushdataCommitment, parseTypeStrict, PrimitiveType,
  getDefaultStateValue, hash160, hash256, ripemd160, sha256,
} from '@solidcash/utils';
import type {
  Artifact, ChildDeploymentValueRecipe, ExternalResultEncoding, FixedBchTransferAbi, StateLayout, StateValue,
  StructDefinitionInfo,
} from '@solidcash/utils';
import type { ConstructorArgument, FunctionArgument } from '../Argument.js';
import type { Output, UnlockableUtxo } from '../interfaces.js';
import { TransactionBuilder } from '../TransactionBuilder.js';
import { Contract } from '../Contract.js';
import { addressToLockScript } from '../utils.js';
import {
  valueChunkIndexFromCommitment,
} from '../stateful/StatefulTransactionBuilder.js';
import {
  canonicalValueChunkProducerResourceIdentity,
} from '../stateful/ValueChunkProducerIdentity.js';
import { isCanonicalEvmScalarReturnVector } from '../stateful/StatefulContract.js';
import { artifactUsesSolidityAbi, resolveExternalResultEncoding } from '../stateful/solidityAbi.js';
import type NetworkProvider from '../network/NetworkProvider.js';

/** Minimal claim shape for continuation seeding predicates (avoids compose orchestration types). */
type ComputedValueChunkClaim = {
  tokenCategory: string;
  commitment: string;
};

export function canSeedComputedValueChunkClaim(
  input: Pick<UnlockableUtxo, 'satoshis' | 'token' | 'unlocker'> | undefined,
  output: Pick<Output, 'amount' | 'token'> | undefined,
  claim: Pick<ComputedValueChunkClaim, 'tokenCategory' | 'commitment'>,
): boolean {
  return input !== undefined
    && input.token === undefined
    && binToHex(input?.unlocker.generateLockingBytecode() ?? new Uint8Array())
      === BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX
    && input.satoshis === output?.amount
    && output?.token?.category === claim.tokenCategory
    && output.token.amount === 0n
    && output.token.nft?.capability === 'mutable'
    && valueChunkIndexFromCommitment(output.token.nft.commitment)
      === valueChunkIndexFromCommitment(claim.commitment);
}

/** Display-order category hex without an optional capability suffix, for token/artifact comparisons. */
const comparableTokenCategory = (category: string | undefined): string | undefined =>
  category === undefined ? undefined : category.replace(/^0x/i, '').slice(0, 64).toLowerCase();

/**
 * Exact authority predicate for replacing a balanced continuation slot's output with a transported chunk.
 *
 * The composer overwrites that output, so the slot must belong to the transported continuation. Two funding
 * shapes prove it: the balanced dummy, which reserves a slot the participant did not previously occupy, and a
 * value-chunk predecessor of the same resource - a mutable token input of the transported category whose
 * commitment parses as a canonical value chunk - which the executing participant consumes there when the
 * continuation already existed in the prior state. A wider continuation shifts the transported band, so a
 * predecessor is not necessarily the chunk at the same index; requiring the shared category, the mutable
 * capability, and a canonical chunk index keeps an unrelated token input from authorizing the replacement. The
 * completed block is still authenticated by the participant's own covenant VM.
 */
export function canOwnTransportedContinuationSlot(
  input: Pick<UnlockableUtxo, 'token' | 'unlocker'> | undefined,
  claim: { categoryId: string | undefined; commitment: string },
): boolean {
  if (input === undefined) return false;
  if (input.token === undefined) {
    return binToHex(input.unlocker.generateLockingBytecode()) === BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX;
  }
  return valueChunkIndexFromCommitment(claim.commitment) !== undefined
    && input.token.nft?.capability === 'mutable'
    && valueChunkIndexFromCommitment(input.token.nft.commitment) !== undefined
    && comparableTokenCategory(input.token.category) !== undefined
    && comparableTokenCategory(input.token.category) === comparableTokenCategory(claim.categoryId);
}

const recipeType = (
  recipe: ChildDeploymentValueRecipe,
  inputTypes: readonly string[],
): string => recipe.resultType
  ?? (recipe.kind === 'handlerInput' ? inputTypes[recipe.inputIndex] : undefined)
  ?? (() => { throw new Error('messageBus: deployment recipe has no result type'); })();

const numericRecipeValue = (value: FunctionArgument, typeName: string, solidityAbi: boolean): bigint => {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === 'boolean') return value ? 1n : 0n;
  if (typeof value === 'string' && /^(?:-?\d+|0x[0-9a-f]+)$/i.test(value)) return BigInt(value);
  if (value instanceof Uint8Array) {
    const type = parseTypeStrict(typeName);
    const bytes = solidityAbi && type instanceof BytesType && type.bound !== undefined
      ? value.slice().reverse() : value;
    const decoded = vmNumberToBigInt(bytes);
    if (typeof decoded !== 'bigint') {
      throw new Error(`messageBus: deployment recipe has a non-minimal numeric ${typeName}`);
    }
    return decoded;
  }
  throw new Error(`messageBus: deployment recipe expected a scalar numeric ${typeName}`);
};

const byteRecipeValue = (value: FunctionArgument, typeName: string, solidityAbi: boolean): Uint8Array => {
  const type = parseTypeStrict(typeName);
  if (type === PrimitiveType.BOOL || type === PrimitiveType.BIGINT
    || type instanceof IntType || type instanceof FixedType) {
    return bigIntToVmNumber(numericRecipeValue(value, typeName, solidityAbi));
  }
  if (type === PrimitiveType.STRING) {
    if (typeof value === 'string') return utf8ToBin(value);
    if (value instanceof Uint8Array) return value;
    throw new Error('messageBus: deployment recipe expected string bytes');
  }
  if (type instanceof AddressType && typeof value === 'string' && value.includes(':')) {
    return addressToLockScript(value);
  }
  const byteType = type instanceof AddressType || type instanceof BytesType
    || type === PrimitiveType.PUBKEY || type === PrimitiveType.DATASIG;
  if (!byteType) throw new Error(`messageBus: deployment recipe type ${typeName} is not byte-represented`);
  if (value instanceof Uint8Array) return value;
  if (typeof value === 'string') {
    return hexToBin(value.startsWith('0x') ? value.slice(2) : value);
  }
  throw new Error(`messageBus: deployment recipe expected byte sequence ${typeName}`);
};

export const fixedVmNumber = (value: bigint, width: number): Uint8Array => {
  const minimal = bigIntToVmNumber(value);
  if (minimal.length > width) throw new Error(`messageBus: deployment recipe value does not fit bytes${width}`);
  if (minimal.length === width) return minimal;
  const result = new Uint8Array(width);
  result.set(minimal);
  if (value < 0n && minimal.length > 0) {
    result[minimal.length - 1] &= 0x7f;
    result[width - 1] |= 0x80;
  }
  return result;
};

const coerceRecipeValue = (
  value: FunctionArgument,
  sourceTypeName: string,
  resultTypeName: string,
  solidityAbi: boolean,
): FunctionArgument => {
  const sourceType = parseTypeStrict(sourceTypeName);
  const resultType = parseTypeStrict(resultTypeName);
  if (resultType === PrimitiveType.BOOL) {
    return numericRecipeValue(value, sourceTypeName, solidityAbi) !== 0n;
  }
  if (resultType === PrimitiveType.BIGINT || resultType instanceof IntType || resultType instanceof FixedType) {
    let numeric = numericRecipeValue(value, sourceTypeName, solidityAbi);
    if ((sourceType === PrimitiveType.BIGINT || sourceType instanceof IntType)
      && resultType instanceof FixedType) numeric *= resultType.scaleFactor;
    if (sourceType instanceof FixedType
      && (resultType === PrimitiveType.BIGINT || resultType instanceof IntType)) numeric /= sourceType.scaleFactor;
    if (sourceType instanceof FixedType && resultType instanceof FixedType) {
      numeric = resultType.decimals > sourceType.decimals
        ? numeric * 10n ** BigInt(resultType.decimals - sourceType.decimals)
        : numeric / 10n ** BigInt(sourceType.decimals - resultType.decimals);
    }
    if ((resultType instanceof IntType || resultType instanceof FixedType)
      && (numeric < resultType.minValue || numeric > resultType.maxValue)) {
      throw new Error(`messageBus: deployment recipe value ${numeric} is out of bounds for ${resultTypeName}`);
    }
    return numeric;
  }
  if (resultType instanceof AddressType) {
    // The compiler's bytes/int -> address cast is a VM-level no-op: an address is the locking-bytecode stack
    // item itself. Reproduce that representation here so constructor genesis replay authenticates the same
    // value. CashAddress spelling is only possible for an address-typed source; bytes strings remain hex.
    if (value instanceof Uint8Array) return value;
    if (typeof value === 'string' && sourceType instanceof AddressType && value.includes(':')) {
      return addressToLockScript(value);
    }
    if (typeof value === 'string' && sourceType instanceof BytesType) {
      return hexToBin(value.startsWith('0x') ? value.slice(2) : value);
    }
    return bigIntToVmNumber(numericRecipeValue(value, sourceTypeName, solidityAbi));
  }
  if (resultType instanceof BytesType) {
    if (value instanceof Uint8Array) {
      if (resultType.bound === undefined) return value;
      if (!(sourceType instanceof BytesType)) {
        throw new Error(`messageBus: deployment recipe cannot cast ${sourceTypeName} to ${resultTypeName}`);
      }
      return value.length > resultType.bound
        ? value.slice(0, resultType.bound)
        : Uint8Array.from([...value, ...new Uint8Array(resultType.bound - value.length)]);
    }
    const numeric = numericRecipeValue(value, sourceTypeName, solidityAbi);
    if (resultType.bound === undefined) return bigIntToVmNumber(numeric);
    const encoded = fixedVmNumber(numeric, resultType.bound);
    return solidityAbi ? encoded.reverse() : encoded;
  }
  throw new Error(`messageBus: deployment recipe type ${resultTypeName} is not materializable`);
};

const canonicalRecipeEqualityValue = (
  value: FunctionArgument,
  typeName: string,
  solidityAbi: boolean,
): bigint | string => {
  const type = parseTypeStrict(typeName);
  if (type === PrimitiveType.BOOL || type === PrimitiveType.BIGINT
    || type instanceof IntType || type instanceof FixedType) {
    return numericRecipeValue(value, typeName, solidityAbi);
  }
  if (type === PrimitiveType.STRING) {
    if (typeof value === 'string') return binToHex(utf8ToBin(value));
    if (value instanceof Uint8Array) return binToHex(value);
    throw new Error('messageBus: deployment recipe expected string');
  }
  if (type instanceof AddressType || type instanceof BytesType
    || type === PrimitiveType.PUBKEY || type === PrimitiveType.DATASIG) {
    let bytesValue = value;
    if (typeof bytesValue === 'string' && type instanceof AddressType && bytesValue.includes(':')) {
      bytesValue = addressToLockScript(bytesValue);
    } else if (typeof bytesValue === 'string' && type instanceof AddressType && /^(?:0x)?0*$/i.test(bytesValue)) {
      bytesValue = new Uint8Array(0);
    } else if (typeof bytesValue === 'string') {
      bytesValue = hexToBin(bytesValue.startsWith('0x') ? bytesValue.slice(2) : bytesValue);
    }
    if (!(bytesValue instanceof Uint8Array)) {
      throw new Error(`messageBus: deployment recipe expected byte sequence ${typeName}`);
    }
    return binToHex(bytesValue);
  }
  throw new Error(`messageBus: deployment recipe equality type ${typeName} is not materializable`);
};

export const evaluateChildDeploymentRecipe = (
  recipe: ChildDeploymentValueRecipe,
  args: readonly FunctionArgument[],
  inputTypes: readonly string[],
  solidityAbi: boolean,
  state: Readonly<Record<string, FunctionArgument>> = {},
  logicalCaller?: FunctionArgument,
): FunctionArgument => {
  const resultType = recipeType(recipe, inputTypes);
  if (recipe.kind === 'handlerInput') {
    if (recipe.inputIndex < 0 || recipe.inputIndex >= args.length) {
      throw new Error(`messageBus: deployment recipe input ${recipe.inputIndex} is out of range`);
    }
    return args[recipe.inputIndex];
  }
  if (recipe.kind === 'state') {
    if (!Object.hasOwn(state, recipe.name)) {
      throw new Error(`messageBus: authenticated state recipe '${recipe.name}' is unavailable`);
    }
    return state[recipe.name];
  }
  if (recipe.kind === 'logicalCaller') {
    if (logicalCaller === undefined) {
      throw new Error('messageBus: authenticated logical caller recipe is unavailable');
    }
    return logicalCaller;
  }
  if (recipe.kind === 'aggregate') {
    return recipe.elements.map((element) =>
      evaluateChildDeploymentRecipe(element, args, inputTypes, solidityAbi, state)) as ConstructorArgument[];
  }
  if (recipe.kind === 'concat') {
    if (recipe.operands.length === 0) {
      throw new Error('messageBus: deployment concat recipe requires at least one operand');
    }
    const parsedResult = parseTypeStrict(resultType);
    if (!(parsedResult instanceof BytesType) && parsedResult !== PrimitiveType.STRING) {
      throw new Error(`messageBus: deployment concat recipe cannot produce ${resultType}`);
    }
    const values = recipe.operands.map((operand) => {
      const operandTypeName = recipeType(operand, inputTypes);
      const operandType = parseTypeStrict(operandTypeName);
      if (!(operandType instanceof BytesType) && operandType !== PrimitiveType.STRING) {
        throw new Error(`messageBus: deployment concat operand ${operandTypeName} is not concatenable`);
      }
      return byteRecipeValue(
        evaluateChildDeploymentRecipe(operand, args, inputTypes, solidityAbi, state), operandTypeName, solidityAbi,
      );
    });
    const joined = Uint8Array.from(values.flatMap((value) => [...value]));
    if (parsedResult instanceof BytesType && parsedResult.bound !== undefined && joined.length !== parsedResult.bound) {
      throw new Error(`messageBus: deployment concat recipe produced ${joined.length} bytes for ${resultType}`);
    }
    return parsedResult === PrimitiveType.STRING ? binToUtf8(joined) : joined;
  }
  if (recipe.kind === 'hash') {
    const expectedResultTypes = {
      ripemd160: 'bytes20', sha1: 'bytes20', sha256: 'bytes32', hash160: 'bytes20', hash256: 'bytes32',
    } as const;
    if (resultType !== expectedResultTypes[recipe.algorithm]) {
      throw new Error(`messageBus: deployment ${recipe.algorithm} recipe cannot produce ${resultType}`);
    }
    const operand = byteRecipeValue(
      evaluateChildDeploymentRecipe(recipe.operand, args, inputTypes, solidityAbi, state),
      recipeType(recipe.operand, inputTypes),
      solidityAbi,
    );
    switch (recipe.algorithm) {
      case 'ripemd160': return ripemd160(operand);
      case 'sha1': return sha1.hash(operand);
      case 'sha256': return sha256(operand);
      case 'hash160': return hash160(operand);
      case 'hash256': return hash256(operand);
      default: throw new Error('messageBus: unsupported deployment hash recipe');
    }
  }
  if (recipe.kind === 'intLiteral') return coerceRecipeValue(BigInt(recipe.value), 'bigint', resultType, solidityAbi);
  if (recipe.kind === 'boolLiteral') return coerceRecipeValue(recipe.value, 'bool', resultType, solidityAbi);
  if (recipe.kind === 'bytesLiteral') {
    return coerceRecipeValue(hexToBin(recipe.value), `bytes${recipe.value.length / 2}`, resultType, solidityAbi);
  }
  if (recipe.kind === 'cast') {
    const operand = evaluateChildDeploymentRecipe(recipe.operand, args, inputTypes, solidityAbi, state);
    return coerceRecipeValue(operand, recipeType(recipe.operand, inputTypes), resultType, solidityAbi);
  }
  if (recipe.kind === 'unary') {
    const operand = evaluateChildDeploymentRecipe(recipe.operand, args, inputTypes, solidityAbi, state);
    const operandTypeName = recipeType(recipe.operand, inputTypes);
    const operandType = parseTypeStrict(operandTypeName);
    const result = parseTypeStrict(resultType);
    const numeric = numericRecipeValue(operand, operandTypeName, solidityAbi);
    if (recipe.operator === '!') {
      if (operandType instanceof FixedType) {
        throw new Error('messageBus: fixed deployment recipe does not support logical negation');
      }
      return coerceRecipeValue(numeric === 0n, 'bool', resultType, solidityAbi);
    }
    if (recipe.operator === '-') {
      if ((operandType instanceof FixedType || result instanceof FixedType)
        && (!(operandType instanceof FixedType) || !(result instanceof FixedType)
          || operandType.decimals !== result.decimals)) {
        throw new Error('messageBus: fixed deployment recipe unary operands must use one scale');
      }
      return coerceRecipeValue(-numeric, operandTypeName, resultType, solidityAbi);
    }
    throw new Error(`messageBus: unsupported deployment recipe unary operator ${recipe.operator}`);
  }
  if (recipe.kind === 'conditional') {
    const conditionType = recipeType(recipe.condition, inputTypes);
    if (conditionType !== 'bool'
      || recipeType(recipe.ifTrue, inputTypes) !== resultType
      || recipeType(recipe.ifFalse, inputTypes) !== resultType) {
      throw new Error('messageBus: conditional recipe branches must match its declared type');
    }
    const condition = evaluateChildDeploymentRecipe(recipe.condition, args, inputTypes, solidityAbi, state);
    const selected = numericRecipeValue(condition, conditionType, solidityAbi) !== 0n
      ? recipe.ifTrue : recipe.ifFalse;
    return evaluateChildDeploymentRecipe(selected, args, inputTypes, solidityAbi, state);
  }
  const leftValue = evaluateChildDeploymentRecipe(recipe.left, args, inputTypes, solidityAbi, state);
  const leftType = recipeType(recipe.left, inputTypes);
  if (recipe.operator === '&&' || recipe.operator === '||') {
    const rightType = recipeType(recipe.right, inputTypes);
    if (parseTypeStrict(leftType) instanceof FixedType || parseTypeStrict(rightType) instanceof FixedType) {
      throw new Error('messageBus: fixed deployment recipe does not support logical operators');
    }
    const left = numericRecipeValue(leftValue, leftType, solidityAbi) !== 0n;
    if (recipe.operator === '&&' && !left) return false;
    if (recipe.operator === '||' && left) return true;
    const rightValue = evaluateChildDeploymentRecipe(recipe.right, args, inputTypes, solidityAbi, state);
    const right = numericRecipeValue(rightValue, rightType, solidityAbi) !== 0n;
    return recipe.operator === '&&' ? left && right : left || right;
  }
  const rightValue = evaluateChildDeploymentRecipe(recipe.right, args, inputTypes, solidityAbi, state);
  const rightType = recipeType(recipe.right, inputTypes);
  const leftParsedType = parseTypeStrict(leftType);
  const rightParsedType = parseTypeStrict(rightType);
  const resultParsedType = parseTypeStrict(resultType);
  const hasFixedOperand = leftParsedType instanceof FixedType || rightParsedType instanceof FixedType;
  if (hasFixedOperand || resultParsedType instanceof FixedType) {
    if (!(leftParsedType instanceof FixedType) || !(rightParsedType instanceof FixedType)
      || leftParsedType.decimals !== rightParsedType.decimals) {
      throw new Error('messageBus: fixed deployment recipe binary operands must use one scale');
    }
    const booleanResult = ['==', '!=', '<', '<=', '>', '>='].includes(recipe.operator);
    if (booleanResult ? resultParsedType !== PrimitiveType.BOOL
      : !(resultParsedType instanceof FixedType)
        || resultParsedType.decimals !== leftParsedType.decimals) {
      throw new Error('messageBus: fixed deployment recipe result must preserve operand scale');
    }
  }
  if (recipe.operator === '==' || recipe.operator === '!=') {
    const equal = canonicalRecipeEqualityValue(leftValue, leftType, solidityAbi)
      === canonicalRecipeEqualityValue(rightValue, rightType, solidityAbi);
    return recipe.operator === '==' ? equal : !equal;
  }
  const left = numericRecipeValue(leftValue, leftType, solidityAbi);
  const right = numericRecipeValue(rightValue, rightType, solidityAbi);
  let value: bigint | boolean;
  const fixedScale = resultParsedType instanceof FixedType ? resultParsedType.scaleFactor : undefined;
  switch (recipe.operator) {
    case '+': value = left + right; break;
    case '-': value = left - right; break;
    case '*': value = fixedScale === undefined ? left * right : left * right / fixedScale; break;
    case '/':
      if (right === 0n) throw new Error('messageBus: division by zero in deployment recipe');
      value = fixedScale === undefined ? left / right : left * fixedScale / right; break;
    case '%':
      if (right === 0n) throw new Error('messageBus: modulo by zero in deployment recipe');
      value = left % right; break;
    case '<': value = left < right; break;
    case '<=': value = left <= right; break;
    case '>': value = left > right; break;
    case '>=': value = left >= right; break;
    default: throw new Error(`messageBus: unsupported deployment recipe binary operator ${recipe.operator}`);
  }
  return coerceRecipeValue(
    value,
    typeof value === 'boolean' ? 'bool' : fixedScale === undefined ? 'bigint' : resultType,
    resultType,
    solidityAbi,
  );
};

/** Materialize one compiler-authenticated fixed BCH effect without probing placeholder outputs. */
export const materializeFixedBchTransfer = (
  transfer: FixedBchTransferAbi,
  args: readonly FunctionArgument[],
  inputTypes: readonly string[],
  executionArtifact: Artifact,
  provider: NetworkProvider,
  state: Readonly<Record<string, FunctionArgument>> = {},
  logicalCaller?: FunctionArgument,
): { lockingBytecode: Uint8Array; amount: bigint } => {
  const solidityAbi = artifactUsesSolidityAbi(executionArtifact);
  const recipientValue = transfer.derivedRecipient
    ? (() => {
      const derived = transfer.derivedRecipient!;
      const constructorArgs = derived.constructorArgs.map((recipe) =>
        evaluateChildDeploymentRecipe(recipe, args, inputTypes, solidityAbi));
      const saltValue = derived.salt
        ? evaluateChildDeploymentRecipe(derived.salt, args, inputTypes, solidityAbi)
        : undefined;
      const salt = saltValue instanceof Uint8Array ? saltValue
        : typeof saltValue === 'string' && /^(?:0x)?[0-9a-f]+$/i.test(saltValue)
          ? hexToBin(saltValue.replace(/^0x/i, '')) : undefined;
      if (derived.salt && !salt) {
        throw new Error('messageBus: stateless child recipient has an invalid salt');
      }
      const childArtifact = {
        contractName: derived.contractName,
        constructorInputs: derived.constructorInputs,
        abi: [],
        bytecode: scriptToAsm(bytecodeToScript(hexToBin(derived.creationBytecode))),
        source: '',
        compiler: executionArtifact.compiler,
        updatedAt: executionArtifact.updatedAt,
      } as Artifact;
      const child = new Contract(childArtifact, constructorArgs as never[], {
        provider,
        // Language-level `new T(...)` always derives a P2SH32 expression, regardless of the parent's wrapper.
        addressType: 'p2sh32',
        ...(salt && { salt }),
      });
      return hexToBin(child.lockingBytecode);
    })()
    : transfer.recipientRecipe
      ? evaluateChildDeploymentRecipe(transfer.recipientRecipe, args, inputTypes, solidityAbi, state, logicalCaller)
      : transfer.recipient.kind === 'forward' && transfer.recipient.paramIndex !== undefined
        ? args[transfer.recipient.paramIndex] : undefined;
  let lockingBytecode = recipientValue;
  if (typeof lockingBytecode === 'string') {
    lockingBytecode = lockingBytecode.includes(':') ? addressToLockScript(lockingBytecode)
      : hexToBin(lockingBytecode.startsWith('0x') ? lockingBytecode.slice(2) : lockingBytecode);
  }
  const amountValue = transfer.amountRecipe
    ? evaluateChildDeploymentRecipe(transfer.amountRecipe, args, inputTypes, solidityAbi, state, logicalCaller)
    : transfer.amount.kind === 'forward' && transfer.amount.paramIndex !== undefined
      ? args[transfer.amount.paramIndex]
      : transfer.amount.kind === 'literal' && transfer.amount.value !== undefined
        ? BigInt(transfer.amount.value) : undefined;
  if (!(lockingBytecode instanceof Uint8Array) || typeof amountValue !== 'bigint') {
    throw new Error('messageBus: BCH transfer is not a canonical typed effect');
  }
  return { lockingBytecode, amount: amountValue };
};

/** Normalize a replayed scalar into the physical state-codec domain used by entry commitments. */
export const materializeChildDeploymentEntryScalar = (
  value: FunctionArgument, typeName: string, solidityAbi: boolean,
): bigint | boolean | Uint8Array => {
  const type = parseTypeStrict(typeName);
  if (type === PrimitiveType.BOOL) return numericRecipeValue(value, typeName, solidityAbi) !== 0n;
  if (type === PrimitiveType.BIGINT || type instanceof IntType || type instanceof FixedType) {
    return numericRecipeValue(value, typeName, solidityAbi);
  }
  if (type instanceof AddressType || type instanceof BytesType
    || type === PrimitiveType.PUBKEY || type === PrimitiveType.DATASIG) {
    return hexToBin(canonicalRecipeEqualityValue(value, typeName, solidityAbi) as string);
  }
  throw new Error(`messageBus: deployment entry scalar type ${typeName} is not materializable`);
};

/** Normalize a replayed fixed-layout aggregate into the state codec's positional representation. */
export const materializeChildDeploymentEntryValue = (
  value: FunctionArgument, typeName: string, solidityAbi: boolean,
  structs: readonly StructDefinitionInfo[] = [], visited: ReadonlySet<string> = new Set(),
): StateValue => {
  const struct = structs.find((candidate) => candidate.name === typeName);
  if (struct) {
    if (visited.has(typeName)) {
      throw new Error(`messageBus: cyclic deployment entry struct ${typeName} is not materializable`);
    }
    if (!Array.isArray(value) || value.length !== struct.fields.length) {
      throw new Error(`messageBus: deployment entry struct ${typeName} has an invalid aggregate value`);
    }
    const nested = new Set(visited);
    nested.add(typeName);
    return struct.fields.map((field, index) => materializeChildDeploymentEntryValue(
      value[index], field.type, solidityAbi, structs, nested,
    ));
  }
  const array = parseArrayTypeString(typeName);
  if (array) {
    if (array.bound === undefined || !Array.isArray(value) || value.length !== array.bound) {
      throw new Error(`messageBus: deployment entry array ${typeName} is not a fixed-layout aggregate`);
    }
    return value.map((element) => materializeChildDeploymentEntryValue(
      element, array.elementType, solidityAbi, structs, visited,
    ));
  }
  return materializeChildDeploymentEntryScalar(value, typeName, solidityAbi);
};

const evmStaticResultType = (type: string): boolean => type === 'bool'
  || type === 'int' || type === 'uint' || type === 'bigint'
  || /^u?int(?:8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)$/.test(type)
  || /^u?fixed(?:8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)x\d+$/.test(type)
  || type === 'address' || type === 'address payable'
  || /^bytes(?:[1-9]|[12][0-9]|3[0-2])$/.test(type);

const evmWord = (value: number): Uint8Array => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('messageBus: invalid EVM ABI word value');
  const word = new Uint8Array(32);
  let rest = BigInt(value);
  for (let index = word.length - 1; index >= 0; index -= 1) {
    word[index] = Number(rest & 0xffn);
    rest >>= 8n;
  }
  if (rest !== 0n) throw new Error('messageBus: EVM ABI word value is too large');
  return word;
};

interface EvmResultLayout {
  type: string;
  kind: 'scalar' | 'bytes' | 'array' | 'struct';
  dynamic: boolean;
  staticSize: number;
  bound?: number;
  children: readonly EvmResultLayout[];
}

export const concatBytes = (parts: readonly Uint8Array[]): Uint8Array =>
  Uint8Array.from(parts.flatMap((part) => [...part]));

/** Resolve the compiler's named result types against the artifact ABI into recursive Solidity layouts. */
const evmResultLayout = (
  artifact: Artifact, type: string, activeStructs = new Set<string>(),
): EvmResultLayout | undefined => {
  if (type === 'bytes' || type === 'string') {
    return { type, kind: 'bytes', dynamic: true, staticSize: 0, children: [] };
  }
  if (evmStaticResultType(type) || artifact.enums?.some((candidate) => candidate.name === type)) {
    return { type, kind: 'scalar', dynamic: false, staticSize: 32, children: [] };
  }
  const array = parseArrayTypeString(type);
  if (array) {
    const child = evmResultLayout(artifact, array.elementType, activeStructs);
    if (!child) return undefined;
    const dynamic = array.bound === undefined || child.dynamic;
    return {
      type, kind: 'array', dynamic, staticSize: dynamic ? 0 : array.bound! * child.staticSize,
      ...(array.bound !== undefined && { bound: array.bound }), children: [child],
    };
  }
  const struct = artifact.structs?.find((candidate) => candidate.name === type);
  if (!struct || activeStructs.has(type)) return undefined;
  const nested = new Set(activeStructs); nested.add(type);
  const children = struct.fields.map((field) => evmResultLayout(artifact, field.type, nested));
  if (children.some((child) => child === undefined)) return undefined;
  const fields = children as EvmResultLayout[];
  const dynamic = fields.some((field) => field.dynamic);
  return {
    type, kind: 'struct', dynamic,
    staticSize: dynamic ? 0 : fields.reduce((sum, field) => sum + field.staticSize, 0), children: fields,
  };
};

const evmTupleHeadSize = (fields: readonly EvmResultLayout[]): number =>
  fields.reduce((sum, field) => sum + (field.dynamic ? 32 : field.staticSize), 0);

const provisionalEvmValue = (layout: EvmResultLayout): Uint8Array => {
  if (layout.kind === 'scalar') {
    const word = new Uint8Array(32);
    // Preserve the existing optimistic boolean seed at every recursively addressable result position.
    if (layout.type === 'bool') word[31] = 1;
    return word;
  }
  if (layout.kind === 'bytes' || (layout.kind === 'array' && layout.bound === undefined)) return evmWord(0);
  if (layout.kind === 'array') {
    return provisionalEvmTuple(Array.from({ length: layout.bound! }, () => layout.children[0]));
  }
  return provisionalEvmTuple(layout.children);
};

const provisionalEvmTuple = (fields: readonly EvmResultLayout[]): Uint8Array => {
  const head: Uint8Array[] = [];
  const tails: Uint8Array[] = [];
  let tailOffset = evmTupleHeadSize(fields);
  for (const field of fields) {
    const encoded = provisionalEvmValue(field);
    if (field.dynamic) {
      head.push(evmWord(tailOffset));
      tails.push(encoded);
      tailOffset += encoded.length;
    } else {
      head.push(encoded);
    }
  }
  return concatBytes([...head, ...tails]);
};

/** @internal Optimistic, type-correct seed used during fixed-point assembly and schema conformance tests. */
export const provisionalInvocationResult = (
  artifact: Artifact, resultTypes: readonly string[], publishedEncoding?: ExternalResultEncoding,
): string => {
  const encoding = resolveExternalResultEncoding(
    publishedEncoding, artifact, resultTypes, 'provisional invocation result',
  );
  if (encoding === 'compact-pushdata-v1') {
    return binToHex(Uint8Array.from(resultTypes.flatMap((type) => [
      // A transaction signature used as result data is a compact byte string, not a deferred signer. Seed it
      // with canonical empty bytes; passing numeric zero to the byte encoder is neither typed nor encodable.
      // Keep the optimistic `true` seed used to discover conditional graph edges, but derive every other seed from
      // the compiler-authored type graph. Numeric zero is not a value of bytes, arrays, or structs, and attempting
      // to encode it made otherwise supported native aggregate results fail before the first discovery pass.
      ...encodePushdataValue(type === 'bool' ? true : getDefaultStateValue(type, artifact.structs),
        type, artifact.structs),
    ])));
  }
  const layouts = resultTypes.map((type) => evmResultLayout(artifact, type));
  const unsupported = layouts.findIndex((layout) => layout === undefined);
  if (unsupported >= 0) throw new Error(
    `messageBus: EVM ABI result type '${resultTypes[unsupported]}' has no canonical provisional encoding`,
  );
  return binToHex(provisionalEvmTuple(layouts as EvmResultLayout[]));
};

const decodeEvmWord = (bytes: Uint8Array, offset: number): number => {
  if (offset < 0 || offset + 32 > bytes.length) throw new Error('messageBus: truncated EVM ABI result word');
  let value = 0n;
  for (const byte of bytes.slice(offset, offset + 32)) value = (value << 8n) | BigInt(byte);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('messageBus: EVM ABI result offset is too large');
  return Number(value);
};

const canonicalEvmScalar = (word: Uint8Array, layout: EvmResultLayout, artifact: Artifact): boolean => {
  const enumeration = artifact.enums?.find((candidate) => candidate.name === layout.type);
  if (!enumeration) return isCanonicalEvmScalarReturnVector(word, [layout.type]);
  if (!isCanonicalEvmScalarReturnVector(word, ['uint8'])) return false;
  const value = word.reduce((result, byte) => (result << 8n) | BigInt(byte), 0n);
  return enumeration.members.some((member) => BigInt(member.value) === value);
};

const canonicalEvmValueLength = (
  vector: Uint8Array, start: number, layout: EvmResultLayout, artifact: Artifact,
): number | undefined => {
  if (layout.kind === 'scalar') {
    if (start + 32 > vector.length) return undefined;
    return canonicalEvmScalar(vector.slice(start, start + 32), layout, artifact) ? 32 : undefined;
  }
  if (layout.kind === 'bytes') {
    const length = decodeEvmWord(vector, start);
    if (length === undefined) return undefined;
    const padded = Math.ceil(length / 32) * 32;
    const end = start + 32 + padded;
    if (!Number.isSafeInteger(end) || end > vector.length) return undefined;
    const padding = vector.slice(start + 32 + length, end);
    return padding.every((byte) => byte === 0) ? 32 + padded : undefined;
  }
  if (layout.kind === 'array' && layout.bound === undefined) {
    const count = decodeEvmWord(vector, start);
    if (count === undefined || count > Math.floor(vector.length / 32)) return undefined;
    const fields = Array.from({ length: count }, () => layout.children[0]);
    const tupleLength = canonicalEvmTupleLength(vector, start + 32, fields, artifact);
    return tupleLength === undefined ? undefined : 32 + tupleLength;
  }
  const fields = layout.kind === 'array'
    ? Array.from({ length: layout.bound! }, () => layout.children[0]) : layout.children;
  return canonicalEvmTupleLength(vector, start, fields, artifact);
};

const canonicalEvmTupleLength = (
  vector: Uint8Array, start: number, fields: readonly EvmResultLayout[], artifact: Artifact,
): number | undefined => {
  const headLength = evmTupleHeadSize(fields);
  if (!Number.isSafeInteger(headLength) || start + headLength > vector.length) return undefined;
  let headOffset = 0;
  let tailOffset = headLength;
  for (const field of fields) {
    if (field.dynamic) {
      const relative = decodeEvmWord(vector, start + headOffset);
      if (relative !== tailOffset || relative % 32 !== 0) return undefined;
      const length = canonicalEvmValueLength(vector, start + relative, field, artifact);
      if (length === undefined) return undefined;
      tailOffset += length;
      headOffset += 32;
    } else {
      const length = canonicalEvmValueLength(vector, start + headOffset, field, artifact);
      if (length !== field.staticSize) return undefined;
      headOffset += field.staticSize;
    }
  }
  return tailOffset;
};

/** @internal Length of one canonical ABI tuple within a concatenated route result vector. */
export const evmInvocationResultLength = (
  vector: Uint8Array, cursor: number, resultTypes: readonly string[], artifact: Artifact,
): number => {
  const layouts = resultTypes.map((type) => evmResultLayout(artifact, type));
  const unsupported = layouts.findIndex((layout) => layout === undefined);
  if (unsupported >= 0) throw new Error(`messageBus: cannot split EVM ABI result type '${resultTypes[unsupported]}'`);
  const length = canonicalEvmTupleLength(vector, cursor, layouts as EvmResultLayout[], artifact);
  if (length === undefined) throw new Error('messageBus: malformed or non-canonical EVM ABI result');
  return length;
};

/** Accept either a raw invocation vector or the one-push aggregate used by participant return events. */
export const canonicalNativeResultField = (
  vector: Uint8Array, cursor: number, type: string, structs: readonly StructDefinitionInfo[] | undefined,
): { bytesConsumed: number; encoded: Uint8Array } => {
  try {
    const decoded = decodePushdataValue(vector, cursor, type, structs);
    return {
      bytesConsumed: decoded.bytesConsumed,
      encoded: encodePushdataValue(decoded.value, type, structs),
    };
  } catch (error) {
    // `encodeFunctionArgument` protects an empty top-level dynamic array count from an enclosing unlocking push by
    // spelling the value as `01 00`. If that transport spelling is forwarded into a provisional result vector,
    // consume it as exactly one empty array field and immediately restore the canonical result spelling (`00`).
    const array = parseArrayTypeString(type);
    if (array?.bound === undefined && vector[cursor] === 0x01 && vector[cursor + 1] === 0x00) {
      return { bytesConsumed: 2, encoded: encodePushdataValue([], type, structs) };
    }
    throw error;
  }
};

export const preparedInvocationResult = (
  commitment: Uint8Array | undefined, artifact: Artifact, resultTypes: readonly string[],
  publishedEncoding?: ExternalResultEncoding,
): string | undefined => {
  if (!commitment) return undefined;
  const encoding = resolveExternalResultEncoding(
    publishedEncoding, artifact, resultTypes, 'prepared invocation result',
  );
  const canonical = (candidate: Uint8Array): Uint8Array | undefined => {
    try {
      if (encoding === 'evm-abi-v1') {
        return evmInvocationResultLength(candidate, 0, resultTypes, artifact) === candidate.length
          ? candidate : undefined;
      }
      let cursor = 0;
      const fields: Uint8Array[] = [];
      for (const type of resultTypes) {
        const decoded = canonicalNativeResultField(candidate, cursor, type, artifact.structs);
        cursor += decoded.bytesConsumed;
        fields.push(decoded.encoded);
      }
      return cursor === candidate.length ? concatBytes(fields) : undefined;
    } catch {
      return undefined;
    }
  };
  const direct = canonical(commitment);
  if (direct) return binToHex(direct);
  try {
    const outer = decodePushdataValue(commitment, 0, 'bytes');
    if (outer.value instanceof Uint8Array && outer.bytesConsumed === commitment.length) {
      const inner = canonical(outer.value);
      if (inner) return binToHex(inner);
      // An empty top-level dynamic array requires `01 00` when transported as an unlocking argument so its count
      // byte survives the outer push. That transport escape is not the array value itself: result vectors use the
      // canonical one-byte `00` count. Accept it only for this exact schema/value and normalize it immediately.
      const only = resultTypes.length === 1 ? parseArrayTypeString(resultTypes[0]) : undefined;
      if (only?.bound === undefined && outer.value.length === 0) {
        return binToHex(encodePushdataValue([], resultTypes[0], artifact.structs));
      }
    }
  } catch {
    // The caller below reports one stable error for malformed prepared data.
  }
  throw new Error('messageBus: prepared return commitment does not match the invocation result schema');
};

export interface ComputedValueChunkSpanClaim {
  offset: number;
  resourceIdentity?: string;
  resourcePart?: string;
}

/**
 * Keep compiler-authenticated continuation slots inside their participant while compacting a published block.
 * Claim offsets are absolute transaction coordinates; the returned size is participant-relative and never
 * exceeds the compiler-published maximum.
 */
export function minimumActualSizeForComputedValueChunkClaims(
  participant: number,
  participantBase: number,
  fixedSize: number,
  maximumSize: number,
  claims: readonly ComputedValueChunkSpanClaim[],
): number {
  if (![participant, participantBase, fixedSize, maximumSize].every(Number.isSafeInteger)
    || participant < 0 || participantBase < 0 || fixedSize < 0 || maximumSize < fixedSize) {
    throw new Error(`messageBus: participant ${participant} has invalid computed value-chunk span geometry`);
  }
  let minimumSize = fixedSize;
  const offsets = new Map<number, string>();
  const parts = new Map<string, number>();
  const starts = new Map<string, number>();
  const indices = new Map<string, Set<number>>();
  for (const claim of claims) {
    if (claim.resourceIdentity === undefined) continue;
    const resourceIdentity = canonicalValueChunkProducerResourceIdentity(claim.resourceIdentity);
    if (resourceIdentity === undefined || resourceIdentity !== claim.resourceIdentity) {
      throw new Error(`messageBus: participant ${participant} has a non-canonical computed value-chunk resource identity`);
    }
    const part = /^(?:chunk:)(0|[1-9][0-9]*)$/.exec(claim.resourcePart ?? '');
    if (part === null) {
      throw new Error(
        `messageBus: participant ${participant} computed value-chunk resource '${resourceIdentity}' `
        + 'has a non-canonical resource part',
      );
    }
    if (!Number.isSafeInteger(claim.offset)) {
      throw new Error(
        `messageBus: participant ${participant} computed value-chunk resource '${resourceIdentity}' `
        + 'has an invalid absolute offset',
      );
    }
    const localOffset = claim.offset - participantBase;
    if (localOffset < fixedSize || localOffset >= maximumSize) {
      throw new Error(
        `messageBus: participant ${participant} computed value-chunk resource '${resourceIdentity}' `
        + `offset ${claim.offset} is outside its published trailing range `
        + `[${participantBase + fixedSize}, ${participantBase + maximumSize})`,
      );
    }
    const chunkIndex = Number(part[1]);
    if (!Number.isSafeInteger(chunkIndex)) {
      throw new Error(
        `messageBus: participant ${participant} computed value-chunk resource '${resourceIdentity}' `
        + 'has an invalid chunk index',
      );
    }
    const partIdentity = `${resourceIdentity}\u0000${part[0]}`;
    const priorPartOffset = parts.get(partIdentity);
    if (priorPartOffset !== undefined && priorPartOffset !== claim.offset) {
      throw new Error(
        `messageBus: participant ${participant} computed value-chunk resource '${resourceIdentity}' `
        + `moves ${part[0]} from ${priorPartOffset} to ${claim.offset}`,
      );
    }
    if (priorPartOffset === claim.offset) continue;
    parts.set(partIdentity, claim.offset);
    const priorOffsetOwner = offsets.get(claim.offset);
    if (priorOffsetOwner !== undefined) {
      throw new Error(
        `messageBus: participant ${participant} computed value-chunk offset ${claim.offset} is claimed by both `
        + `'${priorOffsetOwner}' and '${resourceIdentity}'`,
      );
    }
    offsets.set(claim.offset, resourceIdentity);
    const runStart = localOffset - chunkIndex;
    const priorStart = starts.get(resourceIdentity);
    if (priorStart !== undefined && priorStart !== runStart) {
      throw new Error(
        `messageBus: participant ${participant} computed value-chunk resource '${resourceIdentity}' `
        + 'has conflicting chunk geometry',
      );
    }
    starts.set(resourceIdentity, runStart);
    const resourceIndices = indices.get(resourceIdentity) ?? new Set<number>();
    resourceIndices.add(chunkIndex);
    indices.set(resourceIdentity, resourceIndices);
    minimumSize = Math.max(minimumSize, localOffset + 1);
  }
  for (const [resourceIdentity, resourceIndices] of indices) {
    const maximumIndex = Math.max(...resourceIndices);
    for (let index = 0; index <= maximumIndex; index += 1) {
      if (resourceIndices.has(index)) continue;
      throw new Error(
        `messageBus: participant ${participant} computed value-chunk resource '${resourceIdentity}' `
        + `omits chunk:${index}`,
      );
    }
  }
  return minimumSize;
}

const isOptimisticIntegerType = (type: string): boolean => (
  type === 'int' || type === 'uint' || type === 'bigint' || /^u?int\d+$/.test(type)
);

type StickyWritingRow = {
  handler: { name: string; writesState?: boolean; emits?: readonly unknown[]; inputs: readonly { name: string; type: string }[] };
  args: readonly FunctionArgument[];
};

/**
 * ahead-of-time compose coverage/I4: when a message-bus shell left a single-int data NFT at its input commitment, apply the
 * recipe post-state before aggregate publish so converge does not need extract-from-failed-VM.
 *
 * - Writers with `emits` → leftover +1 (counter+emit; emit payload ints are not the write source).
 * - Writers without emits + one visible int arg → assign that arg (Mid.seen = next beside outState).
 */
export function stickyKernelLeftoverScalarWrites(
  local: TransactionBuilder,
  artifact: Artifact,
  blockLayout: { slots: readonly { kind: string; offset: number }[] },
  writingRows: readonly StickyWritingRow[] = [],
): boolean {
  const layout = artifact.stateLayout as StateLayout | undefined;
  if (!layout) return false;
  // Ignore compiler-internal holds (`__messageBusHold`) — event-only proxies still carry one.
  const intFields = layout.variables.filter((variable) => !variable.dynamic
    && !variable.name.includes('$')
    && !variable.name.startsWith('__')
    && isOptimisticIntegerType(variable.type));
  if (intFields.length !== 1) return false;
  const stateWriters = writingRows.filter((row) => (
    row.handler.writesState !== false
    && row.handler.name !== 'initialize'
    && row.handler.name !== 'constructor'
    && row.handler.name !== '__forward'
    && !row.handler.name.startsWith('__message_bus')
  ));
  const hasScalarWriter = stateWriters.length > 0 || artifact.abi.some((entry) => (
    entry.writesState === true
    && entry.name !== 'initialize'
    && entry.name !== 'constructor'
    && entry.name !== '__forward'
    && !entry.name.startsWith('__message_bus')
  ));
  if (!hasScalarWriter) return false;
  const field = intFields[0];
  const nftIndex = field.nftIndex;
  const primaryWriter = stateWriters.length === 1 ? stateWriters[0] : undefined;
  const writerEmits = (primaryWriter?.handler.emits?.length ?? 0) > 0
    || (primaryWriter === undefined && artifact.abi.some((entry) => (
      entry.writesState === true
      && (entry.emits?.length ?? 0) > 0
      && entry.name !== 'initialize'
      && entry.name !== 'constructor'
      && entry.name !== '__forward'
      && !entry.name.startsWith('__message_bus')
    )));
  let assignedValue: bigint | undefined;
  if (primaryWriter && !writerEmits) {
    const visible = primaryWriter.handler.inputs
      .map((input, index) => ({ input, index }))
      .filter(({ input }) => !input.name.startsWith('__internal__') && isOptimisticIntegerType(input.type));
    if (visible.length === 1) {
      const arg = primaryWriter.args[visible[0].index];
      if (typeof arg === 'bigint') assignedValue = arg;
    }
  }
  let wrote = false;
  for (const slot of blockLayout.slots) {
    if (slot.kind !== 'dataNft') continue;
    const input = local.inputs[slot.offset];
    const output = local.outputs[slot.offset];
    if (input?.token?.nft?.capability !== 'mutable' || output?.token?.nft?.capability !== 'mutable') {
      continue;
    }
    const inCommit = input.token.nft.commitment ?? '';
    const outCommit = output.token.nft.commitment ?? '';
    try {
      const parsed = parsePushdataCommitment(inCommit, layout, nftIndex);
      const current = parsed[field.name];
      if (typeof current !== 'bigint') continue;
      // Arg-assign (I4): replace a wrong leftover +1 / stale commitment with the invocation int.
      // Leftover +1 (ahead-of-time compose coverage): only when the NFT still mirrors its input commitment.
      if (assignedValue === undefined && outCommit !== inCommit) continue;
      const nextValue = assignedValue !== undefined ? assignedValue : current + 1n;
      const nextState: Record<string, StateValue> = { ...parsed, [field.name]: nextValue };
      const nextCommit = buildPushdataCommitment(layout, nextState, nftIndex);
      if (outCommit === nextCommit) continue;
      output.token.nft.commitment = nextCommit;
      wrote = true;
    } catch {
      // Malformed or non-scalar commitments stay untouched.
    }
  }
  return wrote;
}

