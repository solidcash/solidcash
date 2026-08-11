import { compileFile } from '../packages/solidc/src/index.js';

const sourceRoot = process.argv[2]
  ?? '/Code/cashscript/.worktrees/effectiveacceleration-marketplace/examples/effectiveacceleration/contracts-scash';

for (const name of ['MarketplaceDataV1', 'MarketplaceV1']) {
  const artifact = compileFile(`${sourceRoot}/${name}.scash`, {
    forceStateful: true,
    maximumInputBytes: 1_000_000,
    optimizeForCompilationSpeed: true,
  });
  console.log(JSON.stringify({
    name,
    debugBytes: (artifact.debug?.bytecode.length ?? 0) / 2,
    releaseBytes: artifact.bytecode.length / 2,
  }));
}
