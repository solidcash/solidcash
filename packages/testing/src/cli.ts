#!/usr/bin/env node
/**
 * `solidcash` CLI (HARDHAT-PARITY.md WS2). Usage: `solidcash <task> [--network name] [args...]`.
 * Mirrors `npx hardhat <task>`. Built-in tasks: compile, test, run, clean, node. User tasks declared in
 * solidcash.config.ts (via `task(...)` from '@solidcash/solidcash/hardhat') are loaded when the config is imported.
 */
import './builtin-tasks.js';
import { loadConfig } from './config.js';
import { initHre } from './hre.js';
import {
  formatTaskHelp, getTask, getTasks, parseTaskArgs, runTask,
} from './tasks.js';

function printHelp(): void {
  console.log('Usage: solidcash <task> [--network <name>] [args...]\n');
  console.log('Tasks:');
  for (const t of getTasks()) {
    console.log(`  ${t.name.padEnd(12)} ${t.description ?? ''}`);
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  let networkName: string | undefined;
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--network') { networkName = argv[++i]; } else { rest.push(argv[i]); }
  }

  const taskName = rest[0];
  if (!taskName || taskName === 'help' || taskName === '--help' || taskName === '-h') {
    // Load config so user-declared tasks appear in help.
    await initHre(process.cwd(), networkName).catch(() => undefined);
    printHelp();
    return;
  }

  let def = getTask(taskName);
  if (!def) {
    // Tasks a project declares in solidcash.config.* register when that module is imported, so a miss on the
    // built-in registry is not conclusive until the config has loaded (loadConfig returns defaults with no file).
    await loadConfig(process.cwd());
    def = getTask(taskName);
  }
  if (!def) {
    console.error(`Unknown task "${taskName}".\n`);
    printHelp();
    process.exitCode = 1;
    return;
  }
  // `<task> --help` prints that task's own flag table; it never starts a provider or a task action.
  if (rest.slice(1).some((token) => token === '--help' || token === '-h')) {
    console.log(formatTaskHelp(def, 'solidcash'));
    return;
  }

  const hre = await initHre(process.cwd(), networkName);
  const args = parseTaskArgs(def, rest.slice(1));
  await runTask(taskName, args, hre);
}

main().catch((e) => {
  console.error(e?.stack ?? e);
  process.exit(1);
});
