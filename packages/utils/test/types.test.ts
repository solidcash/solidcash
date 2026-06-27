import {
  ArrayType,
  BytesType,
  explicitlyCastable,
  fixedWidthBytes,
  isFixedWidthType,
  parseType,
  PrimitiveType,
  TupleType,
} from '../src/index.js';

describe('type utilities', () => {
  // Foundation for the flat-stream chunk-packed array: which element types pack to a constant width,
  // and what that width is (element i lives at byte offset i * fixedWidthBytes). See docs/arrays.md.
  describe('isFixedWidthType / fixedWidthBytes', () => {
    it('classifies fixed-width types and their packed byte widths', () => {
      // bool / pubkey / bounded bytes
      expect(isFixedWidthType('bool')).toBe(true);
      expect(fixedWidthBytes('bool')).toBe(1);
      expect(isFixedWidthType('pubkey')).toBe(true);
      expect(fixedWidthBytes('pubkey')).toBe(33);
      expect(fixedWidthBytes('bytes20')).toBe(20);
      expect(fixedWidthBytes('bytes200')).toBe(200);
      // bounded ints: sign-magnitude width = ceil((bits+1)/8)
      expect(fixedWidthBytes('uint8')).toBe(2);
      expect(fixedWidthBytes('uint256')).toBe(33);
      expect(fixedWidthBytes('int128')).toBe(17);
    });

    it('rejects variable-width types', () => {
      expect(isFixedWidthType('bigint')).toBe(false); // plain int is value-dependent
      expect(isFixedWidthType('bytes')).toBe(false); // unbounded
      expect(isFixedWidthType('string')).toBe(false);
      expect(() => fixedWidthBytes('string')).toThrow();
    });
  });

  describe('explicitlyCastable()', () => {
    it('cannot cast undefined values', () => {
      expect(explicitlyCastable(PrimitiveType.BIGINT, undefined)).toEqual(false);
      expect(explicitlyCastable(undefined, PrimitiveType.STRING)).toEqual(false);
    });

    it('cannot cast tuples', () => {
      expect(explicitlyCastable(PrimitiveType.BIGINT, new TupleType([PrimitiveType.BIGINT, PrimitiveType.BIGINT])))
        .toEqual(false);
      expect(explicitlyCastable(new TupleType([PrimitiveType.BIGINT, PrimitiveType.BIGINT]), PrimitiveType.STRING))
        .toEqual(false);
    });

    it('cannot cast between array an non-array', () => {
      expect(explicitlyCastable(PrimitiveType.BIGINT, new ArrayType(PrimitiveType.BIGINT)))
        .toEqual(false);
    });

    it('cannot cast arrays if their elements cannot be cast', () => {
      expect(
        explicitlyCastable(new ArrayType(PrimitiveType.BOOL), new ArrayType(PrimitiveType.STRING)),
      ).toEqual(false);
    });

    it('can cast arrays if their elements can be cast', () => {
      expect(
        explicitlyCastable(new ArrayType(PrimitiveType.BOOL), new ArrayType(PrimitiveType.BIGINT)),
      ).toEqual(true);
    });

    // TODO: fully test cast combinations
  });

  describe.skip('TODO: implicitlyCastable()', () => {
  });

  describe.skip('TODO: resultingType()', () => {
  });

  describe.skip('TODO: arrayType()', () => {
  });

  describe.skip('TODO: implicitlyCastableSignature()', () => {
  });

  describe('parseType()', () => {
    it('should parse primitive type strings', () => {
      expect(parseType('bigint')).toEqual(PrimitiveType.BIGINT);
      expect(parseType('bool')).toEqual(PrimitiveType.BOOL);
      expect(parseType('string')).toEqual(PrimitiveType.STRING);
      expect(parseType('pubkey')).toEqual(PrimitiveType.PUBKEY);
      expect(parseType('sig')).toEqual(PrimitiveType.SIG);
      expect(parseType('datasig')).toEqual(PrimitiveType.DATASIG);
    });

    it('should parse bytes type strings', () => {
      expect(parseType('bytes')).toEqual(new BytesType());
      expect(parseType('bytes1')).toEqual(new BytesType(1));
      expect(parseType('bytes32')).toEqual(new BytesType(32));
      expect(parseType('bytes256')).toEqual(new BytesType(256));
    });
  });
});
