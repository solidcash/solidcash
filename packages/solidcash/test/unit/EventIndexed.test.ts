import { compileString } from '../direct-compile.js';

const EVENT_INDEXED_CONTRACT = `
contract EventIndexed(pubkey owner) {
    event Transfer(pubkey indexed from, pubkey indexed to, int amount);

    function transfer(pubkey to, int amount, sig s) {
        require(checkSig(s, owner));
        emit Transfer(owner, to, amount);
    }
}
`;

const EVENT_NO_INDEXED_CONTRACT = `
contract EventIndexed(pubkey owner) {
    event Transfer(pubkey from, pubkey to, int amount);

    function transfer(pubkey to, int amount, sig s) {
        require(checkSig(s, owner));
        emit Transfer(owner, to, amount);
    }
}
`;

describe('EventIndexed', () => {
  describe('artifact', () => {
    it('should compile with indexed event parameters', () => {
      expect(() => compileString(EVENT_INDEXED_CONTRACT)).not.toThrow();
    });

    it('indexed modifier should not affect the ABI', () => {
      const withIndexed = compileString(EVENT_INDEXED_CONTRACT);
      const withoutIndexed = compileString(EVENT_NO_INDEXED_CONTRACT);

      expect(withIndexed.abi).toEqual(withoutIndexed.abi);
    });

    it('indexed modifier should not affect the compiled bytecode', () => {
      const withIndexed = compileString(EVENT_INDEXED_CONTRACT);
      const withoutIndexed = compileString(EVENT_NO_INDEXED_CONTRACT);

      expect(withIndexed.bytecode).toBe(withoutIndexed.bytecode);
    });

    it('should support indexed on some but not all event parameters', () => {
      const mixedContract = `
        contract Mixed(pubkey owner) {
            event Transfer(pubkey indexed from, pubkey to, int indexed amount);

            function transfer(pubkey to, int amount, sig s) {
                require(checkSig(s, owner));
                emit Transfer(owner, to, amount);
            }
        }
      `;

      expect(() => compileString(mixedContract)).not.toThrow();

      const mixed = compileString(mixedContract);
      const withoutIndexed = compileString(EVENT_NO_INDEXED_CONTRACT);
      expect(mixed.bytecode).toBe(withoutIndexed.bytecode);
    });

    it('should support indexed with multiple events', () => {
      const multiEvent = `
        contract MultiEvent(pubkey owner) {
            event Transfer(pubkey indexed from, pubkey indexed to, int amount);
            event Approval(pubkey indexed owner, pubkey indexed spender, int amount);

            function transfer(pubkey to, int amount, sig s) {
                require(checkSig(s, owner));
                emit Transfer(owner, to, amount);
            }
        }
      `;

      expect(() => compileString(multiEvent)).not.toThrow();
    });
  });
});
