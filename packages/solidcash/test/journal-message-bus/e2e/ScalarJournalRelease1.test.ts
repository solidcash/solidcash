import { describe, expect, it } from 'vitest';
import { compileString } from '../../direct-compile.js';
import {
  binToHex, decodeTransactionUnsafe, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { Contract, StatefulContract } from '../../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';

const SOURCE = `pragma solidcash >=0.8.0;
contract ScalarJournalRelease1() {
  int x;
  int y;

  function addX(int amount) internal {
    this.x = this.x + amount;
  }

  function moveXToY() internal {
    this.y = this.y + this.x;
    this.x = 0;
  }

  function repeated(int a, int b, int c) {
    addX(a);
    addX(b);
    addX(c);
    require(a >= 0);
  }

  function branched(bool takeFirst, int a, int b) {
    if (takeFirst) {
      addX(a);
    }
    addX(b);
    require(b >= 0);
  }

  function looped(int count, int amount) {
    for (int i = 0; i < count; i = i + 1) {
      addX(amount);
    }
    require(count >= 0);
  }

  function multiSlot(int initial, int increment) {
    addX(initial);
    addX(increment);
    moveXToY();
    require(initial >= 0);
  }

  function check(int expectedX, int expectedY) {
    require(this.x == expectedX && this.y == expectedY);
  }
}`;

async function deploy(initial = { x: 0n, y: 0n }): Promise<{
  artifact: ReturnType<typeof compileString>;
  contract: StatefulContract;
}> {
  const provider = createTestProvider();
  const artifact = compileString(SOURCE, { forceStateful: true });
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, initial, { saltContract: true },
  );
  return {
    artifact,
    contract: StatefulContract.withCategory(contract, categoryId),
  };
}

describe('Release 1 scalar journal SDK E2E', () => {
  const PREFLIGHT_REFUSAL =
    /^layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation\.$/;
  const PROVIDER_REFUSAL =
    /mandatory-script-verify-flag-failed[\s\S]*evaluating input index 0: Program failed an OP_VERIFY operation/;
  it('auto-derives one sequential settlement for a helper called at three sites', async () => {
    const { contract } = await deploy();
    await contract.repeated(2n, 3n, 5n).send();
    await contract.check(10n, 0n).send();
  });

  it('preserves branch ordering for both taken and non-taken helper sites', async () => {
    const taken = await deploy();
    await taken.contract.branched(true, 4n, 7n).send();
    await taken.contract.check(11n, 0n).send();

    const skipped = await deploy();
    await skipped.contract.branched(false, 4n, 7n).send();
    await skipped.contract.check(7n, 0n).send();
  });

  it('threads one scalar journal through a bounded runtime loop', async () => {
    const { contract } = await deploy({ x: 1n, y: 0n });
    await contract.looped(4n, 3n).send();
    await contract.check(13n, 0n).send();
  });

  it('provides read-your-writes across helpers and flushes multiple scalar slots', async () => {
    const { contract } = await deploy({ x: 1n, y: 10n });
    await contract.multiSlot(4n, 2n).send();
    await contract.check(0n, 17n).send();
  });

  it('rejects a hostile SDK state override that substitutes the journal settlement', async () => {
    const { contract } = await deploy();
    await expect(
      contract.repeated(2n, 3n, 5n)
        .setState({ x: 999n, y: 0n })
        .send(),
    ).rejects.toThrow(PREFLIGHT_REFUSAL);

    // Rejection must leave the consumed owner state untouched.
    await contract.check(0n, 0n).send();
  });

  it('rejects a forged final journal flush while accepting the untouched transaction', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, { forceStateful: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { x: 0n, y: 0n }, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const send = provider.sendRawTransaction.bind(provider);
    let captured = '';
    (provider as any).sendRawTransaction = async (transactionHex: string): Promise<string> => {
      captured = transactionHex;
      throw new Error('capture-only');
    };
    try {
      await expect(contract.repeated(2n, 3n, 5n).send()).rejects.toThrow('capture-only');
    } finally {
      (provider as any).sendRawTransaction = send;
    }
    expect(captured).not.toBe('');

    const forged = decodeTransactionUnsafe(hexToBin(captured));
    const stateOutput = forged.outputs.find((output) => output.token?.nft?.capability === 'mutable');
    expect(stateOutput).toBeDefined();
    stateOutput!.token!.nft!.commitment[0] ^= 1;

    await expect(send(binToHex(encodeTransaction(forged)))).rejects.toThrow(PROVIDER_REFUSAL);
    await expect(send(captured)).resolves.toBeTypeOf('string');
  });
});
