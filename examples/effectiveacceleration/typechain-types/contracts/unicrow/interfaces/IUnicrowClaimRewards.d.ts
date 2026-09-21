import { ContractFactory, StatefulContract } from 'solidcash';
import type { ContractRunner, DeployContractOptions, DeployedContract } from 'solidcash';
import IUnicrowClaimRewardsArtifact from '../../../../artifacts/solidcash/IUnicrowClaimRewards.artifact.js';
export type IUnicrowClaimRewards = StatefulContract<typeof IUnicrowClaimRewardsArtifact>;
export type IUnicrowClaimRewardsConstructorArgs = [];
export declare class IUnicrowClaimRewards__factory extends ContractFactory<typeof IUnicrowClaimRewardsArtifact> {
    static readonly abi: any;
    static readonly artifact: any;
    static createInterface(): {
        readonly abi: any;
        readonly events: any;
        readonly errors: any;
    };
    static connect(categoryId: string, runner: ContractRunner): Promise<IUnicrowClaimRewards>;
    constructor(runner: ContractRunner);
}
export interface IUnicrowClaimRewards__factory {
    deploy(...args: [...IUnicrowClaimRewardsConstructorArgs, DeployContractOptions?]): Promise<DeployedContract<typeof IUnicrowClaimRewardsArtifact>>;
}
