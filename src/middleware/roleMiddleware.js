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

/** Read-only housekeeping context for front desk (recent cleaning queue). */
function requireHousekeepingFrontdeskOrAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const role = req.user.role;
  if (role === "admin" || role === "housekeeping" || role === "frontdesk") {
    return next();
  }
  return res.status(403).json({ error: "Front desk, housekeeping, or admin access required" });
}

/** Billing ledgers: list + detail for cashier, front desk, and admin. */
function requireBillingStaff(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const role = req.user.role;
  if (role === "admin" || role === "frontdesk" || role === "cashier") {
    return next();
  }
  return res.status(403).json({ error: "Cashier, front desk, or admin access required" });
}

/** Record payments: cashier or admin only (front desk is read-only on payments). */
function requireCashierOrAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const role = req.user.role;
  if (role === "admin" || role === "cashier") {
    return next();
  }
  return res.status(403).json({ error: "Cashier or admin access required" });
}

/** Routes intended only for end-user guest accounts (e.g. own billing summary). */
function requireGuestRole(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (req.user.role === "guest") {
    return next();
  }
  return res.status(403).json({ error: "Guest role required" });
}

module.exports = {
  requireFrontdeskOrAdmin,
  requireHousekeepingOrAdmin,
  requireHousekeepingFrontdeskOrAdmin,
  requireBillingStaff,
  requireCashierOrAdmin,
  requireGuestRole,
};
