// Generate the SINGLE-PREIMAGE "shifted" computing side-car covenant for a dynamic keccak loop whose trailing
// band also carries a mapping loop with UNEQUAL input/output widths (e.g. a sorted-upsert: 1 predecessor input,
// N+1 entry outputs). The ordinary stateful covenant self-preserves at OP_INPUTINDEX, which collides with the
// mapping outputs when the keccak loop runs AFTER the mapping loop. This variant's unlocker carries a
// `delta = outputIndex - inputIndex` word; the covenant stashes it, hashes ONE preimage, and recreates at
// INPUTINDEX + delta. Mirrors gen-compute-sidecar.mjs; the contract-side integrity check must bake its hash.
import { asm, binToHex, hash256 } from './sidecar.mjs';
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
  'OP_TOALTSTACK ' +                                                        // stash delta -> [pad,P,width]
  `${KECCAK_SETUP_ASM} ` +                                                  // define the reusable keccak body
  'OP_DUP OP_1 OP_NUMEQUAL OP_IF OP_DROP OP_NIP ' +                         // width==1 -> [P]
  `${KECCAK_INVOKE_ASM} ` +                                                 // [R]
  'OP_ELSE OP_0 OP_VERIFY OP_ENDIF ' +                                      // fail closed on width != 1
  'OP_FROMALTSTACK OP_INPUTINDEX OP_SWAP OP_ADD ' +                         // [R, outIdx = inputIdx + delta]
  'OP_DUP OP_OUTPUTTOKENCOMMITMENT OP_ROT OP_EQUALVERIFY ' +
  'OP_INPUTINDEX OP_UTXOBYTECODE OP_OVER OP_OUTPUTBYTECODE OP_EQUALVERIFY ' +
  'OP_INPUTINDEX OP_UTXOTOKENCATEGORY OP_OVER OP_OUTPUTTOKENCATEGORY OP_EQUALVERIFY ' +
  'OP_DROP OP_1';

const COVENANT = asm(COVENANT_ASM);
console.log('KECCAK_SHIFTED_COVENANT =', binToHex(COVENANT));
console.log('KECCAK_SHIFTED_COVENANT_HASH =', binToHex(hash256(COVENANT)));
console.log('LEN =', COVENANT.length);
