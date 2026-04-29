const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const SALT_ROUNDS = 10;

/** Application RBAC: single `users` collection for all accounts. */
const USER_ROLES = ["admin", "frontdesk", "housekeeping", "guest", "cashier"];

const STAFF_STATUSES = ["Active", "On Leave", "Inactive"];

const userSchema = new mongoose.Schema(
  {
    /** Display name (full name). Prefer this over firstName/lastName for staff. */
    name: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    /**
     * Some databases still have a legacy unique index on `username`. New users must
     * set this (usually equal to `email`) so inserts do not collide on `username: null`.
     */
    username: {
      type: String,
      trim: true,
      lowercase: true,
    },
    firstName: {
      type: String,
      trim: true,
      default: "",
    },
    lastName: {
      type: String,
      trim: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    /** HR-style fields for staff roles (optional for guests). */
    department: {
      type: String,
      trim: true,
      default: "",
    },
    staffStatus: {
      type: String,
      enum: {
        values: STAFF_STATUSES,
        message: "Invalid staff status",
      },
      default: "Active",
    },
    role: {
      type: String,
      enum: {
        values: USER_ROLES,
        message: "Invalid role",
      },
      default: "guest",
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.statics.hashPassword = function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
};

const User = mongoose.model("User", userSchema);

User.USER_ROLES = USER_ROLES;
User.STAFF_STATUSES = STAFF_STATUSES;

module.exports = User;
