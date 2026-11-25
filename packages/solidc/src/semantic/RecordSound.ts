import { ContractNode, FunctionDefinitionNode, FunctionModifier } from '../ast/AST.js';

/**
 * A7 (B6.4): which contracts are compiled as record-sound. The semantic pass decides from this which entries take the
 * genesis call, and code generation decides from it which code carries the record-sound flag, so the two agree.
 */

/** A compiler-synthesized compiler-route route. */
export function isRouteMetaRouteFunction(fn: FunctionDefinitionNode): boolean {
  return fn.routeMetaRoute === true
    || (fn.name.startsWith('__compiler_route') && fn.parameters?.some((parameter) => parameter.name === 'batchBlob') === true);
}

/**
 * A compile that builds the compiler-route route: `routeMeta` is set, with the kernel or without, as an explicit request
 * sets it and as automatic selection sets it for a contract with an external call until its direct fallback. No master
 * it emits is record-sound (A7). A constructor calls only a direct master, whose spend the SDK lays out through the arm
 * it calls (A14 item 5), and a route binds a callee's result its own way (B6.2). That holds also where the route admits
 * no handler and the master keeps no route arm, so whether a contract can answer a constructor does not turn on what
 * its route admits.
 */
export function isRouteMetaCompile(options: { readonly routeMeta?: boolean }): boolean {
  return options.routeMeta === true;
}

/**
 * A master that gets its code tail and whose records are carriers of its own category: one with state, collections or
 * a block read, or one stateful through its effects that also emits events.
 */
export function isRecordMaster(contract: ContractNode, forceStateful: boolean): boolean {
  const tailed = contract.stateVariables.length > 0 || contract.collections.length > 0 || contract.readsBlockhash
    || contract.deploysStatefulChild || contract.deploysWithValue || forceStateful
    || contract.functions.some((fn) => fn.modifiers.includes(FunctionModifier.SELFDESTRUCT));
  const carriers = contract.stateVariables.length > 0 || contract.collections.length > 0
    || contract.eventDefinitions.length > 0 || contract.readsBlockhash || contract.emitsEvent || forceStateful;
  return tailed && carriers;
}

/** Modifiers whose void entry settles its own covenant and pins no call record. */
const SETTLES_OWN_COVENANT = new Set<FunctionModifier>([
  FunctionModifier.UPGRADE, FunctionModifier.DEPLOY, FunctionModifier.SELFDESTRUCT, FunctionModifier.SPLIT,
  FunctionModifier.MERGE, FunctionModifier.MIGRATE_RECORDS, FunctionModifier.UNSAFE,
]);

/**
 * An entry that publishes its call record at `__internal__returnOutputIdx`: a returning entry, or a void one that
 * settles its void record (or a frame's). Such an entry of a record-sound master takes the genesis call (O6).
 */
export function publishesCallRecord(fn: FunctionDefinitionNode): boolean {
  if (fn.isEntryPoint !== true || !fn.parameters.some((parameter) => parameter.name === '__internal__returnOutputIdx')) {
    return false;
  }
  return fn.returnTypes.length > 0 || !fn.modifiers.some((modifier) => SETTLES_OWN_COVENANT.has(modifier));
}

/** An entry that publishes and counts its own records: no `unsafe`, `split`, `merge`, `delegate` or delegatecall. */
export function isOrdinaryRecordArm(
  fn: FunctionDefinitionNode, makesDelegatecall: (fn: FunctionDefinitionNode) => boolean,
): boolean {
  return fn.isEntryPoint === true && !fn.graphEmissionHandler && !isRouteMetaRouteFunction(fn)
    && !makesDelegatecall(fn)
    && !fn.modifiers.some((modifier) => modifier === FunctionModifier.UNSAFE
      || modifier === FunctionModifier.SPLIT || modifier === FunctionModifier.MERGE
      || modifier === FunctionModifier.DELEGATE);
}

/**
 * Every arm of the master but `__construct` is an ordinary entry, `receive` or the multi-call entry, and no other
 * function makes a delegatecall or carries `delegate`.
 */
export function hasRecordSoundArms(
  contract: ContractNode, makesDelegatecall: (fn: FunctionDefinitionNode) => boolean,
): boolean {
  if (contract.fallbackDef !== undefined) return false;
  if (contract.receiveDef !== undefined && makesDelegatecall(contract.receiveDef)) return false;
  return contract.functions.every((fn) => fn.nativeSelfBatchDispatcher === true
    || (fn.isEntryPoint === true ? isOrdinaryRecordArm(fn, makesDelegatecall)
      : !makesDelegatecall(fn) && !fn.modifiers.includes(FunctionModifier.DELEGATE)));
}
