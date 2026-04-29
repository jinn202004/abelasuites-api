const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const RevokedToken = require("../models/RevokedToken");
const { JWT_SECRET, JWT_EXPIRES_IN } = require("../config");

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken, "utf8").digest("hex");
}

function normalizeEmail(email) {
  return String(email).toLowerCase().trim();
}

function trimName(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function trimPhone(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function publicUser(user) {
  const fn = user.firstName ?? "";
  const ln = user.lastName ?? "";
  const combined = [fn, ln].filter(Boolean).join(" ").trim();
  const name = String(user.name ?? "").trim() || combined;
  return {
    id: user._id,
    name,
    email: user.email,
    firstName: fn,
    lastName: ln,
    phone: user.phone ?? "",
    department: user.department ?? "",
    staffStatus: user.staffStatus ?? "Active",
    role: user.role ?? "guest",
  };
}

const STAFF_LOGIN_ROLES = new Set(["admin", "cashier", "frontdesk", "housekeeping"]);

async function register(email, password, { firstName, lastName, phone } = {}) {
  const normalized = normalizeEmail(email);
  const existing = await User.findOne({ email: normalized }).select("_id").lean();
  if (existing) {
    const err = new Error(
      `An account with "${normalized}" already exists. Sign in instead, or use a different email.`,
    );
    err.status = 409;
    err.code = "EMAIL_EXISTS";
    throw err;
  }

  const fn = trimName(firstName);
  const ln = trimName(lastName);
  const displayName = [fn, ln].filter(Boolean).join(" ").trim();
  const user = await User.create({
    email: normalized,
    username: normalized,
    passwordHash: await User.hashPassword(password),
    name: displayName,
    firstName: fn,
    lastName: ln,
    phone: trimPhone(phone),
    role: "guest",
  });
  return publicUser(user);
}

async function login(email, password) {
  if (!JWT_SECRET) {
    throw Object.assign(new Error("JWT_SECRET is not configured"), { status: 500 });
  }

  const normalized = normalizeEmail(email);
  const user = await User.findOne({ email: normalized }).select("+passwordHash");
  if (!user) {
    const err = new Error("Invalid email or password");
    err.status = 401;
    throw err;
  }

  const match = await user.comparePassword(password);
  if (!match) {
    const err = new Error("Invalid email or password");
    err.status = 401;
    throw err;
  }

  if (STAFF_LOGIN_ROLES.has(user.role) && String(user.staffStatus || "Active") === "Inactive") {
    const err = new Error("This staff account is inactive. Contact an administrator.");
    err.status = 403;
    throw err;
  }

  const token = jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
      role: user.role ?? "guest",
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return {
    token,
    user: publicUser(user),
  };
}

/**
 * True if this access token was explicitly revoked (logout).
 * @param {string} rawToken — Bearer token string without "Bearer " prefix
 */
async function isTokenRevoked(rawToken) {
  const tokenHash = hashToken(rawToken);
  const found = await RevokedToken.findOne({ tokenHash }).select("_id").lean();
  return Boolean(found);
}

/**
 * Invalidate the current access token until its natural expiry.
 * Idempotent: revoking the same token again succeeds.
 * @param {string} rawToken
 * @param {string} userId — must match JWT `sub` (caller must pass authenticated user)
 */
async function revokeToken(rawToken, userId) {
  const decoded = jwt.decode(rawToken);
  if (!decoded || !decoded.exp) {
    const err = new Error("Invalid token");
    err.status = 400;
    throw err;
  }
  if (String(decoded.sub) !== String(userId)) {
    const err = new Error("Token does not match user");
    err.status = 403;
    throw err;
  }

  const expiresAt = new Date(decoded.exp * 1000);
  const tokenHash = hashToken(rawToken);

  try {
    await RevokedToken.create({
      tokenHash,
      userId,
      expiresAt,
    });
  } catch (err) {
    if (err.code === 11000) {
      return;
    }
    throw err;
  }
}

module.exports = { register, login, isTokenRevoked, revokeToken };
