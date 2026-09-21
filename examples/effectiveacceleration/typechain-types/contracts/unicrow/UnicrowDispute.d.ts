import { ContractFactory, StatefulContract } from 'solidcash';
import type { ContractRunner, DeployContractOptions, DeployedContract } from 'solidcash';
import IUnicrowArbitratorArtifact from '../../../artifacts/solidcash/IUnicrowArbitrator.artifact.js';
export type JobState = 0n | 1n | 2n;
export type RecoverError = 0n | 1n | 2n | 3n;
export type JobEventType = 0n | 1n | 2n | 3n | 4n | 5n | 6n | 7n | 8n | 9n | 10n | 11n | 12n | 13n | 14n | 15n | 16n | 17n | 18n;
export type IUnicrowArbitrator = StatefulContract<typeof IUnicrowArbitratorArtifact>;
export type IUnicrowArbitratorConstructorArgs = [];
export declare class IUnicrowArbitrator__factory extends ContractFactory<typeof IUnicrowArbitratorArtifact> {
    static readonly abi: any;
    static readonly artifact: any;
    static createInterface(): {
        readonly abi: any;
        readonly events: any;
        readonly errors: any;
    };
    static connect(categoryId: string, runner: ContractRunner): Promise<IUnicrowArbitrator>;
    constructor(runner: ContractRunner);
}
export interface IUnicrowArbitrator__factory {
    deploy(...args: [...IUnicrowArbitratorConstructorArgs, DeployContractOptions?]): Promise<DeployedContract<typeof IUnicrowArbitratorArtifact>>;
}
import UnicrowDisputeArtifact from '../../../artifacts/solidcash/UnicrowDispute.artifact.js';
export type CounterStruct = {
    _value: bigint;
};
export type CounterStructOutput = [_value: bigint] & {
    _value: bigint;
};
export type EscrowStruct = {
    buyer: Uint8Array | string;
    challengeExtension: bigint;
    seller: Uint8Array | string;
    challengePeriodStart: bigint;
    marketplace: Uint8Array | string;
    marketplaceFee: bigint;
    challengePeriodEnd: bigint;
    currency: Uint8Array | string;
    claimed: bigint;
    consensus: readonly bigint[];
    split: readonly bigint[];
    amount: bigint;
    paymentReference: string;
};
export type EscrowStructOutput = [buyer: Uint8Array | string, challengeExtension: bigint, seller: Uint8Array | string, challengePeriodStart: bigint, marketplace: Uint8Array | string, marketplaceFee: bigint, challengePeriodEnd: bigint, currency: Uint8Array | string, claimed: bigint, consensus: readonly bigint[], split: readonly bigint[], amount: bigint, paymentReference: string] & {
    buyer: Uint8Array | string;
    challengeExtension: bigint;
    seller: Uint8Array | string;
    challengePeriodStart: bigint;
    marketplace: Uint8Array | string;
    marketplaceFee: bigint;
    challengePeriodEnd: bigint;
    currency: Uint8Array | string;
    claimed: bigint;
    consensus: readonly bigint[];
    split: readonly bigint[];
    amount: bigint;
    paymentReference: string;
};
export type EscrowInputStruct = {
    buyer: Uint8Array | string;
    seller: Uint8Array | string;
    marketplace: Uint8Array | string;
    marketplaceFee: bigint;
    currency: Uint8Array | string;
    challengePeriod: bigint;
    challengeExtension: bigint;
    amount: bigint;
    paymentReference: string;
};
export type EscrowInputStructOutput = [buyer: Uint8Array | string, seller: Uint8Array | string, marketplace: Uint8Array | string, marketplaceFee: bigint, currency: Uint8Array | string, challengePeriod: bigint, challengeExtension: bigint, amount: bigint, paymentReference: string] & {
    buyer: Uint8Array | string;
    seller: Uint8Array | string;
    marketplace: Uint8Array | string;
    marketplaceFee: bigint;
    currency: Uint8Array | string;
    challengePeriod: bigint;
    challengeExtension: bigint;
    amount: bigint;
    paymentReference: string;
};
export type ArbitratorStruct = {
    arbitrator: Uint8Array | string;
    arbitratorFee: bigint;
    sellerConsensus: boolean;
    buyerConsensus: boolean;
    arbitrated: boolean;
};
export type ArbitratorStructOutput = [arbitrator: Uint8Array | string, arbitratorFee: bigint, sellerConsensus: boolean, buyerConsensus: boolean, arbitrated: boolean] & {
    arbitrator: Uint8Array | string;
    arbitratorFee: bigint;
    sellerConsensus: boolean;
    buyerConsensus: boolean;
    arbitrated: boolean;
};
export type SettlementStruct = {
    latestSettlementOfferBy: Uint8Array | string;
    latestSettlementOffer: readonly bigint[];
};
export type SettlementStructOutput = [latestSettlementOfferBy: Uint8Array | string, latestSettlementOffer: readonly bigint[]] & {
    latestSettlementOfferBy: Uint8Array | string;
    latestSettlementOffer: readonly bigint[];
};
export type TokenStruct = {
    address_: Uint8Array | string;
    decimals: bigint;
    symbol: string;
};
export type TokenStructOutput = [address_: Uint8Array | string, decimals: bigint, symbol: string] & {
    address_: Uint8Array | string;
    decimals: bigint;
    symbol: string;
};
export type DataStruct = {
    escrow: EscrowStruct;
    arbitrator: ArbitratorStruct;
    settlement: SettlementStruct;
    token: TokenStruct;
};
export type DataStructOutput = [escrow: EscrowStructOutput, arbitrator: ArbitratorStructOutput, settlement: SettlementStructOutput, token: TokenStructOutput] & {
    escrow: EscrowStruct;
    arbitrator: ArbitratorStruct;
    settlement: SettlementStruct;
    token: TokenStruct;
};
export type UnicrowDispute = StatefulContract<typeof UnicrowDisputeArtifact>;
export type UnicrowDisputeConstructorArgs = [];
export declare class UnicrowDispute__factory extends ContractFactory<typeof UnicrowDisputeArtifact> {
    static readonly abi: any;
    static readonly artifact: any;
    static createInterface(): {
        readonly abi: any;
        readonly events: any;
        readonly errors: any;
    };
    static connect(categoryId: string, runner: ContractRunner): Promise<UnicrowDispute>;
    constructor(runner: ContractRunner);
}
export interface UnicrowDispute__factory {
    deploy(...args: [...UnicrowDisputeConstructorArgs, DeployContractOptions?]): Promise<DeployedContract<typeof UnicrowDisputeArtifact>>;
}
