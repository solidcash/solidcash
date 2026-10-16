import { vmNumberToBigInt, binToHex, decodeTransactionUnsafe, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { hash160 } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import {
  Contract,
  SignatureTemplate,
} from '../../src/index.js';
import {
  SortedList,
  StatefulContract,
  getEntryNftAddress,
  keyToSlot,
} from '../../src/stateful/index.js';
import { addressToLockScript } from '../../src/utils.js';
import {
  alicePub,
  alicePriv,
  alicePkh,
} from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';
import type { Unlocker, Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// CRYPTO-4 binds every mapping/array entry to the master's exact lock, so an in-place upgrade would strand them.
// The migrateRecords entry drains one entry per transaction at the replacement-bound entry covenant (the SDK loops
// it inside StatefulContract.upgrade), then the upgrade moves the master.
const HOLDER = (): Uint8Array => hash160(alicePub);

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

describe('StatefulContract.upgrade() mapping-entry migration (CRYPTO-4)', () => {
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

  const ledgerV1 = compileString(LEDGER_V1);
  const ledgerV2 = compileString(LEDGER_V2);

  const deploy = async (label: string): Promise<{
    contract: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract']; categoryId: string;
  }> => {
    const fundingUtxo: Utxo = { txid: label.repeat(16), vout: 0, satoshis: 100_000n };
    await provider.addUtxo(p2pkh.address, fundingUtxo);
    return StatefulContract.deploy(ledgerV1, [alicePub], {
      provider,
      fundingUtxo,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      changeAddress: p2pkh.address,
    });
  };

  const upgradeFunding = async (label: string): Promise<{
    fundingUtxo: Utxo; funder: Unlocker; changeAddress: string;
  }> => {
    const fundingUtxo: Utxo = { txid: label.repeat(16), vout: 0, satoshis: 100_000n };
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

  it('drains entries at the replacement-bound covenant and the replacement reads them', async () => {
    const { contract, categoryId } = await deploy('f1cd');
    await contract.call.set(new SignatureTemplate(alicePriv), HOLDER(), 42n).send();

    const result = await StatefulContract.upgrade({
      provider,
      oldContract: contract,
      upgradeFunctionName: 'migrate',
      upgradeFunctionArgs: [new SignatureTemplate(alicePriv)],
      migrateRecordsFunctionArgs: [new SignatureTemplate(alicePriv)],
      newArtifact: ledgerV2,
      newConstructorArgs: [alicePub],
      ...(await upgradeFunding('f2cd')),
    });

    // The replacement reads the migrated entry at its own entry covenant.
    const newEntryAddress = getEntryNftAddress(result.contract.inner, categoryId, 'balances');
    const migrated = SortedList.fromUtxos(await provider.getUtxos(newEntryAddress)).find(keyToSlot(HOLDER()));
    expect(migrated === undefined ? 0n : vmNumberToBigInt(migrated.value)).toBe(42n);

    // The old entry covenant is drained.
    const oldEntryAddress = getEntryNftAddress(contract.inner, categoryId, 'balances');
    const oldEntries = (await provider.getUtxos(oldEntryAddress)).filter((utxo) => utxo.token !== undefined);
    expect(oldEntries).toHaveLength(0);
  });

  it('refuses an entry re-mint at the old covenant', async () => {
    const { contract, categoryId } = await deploy('e1cd');
    await contract.call.set(new SignatureTemplate(alicePriv), HOLDER(), 7n).send();

    // Capture the first migration transaction by refusing the broadcast.
    let hex = '';
    const send = provider.sendRawTransaction.bind(provider);
    (provider as any).sendRawTransaction = async (raw: string): Promise<string> => {
      hex = raw;
      throw new Error('kept, not broadcast');
    };
    try {
      await expect(StatefulContract.upgrade({
        provider,
        oldContract: contract,
        upgradeFunctionName: 'migrate',
        upgradeFunctionArgs: [new SignatureTemplate(alicePriv)],
        migrateRecordsFunctionArgs: [new SignatureTemplate(alicePriv)],
        newArtifact: ledgerV2,
        newConstructorArgs: [alicePub],
        ...(await upgradeFunding('e2cd')),
      })).rejects.toThrow('kept, not broadcast');
    } finally {
      (provider as any).sendRawTransaction = send;
    }

    const stranded = addressToLockScript(getEntryNftAddress(contract.inner, categoryId, 'balances'));
    const mutated = decodeTransactionUnsafe(hexToBin(hex));
    mutated.outputs[1].lockingBytecode = stranded.slice();
    await expect(provider.sendRawTransaction(binToHex(encodeTransaction(mutated))))
      .rejects.toThrow(/mandatory-script-verify-flag-failed/);
  });
});
