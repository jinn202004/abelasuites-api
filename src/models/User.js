const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const SALT_ROUNDS = 10;

const USER_ROLES = ["guest", "cashier", "frontdesk", "admin", "housekeeping"];

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      match: [
        /^[a-z0-9_]+$/,
        "Username may only contain letters, numbers, and underscores",
      ],
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
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

module.exports = User;
