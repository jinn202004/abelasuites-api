const mongoose = require("mongoose");
const User = require("../models/User");
const { validatePasswordStrength } = require("../utils/passwordValidation");

/** Non-guest roles stored in the same `users` collection (replaces legacy `staff` collection). */
const STAFF_USER_ROLES = ["admin", "cashier", "frontdesk", "housekeeping"];

const DISPLAY_BY_ROLE = {
  admin: "Admin",
  frontdesk: "Front Desk",
  housekeeping: "Housekeeping",
  cashier: "Cashier",
};

const FORM_ROLE_BY_DISPLAY = {
  Admin: "admin",
  "Front Desk": "frontdesk",
  Housekeeping: "housekeeping",
  Cashier: "cashier",
};

function normalizeEmail(email) {
  return String(email).toLowerCase().trim();
}

function splitName(full) {
  const s = String(full || "").trim();
  if (!s) return { firstName: "", lastName: "" };
  const parts = s.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function toPublicStaffFromUser(doc) {
  if (!doc) return null;
  const role = doc.role;
  const displayRole = DISPLAY_BY_ROLE[role] || role;
  const combined = [doc.firstName, doc.lastName].filter(Boolean).join(" ").trim();
  const name =
    String(doc.name || "").trim() ||
    combined ||
    String(doc.email || "").split("@")[0] ||
    "User";
  return {
    id: String(doc._id),
    name,
    email: doc.email,
    role: displayRole,
    department: doc.department ?? "",
    contact: doc.phone ?? "",
    status: doc.staffStatus ?? "Active",
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function list() {
  const rows = await User.find({ role: { $in: STAFF_USER_ROLES } })
    .sort({ createdAt: -1 })
    .lean();
  return rows.map(toPublicStaffFromUser);
}

async function create(body) {
  const {
    name,
    email,
    role: displayRole,
    department,
    contact,
    status,
    password,
  } = body || {};

  const dbRole = FORM_ROLE_BY_DISPLAY[displayRole];
  if (!dbRole) {
    const err = new Error(`role must be one of: ${Object.keys(FORM_ROLE_BY_DISPLAY).join(", ")}`);
    err.status = 400;
    throw err;
  }

  const pwd = password != null ? String(password) : "";
  if (!pwd.trim()) {
    const err = new Error("password is required for new staff user accounts");
    err.status = 400;
    throw err;
  }
  const pwdErr = validatePasswordStrength(pwd);
  if (pwdErr) {
    const err = new Error(pwdErr);
    err.status = 400;
    throw err;
  }

  const nm = String(name || "").trim();
  if (!nm) {
    const err = new Error("name is required");
    err.status = 400;
    throw err;
  }

  const normEmail = normalizeEmail(email);
  if (!normEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail)) {
    const err = new Error("valid email is required");
    err.status = 400;
    throw err;
  }

  const dept = String(department || "").trim();
  if (!dept) {
    const err = new Error("department is required");
    err.status = 400;
    throw err;
  }

  const phone = String(contact || "").trim();
  if (!phone) {
    const err = new Error("contact is required");
    err.status = 400;
    throw err;
  }

  const staffStatus =
    status && User.STAFF_STATUSES.includes(status) ? status : "Active";

  const existing = await User.findOne({ email: normEmail }).select("_id").lean();
  if (existing) {
    const err = new Error("A user with this email already exists");
    err.status = 409;
    throw err;
  }

  const { firstName, lastName } = splitName(nm);

  const doc = await User.create({
    email: normEmail,
    username: normEmail,
    passwordHash: await User.hashPassword(pwd),
    name: nm,
    firstName,
    lastName,
    phone,
    department: dept,
    staffStatus,
    role: dbRole,
  });

  return toPublicStaffFromUser(doc.toObject());
}

async function update(staffId, body) {
  if (!mongoose.isValidObjectId(staffId)) {
    const err = new Error("Invalid staff id");
    err.status = 400;
    throw err;
  }

  const user = await User.findById(staffId);
  if (!user) {
    const err = new Error("Staff not found");
    err.status = 404;
    throw err;
  }

  if (!STAFF_USER_ROLES.includes(user.role)) {
    const err = new Error("Not a staff user record");
    err.status = 404;
    throw err;
  }

  if (body.name !== undefined) {
    const nm = String(body.name).trim();
    if (!nm) {
      const err = new Error("name cannot be empty");
      err.status = 400;
      throw err;
    }
    user.name = nm;
    const parts = splitName(nm);
    user.firstName = parts.firstName;
    user.lastName = parts.lastName;
  }

  if (body.email !== undefined) {
    const next = normalizeEmail(body.email);
    if (!next || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
      const err = new Error("valid email is required");
      err.status = 400;
      throw err;
    }
    const dup = await User.findOne({ email: next, _id: { $ne: user._id } })
      .select("_id")
      .lean();
    if (dup) {
      const err = new Error("Email already in use");
      err.status = 409;
      throw err;
    }
    user.email = next;
    user.username = next;
  }

  if (body.role !== undefined) {
    const dbRole = FORM_ROLE_BY_DISPLAY[body.role];
    if (!dbRole) {
      const err = new Error("Invalid role");
      err.status = 400;
      throw err;
    }
    user.role = dbRole;
  }

  if (body.department !== undefined) {
    const d = String(body.department).trim();
    if (!d) {
      const err = new Error("department cannot be empty");
      err.status = 400;
      throw err;
    }
    user.department = d;
  }

  if (body.contact !== undefined) {
    const c = String(body.contact).trim();
    if (!c) {
      const err = new Error("contact cannot be empty");
      err.status = 400;
      throw err;
    }
    user.phone = c;
  }

  if (body.status !== undefined) {
    const s = String(body.status).trim();
    if (!User.STAFF_STATUSES.includes(s)) {
      const err = new Error(`status must be one of: ${User.STAFF_STATUSES.join(", ")}`);
      err.status = 400;
      throw err;
    }
    user.staffStatus = s;
  }

  if (body.password !== undefined && String(body.password).trim()) {
    const pwdErr = validatePasswordStrength(body.password);
    if (pwdErr) {
      const err = new Error(pwdErr);
      err.status = 400;
      throw err;
    }
    user.passwordHash = await User.hashPassword(body.password);
  }

  await user.save();
  const fresh = await User.findById(user._id).lean();
  return toPublicStaffFromUser(fresh);
}

async function remove(staffId) {
  if (!mongoose.isValidObjectId(staffId)) {
    const err = new Error("Invalid staff id");
    err.status = 400;
    throw err;
  }
  const user = await User.findById(staffId);
  if (!user) {
    const err = new Error("Staff not found");
    err.status = 404;
    throw err;
  }
  if (!STAFF_USER_ROLES.includes(user.role)) {
    const err = new Error("Staff not found");
    err.status = 404;
    throw err;
  }
  await User.deleteOne({ _id: user._id });
  return toPublicStaffFromUser(user.toObject());
}

module.exports = { list, create, update, remove };
