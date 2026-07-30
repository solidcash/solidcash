import { describe, expect, it } from 'vitest';
import { compileFile, compileFileMulti } from 'solidc';
import { verifyCorpusPins } from './layer3-corpus-pins.js';

/**
 * X160. THE POPULATION COUNT WAS STALE, AND THE RE-TAKEN PARTITION IS 206, NOT 112.
 *
 * The board carried "112 handlers gained, 0 lost" for the L2-F2 route-admission repair. Two things falsified
 * it. `StableSwap` had silently STOPPED COMPILING, so Set A's gained total measured 50 against the 53 claimed
 * - a corpus row contributing 0 where it had contributed +3, visible only as a smaller number. That
 * regression is fixed (X159/X160, a hunk its own author had measured as byte-inert), and separately the
 * branch has moved a long way past the partition commit. Nobody had re-run the population.
 *
 * THE RE-TAKE, and the method is the one two earlier workers each reproduced independently.
 *
 *  - Both sides compiled in dedicated worktrees: `c988817e` (= `a2885464^`, PRE-repair) and this branch.
 *  - ONE probe binary. `layer3-corpus-probe-f3.mjs` and `layer3-corpus-pins.json` were copied from this branch
 *    into the pre-repair worktree, so the measurement code is byte-identical on both sides and only the
 *    COMPILER differs. Both worktrees were built to exit 0 and both resolve their own `solidc`/`solidcash`.
 *  - Same corpus on both sides, enforced by the probe's own pin refusal against `layer3-corpus-pins.json`.
 *  - Population: mistswap, EA and solidity-by-example - 179 in-scope files, 237 contract rows before and 252
 *    after. "Eligible" is the compiler's own answer: `hiddenBatch.handlers.filter(h => h.eligible)`.
 *
 * THE RESULT, per set. A set is decided from the two compiles, not assumed: NEW means the contract published
 * no eligible handler before and does now, A means it did on both sides with an unchanged route block size,
 * and B means it did on both sides and the block size MOVED.
 *
 *   set      contracts   gained   lost
 *   A               11       53      0     Set A's 53 is restored - StableSwap's +3 is back
 *   B                4       15      0     Airdrop, MyToken, VaultInflation.Token and now EACCToken
 *   NEW             39      138      0
 *   SAME            81        0      0     eligible on both sides, identical handler set
 *   TOTAL          135      206      0     54 contracts moved
 *
 * BOTH DIRECTIONS WERE CHECKED, because a lost row is not an error - it is a smaller number, and the census
 * records bus-compile failures as an anonymized histogram where one row's disappearance is invisible.
 *
 *  - Per contract: 0 handlers lost, on every one of the 135 rows.
 *  - Per contract, route reachability: 0 contracts went ROUTE-PRESENT -> anything else; 0 went from compiling
 *    to DIRECT-FAIL. The inverse of the StableSwap case does not occur anywhere in this population.
 *  - Whole-corpus gate counts moved only upward: bus-OK 2 -> 7 (mistswap), 8 -> 10 (EA), 101 -> 134 (SBE).
 *
 * AND THE WRITER COUNT IS ELEVEN, NOT ONE. `writesState` is published TRUE on eleven of the 206 gained
 * handlers. The recorded figure was one, and that one - `TxOrigin.sol`'s `Attack.attack` - is the only member
 * proved NOT to settle, fail-closed, its counterparty bus-inadmissible. The other ten were never in the count.
 * `Layer3RecoveredWriterSettlesX160.test.ts` runs the cleanest of them, `Counter.inc`, to completion.
 *
 * WHAT THIS FILE IS AND IS NOT.
 *
 *  - The BEFORE column is a RECORD taken at `c988817e` and is stamped as one. One process cannot host two
 *    compilers, so it can never be recomputed here; every assertion against it is an assertion about a record.
 *  - The AFTER column is RECOMPILED by this file, per corpus, and required to agree exactly. That is the guard
 *    the StableSwap regression got past: a row that stops publishing a handler turns this red in either
 *    direction, because set equality is asserted rather than a count.
 *  - The solc conformance corpus is NOT in this population. The recorded partition never included it and
 *    re-taking it at stride 12 doubles a 29-minute census run on both sides; a regression there would be
 *    invisible to this file and is not claimed to be absent.
 *  - Nothing here is VM evidence. Every figure is a compile output. Compiler admission is not VM proof, which
 *    is the whole point of the row this feeds.
 */

/** A recorded partition row. `before` is the record at `c988817e`; `after` and `writes` are recompiled here. */
interface PartitionRow {
  /** A: block size unchanged. B: block size moved. NEW: no eligible handler before. SAME: no change. */
  set: 'A' | 'B' | 'NEW' | 'SAME';
  corpus: 'eacc' | 'mistswap' | 'sbe';
  rel: string;
  name: string;
  before: readonly string[];
  after: readonly string[];
  /** Gained handlers whose ABI publishes anything other than `writesState: false`. */
  writes: readonly string[];
}

const PRE_REPAIR_COMMIT = 'c988817e';

const ROOTS: Record<PartitionRow['corpus'], string> = {
  eacc: process.env.EACC_CONTRACTS_DIR ?? '/Code/effectiveacceleration.ai/contract/contracts',
  mistswap: process.env.MISTSWAP_ROOT ?? '/Code/mistswap/mistswap/contracts',
  sbe: `${process.env.SBE_ROOT ?? '/Code/solidity-by-example'}/contracts/src`,
};

/** Exactly the options the probe compiled both sides with. A different option set is a different census. */
const BUS = {
  solidityImportCompat: true,
  ecrecover: 'p2pkh',
  forceStateful: true,
  experimentalHiddenBatch: true,
  experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
  experimentalMessageBusControllerCategory: '22'.repeat(32),
};
const DIRECT = { solidityImportCompat: true, ecrecover: 'p2pkh' };

/** THE RECORDED PARTITION. Emitted from the two probe outputs; no row is transcribed by hand. */
const PARTITION: readonly PartitionRow[] = [
  {
    set: 'B', corpus: 'eacc', rel: 'EACCToken.sol', name: 'EACCToken',
    before: ['balanceOf', 'allowance'],
    after: ['name', 'symbol', 'decimals', 'totalSupply', 'balanceOf', 'allowance', 'DOMAIN_SEPARATOR', 'eip712Domain'],
    writes: [],
  },
  {
    set: 'A', corpus: 'eacc', rel: 'MarketplaceV1.sol', name: 'MarketplaceV1',
    before: ['whitelistWorkers'],
    after: [
      'marketplaceData', 'version', 'unicrowAddress', 'unicrowDisputeAddress', 'unicrowArbitratorAddress',
      'treasuryAddress', 'unicrowMarketplaceFee', 'whitelistWorkers',
    ],
    writes: [],
  },
  {
    set: 'A', corpus: 'eacc', rel: 'MarketplaceV2.sol', name: 'MarketplaceV2',
    before: ['whitelistWorkers', 'eaccRewardTokensEnabled'],
    after: [
      'marketplaceData', 'version', 'unicrowAddress', 'unicrowDisputeAddress', 'unicrowArbitratorAddress',
      'treasuryAddress', 'unicrowMarketplaceFee', 'eaccToken', 'eaccBar', 'eaccTokensPerToken', 'whitelistWorkers',
      'eaccRewardTokensEnabled',
    ],
    writes: [],
  },
  {
    set: 'A', corpus: 'eacc', rel: 'MarketplaceV3.sol', name: 'MarketplaceV3',
    before: ['whitelistWorkers', 'eaccRewardTokensEnabled'],
    after: [
      'marketplaceData', 'version', 'unicrowAddress', 'unicrowDisputeAddress', 'unicrowArbitratorAddress',
      'treasuryAddress', 'unicrowMarketplaceFee', 'eaccToken', 'eaccBar', 'eaccTokensPerToken', 'whitelistWorkers',
      'eaccRewardTokensEnabled',
    ],
    writes: [],
  },
  {
    set: 'NEW', corpus: 'eacc', rel: 'TreasurySplit.sol', name: 'TreasurySplit',
    before: [],
    after: ['eaccTreasuryAddress', 'arbiusTreasuryAddress', 'eaccTreasuryPercentage'],
    writes: [],
  },
  {
    set: 'A', corpus: 'eacc', rel: 'unicrow/FakeToken.sol', name: 'FakeToken',
    before: ['balanceOf', 'allowance'],
    after: ['name', 'symbol', 'decimals', 'totalSupply', 'balanceOf', 'allowance'],
    writes: [],
  },
  {
    set: 'A', corpus: 'eacc', rel: 'unicrow/UnicrowArbitrator.sol', name: 'UnicrowArbitrator',
    before: ['getArbitratorData'],
    after: ['arbitrationCalculation', 'getArbitratorData', 'unicrow', 'unicrowClaim'],
    writes: [],
  },
  {
    set: 'NEW', corpus: 'eacc', rel: 'unicrow/UnicrowClaim.sol', name: 'UnicrowClaim',
    before: [],
    after: ['unicrow', 'unicrowArbitrator', 'crowRewards', 'stakingRewards', 'protocolFeeAddress'],
    writes: [],
  },
  {
    set: 'A', corpus: 'eacc', rel: 'unicrow/UnicrowDispute.sol', name: 'UnicrowDispute',
    before: ['getSettlementDetails', 'latestSettlementOfferBy'],
    after: ['getSettlementDetails', 'unicrow', 'unicrowClaim', 'unicrowArbitrator', 'latestSettlementOfferBy'],
    writes: [],
  },
  {
    set: 'NEW', corpus: 'mistswap', rel: 'SushiRoll.sol', name: 'SushiRoll',
    before: [],
    after: ['oldRouter', 'router'],
    writes: [],
  },
  {
    set: 'NEW', corpus: 'mistswap', rel: 'uniswapv2/UniswapV2ERC20.sol', name: 'UniswapV2ERC20',
    before: [],
    after: ['totalSupply', 'DOMAIN_SEPARATOR', 'balanceOf', 'allowance', 'nonces'],
    writes: [],
  },
  {
    set: 'NEW', corpus: 'mistswap', rel: 'uniswapv2/UniswapV2Factory.sol', name: 'UniswapV2ERC20',
    before: [],
    after: ['totalSupply', 'DOMAIN_SEPARATOR', 'balanceOf', 'allowance', 'nonces'],
    writes: [],
  },
  {
    set: 'SAME', corpus: 'mistswap', rel: 'uniswapv2/UniswapV2Factory.sol', name: 'UniswapV2Factory',
    before: [
      'allPairsLength', 'pairCodeHash', 'setFeeTo', 'setMigrator', 'setFeeToSetter', 'feeTo', 'feeToSetter', 'migrator',
      'allPairs', 'getPair',
    ],
    after: [
      'allPairsLength', 'pairCodeHash', 'setFeeTo', 'setMigrator', 'setFeeToSetter', 'feeTo', 'feeToSetter', 'migrator',
      'allPairs', 'getPair',
    ],
    writes: ['setFeeTo', 'setMigrator', 'setFeeToSetter'],
  },
  {
    set: 'NEW', corpus: 'mistswap', rel: 'uniswapv2/UniswapV2Factory.sol', name: 'UniswapV2Pair',
    before: [],
    after: [
      'getReserves', 'initialize', 'totalSupply', 'DOMAIN_SEPARATOR', 'factory', 'token0', 'token1', 'price0CumulativeLast',
      'price1CumulativeLast', 'kLast', 'balanceOf', 'allowance', 'nonces',
    ],
    writes: ['initialize'],
  },
  {
    set: 'NEW', corpus: 'mistswap', rel: 'uniswapv2/UniswapV2Pair.sol', name: 'UniswapV2ERC20',
    before: [],
    after: ['totalSupply', 'DOMAIN_SEPARATOR', 'balanceOf', 'allowance', 'nonces'],
    writes: [],
  },
  {
    set: 'SAME', corpus: 'mistswap', rel: 'uniswapv2/UniswapV2Pair.sol', name: 'UniswapV2Pair',
    before: [
      'getReserves', 'initialize', 'totalSupply', 'DOMAIN_SEPARATOR', 'factory', 'token0', 'token1', 'price0CumulativeLast',
      'price1CumulativeLast', 'kLast', 'balanceOf', 'allowance', 'nonces',
    ],
    after: [
      'getReserves', 'initialize', 'totalSupply', 'DOMAIN_SEPARATOR', 'factory', 'token0', 'token1', 'price0CumulativeLast',
      'price1CumulativeLast', 'kLast', 'balanceOf', 'allowance', 'nonces',
    ],
    writes: ['initialize'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'abi-decode/AbiDecode.sol', name: 'AbiDecode',
    before: ['encode', 'decode'],
    after: ['encode', 'decode'],
    writes: ['encode', 'decode'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'abi-encode/AbiEncode.sol', name: 'AbiEncode',
    before: ['test', 'encodeWithSignature', 'encodeWithSelector', 'encodeCall'],
    after: ['test', 'encodeWithSignature', 'encodeWithSelector', 'encodeCall'],
    writes: ['test', 'encodeWithSignature', 'encodeWithSelector', 'encodeCall'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'abi-encode/AbiEncode.sol', name: 'Token',
    before: ['transfer'],
    after: ['transfer'],
    writes: ['transfer'],
  },
  {
    set: 'B', corpus: 'sbe', rel: 'app/airdrop/Airdrop.sol', name: 'Airdrop',
    before: ['claimed'],
    after: ['getLeafHash', 'token', 'root', 'claimed'],
    writes: [],
  },
  {
    set: 'NEW', corpus: 'sbe', rel: 'app/airdrop/Token.sol', name: 'Token',
    before: [],
    after: ['totalSupply', 'name', 'symbol', 'decimals', 'balanceOf', 'allowance', 'authorized'],
    writes: [],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'app/assembly-bin-exp/AssemblyBinExp.sol', name: 'AssemblyBinExp',
    before: ['rpow'],
    after: ['rpow'],
    writes: ['rpow'],
  },
  {
    set: 'NEW', corpus: 'sbe', rel: 'app/create2/Create2.sol', name: 'TestContract',
    before: [],
    after: ['getBalance', 'owner', 'foo'],
    writes: [],
  },
  {
    set: 'A', corpus: 'sbe', rel: 'app/crowd-fund/CrowdFund.sol', name: 'CrowdFund',
    before: ['pledgedAmount'],
    after: ['token', 'count', 'pledgedAmount'],
    writes: [],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'app/deploy-any-contract/Proxy.sol', name: 'Helper',
    before: ['getBytecode1', 'getBytecode2', 'getCalldata'],
    after: ['getBytecode1', 'getBytecode2', 'getCalldata'],
    writes: ['getBytecode1', 'getBytecode2', 'getCalldata'],
  },
  {
    set: 'NEW', corpus: 'sbe', rel: 'app/dutch-auction/DutchAuction.sol', name: 'DutchAuction',
    before: [],
    after: ['getPrice', 'nft', 'nftId', 'seller', 'startingPrice', 'startAt', 'expiresAt', 'discountRate'],
    writes: [],
  },
  {
    set: 'A', corpus: 'sbe', rel: 'app/english-auction/EnglishAuction.sol', name: 'EnglishAuction',
    before: ['bids'],
    after: ['nft', 'nftId', 'seller', 'endAt', 'started', 'ended', 'highestBidder', 'highestBid', 'bids'],
    writes: [],
  },
  {
    set: 'NEW', corpus: 'sbe', rel: 'app/erc20/ERC20.sol', name: 'ERC20',
    before: [],
    after: ['totalSupply', 'name', 'symbol', 'decimals', 'balanceOf', 'allowance'],
    writes: [],
  },
  {
    set: 'NEW', corpus: 'sbe', rel: 'app/erc20/MyToken.sol', name: 'ERC20',
    before: [],
    after: ['totalSupply', 'name', 'symbol', 'decimals', 'balanceOf', 'allowance'],
    writes: [],
  },
  {
    set: 'B', corpus: 'sbe', rel: 'app/erc20/MyToken.sol', name: 'MyToken',
    before: ['balanceOf', 'allowance'],
    after: ['totalSupply', 'name', 'symbol', 'decimals', 'balanceOf', 'allowance'],
    writes: [],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'app/erc721/ERC721.sol', name: 'ERC721',
    before: ['ownerOf', 'balanceOf', 'getApproved', 'isApprovedForAll'],
    after: ['ownerOf', 'balanceOf', 'getApproved', 'isApprovedForAll'],
    writes: [],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'app/erc721/ERC721.sol', name: 'MyNFT',
    before: ['ownerOf', 'balanceOf', 'getApproved', 'isApprovedForAll'],
    after: ['ownerOf', 'balanceOf', 'getApproved', 'isApprovedForAll'],
    writes: [],
  },
  {
    set: 'NEW', corpus: 'sbe', rel: 'app/ether-wallet/EtherWallet.sol', name: 'EtherWallet',
    before: [],
    after: ['getBalance', 'owner'],
    writes: [],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'app/gasless-token-transfer/ERC20Permit.sol', name: 'ERC20Permit',
    before: ['balanceOf', 'allowance', 'nonces'],
    after: ['balanceOf', 'allowance', 'nonces'],
    writes: [],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'app/iterable-mapping/IterableMapping.sol', name: 'TestIterableMap',
    before: ['map__values', 'map__indexOf', 'map__inserted'],
    after: ['map__values', 'map__indexOf', 'map__inserted'],
    writes: [],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'app/minimal-proxy/MinimalProxy.sol', name: 'MinimalProxy',
    before: ['clone'],
    after: ['clone'],
    writes: ['clone'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'app/multi-call/TestMultiCall.sol', name: 'TestMultiCall',
    before: ['test', 'getData'],
    after: ['test', 'getData'],
    writes: ['test', 'getData'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'app/multi-delegatecall/MultiDelegatecall.sol', name: 'Helper',
    before: ['getFunc1Data', 'getFunc2Data', 'getMintData'],
    after: ['getFunc1Data', 'getFunc2Data', 'getMintData'],
    writes: ['getFunc1Data', 'getFunc2Data', 'getMintData'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'app/multi-sig-wallet/TestContract.sol', name: 'TestContract',
    before: ['callMe', 'getData', 'i'],
    after: ['callMe', 'getData', 'i'],
    writes: ['callMe'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'app/simple-bytecode-contract/Factory.sol', name: 'Factory',
    before: ['deploy'],
    after: ['deploy'],
    writes: ['deploy'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'array/Array.sol', name: 'Array',
    before: ['get', 'getArr', 'push', 'pop', 'getLength', 'remove', 'arr', 'arr2', 'myFixedSizeArr'],
    after: ['get', 'getArr', 'push', 'pop', 'getLength', 'remove', 'arr', 'arr2', 'myFixedSizeArr'],
    writes: ['push', 'pop', 'remove'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'array/ArrayRemoveByShifting.sol', name: 'ArrayRemoveByShifting',
    before: ['remove', 'test', 'arr'],
    after: ['remove', 'test', 'arr'],
    writes: ['remove', 'test'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'array/ArrayReplaceFromEnd.sol', name: 'ArrayReplaceFromEnd',
    before: ['remove', 'test', 'arr'],
    after: ['remove', 'test', 'arr'],
    writes: ['remove', 'test'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'assembly-error/AssemblyError.sol', name: 'AssemblyError',
    before: ['yul_revert'],
    after: ['yul_revert'],
    writes: ['yul_revert'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'assembly-if/AssemblyIf.sol', name: 'AssemblyIf',
    before: ['yul_if', 'yul_switch'],
    after: ['yul_if', 'yul_switch'],
    writes: ['yul_if', 'yul_switch'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'assembly-loop/AssemblyLoop.sol', name: 'AssemblyLoop',
    before: ['yul_for_loop', 'yul_while_loop'],
    after: ['yul_for_loop', 'yul_while_loop'],
    writes: ['yul_for_loop', 'yul_while_loop'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'assembly-math/AssemblyMath.sol', name: 'AssemblyMath',
    before: ['yul_add', 'yul_mul', 'yul_fixed_point_round'],
    after: ['yul_add', 'yul_mul', 'yul_fixed_point_round'],
    writes: ['yul_add', 'yul_mul', 'yul_fixed_point_round'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'assembly-variable/AssemblyVariable.sol', name: 'AssemblyVariable',
    before: ['yul_let'],
    after: ['yul_let'],
    writes: ['yul_let'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'bitwise/Bitwise.sol', name: 'BitwiseOps',
    before: [
      'and', 'or', 'xor', 'not', 'shiftLeft', 'shiftRight', 'getLastNBits', 'getLastNBitsUsingMod', 'mostSignificantBit',
      'getFirstNBits',
    ],
    after: [
      'and', 'or', 'xor', 'not', 'shiftLeft', 'shiftRight', 'getLastNBits', 'getLastNBitsUsingMod', 'mostSignificantBit',
      'getFirstNBits',
    ],
    writes: [
      'and', 'or', 'xor', 'not', 'shiftLeft', 'shiftRight', 'getLastNBits', 'getLastNBitsUsingMod', 'mostSignificantBit',
      'getFirstNBits',
    ],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'bitwise/MostSignificantBitAssembly.sol', name: 'MostSignificantBitAssembly',
    before: ['mostSignificantBit'],
    after: ['mostSignificantBit'],
    writes: ['mostSignificantBit'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'bitwise/MostSignificantBitFunction.sol', name: 'MostSignificantBitFunction',
    before: ['mostSignificantBit'],
    after: ['mostSignificantBit'],
    writes: ['mostSignificantBit'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'constructor/Constructor.sol', name: 'B',
    before: ['text', 'name'],
    after: ['text', 'name'],
    writes: [],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'constructor/Constructor.sol', name: 'C',
    before: ['text', 'name'],
    after: ['text', 'name'],
    writes: [],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'constructor/Constructor.sol', name: 'D',
    before: ['text', 'name'],
    after: ['text', 'name'],
    writes: [],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'constructor/Constructor.sol', name: 'E',
    before: ['text', 'name'],
    after: ['text', 'name'],
    writes: [],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'constructor/Constructor.sol', name: 'X',
    before: ['name'],
    after: ['name'],
    writes: [],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'constructor/Constructor.sol', name: 'Y',
    before: ['text'],
    after: ['text'],
    writes: [],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'data-locations/DataLocations.sol', name: 'DataLocations',
    before: ['f', 'g', 'h', 'arr', 'map'],
    after: ['f', 'g', 'h', 'arr', 'map'],
    writes: [],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'defi/constant-product-amm/CPAMM.sol', name: 'CPAMM',
    before: ['balanceOf'],
    after: ['balanceOf'],
    writes: [],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'defi/constant-sum-amm/CSAMM.sol', name: 'CSAMM',
    before: ['balanceOf'],
    after: ['balanceOf'],
    writes: [],
  },
  {
    set: 'A', corpus: 'sbe', rel: 'defi/stable-swap-amm/StableSwap.sol', name: 'StableSwap',
    before: ['balanceOf'],
    after: ['tokens', 'balances', 'totalSupply', 'balanceOf'],
    writes: [],
  },
  {
    set: 'NEW', corpus: 'sbe', rel: 'defi/staking-rewards/StakingRewards.sol', name: 'StakingRewards',
    before: [],
    after: [
      'lastTimeRewardApplicable', 'rewardPerToken', 'earned', 'setRewardsDuration', 'stakingToken', 'rewardsToken', 'owner',
      'duration', 'finishAt', 'updatedAt', 'rewardRate', 'rewardPerTokenStored', 'totalSupply', 'userRewardPerTokenPaid',
      'rewards', 'balanceOf',
    ],
    writes: ['setRewardsDuration'],
  },
  {
    set: 'A', corpus: 'sbe', rel: 'defi/vault/Vault.sol', name: 'Vault',
    before: ['balanceOf'],
    after: ['token', 'totalSupply', 'balanceOf'],
    writes: [],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'error/Account.sol', name: 'Account',
    before: ['deposit', 'withdraw', 'balance'],
    after: ['deposit', 'withdraw', 'balance'],
    writes: ['deposit', 'withdraw'],
  },
  {
    set: 'NEW', corpus: 'sbe', rel: 'error/Error.sol', name: 'Error',
    before: [],
    after: ['testRequire', 'testRevert', 'testAssert', 'testCustomError', 'num'],
    writes: [],
  },
  {
    set: 'NEW', corpus: 'sbe', rel: 'ether-units/EtherUnits.sol', name: 'EtherUnits',
    before: [],
    after: ['oneWei', 'isOneWei', 'oneGwei', 'isOneGwei', 'oneEther', 'isOneEther'],
    writes: [],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'events-advanced/EventsAdvanced.sol', name: 'EventDrivenArchitecture',
    before: ['transferConfirmations'],
    after: ['transferConfirmations'],
    writes: [],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'events-advanced/EventsAdvanced.sol', name: 'EventSubscription',
    before: ['subscribe', 'subscriberList', 'subscribers'],
    after: ['subscribe', 'subscriberList', 'subscribers'],
    writes: ['subscribe'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'events/Events.sol', name: 'Event',
    before: ['test'],
    after: ['test'],
    writes: ['test'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'evm/memory/YulMem.sol', name: 'MemExp',
    before: ['alloc_mem'],
    after: ['alloc_mem'],
    writes: ['alloc_mem'],
  },
  {
    set: 'NEW', corpus: 'sbe', rel: 'fallback/FallbackInputOutput.sol', name: 'Counter',
    before: [],
    after: ['get', 'inc', 'count'],
    writes: ['inc'],
  },
  {
    set: 'NEW', corpus: 'sbe', rel: 'fallback/FallbackInputOutput.sol', name: 'FallbackInputOutput',
    before: [],
    after: ['target'],
    writes: [],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'fallback/FallbackInputOutput.sol', name: 'TestFallbackInputOutput',
    before: ['getTestData'],
    after: ['getTestData'],
    writes: ['getTestData'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'first-app/Counter.sol', name: 'Counter',
    before: ['get', 'inc', 'dec', 'count'],
    after: ['get', 'inc', 'dec', 'count'],
    writes: ['inc', 'dec'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'function-modifier/FunctionModifier.sol', name: 'FunctionModifier',
    before: ['changeOwner', 'decrement', 'owner', 'x', 'locked'],
    after: ['changeOwner', 'decrement', 'owner', 'x', 'locked'],
    writes: ['changeOwner', 'decrement'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'function-selector/FunctionSelector.sol', name: 'FunctionSelector',
    before: ['getSelector'],
    after: ['getSelector'],
    writes: ['getSelector'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'function/Function.sol', name: 'Function',
    before: ['returnMany', 'named', 'assigned', 'destructuringAssignments', 'arrayInput', 'arrayOutput', 'arr'],
    after: ['returnMany', 'named', 'assigned', 'destructuringAssignments', 'arrayInput', 'arrayOutput', 'arr'],
    writes: [],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'function/Function.sol', name: 'XYZ',
    before: ['someFuncWithManyInputs', 'callFunc', 'callFuncWithKeyValue'],
    after: ['someFuncWithManyInputs', 'callFunc', 'callFuncWithKeyValue'],
    writes: ['someFuncWithManyInputs', 'callFunc', 'callFuncWithKeyValue'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'gas-golf/GasGolf.sol', name: 'GasGolf',
    before: ['sumIfEvenAndLessThan99', 'total'],
    after: ['sumIfEvenAndLessThan99', 'total'],
    writes: ['sumIfEvenAndLessThan99'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'gas/Gas.sol', name: 'Gas',
    before: ['forever', 'i'],
    after: ['forever', 'i'],
    writes: ['forever'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'hacks/accessing-private-data/Vault.sol', name: 'Vault',
    before: ['getArrayLocation', 'getMapLocation', 'count', 'owner', 'isTrue', 'u16', 'data'],
    after: ['getArrayLocation', 'getMapLocation', 'count', 'owner', 'isTrue', 'u16', 'data'],
    writes: [],
  },
  {
    set: 'NEW', corpus: 'sbe', rel: 'hacks/contract-size/ContractSize.sol', name: 'Hack',
    before: [],
    after: ['isContract', 'addr'],
    writes: [],
  },
  {
    set: 'NEW', corpus: 'sbe', rel: 'hacks/contract-size/ContractSize.sol', name: 'Target',
    before: [],
    after: ['isContract', 'protected', 'pwned'],
    writes: ['protected'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'hacks/delegatecall/Delegatecall_2.sol', name: 'Attack',
    before: ['attack', 'doSomething', 'lib', 'owner', 'someNumber', 'hackMe'],
    after: ['attack', 'doSomething', 'lib', 'owner', 'someNumber', 'hackMe'],
    writes: ['attack', 'doSomething'],
  },
  {
    set: 'NEW', corpus: 'sbe', rel: 'hacks/delegatecall/Delegatecall_2.sol', name: 'HackMe',
    before: [],
    after: ['lib', 'owner', 'someNumber'],
    writes: [],
  },
  {
    set: 'NEW', corpus: 'sbe', rel: 'hacks/delegatecall/Delegatecall_2.sol', name: 'Lib',
    before: [],
    after: ['doSomething', 'someNumber'],
    writes: ['doSomething'],
  },
  {
    set: 'NEW', corpus: 'sbe', rel: 'hacks/denial-of-service/DenialOfService.sol', name: 'Attack',
    before: [],
    after: ['kingOfEther'],
    writes: [],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'hacks/deploy-different-contracts-same-address/TornadoHack.sol', name: 'Deployer',
    before: ['deployProposal'],
    after: ['deployProposal'],
    writes: ['deployProposal'],
  },
  {
    set: 'NEW', corpus: 'sbe', rel: 'hacks/hiding-malicious-code-with-external-contract/ExternalContract.sol', name: 'Bar',
    before: [],
    after: ['log'],
    writes: ['log'],
  },
  {
    set: 'NEW', corpus: 'sbe', rel: 'hacks/hiding-malicious-code-with-external-contract/ExternalContract.sol', name: 'Foo',
    before: [],
    after: ['callBar', 'bar'],
    writes: ['callBar'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'hacks/hiding-malicious-code-with-external-contract/ExternalContract.sol', name: 'Mal',
    before: ['log'],
    after: ['log'],
    writes: ['log'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'hacks/honeypot/HoneyPot.sol', name: 'HoneyPot',
    before: ['log', 'equal'],
    after: ['log', 'equal'],
    writes: ['log', 'equal'],
  },
  {
    set: 'NEW', corpus: 'sbe', rel: 'hacks/overflow/Overflow.sol', name: 'Attack',
    before: [],
    after: ['timeLock'],
    writes: [],
  },
  {
    set: 'NEW', corpus: 'sbe', rel: 'hacks/phishing-with-tx-origin/TxOrigin.sol', name: 'Attack',
    before: [],
    after: ['attack', 'owner', 'wallet'],
    writes: ['attack'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'hacks/randomness/Randomness.sol', name: 'Attack',
    before: ['attack', 'getBalance'],
    after: ['attack', 'getBalance'],
    writes: ['attack'],
  },
  {
    set: 'NEW', corpus: 'sbe', rel: 'hacks/re-entrancy/ReEntrancy.sol', name: 'Attack',
    before: [],
    after: ['getBalance', 'etherStore'],
    writes: [],
  },
  {
    set: 'NEW', corpus: 'sbe', rel: 'hacks/self-destruct/ForceEther.sol', name: 'Attack',
    before: [],
    after: ['etherGame'],
    writes: [],
  },
  {
    set: 'B', corpus: 'sbe', rel: 'hacks/vault-inflation/VaultInflation.sol', name: 'Token',
    before: ['balanceOf', 'allowance'],
    after: ['totalSupply', 'decimals', 'balanceOf', 'allowance'],
    writes: [],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'hacks/vault-inflation/VaultInflation.sol', name: 'Vault',
    before: ['balanceOf'],
    after: ['balanceOf'],
    writes: [],
  },
  {
    set: 'A', corpus: 'sbe', rel: 'hacks/weth-permit/ERC20Bank.sol', name: 'ERC20Bank',
    before: ['balanceOf'],
    after: ['token', 'balanceOf'],
    writes: [],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'hacks/weth-permit/WETH.sol', name: 'WETH',
    before: ['balanceOf', 'allowance'],
    after: ['balanceOf', 'allowance'],
    writes: [],
  },
  {
    set: 'NEW', corpus: 'sbe', rel: 'hashing/Keccak256.sol', name: 'GuessTheMagicWord',
    before: [],
    after: ['guess', 'answer'],
    writes: [],
  },
  {
    set: 'NEW', corpus: 'sbe', rel: 'hashing/Keccak256.sol', name: 'HashFunction',
    before: [],
    after: ['hash', 'collision'],
    writes: ['hash', 'collision'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'hello-world/HelloWorld.sol', name: 'HelloWorld',
    before: ['greet'],
    after: ['greet'],
    writes: [],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'if-else/IfElse.sol', name: 'IfElse',
    before: ['foo', 'ternary'],
    after: ['foo', 'ternary'],
    writes: ['foo', 'ternary'],
  },
  {
    set: 'NEW', corpus: 'sbe', rel: 'immutable/Immutable.sol', name: 'Immutable',
    before: [],
    after: ['myAddr', 'myUint'],
    writes: [],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'import/Foo.sol', name: 'Foo',
    before: ['name'],
    after: ['name'],
    writes: [],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'interface/Interface.sol', name: 'Counter',
    before: ['increment', 'count'],
    after: ['increment', 'count'],
    writes: ['increment'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'library/Library.sol', name: 'TestArray',
    before: ['testArrayRemove', 'arr'],
    after: ['testArrayRemove', 'arr'],
    writes: ['testArrayRemove'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'library/Library.sol', name: 'TestMath',
    before: ['testSquareRoot'],
    after: ['testSquareRoot'],
    writes: ['testSquareRoot'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'loop/Loop.sol', name: 'Loop',
    before: ['loop'],
    after: ['loop'],
    writes: ['loop'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'mapping/Mapping.sol', name: 'Mapping',
    before: ['get', 'set', 'remove', 'myMap'],
    after: ['get', 'set', 'remove', 'myMap'],
    writes: ['set', 'remove'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'mapping/Mapping.sol', name: 'NestedMapping',
    before: ['get', 'set', 'remove', 'nested'],
    after: ['get', 'set', 'remove', 'nested'],
    writes: ['set', 'remove'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'primitives/Primitives.sol', name: 'Primitives',
    before: [
      'boo', 'u8', 'u256', 'u', 'i8', 'i256', 'i', 'minInt', 'maxInt', 'addr', 'a', 'b', 'defaultBoo', 'defaultUint',
      'defaultInt', 'defaultAddr',
    ],
    after: [
      'boo', 'u8', 'u256', 'u', 'i8', 'i256', 'i', 'minInt', 'maxInt', 'addr', 'a', 'b', 'defaultBoo', 'defaultUint',
      'defaultInt', 'defaultAddr',
    ],
    writes: [],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'shadowing-inherited-state-variables/Shadow.sol', name: 'A',
    before: ['getName', 'name'],
    after: ['getName', 'name'],
    writes: [],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'shadowing-inherited-state-variables/Shadow.sol', name: 'C',
    before: ['getName', 'name'],
    after: ['getName', 'name'],
    writes: [],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'signature/Signature.sol', name: 'VerifySignature',
    before: ['getMessageHash', 'getEthSignedMessageHash', 'verify', 'recoverSigner', 'splitSignature'],
    after: ['getMessageHash', 'getEthSignedMessageHash', 'verify', 'recoverSigner', 'splitSignature'],
    writes: ['getMessageHash', 'getEthSignedMessageHash', 'verify', 'recoverSigner', 'splitSignature'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'state-variables/SimpleStorage.sol', name: 'SimpleStorage',
    before: ['set', 'get', 'num'],
    after: ['set', 'get', 'num'],
    writes: ['set'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'structs/Structs.sol', name: 'Todos',
    before: ['create', 'get', 'updateText', 'toggleCompleted'],
    after: ['create', 'get', 'updateText', 'toggleCompleted'],
    writes: ['create', 'updateText', 'toggleCompleted'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'tests/echidna/EchidnaTestTimeAndCaller.sol', name: 'EchidnaTestTimeAndCaller',
    before: ['echidna_test_pass', 'setFail', 'setSender'],
    after: ['echidna_test_pass', 'setFail', 'setSender'],
    writes: ['setFail', 'setSender'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'tests/echidna/TestEchidna.sol', name: 'Counter',
    before: ['inc', 'dec', 'count'],
    after: ['inc', 'dec', 'count'],
    writes: ['inc', 'dec'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'tests/echidna/TestEchidna.sol', name: 'TestAssert',
    before: ['test_assert', 'test_abs'],
    after: ['test_assert', 'test_abs'],
    writes: ['test_assert', 'test_abs'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'tests/echidna/TestEchidna.sol', name: 'TestCounter',
    before: ['echidna_test_true', 'echidna_test_false', 'echidna_test_count', 'inc', 'dec', 'count'],
    after: ['echidna_test_true', 'echidna_test_false', 'echidna_test_count', 'inc', 'dec', 'count'],
    writes: ['inc', 'dec'],
  },
  {
    set: 'NEW', corpus: 'sbe', rel: 'transient-storage/TransientStorage.sol', name: 'Callback',
    before: [],
    after: ['val'],
    writes: [],
  },
  {
    set: 'NEW', corpus: 'sbe', rel: 'transient-storage/TransientStorage.sol', name: 'MaliciousCallback',
    before: [],
    after: ['count'],
    writes: [],
  },
  {
    set: 'NEW', corpus: 'sbe', rel: 'transient-storage/TransientStorage.sol', name: 'TestStorage',
    before: [],
    after: ['val'],
    writes: [],
  },
  {
    set: 'NEW', corpus: 'sbe', rel: 'transient-storage/TransientStorage.sol', name: 'TestTransientStorage',
    before: [],
    after: ['val'],
    writes: ['val'],
  },
  {
    set: 'NEW', corpus: 'sbe', rel: 'try-catch/TryCatch.sol', name: 'Bar',
    before: [],
    after: ['foo'],
    writes: [],
  },
  {
    set: 'NEW', corpus: 'sbe', rel: 'try-catch/TryCatch.sol', name: 'Foo',
    before: [],
    after: ['myFunc', 'owner'],
    writes: [],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'unchecked-math/UncheckedMath.sol', name: 'UncheckedMath',
    before: ['add', 'sub', 'sumOfCubes'],
    after: ['add', 'sub', 'sumOfCubes'],
    writes: ['add', 'sub', 'sumOfCubes'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'user-defined-value-types/UserDefinedValueTypes.sol', name: 'Examples',
    before: ['example_no_uvdt', 'example_uvdt', '__updateBlockOracle'],
    after: ['example_no_uvdt', 'example_uvdt', '__updateBlockOracle'],
    writes: ['__updateBlockOracle'],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'variables/Variables.sol', name: 'Variables',
    before: ['doSomething', 'text', 'num'],
    after: ['doSomething', 'text', 'num'],
    writes: [],
  },
  {
    set: 'NEW', corpus: 'sbe', rel: 'view-and-pure-functions/ViewAndPureFunctions.sol', name: 'ViewAndPure',
    before: [],
    after: ['addToX', 'add', 'x'],
    writes: [],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'visibility/Visibility.sol', name: 'Base',
    before: ['testPrivateFunc', 'testInternalFunc', 'publicFunc', 'externalFunc', 'publicVar'],
    after: ['testPrivateFunc', 'testInternalFunc', 'publicFunc', 'externalFunc', 'publicVar'],
    writes: [],
  },
  {
    set: 'SAME', corpus: 'sbe', rel: 'visibility/Visibility.sol', name: 'Child',
    before: ['testInternalFunc', 'testPrivateFunc', 'publicFunc', 'externalFunc', 'publicVar'],
    after: ['testInternalFunc', 'testPrivateFunc', 'publicFunc', 'externalFunc', 'publicVar'],
    writes: [],
  },
];

/** The re-take's own totals, recomputed from the table rather than restated. */
const totals = (rows: readonly PartitionRow[]): {
  contracts: number; gained: number; lost: number; moved: number; writers: string[];
} => {
  let gained = 0;
  let lost = 0;
  let moved = 0;
  const writers: string[] = [];
  for (const row of rows) {
    const g = row.after.filter((name) => !row.before.includes(name));
    const l = row.before.filter((name) => !row.after.includes(name));
    gained += g.length;
    lost += l.length;
    if (g.length > 0 || l.length > 0) moved += 1;
    for (const name of g) if (row.writes.includes(name)) writers.push(`${row.rel}::${row.name}.${name}`);
  }
  return { contracts: rows.length, gained, lost, moved, writers };
};

/** One bus-mode compile per FILE, shared by every contract the file declares. */
const compiled = new Map<string, Record<string, any>>();
function busMap(corpus: PartitionRow['corpus'], rel: string): Record<string, any> {
  const path = `${ROOTS[corpus]}/${rel}`;
  const cached = compiled.get(path);
  if (cached !== undefined) return cached;
  let map: Record<string, any>;
  try {
    map = compileFileMulti(path, BUS as never) as never;
  } catch {
    // The probe's own fallback: a file whose sibling does not compile still contributes its primary contract,
    // and dropping it here would understate the reachable set exactly as it would there.
    map = { [(compileFile(path, BUS as never) as any).contractName]: compileFile(path, BUS as never) };
  }
  compiled.set(path, map);
  return map;
}

const eligibleNow = (artifact: any): string[] => ((artifact?.hiddenBatch?.handlers ?? []) as any[])
  .filter((handler) => handler.eligible).map((handler) => handler.name);

/** Recompile one corpus's rows and require the recorded AFTER column, as a SET, exactly. */
function recheck(corpus: PartitionRow['corpus']): void {
  const rows = PARTITION.filter((row) => row.corpus === corpus);
  expect(rows.length, `${corpus} has no recorded rows`).toBeGreaterThan(0);
  const drift: string[] = [];
  for (const row of rows) {
    const artifact = busMap(corpus, row.rel)[row.name];
    const now = [...eligibleNow(artifact)].sort();
    const recorded = [...row.after].sort();
    const missing = recorded.filter((name) => !now.includes(name));
    const extra = now.filter((name) => !recorded.includes(name));
    if (missing.length > 0 || extra.length > 0) {
      drift.push(`${row.rel}::${row.name} recorded ${recorded.length} now ${now.length} `
        + `LOST ${JSON.stringify(missing)} NEW ${JSON.stringify(extra)}`);
    }
  }
  const gate = totals(rows);
  console.log(`[X160P] ${corpus}: ${rows.length} rows, gained ${gate.gained}, lost ${gate.lost}, `
    + `${drift.length} drifted`);
  for (const line of drift) console.log(`[X160P]   DRIFT ${line}`);
  // A row that stops publishing a handler shows up as `missing`, which is the SHAPE of the regression this
  // file exists to catch; `extra` is the opposite direction and is equally a re-take, not a pass.
  expect(drift, `${corpus}: the recompiled eligible sets no longer match the recorded partition`).toEqual([]);
}

describe('X160: the re-taken L2-F2 partition', () => {
  /**
   * THE CORPUS IS THE ONE BOTH SIDES READ. A partition across two compilers is only a compiler measurement if
   * the sources did not move, so this is asserted before any figure below is quoted.
   */
  it('MEASURED: the three corpora this partition covers are at their pinned commits', () => {
    const result = verifyCorpusPins();
    const covered = ['mistswap', 'eacc', 'solidity-by-example'];
    const relevant = result.statuses.filter((status) => covered.includes(status.name));
    for (const status of relevant) {
      console.log(`[X160P] ${status.name.padEnd(20)} ${status.verdict} head=${status.measured.head ?? '-'} `
        + `files=${status.measured.fileCount ?? '-'}`);
    }
    expect(relevant).toHaveLength(3);
    expect(relevant.flatMap((status) => status.refusals)).toEqual([]);
  });

  /**
   * THE ARITHMETIC, recomputed from the recorded rows. This is what replaces "112 gained, 0 lost": it is the
   * count the board should carry, and it is derived here rather than restated.
   */
  it('MEASURED: 206 gained, 0 lost, across 54 moved contracts', () => {
    const all = totals(PARTITION);
    console.log(`[X160P] pre-repair side RECORDED at ${PRE_REPAIR_COMMIT}; after side recompiled below`);
    console.log(`[X160P] rows=${all.contracts} gained=${all.gained} lost=${all.lost} moved=${all.moved}`);
    for (const set of ['A', 'B', 'NEW', 'SAME'] as const) {
      const gate = totals(PARTITION.filter((row) => row.set === set));
      console.log(`[X160P]   set ${set.padEnd(4)} contracts=${String(gate.contracts).padStart(4)} `
        + `gained=${String(gate.gained).padStart(4)} lost=${gate.lost}`);
    }
    expect(all.gained).toBe(206);
    expect(all.lost).toBe(0);
    expect(all.moved).toBe(54);
    expect(totals(PARTITION.filter((row) => row.set === 'A')).gained).toBe(53);
    expect(totals(PARTITION.filter((row) => row.set === 'B')).gained).toBe(15);
    expect(totals(PARTITION.filter((row) => row.set === 'NEW')).gained).toBe(138);
    expect(PARTITION.filter((row) => row.set === 'A')).toHaveLength(11);
    expect(PARTITION.filter((row) => row.set === 'B')).toHaveLength(4);
    expect(PARTITION.filter((row) => row.set === 'NEW')).toHaveLength(39);
    // The population of contracts publishing at least one eligible handler grew and nothing left it.
    expect(PARTITION.filter((row) => row.before.length > 0)).toHaveLength(96);
    expect(PARTITION.filter((row) => row.after.length > 0)).toHaveLength(135);
    expect(PARTITION.filter((row) => row.before.length > 0 && row.after.length === 0)).toEqual([]);
  });

  /**
   * THE MISSING +3, NAMED. `StableSwap` is the row whose silent stop-compiling made the recorded Set A total
   * read 50, and it is back at 4 eligible against the 1 it published pre-repair. Recompiled, not quoted.
   */
  it('MEASURED: StableSwap publishes 4 eligible handlers against the 1 recorded pre-repair', () => {
    const row = PARTITION.find((entry) => entry.rel.endsWith('StableSwap.sol'))!;
    const now = eligibleNow(busMap(row.corpus, row.rel)[row.name]);
    console.log(`[X160P] StableSwap before=${JSON.stringify(row.before)} now=${JSON.stringify(now)}`);
    expect(row.before).toHaveLength(1);
    expect([...now].sort()).toEqual([...row.after].sort());
    expect(now).toHaveLength(4);
  }, 900_000);

  /**
   * THE WRITERS. Eleven of the 206 gained handlers publish `writesState` other than false, measured from the
   * DIRECT artifact - the same classifier the census uses, where absent reads as writing. The recorded count
   * was ONE, which is the figure that made the row's positive case look subject-less.
   */
  it('MEASURED: eleven gained handlers are state-changing, not one', () => {
    const gainedWriters = PARTITION.flatMap((row) => row.after
      .filter((name) => !row.before.includes(name) && row.writes.includes(name))
      .map((name) => `${row.rel}::${row.name}.${name}`));
    for (const writer of gainedWriters) console.log(`[X160P] gained writer ${writer}`);
    expect(gainedWriters).toHaveLength(11);
    expect(gainedWriters).toContain('fallback/FallbackInputOutput.sol::Counter.inc');
    expect(gainedWriters).toContain('hacks/phishing-with-tx-origin/TxOrigin.sol::Attack.attack');
    // Recompiled for the two that carry VM evidence, so the classification is not only a record: `inc`
    // SETTLES (`Layer3RecoveredWriterSettlesX160.test.ts`) and `attack` is proved NOT to, fail-closed
    // (`Layer3RecoveredWriterX136.test.ts`). Nine of the eleven are unproven either way.
    for (const [rel, name, handler] of [
      ['fallback/FallbackInputOutput.sol', 'Counter', 'inc'],
      ['hacks/phishing-with-tx-origin/TxOrigin.sol', 'Attack', 'attack'],
    ] as const) {
      const direct = compileFileMulti(`${ROOTS.sbe}/${rel}`, DIRECT as never) as any;
      const abi = direct[name].abi.find((entry: any) => entry.name === handler);
      console.log(`[X160P] ${name}.${handler} writesState=${abi.writesState}`);
      expect(abi.writesState).toBe(true);
    }
  }, 900_000);

  /**
   * THE RE-TAKE ITSELF, one test per corpus so a slow corpus cannot hide a fast one's regression. Each
   * recompiles every recorded row in bus mode and requires the AFTER column as a SET.
   */
  it('MEASURED: mistswap re-compiles to the recorded partition', () => recheck('mistswap'), 1_800_000);
  it('MEASURED: solidity-by-example re-compiles to the recorded partition', () => recheck('sbe'), 1_800_000);
  it('MEASURED: EA re-compiles to the recorded partition', () => recheck('eacc'), 1_800_000);
});
