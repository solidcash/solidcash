/** Stable diagnostic identifiers for invocation-callManifest construction failures. */
export type MessageBusDiagnosticCode =
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
  | 'L3_TRANSCRIPT_EFFECT_UNIMPLEMENTED'
  | 'L3_UNBOUNDED_EXTERNAL_CALL_LOOP'
  | 'MESSAGE_BUS_FINALIZED_BYTE_LIMIT'
  | 'L3_VM_RESOURCE_LIMIT'
  | 'L3_GRAPH_DEPTH_LIMIT'
  | 'L3_MESSAGE_BUS_ENVELOPE_MALFORMED'
  | 'L3_MESSAGE_BUS_VERSION_UNSUPPORTED'
  | 'L3_SETTLEMENT_AUTHORITY_CONFLICT'
  | 'L3_TARGET_UNRESOLVED'
  | 'L3_TARGET_EXHAUSTED';

export interface MessageBusDiagnosticContext {
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

/** Machine-stable code plus the human context required by callManifest-v1 section 12. */
export class MessageBusDiagnosticError extends Error {
  readonly name = 'MessageBusDiagnosticError';

  constructor(
    public readonly code: MessageBusDiagnosticCode,
    message: string,
    public readonly context: MessageBusDiagnosticContext,
    preserveMessage = false,
  ) {
    super(preserveMessage ? message : `messageBus [${code}]: ${message}`);
  }
}
