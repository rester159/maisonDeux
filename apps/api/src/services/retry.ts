export type RetryOptions = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function calculateDelay(attempt: number, options: RetryOptions): number {
  const exponential = options.baseDelayMs * 2 ** (attempt - 1);
  const jitter = Math.floor(Math.random() * Math.min(250, options.baseDelayMs));
  return Math.min(options.maxDelayMs, exponential + jitter);
}

export async function withRetry<T>(
  task: () => Promise<T>,
  options: RetryOptions,
  shouldRetry: (error: unknown) => boolean
): Promise<T> {
  let attempt = 1;
  let lastError: unknown;
  while (attempt <= options.maxAttempts) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt >= options.maxAttempts || !shouldRetry(error)) break;
      await sleep(calculateDelay(attempt, options));
      attempt += 1;
    }
  }
  throw lastError;
}
