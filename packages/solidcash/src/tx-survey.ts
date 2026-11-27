/**
 * One JSON line per broadcast transaction, appended to the file `SOLIDCASH_TX_SURVEY` names (docs/compiler-diagnostics.md).
 *
 * The line states what a real chain weighs the transaction by, whatever limits the network it was sent on relaxes:
 * its byte length, its inputs and outputs, and for every input the length of its unlocking and locking bytecode,
 * the operation cost and hash digest iterations its evaluation spent, and the budgets a real chain grants an input of
 * that length (`(41 + unlocking length) × 800` units, and 3.5 or 0.5 iterations per byte for a nonstandard or a
 * standard transaction). The path that builds the transaction may label it first (`labelNextBroadcast`): the entry it
 * calls and the frames it runs, and the part each input plays. It changes no transaction, plan or verdict; unset,
 * every hook is one environment read. `SOLIDCASH_TX_SURVEY_RAW=1` also writes the transaction itself and the outputs
 * its inputs spend, as hex, so one input's evaluation can be replayed and profiled afterwards.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { encodeTransactionOutput } from '@bitauth/libauth/build/lib/message/transaction-encoding.js';
import type { Input, Output, Transaction } from '@bitauth/libauth';

/** The real chain's density base and per-byte budgets (libauth `ConsensusBch2025`, VM Limits CHIP). */
const DENSITY_CONTROL_BASE_LENGTH = 41;
const OPERATION_COST_BUDGET_PER_BYTE = 800;
const HASH_ITERATIONS_PER_BYTE_NONSTANDARD = 3.5;
const HASH_ITERATIONS_PER_BYTE_STANDARD = 0.5;

/** Node's own file append, which the survey writes with; undefined where the runtime has none. */
function appendLine(file: string, line: string): void {
  const runtime = (globalThis as { process?: { getBuiltinModule?: (name: string) => unknown } }).process;
  const fs = runtime?.getBuiltinModule?.('node:fs') as
    { appendFileSync?: (path: string, data: string) => void } | undefined;
  fs?.appendFileSync?.(file, line);
}

/** The file the survey appends to, or undefined when it is off. */
function surveyFile(): string | undefined {
  const file = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.SOLIDCASH_TX_SURVEY;
  return file === undefined || file === '' ? undefined : file;
}

/** True when each line also carries the transaction and the outputs it spends. */
function surveyRaw(): boolean {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.SOLIDCASH_TX_SURVEY_RAW === '1';
}

/** True when the survey is on. */
export function surveyOn(): boolean {
  return surveyFile() !== undefined;
}

let pendingLabel: { readonly label: string; readonly roles: readonly string[] } | undefined;

/** Labels the next transaction the survey records: what it does, and the part each input plays, by input index. */
export function labelNextBroadcast(label: string, roles: readonly string[] = []): void {
  if (!surveyOn()) return;
  pendingLabel = { label, roles };
}

/** One input as the survey states it. */
interface SurveyedInput {
  readonly role: string;
  readonly unlocking: number;
  readonly locking: number;
  readonly operationCost?: number;
  readonly operationBudget: number;
  readonly hashIterations?: number;
  readonly hashBudget: number;
  readonly hashBudgetStandard: number;
  readonly error?: string;
}

/** The machine the survey evaluates an input on: any whose final state carries the VM Limits metrics. */
interface SurveyMachine {
  evaluate(program: {
    readonly inputIndex: number; readonly sourceOutputs: readonly Output[]; readonly transaction: Transaction;
  }): unknown;
}

/**
 * Records one transaction: `sourceOutputs` are the outputs its inputs spend, in input order, and `machine` evaluates
 * each input, on the network's own limits, for what it spent.
 */
export function surveyTransaction(
  raw: Uint8Array, transaction: Transaction<Input>, sourceOutputs: readonly (Output | undefined)[],
  machine: SurveyMachine,
): void {
  const file = surveyFile();
  if (file === undefined) return;
  const labelled = pendingLabel;
  pendingLabel = undefined;
  const complete = sourceOutputs.every((output) => output !== undefined);
  const inputs = transaction.inputs.map((input, index): SurveyedInput => {
    const unlocking = input.unlockingBytecode.length;
    const density = DENSITY_CONTROL_BASE_LENGTH + unlocking;
    const surveyed = {
      role: labelled?.roles[index] ?? 'input',
      unlocking,
      locking: sourceOutputs[index]?.lockingBytecode.length ?? -1,
      operationBudget: density * OPERATION_COST_BUDGET_PER_BYTE,
      hashBudget: Math.floor(density * HASH_ITERATIONS_PER_BYTE_NONSTANDARD),
      hashBudgetStandard: Math.floor(density * HASH_ITERATIONS_PER_BYTE_STANDARD),
    };
    if (!complete) return surveyed;
    try {
      const state = machine.evaluate({
        inputIndex: index, sourceOutputs: sourceOutputs as readonly Output[], transaction,
      }) as { readonly metrics?: { readonly operationCost?: number; readonly hashDigestIterations?: number };
        readonly error?: unknown };
      return {
        ...surveyed,
        ...(state.metrics?.operationCost === undefined ? {} : { operationCost: state.metrics.operationCost }),
        ...(state.metrics?.hashDigestIterations === undefined
          ? {} : { hashIterations: state.metrics.hashDigestIterations }),
        ...(state.error === undefined ? {} : { error: String(state.error) }),
      };
    } catch (error) {
      return { ...surveyed, error: (error as Error).message };
    }
  });
  const commitments = transaction.outputs.map((output) => output.token?.nft?.commitment.length ?? 0);
  const inputValue = sourceOutputs.reduce((sum, output) => sum + (output?.valueSatoshis ?? 0n), 0n);
  const outputValue = transaction.outputs.reduce((sum, output) => sum + output.valueSatoshis, 0n);
  // Under a test runner that keeps its state on a global `expect`, the test the transaction belongs to.
  const test = (globalThis as { expect?: { getState?: () => { currentTestName?: string } } }).expect?.getState?.()
    ?.currentTestName;
  appendLine(file, `${JSON.stringify({
    label: labelled?.label ?? 'unlabelled',
    ...(test === undefined ? {} : { test }),
    bytes: raw.length,
    inputs: transaction.inputs.length,
    outputs: transaction.outputs.length,
    ...(complete ? { fee: String(inputValue - outputValue) } : {}),
    largestUnlocking: Math.max(0, ...inputs.map((input) => input.unlocking)),
    largestOutputLocking: Math.max(0, ...transaction.outputs.map((output) => output.lockingBytecode.length)),
    largestCommitment: Math.max(0, ...commitments),
    perInput: inputs,
    ...(surveyRaw() ? {
      raw: binToHex(raw),
      spent: sourceOutputs.map((output) => (output === undefined ? '' : binToHex(encodeTransactionOutput(output)))),
    } : {}),
  })}\n`);
}
