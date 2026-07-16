// BCH side of the differential conformance harness.
// Compile SolidCash with solidc's compileString, then evaluate a require-oracle function through the
// solidcash SDK against MockNetworkProvider: TransactionBuilder.send() runs the real script VM locally
// (via debug()) and throws FailedRequireError iff a require() failed. So resolve = PASS, throw = MISMATCH.
import { compileString } from 'solidc';
import {
  Contract, TransactionBuilder, MockNetworkProvider, FailedRequireError, randomUtxo,
} from 'solidcash';

export type BchArtifact = ReturnType<typeof compileString>;

const cache = new Map<string, BchArtifact>();

export function compileBch(source: string, evmCompat = false): BchArtifact {
  const key = evmCompat ? `evm::${source}` : source;
  let artifact = cache.get(key);
  if (artifact === undefined) {
    artifact = compileString(source, evmCompat ? { evmCompat: true } : {});
    cache.set(key, artifact);
  }
  return artifact;
}

type UnlockFactory = (...args: unknown[]) => Parameters<TransactionBuilder['addInputs']>[1];

async function buildAndSend(
  artifact: BchArtifact, fnName: string, args: readonly unknown[],
): Promise<void> {
  const provider = new MockNetworkProvider();
  const contract = new Contract(artifact, [], { provider });
  // Generous input + change so the fee headroom scales to large redeem scripts (deeply nested decoders can push a
  // small-fee tx past the relay minimum). The contracts under test never constrain output amounts.
  await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
  const utxos = await contract.getUtxos();
  const unlock = contract.unlock as unknown as Record<string, UnlockFactory>;
  const unlocker = unlock[fnName](...args);
  await new TransactionBuilder({ provider })
    .addInputs(utxos, unlocker)
    .addOutput({ to: contract.address, amount: 1_000n })
    .addOutput({ to: contract.address, amount: 900_000n })
    .send();
}

// Equality oracle: true if every require() held, false on a require() failure; other errors propagate.
export async function evalBchCheck(
  artifact: BchArtifact, fnName: string, args: readonly unknown[],
): Promise<boolean> {
  try {
    await buildAndSend(artifact, fnName, args);
    return true;
  } catch (e) {
    if (e instanceof FailedRequireError) return false;
    throw e;
  }
}

// Revert probe: true if the spend fails at runtime for ANY reason (overflow OP_VERIFY, require, etc.).
export async function evalBchRejects(
  artifact: BchArtifact, fnName: string, args: readonly unknown[],
): Promise<boolean> {
  try {
    await buildAndSend(artifact, fnName, args);
    return false;
  } catch {
    return true;
  }
}
