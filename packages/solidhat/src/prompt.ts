import { createInterface } from 'readline/promises';
import { stdin, stdout } from 'process';
import type { InitOptions, PackageManager, Template } from './init.js';

export interface PromptContext {
  createMode?: boolean;
  interactive?: boolean;
  ask?: (question: string) => Promise<string>;
}

function yes(answer: string, fallback: boolean): boolean {
  const value = answer.trim().toLowerCase();
  if (!value) return fallback;
  return value === 'y' || value === 'yes';
}

/** Collect only presentation choices; all filesystem mutation remains in initializeProject. */
export async function promptInitOptions(options: InitOptions, context: PromptContext = {}): Promise<InitOptions> {
  if (context.interactive === false || (context.interactive === undefined && !stdin.isTTY)) return options;
  const readline = context.ask ? undefined : createInterface({ input: stdin, output: stdout });
  const ask = context.ask ?? ((question: string) => readline!.question(question));
  try {
    const prompted = { ...options };
    if (context.createMode && !prompted.target) prompted.target = (await ask('Project directory (.)? ')).trim() || '.';
    if (!prompted.template) {
      const template = (await ask('Template (typescript/javascript/empty) [typescript]? ')).trim();
      prompted.template = (template || 'typescript') as Template;
    }
    if (!prompted.packageManager) {
      const manager = (await ask('Package manager (auto/npm/yarn/pnpm) [auto]? ')).trim();
      if (manager && manager !== 'auto') prompted.packageManager = manager as PackageManager;
    }
    if (prompted.sample === undefined) {
      prompted.sample = yes(await ask('Add a sample contract and test? [Y/n] '), true);
    }
    if (prompted.install === undefined) {
      prompted.install = yes(await ask('Install dependencies? [Y/n] '), true);
    }
    return prompted;
  } finally {
    readline?.close();
  }
}
