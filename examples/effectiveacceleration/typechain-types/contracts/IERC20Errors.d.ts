import { ContractFactory, StatefulContract } from 'solidcash';
import type { ContractRunner, DeployContractOptions, DeployedContract } from 'solidcash';
import IERC20ErrorsArtifact from '../../artifacts/solidcash/IERC20Errors.artifact.js';
export type RecoverError = 0n | 1n | 2n | 3n;
export type Rounding = 0n | 1n | 2n | 3n;
export type IERC20Errors = StatefulContract<typeof IERC20ErrorsArtifact>;
export type IERC20ErrorsConstructorArgs = [];
export declare class IERC20Errors__factory extends ContractFactory<typeof IERC20ErrorsArtifact> {
    static readonly abi: any;
    static readonly artifact: any;
    static createInterface(): {
        readonly abi: any;
        readonly events: any;
        readonly errors: any;
    };
    static connect(categoryId: string, runner: ContractRunner): Promise<IERC20Errors>;
    constructor(runner: ContractRunner);
}
export interface IERC20Errors__factory {
    deploy(...args: [...IERC20ErrorsConstructorArgs, DeployContractOptions?]): Promise<DeployedContract<typeof IERC20ErrorsArtifact>>;
}
