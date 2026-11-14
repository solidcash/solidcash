/**
 * A7 and B6.5 with `genesisCalls` on by default (A18, decision a).
 *
 * A record-sound contract compiled with no option takes the genesis call in every record-publishing entry and its
 * code carries the record-sound flag. One body serves a standalone run and a frame of the multi-call entry: a frame
 * requires its genesis call empty, while a standalone run of the same body answers a tag. `genesisCalls: false`
 * compiles no contract as record-sound: its code is the code compiled before the default changed, less the marker.
 */
import { describe, expect, it } from 'vitest';
import {
  bigIntToVmNumber, binToHex, decodeTransactionUnsafe, encodeDataPush, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { asmToScript, scriptToBytecode, sha256 } from '@solidcash/utils';
import { compileString } from '../src/compiler.js';
import { CODE_MARKER_MAGIC, CODE_MARKER_RECORD_SOUND } from '../src/generation/CodeTail.js';
import { Contract, SignatureTemplate } from '../../solidcash/src/index.js';
import type { FunctionArgument } from '../../solidcash/src/Argument.js';
import MockNetworkProvider from '../../solidcash/src/network/MockNetworkProvider.js';
import { StatefulContract } from '../../solidcash/src/stateful/index.js';
import { callRecordCommitment, callRecordDigest } from '../../solidcash/src/stateful/call-record.js';
import { alicePub, alicePriv, alicePkh } from '../../solidcash/test/fixture/vars.js';
import { createTestProvider, expectScriptRejection, setupStatefulUtxos } from '../../solidcash/test/test-util.js';
import p2pkhArtifact from '../../solidcash/test/fixture/p2pkh.artifact.js';

const P = 'pragma solidcash ^0.50.0;';

const COUNTER = `${P}
contract Counter() {
  bigint count;
  function add(bigint value) public { this.count = this.count + value; }
  function get() public returns (bigint) { return this.count; }
}`;

type Artifact = ReturnType<typeof compileString>;
type Tx = ReturnType<typeof decodeTransactionUnsafe>;
type Output = Tx['outputs'][number];

const MARKER = Uint8Array.from([0x15, ...CODE_MARKER_MAGIC, CODE_MARKER_RECORD_SOUND, 0x75]);
const codeOf = (artifact: Artifact): Uint8Array => scriptToBytecode(asmToScript(artifact.bytecode));
const endsWithMarker = (code: Uint8Array): boolean => binToHex(code.slice(-MARKER.length)) === binToHex(MARKER);
const shaOf = (code: Uint8Array): string => binToHex(sha256(code));
const takesGenesisCall = (fn: Artifact['abi'][number]): boolean => fn.inputs
  .some((input) => input.name === '__internal__genesisCall');
const publishesRecord = (fn: Artifact['abi'][number]): boolean => fn.inputs
  .some((input) => input.name === '__internal__returnOutputIdx');

describe('genesisCalls is on by default', () => {
  it('takes the genesis call in every record-publishing entry and flags the code record-sound', () => {
    for (const options of [{ messageBus: false }, { messageBus: false, callBatch: true }]) {
      const artifact = compileString(COUNTER, options);
      expect(artifact.recordSound).toBe(true);
      expect(artifact.genesisCalls).toBe(true);
      expect(endsWithMarker(codeOf(artifact))).toBe(true);
      const publishing = artifact.abi.filter(publishesRecord);
      // The void entry publishes its void record, the returning one its result.
      expect(publishing.map((fn) => fn.name)).toEqual(['add', 'get']);
      for (const fn of publishing) {
        const names = fn.inputs.map((input) => input.name);
        expect(names.indexOf('__internal__genesisCall'), fn.name).toBe(names.indexOf('__internal__returnOutputIdx') - 1);
      }
      // The default is the option on.
      expect(compileString(COUNTER, { ...options, genesisCalls: true }).bytecode).toBe(artifact.bytecode);
    }
  });

  it('keeps every frame of the multi-call entry, each taking the genesis call', () => {
    const artifact = compileString(COUNTER, { messageBus: false, callBatch: true });
    expect(artifact.callBatch).toEqual({ selector: '53434442' });
    const frames = artifact.abi.filter((fn) => fn.callBatchRow === true);
    expect(frames.map((fn) => fn.name)).toEqual(['add', 'get']);
    expect(frames.every(takesGenesisCall)).toBe(true);
  });

  it('gives no genesis call to a contract that is not record-sound, nor to a stateless one', () => {
    const delegate = compileString(`${P} contract C { int s; function a() { s = s + 1; }
      function d() delegate { s = s + 2; } }`, { messageBus: false, allowUnsafeOperations: true });
    expect(delegate.recordSound).toBe(false);
    expect(delegate.abi.some(takesGenesisCall)).toBe(false);
    const stateless = compileString(`${P} contract C(bytes20 pkh) {
      function get(int a) public pure returns (int) { return a + 1; }
      function spend(int a) { require(a > 1); require(pkh != bytes20(0)); } }`, { messageBus: false });
    expect(stateless.recordSound).toBeUndefined();
    expect(stateless.abi.some(takesGenesisCall)).toBe(false);
    expect(endsWithMarker(codeOf(stateless))).toBe(false);
  });

  it('runs a record-publishing public function called internally, which takes no genesis call there', async () => {
    const source = `${P} contract Tally { int calls;
      function scaled(int a) public pure returns (int) { return a * 2 + 1; }
      function hit(int a) public { calls = calls + scaled(a) + scaled(a + 1); } }`;
    const artifact = compileString(source, { messageBus: false });
    expect(artifact.recordSound).toBe(true);
    expect(artifact.abi.filter(takesGenesisCall).map((fn) => fn.name)).toEqual(['scaled', 'hit']);
    const provider = createTestProvider();
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const funding = { txid: 'c3c0'.repeat(16), vout: 0, satoshis: 300000n };
    await provider.addUtxo(p2pkh.address, funding);
    const deployed = await StatefulContract.deploy(artifact, [], {
      provider,
      fundingUtxo: funding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { calls: 1n },
      changeAddress: p2pkh.address,
    });
    await deployed.contract.functions.hit(2n).then((builder) => builder.send());
    // 1 + (2 * 2 + 1) + (3 * 2 + 1)
    expect((await deployed.contract.getState()).calls).toBe(13n);
  }, 300_000);
});

/**
 * Each code's SHA-256 as the compiler gave it before the default changed, at this tree: with the option unset, and with
 * `genesisCalls: false`. Before, an unset option compiled no genesis call but flagged a record-sound contract, and
 * `false` flagged one with a returning entry.
 */
const BEFORE = {
  unsafe: {
    source: `${P} contract C { int s; function u() unsafe { s = s + 1; } }`, options: {},
    unset: 'feca362958c626029846f778b461e3e937e0ebe0bda76f05438b9f4069c461e5',
    off: 'feca362958c626029846f778b461e3e937e0ebe0bda76f05438b9f4069c461e5',
  },
  fallback: {
    source: `${P} contract C { int s; function a() { s = s + 1; } fallback() external { s = s + 2; } }`,
    options: { allowUnsafeOperations: true },
    unset: 'ca2364fbc2e2ceeac4d24641863972a6af0644c6ab78aa813eaccce2a3a04a49',
    off: 'ca2364fbc2e2ceeac4d24641863972a6af0644c6ab78aa813eaccce2a3a04a49',
  },
  delegate: {
    source: `${P} contract C { int s; function a() { s = s + 1; } function d() delegate { s = s + 2; } }`,
    options: { allowUnsafeOperations: true },
    unset: '0499eddb7172305c03463ba4317867dc2b6c044dc5b156dcc4b33aecd126516a',
    off: '0499eddb7172305c03463ba4317867dc2b6c044dc5b156dcc4b33aecd126516a',
  },
  stateless: {
    source: `${P} contract C(bytes20 pkh) { function get(int a) public pure returns (int) { return a + 1; } `
      + 'function spend(int a) { require(a > 1); require(pkh != bytes20(0)); } }',
    options: {},
    unset: 'c666c01821266f5f7a6c393ce79b5f94610d40eeb5d3c4ebc24d055af74f6986',
    off: 'c666c01821266f5f7a6c393ce79b5f94610d40eeb5d3c4ebc24d055af74f6986',
  },
  voidOnly: {
    source: `${P} contract C { int calls; function hit(int amount) { calls = calls + amount; } }`, options: {},
    unset: '4d314712a73009abac2480e9798645f61ee4a1c371d59c7439b4b3fe7e36693c',
    off: '7d16538bbbff9e6f9a2a044df89a7679d01b8104cb93d141bba9c3cf4e3b9d88',
  },
  returning: {
    source: `${P} contract C { int calls; function hit(int amount) { calls = calls + amount; } `
      + 'function get() public returns (int) { return calls; } }',
    options: {},
    unset: '226697a774462956aae359b234a6701c88629fff81ccd6ccfe58a4279253b2c0',
    off: '226697a774462956aae359b234a6701c88629fff81ccd6ccfe58a4279253b2c0',
  },
} as const;

describe('genesisCalls: false', () => {
  const compile = (name: keyof typeof BEFORE, options: Record<string, unknown>): Artifact => compileString(
    BEFORE[name].source, { messageBus: false, ...BEFORE[name].options, ...options },
  );

  it('is the code compiled before, unset or off, for a contract that is not record-sound', () => {
    for (const name of ['unsafe', 'fallback', 'delegate', 'stateless'] as const) {
      const off = compile(name, { genesisCalls: false });
      expect(shaOf(codeOf(off)), name).toBe(BEFORE[name].unset);
      expect(shaOf(codeOf(off)), name).toBe(BEFORE[name].off);
      expect(compile(name, {}).bytecode, name).toBe(off.bytecode);
    }
  });

  it('is the code compiled before less its record-sound marker, for a record-sound contract', () => {
    for (const name of ['voidOnly', 'returning'] as const) {
      const off = compile(name, { genesisCalls: false });
      const code = codeOf(off);
      expect(endsWithMarker(code), name).toBe(false);
      // The unset compile of before, less the marker it carried.
      expect(shaOf(Uint8Array.from([...code, ...MARKER])), name).toBe(BEFORE[name].unset);
      expect(off.recordSound, name).toBeUndefined();
      expect(off.genesisCalls, name).toBe(false);
      expect(off.abi.some(takesGenesisCall), name).toBe(false);
    }
    // `false` before: unchanged where it carried no marker, and less the marker where it carried one.
    expect(shaOf(codeOf(compile('voidOnly', { genesisCalls: false })))).toBe(BEFORE.voidOnly.off);
    const returning = codeOf(compile('returning', { genesisCalls: false }));
    expect(shaOf(Uint8Array.from([...returning, ...MARKER]))).toBe(BEFORE.returning.off);
  });
});

// P2SH32 of `OP_1`, spent with a push of its redeem script.
const FUNDER = 'aa20953ccfa596a6c6d39e5980194539124fdcff116a571455a212baed811f585ee087';
const FUNDER_UNLOCK = Uint8Array.from([0x01, 0x51]);
let funderNonce = 0x6c00;

/** A funder coin at `(txid, 0)`: its input, and the change a spend returns to it. */
async function funder(provider: MockNetworkProvider): Promise<{ txid: string; input: Tx['inputs'][number]; change: Output }> {
  const txid = (funderNonce++).toString(16).padStart(64, '0');
  await provider.addUtxo(FUNDER, { txid, vout: 0, satoshis: 50000n });
  return {
    txid,
    input: { outpointTransactionHash: hexToBin(txid), outpointIndex: 0, sequenceNumber: 0xffffffff,
      unlockingBytecode: FUNDER_UNLOCK },
    change: { lockingBytecode: hexToBin(FUNDER), valueSatoshis: 40000n } as Output,
  };
}

async function capture(provider: MockNetworkProvider, run: () => Promise<unknown>): Promise<Tx> {
  let captured = '';
  const send = provider.sendRawTransaction.bind(provider);
  (provider as unknown as { sendRawTransaction: (hex: string) => Promise<string> }).sendRawTransaction = async (hex) => {
    captured = hex;
    throw new Error('capture-only');
  };
  try {
    await expect(run()).rejects.toThrow('capture-only');
  } finally {
    (provider as unknown as { sendRawTransaction: typeof send }).sendRawTransaction = send;
  }
  return decodeTransactionUnsafe(hexToBin(captured));
}

const outcomeOf = (provider: MockNetworkProvider, tx: Tx): Promise<string> => provider
  .sendRawTransaction(binToHex(encodeTransaction(tx))).then(() => 'ACCEPTED').catch((error: Error) => error.message);

/** A constructor's genesis call for a callee that does not read `msg.sender`: X ‖ slot ‖ g_in, X spent at (X, 0). */
const genesisTag = (txid: string, slot: number, gIn: number): Uint8Array => Uint8Array.from([
  ...hexToBin(txid).reverse(), slot & 0xff, slot >> 8, gIn & 0xff, gIn >> 8,
]);

/** The digest of a tagged run of an entry without visible arguments: `ff ff ‖ tag ‖ selector`. */
const taggedDigest = (selector: string, tag: Uint8Array): Uint8Array => sha256(Uint8Array.from([
  0xff, 0xff, ...tag.slice(0, 34), ...hexToBin(selector),
])).slice(0, 31);

const resultOf = (value: bigint): Uint8Array => encodeDataPush(bigIntToVmNumber(value));

describe('a multi-call frame requires its genesis call empty', () => {
  it('runs a batch with empty genesis calls, refuses a frame given a tag, and answers that tag standalone', async () => {
    const artifact = compileString(COUNTER, { messageBus: false, callBatch: true });
    const provider = new MockNetworkProvider();
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { count: 3n }, { saltContract: true },
    );
    const counter = StatefulContract.withCategory(contract, categoryId) as StatefulContract<any>;
    const abi = (name: string): Artifact['abi'][number] => artifact.abi.find((fn) => fn.name === name)!;
    const args = (name: string, values: Record<string, FunctionArgument>): FunctionArgument[] => abi(name).inputs
      .map((input) => values[input.name] ?? (input.name === '__internal__genesisCall' ? new Uint8Array() : 0n));

    // The master at input 0 and its data record at input 1; the record leaves `add(2)` at 5.
    const added = await capture(provider, () => counter.add(2n).send());
    expect(added.outputs[0]!.token?.nft?.capability).toBe('minting');
    const category = added.outputs[0]!.token!.category;
    const carrier = (commitment: Uint8Array): Output => ({
      lockingBytecode: Uint8Array.of(0x51), valueSatoshis: 1000n,
      token: { category, amount: 0n, nft: { capability: 'none', commitment } },
    } as Output);

    // Frames add(2) and get(), their records at outputs 2 and 3; the funder at input 2 spends (X, 0).
    const batch = (pay: Awaited<ReturnType<typeof funder>>, genesis: Uint8Array, getDigest?: Uint8Array): Tx => {
      const addArgs = args('add', { value: 2n, __internal__returnOutputIdx: 2n });
      const getArgs = args('get', { __internal__returnOutputIdx: 3n, __internal__genesisCall: genesis });
      const frames = [{ abiFunction: abi('add'), args: addArgs }, { abiFunction: abi('get'), args: getArgs }];
      return {
        version: added.version,
        locktime: added.locktime,
        inputs: [
          { ...added.inputs[0]!, unlockingBytecode: counter.inner.createCallBatchUnlocker(frames)
            .generateUnlockingBytecode({} as never) },
          added.inputs[1]!,
          pay.input,
        ],
        outputs: [
          added.outputs[0]!, added.outputs[1]!,
          carrier(callRecordCommitment(new Uint8Array(), callRecordDigest(abi('add'), addArgs, {}, 0)!)),
          carrier(callRecordCommitment(resultOf(5n), getDigest ?? callRecordDigest(abi('get'), getArgs, {}, 1)!)),
          pay.change,
        ],
      } as Tx;
    };

    // A frame given a well-formed tag, with the record a tagged run pins: refused, as a frame answers no constructor.
    const taggedPay = await funder(provider);
    const tag = genesisTag(taggedPay.txid, 0, 2);
    expectScriptRejection(
      await outcomeOf(provider, batch(taggedPay, tag, taggedDigest(abi('get').selector!, tag))), 0,
    );
    // Every genesis call empty: the batch runs.
    expect(await outcomeOf(provider, batch(await funder(provider), new Uint8Array()))).toBe('ACCEPTED');
    expect((await counter.getState()).count).toBe(5n);

    // The same body run standalone answers a tag: its record, at output 2, is the tagged one.
    const got = await capture(provider, () => counter.get().send());
    expect(got.outputs[0]!.token?.nft?.capability).toBe('minting');
    const standalone = (pay: Awaited<ReturnType<typeof funder>>, genesis: Uint8Array, digest: Uint8Array): Tx => ({
      version: got.version,
      locktime: got.locktime,
      inputs: [
        { ...got.inputs[0]!, unlockingBytecode: counter.inner.unlock.get(genesis, 2n)
          .generateUnlockingBytecode({} as never) },
        got.inputs[1]!,
        pay.input,
      ],
      outputs: [got.outputs[0]!, got.outputs[1]!, carrier(callRecordCommitment(resultOf(5n), digest)), pay.change],
    } as Tx);
    const pay = await funder(provider);
    const standaloneTag = genesisTag(pay.txid, 0, 2);
    const ordinary = callRecordDigest(abi('get'), args('get', { __internal__returnOutputIdx: 2n }), {}, 0)!;
    const tagged = taggedDigest(abi('get').selector!, standaloneTag);
    // The digest covers the tag: an ordinary record does not answer a tagged run, nor a tagged record an ordinary one.
    expectScriptRejection(await outcomeOf(provider, standalone(pay, standaloneTag, ordinary)), 0);
    expectScriptRejection(await outcomeOf(provider, standalone(pay, new Uint8Array(), tagged)), 0);
    expect(await outcomeOf(provider, standalone(pay, standaloneTag, tagged))).toBe('ACCEPTED');
  }, 300_000);
});

describe('a payable entry answers a tag only when it is paid nothing', () => {
  it('refuses a tagged run whose satoshi container gains, and accepts one whose container is unchanged', async () => {
    const source = `${P} contract Box { int paid;
      function pay() public payable returns (int) { paid = paid + 1; return paid; } }`;
    const artifact = compileString(source, { messageBus: false });
    expect(artifact.recordSound).toBe(true);
    const provider = createTestProvider() as MockNetworkProvider;
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const funding = { txid: 'c3c1'.repeat(16), vout: 0, satoshis: 300000n };
    await provider.addUtxo(p2pkh.address, funding);
    const deployed = await StatefulContract.deploy(artifact, [], {
      provider,
      fundingUtxo: funding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { paid: 0n },
      changeAddress: p2pkh.address,
    });
    const box = deployed.contract as StatefulContract<any>;
    // The call as the SDK builds it, its master at input 0, then a funder at the next input that spends (X, 0). The
    // run publishes no record (witness -1), so only the genesis call's own checks and the value rule decide.
    const rerun = (call: Tx, pay: Awaited<ReturnType<typeof funder>>, genesis: Uint8Array): Tx => ({
      ...call,
      inputs: [
        { ...call.inputs[0]!, unlockingBytecode: box.inner.unlock.pay(genesis, -1n)
          .generateUnlockingBytecode({} as never) },
        ...call.inputs.slice(1),
        pay.input,
      ],
      outputs: [...call.outputs, pay.change],
    } as Tx);
    const paidCall = await capture(provider, () => box.pay().withValue(2000n).send());
    // The SDK's paid call keeps the value in a satoshi container output.
    expect(paidCall.outputs.some((output) => output.valueSatoshis === 2000n && output.token === undefined)).toBe(true);
    const paidPay = await funder(provider);
    const paidTag = genesisTag(paidPay.txid, 0, paidCall.inputs.length);
    expectScriptRejection(await outcomeOf(provider, rerun(paidCall, paidPay, paidTag)), 0);
    expect(await outcomeOf(provider, rerun(paidCall, paidPay, new Uint8Array()))).toBe('ACCEPTED');

    const unpaidCall = await capture(provider, () => box.pay().send());
    const unpaidPay = await funder(provider);
    const unpaidTag = genesisTag(unpaidPay.txid, 0, unpaidCall.inputs.length);
    expect(await outcomeOf(provider, rerun(unpaidCall, unpaidPay, unpaidTag))).toBe('ACCEPTED');
  }, 300_000);
});
