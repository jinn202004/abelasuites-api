const TRANSIENT_MONGO =
  /ResetPool|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|ReplicaSetNoPrimary|MongoNetworkError|MongoServerSelectionError|connection.*closed|pool.*cleared/i;

function isTransientMongoError(err) {
  if (!err) return false;
  const parts = [err.message, err.cause?.message, err.reason?.type]
    .filter(Boolean)
    .join(" ");
  if (TRANSIENT_MONGO.test(parts)) return true;
  if (err.errorLabelSet && typeof err.errorLabelSet.has === "function") {
    if (err.errorLabelSet.has("ResetPool") || err.errorLabelSet.has("RetryableWriteError")) {
      return true;
    }
  }
  return false;
}

/**
 * Retry a MongoDB operation when Atlas/local network blips (ResetPool, ETIMEDOUT, etc.).
 */
async function withMongoRetry(fn, { attempts = 3, baseDelayMs = 1500 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransientMongoError(err) || i === attempts - 1) throw err;
      const wait = baseDelayMs * (i + 1);
      console.warn(`[mongo] transient error, retry ${i + 1}/${attempts - 1} in ${wait}ms:`, err.message);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

module.exports = { isTransientMongoError, withMongoRetry };
