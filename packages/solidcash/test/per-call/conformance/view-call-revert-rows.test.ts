import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import { COMPOSITION_LIMITS } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { HDSigner } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import type { PerCallFunctionCall } from '../../../src/per-call/call/index.js';
import type { StatefulContract } from '../../../src/stateful/StatefulContract.js';

/**
 * S0 conformance, spec section 23 row 19: reverts from view calls (six).
 *
 * The four getters the row names revert from a view: three guard a page's range and refuse a page that runs past
 * the end with "index out of bounds", and a tag lookup refuses a key that is empty, unknown, or whose value the
 * mapping holds as the empty string, with "Invalid MECE tag". Each is reached the way a caller reaches a view, a
 * static read of the deployed contract, so what is asserted is the reason the read path hands back, not a value it
 * resolved anyway. The contract is neutral; the six checks mirror the six revert assertions of the row.
 */

const PHRASE = 'test test test test test test test test test test test junk';

/** A 32-byte outpoint hash whose bytes are not all the same, so a byte-order bug cannot hide in it. */
function outpointHash(seed: number): string {
  const bytes = new Uint8Array(32);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = (seed + index * 7) & 0xff;
  return binToHex(bytes);
}

// The three paginated getters and the tag lookup, each with the guard the row's four functions carry. The tags
// the constructor seeds are the only collection it writes, as a deployment plans one collection's sorted writes;
// the paging entries refuse on their arguments before they read the cells they page, so the cell collection may
// stay empty. A page past the end and a key the tags do not hold both reach the entry's own `require` rather than
// a resolved default.
const SOURCE = 'pragma solidity ^0.8.0;'
  + ' contract Registry {'
  + '   mapping(uint256 => uint256) public cells;'
  + '   mapping(string => string) public tags;'
  + '   constructor() {'
  + '     tags["DV"] = "DIGITAL_VIDEO"; tags["TST"] = "Test"; tags["CLR"] = "";'
  + '   }'
  + '   function arbitratorPage(uint256 start, uint256 count) public view returns (uint256) {'
  + '     require(start + count <= 4, "index out of bounds");'
  + '     return cells[start];'
  + '   }'
  + '   function jobPage(uint256 start, uint256 count) public view returns (uint256) {'
  + '     require(start + count <= 2, "index out of bounds");'
  + '     return cells[start];'
  + '   }'
  + '   function eventPage(uint256 id, uint256 start, uint256 count) public view returns (uint256) {'
  + '     require(id == 0 && start + count <= 2, "index out of bounds");'
  + '     return cells[start];'
  + '   }'
  + '   function tag(string memory k) public view returns (string memory) {'
  + '     require(bytes(k).length != 0, "Invalid MECE tag");'
  + '     require(bytes(tags[k]).length != 0, "Invalid MECE tag");'
  + '     return tags[k];'
  + '   }'
  + ' }';

/** The view entries the handle's call namespace exposes, as the class the per-call path returns. */
interface RegistryCalls {
  readonly arbitratorPage: (start: bigint, count: bigint) => PerCallFunctionCall;
  readonly jobPage: (start: bigint, count: bigint) => PerCallFunctionCall;
  readonly eventPage: (id: bigint, start: bigint, count: bigint) => PerCallFunctionCall;
  readonly tag: (key: string) => PerCallFunctionCall;
}

/** Deploys the contract through the shipped deployment, seeding the registries the constructor writes. */
async function deployFresh(): Promise<RegistryCalls> {
  const artifact = compileStringMulti(SOURCE, { composition: 'per-call', solidityImportCompat: true }).Registry!;
  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signer = HDSigner.fromPhrase(PHRASE, provider);
  const fundingUtxo = { txid: outpointHash(0x30), vout: 0, satoshis: 500_000n };
  await provider.addUtxo(signer.getAddress(), fundingUtxo);
  const deployment = await deployStatefulContract(artifact, [], {
    provider, fundingUtxo, funder: signer.unlockP2PKH(), changeAddress: signer.getAddress(),
  });
  const handle = (deployment.contract as StatefulContract).connect(signer);
  return handle.call as unknown as RegistryCalls;
}

let deployed: Promise<RegistryCalls> | undefined;

/** One deployment serves every case: a read is local and changes nothing. */
function deploy(): Promise<RegistryCalls> {
  deployed ??= deployFresh();
  return deployed;
}

/** The reason a refused read hands back, or the value it resolved if it did not refuse. */
async function reasonOf(call: () => PerCallFunctionCall): Promise<string> {
  let message = '';
  await call().then(
    (value) => { throw new Error(`the read resolved a value: ${String(value)}`); },
    (error: unknown) => { message = (error as Error).message; },
  );
  return message;
}

describe('spec section 23 row 19: reverts from view calls', () => {
  it('serves the tag the constructor seeded before any refusal', async () => {
    const calls = await deploy();
    // The control for the three refusals below: the same entry answers for a key the mapping holds a value for.
    expect(await calls.tag('DV')).toBe('DIGITAL_VIDEO');
  });

  it('reports the entry reason for an empty tag key', async () => {
    const calls = await deploy();
    const message = await reasonOf(() => calls.tag(''));
    expect(message).toContain('Invalid MECE tag');
    expect(message).toContain('Registry.tag()');
  });

  it('reports the entry reason for a tag key the mapping does not hold', async () => {
    const calls = await deploy();
    const message = await reasonOf(() => calls.tag('LOL'));
    expect(message).toContain('Invalid MECE tag');
    expect(message).toContain('Registry.tag()');
  });

  it('reports the entry reason for a tag key the constructor wrote as the empty string', async () => {
    const calls = await deploy();
    // The value the mapping holds is the empty string, so the entry's own guard refuses the read.
    const message = await reasonOf(() => calls.tag('CLR'));
    expect(message).toContain('Invalid MECE tag');
    expect(message).toContain('Registry.tag()');
  });

  it('reports the entry reason for an arbitrator page past the end', async () => {
    const calls = await deploy();
    const message = await reasonOf(() => calls.arbitratorPage(5n, 5n));
    expect(message).toContain('index out of bounds');
    expect(message).toContain('Registry.arbitratorPage()');
  });

  it('reports the entry reason for a job page past the end', async () => {
    const calls = await deploy();
    const message = await reasonOf(() => calls.jobPage(2n, 1n));
    expect(message).toContain('index out of bounds');
    expect(message).toContain('Registry.jobPage()');
  });

  it('reports the entry reason for an event page past the end', async () => {
    const calls = await deploy();
    const message = await reasonOf(() => calls.eventPage(0n, 10000n, 10n));
    expect(message).toContain('index out of bounds');
    expect(message).toContain('Registry.eventPage()');
  });
});
