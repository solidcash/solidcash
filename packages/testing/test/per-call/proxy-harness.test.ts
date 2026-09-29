import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { compileStringMulti } from 'solidc';
import { formatArtifact } from '@solidcash/utils';
import { perCallDeploy, type PerCallProxyDeployment, type PerCallProxyHandle } from 'solidcash';
import { upgrades } from '../../src/index.js';
import { createHardhatRuntimeEnvironment } from '../../src/hre.js';
import { resolveConfig } from '../../src/config.js';

/**
 * The testing layer drives a per-call implementation through `upgrades.deployProxy`, and calls it afterwards.
 *
 * The implementation is compiled for the per-call composition convention, so `deployProxy` routes it through the
 * per-call proxy deployment: the implementation's genesis, a proxy generated from the implementation's own record
 * layout, that proxy's genesis, and one `initialize` hop the deployer enters through the proxy. What comes back is
 * the handle a suite calls through - the implementation's entries, addressed and held by the proxy - with the
 * deployment's own record nested as `proxyDeployment`.
 *
 * Everything here is driven by shipped code: the deployment mints and broadcasts the geneses and the hop, the
 * composer plans the delegate edge, the derivation resolves it and fills the witnesses, the machine accepts every
 * participant, and the state is read back through the shipped deployment reader and state decoder.
 */

const COMPOSITION_LIMITS = {
  operationCostBudgetPerByte: 1_000_000,
  maximumInputBytes: 10_000_000,
  maximumTransactionBytes: 100_000_000,
  maximumStackItemBytes: 10_000_000,
  maximumNftCommitmentBytes: 10_000_000,
};

// Two state records - a scalar, and a key the compiler isolates into one of its own - so the implementation and
// the proxy it generates both use multi-record commitments.
const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Counter {'
  + '   int public total;'
  + '   pubkey external owner;'
  + '   function initialize(int start) { this.total = start + 1; require(this.total >= 0); }'
  + '   function bump(int by) { this.total = this.total + by; require(this.total >= 0); }'
  + ' }';

const temporaryDirectories: string[] = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

/** A project directory whose artifacts dir holds the compiled contract, the way `solidcash compile` lays it out. */
function projectWithCompiledContract(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'solidcash-per-call-proxy-'));
  temporaryDirectories.push(directory);
  const artifacts = path.join(directory, 'solidcash', 'Counter.scash');
  fs.mkdirSync(artifacts, { recursive: true });
  for (const [name, artifact] of Object.entries(compileStringMulti(SOURCE, { composition: 'per-call' }))) {
    fs.writeFileSync(path.join(artifacts, `${name}.json`), formatArtifact(artifact, 'json'));
  }
  return directory;
}

function projectHarness(directory: string): ReturnType<typeof createHardhatRuntimeEnvironment> {
  return createHardhatRuntimeEnvironment(resolveConfig({
    paths: { artifacts: directory },
    networks: { mock: { type: 'mock', consensus: COMPOSITION_LIMITS } },
    defaultNetwork: 'mock',
    accounts: { count: 1 },
  }));
}

/** The `total` the proxy's record carries, read back through the shipped reader and state decoder. */
async function recordTotal(
  provider: ReturnType<typeof createHardhatRuntimeEnvironment>['ethers']['provider'],
  categoryId: string, layout: NonNullable<PerCallProxyDeployment['proxy']['contract']['inner']['artifact']['stateLayout']>,
): Promise<bigint> {
  const state = await perCallDeploy.readPerCallState(provider as never, categoryId, layout);
  return state.byNft[0]!.total as bigint;
}

describe('the testing layer and a per-call contract behind upgrades.deployProxy', () => {
  it('deploys it, settles the initialize hop on chain, and answers a later call through the same handle',
    async () => {
      const hre = projectHarness(projectWithCompiledContract());
      const [signer] = await hre.ethers.getSigners(1);

      const deployment = await upgrades.deployProxy(
        hre.ethers.getContractFactory('Counter', signer) as never, [5n],
      ) as unknown as PerCallProxyHandle;
      const record = deployment.proxyDeployment;

      // The handle names the proxy: its own token category and the address its masters and records sit under.
      expect(record.proxy.categoryId).toMatch(/^[0-9a-f]{64}$/);
      expect(deployment.categoryId).toBe(record.proxy.categoryId);
      expect(await deployment.getAddress()).toMatch(/^[a-z]+:/);

      // The hop is the composition driven end to end and broadcast: the implementation's entry completes first,
      // the proxy that forwarded it last, and the machine accepted every participant.
      expect(record.initialize.completed.map((frame) => frame.functionName))
        .toStrictEqual(['Counter.initialize()', 'CounterProxy.__fallback()']);
      expect(record.initialize.accepted).toBe(true);
      expect(record.initialize.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);

      // The state the hop left on chain is what the entry's own body computed: `initialize(5)` wrote 6.
      const layout = record.proxy.contract.inner.artifact.stateLayout!;
      const provider = hre.ethers.provider;
      expect(await recordTotal(provider, record.proxy.categoryId, layout)).toBe(6n);

      // A later entry is called the way a suite calls a contract - by name, on the handle - and its write lands.
      await (deployment as unknown as { bump: (by: bigint) => Promise<unknown> }).bump(4n);
      expect(await recordTotal(provider, record.proxy.categoryId, layout)).toBe(10n);
    });
});
