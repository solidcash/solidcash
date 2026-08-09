import { describe, expect, it } from 'vitest';
import { cjsHardhatRequirePlugin, hardhatAliases } from '../src/vitest-preset.js';

describe('cjsHardhatRequirePlugin', () => {
  const plugin = cjsHardhatRequirePlugin({
    ...hardhatAliases(),
    // Project configs often pre-resolve to absolute paths (mistswap-native does).
    hardhat: '/abs/testing/dist/index.js',
  });
  const transform = (plugin as { transform?: (code: string, id: string) => { code: string } | null })
    .transform!.bind(plugin);

  it('rewrites destructuring require("hardhat") into an ESM import', () => {
    const src = 'const { ethers } = require("hardhat")\nconst { BigNumber } = ethers\n';
    const out = transform(src, '/Code/mistswap/mistswap/test/utilities/time.ts');
    expect(out).not.toBeNull();
    expect(out!.code).toContain('import * as __solidcashHardhat0 from "/abs/testing/dist/index.js"');
    expect(out!.code).toContain('const { ethers } = __solidcashHardhat0');
    expect(out!.code).not.toContain('require("hardhat")');
  });

  it('rewrites simple require("hardhat") binding', () => {
    const src = 'const hh = require("hardhat");\nexport const network = hh.network;\n';
    const out = transform(src, '/proj/test/helpers.ts');
    expect(out).not.toBeNull();
    expect(out!.code).toMatch(/const hh = __solidcashHardhat\d+\.default \?\? __solidcashHardhat\d+;/);
    expect(out!.code).not.toContain('require("hardhat")');
  });

  it('rewrites require("ethers") through the CashAddress-aware compatibility shim', () => {
    const src = 'const { BigNumber } = require("ethers")\n';
    const out = transform(src, '/proj/test/utilities/index.ts');
    expect(out).not.toBeNull();
    expect(out!.code).toContain('from "@solidcash/testing/ethers-shim"');
    expect(out!.code).toContain('const { BigNumber } = __solidcashHardhat0');
    expect(out!.code).not.toContain('require("ethers")');
  });

  it('does not rewrite inside the real hardhat package', () => {
    const src = 'const { ethers } = require("hardhat")\n';
    const out = transform(src, '/Code/mistswap/mistswap/node_modules/hardhat/internal/lib/hardhat-lib.js');
    expect(out).toBeNull();
  });

  it('rewrites relative require("./kashipair") so Vite can resolve the .ts sibling', () => {
    const src = 'const { KashiPair } = require("./kashipair")\nexport { KashiPair }\n';
    const out = transform(src, '/Code/mistswap/mistswap/test/utilities/index.ts');
    expect(out).not.toBeNull();
    expect(out!.code).toContain('import * as __solidcashHardhat0 from "./kashipair"');
    expect(out!.code).toContain('const { KashiPair } = __solidcashHardhat0');
    expect(out!.code).not.toContain('require("./kashipair")');
  });
});
