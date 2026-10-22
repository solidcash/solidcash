import { binToHex, decodeTransactionUnsafe, hexToBin, vmNumberToBigInt } from '@bitauth/libauth';
import { hash160, hash256 } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import {
  Contract,
  SignatureTemplate,
} from '../../src/index.js';
import {
  SortedList,
  StatefulContract,
  getEntryNftAddress,
  getTokenContainerAddress,
  keyToSlot,
} from '../../src/stateful/index.js';
import { addressToLockScript } from '../../src/utils.js';
import {
  alicePub,
  alicePriv,
  alicePkh,
  bobPub,
} from '../fixture/vars.js';
import { createTestProvider, getTxOutputs } from '../test-util.js';
import type { Unlocker, Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// CRYPTO-4 binds every record and container to the master's exact lock, so whatever the upgrade leaves at the old lock
// is unspendable for good. The SDK plans the migration from complete listings: it carries only genuine records,
// refuses before any broadcast when one would be left behind, and pays every step from the caller's own coin.
const TOKEN = 'bb'.repeat(31) + '45';
const JUNK = 'ee'.repeat(32);

const VAULT_V1 = `
pragma solidcash >=0.8.0;

contract VaultV1(pubkey admin) {
    function pay(bytes32 tokenCategory, bytes20 recipient, int amount) {
        this.tokens[tokenCategory].transfer(recipient, amount);
    }

    function migrate(sig s) upgrade {
        require(checkSig(s, admin));
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

const VAULT_V2 = `
pragma solidcash >=0.8.0;

contract VaultV2(pubkey admin) {
    function pay(bytes32 tokenCategory, bytes20 recipient, int amount) {
        this.tokens[tokenCategory].transfer(recipient, amount);
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

const LEDGER_V1 = `
pragma solidcash >=0.8.0;

contract LedgerV1(pubkey admin) {
    mapping(bytes20 => int) public balances;

    function set(sig s, bytes20 holder, int amount) {
        require(checkSig(s, admin));
        this.balances[holder] = amount;
    }

    function migrateEntry(sig s) migrateRecords {
        require(checkSig(s, admin));
    }

    function migrate(sig s) upgrade {
        require(checkSig(s, admin));
    }
}
`;

const LEDGER_V2 = `
pragma solidcash >=0.8.0;

contract LedgerV2(pubkey admin) {
    mapping(bytes20 => int) public balances;

    function set(sig s, bytes20 holder, int amount) {
        require(checkSig(s, admin));
        this.balances[holder] = amount;
    }
}
`;

// Entries and a token container: the container plan must refuse before the entry migrations broadcast.
const LEDGER_VAULT_V1 = `
pragma solidcash >=0.8.0;

contract LedgerVaultV1(pubkey admin) {
    mapping(bytes20 => int) public balances;

    function set(sig s, bytes20 holder, int amount) {
        require(checkSig(s, admin));
        this.balances[holder] = amount;
    }

    function pay(bytes32 tokenCategory, bytes20 recipient, int amount) {
        this.tokens[tokenCategory].transfer(recipient, amount);
    }

    function migrateEntry(sig s) migrateRecords {
        require(checkSig(s, admin));
    }

    function migrate(sig s) upgrade {
        require(checkSig(s, admin));
    }
}
`;

const LEDGER_VAULT_V2 = `
pragma solidcash >=0.8.0;

contract LedgerVaultV2(pubkey admin) {
    mapping(bytes20 => int) public balances;

    function set(sig s, bytes20 holder, int amount) {
        require(checkSig(s, admin));
        this.balances[holder] = amount;
    }

    function pay(bytes32 tokenCategory, bytes20 recipient, int amount) {
        this.tokens[tokenCategory].transfer(recipient, amount);
    }
}
`;

describe('StatefulContract.upgrade() migration completeness (CRYPTO-4)', () => {
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

  const vaultV1 = compileString(VAULT_V1, { forceStateful: true });
  const vaultV2 = compileString(VAULT_V2, { forceStateful: true });
  const ledgerV1 = compileString(LEDGER_V1);
  const ledgerV2 = compileString(LEDGER_V2);
  const ledgerVaultV1 = compileString(LEDGER_VAULT_V1);
  const ledgerVaultV2 = compileString(LEDGER_VAULT_V2);

  const coin = (label: string, satoshis: bigint, token?: Utxo['token']): Utxo => ({
    txid: label.repeat(16), vout: 0, satoshis, ...(token === undefined ? {} : { token }),
  });

  const deploy = async (label: string, artifact: typeof vaultV1): Promise<{
    contract: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract']; categoryId: string;
  }> => {
    const fundingUtxo = coin(label, 100_000n);
    await provider.addUtxo(p2pkh.address, fundingUtxo);
    return StatefulContract.deploy(artifact, [alicePub], {
      provider,
      fundingUtxo,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      changeAddress: p2pkh.address,
    });
  };

  const upgradeFunding = async (label: string): Promise<{
    fundingUtxo: Utxo; funder: Unlocker; changeAddress: string;
  }> => {
    const fundingUtxo = coin(label, 500_000n);
    await provider.addUtxo('51', fundingUtxo);
    return {
      fundingUtxo,
      funder: {
        generateLockingBytecode: (): Uint8Array => hexToBin('51'),
        generateUnlockingBytecode: (): Uint8Array => new Uint8Array(),
      },
      changeAddress: p2pkh.address,
    };
  };

  const outpoints = async (address: string): Promise<string[]> => (await provider.getUtxos(address))
    .map((utxo) => `${utxo.txid}:${utxo.vout}`).sort();

  it('migrates the genuine token container past a dust and a foreign-category coin at its address', async () => {
    const { contract, categoryId } = await deploy('c1a0', vaultV1);
    const oldAddress = getTokenContainerAddress(contract.inner, categoryId, TOKEN);
    // Anyone can send these to the container address; neither is a container the covenant can carry.
    await provider.addUtxo(oldAddress, coin('c1a1', 1_000n, { category: JUNK, amount: 5n }));
    await provider.addUtxo(oldAddress, coin('c1a2', 546n));
    await provider.addUtxo(oldAddress, coin('c1a3', 2_000n, { category: TOKEN, amount: 1_000n }));

    const result = await StatefulContract.upgrade({
      provider,
      oldContract: contract,
      upgradeFunctionName: 'migrate',
      upgradeFunctionArgs: [new SignatureTemplate(alicePriv)],
      newArtifact: vaultV2,
      newConstructorArgs: [alicePub],
      tokenContainerCategoryIds: [TOKEN],
      ...(await upgradeFunding('c1a4')),
    });

    const newLock = binToHex(addressToLockScript(getTokenContainerAddress(result.contract.inner, categoryId, TOKEN)));
    const reMintIndex = result.tx.outputs.findIndex((output) => binToHex(output.lockingBytecode) === newLock);
    expect(reMintIndex).toBeGreaterThan(0);
    const reMint = getTxOutputs(result.tx)[reMintIndex];
    expect(reMint.token?.category).toBe(TOKEN);
    expect(reMint.token?.amount).toBe(1_000n);
    expect(reMint.amount).toBe(2_000n);

    // The junk stays where it was sent; only the genuine container left the old address.
    expect(await outpoints(oldAddress)).toEqual([`${'c1a1'.repeat(16)}:0`, `${'c1a2'.repeat(16)}:0`]);
    await result.contract.call.pay(hexToBin(TOKEN), alicePkh, 250n).send();
  });

  it('refuses, before broadcasting anything, an upgrade that would strand a genuine container', async () => {
    const { contract, categoryId } = await deploy('c2a0', ledgerVaultV1);
    await contract.call.set(new SignatureTemplate(alicePriv), hash160(alicePub), 42n).send();
    const containerAddress = getTokenContainerAddress(contract.inner, categoryId, TOKEN);
    // Two coins of the container's own category: both are the contract's, and the covenant migrates exactly one.
    await provider.addUtxo(containerAddress, coin('c2a1', 2_000n, { category: TOKEN, amount: 1_000n }));
    await provider.addUtxo(containerAddress, coin('c2a2', 2_000n, { category: TOKEN, amount: 300n }));
    const funding = await upgradeFunding('c2a4');
    const entryAddress = getEntryNftAddress(contract.inner, categoryId, 'balances');
    const entriesBefore = await outpoints(entryAddress);
    expect(entriesBefore.length).toBeGreaterThan(0);

    let broadcasts = 0;
    const send = provider.sendRawTransaction.bind(provider);
    (provider as any).sendRawTransaction = async (raw: string): Promise<string> => {
      broadcasts += 1;
      return send(raw);
    };
    try {
      await expect(StatefulContract.upgrade({
        provider,
        oldContract: contract,
        upgradeFunctionName: 'migrate',
        upgradeFunctionArgs: [new SignatureTemplate(alicePriv)],
        migrateRecordsFunctionArgs: [new SignatureTemplate(alicePriv)],
        newArtifact: ledgerVaultV2,
        newConstructorArgs: [alicePub],
        tokenContainerCategoryIds: [TOKEN],
        ...funding,
      })).rejects.toThrow(/would strand 1 of 2 live token container/);
    } finally {
      (provider as any).sendRawTransaction = send;
    }

    // No entry migration ran: every record is still at its old lock.
    expect(broadcasts).toBe(0);
    expect(await outpoints(entryAddress)).toEqual(entriesBefore);
    expect(await outpoints(containerAddress)).toHaveLength(2);
  });

  it('pays every entry migration from the caller\'s coin, chaining its change, and never mints a fee coin', async () => {
    const { contract, categoryId } = await deploy('c3a0', ledgerV1);
    await contract.call.set(new SignatureTemplate(alicePriv), hash160(alicePub), 42n).send();
    await contract.call.set(new SignatureTemplate(alicePriv), hash160(bobPub), 7n).send();
    const funding = await upgradeFunding('c3a4');
    const entryCount = (await provider.getUtxos(getEntryNftAddress(contract.inner, categoryId, 'balances')))
      .filter((utxo) => utxo.token !== undefined).length;
    expect(entryCount).toBeGreaterThanOrEqual(2);

    const raws: string[] = [];
    let minted = 0;
    const send = provider.sendRawTransaction.bind(provider);
    const addUtxo = provider.addUtxo.bind(provider);
    (provider as any).sendRawTransaction = async (raw: string): Promise<string> => {
      raws.push(raw);
      return send(raw);
    };
    (provider as any).addUtxo = async (address: string, utxo: Utxo): Promise<Utxo> => {
      minted += 1;
      return addUtxo(address, utxo);
    };
    let result: Awaited<ReturnType<typeof StatefulContract.upgrade>> | undefined;
    try {
      result = await StatefulContract.upgrade({
        provider,
        oldContract: contract,
        upgradeFunctionName: 'migrate',
        upgradeFunctionArgs: [new SignatureTemplate(alicePriv)],
        migrateRecordsFunctionArgs: [new SignatureTemplate(alicePriv)],
        newArtifact: ledgerV2,
        newConstructorArgs: [alicePub],
        ...funding,
      });
    } finally {
      (provider as any).sendRawTransaction = send;
      (provider as any).addUtxo = addUtxo;
    }
    expect(minted).toBe(0);

    // One transaction per entry, then the upgrade. The first spends the caller's coin; each later one spends the
    // change the step before returned to the funder's lock (output 2 of an entry migration).
    expect(raws).toHaveLength(entryCount + 1);
    const txs = raws.map((raw) => decodeTransactionUnsafe(hexToBin(raw)));
    const txidOf = (raw: string): string => binToHex(hash256(hexToBin(raw)).reverse());
    const spends = (step: number, txid: string, vout: number): boolean => txs[step].inputs
      .some((input) => binToHex(input.outpointTransactionHash) === txid && input.outpointIndex === vout);
    expect(spends(0, funding.fundingUtxo.txid, 0)).toBe(true);
    for (let step = 1; step < txs.length; step += 1) {
      expect(binToHex(txs[step - 1].outputs[2].lockingBytecode)).toBe('51');
      expect(spends(step, txidOf(raws[step - 1]), 2)).toBe(true);
    }

    // The replacement reads both migrated entries at its own entry covenant.
    const list = SortedList.fromUtxos(
      await provider.getUtxos(getEntryNftAddress(result!.contract.inner, categoryId, 'balances')),
    );
    const read = (holder: Uint8Array): unknown => {
      const entry = list.find(keyToSlot(holder));
      return entry === undefined ? 0n : vmNumberToBigInt(entry.value);
    };
    expect(read(hash160(alicePub))).toBe(42n);
    expect(read(hash160(bobPub))).toBe(7n);
  });
});
