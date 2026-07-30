import type { ParserRuleContext, Token } from 'antlr4';
import { LocationI } from '@solidcash/utils';

// X92. A position built while COMPILER-GENERATED source is being parsed is a position in that string, not in
// anything the user wrote. Stamped at construction rather than walked afterwards: later lowering passes clone
// and re-parent nodes, and a post-parse walk misses every node they create.
let activeGeneratedOrigin: string | undefined;

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

/** The generated-source origin of a position, or undefined when it is a position in a real file. */
export function generatedOriginOf(location?: LocationI): string | undefined {
  return (location as Location | undefined)?.generatedOrigin;
}

export class Location implements LocationI {
  /** Set when this position is in compiler-generated source rather than in a file on disk. */
  generatedOrigin?: string;

  constructor(public start: Point, public end: Point) {
    this.generatedOrigin = activeGeneratedOrigin;
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
    // A copy of a generated-source position is still one, whenever the copy is taken.
    copy.generatedOrigin = generatedOriginOf(object) ?? copy.generatedOrigin;
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
