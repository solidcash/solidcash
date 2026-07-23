import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { bigIntToVmNumber, hexToBin } from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';

const SOURCE = `pragma solidcash >=0.8.0;
contract HiddenBatchRelease4() {
  int counter;
  function add(int n) public { this.counter = this.counter + n; require(n >= 0); }
  function multiply(int n) public { this.counter = this.counter * n; require(n >= 0); }
  function note(bytes value) public { this.counter = value.length; require(value.length >= 0); }
  function clear() public { this.counter = 0; require(true); }
  function check(int expected) public { require(this.counter == expected); }
}`;

async function deploy() {
  const provider = createTestProvider();
  const artifact = compileString(SOURCE, {
    forceStateful: true,
    experimentalHiddenBatch: true,
  });
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
  );
  return StatefulContract.withCategory(contract, categoryId);
}

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;
  for (const part of parts) { out.set(part, cursor); cursor += part.length; }
  return out;
};
const le = (value: number, width: number): Uint8Array =>
  Uint8Array.from({ length: width }, (_, i) => (value >>> (8 * i)) & 0xff);
const oneAddBlob = (selector: string, amount = 2n): Uint8Array => {
  const args = scriptToBytecode([bigIntToVmNumber(amount)]);
  return concat(
    hexToBin('53434231'), Uint8Array.from([1, 0, 1]), hexToBin(selector),
    le(0, 4), le(0, 2), le(args.length, 2), args,
  );
};

describe('Release 4 hidden owner-local batch SDK E2E', () => {
  it('executes three logical handlers in order and flushes one owner state', async () => {
    const contract = await deploy();
    await contract.batch([
      { function: 'add', args: [2n] },
      { function: 'add', args: [3n] },
      { function: 'multiply', args: [4n] },
    ]).send();
    await contract.check(20n).send();
  });

  it('preserves replacement order across distinct handlers', async () => {
    const contract = await deploy();
    await contract.batch([
      { function: 'add', args: [99n] },
      { function: 'clear' },
      { function: 'add', args: [7n] },
    ]).send();
    await contract.check(7n).send();
  });

  it('rejects malformed limits and unknown handlers before construction', async () => {
    const contract = await deploy();
    expect(() => contract.batch([])).toThrow(/row count/);
    expect(() => contract.batch([{ function: 'missing' }])).toThrow(/Unknown SCB1 handler/);
    expect(() => contract.batch(Array.from({ length: 9 }, () => ({ function: 'clear' }))))
      .toThrow(/row count/);
  });

  it('enforces the frozen blob-byte limit in both the SDK and covenant', async () => {
    const contract = await deploy();
    const oversizedArgument = new Uint8Array(63);
    expect(() => contract.batch([{ function: 'note', args: [oversizedArgument] }]))
      .toThrow(/maximum is 75/);

    const selector = contract.inner.artifact.hiddenBatch!.handlers
      .find((handler) => handler.name === 'note')!.selector;
    const encodedArgument = scriptToBytecode([oversizedArgument]);
    const oversizedRaw = concat(
      hexToBin('53434231'), Uint8Array.from([1, 0, 1]), hexToBin(selector),
      le(0, 4), le(0, 2), le(encodedArgument.length, 2), encodedArgument,
    );
    expect(oversizedRaw.length).toBeGreaterThan(75);
    await expect(contract._batchRaw(oversizedRaw).send()).rejects.toThrow();
  });

  it('rejects suffixes, count substitution, selector substitution, and noncanonical row identity in the VM', async () => {
    const cases: Array<(blob: Uint8Array) => Uint8Array> = [
      (blob) => concat(blob, Uint8Array.of(0)), // unchecked suffix
      (blob) => { const out = blob.slice(); out[6] = 2; return out; }, // count says two, contains one
      (blob) => { const out = blob.slice(); out.set(hexToBin('ffffffff'), 7); return out; },
      (blob) => { const out = blob.slice(); out[11] = 1; return out; }, // callsite must equal row index
      (blob) => { const out = blob.slice(); out[15] = 1; return out; }, // local occurrence must be zero
    ];
    for (const mutate of cases) {
      const contract = await deploy();
      const selector = contract.inner.artifact.hiddenBatch!.handlers
        .find((handler) => handler.name === 'add')!.selector;
      await expect(contract._batchRaw(mutate(oneAddBlob(selector))).send()).rejects.toThrow();
    }
  });
});
