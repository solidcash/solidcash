import { SignatureAlgorithm } from 'solidcash';
export declare class PriceOracle {
    privateKey: Uint8Array;
    constructor(privateKey: Uint8Array);
    createMessage(blockHeight: bigint, bchUsdPrice: bigint): Uint8Array;
    signMessage(message: Uint8Array, signatureAlgorithm?: SignatureAlgorithm): Uint8Array;
}
