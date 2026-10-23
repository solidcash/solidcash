import { bigIntToVmNumber, binToHex, hexToBin, vmNumberToBigInt } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import {
  StatefulContract,
  SortedList,
  getEntryNftAddress,
} from '../../../src/stateful/index.js';
import { keyToSlot } from '../../../src/stateful/SortedList.js';
import { setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  evmCompat: true,
  suppressWarnings: true,
} as const;

/**
 * Plain `.send()` must keep the caller's entry NFTs immediately after the master/data region and defer
 * external-call participants. Legacy ordering placed Probe between Acc and its entry slots so Acc's
 * `OUTPUTBYTECODE[INPUTINDEX+1]` EQUALVERIFY authenticated Probe instead of the entry NFT.
 */
describe('kernel direct send external-call entry ordering', () => {
  it('settles single-key mapping RMW + Probe.touch under plain send', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const probeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Probe() { function touch() public { require(true); } }`, {
      ...KERNEL, evmCompat: false, messageBusGraphContext: true,
    });
    const accArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IProbe { function touch() external; }
      contract Acc() {
        mapping(int => int) bal;
        function seed(int k, int v) public { this.bal[k] = v; require(true); }
        function credit(address probe, int k, int v) public {
          this.bal[k] = this.bal[k] + v;
          IProbe(probe).touch();
          require(true);
        }
      }`, { ...KERNEL, evmCompat: false });

    const probeBase = new Contract(probeArtifact, [], { provider });
    const probeSetup = await setupStatefulUtxos(
      provider, probeBase, probeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const probe = StatefulContract.withCategory(
      probeBase.withCategory(hexToBin(probeSetup.categoryId)), probeSetup.categoryId,
    );
    const accBase = new Contract(accArtifact, [], { provider });
    const accSetup = await setupStatefulUtxos(
      provider, accBase, accArtifact.stateLayout!, {}, { saltContract: true },
    );
    const acc = StatefulContract.withCategory(
      accBase.withCategory(hexToBin(accSetup.categoryId)), accSetup.categoryId,
    );
    acc._registerResolvedExternal('IProbe', probe);
    await acc.call.seed(2n, 10n).send();

    const entrySlotOffset = accArtifact.abi.find((entry) => entry.name === 'credit')!
      .blockLayout?.slots.find((slot) => slot.kind === 'entry')?.offset;
    expect(entrySlotOffset).toBeDefined();

    // Seed spent the deploy master; resolve the live minting NFT for Acc/Probe before asserting order.
    const accMaster = (await provider.getUtxos(acc.tokenAddress)).find(
      (utxo) => utxo.token?.nft?.capability === 'minting'
        && utxo.token.category.toLowerCase() === accSetup.categoryId.toLowerCase(),
    );
    const probeMaster = (await provider.getUtxos(probe.tokenAddress)).find(
      (utxo) => utxo.token?.nft?.capability === 'minting'
        && utxo.token.category.toLowerCase() === probeSetup.categoryId.toLowerCase(),
    );
    expect(accMaster).toBeDefined();
    expect(probeMaster).toBeDefined();

    const builder = await (acc as unknown as {
      _createBuilder: (
        name: string, args: unknown[],
      ) => Promise<{ build: () => { inputs: Array<{ txid: string; vout: number }> } }>;
    })._createBuilder('credit', [probe.inner.lockingBytecode, 2n, 5n]);
    const built = builder.build();
    const accInputIndex = built.inputs.findIndex(
      (input) => input.txid === accMaster!.txid && input.vout === accMaster!.vout,
    );
    const probeInputIndex = built.inputs.findIndex(
      (input) => input.txid === probeMaster!.txid && input.vout === probeMaster!.vout,
    );
    expect(accInputIndex).toBeGreaterThanOrEqual(0);
    expect(probeInputIndex).toBeGreaterThan(accInputIndex + entrySlotOffset!);

    await expect(acc.call.credit(probe.inner.lockingBytecode, 2n, 5n).send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    const entryAddress = getEntryNftAddress(acc.inner, accSetup.categoryId, 'bal');
    const entry = SortedList.fromUtxos(await provider.getUtxos(entryAddress))
      .find(keyToSlot(bigIntToVmNumber(2n)));
    expect(entry).toBeDefined();
    expect(vmNumberToBigInt(entry!.value, { requireMinimalEncoding: false })).toBe(15n);
  }, 180_000);

  it('settles fixed dual-key add+remove + Probe.touch under plain send', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const probeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Probe() { function touch() public { require(true); } }`, {
      ...KERNEL, evmCompat: false, messageBusGraphContext: true,
    });
    const accArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IProbe { function touch() external; }
      contract Acc() {
        mapping(int => bool) membership;
        function seed(int who) public { this.membership[who] = true; require(true); }
        function update(address probe, int addKey, int removeKey) public {
          this.membership[addKey] = true;
          this.membership[removeKey] = false;
          IProbe(probe).touch();
          require(true);
        }
      }`, { ...KERNEL, evmCompat: false });

    const probeBase = new Contract(probeArtifact, [], { provider });
    const probeSetup = await setupStatefulUtxos(
      provider, probeBase, probeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const probe = StatefulContract.withCategory(
      probeBase.withCategory(hexToBin(probeSetup.categoryId)), probeSetup.categoryId,
    );
    const accBase = new Contract(accArtifact, [], { provider });
    const accSetup = await setupStatefulUtxos(
      provider, accBase, accArtifact.stateLayout!, {}, { saltContract: true },
    );
    const acc = StatefulContract.withCategory(
      accBase.withCategory(hexToBin(accSetup.categoryId)), accSetup.categoryId,
    );
    acc._registerResolvedExternal('IProbe', probe);
    await acc.call.seed(7n).send();

    await expect(
      acc.call.update(probe.inner.lockingBytecode, 3n, 7n).send(),
    ).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });

    const entryAddress = getEntryNftAddress(acc.inner, accSetup.categoryId, 'membership');
    const entries = SortedList.fromUtxos(await provider.getUtxos(entryAddress));
    expect(entries.find(keyToSlot(bigIntToVmNumber(3n)))).toBeDefined();
    expect(binToHex(entries.find(keyToSlot(bigIntToVmNumber(3n)))!.value)).toBe('01');
    const removed = entries.find(keyToSlot(bigIntToVmNumber(7n)));
    expect(removed).toBeDefined();
    expect(removed!.value.length === 0
      || vmNumberToBigInt(removed!.value, { requireMinimalEncoding: false }) === 0n).toBe(true);
  }, 180_000);
});
