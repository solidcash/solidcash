import { Layer3DiagnosticError } from './diagnostics.js';

export interface Layer3AuthorityClaim {
  ownerIdentity: string;
  inputIdentity: string;
  outpoint: string;
  artifactFingerprint: string;
  stateLayoutFingerprint: string;
  settlementPath: string;
  /** Present when this input is a resource authority rather than the owner's master input. */
  resourceIdentity?: string;
  mutable: boolean;
  transcriptCapable: boolean;
  dynamicAliasesResolved: boolean;
}

/**
 * Refuse concrete authority aliasing before any input is fetched or transaction is built.
 * The participant and controller covenants remain authoritative over the same identities.
 */
export const assertLayer3AuthorityClaims = (claims: readonly Layer3AuthorityClaim[]): void => {
  const owners = new Map<string, Layer3AuthorityClaim>();
  const authorities = new Map<string, { owner: string; resource?: string }>();
  const outpoints = new Map<string, number>();
  claims.forEach((claim, participant) => {
    const previousOwner = owners.get(claim.ownerIdentity);
    const isOwnerInput = claim.resourceIdentity === undefined;
    if (isOwnerInput && previousOwner && previousOwner.inputIdentity !== claim.inputIdentity) {
      throw new Layer3DiagnosticError(
        'L3_INPUT_AUTHORITY_CONFLICT',
        `logical owner '${claim.ownerIdentity}' names two different inputs`,
        { ownerIdentity: claim.ownerIdentity, inputIdentity: claim.inputIdentity, participant },
      );
    }
    if (isOwnerInput && previousOwner && (previousOwner.artifactFingerprint !== claim.artifactFingerprint
      || previousOwner.stateLayoutFingerprint !== claim.stateLayoutFingerprint)) {
      throw new Layer3DiagnosticError(
        'L3_ARTIFACT_FINGERPRINT_CONFLICT',
        `logical owner '${claim.ownerIdentity}' names incompatible artifact or state-layout fingerprints`,
        {
          ownerIdentity: claim.ownerIdentity,
          artifactFingerprint: claim.artifactFingerprint,
          stateLayoutFingerprint: claim.stateLayoutFingerprint,
          participant,
        },
      );
    }
    if (isOwnerInput && previousOwner && previousOwner.settlementPath !== claim.settlementPath) {
      throw new Layer3DiagnosticError(
        'L3_SETTLEMENT_AUTHORITY_CONFLICT',
        `logical owner '${claim.ownerIdentity}' has two final settlement authorities`,
        {
          ownerIdentity: claim.ownerIdentity,
          settlementPaths: [previousOwner.settlementPath, claim.settlementPath],
          participant,
        },
      );
    }
    if (isOwnerInput) owners.set(claim.ownerIdentity, previousOwner ?? claim);

    if (isOwnerInput && claim.mutable && !claim.transcriptCapable) {
      throw new Layer3DiagnosticError(
        'L3_MUTABLE_ARTIFACT_UNSUPPORTED',
        `mutable owner '${claim.ownerIdentity}' has no transcript-capable artifact`,
        { ownerIdentity: claim.ownerIdentity, artifactFingerprint: claim.artifactFingerprint, participant },
      );
    }
    if (isOwnerInput && !claim.dynamicAliasesResolved) {
      throw new Layer3DiagnosticError(
        'L3_ALIAS_UNRESOLVED',
        `owner '${claim.ownerIdentity}' retains an unresolved dynamic alias`,
        { ownerIdentity: claim.ownerIdentity, participant },
      );
    }

    const previous = authorities.get(claim.inputIdentity);
    if (previous && (previous.owner !== claim.ownerIdentity || previous.resource !== claim.resourceIdentity)) {
      throw new Layer3DiagnosticError(
        'L3_INPUT_AUTHORITY_CONFLICT',
        `input '${claim.inputIdentity}' is assigned to two owners or resources`,
        {
          ownerIdentity: claim.ownerIdentity,
          inputIdentity: claim.inputIdentity,
          resourceIdentity: claim.resourceIdentity,
          participant,
        },
      );
    }
    authorities.set(claim.inputIdentity, { owner: claim.ownerIdentity, resource: claim.resourceIdentity });
    const previousOutpoint = outpoints.get(claim.outpoint);
    if (previousOutpoint !== undefined && previousOutpoint !== participant) {
      throw new Layer3DiagnosticError(
        'L3_DUPLICATE_OUTPOINT',
        `final transaction would consume outpoint '${claim.outpoint}' twice`,
        { ownerIdentity: claim.ownerIdentity, inputIdentity: claim.inputIdentity, participant },
      );
    }
    outpoints.set(claim.outpoint, participant);
  });
};

export interface Layer3ContentionOptions {
  participants: number;
  /** Probability that one participant owner moves during one derivation/mining window. */
  activityProbability: number;
  /** Independent settlement attempts per trial, including the initial attempt. */
  attempts: number;
  trials: number;
  /** Retry attempts shorten the vulnerable window by this factor (0 < factor <= 1). */
  retryWindowFactor?: number;
  seed?: number;
}

export interface Layer3ContentionReport {
  options: Required<Layer3ContentionOptions>;
  successes: number;
  failures: number;
  empiricalSuccessProbability: number;
  theoreticalSuccessProbability: number;
  meanAttemptsWhenSuccessful: number;
}

const validateInteger = (name: string, value: number, minimum: number): void => {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`layer3: ${name} must be an integer >= ${minimum}`);
  }
};

/** Deterministic 32-bit generator so contention reports are reproducible in CI and review. */
const mulberry32 = (initial: number): (() => number) => {
  let state = initial >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
  };
};

/**
 * Model the multiplicative liveness cost of atomically acquiring N independently
 * active owner UTXOs. This is deliberately a liveness model, never a covenant
 * soundness assumption.
 */
export const simulateLayer3Contention = (
  supplied: Layer3ContentionOptions,
): Layer3ContentionReport => {
  const options: Required<Layer3ContentionOptions> = {
    retryWindowFactor: 0.65,
    seed: 0x53434231,
    ...supplied,
  };
  validateInteger('participants', options.participants, 1);
  validateInteger('attempts', options.attempts, 1);
  validateInteger('trials', options.trials, 1);
  if (options.activityProbability < 0 || options.activityProbability > 1) {
    throw new Error('layer3: activityProbability must be between 0 and 1');
  }
  if (options.retryWindowFactor <= 0 || options.retryWindowFactor > 1) {
    throw new Error('layer3: retryWindowFactor must be greater than 0 and at most 1');
  }

  const random = mulberry32(options.seed);
  let successes = 0;
  let successfulAttemptTotal = 0;
  for (let trial = 0; trial < options.trials; trial += 1) {
    for (let attempt = 0; attempt < options.attempts; attempt += 1) {
      const activity = options.activityProbability * (options.retryWindowFactor ** attempt);
      let stale = false;
      for (let participant = 0; participant < options.participants; participant += 1) {
        if (random() < activity) stale = true;
      }
      if (!stale) {
        successes += 1;
        successfulAttemptTotal += attempt + 1;
        break;
      }
    }
  }

  let allAttemptsFail = 1;
  for (let attempt = 0; attempt < options.attempts; attempt += 1) {
    const activity = options.activityProbability * (options.retryWindowFactor ** attempt);
    const attemptSuccess = (1 - activity) ** options.participants;
    allAttemptsFail *= 1 - attemptSuccess;
  }
  return {
    options,
    successes,
    failures: options.trials - successes,
    empiricalSuccessProbability: successes / options.trials,
    theoreticalSuccessProbability: 1 - allAttemptsFail,
    meanAttemptsWhenSuccessful: successes === 0 ? 0 : successfulAttemptTotal / successes,
  };
};
