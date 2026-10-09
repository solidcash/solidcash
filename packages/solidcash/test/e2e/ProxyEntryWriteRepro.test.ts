/* eslint-disable max-len -- contract source fixtures remain readable as complete declarations */
import { describe, it, expect } from 'vitest';
import {
  bigIntToVmNumber, binToHex, decodeAuthenticationInstructions, decodeTransactionUnsafe,
  encodeAuthenticationInstructions, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { Signer } from '../../src/index.js';
import {
  getContractFactory,
  keyToSlotMulti,
  upgrades,
} from '../../src/stateful/index.js';
import { alicePriv } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';

// Blocker A repro: MarketplaceDataV1.initialize fails BCH-2026 preflight at its own input when it writes even a
// SINGLE mapping entry (verified against the real project: 8 writes fail, 1 write fails, 0 writes succeed and
// the suite advances ~530 lines). MarketplaceV1, same OZ initializer/proxy machinery but scalar writes only,
// deploys fine.
//
// deployProxy runs the initializer as its OWN transaction (upgrades.ts ~573):
//   await handle.forward(initializer, args).withoutLogicalNonce().send();
// so this is NOT the deploy-then-call fold. These pin the initializer-forward path specifically: an ordinary
// post-deploy proxy call writing the same entry passes (last case), which isolates it to the forward.

const SCALAR_INIT = `pragma solidcash >=0.8.0;
  contract ScalarInit() {
    bigint counter;
    function initialize(bigint counter_) public { this.counter = counter_; }
  }`;

const ENTRY_INIT = `pragma solidcash >=0.8.0;
  contract EntryInit() {
    bigint counter;
    mapping(int => bigint) tags;
    function initialize(bigint counter_) public { this.counter = counter_; this.tags[1] = 11; }
  }`;

// The OZ shape: the `initializer` modifier sets _initializing = true, a nested __Ownable_init reads it back via
// `onlyInitializing`, and the body also writes mapping entries. Neither ingredient alone reproduces.
const FLAG_ENTRY_INIT = `pragma solidcash >=0.8.0;
  contract FlagEntryInit() {
    bool initializing;
    bigint counter;
    mapping(int => bigint) tags;
    function checkInit() internal view { require(this.initializing); }
    function initialize(bigint counter_) public {
      this.initializing = true;
      this.checkInit();
      this.counter = counter_;
      this.tags[1] = 11;
      this.initializing = false;
    }
  }`;

// meceTags is `mapping(string => string)`: dynamic KEY and dynamic VALUE, unlike the int=>bigint cases above.
const STRING_ENTRY_INIT = `pragma solidcash >=0.8.0;
  contract StringEntryInit() {
    bigint counter;
    mapping(string => string) tags;
    function initialize(bigint counter_) public { this.counter = counter_; this.tags["DA"] = "DIGITAL_AUDIO"; }
  }`;

const SORTED_BATCH_ENTRY_INIT = `pragma solidcash >=0.8.0;
  contract SortedBatchEntryInit() {
    mapping(string => string) tags;
    function initialize() public delegate {
      this.tags["DA"] = "DIGITAL_AUDIO";
      this.tags["DV"] = "DIGITAL_VIDEO";
      this.tags["DT"] = "DIGITAL_TEXT";
      this.tags["DS"] = "DIGITAL_SOFTWARE";
      this.tags["DO"] = "DIGITAL_OTHERS";
      this.tags["NDG"] = "NON_DIGITAL_GOODS";
      this.tags["NDS"] = "NON_DIGITAL_SERVICES";
      this.tags["NDO"] = "NON_DIGITAL_OTHERS";
    }
    function tagOf(string key) public delegate returns (string) { return this.tags[key]; }
  }`;

const ENTRY_CALL = `pragma solidcash >=0.8.0;
  contract EntryCall() {
    bigint counter;
    mapping(int => bigint) tags;
    function bump() public { this.counter = this.counter + 1; this.tags[1] = 11; }
  }`;

async function fundedSigner(): Promise<Signer> {
  const provider = createTestProvider();
  const signer = new Signer(alicePriv, provider);
  for (const seed of Array.from({ length: 20 }, (_unused, index) => (index + 1).toString(16).padStart(2, '0'))) {
    await provider.addUtxo(signer.getAddress(), { txid: seed.repeat(32), vout: 0, satoshis: 1_000_000n });
  }
  return signer;
}

describe('mapping-entry write inside a proxy initializer', () => {
  it('runs an initializer that writes only scalars', async () => {
    const signer = await fundedSigner();
    const Impl = getContractFactory(compileString(SCALAR_INIT), signer);
    const proxy = await upgrades.deployProxy(Impl, [7n]);
    await expect(proxy.waitForDeployment()).resolves.toBeDefined();
  });

  it('runs an initializer that ALSO writes a mapping entry', async () => {
    const signer = await fundedSigner();
    const Impl = getContractFactory(compileString(ENTRY_INIT), signer);
    const proxy = await upgrades.deployProxy(Impl, [7n]);
    await expect(proxy.waitForDeployment()).resolves.toBeDefined();
  });

  it('runs an initializer that sets a flag, reads it back in a nested call, and writes a mapping entry', async () => {
    const signer = await fundedSigner();
    const Impl = getContractFactory(compileString(FLAG_ENTRY_INIT), signer);
    const proxy = await upgrades.deployProxy(Impl, [7n]);
    await expect(proxy.waitForDeployment()).resolves.toBeDefined();
  });

  it('runs an initializer that writes a string-keyed, string-valued mapping entry', async () => {
    const signer = await fundedSigner();
    const Impl = getContractFactory(compileString(STRING_ENTRY_INIT), signer);
    const proxy = await upgrades.deployProxy(Impl, [7n]);
    await expect(proxy.waitForDeployment()).resolves.toBeDefined();
  });

  it('runs an initializer with a fixed sorted batch after its direct epilogue helper frame', async () => {
    const signer = await fundedSigner();
    const Impl = getContractFactory(compileString(SORTED_BATCH_ENTRY_INIT), signer);
    const proxy = await upgrades.deployProxy(Impl, []);
    await expect(proxy.waitForDeployment()).resolves.toBeDefined();
    // The batch stored each value under its own key in the proxy's mapping.
    const tags = proxy as unknown as { tagOf(key: string): Promise<string> };
    await expect(tags.tagOf('NDS')).resolves.toBe('NON_DIGITAL_SERVICES');
    await expect(tags.tagOf('DA')).resolves.toBe('DIGITAL_AUDIO');
  });

  it('writes the same entry through an ordinary post-deploy proxy call', async () => {
    const signer = await fundedSigner();
    const Impl = getContractFactory(compileString(ENTRY_CALL), signer);
    const proxy = await upgrades.deployProxy(Impl, { counter: 0n });
    await proxy.waitForDeployment();
    await expect(proxy.bump().send()).resolves.toBeDefined();
  });
});

// `m[a] = m[b]; delete m[b]` is a swap-remove: the write is skipped when the two keys alias, and the batch reads the
// deleted entry beside it to authenticate that. A delegate finds that entry after its co-spent implementation block.
const SWAP_REMOVE = `pragma solidcash >=0.8.0;
  contract SwapRemove() {
    mapping(uint256 => uint256) m;
    function initialize() public delegate { this.m[1] = 11; this.m[2] = 22; this.m[3] = 33; }
    function swapRemove(uint256 a, uint256 b) public delegate { this.m[a] = this.m[b]; delete this.m[b]; }
    function entryOf(uint256 k) public delegate returns (uint256) { return this.m[k]; }
  }`;

interface SwapRemoveProxy {
  swapRemove(a: bigint, b: bigint): { send(): Promise<unknown> };
  entryOf(key: bigint): Promise<bigint>;
}

describe('swap-remove through a proxy', () => {
  it('moves one entry over another, and only deletes when the keys alias', async () => {
    const signer = await fundedSigner();
    const proxy = await upgrades.deployProxy(getContractFactory(compileString(SWAP_REMOVE), signer), []);
    const swap = proxy as unknown as SwapRemoveProxy;
    await swap.swapRemove(1n, 3n).send();
    await expect(swap.entryOf(1n)).resolves.toBe(33n);
    await expect(swap.entryOf(3n)).resolves.toBe(0n);
    await swap.swapRemove(2n, 2n).send();
    await expect(swap.entryOf(2n)).resolves.toBe(0n);
  });

  it('refuses forged alias witnesses on the delegate frame', async () => {
    const signer = await fundedSigner();
    const artifact = compileString(SWAP_REMOVE);
    const proxy = await upgrades.deployProxy(getContractFactory(artifact, signer), []);
    const provider = signer.provider as unknown as { sendRawTransaction(hex: string): Promise<string> };
    const send = provider.sendRawTransaction.bind(provider);
    let captured = '';
    provider.sendRawTransaction = async (hex: string): Promise<string> => {
      captured = hex;
      throw new Error('capture-only');
    };
    await expect((proxy as unknown as SwapRemoveProxy).swapRemove(2n, 2n).send()).rejects.toThrow('capture-only');
    provider.sendRawTransaction = send;

    // The frame pushes its selector, then its arguments last-first.
    const abi = (artifact.delegateArtifact ?? artifact).abi.find((entry) => entry.name === 'swapRemove')!;
    const pushOf = (name: string): number => abi.inputs.length - abi.inputs.findIndex((input) => input.name === name);
    const frame = decodeTransactionUnsafe(hexToBin(captured)).inputs.findIndex((input) => {
      const [selector] = decodeAuthenticationInstructions(input.unlockingBytecode);
      return selector !== undefined && 'data' in selector && binToHex(selector.data) === abi.selector;
    });
    expect(frame).toBeGreaterThan(0);
    const forge = async (name: string, data: Uint8Array): Promise<string> => {
      const tx = decodeTransactionUnsafe(hexToBin(captured));
      const instructions = decodeAuthenticationInstructions(tx.inputs[frame]!.unlockingBytecode);
      instructions[pushOf(name)] = data.length === 32 ? { opcode: 0x20, data } : { opcode: 0x4f };
      tx.inputs[frame]!.unlockingBytecode = encodeAuthenticationInstructions(instructions);
      return send(binToHex(encodeTransaction(tx))).then(() => 'settled', (error: Error) => error.message);
    };
    const refusal = /Program failed|mandatory-script-verify-flag-failed/;
    // The keys alias, so the write carries the alias sentinel; claiming they do not is refused.
    const predOut = decodeAuthenticationInstructions(
      decodeTransactionUnsafe(hexToBin(captured)).inputs[frame]!.unlockingBytecode,
    )[pushOf('__internal__vmapBatchPredOut_0')];
    expect(predOut !== undefined && 'data' in predOut ? binToHex(predOut.data) : '').toBe('82');
    await expect(forge('__internal__vmapBatchPredOut_0', new Uint8Array())).resolves.toMatch(refusal);
    // The deleted entry's slot is checked against the entry it spends: naming another live key is refused.
    await expect(forge('__internal__vmapBatchSlot_1', keyToSlotMulti([bigIntToVmNumber(3n)])))
      .resolves.toMatch(refusal);
    await expect(send(captured)).resolves.toBeTypeOf('string');
  });
});
