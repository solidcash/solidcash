import { keccak_256 } from '@noble/hashes/sha3.js';
import { asm, binToHex, hexToBin, p2sh32, evalInput } from './sidecar.mjs';
import { genKeccak256var, genKeccakRegistrar } from './genvar.mjs';

const aTo = (s) => binToHex(asm(s));
const KECCAK_FUNCTION_ID = 3;
const KECCAK_SETUP_ASM = `<${KECCAK_FUNCTION_ID}> ${genKeccakRegistrar(aTo)}`;
const KECCAK_INVOKE_ASM = `<${KECCAK_FUNCTION_ID}> OP_INVOKE`;
const ZERO32 = '00'.repeat(32);

const COVENANT_ASM =
  `OP_DUP <0x${ZERO32}> OP_EQUAL ` +
  'OP_IF OP_DROP ' +
  'OP_ELSE OP_0 OP_UTXOTOKENCATEGORY <32> OP_SPLIT OP_DROP OP_EQUALVERIFY OP_ENDIF ' +
  'OP_TOALTSTACK ' +
  `${KECCAK_SETUP_ASM} ` +
  'OP_DUP OP_1 OP_NUMEQUAL OP_IF OP_DROP OP_NIP ' +
  `${KECCAK_INVOKE_ASM} ` +
  'OP_ELSE OP_0 OP_VERIFY OP_ENDIF ' +
  'OP_FROMALTSTACK OP_INPUTINDEX OP_SWAP OP_ADD ' +
  'OP_DUP OP_OUTPUTTOKENCOMMITMENT OP_ROT OP_EQUALVERIFY ' +
  'OP_INPUTINDEX OP_UTXOBYTECODE OP_OVER OP_OUTPUTBYTECODE OP_EQUALVERIFY ' +
  'OP_INPUTINDEX OP_UTXOTOKENCATEGORY OP_OVER OP_OUTPUTTOKENCATEGORY OP_EQUALVERIFY ' +
  'OP_DROP OP_1';

const COVENANT = asm(COVENANT_ASM);
const SALT = new Uint8Array(32).fill(0xcc);
const redeem = Uint8Array.from([0x20, ...SALT, ...COVENANT]);
const lock = p2sh32(redeem);

const preimage = hexToBin('deadbeefcafebabe0102030405060708090a0b0c0d0e0f101112131415161718');
const R = keccak_256(preimage);
const delta = 2;

const pad = new Uint8Array(1000);
const unlock = asm(
  `<0x${binToHex(pad)}> <0x${binToHex(preimage)}> OP_1 <0x${binToHex(new Uint8Array([delta]))}> <0x${binToHex(redeem)}>`,
);
const inputs = [
  { outpointIndex: 0, outpointTransactionHash: new Uint8Array(32), sequenceNumber: 0xffffffff, unlockingBytecode: new Uint8Array(0) },
  { outpointIndex: 1, outpointTransactionHash: new Uint8Array(32).fill(1), sequenceNumber: 0xffffffff, unlockingBytecode: unlock },
  { outpointIndex: 2, outpointTransactionHash: new Uint8Array(32).fill(2), sequenceNumber: 0xffffffff, unlockingBytecode: new Uint8Array(0) },
];
const sourceOutputs = [
  { lockingBytecode: new Uint8Array(25), valueSatoshis: 100000n, token: { category: SALT, amount: 0n, nft: { capability: 'mutable', commitment: '' } } },
  { lockingBytecode: lock, valueSatoshis: 100000n, token: { category: new Uint8Array(32).fill(0xbb), amount: 0n, nft: { capability: 'mutable', commitment: '' } } },
  { lockingBytecode: new Uint8Array(25), valueSatoshis: 100000n },
];
const outputs = [
  { lockingBytecode: new Uint8Array(25), valueSatoshis: 100000n },
  { lockingBytecode: new Uint8Array(25), valueSatoshis: 100000n },
  { lockingBytecode: new Uint8Array(25), valueSatoshis: 100000n },
  { lockingBytecode: lock, valueSatoshis: 100000n, token: { category: new Uint8Array(32).fill(0xbb), amount: 0n, nft: { capability: 'mutable', commitment: R } } },
];
const r = evalInput(inputs, sourceOutputs, outputs, 1);
console.log('shifted full ok:', !r.error, r.error ? r.error.slice(0, 200) : '');
