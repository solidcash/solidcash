import { hexToBin } from '@bitauth/libauth';
import { parsePushdataCommitment } from '@solidcash/utils';
import type { Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import {
  StatefulContract,
  getDataNftLockingBytecode,
} from '../../src/stateful/index.js';
import type { TransactionDetails } from '../../src/interfaces.js';
import { createTestProvider, getTxOutputs, setupStatefulUtxos } from '../test-util.js';

/**
 * A read a function makes beside its delegatecall is verified like a read in any other function.
 *
 * The delegate authorizes the proxy's state, and nothing it runs binds a read the proxy makes itself, yet the proxy
 * skipped its read verification together with its state covenant: another deployment's data NFT settled where the
 * source names `ICounter(counterAddr).counter`. Now the read's identity and its preservation are bound.
 *
 * The SDK does not yet lay such a read out: it gives the read input's value to a new implementation NFT and leaves the
 * read's own output a placeholder, so the spend it builds is refused, honest included. Each case here restores the
 * read's output by hand.
 */
const IMPL = `pragma solidcash >=0.8.0;
contract Impl() {
  bigint counter;
  function increment() public { this.counter = this.counter + 1; }
}`;

const ICOUNTER = 'interface ICounter { public bigint counter; function bump(); }';

const COUNTER = `pragma solidcash >=0.8.0;
${ICOUNTER}
contract Counter() is ICounter {
  bigint counter;
  function bump() public { this.counter = this.counter + 1; }
}`;

const PROXY = `pragma solidcash >=0.8.0;
${ICOUNTER}
contract Proxy(address impl, bytes counterAddr) {
  bigint counter;
  function look(bytes input) public {
    impl.delegatecall(input);
    require(ICounter(counterAddr).counter > 4);
  }
}`;

interface Deployed {
  contract: Contract;
  sc: StatefulContract;
  locking: string;
  category: string;
}

async function deploy(
  provider: ReturnType<typeof createTestProvider>, artifact: Artifact, args: (string | Uint8Array)[],
  state: Record<string, bigint>,
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

describe('a read beside a delegatecall', () => {
  it('settles with the named deployment\'s data NFT, and refuses another deployment\'s', async () => {
    const provider = createTestProvider();
    const implArtifact = compileString(IMPL).delegateArtifact!;
    const counterArtifact = compileString(COUNTER);
    const proxyArtifact = compileString(PROXY);
    const impl = await deploy(provider, implArtifact, [], { counter: 0n });
    const counter = await deploy(provider, counterArtifact, [], { counter: 7n });
    const other = await deploy(provider, counterArtifact, [], { counter: 9n });
    const proxy = await deploy(
      provider, proxyArtifact, [impl.locking, getDataNftLockingBytecode(counter.category)], { counter: 5n },
    );
    const input = hexToBin(implArtifact.abi.find((entry) => entry.name === 'increment')!.selector!);

    // `look` reading the given deployment, its read output restored at the read input's index.
    const look = async (source: Deployed): Promise<TransactionDetails> => {
      const reader = StatefulContract.withCategory(proxy.contract, proxy.category, {
        externals: { ICounter: source.sc },
      });
      const builder: any = await (reader as any).look(input).withDelegatecall(impl.sc, 'increment', []).build();
      const index = builder.inputs.findIndex((utxo: any) => utxo.token?.category === source.category);
      const read = builder.inputs[index];
      const lock = getDataNftLockingBytecode(source.category);
      const to = typeof builder.outputs[0].to === 'string' ? Buffer.from(lock).toString('hex') : lock;
      builder.outputs.splice(index, builder.outputs.length - index, {
        to, amount: BigInt(read.satoshis), token: read.token,
      });
      return builder.send();
    };

    await expect(look(other)).rejects.toThrow(/input index 0/);

    const tx = await look(counter);
    const proxyState = getTxOutputs(tx).find((output) => output.token?.category === proxy.category
      && output.token.nft?.capability === 'mutable');
    expect(parsePushdataCommitment(proxyState!.token!.nft!.commitment, proxyArtifact.stateLayout!, 0).counter)
      .toBe(6n);
  }, 180_000);
});
