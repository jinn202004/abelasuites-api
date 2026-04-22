const mongoose = require("mongoose");
const EventVenue = require("../models/EventVenue");

function parsePrice(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  const n = Number(String(value).replace(/[₱,\s]/g, "").trim());
  if (Number.isNaN(n)) {
    const err = new Error("price must be a number (₱ and commas are allowed in strings)");
    err.status = 400;
    throw err;
  }
  return n;
}

function parseCapacity(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    const err = new Error("capacity must be a positive integer when provided");
    err.status = 400;
    throw err;
  }
  return n;
}

function normalizeStringArray(value, fieldLabel) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    const err = new Error(`${fieldLabel} must be an array of strings`);
    err.status = 400;
    throw err;
  }
  return value.map((x) => String(x).trim()).filter(Boolean);
}

/** Merge legacy `amenities` with `features` (same meaning as json-server). */
function pickFeaturesFromBody(body) {
  const f = body.features;
  const a = body.amenities;
  if (f !== undefined && a !== undefined) {
    const merged = [
      ...normalizeStringArray(f, "features"),
      ...normalizeStringArray(a, "amenities"),
    ];
    return [...new Set(merged)];
  }
  if (f !== undefined) return normalizeStringArray(f, "features");
  if (a !== undefined) return normalizeStringArray(a, "amenities");
  return undefined;
}

/**
 * Ensures new venues match the full shape used in `db.json` + admin UI so DB rows are easy to spot.
 */
function assertCompleteCatalogPayload(body, { isCreate }) {
  if (!isCreate) return;
  const missing = [];
  if (!String(body.eventNum || "").trim()) missing.push("eventNum");
  if (!String(body.name || "").trim()) missing.push("name");
  if (!String(body.package || "").trim()) missing.push("package");
  if (!String(body.limit || "").trim()) missing.push("limit");
  if (body.price === undefined || body.price === null || body.price === "") {
    missing.push("price");
  }
  if (!String(body.location || "").trim()) missing.push("location");
  if (!String(body.description || "").trim()) missing.push("description");
  if (!String(body.image || "").trim()) missing.push("image");

  const feats = pickFeaturesFromBody(body);
  if (!feats || feats.length === 0) {
    missing.push("features or amenities (at least one entry)");
  }

  if (missing.length > 0) {
    const err = new Error(
      `Incomplete event venue. Missing: ${missing.join(
        ", ",
      )}. Expected the same fields as your catalog: eventNum, name, package, type, limit, price, location, description, features (or amenities), housekeeping, image.`,
    );
    err.status = 400;
    err.missing = missing;
    throw err;
  }
}

function toPublicEventVenue(doc) {
  if (!doc) return null;
  const o = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const features = Array.isArray(o.features) ? o.features : [];
  return {
    id: o._id,
    eventNum: o.eventNum,
    name: o.name,
    package: o.package ?? "",
    type: o.type ?? "Event",
    limit: o.limit ?? "",
    capacity: o.capacity ?? null,
    price: o.price,
    location: o.location ?? "",
    description: o.description ?? "",
    features,
    amenities: features,
    housekeeping: Array.isArray(o.housekeeping) ? o.housekeeping : [],
    image: o.image ?? "",
    status: o.status ?? "available",
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

async function list() {
  const rows = await EventVenue.find().sort({ eventNum: 1 }).lean();
  return rows.map((r) => toPublicEventVenue(r));
}

async function getById(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await EventVenue.findById(id).lean();
  return toPublicEventVenue(doc);
}

async function create(body) {
  assertCompleteCatalogPayload(body, { isCreate: true });

  const {
    eventNum,
    name,
    package: pkg,
    type,
    limit,
    capacity,
    location,
    description,
    image,
    housekeeping,
  } = body;

  const price = parsePrice(body.price);
  const cap = parseCapacity(capacity);
  const features = pickFeaturesFromBody(body);
  const hk = housekeeping !== undefined ? normalizeStringArray(housekeeping, "housekeeping") : [];

  const doc = await EventVenue.create({
    eventNum: String(eventNum).trim(),
    name: String(name).trim(),
    package: pkg !== undefined ? String(pkg).trim() : "",
    type: type !== undefined ? String(type).trim() : "Event",
    limit: limit !== undefined ? String(limit).trim() : "",
    ...(cap !== undefined ? { capacity: cap } : {}),
    price,
    location: location !== undefined ? String(location).trim() : "",
    description: description !== undefined ? String(description).trim() : "",
    features,
    housekeeping: hk,
    image: image !== undefined ? String(image) : "",
  });
  return toPublicEventVenue(doc);
}

async function update(id, body) {
  if (!mongoose.isValidObjectId(id)) {
    const err = new Error("Invalid event venue id");
    err.status = 400;
    throw err;
  }
  const venue = await EventVenue.findById(id);
  if (!venue) {
    const err = new Error("Event venue not found");
    err.status = 404;
    throw err;
  }

  const {
    eventNum,
    name,
    package: pkg,
    type,
    limit,
    capacity,
    location,
    description,
    image,
    housekeeping,
  } = body;

  if (eventNum !== undefined) venue.eventNum = String(eventNum).trim();
  if (name !== undefined) venue.name = String(name).trim();
  if (pkg !== undefined) venue.package = String(pkg).trim();
  if (type !== undefined) venue.type = String(type).trim();
  if (limit !== undefined) venue.limit = String(limit).trim();
  if (capacity !== undefined) {
    venue.capacity = parseCapacity(capacity);
  }
  if (body.price !== undefined) venue.price = parsePrice(body.price);
  if (location !== undefined) venue.location = String(location).trim();
  if (description !== undefined) venue.description = String(description).trim();
  if (image !== undefined) venue.image = String(image);

  if (body.features !== undefined || body.amenities !== undefined) {
    venue.features = pickFeaturesFromBody(body);
  }
  if (housekeeping !== undefined) {
    venue.housekeeping = normalizeStringArray(housekeeping, "housekeeping");
  }
  if (body.status !== undefined) {
    const st = String(body.status).trim();
    if (!EventVenue.EVENT_VENUE_STATUSES.includes(st)) {
      const err = new Error(`status must be one of: ${EventVenue.EVENT_VENUE_STATUSES.join(", ")}`);
      err.status = 400;
      throw err;
    }
    venue.status = st;
  }

  try {
    await venue.save();
  } catch (e) {
    if (e.code === 11000) {
      const err = new Error("eventNum already in use");
      err.status = 409;
      throw err;
    }
    throw e;
  }
  const fresh = await EventVenue.findById(venue._id).lean();
  return toPublicEventVenue(fresh);
}

async function remove(id) {
  if (!mongoose.isValidObjectId(id)) {
    const err = new Error("Invalid event venue id");
    err.status = 400;
    throw err;
  }
  const deleted = await EventVenue.findByIdAndDelete(id);
  if (!deleted) {
    const err = new Error("Event venue not found");
    err.status = 404;
    throw err;
  }
  return toPublicEventVenue(deleted);
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  toPublicEventVenue,
};
