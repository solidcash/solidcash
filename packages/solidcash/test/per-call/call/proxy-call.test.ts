import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { buildPushdataCommitment, bytesToHex, type StateLayout } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployMaster, readPerCallDeployment } from '../../../src/per-call/deploy/index.js';
import { buildProxyArtifact, deployPerCallProxy } from '../../../src/per-call/proxy/index.js';
import { callPerCallProxyEntry } from '../../../src/per-call/proxy/deploy.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM } from '../shapes/harness.js';

/**
 * Calling an entry of a deployed per-call implementation through the proxy in front of it.
 *
 * A user's coin enters the proxy's fallback, which forwards the call data to the address its record holds, and the
 * implementation's entry runs as a delegate frame on the proxy's records. The call is the same hop a deployment's
 * `initialize` is, on the deployment's own live outpoints, so this drives the shipped deployment, composer,
 * derivation and machine and then reads the state back through the shipped deployment reader and decoder.
 */

const IMPL_CATEGORY = '11'.repeat(32);
const PROXY_CATEGORY = '22'.repeat(32);

// The implementation declares the field the fallback forwards to beside the state its entries write: its own write
// rebuilds the record from its declaration, so the address has to be one of the fields that survives it.
const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Impl {'
  + '   address public implementation;'
  + '   uint public initialized;'
  + '   int public total;'
  + '   function initialize(address expected) {'
  + '     require(msg.sender == expected);'
  + '     require(this.initialized == 0);'
  + '     this.initialized = 1;'
  + '     this.total = 5;'
  + '   }'
  + '   function add(int by) { this.total = this.total + by; require(this.total >= 0); }'
  + '   function peek() view returns (int) { return this.total; }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'per-call' });
const impl = artifacts.Impl!;

/** The commitment the shipped encoder materializes from one state of a layout. */
function commitment(layout: StateLayout, state: Record<string, bigint | Uint8Array>): Uint8Array {
  return new Uint8Array(Buffer.from(buildPushdataCommitment(layout, state, 0), 'hex'));
}

/** The record's own state, read back through the shipped deployment reader and decoded as a field map. */
async function recordState(network: MockNetworkProvider, categoryId: string): Promise<string> {
  const deployment = await readPerCallDeployment(network, categoryId, impl.stateLayout!);
  return bytesToHex(new Uint8Array(Buffer.from(deployment.records[0]!.token!.nft!.commitment, 'hex')));
}

/** The implementation's address at its seeded category, `addrV(category)`. */
function implementationAddress(): Uint8Array {
  return deployMaster(impl, new Uint8Array(Buffer.from(IMPL_CATEGORY, 'hex')), VALIDATOR_PROGRAM).address;
}

/** A deployment funded from the deployer's own P2PKH lock, plus two coins a caller can enter a hop with. */
async function deployedWithCallerCoins(network: MockNetworkProvider): Promise<{
  readonly proxyCategoryId: string;
  readonly implementationCategoryId: string;
  readonly deployerLock: Uint8Array;
  readonly changeAddress: string;
  readonly hopCoin: { txid: string; vout: number; satoshis: bigint };
  readonly callCoin: { txid: string; vout: number; satoshis: bigint };
  readonly funder: ReturnType<Contract['unlock']['spend']>;
}> {
  const signature = new SignatureTemplate(alicePriv);
  const source = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = source.unlock.spend(alicePub, signature);
  // A hop's caller funding signs for its own P2PKH lock, which is the lock the root frame binds `msg.sender` to.
  const callerFunder = signature.unlockP2PKH();
  const implFunding = { txid: IMPL_CATEGORY, vout: 0, satoshis: 500_000n };
  const proxyFunding = { txid: PROXY_CATEGORY, vout: 0, satoshis: 500_000n };
  const hopCoin = { txid: '33'.repeat(32), vout: 0, satoshis: 300_000n };
  const callCoin = { txid: '44'.repeat(32), vout: 0, satoshis: 300_000n };
  for (const coin of [implFunding, proxyFunding]) await network.addUtxo(source.address, coin);
  // A hop's root frame binds `msg.sender` to the lock of the input it names, so the caller's own coins sit at that
  // 25-byte P2PKH lock rather than at the p2pkh contract's address.
  const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);
  for (const coin of [hopCoin, callCoin]) await network.addUtxo(binToHex(deployerLock), coin);

  const deployment = await deployPerCallProxy({
    provider: network,
    implementationArtifact: impl,
    implementationDeploy: { fundingUtxo: implFunding, funder, changeAddress: source.address },
    proxyDeploy: { fundingUtxo: proxyFunding, funder, changeAddress: source.address },
    initialize: { functionName: 'initialize', args: [deployerLock] },
    callerLockingBytecode: deployerLock,
    callerFunding: { utxo: hopCoin, funder: callerFunder, changeAddress: source.address },
    vm: compositionMachine(),
  });
  expect(deployment.initialize.broadcast).toBeDefined();
  return {
    proxyCategoryId: deployment.proxy.categoryId,
    implementationCategoryId: deployment.implementation.categoryId,
    deployerLock, changeAddress: source.address, hopCoin, callCoin, funder: callerFunder,
  };
}

describe('a call into a per-call implementation through its proxy', () => {
  it('derives the hop, accepts every contract input, broadcasts it, and the record carries what the entry computed',
    async () => {
      const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
      const funded = await deployedWithCallerCoins(network);

      // The deployment's own initialize hop ran on chain, so the state the entry computed is the state the next
      // call reads.
      const afterInitialize = await recordState(network, funded.proxyCategoryId);
      expect(afterInitialize).toBe(bytesToHex(commitment(impl.stateLayout!, {
        implementation: implementationAddress(), initialized: 1n, total: 5n,
      })));

      const result = await callPerCallProxyEntry({
        provider: network,
        implementationArtifact: impl,
        proxyArtifact: buildProxyArtifact(impl),
        proxyCategoryId: funded.proxyCategoryId,
        implementationCategoryId: funded.implementationCategoryId,
        functionName: 'add',
        args: [4n],
        callerUtxo: funded.callCoin,
        callerLockingBytecode: funded.deployerLock,
        funder: funded.funder,
        changeAddress: funded.changeAddress,
        vm: compositionMachine(),
      });

      // The proxy's fallback frame is entered first and the implementation's entry completes before it.
      expect(result.completed.map((frame) => frame.functionName))
        .toStrictEqual([`${impl.contractName}.add()`, 'ImplProxy.__fallback()']);
      expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
      expect(result.accepted).toBe(true);
      expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
      expect(bytesToHex(result.writtenCommitments[0]!)).toBe(bytesToHex(commitment(impl.stateLayout!, {
        implementation: implementationAddress(), initialized: 1n, total: 9n,
      })));

      // The state the broadcast left behind, read back through the shipped reader rather than recomputed here.
      expect(await recordState(network, funded.proxyCategoryId))
        .toBe(bytesToHex(commitment(impl.stateLayout!, {
          implementation: implementationAddress(), initialized: 1n, total: 9n,
        })));
    });

  it('refuses an entry the implementation does not publish, and broadcasts nothing', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funded = await deployedWithCallerCoins(network);
    const before = await recordState(network, funded.proxyCategoryId);

    await expect(callPerCallProxyEntry({
      provider: network,
      implementationArtifact: impl,
      proxyArtifact: buildProxyArtifact(impl),
      proxyCategoryId: funded.proxyCategoryId,
      implementationCategoryId: funded.implementationCategoryId,
      functionName: 'noSuchEntry',
      args: [],
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    })).rejects.toThrow(/publishes no entry "noSuchEntry"/);

    expect(await recordState(network, funded.proxyCategoryId)).toBe(before);
  });

  it('refuses a returning entry, naming the fact the hop lacks: it records no implementation `retval`', async () => {
    // The hop delegates into the implementation frame, whose `retval` no stage records, so a value an entry returns
    // cannot be handed back through this call; the refusal names that rather than losing the value silently.
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funded = await deployedWithCallerCoins(network);

    await expect(callPerCallProxyEntry({
      provider: network,
      implementationArtifact: impl,
      proxyArtifact: buildProxyArtifact(impl),
      proxyCategoryId: funded.proxyCategoryId,
      implementationCategoryId: funded.implementationCategoryId,
      functionName: 'peek',
      args: [],
      callerUtxo: funded.callCoin,
      callerLockingBytecode: funded.deployerLock,
      funder: funded.funder,
      changeAddress: funded.changeAddress,
      vm: compositionMachine(),
    })).rejects.toThrow(/records no `retval` for the implementation frame/);
  });
});
