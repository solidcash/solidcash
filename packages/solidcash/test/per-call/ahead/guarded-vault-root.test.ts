import { describe, expect, it } from 'vitest';
import {
  USER_LOCK, compilePerCall, deployPlain, deployProxied, enterPlain, enterProxied, newWorld, recordMet,
  refusedVerdicts, type Outcome, type PlainDeployment, type ProxiedDeployment, type World,
} from './composition-world.js';
import type { PerCallProxyCallResult } from '../../../src/per-call/proxy/index.js';

/**
 * Walls ahead: the guards an OpenZeppelin vault stacks on a token pull, on a ROOT behind its proxy: an owner, a
 * pause flag, and a reentrancy status written before the call and cleared after it (`nonReentrant`), around a pull
 * whose target is a stored token address and a credit to the depositor's mapping entry.
 *
 * The reentrancy status is the root's own data record written in two segments, the one before the call and the
 * one after it, and it ends where it started (1 -> 2 -> 1). The compiler publishes both landings, but the hop decides
 * whether the implementation frame writes a record by comparing the record's end commitment with its start
 * (`proxy/deploy.ts`, `writes`, beside `recordLandings`), so a record the body restores is declared kept in every
 * segment; the settle then learns its mid-body view into the one written slot, then the end view back, and runs out
 * of attempts. A callee frame decides the same from the published write facts and is served (the escrow guards of
 * the ladder). The variants split the shape: the pull and the credit alone settle, the pause check settles, and
 * every variant that carries the status write around the call does not.
 * The file runs only under `PER_CALL_AHEAD=1`.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'interface IToken { function transferFrom(address from, address to, uint256 amount) external; }',
  'contract Token {',
  '  uint256 public supply;',
  '  mapping(address => uint256) internal balances;',
  '  function mint(address to, uint256 amount) external { supply += amount; balances[to] += amount; }',
  '  function transferFrom(address from, address to, uint256 amount) external {',
  '    require(balances[from] >= amount, "short");',
  '    balances[from] -= amount;',
  '    balances[to] += amount;',
  '  }',
  '}',
  'contract Vault {',
  '  address public implementation;',
  '  address public owner;',
  '  bool public paused;',
  '  uint256 private status;',
  '  IToken public token;',
  '  mapping(address => uint256) public deposits;',
  '  modifier onlyOwner() { require(msg.sender == owner, "not owner"); _; }',
  '  modifier whenNotPaused() { require(!paused, "paused"); _; }',
  '  modifier nonReentrant() { require(status != 2, "reentrant"); status = 2; _; status = 1; }',
  '  function initialize(address owner_, IToken token_) public { owner = owner_; token = token_; status = 1; }',
  '  function setPaused(bool paused_) external onlyOwner { paused = paused_; }',
  '  function depositPlain(uint256 amount) external {',
  '    token.transferFrom(msg.sender, address(this), amount);',
  '    deposits[msg.sender] += amount;',
  '  }',
  '  function depositPaused(uint256 amount) external whenNotPaused {',
  '    token.transferFrom(msg.sender, address(this), amount);',
  '    deposits[msg.sender] += amount;',
  '  }',
  '  function pullGuarded(uint256 amount) external nonReentrant {',
  '    token.transferFrom(msg.sender, address(this), amount);',
  '  }',
  '  function deposit(uint256 amount) external nonReentrant whenNotPaused {',
  '    token.transferFrom(msg.sender, address(this), amount);',
  '    deposits[msg.sender] += amount;',
  '  }',
  '}',
].join('\n');

interface Chain { readonly world: World; readonly token: PlainDeployment; readonly vault: ProxiedDeployment }
let chainRun: Promise<Chain> | undefined;
function chain(): Promise<Chain> {
  chainRun ??= (async (): Promise<Chain> => {
    const artifacts = compilePerCall(SOURCE);
    const world = await newWorld(0x5c);
    const token = await deployPlain(world, artifacts.Token!);
    const vault = await deployProxied(world, artifacts.Vault!, [USER_LOCK, token.address]);
    return { world, token, vault };
  })();
  return chainRun;
}

async function enter(entry: string): Promise<Outcome<PerCallProxyCallResult>> {
  const { world, token, vault } = await chain();
  const outcome = await enterProxied(world, vault, entry, [10n], {
    Token: { artifact: token.artifact, categoryId: token.categoryId },
  });
  recordMet(`guarded-vault-root/${entry}`, outcome.error?.message
    ?? (outcome.result === undefined ? undefined
      : refusedVerdicts(outcome.result) ?? `accepted broadcast=${outcome.result.broadcast?.txid ?? 'none'}`));
  return outcome;
}

function expectSettled(outcome: Outcome<PerCallProxyCallResult>): void {
  expect(outcome.error).toBeUndefined();
  expect(refusedVerdicts(outcome.result!)).toBeUndefined();
  expect(outcome.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
}

const EXHAUSTED = (entry: string): RegExp =>
  new RegExp(`^the implementation's "${entry}" entry did not settle through the proxy in \\d+ attempts`);

describe.runIf(process.env.PER_CALL_AHEAD === '1')('ahead: an owner-, pause- and reentrancy-guarded proxied root', () => {
  it('mints the user tokens (setup, plain root)', async () => {
    const { world, token } = await chain();
    const outcome = await enterPlain(world, token, 'mint', [USER_LOCK, 100n]);
    expect(outcome.error).toBeUndefined();
    expect(refusedVerdicts(outcome.result!)).toBeUndefined();
  }, 600_000);

  it('settles the pull and the credit with no guard (control)', async () => {
    expectSettled(await enter('depositPlain'));
  }, 600_000);

  it('settles the pull and the credit behind the pause check (control)', async () => {
    expectSettled(await enter('depositPaused'));
  }, 600_000);

  it('does not settle a pull behind nonReentrant alone (should settle once served)', async () => {
    const outcome = await enter('pullGuarded');
    expect(outcome.error?.message).toMatch(EXHAUSTED('pullGuarded'));
    expect(outcome.coinSpent).toBe(false);
  }, 600_000);

  it('does not settle the guarded deposit (should settle once served)', async () => {
    const outcome = await enter('deposit');
    expect(outcome.error?.message).toMatch(EXHAUSTED('deposit'));
    expect(outcome.coinSpent).toBe(false);
  }, 600_000);
});
