import { ContractFactory, StatefulContract } from 'solidcash';
import type { ContractRunner, DeployContractOptions, DeployedContract } from 'solidcash';
import IUnicrowArtifact from '../../../../artifacts/solidcash/IUnicrow.artifact.js';
export type JobState = 0n | 1n | 2n;
export type RecoverError = 0n | 1n | 2n | 3n;
export type JobEventType = 0n | 1n | 2n | 3n | 4n | 5n | 6n | 7n | 8n | 9n | 10n | 11n | 12n | 13n | 14n | 15n | 16n | 17n | 18n;
export type IUnicrow = StatefulContract<typeof IUnicrowArtifact>;
export type IUnicrowConstructorArgs = [];
export declare class IUnicrow__factory extends ContractFactory<typeof IUnicrowArtifact> {
    static readonly abi: any;
    static readonly artifact: any;
    static createInterface(): {
        readonly abi: any;
        readonly events: any;
        readonly errors: any;
    };
    static connect(categoryId: string, runner: ContractRunner): Promise<IUnicrow>;
    constructor(runner: ContractRunner);
}
export interface IUnicrow__factory {
    deploy(...args: [...IUnicrowConstructorArgs, DeployContractOptions?]): Promise<DeployedContract<typeof IUnicrowArtifact>>;
}
