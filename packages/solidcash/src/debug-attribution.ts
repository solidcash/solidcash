import type { Artifact, FunctionDebugInformation, RequireStatement } from '@solidcash/utils';

export interface ActiveRequireSource {
  artifact: Artifact;
  debug: FunctionDebugInformation;
  requirement: RequireStatement;
}

export interface ActiveRequireResolution {
  /** True when the instruction body has compiler-published debug metadata, even if its source is ambiguous. */
  matchedBody: boolean;
  message?: string;
  requireIp?: number;
  /** Present only when one exact body record owns the resolved requirement. */
  source?: ActiveRequireSource;
}

/** Traverse an artifact and its delegate artifacts once, preserving caller-first order. */
export function artifactClosure(
  artifacts: readonly (Artifact | undefined)[],
): Artifact[] {
  const seen = new Set<Artifact>();
  const result: Artifact[] = [];
  const add = (artifact: Artifact | undefined): void => {
    if (!artifact || seen.has(artifact)) return;
    seen.add(artifact);
    result.push(artifact);
    add(artifact.delegateArtifact);
  };
  for (const artifact of artifacts) add(artifact);
  return result;
}

/**
 * Resolve a failed require against the exact instruction body active in the VM.
 *
 * OP_INVOKE restarts instruction pointers inside outlined bodies, so an entry selector alone cannot identify the
 * source coordinate. Byte-identical bodies are allowed only when their exact-IP reasons agree; otherwise this
 * deliberately reports a matched-but-unresolved body so callers cannot fall back to an unrelated coordinate.
 */
export function resolveActiveRequire(
  artifacts: readonly (Artifact | undefined)[],
  activeBytecode: string,
  errorIp: number,
): ActiveRequireResolution {
  const bodies: Array<{ artifact: Artifact; debug: FunctionDebugInformation }> = [];
  for (const artifact of artifactClosure(artifacts)) {
    const seenDebug = new Set<FunctionDebugInformation>();
    const addBody = (debug: FunctionDebugInformation | undefined): void => {
      if (!debug || seenDebug.has(debug)) return;
      seenDebug.add(debug);
      bodies.push({ artifact, debug });
    };
    for (const debug of Object.values(artifact.debug?.invokeDebug ?? {})) {
      if (debug.bytecode === activeBytecode) addBody(debug);
    }
    for (const [selector, bytecode] of Object.entries(artifact.functionBodies ?? {})) {
      if (bytecode === activeBytecode) addBody(artifact.debug?.functionDebug?.[selector]);
    }
    if (artifact.debug?.bytecode === activeBytecode) addBody(artifact.debug);
  }
  if (bodies.length === 0) return { matchedBody: false };

  // Libauth records an execution error on the state after the failing VERIFY. Retain direct-IP compatibility
  // for callers which already pass the failing instruction rather than the terminal state pointer.
  for (const requireIp of [errorIp - 1, errorIp]) {
    const matches = bodies.flatMap(({ artifact, debug }) => {
      const requirement = debug.requires.find((entry) => entry.ip === requireIp);
      return requirement ? [{ artifact, debug, requirement }] : [];
    });
    if (matches.length === 0) continue;
    const messages = new Set(matches.flatMap(({ requirement }) => (
      requirement.message ? [requirement.message] : []
    )));
    if (messages.size !== 1) return { matchedBody: true, requireIp };
    return {
      matchedBody: true,
      requireIp,
      message: [...messages][0],
      ...(matches.length === 1 && { source: matches[0] }),
    };
  }
  return { matchedBody: true };
}
