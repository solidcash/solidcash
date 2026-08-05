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

export function assertApplicationScriptSize(
  scenario: ApplicationSizeScenario, ...artifacts: readonly Artifact[]
): number {
  const measured = Math.max(...artifacts.map((artifact) => asmToBytecode(artifact.bytecode).length));
  const budget = APPLICATION_SCRIPT_SIZE_BUDGETS[scenario];
  if (measured > budget) {
    throw new Error(`Application '${scenario}' locking script is ${measured} bytes (budget: ${budget}).`);
  }
  if (process.env.RELEASE_SIZE_REPORT === '1') {
    console.log(`application-size ${JSON.stringify({ scenario, measuredBytes: measured, budgetBytes: budget })}`);
  }
  return measured;
}
