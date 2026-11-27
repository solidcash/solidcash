import { describe, expect, it } from 'vitest';
import type { Artifact } from '@solidcash/utils';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import { SignatureTemplate } from '../../../src/index.js';
import { callFramedEntry, type FramedCallResult } from '../../../src/framed/call/index.js';
import { satoshiContainerLockingBytecode } from '../../../src/framed/deploy/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import { alicePriv } from '../../fixture/vars.js';
import {
  USER_LOCK, compileFramed, deployPlain, newWorld, refusedVerdicts, type PlainDeployment, type World,
} from '../ahead/composition-world.js';

/**
 * A typed call carrying value that runs on some paths only, `if (c == 3) i.c{value: v}()`, compiled framed.
 *
 * The call's own record carries the value, as an unconditional one's does (`typed-call-value.test.ts`): the site
 * binds the record's value where the call runs, and a run that skips the call binds no record, which the body's
 * count of the calls it made pins. A branch holding such a call reserves no send for it, so every branch shape
 * compiles; the entry settles with the branch taken and not taken, and the callee receives the value only when it
 * is taken. A plan that states the call on a run that skips it is refused by the caller's own frame.
 */

const shapeSource = (body: string): string => [
  'pragma solidity ^0.8.20;',
  'interface I { function c() external payable; }',
  'contract C {',
  '  I i = I(address(0xcafecafe));',
  '  constructor() payable {}',
  `  function f(uint c) external returns (uint) { ${body} }`,
  '}',
].join('\n');

const SHAPES: [string, string][] = [
  ['an if', 'if (c == 3) i.c{value: 1}(); return 1 + c;'],
  ['an else if arm', 'uint r = 1; if (c == 1) r = 2; else if (c == 3) i.c{value: 1}(); return r + c;'],
  ['an if/else with a plain call in the other arm', 'if (c == 3) i.c{value: 1}(); else i.c(); return 1 + c;'],
  ['an early return before the call', 'if (c != 3) return 1 + c; i.c{value: 1}(); return 1 + c;'],
];

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'interface I { function c() external payable; }',
  'contract Callee {',
  '  uint256 public received;',
  '  function c() external payable { received += msg.value; }',
  '}',
  'contract C {',
  '  I i;',
  '  constructor(address target) { i = I(target); }',
  '  function f(uint256 c) external payable returns (uint256) {',
  '    if (c == 3) i.c{value: 5000}();',
  '    return 1 + c;',
  '  }',
  '}',
].join('\n');

const units = compileFramed(SOURCE);
const FUNDER = new SignatureTemplate(alicePriv).unlockP2PKH();
const VALUE = 5_000n;

interface Chain {
  readonly world: World;
  readonly callee: PlainDeployment;
  readonly root: PlainDeployment;
}

let chainRun: Promise<Chain> | undefined;
/** The callee and the contract that calls it, both deployed without a proxy. */
function chain(): Promise<Chain> {
  chainRun ??= (async (): Promise<Chain> => {
    const world = await newWorld(0x7c);
    const callee = await deployPlain(world, units.Callee!);
    const root = await deployPlain(world, units.C!, [callee.address]);
    return { world, callee, root };
  })();
  return chainRun;
}

/** `f(c)` entered by the user with `VALUE`, planned from `artifact`. */
async function enter(c: Chain, argument: bigint, artifact: Artifact = c.root.artifact): Promise<FramedCallResult> {
  return callFramedEntry({
    provider: c.world.network, artifact, categoryId: c.root.categoryId, functionName: 'f', args: [argument],
    value: VALUE, externals: { Callee: { artifact: c.callee.artifact, categoryId: c.callee.categoryId } },
    callerUtxo: await c.world.userCoin(), callerLockingBytecode: USER_LOCK, funder: FUNDER,
    changeAddress: c.world.changeAddress, vm: compositionMachine(),
  });
}

/** A view's value, read from a plain deployment's records through the read path. */
async function view(
  world: World, deployed: PlainDeployment, functionName: string, args: readonly FunctionArgument[],
): Promise<unknown> {
  const read = await readFramedEntry({
    provider: world.network, artifact: deployed.artifact, categoryId: deployed.categoryId, functionName,
    args: [...args], vm: compositionMachine(),
  });
  expect(read.accepted, read.objection).toBe(true);
  return read.value;
}

/** What a deployment's satoshi containers hold. */
async function containerValue(world: World, deployed: PlainDeployment): Promise<bigint> {
  const held = await world.network.getUtxosForLockingBytecode(satoshiContainerLockingBytecode(deployed.categoryId));
  return held.reduce((sum, utxo) => sum + utxo.satoshis, 0n);
}

/** The callee's recorded value and both contracts' containers. */
async function balances(c: Chain): Promise<readonly [unknown, bigint, bigint]> {
  return [
    await view(c.world, c.callee, 'received', []),
    await containerValue(c.world, c.callee),
    await containerValue(c.world, c.root),
  ];
}

/** The artifact without the call's published condition: a plan from it states the call whatever `c` is. */
function withoutCondition(artifact: Artifact): Artifact {
  const copy = JSON.parse(JSON.stringify(artifact)) as Artifact;
  for (const entry of copy.abi) {
    for (const row of (entry as { externalCalls?: { condition?: unknown; occurrence?: string }[] }).externalCalls ?? []) {
      delete row.condition;
      if (row.occurrence === 'conditional') row.occurrence = 'once';
    }
  }
  for (const entry of copy.composition?.stopSites?.entries ?? []) {
    for (const site of entry.sites.sites) if (site.kind === 'call') delete site.conditional;
  }
  return copy;
}

describe('a framed typed call carrying value on some paths only', () => {
  it.each(SHAPES)('compiles and serves the entry for %s', (_label, body) => {
    const artifacts = compileFramed(shapeSource(body));
    const refused = (artifacts.C!.composition?.refusedEntries ?? []).map((entry) => entry.functionName);
    expect(refused).not.toContain('C.f()');
  });

  it('keeps the value when the branch is not taken, binding no call', async () => {
    const c = await chain();
    const [received, calleeHeld, rootHeld] = await balances(c);
    const result = await enter(c, 2n);
    expect(refusedVerdicts(result)).toBeUndefined();
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(result.value).toBe(3n);
    expect(result.draft.blockOf('master').calls).toHaveLength(0);
    expect(await balances(c)).toStrictEqual([received, calleeHeld, rootHeld + VALUE]);
  }, 600_000);

  it('pays the callee the value when the branch is taken, through the call\'s record', async () => {
    const c = await chain();
    const [received, calleeHeld, rootHeld] = await balances(c);
    const result = await enter(c, 3n);
    expect(refusedVerdicts(result)).toBeUndefined();
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(result.value).toBe(4n);
    expect(result.draft.blockOf('master').calls.map((call) => call.value)).toStrictEqual([VALUE]);
    expect(await balances(c)).toStrictEqual([(received as bigint) + VALUE, calleeHeld + VALUE, rootHeld]);
  }, 600_000);

  it('refuses at the caller a plan that states the call on a run that skips the branch', async () => {
    const c = await chain();
    const before = await balances(c);
    const stated = await enter(c, 2n, withoutCondition(c.root.artifact));
    expect(stated.draft.blockOf('master').calls).toHaveLength(1);
    expect(stated.verdicts.find((verdict) => verdict.id === 'master')?.accepted).toBe(false);
    expect(stated.broadcast).toBeUndefined();
    expect(await balances(c)).toStrictEqual(before);
  }, 600_000);
});
