# SolidHat

Hardhat-style project tooling for SolidCash.

Initialize SolidHat alongside an existing Hardhat project without changing its EVM configuration or artifacts:

```sh
npx solidhat --init
```

Create a new project:

```sh
npm create solidhat@latest my-project
```

SolidCash output is namespaced beneath `artifacts/solidcash` and `cache/solidcash`. Use `--dry-run` to preview
injection, `--no-install` to skip dependency installation, and `--force` to replace a conflicting
`solidcash.config.ts`. Existing Hardhat configuration, scripts, contracts, tests, and artifacts are preserved.

Compatibility generations are deliberately separate and can be imported without loading the alternatives:

```ts
import hre2 from '@solidcash/solidhat/hardhat2';
import hre3 from '@solidcash/solidhat/hardhat3';
import { BigNumber } from '@solidcash/solidhat/ethers5';
import { toBigInt } from '@solidcash/solidhat/ethers6';
```

`--init` detects declared `hardhat` and `ethers` dependency majors and writes exact-match aliases to
`vitest.solidhat.config.ts`. Override detection with `--hardhat 2|3` and `--ethers 5|6`.

The package declares `sideEffects: false`; configuration, initialization, Vitest integration, and each generation
shim are independent export-map entry points. The unscoped `solidhat` package is only a CLI launcher.
