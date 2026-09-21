/**
 * Task system for the SolidCash harness (HARDHAT-PARITY.md WS2), mirroring Hardhat v2 ergonomics:
 * `task(name, desc?).addParam(...).addFlag(...).setAction(async (args, hre) => ...)`. A process-global registry
 * holds definitions (built-ins + user tasks declared in solidcash.config.ts). `subtask` is an alias. Actions
 * receive `(args, hre)`; the hre is passed in by the runner, keeping a v3 connection-seam layerable later.
 */
import type { HardhatRuntimeEnvironment } from './hre.js';
export type TaskArguments = Record<string, unknown>;
export type ActionFn = (args: TaskArguments, hre: HardhatRuntimeEnvironment, runSuper?: () => Promise<unknown>) => Promise<unknown> | unknown;
interface ParamDef {
    name: string;
    description?: string;
    defaultValue?: unknown;
    isFlag: boolean;
    isOptional: boolean;
    isPositional: boolean;
    isVariadic: boolean;
}
export interface TaskDefinition {
    name: string;
    description?: string;
    params: ParamDef[];
    action?: ActionFn;
    isSubtask: boolean;
}
/** Chainable builder returned by `task()` / `subtask()`. */
export declare class TaskBuilder {
    private def;
    constructor(def: TaskDefinition);
    setDescription(description: string): this;
    addParam(name: string, description?: string, defaultValue?: unknown): this;
    addOptionalParam(name: string, description?: string, defaultValue?: unknown): this;
    addFlag(name: string, description?: string): this;
    addPositionalParam(name: string, description?: string, defaultValue?: unknown): this;
    addVariadicPositionalParam(name: string, description?: string): this;
    setAction(action: ActionFn): this;
}
/** Declare (or override) a top-level task. */
export declare function task(name: string, descriptionOrAction?: string | ActionFn, action?: ActionFn): TaskBuilder;
/** Declare (or override) a subtask (Hardhat v2 `subtask`). */
export declare function subtask(name: string, descriptionOrAction?: string | ActionFn, action?: ActionFn): TaskBuilder;
export declare function getTask(name: string): TaskDefinition | undefined;
export declare function getTasks(): TaskDefinition[];
/** Run a registered task's action with `args`, injecting `hre`. */
export declare function runTask(name: string, args: TaskArguments, hre: HardhatRuntimeEnvironment): Promise<unknown>;
/** Coerce raw CLI tokens into a task's argument object using its param definitions. */
export declare function parseTaskArgs(def: TaskDefinition, tokens: string[]): TaskArguments;
/** Reset the registry (test isolation). */
export declare function clearTasks(): void;
export {};
