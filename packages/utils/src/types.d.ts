export type Type = PrimitiveType | ArrayType | TupleType | BytesType | IntType | FixedType | MappingType | StructType | TokenContainerType | EnumType | AddressType | ValueType | FunctionType;
export declare class TokenContainerType {
    toString(): string;
}
export declare class AddressType {
    payable: boolean;
    interfaceName?: string | undefined;
    constructor(payable?: boolean, interfaceName?: string | undefined);
    toString(): string;
}
export declare class ArrayType {
    elementType: Type;
    bound?: number | undefined;
    constructor(elementType: Type, bound?: number | undefined);
    toString(): string;
}
export declare class BytesType {
    bound?: number | undefined;
    constructor(bound?: number | undefined);
    static fromString(str: string): BytesType;
    toString(): string;
}
export declare class IntType {
    signed: boolean;
    bits: number;
    constructor(signed: boolean, bits: number);
    get minValue(): bigint;
    get maxValue(): bigint;
    get byteWidth(): number;
    toString(): string;
    static isValidBitWidth(bits: number): boolean;
}
export declare class FixedType {
    signed: boolean;
    bits: number;
    decimals: number;
    readonly scaleFactor: bigint;
    constructor(signed: boolean, bits: number, // M - total bit width (8-256, step 8)
    decimals: number);
    get minValue(): bigint;
    get maxValue(): bigint;
    get byteWidth(): number;
    toString(): string;
    static isValidBitWidth(bits: number): boolean;
    static isValidDecimals(decimals: number): boolean;
}
export declare class MappingType {
    keyType: Type;
    valueType: Type;
    keyName?: string | undefined;
    valueName?: string | undefined;
    constructor(keyType: Type, valueType: Type, keyName?: string | undefined, valueName?: string | undefined);
    toString(): string;
    toSourceString(): string;
}
export declare class StructType {
    name: string;
    fields: {
        name: string;
        type: Type;
    }[];
    constructor(name: string, fields: {
        name: string;
        type: Type;
    }[]);
    toString(): string;
}
export declare class EnumType {
    name: string;
    members: {
        name: string;
        value: bigint;
    }[];
    constructor(name: string, members: {
        name: string;
        value: bigint;
    }[]);
    toString(): string;
}
export declare class ValueType {
    readonly name: string;
    readonly underlyingType: BytesType | IntType | PrimitiveType;
    constructor(name: string, underlyingType: BytesType | IntType | PrimitiveType);
    toString(): string;
}
/** Canonical public artifact spelling for a resolved language type. */
export declare function abiTypeString(type: Type | undefined): string;
export declare class TupleType {
    elements: Type[];
    constructor(elements: Type[]);
    get leftType(): Type;
    get rightType(): Type;
    toString(): string;
}
export declare class FunctionType {
    parameterTypes: Type[];
    returnTypes: Type[];
    isExternal: boolean;
    stateMutability: 'pure' | 'view' | 'payable' | 'nonpayable';
    constructor(parameterTypes: Type[], returnTypes: Type[], isExternal?: boolean, stateMutability?: 'pure' | 'view' | 'payable' | 'nonpayable');
    toString(): string;
}
export declare enum PrimitiveType {
    INT = "int",
    BIGINT = "bigint",
    BOOL = "bool",
    STRING = "string",
    PUBKEY = "pubkey",
    SIG = "sig",
    DATASIG = "datasig",
    ANY = "any",
    VOID = "void"
}
export declare function explicitlyCastable(from?: Type, to?: Type): boolean;
export declare function implicitlyCastable(actual?: Type, expected?: Type): boolean;
export declare function arrayType(types: Type[]): Type | undefined;
export declare function implicitlyCastableSignature(actual: Type[], expected: Type[]): boolean;
export declare function parseType(str: string): Type;
/** Like parseType but throws on unrecognized types (for SDK boundary validation). */
export declare function parseTypeStrict(str: string): Type;
/**
 * A type is fixed-width when its packed (tight) encoding is a constant number of bytes - the basis for the
 * flat-stream chunk-packed array (element `i` at byte offset `i * fixedWidthBytes`). Mirrors the compiler's
 * getFixedWidth/emitEncodeElementPacked. NOT fixed-width (value-dependent encoding): plain `int`, unbounded
 * `bytes`, `string`, and structs with any dynamic field. Accepts a Type or a type string.
 */
export declare function isFixedWidthType(type: Type | string): boolean;
/**
 * An array element type eligible for the chunk-packed backend. Fixed-width types (incl. fixed-width structs)
 * use the flat-stream layout (count = A$len/width). Variable-width leaves (plain `int`, `string`, unbounded
 * `bytes`) and variable-width structs use the framed layout: one dynamic value
 * `pushdata(count) ++ pushdata(elem_0) ++ ...`, accessed by scan. Nested-array elements are NOT yet
 * chunk-packable (they stay on the collection backend). Accepts a Type or a type string.
 */
export declare function isChunkPackableElementType(type: Type | string): boolean;
/** Packed (tight) byte width of a fixed-width type. Throws if the type is not fixed-width. */
export declare function fixedWidthBytes(type: Type | string): number;
export declare function isPrimitive(type: Type): type is PrimitiveType;
/**
 * A dynamic-storage type: variable-length state stored in chunk UTXOs (string / unbounded bytes).
 * Such a state var desugars to a hidden `uint32 <name>$len` register field + a chunk collection.
 * See packages/solidc/docs/dynamic-storage.md.
 */
export declare function isDynamicStorageType(type: Type): boolean;
/**
 * A P5b CHUNKABLE vmap mapping value: a variable-width blob that chunks off-commitment when it exceeds the ~60 B
 * inline tail (stored as len ++ sha256, the value in per-slot chunk NFTs). Covers unbounded `bytes`/`string`,
 * variable-width or >60-byte `struct`, and any array `T[]` / `T[N]` - values whose blobs can exceed the 128 B
 * commitment. A small value (int, bool, bytesN, a short fixed-width struct) stays inline in the tail; the runtime
 * `size > 60` guard picks inline
 * vs chunked. This is the SINGLE source of truth for the compiler covenant, the SDK gates, and the artifact flag.
 */
export declare function isChunkableValueType(type: Type): boolean;
export interface LocationI {
    start: {
        line: number;
        column: number;
    };
    end: {
        line: number;
        column: number;
    };
}
export type SingleLocationData = {
    location: LocationI;
    positionHint: PositionHint;
};
export type FullLocationData = Array<SingleLocationData>;
export declare enum PositionHint {
    START = 0,
    END = 1
}
