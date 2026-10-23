import { describe, expect, it } from 'vitest';
import {
  FrameKind, computeFunctionSelector, computeFunctionSignature, validatorAddress,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { deployMaster } from '../../../src/framed/deploy/index.js';
import {
  createComposedDerivationHost, deriveDepthFirst, participant,
  type CompositionDraftPlan, type DraftMaster,
} from '../../../src/framed/composer/index.js';
import { REAL_VALIDATOR_PROGRAM, seededCategory, validatorSpend } from '../../../../solidc/test/framed/master/validator-input.js';
import { callerUnlockingBytecode } from '../../../../solidc/test/framed/master/caller-input.js';

/**
 * A chain of calls deeper than one hop.
 *
 * Each contract has one entry and calls the next, so every contract runs on one master and each call is an edge
 * the validator binds. The whole shipped path runs; the machine is asked for a verdict on each master's own input,
 * which is where that master's frame, its call edge and its record are checked. The validator input is skipped:
 * its transcript's operation cost over a chain this long exceeds the relaxed profile these tests run under.
 */

const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');
const token = (
  category: Uint8Array,
  capability: 'minting' | 'mutable',
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable'; commitment: Uint8Array } } =>
  ({ category, amount: 0n, nft: { capability, commitment: new Uint8Array(0) } });

const labels = {
  A: 'deep chain a', B: 'deep chain b', C: 'deep chain c', D: 'deep chain d',
} as const;
const category = (label: string): Uint8Array => seededCategory(label);
const address = (label: string): Uint8Array => validatorAddress(category(label), REAL_VALIDATOR_PROGRAM);

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IB { function mid(); }'
  + ' interface IC { function end(); }'
  + ' interface ID { function leaf(); }'
  + ' contract D { function leaf() { require(true); } }'
  + ` contract C { function end() { ID(0x${toHex(address(labels.D))}).leaf.call(); require(true); } }`
  + ` contract B { function mid() { IC(0x${toHex(address(labels.C))}).end.call(); require(true); } }`
  + ` contract A { function start() { IB(0x${toHex(address(labels.B))}).mid.call(); require(true); } }`;

const USER_LOCK = new Uint8Array([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x22), 0x88, 0xac]);

/** One master's identity, target entry and the call data its caller records for it. */
interface Link {
  readonly name: string;
  readonly label: string;
  readonly entry: string;
  readonly next?: string;
}

const LINKS: readonly Link[] = [
  { name: 'A', label: labels.A, entry: 'start', next: 'B' },
  { name: 'B', label: labels.B, entry: 'mid', next: 'C' },
  { name: 'C', label: labels.C, entry: 'end', next: 'D' },
  { name: 'D', label: labels.D, entry: 'leaf' },
];

describe('a chain of four contracts, each calling the next', () => {
  it('settles every master in the chain, accepted by the machine', () => {
    const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
    const selectorOf = (link: Link): Uint8Array =>
      computeFunctionSelector(computeFunctionSignature(link.entry, []));
    const programOf = (link: Link): Uint8Array =>
      deployMaster(artifacts[link.name]!, category(link.label), REAL_VALIDATOR_PROGRAM).script;
    const validator = validatorSpend(category(labels.A), { roots: [0], masters: [0, 2, 3, 4], settles: [] });

    const masters: DraftMaster[] = LINKS.map((link, position) => {
      const next = link.next === undefined ? undefined : LINKS.find((candidate) => candidate.name === link.next)!;
      const calls: DraftMaster['calls'] = next === undefined ? [] : [{
        kind: FrameKind.CALL, callee: `${next.name.toLowerCase()}-1`, target: address(next.label),
        value: 0n, argumentPushes: [selectorOf(next)],
      }];
      const kind = position === 0 ? FrameKind.ROOT : FrameKind.CALL;
      const callerLink = position === 0 ? undefined : LINKS[position - 1]!;
      return {
        master: `${link.name.toLowerCase()}-1`, contract: link.name,
        functionName: `${link.name}.${link.entry}()`, program: programOf(link),
        facts: {
          contract: link.name, functionName: link.entry, kind,
          callerIsUser: position === 0, originEqualsCaller: position === 0,
          makesExternalCall: calls.length > 0, mastersOfContract: 1,
        },
        frame: {
          kind,
          sender: callerLink === undefined ? USER_LOCK : address(callerLink.label),
          self: address(link.label), value: 0n,
        },
        enteredBy: callerLink === undefined ? 'user' : `${callerLink.name.toLowerCase()}-1`,
        origin: 'user', calls, retval: new Uint8Array(0),
        segments: Array.from({ length: calls.length + 1 }, () => []), events: [], sends: [],
        // A caller records the callee's call data, so a callee carries the selector its caller committed to.
        argumentPushes: callerLink === undefined ? [] : [selectorOf(link)],
        redeemScript: programOf(link),
      };
    });

    const plan: CompositionDraftPlan = {
      blocks: [
        { contract: 'A', masters: ['a-1'], validator: { id: 'validator', settles: [] }, state: [] },
        { contract: 'B', masters: ['b-1'], state: [] },
        { contract: 'C', masters: ['c-1'], state: [] },
        { contract: 'D', masters: ['d-1'], state: [] },
      ],
      // The facet the validator binds is one participant ahead of the user.
      userInputs: [{ id: 'user', index: 6 }],
      masters,
      inputs: {
        ...Object.fromEntries(LINKS.map((link) => [`${link.name.toLowerCase()}-1`, {
          source: {
            lockingBytecode: deployMaster(
              artifacts[link.name]!, category(link.label), REAL_VALIDATOR_PROGRAM,
            ).lockingBytecode,
            valueSatoshis: 20_000n, token: token(category(link.label), 'minting'),
          },
        }])),
        validator: { source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(category(labels.A), 'mutable') } },
        user: {
          source: { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
          unlockingBytecode: callerUnlockingBytecode(),
        },
      },
      validator: { id: 'validator', covers: ['B', 'C', 'D'], settles: [], redeemScript: validator.redeem },
    };

    const { host, draft } = createComposedDerivationHost({
      vm: compositionMachine(),
      artifacts: LINKS.map((link) => artifacts[link.name]!),
      plan,
    });
    deriveDepthFirst({ contract: 'A', functionName: 'A.start()', kind: FrameKind.ROOT, master: 'a-1' }, host);

    // The layout places the four masters around the validator and the facet it binds, in entry order.
    expect(LINKS.map((link) => participant(draft.layout, `${link.name.toLowerCase()}-1`).index))
      .toStrictEqual([0, 3, 4, 5]);

    const vm = compositionMachine();
    const rejected = LINK_IDS.map((id) => {
      const program = draft.programFor(id);
      const state = vm.evaluate({
        inputIndex: program.inputIndex, sourceOutputs: program.sourceOutputs, transaction: program.transaction,
      });
      return vm.stateSuccess(state) === true ? undefined : `${id}: ${String(state.error)}`;
    }).filter((entry): entry is string => entry !== undefined);
    expect(rejected).toStrictEqual([]);
  });
});

const LINK_IDS = LINKS.map((link) => `${link.name.toLowerCase()}-1`);
