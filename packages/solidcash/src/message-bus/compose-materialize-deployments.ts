/**
 * phase-boundary extract: Compose phase-boundary extract — materialize compiler-published child deployments.
 */

import { hexToBin } from '@bitauth/libauth';
import {
  buildEntryCommitment,
  buildInitialStateCommitments,
  bytecodeToScript,
  childStateLayoutDigest,
  scriptToAsm,
  validateChildDeploymentGenesisState,
  type Artifact,
} from '@solidcash/utils';
import { Contract } from '../Contract.js';
import type { Output, UnlockableUtxo } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import type { StatefulContract } from '../stateful/StatefulContract.js';
import { getDataNftAddress, getEntryNftLockingBytecode } from '../stateful/covenant-helpers.js';
import { artifactUsesSolidityAbi } from '../stateful/solidityAbi.js';
import { addressToLockScript } from '../utils.js';
import {
  evaluateChildDeploymentRecipe,
  materializeChildDeploymentEntryScalar,
  materializeChildDeploymentEntryValue,
} from './compose-recipes.js';
import { funderUtxo } from './compose-participant-helpers.js';
import type { CallDescriptor, ComposeAtomicMessageBusOptions } from './compose-prepared-invocation.js';
import { findMessageBusHandlerForInvocation } from './graph-handler-join.js';
import { deriveCompiledGraphPlan } from './worklist.js';

type CompiledGraphPlan = ReturnType<typeof deriveCompiledGraphPlan>;

export type MaterializedComposeDeployment =
  | {
    participant: number;
    invocation: number;
    siteIndex: number;
    offset: number;
    slotOffset?: number;
    active: false;
    outputs: readonly Output[];
  }
  | {
    participant: number;
    invocation: number;
    siteIndex: number;
    offset: number;
    slotOffset: number;
    active: true;
    genesis: UnlockableUtxo;
    outputs: readonly Output[];
    valueTransfer?: {
      outputSlot: number;
      lockingBytecode: Uint8Array;
      amount: bigint;
    };
  };

export interface MaterializeComposeDeploymentsContext {
  plan: CompiledGraphPlan;
  descriptors: readonly CallDescriptor[];
  byLockingBytecode: Map<string, StatefulContract>;
  suppliedDeployments: NonNullable<ComposeAtomicMessageBusOptions['childDeployments']>;
  usedDeployments: Set<number>;
  provider: NetworkProvider;
}

export function materializeComposeDeployments(
  ctx: MaterializeComposeDeploymentsContext,
): MaterializedComposeDeployment[] {
  return ctx.plan.participants.flatMap((participant) => {
    const owner = ctx.byLockingBytecode.get(participant.lockingBytecode.toLowerCase())!;
    const deploymentSlots = participant.blockLayout!.slots
      .filter((slot) => slot.kind === 'deploy')
      .sort((left, right) => left.offset - right.offset);
    const transferSlots = participant.blockLayout!.slots
      .filter((slot) => slot.kind === 'transfer' && slot.slotIndex !== undefined);
    const maximumRows = participant.artifact.messageBus?.maximumRows ?? 0;
    const transferFrameWidth = maximumRows > 0 && transferSlots.length % maximumRows === 0
      ? transferSlots.length / maximumRows : 0;
    return participant.invocations.flatMap((invocationIndex, row) => {
      const descriptor = ctx.descriptors[invocationIndex];
      const handler = findMessageBusHandlerForInvocation(
        participant.artifact,
        ctx.plan.invocations[invocationIndex],
      );
      const sites = handler?.childDeployments ?? [];
      if (sites.length === 0) return [];
      let expectedSpanOffset = 0;
      if (sites.some((site, index) => {
        const valid = site.siteIndex === index
          && (site.occurrence === 'once'
            || (site.occurrence === 'conditional' && site.activation !== undefined))
          && (site.spanOffset ?? expectedSpanOffset) === expectedSpanOffset
          && (site.spanWidth ?? site.totalOutputCount) === site.totalOutputCount;
        expectedSpanOffset += site.totalOutputCount;
        return !valid;
      })) {
        throw new Error(`messageBus: invocation ${invocationIndex} has no canonical deployment sequence`);
      }
      const deploymentSlot = deploymentSlots[row];
      if (deploymentSlot?.slotIndex === undefined) {
        throw new Error(`messageBus: compiler layout has no deployment slot for selected row ${row}`);
      }
      return sites.map((site) => {
        const offset = deploymentSlot.offset + (site.spanOffset ?? sites.slice(0, site.siteIndex)
          .reduce((width, prior) => width + prior.totalOutputCount, 0));
        const inputTypes = handler?.inputs.map((input) => input.type) ?? [];
        const solidityAbi = artifactUsesSolidityAbi(participant.artifact);
        const activation = site.activation === undefined ? true
          : evaluateChildDeploymentRecipe(site.activation, descriptor.args, inputTypes, solidityAbi);
        if (typeof activation !== 'boolean') {
          throw new Error(`messageBus: child deployment activation at site ${site.siteIndex} is not boolean`);
        }
        const suppliedIndex = ctx.suppliedDeployments.findIndex((candidate) =>
          candidate.invocationIndex === invocationIndex && candidate.siteIndex === site.siteIndex);
        if (!activation) {
          if (suppliedIndex >= 0) {
            throw new Error(
              `messageBus: inactive child deployment at invocation ${invocationIndex}, site ${site.siteIndex} must not supply genesis`,
            );
          }
          return {
            participant: participant.participant,
            invocation: invocationIndex,
            siteIndex: site.siteIndex,
            offset,
            slotOffset: offset,
            active: false as const,
            outputs: [] as Output[],
          };
        }
        if (suppliedIndex < 0) {
          throw new Error(`messageBus: missing child genesis for invocation ${invocationIndex}, site ${site.siteIndex}`);
        }
        if (ctx.usedDeployments.has(suppliedIndex)) {
          throw new Error(`messageBus: duplicate child genesis for invocation ${invocationIndex}, site ${site.siteIndex}`);
        }
        ctx.usedDeployments.add(suppliedIndex);
        const genesis = funderUtxo(ctx.suppliedDeployments[suppliedIndex].funder);
        if (genesis.vout !== 0 || genesis.token) {
          throw new Error(
            `messageBus: child genesis for invocation ${invocationIndex}, site ${site.siteIndex} must be token-free vout 0`,
          );
        }
        const childArtifact = owner._getChild(site.contractName);
        if (!childArtifact?.stateLayout) {
          throw new Error(`messageBus: registered stateful child artifact '${site.contractName}' is required`);
        }
        if (childArtifact.stateLayout.dataNftCount !== site.dataNftOutputCount) {
          throw new Error(
            `messageBus: registered child artifact '${site.contractName}' has deployment state geometry ${childArtifact.stateLayout.dataNftCount}, expected ${site.dataNftOutputCount}`,
          );
        }
        if ((site.entryNftOutputCount ?? 0) !== (site.genesisEntries?.length ?? 0)) {
          throw new Error(
            `messageBus: child deployment site ${site.siteIndex} has inconsistent entry-genesis geometry`,
          );
        }
        if (site.childLayoutDigest
          && childStateLayoutDigest(childArtifact.stateLayout) !== site.childLayoutDigest.toLowerCase()) {
          throw new Error(
            `messageBus: registered child artifact '${site.contractName}' does not match deployment state layout`,
          );
        }
        if (site.hasFoldedChildCall && !site.genesisState) {
          throw new Error(
            `messageBus: folded child initialization at site ${site.siteIndex} has no authenticated genesis state`,
          );
        }
        if (site.genesisState) {
          try {
            validateChildDeploymentGenesisState(childArtifact.stateLayout, site.genesisState);
          } catch (error) {
            throw new Error(
              `messageBus: invalid constructor genesis for '${site.contractName}': `
              + `${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
        const constructorArgs = site.constructorArgs.slice(0, childArtifact.constructorInputs.length).map((source) => {
          if (source.kind === 'expression') {
            throw new Error(`messageBus: child constructor expression at site ${site.siteIndex} is not materializable`);
          }
          return evaluateChildDeploymentRecipe(source, descriptor.args, inputTypes, solidityAbi);
        });
        let salt: Uint8Array | undefined;
        if (site.salt?.kind === 'handlerInput') {
          const value = descriptor.args[site.salt.inputIndex];
          salt = value instanceof Uint8Array ? value
            : typeof value === 'string' && /^(?:0x)?[0-9a-f]+$/i.test(value)
              ? hexToBin(value.replace(/^0x/i, '')) : undefined;
        } else if (site.salt?.kind === 'literal') salt = hexToBin(site.salt.value);
        else if (site.salt?.kind === 'expression') {
          throw new Error(`messageBus: child salt expression at site ${site.siteIndex} is not materializable`);
        } else if (site.salt) {
          const value = evaluateChildDeploymentRecipe(site.salt, descriptor.args, inputTypes, solidityAbi);
          salt = value instanceof Uint8Array ? value
            : typeof value === 'string' && /^(?:0x)?[0-9a-f]+$/i.test(value)
              ? hexToBin(value.replace(/^0x/i, '')) : undefined;
        }
        if (site.salt && !salt) throw new Error(`messageBus: invalid child salt at site ${site.siteIndex}`);
        const effectiveArtifact = {
          ...childArtifact,
          bytecode: scriptToAsm(bytecodeToScript(hexToBin(site.creationBytecode))),
        } as Artifact;
        // Only contract-level parameters are baked into the locking bytecode. Solidity-style constructor
        // parameters are consumed by the authenticated genesis recipe without changing the child's address.
        const child = new Contract(effectiveArtifact, constructorArgs as never[], {
          provider: ctx.provider,
          addressType: owner.inner.addressType,
          category: hexToBin(genesis.txid),
          ...(salt && { salt }),
        });
        let valueTransfer: { outputSlot: number; lockingBytecode: Uint8Array; amount: bigint } | undefined;
        if (site.value) {
          const amount = site.value.amount.kind === 'expression' ? undefined
            : evaluateChildDeploymentRecipe(site.value.amount, descriptor.args, inputTypes, solidityAbi);
          if (typeof amount !== 'bigint' || amount <= 0n || amount > 0xffff_ffff_ffff_ffffn) {
            throw new Error(
              `messageBus: child deployment value at site ${site.siteIndex} must be a positive uint64`,
            );
          }
          const outputSlot = row * transferFrameWidth + site.value.transferIndex;
          if (transferFrameWidth < 1 || !Number.isSafeInteger(site.value.transferIndex)
            || site.value.transferIndex < 0 || site.value.transferIndex >= transferFrameWidth
            || !transferSlots.some((slot) => slot.slotIndex === outputSlot)) {
            throw new Error(
              `messageBus: child deployment site ${site.siteIndex} has no canonical transfer slot`,
            );
          }
          valueTransfer = {
            outputSlot,
            lockingBytecode: addressToLockScript(child.address),
            amount,
          };
        }
        const genesisState = Object.fromEntries((site.genesisState?.fields ?? []).map((field) => [
          field.name,
          evaluateChildDeploymentRecipe(field.value, descriptor.args, inputTypes, solidityAbi),
        ]));
        const commitments = buildInitialStateCommitments(
          childArtifact.stateLayout, genesisState as never,
          ctx.provider.consensusLimits?.maximumNftCommitmentBytes,
        );
        if (commitments.length !== site.dataNftOutputCount) {
          throw new Error(`messageBus: child deployment site ${site.siteIndex} produced incomplete default state`);
        }
        const outputs: Output[] = [{
          to: addressToLockScript(child.address), amount: 1200n,
          token: { category: genesis.txid, amount: 0n, nft: { capability: 'minting', commitment: '' } },
        }];
        const dataAddress = getDataNftAddress(child, genesis.txid);
        for (let nftIndex = 0; nftIndex < site.dataNftOutputCount; nftIndex++) {
          outputs.push({
            to: dataAddress, amount: 1200n,
            token: {
              category: genesis.txid, amount: 0n,
              nft: { capability: 'mutable', commitment: commitments[nftIndex] },
            },
          });
        }
        for (const entry of site.genesisEntries ?? []) {
          const collection = childArtifact.stateLayout.collections?.find((candidate) =>
            candidate.name === entry.collection && candidate.signature === entry.collectionSignature);
          if (!collection || !['array', 'mapping'].includes(collection.kind)
            || (collection.kind === 'array' && collection.bound === undefined)
            || collection.keyType !== entry.keyType || collection.valueType !== entry.valueType) {
            throw new Error(
              `messageBus: child deployment entry '${entry.collection}' does not match the authenticated layout`,
            );
          }
          const key = evaluateChildDeploymentRecipe(entry.key, descriptor.args, inputTypes, solidityAbi);
          const value = evaluateChildDeploymentRecipe(entry.value, descriptor.args, inputTypes, solidityAbi);
          if (collection.kind === 'array'
            && (typeof key !== 'bigint' || key < 0n || key >= BigInt(collection.bound!))) {
            throw new Error(`messageBus: child deployment entry '${entry.collection}' has an invalid fixed-array key`);
          }
          const materializedKey = materializeChildDeploymentEntryScalar(key, entry.keyType, solidityAbi);
          const materializedValue = materializeChildDeploymentEntryValue(
            value, entry.valueType, solidityAbi, childArtifact.stateLayout.structs,
          );
          outputs.push({
            to: getEntryNftLockingBytecode(child, genesis.txid, entry.collectionSignature),
            amount: 1200n,
            token: {
              category: genesis.txid,
              amount: 0n,
              nft: {
                capability: 'mutable',
                commitment: buildEntryCommitment(
                  materializedKey, entry.keyType, materializedValue, entry.valueType,
                  childArtifact.stateLayout.structs,
                  ctx.provider.consensusLimits?.maximumNftCommitmentBytes,
                ),
              },
            },
          });
        }
        return {
          participant: participant.participant,
          invocation: invocationIndex,
          siteIndex: site.siteIndex,
          offset,
          slotOffset: offset,
          active: true as const,
          genesis,
          outputs,
          ...(valueTransfer && { valueTransfer }),
        };
      });
    });
  });
}
