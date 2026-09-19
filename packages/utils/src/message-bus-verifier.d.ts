import { type Script } from './script.js';
export interface MessageBusVerifierProgram {
    verifyFunctionId: number;
    inputCount: number;
    inputs: readonly {
        name: string;
        type: string;
    }[];
    functions: readonly {
        id: number;
        name: string;
        bytecode: string;
    }[];
    /** Selector-derived participant lifecycle authority encoded in the verifier's two-byte result suffix. */
    lifecycle?: true;
    /** @deprecated Read support for artifacts emitted before lifecycle authority was generalized to merge. */
    splitLifecycle?: true;
}
/** The specialized verifier cannot fit within BCH's consensus script-size limit. */
export declare class MessageBusVerifierCapacityError extends Error {
    constructor(byteLength: number, maximumInputBytes?: number);
}
/** Commitment domain for one genesis-deployed composition-verifier instance. */
export declare const MESSAGE_BUS_VERIFIER_COMMITMENT_DOMAIN: Uint8Array<ArrayBuffer>;
/** Stable per-instance commitment. Instances share one covenant address but remain independently discoverable. */
export declare const messageBusVerifierCommitment: (instance: number) => Uint8Array;
/**
 * Category-branded, self-preserving message bus verifier covenant.
 *
 * The global callManifest verifier is deliberately added to this covenant rather than to participant masters;
 * these preservation checks are the stable deployment and recreation boundary. The mutable NFT commitment
 * identifies one of N independently spendable verifier instances deployed with the contract.
 */
export declare function buildMessageBusVerifierCovenantScript(program: MessageBusVerifierProgram, maximumInputBytes?: number): Script;
export declare const messageBusVerifierCovenantBytecode: (program: MessageBusVerifierProgram, maximumInputBytes?: number) => Uint8Array;
export declare const messageBusVerifierCovenantHex: (program: MessageBusVerifierProgram) => string;
/** Artifact-fixed P2SH32 lock; the NFT category supplies deployment-specific branding. */
export declare const messageBusVerifierLockingBytecode: (program: MessageBusVerifierProgram, maximumInputBytes?: number) => Uint8Array;
