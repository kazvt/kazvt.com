const DEFAULT_DELAYS_MS = [300, 800];

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

/** Retry a bounded, read-only operation after short-lived fetch or publication failures. */
export async function retryRead(operation, { delays = DEFAULT_DELAYS_MS, waitImpl = wait } = {}) {
  if (typeof operation !== "function") throw new TypeError("A read operation is required.");
  if (!Array.isArray(delays) || delays.some(delay => !Number.isFinite(delay) || delay < 0)) {
    throw new TypeError("Retry delays must be non-negative numbers.");
  }
  if (typeof waitImpl !== "function") throw new TypeError("A retry wait function is required.");

  let lastError;
  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (attempt === delays.length) break;
      await waitImpl(delays[attempt]);
    }
  }
  throw lastError;
}
