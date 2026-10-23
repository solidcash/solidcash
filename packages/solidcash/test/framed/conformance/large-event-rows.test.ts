import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { encodeEventCommitment } from '@solidcash/utils';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callFramedEntry } from '../../../src/framed/call/index.js';
import { compositionEventLogs } from '../../../src/framed/receipt/index.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { fundShippedFacets, hexOf, seededAddress } from '../shapes/harness.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';

/**
 * S0 conformance, spec section 23 row 13: events above 128 bytes, emitted by nested frames and asserted.
 *
 * The row names an event whose payload crosses the direct convention's 128-byte commitment size, emitted from a
 * nested frame. The compiler accepts the payload: five 32-byte fields encode to 160 bytes. The shipped call path
 * (`callFramedEntry`) plans the callee frame an entry's call reaches, and the row's caller calls an emitter at an
 * address no deployment holds, so the transaction cannot even be assembled for the row, and the refusal it meets
 * is pinned by name (a deployed emitting callee is served: `call/plain-callees.test.ts`). The control beside it
 * drives the identical >128-byte event through the same path emitted by the root frame itself, which settles, and
 * reads it back through the shipped receipt (`compositionEventLogs`): the size is not what the path refuses, the
 * address is.
 */

/** Five 32-byte fields, so the encoded event payload is 160 bytes, above the 128-byte direct commitment size. */
const BIG = 452312848583266388373324160190187140051835877600158453279131187530910662656n;
const FIELDS = [BIG, BIG, BIG, BIG, BIG];

/** A 32-byte outpoint hash whose bytes are not all the same, so a byte-order bug cannot hide in it. */
function outpointHash(seed: number): string {
  const bytes = new Uint8Array(32);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = (seed + index * 7) & 0xff;
  return binToHex(bytes);
}

/** The emitter's covenant address, embedded in the caller's source so its body calls that target. */
const EMITTER_ADDRESS = hexOf(seededAddress('large event emitter row 13'));

/** A unit whose caller reaches a callee, and the callee emits the >128-byte event; the caller also emits. */
const NESTED_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IEmitter { function publish() external; }'
  + ' contract Emitter {'
  + '   event Report(int a, int b, int c, int d, int e);'
  + '   int public sent;'
  + '   function publish() {'
  + '     this.sent = 1;'
  + `     emit Report(${FIELDS.join(', ')});`
  + '     require(true);'
  + '   }'
  + ' }'
  + ' contract Root {'
  + '   event Started(int x);'
  + '   int public step;'
  + '   function run() {'
  + '     this.step = 1;'
  + '     emit Started(1);'
  + `     IEmitter(0x${EMITTER_ADDRESS}).publish.call();`
  + '     require(true);'
  + '   }'
  + ' }';

/** The same >128-byte event emitted by a single contract's own root entry, with no nested frame. */
const ROOT_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Solo {'
  + '   event Report(int a, int b, int c, int d, int e);'
  + '   int public sent;'
  + '   function emitReport() {'
  + '     this.sent = 1;'
  + `     emit Report(${FIELDS.join(', ')});`
  + '     require(true);'
  + '   }'
  + '   function idle() { require(true); }'
  + ' }';

describe('spec section 23 row 13: events above 128 bytes from nested frames', () => {
  it('refuses the nested-frame entry by name, unable to plan the callee frame', async () => {
    const artifacts = compileStringMulti(
      NESTED_SOURCE, { composition: 'framed', evmCompat: true } as never,
    );
    const root = artifacts.Root!;
    const emitter = artifacts.Emitter!;

    // The payload the callee's own body would emit is above the 128-byte commitment size the compiler compiles to.
    const payload = encodeEventCommitment(emitter.events![0]!.parameters, FIELDS);
    expect(payload.length).toBeGreaterThan(128);

    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signature = new SignatureTemplate(alicePriv);
    const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const fundingUtxo = { txid: outpointHash(0x30), vout: 0, satoshis: 500_000n };
    await provider.addUtxo(funder.address, fundingUtxo);
    await fundShippedFacets(provider);

    const deployment = await deployStatefulContract(root, [], {
      provider, fundingUtxo, funder: funder.unlock.spend(alicePub, signature), changeAddress: funder.address,
    });

    const user = encodeLockingBytecodeP2pkh(alicePkh);
    const callerUtxo = { txid: outpointHash(0x51), vout: 0, satoshis: 300_000n };
    await provider.addUtxo(binToHex(user), callerUtxo);

    // The entry's one external call reaches an address no deployment holds, so the path refuses before assembling.
    await expect(callFramedEntry({
      provider,
      artifact: root,
      categoryId: deployment.categoryId,
      functionName: 'run',
      args: [],
      callerUtxo,
      callerLockingBytecode: user,
      funder: signature.unlockP2PKH(),
      vm: compositionMachine(),
    })).rejects.toThrow(
      new RegExp('entry "run" makes 1 external call\\(s\\): the call to "IEmitter\\.publish" targets [0-9a-f]{70}, '
        + 'and none of the deployment\'s contracts sits at that address'),
    );
  }, 120_000);

  it('serves and decodes the same payload emitted by the root frame, the control for the size', async () => {
    const artifact = compileStringMulti(
      ROOT_SOURCE, { composition: 'framed', evmCompat: true } as never,
    ).Solo!;

    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signature = new SignatureTemplate(alicePriv);
    const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const fundingUtxo = { txid: outpointHash(0x30), vout: 0, satoshis: 500_000n };
    await provider.addUtxo(funder.address, fundingUtxo);
    await fundShippedFacets(provider);

    const deployment = await deployStatefulContract(artifact, [], {
      provider, fundingUtxo, funder: funder.unlock.spend(alicePub, signature), changeAddress: funder.address,
    });

    const user = encodeLockingBytecodeP2pkh(alicePkh);
    const callerUtxo = { txid: outpointHash(0x51), vout: 0, satoshis: 300_000n };
    await provider.addUtxo(binToHex(user), callerUtxo);

    const answered = await callFramedEntry({
      provider,
      artifact,
      categoryId: deployment.categoryId,
      functionName: 'emitReport',
      args: [],
      callerUtxo,
      callerLockingBytecode: user,
      funder: signature.unlockP2PKH(),
      vm: compositionMachine(),
    });

    expect(answered.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.id}: ${verdict.objection ?? 'refused'}`)).toStrictEqual([]);
    expect(answered.accepted).toBe(true);

    const logs = compositionEventLogs(answered.draft, [artifact]);
    expect(logs).toHaveLength(1);
    expect(logs[0]!.eventName).toBe('Report');
    expect(logs[0]!.eventSignature).toBe(artifact.events![0]!.signature);
    expect(logs[0]!.values).toStrictEqual(FIELDS);
    expect(logs[0]!.args).toStrictEqual({ a: BIG, b: BIG, c: BIG, d: BIG, e: BIG });
    // The payload the shipped decoder read back is the same above-128-byte commitment the encoder computed.
    expect(logs[0]!.commitment.length).toBeGreaterThan(128);
    expect(logs[0]!.commitment).toStrictEqual(encodeEventCommitment(artifact.events![0]!.parameters, FIELDS));
  }, 120_000);
});
