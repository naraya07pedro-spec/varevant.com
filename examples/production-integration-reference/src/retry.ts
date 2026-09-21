export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function isRetryable(error: unknown): boolean {
  if (error instanceof HttpError) {
    return error.status === 408 || error.status === 429 || error.status >= 500;
  }

  return error instanceof TypeError;
}

export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelayMs?: number;
    sleep?: (ms: number) => Promise<void>;
    random?: () => number;
  } = {},
): Promise<T> {
  const maxAttempts = Math.min(Math.max(options.maxAttempts ?? 3, 1), 5);
  const baseDelayMs = Math.max(options.baseDelayMs ?? 150, 0);
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const random = options.random ?? Math.random;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;

      if (!isRetryable(error) || attempt === maxAttempts) {
        throw error;
      }

      const exponential = baseDelayMs * 2 ** (attempt - 1);
      const jitter = Math.floor(exponential * 0.25 * random());
      await sleep(exponential + jitter);
    }
  }

  throw lastError;
}
