// Offline inventory of the exact framed programs and declared state encodings in the marketplace lane.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ConsensusBch2026 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-consensus.js';
import { encodeDataPush } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/push.js';
import {
  asmToScript, buildPushdataCommitment, scriptToBytecode, validatorRedeemScript,
} from '../packages/utils/dist/index.js';
import { framedValidator } from '../packages/solidc/dist/runtime.js';
import { compileStringMulti } from '../packages/solidc/dist/compiler.js';
import { compileProxyArtifact } from '../packages/solidcash/dist/framed/proxy/generate-core.js';
import { fixtureStaleness } from './marketplace-fixture-fresh.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
if (fixtureStaleness(root)?.stale) throw new Error('Run a complete normal marketplace compile before inventorying it.');
const folder = path.join(root, '.marketplace/artifacts/solidcash');
const artifacts = readdirSync(folder).filter((name) => name.endsWith('.json')).sort().map((name) => {
  const bytes = readFileSync(path.join(folder, name));
  return { artifact: JSON.parse(bytes), digest: createHash('sha256').update(bytes).digest('hex') };
});
const executable = artifacts.filter(({ artifact }) => artifact.bytecode.length > 0);
const parts = framedValidator.buildValidatorParts();
const stock = ConsensusBch2026;
const programRows = [];
const records = [];
const program = (name, bytes) => {
  programRows.push([name, bytes.length, stock.maximumStackItemLength - bytes.length]);
};
const inspect = (artifact, role) => {
  // Deployment fills fixed-width placeholders and the oracle lock, leaving this byte count unchanged.
  program(`${artifact.contractName} ${role}`, scriptToBytecode(asmToScript(artifact.bytecode)));
  if (artifact.delegateArtifact) inspect(artifact.delegateArtifact, 'delegate');
  const layout = artifact.stateLayout;
  if (!layout) return;
  const defaults = Array.from({ length: layout.dataNftCount }, (_, index) =>
    buildPushdataCommitment(layout, {}, index).length / 2);
  records.push([artifact.contractName, defaults.join(', '), layout.commitmentLimit,
    stock.maximumTokenCommitmentLength - Math.max(...defaults),
    stock.maximumTokenCommitmentLength - layout.commitmentLimit]);
};
for (const { artifact } of executable) inspect(artifact, 'master');
// These are the two proxy deployments in the unchanged canonical fixture. Their implementations above also
// execute as DELEGATE frames; framed artifacts use the same program for those frames.
for (const name of ['MarketplaceV1', 'MarketplaceDataV1']) {
  inspect(compileProxyArtifact(executable.find(({ artifact }) => artifact.contractName === name).artifact,
    (source, options) => compileStringMulti(source, { ...options, suppressWarnings: true })), 'proxy master');
}
program('shared validator head, including category pin', validatorRedeemScript(new Uint8Array(32), parts[0]));
parts.slice(1).forEach((part, index) => program(`shared validator facet ${index + 1}`, part));

console.log('# Offline marketplace stock-limit inventory\n');
console.log('Measured against the current complete marketplace artifacts and the pinned libauth BCH_2026_05 VM.');
console.log('No node or transaction execution is performed by this script. Regenerate with');
console.log('`node scripts/marketplace-stock-inventory.mjs`. All sizes and margins below are bytes.\n');
console.log(`The stock redeem-script stack-item ceiling is **${stock.maximumStackItemLength}**; the complete unlocking`);
console.log(`script has a separate **${stock.maximumBytecodeLength}** consensus ceiling and`);
console.log(`**${stock.maximumStandardUnlockingBytecodeLength}** relay-policy ceiling. Redeem scripts must be pushed`);
console.log('inside that unlocking script, alongside every argument and witness; a positive margin here does not');
console.log('establish that a spend fits. A negative margin already rules out an ordinary P2SH spend.\n');
console.log('| Artifact / participant | Redeem script | Stack-item margin |');
console.log('| --- | ---: | ---: |');
programRows.forEach((row) => console.log(`| ${row.join(' | ')} |`));
if (!executable.some(({ artifact }) => artifact.delegateArtifact)) {
  console.log('\nNo separate delegate artifact is published in this framed fixture: implementation DELEGATE frames use');
  console.log('the implementation master program measured above.');
}
console.log('Generated proxies are measured through the shipped');
console.log('source generator with the same layout options. Compiler warning printing alone is suppressed.');
console.log('\nThe validator facets have no argument pushes: their complete unlocking scripts are just their');
console.log('redeem-script pushes. The head additionally carries the encoded transcript.\n');
console.log('| Facet | Complete unlocking script | Consensus margin | Relay margin |');
console.log('| --- | ---: | ---: | ---: |');
parts.slice(1).forEach((part, index) => {
  const bytes = encodeDataPush(part).length;
  console.log(`| ${index + 1} | ${bytes} | ${stock.maximumBytecodeLength - bytes} | ${stock.maximumStandardUnlockingBytecodeLength - bytes} |`);
});
console.log('\nState defaults are exact encodings of the schema defaults, not measured deployed commitments.');
console.log('They are lower-bound examples, not maximum-field claims. The artifact ceiling is a published');
console.log('encoding allowance, not evidence that a particular call requires that size. Stock commitments are');
console.log(`limited to **${stock.maximumTokenCommitmentLength}** bytes. Full chunk/sorted-node commitments can use all 128.\n`);
console.log('| State owner | Default record sizes | Published commitment ceiling | Smallest default margin | Published-ceiling margin |');
console.log('| --- | ---: | ---: | ---: | ---: |');
records.forEach((row) => console.log(`| ${row.join(' | ')} |`));
console.log(`\nStock transaction consensus size: **${stock.maximumTransactionLengthBytes}**; relay policy:`);
console.log(`**${stock.maximumStandardTransactionSize}**. Operation budget per input is`);
console.log(`**${stock.operationCostBudgetPerByte} × (${stock.densityControlBaseLength} + encoded unlocking bytes)**.`);
console.log(`Hash-iteration density is **${stock.hashDigestIterationsPerByteNonstandard}** at consensus and`);
console.log(`**${stock.hashDigestIterationsPerByteStandard}** under relay policy. Input bytes, transaction bytes, actual`);
console.log('commitments, hashing and operation costs require a concrete encoded transaction and per-input VM');
console.log('measurement. This static inventory does not claim deployability; no oversized participant is run with');
console.log('stock limits. The enlarged semantic fixture remains unchanged.\n');
console.log('Limits come from the pinned libauth consensus objects in `node_modules/@bitauth/libauth/build/lib/vm/');
console.log('instruction-sets/bch/{2023,2025,2026}/*consensus.js`; BCH_SPEC is a separate internal-evaluation profile.');
console.log('Pin: `1cf4b432864b3a4ed9f33d1992355d7286f3dab8` (root package.json).\n');
console.log('| Input artifact | SHA-256 of JSON |');
console.log('| --- | --- |');
artifacts.forEach(({ artifact, digest }) => console.log(`| ${artifact.contractName} | ${digest} |`));
console.log(`\n${artifacts.length} input artifacts; ${executable.length} executable artifacts;`);
console.log(`${artifacts.length - executable.length} interface-only artifacts publish no redeem script.`);
