const mongoose = require("mongoose");
const User = require("../models/User");
const { validatePasswordStrength } = require("../utils/passwordValidation");
const { validateUsername } = require("../utils/usernameValidation");

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
    username: doc.username,
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

async function updateMe(userId, { username, email, firstName, lastName, currentPassword, newPassword }) {
  const user = await User.findById(userId).select("+passwordHash");
  if (!user) {
    const err = new Error("User not found");
    err.status = 404;
    throw err;
  }

  if (username !== undefined) {
    const usernameError = validateUsername(username);
    if (usernameError) {
      const err = new Error(usernameError);
      err.status = 400;
      throw err;
    }
    user.username = String(username).trim().toLowerCase();
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

  if (newPassword !== undefined) {
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

module.exports = { getById, updateMe };
