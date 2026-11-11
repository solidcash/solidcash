import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { asmToBytecode, validatorAddress, type FunctionSplitBundle } from '@solidcash/utils';
import { framedValidator } from '@solidcash/solidc/runtime';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringSplit } from '../../../../solidc/src/compiler.js';
import { SignatureTemplate } from '../../../src/index.js';
import type { Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callFramedEntry, type FramedCallResult } from '../../../src/framed/call/index.js';
import { functionSplitFor } from '../../../src/framed/deploy/split-registry.js';
import { alicePkh, alicePriv } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A helper cut out of its entry into an INTERNAL frame, whose call passes an amount it picks by a condition over the
 * arguments its entry computed.
 *
 * `Router.swap` is Router02's swap entries in small: it reads an amount off an oracle, computes the amounts it hands
 * `_swap`, and `_swap`, which the split cuts out of the entry, passes the pool `out` or nothing in each of its two
 * slots by the order of the two addresses it was given, as `_swap` picks a pair's `amount0Out` and `amount1Out` by
 * token order. Neither the cut's arguments nor its call's are stated by an expression over the caller's own facts, so
 * each is read from a run of the frame that computes it: the entry's for `_swap`, the cut's own for the pool's call.
 * The payable entry is `swapExactETHForTokens`'s shape: the cut runs in it and keeps its value, which a body of the
 * cut's own checks nothing of.
 */

const FRAMED = { composition: 'framed' as const, evmCompat: true, suppressWarnings: true, split: 'func' as const };

const PAD = 'ab'.repeat(3000);
const SOURCE = `pragma solidity ^0.8.20;
interface IOracle {
  function read() external view returns (uint256);
}
interface IPool {
  function swap(uint256 amount0Out, uint256 amount1Out) external;
}
interface IDirectory {
  function poolFor(address a, address b) external view returns (address);
}
contract Directory {
  address public pool;
  constructor(address p) { pool = p; }
  function poolFor(address a, address b) external view returns (address) {
    require(a != b, "Directory: IDENTICAL");
    return pool;
  }
}
contract Oracle {
  uint256 public value;
  constructor(uint256 v) { value = v; }
  function read() external view returns (uint256) { return value; }
}
contract Pool {
  uint256 public last0;
  uint256 public last1;
  function swap(uint256 amount0Out, uint256 amount1Out) external { last0 = amount0Out; last1 = amount1Out; }
}
contract Router {
  address public immutable oracle;
  address public immutable directory;
  constructor(address o, address d) { oracle = o; directory = d; }
  function _swap(uint256[] memory amounts, address[] memory path) internal {
    bytes memory pad = hex"${PAD}";
    require(pad.length > 0);
    if (path.length == 2) {
      uint256 out0;
      uint256 out1;
      if (path[0] < path[1]) {
        out1 = amounts[1];
      } else {
        out0 = amounts[1];
      }
      // The pool is the one a call names, as Router02's _swap asks the factory for each pair.
      address target = IDirectory(directory).poolFor(path[0], path[1]);
      IPool(target).swap(out0, out1);
      return;
    }
    revert("Router: PATH");
  }
  function quote(uint256 amountIn) internal view returns (uint256[] memory amounts) {
    amounts = new uint256[](2);
    amounts[0] = amountIn;
    amounts[1] = amountIn * IOracle(oracle).read() / 1000;
  }
  function swap(uint256 amountIn, address[] calldata path) external {
    _swap(quote(amountIn), path);
  }
  function swapPaid(address[] calldata path) external payable {
    _swap(quote(msg.value), path);
  }
}`;

const VALIDATOR = framedValidator.buildValidatorProgram();
const FUNDER = new SignatureTemplate(alicePriv).unlockP2PKH();
const USER = encodeLockingBytecodeP2pkh(alicePkh);
const USER_ADDRESS = ((): string => {
  const encoded = lockingBytecodeToCashAddress({ bytecode: USER, prefix: 'bchtest' });
  if (typeof encoded === 'string') throw new Error(encoded);
  return encoded.address;
})();
/** Two addresses in either order, so each run takes one arm of `_swap`'s condition. */
const LOW = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x11));
const HIGH = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x77));

const shardsOf = (primaryContractName: string, maxShardBytes?: number): FunctionSplitBundle =>
  compileStringSplit(SOURCE, {
    ...FRAMED, primaryContractName, ...(maxShardBytes === undefined ? {} : { maxShardBytes }),
  }) as FunctionSplitBundle;
const openRouter = shardsOf('Router');
const inlined = Math.min(...['swap', 'swapPaid'].map((name) =>
  asmToBytecode(openRouter.shards.find((shard) => shard.function === name)!.artifact.bytecode).length));
const UNITS = {
  Oracle: shardsOf('Oracle'), Pool: shardsOf('Pool'), Directory: shardsOf('Directory'),
  // Just under both entries' size, so the split cuts `_swap` out of each.
  Router: shardsOf('Router', inlined - 1),
};

interface Deployment {
  readonly bundle: FunctionSplitBundle;
  readonly categoryId: string;
  readonly address: Uint8Array;
}

interface Chain {
  readonly network: MockNetworkProvider;
  readonly oracle: Deployment;
  readonly pool: Deployment;
  readonly directory: Deployment;
  readonly router: Deployment;
  readonly coin: () => Promise<Utxo>;
}

let coins = 0;

async function chain(): Promise<Chain> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  await fundShippedFacets(network);
  const coin = async (): Promise<Utxo> => {
    coins += 1;
    const utxo = { txid: `6c${coins.toString(16).padStart(6, '0')}`.padEnd(64, 'c'), vout: 0, satoshis: 5_000_000n };
    await network.addUtxo(binToHex(USER), utxo);
    return utxo;
  };
  const deploy = async (bundle: FunctionSplitBundle, args: readonly unknown[]): Promise<Deployment> => {
    const { categoryId } = await deployStatefulContract(bundle.logical, [...args] as never, {
      provider: network, fundingUtxo: await coin(), funder: FUNDER, changeAddress: USER_ADDRESS,
      threadCount: 2, validatorCount: 1, functionSplit: bundle,
    });
    return {
      bundle: functionSplitFor(network, categoryId) ?? bundle, categoryId,
      address: validatorAddress(hexToBin(categoryId), VALIDATOR),
    };
  };
  const oracle = await deploy(UNITS.Oracle, [2500n]);
  const pool = await deploy(UNITS.Pool, []);
  const directory = await deploy(UNITS.Directory, [pool.address]);
  const router = await deploy(UNITS.Router, [oracle.address, directory.address]);
  return { network, oracle, pool, directory, router, coin };
}

async function enter(
  c: Chain, functionName: 'swap' | 'swapPaid', path: readonly Uint8Array[], amountIn: bigint,
): Promise<FramedCallResult> {
  return callFramedEntry({
    provider: c.network, artifact: c.router.bundle.logical, categoryId: c.router.categoryId, split: c.router.bundle,
    functionName, args: functionName === 'swap' ? [amountIn, [...path]] : [[...path]],
    ...(functionName === 'swapPaid' ? { value: amountIn } : {}),
    externals: {
      IOracle: { artifact: c.oracle.bundle.logical, categoryId: c.oracle.categoryId },
      IPool: { artifact: c.pool.bundle.logical, categoryId: c.pool.categoryId },
      IDirectory: { artifact: c.directory.bundle.logical, categoryId: c.directory.categoryId },
    },
    callerUtxo: await c.coin(), callerLockingBytecode: USER, funder: FUNDER, changeAddress: USER_ADDRESS,
    vm: compositionMachine(), validatorProgram: VALIDATOR,
  });
}

const objections = (result: FramedCallResult): string => result.verdicts.filter((verdict) => !verdict.accepted)
  .map((verdict) => `${verdict.id}: ${verdict.objection ?? 'refused'}`).join('; ');

describe('a call an internal cut makes with an amount it picks by its arguments', () => {
  it('cuts _swap into an INTERNAL shard', () => {
    expect(UNITS.Router.internalCuts.map((cut) => cut.name)).toContain('_swap(uint256[],address[])');
  });

  it('plans the cut\'s call from a run of the cut, in either arm', async () => {
    const c = await chain();
    // Contract addresses, as a router's path names tokens: two framed contracts' locks in either order.
    for (const path of [[c.oracle.address, c.pool.address], [c.pool.address, c.oracle.address]]) {
      const result = await enter(c, 'swap', path, 1_000n);
      expect({ accepted: result.accepted, objections: objections(result) }).toStrictEqual({ accepted: true, objections: '' });
      expect(result.completed.map((frame) => frame.functionName), JSON.stringify(result.completed.map((frame) => frame.functionName))).toContain('Router._swap()');
    }
  }, 600_000);

  it('runs the cut in a payable entry, which keeps the value it was sent', async () => {
    const c = await chain();
    const result = await enter(c, 'swapPaid', [LOW, HIGH], 100_000n);
    expect({ accepted: result.accepted, objections: objections(result) }).toStrictEqual({ accepted: true, objections: '' });
  }, 600_000);
});
