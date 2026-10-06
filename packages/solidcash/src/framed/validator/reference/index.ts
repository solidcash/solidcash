/**
 * The independent reference model of the composition validator.
 *
 * It shares no code with the derivation in the compiler package: the two are compared case by case by the
 * differential harness, which requires them to agree on every accept and every reject.
 */

export {
  carriesToken,
  eq,
  immutableToken,
  inputByIndex,
  keyOf,
  masterToken,
  mutableToken,
  outputByIndex,
  userLock,
  type ReferenceContext,
  type ReferenceInput,
  type ReferenceOutput,
  type ReferenceToken,
  type ReferenceTransaction,
} from './model.js';

export {
  decideReference,
  type ReferenceCheck,
  type ReferenceDecision,
} from './reference.js';
