import { FullLocationData, PositionHint } from './types.js';

/*
 * The source mappings for the bytecode use the following notation (similar to Solidity):
 *
 * `sl:sc:el:ec:h`
 *
 * Where `sl` is the start line, `sc` - start column, `el` - end line, and `ec` - end column
 * of the range in the source file.
 * `h` is the position hint denoting where to place the instruction - at the beginning of the parent AST block
 * or at the end.
 * `h` is used with AST blocks, instructions of which surround children blocks, like function declarations and
 * if-then-else blocks.
 *
 * Mappings are a list of `sl:sc:el:ec:h` separated by `;`. Each of these elements corresponds to an instruction.
 *
 * In order to compress these source mappings, the following rules are used:
 *
 * If a field is empty, the value of the preceding element is used.
 * If a `:` is missing, all the following fields are considered empty.
 * This means the following source mappings represent the same information:
 *
 * 14:20:14:29;14:20:14:29;14:12:14:30;14:34:14:43;14:34:14:43
 *
 * 14:20:14:29;;:12::30;:34::43;
 *
 */
export function generateSourceMap(locationData: FullLocationData): string {
  let prevStartLine = 0;
  let prevStartColumn = 0;
  let prevEndLine = 0;
  let prevEndColumn = 0;
  let prevHint = PositionHint.START;

  const entries = new Array<string>(locationData.length);
  for (let index = 0; index < locationData.length; index += 1) {
    const { location, positionHint } = locationData[index];
    // A compiler-generated instruction may carry no source location (like solc's empty source-map entries).
    // Fall back to the previous mapping's positions so the fields serialise as empty ("same as previous")
    // rather than crashing on a missing location.
    const startLine = location?.start.line ?? prevStartLine;
    const startColumn = location?.start.column ?? prevStartColumn;
    const endLine = location?.end.line ?? prevEndLine;
    const endColumn = location?.end.column ?? prevEndColumn;
    const prevStartLineString = prevStartLine === startLine ? '' : String(startLine);
    prevStartLine = startLine;

    const prevStartColumnString = prevStartColumn === startColumn ? '' : String(startColumn);
    prevStartColumn = startColumn;

    const prevEndLineString = prevEndLine === endLine ? '' : String(endLine);
    prevEndLine = endLine;

    const prevEndColumnString = prevEndColumn === endColumn ? '' : String(endColumn);
    prevEndColumn = endColumn;

    const hint = positionHint ?? PositionHint.START;
    const prevHintString = prevHint === hint ? '' : String(hint);
    prevHint = hint;

    if (prevHintString) {
      entries[index] = `${prevStartLineString}:${prevStartColumnString}:${prevEndLineString}`
        + `:${prevEndColumnString}:${prevHintString}`;
    } else if (prevEndColumnString) {
      entries[index] = `${prevStartLineString}:${prevStartColumnString}:${prevEndLineString}:${prevEndColumnString}`;
    } else if (prevEndLineString) {
      entries[index] = `${prevStartLineString}:${prevStartColumnString}:${prevEndLineString}`;
    } else if (prevStartColumnString) {
      entries[index] = `${prevStartLineString}:${prevStartColumnString}`;
    } else {
      entries[index] = prevStartLineString;
    }
  }
  return entries.join(';');
}

export const sourceMapToLocationData = (sourceMap: string): FullLocationData => {
  let prevStartLine = 0;
  let prevStartColumn = 0;
  let prevEndLine = 0;
  let prevEndColumn = 0;
  let prevHint: PositionHint = PositionHint.START;

  const entries = sourceMap.split(';');
  const locationData = new Array<FullLocationData[number]>(entries.length);
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const first = entry.indexOf(':');
    let startLineStr: string | undefined;
    let startColumnStr: string | undefined;
    let endLineStr: string | undefined;
    let endColumnStr: string | undefined;
    let positionHintStr: string | undefined;
    if (first === -1) {
      startLineStr = entry;
    } else {
      startLineStr = entry.slice(0, first);
      const second = entry.indexOf(':', first + 1);
      if (second === -1) {
        startColumnStr = entry.slice(first + 1);
      } else {
        startColumnStr = entry.slice(first + 1, second);
        const third = entry.indexOf(':', second + 1);
        if (third === -1) {
          endLineStr = entry.slice(second + 1);
        } else {
          endLineStr = entry.slice(second + 1, third);
          const fourth = entry.indexOf(':', third + 1);
          if (fourth === -1) {
            endColumnStr = entry.slice(third + 1);
          } else {
            endColumnStr = entry.slice(third + 1, fourth);
            positionHintStr = entry.slice(fourth + 1);
          }
        }
      }
    }

    const startLine = startLineStr ? Number(startLineStr) : prevStartLine;
    prevStartLine = startLine;

    const startColumn = startColumnStr ? Number(startColumnStr) : prevStartColumn;
    prevStartColumn = startColumn;

    const endLine = endLineStr ? Number(endLineStr) : prevEndLine;
    prevEndLine = endLine;

    const endColumn = endColumnStr ? Number(endColumnStr) : prevEndColumn;
    prevEndColumn = endColumn;

    const hint: PositionHint = parsePositionHint(positionHintStr) ?? prevHint;
    prevHint = hint;

    locationData[index] = {
      location: {
        start: { line: startLine, column: startColumn },
        end: { line: endLine, column: endColumn },
      },
      positionHint: hint,
    };
  }
  return locationData;
};

const parsePositionHint = (hint: string | undefined): PositionHint | undefined => {
  if (hint === '1') return PositionHint.END;
  if (hint === '0') return PositionHint.START;
  return undefined;
};
