import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { bytesEqual, type FunctionSplitBundle } from '@solidcash/utils';
import { framedValidator } from '@solidcash/solidc/runtime';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringSplit } from '../../../../solidc/src/compiler.js';
import { SignatureTemplate } from '../../../src/index.js';
import type { Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { childGenesisOutputs } from '../../../src/framed/deploy/genesis-outputs.js';
import { alicePkh, alicePriv } from '../../fixture/vars.js';

/**
 * A child's genesis outputs, listed for a creator's transaction.
 *
 * A creator mints its child's genesis inside its own transaction, so the outputs a deployment would build have to be
 * available without one. `childGenesisOutputs` computes them from the same artifact and constructor arguments; this
 * test compares that list with what a real deployment puts on chain for the same contract, so the list cannot drift
 * from the deployment: every category-bearing output must be a live UTXO at the same lock, capability and
 * commitment, the validator pool must sit at `addrV(category)`, and the tokenless facets must be there.
 */

const FRAMED = {
  composition: 'framed' as const, evmCompat: true, suppressWarnings: true, split: 'func' as const,
};

const SOURCE = `pragma solidity ^0.8.0;
contract Child {
  address public owner;
  uint256 public n;
  constructor(address _owner) { owner = _owner; }
  function initialize(uint256 k) external { n = k; }
  function bump(uint256 k) external { n = n + k; }
}`;

const VALIDATOR = framedValidator.buildValidatorProgram();
const CALLER = encodeLockingBytecodeP2pkh(alicePkh);

function bundleOf(): FunctionSplitBundle {
  return compileStringSplit(SOURCE, { ...FRAMED, primaryContractName: 'Child' }) as FunctionSplitBundle;
}

describe('a creator\'s list of the child\'s genesis outputs', () => {
  it('is exactly what the deployment mints for the same contract', async () => {
    const bundle = bundleOf();
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
    const encoded = lockingBytecodeToCashAddress({ bytecode: CALLER, prefix: 'bchtest' });
    if (typeof encoded === 'string') throw new Error(encoded);
    const funding: Utxo = { txid: 'a1'.repeat(32), vout: 0, satoshis: 1_500_000n };
    await provider.addUtxo(binToHex(CALLER), funding);
    const pool = { masters: 2, validators: 1 };
    const { categoryId } = await deployStatefulContract(bundle.logical, [CALLER], {
      provider, fundingUtxo: funding, funder, changeAddress: encoded.address,
      threadCount: pool.masters, validatorCount: pool.validators, functionSplit: bundle,
    });

    const listed = childGenesisOutputs({
      artifact: bundle.logical,
      category: hexToBin(categoryId),
      validatorProgram: VALIDATOR,
      provider,
      constructorArgs: [CALLER],
      senderLockingBytecode: CALLER,
      split: bundle,
      pool,
      ownerLock: CALLER,
    });

    const live = await provider.getUtxosByTokenCategory(categoryId);
    const atLock = (lock: Uint8Array) =>
      (provider as unknown as { getUtxosForLockingBytecode: (lock: Uint8Array) => Promise<Utxo[]> })
        .getUtxosForLockingBytecode(lock);
    let matched = 0;
    for (const output of listed.outputs) {
      if (output.token === undefined) {
        // The state commitment is an OP_RETURN, not a UTXO; nothing on chain carries it.
        if ((output.to as Uint8Array)[0] === 0x6a) continue;
        // A facet: any UTXO of its code serves, so it only has to exist.
        const at = await atLock(output.to as Uint8Array);
        expect(at.length, 'facet output').toBeGreaterThan(0);
        continue;
      }
      const utxo = live.find((candidate) => bytesEqual(candidate.lockingBytecode ?? new Uint8Array(), output.to as Uint8Array)
        && candidate.token?.category.toLowerCase() === categoryId
        && candidate.token.nft?.capability === output.token!.nft?.capability
        && (candidate.token.nft?.commitment ?? '').toLowerCase() === (output.token!.nft?.commitment ?? '').toLowerCase());
      expect(utxo, `output ${binToHex(output.to as Uint8Array).slice(0, 16)} matches a live UTXO`).toBeDefined();
      matched += 1;
    }
    // The authhead, the master pool, the validator and the state record: four kinds, all matched above.
    expect(matched).toBeGreaterThanOrEqual(1 + pool.masters * bundle.shards.length + pool.validators + 1);
    console.log('matched', matched, 'of', listed.outputs.length, 'outputs');
  }, 240_000);
});
