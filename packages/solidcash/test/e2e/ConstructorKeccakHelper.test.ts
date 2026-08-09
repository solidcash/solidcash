import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { ContractFactory, HDSigner } from '../../src/index.js';
import { createTestProvider } from '../test-util.js';

/**
 * A `keccak256` reached through an internal helper, from a constructor.
 *
 * The helper is compiled on its own sub-traversal, where `currentFunction` is the HELPER and there is no block
 * layout - so `emitKeccakComputeCall` used to fall back to the STATELESS, count-relative side-car read
 * (`OP_TXINPUTCOUNT - n` / `OP_TXOUTPUTCOUNT - n`). Inlined into a stateful block that names the wrong things:
 * the last input is the funder and the last output the event, while the SDK positions the side-car at the
 * block-layout slot. The covenant then decoded the funder's unlocking script and compared it to the computed
 * keccak argument, which can never match - surfacing only as
 * `Failed to derive initial state commitments from constructor ... OP_VERIFY`.
 *
 * Measured on MistSwap's BentoBox, whose `_calculateDomainSeparator` is private; it gated 62 tests.
 *
 * Three things have to line up, and each was separately wrong:
 *  - the entry point must RESERVE the slot (`countLibraryCalls` follows `resolvedFunction`);
 *  - the SDK must SUPPLY a side-car there (`keccakPreimageParams` padded to the reserved slot count);
 *  - the covenant must READ that slot, and check the STATEFUL covenant hash while doing so.
 */
const HELPER_KECCAK = `pragma solidcash >=0.8.0;
  contract C() {
    bytes32 h;
    address owner;
    function calc(bytes x) private view returns (bytes32) { return keccak256(x); }
    constructor(bytes x) { owner = msg.sender; this.h = calc(x); }
    function get() public view returns (bytes32) { return this.h; }
  }`;

/** Same hash, called directly in the constructor - the shape that always worked. Guards against regressing it. */
const DIRECT_KECCAK = `pragma solidcash >=0.8.0;
  contract C() {
    bytes32 h;
    address owner;
    constructor(bytes x) { owner = msg.sender; this.h = keccak256(x); }
    function get() public view returns (bytes32) { return this.h; }
  }`;

const fundedSigner = async (): Promise<HDSigner> => {
  const provider = createTestProvider();
  const signer = HDSigner.fromPhrase(
    'test test test test test test test test test test test junk', provider,
  );
  for (let i = 0; i < 8; i++) {
    await provider.addUtxo(signer.getAddress(), {
      txid: Buffer.alloc(32, i + 1).toString('hex'), vout: 0, satoshis: 100_000_000n,
    });
  }
  return signer;
};

describe('constructor keccak256 through an internal helper', () => {
  it('deploys, and the constructor reserves exactly one side-car slot with one published preimage param', async () => {
    const artifact = compileString(HELPER_KECCAK, { forceStateful: true });
    const ctor = artifact.abi.find((f) => f.name === '__construct') as any;
    const slots = (ctor?.blockLayout?.slots ?? []).filter((s: { kind: string }) => s.kind === 'keccakSideCar');
    expect(slots).toHaveLength(1);
    // The SDK co-spends one side-car per published param, so this list must match the reserved slots.
    expect(ctor?.keccakPreimageParams).toHaveLength(1);

    const contract = await new ContractFactory(artifact, await fundedSigner())
      .deploy(new Uint8Array([1, 2, 3]));
    expect((contract as any).address).toMatch(/^bchtest:/);
  }, 180000);

  it('still deploys when the keccak256 is written directly in the constructor', async () => {
    const artifact = compileString(DIRECT_KECCAK, { forceStateful: true });
    const contract = await new ContractFactory(artifact, await fundedSigner())
      .deploy(new Uint8Array([1, 2, 3]));
    expect((contract as any).address).toMatch(/^bchtest:/);
  }, 180000);
});
