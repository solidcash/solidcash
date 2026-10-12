const SIMPLE_ESCAPES: Record<string, number> = {
  n: 0x0a, r: 0x0d, t: 0x09, '\\': 0x5c, '\'': 0x27, '"': 0x22,
};

// UTF-8 of one code point, as solc's Scanner::addUnicodeAsUTF8 writes it (a `\u` surrogate is encoded, not replaced).
function pushUtf8(bytes: number[], codePoint: number): void {
  if (codePoint <= 0x7f) bytes.push(codePoint);
  else if (codePoint <= 0x7ff) bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
  else if (codePoint <= 0xffff) {
    bytes.push(0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
  } else {
    bytes.push(0xf0 | (codePoint >> 18), 0x80 | ((codePoint >> 12) & 0x3f), 0x80 | ((codePoint >> 6) & 0x3f),
      0x80 | (codePoint & 0x3f));
  }
}

/**
 * The bytes solc gives the text between a string literal's quotes: `\n \r \t \' \" \\`, `\xNN` as one raw byte,
 * `\uNNNN` as UTF-8, a backslash-newline continuation dropped, and any other character as UTF-8. Undefined on a
 * malformed or unknown escape.
 */
export function stringLiteralBytes(raw: string): Uint8Array | undefined {
  const bytes: number[] = [];
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] !== '\\') {
      const codePoint = raw.codePointAt(i)!;
      pushUtf8(bytes, codePoint);
      if (codePoint > 0xffff) i++;
      continue;
    }
    const next = raw[i + 1];
    if (next === 'x' && /^[0-9a-fA-F]{2}$/.test(raw.slice(i + 2, i + 4))) {
      bytes.push(parseInt(raw.slice(i + 2, i + 4), 16));
      i += 3;
    } else if (next === 'u' && /^[0-9a-fA-F]{4}$/.test(raw.slice(i + 2, i + 6))) {
      pushUtf8(bytes, parseInt(raw.slice(i + 2, i + 6), 16));
      i += 5;
    } else if (next === '\n') {
      i++;
    } else if (next === '\r') {
      i += raw[i + 2] === '\n' ? 2 : 1;
    } else if (next !== undefined && next in SIMPLE_ESCAPES) {
      bytes.push(SIMPLE_ESCAPES[next]);
      i++;
    } else {
      return undefined;
    }
  }
  return Uint8Array.from(bytes);
}

/** The UTF-8 reading of `bytes` (a leading BOM kept), or undefined when they are not valid UTF-8. */
export function decodeUtf8Exact(bytes: Uint8Array): string | undefined {
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return undefined;
  }
}
