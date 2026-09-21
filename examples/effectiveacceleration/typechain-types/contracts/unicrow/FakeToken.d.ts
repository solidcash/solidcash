import { ContractFactory, StatefulContract } from 'solidcash';
import type { ContractRunner, DeployContractOptions, DeployedContract } from 'solidcash';
import FakeTokenArtifact from '../../../artifacts/solidcash/FakeToken.artifact.js';
export type FakeToken = StatefulContract<typeof FakeTokenArtifact>;
export type FakeTokenConstructorArgs = [];
export declare class FakeToken__factory extends ContractFactory<typeof FakeTokenArtifact> {
    static readonly abi: any;
    static readonly artifact: any;
    static createInterface(): {
        readonly abi: any;
        readonly events: any;
        readonly errors: any;
    };
    static connect(categoryId: string, runner: ContractRunner): Promise<FakeToken>;
    constructor(runner: ContractRunner);
}
export interface FakeToken__factory {
    deploy(...args: [...FakeTokenConstructorArgs, DeployContractOptions?]): Promise<DeployedContract<typeof FakeTokenArtifact>>;
}
