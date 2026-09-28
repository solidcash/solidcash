// One authoritative Marketplace gate. Keeping the historical filename as an alias preserves focused commands
// without allowing a copied test, stale bindings, or a different project root to change the measured result.
export { default } from './vitest.marketplace.config.js';
