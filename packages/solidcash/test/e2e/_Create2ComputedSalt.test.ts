/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect } from 'vitest';
import { hexToBin, binToHex } from '@bitauth/libauth';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { writeFileSync, mkdirSync } from 'fs';
import { compileStringMulti } from '../direct-compile.js';
import type { ResolvedImport } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import type { Utxo } from '../../src/interfaces.js';
import { addressToLockScript } from '../../src/utils.js';

const SCRATCH = '/tmp/grok-goal-f077261f25bd/implementer';

const childSrc = `
  contract PairChild() {
    int public n;
    function bump() { this.n = this.n + 1; require(true); }
  }
`;

// A: param salt (known green pattern)
const factoryParamSalt = `
  import "./pair_child.scash";
  contract FactoryParam(pubkey owner) {
    int deployCount;
    function deploySalted(sig s, bytes32 salt) {
      require(checkSig(s, owner));
      PairChild child = new PairChild{salt: salt}();
      this.deployCount = this.deployCount + 1;
    }
  }
`;

// B: computed salt via keccak(encodePacked(a,b)) - createPair shape without vmap
const factoryComputedSalt = `
  import "./pair_child.scash";
  contract FactoryComputed(pubkey owner) {
    int deployCount;
    function deployComputed(sig s, address tokenA, address tokenB) returns (address pair) {
      require(checkSig(s, owner));
      (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
      bytes memory bytecode = type(PairChild).creationCode;
      bytes32 salt = keccak256(abi.encodePacked(token0, token1));
      assembly {
        pair := create2(0, add(bytecode, 32), mload(bytecode), salt)
      }
      this.deployCount = this.deployCount + 1;
    }
  }
`;

// C0: dual getPair vmap writes WITHOUT deploy (isolates multi-key batch)
const factoryVMapOnly = `
  contract FactoryVMapOnly(pubkey owner) {
    mapping(address => mapping(address => address)) public getPair;
    function setBoth(sig s, address tokenA, address tokenB, address pair) {
      require(checkSig(s, owner));
      (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
      require(getPair[token0][token1] == address(0));
      getPair[token0][token1] = pair;
      getPair[token1][token0] = pair;
    }
  }
`;

// C: computed salt + dual getPair vmap writes
const factoryFull = `
  import "./pair_child.scash";
  contract FactoryFull(pubkey owner) {
    mapping(address => mapping(address => address)) public getPair;
    function createPair(sig s, address tokenA, address tokenB) returns (address pair) {
      require(checkSig(s, owner));
      require(tokenA != tokenB);
      (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
      require(getPair[token0][token1] == address(0));
      bytes memory bytecode = type(PairChild).creationCode;
      bytes32 salt = keccak256(abi.encodePacked(token0, token1));
      assembly {
        pair := create2(0, add(bytecode, 32), mload(bytecode), salt)
      }
      getPair[token0][token1] = pair;
      getPair[token1][token0] = pair;
    }
  }
`;

function compileFactory(src: string): { factory: any; child: any } {
  const arts = compileStringMulti(src, {
    solidityImportCompat: true,
    rootFileId: '/main.scash',
    importResolver: (importPath: string, currentFile: string): ResolvedImport | undefined => {
      const dir = currentFile.substring(0, currentFile.lastIndexOf('/') + 1);
      let resolved = dir + importPath.replace('./', '');
      if (!resolved.endsWith('.scash')) resolved += '.scash';
      return resolved.endsWith('pair_child.scash') ? { source: childSrc, id: resolved } : undefined;
    },
  });
  const factory = Object.values(arts).find((a: any) => a.contractName?.startsWith('Factory')) as any;
  const child = arts.PairChild;
  return { factory, child };
}

describe('create2 salt isolation (param vs computed vs +vmap)', () => {
  const provider = createTestProvider();
  (provider as any).consensusLimits = {
    ...(provider as any).consensusLimits,
    maximumInputBytes: 100_000,
    maximumTransactionBytes: 10_000_000,
  };
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const funder = p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv));
  let fundSeq = 0;
  async function mintFund(sats = 200_000n): Promise<Utxo> {
    fundSeq += 1;
    const txid = binToHex(Uint8Array.from({ length: 32 }, (_, i) => (fundSeq + i) & 0xff));
    const u: Utxo = { txid, vout: 0, satoshis: sats };
    await provider.addUtxo(p2pkh.address, u);
    return u;
  }

  it('A: param salt deploy succeeds (baseline)', async () => {
    const { factory: factoryArt, child: childArt } = compileFactory(factoryParamSalt);
    const fundF = await mintFund(300_000n);
    const { contract: factory } = await StatefulContract.deploy(factoryArt, [alicePub], {
      provider, fundingUtxo: fundF, funder, changeAddress: p2pkh.address,
    });
    (factory as any).registerChild(childArt);
    const salt = hexToBin('cd'.repeat(32));
    const fundC = await mintFund();
    const result = await StatefulContract.deployFrom({
      provider, factory: factory as any, deployFunctionName: 'deploySalted',
      deployFunctionArgs: [new SignatureTemplate(alicePriv), salt],
      childArtifact: childArt, childConstructorArgs: [],
      fundingUtxo: fundC, funder, changeAddress: p2pkh.address, fee: 20_000n,
    });
    expect(result.tx.txid).toBeDefined();
    const expected = new Contract(childArt, [], {
      provider, addressType: 'p2sh32', category: hexToBin(result.childCategoryId), salt,
    });
    expect(result.child.address).toBe(expected.address);
  }, 120_000);

  it('B: computed keccak salt deploy succeeds (no vmap)', async () => {
    mkdirSync(SCRATCH, { recursive: true });
    const { factory: factoryArt, child: childArt } = compileFactory(factoryComputedSalt);
    const cp = factoryArt.abi.find((f: any) => f.name === 'deployComputed');
    writeFileSync(`${SCRATCH}/create2-B-layout.json`, JSON.stringify({
      deployTargets: cp?.deployTargets, blockLayout: cp?.blockLayout, keccak: cp?.keccakCompute,
    }, null, 2));
    const fundF = await mintFund(300_000n);
    const { contract: factory } = await StatefulContract.deploy(factoryArt, [alicePub], {
      provider, fundingUtxo: fundF, funder, changeAddress: p2pkh.address,
    });
    (factory as any).registerChild(childArt);
    const tokenA = p2pkh.address;
    const tokenB = new Contract(p2pkhArtifact, [hexToBin('22'.repeat(20))], { provider }).address;
    const fundC = await mintFund();
    try {
      const result = await StatefulContract.deployFrom({
        provider, factory: factory as any, deployFunctionName: 'deployComputed',
        deployFunctionArgs: [new SignatureTemplate(alicePriv), tokenA, tokenB],
        childArtifact: childArt, childConstructorArgs: [],
        fundingUtxo: fundC, funder, changeAddress: p2pkh.address, fee: 30_000n,
      });
      expect(result.tx.txid).toBeDefined();
      // Offline salt for parity check
      const a = addressToLockScript(tokenA);
      const b = addressToLockScript(tokenB);
      const [t0, t1] = binToHex(a) < binToHex(b) ? [a, b] : [b, a];
      const packed = new Uint8Array(t0.length + t1.length);
      packed.set(t0, 0); packed.set(t1, t0.length);
      const salt = keccak_256(packed);
      const expected = new Contract(childArt, [], {
        provider, addressType: 'p2sh32', category: hexToBin(result.childCategoryId), salt,
      });
      writeFileSync(`${SCRATCH}/create2-B.log`,
        `OK child=${result.child.address}\nexpected=${expected.address}\nsalt=${binToHex(salt)}\n`);
      expect(result.child.address).toBe(expected.address);
    } catch (e: any) {
      writeFileSync(`${SCRATCH}/create2-B.log`, `ERR ${e?.message ?? e}\n`);
      throw e;
    }
  }, 120_000);

  it('C0: dual getPair vmap writes without deploy succeed via normal call path', async () => {
    mkdirSync(SCRATCH, { recursive: true });
    // Single-file compile (no import)
    const { compileString } = await import('../direct-compile.js');
    const art = compileString(factoryVMapOnly, { solidityImportCompat: true });
    const fundF = await mintFund(300_000n);
    const { contract: factory } = await StatefulContract.deploy(art, [alicePub], {
      provider, fundingUtxo: fundF, funder, changeAddress: p2pkh.address,
    });
    const tokenA = p2pkh.address;
    const tokenB = new Contract(p2pkhArtifact, [hexToBin('44'.repeat(20))], { provider }).address;
    const pairAddr = new Contract(p2pkhArtifact, [hexToBin('55'.repeat(20))], { provider }).address;
    try {
      await (factory as any).setBoth(new SignatureTemplate(alicePriv), tokenA, tokenB, pairAddr).send();
      const ab = await (factory as any).getPair(tokenA, tokenB);
      const ba = await (factory as any).getPair(tokenB, tokenA);
      const exp = binToHex(addressToLockScript(pairAddr));
      const abHex = ab instanceof Uint8Array ? binToHex(ab) : binToHex(addressToLockScript(String(ab)));
      const baHex = ba instanceof Uint8Array ? binToHex(ba) : binToHex(addressToLockScript(String(ba)));
      writeFileSync(`${SCRATCH}/create2-C0.log`, `OK AB=${abHex} BA=${baHex} exp=${exp}\n`);
      expect(abHex).toBe(exp);
      expect(baHex).toBe(exp);
    } catch (e: any) {
      writeFileSync(`${SCRATCH}/create2-C0.log`, `ERR ${e?.message ?? e}\n`);
      throw e;
    }
  }, 120_000);

  it('C: computed salt + dual getPair vmap succeeds', async () => {
    mkdirSync(SCRATCH, { recursive: true });
    const { factory: factoryArt, child: childArt } = compileFactory(factoryFull);
    const cp = factoryArt.abi.find((f: any) => f.name === 'createPair');
    writeFileSync(`${SCRATCH}/create2-C-layout.json`, JSON.stringify({
      deployTargets: cp?.deployTargets, blockLayout: cp?.blockLayout,
      entryAccesses: cp?.entryAccesses, sortedBatchInfo: cp?.sortedBatchInfo,
    }, null, 2));
    const fundF = await mintFund(400_000n);
    const { contract: factory } = await StatefulContract.deploy(factoryArt, [alicePub], {
      provider, fundingUtxo: fundF, funder, changeAddress: p2pkh.address,
    });
    (factory as any).registerChild(childArt);
    const tokenA = p2pkh.address;
    const tokenB = new Contract(p2pkhArtifact, [hexToBin('33'.repeat(20))], { provider }).address;
    const fundC = await mintFund(300_000n);
    // Diagnostics: HEAD entry must exist before dual insert.
    const full = await (factory as any).getFullState();
    const entryN = full.entryNftUtxos?.length ?? 0;
    writeFileSync(`${SCRATCH}/create2-C-pre.json`, JSON.stringify({
      entryN,
      entries: (full.entryNftUtxos ?? []).map((u: any) => ({
        vout: u.vout, sat: String(u.satoshis),
        cap: u.token?.nft?.capability,
        c: (u.token?.nft?.commitment ?? '').slice(0, 80),
      })),
      dataN: full.dataNftUtxos?.length ?? 0,
      dataNftCount: factoryArt.stateLayout?.dataNftCount,
    }, null, 2));
    try {
      const result = await StatefulContract.deployFrom({
        provider, factory: factory as any, deployFunctionName: 'createPair',
        deployFunctionArgs: [new SignatureTemplate(alicePriv), tokenA, tokenB],
        childArtifact: childArt, childConstructorArgs: [],
        fundingUtxo: fundC, funder, changeAddress: p2pkh.address, fee: 40_000n,
      });
      expect(result.tx.txid).toBeDefined();
      const sc = factory as any;
      const ab = await sc.getPair(tokenA, tokenB);
      const ba = await sc.getPair(tokenB, tokenA);
      const expectedLbc = addressToLockScript(result.child.address);
      const abHex = ab instanceof Uint8Array ? binToHex(ab) : binToHex(addressToLockScript(String(ab)));
      const baHex = ba instanceof Uint8Array ? binToHex(ba) : binToHex(addressToLockScript(String(ba)));
      writeFileSync(`${SCRATCH}/create2-C.log`,
        `OK child=${result.child.address}\nAB=${abHex}\nBA=${baHex}\nexp=${binToHex(expectedLbc)}\n`);
      expect(abHex).toBe(binToHex(expectedLbc));
      expect(baHex).toBe(binToHex(expectedLbc));
    } catch (e: any) {
      writeFileSync(`${SCRATCH}/create2-C.log`, `ERR ${e?.message ?? e}\n`);
      throw e;
    }
  }, 180_000);
});
