import path from 'node:path';
import { createHash } from 'node:crypto';
import { compileFileMulti } from '@solidcash/solidc';
const src = path.join(process.cwd(), '.marketplace/contracts/MarketplaceV1.sol');
// The maintained marketplace build: the compiler options of the project's `solidcash.config.ts`.
const arts = compileFileMulti(src, { evmCompat: true, ecrecover: 'p2pkh', optimizeForCompilationSpeed: true,
  suppressWarnings: true, tagSingletonDataNfts: true, composition: 'framed',
  maximumInputBytes: 10_000_000, commitmentLimit: 10_000_000 });
const sha = (v) => createHash('sha256').update(v ?? '').digest('hex');
const a = arts.MarketplaceV1;
console.log(JSON.stringify({ fullBytes: (a.debug?.bytecode?.length ?? 0) / 2,
  fullHash: sha(a.debug?.bytecode).slice(0, 16) }));
