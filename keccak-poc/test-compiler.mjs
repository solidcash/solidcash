// Verify the compiler emits the keccak side-car loader + invoke and records the artifact dependency.
import { compileString } from '../packages/solidc/dist/compiler.js';
import { KECCAK256_LIBRARY_BLOB_HASH, KECCAK256_LIBRARY_BLOB_LENGTH } from '../packages/utils/dist/index.js';

const src = `contract KeccakTest() {
    function verify(bytes preimage, bytes32 expected) {
        require(keccak256(preimage) == expected);
    }
}`;
const art = compileString(src);
const asm = art.bytecode;
console.log('contract externalLibraries:', JSON.stringify(art.externalLibraries));
console.log('verify fn externalLibraries:', JSON.stringify(art.abi.find((f) => f.name === 'verify')?.externalLibraries));
console.log('blobHash matches utils:', art.externalLibraries?.[0]?.blobHash === KECCAK256_LIBRARY_BLOB_HASH);
console.log('loader: OP_TXINPUTCOUNT =', asm.includes('OP_TXINPUTCOUNT'), '| OP_INPUTBYTECODE =', asm.includes('OP_INPUTBYTECODE'));
console.log('integrity: HASH256 =', asm.includes('OP_HASH256'), '| blobHash literal =', asm.includes(KECCAK256_LIBRARY_BLOB_HASH));
console.log('define+invoke: OP_DEFINE =', asm.includes('OP_DEFINE'), '| OP_INVOKE =', asm.includes('OP_INVOKE'));
console.log('blobLen split present:', asm.includes(' ' + KECCAK256_LIBRARY_BLOB_LENGTH + ' ') || asm.includes('OP_SPLIT'));
