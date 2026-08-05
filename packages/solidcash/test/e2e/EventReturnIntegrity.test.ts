import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeTransactionUnsafe, encodeTransaction, hash256, hexToBin,
} from '@bitauth/libauth';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { compileString } from '../direct-compile.js';

const EVENT_SOURCE = `contract EventState() {
  int counter;
  event Changed(int value);
  function set(int value) {
    this.counter = value;
    emit Changed(value);
    require(value >= 0);
  }
}`;

const RETURN_SOURCE = `contract ReturnState() {
  int counter;
  function calculate(int value) returns (int) {
    require(value >= 0);
    return value + this.counter;
  }
}`;

type Decoded = ReturnType<typeof decodeTransactionUnsafe>;

async function capturedCall(
  source: string,
  invoke: (contract: StatefulContract) => { send(): Promise<unknown> },
): Promise<{ captured: string; send: (hex: string) => Promise<string> }> {
  const provider = createTestProvider();
  const artifact = compileString(source);
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
  );
  const connected = StatefulContract.withCategory(contract, categoryId);
  let captured = '';
  const send = provider.sendRawTransaction.bind(provider);
  (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
    captured = hex;
    return binToHex(hash256(hexToBin(hex)).reverse());
  };
  try {
    await invoke(connected).send();
  } finally {
    (provider as any).sendRawTransaction = send;
  }
  expect(captured).not.toBe('');
  return { captured, send };
}

async function verifyImmutableOutputConsistency(
  captured: string, send: (hex: string) => Promise<string>,
): Promise<void> {
  const base = decodeTransactionUnsafe(hexToBin(captured));
  const immutableIndex = base.outputs.findIndex((output) => output.token?.nft?.capability === 'none');
  expect(immutableIndex).toBeGreaterThanOrEqual(2);

  const submitChanged = async (change: (tx: Decoded) => void): Promise<void> => {
    const tx = decodeTransactionUnsafe(hexToBin(captured));
    change(tx);
    await send(binToHex(encodeTransaction(tx)));
  };
  const refusal = /mandatory-script-verify-flag-failed|bad-txns|Program failed/;

  await expect(submitChanged((tx) => { tx.outputs.splice(immutableIndex, 1); }))
    .rejects.toThrow(refusal);
  await expect(submitChanged((tx) => {
    const output = tx.outputs[immutableIndex];
    tx.outputs.push({
      ...output,
      lockingBytecode: output.lockingBytecode.slice(),
      token: { ...output.token!, nft: { ...output.token!.nft! } },
    });
    tx.outputs[0].valueSatoshis -= output.valueSatoshis + 1_000n;
  })).rejects.toThrow(refusal);
  await expect(submitChanged((tx) => {
    [tx.outputs[1], tx.outputs[immutableIndex]] = [
      tx.outputs[immutableIndex], tx.outputs[1],
    ];
  })).rejects.toThrow(refusal);
  await expect(submitChanged((tx) => {
    const current = binToHex(tx.outputs[immutableIndex].lockingBytecode);
    tx.outputs[immutableIndex].lockingBytecode = current === '51'
      ? hexToBin(`76a914${'00'.repeat(20)}88ac`)
      : hexToBin('51');
  })).rejects.toThrow(refusal);
  await expect(submitChanged((tx) => {
    const commitment = tx.outputs[immutableIndex].token!.nft!.commitment.slice();
    commitment[commitment.length - 1] ^= 1;
    tx.outputs[immutableIndex].token!.nft!.commitment = commitment;
  })).rejects.toThrow(refusal);

  await expect(send(captured)).resolves.toMatch(/^[0-9a-f]{64}$/);
}

describe('event and emitted-return transaction integrity', () => {
  it('preserves ordinary event position, destination, and commitment', async () => {
    const { captured, send } = await capturedCall(
      EVENT_SOURCE, (contract) => contract.getFunction('set')(7n),
    );
    await verifyImmutableOutputConsistency(captured, send);
  });

  it('preserves emitted-return position, destination, and commitment', async () => {
    const { captured, send } = await capturedCall(
      RETURN_SOURCE, (contract) => contract.getFunction('calculate')(7n).emitReturn(),
    );
    await verifyImmutableOutputConsistency(captured, send);
  });
});
