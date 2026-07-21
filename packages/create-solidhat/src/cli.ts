#!/usr/bin/env node
import {
  formatResult, initializeProject, parseInitCli, promptInitOptions,
} from '@solidcash/solidhat';

const HELP = 'Usage: npm create solidhat@latest [directory] -- [options]\n\n  --template <typescript|javascript|empty>\n  --package-manager <npm|yarn|pnpm>\n  --hardhat <2|3>\n  --ethers <5|6>\n  --dry-run\n  --force\n  --yes\n  --no-install\n';

try {
  const parsed = parseInitCli(process.argv.slice(2), true);
  if (parsed.help) console.log(HELP);
  else {
    const options = parsed.yes
      ? parsed.options
      : await promptInitOptions(parsed.options, { createMode: true });
    console.log(formatResult(initializeProject(options)));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
