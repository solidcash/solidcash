import { describe, expect, it } from 'vitest';
import { PerCallCallError } from '../../../src/per-call/call/index.js';
import {
  USER_LOCK, compileProject, deployPlain, enterPlain, newWorld, type PlainDeployment, type World,
} from './composition-world.js';

/**
 * Walls ahead: a contract deployed WITHOUT a proxy, entered through the plain call path (`callPerCallEntry`), which
 * is what a project's handle uses for every contract `deployContract` deployed. The hop serves each of these shapes
 * for a proxied root (the ladder's roots are all proxied); the plain path refuses a sweep that transfers what an
 * earlier `balanceOf` returned (an argument from an earlier call's result) by name before anything is built.
 *
 * A vault that pulls a token and credits the depositor (a mapping write beside a call) and a payout that pays two
 * parties through one token (one callee entered twice, each frame writing its nodes) are served
 * (`call/plain-root-calls.test.ts`). The case pins the refusal met today; its title says what should settle once the
 * plain path plans what the hop plans. The file runs only under `PER_CALL_AHEAD=1`.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'interface IToken {',
  '  function transferFrom(address from, address to, uint256 amount) external;',
  '  function transfer(address to, uint256 amount) external;',
  '  function balanceOf(address who) external view returns (uint256);',
  '}',
  'contract Token {',
  '  mapping(address => uint256) internal balances;',
  '  function transferFrom(address from, address to, uint256 amount) external {',
  '    require(balances[from] >= amount, "short");',
  '    balances[from] -= amount;',
  '    balances[to] += amount;',
  '  }',
  '  function transfer(address to, uint256 amount) external {',
  '    require(balances[msg.sender] >= amount, "short");',
  '    balances[msg.sender] -= amount;',
  '    balances[to] += amount;',
  '  }',
  '  function balanceOf(address who) external view returns (uint256) { return balances[who]; }',
  '}',
  'contract Vault {',
  '  IToken public token;',
  '  address public feeTo;',
  '  mapping(address => uint256) public deposits;',
  '  constructor(IToken token_, address feeTo_) { token = token_; feeTo = feeTo_; }',
  '  function deposit(uint256 amount) external {',
  '    token.transferFrom(msg.sender, address(this), amount);',
  '    deposits[msg.sender] += amount;',
  '  }',
  '  function payout(address to, uint256 amount, uint256 fee) external {',
  '    token.transfer(to, amount);',
  '    token.transfer(feeTo, fee);',
  '  }',
  '  function sweep(address to) external {',
  '    uint256 held = token.balanceOf(address(this));',
  '    token.transfer(to, held);',
  '  }',
  '}',
].join('\n');

interface Chain {
  readonly world: World;
  readonly token: PlainDeployment;
  readonly vault: PlainDeployment;
}

let chainRun: Promise<Chain> | undefined;
/** The token and the vault, deployed once as `deployContract` deploys them. */
function chain(): Promise<Chain> {
  chainRun ??= (async (): Promise<Chain> => {
    const artifacts = compileProject(SOURCE);
    const world = await newWorld(0x51);
    const token = await deployPlain(world, artifacts.Token!);
    const vault = await deployPlain(world, artifacts.Vault!, [token.address, USER_LOCK]);
    return { world, token, vault };
  })();
  return chainRun;
}

/** The externals the plain path names its callees by: the deployment's own name. */
const externalsOf = (c: Chain): Record<string, { artifact: PlainDeployment['artifact']; categoryId: string }> => ({
  Token: { artifact: c.token.artifact, categoryId: c.token.categoryId },
});

describe.runIf(process.env.PER_CALL_AHEAD === '1')('ahead: a plain root whose entry calls out (plain call path)', () => {
  it('compiles every entry: the walls below are the plain path\'s, not the compiler\'s', async () => {
    const c = await chain();
    expect(c.vault.artifact.composition?.refusedEntries ?? []).toStrictEqual([]);
  }, 300_000);

  it('refuses a sweep whose transfer amount is an earlier call\'s result (should settle once served)', async () => {
    const c = await chain();
    const outcome = await enterPlain(c.world, c.vault, 'sweep', [USER_LOCK], externalsOf(c));
    expect(outcome.error).toBeInstanceOf(PerCallCallError);
    expect(outcome.error!.message).toMatch(new RegExp('^entry "sweep" makes 2 external call\\(s\\): .* reads an earlier '
      + 'call\'s result, which this call path does not plan yet$'));
    expect(outcome.coinSpent).toBe(false);
  }, 300_000);
});
