import { describe, expect, it } from 'vitest';
import { compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { PerCallCallResult } from '../../../src/per-call/call/index.js';
import { readPerCallEntry } from '../../../src/per-call/read/index.js';
import {
  USER_LOCK, compilePerCall, deployPlain, enterPlain, newWorld, refusedVerdicts, type Outcome, type PlainDeployment,
  type World,
} from '../ahead/composition-world.js';

/**
 * A plain root that reverts between the calls of a loop and the calls after it, on the plain call path
 * (`callPerCallEntry`).
 *
 * `Board.post` looks each of its labels up in a dictionary, one static call per turn of a loop over its argument array,
 * counts the labels the dictionary tags and requires exactly one. Only then does it pull a token from its caller and
 * record the post in a log, so the plan states those calls too. Named two tagged labels, the body makes both lookups
 * and stops on its own `require`, which never makes the pull or the record: the frames the plan states for them close
 * nothing, and the derivation still runs the root to its check, so the call reports that reason and spends nothing.
 * Named one tagged label, the post pulls the token, records itself and is read back.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'interface IDict { function lookup(string calldata key) external view returns (string memory); }',
  'interface IToken { function transferFrom(address from, address to, uint256 value) external returns (bool); }',
  'interface ILog { function record(uint256 id) external; }',
  'contract Dict {',
  '  mapping(string => string) private entries;',
  '  function set(string calldata key, string calldata value) external { entries[key] = value; }',
  '  function lookup(string calldata key) external view returns (string memory) { return entries[key]; }',
  '}',
  'contract Token {',
  '  mapping(address => uint256) private balances;',
  '  mapping(address => mapping(address => uint256)) private allowances;',
  '  function mint(address to, uint256 value) external { balances[to] += value; }',
  '  function balanceOf(address account) external view returns (uint256) { return balances[account]; }',
  '  function approve(address spender, uint256 value) external returns (bool) {',
  '    allowances[msg.sender][spender] = value;',
  '    return true;',
  '  }',
  '  function transferFrom(address from, address to, uint256 value) external returns (bool) {',
  '    uint256 allowed = allowances[from][msg.sender];',
  '    require(allowed >= value, "Allowance too low");',
  '    allowances[from][msg.sender] = allowed - value;',
  '    uint256 held = balances[from];',
  '    require(held >= value, "Balance too low");',
  '    balances[from] = held - value;',
  '    balances[to] += value;',
  '    return true;',
  '  }',
  '}',
  'contract Log {',
  '  mapping(address => uint256) public lastOf;',
  '  function record(uint256 id) external { lastOf[msg.sender] = id; }',
  '}',
  'contract Board {',
  '  IDict public dict;',
  '  IToken public token;',
  '  ILog public log;',
  '  constructor(IDict dict_, IToken token_, ILog log_) { dict = dict_; token = token_; log = log_; }',
  '  function post(string[] calldata labels) external {',
  '    uint256 n = 0;',
  '    for (uint256 i = 0; i < labels.length; i++) {',
  '      if (bytes(dict.lookup(labels[i])).length != 0) n++;',
  '    }',
  '    require(n == 1, "Only one tagged label");',
  '    token.transferFrom(msg.sender, address(this), 5);',
  '    log.record(7);',
  '  }',
  '}',
].join('\n');

const artifacts = compilePerCall(SOURCE);

interface Chain {
  readonly world: World;
  readonly dict: PlainDeployment;
  readonly token: PlainDeployment;
  readonly log: PlainDeployment;
  readonly board: PlainDeployment;
}

/** One entry of `root` that has to settle, entered by the user. */
async function settle(c: Chain, root: PlainDeployment, functionName: string, args: FunctionArgument[]): Promise<void> {
  const outcome = await enterPlain(c.world, root, functionName, args);
  expect(outcome.error).toBeUndefined();
  expect(refusedVerdicts(outcome.result!)).toBeUndefined();
}

let chainRun: Promise<Chain> | undefined;
/** The board's chain, each deployment plain: two tagged labels, and 100 of the token, 10 of them allowed the board. */
function chain(): Promise<Chain> {
  chainRun ??= (async (): Promise<Chain> => {
    const world = await newWorld(0x5c);
    const dict = await deployPlain(world, artifacts.Dict!);
    const token = await deployPlain(world, artifacts.Token!);
    const log = await deployPlain(world, artifacts.Log!);
    const board = await deployPlain(world, artifacts.Board!, [dict.address, token.address, log.address]);
    const c = { world, dict, token, log, board };
    await settle(c, dict, 'set', ['a', 'TAG_A']);
    await settle(c, dict, 'set', ['b', 'TAG_B']);
    await settle(c, token, 'mint', [USER_LOCK, 100n]);
    await settle(c, token, 'approve', [board.address, 10n]);
    return c;
  })();
  return chainRun;
}

/** The board's post of `labels`, which reaches the dictionary, the token and the log. */
function post(c: Chain, labels: readonly string[]): Promise<Outcome<PerCallCallResult>> {
  return enterPlain(c.world, c.board, 'post', [[...labels]], Object.fromEntries([c.dict, c.token, c.log]
    .map((deployed) => [deployed.artifact.contractName, { artifact: deployed.artifact, categoryId: deployed.categoryId }])));
}

/** A view's value, read from a plain deployment's records and nodes through the read path. */
async function view(c: Chain, deployed: PlainDeployment, functionName: string, args: FunctionArgument[]): Promise<unknown> {
  const read = await readPerCallEntry({
    provider: c.world.network, artifact: deployed.artifact, categoryId: deployed.categoryId, functionName, args,
    vm: compositionMachine(),
  });
  expect(read.accepted, read.objection).toBe(true);
  return read.value;
}

describe('a plain root that reverts between the calls of its loop and the calls after it', () => {
  it('reports its own reason for two tagged labels, after both lookups, and spends nothing', async () => {
    const c = await chain();
    const refused = await post(c, ['a', 'b']);
    expect(refused.error).toBeUndefined();
    expect(refused.result!.accepted).toBe(false);
    expect(refused.result!.broadcast).toBeUndefined();
    expect(refused.result!.refusal?.innermost?.master).toBe('master');
    expect(refused.result!.refusal?.innermost?.reason.message).toBe('Only one tagged label');
    expect(refused.coinSpent).toBe(false);
  }, 600_000);

  it('settles a post with one tagged label, pulling the token and recording the post', async () => {
    const c = await chain();
    const settled = await post(c, ['a']);
    expect(settled.error).toBeUndefined();
    expect(refusedVerdicts(settled.result!)).toBeUndefined();
    expect(settled.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(await view(c, c.log, 'lastOf', [c.board.address])).toBe(7n);
    expect(await view(c, c.token, 'balanceOf', [USER_LOCK])).toBe(95n);
    expect(await view(c, c.token, 'balanceOf', [c.board.address])).toBe(5n);
  }, 600_000);
});
