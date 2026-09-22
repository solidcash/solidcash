/**
 * DEFINE frame validation bridge (backlog item 3).
 * GTT emitFunctionDefine calls validateDefineEmission — the same entry unit tests drive.
 */

import {
  buildHandlerFrameSchema,
  validateHandlerFrame,
  type FrameValidationResult,
  type HandlerFrameSchema,
  type StackEffectSignature,
} from '@solidcash/utils';

export type DefineFrameValidationRecord = {
  handlerId: string;
  handlerName: string;
  schema: HandlerFrameSchema;
  effects: readonly StackEffectSignature[];
  result: FrameValidationResult;
};

const records: DefineFrameValidationRecord[] = [];

export function clearDefineFrameValidations(): void {
  records.length = 0;
}

export function getDefineFrameValidations(): readonly DefineFrameValidationRecord[] {
  return records;
}

export type DefineEmissionFrameInput = {
  handlerId: string;
  handlerName: string;
  parameters: readonly { name: string }[];
  callerBandNames?: readonly string[];
  /** Net anonymous cells left on the stack model after the DEFINE body (must be 0). */
  anonymousLive?: number;
  /** Alt-stack depth at DEFINE body exit (must be 0 for balanced bodies). */
  altStackDepth?: number;
  /** Optional extra helper effects recorded during emission. */
  helperEffects?: readonly StackEffectSignature[];
};

/**
 * Build schema from the real FunctionDefinition parameter list and validate stack-effect signatures.
 * Called from GTT `emitFunctionDefine` after the body sub-traversal completes.
 */
export function validateDefineEmission(input: DefineEmissionFrameInput): FrameValidationResult {
  const args = input.parameters
    .filter((p) => !p.name.startsWith('__internal__'))
    .map((p) => p.name);
  const internals = input.parameters
    .filter((p) => p.name.startsWith('__internal__'))
    .map((p) => p.name);
  const band = [...(input.callerBandNames ?? [])];
  const schema = buildHandlerFrameSchema({
    handlerId: input.handlerId,
    handlerName: input.handlerName,
    arguments: args,
    routeContext: [
      ...band,
      ...internals.filter((n) => /batch|owner|blob|graph|manifest|verifier/i.test(n)),
    ],
    journals: internals.filter((n) => /journal/i.test(n)),
    cursors: internals.filter((n) => /cursor|iter|Index|count/i.test(n)),
    results: internals.filter((n) => /return|result|PredOut|valueChunk|dynamicChunk/i.test(n)),
  });

  const anonymousLive = input.anonymousLive ?? 0;
  const altStackDepth = input.altStackDepth ?? 0;
  const effects: StackEffectSignature[] = [...(input.helperEffects ?? [])];
  if (anonymousLive === 0 && altStackDepth === 0) {
    effects.push({
      helperId: `${input.handlerName}:define-body`,
      reads: schema.slots.map((slot) => slot.name),
    });
  } else {
    // Emission model reported live anonymous cells or alt imbalance — fail closed.
    effects.push({
      helperId: `${input.handlerName}:define-exit-imbalance`,
      anonymousPushes: Math.max(0, anonymousLive),
      anonymousPops: Math.max(0, -anonymousLive),
      altStackDelta: altStackDepth,
    });
  }

  const result = validateHandlerFrame(schema, effects);
  records.push({
    handlerId: input.handlerId,
    handlerName: input.handlerName,
    schema,
    effects,
    result,
  });
  return result;
}
