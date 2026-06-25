import {
  AbiFunction, Artifact, CompilerOptions, DebugInformation, Script, scriptToAsm, StateLayout, ArrayType,
  computeCollectionSignature, computeFunctionSelectorHex, ExternalInterfaceInfo, MappingType, Type, ValueType,
  ExternalLibraryAbi, BUILTIN_LIBRARIES, resolveLibraries, sidecarCodeRange,
} from '@solidcash/utils';
import { binToHex } from '@bitauth/libauth';
import { version } from '../index.js';
import {
  Ast, StateVariableVisibility, InterfaceNode, InterfaceCollectionNode, ExternalCallMode,
  StructDefinitionNode, FunctionDefinitionNode,
} from '../ast/AST.js';

/** Unwrap ValueType to its underlying type string for ABI serialization. */
function abiTypeString(type: Type): string {
  if (type instanceof ValueType) return type.underlyingType.toString();
  return type.toString();
}

/** Build the common metadata fields for an ABI function entry. */
function buildFunctionAbiMetadata(func: FunctionDefinitionNode): Partial<AbiFunction> {
  return {
    ...(func.requiredNftIndices !== undefined
      && { requiredNftIndices: func.requiredNftIndices }),
    ...(func.entryAccesses && func.entryAccesses.length > 0 && {
      entryAccesses: func.entryAccesses.map((ea) => ({
        collection: ea.collection,
        keyParams: ea.keyParams,
        ...(ea.keySources && ea.keySources.some((ks) => ks.kind !== 'param') && {
          keySources: ea.keySources.map((ks) => ({
            kind: ks.kind,
            ...(ks.paramName && { paramName: ks.paramName }),
            ...(ks.stateVarName && { stateVarName: ks.stateVarName }),
            ...(ks.kind === 'expression' && { expressionLabel: ks.canonical }),
          })),
        }),
        operations: ea.operations,
      })),
    }),
    ...(func.emitInfos && func.emitInfos.length > 0 && {
      emits: func.emitInfos.map((ei) => ({
        eventName: ei.eventName,
        eventSignature: ei.eventSignature,
        emitIndex: ei.emitIndex,
      })),
    }),
    ...(func.transferInfos && func.transferInfos.length > 0 && {
      transferCount: func.transferInfos.length,
    }),
    ...(func.deployTargets && func.deployTargets.length > 0 && {
      deployTargets: func.deployTargets.map((dt) => ({
        contractName: dt.contractName,
        dataNftCount: dt.dataNftCount,
      })),
    }),
    ...(func.externalReads && func.externalReads.length > 0 && {
      externalReads: func.externalReads.map((er) => ({
        interfaceName: er.interfaceName,
        kind: er.kind,
        ...(er.nftIndex !== undefined && { nftIndex: er.nftIndex }),
        ...(er.collectionName && { collectionName: er.collectionName }),
        ...(er.collectionSignature && { collectionSignature: er.collectionSignature }),
        ...(er.addressParam && { addressParam: er.addressParam }),
      })),
    }),
    ...(func.externalCalls && func.externalCalls.length > 0 && {
      externalCalls: func.externalCalls.map((ec) => ({
        interfaceName: ec.interfaceName,
        functionName: ec.functionName,
        ...(ec.addressParam && { addressParam: ec.addressParam }),
        ...(ec.addressStateVar && { addressStateVar: ec.addressStateVar }),
        requiredDataNftIndices: ec.requiredDataNftIndices,
        ...(ec.hasReturnValues && { hasReturnValues: true }),
        ...(ec.returnTypes && ec.returnTypes.length > 0 && {
          returnTypes: ec.returnTypes.map((t) => t.toString()),
        }),
        ...(ec.returnEventSignature && { returnEventSignature: ec.returnEventSignature }),
        ...(ec.computedOffset !== undefined && ec.computedOffset > 0 && { computedOffset: ec.computedOffset }),
        ...(ec.callMode && ec.callMode !== ExternalCallMode.REGULAR && { callMode: ec.callMode }),
        ...(ec.rawCall && { rawCall: true }),
        ...(ec.argSources && ec.argSources.length > 0 && { argSources: ec.argSources }),
      })),
    }),
    ...(func.externalOutStateReads && func.externalOutStateReads.length > 0 && {
      externalOutStateReads: func.externalOutStateReads.map((os) => ({
        interfaceName: os.interfaceName,
        ...(os.addressParam && { addressParam: os.addressParam }),
        requiredDataNftIndices: os.requiredDataNftIndices,
      })),
    }),
    ...(func.tokenContainerAccesses && func.tokenContainerAccesses.length > 0 && {
      tokenContainerAccesses: func.tokenContainerAccesses.map((da) => ({
        keyParam: da.keyParam,
        operations: da.operations,
        ...(da.transferCount > 1 && { transferCount: da.transferCount }),
        ...(da.transferNftCount > 1 && { transferNftCount: da.transferNftCount }),
      })),
    }),
    ...(func.usesMsgSender && { usesMsgSender: true }),
    ...(func.usedLibraries && func.usedLibraries.length > 0 && { externalLibraries: func.usedLibraries }),
    ...(func.unsafeTier !== undefined && { unsafeTier: func.unsafeTier }),
    ...(func.lowLevelCalls && func.lowLevelCalls.length > 0 && {
      lowLevelCalls: func.lowLevelCalls.map((lc) => ({ callMode: lc.callMode })),
    }),
    ...(func.collectionIterations && func.collectionIterations.length > 0 && {
      collectionIterations: func.collectionIterations.map((ci) => ({
        collection: ci.collection,
        mode: ci.mode,
        iterationIndex: ci.iterationIndex,
      })),
    }),
    ...(func.dynamicReads && func.dynamicReads.length > 0 && { dynamicReads: [...func.dynamicReads] }),
    ...(func.dynamicWrites && func.dynamicWrites.length > 0 && { dynamicWrites: [...func.dynamicWrites] }),
    ...(func.blockLayout && { blockLayout: func.blockLayout }),
  };
}

/** Extract optional key/value name annotations from a MappingType for the artifact. */
function mappingNameFields(type: Type): Record<string, unknown> {
  if (!(type instanceof MappingType)) return {};
  const result: Record<string, unknown> = {};
  if (type.keyName) result.keyName = type.keyName;
  // Get the innermost value name and count depth
  let depth = 1;
  let inner: MappingType = type;
  while (inner.valueType instanceof MappingType) {
    inner = inner.valueType;
    depth++;
  }
  if (inner.valueName) result.valueName = inner.valueName;
  // For nested mappings, collect all key names if any are present
  if (depth > 1) {
    const keyNames: (string | undefined)[] = [];
    let cur: MappingType = type;
    keyNames.push(cur.keyName);
    while (cur.valueType instanceof MappingType) {
      cur = cur.valueType;
      keyNames.push(cur.keyName);
    }
    if (keyNames.some((n) => n !== undefined)) {
      result.keyNames = keyNames;
    }
  }
  return result;
}

export function generateArtifact(
  ast: Ast,
  script: Script,
  source: string,
  debug: DebugInformation,
  compilerOptions: CompilerOptions,
  functionBodies?: Record<string, string>,
  fingerprint?: string,
): Artifact {
  const { contract } = ast;

  const constructorInputs = contract.parameters
    .map((parameter) => ({ name: parameter.name, type: abiTypeString(parameter.type) }));

  // Exclude internal/private functions from the ABI (they're implementation details)
  const abiFunctions = contract.functions.filter((func) => {
    const v = func.visibility;
    return v !== 'internal' && v !== 'private';
  });

  const abi: AbiFunction[] = abiFunctions.map((func) => ({
    name: func.name,
    ...(func.functionSelector && { selector: binToHex(func.functionSelector) }),
    inputs: func.parameters.map((parameter) => ({
      name: parameter.name,
      type: abiTypeString(parameter.type),
    })),
    ...(func.returnTypes.length > 0 && {
      outputs: func.returnTypes.map((type) => ({ type: type.toString() })),
    }),
    ...(func.modifiers.length > 0 && {
      modifiers: func.modifiers.map((m) => m.toString()),
    }),
    ...buildFunctionAbiMetadata(func),
    ...(func.splitCountParam && { splitCountParam: func.splitCountParam }),
    ...(func.mergeCountParam && { mergeCountParam: func.mergeCountParam }),
  }));

  if (contract.constructorDef) {
    abi.push({
      name: contract.constructorDef.name, // '__construct'
      inputs: contract.constructorDef.parameters.map((parameter) => ({
        name: parameter.name,
        type: abiTypeString(parameter.type),
      })),
      ...buildFunctionAbiMetadata(contract.constructorDef),
    });
  }

  if (contract.fallbackDef) {
    abi.push({
      name: '__fallback',
      ...(contract.fallbackDef.functionSelector && { selector: binToHex(contract.fallbackDef.functionSelector) }),
      inputs: [],
      isFallback: true,
      ...buildFunctionAbiMetadata(contract.fallbackDef),
    });
  }

  if (contract.receiveDef) {
    abi.push({
      name: '__receive',
      ...(contract.receiveDef.functionSelector && { selector: binToHex(contract.receiveDef.functionSelector) }),
      inputs: [],
      isReceive: true,
      modifiers: ['payable'],
      ...buildFunctionAbiMetadata(contract.receiveDef),
    });
  }

  const bytecode = scriptToAsm(script);

  // Build state layout if contract has state variables or collections
  let stateLayout: StateLayout | undefined;
  if (contract.stateVariables.length > 0 || contract.collections.length > 0) {
    stateLayout = {
      variables: contract.stateVariables.map((sv) => ({
        name: sv.name,
        type: abiTypeString(sv.type),
        nftIndex: sv.nftIndex,
        fieldIndex: sv.fieldIndex,
        ...(sv.visibility !== StateVariableVisibility.PUBLIC && { visibility: sv.visibility }),
        ...(sv.immutable && { immutable: true }),
        ...(sv.isPacked && { packed: true }),
        ...(sv.isDynamic && { dynamic: true }),
        ...(sv.contractTypeName && { contractType: sv.contractTypeName }),
      })),
      dataNftCount: contract.stateVariables.length > 0
        ? Math.max(...contract.stateVariables.map((sv) => sv.nftIndex)) + 1
        : 0,
      commitmentLimit: compilerOptions.commitmentLimit ?? 128,
      ...(contract.constructorDef && {
        constructorInputs: contract.constructorDef.parameters.map((p) => ({
          name: p.name,
          type: p.type.toString(),
        })),
      }),
      ...(contract.collections.length > 0 && {
        collections: contract.collections.map((coll) => ({
          name: coll.name,
          signature: computeCollectionSignature(coll.name, coll.type.toString()),
          kind: (coll.type instanceof ArrayType ? 'array' : 'mapping') as 'mapping' | 'array',
          keyType: coll.keyType.toString(),
          valueType: coll.innermostValueType.toString(),
          ...(coll.depth > 1 && {
            keyTypes: coll.allKeyTypes.map((t) => t.toString()),
          }),
          ...mappingNameFields(coll.type),
          ...(coll.type instanceof ArrayType && {
            elementType: coll.type.elementType.toString(),
            ...(coll.type.bound !== undefined && { bound: coll.type.bound }),
          }),
          ...(coll.immutable && { immutable: true }),
        })),
      }),
      ...(contract.collections.some((c) => !(c.type instanceof ArrayType)) && {
        mappings: contract.collections
          .filter((coll) => !(coll.type instanceof ArrayType))
          .map((coll) => ({
            name: coll.name,
            signature: computeCollectionSignature(coll.name, coll.type.toString()),
            kind: 'mapping' as const,
            keyType: coll.keyType.toString(),
            valueType: coll.innermostValueType.toString(),
            ...(coll.depth > 1 && {
              keyTypes: coll.allKeyTypes.map((t) => t.toString()),
            }),
            ...mappingNameFields(coll.type),
            ...(coll.immutable && { immutable: true }),
          })),
      }),
      ...(() => {
        const allStructs = [...(ast.structDefinitions || []), ...contract.structDefinitions];
        return allStructs.length > 0 ? {
          structs: allStructs.map((sd) => ({
            name: sd.name,
            fields: sd.fields.map((f) => ({ name: f.name, type: f.type.toString() })),
          })),
        } : {};
      })(),
    };
  }

  // Build events if contract has event definitions
  // Build events from file-level (library imports) and contract-level event definitions
  const allEventDefs = [...(ast.eventDefinitions || []), ...contract.eventDefinitions];
  const events = allEventDefs.length > 0
    ? allEventDefs.map((ev) => ({
      name: ev.name,
      signature: ev.signature,
      parameters: ev.parameters.map((p) => ({
        name: p.name,
        type: p.type.toString(),
        ...(p.indexed && { indexed: true }),
      })),
      ...(ev.isAnonymous && { anonymous: true }),
    }))
    : undefined;

  // Build errors from both file-level and contract-level error definitions
  const allErrors = [...(ast.errorDefinitions || []), ...contract.errorDefinitions];
  const errors = allErrors.length > 0
    ? allErrors.map((err) => ({
      name: err.name,
      signature: err.signature,
      parameters: err.parameters.map((p) => ({ name: p.name, type: p.type.toString() })),
    }))
    : undefined;

  // Build enums from file-level, interface-level, and contract-level enum definitions
  const allEnums = [
    ...(ast.enumDefinitions || []),
    ...ast.interfaceDefinitions.flatMap((i) => i.enumDefinitions || []),
    ...contract.enumDefinitions,
  ];
  const enums = allEnums.length > 0
    ? allEnums.map((e) => ({
      name: e.name,
      members: e.members.map((m) => ({ name: m.name, value: m.value.toString() })),
    }))
    : undefined;

  // Collect external interface info from all referenced interfaces
  const referencedInterfaces = new Set<string>();
  for (const func of contract.functions) {
    if (func.externalReads) {
      for (const er of func.externalReads) {
        referencedInterfaces.add(er.interfaceName);
      }
    }
    if (func.externalCalls) {
      for (const ec of func.externalCalls) {
        referencedInterfaces.add(ec.interfaceName);
      }
    }
    if (func.externalOutStateReads) {
      for (const os of func.externalOutStateReads) {
        referencedInterfaces.add(os.interfaceName);
      }
    }
  }

  const externalInterfaces: ExternalInterfaceInfo[] | undefined = referencedInterfaces.size > 0
    ? [...referencedInterfaces].map((ifaceName) => {
      const iface = ast.interfaceDefinitions.find((i) => i.name === ifaceName);
      if (!iface) return undefined;
      return buildExternalInterfaceInfo(iface, compilerOptions, ast.interfaceDefinitions);
    }).filter((x): x is ExternalInterfaceInfo => x !== undefined)
    : undefined;

  // External script libraries the contract depends on, with a self-describing descriptor. Branded
  // (category-salted side-car) for stateful contracts; shared otherwise. See docs/external-libraries.md.
  const resolvedLibraries = resolveLibraries(compilerOptions.userLibraries);
  const allFns = [contract.constructorDef, contract.fallbackDef, contract.receiveDef, ...contract.functions];
  const usedLibraryNames = [...new Set(allFns.flatMap((f) => f?.usedLibraries ?? []))];
  const inlinedNames = new Set(allFns.flatMap((f) => f?.inlinedLibraries ?? []));
  const externalLibraries: ExternalLibraryAbi[] | undefined = usedLibraryNames.length > 0
    ? usedLibraryNames.map((name) => {
      const lib = resolvedLibraries[name];
      const range = sidecarCodeRange(lib.blob);
      return {
        name,
        blobHash: binToHex(lib.blobHash),
        branded: stateLayout !== undefined,
        inline: inlinedNames.has(name), // inlined into the contract bytecode -> SDK skips the side-car
        codeBegin: range.codeBegin,
        codeEnd: range.codeEnd,
        abi: lib.abi,
        // built-ins resolve by name in the SDK; user libraries embed their blob
        ...(BUILTIN_LIBRARIES[name] ? {} : { code: binToHex(lib.blob) }),
      };
    })
    : undefined;

  return {
    contractName: contract.name,
    constructorInputs,
    abi,
    bytecode,
    source,
    debug,
    ...(functionBodies && { functionBodies }),
    ...(fingerprint && { fingerprint }),
    ...(stateLayout && { stateLayout }),
    ...(externalInterfaces && externalInterfaces.length > 0 && { externalInterfaces }),
    ...(events && { events }),
    ...(errors && { errors }),
    ...(enums && { enums }),
    ...(externalLibraries && { externalLibraries }),
    compiler: {
      name: 'solidc',
      version,
      options: {
        enforceFunctionParameterTypes: compilerOptions.enforceFunctionParameterTypes,
        enforceLocktimeGuard: compilerOptions.enforceLocktimeGuard,
        commitmentLimit: compilerOptions.commitmentLimit,
      },
    },
    updatedAt: new Date().toISOString(),
  };
}

function buildExternalInterfaceInfo(
  iface: InterfaceNode,
  compilerOptions: CompilerOptions,
  allInterfaces: InterfaceNode[],
): ExternalInterfaceInfo {
  // Collect all state variables including from parent interfaces
  const allVars = getAllInterfaceStateVarsFlat(iface, allInterfaces);

  // Build state layout using same bin-packing as compiler
  const commitmentLimit = compilerOptions.commitmentLimit ?? 128;
  const variables: { name: string; type: string; nftIndex: number; fieldIndex: number; visibility?: string }[] = [];
  let nftIndex = 0;
  let fieldIndex = 0;
  let currentNftUsed = 0;

  // Collect struct definitions from the interface and parents for size computation
  const structDefs = collectInterfaceStructDefs(iface, allInterfaces);

  for (const sv of allVars) {
    const typeStr = sv.type.toString();
    const maxSize = getMaxEncodedSize(typeStr, structDefs);
    const isExternal = sv.visibility === StateVariableVisibility.EXTERNAL;
    const isStruct = structDefs.some((s) => s.name === typeStr);

    if (isExternal) {
      if (currentNftUsed > 0) { nftIndex++; fieldIndex = 0; currentNftUsed = 0; }
      variables.push({ name: sv.name, type: typeStr, nftIndex, fieldIndex: 0, visibility: 'external' });
      nftIndex++; fieldIndex = 0; currentNftUsed = 0;
    } else if (isStruct) {
      // Struct must be placed last in its NFT (same rule as SymbolTableTraversal)
      if (currentNftUsed + maxSize > commitmentLimit && currentNftUsed > 0) {
        nftIndex++; fieldIndex = 0; currentNftUsed = 0;
      }
      variables.push({ name: sv.name, type: typeStr, nftIndex, fieldIndex });
      fieldIndex++; currentNftUsed += maxSize;
      // Force next var to go to a new NFT since struct must be last
      nftIndex++; fieldIndex = 0; currentNftUsed = 0;
    } else {
      if (currentNftUsed + maxSize > commitmentLimit && currentNftUsed > 0) {
        nftIndex++; fieldIndex = 0; currentNftUsed = 0;
      }
      variables.push({ name: sv.name, type: typeStr, nftIndex, fieldIndex });
      fieldIndex++; currentNftUsed += maxSize;
    }
  }

  const dataNftCount = variables.length > 0 ? Math.max(...variables.map((v) => v.nftIndex)) + 1 : 0;

  // Collect collections
  const allCollections = getAllInterfaceCollectionsFlat(iface, allInterfaces);
  const collections = allCollections.length > 0
    ? allCollections.map((coll) => ({
      name: coll.name,
      signature: computeCollectionSignature(coll.name, coll.type.toString()),
      kind: (coll.type instanceof ArrayType ? 'array' : 'mapping') as 'mapping' | 'array',
      keyType: coll.keyType.toString(),
      valueType: coll.innermostValueType.toString(),
      ...mappingNameFields(coll.type),
    }))
    : undefined;

  // Build interface function ABIs
  const ifaceFunctions = iface.functions.map((func) => {
    const paramTypes = func.parameters.map((p) => abiTypeString(p.type));
    const sig = `${func.name}(${paramTypes.join(',')})`;
    return {
      name: func.name,
      inputs: func.parameters.map((p) => ({ name: p.name, type: abiTypeString(p.type) })),
      selector: computeFunctionSelectorHex(sig),
    };
  });

  return {
    name: iface.name,
    stateLayout: {
      variables,
      dataNftCount,
      commitmentLimit,
      ...(collections && { collections }),
    },
    ...(ifaceFunctions.length > 0 && { abi: ifaceFunctions }),
  };
}

function getAllInterfaceStateVarsFlat(
  iface: InterfaceNode,
  allInterfaces: InterfaceNode[],
): typeof iface.stateVariables {
  const varMap = new Map<string, typeof iface.stateVariables[0]>();

  // Recursively collect from parent interfaces first (parents override by order)
  for (const parentName of iface.parents) {
    const parent = allInterfaces.find((i) => i.name === parentName);
    if (!parent) continue;
    for (const sv of getAllInterfaceStateVarsFlat(parent, allInterfaces)) {
      varMap.set(sv.name, sv);
    }
  }

  // Then add/override with the interface's own state variables
  for (const sv of iface.stateVariables) {
    varMap.set(sv.name, sv);
  }

  return [...varMap.values()];
}

function getAllInterfaceCollectionsFlat(
  iface: InterfaceNode,
  allInterfaces: InterfaceNode[],
): InterfaceCollectionNode[] {
  const collMap = new Map<string, InterfaceCollectionNode>();

  for (const parentName of iface.parents) {
    const parent = allInterfaces.find((i) => i.name === parentName);
    if (!parent) continue;
    for (const coll of getAllInterfaceCollectionsFlat(parent, allInterfaces)) {
      collMap.set(coll.name, coll);
    }
  }

  for (const coll of iface.collections) {
    collMap.set(coll.name, coll);
  }

  return [...collMap.values()];
}

function collectInterfaceStructDefs(
  iface: InterfaceNode,
  allInterfaces: InterfaceNode[],
): StructDefinitionNode[] {
  const structMap = new Map<string, StructDefinitionNode>();
  for (const parentName of iface.parents) {
    const parent = allInterfaces.find((i) => i.name === parentName);
    if (!parent) continue;
    for (const sd of collectInterfaceStructDefs(parent, allInterfaces)) {
      structMap.set(sd.name, sd);
    }
  }
  for (const sd of (iface.structDefinitions ?? [])) {
    structMap.set(sd.name, sd);
  }
  return [...structMap.values()];
}

function getMaxEncodedSize(typeStr: string, structDefs?: StructDefinitionNode[]): number {
  // Check struct types first (recursive sum of field sizes)
  if (structDefs) {
    const structDef = structDefs.find((s) => s.name === typeStr);
    if (structDef) {
      return structDef.fields.reduce(
        (sum, f) => sum + getMaxEncodedSize(f.type.toString(), structDefs), 0,
      );
    }
  }
  if (typeStr === 'bool') return 1;
  if (typeStr === 'bigint') return 9;
  if (typeStr === 'pubkey') return 34;
  if (typeStr === 'sig') return 74;
  if (typeStr === 'datasig') return 66;
  // Bounded int types (int8, uint256, etc.)
  const intMatch = typeStr.match(/^u?int(\d+)$/);
  if (intMatch) {
    const bits = parseInt(intMatch[1], 10);
    const dataBytes = Math.ceil((bits + 1) / 8);
    if (dataBytes <= 75) return dataBytes + 1;
    if (dataBytes <= 255) return dataBytes + 2;
    return dataBytes + 3;
  }
  // Fixed-point types (fixed128x18, ufixed64x8)
  const fixedMatch = typeStr.match(/^u?fixed(\d+)x\d+$/);
  if (fixedMatch) {
    const bits = parseInt(fixedMatch[1], 10);
    const dataBytes = Math.ceil((bits + 1) / 8);
    if (dataBytes <= 75) return dataBytes + 1;
    if (dataBytes <= 255) return dataBytes + 2;
    return dataBytes + 3;
  }
  const bytesMatch = typeStr.match(/^bytes(\d+)$/);
  if (bytesMatch) {
    const n = parseInt(bytesMatch[1], 10);
    if (n === 0) return 1;
    if (n === 1) return 2;
    if (n <= 75) return n + 1;
    if (n <= 255) return n + 2;
    return n + 3;
  }
  return 9;
}

// strip verbose debug info (and optionally source) from artifact for production use
export function stripArtifact(
  artifact: Artifact,
  options?: { stripSource?: boolean },
): Omit<Artifact, 'debug'> {
  const stripped = { ...artifact };
  delete stripped.debug;
  delete stripped.functionBodies;
  if (options?.stripSource) {
    (stripped as any).source = '';
  }
  return stripped;
}
