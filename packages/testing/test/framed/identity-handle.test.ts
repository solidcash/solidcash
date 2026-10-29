import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { compileStringMulti } from '@solidcash/solidc';
import { formatArtifact } from '@solidcash/utils';
import { createHardhatRuntimeEnvironment } from '../../src/hre.js';
import { resolveConfig } from '../../src/config.js';

/**
 * A getter's `address`, and a handle opened on the 20-byte identity a read carries for it.
 *
 * `Holder` keeps an address, and a read answers with the identity an EVM ABI carries for it (DECISIONS D13). Where the
 * identity names a deployed contract, `Named`, the getter answers with the address `Named` was deployed at, so a
 * suite can compare it with `getAddress()` by `===` as ethers lets it, and open `Named` on it, as one opens a pair's
 * token on `pair.token0()`. A key's identity is answered as given. A handle opened on the identity itself names the
 * same address: the one a call names the contract by, not the lock its records are read under.
 */

const COMPOSITION_LIMITS = {
  operationCostBudgetPerByte: 1_000_000,
  maximumInputBytes: 10_000_000,
  maximumTransactionBytes: 100_000_000,
  maximumStackItemBytes: 10_000_000,
  maximumNftCommitmentBytes: 10_000_000,
};

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' contract Named { uint256 public unit = 1; }'
  + ' contract Holder { address public held; constructor(address x) { held = x; } }'
  + ' contract Keeper { address public kept; constructor(address x) { kept = x; } }';

const temporaryDirectories: string[] = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

/** A project directory whose artifacts dir holds the compiled contracts, the way `solidcash compile` lays it out. */
function projectWithCompiledContracts(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'solidcash-identity-handle-'));
  temporaryDirectories.push(directory);
  const artifacts = path.join(directory, 'solidcash', 'Named.sol');
  fs.mkdirSync(artifacts, { recursive: true });
  const compiled = compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true } as never);
  for (const [name, artifact] of Object.entries(compiled)) {
    fs.writeFileSync(path.join(artifacts, `${name}.json`), formatArtifact(artifact, 'json'));
  }
  return directory;
}

/** A runtime over the compiled contracts with one funded signer, and `Named` deployed with a `Holder` keeping it. */
async function deployed(): Promise<{ hre: any; signer: any; named: any; holder: any }> {
  const hre = createHardhatRuntimeEnvironment(resolveConfig({
    paths: { artifacts: projectWithCompiledContracts() },
    networks: { mock: { type: 'mock', consensus: COMPOSITION_LIMITS } },
    defaultNetwork: 'mock',
    accounts: { count: 1 },
  }));
  const [signer] = await hre.ethers.getSigners(1);
  await (hre.ethers.provider as { addUtxo: (address: string, utxo: object) => Promise<void> })
    .addUtxo(signer.getAddress(), { txid: '92'.repeat(32), vout: 0, satoshis: 10_000_000n });
  const named = await hre.ethers.deployContract('Named');
  const holder = await hre.ethers.deployContract('Holder', [await named.getAddress()]);
  return { hre, signer, named, holder };
}

describe('a getter\'s address and a handle opened on its identity', () => {
  it('answers a deployed contract\'s identity with the address it was deployed at, and opens it there', async () => {
    const { hre, named, holder } = await deployed();
    const held = await holder.held();
    expect(held).toBe(await named.getAddress());
    expect(await holder.held.staticCall()).toBe(held);
    const reopened = await hre.ethers.getContractAt('Named', held);
    expect(await reopened.getAddress()).toBe(await named.getAddress());
  });

  it('answers a key\'s identity as given', async () => {
    const { hre, signer } = await deployed();
    const keeper = await hre.ethers.deployContract('Keeper', [signer.getAddress()]);
    const kept = await keeper.kept();
    expect(kept).toBeInstanceOf(Uint8Array);
    expect((kept as Uint8Array).length).toBe(20);
  });

  it('names the address the contract was deployed at when opened on the identity itself', async () => {
    const { hre, named, holder } = await deployed();
    // The state accessor answers with the identity a read carries, which a handle is opened on as it stands.
    const identity = await holder.state.held();
    expect(identity).toBeInstanceOf(Uint8Array);
    expect((identity as Uint8Array).length).toBe(20);
    const reopened = await hre.ethers.getContractAt('Named', identity as never);
    expect(await reopened.getAddress()).toBe(await named.getAddress());
  });
});
