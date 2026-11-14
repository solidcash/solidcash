/**
 * A14 item 4: a creating call makes the children its creator's run makes, in run order, with the arguments that run
 * binds. A creation is built from a plan of them and the creator's input is then run: each deployer `new` site it
 * reaches shows the child's contract, its deployer input d_in and its Q ‖ A, and the checks of its runtime loops show
 * their transfers. A run that differs from the plan its creation was built from throws `CreationPlanChanged` with what
 * the run showed, and the call is built again from that plan.
 */
import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type { Transaction } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2023/bch-2023-types.js';
import type { AuthenticationProgramStateCommon } from '@bitauth/libauth/build/lib/vm/vm-types.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import {
  DeployerPrepError, locktimeChecks, locktimeLedger, readDeployerSiteVisits, type DeployerSiteVisit,
  type LocktimeNeed,
} from './deployer.js';
import { evaluateFaithfulOrDebugTrace } from './faithful-probe-trace.js';
import { readRuntimeEffects, type RuntimeEffect } from './runtime-effect-stream-trace.js';
import {
  deriveRuntimeLoopTransfers, type RuntimeLoopTransferTarget,
} from './sc-derive-full-phase2-apply-runtime-loop.js';

/** One child of a creating call, in run order, with what a run of its creator showed of it. */
export interface PlannedChild {
  contractName: string;
  /** d_in: the input the creator's site binds. */
  inputIndex?: number;
  /** Q ‖ A: the bytes the creator's site binds. */
  bound?: Uint8Array;
}

/** The children a creating call makes, and its runtime loops' transfers, as far as a run has shown them. */
export interface CreationPlan {
  children: PlannedChild[];
  /** The runtime effect span, events and payments in output order, as a run showed it. */
  effects?: RuntimeEffect[];
  /** The transfers at the function's transfer slots, in slot order. */
  fixedTransfers?: Array<{ lockingBytecode: Uint8Array; amount: bigint }>;
  /** The creation's locktime, as its inputs' needs settled it (A5). */
  locktime?: number;
  /** Needs a run of the creation showed beyond the creator's own and its children's: its callees' `tx.time` checks. */
  locktimeNeeds?: LocktimeNeed[];
}

/** The creator's run makes other children, or binds other values, than the creation was built from. */
export class CreationPlanChanged extends Error {
  constructor(readonly plan: CreationPlan, message: string) {
    super(message);
    this.name = 'CreationPlanChanged';
  }
}

/** A plan as a string, to tell two plans apart. */
export function creationPlanKey(plan: CreationPlan): string {
  return JSON.stringify({
    children: plan.children.map((child) => [
      child.contractName, child.inputIndex ?? null, child.bound === undefined ? null : binToHex(child.bound),
    ]),
    fixedTransfers: (plan.fixedTransfers ?? []).map((transfer) => [
      binToHex(transfer.lockingBytecode), transfer.amount.toString(),
    ]),
    effects: plan.effects?.map(effectKey) ?? null,
    locktime: plan.locktime ?? null,
    locktimeNeeds: (plan.locktimeNeeds ?? []).map((need) => [need.inputIndex, need.kind, need.value]),
  });
}

/** An effect as a string, to tell two runs apart. */
function effectKey(effect: RuntimeEffect): string {
  switch (effect.kind) {
    case 'event': return `event:${binToHex(effect.lockingBytecode)}:${effect.commitment}`;
    case 'bch': return `bch:${binToHex(effect.lockingBytecode)}:${effect.amount}`;
    case 'token': return `token:${effect.category}:${binToHex(effect.lockingBytecode)}:${effect.amount}`;
    default:
      return `nft:${effect.category}:${binToHex(effect.lockingBytecode)}:${effect.commitment}:${effect.capability}:`
        + `${effect.slot}`;
  }
}

/** One deployment as a creation holds it. */
export interface BuiltChild {
  contractName: string;
  /** The input its deployer coin sits at. */
  inputIndex: number;
  /** The Q ‖ A its unlocking carries, which a settling run replaces with the creator's. */
  binding: { bound?: Uint8Array };
}

/**
 * A5, A14 item 7: the creation's one locktime. A child whose constructor reads a block field needs a height or a time
 * (`children`); the creator's `tx.time` checks need at least their operands, which its run shows at each
 * `OP_CHECKLOCKTIMEVERIFY` it reaches; `extra` are needs an earlier run of the creation showed, its callees'. When only
 * the children constrain the locktime it is item 7's value for their field (`preferred`); otherwise it is the lowest
 * value that satisfies every input, and the constructor reads that. A height against a time is
 * `DeployerLocktimeConflictError`, which names both inputs. A run stops at the first check that fails, so the locktime
 * is raised and the run repeated until every check it reaches has been seen. Returns the locktime and every need.
 */
export function settleCreationLocktime(options: {
  provider: NetworkProvider;
  build: () => { transaction: Transaction; sourceOutputs: Transaction['outputs'] };
  creatorInputIndex: number;
  /** The creator, in words, for a conflict's message. */
  creator: string;
  children: ReadonlyArray<{ need: LocktimeNeed; preferred: number }>;
  extra?: readonly LocktimeNeed[];
  setLocktime: (locktime: number) => void;
}): { locktime: number | undefined; needs: LocktimeNeed[] } {
  const preferred = options.children.length === 0
    ? undefined : Math.max(...options.children.map((child) => child.preferred));
  const ledger = locktimeLedger(options.children.map((child) => child.need), preferred);
  ledger.add(options.extra ?? []);
  for (let round = 0; round < 16; round += 1) {
    if (ledger.locktime !== undefined) options.setLocktime(ledger.locktime);
    const { transaction, sourceOutputs } = options.build();
    const trace = evaluateFaithfulOrDebugTrace(
      options.provider, { transaction, sourceOutputs, inputIndex: options.creatorInputIndex } as never,
    );
    const known = ledger.needs.length;
    ledger.add(locktimeChecks(trace, options.creatorInputIndex, options.creator));
    if (ledger.needs.length === known) break;
  }
  return { locktime: ledger.locktime, needs: ledger.needs };
}

/** The index of the state before the operation a failed run stopped at, or -1 when the run did not fail. */
function failingStep(trace: readonly AuthenticationProgramStateCommon[]): number {
  const failed = trace.findIndex((state) => state.error !== undefined);
  return failed <= 0 ? -1 : failed - 1;
}

/**
 * Run the creator's input of a finished creation until the run settles (A14 item 4 steps 2 and 8). Each deployer site
 * it reaches puts the Q ‖ A it built into that deployment's unlocking; once every site it reaches is bound, the checks
 * that pin its transfers, at its transfer slots and in its runtime loops, name each recipient and amount. A deployment
 * of another contract, or at another input, than the creation holds at that position, or a run that stops before a
 * deployment the creation holds, throws `CreationPlanChanged`. A run that fails inside the checks of a site the
 * creation holds is that site's refusal, and throws `DeployerPrepError`. `learned` says whether the creation needed a
 * value it did not have.
 */
export function settleCreatorRun(options: {
  provider: NetworkProvider;
  build: () => { transaction: Transaction; sourceOutputs: Transaction['outputs'] };
  creatorInputIndex: number;
  children: readonly BuiltChild[];
  /** The contract a site creates: its slot's `new`, which the deployer lock the site checks must agree with. */
  contractOf: (visit: DeployerSiteVisit) => string;
  /** The transfers the creation lays out whose recipients and amounts the run pins. */
  transfers?: readonly RuntimeLoopTransferTarget[];
  /** The runtime effect span the creation lays out: its first output, and its records in output order. */
  effectSpan?: { base: number; effects: readonly RuntimeEffect[] };
  plan: CreationPlan;
}): { visits: DeployerSiteVisit[]; learned: boolean; effects?: RuntimeEffect[] } {
  const shown = (count: number): PlannedChild[] => options.children.slice(0, count).map((child) => ({
    contractName: child.contractName, inputIndex: child.inputIndex, bound: child.binding.bound,
  }));
  let learned = false;
  for (let round = 0; round < 256; round += 1) {
    const { transaction, sourceOutputs } = options.build();
    const trace = evaluateFaithfulOrDebugTrace(
      options.provider, { transaction, sourceOutputs, inputIndex: options.creatorInputIndex } as never,
    );
    const visits = readDeployerSiteVisits(trace);
    let bound = false;
    for (const [index, visit] of visits.entries()) {
      const child = options.children[index];
      const contractName = options.contractOf(visit);
      if (child === undefined || child.contractName !== contractName || child.inputIndex !== visit.inputIndex) {
        throw new CreationPlanChanged({
          ...options.plan,
          children: [...shown(index), { contractName, inputIndex: visit.inputIndex, bound: visit.bound }],
        }, `the creator's run creates '${contractName}' at input ${visit.inputIndex} as deployment ${index}`);
      }
      if (child.binding.bound === undefined || binToHex(child.binding.bound) !== binToHex(visit.bound)) {
        child.binding.bound = visit.bound;
        bound = true;
      }
    }
    if (bound) {
      learned = true;
      continue;
    }
    // The effect verifier holds every record of its run at its first step: another span than the creation's is the
    // run's, laid out by the caller.
    const shownEffects = readRuntimeEffects(trace);
    if (shownEffects !== undefined && options.effectSpan !== undefined) {
      if (shownEffects.base !== options.effectSpan.base) {
        throw new DeployerPrepError(
          `The creator reads its runtime effects from output ${shownEffects.base}, but the creation lays them out from `
          + `output ${options.effectSpan.base}`,
        );
      }
      if (shownEffects.effects.map(effectKey).join() !== options.effectSpan.effects.map(effectKey).join()) {
        return { visits, learned: true, effects: shownEffects.effects };
      }
    }
    let paid = false;
    for (const target of options.transfers ?? []) {
      const count = target.getRuntimeLoopTransferOutputs().length;
      const flags = {
        bytecodesDerived: Array.from({ length: count }, () => false),
        amountsDerived: Array.from({ length: count }, () => false),
        commitmentsDerived: Array.from({ length: count }, () => false),
        capabilitiesDerived: Array.from({ length: count }, () => false),
      };
      const capability = (category: Uint8Array): 'none' | 'mutable' | 'minting' => (
        category[32] === 0x02 ? 'minting' : category[32] === 0x01 ? 'mutable' : 'none');
      if (deriveRuntimeLoopTransfers(target, trace as AuthenticationProgramStateCommon[], flags, capability) > 0) {
        paid = true;
      }
    }
    if (paid) {
      learned = true;
      continue;
    }
    if (visits.length < options.children.length) {
      const last = visits[visits.length - 1];
      const step = failingStep(trace);
      const stopped = step < 0 ? undefined : trace[step];
      if (last !== undefined && stopped !== undefined && stopped.instructions === last.instructions
        && stopped.ip >= last.firstIp && stopped.ip <= (last.lastIp < 0 ? last.firstIp + 5 : last.lastIp)) {
        throw new DeployerPrepError(
          `The creator's deployer site refuses deployment ${visits.length - 1} ('${options.children[visits.length - 1]!
            .contractName}'): ${String(trace[step + 1]?.error)}`,
        );
      }
      throw new CreationPlanChanged(
        { ...options.plan, children: shown(visits.length) },
        `the creator's run creates ${visits.length} of the ${options.children.length} children the creation holds`,
      );
    }
    return { visits, learned };
  }
  throw new DeployerPrepError('The creator\'s run did not settle after 256 runs');
}
