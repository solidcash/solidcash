/**
 * The refusal a framed proxy deployment raises: a proxy that is not the shape the convention compiles, an
 * implementation whose declaration the generated proxy cannot mirror, or a pair whose records do not agree.
 */
export class FramedProxyDeployError extends Error {
  public readonly name = 'FramedProxyDeployError';

  /**
   * `errorArgs` are the values the refusing frame's custom error was raised with, when the refusal report could
   * read them, as a Solidity-style matcher reads them (`revertedWithCustomError(...).withArgs(...)`).
   */
  public constructor(message: string, public readonly errorArgs?: readonly unknown[]) {
    super(message);
  }
}

/**
 * A low-level call the planner cannot place because its callee has no body to run for it: the EVM's call fails there,
 * returning `false` to the caller, whose own check over its success refuses with `failedCallMessage`.
 */
export class FramedFailedCallSite extends FramedProxyDeployError {
  public constructor(message: string, public readonly failedCallMessage: string) {
    super(message);
  }
}
