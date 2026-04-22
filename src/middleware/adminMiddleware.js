/**
 * Requires `req.user.role === "admin"`. Use after `authMiddleware`.
 * @see ./requireAdmin.js — single implementation; this module exposes the name `adminMiddleware`.
 */
const { requireAdmin } = require("./requireAdmin");

module.exports = { adminMiddleware: requireAdmin };
