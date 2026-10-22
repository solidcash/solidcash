import { describe, expect, it } from 'vitest';
import {
  binToHex, cashAddressToLockingBytecode, decodeTransactionUnsafe, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { Contract, Signer } from '../../src/index.js';
import {
  StatefulContract, getContractFactory, upgrades,
} from '../../src/stateful/index.js';
import { alicePriv } from '../fixture/vars.js';
import {
  createTestProvider, expectScriptRejection, setupStatefulUtxos,
} from '../test-util.js';

/**
 * C3 on the TAKEN path of a direct delegatecall proxy (docs/security/SECURITY-AUDIT.md C3). A compiler-built
 * delegate writes the co-spent proxy's records, so every record covenant self-authorizes on the proxy master.
 * The proxy's own-category mutable count balanced a proxy record the delegate does not touch when it was rewritten
 * in place, and the certified default proxy drops even that count. The delegate now pins every proxy-category
 * mutable input outside the proxy's master+data block 1:1 (emitDelegateOutsideLayoutPin), admitting only the
 * record families it rewrites. A forwarded selector that reaches a NON-delegate implementation entry ran none of
 * that census, so a non-delegate entry of the delegate variant is now unspendable.
 *
 * Attack: a hand-written strict proxy (so the proxy count balances a rewrite) co-spends a proxy-category mutable
 * record beside a taken `setCount` delegatecall and rewrites it in place with a forged commitment. Honest: a
 * chunked mapping write through the certified default proxy still settles.
 */

// Attack: a compiler-built delegate LIBRARY behind a hand-written strict proxy (identical shape to DX-8).
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

// Honest: a compiler-built delegate CONTRACT behind the certified default proxy, writing a chunked mapping value.
const STORE = `pragma solidcash >=0.8.0;
contract Store() {
  bigint count;
  mapping(int => bytes) notes;
  function setNote(int k, bytes v) public { this.notes[k] = v; }
}`;

type Provider = ReturnType<typeof createTestProvider>;
type Tx = ReturnType<typeof decodeTransactionUnsafe>;
type Utxo = { txid: string; vout: number; satoshis: bigint; token?: { nft?: { commitment: string } } };

// P2SH32 of `OP_1`, spent with a push of its redeem script: a trivially-spendable record lock.
const RECORD_LOCK = 'aa20953ccfa596a6c6d39e5980194539124fdcff116a571455a212baed811f585ee087';
const RECORD_UNLOCK = Uint8Array.from([0x01, 0x51]);
const FUNDER = RECORD_LOCK;
const FUNDER_UNLOCK = RECORD_UNLOCK;
const ORIG_COMMIT = 'cc'.repeat(32);
const FORGED_COMMIT = hexToBin('dd'.repeat(32));

const randomTxid = (): string => (0x8000 + Math.floor(Math.random() * 0x7fff)).toString(16).padStart(64, '0');

interface Fixture {
  provider: Provider;
  proxySc: StatefulContract<any>;
  libSc: StatefulContract<any>;
  libMaster: Utxo;
  proxyCat: string;
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
  return {
    provider,
    proxySc: StatefulContract.withCategory(proxyContract, proxy.categoryId),
    libSc: StatefulContract.withCategory(libContract, lib.categoryId),
    libMaster: lib.masterUtxo,
    proxyCat: proxy.categoryId,
  };
}

const spends = (tx: Tx, utxo: Utxo): number => tx.inputs.findIndex((input) =>
  binToHex(input.outpointTransactionHash) === utxo.txid && input.outpointIndex === utxo.vout);

const outcomeOf = (provider: Provider, hex: string): Promise<string> => provider.sendRawTransaction(hex)
  .then(() => 'ACCEPTED').catch((e: Error) => e.message);

/**
 * The honest `setCount(5)` delegatecall, with a forged proxy-category mutable record co-spent at `RECORD_LOCK` and
 * rewritten in place at the same index with a forged commitment. The strict proxy's count balances (one proxy
 * record in, one out); only the delegate's outside-layout pin can refuse it.
 */
async function rewriteUntouchedRecord(f: Fixture): Promise<{ hex: string; impl: number }> {
  const builder: any = await f.proxySc.call.__fallback().withDelegatecall(f.libSc, 'setCount', [5n]).build();
  const tx = decodeTransactionUnsafe(encodeTransaction(builder.buildLibauthTransaction()));
  const impl = spends(tx, f.libMaster);
  expect(impl).toBeGreaterThanOrEqual(0);
  // The proxy category in transaction (wire) byte order, copied from the recreated proxy data-NFT output, found
  // by its (category-pinned) locking bytecode (no byte-order assumption).
  const proxyDataLock = binToHex(
    (cashAddressToLockingBytecode(f.proxySc.getDataNftAddress()) as { bytecode: Uint8Array }).bytecode,
  );
  const proxyOut = tx.outputs.find((output) => output.token
    && binToHex(output.lockingBytecode) === proxyDataLock);
  if (!proxyOut?.token) throw new Error('no proxy data-NFT output to copy the category from');
  const proxyCatWire = Uint8Array.from(proxyOut.token.category);

  const recordTxid = randomTxid();
  const slot = Math.max(tx.inputs.length, tx.outputs.length);
  const padCount = slot - tx.outputs.length;
  await (f.provider as any).addUtxo(RECORD_LOCK, {
    txid: recordTxid, vout: 0, satoshis: BigInt((padCount + 1) * 1000 + 4000),
    token: { category: f.proxyCat, amount: 0n, nft: { capability: 'mutable' as const, commitment: ORIG_COMMIT } },
  });
  // The forged record sits at input index `slot`; pad inputs with trivially-spendable funders up to it.
  while (tx.inputs.length < slot) {
    const funderTxid = randomTxid();
    await (f.provider as any).addUtxo(FUNDER, { txid: funderTxid, vout: 0, satoshis: 2000n });
    tx.inputs.push({
      outpointTransactionHash: hexToBin(funderTxid), outpointIndex: 0, sequenceNumber: 0xffffffff,
      unlockingBytecode: FUNDER_UNLOCK,
    });
  }
  tx.inputs.push({
    outpointTransactionHash: hexToBin(recordTxid), outpointIndex: 0, sequenceNumber: 0xffffffff,
    unlockingBytecode: RECORD_UNLOCK,
  });
  // Pad outputs so the forged record's output lands at the same index as its input.
  while (tx.outputs.length < slot) {
    tx.outputs.push({ lockingBytecode: hexToBin(FUNDER), valueSatoshis: 1000n });
  }
  tx.outputs.push({
    lockingBytecode: hexToBin(RECORD_LOCK), valueSatoshis: 1000n,
    token: { amount: 0n, category: proxyCatWire, nft: { capability: 'mutable', commitment: FORGED_COMMIT } },
  } as any);
  return { hex: binToHex(encodeTransaction(tx)), impl };
}

describe('C3: a direct delegate pins the proxy records it does not touch on the taken path', () => {
  it.skipIf(Boolean(process.env.TESTS_USE_REGTEST))(
    'refuses rewriting a proxy record the delegate does not touch', async () => {
      const f = await setup();
      const { hex, impl } = await rewriteUntouchedRecord(f);
      expectScriptRejection(await outcomeOf(f.provider, hex), impl);
    }, 300_000,
  );

  it.skipIf(Boolean(process.env.TESTS_USE_REGTEST))(
    'settles an honest chunked delegate write through the certified proxy', async () => {
      const provider = createTestProvider();
      const signer = new Signer(alicePriv, provider);
      for (const byte of ['a1', 'b2', 'c3', 'd4']) {
        await provider.addUtxo(signer.getAddress(), { txid: byte.repeat(32), vout: 0, satoshis: 1_000_000n });
      }
      const artifact = compileString(STORE);
      expect(artifact.delegateArtifact).toBeDefined();
      const proxy = await upgrades.deployProxy(getContractFactory(artifact, signer), { count: 0n });
      const long = new Uint8Array(90).fill(0x5a); // > 60 bytes: a chunked value
      const result = await (proxy as any).setNote(1n, long).send();
      expect(result.txid).toMatch(/^[0-9a-f]{64}$/);
    }, 300_000,
  );
});
