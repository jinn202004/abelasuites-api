/**
 * Role guards for staff APIs. Use after `authenticate` / `authMiddleware`.
 */

function requireFrontdeskOrAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const role = req.user.role;
  if (role === "admin" || role === "frontdesk") {
    return next();
  }
  return res.status(403).json({ error: "Front desk or admin access required" });
}

function requireHousekeepingOrAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const role = req.user.role;
  if (role === "admin" || role === "housekeeping") {
    return next();
  }
  return res.status(403).json({ error: "Housekeeping or admin access required" });
}

module.exports = { requireFrontdeskOrAdmin, requireHousekeepingOrAdmin };
