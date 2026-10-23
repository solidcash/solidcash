/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect } from 'vitest';
import { hexToBin, binToHex } from '@bitauth/libauth';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { compileStringMulti } from '../direct-compile.js';
import type { ResolvedImport } from '@solidcash/solidc';
import {
  Contract,
  SignatureTemplate,
} from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import type { Utxo } from '../../src/interfaces.js';
import { addressToLockScript, lockingBytecodeToSolidityAddressPayload } from '../../src/utils.js';

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

/** The 20-byte Solidity identity of a locking bytecode, as a Solidity-compat ABI result carries an address. */
function solidityIdentity(lockingBytecode: Uint8Array): Uint8Array {
  const identity = lockingBytecodeToSolidityAddressPayload(lockingBytecode);
  if (identity === undefined) throw new Error(`no Solidity identity for ${binToHex(lockingBytecode)}`);
  return identity;
}

function compileFactory(src: string): { factory: any; child: any } {
  const arts = compileStringMulti(src, {
    evmCompat: true,
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

// This is a mock-only diagnostic: it deliberately installs synthetic outpoints, relaxes mock input-size limits,
// and writes intermediate layouts to /tmp. Those premises do not exist on BCHN (where the synthetic covenant
// setup fails independently of the CREATE2 behavior under inspection).
describe.skipIf(Boolean(process.env.TESTS_USE_REGTEST))('create2 salt isolation (param vs computed vs +vmap)', () => {
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
    const { factory: factoryArt, child: childArt } = compileFactory(factoryComputedSalt);
    const fundF = await mintFund(300_000n);
    const { contract: factory } = await StatefulContract.deploy(factoryArt, [alicePub], {
      provider, fundingUtxo: fundF, funder, changeAddress: p2pkh.address,
    });
    (factory as any).registerChild(childArt);
    const tokenA = p2pkh.address;
    const tokenB = new Contract(p2pkhArtifact, [hexToBin('22'.repeat(20))], { provider }).address;
    const fundC = await mintFund();
    const result = await StatefulContract.deployFrom({
      provider, factory: factory as any, deployFunctionName: 'deployComputed',
      deployFunctionArgs: [new SignatureTemplate(alicePriv), tokenA, tokenB],
      childArtifact: childArt, childConstructorArgs: [],
      fundingUtxo: fundC, funder, changeAddress: p2pkh.address, fee: 30_000n,
    });
    expect(result.tx.txid).toBeDefined();
    // Offline salt for parity check, by the covenant's rules: `tokenA < tokenB` orders the address bytes as
    // unsigned big-endian numbers, and this Solidity-compat source packs each address as its 20-byte identity
    // (HASH160 of these P2SH32 locks), so the preimage is 40 bytes, not the two locking bytecodes.
    const a = addressToLockScript(tokenA);
    const b = addressToLockScript(tokenB);
    const asNumber = (value: Uint8Array): bigint => BigInt(`0x${binToHex(value)}`);
    const [t0, t1] = asNumber(a) < asNumber(b) ? [a, b] : [b, a];
    const [p0, p1] = [lockingBytecodeToSolidityAddressPayload(t0)!, lockingBytecodeToSolidityAddressPayload(t1)!];
    const packed = new Uint8Array(p0.length + p1.length);
    packed.set(p0, 0); packed.set(p1, p0.length);
    expect(packed).toHaveLength(40);
    const salt = keccak_256(packed);
    const expected = new Contract(childArt, [], {
      provider, addressType: 'p2sh32', category: hexToBin(result.childCategoryId), salt,
    });
    expect(result.child.address).toBe(expected.address);
  }, 120_000);

  it('C0: dual getPair vmap writes without deploy succeed via normal call path', async () => {
    // Single-file compile (no import)
    const { compileString } = await import('../direct-compile.js');
    const art = compileString(factoryVMapOnly, { evmCompat: true });
    const fundF = await mintFund(300_000n);
    const { contract: factory } = await StatefulContract.deploy(art, [alicePub], {
      provider, fundingUtxo: fundF, funder, changeAddress: p2pkh.address,
    });
    const tokenA = p2pkh.address;
    const tokenB = new Contract(p2pkhArtifact, [hexToBin('44'.repeat(20))], { provider }).address;
    const pairAddr = new Contract(p2pkhArtifact, [hexToBin('55'.repeat(20))], { provider }).address;
    await (factory as any).setBoth(new SignatureTemplate(alicePriv), tokenA, tokenB, pairAddr).send();
    const ab = await (factory as any).getPair(tokenA, tokenB);
    const ba = await (factory as any).getPair(tokenB, tokenA);
    // Both entries store the pair's full locking bytecode. A Solidity-compat function returns its result in the EVM
    // ABI encoding, where an address is its 20-byte Solidity identity (HASH160 of a P2SH32 lock), so that is what
    // the getter returns for the stored pair.
    const exp = solidityIdentity(addressToLockScript(pairAddr));
    expect(ab).toEqual(exp);
    expect(ba).toEqual(exp);
  }, 120_000);

  it('C: computed salt + dual getPair vmap succeeds', async () => {
    const { factory: factoryArt, child: childArt } = compileFactory(factoryFull);
    const fundF = await mintFund(400_000n);
    const { contract: factory } = await StatefulContract.deploy(factoryArt, [alicePub], {
      provider, fundingUtxo: fundF, funder, changeAddress: p2pkh.address,
    });
    (factory as any).registerChild(childArt);
    const tokenA = p2pkh.address;
    const tokenB = new Contract(p2pkhArtifact, [hexToBin('33'.repeat(20))], { provider }).address;
    const fundC = await mintFund(300_000n);
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
    // The getter's EVM ABI result carries the child's 20-byte Solidity identity, as in C0.
    const expected = solidityIdentity(addressToLockScript(result.child.address));
    expect(ab).toEqual(expected);
    expect(ba).toEqual(expected);
  }, 180_000);
});
