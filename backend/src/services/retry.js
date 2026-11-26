function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry(
  operation,
  { attempts = 3, baseDelayMs = 100, maxDelayMs = 2000, label = 'operation', logger = console } = {}
) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      logger.error(`[retry] ${label} attempt ${attempt}/${attempts} failed: ${error.message}`);
      if (attempt < attempts) {
        const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
        const jitter = Math.floor(Math.random() * Math.max(1, delay * 0.2));
        await sleep(delay + jitter);
      }
    }
  }

  throw lastError;
}
