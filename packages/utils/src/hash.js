import { sha256 as sha256Lib, ripemd160 as ripemd160Lib, sha512 as sha512Lib } from '@bitauth/libauth';
export function sha512(payload) {
    return sha512Lib.hash(payload);
}
export function sha256(payload) {
    return sha256Lib.hash(payload);
}
export function ripemd160(payload) {
    return ripemd160Lib.hash(payload);
}
export function hash160(payload) {
    return ripemd160(sha256(payload));
}
export function hash256(payload) {
    return sha256(sha256(payload));
}
//# sourceMappingURL=hash.js.map