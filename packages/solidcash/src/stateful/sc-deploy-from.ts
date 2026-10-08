/**
 * phase-boundary extract: SC lifecycle extract — static deployFrom (factory deploy + child genesis).
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
;
;
import { bigIntToVmNumber } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
;
;
;
import { keccak_256 } from '@noble/hashes/sha3.js';
import {
  buildChunkCommitment,
  buildEntryCommitment,
  buildEventNftCovenantScript,
  buildInitialStateCommitments,
  buildPushdataCommitment,
  bytecodeToScript,
  childStateLayoutDigest,
  computeEventNameHash,
  dynamicLenKey,
  encodePushdataValue,
  parsePushdataCommitment,
  scriptToAsm,
  splitValueIntoChunks,
  validateChildDeploymentGenesisState,
  type Artifact,
  type StateValue,
} from '@solidcash/utils';
import type { ConstructorArgument, FunctionArgument } from '../Argument.js';
import { Contract } from '../Contract.js';
import type { Unlocker, Utxo } from '../interfaces.js';
import type { StateValueType } from '../types/state-inference.js';
import {
  addressToLockScript, randomUtxo, scriptToLockingBytecode,
} from '../utils.js';
import {
  createDataNftUnlocker,
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
import { evalComputedKey } from './route-expression-key.js';
import {
  bytesToSlotValue,
  decodeEntryCommitment,
  encodeEntryCommitment,
  keyToSlotMulti,
  SortedList,
} from './SortedList.js';
import { artifactUsesSolidityAbi, sortAddressPair, sortedAddressPairPacked } from './solidityAbi.js';
import { encodeExternalReturnValues } from './external-return-encoding.js';
import type {
  DeployFromOptions, DeployFromResult,
} from './stateful-lifecycle-types.js';
import type { ConnectedStatefulContract } from './StatefulContract.js';

export async function deployFromStatefulContract<T extends Artifact>(
  options: DeployFromOptions<T>,
): Promise<DeployFromResult<T>> {
  const {
    provider, factory, deployFunctionName, deployFunctionArgs,
  } = options;

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
  const childArtifact = (options.childArtifact
    ?? (deployTarget ? (factory as any)._getChild(deployTarget.contractName) : undefined)) as T;
  if (!childArtifact) {
    throw new Error(
      `No child artifact for deploy function '${deployFunctionName}'. Pass childArtifact or register it `
      + 'with factory.registerChild(artifact).',
    );
  }
  const bakedConstructorArgumentCount = childArtifact.constructorInputs.length;
  let childConstructorArgs = options.childConstructorArgs;
  if (bakedConstructorArgumentCount === 0) {
    childConstructorArgs = [];
  } else if (!childConstructorArgs && deployTarget?.constructorArgs?.every((n) => n !== null)) {
    const derived = deployTarget.constructorArgs.map((name) => {
      const idx = deployAbi.inputs.findIndex((inp) => inp.name === name);
      return idx >= 0 ? deployFunctionArgs[idx] : undefined;
    });
    if (derived.every((v) => v !== undefined)) childConstructorArgs = derived as ConstructorArgument[];
  }
  if (!childConstructorArgs) {
    throw new Error(
      `Cannot derive constructor args for 'new ${deployTarget?.contractName ?? '?'}(...)' in `
      + `'${deployFunctionName}'. Pass childConstructorArgs (the new-C(...) args are not all plain parameters).`,
    );
  }
  const bakedChildConstructorArgs = childConstructorArgs.slice(0, bakedConstructorArgumentCount);
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
          // (`sortAddressPair`). Solidity-compatible abi.encodePacked then narrows each address to its canonical
          // 20-byte payload; native SolidCash packs the full locking bytecode. Keep the CREATE2 prediction identical.
          const packed = sortedAddressPairPacked(a, b, artifactUsesSolidityAbi(factory.inner.artifact));
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
  if (!childArtifact.stateLayout) {
    throw new Error(
      `Child contract '${childArtifact.contractName}' is not a stateful contract.`,
    );
  }

  // Funding UTXOs: one per child (a loop `for (i<n) new C()` mints N children, and a balanced contract block
  // needs N funding inputs). fundingUtxos supersedes the single fundingUtxo; default = [fundingUtxo] (1 child).
  const fundingUtxos = options.fundingUtxos ?? [options.fundingUtxo];
  const childCount = fundingUtxos.length;
  if (childCount === 0) {
    throw new Error('deployFrom needs at least one funding UTXO (fundingUtxo or a non-empty fundingUtxos).');
  }
  for (const fu of fundingUtxos) {
    if (fu.vout !== 0) {
      throw new Error(
        'Each funding UTXO must be at vout 0 to create a valid token category. '
        + `Got vout ${fu.vout}.`,
      );
    }
  }

  // child i's category = fundingUtxos[i].txid. The first child's category doubles as the returned handle's.
  const childCategoryId = fundingUtxos[0].txid;
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
  if (deployTarget.creationBytecode) {
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
  const childContracts = fundingUtxos.map((fu) => new Contract(effectiveChildArtifact, bakedChildConstructorArgs as any, {
    provider,
    addressType,
    category: hexToBin(fu.txid),
    ...(childSalt && { salt: childSalt }),
  }));
  const childContractUnsalted = childContracts[0];

  // The returned handle uses the same self-pinned address as the first deployed genesis.
  const childContract = childContractUnsalted;

  const childLayout = childArtifact.stateLayout!;

  if (deployTarget?.childLayoutDigest
    && childStateLayoutDigest(childLayout) !== deployTarget.childLayoutDigest.toLowerCase()) {
    throw new Error(
      `Child artifact '${childArtifact.contractName}' does not match the compiler-authenticated deployment state layout.`,
    );
  }
  if ((deployTarget.entryNftCount ?? 0) !== (deployTarget.genesisEntries?.length ?? 0)) {
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
  const needsGenesisRecipeEvaluator = !!deployTarget.genesisState || (deployTarget.genesisEntries?.length ?? 0) > 0;
  const genesisRecipeModule = needsGenesisRecipeEvaluator
    ? await import('../message-bus/compose.js') : undefined;
  const evaluateGenesisRecipe = genesisRecipeModule?.evaluateChildDeploymentRecipe;
  const genesisInputTypes = deployAbi.inputs
    .filter((input) => !input.name.startsWith('__internal__'))
    .map((input) => input.type);
  if (deployTarget?.genesisState) {
    for (const field of deployTarget.genesisState.fields) {
      childSeedState[field.name] = evaluateGenesisRecipe!(
        field.value, deployFunctionArgs, genesisInputTypes, artifactUsesSolidityAbi(factory.inner.artifact),
      ) as StateValueType;
    }
  }
  const childGenesisEntries = (deployTarget.genesisEntries ?? []).map((entry) => {
    const collection = childLayout.collections?.find((candidate) => candidate.name === entry.collection
      && candidate.signature === entry.collectionSignature);
    if (!collection || !['array', 'mapping'].includes(collection.kind)
      || (collection.kind === 'array' && collection.bound === undefined)
      || collection.keyType !== entry.keyType || collection.valueType !== entry.valueType) {
      throw new Error(
        `Constructor entry '${entry.collection}' does not match child '${childArtifact.contractName}' layout.`,
      );
    }
    const key = evaluateGenesisRecipe!(
      entry.key, deployFunctionArgs, genesisInputTypes, artifactUsesSolidityAbi(factory.inner.artifact),
    );
    const value = evaluateGenesisRecipe!(
      entry.value, deployFunctionArgs, genesisInputTypes, artifactUsesSolidityAbi(factory.inner.artifact),
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
  if (legacyChildGenesisHeuristics && childLayout.variables?.some((variable) => (
    variable.name === 'factory' && variable.type.startsWith('address')
  )) && childSeedState.factory === undefined) {
    childSeedState.factory = addressToLockScript(factory.inner.address);
  }
  if (legacyChildGenesisHeuristics && childLayout.variables?.some((variable) => variable.name === 'unlocked')
    && childSeedState.unlocked === undefined) {
    childSeedState.unlocked = 1n;
  }
  const childCommitments = buildInitialStateCommitments(
    childLayout, childSeedState, provider.consensusLimits?.maximumNftCommitmentBytes,
  );

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
        const auto = evalComputedKey(label, deployFunctionArgs as FunctionArgument[], deployAbi.inputs);
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
  const fundingCatValue = hexToBin(fundingUtxos[0].txid).reverse();
  const pairAddressValue = addressToLockScript(childContracts[0].address);
  const predictedAddressReturn = encodeExternalReturnValues(
    [pairAddressValue], ['address'], factoryLayout.structs,
    artifactUsesSolidityAbi(factory.inner.artifact), factory.inner.artifact.enums,
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
      const plan = list.planBatchUpsert(writes);
      const targetValues = new Set(writes.map((w) => bytesToSlotValue(w.slot).toString()));
      const predOutputs = plan.outputs.filter((o) => !targetValues.has(bytesToSlotValue(o.slot).toString()));
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
        const out = plan.outputs.find((o) => bytesToSlotValue(o.slot) === bytesToSlotValue(r.slot));
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
        const plan = list.planInsert(r.slot, r.valueTail);
        entryInfos[i] = {
          collection: r.access.collection, keyValue: r.keyValue, encodedKeys: r.encodedKeys, slot: r.slot,
          proofUtxo: plan.predecessor.utxo, present: false,
          fixedCommitment: binToHex(plan.newNodeCommitment),
          trailingCommitment: binToHex(plan.predNewCommitment),
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
        const plan = list.planInsert(r.slot, r.valueTail);
        // Non-batch: P' fixed, NEW trailing (legacy single-write path).
        entryInfos.push({
          collection: r.access.collection, keyValue: r.keyValue, encodedKeys: r.encodedKeys, slot: r.slot,
          proofUtxo: plan.predecessor.utxo, present: false,
          fixedCommitment: binToHex(plan.predNewCommitment),
          trailingCommitment: binToHex(plan.newNodeCommitment),
        });
      }
    }
  }

  // Append vmap batch witnesses (slot/proof/next/predOut per write + trailing count) so the factory unlocker
  // matches a normal StatefulContract call path.
  if (useBatch) {
    const trailingBase = deployAbi.blockLayout?.trailingBase
      ?? deployAbi.blockLayout?.blockSize ?? 1;
    // NEW nodes trail the full fixed block when deployDataNft slots authenticate the child data region.
    let batchPredOutputBase = trailingBase;
    let batchTrailingCount = 0;
    for (const batch of deployAbi.sortedBatchInfo ?? []) {
      const collection = factoryLayout.collections?.find((c) => c.name === batch.collection);
      if (!collection) continue;
      const list = SortedList.fromUtxos(await deployCollectionEntries(collection.signature));
      const writes = batch.slotIndices.map((slotIndex) => {
        const info = entryInfos[slotIndex];
        return { slot: info.slot, value: info.present ? new Uint8Array() : resolvedAccesses[slotIndex].valueTail };
      });
      const plan = list.planBatchUpsert(writes.map((w, i) => ({
        slot: w.slot,
        value: resolvedAccesses[batch.slotIndices[i]].valueTail,
      })));
      const targetValues = new Set(writes.map((w) => bytesToSlotValue(w.slot).toString()));
      const predOutputs = plan.outputs.filter((o) => !targetValues.has(bytesToSlotValue(o.slot).toString()));
      const linearRows = batch.linear ? batch.slotIndices.map((slotIndex) => {
        const slot = entryInfos[slotIndex].slot;
        const out = plan.outputs.find((candidate) => bytesToSlotValue(candidate.slot) === bytesToSlotValue(slot));
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
        const out = plan.outputs.find((o) => bytesToSlotValue(o.slot) === bytesToSlotValue(slot));
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
    finalArgs = [...finalArgs, BigInt(batchTrailingCount)];
  }

  // returnOutputIdx is the last hidden input when present (after vmap batch witnesses).
  if (deployReturns) {
    const retIdxPos = deployAbi.inputs.findIndex((inp) => inp.name === '__internal__returnOutputIdx');
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
    // A reserved genesis coin holds a predicted create address, so it funds no alias slot either.
    const { genesisOutpointKey, isReservedGenesisOutpoint } = await import('./genesis-reservations.js');
    const signerUtxos = await factorySigner.getUtxos();
    for (const u of signerUtxos) {
      if (u.token || fundingKeys.has(`${u.txid}:${u.vout}`) || u.satoshis < 1000n) continue;
      if (isReservedGenesisOutpoint(genesisOutpointKey(u.txid, u.vout))) continue;
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

  // Create unlockers for factory's master UTXO and data NFTs
  const stateInputUnlocker = (factory.inner.unlock as any)[deployFunctionName](...finalArgs);
  const dataNftUnlockers = filteredDataNftUtxos.map(
    () => createDataNftUnlocker(factory.inner, 0, factory.categoryId),
  );

  // A LOOP `new C{value:V}()` has NO standalone transfer block-layout slot (the N value transfers are
  // interleaved as the LAST output of each child's group). A straight-line / conditional {value:} keeps a
  // transfer slot (separate output). Both co-spend the factory's satoshi container as the value source.
  const hasSatoshiContainer = deployAbi.blockLayout?.slots.some((s) => s.kind === 'satoshiContainer') ?? false;
  const hasTransferSlot = deployAbi.blockLayout?.slots.some((s) => s.kind === 'transfer') ?? false;
  const isLoopValueDeploy = hasSatoshiContainer && !hasTransferSlot;

  // Build child outputs for the VM probe (needed by the deploy covenant verification). N child groups, one per
  // funding UTXO, at consecutive stride-sized slots (the runtime deploy counter indexes them). Each child's
  // master + data NFTs carry its own category (fundingUtxos[k].txid) and self-pinned address; a loop {value:}
  // group ends with the interleaved value transfer to that child.
  const childExtraOutputs: Array<{ to: string | Uint8Array; amount: bigint; token?: any }> = [];
  for (let k = 0; k < childCount; k++) {
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
        token: { category: cat, amount: 0n, nft: { capability: 'mutable', commitment: childCommitments[i] } },
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
  const childProbeOutputs = childExtraOutputs.length > 0
    ? (hasDeployDataNftSlots
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
          commitment: binToHex(predictedAddressReturn),
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
  const containerOutputs: Array<{ to: string | Uint8Array; amount: bigint }> = [];
  if (hasSatoshiContainer) {
    const childValue = options.childValue;
    if (childValue === undefined || childValue <= 0n) {
      throw new Error(
        `Deploy function '${deployFunctionName}' sends value to the child (new C{value:...}()); pass `
        + 'childValue (the sats transferred from the factory\'s satoshi container to the child).',
      );
    }
    const totalValue = isLoopValueDeploy ? childValue * BigInt(childCount) : childValue;
    const satAddr = getSatoshiContainerAddress(factory.inner, factory.categoryId);
    const satUtxo = (await provider.getUtxos(satAddr)).find((u) => u.satoshis > totalValue);
    if (!satUtxo) {
      throw new Error(
        `Factory '${factory.name}' has no satoshi container with > ${totalValue} sats at ${satAddr}. Deploy `
        + 'the factory with an initialBalance to fund new C{value:}() transfers.',
      );
    }
    containerInputs.push({
      utxo: satUtxo, unlocker: createSatoshiContainerUnlocker(factory.inner, 0, factory.categoryId),
    });
    containerOutputs.push({ to: satAddr, amount: satUtxo.satoshis - totalValue });    // recreate the container
    // Straight-line / conditional: one separate transfer output. Loop: the N transfers are interleaved into
    // the child groups (added in the child-output construction below), so no separate transfer here.
    if (!isLoopValueDeploy) {
      containerOutputs.push({ to: childContractUnsalted.address, amount: childValue });
    }
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
    const transfers = options.childTokenTransfers ?? [];
    if (transfers.length === 0) {
      throw new Error(
        `Deploy function '${deployFunctionName}' transfers tokens from the factory's container; pass `
        + 'childTokenTransfers [{ categoryId, to, amount }] (one per FT transfer the deploy performs). NFT '
        + '(transferNft) transfers on deploy are not yet supported.',
      );
    }
    const remainderOutputs: Array<{ to: string | Uint8Array; amount: bigint; token?: any }> = [];
    const transferOutputs: Array<{ to: string | Uint8Array; amount: bigint; token?: any }> = [];
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
    let eventCommitment = '00';
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
      const parts = eventDef.parameters.map((p, i) => encodePushdataValue(
        eventArgs[i] as StateValue, p.type, factoryLayout.structs,
      ));
      const total = parts.reduce((n, p) => n + p.length, 0);
      const commitmentBytes = new Uint8Array(total);
      let off = 0;
      for (const part of parts) { commitmentBytes.set(part, off); off += part.length; }
      eventCommitment = binToHex(commitmentBytes);
    }
    eventPlaceholderOutputs.push({
      to: eventNftAddress,
      amount: dataNftAmount,
      token: {
        category: factory.categoryId, amount: 0n,
        nft: { capability: 'none', commitment: eventCommitment },
      },
    });
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
  // Derive factory state + entry commitments via VM probe. Inputs: master, data NFTs,
  // existing entries, [satoshi container], funding. Outputs: master, data NFTs, entries,
  // [container, value transfer], return event, child outputs.
  const {
    state: derivedState, entryCommitments, childCommitments: derivedChildCommitments, returnBlob,
    keccakCoSpends: derivedKeccakCoSpends, eventCommitments: derivedEventCommitments,
  } = await (factory as any)._deriveCommitments(
    deployFunctionName, finalArgs, requiredNftIndices,
    [...entryPlaceholderOutputs, ...containerOutputs, ...tokenContainerOutputs,
      ...eventPlaceholderOutputs, ...returnEventPlaceholders, ...childProbeOutputs,
      ...dynamicWriteChunkOutputs],
    [...entryExtraInputs, ...containerInputs, ...tokenContainerInputs,
      ...fundingUtxos.map((fu) => ({ utxo: fu, unlocker: funder }))],
    entryInfos.length,
    childLayout!.dataNftCount,
    deployTarget.hasFoldedChildCall === true,
    returnEventPlaceholders.length,
    containerOutputs.length + tokenContainerOutputs.length,
    trailingEntryPlaceholderOutputs.length,
    entryPlaceholderOutputs.length + containerOutputs.length + tokenContainerOutputs.length
      + eventPlaceholderOutputs.length + returnEventPlaceholders.length
      + (hasDeployDataNftSlots ? childExtraOutputs.length : (childExtraOutputs.length > 0 ? 1 : 0)),
    deployProbeState,
    eventPlaceholderOutputs.length,
  );
  const keccakCoSpends = derivedKeccakCoSpends ?? [];

  // Deploy-then-call fold: the covenant may verify a post-call child genesis (a same-tx
  // `child.foo(args)` folded into the deploy). Prefer the trace-derived commitment; fall back to the
  // static initial state for a plain deploy that lands the child at default. See deploy-then-call-fold.md.
  const effectiveChildCommitments = Array.from(
    { length: childLayout!.dataNftCount },
    (_, i) => {
      const derived = deployTarget.hasFoldedChildCall ? derivedChildCommitments[i] : undefined;
      return typeof derived === 'string' && derived.length > 0 ? derived : childCommitments[i];
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
  for (const fu of fundingUtxos) {
    builder.addInput(fu, funder);
  }

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

  // Outputs 1..N: factory data NFTs with updated commitments
  for (let i = 0; i < filteredDataNftUtxos.length; i++) {
    const nftIdx = requiredNftIndices[i];
    const nftUtxo = filteredDataNftUtxos[i];
    const commitment = buildPushdataCommitment(factoryLayout, factoryCurrentState, nftIdx);

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
      const seedReturn = predictedAddressReturn;
      builder.addOutput({
        to: new Uint8Array([0x51]),
        amount: 800n,
        token: {
          category: factory.categoryId, amount: 0n,
          nft: { capability: 'none', commitment: binToHex(seedReturn) },
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
  for (let k = 0; k < childCount; k++) {
    const cc = childContracts[k];
    const cat = fundingUtxos[k].txid;
    const dnAddr = getDataNftAddress(cc, cat);
    // Child minting NFT - use unsalted address to match compiler's `new` expression
    builder.addOutput({
      to: cc.tokenAddress,
      amount: masterAmount,
      token: { category: cat, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    });
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
    if (k === 0 && !hasDeployDataNftSlots) addTrailingEntries();
    // Child data NFTs
    for (let i = 0; i < childLayout!.dataNftCount; i++) {
      builder.addOutput({
        to: dnAddr,
        amount: dataNftAmount,
        token: { category: cat, amount: 0n, nft: { capability: 'mutable', commitment: effectiveChildCommitments[i] } },
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
    // Loop {value:}: the value transfer to this child, interleaved as the last output of its group.
    if (isLoopValueDeploy) {
      builder.addOutput({ to: cc.address, amount: options.childValue ?? 0n });
    }
  }

  for (const output of dynamicWriteChunkOutputs) builder.addOutput(output);

  // Change output. New entries cost dust from the funding UTXOs; existing entries are
  // satoshi-neutral (input funds output). N children cost N * (master + data NFTs); the N funding inputs' total
  // satoshis cover them (any value >= that cost).
  const newEntryCount = BigInt(trailingEntrySpecs.length);
  const totalChildCost = BigInt(childCount) * (masterAmount
    + (dataNftAmount * BigInt(childLayout!.dataNftCount + childGenesisEntries.length)));
  const totalEntryCost = dataNftAmount * newEntryCount;
  const totalDynamicChunkCost = dataNftAmount * BigInt(dynamicWriteChunkOutputs.length);
  const eventCost = dataNftAmount * BigInt(eventPlaceholderOutputs.length);
  const returnEventCost = returnEventPlaceholders.length > 0 ? 800n : 0n;
  const totalFundingSats = fundingUtxos.reduce((sum, fu) => sum + fu.satoshis, 0n);
  // tokenTransferCost = dust for each tcTransfer output (the token container's own satoshis fund only its
  // recreated remainder; each transfer output's dust comes from the funding inputs).
  const changeAmount = totalFundingSats - totalChildCost - totalEntryCost - totalDynamicChunkCost
    - eventCost - returnEventCost
    - tokenTransferCost - fee;
  if (changeAmount > 0n) {
    if (!changeAddress) {
      throw new Error(
        `deployFrom has ${changeAmount} satoshis of excess funding but no changeAddress was provided. `
        + 'Specify changeAddress in options or via factory.setDeployDefaults({ changeAddress }).',
      );
    }
    builder.addOutput({ to: changeAddress, amount: changeAmount });
  }

  const tx = await builder.send();

  // Connect the child with its categoryId. The compiler's `new C(...)` codegen now self-pins the child by
  // category (matching the SDK), so childContract's self-pinned address equals the deployed genesis address.
  // See docs/external-contract-calls.md.
  const { StatefulContract: SC } = await import('./StatefulContract.js');
  const childStateful = new SC(childContract, childCategoryId) as ConnectedStatefulContract<T>;

  return { factory, child: childStateful, tx, childCategoryId };
}
