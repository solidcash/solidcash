import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callFramedEntry } from '../../../src/framed/call/index.js';
import { fundShippedFacets } from '../shapes/harness.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';

/**
 * spec section 23 row 12: struct and array arguments and returns with dynamic members, `uint16[5]` and
 * `uint256[5]`.
 *
 * Every entry is driven through the shipped call path: the shipped compiler under the framed convention, the
 * shipped deployment, the shipped `callFramedEntry` (which encodes each argument with the shipped
 * `encodeFunctionArgument` and decodes the entry's answer with the shipped `decodeReturnValues`), and the
 * BCH-2026 machine's verdict on every participant. A shape the path does not serve is pinned by the refusal it
 * meets, so a case is a regression guard either way. Each shape is its own contract, so a refused shape leaves
 * the served ones running.
 */

/** A contract deployed once and entered by a fresh caller coin each case. */
interface Deployed {
  readonly provider: MockNetworkProvider;
  readonly categoryId: string;
  readonly callerLock: Uint8Array;
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
}

let nonce = 0;

async function deployedFor(artifact: Artifact): Promise<Deployed> {
  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
  nonce += 1;
  const fundingUtxo = { txid: `${nonce.toString(16).padStart(2, '0')}`.repeat(32), vout: 0, satoshis: 500_000n };
  await provider.addUtxo(funder.address, fundingUtxo);
  await fundShippedFacets(provider);
  const deployment = await deployStatefulContract(artifact, [], {
    provider, fundingUtxo, funder: funder.unlock.spend(alicePub, signature), changeAddress: funder.address,
  });
  return {
    provider, categoryId: deployment.categoryId, callerLock: encodeLockingBytecodeP2pkh(alicePkh),
    funder: signature.unlockP2PKH(),
  };
}

/** What entering one shape produced: the entry's decoded answer, or the name of the refusal it met. */
interface Entered {
  readonly answer?: readonly unknown[];
  readonly refusal?: string;
}

/**
 * Compiles one shape's source, deploys it, and enters its entry through the shipped call path. A shape the
 * compiler refuses is reported by its published reason; a shape the path refuses when entered reports the
 * objection of the refused participants.
 */
async function enter(source: string, functionName: string, args: readonly unknown[]): Promise<Entered> {
  let artifact: Artifact;
  try {
    artifact = compileStringMulti(source, { composition: 'framed' }).Answer!;
  } catch (error) {
    return { refusal: String((error as Error).message) };
  }
  const refusals = artifact.composition?.refusedEntries ?? [];
  const refused = refusals.find((each) => each.functionName.includes(functionName));
  if (refused !== undefined) return { refusal: `${refused.functionName}: ${refused.reason}` };

  const deployed = await deployedFor(artifact);
  nonce += 1;
  const callerUtxo = { txid: `${nonce.toString(16).padStart(2, '0')}`.repeat(32), vout: 0, satoshis: 300_000n };
  await deployed.provider.addUtxo(binToHex(deployed.callerLock), callerUtxo);
  const result = await callFramedEntry({
    provider: deployed.provider,
    artifact,
    categoryId: deployed.categoryId,
    functionName,
    args: args as never,
    callerUtxo,
    callerLockingBytecode: deployed.callerLock,
    funder: deployed.funder,
    vm: compositionMachine(),
  });
  const refusedVerdicts = result.verdicts.filter((verdict) => !verdict.accepted)
    .map((verdict) => `${verdict.id}: ${verdict.objection ?? 'refused'}`);
  if (!result.accepted) return { refusal: refusedVerdicts.join('; ') || 'refused' };
  return { answer: [...result.values] };
}

/** One shape: a source with the entry, its name, its arguments, and the answer the entry returns. */
interface Shape {
  readonly label: string;
  readonly source: string;
  readonly functionName: string;
  readonly args: readonly unknown[];
  readonly expected: readonly unknown[];
}

/**
 * Wraps an entry body in the contract whose public marker makes the entry a state-writing root. A second entry is
 * present because a user's frame leads its call data with a selector only when the master has more than one body
 * to dispatch over, and `this.marker` is the write the entry settles.
 */
const contract = (extraFields: string, entryBody: string): string => 'pragma solidcash ^0.14.0;'
  + ' struct Note { string label; int amount; }'
  + ' contract Answer {'
  + '   int public marker;'
  + extraFields
  + `   ${entryBody}`
  + '   function ping() view returns (int) { return this.marker; }'
  + ' }';

const SHAPES: readonly Shape[] = [
  {
    label: 'uint16[5] argument and return',
    functionName: 'fixed16',
    source: contract('', 'function fixed16(uint16[5] xs) returns (uint16[5]) '
      + '{ this.marker = this.marker + 1; return xs; }'),
    args: [[1n, 2n, 3n, 4n, 5n]],
    expected: [[1n, 2n, 3n, 4n, 5n]],
  },
  {
    label: 'uint256[5] argument and return',
    functionName: 'fixed256',
    source: contract('', 'function fixed256(uint256[5] xs) returns (uint256[5]) '
      + '{ this.marker = this.marker + 1; return xs; }'),
    args: [[11n, 22n, 33n, 44n, 55n]],
    expected: [[11n, 22n, 33n, 44n, 55n]],
  },
  {
    label: 'struct with a dynamic string member, in and out',
    functionName: 'wrap',
    source: contract('', 'function wrap(Note n) returns (Note) { this.marker = this.marker + 1; return n; }'),
    args: [{ label: 'hi', amount: 3n }],
    expected: [{ label: 'hi', amount: 3n }],
  },
  {
    label: 'dynamic array argument and return',
    functionName: 'sum',
    source: contract('', 'function sum(int[] xs) returns (int) {'
      + ' this.marker = this.marker + 1;'
      + ' int s = 0;'
      + ' for (int i = 0; i < xs.length; i = i + 1) { s = s + xs[i]; }'
      + ' return s; }'),
    args: [[4n, 5n, 6n]],
    expected: [15n],
  },
  {
    label: 'struct with a dynamic bytes member, in and out',
    functionName: 'echo',
    source: contract('struct Payload { int id; bytes body; }',
      'function echo(Payload p) returns (Payload) { this.marker = this.marker + 1; return p; }'),
    args: [{ id: 7n, body: new Uint8Array(80).fill(0xaa) }],
    expected: [{ id: 7n, body: new Uint8Array(80).fill(0xaa) }],
  },
  {
    label: 'dynamic array argument with a dynamic array return',
    functionName: 'double',
    source: contract('', 'function double(uint16[] xs) returns (uint16[]) {'
      + ' this.marker = this.marker + 1;'
      + ' uint16[] r;'
      + ' for (int i = 0; i < xs.length; i = i + 1) { r.push(xs[i] * 2); }'
      + ' return r; }'),
    args: [[31n, 32n, 33n]],
    expected: [[62n, 64n, 66n]],
  },
];

describe('spec section 23 row 12: struct and array arguments and returns with dynamic members', () => {
  for (const shape of SHAPES) {
    it(`${shape.label}: served, so the entry reads what was passed and answers it back`, async () => {
      const entered = await enter(shape.source, shape.functionName, shape.args);
      expect(entered.refusal).toBeUndefined();
      expect(entered.answer).toStrictEqual(shape.expected);
    }, 120_000);
  }

  it('a uint16[5] argument built from JS numbers packs the same elements as bigints', async () => {
    const entered = await enter(contract('', 'function fixed16(uint16[5] xs) returns (uint16[5]) '
      + '{ this.marker = this.marker + 1; return xs; }'), 'fixed16', [[1, 2, 3, 4, 5]]);
    expect(entered.refusal).toBeUndefined();
    expect(entered.answer).toStrictEqual([[1n, 2n, 3n, 4n, 5n]]);
  }, 120_000);

  it('uint16[5] computed by the entry is carried back as its own return', async () => {
    const entered = await enter(contract('', 'function list() returns (uint16[5]) {'
      + ' this.marker = this.marker + 1; return [11, 22, 33, 44, 55]; }'), 'list', []);
    expect(entered.refusal).toBeUndefined();
    expect(entered.answer).toStrictEqual([[11n, 22n, 33n, 44n, 55n]]);
  }, 120_000);
});
