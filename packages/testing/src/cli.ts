#!/usr/bin/env node

import { loadConfig } from './config.js';
import { compileAllWithConfig } from './compile.js';

const args = process.argv.slice(2);
const command = args[0];

async function main(): Promise<void> {
  const config = await loadConfig();

  switch (command) {
    case 'compile': {
      console.log(`Compiling contracts in ${config.paths.sources}...`);
      const artifacts = compileAllWithConfig(config);
      console.log(`\nCompiled ${artifacts.size} contract(s) to ${config.paths.artifacts}`);
      break;
    }

    case 'test': {
      // Delegate to vitest with the configured test directory
      const { execSync } = await import('child_process');
      const testArgs = args.slice(1).join(' ');
      try {
        execSync(`npx vitest run ${testArgs}`, {
          stdio: 'inherit',
          cwd: config.paths.root,
        });
      } catch {
        process.exit(1);
      }
      break;
    }

    case 'run': {
      const scriptPath = args[1];
      if (!scriptPath) {
        console.error('Usage: solidcash run <script> [--network <name>]');
        process.exit(1);
      }

      const networkIdx = args.indexOf('--network');
      const network = networkIdx !== -1 ? args[networkIdx + 1] : config.defaultNetwork;

      // Execute the script with tsx
      const { execSync } = await import('child_process');
      try {
        execSync(`npx tsx ${scriptPath}`, {
          stdio: 'inherit',
          cwd: config.paths.root,
          env: { ...process.env, SOLIDCASH_NETWORK: network },
        });
      } catch {
        process.exit(1);
      }
      break;
    }

    case 'init': {
      const fs = await import('fs');
      const path = await import('path');
      const root = config.paths.root;

      // Create directory structure
      const dirs = ['contracts', 'artifacts', 'test', 'scripts'];
      for (const dir of dirs) {
        fs.mkdirSync(path.join(root, dir), { recursive: true });
        console.log(`Created ${dir}/`);
      }

      // Create config file if it doesn't exist
      const configPath = path.join(root, 'solidcash.config.ts');
      if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, `import { defineConfig } from '@solidcash/testing';

export default defineConfig({
  compiler: {
    version: '>=0.13.0',
  },
  paths: {
    sources: 'contracts',
    artifacts: 'artifacts',
    tests: 'test',
    scripts: 'scripts',
  },
  networks: {
    mocknet: {
      accountCount: 10,
      accountBalance: 100_000n,
    },
    chipnet: {
      url: 'chipnet',
    },
  },
  defaultNetwork: 'mocknet',
});
`);
        console.log('Created solidcash.config.ts');
      }

      // Create example contract
      const exampleContract = path.join(root, 'contracts', 'Example.scash');
      if (!fs.existsSync(exampleContract)) {
        fs.writeFileSync(exampleContract, `pragma solidcash >=0.13.0;

contract Example(pubkey owner) {
    function spend(pubkey pk, sig s) {
        require(hash160(pk) == hash160(owner));
        require(checkSig(s, pk));
    }
}
`);
        console.log('Created contracts/Example.scash');
      }

      // Create example test
      const exampleTest = path.join(root, 'test', 'Example.test.ts');
      if (!fs.existsSync(exampleTest)) {
        fs.writeFileSync(exampleTest, `import { describe, it, expect } from 'vitest';
import { loadFixture, compileContract, type Fixture } from '@solidcash/testing';
import 'solidcash/vitest';

async function deployExample(env: Fixture) {
  const artifact = compileContract('./contracts/Example.scash');
  const [owner, other] = env.signers;
  const contract = env.createContract(artifact, [owner.pubkey]);
  const utxo = env.fund(contract.address);
  return { contract, owner, other, utxo };
}

describe('Example', () => {
  it('should allow owner to spend', async () => {
    const { contract, owner, utxo } = await loadFixture(deployExample);

    const tx = contract.unlock.spend(owner.pubkey, owner.sign());
    // ...build and verify transaction
  });
});
`);
        console.log('Created test/Example.test.ts');
      }

      console.log('\nProject initialized. Run:');
      console.log('  npx solidcash compile   # compile contracts');
      console.log('  npx solidcash test      # run tests');
      break;
    }

    default:
      console.log(`SolidCash Testing Framework

Usage:
  solidcash init              Create project structure and config
  solidcash compile           Compile all .scash contracts
  solidcash test [options]    Run tests (delegates to vitest)
  solidcash run <script>      Run a deployment/task script
    --network <name>          Target network (default: from config)
`);
      if (command) {
        console.error(`Unknown command: ${command}`);
        process.exit(1);
      }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
