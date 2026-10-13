/**
 * Per-entry framed split (`split: 'func'`).
 *
 * Size split stays on its own packer. This path compiles one framed master per ABI entry, salts the redeem
 * script with that entry's selector, and does not emit a delegate facet or a kernel route wrapper.
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  AddressType,
  FrameKind,
  hash256,
  asmToBytecode,
  functionSplitLoaderLock,
  functionSplitLoaderScript,
  publishedRedeemLock,
  type AbiFunction,
  type Artifact,
  type CompilerOptions,
  type FunctionSplitBundle,
  type FunctionSplitFrameKind,
  type FunctionSplitInternalCut,
  type FunctionSplitLoader,
  type FunctionSplitShard,
  type InternalHelperLockSlot,
} from '@solidcash/utils';
import { walkInvocationAst } from '../analysis/InvocationAnalysis.js';
import { MAX_INPUT_BYTESIZE } from '../constants.js';
import {
  CastNode,
  ContractNode,
  FunctionCallNode,
  FunctionCallStatementNode,
  FunctionDefinitionNode,
  FunctionModifier,
  HexLiteralNode,
  IdentifierNode,
  InterfaceFunctionNode,
  InterfaceNode,
  MethodCallNode,
  MethodCallStatementNode,
  Node,
  NullaryOpNode,
  ParameterNode,
  UnaryOpNode,
  type Ast,
} from '../ast/AST.js';
import { NullaryOperator, UnaryOperator } from '../ast/Operator.js';
import { SolidcDiagnosticError } from '../Errors.js';

const KIND_NAME: Record<number, FunctionSplitFrameKind> = {
  [FrameKind.ROOT]: 'ROOT',
  [FrameKind.CALL]: 'CALL',
  [FrameKind.STATIC]: 'STATIC',
  [FrameKind.DELEGATE]: 'DELEGATE',
  [FrameKind.INTERNAL]: 'INTERNAL',
};

const HISTORICAL_KINDS = [FrameKind.ROOT, FrameKind.CALL, FrameKind.STATIC, FrameKind.DELEGATE];
const INTERNAL_CUT_INTERFACE = '__FunctionSplitInternal';

interface HelperCutProfile {
  name: string;
  returns: boolean;
  readsLocalState: boolean;
  writesState: boolean;
  externalCalls: boolean;
  unknown: boolean;
}

/** Services the per-entry compile needs from the compiler pipeline, so this module does not import it. */
export interface FunctionSplitHost {
  prepare(code: string, options: CompilerOptions): Ast;
  compileMonolith(code: string, options: CompilerOptions): Artifact;
  compileParsed(code: string, options: CompilerOptions, ast: Ast, frameKinds: readonly number[]): Artifact;
  cloneAst(ast: Ast, reason: string): Ast;
  byteSize(artifact: Artifact): number;
  spendReserve(artifact: Artifact, budgetWholeSpend: boolean): number;
  fingerprint(artifact: Artifact): string;
  assertLayouts(
    name: string,
    root: Artifact,
    shards: ReadonlyArray<{ name: string; artifact: Artifact }>,
    baseline: Artifact,
  ): void;
  selectorHex(fn: FunctionDefinitionNode, evmCompat: boolean): string;
  helperCuts(entry: FunctionDefinitionNode): readonly unknown[];
  cloneLogical(artifact: Artifact): Artifact;
}

export interface FunctionSplitRequest {
  code: string;
  options: CompilerOptions & {
    composition?: string;
    evmCompat?: boolean;
    maxShardBytes?: number;
  };
  host: FunctionSplitHost;
}

/** Compile `split: 'func'`. Throws before preparing a shard when the convention is not framed. */
export function compileFunctionSplit(request: FunctionSplitRequest): FunctionSplitBundle {
  const seen = request.options.composition ?? 'direct';
  if (seen !== 'framed') {
    throw new SolidcDiagnosticError(
      'SPLIT_FUNC_REQUIRES_FRAMED',
      `split 'func' requires composition 'framed'; saw '${seen}'`,
      { split: 'func', composition: seen },
    );
  }

  const { host, code } = request;
  const evmCompat = request.options.evmCompat === true;
  const maxShardBytes = request.options.maxShardBytes ?? MAX_INPUT_BYTESIZE;
  const budgetWholeSpend = request.options.maxShardBytes === undefined;
  const artifactOptions: CompilerOptions = { ...request.options, composition: 'framed' };
  const monolith = host.compileMonolith(code, artifactOptions);
  const probe = host.prepare(code, artifactOptions);
  const contract = probe.contract;
  const byName = indexFunctions(contract);
  const entries = listEntries(contract);
  if (entries.length === 0) {
    throw new Error(`split 'func' on '${contract.name}' has no ABI entry to shard`);
  }

  const shards: FunctionSplitShard[] = [];
  const internalCuts: FunctionSplitInternalCut[] = [];
  for (const entry of entries) {
    const selector = host.selectorHex(entry, evmCompat);
    const frameKinds = admittedKinds(entry);
    const compiled = compileEntryWithinCap(
      request, probe, byName, entry, selector, frameKinds, maxShardBytes, budgetWholeSpend,
    );
    shards.push(compiled.shard);
    internalCuts.push(...compiled.cuts);
  }

  host.assertLayouts(
    contract.name,
    monolith,
    [
      ...shards.map((shard) => ({ name: shard.function, artifact: shard.artifact })),
      ...internalCuts.map((cut) => ({ name: cut.name, artifact: cut.artifact })),
    ],
    monolith,
  );
  const logical = host.cloneLogical(monolith);
  stripKernelRoute(logical);
  const loaders = shards.map((shard) => loaderFor(shard));
  return {
    format: 'solidcash-split-v2',
    algorithm: 'per-entry-v1',
    composition: 'framed',
    logicalContractName: contract.name,
    abi: monolith.abi,
    stateLayoutFingerprint: host.fingerprint(monolith),
    logical,
    shards,
    internalCuts,
    loaders,
    messageBus: { available: false },
  };
}

function loaderFor(shard: FunctionSplitShard): FunctionSplitLoader {
  const codeHash = hash256(asmToBytecode(shard.artifact.bytecode));
  const selector = hexToBin(shard.selector);
  const script = functionSplitLoaderScript(codeHash, selector);
  return {
    selector: shard.selector,
    codeHash: binToHex(codeHash),
    script: binToHex(script),
    lock: binToHex(functionSplitLoaderLock(script)),
  };
}

/**
 * Public entries admit the historical four frame kinds plus `INTERNAL`. External entries keep the historical
 * four, so an `INTERNAL` frame falls through to the head's refusal.
 */
function admittedKinds(fn: FunctionDefinitionNode): number[] {
  // External, fallback, and receive keep the historical four. A public entry (the omitted specifier included)
  // also admits INTERNAL, so a same-contract message call can land on this master.
  if (fn.isFallback || fn.isReceive || fn.visibility === 'external') return [...HISTORICAL_KINDS];
  return [...HISTORICAL_KINDS, FrameKind.INTERNAL];
}

const LIFECYCLE_MODIFIERS = [
  FunctionModifier.SPLIT, FunctionModifier.MERGE, FunctionModifier.UPGRADE,
  FunctionModifier.DEPLOY, FunctionModifier.SELFDESTRUCT,
];

function listEntries(contract: ContractNode): FunctionDefinitionNode[] {
  // Lifecycle arms are the master's own split/merge/upgrade path, not a dispatched entry. A shard of only
  // that arm has nothing for the head to select.
  const entries = contract.functions.filter((fn) => fn.isEntryPoint && !fn.isAbstract && fn.name !== '__construct'
    && !fn.modifiers.some((modifier) => LIFECYCLE_MODIFIERS.includes(modifier)));
  if (contract.fallbackDef && !entries.includes(contract.fallbackDef)) entries.push(contract.fallbackDef);
  if (contract.receiveDef && !entries.includes(contract.receiveDef)) entries.push(contract.receiveDef);
  return entries;
}

function indexFunctions(contract: ContractNode): Map<string, FunctionDefinitionNode[]> {
  const byName = new Map<string, FunctionDefinitionNode[]>();
  const add = (fn: FunctionDefinitionNode | undefined): void => {
    if (!fn) return;
    const list = byName.get(fn.name) ?? [];
    list.push(fn);
    byName.set(fn.name, list);
  };
  for (const fn of contract.functions) add(fn);
  add(contract.fallbackDef);
  add(contract.receiveDef);
  return byName;
}

function measuredSpend(host: FunctionSplitHost, artifact: Artifact, budgetWholeSpend: boolean): number {
  return host.byteSize(artifact) + host.spendReserve(artifact, budgetWholeSpend);
}

function isLegalCut(profile: HelperCutProfile): boolean {
  return !profile.returns && !profile.readsLocalState && !profile.writesState
    && !profile.externalCalls && !profile.unknown;
}

function asProfiles(cuts: readonly unknown[]): HelperCutProfile[] {
  return cuts.filter((cut): cut is HelperCutProfile => {
    if (cut === null || typeof cut !== 'object') return false;
    const profile = cut as Partial<HelperCutProfile>;
    return typeof profile.name === 'string'
      && typeof profile.returns === 'boolean'
      && typeof profile.readsLocalState === 'boolean'
      && typeof profile.writesState === 'boolean'
      && typeof profile.externalCalls === 'boolean'
      && typeof profile.unknown === 'boolean';
  });
}

function profileKey(fn: FunctionDefinitionNode): string {
  return `${fn.name}(${fn.parameters.map((parameter) => parameter.type.toString()).join(',')})`;
}

/** Helpers whose profile is a legal cut and that this entry actually copies. */
function legalCutFunctions(
  entry: FunctionDefinitionNode,
  byName: Map<string, FunctionDefinitionNode[]>,
  profiles: readonly HelperCutProfile[],
): FunctionDefinitionNode[] {
  const legal = new Set(profiles.filter(isLegalCut).map((profile) => profile.name));
  const closure = inlineClosureNames(entry, byName);
  const chosen: FunctionDefinitionNode[] = [];
  for (const name of closure) {
    if (name === entry.name) continue;
    for (const fn of byName.get(name) ?? []) {
      if (fn.isEntryPoint) continue;
      if (legal.has(profileKey(fn))) chosen.push(fn);
    }
  }
  return chosen;
}

function capacityError(
  contractName: string,
  entryName: string,
  closure: readonly string[],
  helperCuts: readonly unknown[],
  measured: number,
  limit: number,
): SolidcDiagnosticError {
  const helperNames = helperCuts
    .map((cut) => (cut as { name?: string }).name)
    .filter((name): name is string => typeof name === 'string' && name.length > 0);
  return new SolidcDiagnosticError(
    'SPLIT_CLOSURE_CAPACITY',
    `Cannot split '${contractName}': indivisible closure '${entryName}' is `
      + `${measured} bytes (limit ${limit}).`
      + (helperNames.length > 0 ? ` Helpers: ${helperNames.join(', ')}.` : ''),
    {
      contractName,
      facet: 'function',
      handlers: [entryName],
      callChain: [...closure],
      helperCuts,
      measured,
      limit,
    },
  );
}

function compileEntryWithinCap(
  request: FunctionSplitRequest,
  probe: Ast,
  byName: Map<string, FunctionDefinitionNode[]>,
  entry: FunctionDefinitionNode,
  selector: string,
  frameKinds: readonly number[],
  maxShardBytes: number,
  budgetWholeSpend: boolean,
): { shard: FunctionSplitShard; cuts: FunctionSplitInternalCut[] } {
  const { host } = request;
  const contractName = probe.contract.name;
  const full = compileEntryShard(request, probe, byName, entry, selector, frameKinds, new Set());
  const fullSpend = measuredSpend(host, full, budgetWholeSpend);
  const profiles = asProfiles(host.helperCuts(entry));
  const cuts = fullSpend > maxShardBytes ? legalCutFunctions(entry, byName, profiles) : [];
  if (fullSpend > maxShardBytes && cuts.length === 0) {
    throw capacityError(
      contractName, entry.name, [...inlineClosureNames(entry, byName)], profiles, fullSpend, maxShardBytes,
    );
  }
  const cutNames = new Set(cuts.map((fn) => fn.name));
  const sentinels = new Map<string, Uint8Array>();
  cuts.forEach((fn, index) => {
    sentinels.set(profileKey(fn), helperLockSentinel(index, profileKey(fn)));
  });
  const artifact = cuts.length > 0
    ? compileEntryShard(request, probe, byName, entry, selector, frameKinds, cutNames, false, sentinels)
    : full;
  const wholeSpendBytes = cuts.length > 0 ? measuredSpend(host, artifact, budgetWholeSpend) : fullSpend;
  if (wholeSpendBytes > maxShardBytes) {
    throw capacityError(
      contractName, entry.name, [...inlineClosureNames(entry, byName)], profiles, wholeSpendBytes, maxShardBytes,
    );
  }
  const internalCuts: FunctionSplitInternalCut[] = [];
  for (const helper of cuts) {
    const others = new Set(cutNames);
    others.delete(helper.name);
    const helperArtifact = compileEntryShard(
      request, probe, byName, helper, host.selectorHex(helper, request.options.evmCompat === true),
      [FrameKind.INTERNAL], others, true, sentinels,
    );
    const helperSpend = measuredSpend(host, helperArtifact, budgetWholeSpend);
    if (helperSpend > maxShardBytes) {
      throw capacityError(contractName, helper.name, [helper.name], profiles, helperSpend, maxShardBytes);
    }
    helperArtifact.abi = helperArtifact.abi.filter((fn) => fn.name !== helper.name);
    stripKernelRoute(helperArtifact);
    internalCuts.push({
      name: profileKey(helper),
      artifact: helperArtifact,
      lock: publishedRedeemLock(helperArtifact.bytecode),
      wholeSpendBytes: helperSpend,
      callerSelectors: [selector],
    });
  }
  stripKernelRoute(artifact);
  return {
    shard: {
      selector,
      function: entry.name,
      acceptedFrameKinds: frameKinds.map((kind) => KIND_NAME[kind]!),
      artifact,
      lock: publishedRedeemLock(artifact.bytecode),
      wholeSpendBytes,
    },
    cuts: internalCuts,
  };
}

function compileEntryShard(
  request: FunctionSplitRequest,
  probe: Ast,
  byName: Map<string, FunctionDefinitionNode[]>,
  entry: FunctionDefinitionNode,
  entrySelector: string,
  frameKinds: readonly number[],
  cutNames: ReadonlySet<string>,
  promoteEntry = false,
  sentinels: ReadonlyMap<string, Uint8Array> = new Map(),
): Artifact {
  const { host, code } = request;
  const evmCompat = request.options.evmCompat === true;
  const inlineNames = inlineClosureNames(entry, byName);
  for (const name of cutNames) inlineNames.delete(name);
  const selfCallTargets = selfCallEntries(entry, byName, inlineNames, entrySelector, evmCompat, host);
  const cutTargets = [...cutNames].flatMap((name) => (byName.get(name) ?? [])
    .filter((fn) => !fn.isEntryPoint));
  const prepared = probe.contract;
  const completeFunctions = prepared.functions;
  const completeConstructor = prepared.constructorDef;
  const completeFallback = prepared.fallbackDef;
  const completeReceive = prepared.receiveDef;
  let ast: Ast;
  try {
    prepared.functions = completeFunctions.filter((fn) => keepFunction(fn, entry, inlineNames, byName));
    prepared.constructorDef = undefined;
    prepared.fallbackDef = entry.isFallback ? entry : undefined;
    prepared.receiveDef = entry.isReceive ? entry : undefined;
    ast = host.cloneAst(probe, `func:${entry.name}:${entrySelector}`);
  } finally {
    prepared.functions = completeFunctions;
    prepared.constructorDef = completeConstructor;
    prepared.fallbackDef = completeFallback;
    prepared.receiveDef = completeReceive;
  }

  const contract = ast.contract;
  contract.flattenedPublicStructGetters = [];
  contract.suppressSynthesizedGetters = true;
  contract.implements = [];
  contract.parentInvocations = [];
  for (const fn of contract.functions) {
    fn.overrideBases = [];
    fn.modifiers = fn.modifiers.filter((modifier) => modifier !== FunctionModifier.OVERRIDE);
  }
  for (const fn of contract.functions) {
    const selector = host.selectorHex(fn, evmCompat);
    const isShardEntry = selector === entrySelector && fn.isFallback === entry.isFallback
      && fn.isReceive === entry.isReceive && fn.name === entry.name;
    // A lifecycle arm is extracted beside the head. It is not a dispatched entry, and demoting it would
    // drop the modifier the arm is recognized by.
    if (isShardEntry || !fn.isEntryPoint || isLifecycleFunction(fn)) continue;
    fn.modifiers = fn.modifiers.filter((modifier) => modifier !== FunctionModifier.EXTERNAL
      && modifier !== FunctionModifier.PUBLIC && modifier !== FunctionModifier.DELEGATE);
    fn.modifiers.push(FunctionModifier.INTERNAL);
  }
  if (promoteEntry) {
    const body = contract.functions.find((fn) => fn.name === entry.name);
    if (body !== undefined) {
      body.modifiers = body.modifiers.filter((modifier) => modifier !== FunctionModifier.INTERNAL
        && modifier !== FunctionModifier.PRIVATE);
      if (!body.modifiers.includes(FunctionModifier.PUBLIC)) body.modifiers.push(FunctionModifier.PUBLIC);
    }
  }
  if (selfCallTargets.length > 0) {
    publishCallInterface(ast, SELF_CALL_INTERFACE, selfCallTargets);
    rewriteSelfCalls(contract, selfCallTargets, evmCompat, host);
  }
  if (cutTargets.length > 0) {
    publishCallInterface(ast, INTERNAL_CUT_INTERFACE, cutTargets);
    rewriteBareCalls(contract, cutTargets, sentinels);
  }
  const artifactOptions: CompilerOptions = {
    ...request.options,
    composition: 'framed',
    __functionSplitPrepared: true,
    __functionSplitFrameKinds: frameKinds,
  } as CompilerOptions;
  const artifact = host.compileParsed(code, artifactOptions, ast, frameKinds);
  if (cutTargets.length > 0) {
    recordInternalHelperLocks(artifact, sentinels, new Set(cutTargets.map((fn) => profileKey(fn))));
  }
  return artifact;
}

const HELPER_LOCK_BYTES = 35;

/**
 * A 35-byte address that is not the zero address slot.
 *
 * Deployment fills the real helper lock over this push. A second 35-byte run of zeros would be a second
 * address slot, so the sentinel is non-zero and unique per helper.
 */
function helperLockSentinel(index: number, name: string): Uint8Array {
  const bytes = new Uint8Array(HELPER_LOCK_BYTES);
  bytes[0] = 0xa1;
  bytes[1] = (index + 1) & 0xff;
  const nameBytes = new TextEncoder().encode(name);
  for (let at = 2; at < HELPER_LOCK_BYTES; at += 1) {
    const mixed = nameBytes.length === 0 ? 0x11 : nameBytes[(at - 2) % nameBytes.length]!;
    const byte = (0x11 ^ mixed) & 0xff;
    bytes[at] = byte === 0 ? 0x11 : byte;
  }
  return bytes;
}

/** Offsets of a direct push of `payload`. The offset is the opcode byte. */
function findDirectPushes(program: Uint8Array, payload: Uint8Array): number[] {
  const opcode = payload.length;
  if (opcode < 1 || opcode > 0x4b) return [];
  const offsets: number[] = [];
  for (let index = 0; index + 1 + payload.length <= program.length; index += 1) {
    if (program[index] !== opcode) continue;
    let same = true;
    for (let at = 0; at < payload.length; at += 1) {
      if (program[index + 1 + at] !== payload[at]) {
        same = false;
        break;
      }
    }
    if (same) offsets.push(index);
  }
  return offsets;
}

/** Records every sentinel push this shard's cuts require. A missing push is a compile failure. */
function recordInternalHelperLocks(
  artifact: Artifact,
  sentinels: ReadonlyMap<string, Uint8Array>,
  required: ReadonlySet<string>,
): void {
  if (required.size === 0) return;
  const program = asmToBytecode(artifact.bytecode);
  const slots: InternalHelperLockSlot[] = [];
  for (const name of required) {
    const sentinel = sentinels.get(name);
    if (sentinel === undefined) {
      throw new Error(`function split has no helper-lock sentinel for '${name}'`);
    }
    const offsets = findDirectPushes(program, sentinel);
    if (offsets.length === 0) {
      throw new Error(
        `function split did not publish the helper lock for '${name}' as a ${sentinel.length}-byte push`,
      );
    }
    for (const offset of offsets) slots.push({ name, offset });
  }
  const composition = artifact.composition;
  if (composition === undefined) {
    throw new Error(`function split artifact '${artifact.contractName}' has no framed composition`);
  }
  composition.internalHelperLocks = slots;
}

function isLifecycleFunction(fn: FunctionDefinitionNode): boolean {
  return fn.modifiers.some((modifier) => LIFECYCLE_MODIFIERS.includes(modifier));
}

function keepFunction(
  fn: FunctionDefinitionNode,
  entry: FunctionDefinitionNode,
  inlineNames: ReadonlySet<string>,
  byName: Map<string, FunctionDefinitionNode[]>,
): boolean {
  // Every entry master can mint or burn its own pool. The arm is extracted beside the head, so it does not
  // become a second dispatched selector.
  if (isLifecycleFunction(fn)) return true;
  if (fn === entry) return !entry.isFallback && !entry.isReceive;
  if (!inlineNames.has(fn.name)) return false;
  if (!fn.isEntryPoint) return true;
  const entries = (byName.get(fn.name) ?? []).filter((candidate) => candidate.isEntryPoint);
  // A sibling overload is its own shard. Copying it would publish its selector beside this entry.
  return entries.length === 1;
}

/** Names reached by bare calls. `this.f()` is a message call and is not part of the copied body. */
function inlineClosureNames(
  root: FunctionDefinitionNode,
  byName: Map<string, FunctionDefinitionNode[]>,
): Set<string> {
  const closure = new Set<string>();
  const pending = [root.name];
  while (pending.length > 0) {
    const name = pending.pop()!;
    if (closure.has(name)) continue;
    closure.add(name);
    for (const candidate of byName.get(name) ?? []) {
      for (const called of inlineCallNames(candidate)) {
        if (byName.has(called)) pending.push(called);
      }
    }
  }
  return closure;
}

function inlineCallNames(fn: FunctionDefinitionNode): Set<string> {
  const calls = new Set<string>();
  if (!fn.body) return calls;
  walkInvocationAst(fn.body, (node) => {
    if (node instanceof FunctionCallNode && node.fromThisCall !== true && node.identifier) {
      calls.add(node.identifier.name);
    }
    if (node instanceof FunctionCallStatementNode && node.call.fromThisCall !== true && node.call.identifier) {
      calls.add(node.call.identifier.name);
    }
  });
  return calls;
}

function selfCallEntries(
  entry: FunctionDefinitionNode,
  byName: Map<string, FunctionDefinitionNode[]>,
  inlineNames: ReadonlySet<string>,
  entrySelector: string,
  evmCompat: boolean,
  host: FunctionSplitHost,
): FunctionDefinitionNode[] {
  const names = new Set<string>();
  const visit = (fn: FunctionDefinitionNode): void => {
    if (!fn.body) return;
    walkInvocationAst(fn.body, (node) => {
      const call = node instanceof FunctionCallNode ? node
        : node instanceof FunctionCallStatementNode ? node.call : undefined;
      if (call?.fromThisCall === true && call.identifier) names.add(call.identifier.name);
    });
  };
  visit(entry);
  for (const name of inlineNames) for (const fn of byName.get(name) ?? []) visit(fn);
  const targets: FunctionDefinitionNode[] = [];
  for (const name of names) {
    for (const candidate of byName.get(name) ?? []) {
      if (!candidate.isEntryPoint) continue;
      if (host.selectorHex(candidate, evmCompat) === entrySelector && candidate.name === entry.name) continue;
      targets.push(candidate);
    }
  }
  return targets;
}

const SELF_CALL_INTERFACE = '__FunctionSplit';

function publishCallInterface(ast: Ast, interfaceName: string, targets: readonly FunctionDefinitionNode[]): void {
  const functions = targets.map((fn) => {
    const parameters = fn.parameters
      .filter((parameter) => !parameter.name.startsWith('__internal__'))
      .map((parameter) => new ParameterNode(parameter.type, parameter.name));
    const mutability = fn.modifiers.includes(FunctionModifier.PURE) ? 'pure'
      : fn.modifiers.includes(FunctionModifier.VIEW) ? 'view'
        : fn.modifiers.includes(FunctionModifier.PAYABLE) ? 'payable' : 'nonpayable';
    const method = new InterfaceFunctionNode(fn.name, parameters, [...fn.returnTypes], mutability);
    method.location = fn.location;
    return method;
  });
  const iface = new InterfaceNode(interfaceName, [], [], functions);
  iface.location = ast.contract.location;
  ast.interfaceDefinitions.push(iface);
}

function rewriteSelfCalls(
  contract: ContractNode,
  targets: readonly FunctionDefinitionNode[],
  evmCompat: boolean,
  host: FunctionSplitHost,
): void {
  const bySelector = new Map(targets.map((fn) => [host.selectorHex(fn, evmCompat), fn]));
  const rewrite = (call: FunctionCallNode): MethodCallNode | undefined => {
    const matches = targets.filter((fn) => fn.name === call.identifier?.name
      && visibleArity(fn) === call.parameters.length);
    const target = matches[0] ?? targets.find((fn) => fn.name === call.identifier?.name);
    if (!target || !bySelector.has(host.selectorHex(target, evmCompat))) return undefined;
    const index = new NullaryOpNode(NullaryOperator.INPUT_INDEX);
    index.location = call.location;
    const self = new UnaryOpNode(UnaryOperator.INPUT_LOCKING_BYTECODE, index);
    self.isThisExpression = true;
    self.location = call.location;
    const ifaceId = new IdentifierNode(SELF_CALL_INTERFACE);
    ifaceId.location = call.location;
    const ifaceCall = new FunctionCallNode(ifaceId, [self]);
    ifaceCall.location = call.location;
    // `__FunctionSplit(address(this)).f(args)` is the shape the semantic pass already lowers to a message
    // call. A direct `this.f()` node would be inlined again.
    const method = new MethodCallNode(ifaceCall, target.name, call.parameters);
    method.location = call.location;
    return method;
  };
  for (const fn of contract.functions) replaceSelfCalls(fn, rewrite);
  if (contract.fallbackDef) replaceSelfCalls(contract.fallbackDef, rewrite);
  if (contract.receiveDef) replaceSelfCalls(contract.receiveDef, rewrite);
}

function rewriteBareCalls(
  contract: ContractNode,
  targets: readonly FunctionDefinitionNode[],
  sentinels: ReadonlyMap<string, Uint8Array>,
): void {
  const names = new Set(targets.map((fn) => fn.name));
  const rewrite = (call: FunctionCallNode): MethodCallNode | undefined => {
    if (call.identifier === undefined || !names.has(call.identifier.name)) return undefined;
    const matches = targets.filter((fn) => fn.name === call.identifier?.name
      && visibleArity(fn) === call.parameters.length);
    const target = matches[0] ?? targets.find((fn) => fn.name === call.identifier?.name);
    if (target === undefined) return undefined;
    const sentinel = sentinels.get(profileKey(target));
    if (sentinel === undefined) {
      throw new Error(`function split has no helper-lock sentinel for '${profileKey(target)}'`);
    }
    const literal = new HexLiteralNode(sentinel);
    literal.location = call.location;
    // A bytes-to-address cast. The symbol table unwraps it and publishes the bytes as the call target.
    const address = new CastNode(new AddressType(false), literal, false);
    address.location = call.location;
    const ifaceId = new IdentifierNode(INTERNAL_CUT_INTERFACE);
    ifaceId.location = call.location;
    const ifaceCall = new FunctionCallNode(ifaceId, [address]);
    ifaceCall.location = call.location;
    const method = new MethodCallNode(ifaceCall, target.name, call.parameters);
    method.location = call.location;
    return method;
  };
  for (const fn of contract.functions) replaceBareCalls(fn, rewrite);
  if (contract.fallbackDef) replaceBareCalls(contract.fallbackDef, rewrite);
  if (contract.receiveDef) replaceBareCalls(contract.receiveDef, rewrite);
}

function replaceBareCalls(
  root: Node,
  rewrite: (call: FunctionCallNode) => MethodCallNode | undefined,
): void {
  const seen = new Set<object>();
  const visit = (value: unknown, parent: object | undefined, key: string | number | undefined): void => {
    if (!value || typeof value !== 'object' || seen.has(value as object)) return;
    if (value instanceof FunctionCallStatementNode && value.call.fromThisCall !== true && parent && key !== undefined) {
      const method = rewrite(value.call);
      if (method) {
        const statement = new MethodCallStatementNode(method);
        statement.location = value.location;
        (parent as Record<string | number, unknown>)[key] = statement;
        seen.add(statement);
        return;
      }
    }
    if (value instanceof FunctionCallNode && value.fromThisCall !== true && parent && key !== undefined
      && !(parent instanceof FunctionCallStatementNode)) {
      const replacement = rewrite(value);
      if (replacement) {
        (parent as Record<string | number, unknown>)[key] = replacement;
        seen.add(replacement);
        return;
      }
    }
    seen.add(value as object);
    if (value instanceof Map || value instanceof Set || value instanceof Uint8Array) return;
    if (Array.isArray(value)) {
      value.forEach((child, index) => visit(child, value, index));
      return;
    }
    for (const [childKey, child] of Object.entries(value as Record<string, unknown>)) {
      if (childKey === 'location' || childKey === 'parent') continue;
      visit(child, value, childKey);
    }
  };
  visit(root, undefined, undefined);
}

function visibleArity(fn: FunctionDefinitionNode): number {
  return fn.parameters.filter((parameter) => !parameter.name.startsWith('__internal__')).length;
}

function replaceSelfCalls(
  root: Node,
  rewrite: (call: FunctionCallNode) => MethodCallNode | undefined,
): void {
  const seen = new Set<object>();
  const visit = (value: unknown, parent: object | undefined, key: string | number | undefined): void => {
    if (!value || typeof value !== 'object' || seen.has(value as object)) return;
    if (value instanceof FunctionCallStatementNode && value.call.fromThisCall === true && parent && key !== undefined) {
      const method = rewrite(value.call);
      if (method) {
        const statement = new MethodCallStatementNode(method);
        statement.location = value.location;
        (parent as Record<string | number, unknown>)[key] = statement;
        seen.add(statement);
        visit(method, statement, 'call');
        return;
      }
    }
    if (value instanceof FunctionCallNode && value.fromThisCall === true && parent && key !== undefined
      && !(parent instanceof FunctionCallStatementNode)) {
      const replacement = rewrite(value);
      if (replacement) {
        (parent as Record<string | number, unknown>)[key] = replacement;
        seen.add(replacement);
        visit(replacement, parent, key);
        return;
      }
    }
    seen.add(value as object);
    if (value instanceof Map || value instanceof Set || value instanceof Uint8Array) return;
    if (Array.isArray(value)) {
      value.forEach((child, index) => visit(child, value, index));
      return;
    }
    for (const [childKey, child] of Object.entries(value as Record<string, unknown>)) {
      if (childKey === 'location' || childKey === 'parent') continue;
      visit(child, value, childKey);
    }
  };
  visit(root, undefined, undefined);
}

function stripKernelRoute(artifact: Artifact): void {
  if (!artifact.messageBus) return;
  const messageBus = { ...artifact.messageBus, available: false as const };
  delete messageBus.kernelExecutionPlans;
  delete messageBus.routeInBytecode;
  artifact.messageBus = messageBus;
}

/** The logical ABI entries a bundle claims, used by callers that compare shard count to the ABI. */
export function functionSplitAbiEntries(abi: readonly AbiFunction[]): readonly AbiFunction[] {
  return abi.filter((fn) => (fn as { type?: string }).type !== 'constructor' && fn.name !== 'constructor');
}
