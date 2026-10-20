/**
 * A framed callee that pays tokens from its container: `Payer.run` calls `Treasury.payOut`, whose frame spends the
 * treasury's container for its reserve category and pays the recipient in a token run of its own (spec 4b), the
 * treasury's own close handing back what it pays. Two frames that pay one contract's category in one transaction are
 * refused by name.
 */
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { validatorAddress } from '@solidcash/utils';
import { framedValidator } from 'solidc';
import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../../solidc/src/compiler.js';
import { callFramedEntry, type FramedCallResult } from '../../src/framed/call/index.js';
import { framedTokenContainerLockingBytecode } from '../../src/framed/call/token-containers.js';
import { SignatureTemplate } from '../../src/index.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { deployStatefulContract } from '../../src/stateful/sc-deploy.js';
import { aliceAddress, alicePkh, alicePriv, bobPkh } from '../fixture/vars.js';
import { fundShippedFacets } from '../framed/shapes/harness.js';

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' contract Treasury { bytes32 immutable reserve;'
  + '   constructor(bytes32 reserve_) { reserve = reserve_; }'
  + '   function payOut(address to, int amount) external { bytes32 category = reserve;'
  + '     require(this.tokens[category].tokenAmount >= amount); this.tokens[category].transfer(to, amount); } }'
  + ' contract Payer { Treasury public treasury; uint256 public runs;'
  + '   constructor(Treasury treasury_) { treasury = treasury_; }'
  + '   function run(address to, int amount) external { runs = runs + 1; treasury.payOut(to, amount); }'
  + '   function runTwice(address to, int amount) external {'
  + '     treasury.payOut(to, amount); treasury.payOut(to, amount); } }';

describe('a framed callee that pays tokens', () => {
  it('pays from the callee contract\'s container in a run of its own, on real consensus limits', async () => {
    const compiled = compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true } as never);
    const treasury = compiled.Treasury!;
    const payer = compiled.Payer!;
    const provider = new MockNetworkProvider();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const alice = new SignatureTemplate(alicePriv);
    const aliceLock = encodeLockingBytecodeP2pkh(alicePkh);
    const bobLock = encodeLockingBytecodeP2pkh(bobPkh);
    await fundShippedFacets(provider);
    const coin = async (txid: string, satoshis: bigint): Promise<{ txid: string; vout: number; satoshis: bigint }> => {
      const utxo = { txid: txid.repeat(32), vout: 0, satoshis };
      await provider.addUtxo(binToHex(aliceLock), utxo);
      return utxo;
    };
    const tokenFunding = await coin('e2', 100_000n);
    const category = tokenFunding.txid;
    const treasuryDeployment = await deployStatefulContract(treasury, [hexToBin(category)], {
      provider, fundingUtxo: await coin('e1', 3_000_000n), funder: alice.unlockP2PKH(), changeAddress: aliceAddress,
      nativeToken: { funding: tokenFunding, reserve: 1_000n },
    });
    const treasuryAddress = validatorAddress(
      hexToBin(treasuryDeployment.categoryId), framedValidator.buildValidatorProgram(),
    );
    const payerDeployment = await deployStatefulContract(payer, [treasuryAddress], {
      provider, fundingUtxo: await coin('e3', 3_000_000n), funder: alice.unlockP2PKH(), changeAddress: aliceAddress,
    });
    const container = framedTokenContainerLockingBytecode(treasuryDeployment.categoryId, category);
    const tokensAt = async (lock: Uint8Array): Promise<bigint> => (await provider.getUtxosForLockingBytecode(lock))
      .filter((utxo) => utxo.token?.category === category)
      .reduce((sum, utxo) => sum + utxo.token!.amount, 0n);
    expect(await tokensAt(container)).toBe(1_000n);

    const call = async (functionName: string, args: unknown[], txid: string): Promise<FramedCallResult> =>
      callFramedEntry({
        provider, artifact: payer, categoryId: payerDeployment.categoryId, functionName, args: args as never,
        callerUtxo: await coin(txid, 300_000n), callerLockingBytecode: aliceLock, funder: alice.unlockP2PKH(), vm,
        externals: { Treasury: { artifact: treasury, categoryId: treasuryDeployment.categoryId } },
      });
    const paid = await call('run', [bobLock, 250n], 'c1');
    expect(paid.verdicts.filter((verdict) => !verdict.accepted)).toEqual([]);
    expect(paid.broadcast).toBeDefined();
    expect(paid.completed.map((frame) => frame.functionName)).toEqual(['Treasury.payOut()', 'Payer.run()']);
    expect(await tokensAt(bobLock)).toBe(250n);
    expect(await tokensAt(container)).toBe(750n);

    await expect(call('runTwice', [bobLock, 10n], 'c2')).rejects.toThrow(/two frames pay tokens/);
  }, 900_000);
});
