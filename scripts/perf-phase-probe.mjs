import path from 'node:path';
import { compileFileMulti } from '@solidcash/solidc';
const src = path.join(process.cwd(), '.marketplace/contracts/MarketplaceV1.sol');
const t = Date.now();
const arts = compileFileMulti(src, { evmCompat:true, messageBus:true, messageBusKernel:false,
  messageBusGraphContext:true, ecrecover:'p2pkh', optimizeForCompilationSpeed:true, suppressWarnings:true,
  maximumInputBytes:10_000_000, commitmentLimit:10_000_000 });
console.log(JSON.stringify({ ms: Date.now()-t, decls: Object.keys(arts).length }));
