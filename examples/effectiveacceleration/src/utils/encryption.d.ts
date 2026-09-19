import { SigningKey, Signer, JsonRpcSigner } from "ethers";
export declare const cidToHash: (cid: string) => string;
export declare const hashToCid: (hash: string) => string;
export declare const encryptBinaryData: (data: Uint8Array, sessionKey: string | undefined) => Uint8Array;
export declare const encryptUtf8Data: (data: string, sessionKey: string | undefined) => Uint8Array;
export declare const publishToIpfsRaw: (encodedData: string) => Promise<{
    hash: string;
    cid: string;
}>;
export declare const publishToIpfs: (message: string, sessionKey?: string | undefined) => Promise<{
    hash: string;
    cid: string;
}>;
type PublishedIpfs = {
    hash: string;
    cid: string;
};
export declare function publishMediaToIpfs(mimeType: string, mediaBytes: Uint8Array, sessionKey?: string): Promise<PublishedIpfs>;
export declare function publishMediaToIpfs(fileName: string, mimeType: string, mediaBytes: Uint8Array, sessionKey?: string): Promise<PublishedIpfs>;
export declare const decryptBinaryData: (data: Uint8Array, sessionKey: string | undefined) => Uint8Array;
export declare const decryptUtf8Data: (data: Uint8Array, sessionKey: string | undefined) => string;
export declare const getFromIpfsRaw: (cidOrHash: string) => Promise<string>;
export declare const getFromIpfs: (cidOrHash: string, sessionKey?: string | undefined) => Promise<string>;
export declare const safeGetFromIpfs: (cidOrHash: string, sessionKey?: string | undefined) => Promise<string>;
export declare const getMediaFromIpfs: (cidOrHash: string, sessionKey?: string | undefined) => Promise<{
    fileName: string;
    mimeType: string;
    mediaBytes: Uint8Array;
}>;
export declare const safeGetMediaFromIpfs: (cidOrHash: string, sessionKey?: string | undefined) => Promise<{
    fileName: string;
    mimeType: string;
    mediaBytes: Uint8Array;
}>;
export declare const getEncryptionSigningKey: (signer: Signer | JsonRpcSigner) => Promise<SigningKey>;
export declare const getSessionKey: (signer: Signer | JsonRpcSigner, otherCompressedPublicKey: string, jobId: string | bigint) => Promise<string>;
export {};
