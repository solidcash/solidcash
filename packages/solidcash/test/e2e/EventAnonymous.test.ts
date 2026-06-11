import { compileString } from 'solidc';
import {
  buildEventNftCovenantScript,
  buildAnonymousEventNftCovenantScript,
  computeEventNameHash,
} from '@solidcash/utils';
import { hexToBin } from '@bitauth/libauth';

const ANONYMOUS_EVENT_CONTRACT = `
contract EventAnonymous(pubkey owner) {
    event Transfer(pubkey indexed from, pubkey indexed to, int amount) anonymous;

    function transfer(pubkey to, int amount, sig s) {
        require(checkSig(s, owner));
        emit Transfer(owner, to, amount);
    }
}
`;

const NAMED_EVENT_CONTRACT = `
contract EventNamed(pubkey owner) {
    event Transfer(pubkey indexed from, pubkey indexed to, int amount);

    function transfer(pubkey to, int amount, sig s) {
        require(checkSig(s, owner));
        emit Transfer(owner, to, amount);
    }
}
`;

const MIXED_EVENT_CONTRACT = `
contract EventMixed(pubkey owner) {
    event Transfer(pubkey indexed from, pubkey indexed to, int amount);
    event Debug(int value) anonymous;
    event AdminAction(pubkey indexed admin, int action) anonymous;

    function transfer(pubkey to, int amount, sig s) {
        require(checkSig(s, owner));
        emit Transfer(owner, to, amount);
    }

    function debug(int value, sig s) {
        require(checkSig(s, owner));
        emit Debug(value);
    }

    function adminAction(int action, sig s) {
        require(checkSig(s, owner));
        emit AdminAction(owner, action);
    }
}
`;

describe('EventAnonymous', () => {
  describe('compilation', () => {
    it('should compile contract with anonymous event', () => {
      expect(() => compileString(ANONYMOUS_EVENT_CONTRACT)).not.toThrow();
    });

    it('should compile contract with mixed named and anonymous events', () => {
      expect(() => compileString(MIXED_EVENT_CONTRACT)).not.toThrow();
    });
  });

  describe('artifact', () => {
    it('should include anonymous: true in artifact for anonymous events', () => {
      const artifact = compileString(ANONYMOUS_EVENT_CONTRACT);
      expect(artifact.events).toBeDefined();
      expect(artifact.events!.length).toBe(1);
      expect(artifact.events![0].anonymous).toBe(true);
      expect(artifact.events![0].name).toBe('Transfer');
    });

    it('should not include anonymous field for named events', () => {
      const artifact = compileString(NAMED_EVENT_CONTRACT);
      expect(artifact.events).toBeDefined();
      expect(artifact.events![0].anonymous).toBeUndefined();
    });

    it('should correctly mark mixed events', () => {
      const artifact = compileString(MIXED_EVENT_CONTRACT);
      expect(artifact.events).toBeDefined();
      expect(artifact.events!.length).toBe(3);

      const transfer = artifact.events!.find((e) => e.name === 'Transfer');
      const debug = artifact.events!.find((e) => e.name === 'Debug');
      const adminAction = artifact.events!.find((e) => e.name === 'AdminAction');

      expect(transfer?.anonymous).toBeUndefined();
      expect(debug?.anonymous).toBe(true);
      expect(adminAction?.anonymous).toBe(true);
    });

    it('anonymous modifier should preserve indexed modifiers', () => {
      const artifact = compileString(ANONYMOUS_EVENT_CONTRACT);
      const event = artifact.events![0];
      expect(event.parameters[0].indexed).toBe(true); // from
      expect(event.parameters[1].indexed).toBe(true); // to
      expect(event.parameters[2].indexed).toBeUndefined(); // amount
    });
  });

  describe('bytecode', () => {
    it('anonymous events should produce different bytecode than named events', () => {
      const anonymous = compileString(ANONYMOUS_EVENT_CONTRACT);
      const named = compileString(NAMED_EVENT_CONTRACT);

      // The bytecode should differ because anonymous events use a shorter
      // covenant script (no eventNameHash embedding)
      expect(anonymous.bytecode).not.toBe(named.bytecode);
    });

    it('anonymous event should produce shorter bytecode', () => {
      const anonymous = compileString(ANONYMOUS_EVENT_CONTRACT);
      const named = compileString(NAMED_EVENT_CONTRACT);

      // Anonymous event covenant is 22 bytes shorter (no 0x14 + 20-byte hash + 0x75)
      expect(anonymous.bytecode.length).toBeLessThan(named.bytecode.length);
    });
  });

  describe('covenant script', () => {
    it('anonymous covenant script should be shorter than named', () => {
      const categoryId = hexToBin('0000000000000000000000000000000000000000000000000000000000000001');
      const eventNameHash = computeEventNameHash('Transfer(pubkey,pubkey,int)');

      const namedScript = buildEventNftCovenantScript(categoryId, eventNameHash);
      const anonymousScript = buildAnonymousEventNftCovenantScript(categoryId);

      // Convert to bytecode to compare sizes
      // Anonymous script should not contain the eventNameHash or OP_DROP for it
      expect(anonymousScript.length).toBeLessThan(namedScript.length);
    });

    it('all anonymous events from same contract should share one address', () => {
      const categoryId = hexToBin('0000000000000000000000000000000000000000000000000000000000000001');

      // Anonymous script doesn't take eventNameHash, so it's always the same
      const script1 = buildAnonymousEventNftCovenantScript(categoryId);
      const script2 = buildAnonymousEventNftCovenantScript(categoryId);

      // Same categoryId should produce identical scripts
      expect(script1).toEqual(script2);
    });

    it('named events with different signatures should produce different addresses', () => {
      const categoryId = hexToBin('0000000000000000000000000000000000000000000000000000000000000001');
      const hash1 = computeEventNameHash('Transfer(pubkey,pubkey,int)');
      const hash2 = computeEventNameHash('Approval(pubkey,pubkey,int)');

      const script1 = buildEventNftCovenantScript(categoryId, hash1);
      const script2 = buildEventNftCovenantScript(categoryId, hash2);

      expect(script1).not.toEqual(script2);
    });
  });
});
