import { describe, expect, it } from 'vitest';
import { compilePerCall, deployPlain, newWorld } from './composition-world.js';

/**
 * Walls ahead: a plain deployment's constructor that writes two mappings, the token constructor that both mints the
 * supply to its deployer and records the deployer as an admin or minter (`_grantRole(...)` beside `_mint(...)`).
 * The genesis plans one collection's sorted writes (`deploy/genesis.ts`, `planConstructorMapping`), so the
 * deployment is refused before any transaction; the same constructor minting alone deploys (control).
 * The file runs only under `PER_CALL_AHEAD=1`.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'contract MintOnly {',
  '  uint256 public supply;',
  '  mapping(address => uint256) internal balances;',
  '  constructor(uint256 initial) { supply = initial; balances[msg.sender] = initial; }',
  '}',
  'contract MintAndAdmin {',
  '  uint256 public supply;',
  '  mapping(address => uint256) internal balances;',
  '  mapping(address => bool) public admins;',
  '  constructor(uint256 initial) { supply = initial; balances[msg.sender] = initial; admins[msg.sender] = true; }',
  '}',
].join('\n');

describe.runIf(process.env.PER_CALL_AHEAD === '1')('ahead: a constructor that writes two mappings', () => {
  it('deploys a constructor that mints only (control)', async () => {
    const world = await newWorld(0x5d);
    const deployed = await deployPlain(world, compilePerCall(SOURCE).MintOnly!, [1_000n]);
    expect(deployed.categoryId).toMatch(/^[0-9a-f]{64}$/);
  }, 600_000);

  it('refuses a constructor that mints and records an admin (should deploy once served)', async () => {
    const world = await newWorld(0x5e);
    await expect(deployPlain(world, compilePerCall(SOURCE).MintAndAdmin!, [1_000n])).rejects.toThrow(
      'the constructor of "MintAndAdmin" writes 2 mapping entry(ies) across 2 collection(s), and this deployment '
      + 'plans one collection\'s sorted writes',
    );
  }, 600_000);
});
