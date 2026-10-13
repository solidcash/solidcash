import { binToHex, hexToBin } from '@bitauth/libauth';
import { parsePushdataCommitment } from '@solidcash/utils';
import type { Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import type { TransactionDetails, Utxo } from '../../src/interfaces.js';
import { MockNetworkProvider } from '../../src/network/mock/index.js';
import {
  StatefulContract,
  createSatoshiContainerUnlocker,
  getSatoshiContainerAddress,
} from '../../src/stateful/index.js';
import { getTxOutputs, setupStatefulUtxos } from '../test-util.js';

/**
 * A direct delegate guards the proxy's satoshi container, which is bound to the proxy master's lock.
 *
 * The delegate derived the container from the executing implementation's lock, an address no coin sits at, so its
 * guard summed nothing while a delegate call spent the proxy's container on its master path and paid it away.
 */
const IMPL = `pragma solidcash >=0.8.0;
contract Impl() {
  bigint counter;
  function increment() public { this.counter = this.counter + 1; }
}`;

const PROXY = `pragma solidcash >=0.8.0;
contract Proxy(address impl) {
  bigint counter;
  function fire(bytes input) public {
    impl.delegatecall(input);
    require(input.length > 0);
  }
}`;

interface Deployed {
  contract: Contract;
  sc: StatefulContract;
  locking: string;
  category: string;
}

async function deploy(
  provider: MockNetworkProvider, artifact: Artifact, args: string[], state: Record<string, bigint>,
): Promise<Deployed> {
  const base = new Contract(artifact, args, { provider });
  const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, state, { saltContract: true });
  const contract = base.withCategory(hexToBin(setup.categoryId));
  return {
    contract,
    sc: StatefulContract.withCategory(contract, setup.categoryId),
    locking: contract.lockingBytecode,
    category: setup.categoryId,
  };
}

function counterOf(tx: TransactionDetails, category: string, artifact: Artifact): bigint | undefined {
  const output = getTxOutputs(tx).find((candidate) => candidate.token?.category === category
    && candidate.token.nft?.capability === 'mutable');
  return output ? parsePushdataCommitment(output.token!.nft!.commitment, artifact.stateLayout!, 0).counter as bigint
    : undefined;
}

describe('a direct delegate and the proxy satoshi container', () => {
  it('settles an honest call and refuses one that pays the container away', async () => {
    const provider = new MockNetworkProvider();
    const implArtifact = compileString(IMPL).delegateArtifact!;
    const proxyArtifact = compileString(PROXY);
    const impl = await deploy(provider, implArtifact, [], { counter: 0n });
    const proxy = await deploy(provider, proxyArtifact, [impl.locking], { counter: 5n });
    const input = hexToBin(implArtifact.abi.find((entry) => entry.name === 'increment')!.selector!);
    const container = getSatoshiContainerAddress(proxy.contract, proxy.category);
    await provider.addUtxo(container, { txid: 'c5'.repeat(32), vout: 0, satoshis: 50_000n });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fire = (): any => (proxy.sc.call as any).fire(input).withDelegatecall(impl.sc, 'increment', []);

    expect(counterOf(await fire().send(), proxy.category, proxyArtifact)).toBe(6n);

    // The same call also spends the container on its master path, naming the proxy master, and pays it away.
    const builder = await fire().build();
    const master = builder.inputs.findIndex((utxo: Utxo) => utxo.token?.category === proxy.category
      && utxo.token.nft?.capability === 'minting');
    const executor = builder.inputs.findIndex((utxo: Utxo) => utxo.token?.category === impl.category);
    expect(master).toBeGreaterThanOrEqual(0);
    expect(executor).toBeGreaterThanOrEqual(0);
    const [coin] = await provider.getUtxos(container);
    builder.addInput(coin, createSatoshiContainerUnlocker(proxy.contract, master, proxy.category));
    const thief = hexToBin(`76a914${'5a'.repeat(20)}88ac`);
    builder.addOutput({
      to: typeof builder.outputs[0].to === 'string' ? binToHex(thief) : thief,
      amount: coin.satoshis - 2_000n,
    });
    await expect(builder.send()).rejects.toThrow(new RegExp(`input (index )?${executor}(?!\\d)`));
    expect((await provider.getUtxos(container)).map((utxo) => utxo.satoshis)).toEqual([50_000n]);
  }, 180_000);
});
