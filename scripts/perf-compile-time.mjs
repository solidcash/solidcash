#!/usr/bin/env node
/** Time the maintained marketplace compile (all declarations, legacy convention). */
import path from 'node:path';
import { compileFileMulti } from '@solidcash/solidc';
const source = path.join(process.cwd(), '.marketplace/contracts/MarketplaceV1.sol');
const options = {
  evmCompat: true, messageBus: true, messageBusKernel: false, messageBusGraphContext: true,
  ecrecover: 'p2pkh', optimizeForCompilationSpeed: true, suppressWarnings: true,
  maximumInputBytes: 10_000_000, commitmentLimit: 10_000_000,
};
const started = Date.now();
const artifacts = compileFileMulti(source, options);
console.log(JSON.stringify({
  ms: Date.now() - started,
  declarations: Object.keys(artifacts).length,
}));
