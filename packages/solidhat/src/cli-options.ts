import type { InitOptions, InitResult, PackageManager, Template } from './init.js';

export interface ParsedInitCli { init: boolean; help: boolean; yes: boolean; options: InitOptions; passthrough: string[] }

export function parseInitCli(argv: string[], createMode = false): ParsedInitCli {
  const options: InitOptions = {};
  const passthrough: string[] = [];
  let init = createMode;
  let help = false;
  let yes = false;
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--init') init = true;
    else if (arg === '--help' || arg === '-h') help = true;
    else if (arg === '--yes' || arg === '-y') yes = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--force') options.force = true;
    else if (arg === '--install') options.install = true;
    else if (arg === '--no-install') options.install = false;
    else if (arg === '--sample') options.sample = true;
    else if (arg === '--no-sample') options.sample = false;
    else if (arg === '--template') options.template = argv[++index] as Template;
    else if (arg === '--package-manager') options.packageManager = argv[++index] as PackageManager;
    else if (arg === '--hardhat') {
      options.compatibility ??= {};
      options.compatibility.hardhat = Number(argv[++index]) as 2 | 3;
    } else if (arg === '--ethers') {
      options.compatibility ??= {};
      options.compatibility.ethers = Number(argv[++index]) as 5 | 6;
    } else if (createMode && !arg.startsWith('-') && !options.target) options.target = arg;
    else passthrough.push(arg);
  }
  if (yes && options.install === undefined) options.install = true;
  return { init, help, yes, options, passthrough };
}

export function formatResult(result: InitResult): string {
  const prefix = result.dryRun ? 'Would initialize' : 'Initialized';
  const hardhat = result.hardhatDetected ? '\nDetected Hardhat; its configuration and artifacts were left unchanged.' : '';
  return `${prefix} SolidHat in ${result.directory}\nCreated: ${result.created.length}, updated: ${result.updated.length}, unchanged: ${result.skipped.length}${hardhat}`;
}
