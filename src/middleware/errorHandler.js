module.exports = function errorHandler(err, _req, res, _next) {
  console.error(err);
  const status = Number(err.status) || 500;
  const isDev = process.env.NODE_ENV !== "production";
  const message =
    status === 500
      ? isDev && err.message
        ? err.message
        : "Internal server error"
      : err.message || "Error";
  const payload = { error: message };
  if (isDev && status === 500 && err.stack) {
    payload.detail = err.stack.split("\n").slice(0, 8).join("\n");
  }
  res.status(status).json(payload);
};
