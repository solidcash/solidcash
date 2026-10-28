/**
 * Task system for the SolidCash harness (HARDHAT-PARITY.md WS2), mirroring Hardhat v2 ergonomics:
 * `task(name, desc?).addParam(...).addFlag(...).setAction(async (args, hre) => ...)`. A process-global registry
 * holds definitions (built-ins + user tasks declared in solidcash.config.ts). `subtask` is an alias. Actions
 * receive `(args, hre)`; the hre is passed in by the runner, keeping a v3 connection-seam layerable later.
 */
import type { HardhatRuntimeEnvironment } from './hre.js';

export type TaskArguments = Record<string, unknown>;
export type ActionFn = (args: TaskArguments, hre: HardhatRuntimeEnvironment, runSuper?: () => Promise<unknown>)
=> Promise<unknown> | unknown;

interface ParamDef {
  name: string;
  description?: string;
  defaultValue?: unknown;
  isFlag: boolean;
  isOptional: boolean;
  isPositional: boolean;
  isVariadic: boolean;
  isArray?: boolean;
}

export interface TaskDefinition {
  name: string;
  description?: string;
  params: ParamDef[];
  action?: ActionFn;
  isSubtask: boolean;
}

const registry = new Map<string, TaskDefinition>();

/** Chainable builder returned by `task()` / `subtask()`. */
export class TaskBuilder {
  constructor(private def: TaskDefinition) {}

  setDescription(description: string): this {
    this.def.description = description;
    return this;
  }

  addParam(name: string, description?: string, defaultValue?: unknown): this {
    this.def.params.push({
      name, description, defaultValue, isFlag: false,
      isOptional: defaultValue !== undefined, isPositional: false, isVariadic: false,
    });
    return this;
  }

  addOptionalParam(name: string, description?: string, defaultValue?: unknown): this {
    this.def.params.push({
      name, description, defaultValue, isFlag: false, isOptional: true, isPositional: false, isVariadic: false,
    });
    return this;
  }

  /** A repeatable option; repeated flags and `--name=a,b` both append. */
  addArrayParam(name: string, description?: string): this {
    this.def.params.push({
      name, description, defaultValue: [] as string[], isFlag: false,
      isOptional: true, isPositional: false, isVariadic: false, isArray: true,
    });
    return this;
  }

  addFlag(name: string, description?: string): this {
    this.def.params.push({
      name, description, defaultValue: false, isFlag: true, isOptional: true, isPositional: false, isVariadic: false,
    });
    return this;
  }

  addPositionalParam(name: string, description?: string, defaultValue?: unknown): this {
    this.def.params.push({
      name, description, defaultValue, isFlag: false,
      isOptional: defaultValue !== undefined, isPositional: true, isVariadic: false,
    });
    return this;
  }

  addVariadicPositionalParam(name: string, description?: string): this {
    this.def.params.push({
      name, description, defaultValue: [], isFlag: false, isOptional: true, isPositional: true, isVariadic: true,
    });
    return this;
  }

  setAction(action: ActionFn): this {
    this.def.action = action;
    return this;
  }
}

function define(name: string, descriptionOrAction?: string | ActionFn, maybeAction?: ActionFn, isSubtask = false)
  : TaskBuilder {
  const description = typeof descriptionOrAction === 'string' ? descriptionOrAction : undefined;
  const action = typeof descriptionOrAction === 'function' ? descriptionOrAction : maybeAction;
  const existing = registry.get(name);
  const def: TaskDefinition = existing ?? { name, params: [], isSubtask };
  def.description = description ?? def.description;
  if (action) def.action = action;
  registry.set(name, def);
  return new TaskBuilder(def);
}

/** Declare (or override) a top-level task. */
export function task(name: string, descriptionOrAction?: string | ActionFn, action?: ActionFn): TaskBuilder {
  return define(name, descriptionOrAction, action, false);
}

/** Declare (or override) a subtask (Hardhat v2 `subtask`). */
export function subtask(name: string, descriptionOrAction?: string | ActionFn, action?: ActionFn): TaskBuilder {
  return define(name, descriptionOrAction, action, true);
}

export function getTask(name: string): TaskDefinition | undefined {
  return registry.get(name);
}

export function getTasks(): TaskDefinition[] {
  return [...registry.values()];
}

/** Run a registered task's action with `args`, injecting `hre`. */
export async function runTask(name: string, args: TaskArguments, hre: HardhatRuntimeEnvironment): Promise<unknown> {
  const def = registry.get(name);
  if (!def) throw new Error(`Task "${name}" not found. Available: ${[...registry.keys()].join(', ')}`);
  if (!def.action) throw new Error(`Task "${name}" has no action.`);
  const merged: TaskArguments = {};
  for (const p of def.params) if (p.defaultValue !== undefined) merged[p.name] = p.defaultValue;
  Object.assign(merged, args);
  return def.action(merged, hre);
}

/**
 * Coerce raw CLI tokens into a task's argument object using its param definitions.
 *
 * Rejects unknown options and missing values (a typo must not become a silent argument nobody reads), accepts
 * `--name=value`, and appends for repeatable (`addArrayParam`) options instead of keeping only the last value.
 */
export function parseTaskArgs(def: TaskDefinition, tokens: string[]): TaskArguments {
  const args: TaskArguments = {};
  const positionals = def.params.filter((p) => p.isPositional);
  const byName = new Map(def.params.map((p) => [p.name, p]));
  const posQueue = [...positionals];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok === undefined) continue;
    if (tok.startsWith('--')) {
      const body = tok.slice(2);
      const equals = body.indexOf('=');
      const name = equals === -1 ? body : body.slice(0, equals);
      const inlineValue = equals === -1 ? undefined : body.slice(equals + 1);
      const p = byName.get(name);
      if (!p) {
        throw new Error(
          `Unknown option --${name}. Accepted options: ${def.params.map((param) => `--${param.name}`).join(', ') || '(none)'}`,
        );
      }
      if (p.isFlag) {
        args[name] = inlineValue === undefined ? true : inlineValue !== 'false';
        continue;
      }
      const value = inlineValue === undefined ? tokens[++i] : inlineValue;
      if (value === undefined) throw new Error(`Option --${name} requires a value.`);
      if (p.isArray) {
        const list = (args[name] ??= [] as string[]);
        (list as string[]).push(...value.split(',').filter((entry) => entry.length > 0));
      } else {
        args[name] = value;
      }
    } else {
      const p = posQueue[0];
      if (!p) continue;
      if (p.isVariadic) {
        (args[p.name] ??= [] as string[]);
        (args[p.name] as string[]).push(tok);
      } else {
        args[p.name] = tok;
        posQueue.shift();
      }
    }
  }
  return args;
}

/** Reset the registry (test isolation). */
export function clearTasks(): void {
  registry.clear();
}
