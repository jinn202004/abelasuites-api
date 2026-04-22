const mongoose = require("mongoose");
const Room = require("../models/Room");

function toPublicRoom(doc) {
  if (!doc) return null;
  const o = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    id: o._id,
    title: o.title,
    roomNumber: o.roomNumber,
    package: o.package ?? "",
    image: o.image ?? "",
    price: o.price,
    guests: o.guests,
    description: o.description ?? "",
    features: Array.isArray(o.features) ? o.features : [],
    status: o.status ?? "available",
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

function parsePrice(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  const n = Number(String(value).replace(/[₱,\s]/g, "").trim());
  if (Number.isNaN(n)) {
    const err = new Error("price must be a number");
    err.status = 400;
    throw err;
  }
  return n;
}

function parseGuests(value) {
  if (value === undefined || value === null) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    const err = new Error("guests must be a positive integer");
    err.status = 400;
    throw err;
  }
  return n;
}

function normalizeFeatures(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    const err = new Error("features must be an array of strings");
    err.status = 400;
    throw err;
  }
  return value.map((x) => String(x).trim()).filter(Boolean);
}

async function list() {
  const rows = await Room.find().sort({ roomNumber: 1 }).lean();
  return rows.map((r) => toPublicRoom(r));
}

async function getById(roomId) {
  if (!mongoose.isValidObjectId(roomId)) return null;
  const doc = await Room.findById(roomId).lean();
  return toPublicRoom(doc);
}

async function create(body) {
  const {
    title,
    roomNumber,
    package: pkg,
    image,
    price,
    guests,
    description,
    features,
  } = body;

  if (!title || !String(title).trim()) {
    const err = new Error("title is required");
    err.status = 400;
    throw err;
  }
  if (!roomNumber || !String(roomNumber).trim()) {
    const err = new Error("roomNumber is required");
    err.status = 400;
    throw err;
  }

  const p = parsePrice(price);
  const g = parseGuests(guests);
  if (p === undefined) {
    const err = new Error("price is required");
    err.status = 400;
    throw err;
  }
  if (g === undefined) {
    const err = new Error("guests is required");
    err.status = 400;
    throw err;
  }

  const room = await Room.create({
    title: String(title).trim(),
    roomNumber: String(roomNumber).trim(),
    package: pkg !== undefined ? String(pkg).trim() : "",
    image: image !== undefined ? String(image) : "",
    price: p,
    guests: g,
    description: description !== undefined ? String(description).trim() : "",
    features: features !== undefined ? normalizeFeatures(features) : [],
  });
  return toPublicRoom(room);
}

async function update(roomId, body) {
  if (!mongoose.isValidObjectId(roomId)) {
    const err = new Error("Invalid room id");
    err.status = 400;
    throw err;
  }
  const room = await Room.findById(roomId);
  if (!room) {
    const err = new Error("Room not found");
    err.status = 404;
    throw err;
  }

  const {
    title,
    roomNumber,
    package: pkg,
    image,
    price,
    guests,
    description,
    features,
  } = body;

  if (title !== undefined) room.title = String(title).trim();
  if (roomNumber !== undefined) room.roomNumber = String(roomNumber).trim();
  if (pkg !== undefined) room.package = String(pkg).trim();
  if (image !== undefined) room.image = String(image);
  if (price !== undefined) room.price = parsePrice(price);
  if (guests !== undefined) room.guests = parseGuests(guests);
  if (description !== undefined) room.description = String(description).trim();
  if (features !== undefined) room.features = normalizeFeatures(features);
  if (body.status !== undefined) {
    const st = String(body.status).trim();
    if (!Room.ROOM_STATUSES.includes(st)) {
      const err = new Error(`status must be one of: ${Room.ROOM_STATUSES.join(", ")}`);
      err.status = 400;
      throw err;
    }
    room.status = st;
  }

  try {
    await room.save();
  } catch (e) {
    if (e.code === 11000) {
      const err = new Error("roomNumber already in use");
      err.status = 409;
      throw err;
    }
    throw e;
  }
  const fresh = await Room.findById(room._id).lean();
  return toPublicRoom(fresh);
}

async function remove(roomId) {
  if (!mongoose.isValidObjectId(roomId)) {
    const err = new Error("Invalid room id");
    err.status = 400;
    throw err;
  }
  const deleted = await Room.findByIdAndDelete(roomId);
  if (!deleted) {
    const err = new Error("Room not found");
    err.status = 404;
    throw err;
  }
  return toPublicRoom(deleted);
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
};
