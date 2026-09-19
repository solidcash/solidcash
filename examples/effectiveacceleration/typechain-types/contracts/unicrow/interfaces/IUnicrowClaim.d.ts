import { ContractFactory, StatefulContract } from 'solidcash';
import type { ContractRunner, DeployContractOptions, DeployedContract } from 'solidcash';
import IUnicrowClaimArtifact from '../../../../artifacts/solidcash/IUnicrowClaim.artifact.js';
export type IUnicrowClaim = StatefulContract<typeof IUnicrowClaimArtifact>;
export type IUnicrowClaimConstructorArgs = [];
export declare class IUnicrowClaim__factory extends ContractFactory<typeof IUnicrowClaimArtifact> {
    static readonly abi: any;
    static readonly artifact: any;
    static createInterface(): {
        readonly abi: any;
        readonly events: any;
        readonly errors: any;
    };
    static connect(categoryId: string, runner: ContractRunner): Promise<IUnicrowClaim>;
    constructor(runner: ContractRunner);
}
export interface IUnicrowClaim__factory {
    deploy(...args: [...IUnicrowClaimConstructorArgs, DeployContractOptions?]): Promise<DeployedContract<typeof IUnicrowClaimArtifact>>;
}
