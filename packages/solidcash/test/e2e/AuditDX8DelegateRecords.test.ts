import { describe, expect, it } from 'vitest';
import {
  binToHex, cashAddressToLockingBytecode, decodeTransactionUnsafe, encodeDataPush, encodeTransaction, hexToBin,
  bigIntToVmNumber,
} from '@bitauth/libauth';
import { buildDataNftCovenantScript, buildInitialStateCommitments, scriptToBytecode } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, expectScriptRejection, setupStatefulUtxos } from '../test-util.js';

/**
 * Audit DX-8. A delegated call co-spends the implementation's minting master, which authorizes every record of the
 * implementation's own category. The delegate pinned only that master, so the same transaction could rewrite or
 * destroy the implementation's own data NFT (which the honest call co-spends and recreates unchanged), or mint a new
 * one. Every such transaction must now be refused at the implementation's input.
 */

const LIB = `pragma solidcash >=0.8.0;
library CountLib {
  bigint count;
  function setCount(bigint v) public { this.count = v; }
}`;

const PROXY = `pragma solidcash >=0.8.0;
contract CountProxy() {
  bigint count;
  function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
  fallback(bytes input) external {
    address impl = address(0x76a91489abcdefabbaabbaabbaabbaabbaabbaabbaabba88ac);
    impl.delegatecall(input);
    require(input.length > 0);
  }
}`;

type Provider = ReturnType<typeof createTestProvider>;
type Tx = ReturnType<typeof decodeTransactionUnsafe>;
type Utxo = { txid: string; vout: number; satoshis: bigint; token?: { nft?: { commitment: string } } };

// P2SH32 of `OP_1`, spent with a push of its redeem script.
const FUNDER = 'aa20953ccfa596a6c6d39e5980194539124fdcff116a571455a212baed811f585ee087';
const FUNDER_UNLOCK = Uint8Array.from([0x01, 0x51]);
const randomTxid = (): string => (0x8000 + Math.floor(Math.random() * 0x7fff)).toString(16).padStart(64, '0');
const num = (value: number): Uint8Array => encodeDataPush(bigIntToVmNumber(BigInt(value)));

interface Fixture {
  provider: Provider;
  proxySc: StatefulContract<any>;
  libSc: StatefulContract<any>;
  libCat: string;
  libMaster: Utxo;
  libRecord: Utxo;
  libRecordAddress: string;
  libRecordLock: Uint8Array;
  forged: Uint8Array;
}

async function setup(): Promise<Fixture> {
  const provider = createTestProvider();
  const libArt = compileString(LIB);
  const proxyArt = compileString(PROXY, { allowUnsafeOperations: true });
  const proxyContract = new Contract(proxyArt, [], { provider });
  const libContract = new Contract(libArt, [], { provider });
  const proxy = await setupStatefulUtxos(
    provider, proxyContract, proxyArt.stateLayout!, { count: 1n }, { saltContract: true },
  );
  const lib = await setupStatefulUtxos(
    provider, libContract, libArt.stateLayout!, { count: 7n }, { saltContract: true },
  );
  expect(lib.dataNftUtxos.length).toBe(1);
  const lockOf = (address: string): Uint8Array =>
    (cashAddressToLockingBytecode(address) as { bytecode: Uint8Array }).bytecode;
  return {
    provider,
    proxySc: StatefulContract.withCategory(proxyContract, proxy.categoryId),
    libSc: StatefulContract.withCategory(libContract, lib.categoryId),
    libCat: lib.categoryId,
    libMaster: lib.masterUtxo,
    libRecord: lib.dataNftUtxos[0],
    libRecordAddress: lib.dataNftAddresses[0],
    libRecordLock: lockOf(lib.dataNftAddresses[0]),
    forged: hexToBin(buildInitialStateCommitments(libArt.stateLayout!, { count: 666n })[0]),
  };
}

const spends = (tx: Tx, utxo: Utxo): number => tx.inputs.findIndex((input) =>
  binToHex(input.outpointTransactionHash) === utxo.txid && input.outpointIndex === utxo.vout);

interface Spend { tx: Tx; impl: number; record: number; recordOut: number; implToken: any }

/**
 * The honest delegated `setCount(5)`, which passes the implementation record through, with `tamper` applied and an
 * extra funding input and change output.
 */
async function tampered(f: Fixture, tamper: (spend: Spend) => void): Promise<{ hex: string; impl: number }> {
  const builder: any = await f.proxySc.call.__fallback().withDelegatecall(f.libSc, 'setCount', [5n]).build();
  const tx = decodeTransactionUnsafe(encodeTransaction(builder.buildLibauthTransaction()));
  const impl = spends(tx, f.libMaster);
  const record = spends(tx, f.libRecord);
  const implToken = tx.outputs[impl].token!;
  // The honest call co-spends the record and recreates it unchanged.
  const recordOut = tx.outputs.findIndex((output) => binToHex(output.lockingBytecode) === binToHex(f.libRecordLock)
    && binToHex(output.token?.category ?? new Uint8Array()) === binToHex(implToken.category));
  expect(impl).toBeGreaterThanOrEqual(0);
  expect(record).toBeGreaterThanOrEqual(0);
  expect(binToHex(tx.outputs[recordOut].token!.nft!.commitment)).toBe(f.libRecord.token!.nft!.commitment);
  const funderTxid = randomTxid();
  await (f.provider as any).addUtxo(FUNDER, { txid: funderTxid, vout: 0, satoshis: 40000n });
  tx.inputs.push({
    outpointTransactionHash: hexToBin(funderTxid), outpointIndex: 0, sequenceNumber: 0xffffffff,
    unlockingBytecode: FUNDER_UNLOCK,
  });
  tamper({ tx, impl, record, recordOut, implToken });
  tx.outputs.push({ lockingBytecode: hexToBin(FUNDER), valueSatoshis: 24000n });
  return { hex: binToHex(encodeTransaction(tx)), impl };
}

/** Re-sign the record input: `<impl> <out> <3>` rewrites it at `out`, `<impl> <2>` destroys it. */
const unlockRecord = (f: Fixture, { tx, impl, record }: Spend, args: number[]): void => {
  const redeem = scriptToBytecode(buildDataNftCovenantScript(hexToBin(f.libCat)));
  tx.inputs[record].unlockingBytecode = Uint8Array.from([
    ...[impl, ...args].flatMap((value) => [...num(value)]), ...encodeDataPush(redeem),
  ]);
};

const outcomeOf = (provider: Provider, hex: string): Promise<string> => provider.sendRawTransaction(hex)
  .then(() => 'ACCEPTED').catch((e: Error) => e.message);

describe('DX-8: a delegated call conserves the implementation records', () => {
  it('settles an honest delegated write and passes the implementation record through', async () => {
    const f = await setup();
    const tx = await f.proxySc.call.__fallback().withDelegatecall(f.libSc, 'setCount', [5n]).send();
    expect(tx.txid).toBeDefined();
    const live = (await f.provider.getUtxos(f.libRecordAddress)) as Utxo[];
    expect(live.map((u) => u.token?.nft?.commitment)).toEqual([f.libRecord.token!.nft!.commitment]);
  }, 300_000);

  // The funding UTXO is injected into the mock's UTXO set.
  it.skipIf(Boolean(process.env.TESTS_USE_REGTEST))('refuses a rewritten implementation record', async () => {
    const f = await setup();
    const { hex, impl } = await tampered(f, (spend) => {
      unlockRecord(f, spend, [spend.recordOut, 3]);
      spend.tx.outputs[spend.recordOut].token!.nft!.commitment = f.forged;
    });
    expectScriptRejection(await outcomeOf(f.provider, hex), impl);
  }, 300_000);

  it.skipIf(Boolean(process.env.TESTS_USE_REGTEST))('refuses a destroyed implementation record', async () => {
    const f = await setup();
    const { hex, impl } = await tampered(f, (spend) => {
      unlockRecord(f, spend, [2]);
      const out = spend.tx.outputs[spend.recordOut];
      spend.tx.outputs[spend.recordOut] = { lockingBytecode: hexToBin(FUNDER), valueSatoshis: out.valueSatoshis };
    });
    expectScriptRejection(await outcomeOf(f.provider, hex), impl);
  }, 300_000);

  it.skipIf(Boolean(process.env.TESTS_USE_REGTEST))('refuses a minted implementation record', async () => {
    const f = await setup();
    const { hex, impl } = await tampered(f, ({ tx, implToken }) => {
      tx.outputs.push({
        lockingBytecode: f.libRecordLock, valueSatoshis: 1000n,
        token: { amount: 0n, category: implToken.category.slice(), nft: { capability: 'mutable', commitment: f.forged } },
      } as any);
    });
    expectScriptRejection(await outcomeOf(f.provider, hex), impl);
  }, 300_000);
});
