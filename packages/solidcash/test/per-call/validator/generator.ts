/**
 * The seeded composition generator.
 *
 * It builds valid compositions from a small grammar (contracts, a call tree, records, events and sends), then applies
 * exactly one mutation from a catalogue — a witness field, a call, a record, a transcript entry, a token — so every
 * generated case has a single deliberate defect. The PRNG is deterministic, so a failure reproduces from its seed.
 *
 * The generator only builds plans; the checks themselves live in the two modules the harness compares.
 */

import { FrameKind, INDEX_NONE, argsHash, encodeArgumentList } from '@solidcash/utils';
import { materialise, planComposition } from './fixture.js';
import { decideBoth } from './harness.js';
import {
  categoryOf,
  contractLockOf,
  seedBytes,
  selectorOf,
  userLockOf,
  type CompositionPlan,
  type Composition,
  type MasterPlan,
  type RecordTouchPlan,
  type SegmentPlan,
  type StateSlotPlan,
  type CreatedSlotPlan,
} from './fixture.js';

/** A deterministic PRNG (mulberry32), so a failing case reproduces from its seed. */
class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(items.length)]!;
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }
}

/** One generated case: a plan and the single mutation applied to the composition it lays out. */
export interface GeneratedCase {
  readonly name: string;
  readonly seed: number;
  readonly plan: CompositionPlan;
  readonly mutation: string;
  readonly mutate: (composition: Composition) => void;
}

interface MasterSpec {
  id: string;
  contract: number;
  kind: number;
  caller: string;
  context: number;
  staticContext: boolean;
  children: string[];
  callKinds: number[];
  callValues: bigint[];
  touches: RecordTouchPlan[][];
  events: number;
  sends: number;
  retval: Uint8Array;
  selector: Uint8Array;
  args: Uint8Array[];
}

/** Builds a random valid plan. */
function randomPlan(rng: Rng, seed: number, index: number): CompositionPlan {
  const contractCount = 2 + rng.int(2);
  const contracts = Array.from({ length: contractCount }, (_, at) => ({
    id: `C${at}`,
    category: categoryOf(`gen-${seed}-${index}-c${at}`),
    masterLock: contractLockOf(seedBytes(`gen-code-${seed}-${index}-c${at}`, 8)),
    stateLock: contractLockOf(seedBytes(`gen-state-${seed}-${index}-c${at}`, 8)),
    eventLock: contractLockOf(seedBytes(`gen-event-${seed}-${index}-c${at}`, 8)),
  }));
  const userId = 'U0';

  const specs: MasterSpec[] = [{
    id: 'M0',
    contract: 0,
    kind: FrameKind.ROOT,
    caller: userId,
    context: 0,
    staticContext: false,
    children: [],
    callKinds: [],
    callValues: [],
    touches: [],
    events: 0,
    sends: 0,
    retval: new Uint8Array(0),
    selector: selectorOf(`gen-${seed}-${index}-m0`),
    args: rng.chance(0.5) ? [seedBytes(`gen-arg-${seed}-${index}-m0`, 1 + rng.int(3))] : [],
  }];

  // A second entry, so root order is a real degree of freedom. It needs a call of its own to be covered: an
  // unreachable second root would leave its callees unwalkable.
  const rootCount = rng.chance(0.5) ? 2 : 1;
  for (let root = 1; root < rootCount; root += 1) {
    specs.push({
      id: `M${specs.length}`,
      contract: rng.int(contractCount),
      kind: FrameKind.ROOT,
      caller: userId,
      context: 0,
      staticContext: false,
      children: [],
      callKinds: [],
      callValues: [],
      touches: [],
      events: 0,
      sends: 0,
      retval: new Uint8Array(0),
      selector: selectorOf(`gen-${seed}-${index}-r${root}`),
      args: [],
    });
    specs[specs.length - 1]!.context = specs[specs.length - 1]!.contract;
  }

  const masterCount = 2 + rng.int(5);
  for (let at = specs.length; at < masterCount + rootCount; at += 1) {
    const parent = specs[rng.int(specs.length)]!;
    const inheritedStatic = parent.staticContext || parent.kind === FrameKind.STATIC;
    const kind = inheritedStatic
      ? FrameKind.STATIC
      : rng.pick([
        FrameKind.CALL, FrameKind.CALL, FrameKind.CREATE, FrameKind.STATIC, FrameKind.DELEGATE, FrameKind.INTERNAL,
      ]);
    let contract: number;
    if (kind === FrameKind.INTERNAL) {
      contract = parent.context;
    } else if (kind === FrameKind.DELEGATE) {
      const candidates = contracts.map((_, candidate) => candidate).filter((candidate) => candidate !== parent.context);
      contract = candidates.length > 0 && rng.chance(0.8) ? rng.pick(candidates) : parent.context;
    } else {
      contract = rng.int(contractCount);
    }
    const passthrough = kind === FrameKind.DELEGATE || kind === FrameKind.INTERNAL;
    const spec: MasterSpec = {
      id: `M${at}`,
      contract,
      kind,
      caller: parent.id,
      context: passthrough ? parent.context : contract,
      staticContext: inheritedStatic || kind === FrameKind.STATIC,
      children: [],
      callKinds: [],
      callValues: [],
      touches: [],
      events: 0,
      sends: 0,
      retval: rng.chance(0.7) ? seedBytes(`gen-ret-${seed}-${index}-m${at}`, 1 + rng.int(2)) : new Uint8Array(0),
      selector: selectorOf(`gen-${seed}-${index}-m${at}`),
      args: rng.chance(0.5) ? [seedBytes(`gen-arg-${seed}-${index}-m${at}`, 1 + rng.int(3))] : [],
    };
    const edgeValue = kind === FrameKind.STATIC || spec.staticContext ? 0n : (rng.chance(0.85) ? 0n : 1_000n);
    parent.children.push(spec.id);
    parent.callKinds.push(kind);
    parent.callValues.push(edgeValue);
    specs.push(spec);
  }

  for (const spec of specs) {
    spec.touches = Array.from({ length: spec.children.length + 1 }, () => []);
    if (!spec.staticContext) {
      if (rng.chance(0.4)) spec.events = 1;
      if (rng.chance(0.3)) spec.sends = 1;
    }
  }

  // Which contracts the validator settles (V8), and which frames run on each contract's records.
  const mastersPerContract = new Map<number, number>();
  for (const spec of specs) mastersPerContract.set(spec.contract, (mastersPerContract.get(spec.contract) ?? 0) + 1);
  const framesOn = new Map<number, MasterSpec[]>();
  for (const spec of specs) {
    const list = framesOn.get(spec.context) ?? [];
    list.push(spec);
    framesOn.set(spec.context, list);
  }
  const settled = new Set<number>();
  for (const [contract, count] of mastersPerContract) if (count >= 2) settled.add(contract);
  for (const spec of specs) {
    if (spec.kind === FrameKind.DELEGATE || spec.kind === FrameKind.INTERNAL) settled.add(spec.context);
  }

  const stateSlots: StateSlotPlan[] = [];
  const createdSlots: CreatedSlotPlan[] = [];
  for (const [contract, frames] of framesOn) {
    const wanted = settled.has(contract) ? 1 + rng.int(2) : (rng.chance(0.5) ? 1 : 0);
    for (let at = 0; at < wanted; at += 1) {
      stateSlots.push({
        id: `S${contract}-${at}`,
        contract: `C${contract}`,
        commitment: seedBytes(`gen-commit-${seed}-${index}-c${contract}-${at}`, 3 + rng.int(4)),
        value: 1_000n + BigInt(rng.int(2_000)),
      });
    }
    if (frames.length > 0 && rng.chance(0.35)) {
      createdSlots.push({
        id: `E${contract}`,
        contract: `C${contract}`,
        commitment: seedBytes(`gen-created-${seed}-${index}-c${contract}`, 3 + rng.int(4)),
        value: 1_000n + BigInt(rng.int(500)),
      });
    }
  }
  if (stateSlots.length === 0) {
    stateSlots.push({
      id: 'member-0',
      contract: 'C0',
      commitment: seedBytes(`gen-commit-${seed}-${index}-fallback`, 4),
      value: 1_500n,
    });
  }

  // The execution order, which decides where a record is created and read.
  const order: MasterSpec[] = [];
  const walk = (spec: MasterSpec): void => {
    order.push(spec);
    for (const childId of spec.children) walk(specs.find((candidate) => candidate.id === childId)!);
  };
  walk(specs[0]!);

  // A created record appears in the last segment of the last frame on its contract, which therefore has a call.
  const created = new Set<string>();
  for (const slot of [...createdSlots]) {
    const contract = Number(slot.contract.slice(1));
    const owner = [...order].reverse()
      .find((spec) => spec.context === contract && spec.children.length > 0 && !spec.staticContext);
    if (owner === undefined) {
      // A created record needs a segment after the first, and a read-only frame cannot create one.
      createdSlots.splice(createdSlots.indexOf(slot), 1);
      continue;
    }
    owner.touches[owner.touches.length - 1]!.push({ slot: slot.id });
    created.add(slot.id);
  }

  const slotsOf = (contract: number): StateSlotPlan[] =>
    stateSlots.filter((slot) => slot.contract === `C${contract}`);

  for (const spec of order) {
    const candidates = slotsOf(spec.context);
    for (const touches of spec.touches) {
      if (candidates.length > 0 && rng.chance(0.6)) {
        const slot = rng.pick(candidates);
        if (spec.staticContext || rng.chance(0.4)) {
          touches.push({ slot: slot.id });
        } else {
          touches.push({
            slot: slot.id,
            viewOut: seedBytes(`${slot.id}-${spec.id}-${touches.length}`, slot.commitment.length),
          });
        }
      }
    }
  }

  // A settled contract must spend at least one of its records, or M cannot state its settlement.
  for (const contract of settled) {
    const mine = slotsOf(contract);
    if (mine.length === 0) {
      stateSlots.push({
        id: `S${contract}-forced`,
        contract: `C${contract}`,
        commitment: seedBytes(`gen-forced-${seed}-${index}-c${contract}`, 4),
        value: 1_200n,
      });
      mine.push(stateSlots[stateSlots.length - 1]!);
    }
    const touched = new Set<string>();
    for (const spec of specs) {
      if (spec.context !== contract) continue;
      for (const touches of spec.touches) for (const touch of touches) touched.add(touch.slot);
    }
    const missing = mine.find((slot) => !touched.has(slot.id));
    const owner = specs.find((spec) => spec.context === contract);
    if (missing !== undefined && owner !== undefined) {
      owner.touches[0]!.push({ slot: missing.id });
    }
  }

  const masters: MasterPlan[] = specs.map((spec) => ({
    id: spec.id,
    contract: `C${spec.contract}`,
    kind: spec.kind,
    caller: spec.caller,
    selector: spec.selector,
    args: spec.args,
    children: spec.children,
    callKinds: spec.callKinds,
    callValues: spec.callValues,
    segments: spec.touches.map((touches): SegmentPlan => ({ touches })),
    events: spec.events,
    sends: spec.sends,
    retval: spec.retval,
  }));

  return {
    contracts,
    users: [{ id: userId, lock: userLockOf(`gen-user-${seed}-${index}`), value: 900_000n }],
    stateSlots,
    createdSlots,
    masters,
    changeUser: userId,
    sendValues: Object.fromEntries(specs.filter((spec) => spec.sends > 0).map((spec) => [spec.id, [1_000n]])),
  };
}

/** The mutation catalogue: each entry is one deliberate defect (or a change that must stay accepted). */
const MUTATIONS: ReadonlyArray<{
  readonly name: string;
  readonly apply: (rng: Rng, composition: Composition) => void;
}> = [
  { name: 'none', apply: () => {} },
  {
    name: 'detached cycle',
    apply: (rng, composition) => {
      // Two read-only declarations of one record read at an input are given the same fabricated view in and out, so
      // they pair with each other while the record's honest declarations still chain and anchor the output. Reading
      // a record without writing it is what makes the pair detachable: nothing else continues from the view the pair
      // leaves, and nothing needs the pair to reach the output. Pairing alone accepts it; connectivity refuses it,
      // because the fabricated pair hangs off no view the spent commitment reaches.
      const byInput = new Map<number, import('@solidcash/utils').RecordEntry[]>();
      for (const block of composition.blocks.values()) {
        for (const segment of block.segments) {
          for (const entry of segment) {
            if (entry.in === INDEX_NONE || entry.out === INDEX_NONE) continue;
            if (entry.viewIn.length !== entry.viewOut.length) continue;
            if (!entry.viewIn.every((byte, at) => byte === entry.viewOut[at])) continue;
            const list = byInput.get(entry.in) ?? [];
            list.push(entry);
            byInput.set(entry.in, list);
          }
        }
      }
      const pair = [...byInput.values()].find((entries) => entries.length >= 2);
      if (pair === undefined) return;
      const fake = seedBytes(`mut-cycle-${rng.int(1000)}`, 4);
      const first = pair[rng.int(pair.length)]!;
      let second = pair[rng.int(pair.length)]!;
      while (second === first) second = pair[rng.int(pair.length)]!;
      first.viewIn = fake;
      first.viewOut = fake;
      second.viewIn = fake;
      second.viewOut = fake;
    },
  },
  {
    name: 'master lock is a loader lock',
    apply: (_rng, composition) => {
      for (const input of composition.inputs) {
        if (input.master === undefined) continue;
        input.lockingBytecode = contractLockOf(seedBytes('loader', 8));
      }
    },
  },
  {
    name: 'witness kind',
    apply: (rng, composition) => {
      const block = pickBlock(rng, composition);
      block.kind = rng.pick([
        FrameKind.ROOT, FrameKind.CALL, FrameKind.STATIC, FrameKind.DELEGATE, FrameKind.INTERNAL, FrameKind.CREATE,
      ]);
    },
  },
  {
    name: 'callerRef',
    apply: (rng, composition) => {
      pickBlock(rng, composition).callerRef = rng.int(composition.inputs.length);
    },
  },
  {
    name: 'originRef',
    apply: (rng, composition) => {
      pickBlock(rng, composition).originRef = rng.int(composition.inputs.length);
    },
  },
  {
    name: 'validatorRef',
    apply: (rng, composition) => {
      pickBlock(rng, composition).validatorRef = rng.chance(0.5) ? INDEX_NONE : rng.int(composition.inputs.length);
    },
  },
  {
    name: 'sender',
    apply: (rng, composition) => {
      pickBlock(rng, composition).sender = seedBytes(`mut-sender-${rng.int(1000)}`, 25);
    },
  },
  {
    name: 'self',
    apply: (rng, composition) => {
      pickBlock(rng, composition).self = seedBytes(`mut-self-${rng.int(1000)}`, 35);
    },
  },
  {
    name: 'value',
    apply: (rng, composition) => {
      const block = pickBlock(rng, composition);
      block.value += 1n;
    },
  },
  {
    name: 'retval',
    apply: (rng, composition) => {
      pickBlock(rng, composition).retval = seedBytes(`mut-retval-${rng.int(1000)}`, 2);
    },
  },
  {
    name: 'call kind',
    apply: (rng, composition) => {
      const call = pickCall(rng, composition);
      if (call !== undefined) {
        call.kind = rng.pick([
          FrameKind.CALL, FrameKind.STATIC, FrameKind.DELEGATE, FrameKind.INTERNAL, FrameKind.CREATE,
        ]);
      }
    },
  },
  {
    name: 'call target',
    apply: (rng, composition) => {
      const call = pickCall(rng, composition);
      if (call !== undefined) call.target = seedBytes(`mut-target-${rng.int(1000)}`, 35);
    },
  },
  {
    name: 'call value',
    apply: (rng, composition) => {
      const call = pickCall(rng, composition);
      if (call !== undefined) call.value += 1n;
    },
  },
  {
    name: 'calleeRef',
    apply: (rng, composition) => {
      const call = pickCall(rng, composition);
      if (call !== undefined) call.calleeRef = rng.int(composition.inputs.length);
    },
  },
  {
    name: 'argsHash',
    apply: (rng, composition) => {
      const call = pickCall(rng, composition);
      if (call !== undefined) call.argsHash = seedBytes(`mut-args-${rng.int(1000)}`, 32);
    },
  },
  {
    name: 'call result',
    apply: (rng, composition) => {
      const call = pickCall(rng, composition);
      if (call !== undefined) call.result = seedBytes(`mut-result-${rng.int(1000)}`, 2);
    },
  },
  {
    name: 'record viewIn',
    apply: (rng, composition) => {
      const entry = pickRecord(rng, composition);
      if (entry !== undefined) entry.viewIn = seedBytes(`mut-viewin-${rng.int(1000)}`, 4);
    },
  },
  {
    name: 'record viewOut',
    apply: (rng, composition) => {
      const entry = pickRecord(rng, composition);
      if (entry !== undefined) entry.viewOut = seedBytes(`mut-viewout-${rng.int(1000)}`, 4);
    },
  },
  {
    name: 'record out',
    apply: (rng, composition) => {
      const entry = pickRecord(rng, composition);
      if (entry !== undefined) entry.out = rng.chance(0.5) ? INDEX_NONE : rng.int(composition.outputs.length);
    },
  },
  {
    name: 'master token capability',
    apply: (rng, composition) => {
      const index = rng.int(composition.inputs.length);
      composition.inputs[index]!.token = { ...composition.inputs[index]!.token, capability: 1 };
    },
  },
  {
    name: 'record input commitment',
    apply: (rng, composition) => {
      const stateInputs = composition.inputs.filter((input) => input.state !== undefined);
      if (stateInputs.length === 0) return;
      const input = stateInputs[rng.int(stateInputs.length)]!;
      input.token = { ...input.token, nftCommitment: seedBytes(`mut-in-${rng.int(1000)}`, 4) };
    },
  },
  {
    name: 'record output commitment',
    apply: (rng, composition) => {
      const indices = composition.outputs
        .map((output, index) => (output.token.hasNft && output.token.capability === 1 ? index : -1))
        .filter((index) => index >= 0);
      if (indices.length === 0) return;
      const index = indices[rng.int(indices.length)]!;
      const output = composition.outputs[index]!;
      composition.outputs[index] = {
        ...output,
        token: { ...output.token, nftCommitment: seedBytes(`mut-out-${rng.int(1000)}`, 4) },
      };
    },
  },
  {
    name: 'event output',
    apply: (rng, composition) => {
      const block = pickBlock(rng, composition);
      if (composition.outputs.length > 0) block.events = [...block.events, rng.int(composition.outputs.length)];
    },
  },
  {
    name: 'send output',
    apply: (rng, composition) => {
      const block = pickBlock(rng, composition);
      if (composition.outputs.length > 0) block.sends = [...block.sends, rng.int(composition.outputs.length)];
    },
  },
  {
    name: 'validator redeem script',
    apply: (rng, composition) => {
      composition.inputs[composition.validatorIndex]!.validator!.redeemScript = seedBytes(`mut-vrs-${rng.int(1000)}`, 16);
    },
  },
  {
    name: 'transcript drops a master',
    apply: (rng, composition) => {
      if (composition.transcript.masters.length === 0) return;
      composition.transcript.masters = composition.transcript.masters
        .filter((_, at) => at !== rng.int(composition.transcript.masters.length));
    },
  },
  {
    name: 'transcript duplicates a master',
    apply: (rng, composition) => {
      if (composition.transcript.masters.length === 0) return;
      composition.transcript.masters = [
        ...composition.transcript.masters,
        composition.transcript.masters[rng.int(composition.transcript.masters.length)]!,
      ];
    },
  },
  {
    name: 'call callees are swapped',
    apply: (rng, composition) => {
      const blocks = [...composition.blocks.values()].filter((block) => block.calls.length >= 1);
      if (blocks.length === 0) return;
      const block = blocks[rng.int(blocks.length)]!;
      if (block.calls.length < 2) {
        const other = pickCall(rng, composition);
        if (other === undefined || other === block.calls[0]) return;
        [block.calls[0]!.calleeRef, other.calleeRef] = [other.calleeRef, block.calls[0]!.calleeRef];
        return;
      }
      const first = rng.int(block.calls.length);
      let second = rng.int(block.calls.length);
      if (second === first) second = (second + 1) % block.calls.length;
      [block.calls[first]!.calleeRef, block.calls[second]!.calleeRef] =
        [block.calls[second]!.calleeRef, block.calls[first]!.calleeRef];
    },
  },
  {
    name: 'an uncalled root presents another address',
    apply: (_rng, composition) => {
      // A root that makes no call has its address referenced by nobody, so only V11 can object.
      const standouts = [...composition.blocks.values()]
        .filter((block) => block.kind === FrameKind.ROOT && block.calls.length === 0);
      if (standouts.length === 0) return;
      standouts[0]!.self = seedBytes('mut-address', 35);
    },
  },
  {
    name: 'a leaf master calls itself',
    apply: (rng, composition) => {
      const entries = [...composition.blocks.entries()];
      const leaf = entries.find(([id, block]) => block.kind !== FrameKind.ROOT && block.calls.length === 0
        && entries.some(([, other]) => other.calls.some((call) => call.calleeRef === composition.masterIndex.get(id))));
      if (leaf === undefined) return;
      const [leafId, leafBlock] = leaf;
      const called = composition.masterIndex.get(leafId);
      const parent = entries.find(([, block]) => block.calls.some((call) => call.calleeRef === called));
      if (parent === undefined) return;
      const [parentId, parentBlock] = parent;
      const input = composition.inputs[composition.masterIndex.get(leafId)!]!;
      parentBlock.calls = parentBlock.calls.filter((call) => call.calleeRef !== called);
      parentBlock.segments = Array.from({ length: parentBlock.calls.length + 1 }, () => []);
      const self = composition.masterIndex.get(leafId)!;
      leafBlock.callerRef = self;
      leafBlock.sender = leafBlock.self;
      leafBlock.calls = [{
        kind: FrameKind.CALL,
        target: leafBlock.self,
        value: 0n,
        calleeRef: self,
        argsHash: argsHash(input.master!.selector, encodeArgumentList(input.master!.args)),
        result: leafBlock.retval,
      }];
      leafBlock.segments = [[], []];
      void parentId;
      void rng;
    },
  },
  {
    name: 'transcript reorders roots',
    apply: (_rng, composition) => {
      composition.transcript.roots = [...composition.transcript.roots].reverse();
    },
  },
  {
    name: 'transcript drops a settle',
    apply: (rng, composition) => {
      if (composition.transcript.settles.length === 0) return;
      composition.transcript.settles = composition.transcript.settles
        .filter((_, at) => at !== rng.int(composition.transcript.settles.length));
    },
  },
  {
    name: 'transcript adds a settle',
    apply: (rng, composition) => {
      const candidates = composition.inputs
        .map((input, index) => (input.state !== undefined && mutableCapability(input.token.capability) ? index : -1))
        .filter((index) => index >= 0);
      if (candidates.length === 0) return;
      const index = candidates[rng.int(candidates.length)]!;
      composition.transcript.settles = [
        ...composition.transcript.settles,
        { category: composition.inputs[index]!.token.category, stateInputs: [index] },
      ];
    },
  },
  {
    name: 'transcript changes a settle state input',
    apply: (rng, composition) => {
      if (composition.transcript.settles.length === 0) return;
      const settled = composition.transcript.settles[rng.int(composition.transcript.settles.length)]!;
      if (settled.stateInputs.length < 2) return;
      settled.stateInputs = [settled.stateInputs[settled.stateInputs.length - 1]!];
    },
  },
];

function mutableCapability(capability: number): boolean {
  return capability === 1;
}

function pickBlock(rng: Rng, composition: Composition): import('@solidcash/utils').WitnessBlock {
  const ids = [...composition.blocks.keys()];
  return composition.blocks.get(ids[rng.int(ids.length)]!)!;
}

function pickCall(rng: Rng, composition: Composition): import('@solidcash/utils').CallRecord | undefined {
  const calls = [...composition.blocks.values()].flatMap((block) => block.calls);
  if (calls.length === 0) return undefined;
  return calls[rng.int(calls.length)]!;
}

function pickRecord(rng: Rng, composition: Composition): import('@solidcash/utils').RecordEntry | undefined {
  const entries = [...composition.blocks.values()].flatMap((block) => block.segments.flat());
  if (entries.length === 0) return undefined;
  return entries[rng.int(entries.length)]!;
}

/** Whether a plan lays out and both models accept it as it stands. */
function isValidComposition(plan: CompositionPlan): boolean {
  try {
    const composition = planComposition(plan);
    const both = decideBoth(materialise(composition), composition.validatorIndex);
    return both.derivation.accepted && both.reference.accepted;
  } catch {
    return false;
  }
}

/** The catalogue's size. Cases cycle through it, so `n * MUTATION_COUNT` cases apply every mutation `n` times. */
export const MUTATION_COUNT = MUTATIONS.length;

/** Generates `count` deterministic cases from one seed. */
export function generateCases(seed: number, count: number): GeneratedCase[] {
  const cases: GeneratedCase[] = [];
  for (let index = 0; index < count; index += 1) {
    // Some shapes the grammar can draw are not valid compositions at all (a contract with two masters whose frames
    // both run on another contract's records has nothing to settle; a second root whose callers are never attached
    // leaves its callees unwalkable). Draw again until the layout accepts the plan *and* both models accept it
    // unmutated, so every compared case is one mutation away from a valid composition.
    let plan: CompositionPlan | undefined;
    for (let attempt = 0; attempt < 24 && plan === undefined; attempt += 1) {
      const candidate = randomPlan(new Rng(seed + index * 7919 + attempt * 2654435761), seed, index);
      if (isValidComposition(candidate)) plan = candidate;
    }
    if (plan === undefined) throw new Error(`seed ${seed} case ${index}: no valid plan after 24 attempts`);
    const mutation = MUTATIONS[index % MUTATIONS.length]!;
    const mutationRng = new Rng((seed ^ 0x9e3779b9) + index * 104729);
    cases.push({
      name: `seed ${seed} case ${index} (${mutation.name})`,
      seed: seed + index * 7919,
      plan,
      mutation: mutation.name,
      mutate: (composition: Composition) => mutation.apply(mutationRng, composition),
    });
  }
  return cases;
}

export { FrameKind };
