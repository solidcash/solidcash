import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Signer } from '../../src/index.js';
import {
  ContractFactory,
  resolveLogicalIdentity,
  deriveLogicalCreateAddress,
  buildLogicalIdentityCommitment,
} from '../../src/stateful/index.js';
import {
  isScidIdentityCommitment, logicalIdentityAddressVariants, sameLogicalIdentityAddress,
  logicalLockFromScidCommitment, resolveLogicalIdentityFromAddresses,
  resolveLogicalIdentityByCategory, requireMsgSenderIdentity, isZeroMsgSenderCategory,
} from '../../src/stateful/logical-identity.js';
import {
  findScidAnchorInputIndex, reassertScidIdentityOutputs,
} from '../../src/stateful/StatefulTransactionBuilder.js';
import { addressToLockScript } from '../../src/utils.js';
import { binToHex, hash160, hexToBin } from '@bitauth/libauth';
import { createTestProvider } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';
import {
  findDeploymentByAddressValue, findDeploymentByCategory, findDeploymentByLockingBytecode, registerDeployment,
  registeredExecutionLockingBytecode,
  registeredPhysicalLockingBytecode,
} from '../../src/stateful/deployment-registry.js';

function freshKey(): Uint8Array {
  const key = new Uint8Array(32);
  crypto.getRandomValues(key);
  key[0] = (key[0] & 0x7f) | 0x01;
  return key;
}

async function fundedSigner(txidByte: string): Promise<{ signer: Signer; fundingUtxo: Utxo }> {
  const provider = createTestProvider();
  const signer = new Signer(freshKey(), provider);
  const fundingUtxo: Utxo = { txid: txidByte.repeat(32), vout: 0, satoshis: 5_000_000n };
  await provider.addUtxo(signer.getAddress(), fundingUtxo);
  return { signer, fundingUtxo };
}

const TOKEN = 'contract Token() {'
  + ' mapping(address => int) balances;'
  + ' mapping(address => mapping(address => int)) allowances;'
  + ' constructor() { this.balances[msg.sender] = 1000000; }'
  + ' function transfer(address to, int amount) {'
  + '   require(this.balances[msg.sender] >= amount);'
  + '   this.balances[msg.sender] = this.balances[msg.sender] - amount;'
  + '   this.balances[to] = this.balances[to] + amount;'
  + ' }'
  + ' function approve(address spender, int amount) {'
  + '   this.allowances[msg.sender][spender] = amount;'
  + ' }'
  + '}';

const ADDRESS_HOLDER = 'contract AddressHolder {'
  + ' address public peer;'
  + ' constructor(address peer_) { peer = peer_; }'
  + ' function check(address expected) external view { require(peer == expected); }'
  + '}';

describe('logical CREATE identity at getAddress()', () => {
  it('resolves only one immutable SCID from the assembled input category', () => {
    const category = 'ab'.repeat(31) + '54';
    const scid = { category, amount: 0n, nft: { capability: 'none' as const, commitment: '5343494401abcd' } };
    const inputs: Pick<Utxo, 'token'>[] = [
      { token: { ...scid, category: 'cd'.repeat(31) + '32' } },
      { token: { ...scid, nft: { ...scid.nft, capability: 'mutable' } } },
      { token: scid },
    ];
    expect(findScidAnchorInputIndex(inputs, category.toUpperCase())).toBe(2);
    expect(findScidAnchorInputIndex(inputs, 'ef'.repeat(32))).toBe(-1);
    expect(() => findScidAnchorInputIndex([...inputs, { token: scid }], category))
      .toThrow('Ambiguous CREATE identity anchors');
  });

  it.each([false, true])('keeps reserved output coordinates when splitting a large SCID funding pad (suffix %s)', (withSuffix) => {
    const lock = Uint8Array.of(0xaa, 0x20, 0xe6);
    const funderLock = Uint8Array.of(0x76, 0xa9, 0x14);
    const category = 'ab'.repeat(31) + '54';
    const commitment = '5343494401dead';
    const interior = { to: Uint8Array.of(0x6a), amount: 1000n };
    const entry = { to: Uint8Array.of(0x51), amount: 1200n,
      token: { category, nft: { capability: 'mutable', commitment: '01' } } };
    const suffix = { to: Uint8Array.of(0x6a), amount: 1000n };
    const outputs: Array<{ to?: Uint8Array; amount?: bigint; token?: object }> = [
      { to: funderLock, amount: 100_000n }, interior, entry, ...(withSuffix ? [suffix] : []),
    ];
    const total = outputs.reduce((sum, output) => sum + (output.amount ?? 0n), 0n);
    const inputs = [{ satoshis: 1200n, unlocker: { generateLockingBytecode: () => lock },
      token: { category, amount: 0n, nft: { capability: 'none', commitment } } }];
    expect(reassertScidIdentityOutputs(outputs, inputs, new Set([1, 2]))).toBe(1);
    expect(outputs[0].to).toBe(lock);
    expect(outputs[1]).toBe(interior);
    expect(outputs[2]).toBe(entry);
    if (withSuffix) expect(outputs.at(-1)).toBe(suffix);
    expect(outputs[3]).toEqual({ to: funderLock, amount: 98_800n });
    expect(outputs.reduce((sum, output) => sum + (output.amount ?? 0n), 0n)).toBe(total);
    expect(reassertScidIdentityOutputs(outputs, inputs, new Set([1, 2]))).toBe(0);
  });

  it('recognizes SCID v1 commitments', () => {
    expect(isScidIdentityCommitment('5343494401abcd')).toBe(true);
    expect(isScidIdentityCommitment('53434944')).toBe(false);
    expect(isScidIdentityCommitment('00')).toBe(false);
    expect(isScidIdentityCommitment(undefined)).toBe(false);
  });

  it('derives the CREATE lock from a SCID v1 commitment', () => {
    const deployer = 'bchtest:qpcn7sy4mgy9glvkjxj3r5y0s9rhy5lwtymfzfnde8';
    const logical = deriveLogicalCreateAddress(deployer, 4n);
    const commitment = buildLogicalIdentityCommitment(deployer, 4n, logical);
    const derived = logicalLockFromScidCommitment(commitment, 'bchtest');
    expect(derived).toBeDefined();
    expect(binToHex(derived!)).toBe(binToHex(addressToLockScript(logical)));
  });

  it('restores a stripped SCID onto the last same-lock pad, not a minting occupant', () => {
    const commitment = '5343494401dead';
    const lock = Uint8Array.of(0xaa, 0x20, 0xe6);
    const outputs: Array<{ to?: Uint8Array; amount?: bigint; token?: object }> = [
      { to: lock, amount: 1200n, token: { category: 'aa'.repeat(31) + '55', nft: { capability: 'minting' } } },
      { to: Uint8Array.of(0x51), amount: 1000n },
      { to: lock, amount: 1200n },
    ];
    expect(reassertScidIdentityOutputs(outputs, [{
      satoshis: 1200n,
      token: { category: 'aa'.repeat(31) + '55', amount: 0n, nft: { capability: 'none', commitment } },
      unlocker: { generateLockingBytecode: () => lock },
    }])).toBe(1);
    expect((outputs[0].token as { nft?: { capability?: string } }).nft?.capability).toBe('minting');
    expect((outputs[2].token as { nft?: { commitment?: string } }).nft?.commitment).toBe(commitment);
  });

  it('recreates a SCID even when the input index is a mutable occupant', () => {
    const commitment = '5343494401beef';
    const lock = Uint8Array.of(0xaa, 0x20, 0xee);
    const outputs: Array<{ to?: Uint8Array; amount?: bigint; token?: object }> = [
      {
        to: lock, amount: 1200n,
        token: { category: 'bb'.repeat(31) + '44', nft: { capability: 'mutable', commitment: '00' } },
      },
      { to: Uint8Array.of(0x76, 0xa9), amount: 1000n },
    ];
    expect(reassertScidIdentityOutputs(outputs, [{
      satoshis: 1200n,
      token: { category: 'bb'.repeat(31) + '44', amount: 0n, nft: { capability: 'none', commitment } },
      unlocker: { generateLockingBytecode: () => lock },
    }])).toBe(1);
    expect((outputs[0].token as { nft?: { capability?: string } }).nft?.capability).toBe('mutable');
    expect((outputs[1].token as { nft?: { commitment?: string } }).nft?.commitment).toBe(commitment);
  });

  it('does not park a SCID on a reserved impl-trailing / jobEvents slot', () => {
    const commitment = '5343494401cafe';
    const lock = Uint8Array.of(0xaa, 0x20, 0x08);
    const outputs: Array<{ to?: Uint8Array; amount?: bigint; token?: object }> = [
      { to: Uint8Array.of(0x76, 0xa9), amount: 1000n },
      { to: Uint8Array.of(0x76, 0xa9), amount: 1000n },
      { to: Uint8Array.of(0x51), amount: 1000n },
    ];
    expect(reassertScidIdentityOutputs(outputs, [{
      satoshis: 1200n,
      token: { category: 'cc'.repeat(31) + '33', amount: 0n, nft: { capability: 'none', commitment } },
      unlocker: { generateLockingBytecode: () => lock },
    }], new Set([0, 1]))).toBe(1);
    expect(outputs[0].token).toBeUndefined();
    expect(outputs[1].token).toBeUndefined();
    expect((outputs[2].token as { nft?: { commitment?: string } }).nft?.commitment).toBe(commitment);
  });

  it('does not park or accept a SCID on a consumed mutable resource slot', () => {
    const commitment = '5343494401cafe';
    const category = 'cc'.repeat(31) + '33';
    const lock = Uint8Array.of(0xaa, 0x20, 0x08);
    const identity = {
      category, amount: 0n,
      nft: { capability: 'none', commitment },
    };
    const inputs = [{
      satoshis: 1200n,
      token: identity,
      unlocker: { generateLockingBytecode: () => lock },
    }, {
      satoshis: 1200n,
      token: { category, amount: 0n, nft: { capability: 'mutable', commitment: '00' } },
      unlocker: { generateLockingBytecode: () => Uint8Array.of(0xaa, 0x20, 0x09) },
    }];
    const outputs: Array<{ to?: Uint8Array; amount?: bigint; token?: object }> = [
      { to: Uint8Array.of(0x51), amount: 1000n },
      { to: Uint8Array.of(0x51), amount: 1000n },
    ];
    expect(reassertScidIdentityOutputs(outputs, inputs)).toBe(1);
    expect((outputs[0].token as { nft?: { commitment?: string } }).nft?.commitment).toBe(commitment);
    expect(outputs[1].token).toBeUndefined();

    // A provisional replica on that slot must be moved too, not accepted as
    // satisfying identity conservation before the resource proof is built.
    outputs[0] = { to: Uint8Array.of(0x51), amount: 1000n };
    outputs[1] = { to: lock, amount: 1200n, token: identity };
    expect(reassertScidIdentityOutputs(outputs, inputs)).toBe(1);
    expect((outputs[0].token as { nft?: { commitment?: string } }).nft?.commitment).toBe(commitment);
    expect(outputs[1].token).toBeUndefined();

    // A four-byte placeholder at the mutable slot is still not a free pad.
    outputs[0] = { to: Uint8Array.of(0x51), amount: 1000n };
    outputs[1] = { to: lock, amount: 1200n, token: {
      category, amount: 0n, nft: { capability: 'none', commitment: '53434944' },
    } };
    expect(reassertScidIdentityOutputs(outputs, inputs)).toBe(1);
    expect((outputs[0].token as { nft?: { commitment?: string } }).nft?.commitment).toBe(commitment);
    expect((outputs[1].token as { nft?: { commitment?: string } }).nft?.commitment).toBe('53434944');
  });

  it('relocates an already-restored SCID out of a reserved suffix slot', () => {
    const commitment = '5343494401cafe';
    const category = 'cc'.repeat(31) + '33';
    const lock = Uint8Array.of(0xaa, 0x20, 0x08);
    const outputs: Array<{ to?: Uint8Array; amount?: bigint; token?: object }> = [
      { to: Uint8Array.of(0x51), amount: 1000n },
      { to: lock, amount: 1200n },
      { to: lock, amount: 1200n, token: { category, amount: 0n,
        nft: { capability: 'none', commitment } } },
      { to: Uint8Array.of(0xaa, 0x20, 0x09), amount: 1200n,
        token: { category, amount: 0n, nft: { capability: 'mutable', commitment: '00' } } },
      { to: Uint8Array.of(0x6a), amount: 0n },
    ];
    expect(reassertScidIdentityOutputs(outputs, [{
      satoshis: 1200n,
      token: { category, amount: 0n, nft: { capability: 'none', commitment } },
      unlocker: { generateLockingBytecode: () => lock },
    }], new Set([2, 3, 4]))).toBe(1);
    expect((outputs[1].token as { nft?: { commitment?: string } }).nft?.commitment).toBe(commitment);
    expect(outputs[2].token).toBeUndefined();
    expect(outputs).toHaveLength(5);
  });

  it('recreates a consumed SCID identity 1:1 at its input index', () => {
    const commitment = '5343494401dead';
    const outputs: Array<{ to?: Uint8Array; amount?: bigint; token?: object }> = [
      { to: Uint8Array.of(0x51), amount: 1000n },
    ];
    const added = reassertScidIdentityOutputs(outputs, [{
      satoshis: 1200n,
      token: { category: 'aa'.repeat(31) + '55', amount: 0n, nft: { capability: 'none', commitment } },
      unlocker: { generateLockingBytecode: () => Uint8Array.of(0xaa, 0x20) },
    }]);
    expect(added).toBe(1);
    expect(outputs).toHaveLength(1);
    expect((outputs[0].token as { nft?: { commitment?: string } }).nft?.commitment).toBe(commitment);
    expect(reassertScidIdentityOutputs(outputs, [{
      satoshis: 1200n,
      token: { category: 'aa'.repeat(31) + '55', amount: 0n, nft: { capability: 'none', commitment } },
      unlocker: { generateLockingBytecode: () => Uint8Array.of(0xaa, 0x20) },
    }])).toBe(0);
  });

  it('does not overwrite one restored SCID while restoring another', () => {
    const firstCommitment = '5343494401aaaa';
    const secondCommitment = '5343494401bbbb';
    const firstLock = Uint8Array.of(0xaa, 0x20, 0x01);
    const secondLock = Uint8Array.of(0xaa, 0x20, 0x02);
    const outputs: Array<{ to?: Uint8Array; amount?: bigint; token?: object }> = [
      { to: Uint8Array.of(0x51), amount: 1000n },
    ];
    expect(reassertScidIdentityOutputs(outputs, [{
      satoshis: 1200n,
      token: { category: 'aa'.repeat(31) + '55', amount: 0n, nft: { capability: 'none', commitment: firstCommitment } },
      unlocker: { generateLockingBytecode: () => firstLock },
    }, {
      satoshis: 1200n,
      token: { category: 'bb'.repeat(31) + '44', amount: 0n, nft: { capability: 'none', commitment: secondCommitment } },
      unlocker: { generateLockingBytecode: () => secondLock },
    }])).toBe(2);
    expect(outputs).toHaveLength(2);
    expect(outputs.map((output) => (
      output.token as { nft?: { commitment?: string } }
    ).nft?.commitment)).toEqual([firstCommitment, secondCommitment]);
  });

  it('resolves an explicit logical identity independently of runtime msg.sender', async () => {
    const { signer } = await fundedSigner('ae');
    const token = await new ContractFactory(compileString(TOKEN), signer).deploy();
    expect(isZeroMsgSenderCategory(new Uint8Array(32))).toBe(true);
    expect(isZeroMsgSenderCategory(token.categoryId)).toBe(false);
    const byCategory = await resolveLogicalIdentityByCategory(
      signer.provider, token.categoryId, [undefined, signer.getAddress()],
    );
    expect(byCategory?.categoryId).toBe(token.categoryId);
    const required = await requireMsgSenderIdentity(
      signer.provider, token.categoryId, [await token.getAddress()],
    );
    expect(required.anchor.txid).toBe(byCategory!.anchor.txid);
    await expect(requireMsgSenderIdentity(
      signer.provider, '11'.repeat(32), [signer.getAddress()],
    )).rejects.toThrow(/CREATE identity for category/);
  });

  it('stores a registered contract address as its physical locking bytecode', async () => {
    const { signer } = await fundedSigner('ad');
    const token = await new ContractFactory(compileString(TOKEN), signer).deploy();
    const logicalAddress = await token.getAddress();
    expect(binToHex(registeredPhysicalLockingBytecode(signer.provider, logicalAddress)!))
      .toBe(token.inner.lockingBytecode);

    const holder = await new ContractFactory(compileString(ADDRESS_HOLDER), signer).deploy(logicalAddress);
    const state = await holder.getState();
    expect(binToHex(state.peer as Uint8Array)).toBe(token.inner.lockingBytecode);
  });

  it('resolves a proxy registration by its active implementation bytecode', () => {
    const provider = createTestProvider();
    const implementationLock = `aa20${'11'.repeat(32)}87`;
    const proxyLock = `aa20${'22'.repeat(32)}87`;
    const proxyHandle = {
      implementation: { inner: { lockingBytecode: implementationLock } },
      proxy: { inner: { lockingBytecode: proxyLock } },
    };
    const deployment = {
      contractName: 'ProxyTarget', address: 'logical-proxy-address',
      lockingBytecode: proxyLock, contract: proxyHandle,
    };
    registerDeployment(provider, deployment);

    expect(registeredExecutionLockingBytecode(deployment)).toBe(implementationLock);
    expect(findDeploymentByLockingBytecode(provider, implementationLock)).toBe(deployment);
  });

  it('resolves a unique P2SH32 deployment from its typed Solidity address identity', () => {
    const provider = createTestProvider();
    const lockingBytecode = `aa20${'31'.repeat(32)}87`;
    const deployment = {
      contractName: 'AddressTarget', address: 'logical-address', lockingBytecode, contract: {},
    };
    registerDeployment(provider, deployment);

    const solidityIdentity = hash160(hexToBin(lockingBytecode));
    expect(findDeploymentByAddressValue(provider, solidityIdentity)).toBe(deployment);
    expect(findDeploymentByAddressValue(provider, new Uint8Array(20).fill(0x72))).toBeUndefined();

    registerDeployment(provider, {
      contractName: 'CollidingAddressTarget', address: 'second-logical-address',
      lockingBytecode: `a914${binToHex(solidityIdentity)}87`, contract: {},
    });
    expect(findDeploymentByAddressValue(provider, solidityIdentity)).toBeUndefined();
  });

  it('resolves the state-owning proxy registration by category', () => {
    const provider = createTestProvider();
    const implementationCategory = '11'.repeat(31) + 'ee';
    const proxyCategory = '22'.repeat(31) + 'dd';
    const implementation = {
      contractName: 'Implementation', address: 'implementation-address',
      lockingBytecode: `aa20${'11'.repeat(32)}87`,
      contract: { categoryId: implementationCategory },
    };
    const proxy = {
      contractName: 'Implementation', address: 'proxy-address',
      lockingBytecode: `aa20${'22'.repeat(32)}87`,
      contract: {
        proxy: { categoryId: proxyCategory },
        implementation: { categoryId: implementationCategory },
      },
    };
    registerDeployment(provider, implementation);
    registerDeployment(provider, proxy);

    expect(findDeploymentByCategory(provider, implementationCategory)).toBe(implementation);
    expect(findDeploymentByCategory(provider, proxyCategory)).toBe(proxy);
  });

  it('resolves identity from target/address when _logicalAddress is omitted', async () => {
    const { signer } = await fundedSigner('af');
    const token = await new ContractFactory(compileString(TOKEN), signer).deploy();
    const logical = await token.getAddress();
    const resolved = await resolveLogicalIdentityFromAddresses(signer.provider, [
      undefined, signer.getAddress(), logical,
    ]);
    expect(resolved?.categoryId).toBe(token.categoryId);
    expect(sameLogicalIdentityAddress(resolved!.logicalAddress, logical)).toBe(true);
  });

  it('resolves the same SCID from token-aware and non-token cashaddrs of one lock', async () => {
    const { signer } = await fundedSigner('b0');
    const token = await new ContractFactory(compileString(TOKEN), signer).deploy();
    const logical = await token.getAddress();
    const variants = logicalIdentityAddressVariants(logical);
    expect(variants.length).toBeGreaterThan(1);
    const resolved = [];
    for (const address of variants) {
      expect(sameLogicalIdentityAddress(address, logical)).toBe(true);
      const identity = await resolveLogicalIdentity(signer.provider, address);
      resolved.push(identity);
    }
    expect(new Set(resolved.map((identity) => identity.categoryId))).toEqual(new Set([token.categoryId]));
    expect(new Set(resolved.map((identity) => `${identity.anchor.txid}:${identity.anchor.vout}`)).size).toBe(1);
  });

  it('factory.deploy leaves exactly one authenticated identity UTXO at getAddress()', async () => {
    const { signer } = await fundedSigner('b1');
    const predicted = deriveLogicalCreateAddress(signer.getAddress(), await signer.getNonce());
    const token = await new ContractFactory(compileString(TOKEN), signer).deploy();
    expect(await token.getAddress()).toBe(predicted);
    const identity = await resolveLogicalIdentity(signer.provider, predicted);
    expect(identity.categoryId).toBe(token.categoryId);
    const atAddress = await signer.provider.getUtxos(predicted);
    const scid = atAddress.filter((utxo) => isScidIdentityCommitment(utxo.token?.nft?.commitment));
    expect(scid).toHaveLength(1);
  });

  it('preserves that identity across transfer and approve', async () => {
    const { signer } = await fundedSigner('b2');
    const token = await new ContractFactory(compileString(TOKEN), signer).deploy();
    const recipient = new Signer(freshKey(), signer.provider);
    await token.transfer(recipient.getAddress(), 10n);
    const afterTransfer = await resolveLogicalIdentity(signer.provider, await token.getAddress());
    expect(afterTransfer.categoryId).toBe(token.categoryId);
    await token.approve(recipient.getAddress(), 5n);
    const afterApprove = await resolveLogicalIdentity(signer.provider, await token.getAddress());
    expect(afterApprove.categoryId).toBe(token.categoryId);
    const scid = (await signer.provider.getUtxos(await token.getAddress()))
      .filter((utxo) => isScidIdentityCommitment(utxo.token?.nft?.commitment));
    expect(scid).toHaveLength(1);
  });

  it('preserves FakeToken.json identity across the marketplace fixture transfer/approve sequence', async () => {
    const { readFileSync, existsSync } = await import('fs');
    const artifactPath = new URL(
      '../../../../bench/effectiveacceleration/artifacts/solidcash/FakeToken.json',
      import.meta.url,
    );
    const path = artifactPath.pathname;
    if (!existsSync(path)) return;
    const { signer } = await fundedSigner('b4');
    const artifact = JSON.parse(readFileSync(path, 'utf8'));
    // The bench compiles FakeToken framed, whose getAddress() is the lock its frames present: the SCID anchor
    // sits at the CREATE address the deploy derives, which getAddress() is only in the direct convention.
    const logical = deriveLogicalCreateAddress(signer.getAddress(), await signer.getNonce());
    const token = await new ContractFactory(artifact, signer).deploy('Test', 'TST');
    const user1 = new Signer(freshKey(), signer.provider);
    const user2 = new Signer(freshKey(), signer.provider);
    const marketplace = new Signer(freshKey(), signer.provider);
    await signer.provider.addUtxo(user1.getAddress(), { txid: 'c1'.repeat(32), vout: 0, satoshis: 5_000_000n });
    await signer.provider.addUtxo(user2.getAddress(), { txid: 'c2'.repeat(32), vout: 0, satoshis: 5_000_000n });
    await token.transfer(user1.getAddress(), 10n);
    await token.connect(user1).approve(marketplace.getAddress(), 20n);
    await token.transfer(user2.getAddress(), 10n);
    await token.connect(user2).approve(marketplace.getAddress(), 20n);
    const utxos = await signer.provider.getUtxos(logical);
    const scid = utxos.filter((utxo) => isScidIdentityCommitment(utxo.token?.nft?.commitment));
    expect({
      total: utxos.length,
      scid: scid.length,
      tokens: utxos.map((utxo) => utxo.token?.nft?.commitment?.slice(0, 16) ?? 'plain'),
    }).toEqual({ total: expect.any(Number), scid: 1, tokens: expect.any(Array) });
    expect(scid).toHaveLength(1);
    await resolveLogicalIdentity(signer.provider, logical);
  });

  it('preserves FakeToken.json identity across transfer to another account', async () => {
    const { readFileSync, existsSync } = await import('fs');
    const artifactPath = new URL(
      '../../../../bench/effectiveacceleration/artifacts/solidcash/FakeToken.json',
      import.meta.url,
    );
    const path = artifactPath.pathname;
    if (!existsSync(path)) return;
    const { signer } = await fundedSigner('b3');
    const artifact = JSON.parse(readFileSync(path, 'utf8'));
    // The bench compiles FakeToken framed, whose getAddress() is the lock its frames present: the SCID anchor
    // sits at the CREATE address the deploy derives, which getAddress() is only in the direct convention.
    const logical = deriveLogicalCreateAddress(signer.getAddress(), await signer.getNonce());
    const token = await new ContractFactory(artifact, signer).deploy('Test', 'TST');
    const before = await resolveLogicalIdentity(signer.provider, logical);
    expect(before.categoryId).toBe(token.categoryId);
    const recipient = new Signer(freshKey(), signer.provider);
    await token.transfer(recipient.getAddress(), 10n);
    const after = await resolveLogicalIdentity(signer.provider, logical);
    expect(after.categoryId).toBe(token.categoryId);
    expect((await signer.provider.getUtxos(logical))
      .filter((utxo) => isScidIdentityCommitment(utxo.token?.nft?.commitment))).toHaveLength(1);
  });
});
