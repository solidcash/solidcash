import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';
import { addProvenUtxo } from '../test-util.js';

// An initializer-marked implementation compiles every public function as a delegate entry, so the setter runs as a
// direct proxied owner call. Its if/revert guard makes the single map write a conditional entry slot.
let compiled: ReturnType<typeof compileStringMulti> | undefined;
const artifacts = (): ReturnType<typeof compileStringMulti> => compiled ??= compileStringMulti(`pragma solidity ^0.8.20;
  contract Catalog {
    error Unauthorized(address account);
    bool private initialized;
    address public owner;
    address[] public members;
    mapping(string => string) public labels;
    modifier initializer() { require(!initialized, "initialized"); initialized = true; _; }
    modifier onlyOwner() { if (msg.sender != owner) revert Unauthorized(msg.sender); _; }
    function initialize() public initializer {
      owner = msg.sender;
      labels["AB"] = "ALPHA_BRAVO_X";
      labels["CD"] = "CHARLIE_DELTA";
    }
    function setLabel(string memory key, string memory value) public onlyOwner {
      require(bytes(key).length > 0 && bytes(value).length > 0, "bad label");
      labels[key] = value;
    }
  }`, { forceStateful: true, evmCompat: true, messageBus: true,
  messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
  suppressWarnings: true, optimizeForCompilationSpeed: true });

type Labels = { labels: (key: string) => Promise<unknown> };

const asText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value instanceof Uint8Array) return Buffer.from(value).toString('utf8');
  throw new Error(`unexpected string map value: ${typeof value}`);
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
async function deploy() {
  const provider = createMessageBusCapstoneTestProvider();
  const signer = new Signer(new Uint8Array(32).fill(0x6e), provider);
  for (let index = 0; index < 20; index += 1) await addProvenUtxo(provider, signer.getAddress());
  const catalog = await upgrades.deployProxy(getContractFactory(artifacts().Catalog, signer), []);
  return { catalog, labels: catalog as unknown as Labels };
}

describe('kernel proxied string map overwrite', () => {
  it('rewrites a seeded inline entry as exactly one updated row', async () => {
    const setter = artifacts().Catalog.abi.find((fn) => fn.name === 'setLabel');
    expect(setter?.inputs.map((input) => input.name)).toContain('__internal__proxyMasterIndex');
    expect(setter?.blockLayout?.slots.find((slot) => slot.kind === 'entry')).toMatchObject({ conditional: true });

    const { catalog, labels } = await deploy();
    // Inline -> inline of a different length, through the delegate entry the owner calls directly.
    await catalog.forward('setLabel', ['AB', 'Alpha Bravo X2']).send();
    expect(asText(await labels.labels('AB'))).toBe('Alpha Bravo X2');
    expect(asText(await labels.labels('CD'))).toBe('CHARLIE_DELTA');
  }, 300_000);

  it('rewrites a seeded entry inline -> chunked -> inline', async () => {
    const { catalog, labels } = await deploy();
    const long = 'L'.repeat(90);
    await catalog.forward('setLabel', ['CD', long]).send();
    expect(asText(await labels.labels('CD'))).toBe(long);
    await catalog.forward('setLabel', ['CD', 'Cd']).send();
    expect(asText(await labels.labels('CD'))).toBe('Cd');
    expect(asText(await labels.labels('AB'))).toBe('ALPHA_BRAVO_X');
  }, 300_000);
});
