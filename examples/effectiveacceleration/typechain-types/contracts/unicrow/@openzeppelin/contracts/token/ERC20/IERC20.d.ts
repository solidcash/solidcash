import { ContractFactory, StatefulContract } from 'solidcash';
import type { ContractRunner, DeployContractOptions, DeployedContract } from 'solidcash';
import IERC20Artifact from '../../../../../../../artifacts/solidcash/IERC20.artifact.js';
export type JobState = 0n | 1n | 2n;
export type RecoverError = 0n | 1n | 2n | 3n;
export type JobEventType = 0n | 1n | 2n | 3n | 4n | 5n | 6n | 7n | 8n | 9n | 10n | 11n | 12n | 13n | 14n | 15n | 16n | 17n | 18n;
export type IERC20 = StatefulContract<typeof IERC20Artifact>;
export type IERC20ConstructorArgs = [];
export declare class IERC20__factory extends ContractFactory<typeof IERC20Artifact> {
    static readonly abi: any;
    static readonly artifact: any;
    static createInterface(): {
        readonly abi: any;
        readonly events: any;
        readonly errors: any;
    };
    static connect(categoryId: string, runner: ContractRunner): Promise<IERC20>;
    constructor(runner: ContractRunner);
}
export interface IERC20__factory {
    deploy(...args: [...IERC20ConstructorArgs, DeployContractOptions?]): Promise<DeployedContract<typeof IERC20Artifact>>;
}
