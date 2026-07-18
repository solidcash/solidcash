import {
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

export const Op = OpcodesBch;
export type Op = number;
export type OpOrData = Op | Uint8Array;
export type Script = OpOrData[];

export function scriptToAsm(script: Script): string {
  return bytecodeToAsm(scriptToBytecode(script));
}

export function scriptToBitAuthAsm(script: Script): string {
  return bytecodeToBitAuthAsm(scriptToBytecode(script));
}

export function asmToScript(asm: string): Script {
  return bytecodeToScript(asmToBytecode(asm));
}

// asmToBytecode also works for BitAuth ASM
export function bitAuthAsmToScript(asm: string): Script {
  return asmToScript(asm);
}

export function scriptToBytecode(script: Script): Uint8Array {
  // Convert the script elements to AuthenticationInstructions
  const instructions = script.map((opOrData) => {
    if (typeof opOrData === 'number') {
      return { opcode: opOrData };
    }

    return decodeAuthenticationInstructions(encodeDataPush(opOrData))[0];
  });

  // Convert the AuthenticationInstructions to bytecode
  return encodeAuthenticationInstructions(instructions);
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
  for (let i = 0; i < runs; i += 1) {
    const oldScript = script;
    const {
      script: newScript,
      locationData: newLocationData,
      logs: newLogs,
      requires: newRequires,
    } = replaceOps(script, locationData, logs, requires, constructorParamLength, optimisationReplacements);

    // Break on fixed point
    if (scriptToAsm(oldScript) === scriptToAsm(newScript)) {
      break;
    }

    script = newScript;
    locationData = newLocationData;
    logs = newLogs;
    requires = newRequires;
  }

  return { script, locationData, logs, requires };
}

export function optimiseBytecodeOld(script: Script, runs: number = 1000): Script {
  const optimisations = OptimisationsEquivFile
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
    .filter((equiv) => equiv.length === 2);

  for (let i = 0; i < runs; i += 1) {
    const oldScript = script;
    script = replaceOpsOld(script, optimisations);

    // Break on fixed point
    if (scriptToAsm(oldScript) === scriptToAsm(script)) break;
  }

  return script;
}

function replaceOpsOld(script: Script, optimisations: string[][]): Script {
  let asm = scriptToAsm(script);

  // Apply all optimisations in the cashproof file
  // Normalize spaces after each rule to prevent double-space artifacts from
  // empty replacements breaking subsequent pattern matches.
  // Add word boundary assertion (?=\s|$) to each opcode in the pattern to prevent
  // partial matching (e.g., OP_EQUAL matching inside OP_EQUALVERIFY).
  optimisations.forEach(([pattern, replacement]) => {
    const boundedPattern = pattern.replace(/(OP_\w+)/g, '$1(?=\\s|$)');
    const next = asm.replace(new RegExp(boundedPattern, 'g'), replacement);
    // Only re-normalize whitespace when a replacement actually happened (empty replacements can leave double
    // spaces that break the next pattern). Skipping the no-op normalize on non-matching patterns avoids an
    // O(len) whitespace pass per pattern - the dominant cost on very large scripts (e.g. big fixed arrays).
    if (next !== asm) asm = next.replace(/\s+/g, ' ').trim();
  });

  // Add optimisations that are not compatible with CashProof
  // Use (?=\s|$) lookahead to prevent partial opcode matching
  // CashProof can't prove OP_IF without parameters
  asm = asm.replace(/OP_NOT OP_IF(?=\s|$)/g, 'OP_NOTIF');
  // CashProof can't prove OP_CHECKMULTISIG without specifying N
  asm = asm.replace(/OP_CHECKMULTISIG OP_VERIFY(?=\s|$)/g, 'OP_CHECKMULTISIGVERIFY');
  // CashProof can't prove bitwise operators
  asm = asm.replace(/OP_SWAP OP_AND(?=\s|$)/g, 'OP_AND');
  asm = asm.replace(/OP_SWAP OP_OR(?=\s|$)/g, 'OP_OR');
  asm = asm.replace(/OP_SWAP OP_XOR(?=\s|$)/g, 'OP_XOR');
  asm = asm.replace(/OP_DUP OP_AND(?=\s|$)/g, '');
  asm = asm.replace(/OP_DUP OP_OR(?=\s|$)/g, '');

  // Remove any double spaces as a result of opcode removal
  asm = asm.replace(/\s+/g, ' ').trim();

  return asmToScript(asm);
}

interface ReplaceOpsResult {
  script: Script;
  locationData: FullLocationData;
  logs: LogEntry[];
  requires: RequireStatement[];
}

function replaceOps(
  script: Script,
  locationData: FullLocationData,
  logs: LogEntry[],
  requires: RequireStatement[],
  constructorParamLength: number,
  optimisations: string[][],
): ReplaceOpsResult {
  let asm = scriptToAsm(script);
  let newLocationData = [...locationData];
  let newLogs = [...logs];
  let newRequires = [...requires];

  optimisations.forEach(([pattern, replacement]) => {
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

    // We add a space or end of string to the end of the pattern to ensure that we match the whole pattern
    // (no partial matches)
    const regex = new RegExp(`${pattern}(\\s|$)`, 'g');

    let matchIndex = asmToSearch.search(regex);
    while (matchIndex !== -1) {
      // We add the part before the match to the processed asm
      const beforeMatch = asmToSearch.slice(0, matchIndex);
      pushPre(beforeMatch);
      processedTokens += (beforeMatch.match(/\S+/g) || []).length;

      // The script index is the opcode count of processedAsm (tracked incrementally above).
      // We count the opcodes in the pattern and replacement the same way.
      const scriptIndex = processedTokens;
      const patternLength = [...pattern.matchAll(/\s+/g)].length + 1;
      const replacementLength = replacement === '' ? 0 : [...replacement.matchAll(/\s+/g)].length + 1;

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
            const addedTransformations = [...pattern.split(/\s+/g)].slice(0, addedTransformationsCount).join(' ');
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

  return {
    script: asmToScript(asm),
    locationData: newLocationData,
    logs: newLogs,
    requires: newRequires,
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

const mergeAsm = (asm1: string, asm2: string): string => {
  // Append two ASM strings with a single separating space. asm1 is the accumulated result of prior merges and
  // is already normalised, so we only normalise the (small) newly-appended asm2 rather than re-scanning the
  // whole accumulated string on every append - the latter was O(N^2) on large scripts (huge fixed arrays).
  const b = asm2.replace(/\s+/g, ' ').trim();
  if (asm1 === '') return b;
  if (b === '') return asm1;
  return `${asm1} ${b}`;
};
