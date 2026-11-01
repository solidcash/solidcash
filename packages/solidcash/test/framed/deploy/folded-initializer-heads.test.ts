import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import type { Artifact, FunctionSplitBundle } from '@solidcash/utils';
import { framedValidator } from '@solidcash/solidc/runtime';
import { COMPOSITION_LIMITS } from '../../../../solidc/test/framed/machine.js';
import { compileStringSplit } from '../../../../solidc/src/compiler.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deriveFramedGenesis, FramedGenesisError } from '../../../src/framed/deploy/genesis.js';
import { headSentinelCommitment } from '../../../src/stateful/SortedList.js';

const FRAMED = { composition: 'framed' as const, evmCompat: true, suppressWarnings: true, split: 'func' as const };
const VALIDATOR = framedValidator.buildValidatorProgram();
const EMPTY_HEAD = binToHex(headSentinelCommitment());
/** A head sentinel's commitment starts with slot 0. */
const isHead = (commitment: string): boolean => commitment.startsWith('00'.repeat(32));

/** A pair-shaped child: a constructor that writes a scalar, two sorted mappings, and an initializer. */
const childSource = (constructorBody: string, initializerBody: string): string => `pragma solidity ^0.8.0;
contract Child {
  address public owner;
  address public token;
  mapping(address => uint256) public balanceOf;
  mapping(address => mapping(address => uint256)) public allowance;
  constructor() { ${constructorBody} }
  function initialize(address a) external { ${initializerBody} }
  function approve(address spender, uint256 v) external { allowance[msg.sender][spender] = v; }
}`;

const childArtifact = (source: string): Artifact =>
  (compileStringSplit(source, { ...FRAMED, primaryContractName: 'Child' }) as FunctionSplitBundle).logical;

const fold = (artifact: Artifact) => deriveFramedGenesis({
  artifact,
  category: new Uint8Array(32).fill(9),
  validatorProgram: VALIDATOR,
  provider: new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS }),
  constructorArgs: [],
  headCollections: (artifact.stateLayout?.collections ?? []).filter((collection) => collection.sorted === true)
    .map((collection) => ({ name: collection.name, signature: collection.signature! })),
  initializer: { functionName: 'initialize', args: [new Uint8Array(20).fill(0x11)] },
});

/** The head sentinels a genesis mints, by collection. */
const headsOf = (entries: readonly { collection: string; commitment: string }[]): Record<string, string[]> => {
  const heads: Record<string, string[]> = {};
  for (const entry of entries.filter((candidate) => isHead(candidate.commitment))) {
    (heads[entry.collection] ??= []).push(entry.commitment);
  }
  return heads;
};

describe('a genesis with a folded initializer', () => {
  it('mints one empty head per sorted collection when neither frame writes a mapping', () => {
    const genesis = fold(childArtifact(childSource('owner = msg.sender;', 'token = a;')));
    // The constructor's frame and the initializer's both run, but the collections are seeded once: a second empty
    // head would be a second list head at the collection's lock, which an insert at the list's front could spend.
    expect(headsOf(genesis.entries)).toEqual({ balanceOf: [EMPTY_HEAD], allowance: [EMPTY_HEAD] });
  }, 240_000);

  it('keeps the head the initializer relinked in place of the empty one', () => {
    const genesis = fold(childArtifact(childSource('owner = msg.sender;', 'token = a; balanceOf[a] = 7;')));
    const heads = headsOf(genesis.entries);
    expect(heads.allowance).toEqual([EMPTY_HEAD]);
    expect(heads.balanceOf).toHaveLength(1);
    // The one balanceOf head links to the node the initializer created: its successor is that node's slot.
    expect(heads.balanceOf![0]).not.toBe(EMPTY_HEAD);
    const created = genesis.entries.filter((entry) => entry.collection === 'balanceOf' && !isHead(entry.commitment));
    expect(created).toHaveLength(1);
    expect(heads.balanceOf![0]!.slice(64, 128)).toBe(created[0]!.commitment.slice(0, 64));
  }, 240_000);

  it('refuses an initializer that writes a collection the constructor wrote too', () => {
    const artifact = childArtifact(childSource('owner = msg.sender; balanceOf[msg.sender] = 1;', 'balanceOf[a] = 7;'));
    expect(() => fold(artifact)).toThrow(FramedGenesisError);
    expect(() => fold(artifact)).toThrow(/writes "balanceOf", which the constructor writes too/);
  }, 240_000);
});
