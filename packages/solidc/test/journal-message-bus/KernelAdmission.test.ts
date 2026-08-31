import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const KERNEL = { forceStateful: true, messageBus: true, messageBusKernel: true } as const;

const denied = (source: string, name: string): NonNullable<
  ReturnType<typeof compileString>['messageBus']
>['handlers'][number] => {
  const artifact = compileString(source, KERNEL);
  const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === name);
  expect(handler, `missing handler ${name}`).toBeDefined();
  return handler!;
};

describe('required kernel admission', () => {
  it('refuses lifecycle handlers as KERNEL_LIFECYCLE', () => {
    expect(denied(`contract C() {
      int value;
      function denied() selfdestruct { require(true); }
      function control() public { require(true); }
    }`, 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_LIFECYCLE',
    });
  });

  it('refuses a transaction signature row as KERNEL_TX_SIGNATURE', () => {
    expect(denied(`contract C() {
      function denied(sig s) public { require(true); }
      function control() public { require(true); }
    }`, 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_TX_SIGNATURE',
    });
  });

  it('refuses a counter-keyed mapping loop as KERNEL_UNBOUNDED_KEY', () => {
    expect(denied(`contract C() {
      mapping(int => int) slots;
      function denied(int n) public {
        for (int i = 0; i < n; i = i + 1) { slots[i] = 1; }
        require(true);
      }
      function control() public { require(true); }
    }`, 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_UNBOUNDED_KEY',
    });
  });

  it('admits an expression-keyed mapping write', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) slots;
      int next;
      function push(int n) public {
        this.slots[this.next] = n;
        this.next = this.next + 1;
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'push')).toMatchObject({
      eligible: true,
    });
  });

  it('admits a literal local key array that unrolls to an expression-keyed write', () => {
    const artifact = compileString(`contract C() {
      mapping(int => mapping(bytes20 => int)) seen;
      bytes20 worker;
      function refund(int id) public {
        bytes20[] xs = new bytes20[](1);
        xs[0] = this.worker;
        for (int i = 0; i < xs.length; i = i + 1) {
          this.seen[id][xs[i]] = 0;
        }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'refund')).toMatchObject({
      eligible: true,
    });
  });

  it('admits an expression-keyed parameter-array mapping loop', () => {
    const artifact = compileString(`contract C() {
      mapping(int => mapping(bytes20 => int)) seen;
      int[] jobs;
      function create(bytes20[] workers) public {
        this.jobs.push(0);
        int id = this.jobs.length - 1;
        for (int i = 0; i < int(workers.length); i = i + 1) {
          this.seen[id][workers[i]] = 1;
        }
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'create')).toMatchObject({
      eligible: true,
    });
  });

  it('refuses foreign delegatecall as KERNEL_FOREIGN_DELEGATE', () => {
    expect(denied(`contract C(address impl) {
      function denied(bytes input) public {
        impl.delegatecall(input);
        require(true);
      }
      function control() public { require(true); }
    }`, 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_FOREIGN_DELEGATE',
    });
  });

  it('refuses opaque assembly effects as KERNEL_OPAQUE_EFFECT', () => {
    expect(denied(`pragma solidcash >=0.8.0;
      contract C() {
        function denied() public { assembly { OP_1 OP_DROP } require(true); }
        function control() public { require(true); }
      }`, 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_OPAQUE_EFFECT',
    });
  });

  it('refuses a deploy-in-handler as KERNEL_LAYOUT', () => {
    expect(denied(`contract Child() { }
      contract C() {
        function denied() public { Child child = new Child(); require(true); }
        function control() public { require(true); }
      }`, 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_LAYOUT',
    });
  });

  it('leaves legacy reasons on non-kernel compiles', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract C() {
        function opaque() public { assembly { OP_1 OP_DROP } require(true); }
        function control() public { require(true); }
      }`, { forceStateful: true, messageBus: true });
    expect(artifact.messageBus!.handlers.find((handler) => handler.name === 'opaque')).toMatchObject({
      eligible: false,
      rejectionReason: 'opaque-assembly-effects-callManifest-ineligible',
    });
  });
});
