import { binToBase64 } from '@bitauth/libauth/build/lib/format/base64.js';
import { utf8ToBin } from '@bitauth/libauth/build/lib/format/utf8.js';
import type { WalletTemplate } from '@bitauth/libauth/build/lib/engine/types/template-types.js';
import { zlibSync } from 'fflate';
import { extendedStringify } from '../utils.js';

/**
 * Link to the Bitauth IDE's import page for a wallet template.
 *
 * This is its own module, and not a helper in `LibauthTemplate.ts`, because `LibauthTemplate.ts` imports
 * `debugTemplate` from `debugging.js`: keeping `getBitauthUri` there made `debugging.js` and `LibauthTemplate.js`
 * import each other. A browser bundler that follows top-level await - see the `SdkBrowserBundle` test - cannot
 * order an import cycle, so the cycle deadlocks the bundle's module initialization. `debugging.js` imports this
 * leaf instead.
 */
export const getBitauthUri = (template: WalletTemplate, includePrivateKeys = true): string => {
  // A failure-path debug URL is attached to thrown errors automatically; it must never carry signing keys. The
  // explicit opt-in `TransactionBuilder.getBitauthUri()` keeps the keys (it warns), while automatic failure paths
  // pass `includePrivateKeys = false` and get placeholder values instead.
  if (!includePrivateKeys) {
    for (const scenario of Object.values(template.scenarios ?? {})) {
      const keys = (scenario.data as { keys?: { privateKeys?: Record<string, string> } } | undefined)?.keys;
      if (keys?.privateKeys) {
        for (const name of Object.keys(keys.privateKeys)) keys.privateKeys[name] = '[REDACTED]';
      }
    }
  }
  const base64toBase64Url = (base64: string): string => base64.replace(/\+/g, '-').replace(/\//g, '_');
  const payload = base64toBase64Url(binToBase64(zlibSync(utf8ToBin(extendedStringify(template)))));
  return `https://ide.bitauth.com/import-template/${payload}`;
};
