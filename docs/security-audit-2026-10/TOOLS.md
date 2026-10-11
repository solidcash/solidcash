<!-- cspell:ignore invalidateblock mktemp pipefail undecoded -->
# TOOLS audit: tooling, packaging, supply chain

Tree: /Code/cashscript/.worktrees/per-call, branch feat/per-call, HEAD abbb7e0ec (unchanged during the audit).
Method: read-only (grep, sed, git ls-files/grep). No tests, builds, CLIs or network fetches.

## Findings

### TOOLS-1 - HIGH - CODE-CONFIRMED - Published packages depend on a mutable branch of a personal libauth fork

- Files: packages/solidc/package.json:54, packages/solidcash/package.json:73, packages/utils/package.json:45,
  packages/testing/package.json:58 (and transitively @solidcash/solidhat and @solidcash/create-solidhat);
  examples/package.json:14, examples/testing-suite/package.json:20, package.json:17 (root resolutions);
  yarn.lock:61-63 (pins commit 1cf4b432 for the monorepo only); scripts/release-package-smoke.mjs:96-101.
- Root cause: the dependency spec `git+https://github.com/mainnet-pat/libauth.git#vm-performance-dist` names a
  branch. A consumer without a lockfile entry (every `npm create @solidcash/solidhat`, every fresh `npm i solidcash`)
  resolves the branch head at install time. Git dependencies carry no registry integrity hash. The package smoke
  test installs the packed tarballs into a clean consumer with no lockfile, so it already exercises the branch
  head, not the pinned commit. The `-dist` branch holds prebuilt JS that the SDK deep-imports and runs directly,
  e.g. packages/solidcash/src/HDSigner.ts:2 (bip39) and packages/solidcash/src/Signer.ts:1.
- Scenario: anyone who can push to that branch can ship code to every new install of solidc, solidcash and
  @solidcash/*. That includes the account owner, a stolen token or session, or whoever gets the repo after a rename
  or transfer. libauth does BIP39 generation (HDSigner.createRandom -> generateBip39Mnemonic, HDSigner.ts:70-72), HD
  derivation, secp256k1 signing and VM evaluation. A backdoor could leak or weaken keys, or bias VM results so
  tests pass for contracts that misbehave on chain. It could also add lifecycle scripts (git dependencies are packed
  with their prepare script on the developer's machine). The @mem-cash/* deps pin a different libauth commit from
  the same fork (yarn.lock:1691, 1700, 1710).
- Fix: publish the fork to npm under an owned scope with an exact version, or vendor it. At minimum, pin the full
  commit SHA in every published manifest. Add a release gate that rejects git/URL/branch specs in published
  `dependencies`. Publish with provenance.

### TOOLS-2 - MEDIUM - CODE-CONFIRMED - Regtest stack publishes node RPC (known credentials, allow-all), Electrum and explorer on all interfaces

- Files: docker-compose.regtest.yml:9-12 (`-rpcuser=user -rpcpassword=password -rpcallowip=0.0.0.0/0
  -rpcbind=0.0.0.0`), :16-17 (`"18443:18443"`, `"28332:28332"`), :41-42 (`50001`, `50003`), :82, :92-93, :96
  (explorer `BTCEXP_HOST 0.0.0.0`, `BTCEXP_UI_SHOW_RPC`, `BTCEXP_RPC_ALLOWALL`, `"3002:3002"`), :28
  (`cculianu/fulcrum:latest`); docker/fulcrum.conf:3-6.
- Root cause: short-form `ports:` mappings publish on 0.0.0.0, and Docker's own iptables rules bypass host
  firewalls such as ufw. The credentials are public in the repo and in the init template
  (packages/solidhat/src/init.ts:72).
- Scenario: while a developer runs the stack (as CLAUDE.md documents and CI does), anyone on the same LAN, Wi-Fi or
  cloud network can use BCHN JSON-RPC as an authenticated client. They can stop the node, use the node wallet,
  invalidateblock or submit blocks to reorg and flip regtest test outcomes, or flood the mempool. With the explorer
  service, RPC_ALLOWALL exposes an unauthenticated web RPC console on :3002. Impact is bounded to the regtest chain
  and its wallet. I found no path to mainnet keys.
- Fix: bind to loopback (`"127.0.0.1:18443:18443"`, likewise for 28332/50001/50003/3002). Drop the ZMQ publish if
  it is not needed. Remove `BTCEXP_RPC_ALLOWALL`/`BTCEXP_UI_SHOW_RPC`. Pin images by digest (fulcrum is on
  `:latest`).

### TOOLS-3 - MEDIUM - CODE-CONFIRMED - `.emit(...).withArgs(...)` never compares CashAddress arguments and accepts undecoded receipts

- Files: packages/testing/src/chai.ts:489 (`if (got === undefined) continue;`), :494-496 (when either side is a
  string containing ':', a mismatch is skipped with `continue`), :549-558 (a mined tx with no decoded events and no
  args passes).
- Root cause: the "loose match on cashaddr vs locking-bytecode address forms" skips the comparison instead of
  normalising both sides. Harness signer addresses are CashAddresses (`prefix:payload`,
  packages/solidcash/src/Signer.ts:74-85), so every `withArgs(signer.address, ...)` position is unchecked. Missing
  named or positional args are also skipped. `chai` is aliased to this shim by both presets
  (packages/testing/src/vitest-preset.ts:52, packages/solidhat/src/vitest-preset.ts:50), so ported Hardhat suites
  use it unmodified.
- Scenario: `expect(tx).to.emit(token, 'Transfer').withArgs(alice.address, bob.address, n)` passes when the event
  pays an attacker. A misspelled key in object form passes. `.to.emit(c, 'X')` passes for any mined tx whose receipt
  has no decoded events when `queryFilter` is unavailable. A contract ships with a green suite that "proves"
  recipient or authorization semantics it does not have.
- Fix: normalise with `normalizeAddressPair` and then compare. Treat a missing expected arg as a failure. Fail
  instead of passing when the events cannot be decoded.

### TOOLS-4 - MEDIUM - CODE-CONFIRMED - `.reverted` and `.rejectedWith(reason)` pass on failures that are not contract reverts

- Files: packages/testing/src/chai.ts:818-821 -> packages/solidcash/src/test/TestExtensions.ts:243-255 (any error
  thrown by `sendTransaction` gives `pass: true`); chai.ts:953-962 (`rejectedWith` passes when the message does
  not match but `delegatedSourceDeclaresReason` finds the reason in the artifact's require messages or in the raw
  source text, chai.ts:216-248).
- Root cause: neither matcher distinguishes a VM or contract refusal from a harness, derivation, funding or network
  error. The relaxed `revertedWith` path already rethrows construction failures (chai.ts:844, 863), but these two
  matchers do not.
- Scenario: the negative test `await expect(vault.connect(attacker).withdraw()).to.be.reverted` passes because the
  SDK could not build, fund or derive the call. The same is true of
  `.to.be.rejectedWith('Ownable: caller is not the owner')`. Meanwhile a hand-built transaction succeeds on chain,
  and the access-control hole ships.
- Fix: for `.reverted`, require an error that carries VM-failure evidence (a framed refusal or failing
  opcode/require metadata). Rethrow construction-class errors. Remove the source-declaration fallback in
  `rejectedWith`, or apply it only to a verified VM failure that has no reason string.

### TOOLS-5 - LOW - CODE-CONFIRMED - chai shim silently accepts unimplemented property assertions

- Files: packages/testing/src/chai.ts:633-770. `Assertion` is a plain class with no Proxy. Property getters exist
  only for true/false/null/undefined/exist/ok.
- Scenario: `expect(await c.pendingOf(attacker)).to.be.empty` evaluates `.empty` to `undefined` and asserts
  nothing. The same applies to `.NaN`, `.finite`, `.frozen`, `.sealed`, `.extensible` and `.arguments`. Unknown
  methods throw a TypeError and fail correctly.
- Fix: return the instance through a Proxy that throws on unknown property access (as chai does), or implement the
  missing properties.

### TOOLS-6 - LOW - CODE-CONFIRMED - An `electrum` network with an unrecognised name silently targets mainnet

- Files: packages/testing/src/hre.ts:62-64 (`configuredNetwork` is taken only from known names), :72
  (`configuredNetwork ?? Networks.MAINNET`).
- Scenario: a Hardhat habit or a typo, such as `networks: { testnet: { type: 'electrum' } }`, plus SOLIDCASH_MNEMONIC
  set, means `solidhat deploy --network testnet` signs and broadcasts real mainnet spends. The live-network guard
  (hre.ts:548-552) does not fire because a mnemonic is configured.
- Fix: require `network` on electrum entries whose name is not a known network, and require mainnet to be selected
  explicitly.

### TOOLS-7 - LOW - SUSPECTED - One mnemonic signs on every network; BCH signatures carry no chain id

- Files: packages/solidhat/src/init.ts:72 (the template has a single `mnemonic: process.env.SOLIDCASH_MNEMONIC`
  serving mock, regtest, chipnet and mainnet), packages/testing/src/hre.ts:557, 570, 576 (one mnemonic for every
  connection), packages/solidcash/src/network/ElectrumNetworkProvider.ts:59 (chipnet defaults to a third-party
  server).
- Scenario: a developer exports one funded phrase to deploy on mainnet and later runs `--network chipnet`. A
  malicious or compromised chipnet Electrum server reports the address's mainnet UTXOs (same locking bytecode) as
  chipnet coins. The SDK signs a transaction that is also valid on mainnet, and the server relays it, moving real
  funds into test outputs or contracts. I did not trace the SDK's UTXO handling end to end.
- Fix: per-network accounts (Hardhat-style `networks.<n>.accounts`). Refuse the same mnemonic on mainnet and on a
  test network. Use a dedicated mainnet env var.

### TOOLS-8 - LOW - CODE-CONFIRMED - `solidcash init --from-hardhat` writes the resolved mnemonic into solidcash.config.ts as plaintext

- Files: packages/testing/src/config.ts:253-269 (imports the Hardhat config, then
  `mnemonic: ${JSON.stringify(migrated.mnemonic)}`), packages/testing/src/builtin-tasks.ts:464-471.
- Scenario: a Hardhat project with `accounts: { mnemonic: process.env.MNEMONIC }` (dotenv) gets its real phrase
  copied into a new config file, which is normally committed.
- Fix: emit an env reference (`process.env.SOLIDCASH_MNEMONIC`) and never write the value.

### TOOLS-9 - LOW - CODE-CONFIRMED - Config discovery walks to the filesystem root and executes the first config it finds

- Files: packages/testing/src/config.ts:173-198, 242-246; packages/testing/src/cli.ts:30 (even help loads it);
  packages/testing/src/vitest-setup.ts:167.
- Root cause: executing the config is by design, as in Hardhat, but the search does not stop at a project
  boundary.
- Scenario: on a shared host, another user drops /tmp/solidcash.config.js. A developer then runs `solidcash test` or
  `solidhat compile` in a /tmp subdirectory that has no config of its own, and the attacker's code runs with the
  developer's environment (mnemonics in env).
- Fix: stop at the nearest package.json or git root, and warn when the config is outside the cwd's project.

### TOOLS-10 - LOW - CODE-CONFIRMED - Compile trusts on-disk cache entries; a cloned repo shipping cache/solidcash can substitute artifacts for reviewed sources

- Files: packages/testing/src/builtin-tasks.ts:214-216 (`SOLIDC_COMPILE_CACHE_DIR` defaults to
  `<project>/cache/solidcash`), packages/solidc/src/compiler.ts:1465-1470, 1561-1570 (the key is sha256 of source,
  options and the compiler fingerprint, which is predictable for a published version; the entry is returned after
  `JSON.parse` with no further check).
- Scenario: a reviewer reads benign `.scash` sources and a benign config in a cloned repo, then runs compile and
  deploy. The committed poisoned cache entry supplies backdoored bytecode. This is the same class as committed
  Hardhat artifacts and cache. The init template gitignores cache/solidcash, but a cloned repo need not.
- Fix: authenticate entries with a per-machine key, or keep the default cache outside the project (user cache dir,
  0700).

### TOOLS-11 - LOW - CODE-CONFIRMED - CI: actions pinned by tag, no `permissions:` block, credentials persisted

- Files: .github/workflows/github-actions.yml:23, 26, 87-89 (`actions/checkout@v4`, `actions/setup-node@v4`,
  `codecov/codecov-action@v5` with `CODECOV_TOKEN`); there is no `permissions:` key.
- Scenario: on push builds, a moved or compromised action tag, or any dependency code run by the build and test
  steps, can read the persisted GITHUB_TOKEN (checkout default `persist-credentials: true`) and CODECOV_TOKEN. The
  token's write scope depends on repo settings that are not visible in the code.
- Fix: `permissions: contents: read`, pin actions by SHA, `persist-credentials: false`, and upload coverage from a
  minimal separate job.

### TOOLS-12 - INFO - CODE-CONFIRMED - Generated TS modules interpolate file and contract names without escaping (latent)

- Files: packages/testing/src/builtin-tasks.ts:242-246 with 283-287 (with `jsonArtifactModules`, the `.scash` file
  name goes into a single-quoted `new URL('./...')` literal); packages/testing/src/typegen.ts:237-238, 263-264, 271
  (source module paths and contract names go into quoted import/export specifiers); packages/utils/src/artifact.ts:2725
  (`stringifyAsTs` object keys escape `'` but not `\` or newlines).
- Scenario: a file under contracts/ whose name contains `'` breaks out of the string in a generated
  `.artifact.ts` or typegen `index.ts`, and that code runs when tests import it. This needs control of file names in
  the developer's own project. `stringifyAsTs` string values are escaped correctly.
- Fix: emit `JSON.stringify(...)` for every interpolated name and key.

### TOOLS-13 - INFO - CODE-CONFIRMED - VS Code hover renders contract doc comments as markdown

- Files: vscode-solidcash/src/extension.js:113-118 (`decl.doc` goes through `appendMarkdown`, and the string is not
  trusted); vscode-solidcash/src/resolver.js:32-51 (absolute and `../` imports resolve any existing `.scash`/`.sol`).
- Scenario: a malicious contract's NatSpec can show crafted links or remote images (a beacon on hover). Imports can
  make the extension read other local `.scash`/`.sol` files, but that content stays in process. `isTrusted` is
  unset, so `command:` links do not run.
- Fix: strip links and images from doc text, or render it with `appendText`.

### TOOLS-14 - INFO - Secrets inventory (values deliberately not reproduced)

- website/docs/sdk/signature-templates.md:28, 117, 139: WIF. The upstream CashScript docs example key (public).
- solidcash.config.ts:38 and bench/effectiveacceleration/solidcash.config.ts:62: a 12-word BIP39 mnemonic. Per
  the adjacent comment it was copied from the third-party EffectiveAcceleration Hardhat config. Only `mock` is
  configured, so it looks like a test fixture. It uses the ETH path m/44'/60'/0'/0, so confirm upstream that it is
  dev-only.
- packages/solidcash/src/network/MockNetworkProvider.ts:289, examples/testing-suite/solidcash.config.ts:14,
  scripts/release-package-smoke.mjs:137, packages/solidcash/test/e2e/AbiEncodeKeccakParity.test.ts:77 (and
  others): the public Hardhat test mnemonic (fixture).
- packages/solidcash/test/e2e/HDSigner.test.ts:22, packages/testing/test/framed/revert-matchers.test.ts:49: BIP39
  test-vector mnemonics (fixture).
- examples/common.ts:12, examples/common-js.js:13: keys derived from a fixed public seed string (upstream example).
  The examples use MockNetworkProvider; the commented `new ElectrumNetworkProvider()` would default to mainnet.
- docker-compose.regtest.yml:9-10, docker/fulcrum.conf:3-4, packages/solidhat/src/init.ts:72: regtest RPC
  user/password defaults.
- Not found: no xprv/tprv, PEM private keys, GitHub/npm/AWS/Slack/OpenAI/Google tokens, or tracked .env/.npmrc
  files. HANDOFF_KERNEL_BETA_ROUND_NEXT.md:2332 `token:` is a token-category hex, not a secret. .marketplace/ has no
  tracked files.
- No funded key is wired to a mainnet default. Live electrum/bitcoin-rpc networks refuse the public mock mnemonic
  (packages/testing/src/hre.ts:548-552, applied to both the base connection and `connect()`).

## Checked and sound

1. VS Code extension: no child_process, eval, commands, webviews or terminals; activation is only onLanguage; `untrustedWorkspaces: supported` is acceptable because nothing executes.
2. solidhat init/create-solidhat: `spawnSync` takes argv arrays, with a shell only on win32 and a fixed manager name unless the user passes `--package-manager` themselves; writes stay inside the target dir, existing files are refused without `--force`, and temp files use `wx` then rename.
3. Live-network mnemonic guard (hre.ts:548-552) covers both base and `connect()`; the template's `defaultNetwork` is `mock`; regtest RPC defaults to 127.0.0.1.
4. testing CLI `test` task: `spawnSync('npx', [...])` with no shell; script and config imports are by design (Hardhat parity).
5. scripts/*.mjs and update-version.ts use only `spawnSync`/`execFileSync` with argv arrays; perf-ab.sh quotes its vars and uses mktemp with set -euo pipefail.
6. Workflow: no `pull_request_target`; no `${{ github.event.* }}` in `run:`; install uses `--frozen-lockfile --ignore-scripts`; the only secret is CODECOV_TOKEN, which fork PRs do not get.
7. yarn.lock: apart from libauth, all 1261 resolved entries come from registry.yarnpkg.com with integrity hashes.
8. `@mem-cash/*` `^0.0.10` caret ranges resolve to exactly 0.0.10.
9. `stringifyAsTs` string-value escaping is correct (quotes, backslashes and control characters).
10. Compile output paths use `basename()` plus identifier contract names, so there is no traversal; disk cache file names are sha256 hex.
11. The offline IPFS/network/RPC helpers intercept fetch in process and open no listening sockets.
12. `revertedWithCustomError(...).withArgs` compares strictly and refuses when no tuple is present; `.not.to.emit` on an undecoded receipt refuses.
13. `changeBchBalance(s)` and `changeTokenBalance(s)` propagate action failures; there is no swallow.
14. website/ is a static Docusaurus site with no server-side code.
15. solidc, solidcash and @solidcash/utils publish through `.npmignore` allowlists that ship `dist` only.

## Not reached

- SDK network providers (Electrum/BitcoinRpc/Regtest): TLS and host verification, and trust in provider-supplied UTXO or token data during signing (needed to confirm TOOLS-7).
- The solidc CLI (outside this area), the typegen `moduleSource` generator body, solidhat mock-contracts/ported-script, and import resolution in project-compiler.
- The actual contents of the libauth `vm-performance-dist` branch and the npm-published tarballs (no network). Whether the published manifests match the repo is unverified.
- Publish contents for testing/solidhat/create-solidhat: they have no `files` field or local `.npmignore`, and I did not verify how npm-packlist treats the root `.npmignore` for workspace packages.
- website/scripts/generate-message-bus-reference.mjs and the vscode scanner/docs internals beyond the hover path.
