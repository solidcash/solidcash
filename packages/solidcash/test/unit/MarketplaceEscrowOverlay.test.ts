import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { ContractFactory, Signer } from '../../src/index.js';
import { createTestProvider } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';
import { addressToLockScript } from '../../src/utils.js';
import { keyToSlot } from '../../src/stateful/SortedList.js';

function freshKey(): Uint8Array {
  const key = new Uint8Array(32);
  crypto.getRandomValues(key);
  key[0] = (key[0] & 0x7f) | 0x01;
  return key;
}

const TOKEN = 'contract Token() {'
  + ' mapping(address => int) _balances;'
  + ' constructor() { this._balances[msg.sender] = 1000000; }'
  + ' function transfer(address to, int amount) {'
  + '   require(this._balances[msg.sender] >= amount);'
  + '   this._balances[msg.sender] = this._balances[msg.sender] - amount;'
  + '   this._balances[to] = this._balances[to] + amount;'
  + ' }'
  + '}';

const TOKEN_TF = 'contract Token() {'
  + ' mapping(address => int) _balances;'
  + ' mapping(address => mapping(address => int)) _allowances;'
  + ' constructor() { this._balances[msg.sender] = 1000000; }'
  + ' function approve(address spender, int amount) {'
  + '   this._allowances[msg.sender][spender] = amount;'
  + ' }'
  + ' function transferFrom(address from, address to, int amount) {'
  + '   require(this._allowances[from][msg.sender] >= amount);'
  + '   require(this._balances[from] >= amount);'
  + '   this._allowances[from][msg.sender] = this._allowances[from][msg.sender] - amount;'
  + '   this._balances[from] = this._balances[from] - amount;'
  + '   this._balances[to] = this._balances[to] + amount;'
  + ' }'
  + ' function transfer(address to, int amount) {'
  + '   require(this._balances[msg.sender] >= amount);'
  + '   this._balances[msg.sender] = this._balances[msg.sender] - amount;'
  + '   this._balances[to] = this._balances[to] + amount;'
  + ' }'
  + '}';

describe('marketplace escrow overlay after extraTransfer', () => {
  it('credits marketplace escrow when chain lookup still shows the pre-transfer amount', async () => {
    const provider = createTestProvider();
    const signer = new Signer(freshKey(), provider);
    const fundingUtxo: Utxo = { txid: 'e1'.repeat(32), vout: 0, satoshis: 5_000_000n };
    await provider.addUtxo(signer.getAddress(), fundingUtxo);
    const token = await new ContractFactory(compileString(TOKEN), signer).deploy();
    const marketplace = new Signer(freshKey(), provider);
    const user = signer.getAddress();
    const escrow = marketplace.getAddress();
    token._setSoftMapping('_balances', [user], 900n);
    token._setSoftMapping('_balances', [escrow], 100n);
    (token as { _pendingMarketplaceTokenTransfer?: object })._pendingMarketplaceTokenTransfer = {
      token,
      from: user,
      to: escrow,
      amount: 100n,
    };
    await token._commitPendingMarketplaceTokenTransfer();
    expect(await token._softReadErc20Balance(token, user)).toBe(800n);
    expect(await token._softReadErc20Balance(token, escrow)).toBe(200n);
  });

  it('does not subtract again when overlay is empty and chain already debited', async () => {
    const provider = createTestProvider();
    const signer = new Signer(freshKey(), provider);
    const fundingUtxo: Utxo = { txid: 'e3'.repeat(32), vout: 0, satoshis: 5_000_000n };
    await provider.addUtxo(signer.getAddress(), fundingUtxo);
    const token = await new ContractFactory(compileString(TOKEN), signer).deploy();
    const recipient = new Signer(freshKey(), provider);
    await token.transfer(recipient.getAddress(), 100n);
    (token as { _pendingMarketplaceTokenTransfer?: object })._pendingMarketplaceTokenTransfer = {
      token,
      from: signer.getAddress(),
      to: recipient.getAddress(),
      amount: 100n,
    };
    await token._commitPendingMarketplaceTokenTransfer();
    expect(await token._softReadErc20Balance(token, signer.getAddress())).toBe(999900n);
    expect(await token._softReadErc20Balance(token, recipient.getAddress())).toBe(100n);
  });

  it('does not treat a found zero mapping row as a full escrow drain', async () => {
    const provider = createTestProvider();
    const signer = new Signer(freshKey(), provider);
    const fundingUtxo: Utxo = { txid: 'e5'.repeat(32), vout: 0, satoshis: 5_000_000n };
    await provider.addUtxo(signer.getAddress(), fundingUtxo);
    const token = await new ContractFactory(compileString(TOKEN), signer).deploy();
    const marketplace = new Signer(freshKey(), provider);
    const user = signer.getAddress();
    const escrow = marketplace.getAddress();
    token._setSoftMapping('_balances', [user], 700n);
    token._setSoftMapping('_balances', [escrow], 300n);
    const original = token.getEntries.bind(token);
    token.getEntries = async (name: string) => (
      name === '_balances' ? [{ keys: [escrow], value: 0n }] as Awaited<ReturnType<typeof original>>
        : original(name)
    );
    (token as { _pendingMarketplaceTokenTransfer?: object })._pendingMarketplaceTokenTransfer = {
      token,
      from: escrow,
      to: user,
      amount: 200n,
    };
    await token._commitPendingMarketplaceTokenTransfer();
    expect(await token._softReadErc20Balance(token, escrow)).toBe(100n);
  });

  it('does not treat a missing marketplace entry as a full escrow drain', async () => {
    const provider = createTestProvider();
    const signer = new Signer(freshKey(), provider);
    const fundingUtxo: Utxo = { txid: 'e4'.repeat(32), vout: 0, satoshis: 5_000_000n };
    await provider.addUtxo(signer.getAddress(), fundingUtxo);
    const token = await new ContractFactory(compileString(TOKEN), signer).deploy();
    const marketplace = new Signer(freshKey(), provider);
    const user = signer.getAddress();
    const escrow = marketplace.getAddress();
    token._setSoftMapping('_balances', [user], 700n);
    token._setSoftMapping('_balances', [escrow], 300n);
    (token as { _pendingMarketplaceTokenTransfer?: object })._pendingMarketplaceTokenTransfer = {
      token,
      from: escrow,
      to: user,
      amount: 200n,
    };
    await token._commitPendingMarketplaceTokenTransfer();
    expect(await token._softReadErc20Balance(token, escrow)).toBe(100n);
  });

  it('keeps a larger on-chain credit when extraTransfer already landed', async () => {
    const provider = createTestProvider();
    const signer = new Signer(freshKey(), provider);
    const fundingUtxo: Utxo = { txid: 'e2'.repeat(32), vout: 0, satoshis: 5_000_000n };
    await provider.addUtxo(signer.getAddress(), fundingUtxo);
    const token = await new ContractFactory(compileString(TOKEN), signer).deploy();
    const recipient = new Signer(freshKey(), provider);
    await token.transfer(recipient.getAddress(), 200n);
    token._setSoftMapping('_balances', [signer.getAddress()], 300n);
    token._setSoftMapping('_balances', [recipient.getAddress()], 100n);
    (token as { _pendingMarketplaceTokenTransfer?: object })._pendingMarketplaceTokenTransfer = {
      token,
      from: signer.getAddress(),
      to: recipient.getAddress(),
      amount: 100n,
    };
    await token._commitPendingMarketplaceTokenTransfer();
    expect(await token._softReadErc20Balance(token, recipient.getAddress())).toBe(200n);
  });
});

describe('transferFrom _balances[to] INSERT', () => {
  it('lands a getEntries-visible credit under the recipient lock transfer would debit', async () => {
    const provider = createTestProvider();
    const owner = new Signer(freshKey(), provider);
    const spender = new Signer(freshKey(), provider);
    const recipient = new Signer(freshKey(), provider);
    await provider.addUtxo(owner.getAddress(), { txid: 'a1'.repeat(32), vout: 0, satoshis: 5_000_000n });
    await provider.addUtxo(spender.getAddress(), { txid: 'a2'.repeat(32), vout: 0, satoshis: 5_000_000n });
    const token = await new ContractFactory(compileString(TOKEN_TF), owner).deploy();
    await token.approve(spender.getAddress(), 100n);
    await token.connect(spender).transferFrom(owner.getAddress(), recipient.getAddress(), 100n);
    const entries = await token.getEntries('_balances');
    const wanted = binToHex(keyToSlot(addressToLockScript(recipient.getAddress())));
    const match = entries.find((entry) => entry.slot && binToHex(entry.slot) === wanted);
    expect(match).toBeDefined();
    expect(match?.value).toBe(100n);
  });
});
