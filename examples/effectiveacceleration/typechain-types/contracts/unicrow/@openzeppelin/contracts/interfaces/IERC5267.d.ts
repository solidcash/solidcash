import { ContractFactory, StatefulContract } from 'solidcash';
import type { ContractRunner, DeployContractOptions, DeployedContract } from 'solidcash';
import IERC5267Artifact from '../../../../../../artifacts/solidcash/IERC5267.artifact.js';
export type RecoverError = 0n | 1n | 2n | 3n;
export type Rounding = 0n | 1n | 2n | 3n;
export type IERC5267 = StatefulContract<typeof IERC5267Artifact>;
export type IERC5267ConstructorArgs = [];
export declare class IERC5267__factory extends ContractFactory<typeof IERC5267Artifact> {
    static readonly abi: any;
    static readonly artifact: any;
    static createInterface(): {
        readonly abi: any;
        readonly events: any;
        readonly errors: any;
    };
    static connect(categoryId: string, runner: ContractRunner): Promise<IERC5267>;
    constructor(runner: ContractRunner);
}
export interface IERC5267__factory {
    deploy(...args: [...IERC5267ConstructorArgs, DeployContractOptions?]): Promise<DeployedContract<typeof IERC5267Artifact>>;
}
