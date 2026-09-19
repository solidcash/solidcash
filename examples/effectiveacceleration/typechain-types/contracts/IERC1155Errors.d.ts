import { ContractFactory, StatefulContract } from 'solidcash';
import type { ContractRunner, DeployContractOptions, DeployedContract } from 'solidcash';
import IERC1155ErrorsArtifact from '../../artifacts/solidcash/IERC1155Errors.artifact.js';
export type RecoverError = 0n | 1n | 2n | 3n;
export type Rounding = 0n | 1n | 2n | 3n;
export type IERC1155Errors = StatefulContract<typeof IERC1155ErrorsArtifact>;
export type IERC1155ErrorsConstructorArgs = [];
export declare class IERC1155Errors__factory extends ContractFactory<typeof IERC1155ErrorsArtifact> {
    static readonly abi: any;
    static readonly artifact: any;
    static createInterface(): {
        readonly abi: any;
        readonly events: any;
        readonly errors: any;
    };
    static connect(categoryId: string, runner: ContractRunner): Promise<IERC1155Errors>;
    constructor(runner: ContractRunner);
}
export interface IERC1155Errors__factory {
    deploy(...args: [...IERC1155ErrorsConstructorArgs, DeployContractOptions?]): Promise<DeployedContract<typeof IERC1155ErrorsArtifact>>;
}
