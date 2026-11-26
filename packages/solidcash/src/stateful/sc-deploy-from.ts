/**
 * phase-boundary extract: SC lifecycle extract — static deployFrom (factory deploy + child genesis).
 */

import { binToHex, binsAreEqual, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { encodeLockingBytecodeP2pkh } from '@bitauth/libauth/build/lib/address/locking-bytecode.js';
import { sha256 } from '@bitauth/libauth/build/lib/crypto/default-crypto-instances.js';
import { bigIntToVmNumber } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import {
  buildChunkCommitment,
  buildEntryCommitment,
  buildEventNftCovenantScript,
  buildInitialStateCommitments,
  buildPushdataCommitmentKeeping,
  bytecodeToScript,
  childStateLayoutDigest,
  computeEventNameHash,
  dynamicLenKey,
  encodeEventParameter,
  encodePushdataValue,
  EVENT_CHUNK_BYTES,
  ORACLE_POOL_PARAMETER,
  oraclePoolBinding,
  parsePushdataCommitment,
  splitEventPayload,
  scriptToAsm,
  splitValueIntoChunks,
  validateChildDeploymentGenesisState,
  getDefaultStateValue,
  CALL_RECORD_NO_READER,
  CALL_RECORD_READER_INPUT,
  type Artifact,
  type DeployerAbi,
  type StateValue,
} from '@solidcash/utils';
import { type ConstructorArgument, type FunctionArgument } from '../Argument.js';
import { Contract } from '../Contract.js';
import { ownCoinRefusal, signerFundingCoins } from '../framed/deploy/own-coin.js';
import { createVirtualMachineBch2026ForProvider } from '../network/createVirtualMachine.js';
import { generateLibauthSourceOutputs as sourceOutputsOf } from '../utils.js';
import { applyExternalSignatures, isExternallySignedUnlocker } from '../external-signing.js';
import { takesOraclePool } from '../oracle/pool/reader.js';
import type { Output, UnlockableUtxo, Unlocker, Utxo } from '../interfaces.js';
import type { StateValueType } from '../types/state-inference.js';
import {
  addressToLockScript, randomUtxo, scriptToLockingBytecode,
} from '../utils.js';
import {
  createDataNftUnlocker,
  createDynamicChunkUnlocker,
  createEntryNftUnlocker,
  createSatoshiContainerUnlocker,
  createTokenContainerUnlocker,
  getAnonymousEventNftAddress,
  getDataNftAddress,
  getDynamicChunkAddress,
  getEntryNftAddress,
  getEntryNftLockingBytecode,
  getEventNftAddress,
  getSatoshiContainerAddress,
  getTokenContainerAddress,
} from './covenant-helpers.js';
import {
  buildDeployerPreps, broadcastDeployerPreps, buildDeployerUnlocking, DeployerPathError, DeployerPrepError,
  releaseDeployerPrepReservations, decodeDeployBinding, encodeDeployBinding, fitCreatePad, largestCreatePad,
  deployerLocktime, lowestCommonLocktime,
  type DeployerPrep, type DeployerSiteVisit, completeCreateRun, placeChildCreationGroups, staleCreationInputs,
  unboundCallWitnesses,
  type LocktimeNeed, type PlacedConstructorCalls,
} from './deployer.js';
import {
  CreationPlanChanged, creationPlanKey, settleCreationLocktime, settleCreatorRun, type CreationPlan,
  type PlannedChild,
} from './sc-deploy-from-plan.js';
import { planRuntimeLoopTransfers } from './sc-load-create-builder-dynamic-chunks.js';
import { loadCreateBuilderTokenContainers } from './sc-load-create-builder-token-containers.js';
import { refusePaymentsToStatefulMasters } from './master-lock-payment.js';
import type { RuntimeEffect } from './runtime-effect-stream-trace.js';
import type { RuntimeLoopTransferTarget } from './sc-derive-full-phase2-apply-runtime-loop.js';
import type { RuntimeLoopTransferOutput, TokenContainerInfo } from './external-call-utxo-group.js';
import { evalComputedKey, keyArguments, visibleHandlerInputs } from './route-expression-key.js';
import { vmapCounterPermutationSpec } from './internal-function-args.js';
import { callRecordDigest } from './call-record.js';
import { returnEventNftCommitment } from './return-event-nft-commitment.js';
import { registeredValueAddressLockingBytecode, registerDeployment } from './deployment-registry.js';
import { genesisOutpointKey, isReservedGenesisOutpoint } from './genesis-reservations.js';
import { assertSpendableContract } from './spendable-code.js';
import {
  bytesToSlotValue,
  decodeEntryCommitment,
  encodeEntryCommitment,
  headSentinelCommitment,
  keyToSlotMulti,
  SortedList,
} from './SortedList.js';
import { loadCreateBuilderIterationInputs } from './sc-load-create-builder-iteration-inputs.js';
import {
  artifactAddressForm, artifactUsesSolidityAbi, externalResultUsesEvmWords, sortAddressPair, sortedAddressPairPacked,
} from './solidityAbi.js';
import { encodeExternalReturnValues } from './external-return-encoding.js';
import { eventContinuationLockingBytecode } from './event-chunks.js';
import type {
  DeployFromOptions, DeployFromResult,
} from './stateful-lifecycle-types.js';
import type { ConnectedStatefulContract } from './StatefulContract.js';

/** The preps of a creating call are broadcast, and a coin its creation spends moved before the creation was sent. */
class CreationCoinsMoved extends Error {
  constructor(readonly preps: DeployerPrep[]) {
    super('A coin the creation spends moved while its preps were broadcast');
    this.name = 'CreationCoinsMoved';
  }
}

/**
 * A10 and decision f: a creating call through Deploy<C> builds and signs its preps, builds the creation, runs it
 * in the VM, and only then broadcasts the chain and the creation. A failure before that broadcasts nothing and
 * releases the coins the preps reserved.
 *
 * A14 item 4: the children are the ones the creator's run makes. A creation whose run shows other children, or other
 * arguments, than it was built from is built again from what the run showed, before anything is broadcast.
 */
export async function deployFromStatefulContract<T extends Artifact>(
  options: DeployFromOptions<T>,
): Promise<DeployFromResult<T>> {
  let plan: CreationPlan | undefined;
  let current = options;
  let moved = 0;
  const tried = new Set<string>();
  for (let attempt = 0; ; attempt += 1) {
    const pending: { preps?: DeployerPrep[] } = {};
    try {
      return await deployFromStatefulContractInner(current, pending, plan);
    } catch (error) {
      if (pending.preps !== undefined && pending.preps.every((prep) => !prep.broadcast)) {
        releaseDeployerPrepReservations(pending.preps);
      }
      // The preps are out and a coin the creation spent moved meanwhile: build it again from those preps.
      if (error instanceof CreationCoinsMoved && moved < 4) {
        moved += 1;
        current = { ...current, deployerPreps: error.preps };
        continue;
      }
      if (!(error instanceof CreationPlanChanged)) throw error;
      const key = creationPlanKey(error.plan);
      if (tried.has(key) || attempt >= 32) {
        throw new DeployerPrepError(`The creator's run does not settle: ${error.message}`);
      }
      tried.add(key);
      plan = error.plan;
    }
  }
}

async function deployFromStatefulContractInner<T extends Artifact>(
  options: DeployFromOptions<T>,
  pending: { preps?: DeployerPrep[] },
  plan: CreationPlan | undefined,
): Promise<DeployFromResult<T>> {
  const {
    provider, factory, deployFunctionName,
  } = options;
  const rawDeployFunctionArgs = options.deployFunctionArgs;

  // Validate the deploy function exists and has the 'deploy' modifier
  const deployAbi = factory.inner.artifact.abi.find(
    (f) => f.name === deployFunctionName,
  );
  if (!deployAbi) {
    throw new Error(
      `Function '${deployFunctionName}' not found in contract '${factory.name}'.`,
    );
  }
  if (!deployAbi.modifiers?.includes('deploy')) {
    throw new Error(
      `Function '${deployFunctionName}' does not have the 'deploy' modifier. `
      + 'Only functions with the deploy modifier can be used for contract deployment.',
    );
  }

  // The covenant sees each address argument as the registered deployment's value identity (a physical locking
  // bytecode for a plain contract, its public CREATE identity when it has one). Derive salts, mapping
  // keys and constructor genesis from those same bytes: a cashaddr string here would otherwise sort and pack
  // differently from the value the script compares, deriving a child address the factory never creates.
  const deployFunctionArgs = rawDeployFunctionArgs.map((arg, index) => {
    const input = deployAbi.inputs[index];
    if (!input || input.name.startsWith('__internal__')) return arg;
    if (input.type !== 'address' && !input.type.startsWith('address ')) return arg;
    return typeof arg === 'string' ? (registeredValueAddressLockingBytecode(provider, arg) ?? arg) : arg;
  });

  // Resolve the child + funding from the call, the factory's child registry, the recorded `new C(param)`
  // argument mapping, and the factory's deploy defaults - so a call need only pass what isn't already known.
  // The child's category is the funding UTXO's txid (vout 0), so its address derives forward from
  // (artifact, constructorArgs, category) - no extra input and no trace reverse-derivation needed.
  const deployTarget = deployAbi.deployTargets?.[0];
  if (!deployTarget) {
    throw new Error(
      `Deploy function '${deployFunctionName}' does not contain a typed 'new Contract(...)' deployment. `
      + 'The child artifact, address, and state-NFT layout would be supplied only by the caller and are not '
      + 'authenticated by the factory covenant. Recompile the factory with an explicit typed deployment.',
    );
  }
  // A compiler-published deployDataNft run gives child state outputs a fixed region before the vmap tail, so
  // the two authenticated families no longer alias. Keep refusing legacy artifacts that lack that layout.
  const hasDeployDataNftSlots = deployAbi.blockLayout?.slots.some(
    (slot) => slot.kind === 'deployDataNft',
  ) ?? false;
  if ((deployAbi.entryAccesses?.length ?? 0) > 0
    && deployTarget.dataNftCount > 0 && !hasDeployDataNftSlots) {
    throw new Error(
      `Deploy function '${deployFunctionName}' combines a typed stateful child with vmap mapping access. `
      + 'The vmap insert tail and child data-NFT outputs currently share the first trailing slot, so this shape '
      + 'is refused until the output layout authenticates both regions (recompile with deployDataNft slots).',
    );
  }
  const childDeployers = factory.inner.artifact.childDeployers ?? {};
  const childDeployer = childDeployers[deployTarget.contractName];
  /** A child's artifact: `childArtifact` for the first `new`'s contract, `childArtifacts` by name, else the registry. */
  const artifactOf = (contractName: string): T | undefined => ((
    contractName === deployTarget.contractName || options.childArtifact?.contractName === contractName
      ? options.childArtifact : undefined)
    ?? options.childArtifacts?.[contractName]
    ?? (factory as any)._getChild(contractName)) as T | undefined;
  // A creating call through deployers resolves each child's artifact when its run creates that child.
  const childArtifact = artifactOf(deployTarget.contractName) as T;
  if (!childArtifact && childDeployer === undefined) {
    throw new Error(
      `No child artifact for deploy function '${deployFunctionName}'. Pass childArtifact or register it `
      + 'with factory.registerChild(artifact).',
    );
  }
  // B8.8: each deployer child receives the value the source sends. A `new` with no `value` sends none; one whose
  // value is a parameter of the creating function sends that argument; any other expression sends what the caller
  // says, which the creator's own run then checks against Q before anything is broadcast.
  if (childDeployer !== undefined) {
    const named = deployTarget.valueArg;
    if (named === undefined && (options.childValue ?? 0n) !== 0n) {
      throw new DeployerPrepError(
        `'${deployFunctionName}' creates '${deployTarget.contractName}' with no value, but childValue is `
        + `${options.childValue}`,
      );
    }
    if (typeof named === 'string') {
      const index = deployAbi.inputs.findIndex((input) => input.name === named);
      const argument = index >= 0 ? deployFunctionArgs[index] : undefined;
      const sent = typeof argument === 'bigint' ? argument : typeof argument === 'number' ? BigInt(argument) : undefined;
      if (sent !== undefined) {
        if (options.childValue !== undefined && options.childValue !== sent) {
          throw new DeployerPrepError(
            `childValue is ${options.childValue}, but '${deployFunctionName}' sends '${named}', which is ${sent}`,
          );
        }
        options = { ...options, childValue: sent };
      }
    }
  }
  // `constructorInputs` are a stateful contract's immutable contract parameters; the runtime
  // constructor's arguments are the `__construct` entry's inputs. Only the latter are `new C(...)`'s
  // parentheses and the child's constructor rows.
  const bakedConstructorArgumentCount = childArtifact?.constructorInputs.length ?? 0;
  // A bound child takes its creator's own pool binding last, as the creator's covenant builds the child's lock.
  const creatorBinding = (): Uint8Array => {
    const pool = factory.inner.oraclePool ?? options.childOraclePool;
    if (pool === undefined) {
      throw new Error(`'${deployTarget.contractName}' takes the oracle pool binding, which '${factory.name}' lacks`);
    }
    return oraclePoolBinding(hexToBin(pool));
  };
  let childConstructorArgs = options.childConstructorArgs;
  const deployConstructorArgs = deployTarget?.constructorArgs;
  if (!childConstructorArgs && deployConstructorArgs !== undefined
    && deployConstructorArgs.every((name) => name !== null)) {
    const derived = deployConstructorArgs.map((name) => {
      if (name === ORACLE_POOL_PARAMETER) return creatorBinding();
      const idx = deployAbi.inputs.findIndex((inp) => inp.name === name);
      return idx >= 0 ? deployFunctionArgs[idx] : undefined;
    });
    if (derived.every((v) => v !== undefined)) childConstructorArgs = derived as ConstructorArgument[];
  }
  if (childConstructorArgs === undefined && bakedConstructorArgumentCount === 0
    && (deployConstructorArgs?.length ?? 0) === 0) {
    // A child with neither contract parameters nor runtime constructor arguments takes an empty list.
    childConstructorArgs = [];
  }
  // A child created through its deployer takes its arguments from the creator's run (A14 item 4).
  if (!childConstructorArgs && childDeployer === undefined) {
    throw new Error(
      `Cannot derive constructor args for 'new ${deployTarget?.contractName ?? '?'}(...)' in `
      + `'${deployFunctionName}'. Pass childConstructorArgs (the new-C(...) args are not all plain parameters).`,
    );
  }
  if (childConstructorArgs !== undefined && childArtifact !== undefined && takesOraclePool(childArtifact)
    && childConstructorArgs.length === bakedConstructorArgumentCount - 1) {
    childConstructorArgs = [...childConstructorArgs, creatorBinding()];
  }
  // The Contract is built from the child's *contract* parameters (`new C{args:(…)}`, or the compatibility form
  // `new C(…)` that fills them). A creator that forwards them records their sources in `deployTarget.contractArgs`;
  // the parentheses' arguments (`childConstructorArgs`) are the runtime constructor's. A caller that predates the
  // split passes the contract parameters through `childConstructorArgs`, so fill from it when the source list is
  // absent or incomplete.
  const derivedContractArgs = (deployTarget?.contractArgs ?? []).map((name) => {
    if (name === null || name === undefined) return undefined;
    if (name === ORACLE_POOL_PARAMETER) return creatorBinding();
    const idx = deployAbi.inputs.findIndex((inp) => inp.name === name);
    return idx >= 0 ? deployFunctionArgs[idx] : undefined;
  });
  const bakedChildConstructorArgs = Array.from({ length: bakedConstructorArgumentCount }, (_, index) => (
    derivedContractArgs[index] !== undefined ? derivedContractArgs[index] : childConstructorArgs?.[index]
  )).filter((value) => value !== undefined) as ConstructorArgument[];
  // create2 salt: build the child with the salt the deploy covenant pins (composed with the self-pin).
  // Resolve from an explicit childSalt, else the recorded `new C{salt}()` mapping (a forwarded deploy param
  // or a hex literal). A computed salt with no explicit childSalt is an error (the address can't be rebuilt).
  let childSalt = options.childSalt;
  if (!childSalt && deployTarget?.salt) {
    const s = deployTarget.salt;
    if ('param' in s) {
      const idx = deployAbi.inputs.findIndex((inp) => inp.name === s.param);
      const arg = idx >= 0 ? deployFunctionArgs[idx] : undefined;
      if (arg instanceof Uint8Array) childSalt = arg;
      else if (typeof arg === 'string' && /^(?:0x)?[0-9a-f]+$/i.test(arg)) {
        childSalt = hexToBin(arg.replace(/^0x/i, ''));
      }
    } else if ('literal' in s) {
      childSalt = hexToBin(s.literal);
    } else if (s.computed) {
      const toLockingBytecode = (value: unknown): Uint8Array | undefined => {
        if (value instanceof Uint8Array) return value;
        if (typeof value === 'string' && value.includes(':')) return addressToLockScript(value);
        if (typeof value === 'string' && /^(?:0x)?[0-9a-f]+$/i.test(value)) {
          return hexToBin(value.replace(/^0x/i, ''));
        }
        return undefined;
      };
      // Uniswap-style factories compute keccak256(abi.encodePacked(token0, token1)) after sorting their two
      // address arguments. Reproduce that canonical expression, by the covenant's own ordering and packing
      // rules, so callers need not redundantly pass childSalt.
      const addressArgIndices = deployAbi.inputs
        .map((input, index) => ({ input, index }))
        .filter(({ input }) => !input.name.startsWith('__internal__')
          && (input.type === 'address' || input.type.startsWith('address ')))
        .map(({ index }) => index);
      if (addressArgIndices.length >= 2) {
        const a = toLockingBytecode(deployFunctionArgs[addressArgIndices[0]]);
        const b = toLockingBytecode(deployFunctionArgs[addressArgIndices[1]]);
        if (a && b) {
          // The source-level address comparison sorts the original BCH values by the covenant's rules
          // (`sortAddressPair`). abi.encodePacked then packs each address the way the source's own
          // `addressForm` decides: its 20-byte identity under 'hash', its full locking bytecode under
          // 'bytecode'. Keep the CREATE2 prediction identical to the covenant's own hash.
          const packed = sortedAddressPairPacked(
            a, b, artifactAddressForm(factory.inner.artifact) === 'hash',
          );
          if (!packed) {
            throw new Error('Computed CREATE2 salt needs canonical address arguments for Solidity ABI packing.');
          }
          childSalt = keccak_256(packed);
        }
      }
      if (!childSalt) {
        throw new Error(
          `'new ${deployTarget.contractName}{salt}()' in '${deployFunctionName}' uses a computed salt; pass `
          + 'childSalt explicitly so the SDK can build the child address.',
        );
      }
    }
  }
  const funder = options.funder ?? (factory as any).deployDefaults.funder;
  if (!funder) {
    throw new Error('No funder for deployFrom. Pass funder or set factory.setDeployDefaults({ funder }).');
  }
  const changeAddress = options.changeAddress ?? (factory as any).deployDefaults.changeAddress;

  // Validate child artifact is stateful
  if (childDeployer === undefined && !childArtifact.stateLayout) {
    throw new Error(
      `Child contract '${childArtifact.contractName}' is not a stateful contract.`,
    );
  }

  // A deployer child is born from a one-shot deployer coin (A14). The creating call spends the prep's deployer coin
  // at the creator's `deploy` slot and the author coin among the wallet's inputs, so tx.origin is the deploying
  // wallet. Which children the call makes, of which contracts, in which order and with which arguments is what the
  // creator's run does (A14 item 4): the creation is built from a plan of them, which the creator's run checks below.
  const prepFunding = options.prepFunding?.fundingUtxos
    ?? options.fundingUtxos ?? (options.fundingUtxo === undefined ? [] : [options.fundingUtxo]);
  const creatorLock = hexToBin(factory.inner.lockingBytecode);
  // The creator's deploy slots in site order: where each site's genesis group starts, and the input it binds (A6).
  const outputOnlyKinds = new Set(['transfer', 'tcTransfer', 'event', 'eventChunk', 'returnEvent', 'deployDataNft']);
  const layoutSlots = deployAbi.blockLayout?.slots ?? [];
  const deploySites = layoutSlots.filter((slot) => slot.kind === 'deploy')
    .sort((left, right) => (left.slotIndex ?? 0) - (right.slotIndex ?? 0))
    .map((slot) => ({
      offset: slot.offset,
      inputIndex: slot.offset
        - layoutSlots.filter((other) => outputOnlyKinds.has(other.kind) && other.offset < slot.offset).length,
      target: deployAbi.deployTargets?.[slot.slotIndex ?? 0] ?? deployTarget,
    }));
  type CreationChild = {
    contractName: string;
    /** Its site, and which run of that site it is when the site is in a loop. */
    site: number;
    iteration: number;
    artifact: T;
    deployer: DeployerAbi;
    constructorCount: number;
    readsSender: boolean;
    /** Q ‖ A in its unlocking; the settling run of the creator replaces it with the bytes the creator binds. */
    binding: { bound?: Uint8Array };
    /** Whether a run of the creator showed that Q ‖ A, rather than the values the call was given. */
    boundByRun: boolean;
    /** `__internal__budgetPad` of its unlocking, sized from its run when its constructor needs the budget. */
    budgetPad: Uint8Array;
    /**
     * A7: its callee list and call witnesses, unbound placeholders until its callee blocks are placed. The creator
     * reads `create`'s unlocking from byte 6 + 2s, so the list's values do not move what it binds (A6).
     */
    calls: { callees: Array<number | undefined>; synthetic: Record<string, bigint | Uint8Array> };
    /** A4.4: where its shared side-car group starts, once placed after the creator's layout. */
    sidecarBase?: number;
    value: bigint;
    contractArgs: ConstructorArgument[];
    prep: DeployerPrep;
    contract: Contract;
    unlocker: Unlocker;
  };
  let creation: {
    children: CreationChild[];
    /** The wallet's coins the creation spends besides the deployer coins: the author coins, or with no child the funding. */
    walletCoins: Array<{ utxo: Utxo; unlocker: Unlocker }>;
    /** A6 rule 2: the X (VM order) of every child that reads `msg.sender`, in run order. */
    createdChildren: Uint8Array;
  } | undefined;
  if (childDeployer !== undefined) {
    // Preps the caller built already name the children's categories and carry their own funding.
    if (prepFunding.length === 0 && options.deployerPreps === undefined) {
      throw new DeployerPrepError('A deployer creating call needs prepFunding (or fundingUtxo) for its preps');
    }
    if (deploySites.length === 0) {
      throw new DeployerPathError(`'${deployFunctionName}' creates through a deployer but lays out no deploy slot`);
    }
    const changeLock = changeAddress === undefined
      ? funder.generateLockingBytecode()
      : addressToLockScript(changeAddress);
    const authorSigner = options.prepFunding?.authorSigner ?? funder;
    const authorLock = options.prepFunding?.authorLockingBytecode ?? funder.generateLockingBytecode();
    // A provider may hand the coin without its locking bytecode; the prep builder proves it against the author's
    // own P2PKH lock.
    const prepCoins = prepFunding.map((coin) => (coin.lockingBytecode === undefined
      ? { ...coin, lockingBytecode: authorLock } : coin));
    // What an earlier run of the creator showed, else one child per site, a loop's site as many times as
    // `deployments`, the preps or the funding coins say. The run below corrects either.
    const planned: PlannedChild[] = plan?.children ?? (options.deployerPreps !== undefined
      ? options.deployerPreps.map((prep) => ({ contractName: prep.contractName }))
      : (() => {
        const named = Math.max(0, ...(options.childContainers ?? []).map((entry) => entry.deployment + 1));
        const funded = options.fundingUtxos !== undefined && options.fundingUtxos.length > 1
          ? options.fundingUtxos.length : 0;
        const hint = options.deployments ?? (Math.max(named, funded) > 1 ? Math.max(named, funded) : undefined);
        if (deploySites.length > 1) {
          return deploySites.slice(0, hint ?? deploySites.length)
            .map((site) => ({ contractName: site.target.contractName }));
        }
        return Array.from({ length: hint ?? 1 }, () => ({ contractName: deploySites[0]!.target.contractName }));
      })());
    const argumentOf = (name: string | null | undefined): FunctionArgument | undefined => {
      if (name === null || name === undefined) return undefined;
      if (name === ORACLE_POOL_PARAMETER) return creatorBinding();
      const index = deployAbi.inputs.findIndex((input) => input.name === name);
      return index < 0 ? undefined : deployFunctionArgs[index] as FunctionArgument;
    };
    const creatorCategory = Uint8Array.from(hexToBin(factory.categoryId)).reverse();
    const resolved = planned.map((child, k) => {
      // A loop's site binds base + i at its i-th run; any other site binds its own slot (A6, Indices).
      let site = 0;
      let iteration = 0;
      if (deploySites.length === 1) {
        iteration = child.inputIndex === undefined ? k : child.inputIndex - deploySites[0]!.inputIndex;
      } else if (child.inputIndex === undefined) {
        site = k;
      } else {
        site = deploySites.findIndex((candidate) => candidate.inputIndex === child.inputIndex);
      }
      if (site < 0 || site >= deploySites.length || iteration < 0) {
        throw new DeployerPrepError(
          `Deployment ${k} of '${deployFunctionName}' binds input ${child.inputIndex}, which is no deploy slot of it`,
        );
      }
      const artifact = artifactOf(child.contractName);
      if (!artifact) {
        throw new Error(
          `No child artifact for '${child.contractName}', which '${deployFunctionName}' creates. Pass childArtifacts `
          + 'or register it with factory.registerChild(artifact).',
        );
      }
      if (!artifact.stateLayout) {
        throw new Error(`Child contract '${artifact.contractName}' is not a stateful contract.`);
      }
      const deployer = childDeployers[child.contractName];
      if (deployer === undefined) {
        throw new DeployerPathError(`'${factory.name}' has no deployer for '${child.contractName}'`);
      }
      // The visible inputs only: a constructor that reads `msg.sender` also takes the hidden sender category, which is
      // not one of `new C(...)`'s arguments and has no place in Q.
      const constructorCount = artifact.abi.find((entry) => entry.name === '__construct')?.inputs
        .filter((input) => !input.name.startsWith('__internal__')).length ?? 0;
      const visible = deployer.abi.find((entry) => entry.name === 'create')?.inputs
        .filter((input) => !input.name.startsWith('__internal__')) ?? [];
      const contractTypes = visible.slice(0, visible.length - constructorCount).map((input) => input.type);
      // Before a run has shown Q ‖ A: the values a site's `new` forwards from the creating function's parameters.
      const target = deploySites[site]!.target;
      const sameSite = target.contractName === child.contractName;
      const first = child.contractName === deployTarget.contractName;
      const contractGuess = contractTypes.map((_, index) => (sameSite ? argumentOf(target.contractArgs?.[index]) : undefined)
        ?? (first ? childConstructorArgs?.[index] as FunctionArgument | undefined : undefined));
      const constructorGuess = Array.from({ length: constructorCount }, (_, index) => (
        sameSite ? argumentOf(target.constructorArgs?.[index]) : undefined)
        ?? (first ? childConstructorArgs?.[index] as FunctionArgument | undefined : undefined));
      const valueArgument = sameSite && typeof target.valueArg === 'string' ? argumentOf(target.valueArg) : undefined;
      const valueGuess = !sameSite ? undefined
        : target.valueArg === undefined ? 0n
          : typeof valueArgument === 'bigint' ? valueArgument
            : typeof valueArgument === 'number' ? BigInt(valueArgument)
              : first ? options.childValue : undefined;
      let decoded = child.bound === undefined
        ? undefined : decodeDeployBinding(child.bound, deployer, constructorCount, artifact.structs);
      let bound = child.bound;
      if (bound === undefined && valueGuess !== undefined && contractGuess.every((value) => value !== undefined)
        && constructorGuess.every((value) => value !== undefined)) {
        try {
          const guess = encodeDeployBinding({
            senderCategory: creatorCategory, value: valueGuess,
            constructorArgs: constructorGuess as StateValue[], contractArgs: contractGuess as StateValue[],
          }, deployer, constructorCount, artifact.structs);
          decoded = decodeDeployBinding(guess, deployer, constructorCount, artifact.structs);
          bound = guess;
        } catch {
          // Not a value the site could bind: the run below shows the bytes.
        }
      }
      return {
        contractName: child.contractName, site, iteration, artifact, deployer, constructorCount,
        readsSender: deployer.constructorReadsSender === true,
        binding: { bound },
        boundByRun: child.bound !== undefined,
        budgetPad: new Uint8Array(),
        calls: {
          callees: Array.from({ length: deployer.callSlots }, (): number | undefined => undefined),
          synthetic: unboundCallWitnesses(deployer),
        },
        value: decoded?.value ?? valueGuess ?? 0n,
        contractArgs: (decoded?.contractArgs ?? contractGuess.map((value, index) => value
          ?? getDefaultStateValue(contractTypes[index]!, artifact.structs))) as ConstructorArgument[],
      };
    });
    if (options.deployerPreps !== undefined && (options.deployerPreps.length !== resolved.length
      || options.deployerPreps.some((prep, k) => prep.contractName !== resolved[k]!.contractName))) {
      throw new DeployerPrepError(
        `This call creates ${resolved.length} child${resolved.length === 1 ? '' : 'ren'} `
        + `(${resolved.map((child) => child.contractName).join(', ')}), but deployerPreps holds `
        + `${options.deployerPreps.length} (${options.deployerPreps.map((prep) => prep.contractName).join(', ')})`,
      );
    }
    const built = options.deployerPreps !== undefined
      ? { preps: options.deployerPreps }
      : resolved.length === 0 ? { preps: [] as DeployerPrep[] }
        : await buildDeployerPreps({
          children: resolved.map((child) => ({
            contractName: child.contractName,
            deployer: child.deployer,
            // The author coin pays the creation's outputs and fee; the deployer coin is only V_DEPLOY.
            authorValue: prepFunding[0].satoshis / BigInt(resolved.length + 1),
          })),
          fundingUtxos: prepCoins,
          authorSigner,
          authorLockingBytecode: authorLock,
          changeLockingBytecode: changeLock,
          provider,
          allowAnyAuthorLock: true,
        });
    // Nothing is broadcast yet: the chain goes out just before the creation, once the creation passes the VM.
    if (options.deployerPreps === undefined) pending.preps = built.preps;
    const addressType = options.addressType ?? factory.inner.addressType;
    const children: CreationChild[] = resolved.map((child, k) => {
      const prep = built.preps[k]!;
      const artifact = {
        ...child.artifact, bytecode: scriptToAsm(bytecodeToScript(hexToBin(child.deployer.code))),
      } as T;
      return {
        ...child,
        prep,
        contract: new Contract(artifact, child.contractArgs as any, {
          provider, addressType, category: hexToBin(prep.category),
        }),
        unlocker: undefined as unknown as Unlocker,
      };
    });
    // A4.3 step 8 and A6 rule 2: a child whose constructor reads `msg.sender` proves its creator through the
    // creator's created-children list, the X (VM order) of every such child the call creates, in run order. The
    // creator's unlocking carries sha256 of the list, and each such child's `create` the list and its own position.
    const senders = children.filter((child) => child.readsSender);
    const createdChildren = Uint8Array.from(senders.flatMap((child) => [...hexToBin(child.prep.category).reverse()]));
    for (const child of children) {
      child.unlocker = {
        generateLockingBytecode: () => hexToBin(child.deployer.lockingBytecode),
        generateUnlockingBytecode: ({ transaction, sourceOutputs }) => {
          const category = child.prep.category.toLowerCase();
          // OUTBASE is the output holding the child's minting NFT; the author coin is (X, 1) wherever it sits.
          const outbase = transaction.outputs.findIndex((output) => output.token !== undefined
            && binToHex(output.token.category) === category && output.token.nft?.capability === 'minting');
          const authorIndex = transaction.inputs.findIndex((input) => input.outpointIndex === 1
            && binToHex(input.outpointTransactionHash) === category);
          if (outbase < 0 || authorIndex < 0) {
            throw new DeployerPrepError(`The creation holds no master output or no author coin of category ${category}`);
          }
          // The creator input is the one spending the creator's master, wherever the builder placed it.
          const creatorIndex = child.readsSender
            ? sourceOutputs.findIndex((output) => binsAreEqual(output.lockingBytecode, creatorLock)) : -1;
          if (child.readsSender && creatorIndex < 0) {
            throw new DeployerPrepError('The creating transaction does not spend the creator\'s master');
          }
          return buildDeployerUnlocking({
            deployer: child.deployer,
            ...(child.readsSender
              ? { creator: { inputIndex: creatorIndex, list: createdChildren, listPos: senders.indexOf(child) } } : {}),
            callees: child.calls.callees,
            boundBytes: child.binding.bound ?? new Uint8Array(),
            authorIndex,
            identity: false,
            budgetPad: child.budgetPad,
            synthetic: {
              __internal__genesisOutputBase: BigInt(outbase),
              __internal__genesisSidecarBase: BigInt(child.sidecarBase ?? outbase + child.deployer.genesisOutputs),
              // A genesis block read comes from the locktime; the parameter stays for the arm's shape (A5).
              ...(child.deployer.abi.find((entry) => entry.name === 'create')?.inputs
                .some((input) => input.name === '__internal__blockOracleInputIndex')
                ? { __internal__blockOracleInputIndex: -1n } : {}),
              ...child.calls.synthetic,
            },
            // A placeholder callee serves the creator's runs; the creation is checked in the VM before it is sent.
            forBroadcast: child.calls.callees.every((callee) => callee !== undefined),
          });
        },
      };
    }
    // With no child the funding pays the creation itself; it is the wallet's, so it carries no token.
    for (const coin of children.length === 0 ? prepCoins : []) {
      if (coin.token !== undefined) throw new DeployerPrepError(`Funding coin ${coin.txid}:${coin.vout} carries a token`);
    }
    creation = {
      children,
      walletCoins: children.length > 0
        ? children.map((child) => ({ utxo: child.prep.authorCoin, unlocker: authorSigner }))
        : prepCoins.map((utxo) => ({ utxo, unlocker: authorSigner })),
      createdChildren,
    };
  }

  // B8.9: through deployers the trailing region starts at the block's trailing base, after every child's genesis group
  // when a loop of `new` ran: (runs − 1) × w_out(C) further. The deploy-region inputs pad up to it exactly (below).
  const loopShift = creation !== undefined && deploySites.length === 1
    ? Math.max(creation.children.length - 1, 0) * (childDeployers[deploySites[0]!.target.contractName]?.genesisOutputs ?? 1)
    : 0;
  const trailingInputBase = (deployAbi.blockLayout?.trailingBase ?? deployAbi.blockLayout?.blockSize ?? 1) + loopShift;

  // Funding UTXOs: one per child (a loop `for (i<n) new C()` mints N children, and a balanced contract block
  // needs N funding inputs). fundingUtxos supersedes the single fundingUtxo; default = [fundingUtxo] (1 child).
  // Through deployers the coins are the deployer coins of the children the plan holds, possibly none.
  const fundingUtxos = creation === undefined
    ? options.fundingUtxos ?? [options.fundingUtxo]
    : creation.children.map((child) => child.prep.deployerCoin);
  const childCount = fundingUtxos.length;
  if (childCount === 0 && creation === undefined) {
    throw new Error('deployFrom needs at least one funding UTXO (fundingUtxo or a non-empty fundingUtxos).');
  }
  if (creation === undefined && options.deployments !== undefined && options.deployments !== childCount) {
    throw new DeployerPrepError(
      `This call creates ${childCount} child${childCount === 1 ? '' : 'ren'}, but deployments is `
      + `${options.deployments}; pass one funding coin per child and the matching count`,
    );
  }
  for (const fu of fundingUtxos) {
    if (fu.vout !== 0) {
      throw new Error(
        'Each funding UTXO must be at vout 0 to create a valid token category. '
        + `Got vout ${fu.vout}.`,
      );
    }
  }
  // Child i's category is fundingUtxos[i].txid, so each coin is proven at the funder's own lock before anything is
  // signed: a coin a provider lists there but that sits at another lock would hand the category to its owner.
  const funderLock: Uint8Array = funder.generateLockingBytecode();
  if (creation === undefined) {
    for (const fu of fundingUtxos) {
      const coinRefusal = await ownCoinRefusal(provider, fu, funderLock, { role: 'funder', tokenFree: true });
      if (coinRefusal !== undefined) throw new Error(coinRefusal);
    }
  }

  // child i's category = fundingUtxos[i].txid. The first child's category doubles as the returned handle's.
  const childCategoryId = creation === undefined ? fundingUtxos[0].txid : creation.children[0]?.prep.category;
  const addressType = options.addressType ?? factory.inner.addressType;
  // Large factory redeems make deploy transactions substantially larger than ordinary calls. Size the default
  // conservatively from the authenticated layout; callers can still provide an exact fee explicitly.
  const fee = options.fee ?? (() => {
    const slots = deployAbi.blockLayout?.blockSize ?? 4;
    const childNfts = (deployTarget.dataNftCount ?? 1) + (deployTarget.entryNftCount ?? 0);
    const entryCount = deployAbi.entryAccesses?.length ?? 0;
    return BigInt(Math.max(
      5_000,
      factory.inner.bytesize + 12_000 + slots * 800 + childNfts * 1_500 + entryCount * 2_000,
    ));
  })();
  const masterAmount = options.masterAmount ?? 1200n;
  const dataNftAmount = options.dataNftAmount ?? 1200n;

  // Get factory's on-chain state
  const onChainState = await factory.getFullState();
  if (!onChainState.masterUtxo) {
    throw new Error(
      `Master UTXO not found for factory '${factory.name}' `
      + `(category ${factory.categoryId}). Ensure the factory is deployed.`,
    );
  }

  const masterUtxo = onChainState.masterUtxo;

  // Self-pin the child by category, identical to the compiler's `new ContractName(...)` covenant and to an
  // SDK-direct deploy (Contract.ts bakes <cat||0x02> OP_INPUTINDEX OP_UTXOTOKENCATEGORY OP_EQUALVERIFY). A
  // create2 salt (if any) composes outside the self-pin (<salt> OP_DROP | <self-pin> | base), matching the
  // compiler. This address is what the deploy covenant verifies in the genesis outputs.
  // One child Contract per funding UTXO - the self-pinned address is category-dependent, so each of the N
  // children (loop deploy) has a distinct address derived from its own category. childContracts[0] is the
  // returned handle. childConstructorArgs are shared (a loop mints the same child type each iteration).
  let effectiveChildArtifact = childArtifact;
  if (creation !== undefined) {
    // Each child's Contract was built with its own artifact and arguments when its prep was.
  } else if (deployTarget.creationBytecode) {
    effectiveChildArtifact = {
      ...childArtifact,
      bytecode: scriptToAsm(bytecodeToScript(hexToBin(deployTarget.creationBytecode))),
    } as T;
  } else if (deployTarget.salt) {
    console.warn(
      `deployFrom('${deployFunctionName}'): salted deploy target has no creationBytecode; `
      + 'recompile the factory so the SDK can derive the covenant-authenticated child address.',
    );
  }
  const legacyChild = (fu: Utxo): Contract<T> => new Contract(effectiveChildArtifact, bakedChildConstructorArgs as any, {
    provider,
    addressType,
    category: hexToBin(fu.txid),
    ...(childSalt && { salt: childSalt }),
  });
  const childContracts = creation !== undefined
    ? creation.children.map((child) => child.contract as unknown as ReturnType<typeof legacyChild>)
    : fundingUtxos.map(legacyChild);
  // Each child's whole redeem script, the lock its creation mints the master at, before anything is broadcast. A
  // child's preps, when it is created through its deployer, are built and not yet sent.
  for (const child of childContracts) assertSpendableContract(child);
  // Publish created children so an off-chain CREATE2 prediction can resolve the exact address this transaction
  // will produce (the address commits to the funding coin's category, so it is not a pure function of salt). A child
  // created through its deployer is published once its creation is sent.
  for (const [index, child] of (creation === undefined ? childContracts : []).entries()) {
    registerDeployment(provider, {
      contractName: childArtifact.contractName,
      address: child.address,
      lockingBytecode: child.lockingBytecode,
      contract: child,
      parentAddress: factory.target,
      parentLockingBytecode: factory.inner.lockingBytecode,
      salt: childSalt ? binToHex(childSalt) : undefined,
      category: fundingUtxos[index]?.txid,
    });
  }
  const childContractUnsalted = childContracts[0];
  if ((globalThis as any).process?.env?.DEBUG_DEPLOY_FROM && childContractUnsalted !== undefined) {
    console.error('DEPLOY_FROM', JSON.stringify({
      childSalt: childSalt ? binToHex(childSalt) : undefined,
      category: fundingUtxos[0].txid,
      address: childContractUnsalted.address,
      bytecodeLen: childContractUnsalted.bytecode.length / 2,
    }));
  }

  // Through deployers each child has its own artifact; the first `new`'s artifact may be absent when no run makes it.
  const childLayout = childArtifact?.stateLayout as NonNullable<T['stateLayout']>;

  if (deployTarget?.childLayoutDigest
    && childStateLayoutDigest(childLayout) !== deployTarget.childLayoutDigest.toLowerCase()) {
    throw new Error(
      `Child artifact '${childArtifact.contractName}' does not match the compiler-authenticated deployment state layout.`,
    );
  }
  // A child created through its deployer takes its genesis layout from its own `create` (A4.4), not from these entries.
  if (childDeployer === undefined && (deployTarget.entryNftCount ?? 0) !== (deployTarget.genesisEntries?.length ?? 0)) {
    throw new Error(
      `Deploy target '${deployTarget.contractName}' has inconsistent constructor-entry geometry.`,
    );
  }
  if (deployTarget?.genesisState) {
    try {
      validateChildDeploymentGenesisState(childLayout, deployTarget.genesisState);
    } catch (error) {
      throw new Error(
        `Invalid constructor genesis for child '${childArtifact.contractName}': `
        + `${error instanceof Error ? error.message : String(error)}`,
      );
    }
    for (const field of deployTarget.genesisState.fields) {
      if (Object.prototype.hasOwnProperty.call(options.childInitialState ?? {}, field.name)) {
        throw new Error(
          `childInitialState cannot override authenticated constructor-genesis field '${field.name}'`,
        );
      }
    }
  }

  // Compute child's initial state commitments
  const childSeedState: Record<string, StateValueType> = { ...(options.childInitialState ?? {}) };
  const needsGenesisRecipeEvaluator = !!deployTarget.genesisState || (deployTarget.genesisEntries?.length ?? 0) > 0
    || (deployAbi.transfers?.length ?? 0) > 0;
  const genesisRecipeModule = needsGenesisRecipeEvaluator
    ? await import('./child-deployment-recipes.js') : undefined;
  const evaluateGenesisRecipe = genesisRecipeModule?.evaluateChildDeploymentRecipe;
  const genesisInputTypes = deployAbi.inputs
    .filter((input) => !input.name.startsWith('__internal__'))
    .map((input) => input.type);
  // A child constructor/initializer observes the deploying contract as `msg.sender`; the compiler-folded recipe
  // names the deploying input's locking bytecode, so materialize the same value identity here.
  const callerValueIdentity = hexToBin(factory.inner.lockingBytecode);
  if (deployTarget?.genesisState) {
    for (const field of deployTarget.genesisState.fields) {
      childSeedState[field.name] = evaluateGenesisRecipe!(
        field.value, deployFunctionArgs, genesisInputTypes, artifactUsesSolidityAbi(factory.inner.artifact),
        undefined, callerValueIdentity,
      ) as StateValueType;
    }
  }
  const childGenesisEntries = (deployTarget.genesisEntries ?? []).map((entry) => {
    const collection = childLayout.collections?.find((candidate) => candidate.name === entry.collection
      && candidate.signature === entry.collectionSignature);
    if (!collection || !['array', 'mapping'].includes(collection.kind)
      || (collection.kind === 'array' && collection.bound === undefined)
      || (!entry.head && (collection.keyType !== entry.keyType
        || collection.valueType !== entry.valueType))) {
      throw new Error(
        `Constructor entry '${entry.collection}' does not match child '${childArtifact.contractName}' layout.`,
      );
    }
    if (entry.head === true) {
      return { collectionSignature: entry.collectionSignature, commitment: binToHex(headSentinelCommitment()) };
    }
    const key = evaluateGenesisRecipe!(
      entry.key, deployFunctionArgs, genesisInputTypes, artifactUsesSolidityAbi(factory.inner.artifact),
      undefined, callerValueIdentity,
    );
    const value = evaluateGenesisRecipe!(
      entry.value, deployFunctionArgs, genesisInputTypes, artifactUsesSolidityAbi(factory.inner.artifact),
      undefined, callerValueIdentity,
    );
    if (collection.kind === 'array'
      && (typeof key !== 'bigint' || key < 0n || key >= BigInt(collection.bound!))) {
      throw new Error(`Constructor entry '${entry.collection}' has an invalid fixed-array key.`);
    }
    const solidityAbi = artifactUsesSolidityAbi(factory.inner.artifact);
    const materializedKey = genesisRecipeModule!.materializeChildDeploymentEntryScalar(
      key, entry.keyType, solidityAbi,
    );
    const materializedValue = genesisRecipeModule!.materializeChildDeploymentEntryValue(
      value, entry.valueType, solidityAbi, childLayout.structs,
    );
    return {
      collectionSignature: entry.collectionSignature,
      commitment: buildEntryCommitment(
        materializedKey, entry.keyType, materializedValue, entry.valueType, childLayout.structs,
        provider.consensusLimits?.maximumNftCommitmentBytes,
      ),
    };
  });
  const legacyChildGenesisHeuristics = !deployTarget?.childLayoutDigest && !deployTarget?.genesisState;
  if (legacyChildGenesisHeuristics && childLayout?.variables?.some((variable) => (
    variable.name === 'factory' && variable.type.startsWith('address')
  )) && childSeedState.factory === undefined) {
    childSeedState.factory = addressToLockScript(factory.inner.address);
  }
  if (legacyChildGenesisHeuristics && childLayout?.variables?.some((variable) => variable.name === 'unlocked')
    && childSeedState.unlocked === undefined) {
    childSeedState.unlocked = 1n;
  }
  let childCommitments = childLayout === undefined ? [] : buildInitialStateCommitments(
    childLayout, childSeedState, provider.consensusLimits?.maximumNftCommitmentBytes,
  );
  // One child's records per child: a constructor that stores `this.category` (or anything else of its own
  // category) gives each child of a loop records of its own.
  const childCommitmentsByChild: string[][] = [];
  // A child created through its deployer gets its records from its own `create` run (A14 item 4 step 4), completed
  // on the finished creation below; until then each child's records are its contract's default state.
  for (const [k, child] of (creation?.children ?? []).entries()) {
    childCommitmentsByChild[k] = child.contractName === deployTarget.contractName ? childCommitments
      : buildInitialStateCommitments(child.artifact.stateLayout!, {}, provider.consensusLimits?.maximumNftCommitmentBytes);
  }
  const childCommitmentsOf = (k: number): string[] => childCommitmentsByChild[k] ?? childCommitments;

  // Determine which data NFTs the factory's deploy function needs
  const requiredNftIndices = deployAbi.requiredNftIndices
    ?? Array.from({ length: factory.inner.stateLayout!.dataNftCount }, (_, i) => i);
  const filteredDataNftUtxos = requiredNftIndices.map((idx) => onChainState.dataNftUtxos[idx]);
  if (filteredDataNftUtxos.some((u) => u === undefined)) {
    throw new Error(`Missing required data NFTs on-chain. Expected indices: [${requiredNftIndices.join(', ')}], but only ${onChainState.dataNftUtxos.length} data NFTs found.`);
  }

  // Build function args with synthetic parameters
  let finalArgs = [...deployFunctionArgs];

  // Append _msgSenderCategory if function uses msg.sender
  if (deployAbi.usesMsgSender) {
    finalArgs = [...finalArgs, new Uint8Array(32)]; // zero bytes = direct call
  }

  // A value-returning deploy function takes a hidden __internal__returnOutputIdx pointing at its return-event
  // (B8) output slot. On a plain send a returning function's return-event is the LAST block slot, so idx=-1
  // (no output) is harmless; but a deploy function's deploy slot sits AFTER the return-event slot, so the
  // return-event output MUST be materialized to keep the deploy genesis at its fixed block-layout offset.
  // Appended AFTER vmap batch witnesses below so finalArgs match ABI input order
  // (…, vmapBatch*, trailingCount, returnOutputIdx). Inserting earlier mis-encodes the bigint as a bytes32 slot.
  const returnEventSlot = deployAbi.blockLayout?.slots.find((s) => s.kind === 'returnEvent');
  const deployReturns = !!returnEventSlot && (deployAbi.outputs?.length ?? 0) > 0;

  // Resolve vmap mapping writes against an authenticated target/predecessor proof node.
  // Supports multi-key nested mappings (createPair getPair[token0][token1]) and batch inserts that share a
  // predecessor: planBatchUpsert rebuilds links over the original list once, fixed slots carry NEW targets,
  // and re-pointed predecessors trail after the full fixed block (deployDataNft-aware).
  const factoryLayout = factory.inner.stateLayout!;
  const entryAccesses = deployAbi.entryAccesses ?? [];
  const entryInfos: Array<{
    collection: string; keyValue: bigint | boolean | Uint8Array; encodedKeys: Uint8Array[];
    slot: Uint8Array; proofUtxo: Utxo;
    present: boolean; fixedCommitment: string; trailingCommitment?: string;
  }> = [];
  // Batch mode trails P' nodes once per collection (not once per logical write), so two inserts that share
  // HEAD only mint one predecessor rewrite.
  const batchTrailingCommitments: Array<{ collection: string; commitment: string }> = [];
  // Entries of different collections share the category and are indistinguishable by key; with >1 collection,
  // match within each collection's own entries (fetched by its entry address) rather than the mixed set.
  const deployMultiColl = (factoryLayout.collections?.length ?? 0) > 1;
  const deployCollCache = new Map<string, Utxo[]>();
  const deployCollectionEntries = async (sig: string): Promise<Utxo[]> => {
    if (!deployMultiColl) return onChainState.entryNftUtxos;
    const hit = deployCollCache.get(sig);
    if (hit) return hit;
    const addr = getEntryNftAddress(factory.inner, factory.categoryId, sig);
    const fetched = (await factory.inner.provider.getUtxos(addr)).filter((u) => (
      u.token?.category === factory.categoryId && !!u.token?.nft?.commitment && u.token.nft.commitment.length > 0
    ));
    deployCollCache.set(sig, fetched);
    return fetched;
  };
  const toKeyLbc = (v: unknown): Uint8Array | undefined => {
    if (v instanceof Uint8Array) return v;
    if (typeof v === 'string' && v.includes(':')) return addressToLockScript(v);
    if (typeof v === 'string' && /^(?:0x)?[0-9a-f]+$/i.test(v)) return hexToBin(v.replace(/^0x/i, ''));
    return undefined;
  };
  // UniswapV2 createPair locals: (token0, token1) = sort(tokenA, tokenB), ordered as the covenant orders addresses.
  const sortedTokenLbcs = ((): [Uint8Array, Uint8Array] | undefined => {
    const idxs: number[] = [];
    for (let i = 0; i < deployAbi.inputs.length; i++) {
      if (deployAbi.inputs[i].name.startsWith('__internal__')) continue;
      const t = deployAbi.inputs[i].type;
      if (t === 'address' || t.startsWith('address ')) idxs.push(i);
    }
    if (idxs.length < 2) return undefined;
    const a = toKeyLbc(deployFunctionArgs[idxs[0]]);
    const b = toKeyLbc(deployFunctionArgs[idxs[1]]);
    if (!a || !b) return undefined;
    return sortAddressPair(a, b);
  })();
  const encodeDeployKey = (keyType: string, raw: unknown): Uint8Array => {
    if (keyType === 'address' || keyType.startsWith('address ')) {
      const lbc = toKeyLbc(raw);
      if (lbc) return lbc;
    }
    if (raw instanceof Uint8Array) return raw;
    if (typeof raw === 'bigint') return bigIntToVmNumber(raw);
    if (typeof raw === 'boolean') return bigIntToVmNumber(raw ? 1n : 0n);
    if (typeof raw === 'string' && /^(?:0x)?[0-9a-f]+$/i.test(raw)) {
      return hexToBin(raw.replace(/^0x/i, ''));
    }
    throw new Error(`Cannot encode deploy mapping key of type '${keyType}'.`);
  };
  const resolveAccessKeys = (
    access: (typeof entryAccesses)[number], collection: NonNullable<typeof factoryLayout.collections>[number],
  ): { keyValue: bigint | boolean | Uint8Array; encodedKeys: Uint8Array[] } => {
    const keyTypes = collection.keyTypes ?? [collection.keyType];
    const sources = access.keySources
      ?? access.keyParams.map((name) => ({ kind: 'param' as const, paramName: name }));
    const encodedKeys: Uint8Array[] = [];
    let firstKey: bigint | boolean | Uint8Array | undefined;
    for (let ki = 0; ki < Math.max(sources.length, access.keyParams.length); ki++) {
      const source = sources[ki] as {
        kind?: string; paramName?: string; expressionLabel?: string;
      } | undefined;
      const keyType = keyTypes[ki] ?? collection.keyType;
      const label = source?.expressionLabel ?? access.keyParams[ki];
      if (source?.kind === 'expression' || (label?.startsWith('id:') && source?.kind !== 'param')) {
        // createPair: id:token0 / id:token1 are locals after Uniswap sort of the two address args.
        if (label === 'id:token0' && sortedTokenLbcs) {
          encodedKeys.push(sortedTokenLbcs[0]);
          firstKey ??= sortedTokenLbcs[0];
          continue;
        }
        if (label === 'id:token1' && sortedTokenLbcs) {
          encodedKeys.push(sortedTokenLbcs[1]);
          firstKey ??= sortedTokenLbcs[1];
          continue;
        }
        const auto = evalComputedKey(
          label, keyArguments(deployFunctionArgs as FunctionArgument[], deployAbi.inputs), deployAbi.inputs,
        );
        if (auto) {
          encodedKeys.push(auto);
          firstKey ??= auto;
          continue;
        }
        const idMatch = /^id:(.+)$/.exec(label ?? '');
        if (idMatch) {
          const idx = deployAbi.inputs.findIndex((inp) => inp.name === idMatch[1]);
          if (idx >= 0) {
            const enc = encodeDeployKey(keyType, deployFunctionArgs[idx]);
            encodedKeys.push(enc);
            firstKey ??= enc;
            continue;
          }
        }
        throw new Error(
          `Cannot resolve deploy mapping key expression '${label}' for collection '${access.collection}'.`,
        );
      }
      const paramName = source?.paramName ?? access.keyParams[ki];
      const keyParamIdx = deployAbi.inputs.findIndex((inp) => inp.name === paramName);
      if (keyParamIdx < 0) {
        throw new Error(`Mapping key parameter '${paramName}' not found in '${deployFunctionName}' inputs.`);
      }
      const rawKey = deployFunctionArgs[keyParamIdx];
      const enc = encodeDeployKey(keyType, rawKey);
      encodedKeys.push(enc);
      if (firstKey === undefined) {
        firstKey = typeof rawKey === 'bigint' || typeof rawKey === 'boolean' ? rawKey
          : typeof rawKey === 'string' && /^(?:0x)?[0-9a-f]+$/i.test(rawKey)
            ? hexToBin(rawKey.replace(/^0x/i, ''))
            : enc;
      }
    }
    if (!firstKey || encodedKeys.length === 0) {
      throw new Error(`No keys resolved for mapping write on '${access.collection}'.`);
    }
    return { keyValue: firstKey, encodedKeys };
  };
  // Value tails known off-chain for deploy+vmap: create3 children[salt]=category; createPair getPair=pair LBC.
  // A creating call whose run makes no child has neither.
  const fundingCatValue = fundingUtxos[0] === undefined ? new Uint8Array() : hexToBin(fundingUtxos[0].txid).reverse();
  const pairAddressValue = childContracts[0] === undefined
    ? new Uint8Array() : addressToLockScript(childContracts[0].address);
  const predictedAddressReturn = encodeExternalReturnValues(
    [pairAddressValue], ['address'], factoryLayout.structs,
    externalResultUsesEvmWords(factory.inner.artifact, ['address']), factory.inner.artifact.enums,
  );
  // A returning direct entry carries its result inside a call record: digest(31) || form(1) || result. The
  // covenant computes the digest over the deploy call it runs, so the seeded carrier must commit to that same
  // digest rather than the bare ABI result.
  const predictedReturnCommitment = returnEventNftCommitment(
    predictedAddressReturn,
    deployAbi.callRecord === true
      ? callRecordDigest(deployAbi, deployFunctionArgs, {
        structs: factoryLayout.structs, enums: factory.inner.artifact.enums,
      })
      : undefined,
  );
  const valueTailFor = (collection: NonNullable<typeof factoryLayout.collections>[number]): Uint8Array => {
    if (collection.valueType === 'bytes32') return fundingCatValue;
    if (collection.valueType === 'address' || collection.valueType.startsWith('address ')) {
      return pairAddressValue;
    }
    return new Uint8Array();
  };

  type ResolvedAccess = {
    access: (typeof entryAccesses)[number];
    collection: NonNullable<typeof factoryLayout.collections>[number];
    keyValue: bigint | boolean | Uint8Array;
    encodedKeys: Uint8Array[];
    slot: Uint8Array;
    valueTail: Uint8Array;
  };
  const resolvedAccesses: ResolvedAccess[] = [];
  for (const access of entryAccesses) {
    const collection = factoryLayout.collections?.find((c) => c.name === access.collection);
    if (!collection) {
      throw new Error(`Unknown collection '${access.collection}' in deploy function '${deployFunctionName}'.`);
    }
    if (!collection.sorted) throw new Error(`Collection '${access.collection}' is not a vmap collection.`);
    const { keyValue, encodedKeys } = resolveAccessKeys(access, collection);
    resolvedAccesses.push({
      access, collection, keyValue, encodedKeys,
      slot: keyToSlotMulti(encodedKeys, collection),
      valueTail: valueTailFor(collection),
    });
  }

  const useBatch = (deployAbi.sortedBatchInfo?.length ?? 0) > 0;
  if (useBatch) {
    // planBatchUpsert once per collection batch so multi-key dual inserts (createPair) share a single P'.
    const plannedSlots = new Set<number>();
    for (const batch of deployAbi.sortedBatchInfo ?? []) {
      const collection = factoryLayout.collections?.find((c) => c.name === batch.collection);
      if (!collection) continue;
      const list = SortedList.fromUtxos(await deployCollectionEntries(collection.signature));
      const writes = batch.slotIndices.map((slotIndex) => {
        const r = resolvedAccesses[slotIndex];
        if (!r) throw new Error(`vmap batch slot ${slotIndex} has no resolved access.`);
        return { slot: r.slot, value: r.valueTail };
      });
      const batchPlan = list.planBatchUpsert(writes);
      const targetValues = new Set(writes.map((w) => bytesToSlotValue(w.slot).toString()));
      const predOutputs = batchPlan.outputs.filter((o) => !targetValues.has(bytesToSlotValue(o.slot).toString()));
      for (const o of predOutputs) {
        batchTrailingCommitments.push({ collection: batch.collection, commitment: binToHex(o.commitment) });
      }
      const ownerByUtxo = new Map<string, number>();
      for (const slotIndex of batch.slotIndices) {
        plannedSlots.add(slotIndex);
        const r = resolvedAccesses[slotIndex];
        const present = list.has(r.slot);
        const proof = list.find(r.slot) ?? list.predecessorOf(r.slot);
        const uid = `${proof.utxo.txid}:${proof.utxo.vout}`;
        let owner = ownerByUtxo.get(uid);
        if (owner === undefined) { owner = slotIndex; ownerByUtxo.set(uid, owner); }
        const out = batchPlan.outputs.find((o) => bytesToSlotValue(o.slot) === bytesToSlotValue(r.slot));
        if (!out) {
          throw new Error(`vmap batch '${batch.collection}' has no planned output for access ${slotIndex}.`);
        }
        // Fixed entry slot carries the TARGET (NEW/updated). Shared-predecessor aliases still get a target
        // commitment but co-spend only the owner's proof UTXO once (see entryExtraInputs dedupe below).
        entryInfos[slotIndex] = {
          collection: r.access.collection,
          keyValue: r.keyValue,
          encodedKeys: r.encodedKeys,
          slot: r.slot,
          proofUtxo: proof.utxo,
          present,
          fixedCommitment: binToHex(out.commitment),
        };
      }
    }
    // Non-batch accesses (if any remain) fall through to per-access planInsert.
    for (let i = 0; i < resolvedAccesses.length; i++) {
      if (plannedSlots.has(i) && entryInfos[i]) continue;
      const r = resolvedAccesses[i];
      const list = SortedList.fromUtxos(await deployCollectionEntries(r.collection.signature));
      if (list.has(r.slot)) {
        const target = list.find(r.slot)!;
        entryInfos[i] = {
          collection: r.access.collection, keyValue: r.keyValue, encodedKeys: r.encodedKeys, slot: r.slot,
          proofUtxo: target.utxo, present: true,
          fixedCommitment: binToHex(encodeEntryCommitment(target.slot, target.nextKey, r.valueTail)),
        };
      } else {
        const insertPlan = list.planInsert(r.slot, r.valueTail);
        entryInfos[i] = {
          collection: r.access.collection, keyValue: r.keyValue, encodedKeys: r.encodedKeys, slot: r.slot,
          proofUtxo: insertPlan.predecessor.utxo, present: false,
          fixedCommitment: binToHex(insertPlan.newNodeCommitment),
          trailingCommitment: binToHex(insertPlan.predNewCommitment),
        };
      }
    }
  } else {
    for (const r of resolvedAccesses) {
      const list = SortedList.fromUtxos(await deployCollectionEntries(r.collection.signature));
      if (list.has(r.slot)) {
        const target = list.find(r.slot)!;
        entryInfos.push({
          collection: r.access.collection, keyValue: r.keyValue, encodedKeys: r.encodedKeys, slot: r.slot,
          proofUtxo: target.utxo, present: true,
          fixedCommitment: binToHex(encodeEntryCommitment(target.slot, target.nextKey, r.valueTail)),
        });
      } else {
        const insertPlan = list.planInsert(r.slot, r.valueTail);
        // Non-batch: P' fixed, NEW trailing (legacy single-write path).
        entryInfos.push({
          collection: r.access.collection, keyValue: r.keyValue, encodedKeys: r.encodedKeys, slot: r.slot,
          proofUtxo: insertPlan.predecessor.utxo, present: false,
          fixedCommitment: binToHex(insertPlan.predNewCommitment),
          trailingCommitment: binToHex(insertPlan.newNodeCommitment),
        });
      }
    }
  }

  // Append vmap batch witnesses (slot/proof/next/predOut per write + trailing count) so the factory unlocker
  // matches a normal StatefulContract call path.
  if (useBatch) {
    const trailingBase = deployAbi.blockLayout?.trailingBase
      ?? deployAbi.blockLayout?.blockSize ?? 1;
    // The route path injects the shared trailing-width witness into the source parameters before route
    // synthesis, so it precedes the per-batch slot witnesses in the ABI. A direct artifact appends it after them.
    // Insert at the ABI position rather than assuming either order.
    const trailingCountIndex = deployAbi.inputs
      .findIndex((input) => input.name === '__internal__vmapBatchTrailingCount');
    // NEW nodes trail the full fixed block when deployDataNft slots authenticate the child data region, and every
    // child's group of a loop of `new`.
    let batchPredOutputBase = trailingBase + loopShift;
    let batchTrailingCount = 0;
    for (const batch of deployAbi.sortedBatchInfo ?? []) {
      const collection = factoryLayout.collections?.find((c) => c.name === batch.collection);
      if (!collection) continue;
      const list = SortedList.fromUtxos(await deployCollectionEntries(collection.signature));
      const writes = batch.slotIndices.map((slotIndex) => {
        const info = entryInfos[slotIndex];
        return { slot: info.slot, value: info.present ? new Uint8Array() : resolvedAccesses[slotIndex].valueTail };
      });
      const batchPlan = list.planBatchUpsert(writes.map((w, i) => ({
        slot: w.slot,
        value: resolvedAccesses[batch.slotIndices[i]].valueTail,
      })));
      const targetValues = new Set(writes.map((w) => bytesToSlotValue(w.slot).toString()));
      const predOutputs = batchPlan.outputs.filter((o) => !targetValues.has(bytesToSlotValue(o.slot).toString()));
      const linearRows = batch.linear ? batch.slotIndices.map((slotIndex) => {
        const slot = entryInfos[slotIndex].slot;
        const out = batchPlan.outputs.find((candidate) => bytesToSlotValue(candidate.slot) === bytesToSlotValue(slot));
        if (!out) throw new Error(`vmap batch '${batch.collection}' has no deploy linear row ${slotIndex}.`);
        return { slotIndex, slot, next: decodeEntryCommitment(out.commitment).nextKey };
      }).sort((a, b) => bytesToSlotValue(a.slot) < bytesToSlotValue(b.slot) ? -1 : 1) : [];
      const linearRank = new Map(linearRows.map((row, rank) => [row.slotIndex, rank]));
      const firstLinearPredSlot = new Map<string, number>();
      for (const row of linearRows) {
        const proof = list.find(row.slot) ?? list.predecessorOf(row.slot);
        const proofSlot = bytesToSlotValue(proof.slot).toString();
        if (!firstLinearPredSlot.has(proofSlot)) firstLinearPredSlot.set(proofSlot, row.slotIndex);
      }
      const ownerByUtxo = new Map<string, number>();
      for (const slotIndex of batch.slotIndices) {
        const info = entryInfos[slotIndex];
        const slot = info.slot;
        const proof = list.find(slot) ?? list.predecessorOf(slot);
        const uid = `${proof.utxo.txid}:${proof.utxo.vout}`;
        let owner = ownerByUtxo.get(uid);
        if (owner === undefined) { owner = slotIndex; ownerByUtxo.set(uid, owner); }
        const offset = deployAbi.blockLayout?.slots.find(
          (s) => s.kind === 'entry' && s.slotIndex === owner,
        )?.offset ?? deployAbi.blockLayout?.slots.find(
          (s) => s.kind === 'entry' && s.slotIndex === slotIndex,
        )?.offset ?? 0;
        const out = batchPlan.outputs.find((o) => bytesToSlotValue(o.slot) === bytesToSlotValue(slot));
        const nextKey = out ? decodeEntryCommitment(out.commitment).nextKey : new Uint8Array(32);
        const proofSlot = bytesToSlotValue(proof.slot).toString();
        const predOrdinal = predOutputs.findIndex(
          (o) => bytesToSlotValue(o.slot).toString() === proofSlot,
        );
        // INSERT: P' trails at batchPredOutputBase+predOrdinal; UPDATE / shared-owner alias: predOut=-1 or owner.
        const firstLinearPred = !batch.linear || firstLinearPredSlot.get(proofSlot) === slotIndex;
        const predOut = info.present || predOrdinal < 0 || !firstLinearPred
          ? -1n
          : BigInt(batchPredOutputBase + predOrdinal);
        finalArgs = [...finalArgs, slot, BigInt(offset), nextKey, predOut,
          ...(batch.linear ? [BigInt(linearRank.get(slotIndex)!)] : [])];
      }
      if (batch.linear) finalArgs = [...finalArgs, Uint8Array.from(linearRows.flatMap(
        (row) => [...row.slot, ...row.next],
      ))];
      batchPredOutputBase += predOutputs.length;
      batchTrailingCount += predOutputs.length;
    }
    finalArgs.splice(
      trailingCountIndex >= 0 && trailingCountIndex <= finalArgs.length ? trailingCountIndex : finalArgs.length,
      0,
      BigInt(batchTrailingCount),
    );
  }

  // returnOutputIdx is the last hidden input when present (after vmap batch witnesses).
  if (deployReturns) {
    const retIdxPos = deployAbi.inputs.findIndex((inp) => inp.name === '__internal__returnOutputIdx');
    // The genesis call and the reader the record names sit right before it, in that order: a creating call answers no
    // constructor, so the genesis call is empty, and no contract makes it, so the record names no reader.
    for (const [name, value] of [
      ['__internal__genesisCall', new Uint8Array()], [CALL_RECORD_READER_INPUT, CALL_RECORD_NO_READER],
    ] as const) {
      if (finalArgs.length < retIdxPos && deployAbi.inputs[finalArgs.length]!.name === name) {
        finalArgs = [...finalArgs, value];
      }
    }
    if (retIdxPos >= 0 && finalArgs.length === retIdxPos) {
      finalArgs = [...finalArgs, BigInt(returnEventSlot!.offset)];
    } else if (retIdxPos >= 0 && finalArgs.length < deployAbi.inputs.length) {
      // Fallback: insert at the ABI position if earlier hidden params left a gap.
      finalArgs = [
        ...finalArgs.slice(0, retIdxPos),
        BigInt(returnEventSlot!.offset),
        ...finalArgs.slice(retIdxPos),
      ];
    }
  }

  // Collection iteration over an enumerable mapping: co-spend the HEAD + entry chain read-only at
  // input[masterInputIndex + blockSize + i] (the compiler's fixed input coordinate). Loading also appends the
  // run-size witness (`__internal__collectionIterCount_N`) that the emitted iteration loop bounds itself by,
  // which the hidden-argument fill below would otherwise refuse.
  const iterationLoaded = await loadCreateBuilderIterationInputs(
    {
      categoryId: factory.categoryId,
      inner: factory.inner,
      rawIterationKeysBlob: undefined,
      iterationKeys: undefined,
      rawWindowUtxos: undefined,
    },
    {
      abiFunction: deployAbi,
      entryAbiFunction: deployAbi,
      stateLayout: factoryLayout,
      finalArgs,
    },
  );
  const iterationEntryInputs = iterationLoaded.iterationEntryInputs;
  finalArgs = iterationLoaded.finalArgs;

  // A runtime-loop vmap write (`for (i < ks.length) this.m[ks[i]] = v`) with a non-chunkable int value co-spends
  // the bracketing predecessor once and mints the re-pointed predecessor + sorted NEW nodes as trailing entry
  // outputs (range-splice). Only the admitted simple shape is resolved here; anything else fails closed below.
  const upsertLoopInputs: Array<{ utxo: Utxo; unlocker: Unlocker }> = [];
  const upsertLoopOutputs: Array<{ to: string | Uint8Array; amount: bigint; token?: any }> = [];
  for (const info of deployAbi.sortedUpsertLoopInfo ?? []) {
    if (info.op !== 'set'
      || (info.fixedKeyParams?.length ?? 0) > 0
      || (info.fixedKeySources?.length ?? 0) > 0
      || info.condition || info.iterationCondition || info.iterationBreakCondition
      || info.valueArrayParam || info.valueTraceWitnessParam || info.prefixCountWitnessParam
      || (info.varyingKeyExpressions?.length ?? 0) > 0
      || (info.valueScalarParam === undefined && info.valueConst === undefined)) {
      throw new Error(
        `deployFrom cannot resolve the runtime-loop mapping write in '${deployFunctionName}'. `
        + 'Only a plain `for (i < n) m[k[i]] = v` insert with a single int key and a scalar int value is '
        + 'supported on the deploy path; recompile the loop without predicates, fixed keys, or chunkable values.',
      );
    }
    const collection = factoryLayout.collections?.find((c) => c.name === info.collection);
    if (!collection) throw new Error(`Unknown collection: ${info.collection}`);
    const entryAddr = getEntryNftAddress(factory.inner, factory.categoryId, collection.signature);
    const entryUtxos = (await provider.getUtxos(entryAddr)).filter((u) => (
      u.token?.category === factory.categoryId && u.token?.nft?.capability === 'mutable'
      && !!u.token?.nft?.commitment && u.token.nft.commitment.length > 0
    ));
    const list = SortedList.fromUtxos(entryUtxos);
    const ksIndex = deployAbi.inputs.findIndex((p) => p.name === info.varyingArrayParam);
    const rawKeys = finalArgs[ksIndex] as unknown[];
    if (!Array.isArray(rawKeys)) {
      throw new Error(
        `vmap runtime loop in '${deployFunctionName}' is missing its key array '${info.varyingArrayParam}'.`,
      );
    }
    const encKey = (k: unknown): Uint8Array => {
      if (typeof k === 'bigint') return bigIntToVmNumber(k);
      throw new Error(`vmap runtime loop key in '${deployFunctionName}' must be an int, got ${typeof k}.`);
    };
    const slots = rawKeys.map((k) => keyToSlotMulti([encKey(k)], collection));
    const order = slots.map((_, i) => i).sort((a, b) => (
      bytesToSlotValue(slots[a]) < bytesToSlotValue(slots[b]) ? -1 : 1
    ));
    finalArgs[ksIndex] = order.map((i) => rawKeys[i]) as unknown as FunctionArgument;
    const sortedSlots = order.map((i) => slots[i]);
    for (let i = 1; i < sortedSlots.length; i += 1) {
      if (bytesToSlotValue(sortedSlots[i]) === bytesToSlotValue(sortedSlots[i - 1])) {
        throw new Error(`vmap runtime loop in '${deployFunctionName}' writes a duplicate key.`);
      }
    }
    const valueTail = info.valueScalarParam !== undefined
      ? bigIntToVmNumber(finalArgs[deployAbi.inputs.findIndex((p) => p.name === info.valueScalarParam)] as bigint)
      : bigIntToVmNumber(BigInt(info.valueConst as string));
    const predecessor = list.predecessorOf(sortedSlots[0]);
    const predSlot = bytesToSlotValue(predecessor.slot);
    const predNext = bytesToSlotValue(predecessor.nextKey);
    for (const slot of sortedSlots) {
      const slotValue = bytesToSlotValue(slot);
      if (!(predSlot < slotValue && (predNext === 0n || slotValue < predNext))) {
        throw new Error(
          `vmap runtime loop in '${deployFunctionName}' spans multiple gaps; `
          + 'the deploy path supports one range splice.',
        );
      }
    }
    const commitments: string[] = [
      binToHex(encodeEntryCommitment(predecessor.slot, sortedSlots[0], predecessor.value)),
    ];
    for (let j = 0; j < sortedSlots.length; j += 1) {
      const next = j < sortedSlots.length - 1 ? sortedSlots[j + 1] : predecessor.nextKey;
      commitments.push(binToHex(encodeEntryCommitment(sortedSlots[j], next, valueTail)));
    }
    upsertLoopInputs.push({
      utxo: predecessor.utxo,
      unlocker: createEntryNftUnlocker(factory.inner, 0, factory.categoryId, info.collection),
    });
    for (const commitment of commitments) {
      upsertLoopOutputs.push({
        to: entryAddr,
        amount: dataNftAmount,
        token: {
          category: factory.categoryId, amount: 0n,
          nft: { capability: 'mutable' as const, commitment },
        },
      });
    }
  }

  // A runtime loop's transfer or event witness: the loop's counters in the order of their slot hashes, as the call
  // path builds it (`materializeCreateBuilderVmapPermutations`). A sorted-upsert loop's witness also needs its
  // predicates, and stays unresolved here.
  const runtimeLoopPermutation = (name: string): bigint[] | undefined => {
    const spec = vmapCounterPermutationSpec(name);
    if (spec === undefined) return undefined;
    if ((deployAbi.sortedUpsertLoopInfo ?? []).some((info) => info.varyingArrayParam === name)) return undefined;
    const loop = [...(deployAbi.runtimeLoopTransfers ?? []), ...(deployAbi.runtimeLoopEvents ?? [])]
      .find((candidate) => candidate.permutationParam === name);
    if (loop === undefined) return undefined;
    const countIndex = deployAbi.inputs.findIndex((parameter) => parameter.name === spec.countName);
    const visibleInputs = visibleHandlerInputs(deployAbi.inputs);
    const visibleArgs = visibleInputs.map((visible) => deployFunctionArgs[
      deployAbi.inputs.findIndex((candidate) => candidate.name === visible.name)]);
    const domain = (factory as unknown as { _vmapCounterDomain(...args: unknown[]): bigint[] | undefined })
      ._vmapCounterDomain(
        loop.iterationBound === undefined ? undefined : { iterationBound: loop.iterationBound }, spec,
        countIndex < 0 ? undefined : deployFunctionArgs[countIndex], visibleArgs, factory.inner.artifact, visibleInputs,
      );
    if (domain === undefined) {
      throw new Error(`deployFrom cannot resolve the bound of the runtime loop behind '${name}'.`);
    }
    const slotOf = (value: bigint): bigint => bytesToSlotValue(keyToSlotMulti([bigIntToVmNumber(value)]));
    return [...domain].sort((a, b) => (slotOf(a) < slotOf(b) ? -1 : slotOf(a) > slotOf(b) ? 1 : 0));
  };

  // Fill any remaining hidden deploy inputs with their canonical plain-path sentinels. A dynamic chunk write
  // (allPairs.push) appends chunks as NEW outputs and co-spends no existing chunk inputs, so the negative
  // sentinel makes the covenant reconstruct its output base (the same value the standalone-call path uses).
  while (finalArgs.length < deployAbi.inputs.length) {
    const input = deployAbi.inputs[finalArgs.length];
    if (input.name === '__internal__dynamicChunkInputBase'
      || input.name === '__internal__dynamicChunkOutputBase'
      || input.name === '__internal__valueChunkOutputBase') {
      finalArgs = [...finalArgs, -1n];
    } else if (runtimeLoopPermutation(input.name) !== undefined) {
      finalArgs = [...finalArgs, runtimeLoopPermutation(input.name)!];
    } else if (input.name === '__internal__createdChildren') {
      // A6 rule 3: the digest of the created-children list, or empty when the call creates no child that reads
      // `msg.sender`; the creator's rule 1 checks this push against the list its sites built.
      const createdChildren = creation?.createdChildren ?? new Uint8Array();
      finalArgs = [...finalArgs, createdChildren.length > 0 ? sha256.hash(createdChildren) : new Uint8Array()];
    } else if (input.name === '__internal__genesisCall') {
      // A creating call answers no constructor.
      finalArgs = [...finalArgs, new Uint8Array()];
    } else if (input.name === CALL_RECORD_READER_INPUT) {
      // No contract makes it, so its record names no reader.
      finalArgs = [...finalArgs, CALL_RECORD_NO_READER];
    } else {
      throw new Error(
        `deployFrom cannot resolve hidden deploy argument '${input.name}'. Recompile or extend the deploy path.`,
      );
    }
  }

  // Placeholder entry NFT outputs for the VM probe (commitments derived from the trace).
  const entryPlaceholderOutputs: Array<{ to: string | Uint8Array; amount: bigint; token?: any }> = [];
  for (const info of entryInfos) {
    const entryAddress = getEntryNftAddress(factory.inner, factory.categoryId, info.collection);
    entryPlaceholderOutputs.push({
      to: entryAddress,
      amount: dataNftAmount,
      token: {
        category: factory.categoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: info.fixedCommitment },
      },
    });
  }

  // Trailing P' / NEW nodes: batch mode collects unique predecessor rewrites once per collection;
  // non-batch keeps a per-access trailingCommitment.
  const trailingEntrySpecs: Array<{ collection: string; commitment: string }> = batchTrailingCommitments.length > 0
    ? batchTrailingCommitments
    : entryInfos
      .filter((info) => info.trailingCommitment !== undefined)
      .map((info) => ({ collection: info.collection, commitment: info.trailingCommitment! }));

  // Funder pool for shared-predecessor alias entry slots (and later output-only placeholders). Prefer the
  // connected signer's plain UTXOs; otherwise mint mock UTXOs at changeAddress (or the funder's lock) so
  // the alias input is actually spendable (randomUtxo alone is missingorspent on MockNetworkProvider).
  const fundingKeys = new Set(fundingUtxos.map((u) => `${u.txid}:${u.vout}`));
  const placeholderFunder = funder;
  const funderPool: Utxo[] = [];
  const factorySigner = (factory as any)._signer;
  if (factorySigner && typeof factorySigner.getUtxos === 'function') {
    // A reserved genesis coin holds a predicted create address and an identity output its metadata authority, so
    // neither funds an alias slot.
    for (const u of await signerFundingCoins(factorySigner)) {
      if (u.token || fundingKeys.has(`${u.txid}:${u.vout}`) || u.satoshis < 1000n) continue;
      funderPool.push(u);
    }
  }
  const funderLockAddress = changeAddress
    ?? (factorySigner && typeof factorySigner.getAddress === 'function' ? factorySigner.getAddress() : undefined);
  const takeFunder = async (): Promise<Utxo> => {
    const u = funderPool.shift();
    if (u) return u;
    if (!funderLockAddress) {
      throw new Error(
        'deployFrom needs extra plain UTXOs for shared vmap predecessor alias entry slots. '
        + 'Connect a Signer (or pass changeAddress) so the SDK can fund the alias inputs.',
      );
    }
    const minted = randomUtxo({ satoshis: 10_000n });
    fundingKeys.add(`${minted.txid}:${minted.vout}`);
    const addUtxo = (provider as { addUtxo?: (a: string, u: Utxo) => Promise<Utxo> }).addUtxo;
    if (typeof addUtxo === 'function') {
      await addUtxo.call(provider, funderLockAddress, minted);
    }
    return minted;
  };

  // Every entry slot needs an input at its layout offset. Shared predecessors co-spend once; later aliases
  // take a funder so the dense input stream still has one input per entry slot (batch witness proof points
  // at the owner's offset).
  const entryExtraInputs: Array<{ utxo: Utxo; unlocker: Unlocker }> = [];
  const seenProofUtxo = new Map<string, number>();
  for (let i = 0; i < entryInfos.length; i++) {
    const info = entryInfos[i];
    const uid = `${info.proofUtxo.txid}:${info.proofUtxo.vout}`;
    if (!seenProofUtxo.has(uid)) {
      seenProofUtxo.set(uid, i);
      entryExtraInputs.push({
        utxo: info.proofUtxo,
        unlocker: createEntryNftUnlocker(factory.inner, 0, factory.categoryId, info.collection),
      });
    } else {
      entryExtraInputs.push({
        utxo: await takeFunder(),
        unlocker: placeholderFunder,
      });
    }
  }

  // A deployDataNft slot is output-only, so any trailing run (collection iteration or a runtime-loop mapping
  // write) that follows the fixed block must be preceded by one funder pad; otherwise its first input sits one
  // slot early and breaks the compiled input coordinate.
  const iterationEntryOutputs: Array<{ to: string | Uint8Array; amount: bigint; token?: any }> = [];
  for (const input of iterationEntryInputs) {
    iterationEntryOutputs.push({
      to: input.unlocker.generateLockingBytecode(),
      amount: input.satoshis,
      token: {
        category: factory.categoryId, amount: 0n,
        nft: { capability: 'mutable' as const, commitment: input.token?.nft?.commitment ?? '' },
      },
    });
  }
  let deployTrailingInputs: Array<{ utxo: Utxo; unlocker: Unlocker }> = [];
  const deployTrailingOutputs: Array<{ to: string | Uint8Array; amount: bigint; token?: any }> = [
    ...iterationEntryOutputs, ...upsertLoopOutputs,
  ];
  if (iterationEntryInputs.length > 0 || upsertLoopInputs.length > 0) {
    deployTrailingInputs = [
      ...(creation === undefined ? [{ utxo: await takeFunder(), unlocker: placeholderFunder }] : []),
      ...iterationEntryInputs.map((input) => {
        const { unlocker, ...utxo } = input;
        return { utxo, unlocker };
      }),
      ...upsertLoopInputs,
    ];
  }

  // A dynamic-array write on a NON-EMPTY value (`allPairs.push` after the first pair) spends the array's existing
  // chunk NFTs to replace them. The negative sentinel is only valid for the first chunk: pass the absolute input
  // coordinate where those chunks are appended and co-spend them.
  const dynamicChunkInputBaseIndex = deployAbi.inputs
    .findIndex((input) => input.name === '__internal__dynamicChunkInputBase');
  if ((deployAbi.dynamicWrites ?? []).length > 0) {
    const chunkOutputOnlyKinds = new Set([
      'event', 'eventChunk', 'returnEvent', 'deployDataNft', 'valueChunk', 'valueChunkOutput',
      'dynamicChunkOutput', 'transfer',
    ]);
    const layoutInputCount = (deployAbi.blockLayout?.slots ?? [])
      .filter((slot) => !chunkOutputOnlyKinds.has(slot.kind)).length;
    const priorChunks: Utxo[] = [];
    for (const varName of deployAbi.dynamicWrites ?? []) {
      priorChunks.push(...(onChainState.dynamicChunkUtxos?.[varName] ?? []));
    }
    if (priorChunks.length > 0) {
      const chunkBase = (creation === undefined ? layoutInputCount : trailingInputBase) + deployTrailingInputs.length;
      const variable = factoryLayout.variables?.find((entry) => entry.dynamic
        && (deployAbi.dynamicWrites ?? []).includes(entry.name));
      const chunkUnlocker = variable === undefined
        ? placeholderFunder
        : createDynamicChunkUnlocker(factory.inner, 0, factory.categoryId, variable.name, variable.type);
      for (const utxo of priorChunks) deployTrailingInputs.push({ utxo, unlocker: chunkUnlocker });
      if (dynamicChunkInputBaseIndex >= 0) finalArgs[dynamicChunkInputBaseIndex] = BigInt(chunkBase);
    }
  }

  // Create unlockers for factory's master UTXO and data NFTs. The master is a covenant input like the data NFTs, so
  // a zero-state factory's deploy gets the same best-effort template debug (its strict replay reports the P2PKH
  // funder's signature as NULLFAIL); the finalized-bytes gate and the broadcast stay authoritative.
  const stateInputUnlocker = {
    ...(factory.inner.unlock as any)[deployFunctionName](...finalArgs), covenantUnlocker: true,
  };
  const dataNftUnlockers = filteredDataNftUtxos.map(
    () => createDataNftUnlocker(factory.inner, 0, factory.categoryId),
  );

  // A LOOP `new C{value:V}()` has NO standalone transfer block-layout slot (the N value transfers are
  // interleaved as the LAST output of each child's group). A straight-line / conditional {value:} keeps a
  // transfer slot (separate output). Both co-spend the factory's satoshi container as the value source.
  const hasSatoshiContainer = deployAbi.blockLayout?.slots.some((s) => s.kind === 'satoshiContainer') ?? false;
  const hasTransferSlot = deployAbi.blockLayout?.slots.some((s) => s.kind === 'transfer') ?? false;
  // A deployer `new`'s value has no transfer output at all (B8.8): its container slot funds the child's row.
  const isLoopValueDeploy = childDeployer === undefined && hasSatoshiContainer && !hasTransferSlot;

  // A runtime loop's payments, planned as the call path plans them (`planRuntimeLoopTransfers`): their number from
  // the loop's permutation and predicates. Their recipients and amounts are the covenant's, read from the creator's run
  // below; until a run has shown them, each is a placeholder. They sit after the trailing inputs' outputs, where the
  // creator's runtime-loop verification reads them, and leave the creator's satoshi container.
  const loopTransfers: RuntimeLoopTransferOutput[] = [];
  // A runtime loop's events with no payment beside them settle as compact records, which this path does not read.
  if (creation !== undefined && (deployAbi.runtimeLoopEvents?.length ?? 0) > 0
    && (deployAbi.runtimeLoopTransfers?.length ?? 0) === 0) {
    throw new DeployerPathError(
      `Deploy function '${deployFunctionName}' emits events from a runtime loop with no payment beside them, whose `
      + 'compact records a creating call does not lay out yet',
    );
  }
  // The token containers a runtime loop pays from, resolved as the call path resolves them: each access's category
  // and the coin its address holds.
  let loopTokenContainers: TokenContainerInfo[] = [];
  const loopPaysTokens = (deployAbi.runtimeLoopTransfers ?? [])
    .some((loop) => (loop.siteKinds ?? []).some((kind) => kind !== 'bch'));
  if ((deployAbi.runtimeLoopTransfers?.length ?? 0) > 0 && creation !== undefined) {
    if (loopPaysTokens) {
      if (hasSatoshiContainer) {
        throw new Error(
          `Deploy function '${deployFunctionName}' co-spends BOTH a satoshi and a token container; deployFrom `
          + 'does not yet support that combination in a single deploy.',
        );
      }
      ({ tokenContainers: loopTokenContainers } = await loadCreateBuilderTokenContainers(
        { categoryId: factory.categoryId, inner: factory.inner as never },
        { abiFunction: deployAbi, args: finalArgs, stateValues: onChainState.state },
      ));
      const missing = loopTokenContainers.find((container) => container.utxo === undefined);
      if (missing !== undefined) {
        throw new Error(
          `Factory '${factory.name}' has no token container for category ${missing.tokenContainerCategoryId}, which `
          + `'${deployFunctionName}' pays from in a runtime loop. Fund the container before deploying.`,
        );
      }
    }
    const visibleInputs = visibleHandlerInputs(deployAbi.inputs);
    await planRuntimeLoopTransfers({
      evaluateExternalExpression: (...a: unknown[]) => (factory as any)._evaluateExternalExpression(...a),
      hydrateExternalPredicateState: (...a: unknown[]) => (factory as any)._hydrateExternalPredicateState(...a),
      vmapCounterDomain: (...a: unknown[]) => (factory as any)._vmapCounterDomain(...a),
    }, {
      source: deployAbi,
      functionArgs: visibleInputs.map((visible) => deployFunctionArgs[
        deployAbi.inputs.findIndex((candidate) => candidate.name === visible.name)] as FunctionArgument),
      sourceArtifact: factory.inner.artifact,
      argumentFor: (name) => {
        const index = deployAbi.inputs.findIndex((input) => input.name === name);
        return index < 0 ? undefined : finalArgs[index] as FunctionArgument;
      },
      rowIndex: -1,
      state: onChainState.state,
      executionSelfAddress: creatorLock,
      tokenContainers: loopTokenContainers,
      outputs: loopTransfers,
      effectOccurrences: [],
    });
  }
  // The runtime effect span: events and payments in the order the creator's run makes them, as a run showed them, else
  // the planned payments. An event is an immutable NFT of the creator's category at its event lock, at most RESERVE.
  const effectSpan: RuntimeEffect[] = plan?.effects ?? loopTransfers.map((transfer): RuntimeEffect => {
    if (transfer.kind === 'token') {
      return {
        kind: 'token', category: transfer.tokenContainerCategoryId!, lockingBytecode: transfer.lockingBytecode,
        amount: transfer.amount,
      };
    }
    if (transfer.kind === 'nft') {
      return {
        kind: 'nft', category: transfer.tokenContainerCategoryId!, lockingBytecode: transfer.lockingBytecode,
        commitment: binToHex(transfer.commitment ?? new Uint8Array()), capability: transfer.capability ?? 'none',
        slot: loopTokenContainers.find((container) => container.tokenContainerCategoryId
          === transfer.tokenContainerCategoryId)?.tokenContainerSlotIndex ?? 0,
      };
    }
    return { kind: 'bch', lockingBytecode: transfer.lockingBytecode, amount: transfer.amount };
  });
  // A token or NFT payment carries at most what the verifier admits, as the call path lays it out.
  const spanTokenSatoshis = 1200n;
  const loopTransferOutputs: Array<{ to: string | Uint8Array; amount: bigint; token?: any }> = effectSpan.map((effect) => {
    switch (effect.kind) {
      case 'event':
        return {
          to: effect.lockingBytecode, amount: dataNftAmount,
          token: { category: factory.categoryId, amount: 0n, nft: { capability: 'none' as const, commitment: effect.commitment } },
        };
      case 'bch':
        return { to: effect.lockingBytecode, amount: effect.amount };
      case 'token':
        return {
          to: effect.lockingBytecode, amount: spanTokenSatoshis,
          token: { category: effect.category, amount: effect.amount },
        };
      default:
        return {
          to: effect.lockingBytecode, amount: spanTokenSatoshis,
          token: {
            category: effect.category, amount: 0n,
            nft: { capability: effect.capability, commitment: effect.commitment },
          },
        };
    }
  });
  const spanEvents = effectSpan.filter((effect) => effect.kind === 'event').length;
  const spanTokenPayments = effectSpan.filter((effect) => effect.kind === 'token' || effect.kind === 'nft').length;

  // Build child outputs for the VM probe (needed by the deploy covenant verification). N child groups, one per
  // funding UTXO, at consecutive stride-sized slots (the runtime deploy counter indexes them). Each child's
  // master + data NFTs carry its own category (fundingUtxos[k].txid) and self-pinned address; a loop {value:}
  // group ends with the interleaved value transfer to that child.
  const childExtraOutputs: Array<{ to: string | Uint8Array; amount: bigint; token?: any }> = [];
  // A child whose deployer keeps a satoshi container has a row in its genesis group. The child's own `create`
  // requires the row to hold at least the journal's final balance (A4.4, A5): the container's start (RESERVE
  // when the child keeps it single), plus the value its Q carries, less its constructor's sends. An optional row
  // with nothing required holds no container: the index takes the plain filler output (A14 item 11).
  // A14 item 11: the paying wallet opens each child's containers. A token row, a container the child keeps single,
  // opens from coins of its category that the creation spends after every input the creator's layout places; the
  // child's `create` pins the row (A4.4), and the creator's covenant does not read a wallet input. `childContainers`
  // names, by deployment in run order (0 is the first), the satoshis for the child's satoshi coin and the units for its
  // token containers, and the SDK takes the coins from the paying wallet; `childTokenContainers` hands over whole coins.
  type ChildContainerFunding = {
    /** The paying wallet's coins this deployment spends. */
    inputs: Array<{ utxo: Utxo; unlocker: Unlocker }>;
    /** One per token row, in `tokenRows` order: the row's units, and its satoshis (at least RESERVE). */
    tokenRows: Array<{ category: string; units: bigint; satoshis: bigint }>;
    /** The satoshi coin's amount, when the caller asks more than the row needs. */
    satoshis?: bigint;
    /** After every compiled output: a container without a row (A14 item 11), and units returned to the wallet. */
    extraOutputs: Array<{ to: string | Uint8Array; amount: bigint; token?: { category: string; amount: bigint } }>;
  };
  const childFunding: ChildContainerFunding[] = Array.from({ length: childCount }, () => ({
    inputs: [], tokenRows: [], extraOutputs: [],
  }));
  const askedContainers = options.childContainers ?? [];
  if (askedContainers.length > 0 && childDeployer === undefined) {
    throw new DeployerPrepError('childContainers opens the containers of a child created through its deployer');
  }
  // Through deployers the count is fixed by the preps or `deployments` when the caller gives them, else it is the
  // run's, checked once the run has settled; until then an entry past this plan's children opens nothing.
  const knownCount = creation === undefined ? childCount : options.deployerPreps?.length ?? options.deployments;
  for (const entry of askedContainers) {
    if (!Number.isInteger(entry.deployment) || entry.deployment < 0
      || (knownCount !== undefined && entry.deployment >= knownCount)) {
      throw new DeployerPrepError(
        `childContainers names deployment ${entry.deployment}, but this call creates ${knownCount ?? childCount} `
        + `child${(knownCount ?? childCount) === 1 ? '' : 'ren'}, numbered from 0 in run order`,
      );
    }
  }
  if (creation !== undefined
    && (askedContainers.length > 0 || creation.children.some((child) => child.deployer.tokenRows.length > 0))) {
    const RESERVE_SATS = 1200n;
    // A plain container output or a wallet's token change: above the dust limit of a token output.
    const PLAIN_SATS = 1000n;
    const asHex = (raw: unknown): string => (typeof raw === 'string' ? raw.replace(/^0x/i, '')
      : raw instanceof Uint8Array ? binToHex(raw) : '').toLowerCase();
    const walletLock = funder.generateLockingBytecode();
    const taken = new Set<string>();
    let walletCoins: Utxo[] | undefined;
    /** Coins of the paying wallet holding at least `units` of `category`, largest first, none with an NFT. */
    const takeUnits = async (
      category: string, units: bigint, deployment: number,
    ): Promise<{ inputs: ChildContainerFunding['inputs']; held: bigint }> => {
      walletCoins ??= await provider.getUtxosForLockingBytecode(walletLock);
      const candidates = walletCoins.filter((utxo) => utxo.token !== undefined && utxo.token.nft === undefined
        && utxo.token.amount > 0n && utxo.token.category.toLowerCase() === category
        && !taken.has(`${utxo.txid}:${utxo.vout}`))
        .sort((left, right) => (left.token!.amount === right.token!.amount ? 0
          : left.token!.amount > right.token!.amount ? -1 : 1));
      const chosen: Utxo[] = [];
      let held = 0n;
      for (const utxo of candidates) {
        if (held >= units) break;
        chosen.push(utxo);
        held += utxo.token!.amount;
        taken.add(`${utxo.txid}:${utxo.vout}`);
      }
      if (held < units) {
        throw new DeployerPrepError(
          `Deployment ${deployment} of '${creation!.children[deployment]!.contractName}' asks ${units} units of `
          + `${category}, but the paying wallet holds ${held} it can spend (coins without an NFT)`,
        );
      }
      return { inputs: chosen.map((utxo) => ({ utxo, unlocker: funder })), held };
    };
    const explicitCoins = [...(options.childTokenContainers ?? [])];
    for (let child = 0; child < childCount; child += 1) {
      const deployment = creation.children[child]!;
      const funding = childFunding[child];
      const rowCategories = deployment.deployer.tokenRows
        .map((row) => asHex((deployment.contractArgs as unknown[])[row]));
      if (new Set(rowCategories).size !== rowCategories.length) {
        throw new DeployerPrepError(
          `'${deployment.contractName}' names one category for two single token containers, which create refuses`,
        );
      }
      const entries = askedContainers.filter((entry) => entry.deployment === child);
      if (entries.length > 1) throw new DeployerPrepError(`childContainers names deployment ${child} twice`);
      const tokens = (entries[0]?.tokens ?? []).map((token) => ({
        category: token.categoryId.replace(/^0x/i, '').toLowerCase(), amount: token.amount,
      }));
      if (new Set(tokens.map((token) => token.category)).size !== tokens.length) {
        throw new DeployerPrepError(
          `childContainers names one category twice for deployment ${child}; a container lock takes one coin`,
        );
      }
      for (const token of tokens) {
        if (token.amount < 1n) {
          throw new DeployerPrepError(`childContainers asks ${token.amount} units of ${token.category}; ask at least 1`);
        }
      }
      for (const [index, row] of deployment.deployer.tokenRows.entries()) {
        const category = rowCategories[index];
        const wanted = tokens.find((token) => token.category === category);
        if (wanted !== undefined) {
          const { inputs, held } = await takeUnits(category, wanted.amount, child);
          funding.inputs.push(...inputs);
          funding.tokenRows.push({ category, units: wanted.amount, satoshis: RESERVE_SATS });
          if (held > wanted.amount) {
            funding.extraOutputs.push({
              to: walletLock, amount: PLAIN_SATS, token: { category, amount: held - wanted.amount },
            });
          }
          continue;
        }
        const at = explicitCoins.findIndex(({ utxo }) => utxo.token !== undefined && utxo.token.nft === undefined
          && utxo.token.amount >= 1n && utxo.token.category.toLowerCase() === category);
        if (at < 0) {
          const name = deployment.artifact.constructorInputs[row]?.name ?? `parameter ${row}`;
          throw new DeployerPrepError(
            `'${deployment.contractName}' keeps its token container '${name}' single; name units of ${category} `
            + `for deployment ${child} in childContainers, or pass a coin of it in childTokenContainers`,
          );
        }
        const [coin] = explicitCoins.splice(at, 1);
        funding.inputs.push(coin);
        funding.tokenRows.push({
          category, units: coin.utxo.token!.amount,
          satoshis: coin.utxo.satoshis >= RESERVE_SATS ? coin.utxo.satoshis : RESERVE_SATS,
        });
      }
      // A container the child does not keep single has no row: one plain output at its lock, after the range.
      for (const token of tokens.filter((candidate) => !rowCategories.includes(candidate.category))) {
        const { inputs, held } = await takeUnits(token.category, token.amount, child);
        funding.inputs.push(...inputs);
        funding.extraOutputs.push({
          to: getTokenContainerAddress(childContracts[child], fundingUtxos[child].txid, token.category),
          amount: PLAIN_SATS, token: { category: token.category, amount: token.amount },
        });
        if (held > token.amount) {
          funding.extraOutputs.push({
            to: walletLock, amount: PLAIN_SATS, token: { category: token.category, amount: held - token.amount },
          });
        }
      }
      const satoshis = entries[0]?.satoshis;
      if (satoshis !== undefined) {
        if (satoshis < 0n) throw new DeployerPrepError(`childContainers asks ${satoshis} satoshis for deployment ${child}`);
        if (deployment.deployer.satoshiContainer !== 'none') {
          funding.satoshis = satoshis;
        } else if (satoshis > 0n) {
          funding.extraOutputs.push({
            to: getSatoshiContainerAddress(childContracts[child], fundingUtxos[child].txid),
            amount: satoshis >= PLAIN_SATS ? satoshis : PLAIN_SATS,
          });
        }
      }
    }
  }
  /** A token row's output (A4.4): its units at the child's container lock, with at least RESERVE. */
  const childTokenRows = (
    child: number,
  ): Array<{ to: string; amount: bigint; token: { category: string; amount: bigint } }> => childFunding[child]
    .tokenRows.map((row) => ({
      to: getTokenContainerAddress(childContracts[child], fundingUtxos[child].txid, row.category),
      amount: row.satoshis,
      token: { category: row.category, amount: row.units },
    }));
  /** The satoshi row of a child created through its deployer, for the value its creator's `new` sends. */
  const childSatoshiRow = (child: number): { to: string | Uint8Array; amount: bigint } => {
    const deployment = creation?.children[child];
    if (deployment === undefined || deployment.deployer.satoshiContainer === 'none') {
      return { to: Uint8Array.of(0x51), amount: 0n };
    }
    const cc = childContracts[child];
    const cat = fundingUtxos[child].txid;
    const value = deployment.value;
    if (value > 0n && value < 1200n) {
      // A4.3 step 6: the child's create takes a value of 0, or of at least RESERVE.
      throw new DeployerPrepError(
        `'${deployment.contractName}' is created with value ${value}, but its create takes a value of 0 `
        + 'or of at least 1200 satoshis (A4.3 step 6)',
      );
    }
    if (deployment.deployer.satoshiContainer === 'required') {
      // A single container opens with its own RESERVE on top of the deploy value (A5); no value is fine, the
      // paying wallet funds the reserve.
      return { to: getSatoshiContainerAddress(cc, cat), amount: 1200n + value };
    }
    if (value === 0n) return { to: Uint8Array.of(0x51), amount: 1000n };
    return { to: getSatoshiContainerAddress(cc, cat), amount: value };
  };
  /** The child's satoshi row, raised to what `childContainers` asks for it; never less than the row needs. */
  const childSatoshiRowFor = (child: number): { to: string | Uint8Array; amount: bigint } => {
    const row = childSatoshiRow(child);
    const asked = childFunding[child]?.satoshis;
    if (asked === undefined) return row;
    // A14 item 11: an optional row with nothing required holds the filler; satoshis asked for it open the
    // container at its lock instead, an amount from 1 to 1,199 raised to RESERVE. They never go to the filler.
    const deployment = creation?.children[child];
    if (deployment?.deployer.satoshiContainer === 'optional' && deployment.value === 0n) {
      if (asked === 0n) return row;
      return {
        to: getSatoshiContainerAddress(childContracts[child], fundingUtxos[child].txid),
        amount: asked < 1200n ? 1200n : asked,
      };
    }
    if (asked < row.amount) {
      throw new DeployerPrepError(
        `childContainers asks ${asked} satoshis for deployment ${child}'s satoshi coin, which must hold at least `
        + `${row.amount}`,
      );
    }
    return { ...row, amount: asked };
  };
  // A child created through its deployer: its genesis group follows its `create` layout (A4.4): the master, its
  // records, a HEAD per collection, the satoshi row, the token rows, then one row per journal append site, which the
  // child's own `create` run fills (A14 item 4 steps 4 and 5). Indexes are relative to the group's start.
  const deployerChildGroup = (k: number): {
    outputs: Array<{ to: string | Uint8Array; amount: bigint; token?: any }>;
    records: number[];
    journals: Array<{ collection: string; head: number; rows: number[]; depth: number }>;
    baseCost: bigint;
  } => {
    const deployment = creation!.children[k]!;
    const createLayout = deployment.deployer.abi.find((entry) => entry.name === 'create')?.blockLayout;
    if (createLayout === undefined) {
      throw new DeployerPathError(`The deployer of '${deployment.contractName}' publishes no create layout`);
    }
    const cc = childContracts[k];
    const cat = fundingUtxos[k].txid;
    const outputs: Array<{ to: string | Uint8Array; amount: bigint; token?: any }> = [];
    const records: number[] = [];
    const heads = new Map<string, number>();
    const rows = new Map<string, number[]>();
    const tokenRows = childTokenRows(k);
    let record = 0;
    let tokenRow = 0;
    let baseCost = 0n;
    for (const slot of createLayout.slots) {
      switch (slot.kind) {
        case 'master':
          outputs.push({
            to: cc.tokenAddress, amount: masterAmount,
            token: { category: cat, amount: 0n, nft: { capability: 'minting', commitment: '' } },
          });
          baseCost += masterAmount;
          break;
        case 'dataNft':
          records.push(outputs.length);
          outputs.push({
            to: getDataNftAddress(cc, cat), amount: dataNftAmount,
            token: { category: cat, amount: 0n, nft: { capability: 'mutable', commitment: childCommitmentsOf(k)[record] ?? '' } },
          });
          record += 1;
          baseCost += dataNftAmount;
          break;
        case 'head':
          heads.set(slot.collection!, outputs.length);
          outputs.push({
            to: getEntryNftAddress(cc, cat, slot.collection!), amount: dataNftAmount,
            token: { category: cat, amount: 0n, nft: { capability: 'mutable', commitment: '00'.repeat(128) } },
          });
          baseCost += dataNftAmount;
          break;
        case 'satoshiContainer':
          outputs.push(childSatoshiRowFor(k));
          baseCost += childSatoshiRow(k).amount;
          break;
        case 'tokenContainer':
          if (tokenRows[tokenRow] === undefined) {
            throw new DeployerPrepError(`'${deployment.contractName}' has a token row this call does not open`);
          }
          outputs.push(tokenRows[tokenRow]!);
          tokenRow += 1;
          break;
        case 'entry':
          rows.set(slot.collection!, [...(rows.get(slot.collection!) ?? []), outputs.length]);
          outputs.push({ to: Uint8Array.of(0x51), amount: 1000n });
          baseCost += 1000n;
          break;
        case 'keccakSideCar':
        case 'ecrecoverSideCar':
          break;
        default:
          throw new DeployerPathError(
            `'${deployment.contractName}''s constructor has a ${slot.kind} output, which a creating call does `
            + 'not lay out yet; create it at top level',
          );
      }
    }
    const journals = [...rows].map(([collection, journalRows]) => {
      const depth = deployment.deployer.collectionRows.find((row) => row.collection === collection)?.journalDepth;
      const head = heads.get(collection);
      if (depth === undefined || head === undefined) {
        throw new DeployerPathError(`The journal rows of '${deployment.contractName}.${collection}' are not laid out`);
      }
      return { collection, head, rows: journalRows, depth };
    });
    return { outputs, records, journals, baseCost };
  };
  // The outputs of the creator's deploy slots (A6, Indices): each site's group at the site's offset, a loop site's
  // groups one after another. A site no run reaches holds fillers where a later output needs its index: before a
  // later site's group, and up to the end of the slots when compiled outputs follow them (A14 item 4 step 6).
  const deployRegion = (): {
    outputs: Array<{ to: string | Uint8Array; amount: bigint; token?: any }>;
    groups: Array<{ k: number; at: number; group: ReturnType<typeof deployerChildGroup> }>;
    fillers: number;
  } => {
    const outputs: Array<{ to: string | Uint8Array; amount: bigint; token?: any }> = [];
    const groups: Array<{ k: number; at: number; group: ReturnType<typeof deployerChildGroup> }> = [];
    let fillers = 0;
    const padTo = (length: number): void => {
      while (outputs.length < length) {
        outputs.push({ to: Uint8Array.of(0x51), amount: 1000n });
        fillers += 1;
      }
    };
    const base = deploySites[0]!.offset;
    for (const [site, { offset }] of deploySites.entries()) {
      const runs = creation!.children.map((child, k) => ({ child, k })).filter(({ child }) => child.site === site)
        .sort((left, right) => left.child.iteration - right.child.iteration);
      if (runs.length === 0) continue;
      if (outputs.length > offset - base) {
        throw new DeployerPathError(`The genesis groups before deploy site ${site} of '${deployFunctionName}' overlap it`);
      }
      padTo(offset - base);
      for (const { k } of runs) {
        const group = deployerChildGroup(k);
        groups.push({ k, at: outputs.length, group });
        outputs.push(...group.outputs);
      }
    }
    const compiledOutputsFollow = trailingEntrySpecs.length > 0 || deployTrailingOutputs.length > 0
      || effectSpan.length > 0 || (deployAbi.dynamicWrites?.length ?? 0) > 0 || deployAbi.keccakChainReads === true;
    if (compiledOutputsFollow) {
      padTo(Math.max(...deploySites.map((site) => site.offset - base
        + (childDeployers[site.target.contractName]?.genesisOutputs ?? 1))));
    }
    return { outputs, groups, fillers };
  };
  if (creation !== undefined) childExtraOutputs.push(...deployRegion().outputs);
  for (let k = 0; k < (creation === undefined ? childCount : 0); k++) {
    const cc = childContracts[k];
    const cat = fundingUtxos[k].txid;
    const dnAddr = getDataNftAddress(cc, cat);
    childExtraOutputs.push({
      to: cc.tokenAddress,
      amount: masterAmount,
      token: { category: cat, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    });
    for (let i = 0; i < childLayout!.dataNftCount; i++) {
      childExtraOutputs.push({
        to: dnAddr,
        amount: dataNftAmount,
        token: { category: cat, amount: 0n, nft: { capability: 'mutable', commitment: childCommitmentsOf(k)[i] } },
      });
    }
    for (const entry of childGenesisEntries) {
      childExtraOutputs.push({
        to: getEntryNftLockingBytecode(cc, cat, entry.collectionSignature),
        amount: dataNftAmount,
        token: {
          category: cat, amount: 0n,
          nft: { capability: 'mutable', commitment: entry.commitment },
        },
      });
    }
    childExtraOutputs.push(...childTokenRows(k));
    if (isLoopValueDeploy) {
      childExtraOutputs.push({ to: cc.address, amount: options.childValue ?? 0n });
    }
  }
  const trailingEntryPlaceholderOutputs = trailingEntrySpecs.map((spec) => ({
    to: getEntryNftAddress(factory.inner, factory.categoryId, spec.collection),
    amount: dataNftAmount,
    token: {
      category: factory.categoryId, amount: 0n,
      nft: { capability: 'mutable' as const, commitment: spec.commitment },
    },
  }));
  // A fixed vmap INSERT's NEW node is output[blockSize]. For deployFrom, the deploy slot itself is the child
  // master, while child data NFTs expand beyond the fixed block; interleave NEW immediately after that master.
  // Through deployers the trailing entries follow the whole deploy region, as they do in the creation.
  const childProbeOutputs = childExtraOutputs.length > 0
    ? (hasDeployDataNftSlots || creation !== undefined
      ? [...childExtraOutputs, ...trailingEntryPlaceholderOutputs]
      : [childExtraOutputs[0], ...trailingEntryPlaceholderOutputs, ...childExtraOutputs.slice(1)])
    : [...trailingEntryPlaceholderOutputs];

  // Return-event (B8) seed for a returning deploy function, at its block-layout slot (after entries, before
  // the child genesis). A deploy's returned address is already fixed by its child category, bytecode and salt;
  // seeding it lets the probe advance through the return check and derive any deploy-then-call child state.
  const returnEventPlaceholders: Array<{ to: string | Uint8Array; amount: bigint; token?: any }> = deployReturns
    ? [{
      to: new Uint8Array([0x51]), // OP_TRUE (anyone-can-spend return event)
      amount: 800n,
      token: {
        category: factory.categoryId, amount: 0n,
        nft: {
          capability: 'none',
          commitment: predictedReturnCommitment,
        },
      },
    }]
    : [];

  // `new Child{value: x}()`: the factory co-spends its OWN satoshi container (the value source, like any scash
  // value transfer) + recreates it (minus x) + adds the x-sat transfer to the child. Detected from the deploy
  // fn's satoshiContainer block-layout slot; the container input sits after entries (before funding), and the
  // container + transfer outputs after entries (before return event / child geneses) - matching the layout.
  // hasSatoshiContainer / isLoopValueDeploy computed above (with the child-output interleave). A loop {value:}
  // deploy's container loses N*childValue (N interleaved transfers); a straight-line / conditional loses V.
  const containerInputs: Array<{ utxo: Utxo; unlocker: Unlocker }> = [];
  /** Through deployers: the transfers at the function's transfer slots, which the creator's run pins (see below). */
  const fixedTransfers: RuntimeLoopTransferOutput[] = [];
  const containerOutputs: Array<{ to: string | Uint8Array; amount: bigint }> = [];
  if (hasSatoshiContainer) {
    const childValue = options.childValue ?? 0n;
    // Every BCH transfer the function makes is funded by the factory's own satoshi container (A8). A payment
    // whose destination is a `new` result is routed to that child's satoshi container lock (B2.2); a payment to
    // a forwarded address goes to that address's lock. A `new C{value: v}` transfer keeps its own slot.
    const transferAmount = (recipe: unknown): bigint => {
      const value = evaluateGenesisRecipe!(
        recipe as never, deployFunctionArgs, genesisInputTypes,
        artifactUsesSolidityAbi(factory.inner.artifact), undefined, callerValueIdentity,
      );
      if (typeof value === 'bigint') return value;
      if (typeof value === 'number') return BigInt(value);
      throw new Error(`Deploy function '${deployFunctionName}' has a transfer whose amount is not concrete.`);
    };
    const routed: Array<{ to: string | Uint8Array; amount: bigint }> = [];
    for (const [index, transfer] of (deployAbi.transfers ?? []).entries()) {
      // Through deployers a recipient or amount the SDK cannot evaluate here starts as a placeholder: the creator's run
      // names it below.
      if (creation !== undefined) {
        let amount = 1000n;
        try {
          amount = transferAmount(transfer.amountRecipe ?? transfer.amount);
        } catch {
          // the run's
        }
        const recipient = transfer.recipient;
        const argument = recipient.kind === 'forward' && recipient.paramIndex !== undefined
          ? deployFunctionArgs[recipient.paramIndex] : undefined;
        const to = typeof argument === 'string' ? addressToLockScript(argument) : argument;
        // A payment to a `new` result goes to that child's satoshi container (B2.2): the guess for a computed one.
        const childIndex = (deployAbi.transfers?.length ?? 0) === childCount ? index : 0;
        const guess = recipient.kind === 'expression' && childCount > 0
          ? addressToLockScript(getSatoshiContainerAddress(childContracts[childIndex], fundingUtxos[childIndex].txid))
          : encodeLockingBytecodeP2pkh(new Uint8Array(20));
        routed.push({ to: to instanceof Uint8Array ? to : guess, amount });
        continue;
      }
      const amount = transferAmount(transfer.amountRecipe ?? transfer.amount);
      const recipient = transfer.recipient;
      if (recipient.kind === 'expression' && deployTarget !== undefined && childCount > 0) {
        const childIndex = (deployAbi.transfers?.length ?? 0) === childCount ? index : 0;
        const child = childContracts[childIndex];
        routed.push({ to: getSatoshiContainerAddress(child, fundingUtxos[childIndex].txid), amount });
        continue;
      }
      if (recipient.kind === 'forward' && recipient.paramIndex !== undefined) {
        const argument = deployFunctionArgs[recipient.paramIndex];
        const to = typeof argument === 'string' ? addressToLockScript(argument) : argument;
        if (!(to instanceof Uint8Array)) {
          throw new Error(
            `Deploy function '${deployFunctionName}' transfers to '${String(argument)}', which is not a lock.`,
          );
        }
        routed.push({ to, amount });
        continue;
      }
      throw new Error(
        `Deploy function '${deployFunctionName}' has a transfer whose recipient the SDK cannot resolve `
        + `(kind '${recipient.kind}').`,
      );
    }
    // Through deployers the creator's run names each slot's recipient and amount: a run showed them, or it will.
    if (creation !== undefined) {
      const shown = plan?.fixedTransfers;
      if (shown !== undefined && shown.length === routed.length) {
        shown.forEach((transfer, index) => {
          routed[index] = { to: transfer.lockingBytecode, amount: transfer.amount };
        });
      }
      for (const entry of routed) {
        fixedTransfers.push({
          lockingBytecode: typeof entry.to === 'string' ? addressToLockScript(entry.to) : entry.to, amount: entry.amount,
        });
      }
    }
    if (childDeployer === undefined && !isLoopValueDeploy && childValue > 0n) {
      routed.push({ to: childContractUnsalted.address, amount: childValue });
    }
    // B8.8: each deployer child's value leaves the container into that child's satoshi row, in its group. A runtime
    // loop's payments leave it too.
    const totalValue = routed.reduce((sum, entry) => sum + entry.amount, 0n)
      + (isLoopValueDeploy ? childValue * BigInt(childCount) : 0n)
      + (creation?.children.reduce((sum, child) => sum + child.value, 0n) ?? 0n)
      + effectSpan.reduce((sum, effect) => sum + (effect.kind === 'bch' ? effect.amount : 0n), 0n);
    // A creating call whose run sends nothing still spends the container at its slot, which the creator reads.
    if (totalValue === 0n && creation === undefined) {
      throw new Error(
        `Deploy function '${deployFunctionName}' has a satoshi-container slot but no transfer to make.`,
      );
    }
    const satAddr = getSatoshiContainerAddress(factory.inner, factory.categoryId);
    const satUtxo = (await provider.getUtxos(satAddr)).find((u) => u.satoshis > totalValue);
    if (!satUtxo) {
      throw new Error(
        `Factory '${factory.name}' has no satoshi container with > ${totalValue} sats at ${satAddr}. Deploy `
        + 'the factory with an initialBalance to fund its transfers.',
      );
    }
    containerInputs.push({
      utxo: satUtxo, unlocker: createSatoshiContainerUnlocker(factory.inner, 0, factory.categoryId),
    });
    containerOutputs.push({ to: satAddr, amount: satUtxo.satoshis - totalValue });    // recreate the container
    // Straight-line / conditional: one separate transfer output per transfer. Loop: the value transfers are
    // interleaved into the child groups (added in the child-output construction below).
    if (!isLoopValueDeploy) containerOutputs.push(...routed);
  }

  // A deploy function that transfers CashTokens - e.g. to the freshly-created child - co-spends the factory's
  // TOKEN container as the source, exactly like any this.tokens[cat].transfer(). Detected from the deploy fn's
  // tokenContainer block-layout slot; the container input sits after entries (before funding), the recreated
  // container output + each tcTransfer output after entries (before the child geneses) - matching the layout
  // [.., tokenContainer, tcTransfer, .., deploy]. The covenant self-preserves the container (LBC + amount) and
  // pins each transfer (LBC + amount + category), so redirecting the remainder is rejected (TokenContainer test).
  const hasTokenContainer = deployAbi.blockLayout?.slots.some((s) => s.kind === 'tokenContainer') ?? false;
  const tokenContainerInputs: Array<{ utxo: Utxo; unlocker: Unlocker }> = [];
  const tokenContainerOutputs: Array<{ to: string | Uint8Array; amount: bigint; token?: any }> = [];
  let tokenTransferCost = 0n;
  if (hasTokenContainer) {
    if (hasSatoshiContainer) {
      throw new Error(
        `Deploy function '${deployFunctionName}' co-spends BOTH a satoshi and a token container; deployFrom `
        + 'does not yet support that combination in a single deploy.',
      );
    }
    const remainderOutputs: Array<{ to: string | Uint8Array; amount: bigint; token?: any }> = [];
    const transferOutputs: Array<{ to: string | Uint8Array; amount: bigint; token?: any }> = [];
    const transfers = options.childTokenTransfers ?? [];
    if (loopTokenContainers.length > 0) {
      // A runtime loop's token payments leave each container they draw on in the span (B8.9); the container is
      // recreated with the rest, which its covenant's preservation equation checks against the span's outputs of its
      // category. Payments at the function's own token-transfer slots come from `childTokenTransfers`, as below.
      const fixedSlots = deployAbi.blockLayout?.slots.filter((slot) => slot.kind === 'tcTransfer').length ?? 0;
      if (transfers.length !== fixedSlots) {
        throw new Error(
          `Deploy function '${deployFunctionName}' has ${fixedSlots} token transfer slot${fixedSlots === 1 ? '' : 's'} `
          + 'beside its runtime loop\'s token payments; pass one childTokenTransfers entry for each',
        );
      }
      for (const container of [...loopTokenContainers]
        .sort((left, right) => left.tokenContainerSlotIndex - right.tokenContainerSlotIndex)) {
        const category = container.tokenContainerCategoryId;
        const { unlocker, ...utxo } = container.utxo!;
        const paid = effectSpan.reduce((sum, effect) => sum
          + (effect.kind === 'token' && effect.category === category ? effect.amount : 0n), 0n)
          + transfers.reduce((sum, transfer) => sum + (transfer.categoryId === category ? transfer.amount : 0n), 0n);
        const held = utxo.token?.amount ?? 0n;
        if (paid > held) {
          throw new Error(
            `'${deployFunctionName}' pays ${paid} tokens of ${category}, but its container holds ${held}`,
          );
        }
        const nft = utxo.token?.nft;
        const nftSent = effectSpan.some((effect) => effect.kind === 'nft' && effect.category === category);
        const keptNft = nft !== undefined && (!nftSent || nft.capability === 'minting') ? nft : undefined;
        if (paid === held && keptNft === undefined) {
          // An emptied container leaves a filler, which its covenant admits only when the transfers at its own slots
          // cover the tokens it held; a runtime loop's payments are not among them.
          throw new Error(
            `'${deployFunctionName}' empties its token container for ${category}, which a creating call does not lay `
            + 'out: an emptied container leaves a filler, which its covenant admits only when the transfers at its own '
            + 'slots cover its tokens; leave a token in it',
          );
        }
        tokenContainerInputs.push({ utxo, unlocker });
        remainderOutputs.push({
          to: unlocker.generateLockingBytecode(),
          amount: utxo.satoshis,
          token: { category, amount: held - paid, ...(keptNft === undefined ? {} : { nft: keptNft }) },
        });
      }
      for (const t of transfers) {
        transferOutputs.push({ to: t.to, amount: dataNftAmount, token: { category: t.categoryId, amount: t.amount } });
        tokenTransferCost += dataNftAmount;
      }
      tokenContainerOutputs.push(...remainderOutputs, ...transferOutputs);
    } else {
      if (transfers.length === 0) {
        throw new Error(
          `Deploy function '${deployFunctionName}' transfers tokens from the factory's container; pass `
          + 'childTokenTransfers [{ categoryId, to, amount }] (one per FT transfer the deploy performs). NFT '
          + '(transferNft) transfers on deploy are not yet supported.',
        );
      }
      // Group by category - one co-spent container + recreated remainder (amount minus the transfers) per category,
      // then ALL tcTransfer outputs (block layout groups [..all tokenContainer.., ..all tcTransfer.., deploy]).
      const byCategory = new Map<string, Array<{ to: string | Uint8Array; amount: bigint }>>();
      for (const t of transfers) {
        const list = byCategory.get(t.categoryId) ?? [];
        list.push({ to: t.to, amount: t.amount });
        byCategory.set(t.categoryId, list);
      }
      for (const [tcCat, ts] of byCategory) {
        const tcAddr = getTokenContainerAddress(factory.inner, factory.categoryId, tcCat);
        const sumAmount = ts.reduce((s, t) => s + t.amount, 0n);
        const tcUtxo = (await provider.getUtxos(tcAddr)).find(
          (u) => u.token?.category === tcCat && (u.token?.amount ?? 0n) >= sumAmount && !u.token?.nft,
        );
        if (!tcUtxo) {
          throw new Error(
            `Factory '${factory.name}' has no fungible token container for category ${tcCat} with >= ${sumAmount} `
            + `tokens at ${tcAddr}. Fund the container before deploying.`,
          );
        }
        tokenContainerInputs.push({
          utxo: tcUtxo, unlocker: createTokenContainerUnlocker(factory.inner, 0, factory.categoryId, tcCat),
        });
        // Recreated container (self-preserved LBC, amount minus the transfers); satoshis preserved from the input.
        remainderOutputs.push({
          to: tcAddr,
          amount: tcUtxo.satoshis,
          token: { category: tcCat, amount: (tcUtxo.token!.amount ?? 0n) - sumAmount },
        });
      }
      // tcTransfer outputs in the caller's order (must match the deploy fn's transfer-statement order, which the
      // covenant verifies slot-by-slot): `amount` tokens of the category to the recipient, dust sats from funding.
      for (const t of transfers) {
        transferOutputs.push({ to: t.to, amount: dataNftAmount, token: { category: t.categoryId, amount: t.amount } });
        tokenTransferCost += dataNftAmount;
      }
      tokenContainerOutputs.push(...remainderOutputs, ...transferOutputs);
    }
  }

  // Event NFT placeholders (PairCreated etc.) sit between entries and the return-event in block layout.
  // Seed known emit payloads off-chain when the probe may not reach the event verify (createPair:
  // PairCreated(token0, token1, pair, allPairs.length) after dual getPair inserts).
  const emitInfos = deployAbi.emits ?? [];
  const eventPlaceholderOutputs: Array<{ to: string | Uint8Array; amount: bigint; token?: any }> = [];
  const priorAllPairs = Array.isArray(onChainState.state?.allPairs)
    ? (onChainState.state.allPairs as unknown[])
    : [];
  const nextAllPairsLength = BigInt(priorAllPairs.length + 1);
  for (const emitInfo of emitInfos) {
    const eventDef = (factory.inner.artifact.events ?? []).find((e) => e.signature === emitInfo.eventSignature);
    const isAnonymous = eventDef?.anonymous === true;
    const eventNftAddress = eventDef === undefined
      ? scriptToLockingBytecode(
        buildEventNftCovenantScript(
          hexToBin(factory.categoryId), computeEventNameHash(emitInfo.eventSignature),
        ),
        factory.inner.addressType,
      )
      : isAnonymous
        ? getAnonymousEventNftAddress(factory.inner, factory.categoryId)
        : getEventNftAddress(factory.inner, factory.categoryId, emitInfo.eventSignature);
    let eventPayload = '00';
    // createPair PairCreated(token0, token1, pair, allPairs.length) - all args known off-chain.
    if (
      eventDef
      && sortedTokenLbcs
      && eventDef.parameters.length === 4
      && eventDef.parameters[0].type.startsWith('address')
      && eventDef.parameters[2].type.startsWith('address')
    ) {
      const eventArgs: unknown[] = [
        sortedTokenLbcs[0], sortedTokenLbcs[1], pairAddressValue, nextAllPairsLength,
      ];
      // Encode exactly as the wide-event covenant does: evm-notation numbers keep their natural width, so a
      // uint256 arg is 32 bytes (not the variable-length VM number encodePushdataValue would produce).
      const parts = eventDef.parameters.map((p, i) => encodeEventParameter(
        eventArgs[i] as StateValue, p, factoryLayout.structs,
      ));
      const total = parts.reduce((n, p) => n + p.length, 0);
      const payload = new Uint8Array(total);
      let off = 0;
      for (const part of parts) { payload.set(part, off); off += part.length; }
      eventPayload = binToHex(payload);
    }
    const chunks = splitEventPayload(
      hexToBin(eventPayload), factoryLayout.commitmentLimit ?? EVENT_CHUNK_BYTES,
    );
    eventPlaceholderOutputs.push({
      to: eventNftAddress,
      amount: dataNftAmount,
      token: {
        category: factory.categoryId, amount: 0n,
        nft: { capability: 'none', commitment: binToHex(chunks[0]) },
      },
    });
    // A wide emit's continuation chunks occupy the eventChunk slots immediately after its event slot. A chunk the
    // payload does not reach stays a neutral no-token output so the return event and child genesis keep their
    // fixed block-layout offsets (the covenant verifies an absent own-category token at that slot).
    const eventChunkSlots = (deployAbi.blockLayout?.slots ?? []).filter(
      (slot) => slot.kind === 'eventChunk' && slot.slotIndex === emitInfo.emitIndex,
    ).sort((a, b) => (a.chunk ?? 0) - (b.chunk ?? 0));
    for (let chunk = 1; chunk <= eventChunkSlots.length; chunk++) {
      const data = chunks[chunk];
      eventPlaceholderOutputs.push(data === undefined
        ? { to: new Uint8Array([0x51]), amount: 1000n }
        : {
          to: eventContinuationLockingBytecode(factory.categoryId, emitInfo.eventSignature, isAnonymous),
          amount: dataNftAmount,
          token: {
            category: factory.categoryId, amount: 0n,
            nft: { capability: 'none', commitment: binToHex(data) },
          },
        });
    }
  }

  // Dynamic-storage writes trail the fixed block after vmap batch P' (covenant: blockSize +
  // vmapBatchTrailingCount + i). Seed createPair allPairs.push(pair) off-chain so both the probe and
  // the real send place the chunk NFT the write epilogue EQUALVERIFYs.
  const earlyAllPairs = [...priorAllPairs, pairAddressValue] as StateValue[];
  const dynamicWriteChunkOutputs: Array<{ to: string | Uint8Array; amount: bigint; token?: any }> = [];
  for (const varName of deployAbi.dynamicWrites ?? []) {
    const variable = factoryLayout.variables?.find((v) => v.name === varName && v.dynamic);
    if (!variable) continue;
    // Prefer the createPair-known allPairs value; other dynamic writes need probe derivation.
    const rawValue: StateValue | undefined = varName === 'allPairs' ? earlyAllPairs : undefined;
    if (rawValue === undefined) continue;
    const blob = encodePushdataValue(rawValue, variable.type, factoryLayout.structs);
    if (blob.length === 0) continue;
    const chunkAddr = getDynamicChunkAddress(factory.inner, factory.categoryId, varName, variable.type);
    for (const [chunkIndex, chunkData] of splitValueIntoChunks(blob).entries()) {
      dynamicWriteChunkOutputs.push({
        to: chunkAddr,
        amount: dataNftAmount,
        token: {
          category: factory.categoryId, amount: 0n,
          nft: {
            capability: 'mutable' as const,
            commitment: buildChunkCommitment(
              chunkIndex, chunkData, provider.consensusLimits?.maximumNftCommitmentBytes,
            ),
          },
        },
      });
    }
  }
  let deployProbeState: Record<string, StateValue> | undefined;
  if ((deployAbi.dynamicWrites ?? []).includes('allPairs')) {
    deployProbeState = { ...(onChainState.state ?? {}) } as Record<string, StateValue>;
    deployProbeState.allPairs = earlyAllPairs;
    const blob = encodePushdataValue(earlyAllPairs, 'address[]', factoryLayout.structs);
    deployProbeState[dynamicLenKey('allPairs')] = BigInt(blob.length);
  }
  // The inputs at the creator's deploy slots (A6, Indices): each child's deployer coin at the input its site binds,
  // then the wallet's coins. A slot no run reaches, before a later deployer coin, takes one of the wallet's coins.
  // When trailing inputs follow, the wallet's coins and then funder pads fill the indexes up to the trailing base, and
  // the wallet's other coins go after the trailing inputs (`tail`).
  const deployRegionSlots = (): Array<{ utxo: Utxo; unlocker: Unlocker } | undefined> => {
    const base = deploySites[0]!.inputIndex;
    const slots: Array<{ utxo: Utxo; unlocker: Unlocker } | undefined> = [];
    for (const child of creation!.children) {
      const at = deploySites[child.site]!.inputIndex + child.iteration - base;
      if (slots[at] !== undefined) {
        throw new DeployerPathError(`Two deployments of '${deployFunctionName}' bind input ${base + at}`);
      }
      slots[at] = { utxo: child.prep.deployerCoin, unlocker: child.unlocker };
    }
    return slots;
  };
  const regionPads: Array<{ utxo: Utxo; unlocker: Unlocker }> = [];
  if (creation !== undefined) {
    const slots = deployRegionSlots();
    const gaps = slots.filter((slot) => slot === undefined).length;
    const reach = deployTrailingInputs.length === 0 ? 0 : trailingInputBase - deploySites[0]!.inputIndex - slots.length;
    if (reach < 0) {
      throw new DeployerPathError(`The deployer coins of '${deployFunctionName}' overlap its trailing inputs`);
    }
    for (let pad = Math.max(0, reach + gaps - creation.walletCoins.length); pad > 0; pad -= 1) {
      regionPads.push({ utxo: await takeFunder(), unlocker: placeholderFunder });
    }
  }
  const deployRegionInputs = (): {
    head: Array<{ utxo: Utxo; unlocker: Unlocker }>; tail: Array<{ utxo: Utxo; unlocker: Unlocker }>;
  } => {
    if (creation === undefined) return { head: fundingUtxos.map((fu) => ({ utxo: fu, unlocker: funder })), tail: [] };
    const slots = deployRegionSlots();
    const wallet = [...creation.walletCoins];
    const pads = [...regionPads];
    const region: Array<{ utxo: Utxo; unlocker: Unlocker }> = [];
    for (let at = 0; at < slots.length; at += 1) {
      const entry = slots[at] ?? wallet.shift() ?? pads.shift();
      if (entry === undefined) {
        throw new DeployerPrepError(`No coin of the wallet fills input ${deploySites[0]!.inputIndex + at} of '${deployFunctionName}'`);
      }
      region.push(entry);
    }
    if (deployTrailingInputs.length === 0) return { head: [...region, ...wallet], tail: [] };
    const reach = trailingInputBase - deploySites[0]!.inputIndex - region.length;
    const filling = wallet.splice(0, reach);
    return { head: [...region, ...filling, ...pads.splice(0, reach - filling.length)], tail: wallet };
  };
  // A5, A14 item 7: the locktime the creation carries, for a creator that checks `tx.time`: an earlier run's, else item
  // 7's value for the children's block reads. The creator's run below settles it, and builds the creation again from it.
  const blockReaders = creation?.children.filter((child) => child.deployer.constructorBlockField !== undefined) ?? [];
  const derivationLocktime = plan?.locktime ?? (blockReaders.length === 0 ? undefined : Math.max(
    ...await Promise.all(blockReaders.map(async (child) => (await deployerLocktime(child.deployer, provider))!)),
  ));
  // Derive factory state + entry commitments via VM probe. Inputs: master, data NFTs,
  // existing entries, [satoshi container], funding. Outputs: master, data NFTs, entries,
  // [container, value transfer], return event, child outputs.
  const {
    state: derivedState, stateCommitments: derivedStateCommitments, entryCommitments,
    childCommitments: derivedChildCommitments, returnBlob,
    keccakCoSpends: derivedKeccakCoSpends, eventCommitments: derivedEventCommitments,
  } = await (factory as any)._deriveCommitments(
    deployFunctionName, finalArgs, requiredNftIndices,
    [...entryPlaceholderOutputs, ...containerOutputs, ...tokenContainerOutputs,
      ...eventPlaceholderOutputs, ...returnEventPlaceholders, ...childProbeOutputs,
      ...deployTrailingOutputs, ...loopTransferOutputs, ...dynamicWriteChunkOutputs],
    [...entryExtraInputs, ...containerInputs, ...tokenContainerInputs,
      ...deployRegionInputs().head,
      ...deployTrailingInputs,
      ...deployRegionInputs().tail],
    entryInfos.length,
    childLayout?.dataNftCount ?? 0,
    deployTarget.hasFoldedChildCall === true,
    returnEventPlaceholders.length,
    containerOutputs.length + tokenContainerOutputs.length,
    trailingEntryPlaceholderOutputs.length,
    entryPlaceholderOutputs.length + containerOutputs.length + tokenContainerOutputs.length
      + eventPlaceholderOutputs.length + returnEventPlaceholders.length
      + (hasDeployDataNftSlots || creation !== undefined
        ? childExtraOutputs.length : (childExtraOutputs.length > 0 ? 1 : 0)),
    deployProbeState,
    eventPlaceholderOutputs.length,
    derivationLocktime,
  );
  const keccakCoSpends = derivedKeccakCoSpends ?? [];
  // A direct unbounded keccak256 chained read on the deploy function routes its preimage through the trailing
  // START/CONT/FINAL side-cars. Resolve them here so the finalized transaction co-spends them at
  // trailingBase + i; the derivation probe above already used the same side-cars to derive the digest state.
  let deployKeccakChain: { sideCars: UnlockableUtxo[]; recreates: Output[] } | undefined;
  // The default fee's slot term does not cover the chain: each step spends ~3.9 KB (budget pad, redeem, its
  // recreation) and FINAL also carries the whole argument.
  let chainFee = 0n;
  if (deployAbi.keccakChainReads) {
    const chainResolution = await (factory as any)._resolveKeccakComputeCoSpends(deployAbi, finalArgs, {
      masterUtxo, stateInputUnlocker, dataNftUtxos: filteredDataNftUtxos, dataNftUnlockers,
    });
    deployKeccakChain = chainResolution.chain;
    const preimage: Uint8Array | null | undefined = chainResolution.preimages?.[0];
    if (options.fee === undefined && deployKeccakChain) {
      chainFee = BigInt(deployKeccakChain.sideCars.length * 4_000 + (preimage?.length ?? 0));
    }
  }

  // Deploy-then-call fold: the covenant may verify a post-call child genesis (a same-tx
  // `child.foo(args)` folded into the deploy). Prefer the trace-derived commitment; fall back to the
  // static initial state for a plain deploy that lands the child at default. See deploy-then-call-fold.md.
  const effectiveChildCommitmentsOf = (k: number): string[] => Array.from(
    { length: childLayout!.dataNftCount },
    (_, i) => {
      const derived = deployTarget.hasFoldedChildCall && k === 0 ? derivedChildCommitments[i] : undefined;
      return typeof derived === 'string' && derived.length > 0 ? derived : childCommitmentsOf(k)[i];
    },
  );
  // The sorted-list plan already supplies exact link/value commitments for ordinary deploy writes. A probe can
  // stop before exposing every entry pin when deployDataNft slots precede the trailing region; retain the
  // authenticated plan seed for any missing/empty observation rather than treating an empty trace as state.
  const seededEntryCommitments = [
    ...entryInfos.map((info) => info.fixedCommitment),
    ...trailingEntrySpecs.map((spec) => spec.commitment),
  ];
  const effectiveEntryCommitments = seededEntryCommitments.map((seed, index) => {
    const derived = entryCommitments[index];
    return typeof derived === 'string' && derived.length > 0 ? derived : seed;
  });
  const expectedEntryCommitmentCount = entryInfos.length + trailingEntryPlaceholderOutputs.length;
  if (expectedEntryCommitmentCount > 0 && effectiveEntryCommitments.length < expectedEntryCommitmentCount) {
    throw new Error(
      `Failed to derive entry NFT commitments for deploy function '${deployFunctionName}'. `
      + 'Ensure the function writes all accessed mapping entries.',
    );
  }

  // Read current factory state and apply derived updates
  const factoryCurrentState: Record<string, StateValue> = {};
  for (let i = 0; i < requiredNftIndices.length; i++) {
    const nftIdx = requiredNftIndices[i];
    const nftUtxo = filteredDataNftUtxos[i];
    if (nftUtxo?.token?.nft?.commitment) {
      const parsed = parsePushdataCommitment(nftUtxo.token.nft.commitment, factoryLayout, nftIdx);
      for (const [key, value] of Object.entries(parsed)) {
        factoryCurrentState[key] = value as StateValueType;
      }
    }
  }

  if (derivedState) {
    for (const [key, value] of Object.entries(derivedState)) {
      factoryCurrentState[key] = value as StateValueType;
    }
  }
  if ((deployAbi.dynamicWrites ?? []).includes('allPairs')) {
    const existing = Array.isArray(factoryCurrentState.allPairs)
      ? factoryCurrentState.allPairs as unknown[] : priorAllPairs;
    if (existing.length <= priorAllPairs.length) factoryCurrentState.allPairs = earlyAllPairs;
    const blob = encodePushdataValue(factoryCurrentState.allPairs, 'address[]', factoryLayout.structs);
    factoryCurrentState[dynamicLenKey('allPairs')] = BigInt(blob.length);
  }

  // Build the deployment transaction
  const { TransactionBuilder } = await import('../TransactionBuilder.js');
  const builder = new TransactionBuilder({
    provider,
    skipAutomaticCoSpends: true,
    ...(options.maxFee !== undefined && { maximumFeeSatoshis: options.maxFee }),
  });

  // Input 0: factory master UTXO
  builder.addInput(masterUtxo, stateInputUnlocker);

  // Inputs 1..N: factory data NFTs
  for (let i = 0; i < filteredDataNftUtxos.length; i++) {
    builder.addInput(filteredDataNftUtxos[i], dataNftUnlockers[i]);
  }

  for (const cs of keccakCoSpends) builder.addInput(cs.utxo, cs.unlocker);

  // Existing entry NFT inputs (mapping writes to pre-existing keys), at their slot offsets
  for (const { utxo, unlocker } of entryExtraInputs) {
    builder.addInput(utxo, unlocker);
  }

  // Satoshi container input (the value source for a new C{value:}() transfer), after entries + before funding.
  for (const ci of containerInputs) {
    builder.addInput(ci.utxo, ci.unlocker);
  }

  // Token container input(s) (the source for a token transfer during deploy), after entries + before funding.
  for (const ti of tokenContainerInputs) {
    builder.addInput(ti.utxo, ti.unlocker);
  }
  // Funding UTXOs for the children's token genesis - N inputs, one per child (a balanced contract block: N
  // deploy output groups need N balancing inputs). Each is at vout 0 so its txid sources the child's category.
  // Through deployers: each deployer coin at the input its site binds, then the author coins.
  if (creation !== undefined && creation.children.length > 0 && builder.inputs.length !== deploySites[0]!.inputIndex) {
    throw new DeployerPathError(
      `'${deployFunctionName}' binds its first deployer coin at input ${deploySites[0]!.inputIndex}, but the creation `
      + `has ${builder.inputs.length} inputs before it`,
    );
  }
  const regionInputs = deployRegionInputs();
  for (const { utxo, unlocker } of regionInputs.head) builder.addInput(utxo, unlocker);

  // Trailing run after the funding input: one funder pad at the deployDataNft output-only slot, then the
  // collection-iteration HEAD + entries and/or the runtime-loop predecessor at input[blockSize+...],
  // matching the compiled trailing input coordinates.
  for (const { utxo, unlocker } of deployTrailingInputs) {
    builder.addInput(utxo, unlocker);
  }
  for (const { utxo, unlocker } of regionInputs.tail) builder.addInput(utxo, unlocker);

  // Chained keccak256 side-cars ride the trailing region after every fixed slot. Pad any fixed gap (the
  // deployDataNft slot is output-only) so the START side-car lands at trailingBase, then append the chain.
  let chainPadSats = 0n;
  if (deployKeccakChain) {
    const trailingBase = deployAbi.blockLayout?.trailingBase
      ?? deployAbi.blockLayout?.blockSize ?? builder.inputs.length;
    while (builder.inputs.length < trailingBase) {
      const pad = await takeFunder();
      chainPadSats += pad.satoshis;
      builder.addInput(pad, placeholderFunder);
    }
    builder.addInputs(deployKeccakChain.sideCars);
  }

  // The child token rows' seed coins are foreign to the factory. They sit after every factory-slot input, so no
  // compiled input index shifts.

  // === Factory outputs (first) ===

  // Output 0: factory master UTXO (preserved)
  builder.addOutput({
    to: factory.inner.tokenAddress,
    amount: masterUtxo.satoshis,
    token: {
      category: factory.categoryId,
      amount: masterUtxo.token?.amount ?? 0n,
      nft: { capability: 'minting', commitment: masterUtxo.token?.nft?.commitment ?? '' },
    },
  });

  // Outputs 1..N: factory data NFTs with updated commitments, each value the run leaves as it was keeping the bytes
  // the run derived or the input holds.
  for (let i = 0; i < filteredDataNftUtxos.length; i++) {
    const nftIdx = requiredNftIndices[i];
    const nftUtxo = filteredDataNftUtxos[i];
    const commitment = buildPushdataCommitmentKeeping(factoryLayout, factoryCurrentState, nftIdx, [
      (derivedStateCommitments as string[] | undefined)?.[i], nftUtxo.token?.nft?.commitment,
    ]);

    builder.addOutput({
      to: dataNftUnlockers[i].generateLockingBytecode(),
      amount: nftUtxo.satoshis,
      token: {
        category: factory.categoryId,
        amount: nftUtxo.token?.amount ?? 0n,
        nft: {
          capability: nftUtxo.token?.nft?.capability ?? 'mutable',
          commitment,
        },
      },
    });
  }

  for (const cs of keccakCoSpends) builder.addOutput(cs.recreate);

  // Entry NFT outputs, after the data NFTs; commitments derived from the VM trace above.
  for (let i = 0; i < entryInfos.length; i++) {
    const info = entryInfos[i];
    const entryAddress = getEntryNftAddress(factory.inner, factory.categoryId, info.collection);
    builder.addOutput({
      to: entryAddress,
      amount: entryExtraInputs[i]?.utxo.satoshis ?? info.proofUtxo.satoshis,
      token: {
        category: factory.categoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: effectiveEntryCommitments[i] },
      },
    });
  }

  // Satoshi container output (recreated, minus the transferred value) + the value transfer to the child, at
  // their block-layout slots (after entries, before the return event / child geneses). See the new C{value:}()
  // handling above. Order matches the layout: satoshiContainer, then transfer.
  // The transfer slots follow the recreated satoshi container.
  const fixedTransferBase = builder.outputs.length + 1;
  for (const co of containerOutputs) {
    builder.addOutput({ to: co.to, amount: co.amount });
  }

  // Token container output(s): the recreated container (remainder) then each tcTransfer, at their block-layout
  // slots (after entries / satoshi container, before the return event + child geneses). Matches the layout order
  // [.., tokenContainer, tcTransfer, ..] and the probe extraOutputs above.
  for (const tco of tokenContainerOutputs) {
    builder.addOutput({ to: tco.to, amount: tco.amount, ...(tco.token ? { token: tco.token } : {}) });
  }

  for (let i = 0; i < eventPlaceholderOutputs.length; i++) {
    const output = eventPlaceholderOutputs[i];
    const commitment = derivedEventCommitments?.[i] || output.token?.nft?.commitment;
    builder.addOutput({
      ...output,
      token: output.token ? {
        ...output.token,
        nft: output.token.nft ? { ...output.token.nft, commitment } : undefined,
      } : undefined,
    });
  }

  // Return-event (B8) output for a returning deploy function, at its block-layout slot (after entries, before
  // the child genesis). Commitment = the derived return value; anyone-can-spend (OP_TRUE), factory category.
  if (returnEventPlaceholders.length > 0) {
    if (!returnBlob) {
      // The child address is already fixed by the funding category, constructor, and computed salt. For a
      // returning deploy such as createPair, it is therefore an authoritative seed even when an earlier vmap
      // verify prevents the derivation trace from reaching the return-event comparison.
      builder.addOutput({
        to: new Uint8Array([0x51]),
        amount: 800n,
        token: {
          category: factory.categoryId, amount: 0n,
          nft: { capability: 'none', commitment: predictedReturnCommitment },
        },
      });
    } else {
      builder.addOutput({
        to: new Uint8Array([0x51]),
        amount: 800n,
        token: {
          category: factory.categoryId, amount: 0n,
          nft: { capability: 'none', commitment: binToHex(returnBlob) },
        },
      });
    }
  }

  // === Child contract outputs (appended after factory outputs) ===
  // N child genesis groups at consecutive stride-sized slots (the covenant's runtime deploy counter indexes
  // output[slotBase + counter*stride]). Group k carries fundingUtxos[k]'s category + that child's self-pinned
  // address; the data NFT commitment is the shared default (a loop mints the same child type each iteration).
  // Each child's genesis group in the finished creation: its range, and the records its `create` run computes.
  const childGroups: Array<{
    min: number; max: number; records: number[];
    journals: Array<{ collection: string; head: number; rows: number[]; depth: number }>;
  }> = [];
  const addTrailingEntries = (): void => {
    let trailingCommitmentIndex = entryInfos.length;
    for (const spec of trailingEntrySpecs) {
      builder.addOutput({
        to: getEntryNftAddress(factory.inner, factory.categoryId, spec.collection),
        amount: dataNftAmount,
        token: {
          category: factory.categoryId, amount: 0n,
          nft: { capability: 'mutable', commitment: effectiveEntryCommitments[trailingCommitmentIndex++] },
        },
      });
    }
  };
  // Through deployers: the deploy slots, each child's group where its site puts it, then the creator's own trailing
  // entries.
  let regionFillers = 0;
  let regionCost = 0n;
  if (creation !== undefined) {
    const start = builder.outputs.length;
    const region = deployRegion();
    for (const output of region.outputs) builder.addOutput(output as any);
    regionFillers = region.fillers;
    for (const { k, at, group } of region.groups) {
      const min = start + at;
      regionCost += group.baseCost;
      childGroups[k] = {
        min,
        max: min + group.outputs.length,
        records: group.records.map((index) => min + index),
        journals: group.journals.map((journal) => ({
          ...journal, head: min + journal.head, rows: journal.rows.map((index) => min + index),
        })),
      };
    }
    addTrailingEntries();
  }
  for (let k = 0; k < (creation === undefined ? childCount : 0); k++) {
    const cc = childContracts[k];
    const cat = fundingUtxos[k].txid;
    const dnAddr = getDataNftAddress(cc, cat);
    const group = {
      min: builder.outputs.length, max: 0, records: [] as number[],
      journals: [] as Array<{ collection: string; head: number; rows: number[]; depth: number }>,
    };
    childGroups.push(group);
    // Child minting NFT - use unsalted address to match compiler's `new` expression
    builder.addOutput({
      to: cc.tokenAddress,
      amount: masterAmount,
      token: { category: cat, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    });
    if (k === 0 && !hasDeployDataNftSlots) addTrailingEntries();
    // Child data NFTs
    for (let i = 0; i < childLayout!.dataNftCount; i++) {
      group.records.push(builder.outputs.length);
      builder.addOutput({
        to: dnAddr,
        amount: dataNftAmount,
        token: { category: cat, amount: 0n, nft: { capability: 'mutable', commitment: effectiveChildCommitmentsOf(k)[i] } },
      });
    }
    for (const entry of childGenesisEntries) {
      builder.addOutput({
        to: getEntryNftLockingBytecode(cc, cat, entry.collectionSignature),
        amount: dataNftAmount,
        token: {
          category: cat, amount: 0n,
          nft: { capability: 'mutable', commitment: entry.commitment },
        },
      });
    }
    if (k === 0 && hasDeployDataNftSlots) addTrailingEntries();
    for (const row of childTokenRows(k)) builder.addOutput(row);
    // Loop {value:}: the value transfer to this child, interleaved as the last output of its group.
    if (isLoopValueDeploy) {
      builder.addOutput({ to: cc.address, amount: options.childValue ?? 0n });
    }
    group.max = builder.outputs.length;
  }

  // Collection-iteration entries are recreated 1:1 and runtime-loop P'/NEW nodes are minted at their compiled
  // trailing coordinates, before any dynamic-chunk outputs, so the outside-layout census sees them where spent.
  for (const output of deployTrailingOutputs) builder.addOutput(output);

  // A runtime loop's payments, at the outputs the creator's runtime-loop verification reads after the trailing ones.
  const loopTransferBase = builder.outputs.length;
  for (const output of loopTransferOutputs) builder.addOutput({ ...output });

  for (const output of dynamicWriteChunkOutputs) builder.addOutput(output);

  // Chained keccak256 side-car recreations carry the running state and the FINAL digest at the trailing
  // outputs. Pad any fixed gap with a neutral dust output so the START recreation lands at trailingBase.
  if (deployKeccakChain) {
    const trailingBase = deployAbi.blockLayout?.trailingBase
      ?? deployAbi.blockLayout?.blockSize ?? builder.outputs.length;
    while (builder.outputs.length < trailingBase) {
      builder.addOutput({ to: new Uint8Array([0x51]), amount: 1000n });
    }
    for (const recreate of deployKeccakChain.recreates) builder.addOutput(recreate);
  }

  // The paying wallet's coins for the children's containers, after every compiled input coordinate, and the outputs
  // that follow every compiled output: containers without a row, and units returned to the wallet (A14 item 11).
  for (const funding of childFunding) {
    for (const { utxo, unlocker } of funding.inputs) builder.addInput(utxo, unlocker);
  }
  for (const funding of childFunding) {
    for (const output of funding.extraOutputs) builder.addOutput(output);
  }
  // What opening the containers adds to the outputs beyond the default rows, less the wallet coins it spends.
  const childFundingNet = childFunding.reduce((sum, funding, child) => {
    const rows = funding.tokenRows.reduce((total, row) => total + row.satoshis, 0n);
    const extra = funding.extraOutputs.reduce((total, output) => total + output.amount, 0n);
    const coins = funding.inputs.reduce((total, { utxo }) => total + utxo.satoshis, 0n);
    const raised = funding.satoshis === undefined ? 0n
      : childSatoshiRowFor(child).amount - childSatoshiRow(child).amount;
    return sum + rows + extra + raised - coins;
  }, 0n);

  // A7, A14 item 4 step 6: each child whose `create` co-spends side-cars or calls contracts has its side-cars and callee
  // blocks after every index the creator's layout uses, in run order. What they spend beyond what they pin joins the
  // change. The callees follow from each child's Q ‖ A: until a run of the creator has shown it, a guess that names
  // other callees is the run's to correct, and a refusal is kept only if the run binds the guess.
  const childCalls: Array<{ placed: PlacedConstructorCalls; child: CreationChild; contractCount: number }> = [];
  let childCallSurplus = 0n;
  let deferredCallRefusal: Error | undefined;
  const grouped = (creation?.children ?? []).map((child, deployment) => ({ child, deployment }))
    .filter(({ child }) => (child.deployer.callSlots > 0
      || child.deployer.sidecars.keccak + child.deployer.sidecars.ecrecover > 0) && child.binding.bound !== undefined);
  if (grouped.length > 0) {
    const shapes = grouped.map(({ child, deployment }) => {
      const visible = child.deployer.abi.find((entry) => entry.name === 'create')!.inputs
        .filter((input) => !input.name.startsWith('__internal__'));
      const contractCount = visible.length - child.constructorCount;
      const binding = decodeDeployBinding(
        child.binding.bound!, child.deployer, child.constructorCount, child.artifact.structs,
      );
      // `create`'s public arguments by name: the contract parameters, then the runtime constructor's.
      const args: Record<string, FunctionArgument> = {};
      visible.forEach((input, index) => {
        args[input.name] = (index < contractCount
          ? binding.contractArgs[index] : binding.constructorArgs[index - contractCount]) as FunctionArgument;
      });
      const callees = options.childCallees?.find((entry) => entry.deployment === deployment)?.callees
        ?? options.childConstructorCallees;
      return {
        child, contractCount,
        group: {
          deployment, contractName: child.contractName, artifact: child.artifact, deployer: child.deployer,
          childLockingBytecode: hexToBin(child.contract.lockingBytecode), args, callees,
        },
      };
    });
    // A slot of a group that takes a wallet coin takes one of the paying wallet's own: a plain coin at the funder's lock
    // that no prep reserves and the creation does not already spend.
    const walletLock = funder.generateLockingBytecode();
    const spends = (coin: Utxo): boolean => (builder as any).inputs.some((input: Utxo) => input.vout === coin.vout
      && input.txid.toLowerCase() === coin.txid.toLowerCase());
    let walletPool: Utxo[] | undefined;
    const walletCoin = async (): Promise<{ utxo: Utxo; unlocker: Unlocker }> => {
      walletPool ??= (await provider.getUtxosForLockingBytecode(walletLock)).filter((coin) => coin.token === undefined
        && coin.satoshis >= 1000n && !isReservedGenesisOutpoint(genesisOutpointKey(coin.txid, coin.vout)));
      const coin = walletPool.find((candidate) => !spends(candidate));
      if (coin === undefined) {
        // A provider that mints coins on demand (a test network) funds the slot as the creator's own pads are funded.
        if (typeof (provider as { addUtxo?: unknown }).addUtxo === 'function') {
          return { utxo: await takeFunder(), unlocker: placeholderFunder };
        }
        throw new DeployerPrepError(
          `'${deployFunctionName}' lays out its children's side-cars and callee blocks with plain coins of the paying `
          + 'wallet, and the funder\'s lock holds no more of them',
        );
      }
      walletPool = walletPool.filter((candidate) => candidate !== coin);
      return { utxo: { ...coin, lockingBytecode: walletLock }, unlocker: funder };
    };
    try {
      const placed = await placeChildCreationGroups({
        builder: builder as never, provider, children: shapes.map((shape) => shape.group), filler: walletCoin,
      });
      childCallSurplus = placed.surplus;
      for (const [index, group] of placed.groups.entries()) {
        const { child, contractCount } = shapes[index]!;
        if (group.sidecarBase !== undefined) child.sidecarBase = group.sidecarBase;
        if (group.placed === undefined) continue;
        childCalls.push({ placed: group.placed, child, contractCount });
        child.calls = { callees: group.placed.masters, synthetic: group.placed.synthetic(child.deployer) };
      }
    } catch (error) {
      if (grouped.every(({ child }) => child.boundByRun)) throw error;
      deferredCallRefusal = error as Error;
    }
  }

  // Change output. New entries cost dust from the funding UTXOs; existing entries are
  // satoshi-neutral (input funds output). N children cost N * (master + data NFTs); the N funding inputs' total
  // satoshis cover them (any value >= that cost). The iteration chain is satoshi-neutral, but its funder pad has
  // no matching output, so the pad's satoshis join the change.
  const newEntryCount = BigInt(trailingEntrySpecs.length);
  // A child's satoshi-container row, or the filler at its index (A14 item 11), takes its satoshis from the funding
  // inputs (see the genesis-group loop above); so does a filler at a deploy slot no run reaches.
  const totalChildCost = creation !== undefined
    ? regionCost + 1000n * BigInt(regionFillers)
    : BigInt(childCount) * (masterAmount
      + (dataNftAmount * BigInt(childLayout!.dataNftCount + childGenesisEntries.length)));
  const totalEntryCost = dataNftAmount * newEntryCount;
  const totalDynamicChunkCost = dataNftAmount * BigInt(dynamicWriteChunkOutputs.length);
  const eventCost = dataNftAmount * BigInt(eventPlaceholderOutputs.length + spanEvents);
  const returnEventCost = returnEventPlaceholders.length > 0 ? 800n : 0n;
  const totalFundingSats = fundingUtxos.reduce((sum, fu) => sum + fu.satoshis, 0n)
    + (creation?.walletCoins.reduce((sum, { utxo }) => sum + utxo.satoshis, 0n) ?? 0n);
  // The funder pads before the trailing inputs have no output of their own: their satoshis join the change.
  const trailingPadSats = creation === undefined ? deployTrailingInputs[0]?.utxo.satoshis ?? 0n
    : regionPads.reduce((sum, { utxo }) => sum + utxo.satoshis, 0n);
  // tokenTransferCost = dust for each tcTransfer output (the token container's own satoshis fund only its
  // recreated remainder; each transfer output's dust comes from the funding inputs).
  const changeAmount = totalFundingSats - childFundingNet + trailingPadSats + chainPadSats - totalChildCost - totalEntryCost
    - totalDynamicChunkCost - eventCost - returnEventCost
    - tokenTransferCost - spanTokenSatoshis * BigInt(spanTokenPayments) - fee - chainFee + childCallSurplus;
  // A change below the dust floor of any lock cannot relay; it is left to the miner rather than refused.
  let changeOutputIndex = -1;
  if (changeAmount >= 576n) {
    if (!changeAddress) {
      throw new Error(
        `deployFrom has ${changeAmount} satoshis of excess funding but no changeAddress was provided. `
        + 'Specify changeAddress in options or via factory.setDeployDefaults({ changeAddress }).',
      );
    }
    changeOutputIndex = builder.outputs.length;
    builder.addOutput({ to: changeAddress, amount: changeAmount });
  }

  const preps = creation?.children.map((child) => child.prep) ?? [];
  if (creation !== undefined) {
    const buildProgram = (): { transaction: any; sourceOutputs: ReturnType<typeof sourceOutputsOf> } => ({
      transaction: (builder as any).buildLibauthTransaction(),
      sourceOutputs: sourceOutputsOf((builder as any).inputs),
    });
    const outputs = (builder as any).outputs as Array<{ to: string | Uint8Array; amount: bigint }>;
    const inputOf = (coin: Utxo): number => (builder as any).inputs
      .findIndex((input: Utxo) => input.txid.toLowerCase() === coin.txid.toLowerCase() && input.vout === coin.vout);
    // A14 item 4 steps 2 and 8: the creator's run names the children it makes, the Q ‖ A each of its sites binds, and
    // its runtime loops' payments. A creation built from other values is built again from the run's (see the wrapper).
    const built = creation.children.map((child) => ({
      contractName: child.contractName,
      inputIndex: inputOf(child.prep.deployerCoin),
      binding: child.binding,
    }));
    // The contract a site creates is its slot's `new` (A6, Indices): a loop's one site, else the slot the site binds.
    // The deployer lock the site checks, where the trace shows it, must be that contract's.
    const contractOf = (visit: DeployerSiteVisit): string => {
      const site = deploySites.length === 1 ? deploySites[0]
        : deploySites.find((candidate) => candidate.inputIndex === visit.inputIndex);
      const named = site?.target.contractName;
      if (named === undefined) {
        throw new DeployerPrepError(`The creator binds input ${visit.inputIndex}, which is no deploy slot of '${deployFunctionName}'`);
      }
      const lock = childDeployers[named]?.lockingBytecode;
      if (visit.deployerLock !== undefined && lock !== visit.deployerLock) {
        throw new DeployerPrepError(`The creator's site at input ${visit.inputIndex} checks another deployer than '${named}'s`);
      }
      return named;
    };
    const fixedTarget: RuntimeLoopTransferTarget | undefined = fixedTransfers.length === 0 ? undefined : {
      getRuntimeLoopTransferOutputs: () => fixedTransfers,
      getRuntimeLoopTransferOutputIndex: (index) => fixedTransferBase + index,
      setRuntimeLoopTransferOutput: (index, lockingBytecode, amount) => {
        fixedTransfers[index] = { ...fixedTransfers[index]!, lockingBytecode: Uint8Array.from(lockingBytecode), amount };
        outputs[fixedTransferBase + index] = { to: Uint8Array.from(lockingBytecode), amount };
      },
      setRuntimeLoopNftTransferOutput: () => {
        throw new Error('deployFrom builds no NFT transfer at a transfer slot');
      },
    };
    const paymentsNow = (
      transfers: RuntimeLoopTransferOutput[],
    ): Array<{ lockingBytecode: Uint8Array; amount: bigint }> => transfers.map((transfer) => ({
      lockingBytecode: transfer.lockingBytecode, amount: transfer.amount,
    }));
    // A5, A14 item 7: one locktime for the children's block reads, the creator's `tx.time` checks and those an earlier
    // run showed of the children's callees, set before the creator's run settles anything else.
    const { locktime, needs: locktimeNeeds } = settleCreationLocktime({
      provider,
      build: buildProgram,
      creatorInputIndex: 0,
      creator: `the creator '${factory.name}' in '${deployFunctionName}'`,
      children: await Promise.all(blockReaders.map(async (child) => {
        const field = child.deployer.constructorBlockField!;
        return {
          need: {
            inputIndex: inputOf(child.prep.deployerCoin),
            who: `deployment ${creation!.children.indexOf(child)} ('${child.contractName}'), whose constructor reads `
              + `block.${field}`,
            kind: field === 'number' ? 'height' as const : 'time' as const,
            value: field === 'number' ? 0 : 500_000_000,
          },
          preferred: (await deployerLocktime(child.deployer, provider))!,
        };
      })),
      ...(plan?.locktimeNeeds === undefined ? {} : { extra: plan.locktimeNeeds }),
      setLocktime: (value) => { builder.setLocktime(value); },
    });
    const calleeNeeds = [...(plan?.locktimeNeeds ?? [])];
    if (locktime !== derivationLocktime) {
      throw new CreationPlanChanged({
        children: built.map((child) => ({
          contractName: child.contractName, inputIndex: child.inputIndex, bound: child.binding.bound,
        })),
        ...(plan?.effects === undefined ? {} : { effects: plan.effects }),
        ...(plan?.fixedTransfers === undefined ? {} : { fixedTransfers: plan.fixedTransfers }),
        ...(locktime === undefined ? {} : { locktime }),
        ...(calleeNeeds.length === 0 ? {} : { locktimeNeeds: calleeNeeds }),
      }, 'the creator\'s state was derived with another locktime than the creation needs');
    }
    const settledRun = settleCreatorRun({
      provider,
      build: buildProgram,
      creatorInputIndex: 0,
      children: built,
      contractOf,
      transfers: fixedTarget === undefined ? [] : [fixedTarget],
      effectSpan: { base: loopTransferBase, effects: effectSpan },
      plan: {
        children: [], effects: effectSpan, fixedTransfers: paymentsNow(fixedTransfers),
        ...(locktime === undefined ? {} : { locktime }),
      },
    });
    if (settledRun.learned) {
      throw new CreationPlanChanged({
        children: built.map((child) => ({
          contractName: child.contractName, inputIndex: child.inputIndex, bound: child.binding.bound,
        })),
        ...(settledRun.effects === undefined && plan?.effects === undefined
          ? {} : { effects: settledRun.effects ?? effectSpan }),
        fixedTransfers: paymentsNow(fixedTransfers),
        ...(locktime === undefined ? {} : { locktime }),
        ...(calleeNeeds.length === 0 ? {} : { locktimeNeeds: calleeNeeds }),
      }, 'the creator\'s run binds values the creation was not built from');
    }
    if (deferredCallRefusal !== undefined) throw deferredCallRefusal;
    // What the caller said must be what the run does; nothing is broadcast otherwise.
    const count = creation.children.length;
    if (options.deployments !== undefined && options.deployments !== count) {
      throw new DeployerPrepError(
        `This call creates ${count} child${count === 1 ? '' : 'ren'}, but deployments is `
        + `${options.deployments}; the creator's run decides how many`,
      );
    }
    const beyond = askedContainers.find((entry) => entry.deployment >= count);
    if (beyond !== undefined) {
      throw new DeployerPrepError(
        `childContainers names deployment ${beyond.deployment}, but this call creates ${count} `
        + `child${count === 1 ? '' : 'ren'}, numbered from 0 in run order`,
      );
    }
    const creatorCategory = Uint8Array.from(hexToBin(factory.categoryId)).reverse();
    for (const [k, child] of creation.children.entries()) {
      const binding = decodeDeployBinding(
        child.binding.bound ?? new Uint8Array(), child.deployer, child.constructorCount, child.artifact.structs,
      );
      if (binToHex(binding.senderCategory) !== binToHex(creatorCategory)) {
        throw new DeployerPrepError(`Deployment ${k} names another sender category than its creator's`);
      }
      if (child.contractName !== deployTarget.contractName) continue;
      if (options.childValue !== undefined && options.childValue !== binding.value) {
        throw new DeployerPrepError(
          `childValue is ${options.childValue}, but the creator's run sends ${binding.value} to deployment ${k}`,
        );
      }
      const asked = options.childConstructorArgs;
      if (asked !== undefined) {
        const visible = child.deployer.abi.find((entry) => entry.name === 'create')!.inputs
          .filter((input) => !input.name.startsWith('__internal__'));
        const contractTypes = visible.slice(0, visible.length - child.constructorCount).map((input) => input.type);
        const constructorTypes = visible.slice(visible.length - child.constructorCount).map((input) => input.type);
        const same = (values: readonly unknown[], expected: readonly StateValue[], types: string[]): boolean => {
          if (values.length !== expected.length) return false;
          try {
            return types.every((type, index) => binToHex(encodePushdataValue(values[index] as StateValue, type,
              child.artifact.structs)) === binToHex(encodePushdataValue(expected[index]!, type, child.artifact.structs)));
          } catch {
            return false;
          }
        };
        // The runtime constructor's arguments, or for a child without any, its contract arguments (`new C(…)`).
        if (!same(asked, binding.constructorArgs, constructorTypes)
          && !(child.constructorCount === 0 && same(asked, binding.contractArgs, contractTypes))) {
          throw new DeployerPrepError(
            `childConstructorArgs differs from what the creator's run binds for deployment ${k} ('${child.contractName}')`,
          );
        }
      }
    }
    // A14 item 4 step 4: complete each child's own Deploy<C> run, in run order. Its `create` pins only its own
    // group, and the creator binds only Q ‖ A and the child's master (A6), so the records it computes are patched
    // into the finished creation without touching what the creator checks.
    for (const [k, child] of creation.children.entries()) {
      const group = childGroups[k];
      if (group === undefined) continue;
      const dIn = inputOf(child.prep.deployerCoin);
      if (dIn < 0) throw new DeployerPrepError(`Deployment ${k}'s deployer coin is not an input of the creation`);
      const calls = childCalls.find((entry) => entry.child === child);
      if (calls !== undefined) {
        // A7: the callees answer this child, whose category input dIn creates and whose master is gOut. Each callee's
        // run is completed first, so the records this child's `create` reads are the callees'. A callee's `tx.time`
        // check that moves the creation's locktime builds the creation again with it (A5); one that conflicts with
        // another input's need is refused, naming both.
        const master = outputs.findIndex((output: any, index) => index >= group.min && index < group.max
          && output.token?.nft?.capability === 'minting');
        calls.placed.bind({
          categoryId: child.prep.category, gIn: dIn, gOut: master < 0 ? group.min : master, deployer: child.deployer,
          contractParameters: calls.contractCount,
          unlocking: buildProgram().transaction.inputs[dIn].unlockingBytecode,
        });
        // The callees' transfers, containers and events move satoshis within their blocks: the change takes the rest.
        const others = (): bigint => outputs.reduce(
          (sum, output, index) => sum + (index === changeOutputIndex ? 0n : output.amount), 0n,
        );
        let settledOthers = others();
        calls.placed.settle(provider, buildProgram, {
          amountsChanged: () => {
            const now = others();
            const moved = now - settledOthers;
            settledOthers = now;
            const change = changeOutputIndex >= 0 ? outputs[changeOutputIndex] : undefined;
            if (change === undefined && moved <= 0n) return;
            if (change === undefined || change.amount - moved < 576n) {
              throw new DeployerPrepError(
                `Deployment ${k}'s callees need ${moved} satoshis more than this call's change can give`,
              );
            }
            change.amount -= moved;
          },
          locktime: (found: readonly LocktimeNeed[]) => {
            const fresh = found.filter((need) => !locktimeNeeds.some((known) => known.inputIndex === need.inputIndex
              && known.kind === need.kind && known.value === need.value));
            if (fresh.length === 0) return false;
            const next = lowestCommonLocktime([...locktimeNeeds, ...fresh]);
            locktimeNeeds.push(...fresh);
            if (next === locktime) return false;
            throw new CreationPlanChanged({
              children: built.map((entry) => ({
                contractName: entry.contractName, inputIndex: entry.inputIndex, bound: entry.binding.bound,
              })),
              ...(plan?.effects === undefined ? {} : { effects: plan.effects }),
              fixedTransfers: paymentsNow(fixedTransfers),
              ...(next === undefined ? {} : { locktime: next }),
              locktimeNeeds: [...calleeNeeds, ...fresh],
            }, `deployment ${k}'s callees need another locktime than the creation has`);
          },
        });
      }
      const groupTotal = (): bigint => outputs.slice(group.min, group.max).reduce((sum, output) => sum + output.amount, 0n);
      let settled = groupTotal();
      const complete = (): void => completeCreateRun({
        provider,
        build: buildProgram,
        deployerInputIndex: dIn,
        outputs: (builder as any).outputs,
        range: { min: group.min, max: group.max },
        slots: {
          commitments: group.records,
          transfers: [],
          journals: group.journals.map((journal) => ({
            collection: journal.collection, depth: journal.depth, head: journal.head, rows: journal.rows,
            entryLock: getEntryNftAddress(childContracts[k], fundingUtxos[k].txid, journal.collection),
            category: fundingUtxos[k].txid,
          })),
        },
        amountsChanged: () => {
          // A row that now holds an entry takes RESERVE where its filler took less: the change pays the difference.
          const now = groupTotal();
          const moved = now - settled;
          settled = now;
          const change = changeOutputIndex >= 0 ? outputs[changeOutputIndex] : undefined;
          if (change === undefined || change.amount - moved < 576n) {
            throw new DeployerPrepError(
              `Deployment ${k}'s entries need ${moved} satoshis more than this call's change can give`,
            );
          }
          change.amount -= moved;
        },
      });
      try {
        complete();
      } catch (error) {
        if (!/operation cost/i.test((error as Error).message)) throw error;
        // A14 item 4 step 5: a constructor that costs more than its unlocking funds needs `__internal__budgetPad`.
        // Every unlocking byte grants budget and `create` drops the pad first: run with the longest pad a 10,000-byte
        // unlocking allows, then keep what the run spent. The change pays the pad's bytes at 1 sat/B.
        const emptyPadLength = buildProgram().transaction.inputs[dIn].unlockingBytecode.length;
        child.budgetPad = new Uint8Array(largestCreatePad(emptyPadLength));
        try {
          complete();
        } catch (padded) {
          if (!/operation cost/i.test((padded as Error).message)) throw padded;
          throw new DeployerPrepError(
            `The constructor of deployment ${k} ('${child.contractName}') needs more operations than a 10,000-byte `
            + `create unlocking funds: ${(padded as Error).message}`,
          );
        }
        child.budgetPad = fitCreatePad(provider, buildProgram(), dIn, child.budgetPad);
        complete();
        const change = changeOutputIndex >= 0 ? outputs[changeOutputIndex] : undefined;
        const padFee = BigInt(child.budgetPad.length);
        if (change === undefined || change.amount - padFee < 576n) {
          throw new DeployerPrepError(
            `Deployment ${k}'s budget pad of ${child.budgetPad.length} bytes needs more fee than this call's change can give`,
          );
        }
        change.amount -= padFee;
      }
    }
    // Run the whole creation in the VM before anything is broadcast (A14 item 4, steps 9 and 10). A refusal
    // here sends nothing, and the wrapper releases the coins the preps reserved.
    const sourceOutputs = sourceOutputsOf((builder as any).inputs);
    // A wallet's input holds a placeholder until the wallet signs it, and a placeholder cannot verify. The wallet
    // signs the creation here, before any prep is broadcast, so a wallet that declines leaves nothing on chain. Its
    // inputs then carry those signatures into `builder.send()`, which asks the wallet nothing more, and the VM
    // judges the transaction the network will receive.
    const unlockers: (Unlocker | undefined)[] = (builder as any).inputs
      .map((input: { unlocker?: Unlocker }) => input.unlocker);
    const transaction = await applyExternalSignatures(unlockers, (builder as any).buildLibauthTransaction(), sourceOutputs);
    unlockers.forEach((unlocker, index) => {
      if (!isExternallySignedUnlocker(unlocker)) return;
      const signed = transaction.inputs[index]!.unlockingBytecode;
      (builder as any).inputs[index].unlocker = {
        generateLockingBytecode: () => unlocker.generateLockingBytecode(),
        generateUnlockingBytecode: () => signed,
      } satisfies Unlocker;
    });
    const verdict = createVirtualMachineBch2026ForProvider(provider).verify({ transaction, sourceOutputs } as never);
    if (verdict !== true) {
      throw new DeployerPrepError(`The creation does not pass the VM, so nothing was broadcast: ${String(verdict)}`);
    }
    await refusePaymentsToStatefulMasters(provider, builder.inputs, builder.outputs);
    const sendsPreps = preps.some((prep) => !prep.broadcast);
    await broadcastDeployerPreps(preps, provider);
    // A coin the creation spends may move while its preps are sent: an oracle pool's keeper moves each info coin a
    // callee reads with each block. The call is then built again, from these preps, with the coins now listed.
    if (sendsPreps && (await staleCreationInputs(provider, transaction, sourceOutputs,
      preps.map((prep) => prep.category))).length > 0) {
      throw new CreationCoinsMoved(preps);
    }
  } else {
    await refusePaymentsToStatefulMasters(provider, builder.inputs, builder.outputs);
  }
  const tx = await builder.send();
  if (creation !== undefined) releaseDeployerPrepReservations(preps);

  // Connect the child with its categoryId. The compiler's `new C(...)` codegen now self-pins the child by
  // category (matching the SDK), so each child's self-pinned address equals the deployed genesis address.
  // See docs/external-contract-calls.md.
  const { StatefulContract: SC } = await import('./StatefulContract.js');
  const statefulChildren = childContracts.map((child, index) => new SC(
    child, fundingUtxos[index]?.txid ?? childCategoryId,
  ) as ConnectedStatefulContract<T>);
  // Replace the early address predictions with the connected handles: a later call that resolves a child by
  // its address (an external call through a factory-created pair) needs the stateful surface, and a bare
  // Contract has no `getFullState`.
  for (const [index, child] of statefulChildren.entries()) {
    registerDeployment(provider, {
      contractName: creation?.children[index]?.contractName ?? childArtifact.contractName,
      address: child.address,
      lockingBytecode: child.inner.lockingBytecode,
      contract: child,
      parentAddress: factory.target,
      parentLockingBytecode: factory.inner.lockingBytecode,
      salt: childSalt ? binToHex(childSalt) : undefined,
      category: fundingUtxos[index]?.txid,
    });
  }
  // A creating call whose run makes no child returns none: `child` and `childCategoryId` are then undefined.
  const childStateful = statefulChildren[0] as ConnectedStatefulContract<T>;

  return {
    factory,
    child: childStateful,
    children: statefulChildren,
    childCategoryIds: fundingUtxos.map((fu) => fu.txid),
    tx,
    childCategoryId: childCategoryId as string,
    ...(creation === undefined ? {} : { prepTransactions: preps.map((prep) => prep.transactionHex) }),
  };
}
