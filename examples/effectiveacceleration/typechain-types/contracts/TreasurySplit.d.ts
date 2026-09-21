import { ContractFactory, StatefulContract } from 'solidcash';
import type { ContractRunner, DeployContractOptions, DeployedContract } from 'solidcash';
import TreasurySplitArtifact from '../../artifacts/solidcash/TreasurySplit.artifact.js';
export type TreasurySplit = StatefulContract<typeof TreasurySplitArtifact>;
export type TreasurySplitConstructorArgs = [];
export declare class TreasurySplit__factory extends ContractFactory<typeof TreasurySplitArtifact> {
    static readonly abi: any;
    static readonly artifact: any;
    static createInterface(): {
        readonly abi: any;
        readonly events: any;
        readonly errors: any;
    };
    static connect(categoryId: string, runner: ContractRunner): Promise<TreasurySplit>;
    constructor(runner: ContractRunner);
}
export interface TreasurySplit__factory {
    deploy(...args: [...TreasurySplitConstructorArgs, DeployContractOptions?]): Promise<DeployedContract<typeof TreasurySplitArtifact>>;
}
