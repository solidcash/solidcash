/** Stable diagnostic identifiers for invocation-transcript construction failures. */
export type Layer3DiagnosticCode =
  | 'L3_INVOCATION_LIMIT'
  | 'L3_OWNER_ARTIFACT_CONFLICT'
  | 'L3_RECURSIVE_CLOSURE'
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
}

/** Machine-stable code plus the human context required by transcript-v1 section 12. */
export class Layer3DiagnosticError extends Error {
  readonly name = 'Layer3DiagnosticError';

  constructor(
    public readonly code: Layer3DiagnosticCode,
    message: string,
    public readonly context: Layer3DiagnosticContext,
  ) {
    super(`layer3 [${code}]: ${message}`);
  }
}
