import fs from 'fs';
import path from 'path';
import { compileFile } from '../packages/solidc/src/index.js';
import { formatArtifact } from '../packages/utils/src/index.js';

const sourceDir = '/Code/mistswap/mistswap/contracts';
const fixtureDir = path.resolve('packages/solidcash/test/fixture/mistswap-artifacts');
const fixtures = {
  ERC20Mock: 'mocks/ERC20Mock.sol',
  MasterChef: 'MasterChef.sol',
  SushiToken: 'SushiToken.sol',
  UniswapV2Factory: 'uniswapv2/UniswapV2Factory.sol',
  UniswapV2Pair: 'uniswapv2/UniswapV2Pair.sol',
};

const selected = process.argv.slice(2);
for (const name of selected) {
  if (!(name in fixtures)) throw new Error(`Unknown Mistswap fixture: ${name}`);
}

for (const [name, source] of Object.entries(fixtures)) {
  if (selected.length > 0 && !selected.includes(name)) continue;
  const artifact = compileFile(path.join(sourceDir, source), {
    solidityImportCompat: true,
    ecrecover: 'p2pkh',
    forceStateful: true,
    maximumInputBytes: 100_000,
  });
  delete (artifact as { updatedAt?: string }).updatedAt;
  fs.writeFileSync(path.join(fixtureDir, `${name}.json`), formatArtifact(artifact, 'json'));
}
