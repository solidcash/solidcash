import { describe, expect, it } from 'vitest';
import { compileStringSplit } from 'solidc';
import { Signer, SignatureTemplate, SplitContractBundle } from '../../src/index.js';
import { alicePriv, alicePub } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';

/**
 * X162/X166. A SPLIT BUNDLE IS ONLY A BUNDLE IF ITS SHARDS AGREE ABOUT WHAT A SLOT MEANS - and then it has
 * to actually SPEND.
 *
 * Two passes append hidden state variables in the order the SURVIVING functions first reach them
 * (`LowerStorageSlotPointers` for ERC-7201 namespaces, `SynthesizeBlockOracle` for block.* registers), and
 * `compileFacet` filters the function set before the ordinary pipeline runs the first of them. The root, its
 * facets and the manifest therefore carried different physical layouts of the same state. A delegate facet
 * writes the ROOT's state through physical slots, so that is a wrong-variable write, not a metadata nit.
 *
 * Both passes now run in `prepareSplitAst`, on the COMPLETE function set, in the ordinary pipeline's relative
 * order. This file is the load-and-spend evidence: a multi-namespace, multi-facet bundle that the compiler's
 * `assertSplitLayoutsAgree` and the SDK's `validateSplitBundle` both admit, deployed and then spent through
 * BOTH a facet-resident function and a root-resident one.
 */
const SOURCE = `pragma solidity ^0.8.7;
  abstract contract AMod {
    struct AStorage { uint256 a; }
    bytes32 private constant ALoc = 0x9016d09d72d40fdae2fd8ceac6b6234c7706214fd39c1cd1e609a0528c199300;
    function _a() private pure returns (AStorage storage $) { assembly { $.slot := ALoc } }
    function _setA(uint256 v) internal { AStorage storage $ = _a(); $.a = v; }
  }
  abstract contract BMod {
    struct BStorage { uint256 b; }
    bytes32 private constant BLoc = 0xcd5ed15c6e187e77e9aee88184c21f4f2182ab5827cb3b7e07fbedcd63f03300;
    function _b() private pure returns (BStorage storage $) { assembly { $.slot := BLoc } }
    function _setB(uint256 v) internal { BStorage storage $ = _b(); $.b = v; }
  }
  abstract contract CMod {
    struct CStorage { uint256 c; }
    bytes32 private constant CLoc = 0x237e158222e3e6968b72b9db0d8043aacf074ad9f650f0d1606b4d82ee432c00;
    function _c() private pure returns (CStorage storage $) { assembly { $.slot := CLoc } }
    function _setC(uint256 v) internal { CStorage storage $ = _c(); $.c = v; }
  }
  contract Multi is AMod, BMod, CMod {
    uint256 own;
    function touchC(uint256 v) public { _setC(v); own = v; require(v >= 0, "n"); }
    function touchA(uint256 v) public { _setA(v); own = v + 1; require(v >= 0, "n"); }
    function touchB(uint256 v) public { _setB(v); own = v + block.timestamp; require(v >= 0, "n"); }
  }`;

const OPTIONS = { solidityImportCompat: true, forceSplit: true };

const slots = (layout: any): string[] => (layout?.variables ?? [])
  .map((v: any) => `${v.name}@${v.nftIndex}.${v.fieldIndex}`);

/** The smallest limit at which the planner cannot keep every entry in one facet: measured, not guessed. */
function dividedBundle(): any {
  const single = compileStringSplit(SOURCE, OPTIONS);
  expect(single.manifest.facets).toHaveLength(1);
  return compileStringSplit(SOURCE, {
    ...OPTIONS, maxShardBytes: single.manifest.facets[0].estimatedRedeemBytes - 1,
  });
}

async function fundedSigner(): Promise<Signer> {
  const provider = createTestProvider();
  const signer = new Signer(alicePriv, provider);
  for (const byte of ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'a7', 'b8']) {
    await provider.addUtxo(signer.getAddress(), { txid: byte.repeat(32), vout: 0, satoshis: 1_000_000n });
  }
  return signer;
}

const GENESIS = {
  own: 0n, AStorage__a: 0n, BStorage__b: 0n, CStorage__c: 0n,
  __block_timestamp: 0n, __blockOracleOwner: alicePub,
};

describe('X162: a divided ERC-7201 split bundle agrees about storage, loads, and spends', () => {
  it('emits one layout across the baseline, the root and every facet', () => {
    const bundle = dividedBundle();
    expect(bundle.manifest.facets.length).toBeGreaterThan(1);
    const rootSlots = slots(bundle.root.stateLayout);
    // Every promoted ERC-7201 namespace AND the injected oracle registers are present, so the case really is
    // the shard-dependent one rather than a contract with nothing to disagree about.
    expect(rootSlots).toEqual(expect.arrayContaining([
      expect.stringContaining('AStorage__a@'), expect.stringContaining('BStorage__b@'),
      expect.stringContaining('CStorage__c@'), expect.stringContaining('__block_timestamp@'),
    ]));
    for (const info of bundle.manifest.facets) {
      expect(slots(bundle.facets[info.name].stateLayout), `${info.name} layout`).toEqual(rootSlots);
    }
  });

  it('loads through the SDK bundle validator that refuses a divergent bundle', async () => {
    const signer = await fundedSigner();
    const bundle = dividedBundle();
    // `validateSplitBundle` compares each shard's FULL layout fingerprint against the manifest's, which is
    // taken from the unsplit baseline. It is the load-time boundary this row was filed against.
    expect(() => SplitContractBundle.from(bundle, signer)).not.toThrow();

    // GUARD NEGATIVE CONTROL, differing only in the attacked field: one facet's promoted-namespace slots
    // reordered and nothing else. The loader must still refuse it, so the admission above is the layouts
    // agreeing rather than the check having been weakened.
    const tampered = structuredClone(bundle);
    const name = tampered.manifest.facets[0].name;
    const variables = [...tampered.facets[name].stateLayout.variables];
    const swap = variables.findIndex((v: any) => v.name.startsWith('AStorage'));
    const other = variables.findIndex((v: any) => v.name.startsWith('CStorage'));
    expect(swap).toBeGreaterThanOrEqual(0);
    expect(other).toBeGreaterThanOrEqual(0);
    [variables[swap].name, variables[other].name] = [variables[other].name, variables[swap].name];
    tampered.facets[name].stateLayout = { ...tampered.facets[name].stateLayout, variables };
    expect(() => SplitContractBundle.from(tampered, signer)).toThrow(/state layout differs/i);
  });

  it('SPENDS: a facet-resident write and a root-resident write both settle on one shared state', async () => {
    const signer = await fundedSigner();
    const bundle = dividedBundle();
    const deployed = await SplitContractBundle.from(bundle, signer).deploy([], { initialState: GENESIS });
    expect(Object.keys(deployed.facets)).toHaveLength(bundle.manifest.facets.length);

    // A function the planner MOVED into a facet. The facet writes the root's state through physical slots,
    // so a disagreement about what slot 0.1 means shows up here as the wrong name changing.
    const facetRoute = bundle.manifest.routes.find((r: any) => r.function === 'touchA');
    expect(facetRoute.target).not.toBe('root');
    await deployed.call.touchA(5n).send();
    const afterA = await deployed.root.getState();
    expect(afterA.AStorage__a).toBe(5n);
    expect(afterA.own).toBe(6n);
    expect(afterA.BStorage__b).toBe(0n);
    expect(afterA.CStorage__c).toBe(0n);

    // A second facet-resident write into a DIFFERENT namespace, so one correct slot cannot carry the row.
    await deployed.call.touchC(9n).send();
    const afterC = await deployed.root.getState();
    expect(afterC.CStorage__c).toBe(9n);
    expect(afterC.own).toBe(9n);
    expect(afterC.AStorage__a).toBe(5n);

    // A function that STAYS ON THE ROOT: the compiler-generated oracle update, which is a real state
    // transition on the root script rather than a delegated one.
    const rootRoute = bundle.manifest.routes.find((r: any) => r.function === '__updateBlockOracle');
    expect(rootRoute.target).toBe('root');
    await deployed.call.__updateBlockOracle(new SignatureTemplate(alicePriv), 1_700_000_000n)
      .setState({ __block_timestamp: 1_700_000_000n }).send();
    const afterOracle = await deployed.root.getState();
    expect(afterOracle.__block_timestamp).toBe(1_700_000_000n);
    expect(afterOracle.AStorage__a).toBe(5n);
    expect(afterOracle.CStorage__c).toBe(9n);
  }, 300_000);
});
