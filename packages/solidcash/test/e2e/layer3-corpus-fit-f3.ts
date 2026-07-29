import type { Calibration, Estimate, GraphShapeSpec } from './layer3-estimator-f2.js';
import { estimate } from './layer3-estimator-f2.js';

/**
 * F3 SUPPORT TYPES AND THE ONE PIECE OF ARITHMETIC THE FIT REPORT NEEDS.
 *
 * F1 measured seven built shapes; F2 predicts an unbuilt one from a descriptor. F3 asks the question neither
 * answers: do the contracts people actually wrote reach the bus at all, and where do the ones that do land?
 *
 * The census this consumes is a COMPILE OUTPUT, recorded by `layer3-corpus-probe-f3.mjs`. Nothing in this file
 * measures a transaction, and every figure it produces is therefore an ESTIMATE, labelled as one.
 */

/** Per-corpus counts at each gate a contract has to pass to reach the bus. */
export interface CensusGates {
  /** Source files probed, after the corpus's own out-of-scope and negative-test exclusions. */
  files: number;
  /** Concrete contracts found in them - the real denominator, since a file can hold several. */
  contracts: number;
  /** Skipped before compilation, by the reason each corpus's own bench skips on. */
  skipped: Record<string, number>;
  /** Compiles in ordinary direct mode. */
  directOk: number;
  /** Compiles again with participant-mode options. */
  busOk: number;
  /** An SCB1 route was synthesized: the contract has a message-bus surface at all. */
  routePresent: number;
  /** At least one handler on that route is eligible, i.e. something can actually be invoked. */
  eligibleHandler: number;
  /** Instantiable with placeholder constructor arguments, so a redeem-script length exists. */
  instantiable: number;
}

export interface CensusRow {
  corpus: string;
  rel: string;
  contractName?: string;
  direct: 'OK' | 'FAIL';
  directMethod?: 'multi' | 'primary';
  directError?: string;
  directSiblingError?: string;
  directStateful?: boolean;
  abiFunctions?: number;
  declarationsOnly?: boolean;
  bus?: 'OK' | 'FAIL';
  busError?: string;
  route?: 'PRESENT' | 'ABSENT';
  handlerCount?: number;
  eligibleHandlers?: string[];
  /** Admitted handlers the compiler does NOT prove read-only: what this participant can actually change. */
  eligibleWrites?: string[];
  /** Refused handlers the compiler does not prove read-only: the write surface the route turned away. */
  refusedWrites?: number;
  rejectionReasons?: string[];
  blockSize?: number;
  maximumRows?: number;
  maximumBlobBytes?: number;
  constructorTypes?: string[];
  redeemBytes?: number;
  redeemError?: string;
}

/**
 * The descriptor for a graph of N copies of ONE real contract, which is the only graph a census can describe.
 *
 * A census records each contract on its own; it cannot know which pairs call each other, and a graph edge is a
 * source-level `IContract(peer).method()`, not something a report may assume. The homogeneous replica is the
 * honest reading of "this contract at N participants": it uses that contract's OWN measured block size and
 * redeem script, and it matches the shape every calibration capstone has - one invocation per participant.
 *
 * A REAL heterogeneous graph is bounded ABOVE by the replica of its largest member and BELOW by the replica of
 * its smallest, because every per-class coefficient here is monotone in block size and redeem bytes. The report
 * states the replica figure and that bracket, never a heterogeneous number the census cannot support.
 */
export function replicaSpec(row: CensusRow, participants: number): GraphShapeSpec {
  if (row.blockSize === undefined || row.redeemBytes === undefined) {
    throw new Error(`F3: ${row.contractName ?? row.rel} has no measured block size or redeem length`);
  }
  return {
    name: `${row.contractName ?? row.rel} x${participants}`,
    family: 'graph',
    participants,
    invocations: participants,
    blockSizes: Array.from({ length: participants }, () => row.blockSize!),
    redeemBytes: Array.from({ length: participants }, () => row.redeemBytes!),
  };
}

export interface FitRow {
  contract: string;
  corpus: string;
  participants: number;
  blockSize: number;
  redeemBytes: number;
  prediction: Estimate;
}

export function fitAt(row: CensusRow, participants: number, calibration: Calibration): FitRow {
  return {
    contract: row.contractName ?? row.rel,
    corpus: row.corpus,
    participants,
    blockSize: row.blockSize!,
    redeemBytes: row.redeemBytes!,
    prediction: estimate(replicaSpec(row, participants), calibration),
  };
}

/** One line per fit row, in the order the board's envelope tables read. */
export function formatFitRow(row: FitRow): string {
  const first = row.prediction.limits[0];
  return [
    `${row.corpus}/${row.contract}`.padEnd(34),
    `N=${row.participants}`,
    `inputs=${String(row.prediction.inputCount).padStart(4)}`,
    `serialized<=${String(row.prediction.serializedBytes.toFixed(0)).padStart(7)}B`,
    `worstScript<=${String(row.prediction.worstUnlockingBytes.toFixed(0)).padStart(6)}B`,
    `density<=${row.prediction.worstDensityRatio.toFixed(4)}x`,
    `binds=${first.limit} ${first.ratio.toFixed(4)}x`,
    row.prediction.verdict,
    row.prediction.outOfRange.length === 0 ? 'in-range' : `OUT-OF-RANGE(${row.prediction.outOfRange.length})`,
  ].join(' | ');
}
