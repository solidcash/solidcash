// Regenerate the @solidcash/utils keccak library constants from genvar.mjs (the re-entrant registrar).
// Run after changing the keccak generator: node keccak-poc/regen-utils-blob.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { asm, binToHex } from './vm.mjs';
import { genKeccakRegistrar } from './genvar.mjs';
import { hash256 } from '@solidcash/utils';

// The callable id is consumer-assigned (pushed by the loader), so it is NOT baked into the blob; only the
// reserved keccak-internal round id is.
const ROUND_ID = 2;
const aTo = (s) => binToHex(asm(s));
const blob = asm(genKeccakRegistrar(aTo, ROUND_ID));
const blobHex = binToHex(blob);
const blobHash = binToHex(hash256(blob));
const length = blob.length;

const path = new URL('../packages/utils/src/keccak-library.ts', import.meta.url);
let src = readFileSync(path, 'utf8');
src = src.replace(/(KECCAK256_LIBRARY_BLOB = ')[0-9a-f]*(';)/, `$1${blobHex}$2`);
src = src.replace(/(KECCAK256_LIBRARY_BLOB_HASH = ')[0-9a-f]*(';)/, `$1${blobHash}$2`);
src = src.replace(/(KECCAK256_LIBRARY_BLOB_LENGTH = )\d+(;)/, `$1${length}$2`);
writeFileSync(path, src);
console.log('updated keccak-library.ts: length', length, 'hash', blobHash);
