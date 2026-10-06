import { describe, expect, it } from 'vitest';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { FramedCallResult } from '../../../src/framed/call/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import {
  USER_LOCK, compileFramed, deployPlain, enterPlain, newWorld, refusedVerdicts, type Outcome, type PlainDeployment,
  type World,
} from '../ahead/composition-world.js';

/**
 * A plain root whose loop reads its own calls' results, on the plain call path (`callFramedEntry`).
 *
 * `Board.post` looks each of its labels up through a dictionary's public `mapping(string => string)` getter, one
 * static call per turn of a loop over its argument array, and counts the labels whose value is not empty: the loop's
 * guard reads the result of the very call its turn makes. It requires exactly one, then checks its caller's token
 * balance, pulls the token and notes the post in a log twice. Named two tagged labels, the body makes both lookups
 * and stops on its own `require`, so the call reports that reason and spends nothing. Named one tagged label and one
 * the dictionary does not hold, the post pulls the token, notes itself twice and is read back.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'interface IDict { function tags(string calldata key) external view returns (string memory); }',
  'interface IToken {',
  '  function balanceOf(address account) external view returns (uint256);',
  '  function transferFrom(address from, address to, uint256 value) external returns (bool);',
  '}',
  'interface ILog { function note(uint256 id) external; }',
  'contract Dict {',
  '  mapping(string => string) public tags;',
  '  function set(string calldata key, string calldata value) external { tags[key] = value; }',
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
  '  uint256 public count;',
  '  uint256 public last;',
  '  function note(uint256 id) external { count += 1; last = id; }',
  '}',
  'contract Board {',
  '  IDict public dict;',
  '  IToken public token;',
  '  ILog public log;',
  '  constructor(IDict dict_, IToken token_, ILog log_) { dict = dict_; token = token_; log = log_; }',
  '  function post(string[] calldata labels) external {',
  '    uint256 n = 0;',
  '    for (uint256 i = 0; i < labels.length; i++) {',
  '      if (bytes(dict.tags(labels[i])).length != 0) n++;',
  '    }',
  '    require(n == 1, "Exactly one tagged label");',
  '    require(token.balanceOf(msg.sender) >= 5, "Balance too low");',
  '    token.transferFrom(msg.sender, address(this), 5);',
  '    log.note(7);',
  '    log.note(8);',
  '  }',
  '}',
].join('\n');

const artifacts = compileFramed(SOURCE);

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
/** The board's chain, each deployment plain: two labels tagged with 13-byte values, 100 of the token, 10 allowed. */
function chain(): Promise<Chain> {
  chainRun ??= (async (): Promise<Chain> => {
    const world = await newWorld(0x6d);
    const dict = await deployPlain(world, artifacts.Dict!);
    const token = await deployPlain(world, artifacts.Token!);
    const log = await deployPlain(world, artifacts.Log!);
    const board = await deployPlain(world, artifacts.Board!, [dict.address, token.address, log.address]);
    const c = { world, dict, token, log, board };
    await settle(c, dict, 'set', ['a', 'TAG_VALUE_ONE']);
    await settle(c, dict, 'set', ['b', 'TAG_VALUE_TWO']);
    await settle(c, token, 'mint', [USER_LOCK, 100n]);
    await settle(c, token, 'approve', [board.address, 10n]);
    return c;
  })();
  return chainRun;
}

/** The board's post of `labels`, which reaches the dictionary, the token and the log. */
function post(c: Chain, labels: readonly string[]): Promise<Outcome<FramedCallResult>> {
  return enterPlain(c.world, c.board, 'post', [[...labels]], Object.fromEntries([c.dict, c.token, c.log]
    .map((deployed) => [deployed.artifact.contractName, { artifact: deployed.artifact, categoryId: deployed.categoryId }])));
}

/** A view's value, read from a plain deployment's records and nodes through the read path. */
async function view(c: Chain, deployed: PlainDeployment, functionName: string, args: FunctionArgument[]): Promise<unknown> {
  const read = await readFramedEntry({
    provider: c.world.network, artifact: deployed.artifact, categoryId: deployed.categoryId, functionName, args,
    vm: compositionMachine(),
  });
  expect(read.accepted, read.objection).toBe(true);
  return read.value;
}

describe('a plain root whose loop reads the results of its own calls to a public mapping getter', () => {
  it('reports its own reason for two tagged labels, after both lookups, and spends nothing', async () => {
    const c = await chain();
    const refused = await post(c, ['a', 'b']);
    expect(refused.error).toBeUndefined();
    expect(refused.result!.accepted).toBe(false);
    expect(refused.result!.broadcast).toBeUndefined();
    expect(refused.result!.refusal?.innermost?.master).toBe('master');
    expect(refused.result!.refusal?.innermost?.reason.message).toBe('Exactly one tagged label');
    expect(refused.coinSpent).toBe(false);
  }, 600_000);

  it('settles a post with one tagged label and one absent, pulling the token and noting the post twice', async () => {
    const c = await chain();
    const settled = await post(c, ['a', 'c']);
    expect(settled.error).toBeUndefined();
    expect(refusedVerdicts(settled.result!)).toBeUndefined();
    expect(settled.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(await view(c, c.log, 'count', [])).toBe(2n);
    expect(await view(c, c.log, 'last', [])).toBe(8n);
    expect(await view(c, c.token, 'balanceOf', [USER_LOCK])).toBe(95n);
    expect(await view(c, c.token, 'balanceOf', [c.board.address])).toBe(5n);
  }, 600_000);
});
