import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import {
  ContractFactory, Signer, resolveLogicalIdentity, deriveLogicalCreateAddress,
  buildLogicalIdentityCommitment,
} from '../../src/index.js';
import {
  isScidIdentityCommitment, logicalIdentityAddressVariants, sameLogicalIdentityAddress,
  logicalLockFromScidCommitment, resolveLogicalIdentityFromAddresses,
  resolveLogicalIdentityByCategory, requireMsgSenderIdentity, isZeroMsgSenderCategory,
} from '../../src/stateful/logical-identity.js';
import { reassertScidIdentityOutputs } from '../../src/stateful/StatefulTransactionBuilder.js';
import { addressToLockScript } from '../../src/utils.js';
import { binToHex } from '@bitauth/libauth';
import { createTestProvider } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';

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

describe('logical CREATE identity at getAddress()', () => {
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
      { to: lock, amount: 1200n, token: { category: 'aa'.repeat(32), nft: { capability: 'minting' } } },
      { to: Uint8Array.of(0x51), amount: 1000n },
      { to: lock, amount: 1200n },
    ];
    expect(reassertScidIdentityOutputs(outputs, [{
      satoshis: 1200n,
      token: { category: 'aa'.repeat(32), amount: 0n, nft: { capability: 'none', commitment } },
      unlocker: { generateLockingBytecode: () => lock },
    }])).toBe(1);
    expect((outputs[0].token as { nft?: { capability?: string } }).nft?.capability).toBe('minting');
    expect((outputs[2].token as { nft?: { commitment?: string } }).nft?.commitment).toBe(commitment);
  });

  it('recreates a SCID even when the input index is a mutable occupant', () => {
    const commitment = '5343494401beef';
    const lock = Uint8Array.of(0xaa, 0x20, 0xee);
    const outputs: Array<{ to?: Uint8Array; amount?: bigint; token?: object }> = [
      { to: lock, amount: 1200n, token: { category: 'bb'.repeat(32), nft: { capability: 'mutable', commitment: '00' } } },
      { to: Uint8Array.of(0x76, 0xa9), amount: 1000n },
    ];
    expect(reassertScidIdentityOutputs(outputs, [{
      satoshis: 1200n,
      token: { category: 'bb'.repeat(32), amount: 0n, nft: { capability: 'none', commitment } },
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
      token: { category: 'cc'.repeat(32), amount: 0n, nft: { capability: 'none', commitment } },
      unlocker: { generateLockingBytecode: () => lock },
    }], new Set([0, 1]))).toBe(1);
    expect(outputs[0].token).toBeUndefined();
    expect(outputs[1].token).toBeUndefined();
    expect((outputs[2].token as { nft?: { commitment?: string } }).nft?.commitment).toBe(commitment);
  });

  it('recreates a consumed SCID identity 1:1 at its input index', () => {
    const commitment = '5343494401dead';
    const outputs: Array<{ to?: Uint8Array; amount?: bigint; token?: object }> = [
      { to: Uint8Array.of(0x51), amount: 1000n },
    ];
    const added = reassertScidIdentityOutputs(outputs, [{
      satoshis: 1200n,
      token: { category: 'aa'.repeat(32), amount: 0n, nft: { capability: 'none', commitment } },
      unlocker: { generateLockingBytecode: () => Uint8Array.of(0xaa, 0x20) },
    }]);
    expect(added).toBe(1);
    expect(outputs).toHaveLength(1);
    expect((outputs[0].token as { nft?: { commitment?: string } }).nft?.commitment).toBe(commitment);
    expect(reassertScidIdentityOutputs(outputs, [{
      satoshis: 1200n,
      token: { category: 'aa'.repeat(32), amount: 0n, nft: { capability: 'none', commitment } },
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
      token: { category: 'aa'.repeat(32), amount: 0n, nft: { capability: 'none', commitment: firstCommitment } },
      unlocker: { generateLockingBytecode: () => firstLock },
    }, {
      satoshis: 1200n,
      token: { category: 'bb'.repeat(32), amount: 0n, nft: { capability: 'none', commitment: secondCommitment } },
      unlocker: { generateLockingBytecode: () => secondLock },
    }])).toBe(2);
    expect(outputs).toHaveLength(2);
    expect(outputs.map((output) => (
      output.token as { nft?: { commitment?: string } }
    ).nft?.commitment)).toEqual([firstCommitment, secondCommitment]);
  });

  it('requires the unique SCID of a non-zero msg.sender category', async () => {
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
      '../../../../examples/effectiveacceleration/artifacts/solidcash/FakeToken.json',
      import.meta.url,
    );
    const path = artifactPath.pathname;
    if (!existsSync(path)) return;
    const { signer } = await fundedSigner('b4');
    const artifact = JSON.parse(readFileSync(path, 'utf8'));
    const token = await new ContractFactory(artifact, signer).deploy('Test', 'TST');
    const logical = await token.getAddress();
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
      '../../../../examples/effectiveacceleration/artifacts/solidcash/FakeToken.json',
      import.meta.url,
    );
    const path = artifactPath.pathname;
    if (!existsSync(path)) return;
    const { signer } = await fundedSigner('b3');
    const artifact = JSON.parse(readFileSync(path, 'utf8'));
    const token = await new ContractFactory(artifact, signer).deploy('Test', 'TST');
    const before = await resolveLogicalIdentity(signer.provider, await token.getAddress());
    expect(before.categoryId).toBe(token.categoryId);
    const recipient = new Signer(freshKey(), signer.provider);
    await token.transfer(recipient.getAddress(), 10n);
    const after = await resolveLogicalIdentity(signer.provider, await token.getAddress());
    expect(after.categoryId).toBe(token.categoryId);
    expect((await signer.provider.getUtxos(await token.getAddress()))
      .filter((utxo) => isScidIdentityCommitment(utxo.token?.nft?.commitment))).toHaveLength(1);
  });
});
