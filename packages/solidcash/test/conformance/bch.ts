// BCH side of the differential conformance harness.
// Compile SolidCash with solidc's compileString, then evaluate a require-oracle function through the
// solidcash SDK against MockNetworkProvider: TransactionBuilder.send() runs the real script VM locally
// (via debug()) and throws FailedRequireError iff a require() failed. So resolve = PASS, throw = MISMATCH.
import { compileString } from '../direct-compile.js';
import { Contract, TransactionBuilder, FailedRequireError, FailedTransactionError, randomUtxo } from '@solidcash/solidcash';
import { MockNetworkProvider } from '@solidcash/solidcash/network/mock';
import { StatefulContract, getContractFactory } from '@solidcash/solidcash/stateful';
import { setupStatefulUtxos } from '../test-util.js';
import { binToHex } from '@bitauth/libauth';
import { SHARED_LIBRARY_SALT, keccakComputeLockingBytecode } from '@solidcash/utils';

export type BchArtifact = ReturnType<typeof compileString>;

const cache = new Map<string, BchArtifact>();

export function compileBch(source: string, evmCompat = false): BchArtifact {
  const key = evmCompat ? `evm::${source}` : source;
  let artifact = cache.get(key);
  if (artifact === undefined) {
    // Conformance compares against the default entry model (the cases seed that shape); opt out of the vmap default.
    artifact = compileString(source, evmCompat ? { evmCompat: true } : {});
    cache.set(key, artifact);
  }
  return artifact;
}

// Stateful compile (state vars / assembly `.slot` layout): needs evmCompat + a data-NFT genesis.
export function compileBchStateful(source: string): BchArtifact {
  const key = `state::${source}`;
  let artifact = cache.get(key);
  if (artifact === undefined) {
    artifact = compileString(source, { evmCompat: true });
    cache.set(key, artifact);
  }
  return artifact;
}

type UnlockFactory = (...args: unknown[]) => Parameters<TransactionBuilder['addInputs']>[1];

// `salt` is a dropped redeem-script push: a deployer's density reserve, which raises the input's operation budget.
async function buildAndSend(
  artifact: BchArtifact, fnName: string, args: readonly unknown[], salt?: Uint8Array,
): Promise<void> {
  const provider = new MockNetworkProvider();
  const contract = new Contract(artifact, [], { provider, ...(salt ? { salt } : {}) });
  // keccak256 runs in compute side-cars the deployer funds (shared salt for a stateless contract).
  const keccak = artifact.externalLibraries?.find((library) => library.name === 'keccak256' && library.resultNft);
  for (let i = 0; keccak && i < Math.max(1, keccak.minInstances ?? 1); i++) {
    await provider.addUtxo(binToHex(keccakComputeLockingBytecode(SHARED_LIBRARY_SALT, false)), {
      ...randomUtxo({ satoshis: 100_000n }),
      token: { category: 'ee'.repeat(31) + '11', amount: 0n, nft: { capability: 'mutable', commitment: '' } },
    });
  }
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
  artifact: BchArtifact, fnName: string, args: readonly unknown[], salt?: Uint8Array,
): Promise<boolean> {
  try {
    await buildAndSend(artifact, fnName, args, salt);
    return true;
  } catch (e) {
    if (e instanceof FailedRequireError) return false;
    throw e;
  }
}

// Stateful eval: genesis the contract's data NFT(s), then spend `fnName` through the StatefulContract covenant.
// Used for slot-layout conformance (assembly `.slot` reads live in a stateful contract). resolve = PASS,
// FailedRequireError = MISMATCH.
async function prepareStateful(
  artifact: BchArtifact, fnName: string, args: readonly unknown[],
): Promise<() => Promise<unknown>> {
  const provider = new MockNetworkProvider();
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(provider, contract, artifact.stateLayout!, {}, { saltContract: true });
  const sc = StatefulContract.withCategory(contract, categoryId);
  const fn = (sc as unknown as Record<string, (...a: unknown[]) => { send: () => Promise<unknown> }>)[fnName];
  return () => fn(...args).send();
}

async function buildAndSendStateful(artifact: BchArtifact, fnName: string, args: readonly unknown[]): Promise<void> {
  await (await prepareStateful(artifact, fnName, args))();
}

export async function evalBchStatefulCheck(
  artifact: BchArtifact, fnName: string, args: readonly unknown[],
): Promise<boolean> {
  try {
    await buildAndSendStateful(artifact, fnName, args);
    return true;
  } catch (e) {
    if (e instanceof FailedRequireError) return false;
    throw e;
  }
}

// Deploy through ContractFactory (the constructor and state-variable initializers run), then send `fnName`. A
// deployment failure throws; a rejected call returns its message, an accepted one undefined.
export async function evalBchDeployedStateful(
  artifact: BchArtifact, fnName: string, args: readonly unknown[],
): Promise<string | undefined> {
  const provider = new MockNetworkProvider();
  const [signer] = await provider.getSigners(1, { fundingUtxos: 4 });
  const deployed = await getContractFactory(artifact, signer).deploy() as unknown as
    Record<string, (...a: unknown[]) => Promise<unknown>>;
  try {
    await deployed[fnName](...args);
    return undefined;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

// Stateful revert probe on a fresh genesis: true only when the VM refused the spend (the SDK's preflight evaluation
// or the node). A genesis setup failure or an SDK error is rethrown.
export async function evalBchStatefulVmRejects(
  artifact: BchArtifact, fnName: string, args: readonly unknown[],
): Promise<boolean> {
  const send = await prepareStateful(artifact, fnName, args);
  try {
    await send();
    return false;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (e instanceof FailedTransactionError
      || /preflight failed|undefined function identifier|mandatory-script-verify/.test(message)) return true;
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

// True only when the BCH VM refused the spend: a failed require, a failed evaluation, or a node rejection. An error
// from building the transaction (an SDK argument check, a compile-time refusal) is not a revert and is rethrown.
export async function evalBchVmRejects(
  artifact: BchArtifact, fnName: string, args: readonly unknown[], salt?: Uint8Array,
): Promise<boolean> {
  try {
    await buildAndSend(artifact, fnName, args, salt);
    return false;
  } catch (e) {
    if (e instanceof FailedTransactionError) return true;
    throw e;
  }
}
