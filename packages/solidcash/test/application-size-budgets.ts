import { asmToBytecode, Artifact } from '@solidcash/utils';

/** Reviewed first-release locking-script ceilings, in serialized bytes. */
export const APPLICATION_SCRIPT_SIZE_BUDGETS = {
  erc20Like: 10_000,
  tokenIntegration: 10_000,
  ownershipAccess: 10_000,
  escrowTimelock: 10_000,
  proxyUpgrade: 10_000,
  mappingDynamicArray: 10_000,
  crossContract: 10_000,
  eventFacade: 10_000,
  customErrorBehavior: 10_000,
} as const;

export type ApplicationSizeScenario = keyof typeof APPLICATION_SCRIPT_SIZE_BUDGETS;

type Applicability = 'covered' | 'not-declared';

/** Event/custom-error applicability is explicit for every row; `not-declared` is a reviewed N/A, not missing coverage. */
export const APPLICATION_INTERFACE_PROFILES = {
  erc20Like: {
    events: 'covered', errors: 'covered', evidence: 'test/e2e/Erc20LikeApplication.test.ts',
  },
  tokenIntegration: {
    events: 'not-declared', errors: 'not-declared', evidence: 'test/e2e/SafeErc20ChainTargetPinning.test.ts',
  },
  ownershipAccess: {
    events: 'not-declared', errors: 'not-declared', evidence: 'test/e2e/CustomModifier.test.ts',
  },
  escrowTimelock: {
    events: 'not-declared', errors: 'not-declared', evidence: 'test/e2e/HodlVault.test.ts',
  },
  proxyUpgrade: {
    events: 'not-declared', errors: 'not-declared', evidence: 'test/e2e/Upgrade.test.ts',
  },
  mappingDynamicArray: {
    events: 'not-declared', errors: 'not-declared', evidence: 'test/e2e/IterableMappingPattern.test.ts',
  },
  crossContract: {
    events: 'not-declared', errors: 'not-declared', evidence: 'test/e2e/ExternalFunctionCalls.test.ts',
  },
  eventFacade: {
    events: 'covered', errors: 'not-declared', evidence: 'test/e2e/EventsFacade.test.ts',
  },
  customErrorBehavior: {
    events: 'not-declared', errors: 'covered', evidence: 'test/e2e/ErrorAssertRevert.test.ts',
  },
} as const satisfies Record<ApplicationSizeScenario, {
  events: Applicability;
  errors: Applicability;
  evidence: string;
}>;

export function assertApplicationScriptSize(
  scenario: ApplicationSizeScenario, ...artifacts: readonly Artifact[]
): number {
  const measured = Math.max(...artifacts.map((artifact) => asmToBytecode(artifact.bytecode).length));
  const budget = APPLICATION_SCRIPT_SIZE_BUDGETS[scenario];
  const profile = APPLICATION_INTERFACE_PROFILES[scenario];
  if (measured > budget) {
    throw new Error(`Application '${scenario}' locking script is ${measured} bytes (budget: ${budget}).`);
  }
  if (process.env.RELEASE_SIZE_REPORT === '1') {
    console.log(`application-size ${JSON.stringify({
      scenario, measuredBytes: measured, budgetBytes: budget, events: profile.events, errors: profile.errors,
    })}`);
  }
  return measured;
}
