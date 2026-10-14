import { describe, expect, it } from 'vitest';
import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  blockhashKeeperBatonLockingBytecode, blockhashOracleLockingBytecode, buildBlockhashCommitment,
} from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { MockNetworkProvider } from '../../src/network/mock/index.js';
import { SignatureTemplate, TransactionBuilder } from '../../src/index.js';
import { BlockOracleUpdater, blockhashKeeperBatonUnlocker } from '../../src/oracle/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../src/utils.js';
import { aliceAddress, alicePriv, alicePub } from '../fixture/vars.js';
import { fundShippedFacets } from '../framed/shapes/harness.js';
import { COMPOSITION_LIMITS } from '../../../solidc/test/framed/machine.js';

const SOURCE = 'contract Reader(){ function check(int n, bytes32 expected) { require(blockhash(n) == expected); } }';

describe('SDK genesis blockhash keeper baton', () => {
  it('mints a confined keeper baton and the updater uses it without fixture seeding', async () => {
    const provider = new MockNetworkProvider();
    const fundingUtxo = await provider.addUtxo(aliceAddress, randomUtxo({ vout: 0, satoshis: 500_000n }));
    const deployed = await StatefulContract.deploy(compileString(SOURCE), [], {
      provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(), changeAddress: aliceAddress,
      blockhashKeeperPublicKey: alicePub, blockhashKeeperAmount: 20_000n,
    });
    const lock = blockhashKeeperBatonLockingBytecode(hexToBin(deployed.categoryId), alicePub);
    const [baton] = await provider.getUtxosForLockingBytecode(lock);
    expect(baton.token).toEqual({ category: deployed.categoryId, amount: 0n,
      nft: { capability: 'minting', commitment: '' } });
    expect(baton.satoshis).toBe(20_000n);
    const updater = new BlockOracleUpdater({
      contract: deployed.contract.inner, categoryId: deployed.categoryId, keeperKey: alicePriv,
      blockhashOracleCategory: deployed.categoryId,
      rpc: { request: async (): Promise<never> => { throw new Error('unused'); } },
    });
    const n = BigInt(await provider.getBlockHeight()) - 1n;
    const hash = new Uint8Array(32).fill(0xb7);
    expect(await updater.mintBlockhashPair(n, hash)).toMatch(/^[0-9a-f]{64}$/);
    expect((await provider.getUtxosForLockingBytecode(lock))[0].satoshis).toBe(18_000n);
    await expect(deployed.contract.call.check(n, hash).send()).resolves.toHaveProperty('txid');
    const current = (await provider.getUtxosForLockingBytecode(lock))[0];
    const builder = new TransactionBuilder({ provider })
      .addInput(current, blockhashKeeperBatonUnlocker(deployed.categoryId, alicePriv))
      .addOutput({ to: lock, amount: current.satoshis - 2_000n, token: current.token })
      .addOutput({
        to: blockhashOracleLockingBytecode(hexToBin(deployed.categoryId)), amount: 1_000n,
        token: { category: deployed.categoryId, amount: 0n,
          nft: { capability: 'none', commitment: binToHex(buildBlockhashCommitment(n - 1n, hash)) } },
      }).setLocktime(Number(n));
    const success = (): true | string => {
      const vm = createVirtualMachineBch2026ForProvider();
      return vm.stateSuccess(vm.evaluate({
        inputIndex: 0, sourceOutputs: generateLibauthSourceOutputs(builder.inputs),
        transaction: builder.buildLibauthTransaction(),
      }));
    };
    expect(success()).toBe(true);
    builder.outputs[1].token!.nft!.capability = 'mutable';
    expect(success()).not.toBe(true);
  }, 120_000);

  it('mints the same confined keeper baton in a framed genesis', async () => {
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    await fundShippedFacets(provider);
    const fundingUtxo = await provider.addUtxo(aliceAddress, randomUtxo({ vout: 0, satoshis: 5_000_000n }));
    const artifact = compileString(`pragma solidity ^0.8.20;
      contract FramedReader {
        function check(uint256 n, bytes32 expected) external view { require(blockhash(n) == expected); }
      }`, { evmCompat: true, composition: 'framed' });
    const deployed = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(), changeAddress: aliceAddress,
      blockhashKeeperPublicKey: alicePub, blockhashKeeperAmount: 20_000n,
    });
    const lock = blockhashKeeperBatonLockingBytecode(hexToBin(deployed.categoryId), alicePub);
    expect(await provider.getUtxosForLockingBytecode(lock)).toEqual([
      expect.objectContaining({ satoshis: 20_000n, token: {
        category: deployed.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' },
      } }),
    ]);
  }, 120_000);
});
