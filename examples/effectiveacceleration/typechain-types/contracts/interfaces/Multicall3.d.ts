import { ContractFactory, StatefulContract } from 'solidcash';
import type { ContractRunner, DeployContractOptions, DeployedContract } from 'solidcash';
import IMulticall3Artifact from '../../../artifacts/solidcash/IMulticall3.artifact.js';
export type IMulticall3 = StatefulContract<typeof IMulticall3Artifact>;
export type IMulticall3ConstructorArgs = [];
export declare class IMulticall3__factory extends ContractFactory<typeof IMulticall3Artifact> {
    static readonly abi: any;
    static readonly artifact: any;
    static createInterface(): {
        readonly abi: any;
        readonly events: any;
        readonly errors: any;
    };
    static connect(categoryId: string, runner: ContractRunner): Promise<IMulticall3>;
    constructor(runner: ContractRunner);
}
export interface IMulticall3__factory {
    deploy(...args: [...IMulticall3ConstructorArgs, DeployContractOptions?]): Promise<DeployedContract<typeof IMulticall3Artifact>>;
}
