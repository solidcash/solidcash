import { ContractFactory, StatefulContract } from 'solidcash';
import type { ContractRunner, DeployContractOptions, DeployedContract } from 'solidcash';
import IERC20MetadataArtifact from '../../../../../../../../artifacts/solidcash/IERC20Metadata.artifact.js';
export type RecoverError = 0n | 1n | 2n | 3n;
export type Rounding = 0n | 1n | 2n | 3n;
export type IERC20Metadata = StatefulContract<typeof IERC20MetadataArtifact>;
export type IERC20MetadataConstructorArgs = [];
export declare class IERC20Metadata__factory extends ContractFactory<typeof IERC20MetadataArtifact> {
    static readonly abi: any;
    static readonly artifact: any;
    static createInterface(): {
        readonly abi: any;
        readonly events: any;
        readonly errors: any;
    };
    static connect(categoryId: string, runner: ContractRunner): Promise<IERC20Metadata>;
    constructor(runner: ContractRunner);
}
export interface IERC20Metadata__factory {
    deploy(...args: [...IERC20MetadataConstructorArgs, DeployContractOptions?]): Promise<DeployedContract<typeof IERC20MetadataArtifact>>;
}
