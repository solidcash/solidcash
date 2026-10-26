import { defineConfig } from '@solidcash/solidhat/config';

export default defineConfig({
  paths: {
    contracts: 'contracts',
    tests: 'test',
    artifacts: 'artifacts',
    cache: 'cache',
  },
  compiler: {
    evmCompat: true,
    messageBus: true,
    messageBusKernel: true,
    messageBusGraphContext: true,
    tagSingletonDataNfts: true,
    allowUnsafeOperations: true,
    forceStateful: true,
    commitmentLimit: 128,
    suppressWarnings: true,
    // The pair opts into the bus lowering. `UniswapV2ERC20 > transferFrom > decrements a finite allowance and
    // transfers` fails here (13/14) when the planner publishes the ternary's preserve arm for an undecidable
    // condition, so that suite is the regression for the pair-route value resolution.
    // `TestERC20` is opted out: it now gains a route (its `_transfer` helper is inlined), but a direct pair call
    // that reaches a route-compiled token adds the token's logical-identity anchor after the pair's own block,
    // and the pair's `mint` spend fails its input-16 anchor check. Opting the test token out keeps the measured
    // direct model; the mixed direct/route anchor layout is a separate blocker.
    messageBusByContract: { UniswapV2Pair: true, SushiSwapPair: true, TestERC20: false },
  },
  composition: 'direct',
  typegen: { jsonArtifactModules: true, targets: [{ target: 'ethers6', layout: 'typechain', outDir: 'typechain-types', sourceDir: 'contracts' }] },
  mnemonic: 'rebuild always symbol rabbit sunset napkin laundry diary doll chalk valid train',
  accounts: { path: "m/44'/60'/0'/0", count: 20, initialIndex: 0, satoshis: 100_000_000n },
  networks: { mock: { type: 'mock', consensus: { operationCostBudgetPerByte: 1_000_000, maximumInputBytes: 10_000_000, maximumNftCommitmentBytes: 128, maximumTransactionBytes: 100_000_000 }, policy: { enforceDust: false } } },
  defaultNetwork: 'mock',
});
