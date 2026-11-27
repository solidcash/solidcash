// usage: tsx compare-bytecode.mts <worktree-name> <out.json>
// Compile one fixed set (the examples, a direct and a framed counter, an evmCompat ERC20 and SolidPool's pools with
// its config's MiMC library) with one worktree's compiler; run it for two trees and compare sizes and hashes. Read
// SolidPool's sources only from /Code/tornado/bch-next. The 0.51.0 migration notes quote its numbers.
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [tree, outFile] = process.argv.slice(2);
const root = `/Code/cashscript/.worktrees/${tree}`;
const solidc = await import(`${root}/packages/solidc/dist/index.js`);
const utils = await import(`${root}/packages/utils/dist/index.js`);
const { mimcPrecompile } = await import('/Code/tornado/bch-next/scripts/lib/mimc-script.ts');

const results: Record<string, unknown> = { tree, version: solidc.version };
const record = (name: string, artifact: { bytecode: string }): void => {
  const bytes = utils.asmToBytecode(artifact.bytecode) as Uint8Array;
  results[name] = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex').slice(0, 16) };
};
const attempt = (name: string, fn: () => void): void => {
  try { fn(); } catch (error) { results[name] = { error: String((error as Error).message ?? error).slice(0, 200) }; }
};
const relax = (source: string): string => source.replace(/pragma solidcash [^;]*;/, 'pragma solidcash >=0.50.0;');

// The repository's stateless examples.
const examples = `${root}/examples`;
for (const file of readdirSync(examples).filter((f) => f.endsWith('.scash'))) {
  attempt(`example:${file}`, () => record(`example:${file}`,
    solidc.compileString(relax(readFileSync(join(examples, file), 'utf8')), { suppressWarnings: true })));
}

const COUNTER = `pragma solidcash >=0.50.0;
contract Counter {
  int n;
  function inc(int by) public { require(by > 0); this.n = this.n + by; }
}`;
attempt('direct:Counter', () => record('direct:Counter', solidc.compileString(COUNTER, { suppressWarnings: true })));
attempt('framed:Counter', () => record('framed:Counter',
  solidc.compileString(COUNTER, { composition: 'framed', suppressWarnings: true })));

const COIN = `pragma solidity ^0.8.0;
contract Coin {
  mapping(address => uint256) public balanceOf;
  mapping(address => mapping(address => uint256)) public allowance;
  event Transfer(address indexed from, address indexed to, uint256 value);
  function mint(address to, uint256 value) external { balanceOf[to] += value; }
  function approve(address spender, uint256 value) external returns (bool) {
    allowance[msg.sender][spender] = value;
    return true;
  }
  function transferFrom(address from, address to, uint256 value) external returns (bool) {
    allowance[from][msg.sender] -= value;
    balanceOf[from] -= value;
    balanceOf[to] += value;
    emit Transfer(from, to, value);
    return true;
  }
}`;
attempt('evmCompat:Coin', () => record('evmCompat:Coin',
  solidc.compileString(COIN, { evmCompat: true, forceStateful: true, suppressWarnings: true })));

// SolidPool's contracts, with the options its artifacts record and its config's MiMC library.
const pool = `${outFile}.pool-src`;
rmSync(pool, { recursive: true, force: true });
mkdirSync(pool, { recursive: true });
cpSync('/Code/tornado/bch-next/contracts', pool, { recursive: true, filter: (p) => !p.includes('/artifacts') && !p.includes('/test') });
for (const file of readdirSync(pool).filter((f) => f.endsWith('.scash'))) {
  writeFileSync(join(pool, file), relax(readFileSync(join(pool, file), 'utf8')));
}
const poolOptions = {
  enforceFunctionParameterTypes: true, enforceLocktimeGuard: true, enforceFinalRequire: true,
  allowUnsafeOperations: true, commitmentLimit: 128, suppressWarnings: true,
  userLibraries: [{
    name: 'mimc', code: Buffer.from(mimcPrecompile()).toString('hex'),
    abi: { inputs: [{ name: 'pair', type: 'bytes' }], outputs: [{ type: 'bytes32' }] },
  }],
  inlineLibraries: { mimc: true },
};
for (const file of ['BchPool.scash', 'TokenPool.scash', 'BchPoolDeployer.scash', 'TokenPoolDeployer.scash']) {
  attempt(`solidpool:${file}`, () => {
    const map = solidc.compileFileMulti(join(pool, file), poolOptions) as Record<string, { bytecode: string }>;
    for (const [name, artifact] of Object.entries(map)) record(`solidpool:${file}:${name}`, artifact);
  });
}
writeFileSync(outFile, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
