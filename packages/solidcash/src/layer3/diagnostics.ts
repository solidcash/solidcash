/** Stable diagnostic identifiers for invocation-transcript construction failures. */
export type Layer3DiagnosticCode =
  | 'L3_ALIAS_UNRESOLVED'
  | 'L3_ARTIFACT_FINGERPRINT_CONFLICT'
  | 'L3_DUPLICATE_OUTPOINT'
  | 'L3_INPUT_AUTHORITY_CONFLICT'
  | 'L3_INVOCATION_LIMIT'
  | 'L3_MUTABLE_ARTIFACT_UNSUPPORTED'
  | 'L3_PARTICIPANT_LIMIT'
  | 'L3_OWNER_ARTIFACT_CONFLICT'
  | 'L3_PROTOCOL_METADATA_MALFORMED'
  | 'L3_PROTOCOL_VERSION_UNSUPPORTED'
  | 'L3_RECURSIVE_CLOSURE'
  | 'L3_RESOURCE_CAPACITY'
  | 'L3_RESOURCE_UNRESOLVED'
  | 'L3_RESULT_DEPENDENCY_INVALID'
  | 'L3_FUTURE_RESULT_DEPENDENCY'
  | 'L3_TRANSCRIPT_ROW_INCONSISTENT'
  | 'L3_FINALIZED_BYTE_LIMIT'
  | 'L3_VM_RESOURCE_LIMIT'
  | 'L3_GRAPH_DEPTH_LIMIT'
  | 'L3_SCB_ENVELOPE_MALFORMED'
  | 'L3_SCB_VERSION_UNSUPPORTED'
  | 'L3_SETTLEMENT_AUTHORITY_CONFLICT'
  | 'L3_TARGET_UNRESOLVED'
  | 'L3_TARGET_EXHAUSTED';

export interface Layer3DiagnosticContext {
  invocationIds?: readonly number[];
  callChain?: readonly string[];
  callsiteId?: number;
  callsiteLocation?: { line: number; column: number };
  ownerIdentity?: string;
  interfaceName?: string;
  measured?: number;
  limit?: number;
  metadataField?: string;
  actual?: unknown;
  expected?: unknown;
  participant?: number;
  inputIdentity?: string;
  resourceIdentity?: string;
  artifactFingerprint?: string;
  stateLayoutFingerprint?: string;
  settlementPaths?: readonly string[];
  handler?: string;
  inputIndex?: number;
  rawVmReason?: string;
  consumerInvocation?: number;
  producerInvocation?: number;
  cyclicEdge?: readonly [number, number];
  keyIdentity?: string;
  rule?: string;
}

/** Machine-stable code plus the human context required by transcript-v1 section 12. */
export class Layer3DiagnosticError extends Error {
  readonly name = 'Layer3DiagnosticError';

  constructor(
    public readonly code: Layer3DiagnosticCode,
    message: string,
    public readonly context: Layer3DiagnosticContext,
    preserveMessage = false,
  ) {
    super(preserveMessage ? message : `layer3 [${code}]: ${message}`);
  }
}
