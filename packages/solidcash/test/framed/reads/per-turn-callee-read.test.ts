import { describe, expect, it } from 'vitest';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { bytesToHex } from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import { readFramedEntry, type FramedReadResult } from '../../../src/framed/read/index.js';
import { registerDeployment } from '../../../src/stateful/deployment-registry.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { lockingBytecodeToSolidityAddressPayload } from '../../../src/utils.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { addressOf, deploy, deployBesideWith, type Deployed } from '../call/value-harness.js';

/**
 * A read whose calls reach deployments the caller names by address, each turn of a loop its own.
 *
 * The pools are two deployments of one contract, both registered with the provider, the second one last. `Router.one`
 * reads the pool its argument names; `Router.total` sums the reserve of each pool in its argument, one call per turn,
 * as a library's chained amounts reach one pair per hop; `Router.salted` reaches each pool through a library function
 * that hashes the pool's address first, as a pair's address is hashed. Each turn reaches the pool its own target
 * names, in a block of its own over its own records, so a sum is the two reserves rather than one pool's twice.
 * `Holder.held` reaches the pool its own state names, as a router reaches the factory it stores: the read plans the
 * call from the holder's live record, so it reaches the first pool, not the one registered last.
 */

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' interface IPool { function reserve() external view returns (uint256); }'
  + ' contract Pool { uint256 public r; constructor(uint256 x) { r = x; }'
  + '   function reserve() external view returns (uint256) { return r; } }'
  + ' library Reach {'
  + '   function salt(address a) internal pure returns (uint256) { return uint256(keccak256(abi.encodePacked(a))) % 7; }'
  + '   function at(address a) internal view returns (uint256) { return salt(a) + IPool(a).reserve(); } }'
  + ' contract Router { uint256 public unit = 1;'
  + '   function one(address pool) external view returns (uint256) { return IPool(pool).reserve(); }'
  + '   function total(address[] memory pools) external view returns (uint256 t) {'
  + '     for (uint256 i = 0; i < pools.length; i++) { t += IPool(pools[i]).reserve(); } }'
  + '   function salted(address[] memory pools) external view returns (uint256 t) {'
  + '     for (uint256 i = 0; i < pools.length; i++) { t += Reach.at(pools[i]); } } }'
  + ' contract Holder { IPool public pool; constructor(IPool p) { pool = p; }'
  + '   function held() external view returns (uint256) { return pool.reserve(); } }';

const compiled = compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true } as never);
const router = compiled.Router!;
const pool = compiled.Pool!;
const holder = compiled.Holder!;

const RESERVES = [5n, 9n] as const;

interface World {
  readonly deployed: Deployed;
  /** Each pool's address, in the order they were deployed and registered. */
  readonly pools: readonly Uint8Array[];
  /** The holder's category, which keeps the first pool in its state. */
  readonly holder: string;
}

let world: Promise<World> | undefined;

/** The router, both pools, each registered under its address and the contract's name, and the holder of the first. */
async function deployed(): Promise<World> {
  world ??= (async (): Promise<World> => {
    const routerDeployed = await deploy(router);
    const funder = new Contract(p2pkhArtifact, [alicePkh], { provider: routerDeployed.provider });
    const pools: Uint8Array[] = [];
    for (const [index, reserve] of RESERVES.entries()) {
      const fundingUtxo = { txid: `${'6e'.repeat(31)}${(0xa0 + index).toString(16)}`, vout: 0, satoshis: 500_000n };
      await routerDeployed.provider.addUtxo(funder.address, fundingUtxo);
      const { categoryId } = await deployStatefulContract(pool, [reserve], {
        provider: routerDeployed.provider, fundingUtxo, changeAddress: funder.address,
        funder: funder.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      });
      const address = addressOf(pool, categoryId);
      registerDeployment(routerDeployed.provider, {
        contractName: 'Pool', address: bytesToHex(address), lockingBytecode: bytesToHex(address),
        contract: { inner: { artifact: pool }, categoryId },
      });
      pools.push(address);
    }
    const holderCategory = await deployBesideWith(routerDeployed, holder, [pools[0]!], `${'6e'.repeat(31)}b0`);
    return { deployed: routerDeployed, pools, holder: holderCategory };
  })();
  return world;
}

async function read(chain: World, functionName: string, args: readonly unknown[]): Promise<FramedReadResult> {
  return readFramedEntry({
    provider: chain.deployed.provider, artifact: router, categoryId: chain.deployed.categoryId, functionName,
    args: args as never, vm: compositionMachine(),
  });
}

/** `Reach.salt`: the keccak256 of the 20-byte identity a pool's address packs as, modulo 7. */
function saltOf(address: Uint8Array): bigint {
  const digest = keccak_256(lockingBytecodeToSolidityAddressPayload(address)!);
  return BigInt(`0x${bytesToHex(digest)}`) % 7n;
}

describe('a read whose calls reach deployments the caller names by address', () => {
  it('reaches the pool an argument names, not the one registered last', async () => {
    const chain = await deployed();
    const result = await read(chain, 'one', [chain.pools[0]]);
    expect(result.objection).toBeUndefined();
    expect(result.value).toBe(RESERVES[0]);
  });

  it('reaches the pool the caller keeps in its own state, not the one registered last', async () => {
    const chain = await deployed();
    const result = await readFramedEntry({
      provider: chain.deployed.provider, artifact: holder, categoryId: chain.holder, functionName: 'held',
      vm: compositionMachine(),
    });
    expect(result.objection).toBeUndefined();
    expect(result.value).toBe(RESERVES[0]);
  });

  it('reaches each turn\'s pool over its own records', async () => {
    const chain = await deployed();
    const result = await read(chain, 'total', [chain.pools]);
    expect(result.objection).toBeUndefined();
    expect(result.value).toBe(RESERVES[0] + RESERVES[1]);
  });

  it('reaches each turn\'s pool through a library function that hashes its address', async () => {
    const chain = await deployed();
    const result = await read(chain, 'salted', [chain.pools]);
    expect(result.objection).toBeUndefined();
    expect(result.value).toBe(saltOf(chain.pools[0]!) + RESERVES[0] + saltOf(chain.pools[1]!) + RESERVES[1]);
  });
});
