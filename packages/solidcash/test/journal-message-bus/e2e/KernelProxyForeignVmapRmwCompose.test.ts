import { bigIntToVmNumber, hexToBin, vmNumberToBigInt } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract, StatefulContract, getContractFactory, upgrades, Signer,
  SortedList, getEntryNftAddress,
} from '../../../src/index.js';
import { keyToSlot } from '../../../src/stateful/SortedList.js';
import { setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

/** Criterion 3a: deployProxy path performs foreign vmap RMW via withExternalCall (shipped SDK). */
describe('kernel proxy × foreign vmap RMW compose', () => {
  it('settles deployProxy poke that credits a foreign Bank', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const privateKey = new Uint8Array(32).fill(0x42);
    const signer = new Signer(privateKey, provider);
    for (let index = 0; index < 32; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'),
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const bankArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Bank() {
        mapping(int => int) bal;
        function seed(int k, int v) public { bal[k] = v; }
        function credit(int k, int v) public { bal[k] = bal[k] + v; }
      }`, KERNEL);
    const bankBase = new Contract(bankArtifact, [], { provider });
    const bankSetup = await setupStatefulUtxos(
      provider, bankBase, bankArtifact.stateLayout!, {}, { saltContract: true },
    );
    const bank = StatefulContract.withCategory(
      bankBase.withCategory(hexToBin(bankSetup.categoryId)), bankSetup.categoryId,
    );
    await bank.call.seed(2n, 10n).send();

    const implArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IBank { function credit(int k, int v) external; }
      contract Coordinator() {
        int count;
        function initialize() public { this.count = 0; }
        function poke(address bank, int k, int v) public {
          IBank(bank).credit(k, v);
          this.count = this.count + 1;
        }
      }`, KERNEL);
    expect(implArtifact.delegateArtifact).toBeDefined();

    const deployed = await upgrades.deployProxy(getContractFactory(implArtifact, signer), []);
    // Foreign targets must be registered on the implementation (not only withExternalCall on the dispatch handle).
    deployed.implementation._registerResolvedExternal('IBank', bank);
    const tx = await (deployed as any).poke(bank.inner.lockingBytecode, 2n, 5n)
      .withExternalCall(bank, 'credit', [2n, 5n])
      .send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);

    const ea = getEntryNftAddress(bank.inner, bankSetup.categoryId, 'bal');
    const entry = SortedList.fromUtxos(await provider.getUtxos(ea))
      .find(keyToSlot(bigIntToVmNumber(2n)));
    expect(entry).toBeDefined();
    expect(vmNumberToBigInt(entry!.value, { requireMinimalEncoding: false })).toBe(15n);
  }, 300_000);
});
