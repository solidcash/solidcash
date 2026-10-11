import { EnumType, StructType, ValueType, type Type } from '@solidcash/utils';

/**
 * Stable identity per user-defined type instance. Two declarations may share a bare name (`library L { struct S; }`
 * beside `interface I { struct S; }`), so a signature built from `toString()` reads them as one type: it reports a
 * redefinition for two genuinely distinct overloads, and it keys the redefinition/signature sets by a name that
 * does not identify the declaration. The same declaration keeps one token wherever it is referenced.
 */
const declaredTypeIds = new WeakMap<object, number>();
let nextDeclaredTypeId = 0;

/**
 * One parameter's contribution to a redefinition key. A user-defined type contributes its declaration identity;
 * every other type keeps its spelled type. `address` and `address payable` stay distinct unless
 * `erasePayability` is set, because a caller that compared erased spellings must keep doing so.
 */
export function parameterTypeToken(type: Type, erasePayability = false): string {
  if (type instanceof StructType || type instanceof EnumType || type instanceof ValueType) {
    let id = declaredTypeIds.get(type);
    if (id === undefined) {
      id = nextDeclaredTypeId++;
      declaredTypeIds.set(type, id);
    }
    return `#${id}`;
  }
  const spelled = type.toString();
  return erasePayability ? spelled.replace(/address payable/g, 'address') : spelled;
}

/** The redefinition key for a callable: name plus one identity-aware token per parameter. */
export function parameterTypeSignature(
  name: string, parameterTypes: readonly Type[], erasePayability = false,
): string {
  return `${name}(${parameterTypes.map((t) => parameterTypeToken(t, erasePayability)).join(',')})`;
}
