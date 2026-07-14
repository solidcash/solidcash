import { compileFile } from '/Code/cashscript/packages/solidc/dist/index.js';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// The solidity-by-example corpus lives OUTSIDE this repo - we keep ONLY the bench harness here. Default corpus
// location is a sibling checkout at ../solidity-by-example; override with the SBE_ROOT env var. The exact upstream
// commit is pinned in SBE_SOURCE.md next to this file. The corpus is compiled AS-IS (correctness, not porting -
// no source interventions).
const here = dirname(fileURLToPath(import.meta.url));
const SBE_ROOT = process.env.SBE_ROOT || join(here, '..', '..', '..', 'solidity-by-example');
const ROOT = join(SBE_ROOT, 'contracts', 'src');
if (!existsSync(ROOT)) {
  console.error(`solidity-by-example corpus not found at ${ROOT}.\n`
    + 'Check out the pinned corpus next to this repo (see examples/solidity-by-example/SBE_SOURCE.md):\n'
    + '  git clone -b gh-pages https://github.com/solidity-by-example/solidity-by-example.github.io '
    + '../solidity-by-example\n'
    + '  git -C ../solidity-by-example checkout 5bcdca0239409d7336a07b66a6fca8d0bcc710e6\n'
    + 'Or set SBE_ROOT to an existing checkout.');
  process.exit(1);
}
const files = execSync(`find ${ROOT} -name '*.sol'`).toString().trim().split('\n').sort();

// Out of scope for the BCH port - EXCLUDED from the bench denominator (kept in the corpus, NOT deleted).
// Two reasons: (1) contracts that INTERACT WITH SPECIFIC CONTRACTS ALREADY DEPLOYED ON ETHEREUM MAINNET
// (Uniswap V2/V3, DAI/MakerDAO, Chronicle, Chainlink, USDC/USDT/WETH) whose counterparty does not exist on
// Bitcoin Cash; (2) contracts that demonstrate EVM VM internals (storage-slot layout via Yul) with no BCH VM
// analogue. Contracts that take their counterparties as params/ctor-args (the generic AMMs, staking, vaults,
// uniswap-v3-flash which takes `_pool`) stay IN - they are portable (deploy your own counterparty).
const EXCLUDED = new Set([
  // Interface.sol / Chainlink.sol / UniswapV2SwapExamples.sol are now IN scope: they take their counterparty as a
  // param / ctor-arg, so they are portable (deploy your own counterparty on BCH) and compile.
  'defi/chronicle-price-oracle/chroniclePriceOracle.sol',        // Chronicle oracle + SelfKisser
  'defi/dai-proxy/DaiProxy.sol',                                 // DAI + MakerDAO CDP manager / proxy registry
  'defi/uniswap-v2-add-remove-liquidity/UniswapV2Liquidity.sol', // Uniswap V2 router/factory + WETH/USDT
  'defi/uniswap-v2-flash-swap/UniswapV2FlashSwap.sol',           // Uniswap V2 factory/pair + DAI/WETH
  'defi/uniswap-v2-optimal-one-sided-supply/Optimal.sol',        // Uniswap V2 factory/router + WETH
  'defi/uniswap-v3-flash-swap/UniswapV3FlashSwap.sol',           // Uniswap V3 SwapRouter02
  'defi/uniswap-v3-liquidity/UniswapV3Liquidity.sol',            // Uniswap V3 NonfungiblePositionManager + DAI/WETH
  'defi/uniswap-v3-swap/UniswapV3SingleHopSwap.sol',             // Uniswap V3 SwapRouter02 + DAI/WETH
  'defi/uniswap-v3-swap/UniswapV3MultiHopSwap.sol',              // Uniswap V3 SwapRouter02 + DAI/USDC/WETH
  // EVM storage-slot VM internals demo (Yul sstore/sload with slot packing / bit masking). Demonstrates the
  // EVM storage model itself, which has no BCH VM analogue (BCH has no addressable contract storage slots).
  'evm/storage/EVMStorage.sol',
]);

// NEGATIVE examples: Solidity source that is DELIBERATELY uncompilable (teaches a compile error).
// Real solc rejects these too, so SolidCash correctly rejecting them is parity, not a gap. Excluded
// from the denominator as they are not valid-Solidity compile targets.
const NEGATIVE = new Set([
  'inheritance/Inheritance.sol',   // `contract F is A, B` with `B is A` - unlinearizable (C3); the file's
                                   // own comment: "Swapping the order of A and B will throw a compilation error"
]);

// silence the compiler's advisory console output during compilation
const origLog = console.log, origErr = console.error;
const mute = () => { console.log = () => {}; console.error = () => {}; };
const unmute = () => { console.log = origLog; console.error = origErr; };

const results = [];
for (const f of files) {
  const rel = f.replace(ROOT + '/', '');
  if (EXCLUDED.has(rel)) { results.push({ rel, status: 'EXCLUDED' }); continue; }
  if (NEGATIVE.has(rel)) { results.push({ rel, status: 'NEGATIVE' }); continue; }
  mute();
  let status = 'OK', err = '';
  // blockhash(n) brands its (n->hash) oracle to the contract's OWN category (master-bound), so using it forces
  // the contract stateful - no deploy-time oracle-category config needed. See block-and-transaction-properties.md.
  try {
    compileFile(f, { solidityImportCompat: true });
  } catch (e) { status = 'FAIL'; err = (e.name || 'Error') + ': ' + String(e.message).split('\n')[0]; }
  unmute();
  results.push({ rel, status, err });
}

const ok = results.filter(r => r.status === 'OK');
const fail = results.filter(r => r.status === 'FAIL');
const excluded = results.filter(r => r.status === 'EXCLUDED');
const negative = results.filter(r => r.status === 'NEGATIVE');
const inScope = ok.length + fail.length;
console.log(`\n=== SCORECARD: ${ok.length}/${inScope} compiled (${fail.length} failed; `
  + `${excluded.length} excluded [out of scope: EVM mainnet counterparties or EVM-VM internals]; `
  + `${negative.length} negative [deliberately-uncompilable, solc rejects too]; ${results.length} total) ===\n`);
console.log('--- PASSING (' + ok.length + ') ---');
console.log(ok.map(r => r.rel).join('\n'));
console.log('\n--- FAILING (' + fail.length + ') ---');
for (const r of fail) console.log(`${r.rel}\n    ${r.err}`);
console.log('\n--- EXCLUDED (' + excluded.length + ', out of scope: EVM mainnet counterparties or EVM-VM internals) ---');
console.log(excluded.map(r => r.rel).join('\n'));
