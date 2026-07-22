/* eslint-disable */
import '@solidcash/testing/hre';

declare module '@solidcash/testing/hre' {
  interface SolidcashArtifactMap {
    'IERC20Errors': typeof import('../artifacts/solidcash/contracts-scash/CompatibilityInterfaces.scash/IERC20Errors.artifact.js').default;
    'MarketplaceDataV1': typeof import('../artifacts/solidcash/contracts-scash/MarketplaceDataV1.scash/MarketplaceDataV1.artifact.js').default;
    'MarketplaceV1': typeof import('../artifacts/solidcash/contracts-scash/MarketplaceV1.scash/MarketplaceV1.artifact.js').default;
    'OwnableUpgradeable': typeof import('../artifacts/solidcash/contracts-scash/CompatibilityInterfaces.scash/OwnableUpgradeable.artifact.js').default;
    'Initializable': typeof import('../artifacts/solidcash/contracts-scash/CompatibilityInterfaces.scash/Initializable.artifact.js').default;
    'ECDSA': typeof import('../artifacts/solidcash/contracts-scash/CompatibilityInterfaces.scash/ECDSA.artifact.js').default;
    'FakeToken': typeof import('../artifacts/solidcash/contracts-scash/FakeToken.scash/FakeToken.artifact.js').default;
    'Unicrow': typeof import('../artifacts/solidcash/contracts-scash/Unicrow.scash/Unicrow.artifact.js').default;
    'UnicrowArbitrator': typeof import('../artifacts/solidcash/contracts-scash/UnicrowArbitrator.scash/UnicrowArbitrator.artifact.js').default;
    'UnicrowClaim': typeof import('../artifacts/solidcash/contracts-scash/UnicrowClaim.scash/UnicrowClaim.artifact.js').default;
    'UnicrowDispute': typeof import('../artifacts/solidcash/contracts-scash/UnicrowDispute.scash/UnicrowDispute.artifact.js').default;
  }
}

export {};
