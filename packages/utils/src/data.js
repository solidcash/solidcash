import { bigIntToVmNumber, utf8ToBin, binToUtf8, vmNumberToBigInt, isVmNumberError, stackItemIsTruthy, padMinimallyEncodedVmNumber, } from '@bitauth/libauth';
export function encodeBool(bool) {
    return bool ? encodeInt(1n) : encodeInt(0n);
}
export function decodeBool(encodedBool) {
    return stackItemIsTruthy(encodedBool);
}
export function encodeInt(int) {
    return bigIntToVmNumber(int);
}
export function encodeIntAsFixedBytes(int, byteLength) {
    const minimal = encodeInt(int);
    if (minimal.length > byteLength)
        throw new Error('value exceeds the requested byteLength');
    return padMinimallyEncodedVmNumber(minimal, byteLength);
}
export function decodeInt(encodedInt, maxLength = 10000) {
    const options = { maximumVmNumberByteLength: maxLength };
    const result = vmNumberToBigInt(encodedInt, options);
    if (isVmNumberError(result)) {
        throw new Error(result);
    }
    return result;
}
/**
 * Decode a fixed-width (OP_NUM2BIN) sign-magnitude int - the OP_BIN2NUM inverse of encodeIntAsFixedBytes.
 * Unlike decodeInt, it accepts the non-minimal zero-padding that NUM2BIN/fixed-width packing produces.
 */
export function decodeIntFixedWidth(encodedInt, maxLength = 10000) {
    const result = vmNumberToBigInt(encodedInt, {
        maximumVmNumberByteLength: maxLength,
        requireMinimalEncoding: false,
    });
    if (isVmNumberError(result)) {
        throw new Error(result);
    }
    return result;
}
export function encodeString(str) {
    return utf8ToBin(str);
}
export function decodeString(encodedString) {
    return binToUtf8(encodedString);
}
export function placeholder(size) {
    return new Uint8Array(size).fill(0);
}
//# sourceMappingURL=data.js.map