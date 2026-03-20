module.exports = function errorHandler(err, _req, res, _next) {
  console.error(err);
  const status = Number(err.status) || 500;
  const message =
    status === 500 ? "Internal server error" : err.message || "Error";
  res.status(status).json({ error: message });
};
