import type { ParserRuleContext, Token } from 'antlr4';
import type { LocationI } from '@solidcash/utils';

// X107. A position built while an IMPORTED file is being parsed is a position in THAT file, not in the one the
// user named. Stamped at construction rather than walked afterwards: later lowering passes clone and re-parent
// nodes, and a post-parse walk misses every node they create. The parse is also reading exactly one file's text,
// so it KNOWS the answer, while a reachability walk over the merged AST only infers it - and infers it from links
// a lowering pass can re-parent. The stamp therefore names the file that HOLDS the line, never an intermediate
// that merely re-exports it, with no ordering rule to get wrong.
let activeSourceFileId: string | undefined;

/**
 * Run `parse` with every Location it builds stamped as a position in `fileId`.
 * `undefined` is the root file being compiled, whose bare line number is already correct.
 */
export function withSourceFile<T>(fileId: string | undefined, parse: () => T): T {
  const previous = activeSourceFileId;
  activeSourceFileId = fileId;
  try {
    return parse();
  } finally {
    activeSourceFileId = previous;
  }
}

/** The imported file holding a position, or undefined when it is in the root file being compiled. */
export function sourceFileOf(location?: LocationI): string | undefined {
  return (location as Location | undefined)?.sourceFileId;
}

/** Stable source identity for matching a serialized compute expression to its emitted VM call site. */
export function computeExpressionSiteKey(location: LocationI): string {
  const source = sourceFileOf(location) ?? '';
  // The empty middle field keeps the published key shape.
  return `${source}\0\0${location.start.line}:${location.start.column}`
    + `-${location.end.line}:${location.end.column}`;
}

export class Location implements LocationI {
  /** Set when this position is in an IMPORTED file rather than in the root file being compiled. */
  sourceFileId?: string;

  constructor(public start: Point, public end: Point) {
    this.sourceFileId = activeSourceFileId;
  }

  static fromCtx(ctx: ParserRuleContext): Location {
    const stop = ctx.stop?.text ? ctx.stop : ctx.start;
    const textLength = (stop.text ?? '').length;

    const start = new Point(ctx.start.line, ctx.start.column);
    const end = new Point(stop.line, stop.column + textLength);

    return new Location(start, end);
  }

  static fromToken(token: Token): Location {
    const textLength = (token.text ?? '').length;

    const start = new Point(token.line, token.column);
    const end = new Point(token.line, token.column + textLength);

    return new Location(start, end);
  }

  static fromObject(object: LocationI): Location {
    const start = new Point(object.start.line, object.start.column);
    const end = new Point(object.end.line, object.end.column);

    const copy = new Location(start, end);
    // A copy keeps the file stamp: one taken by a lowering pass (long after every parse) would otherwise read as
    // a root-file position.
    copy.sourceFileId = sourceFileOf(object) ?? copy.sourceFileId;
    return copy;
  }

  text(code: string): string {
    return code.slice(this.start.offset(code), this.end.offset(code));
  }
}

let cachedOffsetCode: string | undefined;
let cachedLineStarts: number[] | undefined;
function lineStartsFor(code: string): number[] {
  if (cachedOffsetCode === code && cachedLineStarts !== undefined) return cachedLineStarts;
  const starts = [0];
  for (let i = 0; i < code.length; i += 1) {
    if (code.charCodeAt(i) === 10) starts.push(i + 1);
  }
  cachedOffsetCode = code;
  cachedLineStarts = starts;
  return starts;
}

export class Point {
  constructor(public line: number, public column: number) {}

  offset(code: string): number {
    const starts = lineStartsFor(code);
    const newLines = this.line - 1;
    const lineOffset = starts[Math.min(newLines, starts.length - 1)] ?? 0;
    return lineOffset + this.column;
  }

  toString(): string {
    return `Line ${this.line}, Column ${this.column}`;
  }
}
