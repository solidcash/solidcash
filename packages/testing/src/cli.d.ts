#!/usr/bin/env node
/**
 * `solidcash` CLI (HARDHAT-PARITY.md WS2). Usage: `solidcash <task> [--network name] [args...]`.
 * Mirrors `npx hardhat <task>`. Built-in tasks: compile, test, run, clean, node. User tasks declared in
 * solidcash.config.ts (via `task(...)` from 'solidcash/hardhat') are loaded when the config is imported.
 */
import './builtin-tasks.js';
