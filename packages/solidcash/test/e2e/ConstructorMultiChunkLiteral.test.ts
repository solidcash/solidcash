import { describe, it, expect } from 'vitest';
import { binToHex, utf8ToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { getContractFactory } from '../../src/stateful/index.js';
import { fundedSigner } from '../test-util.js';

// A constructor that stores a value the SDK cannot replay (a literal returned by an internal pure function) leaves
// the deploy probe to learn the value's chunk NFTs from the trace. The probe reserved one chunk per variable, so a
// value longer than one 120-byte chunk stopped at the second chunk's output and the derivation was refused as an
// oscillation. The run's width follows the length header the constructor pins in the data NFT.
const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const pattern = (length: number, seed: number): string =>
  Array.from({ length }, (_, i) => ALPHABET[(i * 7 + seed) % ALPHABET.length]).join('');
const ALPHA = pattern(300, 1); // three chunks, the last one partial
const BETA = pattern(240, 5); // exactly two full chunks

const SRC = `contract C {
  bytes alpha;
  bytes beta;
  constructor() { alpha = alphaValue(); beta = betaValue(); }
  function alphaValue() internal pure returns (bytes memory) { return "${ALPHA}"; }
  function betaValue() internal pure returns (bytes memory) { return "${BETA}"; }
  function lens(uint256 a, uint256 b) public { require(alpha.length == a); require(beta.length == b); }
}`;

interface Call { send: () => Promise<unknown> }
interface Handle {
  lens: (a: bigint, b: bigint) => Call;
  getState: () => Promise<Record<string, unknown>>;
}

describe('constructor-stored values longer than one chunk (VM-derived deploy)', () => {
  it('learns every chunk of each run and deploys spendable state', async () => {
    const artifact = compileString(SRC, { evmCompat: true });
    // The values are not replayable, so the probe must learn their chunks.
    expect(artifact.abi.find((fn) => fn.name === '__construct')?.dynamicWriteSources).toBeUndefined();
    const sc = await getContractFactory(artifact, await fundedSigner(8)).deploy() as unknown as Handle;
    const state = await sc.getState();
    expect(binToHex(state.alpha as Uint8Array)).toBe(binToHex(utf8ToBin(ALPHA)));
    expect(binToHex(state.beta as Uint8Array)).toBe(binToHex(utf8ToBin(BETA)));
    await sc.lens(300n, 240n).send();
    // The length check is real: a wrong length reverts.
    await expect(sc.lens(299n, 240n).send()).rejects.toThrow();
  });
});
