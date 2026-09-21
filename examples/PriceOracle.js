import { padMinimallyEncodedVmNumber, flattenBinArray } from '@bitauth/libauth';
import { encodeInt, sha256 } from '@solidcash/utils';
import { SignatureAlgorithm, SignatureTemplate } from 'solidcash';
export class PriceOracle {
    constructor(privateKey) {
        this.privateKey = privateKey;
    }
    // Encode a blockHeight and bchUsdPrice into a byte sequence of 8 bytes (4 bytes per value)
    createMessage(blockHeight, bchUsdPrice) {
        const encodedBlockHeight = padMinimallyEncodedVmNumber(encodeInt(blockHeight), 4);
        const encodedBchUsdPrice = padMinimallyEncodedVmNumber(encodeInt(bchUsdPrice), 4);
        return flattenBinArray([encodedBlockHeight, encodedBchUsdPrice]);
    }
    signMessage(message, signatureAlgorithm = SignatureAlgorithm.SCHNORR) {
        const signatureTemplate = new SignatureTemplate(this.privateKey, undefined, signatureAlgorithm);
        return signatureTemplate.signMessageHash(sha256(message));
    }
}
//# sourceMappingURL=PriceOracle.js.map