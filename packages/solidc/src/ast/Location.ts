import type { ParserRuleContext, Token } from 'antlr4';
import { LocationI } from '@solidcash/utils';

// X92. A position built while COMPILER-GENERATED source is being parsed is a position in that string, not in
// anything the user wrote. Stamped at construction rather than walked afterwards: later lowering passes clone
// and re-parent nodes, and a post-parse walk misses every node they create.
let activeGeneratedOrigin: string | undefined;

// X107. A position built while an IMPORTED file is being parsed is a position in THAT file, not in the one the
// user named. Stamped at construction for the same reason the generated mark is, plus one more: the parse is
// reading exactly one file's text, so it KNOWS the answer, while a reachability walk over the merged AST only
// infers it - and infers it from links a lowering pass can re-parent. The stamp therefore names the file that
// HOLDS the line, never an intermediate that merely re-exports it, with no ordering rule to get wrong.
let activeSourceFileId: string | undefined;

/** Run `parse` with every Location it builds marked as a position in compiler-generated source. */
export function withGeneratedSource<T>(origin: string, parse: () => T): T {
  const previous = activeGeneratedOrigin;
  activeGeneratedOrigin = origin;
  try {
    return parse();
  } finally {
    activeGeneratedOrigin = previous;
  }
}

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

/** The generated-source origin of a position, or undefined when it is a position in a real file. */
export function generatedOriginOf(location?: LocationI): string | undefined {
  return (location as Location | undefined)?.generatedOrigin;
}

/** The imported file holding a position, or undefined when it is in the root file being compiled. */
export function sourceFileOf(location?: LocationI): string | undefined {
  return (location as Location | undefined)?.sourceFileId;
}

export class Location implements LocationI {
  /** Set when this position is in compiler-generated source rather than in a file on disk. */
  generatedOrigin?: string;

  /** Set when this position is in an IMPORTED file rather than in the root file being compiled. */
  sourceFileId?: string;

  constructor(public start: Point, public end: Point) {
    this.generatedOrigin = activeGeneratedOrigin;
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
    // A copy of a generated-source position is still one, whenever the copy is taken. Same for the file stamp:
    // a copy taken by a lowering pass (long after every parse) would otherwise read as a root-file position.
    copy.generatedOrigin = generatedOriginOf(object) ?? copy.generatedOrigin;
    copy.sourceFileId = sourceFileOf(object) ?? copy.sourceFileId;
    return copy;
  }

  text(code: string): string {
    return code.slice(this.start.offset(code), this.end.offset(code));
  }
}

export class Point {
  constructor(public line: number, public column: number) {}

  offset(code: string): number {
    const lines = code.split('\n');
    const newLines = this.line - 1;
    const lineOffset = lines.slice(0, newLines).reduce((acc, curr) => acc + curr.length, 0);
    return lineOffset + newLines + this.column;
  }

  toString(): string {
    return `Line ${this.line}, Column ${this.column}`;
  }
}
