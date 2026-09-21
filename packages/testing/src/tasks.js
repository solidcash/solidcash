const registry = new Map();
/** Chainable builder returned by `task()` / `subtask()`. */
export class TaskBuilder {
    constructor(def) {
        this.def = def;
    }
    setDescription(description) {
        this.def.description = description;
        return this;
    }
    addParam(name, description, defaultValue) {
        this.def.params.push({
            name, description, defaultValue, isFlag: false,
            isOptional: defaultValue !== undefined, isPositional: false, isVariadic: false,
        });
        return this;
    }
    addOptionalParam(name, description, defaultValue) {
        this.def.params.push({
            name, description, defaultValue, isFlag: false, isOptional: true, isPositional: false, isVariadic: false,
        });
        return this;
    }
    addFlag(name, description) {
        this.def.params.push({
            name, description, defaultValue: false, isFlag: true, isOptional: true, isPositional: false, isVariadic: false,
        });
        return this;
    }
    addPositionalParam(name, description, defaultValue) {
        this.def.params.push({
            name, description, defaultValue, isFlag: false,
            isOptional: defaultValue !== undefined, isPositional: true, isVariadic: false,
        });
        return this;
    }
    addVariadicPositionalParam(name, description) {
        this.def.params.push({
            name, description, defaultValue: [], isFlag: false, isOptional: true, isPositional: true, isVariadic: true,
        });
        return this;
    }
    setAction(action) {
        this.def.action = action;
        return this;
    }
}
function define(name, descriptionOrAction, maybeAction, isSubtask = false) {
    const description = typeof descriptionOrAction === 'string' ? descriptionOrAction : undefined;
    const action = typeof descriptionOrAction === 'function' ? descriptionOrAction : maybeAction;
    const existing = registry.get(name);
    const def = existing ?? { name, params: [], isSubtask };
    def.description = description ?? def.description;
    if (action)
        def.action = action;
    registry.set(name, def);
    return new TaskBuilder(def);
}
/** Declare (or override) a top-level task. */
export function task(name, descriptionOrAction, action) {
    return define(name, descriptionOrAction, action, false);
}
/** Declare (or override) a subtask (Hardhat v2 `subtask`). */
export function subtask(name, descriptionOrAction, action) {
    return define(name, descriptionOrAction, action, true);
}
export function getTask(name) {
    return registry.get(name);
}
export function getTasks() {
    return [...registry.values()];
}
/** Run a registered task's action with `args`, injecting `hre`. */
export async function runTask(name, args, hre) {
    const def = registry.get(name);
    if (!def)
        throw new Error(`Task "${name}" not found. Available: ${[...registry.keys()].join(', ')}`);
    if (!def.action)
        throw new Error(`Task "${name}" has no action.`);
    const merged = {};
    for (const p of def.params)
        if (p.defaultValue !== undefined)
            merged[p.name] = p.defaultValue;
    Object.assign(merged, args);
    return def.action(merged, hre);
}
/** Coerce raw CLI tokens into a task's argument object using its param definitions. */
export function parseTaskArgs(def, tokens) {
    const args = {};
    const positionals = def.params.filter((p) => p.isPositional);
    const byName = new Map(def.params.map((p) => [p.name, p]));
    const posQueue = [...positionals];
    for (let i = 0; i < tokens.length; i++) {
        const tok = tokens[i];
        if (tok.startsWith('--')) {
            const name = tok.slice(2);
            const p = byName.get(name);
            if (p?.isFlag) {
                args[name] = true;
                continue;
            }
            args[name] = tokens[++i];
        }
        else {
            const p = posQueue[0];
            if (!p)
                continue;
            if (p.isVariadic) {
                (args[p.name] ??= []);
                args[p.name].push(tok);
            }
            else {
                args[p.name] = tok;
                posQueue.shift();
            }
        }
    }
    return args;
}
/** Reset the registry (test isolation). */
export function clearTasks() {
    registry.clear();
}
//# sourceMappingURL=tasks.js.map