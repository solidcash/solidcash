import {
  getDefaultStateValue,
  getMaxPushdataEncodedSize,
  encodePushdataValue,
  decodePushdataValue,
  buildPushdataCommitment,
  parsePushdataCommitment,
  buildInitialStateCommitments,
  buildDataNftCovenantScript,
  buildEntryNftCovenantScript,
  buildSatoshiContainerCovenantScript,
  StateLayout,
  StateRecord,
  Op,
  scriptToBytecode,
  StructDefinitionInfo,
} from '../src/index.js';

describe('getDefaultStateValue', () => {
  it('should return 0n for "int"', () => {
    expect(getDefaultStateValue('int')).toBe(0n);
  });

  it('should return false for "bool"', () => {
    expect(getDefaultStateValue('bool')).toBe(false);
  });

  it('should return Uint8Array(4) for "bytes4"', () => {
    const result = getDefaultStateValue('bytes4');
    expect(result).toBeInstanceOf(Uint8Array);
    expect((result as Uint8Array).length).toBe(4);
    expect(result).toEqual(new Uint8Array(4));
  });

  it('should return Uint8Array(20) for "bytes20"', () => {
    const result = getDefaultStateValue('bytes20');
    expect(result).toBeInstanceOf(Uint8Array);
    expect((result as Uint8Array).length).toBe(20);
  });

  it('should return Uint8Array(32) for "bytes32"', () => {
    const result = getDefaultStateValue('bytes32');
    expect(result).toBeInstanceOf(Uint8Array);
    expect((result as Uint8Array).length).toBe(32);
  });

  it('should return Uint8Array(0) for "bytes"', () => {
    const result = getDefaultStateValue('bytes');
    expect(result).toBeInstanceOf(Uint8Array);
    expect((result as Uint8Array).length).toBe(0);
  });

  it('should return Uint8Array(33) for "pubkey"', () => {
    const result = getDefaultStateValue('pubkey');
    expect(result).toBeInstanceOf(Uint8Array);
    expect((result as Uint8Array).length).toBe(33);
  });
});

describe('getMaxPushdataEncodedSize', () => {
  it('should return 1 for bool', () => {
    expect(getMaxPushdataEncodedSize('bool')).toBe(1);
  });

  it('should return 258 for int', () => {
    expect(getMaxPushdataEncodedSize('int')).toBe(258);
  });

  it('should return 34 for pubkey', () => {
    expect(getMaxPushdataEncodedSize('pubkey')).toBe(34);
  });

  it('should return N+1 for bytesN (2-75)', () => {
    expect(getMaxPushdataEncodedSize('bytes4')).toBe(5);
    expect(getMaxPushdataEncodedSize('bytes20')).toBe(21);
    expect(getMaxPushdataEncodedSize('bytes32')).toBe(33);
  });

  it('should return 2 for bytes1', () => {
    expect(getMaxPushdataEncodedSize('bytes1')).toBe(2);
  });
});

describe('encodePushdataValue / decodePushdataValue roundtrip', () => {
  it('should roundtrip bool false', () => {
    const encoded = encodePushdataValue(false, 'bool');
    expect(encoded).toEqual(new Uint8Array([0x00]));
    const { value, bytesConsumed } = decodePushdataValue(encoded, 0, 'bool');
    expect(value).toBe(false);
    expect(bytesConsumed).toBe(1);
  });

  it('should roundtrip bool true', () => {
    const encoded = encodePushdataValue(true, 'bool');
    expect(encoded).toEqual(new Uint8Array([0x51]));
    const { value, bytesConsumed } = decodePushdataValue(encoded, 0, 'bool');
    expect(value).toBe(true);
    expect(bytesConsumed).toBe(1);
  });

  it('should roundtrip int 0', () => {
    const encoded = encodePushdataValue(0n, 'int');
    expect(encoded).toEqual(new Uint8Array([0x00])); // OP_0
    const { value } = decodePushdataValue(encoded, 0, 'int');
    expect(value).toBe(0n);
  });

  it('should roundtrip int 1-16 as OP_N', () => {
    for (let i = 1; i <= 16; i++) {
      const encoded = encodePushdataValue(BigInt(i), 'int');
      expect(encoded).toEqual(new Uint8Array([0x50 + i])); // OP_1 to OP_16
      const { value } = decodePushdataValue(encoded, 0, 'int');
      expect(value).toBe(BigInt(i));
    }
  });

  it('should roundtrip int -1 as OP_1NEGATE', () => {
    const encoded = encodePushdataValue(-1n, 'int');
    expect(encoded).toEqual(new Uint8Array([0x4f])); // OP_1NEGATE
    const { value } = decodePushdataValue(encoded, 0, 'int');
    expect(value).toBe(-1n);
  });

  it('should roundtrip int 42', () => {
    const encoded = encodePushdataValue(42n, 'int');
    // 42 = 0x2a, encoded as: 0x01 (length=1) 0x2a
    expect(encoded).toEqual(new Uint8Array([0x01, 0x2a]));
    const { value } = decodePushdataValue(encoded, 0, 'int');
    expect(value).toBe(42n);
  });

  it('should roundtrip int 1000', () => {
    const encoded = encodePushdataValue(1000n, 'int');
    // 1000 = 0x03e8, LE: e8 03, encoded as: 0x02 (length) e8 03
    expect(encoded).toEqual(new Uint8Array([0x02, 0xe8, 0x03]));
    const { value } = decodePushdataValue(encoded, 0, 'int');
    expect(value).toBe(1000n);
  });

  it('should roundtrip bytes4', () => {
    const data = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const encoded = encodePushdataValue(data, 'bytes4');
    expect(encoded).toEqual(new Uint8Array([0x04, 0xde, 0xad, 0xbe, 0xef]));
    const { value, bytesConsumed } = decodePushdataValue(encoded, 0, 'bytes4');
    expect(value).toEqual(data);
    expect(bytesConsumed).toBe(5);
  });

  it('should roundtrip pubkey', () => {
    const pubkey = new Uint8Array(33).fill(0xab);
    const encoded = encodePushdataValue(pubkey, 'pubkey');
    expect(encoded[0]).toBe(33); // length prefix
    expect(encoded.length).toBe(34);
    const { value, bytesConsumed } = decodePushdataValue(encoded, 0, 'pubkey');
    expect(value).toEqual(pubkey);
    expect(bytesConsumed).toBe(34);
  });
});

describe('buildPushdataCommitment / parsePushdataCommitment', () => {
  const layout: StateLayout = {
    variables: [
      { name: 'counter', type: 'int', nftIndex: 0, fieldIndex: 0 },
      { name: 'label', type: 'bytes4', nftIndex: 0, fieldIndex: 1 },
    ],
    dataNftCount: 1,
    commitmentLimit: 128,
  };

  it('should build and parse commitment for counter=0, label=0x00000000', () => {
    const commitment = buildPushdataCommitment(layout, { counter: 0n, label: new Uint8Array(4) }, 0);
    // counter=0 -> 0x00 (OP_0), label=0x00000000 -> 0x04 0x00 0x00 0x00 0x00
    expect(commitment).toBe('000400000000');

    const parsed = parsePushdataCommitment(commitment, layout, 0);
    expect(parsed.counter).toBe(0n);
    expect(parsed.label).toEqual(new Uint8Array(4));
  });

  it('should build and parse commitment for counter=42, label=0xdeadbeef', () => {
    const label = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const commitment = buildPushdataCommitment(layout, { counter: 42n, label }, 0);
    // counter=42 -> 0x01 0x2a, label=0xdeadbeef -> 0x04 0xde 0xad 0xbe 0xef
    expect(commitment).toBe('012a04deadbeef');

    const parsed = parsePushdataCommitment(commitment, layout, 0);
    expect(parsed.counter).toBe(42n);
    expect(parsed.label).toEqual(label);
  });

  it('should use defaults for missing values', () => {
    const commitment = buildPushdataCommitment(layout, {}, 0);
    const parsed = parsePushdataCommitment(commitment, layout, 0);
    expect(parsed.counter).toBe(0n);
    expect(parsed.label).toEqual(new Uint8Array(4));
  });
});

describe('buildInitialStateCommitments with defaults', () => {
  const layout: StateLayout = {
    variables: [
      { name: 'counter', type: 'int', nftIndex: 0, fieldIndex: 0 },
      { name: 'label', type: 'bytes4', nftIndex: 0, fieldIndex: 1 },
    ],
    dataNftCount: 1,
    commitmentLimit: 128,
  };

  it('should work when all values omitted (no error for bytesN types)', () => {
    expect(() => buildInitialStateCommitments(layout, {})).not.toThrow();
    const commitments = buildInitialStateCommitments(layout, {});
    expect(commitments).toHaveLength(1);
    expect(commitments[0].length).toBeGreaterThan(0);
  });

  it('should mix explicit and default values correctly', () => {
    const commitments = buildInitialStateCommitments(layout, { counter: 42n });
    expect(commitments).toHaveLength(1);
    expect(commitments[0].length).toBeGreaterThan(0);

    const parsed = parsePushdataCommitment(commitments[0], layout, 0);
    expect(parsed.counter).toBe(42n);
    expect(parsed.label).toEqual(new Uint8Array(4));
  });
});

describe('encodePushdataValue input validation', () => {
  it('should reject pubkey with wrong size', () => {
    expect(() => encodePushdataValue(new Uint8Array(32), 'pubkey')).toThrow('pubkey must be exactly 33 bytes');
    expect(() => encodePushdataValue(new Uint8Array(34), 'pubkey')).toThrow('pubkey must be exactly 33 bytes');
  });

  it('should reject bytesN with wrong size', () => {
    expect(() => encodePushdataValue(new Uint8Array(3), 'bytes4')).toThrow('bytes4 must be exactly 4 bytes');
    expect(() => encodePushdataValue(new Uint8Array(5), 'bytes4')).toThrow('bytes4 must be exactly 4 bytes');
    expect(() => encodePushdataValue(new Uint8Array(19), 'bytes20')).toThrow('bytes20 must be exactly 20 bytes');
  });

  it('should accept correctly-sized values', () => {
    expect(() => encodePushdataValue(new Uint8Array(33), 'pubkey')).not.toThrow();
    expect(() => encodePushdataValue(new Uint8Array(4), 'bytes4')).not.toThrow();
    expect(() => encodePushdataValue(new Uint8Array(20), 'bytes20')).not.toThrow();
  });
});

describe('decodePushdataValue bounds checking', () => {
  it('should throw on out-of-bounds offset', () => {
    const data = new Uint8Array([0x00]);
    expect(() => decodePushdataValue(data, 1, 'int')).toThrow('out of bounds');
    expect(() => decodePushdataValue(data, -1, 'int')).toThrow('out of bounds');
  });

  it('should throw on truncated pubkey data', () => {
    // Length prefix says 33 bytes, but only 5 bytes available
    const data = new Uint8Array([33, 0x01, 0x02, 0x03, 0x04, 0x05]);
    expect(() => decodePushdataValue(data, 0, 'pubkey')).toThrow('unexpected end of data');
  });

  it('should throw on truncated bytesN data', () => {
    // bytes4 needs 1 + 4 = 5 bytes, but only 3 available
    const data = new Uint8Array([0x04, 0xde, 0xad]);
    expect(() => decodePushdataValue(data, 0, 'bytes4')).toThrow('unexpected end of data');
  });

  it('should throw on truncated OP_PUSHDATA1', () => {
    // OP_PUSHDATA1 with length byte saying 10, but only 3 bytes of data
    const data = new Uint8Array([0x4c, 10, 0x01, 0x02, 0x03]);
    expect(() => decodePushdataValue(data, 0, 'int')).toThrow('unexpected end of data');
  });

  it('should throw on truncated OP_PUSHDATA2', () => {
    // OP_PUSHDATA2 with length 256, but no data
    const data = new Uint8Array([0x4d, 0x00, 0x01]);
    expect(() => decodePushdataValue(data, 0, 'int')).toThrow('unexpected end of data');
  });

  it('should throw on truncated standard pushdata', () => {
    // Standard pushdata: length 5, but only 2 bytes of data
    const data = new Uint8Array([0x05, 0x01, 0x02]);
    expect(() => decodePushdataValue(data, 0, 'int')).toThrow('unexpected end of data');
  });

  it('should succeed on valid data', () => {
    const encoded = encodePushdataValue(42n, 'int');
    expect(() => decodePushdataValue(encoded, 0, 'int')).not.toThrow();
  });
});

describe('buildDataNftCovenantScript (tri-path)', () => {
  const categoryId = new Uint8Array(32).fill(0xab);

  it('should produce valid script bytecode', () => {
    const script = buildDataNftCovenantScript(categoryId);
    expect(script).toBeDefined();
    expect(script.length).toBeGreaterThan(0);
    const bytecode = scriptToBytecode(script);
    expect(bytecode).toBeInstanceOf(Uint8Array);
    expect(bytecode.length).toBeGreaterThan(0);
  });

  it('should start with OP_DUP for tri-path flag=2 check', () => {
    const script = buildDataNftCovenantScript(categoryId);
    // Tri-path: OP_DUP OP_2 OP_NUMEQUAL OP_IF (destroy) OP_ELSE (inner dual-path) OP_ENDIF
    expect(script[0]).toBe(Op.OP_DUP);
    expect(script[1]).toBe(Op.OP_2);
    expect(script[2]).toBe(Op.OP_NUMEQUAL);
    expect(script[3]).toBe(Op.OP_IF);
    // Should contain OP_ELSE and OP_ENDIF for the outer and inner paths
    expect(script).toContain(Op.OP_ELSE);
    expect(script).toContain(Op.OP_ENDIF);
  });

  it('should contain self-preservation opcodes in common section (flag=0/1 paths only)', () => {
    const script = buildDataNftCovenantScript(categoryId);
    // The common section for flag=0/1 paths has bytecode and category preservation
    expect(script).toContain(Op.OP_UTXOBYTECODE);
    expect(script).toContain(Op.OP_OUTPUTBYTECODE);
    expect(script).toContain(Op.OP_UTXOTOKENCATEGORY);
    expect(script).toContain(Op.OP_OUTPUTTOKENCATEGORY);
  });

  it('should contain commitment preservation opcodes for read-only path', () => {
    const script = buildDataNftCovenantScript(categoryId);
    // Read-only path should include OP_UTXOTOKENCOMMITMENT and OP_OUTPUTTOKENCOMMITMENT
    expect(script).toContain(Op.OP_UTXOTOKENCOMMITMENT);
    expect(script).toContain(Op.OP_OUTPUTTOKENCOMMITMENT);
  });

  it('should embed the category ID in the script', () => {
    const script = buildDataNftCovenantScript(categoryId);
    // The category ID should appear as a Uint8Array element in the script
    const found = script.some(
      (el) => el instanceof Uint8Array && el.length === 32 && el.every((b, i) => b === categoryId[i]),
    );
    expect(found).toBe(true);
  });

  it('should have destroy path (flag=2) that skips output preservation', () => {
    const script = buildDataNftCovenantScript(categoryId);
    // Outer OP_IF (flag=2 destroy path) should contain OP_DROP to discard the flag
    // and end before the common preservation section
    const outerIfIdx = script.indexOf(Op.OP_IF);
    const outerElseIdx = script.indexOf(Op.OP_ELSE);
    const destroyPath = script.slice(outerIfIdx + 1, outerElseIdx);

    // Destroy path: OP_DROP, verify master minting NFT, verify this input's category
    expect(destroyPath[0]).toBe(Op.OP_DROP);
    expect(destroyPath).toContain(Op.OP_UTXOTOKENCATEGORY);
    // Should NOT contain output preservation opcodes
    expect(destroyPath).not.toContain(Op.OP_OUTPUTBYTECODE);
    expect(destroyPath).not.toContain(Op.OP_OUTPUTTOKENCOMMITMENT);
  });

  it('should enforce exact satoshi preservation in common section (flag=0/1)', () => {
    const script = buildDataNftCovenantScript(categoryId);
    // The common section should contain UTXOVALUE and OUTPUTVALUE for exact satoshi check
    expect(script).toContain(Op.OP_UTXOVALUE);
    expect(script).toContain(Op.OP_OUTPUTVALUE);

    // Verify satoshi check is in the ELSE branch (flag=0/1), not in the IF branch (flag=2)
    const outerIfIdx = script.indexOf(Op.OP_IF);
    const outerElseIdx = script.indexOf(Op.OP_ELSE);
    const destroyPath = script.slice(outerIfIdx + 1, outerElseIdx);
    expect(destroyPath).not.toContain(Op.OP_UTXOVALUE);
    expect(destroyPath).not.toContain(Op.OP_OUTPUTVALUE);
  });
});

describe('buildEntryNftCovenantScript (dual-path)', () => {
  const categoryId = new Uint8Array(32).fill(0xab);
  const collectionHash = new Uint8Array(20).fill(0xcd);

  it('should produce valid script bytecode', () => {
    const script = buildEntryNftCovenantScript(categoryId, collectionHash);
    expect(script).toBeDefined();
    const bytecode = scriptToBytecode(script);
    expect(bytecode).toBeInstanceOf(Uint8Array);
    expect(bytecode.length).toBeGreaterThan(0);
  });

  it('should contain OP_IF for dual-path structure', () => {
    const script = buildEntryNftCovenantScript(categoryId, collectionHash);
    expect(script[0]).toBe(Op.OP_IF);
    expect(script).toContain(Op.OP_ELSE);
    expect(script).toContain(Op.OP_ENDIF);
  });

  it('should contain self-preservation in read-only path but not in write path', () => {
    const script = buildEntryNftCovenantScript(categoryId, collectionHash);
    const elseIdx = script.indexOf(Op.OP_ELSE);
    const endifIdx = script.indexOf(Op.OP_ENDIF);
    const readOnlyPath = script.slice(elseIdx + 1, endifIdx);
    // Read-only path should include self-preservation and commitment preservation
    expect(readOnlyPath).toContain(Op.OP_UTXOBYTECODE);
    expect(readOnlyPath).toContain(Op.OP_OUTPUTBYTECODE);
    expect(readOnlyPath).toContain(Op.OP_UTXOTOKENCOMMITMENT);
    expect(readOnlyPath).toContain(Op.OP_OUTPUTTOKENCOMMITMENT);
  });

  it('should embed collection hash after OP_ENDIF', () => {
    const script = buildEntryNftCovenantScript(categoryId, collectionHash);
    const endifIdx = script.indexOf(Op.OP_ENDIF);
    const afterEndif = script.slice(endifIdx + 1);
    const found = afterEndif.some(
      (el) => el instanceof Uint8Array && el.length === 20 && el.every((b, i) => b === collectionHash[i]),
    );
    expect(found).toBe(true);
  });

  it('should enforce exact satoshi preservation in read-only path', () => {
    const script = buildEntryNftCovenantScript(categoryId, collectionHash);
    const elseIdx = script.indexOf(Op.OP_ELSE);
    const endifIdx = script.indexOf(Op.OP_ENDIF);
    const readOnlyPath = script.slice(elseIdx + 1, endifIdx);
    // Read-only path should include exact satoshi preservation
    expect(readOnlyPath).toContain(Op.OP_UTXOVALUE);
    expect(readOnlyPath).toContain(Op.OP_OUTPUTVALUE);
  });

  it('should not enforce satoshi preservation in write path', () => {
    const script = buildEntryNftCovenantScript(categoryId, collectionHash);
    const ifIdx = 0; // OP_IF is at index 0
    const elseIdx = script.indexOf(Op.OP_ELSE);
    const writePath = script.slice(ifIdx + 1, elseIdx);
    // Write path should NOT include satoshi preservation opcodes
    expect(writePath).not.toContain(Op.OP_UTXOVALUE);
    expect(writePath).not.toContain(Op.OP_OUTPUTVALUE);
  });
});

describe('buildSatoshiContainerCovenantScript', () => {
  const categoryId = new Uint8Array(32).fill(0xab);

  it('should produce valid script bytecode', () => {
    const script = buildSatoshiContainerCovenantScript(categoryId);
    expect(script).toBeDefined();
    const bytecode = scriptToBytecode(script);
    expect(bytecode).toBeInstanceOf(Uint8Array);
    expect(bytecode.length).toBeGreaterThan(0);
  });

  it('should have dual-path structure (master + merge)', () => {
    const script = buildSatoshiContainerCovenantScript(categoryId);
    expect(script[0]).toBe(Op.OP_IF);
    expect(script).toContain(Op.OP_ELSE);
    expect(script).toContain(Op.OP_ENDIF);
  });

  it('should verify minting NFT in master path', () => {
    const script = buildSatoshiContainerCovenantScript(categoryId);
    const ifIdx = 0;
    const elseIdx = script.indexOf(Op.OP_ELSE);
    const masterPath = script.slice(ifIdx + 1, elseIdx);
    expect(masterPath).toContain(Op.OP_UTXOTOKENCATEGORY);
    expect(masterPath).toContain(Op.OP_2); // minting capability check
  });

  it('should preserve locking bytecode in merge path', () => {
    const script = buildSatoshiContainerCovenantScript(categoryId);
    const elseIdx = script.indexOf(Op.OP_ELSE);
    const endifIdx = script.indexOf(Op.OP_ENDIF);
    const mergePath = script.slice(elseIdx + 1, endifIdx);
    expect(mergePath).toContain(Op.OP_OUTPUTBYTECODE);
    expect(mergePath).toContain(Op.OP_UTXOBYTECODE);
  });

  it('should embed category ID as salt after OP_ENDIF', () => {
    const script = buildSatoshiContainerCovenantScript(categoryId);
    const endifIdx = script.indexOf(Op.OP_ENDIF);
    const afterEndif = script.slice(endifIdx + 1);
    const found = afterEndif.some(
      (el) => el instanceof Uint8Array && el.length === 32 && el.every((b, i) => b === categoryId[i]),
    );
    expect(found).toBe(true);
  });

  it('should end with OP_1 for script success', () => {
    const script = buildSatoshiContainerCovenantScript(categoryId);
    expect(script[script.length - 1]).toBe(Op.OP_1);
  });
});

// --- Nested struct encode/decode tests ---

describe('nested struct encode/decode roundtrip', () => {
  const structs: readonly StructDefinitionInfo[] = [
    { name: 'Inner', fields: [{ name: 'x', type: 'int' }, { name: 'y', type: 'int' }] },
    { name: 'Outer', fields: [{ name: 'inner', type: 'Inner' }, { name: 'z', type: 'int' }] },
  ];

  it('should encode and decode a flat struct', () => {
    const value = { x: 42n, y: 100n };
    const encoded = encodePushdataValue(value, 'Inner', structs);
    const { value: decoded, bytesConsumed } = decodePushdataValue(encoded, 0, 'Inner', structs);
    expect(decoded).toEqual({ x: 42n, y: 100n });
    expect(bytesConsumed).toBe(encoded.length);
  });

  it('should encode and decode a nested struct (2 levels)', () => {
    const value = { inner: { x: 5n, y: 10n }, z: 15n };
    const encoded = encodePushdataValue(value, 'Outer', structs);
    const { value: decoded, bytesConsumed } = decodePushdataValue(encoded, 0, 'Outer', structs);
    expect(decoded).toEqual({ inner: { x: 5n, y: 10n }, z: 15n });
    expect(bytesConsumed).toBe(encoded.length);
  });

  it('should roundtrip nested struct with zero values', () => {
    const value = { inner: { x: 0n, y: 0n }, z: 0n };
    const encoded = encodePushdataValue(value, 'Outer', structs);
    const { value: decoded } = decodePushdataValue(encoded, 0, 'Outer', structs);
    expect(decoded).toEqual({ inner: { x: 0n, y: 0n }, z: 0n });
  });

  it('should roundtrip nested struct with negative int', () => {
    const value = { inner: { x: -1n, y: 1000n }, z: -1n };
    const encoded = encodePushdataValue(value, 'Outer', structs);
    const { value: decoded } = decodePushdataValue(encoded, 0, 'Outer', structs);
    expect(decoded).toEqual({ inner: { x: -1n, y: 1000n }, z: -1n });
  });

  it('should return correct nested fields with proper types', () => {
    const value = { inner: { x: 7n, y: 8n }, z: 9n };
    const encoded = encodePushdataValue(value, 'Outer', structs);
    const { value: decoded } = decodePushdataValue(encoded, 0, 'Outer', structs);
    const outer = decoded as StateRecord;
    const inner = outer.inner as StateRecord;
    expect(inner.x).toBe(7n);
    expect(inner.y).toBe(8n);
    expect(outer.z).toBe(9n);
  });
});

describe('nested struct getDefaultStateValue', () => {
  const structs: readonly StructDefinitionInfo[] = [
    { name: 'Inner', fields: [{ name: 'x', type: 'int' }, { name: 'y', type: 'int' }] },
    { name: 'Outer', fields: [{ name: 'inner', type: 'Inner' }, { name: 'z', type: 'int' }] },
  ];

  it('should return nested default for flat struct', () => {
    const value = getDefaultStateValue('Inner', structs);
    expect(value).toEqual({ x: 0n, y: 0n });
  });

  it('should return nested default for nested struct', () => {
    const value = getDefaultStateValue('Outer', structs);
    expect(value).toEqual({ inner: { x: 0n, y: 0n }, z: 0n });
  });
});

describe('nested struct getMaxPushdataEncodedSize', () => {
  const structs: readonly StructDefinitionInfo[] = [
    { name: 'Inner', fields: [{ name: 'x', type: 'int' }, { name: 'y', type: 'int' }] },
    { name: 'Outer', fields: [{ name: 'inner', type: 'Inner' }, { name: 'z', type: 'int' }] },
  ];

  it('should compute size for flat struct', () => {
    // Inner: 2 ints = 258 + 258 = 516
    expect(getMaxPushdataEncodedSize('Inner', structs)).toBe(516);
  });

  it('should compute size for nested struct', () => {
    // Outer: Inner(516) + int(258) = 774
    expect(getMaxPushdataEncodedSize('Outer', structs)).toBe(774);
  });
});

describe('nested struct state commitment roundtrip', () => {
  const structs: readonly StructDefinitionInfo[] = [
    { name: 'Inner', fields: [{ name: 'x', type: 'int' }, { name: 'y', type: 'int' }] },
    { name: 'Outer', fields: [{ name: 'inner', type: 'Inner' }, { name: 'z', type: 'int' }] },
  ];

  const layout: StateLayout = {
    variables: [
      { name: 'data', type: 'Outer', nftIndex: 0, fieldIndex: 0 },
    ],
    dataNftCount: 1,
    commitmentLimit: 128,
    structs,
  };

  it('should build and parse commitment with nested struct state', () => {
    const values = { data: { inner: { x: 7n, y: 8n }, z: 9n } };
    const commitment = buildPushdataCommitment(layout, values, 0);
    const parsed = parsePushdataCommitment(commitment, layout, 0);
    expect(parsed.data).toEqual({ inner: { x: 7n, y: 8n }, z: 9n });
  });

  it('should use defaults for nested struct state', () => {
    const commitments = buildInitialStateCommitments(layout, {});
    const parsed = parsePushdataCommitment(commitments[0], layout, 0);
    expect(parsed.data).toEqual({ inner: { x: 0n, y: 0n }, z: 0n });
  });

  it('should handle mixed nested struct and primitive state variables', () => {
    const mixedLayout: StateLayout = {
      variables: [
        { name: 'count', type: 'int', nftIndex: 0, fieldIndex: 0 },
        { name: 'data', type: 'Outer', nftIndex: 1, fieldIndex: 0 },
      ],
      dataNftCount: 2,
      commitmentLimit: 128,
      structs,
    };

    const values = { count: 42n, data: { inner: { x: 1n, y: 2n }, z: 3n } };
    const commitment0 = buildPushdataCommitment(mixedLayout, values, 0);
    const commitment1 = buildPushdataCommitment(mixedLayout, values, 1);
    const parsed0 = parsePushdataCommitment(commitment0, mixedLayout, 0);
    const parsed1 = parsePushdataCommitment(commitment1, mixedLayout, 1);
    expect(parsed0.count).toBe(42n);
    expect(parsed1.data).toEqual({ inner: { x: 1n, y: 2n }, z: 3n });
  });
});
