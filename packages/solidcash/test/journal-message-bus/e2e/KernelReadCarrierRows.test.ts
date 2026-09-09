import { describe, it } from 'vitest';

/**
 * Activation fixture for the compiler-published `internal-read-carrier` capability.
 *
 * Keep this test intentionally skipped until GTT publishes the capability and recognizes its internally-produced
 * 0x11 marker. Current bytecode cannot accept a second non-authenticated read, so enabling it early would turn a
 * meaningful protocol precondition into a misleading SDK failure.
 */
describe('kernel repeated clean-read carriers', () => {
  it.skip('activates with compiler internal-read-carrier capability', async () => {
    /*
      contract RepeatedCleanRead() {
        mapping(int => int) source;
        mapping(int => int) target;
        function seed(int key, int value) public { this.source[key] = value; require(true); }
        function copy(int count) public {
          for (int i = 0; i < count; i = i + 1) this.target[i] = this.source[i];
          require(true);
        }
        function check(int key, int value) public { require(this.target[key] == value); }
      }

      Required proof once enabled:
      1. Seed source[1] before source[0], then batch copy(2), copy(2).
      2. Assert all BCH VM inputs succeed and target[0/1] equal 10/11 after send.
      3. Forge a 0x11 header in caller-provided journal records: route must reject it at ingress.
      4. Reorder the second row's compact accesses/global ordinals: route must reject it.
      5. Duplicate the first row's authentication flag: route must reject duplicate physical authority.

      The marker is an internal route transition, never a caller witness. This fixture deliberately uses only
      fixed-width scalars and two equal public rows, so the behavior is a flow/topology property, not a contract
      naming convention.
    */
  });
});
