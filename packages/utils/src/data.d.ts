export declare function encodeBool(bool: boolean): Uint8Array;
export declare function decodeBool(encodedBool: Uint8Array): boolean;
export declare function encodeInt(int: bigint): Uint8Array;
export declare function encodeIntAsFixedBytes(int: bigint, byteLength: number): Uint8Array;
export declare function decodeInt(encodedInt: Uint8Array, maxLength?: number): bigint;
/**
 * Decode a fixed-width (OP_NUM2BIN) sign-magnitude int - the OP_BIN2NUM inverse of encodeIntAsFixedBytes.
 * Unlike decodeInt, it accepts the non-minimal zero-padding that NUM2BIN/fixed-width packing produces.
 */
export declare function decodeIntFixedWidth(encodedInt: Uint8Array, maxLength?: number): bigint;
export declare function encodeString(str: string): Uint8Array;
export declare function decodeString(encodedString: Uint8Array): string;
export declare function placeholder(size: number): Uint8Array;
