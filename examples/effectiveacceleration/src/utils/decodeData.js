import { toUtf8String, hexlify, getAddress, toBigInt, ZeroAddress } from "ethers";
// local decode utils
export const decodeString = (ptr) => {
    const length = ptr.bytes[ptr.index];
    ptr.index++;
    const result = toUtf8String(ptr.bytes.slice(ptr.index, ptr.index + length));
    ptr.index += length;
    return result;
};
export const decodeBytes = (ptr) => {
    const length = ptr.bytes[ptr.index];
    ptr.index++;
    const result = hexlify(ptr.bytes.slice(ptr.index, ptr.index + length));
    ptr.index += length;
    return result;
};
export const decodeStringArray = (ptr) => {
    const length = ptr.bytes[ptr.index];
    ptr.index++;
    const result = [];
    for (let i = 0; i < length; i++) {
        const str = decodeString(ptr);
        result.push(str);
    }
    return result;
};
export const decodeAddressArray = (ptr) => {
    const length = ptr.bytes[ptr.index];
    ptr.index++;
    const result = [];
    for (let i = 0; i < length; i++) {
        result.push(decodeAddress(ptr));
    }
    return result;
};
export const decodeBytes32 = (ptr) => {
    const result = hexlify(ptr.bytes.slice(ptr.index, ptr.index + 32));
    ptr.index += 32;
    return result;
};
export const decodeBool = (ptr) => {
    const result = ptr.bytes[ptr.index] === 1;
    ptr.index++;
    return result;
};
export const decodeAddress = (ptr) => {
    const bytes = ptr.bytes;
    // Packed uint160 may prefix a VM sign byte 0x00 in front of a real locking
    // bytecode (update-job arbitrator: 00 || 76a914…88ac || bool).
    if (bytes[ptr.index] === 0 && ptr.bytes.length - ptr.index > 23) {
        const next = bytes[ptr.index + 1];
        if (next === 0xaa || next === 0xa9 || next === 0x76)
            ptr.index += 1;
    }
    const rest = ptr.bytes.length - ptr.index;
    const index = ptr.index;
    // Packed `uint160(address)` on BCH publishes the locking bytecode. Recognize the standard forms
    // before the 20-byte Solidity-account fallback so p2sh32 tokens survive event replay.
    if (rest >= 35 && bytes[index] === 0xaa && bytes[index + 1] === 0x20 && bytes[index + 34] === 0x87) {
        const slice = bytes.slice(index, index + 35);
        ptr.index += 35;
        return hexlify(slice);
    }
    if (rest >= 23 && bytes[index] === 0xa9 && bytes[index + 1] === 0x14 && bytes[index + 22] === 0x87) {
        const slice = bytes.slice(index, index + 23);
        ptr.index += 23;
        return hexlify(slice);
    }
    if (rest >= 25 && bytes[index] === 0x76 && bytes[index + 1] === 0xa9 && bytes[index + 2] === 0x14
        && bytes[index + 23] === 0x88 && bytes[index + 24] === 0xac) {
        const slice = bytes.slice(index, index + 25);
        ptr.index += 25;
        return hexlify(slice);
    }
    // Packed `uint160(address(0))` can be a run of zeros (1..22 bytes) followed by
    // the schema's trailing bool. The old `rest < 24 && first==0` path consumed one
    // zero and left the next zero as whitelistWorkers=false (Updated tail is
    // 22*0x00 || 0x01).
    if (bytes[index] === 0 && rest > 0 && rest < 24) {
        const maybeBool = rest > 1 && (bytes[bytes.length - 1] === 0 || bytes[bytes.length - 1] === 1);
        const bodyEnd = maybeBool ? bytes.length - 1 : bytes.length;
        const body = bytes.slice(index, bodyEnd);
        if (body.length === 0 || body.every((byte) => byte === 0)) {
            ptr.index = bodyEnd;
            return ZeroAddress;
        }
        ptr.index += 1;
        return ZeroAddress;
    }
    if (ptr.bytes.length - ptr.index < 20) {
        // uint160(address(0)) is the minimal zero VM number and therefore contributes no payload bytes; only the
        // following packed field remains.
        return ZeroAddress;
    }
    const result = getAddress(hexlify(ptr.bytes.slice(ptr.index, ptr.index + 20)));
    // Packed `uint160` is 20 bytes. A following packed bool is 0x00/0x01 and must
    // not be eaten as the unsigned VM sign byte (that would drop whitelistWorkers).
    const after20 = ptr.bytes.length - (index + 20);
    if (after20 === 1 && (bytes[index + 20] === 0 || bytes[index + 20] === 1)) {
        ptr.index += 20;
        return result;
    }
    // These event schemas cast addresses to uint160 before packing. SolidCash's unsigned VM-number width retains
    // one trailing sign byte, so consume 21 while exposing the first 20 account bytes.
    ptr.index += 21;
    return result;
};
export const decodeUint256 = (ptr) => {
    const result = toBigInt(ptr.bytes.slice(ptr.index, ptr.index + 32));
    ptr.index += 32;
    return result;
};
export const decodeUint32 = (ptr) => {
    const result = new DataView(ptr.bytes.buffer, ptr.bytes.byteOffset + ptr.index, 4).getUint32(0);
    ptr.index += 4;
    return result;
};
export const decodeUint16 = (ptr) => {
    const result = new DataView(ptr.bytes.buffer, ptr.bytes.byteOffset + ptr.index, 4).getUint32(0);
    // The source assignment widens maxTime into the uint32 state field before the event reads it.
    ptr.index += 4;
    return result;
};
//# sourceMappingURL=decodeData.js.map