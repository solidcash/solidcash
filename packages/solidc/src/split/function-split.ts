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
  StateVariableVisibility,
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
  sendsValue: boolean;
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
    framedWitnessReserve?: boolean;
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
    for (const cut of compiled.cuts) {
      // Two entries that cut the same helper share one program, so a deployment holds one pool of its masters and
      // either entry's frame enters it. A deployment fills each entry's helper lock by the helper's name, so two
      // entries whose cuts of one helper compile apart, each beside its own other cuts, are refused by name.
      const same = internalCuts.findIndex((other) => other.name === cut.name);
      if (same < 0) {
        internalCuts.push(cut);
        continue;
      }
      if (internalCuts[same]!.artifact.bytecode !== cut.artifact.bytecode) {
        throw new SolidcDiagnosticError(
          'SPLIT_HELPER_CUT_DIVERGES',
          `Cannot split '${contract.name}': entries ${internalCuts[same]!.callerSelectors.join(', ')} and `
            + `${cut.callerSelectors.join(', ')} cut helper '${cut.name}' into different programs.`,
          { contractName: contract.name, helper: cut.name },
        );
      }
      const shared = internalCuts[same]!;
      internalCuts[same] = { ...shared, callerSelectors: [...new Set([...shared.callerSelectors, ...cut.callerSelectors])] };
    }
  }

  // A public state variable's getter is synthesized late, so the probe holds no function for it. Each one the
  // logical ABI publishes gets a shard of its own, which serves that getter alone.
  const sharded = new Set(shards.map((shard) => shard.selector.toLowerCase()));
  const getterNames = publicGetterNames(contract);
  for (const abiEntry of monolith.abi) {
    const selector = abiEntry.selector?.toLowerCase();
    if (selector === undefined || sharded.has(selector) || !getterNames.has(abiEntry.name)
      || byName.has(abiEntry.name)) continue;
    shards.push(compileGetterShard(request, probe, abiEntry.name, selector, maxShardBytes, budgetWholeSpend));
    sharded.add(selector);
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

function measuredSpend(request: FunctionSplitRequest, artifact: Artifact, budgetWholeSpend: boolean): number {
  const witness = request.options.framedWitnessReserve === true ? framedWitnessEstimate(artifact) : 0;
  return request.host.byteSize(artifact) + request.host.spendReserve(artifact, budgetWholeSpend) + witness;
}

/** The fixed part of a witness block: magic, kind, three references, sender, self, value and the result's length. */
const WITNESS_HEADER_BYTES = 3 + 1 + 6 + (2 + 36) + (2 + 36) + 8 + 4;
/** A call record at a result as wide as a 256-bit word: kind, target, value, callee, argument digest, result. */
const CALL_RECORD_BYTES = 1 + (1 + 36) + 8 + 2 + 32 + (1 + 33);
/** A declaration's two indices and two view lengths, ahead of its views. */
const DECLARATION_BYTES = 8;
/** The view a sorted mapping's node carries: its slot, its successor's slot and its value. */
const NODE_VIEW_BYTES = 33 + 33 + 34;
/** The records a sorted mapping write declares in its segment: the predecessor it relinks and the node it creates. */
const NODE_WRITE_DECLARATIONS = 3;
/** The block oracle's record, which a frame that reads the chain's clock declares. */
const ORACLE_VIEW_BYTES = 128;

/** The widest push a state field of the published type takes, as the state packer sizes it. */
function stateFieldBytes(type: string): number {
  const integer = /^u?int(\d*)$/.exec(type);
  if (integer !== null) return Math.ceil((Number(integer[1] || 256) + 1) / 8) + 1;
  if (type === 'bool') return 1;
  if (type.startsWith('address')) return 36;
  const fixed = /^bytes(\d+)$/.exec(type);
  if (fixed !== null) return Number(fixed[1]) + 1;
  return Number.POSITIVE_INFINITY;
}

/**
 * The witness block a framed master of the shard's entry carries, at the widest view each of its records can hold.
 *
 * The block is a header, one call record per call site the entry publishes, and one segment more than calls, each
 * declaring the records the entry's block layout names: its data records, its mapping nodes and the block oracle. A
 * middle segment whose code the entry says touches no mapping declares only the data records its code reads or
 * writes there (`sparseBlock`). A write adds the written view to its segment, a mapping write the nodes it relinks
 * and creates, and every event a place in the event list. A call site in a loop is counted once, so the estimate
 * holds for an entry whose calls the source fixes.
 */
function framedWitnessEstimate(artifact: Artifact): number {
  const sites = artifact.composition?.stopSites?.entries ?? [];
  const entry = artifact.abi.find((fn) => fn.blockLayout !== undefined
    && sites.some((site) => site.functionName.endsWith(`.${fn.name}()`)));
  if (entry?.blockLayout === undefined) return 0;
  const site = sites.find((candidate) => candidate.functionName.endsWith(`.${entry.name}()`))!;
  const layout = artifact.stateLayout;
  const limit = layout?.commitmentLimit ?? 128;
  const recordView = (nftIndex: number): number => Math.min(limit, (layout?.variables ?? [])
    .filter((variable) => variable.nftIndex === nftIndex)
    .reduce((total, variable) => total + stateFieldBytes(variable.type), 2));
  const slots = entry.blockLayout.slots;
  const declared = slots.reduce((total, slot) => {
    if (slot.kind === 'dataNft' && slot.nftIndex !== undefined) return total + DECLARATION_BYTES + recordView(slot.nftIndex);
    if (slot.kind === 'entry') return total + DECLARATION_BYTES + NODE_VIEW_BYTES;
    if (slot.kind === 'blockInfoOracle') return total + DECLARATION_BYTES + ORACLE_VIEW_BYTES;
    return total;
  }, 0);
  const segments = site.calls.length + 1;
  // What each segment declares: everything, or in a middle segment that reaches no mapping, what its code touches.
  const segmentDeclared = (segment: number): number => {
    if (site.readSegments === undefined || site.writeSegments === undefined || segment === 0
      || segment === segments - 1) return declared;
    const touched = new Set<number>();
    for (const fact of [...site.readSegments, ...site.writeSegments]) {
      if (fact.segment !== segment) continue;
      if (fact.record === undefined || (fact as { turns?: unknown }).turns !== undefined) return declared;
      touched.add(fact.record);
    }
    return [...touched].reduce((total, record) => total + DECLARATION_BYTES + recordView(record), 0);
  };
  const writes = (site.writeSegments ?? []).reduce((total, write) => total + (write.record !== undefined
    ? recordView(write.record) : NODE_WRITE_DECLARATIONS * (DECLARATION_BYTES + NODE_VIEW_BYTES)), 0);
  const events = slots.filter((slot) => slot.kind === 'event' || slot.kind === 'returnEvent').length;
  const results = (entry.outputs ?? []).length * 33;
  let segmentBytes = 0;
  for (let segment = 0; segment < segments; segment += 1) segmentBytes += 4 + segmentDeclared(segment);
  return WITNESS_HEADER_BYTES + results + 2 + site.calls.length * CALL_RECORD_BYTES
    + 2 + segmentBytes + writes + 2 + 2 * events + 2 + 2;
}

/**
 * Whether a helper can run as an INTERNAL frame of its own. The frame runs in its caller's context: it keeps the
 * caller's sender, address and value, reads and writes the caller's records, which the validator chains through it,
 * makes its own calls and hands its result back as a call's. A helper whose footprint the analysis cannot read is not
 * one, nor is one that sends value, which a callee frame's plan does not carry yet.
 */
function isLegalCut(profile: HelperCutProfile): boolean {
  return !profile.unknown && !profile.sendsValue;
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
      && typeof profile.sendsValue === 'boolean'
      && typeof profile.unknown === 'boolean';
  });
}

function profileKey(fn: FunctionDefinitionNode): string {
  return `${fn.name}(${fn.parameters.map((parameter) => parameter.type.toString()).join(',')})`;
}

/**
 * Helpers whose profile is a legal cut and that this entry actually copies, heaviest first: a helper's weight is the
 * AST its body and the helpers it reaches hold, each counted once, which is what a cut moves out of the entry.
 */
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
  const weights = new Map(chosen.map((fn) => [fn, closureWeight(fn, byName)]));
  return chosen.sort((left, right) => weights.get(right)! - weights.get(left)!
    || profileKey(left).localeCompare(profileKey(right)));
}

/** How many AST nodes a helper's body holds, with the bodies of the helpers its bare calls reach, each once. */
function closureWeight(fn: FunctionDefinitionNode, byName: Map<string, FunctionDefinitionNode[]>): number {
  let weight = 0;
  const seen = new Set<object>();
  for (const name of inlineClosureNames(fn, byName)) {
    for (const candidate of byName.get(name) ?? []) {
      if (candidate !== fn && candidate.isEntryPoint) continue;
      // eslint-disable-next-line @typescript-eslint/no-loop-func
      walkInvocationAst(candidate.body, () => { weight += 1; }, seen);
    }
  }
  return weight;
}

function capacityError(
  contractName: string,
  entryName: string,
  closure: readonly string[],
  helperCuts: readonly unknown[],
  measured: number,
  limit: number,
  declinedCuts: readonly { name: string; reason: string }[] = [],
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
      ...(declinedCuts.length === 0 ? {} : { declinedCuts }),
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
  const fullSpend = measuredSpend(request, full, budgetWholeSpend);
  const profiles = asProfiles(host.helperCuts(entry));
  // An entry over the cap moves helpers into INTERNAL frames of their own, heaviest first, one at a time, until it
  // fits. A cut replaces the helper's code with a call site, so one that does not shrink the entry is not kept, and
  // neither is one whose call the framed convention cannot place the entry around (`refusedEntries`), as a call after
  // a mapping write the entry makes behind a conditional call moves that write off a segment the source fixes, nor
  // one the entry does not compile with. Why each was not kept is published with a capacity refusal.
  let cuts: FunctionDefinitionNode[] = [];
  let sentinels = new Map<string, Uint8Array>();
  let artifact = full;
  let wholeSpendBytes = fullSpend;
  const declined = new Map<string, string>();
  // A cut can change what the next one meets, as one that moves the entry's mapping write into the helper frees a
  // later call of the write's segment, so the candidates are tried again after each cut the entry keeps.
  let pending = fullSpend > maxShardBytes ? legalCutFunctions(entry, byName, profiles) : [];
  let progress = true;
  while (progress && wholeSpendBytes > maxShardBytes) {
    progress = false;
    for (const candidate of pending) {
      const trial = [...cuts, candidate];
      const trialSentinels = new Map(trial.map((fn, index) => [profileKey(fn), helperLockSentinel(index, profileKey(fn))]));
      let compiled: Artifact;
      try {
        compiled = compileEntryShard(
          request, probe, byName, entry, selector, frameKinds, new Set(trial.map((fn) => fn.name)), false,
          trialSentinels,
        );
      } catch (error) {
        declined.set(profileKey(candidate), (error as Error).message.split('\n')[0]!);
        continue;
      }
      if (refusesEntry(compiled)) {
        declined.set(profileKey(candidate), compiled.composition!.refusedEntries![0]!.reason);
        continue;
      }
      const spend = measuredSpend(request, compiled, budgetWholeSpend);
      if (spend >= wholeSpendBytes) {
        declined.set(profileKey(candidate), `the entry is ${spend} bytes with it cut`);
        continue;
      }
      cuts = trial;
      sentinels = trialSentinels;
      artifact = compiled;
      wholeSpendBytes = spend;
      declined.delete(profileKey(candidate));
      pending = pending.filter((other) => other !== candidate);
      progress = true;
      if (spend <= maxShardBytes) break;
    }
  }
  const declinedCuts = [...declined].map(([name, reason]) => ({ name, reason }));
  if (wholeSpendBytes > maxShardBytes) {
    throw capacityError(
      contractName, entry.name, [...inlineClosureNames(entry, byName)], profiles, wholeSpendBytes, maxShardBytes,
      declinedCuts,
    );
  }
  const cutNames = new Set(cuts.map((fn) => fn.name));
  const internalCuts: FunctionSplitInternalCut[] = [];
  for (const helper of cuts) {
    const others = new Set(cutNames);
    others.delete(helper.name);
    const helperArtifact = compileEntryShard(
      request, probe, byName, helper, host.selectorHex(helper, request.options.evmCompat === true),
      [FrameKind.INTERNAL], others, true, sentinels,
    );
    const helperSpend = measuredSpend(request, helperArtifact, budgetWholeSpend);
    if (helperSpend > maxShardBytes) {
      throw capacityError(contractName, helper.name, [helper.name], profiles, helperSpend, maxShardBytes);
    }
    const helperEntry = helperArtifact.abi.find((fn) => fn.name === helper.name);
    helperArtifact.abi = helperArtifact.abi.filter((fn) => fn.name !== helper.name);
    stripKernelRoute(helperArtifact);
    internalCuts.push({
      name: profileKey(helper),
      artifact: helperArtifact,
      lock: publishedRedeemLock(helperArtifact.bytecode),
      wholeSpendBytes: helperSpend,
      callerSelectors: [selector],
      ...(helperEntry === undefined ? {} : { entry: helperEntry }),
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

/** The names a public state variable, mapping, constant or flattened struct publishes a getter under. */
function publicGetterNames(contract: ContractNode): Set<string> {
  const isPublic = (visibility: StateVariableVisibility | undefined): boolean =>
    visibility === StateVariableVisibility.PUBLIC || visibility === StateVariableVisibility.EXTERNAL;
  return new Set([
    ...contract.stateVariables.filter((state) => isPublic(state.visibility)).map((state) => state.name),
    ...contract.collections.filter((collection) => isPublic(collection.visibility)).map((collection) => collection.name),
    ...contract.constantDefinitions.filter((constant) => isPublic(constant.visibility)).map((constant) => constant.name),
    ...contract.transientStateVars.filter((state) => isPublic(state.visibility)).map((state) => state.name),
    ...contract.flattenedPublicStructGetters.map((spec) => spec.name),
  ]);
}

/**
 * The shard that serves one synthesized getter.
 *
 * It holds no entry of the source: the getter pass synthesizes the one getter it is named for, and a getter is an
 * external view, so it admits the historical four frame kinds.
 */
function compileGetterShard(
  request: FunctionSplitRequest,
  probe: Ast,
  name: string,
  selector: string,
  maxShardBytes: number,
  budgetWholeSpend: boolean,
): FunctionSplitShard {
  const { host, code } = request;
  const prepared = probe.contract;
  const completeFunctions = prepared.functions;
  const completeConstructor = prepared.constructorDef;
  const completeFallback = prepared.fallbackDef;
  const completeReceive = prepared.receiveDef;
  let ast: Ast;
  try {
    prepared.functions = completeFunctions.filter((fn) => isLifecycleFunction(fn));
    prepared.constructorDef = undefined;
    prepared.fallbackDef = undefined;
    prepared.receiveDef = undefined;
    ast = host.cloneAst(probe, `func:getter:${name}:${selector}`);
  } finally {
    prepared.functions = completeFunctions;
    prepared.constructorDef = completeConstructor;
    prepared.fallbackDef = completeFallback;
    prepared.receiveDef = completeReceive;
  }
  const contract = ast.contract;
  contract.suppressSynthesizedGetters = true;
  contract.synthesizedGetterOnly = name;
  contract.implements = [];
  contract.parentInvocations = [];
  const frameKinds = [...HISTORICAL_KINDS];
  const artifactOptions: CompilerOptions = {
    ...request.options,
    composition: 'framed',
    __functionSplitPrepared: true,
    __functionSplitFrameKinds: frameKinds,
  } as CompilerOptions;
  const artifact = host.compileParsed(code, artifactOptions, ast, frameKinds);
  if (!artifact.abi.some((fn) => fn.selector?.toLowerCase() === selector)) {
    throw new Error(`split 'func' on '${prepared.name}' did not synthesize the getter '${name}'`);
  }
  const wholeSpendBytes = measuredSpend(request, artifact, budgetWholeSpend);
  if (wholeSpendBytes > maxShardBytes) {
    throw capacityError(prepared.name, name, [name], [], wholeSpendBytes, maxShardBytes);
  }
  stripKernelRoute(artifact);
  return {
    selector,
    function: name,
    acceptedFrameKinds: frameKinds.map((kind) => KIND_NAME[kind]!),
    artifact,
    lock: publishedRedeemLock(artifact.bytecode),
    wholeSpendBytes,
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
  // A cut helper's body runs in its own frame, so the shard copies what its code reaches short of the cuts, and calls
  // the cuts it reaches.
  const inlineNames = inlineClosureNames(entry, byName, cutNames);
  const reachedCuts = [...cutNames].filter((name) => inlineNames.has(name));
  for (const name of cutNames) inlineNames.delete(name);
  const selfCallTargets = selfCallEntries(entry, byName, inlineNames, entrySelector, evmCompat, host);
  const cutTargets = reachedCuts.flatMap((name) => (byName.get(name) ?? [])
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
  // A refused entry compiles to a program that runs none of its body, so it holds no call site to fill.
  if (cutTargets.length > 0 && !refusesEntry(artifact)) {
    recordInternalHelperLocks(artifact, sentinels, new Set(cutTargets.map((fn) => profileKey(fn))));
  }
  return artifact;
}

/** Whether the framed convention refused an entry of the artifact, which then runs none of its body. */
function refusesEntry(artifact: Artifact): boolean {
  return (artifact.composition?.refusedEntries?.length ?? 0) > 0;
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

/**
 * Names reached by bare calls. `this.f()` is a message call and is not part of the copied body. A name in `stops` is
 * reached but not entered: its body is not part of the closure.
 */
function inlineClosureNames(
  root: FunctionDefinitionNode,
  byName: Map<string, FunctionDefinitionNode[]>,
  stops: ReadonlySet<string> = new Set(),
): Set<string> {
  const closure = new Set<string>();
  const pending = [root.name];
  while (pending.length > 0) {
    const name = pending.pop()!;
    if (closure.has(name)) continue;
    closure.add(name);
    if (name !== root.name && stops.has(name)) continue;
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
