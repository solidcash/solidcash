import { ContractFactory, StatefulContract } from 'solidcash';
import type { ContractRunner, DeployContractOptions, DeployedContract } from 'solidcash';
import definitionsArtifact from '../../artifacts/solidcash/definitions.artifact.js';
export type definitions = StatefulContract<typeof definitionsArtifact>;
export type definitionsConstructorArgs = [];
export declare class definitions__factory extends ContractFactory<typeof definitionsArtifact> {
    static readonly abi: any;
    static readonly artifact: any;
    static createInterface(): {
        readonly abi: any;
        readonly events: any;
        readonly errors: any;
    };
    static connect(categoryId: string, runner: ContractRunner): Promise<definitions>;
    constructor(runner: ContractRunner);
}
export interface definitions__factory {
    deploy(...args: [...definitionsConstructorArgs, DeployContractOptions?]): Promise<DeployedContract<typeof definitionsArtifact>>;
}
