export declare function sha512(payload: Uint8Array): Uint8Array;
export declare function sha256(payload: Uint8Array): Uint8Array;
export declare function ripemd160(payload: Uint8Array): Uint8Array;
export declare function hash160(payload: Uint8Array): Uint8Array;
export declare function hash256(payload: Uint8Array): Uint8Array;
/**
 * Project a native locking bytecode (or short identity) to the 32-byte left-padded
 * solidity ABI address word used on graph-emission address lanes. Empty stays empty
 * (address(0)). Already-ABI 32-byte words pass through.
 */
export declare function addressToGraphEmissionBytes(lockOrIdentity: Uint8Array): Uint8Array;
