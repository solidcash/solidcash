/**
 * A framed callee that pays tokens from its container: `Payer.run` calls `Treasury.payOut`, whose frame spends the
 * treasury's container for its reserve category and pays the recipient in a token run of its own (spec 4b), the
 * treasury's own close handing back what it pays. Each master owns the containers whose unlocking names it, so two
 * frames of one contract pay one category from containers of their own, and a run spends several containers when one
 * does not cover its sends, folding the smallest few besides into the one it keeps. A vault's callee frames wrap into
 * and unwrap from a BchNative token.
 */
import { readFileSync } from 'node:fs';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { validatorAddress } from '@solidcash/utils';
import { framedValidator } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../../solidc/src/compiler.js';
import { callFramedEntry, type FramedCallResult } from '../../src/framed/call/index.js';
import { framedTokenContainerLockingBytecode } from '../../src/framed/call/token-containers.js';
import { readFramedEntry } from '../../src/framed/read/index.js';
import type { Utxo } from '../../src/interfaces.js';
import { SignatureTemplate } from '../../src/index.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { deployStatefulContract } from '../../src/stateful/sc-deploy.js';
import { aliceAddress, alicePkh, alicePriv, aliceTokenAddress, bobPkh } from '../fixture/vars.js';
import { fundShippedFacets } from '../framed/shapes/harness.js';

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' contract Treasury { bytes32 immutable reserve;'
  + '   constructor(bytes32 reserve_) { reserve = reserve_; }'
  + '   function payOut(address to, int amount) external { bytes32 category = reserve;'
  + '     require(this.tokens[category].tokenAmount >= amount); this.tokens[category].transfer(to, amount); }'
  + '   function held() external view returns (int) { bytes32 category = reserve;'
  + '     return this.tokens[category].tokenAmount; } }'
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
    // A view reads the reserve the read's own transaction spends.
    const held = async (): Promise<unknown> => (await readFramedEntry({
      provider, artifact: treasury, categoryId: treasuryDeployment.categoryId, functionName: 'held', args: [], vm,
    })).value;
    expect(await held()).toBe(1_000n);

    const call = async (functionName: string, args: unknown[], txid: string): Promise<FramedCallResult> =>
      callFramedEntry({
        provider, artifact: payer, categoryId: payerDeployment.categoryId, functionName, args: args as never,
        callerUtxo: await coin(txid, 300_000n), callerLockingBytecode: aliceLock, funder: alice.unlockP2PKH(), vm,
        externals: { Treasury: { artifact: treasury, categoryId: treasuryDeployment.categoryId } },
      });
    const settled = (result: FramedCallResult): void => {
      expect(result.verdicts.filter((verdict) => !verdict.accepted)).toEqual([]);
      expect(result.broadcast).toBeDefined();
    };
    const paid = await call('run', [bobLock, 250n], 'c1');
    settled(paid);
    expect(paid.completed.map((frame) => frame.functionName)).toEqual(['Treasury.payOut()', 'Payer.run()']);
    expect(await tokensAt(bobLock)).toBe(250n);
    expect(await tokensAt(container)).toBe(750n);

    // Two frames of the treasury pay from containers of their own: one container is not enough for both.
    await expect(call('runTwice', [bobLock, 10n], 'c2')).rejects.toThrow(/more frames than the 1 containers/);
    await provider.addUtxo(binToHex(container), {
      txid: 'e4'.repeat(32), vout: 0, satoshis: 1_000n, token: { category, amount: 500n },
    });
    settled(await call('runTwice', [bobLock, 100n], 'c3'));
    expect(await tokensAt(bobLock)).toBe(450n);
    expect(await tokensAt(container)).toBe(1_050n);

    // A payment past the largest container spends both, the second drained into the first's recreation.
    settled(await call('run', [bobLock, 900n], 'c4'));
    expect(await tokensAt(bobLock)).toBe(1_350n);
    expect(await tokensAt(container)).toBe(150n);
    expect(await held()).toBe(150n);
    expect(await provider.getUtxosForLockingBytecode(container)).toHaveLength(1);

    // A payment also folds the two smallest containers into the one it keeps, so containers do not pile up.
    for (const [txid, amount] of [['e5', 5n], ['e6', 3n], ['e7', 2n]] as const) {
      await provider.addUtxo(binToHex(container), {
        txid: txid.repeat(32), vout: 0, satoshis: 1_000n, token: { category, amount },
      });
    }
    settled(await call('run', [bobLock, 10n], 'c5'));
    expect(await tokensAt(bobLock)).toBe(1_360n);
    expect((await provider.getUtxosForLockingBytecode(container)).map((utxo) => utxo.token!.amount)
      .sort((left, right) => Number(left - right))).toEqual([5n, 145n]);
    expect(await held()).toBe(150n);
  }, 900_000);

  it('pays from a callee container keyed by the category its call passes', async () => {
    const source = 'pragma solidity ^0.8.0;'
      + ' contract Vaulted { uint256 public payouts;'
      + '   function payOutOf(bytes32 category, address to, int amount) external {'
      + '     payouts = payouts + 1; this.tokens[category].transfer(to, amount); } }'
      + ' contract Router { Vaulted public vault; constructor(Vaulted vault_) { vault = vault_; }'
      + '   function route(bytes32 category, address to, int amount) external { vault.payOutOf(category, to, amount); } }';
    const compiled = compileStringMulti(source, { composition: 'framed', evmCompat: true } as never);
    const provider = new MockNetworkProvider();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const alice = new SignatureTemplate(alicePriv);
    const aliceLock = encodeLockingBytecodeP2pkh(alicePkh);
    const bobLock = encodeLockingBytecodeP2pkh(bobPkh);
    await fundShippedFacets(provider);
    const coin = async (txid: string, satoshis: bigint): Promise<Utxo> => {
      const utxo = { txid: txid.repeat(32), vout: 0, satoshis };
      await provider.addUtxo(binToHex(aliceLock), utxo);
      return utxo;
    };
    const vaulted = await deployStatefulContract(compiled.Vaulted!, [], {
      provider, fundingUtxo: await coin('91', 3_000_000n), funder: alice.unlockP2PKH(), changeAddress: aliceAddress,
    });
    const router = await deployStatefulContract(compiled.Router!, [
      validatorAddress(hexToBin(vaulted.categoryId), framedValidator.buildValidatorProgram()),
    ], {
      provider, fundingUtxo: await coin('92', 3_000_000n), funder: alice.unlockP2PKH(), changeAddress: aliceAddress,
    });
    const category = '93'.repeat(32);
    const container = framedTokenContainerLockingBytecode(vaulted.categoryId, category);
    await provider.addUtxo(binToHex(container), {
      txid: '94'.repeat(32), vout: 0, satoshis: 1_000n, token: { category, amount: 300n },
    });
    const routed = await callFramedEntry({
      provider, artifact: compiled.Router!, categoryId: router.categoryId, functionName: 'route',
      args: [hexToBin(category), bobLock, 120n], callerUtxo: await coin('95', 300_000n),
      callerLockingBytecode: aliceLock, funder: alice.unlockP2PKH(), vm,
      externals: { Vaulted: { artifact: compiled.Vaulted!, categoryId: vaulted.categoryId } },
    });
    expect(routed.verdicts.filter((verdict) => !verdict.accepted)).toEqual([]);
    expect(routed.broadcast).toBeDefined();
    const tokensAt = async (lock: Uint8Array): Promise<bigint> => (await provider.getUtxosForLockingBytecode(lock))
      .filter((utxo) => utxo.token?.category === category)
      .reduce((sum, utxo) => sum + utxo.token!.amount, 0n);
    expect(await tokensAt(bobLock)).toBe(120n);
    expect(await tokensAt(container)).toBe(180n);
  }, 900_000);

  it('drops a token send on a branch the body did not take', async () => {
    const source = 'pragma solidity ^0.8.0;'
      + ' contract Till { bytes32 immutable reserve;'
      + '   constructor(bytes32 reserve_) { reserve = reserve_; }'
      + '   function payIf(address to, int amount, bool really) external { bytes32 category = reserve;'
      + '     if (really) { this.tokens[category].transfer(to, amount); } } }';
    const till = compileStringMulti(source, { composition: 'framed', evmCompat: true } as never).Till!;
    const provider = new MockNetworkProvider();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const alice = new SignatureTemplate(alicePriv);
    const aliceLock = encodeLockingBytecodeP2pkh(alicePkh);
    const bobLock = encodeLockingBytecodeP2pkh(bobPkh);
    await fundShippedFacets(provider);
    const coin = async (txid: string, satoshis: bigint): Promise<Utxo> => {
      const utxo = { txid: txid.repeat(32), vout: 0, satoshis };
      await provider.addUtxo(binToHex(aliceLock), utxo);
      return utxo;
    };
    const category = 'a5'.repeat(32);
    const deployment = await deployStatefulContract(till, [hexToBin(category)], {
      provider, fundingUtxo: await coin('a6', 3_000_000n), funder: alice.unlockP2PKH(), changeAddress: aliceAddress,
    });
    const container = framedTokenContainerLockingBytecode(deployment.categoryId, category);
    await provider.addUtxo(binToHex(container), {
      txid: 'a7'.repeat(32), vout: 0, satoshis: 1_000n, token: { category, amount: 100n },
    });
    const tokensAt = async (lock: Uint8Array): Promise<bigint> => (await provider.getUtxosForLockingBytecode(lock))
      .filter((utxo) => utxo.token?.category === category)
      .reduce((sum, utxo) => sum + utxo.token!.amount, 0n);
    const payIf = async (really: boolean, txid: string): Promise<FramedCallResult> => callFramedEntry({
      provider, artifact: till, categoryId: deployment.categoryId, functionName: 'payIf', args: [bobLock, 30n, really],
      callerUtxo: await coin(txid, 300_000n), callerLockingBytecode: aliceLock, funder: alice.unlockP2PKH(), vm,
    });
    for (const [really, txid] of [[false, 'a8'], [true, 'a9']] as const) {
      const result = await payIf(really, txid);
      expect(result.verdicts.filter((verdict) => !verdict.accepted)).toEqual([]);
      expect(result.broadcast).toBeDefined();
    }
    expect(await tokensAt(bobLock)).toBe(30n);
    expect(await tokensAt(container)).toBe(70n);
  }, 900_000);

  it('pays two categories from one frame, a coin of the caller\'s filling the index between the runs', async () => {
    const source = 'pragma solidity ^0.8.0;'
      + ' contract Twin { bytes32 immutable first; bytes32 immutable second;'
      + '   constructor(bytes32 first_, bytes32 second_) { first = first_; second = second_; }'
      + '   function payBoth(address to, int x, int y) external { bytes32 a = first; bytes32 b = second;'
      + '     this.tokens[a].transfer(to, x); this.tokens[a].transfer(to, x); this.tokens[b].transfer(to, y); } }';
    const twin = compileStringMulti(source, { composition: 'framed', evmCompat: true } as never).Twin!;
    const provider = new MockNetworkProvider();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const alice = new SignatureTemplate(alicePriv);
    const aliceLock = encodeLockingBytecodeP2pkh(alicePkh);
    const bobLock = encodeLockingBytecodeP2pkh(bobPkh);
    await fundShippedFacets(provider);
    const coin = async (txid: string, satoshis: bigint): Promise<Utxo> => {
      const utxo = { txid: txid.repeat(32), vout: 0, satoshis };
      await provider.addUtxo(binToHex(aliceLock), utxo);
      return utxo;
    };
    const [first, second] = ['a1', 'a2'].map((byte) => byte.repeat(32));
    const deployment = await deployStatefulContract(twin, [hexToBin(first!), hexToBin(second!)], {
      provider, fundingUtxo: await coin('b1', 3_000_000n), funder: alice.unlockP2PKH(), changeAddress: aliceAddress,
    });
    const tokensAt = async (lock: Uint8Array, category: string): Promise<bigint> =>
      (await provider.getUtxosForLockingBytecode(lock))
        .filter((utxo) => utxo.token?.category === category)
        .reduce((sum, utxo) => sum + utxo.token!.amount, 0n);
    for (const [index, category] of [first!, second!].entries()) {
      await provider.addUtxo(binToHex(framedTokenContainerLockingBytecode(deployment.categoryId, category)), {
        txid: `b${index + 2}`.repeat(32), vout: 0, satoshis: 1_000n, token: { category, amount: 1_000n },
      });
    }
    await coin('b4', 50_000n);

    const paid = await callFramedEntry({
      provider, artifact: twin, categoryId: deployment.categoryId, functionName: 'payBoth', args: [bobLock, 10n, 20n],
      callerUtxo: await coin('b5', 300_000n), callerLockingBytecode: aliceLock, funder: alice.unlockP2PKH(), vm,
    });
    expect(paid.verdicts.filter((verdict) => !verdict.accepted)).toEqual([]);
    expect(paid.broadcast).toBeDefined();
    expect(await tokensAt(bobLock, first!)).toBe(20n);
    expect(await tokensAt(bobLock, second!)).toBe(20n);
    for (const category of [first!, second!]) {
      expect(await tokensAt(framedTokenContainerLockingBytecode(deployment.categoryId, category), category)).toBe(980n);
    }
  }, 900_000);

  it('wraps into and unwraps from a BchNative token in a vault\'s callee frames', async () => {
    const source = 'pragma solidcash >=0.8.0;'
      + ' import { BchNative } from "./BchNative.scash";'
      + ' interface IReserve { function wrap(int amount); function unwrap(address to, int amount); }'
      + ' contract Reserve() is BchNative { mapping(address => uint256) internal held;'
      + '   constructor(bytes32 nativeCategory_) BchNative(nativeCategory_) { }'
      + '   function heldBy(address account) public view returns (uint256) { return this.held[account]; }'

      + '   function _nativeCredit(address account, uint256 amount) internal override {'
      + '     this.held[account] = this.held[account] + amount; }'
      + '   function _nativeDebit(address account, uint256 amount) internal override {'
      + '     require(this.held[account] >= amount); this.held[account] = this.held[account] - amount; } }'
      + ' contract Vault() { address immutable reserve;'
      + '   constructor(address reserve_) { this.reserve = reserve_; }'
      + '   function deposit(int amount) { IReserve(this.reserve).wrap(amount); }'
      + '   function depositTwice(int amount) { IReserve(this.reserve).wrap(amount); IReserve(this.reserve).wrap(amount); }'
      + '   function depositAndWithdraw(int amount, address to, int out) {'
      + '     IReserve(this.reserve).wrap(amount); IReserve(this.reserve).unwrap(to, out); }'

      + '   function withdraw(address to, int amount) { IReserve(this.reserve).unwrap(to, amount); } }';
    const compiled = compileStringMulti(source, {
      composition: 'framed', suppressWarnings: true,
      files: { 'BchNative.scash': readFileSync(new URL('../../contracts/BchNative.scash', import.meta.url), 'utf8') },
    } as never);
    const reserve = compiled.Reserve!;
    const vault = compiled.Vault!;
    const provider = new MockNetworkProvider();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const alice = new SignatureTemplate(alicePriv);
    const aliceLock = encodeLockingBytecodeP2pkh(alicePkh);
    const bobLock = encodeLockingBytecodeP2pkh(bobPkh);
    await fundShippedFacets(provider);
    const coin = async (txid: string, satoshis: bigint): Promise<Utxo> => {
      const utxo = { txid: txid.repeat(32), vout: 0, satoshis };
      await provider.addUtxo(binToHex(aliceLock), utxo);
      return utxo;
    };
    const tokenFunding = await coin('d2', 100_000n);
    const category = tokenFunding.txid;
    const reserveDeployment = await deployStatefulContract(reserve, [], {
      provider, fundingUtxo: await coin('d1', 3_000_000n), funder: alice.unlockP2PKH(), changeAddress: aliceAddress,
      initArgs: [hexToBin(category)],
      nativeToken: { funding: tokenFunding, bearer: { amount: 1_000n, to: aliceTokenAddress } },
    });
    const vout = reserveDeployment.tx.outputs.findIndex((output) => output.token !== undefined
      && binToHex(output.token.category) === category);
    const bearer: Utxo = {
      txid: reserveDeployment.tx.txid, vout, satoshis: reserveDeployment.tx.outputs[vout]!.valueSatoshis,
      token: { category, amount: 1_000n },
    };
    const reserveAddress = validatorAddress(
      hexToBin(reserveDeployment.categoryId), framedValidator.buildValidatorProgram(),
    );
    const vaultDeployment = await deployStatefulContract(vault, [], {
      provider, fundingUtxo: await coin('d3', 3_000_000n), funder: alice.unlockP2PKH(), changeAddress: aliceAddress,
      initArgs: [reserveAddress],
    });
    const vaultAddress = validatorAddress(hexToBin(vaultDeployment.categoryId), framedValidator.buildValidatorProgram());
    const externals = { Reserve: { artifact: reserve, categoryId: reserveDeployment.categoryId } };
    const call = async (
      functionName: string, args: unknown[], txid: string, extra: object = {},
    ): Promise<FramedCallResult> => callFramedEntry({
      provider, artifact: vault, categoryId: vaultDeployment.categoryId, functionName, args: args as never,
      callerUtxo: await coin(txid, 300_000n), callerLockingBytecode: aliceLock, funder: alice.unlockP2PKH(), vm,
      externals, ...extra,
    });
    const heldBy = async (account: Uint8Array): Promise<unknown> => (await readFramedEntry({
      provider, artifact: reserve, categoryId: reserveDeployment.categoryId, functionName: 'heldBy', args: [account], vm,
    })).value;
    const container = framedTokenContainerLockingBytecode(reserveDeployment.categoryId, category);
    const tokensAt = async (lock: Uint8Array): Promise<bigint> => (await provider.getUtxosForLockingBytecode(lock))
      .filter((utxo) => utxo.token?.category === category)
      .reduce((sum, utxo) => sum + utxo.token!.amount, 0n);

    // The deposit lands in the reserve's container, whose callee frame names the category, crediting the vault.
    const deposited = await call('deposit', [400n], 'c5', {
      tokenDeposits: [{ utxo: bearer, unlocker: alice.unlockP2PKH(), amount: 400n }],
    });
    expect(deposited.verdicts.filter((verdict) => !verdict.accepted)).toEqual([]);
    expect(deposited.broadcast).toBeDefined();
    expect(await tokensAt(container)).toBe(400n);
    expect(await heldBy(vaultAddress)).toBe(400n);

    // Two wraps in one transaction with one deposit: each frame counts only what reaches the containers it owns, so
    // the deposit is credited once at most, and the second wrap refuses.
    const remainder = (await provider.getUtxosForLockingBytecode(aliceLock))
      .find((utxo) => utxo.token?.category === category)!;
    expect(remainder.token!.amount).toBe(600n);
    const doubled = await call('depositTwice', [100n], 'c7', {
      tokenDeposits: [{ utxo: remainder, unlocker: alice.unlockP2PKH(), amount: 100n }],
    }).catch((error: Error) => error);
    expect(doubled instanceof Error || doubled.verdicts.some((verdict) => !verdict.accepted)).toBe(true);
    expect(await heldBy(vaultAddress)).toBe(400n);

    const withdrawn = await call('withdraw', [bobLock, 150n], 'c6');
    expect(withdrawn.verdicts.filter((verdict) => !verdict.accepted)).toEqual([]);
    expect(withdrawn.broadcast).toBeDefined();
    expect(await tokensAt(bobLock)).toBe(150n);
    expect(await tokensAt(container)).toBe(250n);
    expect(await heldBy(vaultAddress)).toBe(250n);

    // A wrap beside an unwrap of the same token: the unwrap's frame owns the container, and the wrap, the one master
    // of the token that owns none, counts the deposit's new container.
    const left = (await provider.getUtxosForLockingBytecode(aliceLock)).find((utxo) => utxo.token?.category === category)!;
    const both = await call('depositAndWithdraw', [100n, bobLock, 50n], 'c8', {
      tokenDeposits: [{ utxo: left, unlocker: alice.unlockP2PKH(), amount: 100n }],
    });
    expect(both.verdicts.filter((verdict) => !verdict.accepted)).toEqual([]);
    expect(both.broadcast).toBeDefined();
    expect(await heldBy(vaultAddress)).toBe(300n);
    expect(await tokensAt(bobLock)).toBe(200n);
    expect(await tokensAt(container)).toBe(300n);
    // With two containers the unwrap spends only the one that covers it, and the wrap counts the new one.
    expect(await provider.getUtxosForLockingBytecode(container)).toHaveLength(2);
    const rest = (await provider.getUtxosForLockingBytecode(aliceLock)).find((utxo) => utxo.token?.category === category)!;
    const again = await call('depositAndWithdraw', [30n, bobLock, 20n], 'c9', {
      tokenDeposits: [{ utxo: rest, unlocker: alice.unlockP2PKH(), amount: 30n }],
    });
    expect(again.verdicts.filter((verdict) => !verdict.accepted)).toEqual([]);
    expect(again.broadcast).toBeDefined();
    expect(await heldBy(vaultAddress)).toBe(310n);
    expect(await tokensAt(bobLock)).toBe(220n);
    expect(await tokensAt(container)).toBe(310n);

  }, 900_000);
});
