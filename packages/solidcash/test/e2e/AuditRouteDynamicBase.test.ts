import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeTransactionUnsafe, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { Contract, TransactionBuilder } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import * as messageBus from '../../src/message-bus/index.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../test-util.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

/**
 * DYN-1 route lane (docs/security/security-audit-2026-10-16.md): the message-bus route body carries the union's dynamic
 * write settlement, so it runs emitDynamicWriteVerification for every selected row. The route's
 * `__internal__dynamicChunkInputBase` is an ordinary unlocking push; selecting the writer row and passing a base
 * below -1 took the inactive skip and disabled every chunk commitment/count/consumption check.
 *
 * The compiler now sets `__message_bus_dynamic_write_active` inside the authenticated writer selector branch and
 * the route refuses a writer row whose base is below -1. A non-writer row still uses the SDK's read-only sentinel
 * (`-(base + 3)`), so an honest read settles.
 *
 * A second contract participates so the atomic message envelope clears its 256-byte minimum, as in the kernel
 * composition suites.
 */
const DYN = `contract DynAudit() {
  string public name;
  function setName(string n) { this.name = n; require(true); }
  function expectName(string v) { require(this.name == v); }
}`;

const DRIVER = `interface IDynAudit {
  function setName(string n);
  function expectName(string v);
}
contract DynDriver(address dyn) {
  function write(string n) public { IDynAudit(dyn).setName(n); require(true); }
  function check(string v) public { IDynAudit(dyn).expectName(v); require(true); }
}`;

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000,
} as const;

const ROUTE_BASE = '__internal__dynamicChunkInputBase';

type RouteBaseSite = {
  unlocker: { params: readonly unknown[]; syncEncodedArgsFromParams?: (indices: number[]) => void };
  index: number;
};

/** Every unlocking frame that carries the free route base witness. */
function routeBaseSites(builder: TransactionBuilder): RouteBaseSite[] {
  const sites: RouteBaseSite[] = [];
  builder.inputs.forEach((input) => {
    const unlocker = input.unlocker as unknown as {
      params?: readonly unknown[];
      abiFunction?: { name?: string; inputs: readonly { name: string }[] };
      syncEncodedArgsFromParams?: (indices: number[]) => void;
    };
    const index = unlocker.abiFunction?.inputs.findIndex((parameter) => parameter.name === ROUTE_BASE) ?? -1;
    if (!unlocker.params || index < 0) return;
    sites.push({ unlocker: unlocker as RouteBaseSite['unlocker'], index });
  });
  return sites;
}

/** Rewrite the chunk commitment ending in `from` to end in `to` (same byte length). */
function forgeChunk(txHex: string, from: string, to: string): string {
  const transaction = decodeTransactionUnsafe(hexToBin(txHex)) as ReturnType<typeof decodeTransactionUnsafe>;
  let patched = 0;
  transaction.outputs.forEach((output) => {
    const token = (output as { token?: { nft?: { capability: string; commitment: Uint8Array } } }).token;
    if (!token?.nft || token.nft.capability !== 'mutable') return;
    const commitment = binToHex(token.nft.commitment);
    if (!commitment.endsWith(from)) return;
    token.nft.commitment = Uint8Array.from([
      ...token.nft.commitment.slice(0, token.nft.commitment.length - from.length / 2),
      ...hexToBin(to),
    ]);
    patched += 1;
  });
  expect(patched).toBeGreaterThan(0);
  return binToHex(encodeTransaction(transaction));
}

describe('DYN-1 route lane: a writer row cannot take the read-only base sentinel', () => {
  it('refuses a forged route base beside a forged chunk, while honest write/read lanes settle', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const dynArtifact = compileString(DYN, { ...KERNEL, suppressWarnings: true });
    const driverArtifact = compileString(DRIVER, { ...KERNEL, suppressWarnings: true });
    expect(dynArtifact.messageBus?.available).toBe(true);
    expect(driverArtifact.messageBus?.available).toBe(true);

    const connect = async (
      artifact: typeof dynArtifact, args: readonly unknown[] = [],
      initialState: Record<string, unknown> = {},
    ): Promise<StatefulContract> => {
      const base = new Contract(artifact, args as never[], { provider });
      const setup = await setupStatefulUtxos(
        provider, base, artifact.stateLayout!, initialState, { saltContract: true },
      );
      return StatefulContract.withCategory(
        base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
      );
    };
    const dyn = await connect(dynArtifact, [], { name: '' });
    const driver = await connect(driverArtifact, [hexToBin(dyn.inner.lockingBytecode)]);
    const compose = async (
      driverFunction: string, driverArgs: readonly unknown[],
      dynFunction: string, dynArgs: readonly unknown[],
    ): Promise<TransactionBuilder> => {
      // Each composition is a separate spend, so it needs its own untouched funding output.
      const funder = await createBareP2pkhFeeFunder(provider, 2_000_000n);
      return messageBus.compose({
        preparedCalls: [
          { contract: driver, functionName: driverFunction, args: driverArgs },
          { contract: dyn, functionName: dynFunction, args: dynArgs },
        ],
        funder,
        changeAddress: funder.unlocker.generateLockingBytecode(),
        // Re-encoding the patched base witness can add a byte to the unlocking script; pay above the relay floor
        // so the covenant, not the mempool, decides the forged spend.
        feeRate: 10,
      }).build();
    };

    // 1. Honest write: the writer row publishes a real coordinate.
    const honestWrite = await compose('write', ['third'], 'setName', ['third']);
    const honestWriteSites = routeBaseSites(honestWrite);
    expect(honestWriteSites.length).toBeGreaterThan(0);
    expect(honestWriteSites.every((site) => (site.unlocker.params[site.index] as bigint) >= -1n)).toBe(true);
    await expect(provider.sendRawTransaction(honestWrite.build())).resolves.toMatch(/^[0-9a-f]{64}$/);

    // 2. Forged write: select the writer row but carry the read-only sentinel and rewrite the new chunk.
    const forgedWrite = await compose('write', ['fourth'], 'setName', ['fourth']);
    const forgedSites = routeBaseSites(forgedWrite);
    expect(forgedSites.length).toBeGreaterThan(0);
    const honestBases = forgedSites.map((site) => site.unlocker.params[site.index]);
    forgedSites.forEach((site) => {
      (site.unlocker.params as unknown[])[site.index] = -5n;
      site.unlocker.syncEncodedArgsFromParams?.([site.index]);
    });
    // cspell:disable-next-line -- forged chunk value
    const forgedHex = forgeChunk(forgedWrite.build(), '666f75727468' /* fourth */, '666f75727458' /* fourtX */);
    const forgedOutcome = await provider.sendRawTransaction(forgedHex)
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expect(forgedOutcome).toContain('mandatory-script-verify-flag-failed');
    expect(forgedOutcome).toMatch(/input index \d+/);

    // Restore the honest base and submit the same call unmodified: the refusal is not over-broad.
    forgedSites.forEach((site, position) => {
      (site.unlocker.params as unknown[])[site.index] = honestBases[position];
      site.unlocker.syncEncodedArgsFromParams?.([site.index]);
    });
    await expect(provider.sendRawTransaction(forgedWrite.build())).resolves.toMatch(/^[0-9a-f]{64}$/);

    // 3. Honest inactive row: a read selects no dynamic writer, so compose keeps the read-only sentinel and the
    //    read must still return the honest value.
    const honestRead = await compose('check', ['fourth'], 'expectName', ['fourth']);
    const readSites = routeBaseSites(honestRead);
    expect(readSites.length).toBeGreaterThan(0);
    expect(readSites.some((site) => (site.unlocker.params[site.index] as bigint) < -1n)).toBe(true);
    await expect(provider.sendRawTransaction(honestRead.build())).resolves.toMatch(/^[0-9a-f]{64}$/);
  }, 300_000);
});
