const jwt = require("jsonwebtoken");
const authService = require("../services/auth.service");
const { JWT_SECRET } = require("../config");

async function authenticate(req, res, next) {
  if (!JWT_SECRET) {
    return res.status(500).json({ error: "JWT_SECRET is not configured" });
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (await authService.isTokenRevoked(token)) {
      return res.status(401).json({ error: "Token has been revoked" });
    }
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role ?? "guest",
    };
    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    next(err);
  }
}

module.exports = { authenticate };
