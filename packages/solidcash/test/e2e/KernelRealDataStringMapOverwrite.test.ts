import path from 'node:path';
import { compileFile } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';
import { effectiveAccelerationContractsRoot } from '../effectiveacceleration-corpus.js';

// Guards the present-key overwrite NEW-lane pin (418b605cd). Neutral replicas with the same block layout did not
// reach the probe order that duplicated the row, so this compiles the real data contract that did. That contract
// is the sibling checkout's own source (see `effectiveacceleration-corpus.ts`), so the case skips without it.
const contractsRoot = effectiveAccelerationContractsRoot();

describe.skipIf(contractsRoot === undefined)('real data contract string map overwrite', () => {
  it('overwrites a seeded inline entry through the proxy', async () => {
    const artifact = compileFile(path.join(contractsRoot!, 'MarketplaceDataV1.sol'), {
      evmCompat: true, suppressWarnings: true, messageBus: true, messageBusKernel: true,
      messageBusGraphContext: true, maximumInputBytes: 1_000_000, commitmentLimit: 128,
    });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x6f), provider);
    for (let index = 0; index < 24; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const peer = addressToLockScript(new Signer(new Uint8Array(32).fill(0x7f), provider).getAddress());
    const data = await upgrades.deployProxy(getContractFactory(artifact, signer), [peer], { initializer: 'initialize' });
    await data.forward('updateMeceTag', ['DV', 'Digital Video2']).send();
    const read = await (data as unknown as { readMeceTag: (key: string) => Promise<unknown> }).readMeceTag('DV');
    expect(typeof read === 'string' ? read : Buffer.from(read as Uint8Array).toString('utf8')).toBe('Digital Video2');
  }, 600_000);
});
