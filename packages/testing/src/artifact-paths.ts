import path from 'path';

export const SOLIDCASH_ARTIFACTS_NAMESPACE = 'solidcash';

/** Resolve the directory exclusively owned by the SolidCash compiler under the configured artifact root. */
export function solidcashArtifactsPath(artifactsRoot: string): string {
  const root = path.isAbsolute(artifactsRoot) ? artifactsRoot : path.resolve(process.cwd(), artifactsRoot);
  return path.join(root, SOLIDCASH_ARTIFACTS_NAMESPACE);
}
