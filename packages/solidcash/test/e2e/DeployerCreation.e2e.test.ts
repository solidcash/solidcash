/**
 * B9.11: a top-level deployment through Deploy<C>, on the production profile.
 */
import { describe, expect, it } from 'vitest';
import { encodeLockingBytecodeP2pkh, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { SignatureTemplate } from '../../src/index.js';
import { ContractFactory, StatefulContract } from '../../src/stateful/index.js';
import { buildDeployerPrep, verifyBirth } from '../../src/stateful/deployer.js';
import { getSatoshiContainerAddress } from '../../src/stateful/covenant-helpers.js';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { keccakComputeLockingBytecode } from '@solidcash/utils';
import { computeSideCarStandIn } from '../../src/stateful/stateful-abi-resolve.js';
import { DeployerSidecarError } from '../../src/stateful/deployer.js';
import { clearGenesisReservations } from '../../src/stateful/genesis-reservations.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';

const P = 'pragma solidcash ^0.50.0;';
const C = `${P} contract C { int n; constructor() { n = 1; } function read() { require(n == 1); } }`;

describe('a top-level deployment through Deploy<C>', () => {
  it('creates the contract from its prep coin and mints it at the prep category', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const artifact = compileString(C, { deployer: true, messageBus: false });
    expect(artifact.deployer).toBeDefined();
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    // A14 item 3: the funding coin need not sit at vout 0; the category is the prep's txid.
    const fundingUtxo: Utxo = {
      txid: '11'.repeat(32), vout: 3, satoshis: 500_000n,
    };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), fundingUtxo);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);

    const result = await StatefulContract.deploy(artifact, [], {
      provider,
      fundingUtxo,
      funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
      changeAddress: change.address,
      senderLockingBytecode: authorLock,
    });

    expect(result.categoryId).not.toBe(fundingUtxo.txid);
    expect(result.prepTransactions).toHaveLength(1);
    expect(await verifyBirth(provider, result.categoryId, [artifact.deployer!])).toBe(true);
    expect(result.contract.categoryId).toBe(result.categoryId);
  });

  it('uses a prep built beforehand and reads its category', async () => {
    clearGenesisReservations();
    const provider = new MockNetworkProvider({ profile: 'production' });
    const artifact = compileString(C, { deployer: true, messageBus: false });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const fundingUtxo: Utxo = { txid: '44'.repeat(32), vout: 0, satoshis: 500_000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), fundingUtxo);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const signer = new SignatureTemplate(alicePriv).unlockP2PKH();
    const { prep } = await buildDeployerPrep({
      children: [{ deployer: artifact.deployer!, contractName: artifact.contractName }],
      fundingUtxos: [fundingUtxo],
      authorSigner: signer,
      authorLockingBytecode: authorLock,
      changeLockingBytecode: authorLock,
      provider,
    });

    const result = await StatefulContract.deploy(artifact, [], {
      provider,
      fundingUtxo,
      funder: signer,
      changeAddress: change.address,
      senderLockingBytecode: authorLock,
      deployerPrep: prep,
      viaDeployer: true,
    });
    expect(result.categoryId).toBe(prep.category);
    expect(result.prepTransactions).toEqual([prep.transactionHex]);
  });

  it('ContractFactory.deploy takes the deployer path and the born contract is callable', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const artifact = compileString(C, { deployer: true, messageBus: false });
    const signer = await provider.getSigner(0);
    await provider.seedUtxo(signer.getAddress(), {
      txid: '22'.repeat(32), vout: 0, satoshis: 1_000_000n,
    });
    const contract = await new ContractFactory(artifact, signer).deploy();
    expect(contract.categoryId).not.toBe('22'.repeat(32));
    expect(await verifyBirth(provider, contract.categoryId, [artifact.deployer!])).toBe(true);
    await contract.read().send();
  });

  it('funds a payable constructor\'s satoshi row with initialBalance (B9.7)', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const artifact = compileString(`${P} contract Pay { int n; constructor() payable { n = 1; } }`,
      { deployer: true, messageBus: false });
    expect(artifact.deployer!.satoshiContainer).toBe('optional');
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const fundingUtxo: Utxo = { txid: '31'.repeat(32), vout: 0, satoshis: 500_000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), fundingUtxo);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const result = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
      changeAddress: change.address, senderLockingBytecode: authorLock, initialBalance: 2000n,
    });
    // The row holds the deploy value, and the contract's journal reads it back as its balance.
    const rowAddress = getSatoshiContainerAddress(
      (result.contract as any).inner ?? result.contract as any, result.categoryId,
    );
    const rows = (await provider.getUtxos(rowAddress)).filter((u) => u.satoshis === 2000n);
    expect(rows).toHaveLength(1);
    expect(((await result.contract.getState()) as { n?: bigint }).n).toBe(1n);
    expect(hexToBin(result.categoryId)).toHaveLength(32);
  });

  it('refuses a payable deployer deployment without initialBalance (B9.7)', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const artifact = compileString(`${P} contract Pay { int n; constructor() payable { n = 1; } }`,
      { deployer: true, messageBus: false });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const fundingUtxo: Utxo = { txid: '32'.repeat(32), vout: 0, satoshis: 500_000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), fundingUtxo);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    await expect(StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
      changeAddress: change.address, senderLockingBytecode: authorLock,
    })).rejects.toThrow(/pass initialBalance/);
  });

  it('co-spends a shared keccak side-car at salt 0 for a constructor that hashes (B9.8)', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const artifact = compileString(
      `${P} contract C { bytes32 h; constructor(bytes b) { h = keccak256(b); } }`,
      { deployer: true, messageBus: false },
    );
    expect(artifact.deployer!.sidecars.keccak).toBeGreaterThan(0);
    const sharedLock = keccakComputeLockingBytecode(new Uint8Array(32), true);
    await provider.seedUtxo(binToHex(sharedLock), computeSideCarStandIn('keccak-deployer-test-a', sharedLock, 0));
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const fundingUtxo: Utxo = { txid: '34'.repeat(32), vout: 0, satoshis: 500_000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), fundingUtxo);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const result = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
      changeAddress: change.address, senderLockingBytecode: authorLock,
      initArgs: [Uint8Array.from([1, 2, 3])], fee: 10000n,
    });
    expect(result.categoryId).toHaveLength(64);
  });

  it('refuses when the shared keccak pool has no coin (B9.8)', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const artifact = compileString(
      `${P} contract C { bytes32 h; constructor(bytes b) { h = keccak256(b); } }`,
      { deployer: true, messageBus: false },
    );
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const fundingUtxo: Utxo = { txid: '35'.repeat(32), vout: 0, satoshis: 500_000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), fundingUtxo);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    await expect(StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
      changeAddress: change.address, senderLockingBytecode: authorLock,
      initArgs: [Uint8Array.from([4, 5, 6])], fee: 10000n,
    })).rejects.toThrow(DeployerSidecarError);
  });

  it('funds a single satoshi container with RESERVE plus the value (B9.7)', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const artifact = compileString(
      `${P} pragma satoshicontainer single; contract Pay { int n; constructor() payable { n = 1; } }`,
      { deployer: true, messageBus: false },
    );
    expect(artifact.deployer!.satoshiContainer).toBe('required');
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const fundingUtxo: Utxo = { txid: '33'.repeat(32), vout: 0, satoshis: 500_000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), fundingUtxo);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const result = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
      changeAddress: change.address, senderLockingBytecode: authorLock, initialBalance: 2000n,
    });
    const rowAddress = getSatoshiContainerAddress(
      (result.contract as any).inner ?? result.contract as any, result.categoryId,
    );
    const rows = (await provider.getUtxos(rowAddress)).filter((u) => u.satoshis === 3200n);
    expect(rows).toHaveLength(1);
  });
});
