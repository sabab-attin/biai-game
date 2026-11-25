const buckets = new Map();

function prune(now) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function consumeRateLimit(key, { max, windowMs }) {
  const now = Date.now();
  if (buckets.size > 5000) prune(now);

  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;

  return {
    allowed: bucket.count <= max,
    remaining: Math.max(0, max - bucket.count),
    retryAfterMs: Math.max(0, bucket.resetAt - now),
  };
}

export function resetRateLimit(key) {
  buckets.delete(key);
}
