import { describe, expect, it } from 'vitest';
import { decodeTransaction, encodeTransactionOutput, hexToBin } from '@bitauth/libauth';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import {
  addressOfCategory, enterPlain, newWorld, type PlainDeployment,
} from '../ahead/composition-world.js';

/**
 * A wide record is funded at its own dust threshold, not at a fixed amount.
 *
 * A node refuses an output worth less than `3 * (serialized size + 148)` satoshis, so the fixed 1200 satoshis a
 * genesis gave every record covers only outputs up to 252 bytes. A build that packs data NFTs wider, on a network
 * that admits wide commitments, puts a record well past that. The record's covenant pins its value on every spend,
 * so the genesis funds it for the widest commitment its layout packs, and a call that rewrites it wider settles at
 * that same value; every record output carries at least its own threshold, the token prefix counted.
 */

const FIELDS = ['a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'];
const SOURCE = [
  'pragma solidity ^0.8.20;',
  'contract Wide {',
  ...FIELDS.map((field) => `  uint256 ${field};`),
  `  constructor(uint256 v) { ${FIELDS.map((field) => `${field} = v;`).join(' ')} }`,
  `  function grow(uint256 v) external { ${FIELDS.map((field) => `${field} = v;`).join(' ')} }`,
  '  function last() external view returns (uint256) { return a7; }',
  '}',
].join('\n');

/** A data NFT packed to this width holds all eight fields in one record. */
const COMMITMENT_LIMIT = 1024;
/** Eight fields of 27 bytes each: a record over 252 bytes once serialized. */
const WIDE = 2n ** 200n;
/** Eight fields of 34 bytes each: the same record, wider. */
const WIDER = 2n ** 255n;

type DecodedOutput = Parameters<typeof encodeTransactionOutput>[0];

/** The NFT-carrying outputs other than masters: the records, chunks and events a transaction funds. */
function recordOutputs(hex: string): DecodedOutput[] {
  const decoded = decodeTransaction(hexToBin(hex));
  if (typeof decoded === 'string') throw new Error(decoded);
  return decoded.outputs.filter((output) =>
    output.token?.nft !== undefined && output.token.nft.capability !== 'minting');
}

const dustThreshold = (output: DecodedOutput): bigint =>
  3n * (BigInt(encodeTransactionOutput(output).length) + 148n);

function expectFundedAtDust(outputs: readonly DecodedOutput[]): void {
  expect(outputs.length).toBeGreaterThan(0);
  for (const output of outputs) expect(output.valueSatoshis).toBeGreaterThanOrEqual(dustThreshold(output));
}

describe('framed wide record dust', () => {
  it('deploys a record over 252 bytes and settles a call that rewrites it wider', async () => {
    const world = await newWorld(0x5d);
    const artifact = compileStringMulti(SOURCE, {
      solidityImportCompat: true, composition: 'framed', commitmentLimit: COMMITMENT_LIMIT,
    } as never).Wide!;
    const deployment = await deployStatefulContract(artifact, [WIDE] as never, {
      provider: world.network,
      fundingUtxo: await world.walletCoin(),
      changeAddress: world.changeAddress,
      funder: world.walletFunder,
    });
    const genesisRecords = recordOutputs(deployment.tx.hex);
    expect(genesisRecords.some((output) => encodeTransactionOutput(output).length > 252)).toBe(true);
    expectFundedAtDust(genesisRecords);

    const root: PlainDeployment = {
      artifact, categoryId: deployment.categoryId, address: addressOfCategory(deployment.categoryId),
    };
    const outcome = await enterPlain(world, root, 'grow', [WIDER]);
    expect(outcome.error).toBeUndefined();
    const broadcast = outcome.result?.broadcast;
    expect(broadcast).toBeDefined();
    const callRecords = recordOutputs(broadcast!.hex);
    const widthOf = (outputs: readonly DecodedOutput[]): number =>
      Math.max(...outputs.map((output) => encodeTransactionOutput(output).length));
    expect(widthOf(callRecords)).toBeGreaterThan(widthOf(genesisRecords));
    expectFundedAtDust(callRecords);

    const read = await readFramedEntry({
      provider: world.network, artifact, categoryId: deployment.categoryId, functionName: 'last', args: [],
      vm: compositionMachine(),
    });
    expect(read.accepted, read.objection).toBe(true);
    expect(read.value).toEqual(WIDER);
  });
});
