import { ContractFactory, StatefulContract } from 'solidcash';
import type { ContractRunner, DeployContractOptions, DeployedContract } from 'solidcash';
import IUnicrowDisputeArtifact from '../../../../artifacts/solidcash/IUnicrowDispute.artifact.js';
export type JobState = 0n | 1n | 2n;
export type RecoverError = 0n | 1n | 2n | 3n;
export type JobEventType = 0n | 1n | 2n | 3n | 4n | 5n | 6n | 7n | 8n | 9n | 10n | 11n | 12n | 13n | 14n | 15n | 16n | 17n | 18n;
export type IUnicrowDispute = StatefulContract<typeof IUnicrowDisputeArtifact>;
export type IUnicrowDisputeConstructorArgs = [];
export declare class IUnicrowDispute__factory extends ContractFactory<typeof IUnicrowDisputeArtifact> {
    static readonly abi: any;
    static readonly artifact: any;
    static createInterface(): {
        readonly abi: any;
        readonly events: any;
        readonly errors: any;
    };
    static connect(categoryId: string, runner: ContractRunner): Promise<IUnicrowDispute>;
    constructor(runner: ContractRunner);
}
export interface IUnicrowDispute__factory {
    deploy(...args: [...IUnicrowDisputeConstructorArgs, DeployContractOptions?]): Promise<DeployedContract<typeof IUnicrowDisputeArtifact>>;
}
