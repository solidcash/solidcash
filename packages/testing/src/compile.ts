import { type Artifact, formatArtifact } from '@solidcash/utils';
import { compileFile, compileString } from 'solidc';
import fs from 'fs';
import path from 'path';
import { type ResolvedConfig, loadConfig } from './config.js';

export interface CompileOptions {
  /** Directory containing .scash source files (overrides config) */
  sourceDir?: string;
  /** Directory for compiled artifacts (overrides config) */
  artifactDir?: string;
  /** Output format: 'json', 'ts', or 'both' (default: 'both') */
  format?: 'json' | 'ts' | 'both';
}

/**
 * Compile a single .scash source string and return the artifact.
 */
export function compile(source: string): Artifact {
  return compileString(source);
}

/**
 * Compile a .scash file by path and return the artifact.
 */
export function compileContract(filePath: string): Artifact {
  return compileFile(new URL(`file://${path.resolve(filePath)}`));
}

/**
 * Compile all .scash files in the configured source directory.
 * Reads paths from solidcash.config.ts (or uses defaults).
 *
 * @returns Map of contract name to artifact
 */
export async function compileAll(options: CompileOptions = {}): Promise<Map<string, Artifact>> {
  const config = await loadConfig();
  return compileAllWithConfig(config, options);
}

export function compileAllWithConfig(config: ResolvedConfig, options: CompileOptions = {}): Map<string, Artifact> {
  const sourceDir = options.sourceDir ?? config.paths.sources;
  const artifactDir = options.artifactDir ?? config.paths.artifacts;
  const format = options.format ?? 'both';

  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Source directory not found: ${sourceDir}`);
  }

  fs.mkdirSync(artifactDir, { recursive: true });

  const files = fs.readdirSync(sourceDir).filter((f: string) => f.endsWith('.scash'));
  const artifacts = new Map<string, Artifact>();

  for (const file of files) {
    const sourcePath = path.join(sourceDir, file);
    const baseName = file.replace('.scash', '');

    try {
      const source = fs.readFileSync(sourcePath, 'utf-8');
      const artifact = compileString(source);
      artifacts.set(baseName, artifact);

      if (format === 'json' || format === 'both') {
        fs.writeFileSync(
          path.join(artifactDir, `${baseName}.json`),
          formatArtifact(artifact, 'json'),
        );
      }
      if (format === 'ts' || format === 'both') {
        fs.writeFileSync(
          path.join(artifactDir, `${baseName}.artifact.ts`),
          formatArtifact(artifact, 'ts'),
        );
      }

      console.log(`Compiled ${file}`);
    } catch (error: any) {
      console.error(`Error compiling ${file}: ${error.message}`);
    }
  }

  return artifacts;
}
