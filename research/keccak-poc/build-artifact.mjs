import { asm, binToHex } from './vm.mjs';
import { genKeccak256x32v2 } from './gen25.mjs';
import { bytecodeToAsm, asmToScript, scriptToBytecode } from '@solidcash/utils';
import { writeFileSync } from 'fs';

// Redeem script: stack in = [pad, expectedHash, preimage] (P2SH, first arg on top).
const wrapperPre = 'OP_SWAP OP_TOALTSTACK OP_SWAP OP_TOALTSTACK';   // stash expectedHash, pad
const wrapperPost = 'OP_FROMALTSTACK OP_DROP OP_FROMALTSTACK OP_EQUAL';
const libauthAsm = `${wrapperPre} ${genKeccak256x32v2((s)=>binToHex(asm(s)))} ${wrapperPost}`;

const bytecode = asm(libauthAsm);
const sdkAsm = bytecodeToAsm(bytecode);
// round-trip check: SDK asm -> script -> bytecode must equal the original
const roundtrip = binToHex(scriptToBytecode(asmToScript(sdkAsm)));
console.log('redeem bytecode size:', bytecode.length, 'bytes');
console.log('SDK asm round-trips to identical bytecode:', roundtrip === binToHex(bytecode));

const artifact = {
  contractName: 'Keccak256',
  constructorInputs: [],
  abi: [{
    name: 'verify',
    inputs: [
      { name: 'preimage', type: 'bytes32' },
      { name: 'expectedHash', type: 'bytes32' },
      { name: 'pad', type: 'bytes' },
    ],
  }],
  bytecode: sdkAsm,
  source: '// hand-authored pure-script keccak256 (not produced by solidc)',
  compiler: { name: 'keccak256-poc', version: '0.13.1' },
  updatedAt: '2026-06-18T00:00:00.000Z',
};
writeFileSync('keccak-poc/Keccak256.artifact.json', JSON.stringify(artifact, null, 2));
console.log('wrote keccak-poc/Keccak256.artifact.json');
