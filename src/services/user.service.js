const mongoose = require("mongoose");
const User = require("../models/User");
const { validatePasswordStrength } = require("../utils/passwordValidation");

function normalizeEmail(email) {
  return String(email).toLowerCase().trim();
}

function trimName(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function toPublicUser(doc) {
  if (!doc) return null;
  return {
    id: doc._id,
    email: doc.email,
    firstName: doc.firstName ?? "",
    lastName: doc.lastName ?? "",
    role: doc.role ?? "guest",
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function getById(userId) {
  if (!mongoose.isValidObjectId(userId)) return null;
  const user = await User.findById(userId).lean();
  return toPublicUser(user);
}

/**
 * @param {object} fields - email, firstName, lastName, role, currentPassword, newPassword
 * @param {{ isSelf: boolean, isAdmin: boolean }} ctx
 */
async function updateUser(targetUserId, fields, { isSelf, isAdmin }) {
  const { email, firstName, lastName, role, currentPassword, newPassword } = fields;

  const user = await User.findById(targetUserId).select("+passwordHash");
  if (!user) {
    const err = new Error("User not found");
    err.status = 404;
    throw err;
  }

  if (email !== undefined) {
    user.email = normalizeEmail(email);
  }

  if (firstName !== undefined) {
    user.firstName = trimName(firstName);
  }

  if (lastName !== undefined) {
    user.lastName = trimName(lastName);
  }

  if (role !== undefined) {
    if (!isAdmin) {
      const err = new Error("Only admins can change user roles");
      err.status = 403;
      throw err;
    }
    if (isSelf) {
      const err = new Error(
        "You cannot change your own role through this API; ask another admin or update the database"
      );
      err.status = 400;
      throw err;
    }
    const roles = User.USER_ROLES;
    if (!roles.includes(role)) {
      const err = new Error("Invalid role");
      err.status = 400;
      throw err;
    }
    user.role = role;
  }

  if (newPassword !== undefined) {
    if (isSelf) {
      if (!currentPassword) {
        const err = new Error("currentPassword is required when setting newPassword");
        err.status = 400;
        throw err;
      }
      const match = await user.comparePassword(currentPassword);
      if (!match) {
        const err = new Error("Current password is incorrect");
        err.status = 401;
        throw err;
      }
    } else if (!isAdmin) {
      const err = new Error("Forbidden");
      err.status = 403;
      throw err;
    }

    const pwdErr = validatePasswordStrength(newPassword);
    if (pwdErr) {
      const err = new Error(pwdErr);
      err.status = 400;
      throw err;
    }
    user.passwordHash = await User.hashPassword(newPassword);
  }

  await user.save();
  const fresh = await User.findById(user._id).lean();
  return toPublicUser(fresh);
}

async function updateMe(userId, fields, actorIsAdmin) {
  return updateUser(userId, fields, {
    isSelf: true,
    isAdmin: Boolean(actorIsAdmin),
  });
}

module.exports = { getById, updateUser, updateMe };
