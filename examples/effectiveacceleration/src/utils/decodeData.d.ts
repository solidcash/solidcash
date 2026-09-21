export declare const decodeString: (ptr: {
    bytes: Uint8Array;
    index: number;
}) => string;
export declare const decodeBytes: (ptr: {
    bytes: Uint8Array;
    index: number;
}) => string;
export declare const decodeStringArray: (ptr: {
    bytes: Uint8Array;
    index: number;
}) => string[];
export declare const decodeAddressArray: (ptr: {
    bytes: Uint8Array;
    index: number;
}) => string[];
export declare const decodeBytes32: (ptr: {
    bytes: Uint8Array;
    index: number;
}) => string;
export declare const decodeBool: (ptr: {
    bytes: Uint8Array;
    index: number;
}) => boolean;
export declare const decodeAddress: (ptr: {
    bytes: Uint8Array;
    index: number;
}) => string;
export declare const decodeUint256: (ptr: {
    bytes: Uint8Array;
    index: number;
}) => bigint;
export declare const decodeUint32: (ptr: {
    bytes: Uint8Array;
    index: number;
}) => number;
export declare const decodeUint16: (ptr: {
    bytes: Uint8Array;
    index: number;
}) => number;
