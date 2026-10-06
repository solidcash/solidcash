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
