import { ContractFactory, StatefulContract } from 'solidcash';
import type { ContractRunner, DeployContractOptions, DeployedContract } from 'solidcash';
import IERC721ErrorsArtifact from '../../artifacts/solidcash/IERC721Errors.artifact.js';
export type RecoverError = 0n | 1n | 2n | 3n;
export type Rounding = 0n | 1n | 2n | 3n;
export type IERC721Errors = StatefulContract<typeof IERC721ErrorsArtifact>;
export type IERC721ErrorsConstructorArgs = [];
export declare class IERC721Errors__factory extends ContractFactory<typeof IERC721ErrorsArtifact> {
    static readonly abi: any;
    static readonly artifact: any;
    static createInterface(): {
        readonly abi: any;
        readonly events: any;
        readonly errors: any;
    };
    static connect(categoryId: string, runner: ContractRunner): Promise<IERC721Errors>;
    constructor(runner: ContractRunner);
}
export interface IERC721Errors__factory {
    deploy(...args: [...IERC721ErrorsConstructorArgs, DeployContractOptions?]): Promise<DeployedContract<typeof IERC721ErrorsArtifact>>;
}
