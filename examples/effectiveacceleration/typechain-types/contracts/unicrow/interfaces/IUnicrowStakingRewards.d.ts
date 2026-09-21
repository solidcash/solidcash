import { ContractFactory, StatefulContract } from 'solidcash';
import type { ContractRunner, DeployContractOptions, DeployedContract } from 'solidcash';
import IUnicrowStakingRewardsArtifact from '../../../../artifacts/solidcash/IUnicrowStakingRewards.artifact.js';
export type IUnicrowStakingRewards = StatefulContract<typeof IUnicrowStakingRewardsArtifact>;
export type IUnicrowStakingRewardsConstructorArgs = [];
export declare class IUnicrowStakingRewards__factory extends ContractFactory<typeof IUnicrowStakingRewardsArtifact> {
    static readonly abi: any;
    static readonly artifact: any;
    static createInterface(): {
        readonly abi: any;
        readonly events: any;
        readonly errors: any;
    };
    static connect(categoryId: string, runner: ContractRunner): Promise<IUnicrowStakingRewards>;
    constructor(runner: ContractRunner);
}
export interface IUnicrowStakingRewards__factory {
    deploy(...args: [...IUnicrowStakingRewardsConstructorArgs, DeployContractOptions?]): Promise<DeployedContract<typeof IUnicrowStakingRewardsArtifact>>;
}
