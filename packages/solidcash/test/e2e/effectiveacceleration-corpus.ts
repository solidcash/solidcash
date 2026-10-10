import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The sibling EffectiveAcceleration checkout's Solidity tree, which the real-contract regression tests compile.
 *
 * That project's sources are its own and are deliberately not mirrored into this repo, so these tests resolve the
 * checkout from `EACC_CONTRACTS_DIR` or by walking up from this file, and skip when it is absent: a clone without
 * the sibling has no real corpus to compile.
 */
export function effectiveAccelerationContractsRoot(): string | undefined {
  const fromEnv = process.env.EACC_CONTRACTS_DIR;
  if (fromEnv !== undefined && fromEnv !== '') {
    return existsSync(fromEnv) ? path.resolve(fromEnv) : undefined;
  }
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const candidate = path.join(dir, 'effectiveacceleration.ai', 'contract', 'contracts');
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}
