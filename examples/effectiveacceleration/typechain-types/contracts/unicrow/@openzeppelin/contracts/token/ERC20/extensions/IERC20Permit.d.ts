import { ContractFactory, StatefulContract } from 'solidcash';
import type { ContractRunner, DeployContractOptions, DeployedContract } from 'solidcash';
import IERC20PermitArtifact from '../../../../../../../../artifacts/solidcash/IERC20Permit.artifact.js';
export type JobState = 0n | 1n | 2n;
export type RecoverError = 0n | 1n | 2n | 3n;
export type JobEventType = 0n | 1n | 2n | 3n | 4n | 5n | 6n | 7n | 8n | 9n | 10n | 11n | 12n | 13n | 14n | 15n | 16n | 17n | 18n;
export type IERC20Permit = StatefulContract<typeof IERC20PermitArtifact>;
export type IERC20PermitConstructorArgs = [];
export declare class IERC20Permit__factory extends ContractFactory<typeof IERC20PermitArtifact> {
    static readonly abi: any;
    static readonly artifact: any;
    static createInterface(): {
        readonly abi: any;
        readonly events: any;
        readonly errors: any;
    };
    static connect(categoryId: string, runner: ContractRunner): Promise<IERC20Permit>;
    constructor(runner: ContractRunner);
}
export interface IERC20Permit__factory {
    deploy(...args: [...IERC20PermitConstructorArgs, DeployContractOptions?]): Promise<DeployedContract<typeof IERC20PermitArtifact>>;
}
