/**
 * JWT Bearer authentication. Populates `req.user` when valid.
 * @see ../middleware/auth.js — single implementation; this module exposes the name `authMiddleware`.
 */
const { authenticate } = require("./auth");

module.exports = { authMiddleware: authenticate };
