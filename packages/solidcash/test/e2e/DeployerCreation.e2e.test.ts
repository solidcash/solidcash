/**
 * B9.11: a top-level deployment through Deploy<C>, on the production profile.
 */
import { describe, expect, it } from 'vitest';
import { encodeLockingBytecodeP2pkh, hash160, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { SignatureTemplate, Signer } from '../../src/index.js';
import { ContractFactory, StatefulContract } from '../../src/stateful/index.js';
import { buildDeployerPrep, verifyBirth } from '../../src/stateful/deployer.js';
import { getEntryNftAddress, getSatoshiContainerAddress, getTokenContainerAddress } from '../../src/stateful/covenant-helpers.js';
import { addressToLockScript } from '../../src/utils.js';
import { resolveIdentity } from '../../src/bcmr/identity.js';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { getEventNftAddress } from '../../src/stateful/covenant-helpers.js';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { getEventNftAddress } from '../../src/stateful/covenant-helpers.js';
import { keccakComputeLockingBytecode } from '@solidcash/utils';
import { computeSideCarStandIn } from '../../src/stateful/stateful-abi-resolve.js';
import { DeployerSidecarError } from '../../src/stateful/deployer.js';
import { clearGenesisReservations } from '../../src/stateful/genesis-reservations.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';

const P = 'pragma solidcash ^0.52.0;';
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

  it('puts the category identity at output 0 and resolves it (B7.12, A14 item 3)', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const artifact = compileString(C, { deployer: true, messageBus: false });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const fundingUtxo: Utxo = { txid: '13'.repeat(32), vout: 0, satoshis: 500_000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), fundingUtxo);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const result = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
      changeAddress: change.address, senderLockingBytecode: authorLock,
    });
    // Output 0 holds the category's mutable authhead NFT, and the deployment reports the identity record.
    const identityOutput = result.tx.outputs[0];
    expect(binToHex(identityOutput.token!.category)).toBe(result.categoryId);
    expect(identityOutput.token?.nft?.capability).toBe('mutable');
    expect(result.identity).toMatchObject({
      txid: result.tx.txid, vout: 0, category: result.categoryId,
    });
    const resolved = await resolveIdentity(provider, result.categoryId);
    expect(resolved?.txid).toBe(result.tx.txid);
    expect(Buffer.from(resolved!.lockingBytecode)).toEqual(Buffer.from(identityOutput.lockingBytecode));
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

  it('deploys a contract whose runtime argument is its own category from a prep built first (A14 item 3)', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const artifact = compileString(
      `${P} contract Self { bytes32 self; constructor(bytes32 c) { self = c; } }`,
      { deployer: true, messageBus: false },
    );
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const fundingUtxo: Utxo = { txid: '18'.repeat(32), vout: 0, satoshis: 500_000n };
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
    // The category is the prep's txid; the runtime argument names it in the VM's byte order.
    const categoryBytes = Uint8Array.from(hexToBin(prep.category)).reverse();
    const result = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo, funder: signer, changeAddress: change.address,
      senderLockingBytecode: authorLock, initArgs: [categoryBytes], deployerPrep: prep, viaDeployer: true,
    });
    expect(result.categoryId).toBe(prep.category);
    expect(((await result.contract.getState()) as { self?: Uint8Array }).self).toEqual(categoryBytes);
  });

  it('mints and decodes a constructor event\'s NFT (A14 item 3)', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const artifact = compileString(
      `${P} contract E { int n; event Ping(int x); constructor() { n = 1; emit Ping(5); } }`,
      { deployer: true, messageBus: false },
    );
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const fundingUtxo: Utxo = { txid: '19'.repeat(32), vout: 0, satoshis: 500_000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), fundingUtxo);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const result = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
      changeAddress: change.address, senderLockingBytecode: authorLock,
    });
    const eventAddress = getEventNftAddress(result.contract.inner, result.categoryId, 'Ping(int256)');
    const eventOutput = result.tx.outputs.find((output) => output.token?.nft?.capability === 'none'
      && output.token.nft.commitment.length > 0);
    expect(eventOutput).toBeDefined();
    const rendered = lockingBytecodeToCashAddress({
      bytecode: eventOutput!.lockingBytecode, prefix: 'bchtest', tokenSupport: true,
    });
    if (typeof rendered === 'string') throw new Error(rendered);
    expect(rendered.address).toBe(eventAddress);
    expect(result.tx.events).toHaveLength(1);
    expect(result.tx.events![0]).toMatchObject({ event: 'Ping', eventSignature: 'Ping(int256)' });
    expect(result.tx.events![0].args.x).toBe(5n);
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

  it('deploys a payable constructor without initialBalance, with a filler at its empty row (A14 item 11)', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const artifact = compileString(`${P} contract Pay { int n; constructor() payable { n = 1; } }`,
      { deployer: true, messageBus: false });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const fundingUtxo: Utxo = { txid: '32'.repeat(32), vout: 0, satoshis: 500_000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), fundingUtxo);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const result = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
      changeAddress: change.address, senderLockingBytecode: authorLock,
    });
    expect(((await result.contract.getState()) as { n?: bigint }).n).toBe(1n);
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

  it('publishes a BCMR registry after the identity (A10, G6)', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const artifact = compileString(C, { deployer: true, messageBus: false });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const fundingUtxo: Utxo = { txid: '36'.repeat(32), vout: 0, satoshis: 500_000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), fundingUtxo);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const result = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
      changeAddress: change.address, senderLockingBytecode: authorLock,
      bcmr: { name: 'Test token', description: 'published through Deploy<C>' },
    });
    expect(result.registry).toBeDefined();
    const identities = Object.values(result.registry!.registry.identities);
    const snapshot = Object.values(identities[0] as Record<string, { name?: string }>)[0];
    expect(snapshot.name).toBe('Test token');
    // Output 0 is the authhead; output 1 is the publication, a tokenless data carrier.
    expect(result.tx.outputs[1].token).toBeUndefined();
    expect(result.tx.outputs[1].lockingBytecode.length).toBeGreaterThan(0);
  });

  it('mints a constructor mapping entry and an unwritten collection\'s HEAD (B7.13, B7.18)', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const deploy = async (source: string, txid: string): Promise<any> => {
      const artifact = compileString(source, { deployer: true, messageBus: false });
      const fundingUtxo: Utxo = { txid, vout: 0, satoshis: 500_000n };
      await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), fundingUtxo);
      return { artifact, result: await StatefulContract.deploy(artifact, [], {
        provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
        changeAddress: change.address, senderLockingBytecode: authorLock,
      }) };
    };
    const written = await deploy(`${P} contract C { mapping(int => int) m; constructor() { m[1] = 2; } }`,
      '37'.repeat(32));
    const entryAddress = getEntryNftAddress(
      (written.result.contract as any).inner ?? written.result.contract as any,
      written.result.categoryId, 'm',
    );
    const entryLock = binToHex(addressToLockScript(entryAddress));
    const entry = written.result.tx.outputs.find(
      (output) => binToHex(output.lockingBytecode) === entryLock,
    );
    expect(entry?.token?.nft?.capability).toBe('mutable');
    expect(binToHex(entry!.token!.nft!.commitment!)).not.toBe('');

    const unwritten = await deploy(`${P} contract C { mapping(int => int) m; constructor() { } }`,
      '38'.repeat(32));
    const headAddress = getEntryNftAddress(
      (unwritten.result.contract as any).inner ?? unwritten.result.contract as any,
      unwritten.result.categoryId, 'm',
    );
    const head = unwritten.result.tx.outputs.find(
      (output) => binToHex(output.lockingBytecode) === binToHex(addressToLockScript(headAddress)),
    );
    expect(binToHex(head!.token!.nft!.commitment!)).toBe('00'.repeat(128));
  });

  it('inserts an entry in a mapping-born contract\'s first call (B7.13)', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const artifact = compileString(`${P} contract C { mapping(int => int) m;
      constructor() { }
      function put(int k, int v) { m[k] = v; }
      function read(int k) { require(m[k] == 2); } }`, { deployer: true, messageBus: false });
    const fundingUtxo: Utxo = { txid: '39'.repeat(32), vout: 0, satoshis: 500_000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), fundingUtxo);
    const result = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
      changeAddress: change.address, senderLockingBytecode: authorLock,
    });
    const signer = new Signer(alicePriv, provider);
    for (let index = 0; index < 4; index += 1) {
      await provider.seedUtxo(signer.getAddress(), {
        txid: `${(0x3a + index).toString(16)}`.repeat(2).padEnd(64, '0'), vout: 0, satoshis: 100_000n,
      });
    }
    const connected = result.contract.connect(signer) as any;
    await connected.call.put(1n, 2n).send();
    await connected.call.read(1n).send();
  });

  it('keeps the last of three constructor writes to one mapping (B7.18)', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const artifact = compileString(`${P} contract C { mapping(int => int) m; int n;
      constructor() { m[1] = 10; m[2] = 20; m[1] = 11; n = m[1]; }
      function put(int k, int v) { m[k] = v; }
      function read(int k, int v) { require(m[k] == v); } }`, { deployer: true, messageBus: false });
    const fundingUtxo: Utxo = { txid: '40'.repeat(32), vout: 0, satoshis: 500_000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), fundingUtxo);
    const result = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
      changeAddress: change.address, senderLockingBytecode: authorLock,
    });
    const signer = new Signer(alicePriv, provider);
    for (let index = 0; index < 6; index += 1) {
      await provider.seedUtxo(signer.getAddress(), {
        txid: `${(0x50 + index).toString(16)}`.repeat(2).padEnd(64, '0'), vout: 0, satoshis: 100_000n,
      });
    }
    const connected = result.contract.connect(signer) as any;
    await connected.call.read(1n, 11n).send();   // the last write to key 1 won
    await connected.call.read(2n, 20n).send();   // key 2 holds its only write
    await connected.call.put(3n, 30n).send();    // a fourth key between them
    await connected.call.read(3n, 30n).send();
    await connected.call.read(9n, 0n).send();    // an unwritten key is the type default
  });

  it('runs a constructor call against a record-sound callee (A7, A14 item 5)', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const source = `${P} interface I { function f(int x) external returns (bool); }
      contract T { bool ok; function f(int x) external returns (bool) { ok = true; return true; } }
      contract C { bool ok; constructor(I i) { ok = i.f(5); } function read() { require(ok); } }`;
    const deploy = async (artifact: any, initArgs: any[] = [], extra: any = {}): Promise<any> => {
      const fundingUtxo: Utxo = {
        txid: `${Math.floor(Math.random() * 1e9).toString(16).padStart(64, '0')}`, vout: 0, satoshis: 2_000_000n,
      };
      await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), fundingUtxo);
      return StatefulContract.deploy(artifact, [], {
        provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
        changeAddress: change.address, senderLockingBytecode: authorLock,
        ...(initArgs.length === 0 ? {} : { initArgs }), ...extra,
      });
    };
    const tArtifact = compileString(source, {
      deployer: true, genesisCalls: true, messageBus: false, primaryContractName: 'T',
    } as never);
    const tResult = await deploy(tArtifact);
    const cArtifact = compileString(source, {
      deployer: true, genesisCalls: true, messageBus: false, primaryContractName: 'C',
    } as never);
    const cResult = await deploy(cArtifact, [addressToLockScript(tResult.contract.address)], {
      constructorCallees: [{ contract: tResult.contract, args: [5n] }],
    });
    const signer = new Signer(alicePriv, provider);
    for (let index = 0; index < 4; index += 1) {
      await provider.seedUtxo(signer.getAddress(), {
        txid: `${(0x60 + index).toString(16)}`.repeat(2).padEnd(64, '0'), vout: 0, satoshis: 100_000n,
      });
    }
    await (cResult.contract.connect(signer) as any).call.read().send();
  });

  it('binds two constructor call slots to two callees (A7 step 14)', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const source = `${P}
      interface IA { function f(int x) external returns (bool); }
      interface IB { function g(int x) external returns (bool); }
      contract T1 { bool a; function f(int x) external returns (bool) { a = true; return true; } }
      contract T2 { bool b; function g(int x) external returns (bool) { b = true; return true; } }
      contract C { bool ok; constructor(IA x, IB y) { ok = x.f(1); y.g(2); }
        function read() { require(ok); } }`;
    let serial = 0;
    const deploy = async (artifact: any, args: any[] = [], extra: any = {}): Promise<any> => {
      serial += 1;
      const fundingUtxo: Utxo = {
        txid: `${(0x70 + serial).toString(16)}`.repeat(2).padEnd(64, '0'), vout: 0, satoshis: 2_000_000n,
      };
      await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), fundingUtxo);
      return StatefulContract.deploy(artifact, args, {
        provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
        changeAddress: change.address, senderLockingBytecode: authorLock, ...extra,
      });
    };
    const t1 = await deploy(compileString(source, {
      deployer: true, genesisCalls: true, messageBus: false, primaryContractName: 'T1',
    } as never));
    const t2 = await deploy(compileString(source, {
      deployer: true, genesisCalls: true, messageBus: false, primaryContractName: 'T2',
    } as never));
    const cArtifact = compileString(source, {
      deployer: true, genesisCalls: true, messageBus: false, primaryContractName: 'C',
    } as never);
    expect(cArtifact.deployer?.callSlots).toBe(2);
    const cResult = await deploy(cArtifact, [], {
      initArgs: [addressToLockScript(t1.contract.address), addressToLockScript(t2.contract.address)],
      constructorCallees: [
        { contract: t1.contract, args: [1n] }, { contract: t2.contract, args: [2n] },
      ],
    });
    const signer = new Signer(alicePriv, provider);
    for (let index = 0; index < 4; index += 1) {
      await provider.seedUtxo(signer.getAddress(), {
        txid: `${(0x80 + index).toString(16)}`.repeat(2).padEnd(64, '0'), vout: 0, satoshis: 100_000n,
      });
    }
    await (cResult.contract.connect(signer) as any).call.read().send();
  });

  it('binds the selector of a multi-method callee (A4.2, A7)', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const source = `${P} interface I { function f(int x) external returns (bool);
        function g(int x) external returns (bool); }
      contract T { bool ok; function f(int x) external returns (bool) { ok = true; return true; }
        function g(int x) external returns (bool) { ok = false; return false; } }
      contract C { bool ok; constructor(I i) { ok = i.f(5); } function read() { require(ok); } }`;
    let serial = 0;
    const deploy = async (artifact: any, extra: any = {}): Promise<any> => {
      serial += 1;
      const fundingUtxo: Utxo = {
        txid: `${(0x90 + serial).toString(16)}`.repeat(2).padEnd(64, '0'), vout: 0, satoshis: 2_000_000n,
      };
      await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), fundingUtxo);
      return StatefulContract.deploy(artifact, [], {
        provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
        changeAddress: change.address, senderLockingBytecode: authorLock, ...extra,
      });
    };
    const t = await deploy(compileString(source, {
      deployer: true, genesisCalls: true, messageBus: false, primaryContractName: 'T',
    } as never), { fee: 1_000_000n });
    const cArtifact = compileString(source, {
      deployer: true, genesisCalls: true, messageBus: false, primaryContractName: 'C',
    } as never);
    const c = await deploy(cArtifact, {
      initArgs: [addressToLockScript(t.contract.address)],
      constructorCallees: [{ contract: t.contract, functionName: 'f', args: [5n] }],
    });
    const signer = new Signer(alicePriv, provider);
    for (let index = 0; index < 4; index += 1) {
      await provider.seedUtxo(signer.getAddress(), {
        txid: `${(0xa0 + index).toString(16)}`.repeat(2).padEnd(64, '0'), vout: 0, satoshis: 100_000n,
      });
    }
    await (c.contract.connect(signer) as any).call.read().send();
  });

  it('binds a void callee compiled with callRecords all (A7)', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const source = `${P} interface I { function register(int x) external; }
      contract R { int x; function register(int v) external { x = v; } }
      contract C { bool ok; constructor(I i) { i.register(7); ok = true; } function read() { require(ok); } }`;
    let serial = 0;
    const deploy = async (artifact: any, extra: any = {}): Promise<any> => {
      serial += 1;
      const fundingUtxo: Utxo = {
        txid: `${(0xb0 + serial).toString(16)}`.repeat(2).padEnd(64, '0'), vout: 0, satoshis: 2_000_000n,
      };
      await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), fundingUtxo);
      return StatefulContract.deploy(artifact, [], {
        provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
        changeAddress: change.address, senderLockingBytecode: authorLock, ...extra,
      });
    };
    const r = await deploy(compileString(source, {
      deployer: true, genesisCalls: true, callRecords: 'all', messageBus: false, primaryContractName: 'R',
    } as never));
    const cArtifact = compileString(source, {
      deployer: true, genesisCalls: true, messageBus: false, primaryContractName: 'C',
    } as never);
    const c = await deploy(cArtifact, {
      initArgs: [addressToLockScript(r.contract.address)],
      constructorCallees: [{ contract: r.contract, args: [7n] }],
    });
    const signer = new Signer(alicePriv, provider);
    for (let index = 0; index < 4; index += 1) {
      await provider.seedUtxo(signer.getAddress(), {
        txid: `${(0xc0 + index).toString(16)}`.repeat(2).padEnd(64, '0'), vout: 0, satoshis: 100_000n,
      });
    }
    await (c.contract.connect(signer) as any).call.read().send();
  });


  it('refuses a callee that is not record-sound before building (A14 item 5)', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const source = `${P} interface I { function f(int x) external returns (bool); }
      contract T { bool ok; function f(int x) external returns (bool) { ok = true; return true; } }
      contract C { bool ok; constructor(I i) { ok = i.f(5); } function read() { require(ok); } }`;
    let serial = 0;
    const deploy = async (artifact: any, extra: any = {}): Promise<any> => {
      serial += 1;
      const fundingUtxo: Utxo = {
        txid: `${(0x4a + serial).toString(16)}`.repeat(2).padEnd(64, '0'), vout: 0, satoshis: 2_000_000n,
      };
      await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), fundingUtxo);
      return StatefulContract.deploy(artifact, [], {
        provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
        changeAddress: change.address, senderLockingBytecode: authorLock, ...extra,
      });
    };
    const t = await deploy(compileString(source, {
      deployer: true, genesisCalls: false, messageBus: false, primaryContractName: 'T',
    } as never));
    const cArtifact = compileString(source, {
      deployer: true, genesisCalls: true, messageBus: false, primaryContractName: 'C',
    } as never);
    await expect(deploy(cArtifact, {
      initArgs: [addressToLockScript(t.contract.address)],
      constructorCallees: [{ contract: t.contract, args: [5n] }],
    })).rejects.toThrow(/record-sound|genesisCalls|callRecords/);
  });






  it('refuses a void callee that does not publish records, naming the option', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const source = `${P} interface I { function register(int x) external; }
      contract R { int x; function register(int v) external { x = v; } }
      contract C { bool ok; constructor(I i) { i.register(7); ok = true; } function read() { require(ok); } }`;
    let serial = 0;
    const deploy = async (artifact: any, extra: any = {}): Promise<any> => {
      serial += 1;
      const fundingUtxo: Utxo = {
        txid: `${(0x5a + serial).toString(16)}`.repeat(2).padEnd(64, '0'), vout: 0, satoshis: 2_000_000n,
      };
      await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), fundingUtxo);
      return StatefulContract.deploy(artifact, [], {
        provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
        changeAddress: change.address, senderLockingBytecode: authorLock, ...extra,
      });
    };
    const r = await deploy(compileString(source, {
      deployer: true, genesisCalls: true, messageBus: false, primaryContractName: 'R',
    } as never));
    const cArtifact = compileString(source, {
      deployer: true, genesisCalls: true, messageBus: false, primaryContractName: 'C',
    } as never);
    await expect(deploy(cArtifact, {
      initArgs: [addressToLockScript(r.contract.address)],
      constructorCallees: [{ contract: r.contract, args: [7n] }],
    })).rejects.toThrow(/callRecords|returns nothing/);
  });


  it('refuses a callee whose called arm is unsafe', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const source = `${P} interface I { function f(int x) external returns (bool); }
      contract T { bool ok; function f(int x) external unsafe returns (bool) { ok = true; return true; } }
      contract C { bool ok; constructor(I i) { ok = i.f(5); } function read() { require(ok); } }`;
    let serial = 0;
    const deploy = async (artifact: any, extra: any = {}): Promise<any> => {
      serial += 1;
      const fundingUtxo: Utxo = {
        txid: `${(0x6a + serial).toString(16)}`.repeat(2).padEnd(64, '0'), vout: 0, satoshis: 2_000_000n,
      };
      await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), fundingUtxo);
      return StatefulContract.deploy(artifact, [], {
        provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
        changeAddress: change.address, senderLockingBytecode: authorLock, ...extra,
      });
    };
    const r = await deploy(compileString(source, {
      deployer: true, genesisCalls: true, messageBus: false, primaryContractName: 'T',
    } as never));
    let cArtifact: any;
    try {
      cArtifact = compileString(source, {
        deployer: true, genesisCalls: true, messageBus: false, primaryContractName: 'C',
      } as never);
    } catch (error) {
      expect(String((error as Error).message)).toMatch(/unsafe|record/);
      return;
    }
    await expect(deploy(cArtifact, {
      initArgs: [addressToLockScript(r.contract.address)],
      constructorCallees: [{ contract: r.contract, args: [5n] }],
    })).rejects.toThrow(/record-sound|unsafe|genesisCalls/);
  });


  it('reads block.number in the constructor from the creation locktime (A5, A14 item 7)', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const artifact = compileString(
      `${P} contract C { int n; constructor() { n = int(block.number); } }`,
      { deployer: true, messageBus: false },
    );
    const fundingUtxo: Utxo = { txid: '66'.repeat(32), vout: 0, satoshis: 500_000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), fundingUtxo);
    const result = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
      changeAddress: change.address, senderLockingBytecode: authorLock,
      oraclePool: 'bb'.repeat(32),
    });
    const height = await provider.getBlockHeight();
    expect(((await result.contract.getState()) as { n?: bigint }).n).toBe(BigInt(height));
  });

  it('reads block.timestamp in the constructor from the median time past (A5, A14 item 7)', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const artifact = compileString(
      `${P} contract C { int t; constructor() { t = int(block.timestamp); } }`,
      { deployer: true, messageBus: false },
    );
    const fundingUtxo: Utxo = { txid: '67'.repeat(32), vout: 0, satoshis: 500_000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), fundingUtxo);
    const result = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
      changeAddress: change.address, senderLockingBytecode: authorLock,
      oraclePool: 'bc'.repeat(32),
    });
    const mtp = await provider.getMedianTimePast();
    expect(((await result.contract.getState()) as { t?: bigint }).t).toBe(BigInt(mtp - 1));
  });


  it('co-spends the shared ecrecover side-cars for a constructor recovery (A14 item 6, B9.8)', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const { ethers } = await import('ethers');
    const { ecrecoverComputeLockingBytecode } = await import('@solidcash/utils');
    const wallet = new ethers.Wallet(`0x${'22'.repeat(32)}`);
    const message = 'deployer-constructor-ecrecover';
    const signature = await wallet.signMessage(message);
    const parsed = ethers.Signature.from(signature);
    const little = (hex: string): Uint8Array => Uint8Array.from(hexToBin(hex.replace(/^0x/, ''))).reverse();
    const h = little(ethers.hashMessage(message));
    const r = little(parsed.r);
    const s = little(parsed.s);
    const expected = hexToBin(wallet.signingKey.compressedPublicKey.replace(/^0x/, ''));
    // A14 item 6: the shared pool at salt 0; the constructor's recovery co-spends A, a funder (M) and B.
    const salt = new Uint8Array(32);
    for (const [index, role] of (['A', 'B2', 'M', 'B3'] as const).entries()) {
      await provider.seedUtxo(binToHex(ecrecoverComputeLockingBytecode(salt, role)), {
        txid: `${(0x90 + index).toString(16)}`.repeat(2).padEnd(64, '0'), vout: 0, satoshis: 100_000n,
        token: {
          category: 'ed'.repeat(31) + '12', amount: 0n,
          nft: { capability: 'mutable', commitment: '' },
        },
      });
    }
    const artifact = compileString(
      `${P} contract C(bytes32 h, int v, bytes32 r, bytes32 s, pubkey expected) {
        int n; constructor() { require(ecrecoverPubKey(h, v, r, s) == expected); n = 1; } }`,
      { deployer: true, messageBus: false },
    );
    expect(artifact.deployer?.sidecars.ecrecover).toBe(1);
    const fundingUtxo: Utxo = { txid: '6b'.repeat(32), vout: 0, satoshis: 500_000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), fundingUtxo);
    const result = await StatefulContract.deploy(artifact, [h, BigInt(parsed.v), r, s, expected], {
      provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
      changeAddress: change.address, senderLockingBytecode: authorLock,
    });
    expect(((await result.contract.getState()) as { n?: bigint }).n).toBe(1n);
  });


  it('answers the zero address in a constructor recovery for every argument the precompile refuses (A14 item 6)',
    async () => {
      // Deploy<C>'s own ecrecoverP2pkh: a bad v and an s outside [1, n) read no slot, an r no curve point has reads the
      // pad of the pool's A over the placeholder recovery, and a key at infinity reads the pair over the shifted digest.
      // Each answers the empty locking bytecode, and the signer's own arguments the signer's P2PKH lock: through the
      // deployer, whose creation runs the constructor, and through today's genesis, whose state-derivation probe does.
      const { ethers } = await import('ethers');
      const { secp256k1 } = await import('@noble/curves/secp256k1');
      const { ecrecoverComputeLockingBytecode } = await import('@solidcash/utils');
      const order = secp256k1.CURVE.n;
      const prime = secp256k1.CURVE.p;
      const word = (value: bigint): Uint8Array => Uint8Array.from(
        { length: 32 }, (_, i) => Number((value >> BigInt(8 * i)) & 0xffn));
      const power = (base: bigint, exponent: bigint, modulus: bigint): bigint => {
        let result = 1n;
        for (let b = base % modulus, e = exponent; e > 0n; b = (b * b) % modulus, e >>= 1n) {
          if (e & 1n) result = (result * b) % modulus;
        }
        return result;
      };
      let offCurve = 1n;
      while (power(offCurve ** 3n + 7n, (prime - 1n) / 2n, prime) === 1n) offCurve += 1n;
      const z = 0x3b5d7f9e1c3a5b7d9f1e3c5a7b9d1f3e5c7a9b1d3f5e7c9a1b3d5f7e9c1a3b5dn, zs = 0x4b1dn;
      const point = secp256k1.ProjectivePoint.BASE.multiply((z * power(zs, order - 2n, order)) % order).toAffine();
      const wallet = new ethers.Wallet(`0x${'24'.repeat(32)}`);
      const message = 'deployer-constructor-ecrecover-refused';
      const parsed = ethers.Signature.from(await wallet.signMessage(message));
      const little = (hex: string): Uint8Array => Uint8Array.from(hexToBin(hex.replace(/^0x/, ''))).reverse();
      const [h, v, r, s] = [little(ethers.hashMessage(message)), BigInt(parsed.v), little(parsed.r), little(parsed.s)];
      const signer = encodeLockingBytecodeP2pkh(hash160(hexToBin(wallet.signingKey.compressedPublicKey.slice(2))));
      const artifact = compileString(
        `${P} contract C(bytes32 h, int v, bytes32 r, bytes32 s) {
          address who; int n; constructor() { who = ecrecoverP2pkh(h, v, r, s); n = 1; } }`,
        { deployer: true, messageBus: false },
      );
      const cases: Array<[unknown[], string]> = [
        [[h, 0n, r, s], ''], [[h, v, r, word(order)], ''], [[h, 27n, word(offCurve), s], ''],
        [[word(z), 27n + (point.y & 1n), word(point.x), word(zs)], ''], [[h, v, r, s], binToHex(signer)],
      ];
      for (const [index, [args, who]] of [...cases.entries(), ...cases.map((entry, at) => [at + 8, entry] as const)]) {
        const viaDeployer = index < 8;
        const provider = new MockNetworkProvider({ profile: 'production' });
        const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
        const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
        if (typeof change === 'string') throw new Error(change);
        for (const [roleIndex, role] of (['A', 'B2', 'M', 'B3'] as const).entries()) {
          await provider.seedUtxo(binToHex(ecrecoverComputeLockingBytecode(new Uint8Array(32), role)), {
            txid: `${(0xa0 + roleIndex).toString(16)}${index}`.padEnd(64, '0'), vout: 0, satoshis: 100_000n,
            token: { category: 'ed'.repeat(31) + '13', amount: 0n, nft: { capability: 'mutable', commitment: '' } },
          });
        }
        // Plain coins at the funder's lock for the slots the recovery does not read.
        for (let coin = 0; coin < 3; coin += 1) {
          await provider.seedUtxo(binToHex(authorLock), {
            txid: `${(0xb0 + coin).toString(16)}${index}`.padEnd(64, '0'), vout: 0, satoshis: 20_000n,
          });
        }
        const fundingUtxo: Utxo = { txid: `6d${index}`.padEnd(64, '0'), vout: 0, satoshis: 500_000n };
        await provider.seedUtxo(binToHex(authorLock), fundingUtxo);
        const result = await StatefulContract.deploy(artifact, args as never, {
          provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
          changeAddress: change.address, senderLockingBytecode: authorLock, ...(viaDeployer ? {} : { viaDeployer: false }),
        });
        const state = (await result.contract.getState()) as { who?: Uint8Array; n?: bigint };
        expect(binToHex(state.who ?? new Uint8Array()), `case ${index}`).toBe(who);
        expect(state.n).toBe(1n);
      }
    });


  it('co-spends A, M and B3 for a constructor recovery whose ladder fits no two-covenant split', async () => {
    // A measured width-0 signature. The constructor locates its side-car group by the stack, past the hash of B's
    // covenant that the B3 predecessor checks hold.
    const width0 = {
      digest: '398eed067d4a815e6ba5220239bf7ebf7b4fcf2c51faee52f0db375644c0aa67', v: 27,
      r: 'd94a22918b3e004b321a8d499c70d153be8a3bd7c85591c5709bf8013e8af39c',
      s: '6a8ff1cd7003b7480a579bbd9d5ba68e17a04e0d3842226b6cb651176def9d32',
    };
    const { ethers } = await import('ethers');
    const { ecrecoverComputeLockingBytecode } = await import('@solidcash/utils');
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const little = (hex: string): Uint8Array => Uint8Array.from(hexToBin(hex)).reverse();
    const expected = hexToBin(ethers.SigningKey.computePublicKey(ethers.SigningKey.recoverPublicKey(
      `0x${width0.digest}`, ethers.Signature.from({ r: `0x${width0.r}`, s: `0x${width0.s}`, v: width0.v })), true).slice(2));
    for (const [index, role] of (['A', 'B2', 'M', 'B3'] as const).entries()) {
      await provider.seedUtxo(binToHex(ecrecoverComputeLockingBytecode(new Uint8Array(32), role)), {
        txid: `${(0xc0 + index).toString(16)}`.padEnd(64, '0'), vout: 0, satoshis: 100_000n,
        token: { category: 'ed'.repeat(31) + '14', amount: 0n, nft: { capability: 'mutable', commitment: '' } },
      });
    }
    const artifact = compileString(
      `${P} contract C(bytes32 h, int v, bytes32 r, bytes32 s, pubkey expected) {
        int n; constructor() { require(ecrecoverPubKey(h, v, r, s) == expected); n = 1; } }`,
      { deployer: true, messageBus: false },
    );
    const fundingUtxo: Utxo = { txid: '6e'.repeat(32), vout: 0, satoshis: 500_000n };
    await provider.seedUtxo(binToHex(authorLock), fundingUtxo);
    const result = await StatefulContract.deploy(artifact, [
      little(width0.digest), BigInt(width0.v), little(width0.r), little(width0.s), expected,
    ], {
      provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
      changeAddress: change.address, senderLockingBytecode: authorLock,
    });
    expect(((await result.contract.getState()) as { n?: bigint }).n).toBe(1n);
  });


  it('refuses a constructor recovery with no shared ecrecover coin (B9.8)', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const { ethers } = await import('ethers');
    const wallet = new ethers.Wallet(`0x${'33'.repeat(32)}`);
    const message = 'deployer-constructor-ecrecover-missing';
    const signature = await wallet.signMessage(message);
    const parsed = ethers.Signature.from(signature);
    const little = (hex: string): Uint8Array => Uint8Array.from(hexToBin(hex.replace(/^0x/, ''))).reverse();
    const artifact = compileString(
      `${P} contract C(bytes32 h, int v, bytes32 r, bytes32 s, pubkey expected) {
        int n; constructor() { require(ecrecoverPubKey(h, v, r, s) == expected); n = 1; } }`,
      { deployer: true, messageBus: false },
    );
    const fundingUtxo: Utxo = { txid: '6c'.repeat(32), vout: 0, satoshis: 500_000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), fundingUtxo);
    await expect(StatefulContract.deploy(artifact, [
      little(ethers.hashMessage(message)), BigInt(parsed.v), little(parsed.r), little(parsed.s),
      hexToBin(wallet.signingKey.compressedPublicKey.replace(/^0x/, '')),
    ], {
      provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
      changeAddress: change.address, senderLockingBytecode: authorLock,
    })).rejects.toThrow(DeployerSidecarError);
  });


  it('pays a wallet from a payable constructor at top level (A5, A14 item 11)', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const artifact = compileString(
      `${P} contract C { int n; constructor() payable { n = 1; payable(msg.sender).send(600); } }`,
      { deployer: true, messageBus: false },
    );
    const fundingUtxo: Utxo = { txid: '68'.repeat(32), vout: 0, satoshis: 500_000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), fundingUtxo);
    const result = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
      changeAddress: change.address, senderLockingBytecode: authorLock, initialBalance: 2000n,
    });
    expect(result.categoryId).not.toBe(fundingUtxo.txid);
  });


  it("reads a single token container's birth balance as 1 (B7.18, A14 item 11)", async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const asset = 'a1b2c3d4e5f60718293a4b5c6d7e8f900123456789abcdef0011223344556677';
    const artifact = compileString(
      `${P} pragma tokencontainer single;
       contract C(bytes32 asset) { int n; constructor() { n = int(this.tokens[asset].tokenAmount); }
         function spend(address to, int amount) { this.tokens[asset].transfer(to, amount); n = 2; } }`,
      { deployer: true, messageBus: false },
    );
    const fundingUtxo: Utxo = { txid: '69'.repeat(32), vout: 0, satoshis: 500_000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), fundingUtxo);
    const tokenUtxo: Utxo = {
      txid: '6a'.repeat(32), vout: 0, satoshis: 1200n, token: { category: asset, amount: 2n },
    };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), tokenUtxo);
    const signer = new SignatureTemplate(alicePriv).unlockP2PKH();
    // A8: the container key parameter is the token category in display order.
    const containerKey = hexToBin(asset);
    const result = await StatefulContract.deploy(artifact, [containerKey], {
      provider, fundingUtxo, funder: signer,
      changeAddress: change.address, senderLockingBytecode: authorLock,
      tokenContainers: [{ utxo: tokenUtxo, unlocker: signer }],
    });
    expect((await result.contract.getState() as { n?: bigint }).n).toBe(1n);

    const containerAddress = getTokenContainerAddress(
      (result.contract as any).inner ?? result.contract as any, result.categoryId, binToHex(containerKey),
    );
    expect((await provider.getUtxos(containerAddress)).filter((coin) => coin.token?.amount === 2n)).toHaveLength(1);
    const callSigner = await provider.getSigner(0);
    await provider.seedUtxo(callSigner.getAddress(), { txid: '6b'.repeat(32), vout: 0, satoshis: 100_000n });
    const recipientLock = encodeLockingBytecodeP2pkh(alicePkh);
    const sent = await (result.contract.connect(callSigner) as any).call.spend(alicePkh, 1)
      .tokenContainerTransfer(asset, recipientLock, 1n).send();
    expect(sent.outputs.some((output: any) => {
      const category = typeof output.token?.category === 'string'
        ? output.token.category : Buffer.from(output.token?.category ?? []).toString('hex');
      return category === asset && output.token?.amount === 1n
        && Buffer.from(output.lockingBytecode).equals(Buffer.from(recipientLock));
    })).toBe(true);
    expect((await result.contract.getState() as { n?: bigint }).n).toBe(2n);
    expect((await provider.getUtxos(containerAddress)).filter((coin) => coin.token?.amount === 1n)).toHaveLength(1);
  });

  it('mints the oracle of a live block reader and reads block data later (A5, A14 item 7)', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const artifact = compileString(
      `${P} contract C { int n; constructor() { n = 1; }
        function read() { require(int(block.number) >= 0); n = 2; } }`,
      { deployer: true, messageBus: false },
    );
    expect(artifact.deployer).toBeDefined();
    expect(artifact.deployer?.readsBlockData).toBe(true);
    const fundingUtxo: Utxo = { txid: 'ba'.repeat(32), vout: 0, satoshis: 500_000n };
    await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), fundingUtxo);
    const result = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
      changeAddress: change.address, senderLockingBytecode: authorLock,
      oraclePool: 'new',
    });
    expect(result.categoryId).not.toBe(fundingUtxo.txid);
    const signer = new Signer(alicePriv, provider);
    for (let index = 0; index < 4; index += 1) {
      await provider.seedUtxo(signer.getAddress(), {
        txid: `${(0xe0 + index).toString(16)}`.repeat(2).padEnd(64, '0'), vout: 0, satoshis: 100_000n,
      });
    }
    await (result.contract.connect(signer) as any).call.read().send();
    expect((await result.contract.getState() as { n?: bigint }).n).toBe(2n);
  });

  it('binds a constructor call to a callee that reads msg.sender (A7, B7.16)', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const source = `${P}
      interface I { function f(int x) external returns (bool); }
      contract T { address who; bool ok;
        function mark() internal { who = msg.sender; }
        function f(int x) external returns (bool) { mark(); ok = true; return true; }
        function check() { require(ok); } }
      contract C { bool ok; constructor(I i) { ok = i.f(5); } function read() { require(ok); } }`;
    let serial = 0;
    const deploy = async (artifact: any, extra: any = {}): Promise<any> => {
      serial += 1;
      const fundingUtxo: Utxo = {
        txid: `${(0xd0 + serial).toString(16)}`.repeat(2).padEnd(64, '0'), vout: 0, satoshis: 2_000_000n,
      };
      await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), fundingUtxo);
      return StatefulContract.deploy(artifact, [], {
        provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
        changeAddress: change.address, senderLockingBytecode: authorLock, ...extra,
      });
    };
    const t = await deploy(compileString(source, {
      deployer: true, genesisCalls: true, messageBus: false, primaryContractName: 'T',
    } as never), { fee: 1_000_000n });
    const cArtifact = compileString(source, {
      deployer: true, genesisCalls: true, messageBus: false, primaryContractName: 'C',
    } as never);
    const c = await deploy(cArtifact, {
      initArgs: [addressToLockScript(t.contract.address)],
      constructorCallees: [{ contract: t.contract, args: [5n] }],
    });
    const stored = (await t.contract.getState()) as { who?: Uint8Array };
    expect(binToHex(stored.who ?? new Uint8Array())).toBe(binToHex(addressToLockScript(c.contract.address)));
  });


  it('binds a void registry call that stores the child as msg.sender (A7, B7.16)', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const source = `${P}
      interface I { function register(int x) external; }
      contract R { int x; address who;
        function register(int v) external { x = v; who = msg.sender; } }
      contract C { bool ok; constructor(I i) { i.register(7); ok = true; } function read() { require(ok); } }`;
    let serial = 0;
    const deploy = async (artifact: any, extra: any = {}): Promise<any> => {
      serial += 1;
      const fundingUtxo: Utxo = {
        txid: `${(0xc8 + serial).toString(16)}`.repeat(2).padEnd(64, '0'), vout: 0, satoshis: 2_000_000n,
      };
      await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), fundingUtxo);
      return StatefulContract.deploy(artifact, [], {
        provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
        changeAddress: change.address, senderLockingBytecode: authorLock, ...extra,
      });
    };
    const r = await deploy(compileString(source, {
      deployer: true, genesisCalls: true, callRecords: 'all', messageBus: false, primaryContractName: 'R',
    } as never));
    const cArtifact = compileString(source, {
      deployer: true, genesisCalls: true, messageBus: false, primaryContractName: 'C',
    } as never);
    const c = await deploy(cArtifact, {
      initArgs: [addressToLockScript(r.contract.address)],
      constructorCallees: [{ contract: r.contract, args: [7n] }],
    });
    const stored = (await r.contract.getState()) as { x?: bigint; who?: Uint8Array };
    expect(stored.x).toBe(7n);
    expect(binToHex(stored.who ?? new Uint8Array())).toBe(binToHex(addressToLockScript(c.contract.address)));
  });


  it('binds a void USDT-shaped transfer compiled with callRecords all (A7, B6)', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const source = `${P}
      interface I { function transfer(address to, int amount) external; }
      contract U { int sent; function transfer(address to, int amount) external { sent = sent + amount; } }
      contract C { bool ok; constructor(I u) { u.transfer(msg.sender, 5); ok = true; } function read() { require(ok); } }`;
    let serial = 0;
    const deploy = async (artifact: any, extra: any = {}): Promise<any> => {
      serial += 1;
      const fundingUtxo: Utxo = {
        txid: `${(0xc0 + serial).toString(16)}`.repeat(2).padEnd(64, '0'), vout: 0, satoshis: 2_000_000n,
      };
      await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), fundingUtxo);
      return StatefulContract.deploy(artifact, [], {
        provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
        changeAddress: change.address, senderLockingBytecode: authorLock, ...extra,
      });
    };
    const u = await deploy(compileString(source, {
      deployer: true, genesisCalls: true, callRecords: 'all', messageBus: false, primaryContractName: 'U',
    } as never));
    const cArtifact = compileString(source, {
      deployer: true, genesisCalls: true, messageBus: false, primaryContractName: 'C',
    } as never);
    const c = await deploy(cArtifact, {
      initArgs: [addressToLockScript(u.contract.address)],
      constructorCallees: [{ contract: u.contract, args: [alicePkh, 5n] }],
    });
    expect((await u.contract.getState() as { sent?: bigint }).sent).toBe(5n);
    expect(c.categoryId).not.toBe(u.contract.categoryId);
  });





  it('binds an ERC20-shaped transfer that debits the child and credits its owner (A7, B6)', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const source = `${P}
      interface I { function transfer(address to, int amount) external returns (bool); }
      contract T { int childBalance; int ownerBalance;
        function transfer(address to, int amount) external returns (bool) {
          require(msg.sender != address(0));
          childBalance = childBalance - amount;
          ownerBalance = ownerBalance + amount;
          return true;
        } }
      contract C { bool ok; constructor(I t) { ok = t.transfer(msg.sender, 5); } function read() { require(ok); } }`;
    let serial = 0;
    const deploy = async (artifact: any, extra: any = {}): Promise<any> => {
      serial += 1;
      const fundingUtxo: Utxo = {
        txid: `${(0xa0 + serial).toString(16)}`.repeat(2).padEnd(64, '0'), vout: 0, satoshis: 2_000_000n,
      };
      await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), fundingUtxo);
      return StatefulContract.deploy(artifact, [], {
        provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
        changeAddress: change.address, senderLockingBytecode: authorLock, ...extra,
      });
    };
    const t = await deploy(compileString(source, {
      deployer: true, genesisCalls: true, messageBus: false, primaryContractName: 'T',
    } as never));
    const cArtifact = compileString(source, {
      deployer: true, genesisCalls: true, messageBus: false, primaryContractName: 'C',
    } as never);
    const c = await deploy(cArtifact, {
      initArgs: [addressToLockScript(t.contract.address)],
      constructorCallees: [{ contract: t.contract, args: [alicePkh, 5n] }],
    });
    const token = (await t.contract.getState()) as { childBalance?: bigint; ownerBalance?: bigint };
    expect(token.childBalance).toBe(-5n);
    expect(token.ownerBalance).toBe(5n);
    expect(c.categoryId).not.toBe(t.contract.categoryId);
  });



  it('runs a constructor call with near-6 kB child code (D13)', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
    const change = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    let extra = '';
    for (let i = 0; i < 40; i += 1) extra += `function f${i}() { n = n + ${i}; } `;
    const source = `${P} interface I { function f(int x) external returns (bool); }
      contract T { bool ok; function f(int x) external returns (bool) { ok = true; return true; } }
      contract C { bool ok; int n; constructor(I i) { ok = i.f(5); } ${extra}
        function read() { require(ok); } }`;
    let serial = 0;
    const deploy = async (artifact: any, extraOpts: any = {}): Promise<any> => {
      serial += 1;
      const fundingUtxo: Utxo = {
        txid: `${(0xe8 + serial).toString(16)}`.repeat(2).padEnd(64, '0'), vout: 0, satoshis: 2_000_000n,
      };
      await provider.seedUtxo(Buffer.from(authorLock).toString('hex'), fundingUtxo);
      return StatefulContract.deploy(artifact, [], {
        provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
        changeAddress: change.address, senderLockingBytecode: authorLock, ...extraOpts,
      });
    };
    const t = await deploy(compileString(source, {
      deployer: true, genesisCalls: true, messageBus: false, primaryContractName: 'T',
    } as never));
    const cArtifact = compileString(source, {
      deployer: true, genesisCalls: true, messageBus: false, primaryContractName: 'C',
    } as never);
    expect((cArtifact.deployer?.code.length ?? 0) / 2).toBeGreaterThan(6_000);
    const c = await deploy(cArtifact, {
      initArgs: [addressToLockScript(t.contract.address)],
      constructorCallees: [{ contract: t.contract, args: [5n] }],
      fee: 1_000_000n,
    });
    expect(c.categoryId).not.toBe(t.contract.categoryId);
  });

});
