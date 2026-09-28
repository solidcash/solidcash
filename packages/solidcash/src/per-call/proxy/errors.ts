/**
 * The refusal a per-call proxy deployment raises: a proxy that is not the shape the convention compiles, an
 * implementation whose declaration the generated proxy cannot mirror, or a pair whose records do not agree.
 */
export class PerCallProxyDeployError extends Error {
  public readonly name = 'PerCallProxyDeployError';

  public constructor(message: string) {
    super(message);
  }
}
