import { ContractFactory, StatefulContract } from 'solidcash';
import type { ContractRunner, DeployContractOptions, DeployedContract } from 'solidcash';
import EACCTokenArtifact from '../../artifacts/solidcash/EACCToken.artifact.js';
export type AddressSlotStruct = {
    value: Uint8Array | string;
};
export type AddressSlotStructOutput = [value: Uint8Array | string] & {
    value: Uint8Array | string;
};
export type BooleanSlotStruct = {
    value: boolean;
};
export type BooleanSlotStructOutput = [value: boolean] & {
    value: boolean;
};
export type Bytes32SlotStruct = {
    value: Uint8Array | string;
};
export type Bytes32SlotStructOutput = [value: Uint8Array | string] & {
    value: Uint8Array | string;
};
export type Uint256SlotStruct = {
    value: bigint;
};
export type Uint256SlotStructOutput = [value: bigint] & {
    value: bigint;
};
export type StringSlotStruct = {
    value: string;
};
export type StringSlotStructOutput = [value: string] & {
    value: string;
};
export type BytesSlotStruct = {
    value: Uint8Array | string;
};
export type BytesSlotStructOutput = [value: Uint8Array | string] & {
    value: Uint8Array | string;
};
export type RecoverError = 0n | 1n | 2n | 3n;
export type Rounding = 0n | 1n | 2n | 3n;
export type EACCToken = StatefulContract<typeof EACCTokenArtifact>;
export type EACCTokenConstructorArgs = [];
export declare class EACCToken__factory extends ContractFactory<typeof EACCTokenArtifact> {
    static readonly abi: any;
    static readonly artifact: any;
    static createInterface(): {
        readonly abi: any;
        readonly events: any;
        readonly errors: any;
    };
    static connect(categoryId: string, runner: ContractRunner): Promise<EACCToken>;
    constructor(runner: ContractRunner);
}
export interface EACCToken__factory {
    deploy(...args: [...EACCTokenConstructorArgs, DeployContractOptions?]): Promise<DeployedContract<typeof EACCTokenArtifact>>;
}
