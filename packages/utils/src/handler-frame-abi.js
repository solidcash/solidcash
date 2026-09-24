/**
 * Typed handler-frame ABI for DEFINE'd message-bus handlers (backlog item 3).
 *
 * Frame layout (bottom → top at entry after caller band seeding):
 *   arguments | route context | journals | cursors | results
 *
 * Helpers declare stack-effect signatures; validateHandlerFrame proves entry/exit
 * shape agreement and rejects live anonymous / untracked cells at settlement.
 */
export function buildHandlerFrameSchema(params) {
    const slots = [
        ...params.arguments.map((name) => ({ name, kind: 'argument' })),
        ...(params.routeContext ?? []).map((name) => ({ name, kind: 'routeContext' })),
        ...(params.journals ?? []).map((name) => ({ name, kind: 'journal' })),
        ...(params.cursors ?? []).map((name) => ({ name, kind: 'cursor' })),
        ...(params.results ?? []).map((name) => ({ name, kind: 'result' })),
    ];
    return {
        handlerId: params.handlerId,
        handlerName: params.handlerName,
        slots,
    };
}
/**
 * Symbolically apply stack-effect signatures against a frame schema.
 * Fails closed on unknown slot reads/writes, leftover anonymous cells, or alt-stack imbalance.
 */
export function validateHandlerFrame(schema, effects) {
    const known = new Set(schema.slots.map((slot) => slot.name));
    const failures = [];
    let anonymousLive = 0;
    let altStackDepth = 0;
    for (const effect of effects) {
        for (const name of effect.reads ?? []) {
            if (!known.has(name)) {
                failures.push({
                    invariantId: 'unknown-frame-read',
                    detail: `helper ${effect.helperId} reads unknown slot`,
                    slot: name,
                });
            }
        }
        for (const name of effect.writes ?? []) {
            if (!known.has(name)) {
                failures.push({
                    invariantId: 'unknown-frame-write',
                    detail: `helper ${effect.helperId} writes unknown slot`,
                    slot: name,
                });
            }
        }
        anonymousLive += effect.anonymousPushes ?? 0;
        anonymousLive -= effect.anonymousPops ?? 0;
        if (anonymousLive < 0) {
            failures.push({
                invariantId: 'anonymous-underflow',
                detail: `helper ${effect.helperId} popped more anonymous cells than live`,
            });
            anonymousLive = 0;
        }
        altStackDepth += effect.altStackDelta ?? 0;
        if (altStackDepth < 0) {
            failures.push({
                invariantId: 'alt-stack-underflow',
                detail: `helper ${effect.helperId} unbalanced alt-stack`,
            });
            altStackDepth = 0;
        }
    }
    if (anonymousLive !== 0) {
        failures.push({
            invariantId: 'live-anonymous-at-settlement',
            detail: `settlement leaves ${anonymousLive} anonymous cell(s); top/bottom bookkeeping drift`,
        });
    }
    if (altStackDepth !== 0) {
        failures.push({
            invariantId: 'alt-stack-imbalance',
            detail: `settlement alt-stack depth ${altStackDepth}`,
        });
    }
    return {
        ok: failures.length === 0,
        failures,
        anonymousLive,
        altStackDepth,
    };
}
//# sourceMappingURL=handler-frame-abi.js.map