/* eslint-disable */
import '@solidcash/testing/hre';

declare module '@solidcash/testing/hre' {
  interface SolidcashArtifactMap {
    'EACCToken': typeof import('../artifacts/solidcash/EACCToken.artifact.js').default;
    'IMulticall3': typeof import('../artifacts/solidcash/IMulticall3.artifact.js').default;
    'MarketplaceDataV1': typeof import('../artifacts/solidcash/MarketplaceDataV1.artifact.js').default;
    'MarketplaceV1': typeof import('../artifacts/solidcash/MarketplaceV1.artifact.js').default;
    'MarketplaceV2': typeof import('../artifacts/solidcash/MarketplaceV2.artifact.js').default;
    'MarketplaceV3': typeof import('../artifacts/solidcash/MarketplaceV3.artifact.js').default;
    'MockSablierLockup': typeof import('../artifacts/solidcash/MockSablierLockup.artifact.js').default;
    'TreasurySplit': typeof import('../artifacts/solidcash/TreasurySplit.artifact.js').default;
    'FakeToken': typeof import('../artifacts/solidcash/FakeToken.artifact.js').default;
    'IUnicrow': typeof import('../artifacts/solidcash/IUnicrow.artifact.js').default;
    'IUnicrowClaim': typeof import('../artifacts/solidcash/IUnicrowClaim.artifact.js').default;
    'IUnicrowClaimRewards': typeof import('../artifacts/solidcash/IUnicrowClaimRewards.artifact.js').default;
    'IUnicrowDispute': typeof import('../artifacts/solidcash/IUnicrowDispute.artifact.js').default;
    'IUnicrowStakingRewards': typeof import('../artifacts/solidcash/IUnicrowStakingRewards.artifact.js').default;
    'Unicrow': typeof import('../artifacts/solidcash/Unicrow.artifact.js').default;
    'UnicrowArbitrator': typeof import('../artifacts/solidcash/UnicrowArbitrator.artifact.js').default;
    'UnicrowClaim': typeof import('../artifacts/solidcash/UnicrowClaim.artifact.js').default;
    'IUnicrowArbitrator': typeof import('../artifacts/solidcash/IUnicrowArbitrator.artifact.js').default;
    'UnicrowDispute': typeof import('../artifacts/solidcash/UnicrowDispute.artifact.js').default;
  }
}

export {};
