const mongoose = require("mongoose");
const Staff = require("../models/Staff");

function toPublicStaff(doc) {
  if (!doc) return null;
  const o = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    id: o._id,
    name: o.name,
    email: o.email,
    role: o.role,
    department: o.department ?? "",
    contact: o.contact ?? "",
    status: o.status ?? "Active",
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

function normalizeEmail(email) {
  return String(email ?? "").toLowerCase().trim();
}

function assertRole(role) {
  if (!Staff.STAFF_ROLES.includes(role)) {
    const err = new Error(`role must be one of: ${Staff.STAFF_ROLES.join(", ")}`);
    err.status = 400;
    throw err;
  }
}

function assertStatus(status) {
  if (status === undefined || status === null) return;
  if (!Staff.STAFF_STATUSES.includes(status)) {
    const err = new Error(`status must be one of: ${Staff.STAFF_STATUSES.join(", ")}`);
    err.status = 400;
    throw err;
  }
}

async function list() {
  const rows = await Staff.find().sort({ createdAt: -1 }).lean();
  return rows.map((r) => toPublicStaff(r));
}

async function create(body) {
  const name = String(body.name ?? "").trim();
  const email = normalizeEmail(body.email);
  const role = String(body.role ?? "").trim();
  const department = String(body.department ?? "").trim();
  const contact = body.contact !== undefined ? String(body.contact).trim() : "";
  const status = body.status !== undefined ? String(body.status).trim() : "Active";

  if (!name) {
    const err = new Error("name is required");
    err.status = 400;
    throw err;
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const err = new Error("valid email is required");
    err.status = 400;
    throw err;
  }
  if (!role) {
    const err = new Error("role is required");
    err.status = 400;
    throw err;
  }
  assertRole(role);
  if (!department) {
    const err = new Error("department is required");
    err.status = 400;
    throw err;
  }
  assertStatus(status);

  try {
    const doc = await Staff.create({
      name,
      email,
      role,
      department,
      contact,
      status,
    });
    return toPublicStaff(doc);
  } catch (err) {
    if (err.code === 11000) {
      const e = new Error("email already in use");
      e.status = 409;
      throw e;
    }
    throw err;
  }
}

async function update(staffId, body) {
  if (!mongoose.isValidObjectId(staffId)) {
    const err = new Error("Invalid staff id");
    err.status = 400;
    throw err;
  }

  const staff = await Staff.findById(staffId);
  if (!staff) {
    const err = new Error("Staff not found");
    err.status = 404;
    throw err;
  }

  if (body.name !== undefined) staff.name = String(body.name).trim();
  if (body.email !== undefined) staff.email = normalizeEmail(body.email);
  if (body.role !== undefined) {
    const r = String(body.role).trim();
    assertRole(r);
    staff.role = r;
  }
  if (body.department !== undefined) staff.department = String(body.department).trim();
  if (body.contact !== undefined) staff.contact = String(body.contact).trim();
  if (body.status !== undefined) {
    const s = String(body.status).trim();
    assertStatus(s);
    staff.status = s;
  }

  if (!staff.name) {
    const err = new Error("name cannot be empty");
    err.status = 400;
    throw err;
  }
  if (!staff.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(staff.email)) {
    const err = new Error("valid email is required");
    err.status = 400;
    throw err;
  }
  if (!staff.department) {
    const err = new Error("department cannot be empty");
    err.status = 400;
    throw err;
  }

  try {
    await staff.save();
  } catch (err) {
    if (err.code === 11000) {
      const e = new Error("email already in use");
      e.status = 409;
      throw e;
    }
    throw err;
  }

  const fresh = await Staff.findById(staff._id).lean();
  return toPublicStaff(fresh);
}

async function remove(staffId) {
  if (!mongoose.isValidObjectId(staffId)) {
    const err = new Error("Invalid staff id");
    err.status = 400;
    throw err;
  }
  const deleted = await Staff.findByIdAndDelete(staffId);
  if (!deleted) {
    const err = new Error("Staff not found");
    err.status = 404;
    throw err;
  }
  return toPublicStaff(deleted);
}

module.exports = {
  list,
  create,
  update,
  remove,
};
