/**
 * The call surface a deployed per-call contract's handle exposes.
 *
 * A direct-convention handle builds a covenant spend out of its own state layout; a per-call handle composes
 * instead: one root frame entered by the caller's own coin, the contract's live records and a validator, derived
 * and broadcast as one transaction (`callPerCallEntry`). An entry the ABI publishes as read-only is run the way the
 * read path runs it — derived and evaluated locally, never broadcast — so awaiting such a call yields the entry's
 * returned value the same way the direct convention's probe does.
 *
 * What this surface covers today: a single contract's entry, entered by a signer, with no external calls. A writing
 * entry that returns a value is carried, and the decoded value is on the call result (`PerCallCallResult.values`); an
 * entry reached through the proxy hop is carried the same way when the proxy's forwarded call records a result (a
 * fallback that consumes the delegated result), and refused by name for the generated closure shape, whose bare
 * `delegatecall(input)` drops it. A read-only entry reached through the proxy hop is read at the proxy's category,
 * where the implementation's delegate frame finds the records it runs on. A call's fluent modifiers (a time lock, an
 * age lock, an extra output) have no per-call equivalent here yet and are not aliased; the entry's own arguments are
 * the whole of what it takes.
 *
 * A call from a wallet that holds no coin is simulated before any funding: it is derived and evaluated over a
 * stand-in coin at the signer's own lock, through a provider that refuses the broadcast, so a body that refuses
 * reports its own revert, and only a call that would settle reports that the caller cannot pay for it.
 *
 * A writing call waits its turn behind the provider's earlier sends that could touch what it spends (spec section
 * 18), and picks its coin and reads the records only then, so a call sent without awaiting the one before it is
 * built on the state that one left rather than spending the same coin or master twice.
 */

import type { Artifact, StateValue } from '@solidcash/utils';
import type { FunctionArgument } from '../../Argument.js';
import type { TransactionDetails, Utxo } from '../../interfaces.js';
import type NetworkProvider from '../../network/NetworkProvider.js';
import type Signer from '../../Signer.js';
import { callPerCallEntry, PerCallCallError, type PerCallCallResult } from './call.js';
import { callPerCallProxyEntry } from '../proxy/deploy.js';
import { readPerCallEntry, PerCallReadError, type PerCallReadResult } from '../read/index.js';
import { PerCallCompositionRefusedError, type CompositionRefusal } from '../composer/index.js';
import { perCallSendQueue, perCallSendResources, proxyHopSendsAreQueued } from '../queue/index.js';

/** The handle a call is made through: the deployed artifact, its category, its provider and its signer. */
export interface PerCallHandleContract {
  readonly artifact: Artifact;
  /**
   * The ABI row the call names, whose `writesState` decides whether the call is a transaction or a read, and whose
   * `payable` modifier decides whether it may carry value.
   */
  readonly abiEntry: { readonly writesState?: boolean; readonly modifiers?: readonly string[] };
  readonly categoryId: string;
  readonly provider: NetworkProvider;
  readonly signer?: Signer;
  /**
   * The implementation's own category, when the handle names a contract behind a proxy.
   *
   * A writing entry is reached by the hop that enters the proxy's fallback and delegates into the implementation,
   * which runs on the proxy's records, so both categories have to be read to place the composition's inputs. A
   * read-only entry reads the proxy's category alone (`categoryId`): the implementation's own category holds its
   * genesis, not the state its delegate frame runs on.
   */
  readonly proxyImplementationCategoryId?: string;
}

/** One entry of one deployed per-call contract, as a call the handle's namespace hands back. */
export class PerCallFunctionCall {
  /** The value the call carries: the frame's `msg.value`. */
  private value = 0n;

  public constructor(
    private readonly contract: PerCallHandleContract,
    private readonly functionName: string,
    private readonly args: readonly FunctionArgument[],
  ) {}

  /** Attaches value to a call to a payable entry, paid by the signer into the contract's containers. */
  public withValue(amount: bigint): this {
    if (amount < 0n) throw new PerCallCallError('a call carries no negative value');
    if (amount > 0n && !(this.contract.abiEntry.modifiers ?? []).includes('payable')) {
      throw new PerCallCallError(`entry "${this.functionName}" is not payable, so a call to it carries no value`);
    }
    this.value = amount;
    return this;
  }

  /**
   * True when the entry changes nothing, so it is read rather than sent.
   *
   * `writesState` answers read-only only in the negative: the compiler proves it false, never true, so an entry it
   * could not prove read-only — one that reads another contract — still carries `true`. A `view` or `pure` entry is
   * read-only by its own declaration, which is what a caller of one expects, so both answer as reads.
   */
  private isRead(): boolean {
    const entry = this.contract.abiEntry;
    return entry.writesState === false
      || (entry.modifiers ?? []).some((modifier) => modifier === 'view' || modifier === 'pure');
  }

  /** Sends the call: composes the root frame, derives it, asks the machine, and broadcasts what it accepted. */
  public async send(): Promise<TransactionDetails> {
    const result = await this.compose();
    if (result.broadcast === undefined) {
      // A frame the machine refused is reported the way a refused read is: the entry's own source reason, read from
      // the artifact's publication, rather than the opcode the run stopped on.
      const refusal = (result as { readonly refusal?: CompositionRefusal }).refusal;
      if (refusal?.innermost !== undefined) throw new PerCallCompositionRefusedError(refusal);
      const refused = result.verdicts.filter((verdict) => !verdict.accepted)
        .map((verdict) => `${verdict.id}: ${verdict.objection ?? 'refused'}`).join('; ');
      throw new PerCallCallError(
        `the call to "${this.functionName}" was refused, so nothing was broadcast: ${refused}`,
      );
    }
    return result.broadcast;
  }

  /** Composes and derives the call without requiring it to be accepted, for a caller that wants the verdicts. */
  public async compose(): Promise<PerCallCallResult> {
    const { provider, signer, categoryId, proxyImplementationCategoryId } = this.contract;
    if (signer === undefined) {
      throw new PerCallCallError(
        `a call to "${this.functionName}" needs the signer whose coin enters the frame; connect one to the handle`,
      );
    }
    // A call through a proxy hop composes at once until the hop's module opts into the queue; any other call waits
    // its turn behind the sends that could touch what it spends.
    if (proxyImplementationCategoryId !== undefined && !proxyHopSendsAreQueued()) {
      return this.composeNow(provider, signer);
    }
    const resources = perCallSendResources({
      callerLockingBytecode: signer.getLockingBytecode(),
      categoryIds: [categoryId, ...(proxyImplementationCategoryId === undefined ? [] : [proxyImplementationCategoryId])],
    });
    return perCallSendQueue(provider).hold(resources, () => this.composeNow(provider, signer));
  }

  /** Picks the caller's coin and composes over it, or simulates without one; a queued call runs this in its turn. */
  private async composeNow(provider: NetworkProvider, signer: Signer): Promise<PerCallCallResult> {
    const callerUtxo = await callerCoin(provider, signer);
    if (callerUtxo === undefined) {
      try {
        return await this.composeWith(simulationProvider(provider), signer, STAND_IN_COIN);
      } catch (error) {
        if (!(error instanceof SimulationAccepted)) throw error;
        throw new PerCallCallError(
          `the caller's address ${signer.getAddress()} holds no tokenless UTXO to pay the call with`,
        );
      }
    }
    return this.composeWith(provider, signer, callerUtxo);
  }

  /** Composes the call over the caller's coin `callerUtxo`, reading and broadcasting through `provider`. */
  private async composeWith(provider: NetworkProvider, signer: Signer, callerUtxo: Utxo): Promise<PerCallCallResult> {
    const { artifact, categoryId, proxyImplementationCategoryId } = this.contract;
    if (proxyImplementationCategoryId !== undefined) {
      if (this.value > 0n) {
        throw new PerCallCallError(
          `a call to "${this.functionName}" through a proxy carries no value: a delegate frame takes none yet`,
        );
      }
      // The hop delegates into the implementation frame: a returning entry's value is recorded in that frame's
      // `retval` and reported back through the proxy hop, or refused by name when the proxy's forwarded call
      // records no result for it to travel in.
      return callPerCallProxyEntry({
        provider,
        implementationArtifact: artifact,
        proxyCategoryId: categoryId,
        implementationCategoryId: proxyImplementationCategoryId,
        functionName: this.functionName,
        args: this.args,
        callerUtxo,
        callerLockingBytecode: signer.getLockingBytecode(),
        funder: signer.unlockP2PKH(),
        changeAddress: signer.getAddress(),
      });
    }
    return callPerCallEntry({
      provider,
      artifact,
      categoryId,
      functionName: this.functionName,
      args: this.args,
      callerUtxo,
      callerLockingBytecode: signer.getLockingBytecode(),
      funder: signer.unlockP2PKH(),
      changeAddress: signer.getAddress(),
      ...(this.value > 0n ? { value: this.value } : {}),
    });
  }

  /**
   * Runs the entry as a read of the deployed contract, which changes nothing and is never broadcast.
   *
   * A handle that names a proxy reads the proxy's category, because `categoryId` is the proxy's: the implementation
   * runs there as the proxy's delegate frame, over the proxy's records, which is the frame the read composes.
   */
  public async staticCall(): Promise<PerCallReadResult> {
    const { artifact, categoryId, provider } = this.contract;
    return readPerCallEntry({
      provider, artifact, categoryId, functionName: this.functionName, args: this.args,
    });
  }

  /** Awaiting a call runs it: a read resolves to the entry's value, a writing call to its receipt. */
  public then<TResult1 = TransactionDetails | StateValue, TResult2 = never>(
    onFulfilled?: ((value: TransactionDetails | StateValue) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    const run: Promise<TransactionDetails | StateValue> = this.isRead()
      ? this.readValue()
      : this.send();
    return run.then(onFulfilled, onRejected);
  }

  /**
   * The value a read answers with, or the refusal it raised.
   *
   * A read the machine did not accept computed no answer, so it rejects the way a refused composition reports:
   * the frame's own reason is named, and a caller reads it off the error the same way a direct-convention read
   * reports a failing `require`.
   */
  private async readValue(): Promise<StateValue> {
    const read = await this.staticCall();
    if (!read.accepted) {
      if (read.refusal !== undefined) throw new PerCallCompositionRefusedError(read.refusal);
      throw new PerCallReadError(
        `the read of "${this.functionName}" was refused, so it returned no value: ${read.objection ?? 'refused'}`,
      );
    }
    return read.value;
  }

  /** The rejection arm of `then`, so a refused call can be handled where it is awaited. */
  public catch<TResult = never>(
    onRejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
  ): Promise<TransactionDetails | StateValue | TResult> {
    return this.then(undefined, onRejected);
  }
}

/** The caller's own coin: the largest tokenless UTXO at the signer's address, which pays the call's fee. */
async function callerCoin(provider: NetworkProvider, signer: Signer): Promise<Utxo | undefined> {
  const utxos = await provider.getUtxos(signer.getAddress());
  const spendable = utxos.filter((utxo) => utxo.token === undefined);
  return spendable.sort((left, right) => (left.satoshis > right.satoshis ? -1 : 1))[0];
}

/** The coin a simulation composes over in place of a caller's: its outpoint is never spent. */
const STAND_IN_COIN: Utxo = { txid: '5a'.repeat(32), vout: 0, satoshis: 1_000_000_000n };

/** Raised where a simulation's broadcast would be: the machine accepted the composition. */
class SimulationAccepted extends Error {}

/**
 * The provider a simulation composes through: its reads are the provider's own, and a broadcast is refused.
 *
 * Property reads are forwarded to the wrapped provider, so a lookup made through this wrapper - the deployment
 * registry's address and interface resolution, for one - answers with the wrapped provider's own state.
 */
export function simulationProvider(provider: NetworkProvider): NetworkProvider {
  const refuse = async (): Promise<never> => {
    throw new SimulationAccepted('the simulated call was accepted');
  };
  return new Proxy(provider, {
    get(target, property): unknown {
      if (property === 'sendRawTransaction' || property === 'sendPreparedTransaction') return refuse;
      const value: unknown = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
