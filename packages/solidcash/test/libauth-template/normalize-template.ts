import { binToHex } from '@bitauth/libauth';
import { asmToBytecode } from '@solidcash/utils';

/**
 * Compare modern named OP_DEFINE bodies against the legacy inline-body fixtures without discarding coverage.
 * Named bodies are losslessly folded back into their main script; only presentation alignment and absent token
 * fields are normalized. Every other template field remains under the existing exact comparison.
 */
export const normalizeTemplate = <T>(template: T): T => {
  // Fixtures contain Vitest asymmetric matchers, which are intentionally not structured-cloneable. The
  // normalization is idempotent and test-local, so normalize the freshly constructed objects in place.
  const copy = template as any;
  const scripts = copy.scripts as Record<string, { script?: string }> | undefined;
  if (scripts) {
    const definitions = new Map<string, string>();
    for (const [name, script] of Object.entries(scripts)) {
      if (!name.includes('_define_') || !name.endsWith('_body_lock') || typeof script.script !== 'string') continue;
      definitions.set(name, binToHex(asmToBytecode(script.script.replace(/\/\*[\s\S]*?\*\//g, ''))));
    }
    for (const script of Object.values(scripts)) {
      if (typeof script.script !== 'string') continue;
      for (const [name, bytecode] of definitions) {
        script.script = script.script.replaceAll(`<${name}>`, `<0x${bytecode}>`);
      }
      script.script = script.script.split('\n')
        .map((line) => line.replace(/\s+\/\*/, ' /*').trimEnd()).join('\n');
    }
    for (const name of definitions.keys()) delete scripts[name];
  }
  const prune = (value: any): void => {
    if (!value || typeof value !== 'object') return;
    for (const key of Object.keys(value)) {
      if (value[key] === undefined) delete value[key];
      else prune(value[key]);
    }
  };
  prune(copy);
  return copy;
};
