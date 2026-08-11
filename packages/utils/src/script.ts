import {
  binToHex,
  encodeDataPush,
  hexToBin,
  disassembleBytecodeBch,
  flattenBinArray,
  encodeAuthenticationInstructions,
  decodeAuthenticationInstructions,
  OpcodesBch,
  AuthenticationInstruction,
} from '@bitauth/libauth';
import OptimisationsEquivFile from './cashproof-optimisations.js';
import { optimisationReplacements } from './optimisations.js';
import { FullLocationData, PositionHint, SingleLocationData } from './types.js';
import { LogEntry, RequireStatement } from './artifact.js';

interface CompiledOptimisation {
  pattern: string;
  replacement: string;
  regex: RegExp;
  patternLength: number;
  replacementLength: number;
  patternTokens: string[];
  firstToken: string;
  requiredTokens: string[];
  replacementTokens: string[];
}

const compiledOptimisationReplacements: CompiledOptimisation[] = optimisationReplacements.map(
  ([pattern, replacement]) => {
    const patternTokens = pattern.split(/\s+/g);
    return {
      pattern,
      replacement,
      regex: new RegExp(`${pattern}(\\s|$)`, 'g'),
      patternLength: patternTokens.length,
      replacementLength: replacement === '' ? 0 : [...replacement.matchAll(/\s+/g)].length + 1,
      patternTokens,
      firstToken: patternTokens[0],
      requiredTokens: [...new Set(patternTokens.slice(1))].filter((token) => token !== patternTokens[0]),
      replacementTokens: replacement === '' ? [] : replacement.split(/\s+/g),
    };
  },
);

export const Op = OpcodesBch;
export type Op = number;
export type OpOrData = Op | Uint8Array;
export type Script = OpOrData[];

export function scriptToAsm(script: Script): string {
  const parts = new Array<string>(script.length);
  for (let i = 0; i < script.length; i += 1) {
    const element = script[i];
    if (typeof element === 'number') {
      // A bare push opcode consumes following bytecode rather than standing alone. Retain the decoder round trip
      // for these uncommon fragments; every other opcode maps independently to its canonical ASM name.
      if (element >= Op.OP_PUSHBYTES_1 && element <= Op.OP_PUSHDATA_4) {
        return bytecodeToAsm(scriptToBytecode(script));
      }
      parts[i] = Op[element] as string;
    } else if (element.length === 0) {
      parts[i] = 'OP_0';
    } else if (foldsToPushNumberOpcode(element)) {
      const opcode = element[0] === NEGATIVE_ONE_BYTE ? Op.OP_1NEGATE : element[0] + PUSH_NUMBER_OPCODE_OFFSET;
      parts[i] = Op[opcode] as string;
    } else {
      parts[i] = binToHex(element);
    }
  }
  return parts.join(' ');
}

export function scriptToBitAuthAsm(script: Script): string {
  return bytecodeToBitAuthAsm(scriptToBytecode(script));
}

export function asmToScript(asm: string): Script {
  asm = asm.replace(/\s+/g, ' ').trim();
  if (asm === '') return [];
  return asm.split(' ').map((token) => {
    if (token.startsWith('OP_')) {
      const opcode = Op[token as keyof typeof Op];
      if (opcode === undefined) throw new Error(`asmToBytecode: unknown opcode "${token}"`);
      return opcode as number;
    }
    const data = hexToBin(token.replace(/<|>/g, '').replace(/^0x/, ''));
    if (!foldsToPushNumberOpcode(data)) return data;
    return data[0] === NEGATIVE_ONE_BYTE ? Op.OP_1NEGATE : data[0] + PUSH_NUMBER_OPCODE_OFFSET;
  });
}

// asmToBytecode also works for BitAuth ASM
export function bitAuthAsmToScript(asm: string): Script {
  return asmToScript(asm);
}

// Single-byte pushes that libauth's `encodeDataPush` folds into one opcode: 0x01..0x10 become OP_1..OP_16 and
// 0x81 becomes OP_1NEGATE. Missing this is not a size bug but an ENCODING bug - the emitted opcode differs.
const PUSH_NUMBER_OPCODE_OFFSET = 80;
const NEGATIVE_ONE_BYTE = 129;

const foldsToPushNumberOpcode = (element: Uint8Array): boolean =>
  element.length === 1 && ((element[0] !== 0 && element[0] <= 16) || element[0] === NEGATIVE_ONE_BYTE);

/** Encoded byte length of one Script element, mirroring libauth's minimal `encodeDataPush`. */
function elementEncodedSize(element: Script[number]): number {
  if (typeof element === 'number') return 1;
  const { length } = element;
  if (length === 0) return 1;
  if (foldsToPushNumberOpcode(element)) return 1;
  if (length <= 75) return length + 1;
  if (length <= 255) return length + 2;
  if (length <= 65535) return length + 3;
  return length + 5;
}

export function scriptToBytecode(script: Script): Uint8Array {
  // The hottest function in the compiler: every optimiser round, every body serialisation and every script
  // comparison calls it. Size the buffer first and write the push prefixes inline, so encoding a script costs
  // one allocation rather than two per element (the per-element `encodeDataPush` result plus the flatten copy).
  // Byte-for-byte identical to `flattenBinArray(script.map(encodeDataPush-or-opcode-byte))`.
  let size = 0;
  for (const element of script) size += elementEncodedSize(element);
  const bytecode = new Uint8Array(size);
  let at = 0;
  for (const element of script) {
    if (typeof element === 'number') {
      bytecode[at] = element;
      at += 1;
      continue;
    }
    const { length } = element;
    if (length === 1 && foldsToPushNumberOpcode(element)) {
      bytecode[at] = element[0] === NEGATIVE_ONE_BYTE ? Op.OP_1NEGATE : element[0] + PUSH_NUMBER_OPCODE_OFFSET;
      at += 1;
      continue;
    }
    if (length <= 75) {
      bytecode[at] = length;
      at += 1;
    } else if (length <= 255) {
      bytecode[at] = Op.OP_PUSHDATA_1;
      bytecode[at + 1] = length;
      at += 2;
    } else if (length <= 65535) {
      bytecode[at] = Op.OP_PUSHDATA_2;
      bytecode[at + 1] = length & 0xff;
      bytecode[at + 2] = (length >>> 8) & 0xff;
      at += 3;
    } else {
      bytecode[at] = Op.OP_PUSHDATA_4;
      bytecode[at + 1] = length & 0xff;
      bytecode[at + 2] = (length >>> 8) & 0xff;
      bytecode[at + 3] = (length >>> 16) & 0xff;
      bytecode[at + 4] = (length >>> 24) & 0xff;
      at += 5;
    }
    bytecode.set(element, at);
    at += length;
  }
  return bytecode;
}

export function bytecodeToScript(bytecode: Uint8Array): Script {
  // Convert the bytecode to AuthenticationInstructions
  const instructions = decodeAuthenticationInstructions(bytecode);

  // Convert the AuthenticationInstructions to script elements
  const script = instructions.map((instruction) => (
    'data' in instruction ? instruction.data : instruction.opcode
  ));

  return script;
}

export function asmToBytecode(asm: string): Uint8Array {
  // Remove any duplicate whitespace
  asm = asm.replace(/\s+/g, ' ').trim();

  // Empty ASM string -> empty bytecode (not OP_0)
  if (asm === '') return new Uint8Array(0);

  // Convert the ASM tokens to AuthenticationInstructions
  const instructions = asm.split(' ').map((token) => {
    // Even though the OpcodesBch type allows for { [key: number]: string }, we know that the keys are always the opcodes
    // so we can safely cast to the AuthenticationInstruction type
    if (token.startsWith('OP_')) {
      const opcode = Op[token as keyof typeof Op];
      if (opcode === undefined) {
        throw new Error(`asmToBytecode: unknown opcode "${token}"`);
      }
      return { opcode } as AuthenticationInstruction;
    }

    const data = token.replace(/<|>/g, '').replace(/^0x/, '');

    return decodeAuthenticationInstructions(encodeDataPush(hexToBin(data)))[0];
  });

  // Convert the AuthenticationInstructions to bytecode
  return encodeAuthenticationInstructions(instructions);
}

export function bytecodeToAsm(bytecode: Uint8Array): string {
  // Convert the bytecode to libauth's ASM format
  let asm = disassembleBytecodeBch(bytecode);

  // COnvert libauth's ASM format to BITBOX's
  asm = asm.replace(/OP_PUSHBYTES_[^\s]+/g, '');
  asm = asm.replace(/OP_PUSHDATA[^\s]+ [^\s]+/g, '');
  asm = asm.replace(/(^|\s)0x/g, ' ');

  // Remove any duplicate whitespace
  asm = asm.replace(/\s+/g, ' ').trim();

  return asm;
}

// TODO: If we decide to change the ASM / artifact format, we can remove this function and merge it with bytecodeToAsm
export function bytecodeToBitAuthAsm(bytecode: Uint8Array): string {
  // Convert the bytecode to libauth's ASM format
  let asm = disassembleBytecodeBch(bytecode);

  // COnvert libauth's ASM format to BitAuth Script ASM
  asm = asm.replace(/OP_PUSHBYTES_[^\s]+/g, '');
  asm = asm.replace(/OP_PUSHDATA[^\s]+ [^\s]+/g, '');
  asm = asm.replace(/(^|\s)(0x\w*)/g, ' \<$2\>');

  // Remove any duplicate whitespace
  asm = asm.replace(/\s+/g, ' ').trim();

  return asm;
}

/**
 * Canonicalise a script the way its serialised bytecode reads back: every data push in its minimal encoding,
 * every opcode its own element. Equivalent to `asmToScript(scriptToAsm(script))` - the ASM string in the middle
 * carries nothing the bytecode does not - without building and re-lexing that string.
 *
 * Done ELEMENT-WISE, not by round-tripping through bytecode. A round trip re-parses the byte stream, so it is
 * only sound on a complete, self-delimiting script: a bare push opcode carried as a NUMBER element makes the
 * decoder read the FOLLOWING opcode as that push's payload, and the malformed instruction it yields comes back
 * as an empty data element that re-encodes to OP_0 - silently destroying bytes (`[0x4c, 0x87]` -> `00`). Function
 * bodies and outlined helper spans are fragments, so they cannot carry that requirement.
 */
export function normaliseScript(script: Script): Script {
  return script.map((element) => {
    if (typeof element === 'number') return element;
    if (foldsToPushNumberOpcode(element)) {
      return element[0] === NEGATIVE_ONE_BYTE ? Op.OP_1NEGATE : element[0] + PUSH_NUMBER_OPCODE_OFFSET;
    }
    return element;
  });
}

/**
 * Scripts whose new-vs-old optimiser agreement has already been established in this process.
 *
 * Both optimisers rewrite ASM derived from the script alone - the location/log/require bookkeeping rides along
 * but never steers a replacement - so the same script cannot reach a different verdict on a second check.
 * Nearly half of all checks ARE a second check: the verifier-binder pass recompiles the same function bodies
 * that the first pass already verified, and only the generated route differs between them.
 *
 * Bounded, because a long-lived process (a test run) would otherwise accumulate every body it ever compiled.
 * Clearing only means checks run again, which is the safe direction.
 */
const OPTIMISER_CROSS_CHECK_MEMO_LIMIT = 4096;
const crossCheckedScripts = new Set<string>();

/**
 * True when `script` still needs the `optimiseBytecodeOld` cross-check, recording it so an identical script
 * skips. Callers keep their own failure message, since each site names a different artifact.
 */
export function needsOptimiserCrossCheck(script: Script): boolean {
  const key = binToHex(scriptToBytecode(script));
  if (crossCheckedScripts.has(key)) return false;
  if (crossCheckedScripts.size >= OPTIMISER_CROSS_CHECK_MEMO_LIMIT) crossCheckedScripts.clear();
  crossCheckedScripts.add(key);
  return true;
}

/** True when two scripts serialise to the same bytecode, and therefore render to the same ASM. */
export function scriptsEqual(left: Script, right: Script): boolean {
  const a = scriptToBytecode(left);
  const b = scriptToBytecode(right);
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

export function countOpcodes(script: Script): number {
  return script
    .filter((opOrData) => typeof opOrData === 'number')
    .filter((op) => (op as number) > Op.OP_16)
    .length;
}

export function calculateBytesize(script: Script): number {
  return scriptToBytecode(script).byteLength;
}

// For encoding OP_RETURN data (doesn't require BIP62.3 / MINIMALDATA)
export function encodeNullDataScript(chunks: OpOrData[]): Uint8Array {
  return flattenBinArray(
    chunks.map((chunk) => {
      if (typeof chunk === 'number') {
        return new Uint8Array([chunk]);
      }

      return encodeDataPush(chunk);
    }),
  );
}

export function generateContractBytecodeScript(baseScript: Script, encodedConstructorArgs: Script): Script {
  return [...encodedConstructorArgs.slice().reverse(), ...baseScript];
}

interface OptimiseBytecodeResult {
  script: Script;
  locationData: FullLocationData;
  logs: LogEntry[];
  requires: RequireStatement[];
}

// Above this op count, skip the optimiseBytecodeOld backwards-compat cross-check (its up-to-1000-pass fixpoint
// is prohibitively slow on very large scripts). The new optimiser's output is what ships; the check never
// changes it. Well above any hand-written contract - only pathological generated scripts (huge arrays) hit it.
export const OPTIMISER_COMPAT_CHECK_MAX_OPS = 5000;

// Above this op count, skip optimisation ENTIRELY. Each pass round-trips the whole script through scriptToAsm, so on a
// pathologically large script (e.g. a deep-inlining explosion) the per-pass cost dominates and the fixpoint is
// prohibitively slow. Such a script is an order of magnitude past any deployable BCH contract (compat check ceiling is
// 5000), so returning it unoptimised (already assembled from per-function-optimised bodies) rather than hanging is the
// correct graceful degradation - the bytecode is semantically identical, just larger.
export const OPTIMISER_SKIP_MAX_OPS = 50000;

export function optimiseBytecode(
  script: Script,
  locationData: FullLocationData,
  logs: LogEntry[],
  requires: RequireStatement[],
  constructorParamLength: number,
  runs: number = 1000,
): OptimiseBytecodeResult {
  if (script.length > OPTIMISER_SKIP_MAX_OPS) return { script, locationData, logs, requires };
  // A round is a pure ASM rewrite, so the Script it used to rebuild existed only for the next round to convert
  // straight back. Convert once on the way in and once on the way out instead.
  let asm = scriptToAsm(script);
  let rewritten = false;
  for (let i = 0; i < runs; i += 1) {
    const result = replaceOps(
      asm, locationData, logs, requires, constructorParamLength, compiledOptimisationReplacements,
    );

    // Break on fixed point: nothing matched, so every field is still the caller's own input.
    if (result.unchanged) break;

    asm = result.asm;
    locationData = result.locationData;
    logs = result.logs;
    requires = result.requires;
    rewritten = true;
  }

  return { script: rewritten ? asmToScript(asm) : script, locationData, logs, requires };
}

// The .equiv table is a constant, but parsing it per call meant re-splitting the whole file for every function
// body the compiler cross-checks.
const cashproofOptimisations = OptimisationsEquivFile
  // Split by line and filter all line comments (#)
  .split('\n')
  .map((equiv) => equiv.trim())
  .filter((equiv) => !equiv.startsWith('#'))
  // Join back the lines, and split on semicolon
  .join('')
  .split(';')
  // Parse all optimisations in .equiv file
  .map((equiv) => equiv.trim())
  .map((equiv) => equiv.split('<=>').map((part) => part.trim()))
  .filter((equiv) => equiv.length === 2)
  .map(([pattern, replacement]) => ({
    // Add word boundaries once at module load rather than rebuilding both this string and its RegExp for every
    // rule, fixpoint round, function body, and compiler pass.
    regex: new RegExp(pattern.replace(/(OP_\w+)/g, '$1(?=\\s|$)'), 'g'),
    replacement,
  }));

export function optimiseBytecodeOld(script: Script, runs: number = 1000): Script {
  // Same conversion hoist as optimiseBytecode: the rounds rewrite ASM, so the Script only has to be rebuilt once.
  let asm = scriptToAsm(script);
  let rewritten = false;
  for (let i = 0; i < runs; i += 1) {
    const next = replaceOpsOld(asm, cashproofOptimisations);

    // Break on fixed point. replaceOpsOld already compared the ASM it rewrote against the ASM it started from.
    if (next === undefined) break;
    asm = next;
    rewritten = true;
  }

  return rewritten ? asmToScript(asm) : script;
}

/** The rewritten ASM, or undefined when no optimisation matched. */
function replaceOpsOld(
  originalAsm: string,
  optimisations: { regex: RegExp; replacement: string }[],
): string | undefined {
  let asm = originalAsm;
  let changed = false;

  // Apply all optimisations in the cashproof file
  // Normalize spaces after each rule to prevent double-space artifacts from
  // empty replacements breaking subsequent pattern matches.
  // Add word boundary assertion (?=\s|$) to each opcode in the pattern to prevent
  // partial matching (e.g., OP_EQUAL matching inside OP_EQUALVERIFY).
  optimisations.forEach(({ regex, replacement }) => {
    const next = asm.replace(regex, replacement);
    // Only re-normalize whitespace when a replacement actually happened (empty replacements can leave double
    // spaces that break the next pattern). Skipping the no-op normalize on non-matching patterns avoids an
    // O(len) whitespace pass per pattern - the dominant cost on very large scripts (e.g. big fixed arrays).
    if (next !== asm) {
      asm = next.replace(/\s+/g, ' ').trim();
      changed = true;
    }
  });

  // Add optimisations that are not compatible with CashProof
  // Use (?=\s|$) lookahead to prevent partial opcode matching
  const replaceExtra = (regex: RegExp, replacement: string): void => {
    const next = asm.replace(regex, replacement);
    if (next !== asm) {
      asm = next;
      changed = true;
    }
  };
  // CashProof can't prove OP_IF without parameters
  replaceExtra(/OP_NOT OP_IF(?=\s|$)/g, 'OP_NOTIF');
  // CashProof can't prove OP_CHECKMULTISIG without specifying N
  replaceExtra(/OP_CHECKMULTISIG OP_VERIFY(?=\s|$)/g, 'OP_CHECKMULTISIGVERIFY');
  // CashProof can't prove bitwise operators
  replaceExtra(/OP_SWAP OP_AND(?=\s|$)/g, 'OP_AND');
  replaceExtra(/OP_SWAP OP_OR(?=\s|$)/g, 'OP_OR');
  replaceExtra(/OP_SWAP OP_XOR(?=\s|$)/g, 'OP_XOR');
  replaceExtra(/OP_DUP OP_AND(?=\s|$)/g, '');
  replaceExtra(/OP_DUP OP_OR(?=\s|$)/g, '');

  if (!changed) return undefined;

  // Remove any double spaces as a result of opcode removal. Inputs are produced by scriptToAsm and therefore
  // already normalized; only a replacement can introduce spacing that needs this pass.
  return asm.replace(/\s+/g, ' ').trim();
}

interface ReplaceOpsResult {
  asm: string;
  locationData: FullLocationData;
  logs: LogEntry[];
  requires: RequireStatement[];
  /** No optimisation matched: every field is the caller's own input, unchanged. */
  unchanged: boolean;
}

function replaceOps(
  originalAsm: string,
  locationData: FullLocationData,
  logs: LogEntry[],
  requires: RequireStatement[],
  constructorParamLength: number,
  optimisations: CompiledOptimisation[],
): ReplaceOpsResult {
  let asm = originalAsm;
  let newLocationData = locationData;
  let newLogs = logs;
  let newRequires = requires;
  const presentTokens = new Set(asm.split(' '));

  optimisations.forEach(({
    pattern, replacement, regex, patternLength, replacementLength, patternTokens, firstToken, requiredTokens,
    replacementTokens,
  }) => {
    if (!presentTokens.has(firstToken)) return;
    for (const token of requiredTokens) if (!presentTokens.has(token)) return;
    let matchIndex = asm.search(regex);
    // Most of the ~100 rules match nothing, and for those the rebuild below is the identity (`asm` is already
    // single-spaced and trimmed). Leaving early skips the accumulator array and its two closures per rule, per
    // round, per function body, on both codegen passes.
    if (matchIndex === -1) return;
    if (newLocationData === locationData) newLocationData = [...locationData];
    for (const token of replacementTokens) presentTokens.add(token);

    // Accumulate normalised ASM pieces in an array and join ONCE at the end - equivalent to repeated
    // mergeAsm(processedAsm, piece) (single-space separators, empties skipped) but O(n) instead of the O(n^2) of
    // copying a growing string on every append (which made large generated bodies pathologically slow to optimise).
    const processedParts: string[] = [];
    // Pre-normalised pieces (slices of the already single-spaced `asm`) only need a trim; the (small) replacement
    // string from the optimisation table needs full whitespace normalisation. Re-running the regex on the large
    // before-match slices was the dominant per-pass cost once the O(n^2) concat was gone.
    const pushPre = (s: string): void => { const b = s.trim(); if (b !== '') processedParts.push(b); };
    const pushAsm = (s: string): void => { const b = s.replace(/\s+/g, ' ').trim(); if (b !== '') processedParts.push(b); };
    // Opcode count of processedAsm, tracked incrementally so scriptIndex is O(slice) per match rather than an
    // O(len) matchAll rescan of the whole accumulated prefix - the latter made large scripts O(N^2).
    let processedTokens = 0;
    let asmToSearch = asm;

    while (matchIndex !== -1) {
      // We add the part before the match to the processed asm
      const beforeMatch = asmToSearch.slice(0, matchIndex);
      pushPre(beforeMatch);
      processedTokens += (beforeMatch.match(/\S+/g) || []).length;

      // The script index is the opcode count of processedAsm (tracked incrementally above).
      // We count the opcodes in the pattern and replacement the same way.
      const scriptIndex = processedTokens;
      // We get the locationData entries for every opcode in the pattern
      const patternLocations = newLocationData.slice(scriptIndex, scriptIndex + patternLength);

      // We get the lowest start location and highest end location of the pattern
      const lowestStart = getLowestStartLocation(patternLocations);
      const highestEnd = getHighestEndLocation(patternLocations);

      // Initially we set the position hint to END if any of the pattern locations have a position hint of END
      // It turned out that this was not the correct approach in the case of OP_NOT OP_IF => OP_NOTIF,
      // because OP_IF and OP_NOTIF are START opcodes, and OP_NOT is an END opcode.
      // After reviewing the entire list of optimisations, we set the position hint to the last location's position hint
      // which we believe to be the correct approach, but it is hard to reason about.
      // We've also consulted with AI (o3-max) to help us reason about this, and it seems to be the correct approach.
      const positionHint = patternLocations.at(-1)?.positionHint ?? PositionHint.START;

      // We merge the lowest start and highest end locations into a single location data entry
      const mergedLocation = {
        location: {
          start: lowestStart.location.start,
          end: highestEnd.location.end,
        },
        positionHint,
      };

      // We replace the pattern locations with the merged location
      // (note that every opcode in the replacement has the same location)
      const replacementLocations = new Array<SingleLocationData>(replacementLength).fill(mergedLocation);
      newLocationData.splice(scriptIndex, patternLength, ...replacementLocations);

      const lengthDiff = patternLength - replacementLength; // 2 or 1

      // The IP of an opcode in the script is its index within the script + the constructor parameters, because
      // the constructor parameters still have to get added to the front of the script when a new Contract is created.
      const scriptIp = scriptIndex + constructorParamLength;

      newRequires = newRequires.map((require) => {
        // We calculate the new ip of the require by subtracting the length diff between the matched pattern and replacement
        const newCalculatedRequireIp = require.ip - lengthDiff;

        return {
          ...require,
          // If the require is within the pattern, we want to make sure that the new ip is at least the scriptIp
          // Note that this is impossible for the current set of optimisations, but future proofs the code
          ip: require.ip >= scriptIp ? Math.max(scriptIp, newCalculatedRequireIp) : require.ip,
        };
      });

      newLogs = newLogs.map((log) => {
        // We calculate the new ip of the log by subtracting the length diff between the matched pattern and replacement
        const newCalculatedLogIp = log.ip - lengthDiff;

        return {
          // If the log is within the pattern, we want to make sure that the new ip is at least the scriptIp
          ip: log.ip >= scriptIp ? Math.max(scriptIp, newCalculatedLogIp) : log.ip,
          line: log.line,
          data: log.data.map((data) => {
            if (typeof data === 'string') return data;

            // If the log is completely before the pattern, we don't need to change anything
            if (data.ip < scriptIp) return data;

            // If the log is completely after the pattern, we just need to offset the ip by the length diff
            if (data.ip >= scriptIp + patternLength) {
              const newCalculatedDataIp = data.ip - lengthDiff;
              return { ...data, ip: newCalculatedDataIp };
            }

            const addedTransformationsCount = data.ip - scriptIp;
            const addedTransformations = patternTokens.slice(0, addedTransformationsCount).join(' ');
            const newTransformations = data.transformations ? `${addedTransformations} ${data.transformations}` : addedTransformations;

            // Only include transformations property if non-empty to avoid adding spurious empty strings
            const result: typeof data = {
              ...data,
              ip: scriptIp,
            };
            if (newTransformations) {
              result.transformations = newTransformations;
            }
            return result;
          }),
        };
      });

      // We add the replacement to the processed asm
      pushAsm(replacement);
      processedTokens += replacementLength;

      // We do not add the matched pattern anywhere since it gets replaced

      // We set the asmToSearch to the part after the match
      asmToSearch = asmToSearch.slice(matchIndex + pattern.length).trim();

      // Find the next match
      matchIndex = asmToSearch.search(regex);
    }

    // We add the remaining asm to the processed asm
    pushPre(asmToSearch);

    // We replace the original asm with the processed asm so that the next optimisation can use the updated asm
    asm = processedParts.join(' ');
  });

  // Nothing matched, so the caller is about to stop iterating with exactly the inputs it handed in.
  if (asm === originalAsm) return { asm: originalAsm, locationData, logs, requires, unchanged: true };

  return {
    asm,
    locationData: newLocationData,
    logs: newLogs,
    requires: newRequires,
    unchanged: false,
  };
}

const getHighestEndLocation = (locations: SingleLocationData[]): SingleLocationData => {
  return locations.reduce((highest, current) => {
    if (current.location.end.line > highest.location.end.line) {
      return current;
    }

    if (highest.location.end.line === current.location.end.line) {
      if (current.location.end.column > highest.location.end.column) {
        return current;
      }
    }

    return highest;
  }, locations[0]);
};

const getLowestStartLocation = (locations: SingleLocationData[]): SingleLocationData => {
  return locations.reduce((lowest, current) => {
    if (current.location.start.line < lowest.location.start.line) {
      return current;
    }

    if (lowest.location.start.line === current.location.start.line) {
      if (current.location.start.column < lowest.location.start.column) {
        return current;
      }
    }

    return lowest;
  }, locations[0]);
};
