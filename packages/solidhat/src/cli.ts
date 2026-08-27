#!/usr/bin/env node
import { parseInitCli, formatResult, extractNetworkOption } from './cli-options.js';
import { initializeProject } from './init.js';
import { promptInitOptions } from './prompt.js';

const HELP = 'Usage: solidhat [--init] [task] [options]\n\n  --network <name>      Select a configured network for tasks and scripts\n  --init               Add SolidHat to the current project\n  --dry-run            Preview initializer changes\n  --force              Replace conflicting SolidHat-owned files\n  --yes                 Accept defaults and install dependencies\n  --no-install          Do not install dependencies\n  --sample              Add a sample contract and test\n  --hardhat <2|3>       Override detected Hardhat compatibility\n  --ethers <5|6>        Override detected Ethers compatibility\n';

async function main(): Promise<void> {
  const parsed = parseInitCli(process.argv.slice(2));
  if (parsed.help) { console.log(HELP); return; }
  if (parsed.init) {
    const options = parsed.yes ? parsed.options : await promptInitOptions(parsed.options);
    const result = initializeProject(options);
    console.log(formatResult(result));
    return;
  }
  const selected = extractNetworkOption(parsed.passthrough);
  const taskName = selected.rest[0];
  if (!taskName) { console.log(HELP); return; }
  const {
    getTask, getTasks, initHre, parseTaskArgs, runTask,
  } = await import('@solidcash/testing');
  const hre = await initHre(process.cwd(), selected.network);
  const task = getTask(taskName);
  if (!task) {
    const names = getTasks().map((candidate) => candidate.name).join(', ');
    throw new Error(`Unknown task "${taskName}". Available tasks: ${names}`);
  }
  const taskArgs = parseTaskArgs(task, selected.rest.slice(1));
  if (taskName === 'test' && taskArgs['no-compile'] !== true) {
    await runTask('compile', {}, hre);
  }
  await runTask(taskName, taskArgs, hre);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
