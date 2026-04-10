const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { JWT_SECRET, JWT_EXPIRES_IN } = require("../config");

function normalizeEmail(email) {
  return String(email).toLowerCase().trim();
}

function normalizeUsername(username) {
  return String(username).trim().toLowerCase();
}

function trimName(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function publicUser(user) {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
    role: user.role ?? "guest",
  };
}

async function register(username, email, password, phone, { firstName, lastName } = {}) {
  const user = await User.create({
    username: normalizeUsername(username),
    email: normalizeEmail(email),
    passwordHash: await User.hashPassword(password),
    firstName: trimName(firstName),
    lastName: trimName(lastName),
    phone,
    role: "guest",
  });
  return publicUser(user);
}

async function login(username, password) {
  if (!JWT_SECRET) {
    throw Object.assign(new Error("JWT_SECRET is not configured"), { status: 500 });
  }

  const normalized = normalizeUsername(username);
  const user = await User.findOne({ username: normalized }).select("+passwordHash");
  if (!user) {
    const err = new Error("Invalid username or password");
    err.status = 401;
    throw err;
  }

  const match = await user.comparePassword(password);
  if (!match) {
    const err = new Error("Invalid username or password");
    err.status = 401;
    throw err;
  }

  const token = jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
      username: user.username,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return {
    token,
    user: publicUser(user),
  };
}

module.exports = { register, login };
