/**
 * Shared MongoDB driver options (Atlas on Windows often needs IPv4 + longer timeouts).
 */
const MONGOOSE_CONNECT_OPTIONS = {
  serverSelectionTimeoutMS: 60_000,
  connectTimeoutMS: 60_000,
  socketTimeoutMS: 60_000,
  heartbeatFrequencyMS: 10_000,
  maxPoolSize: 10,
  minPoolSize: 1,
  /** Prefer IPv4 — Windows IPv6 routes to Atlas often cause ETIMEDOUT / ResetPool. */
  family: 4,
  retryWrites: true,
  retryReads: true,
};

module.exports = { MONGOOSE_CONNECT_OPTIONS };
