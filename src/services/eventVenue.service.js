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
 * Map admin UI / legacy field names and fill sensible defaults before validation.
 */
function normalizeCreateBody(body) {
  const b = { ...(body || {}) };
  if (!String(b.name || "").trim() && String(b.venueName || "").trim()) {
    b.name = String(b.venueName).trim();
  }
  if (!String(b.image || "").trim() && String(b.imageUrl || "").trim()) {
    b.image = String(b.imageUrl).trim();
  }
  const name = String(b.name || "").trim();
  const pkg = String(b.package || "").trim();
  if (!name && pkg) b.name = pkg;
  if (!pkg && name) b.package = name;
  if (!String(b.limit || "").trim() && b.capacity != null && b.capacity !== "") {
    b.limit = `${b.capacity} guests`;
  }
  if (!String(b.location || "").trim()) b.location = "On premises";
  if (!String(b.description || "").trim()) {
    b.description = String(b.name || b.package || "").trim();
  }
  if (!String(b.image || "").trim()) b.image = "";
  return b;
}

async function nextEventNum() {
  const latest = await EventVenue.findOne().sort({ eventNum: -1 }).select("eventNum").lean();
  if (!latest?.eventNum) return "EV001";
  const m = String(latest.eventNum).match(/(\d+)$/);
  const n = m ? parseInt(m[1], 10) + 1 : 1;
  return `EV${String(n).padStart(3, "0")}`;
}

/**
 * Ensures new venues match the full shape used in `db.json` + admin UI so DB rows are easy to spot.
 */
function assertCompleteCatalogPayload(body, { isCreate }) {
  if (!isCreate) return;
  const missing = [];
  if (!String(body.name || "").trim()) missing.push("name");
  if (!String(body.package || "").trim()) missing.push("package");
  if (!String(body.limit || "").trim()) missing.push("limit");
  if (body.price === undefined || body.price === null || body.price === "") {
    missing.push("price");
  }

  const feats = pickFeaturesFromBody(body);
  if (!feats || feats.length === 0) {
    missing.push("features or amenities (at least one entry)");
  }

  if (missing.length > 0) {
    const err = new Error(
      `Incomplete event venue. Missing: ${missing.join(
        ", ",
      )}. Expected name, package, limit, price, and at least one feature.`,
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

/** Public guest catalog — same rows as staff list, sorted for browse/booking UIs. */
async function listCatalog() {
  return list();
}

async function getById(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await EventVenue.findById(id).lean();
  return toPublicEventVenue(doc);
}

async function create(body) {
  const normalized = normalizeCreateBody(body);
  if (!String(normalized.eventNum || "").trim()) {
    normalized.eventNum = await nextEventNum();
  }
  assertCompleteCatalogPayload(normalized, { isCreate: true });

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
  } = normalized;

  const price = parsePrice(normalized.price);
  const cap = parseCapacity(capacity);
  const features = pickFeaturesFromBody(normalized);
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

  if (body.eventNum !== undefined) venue.eventNum = String(body.eventNum).trim();
  if (body.name !== undefined || body.venueName !== undefined) {
    venue.name = String(body.name ?? body.venueName ?? "").trim();
  }
  if (body.package !== undefined) venue.package = String(body.package).trim();
  if (body.type !== undefined) venue.type = String(body.type).trim();
  if (body.limit !== undefined) venue.limit = String(body.limit).trim();
  if (body.capacity !== undefined) {
    venue.capacity = parseCapacity(body.capacity);
  }
  if (body.price !== undefined) venue.price = parsePrice(body.price);
  if (body.location !== undefined) venue.location = String(body.location).trim();
  if (body.description !== undefined) venue.description = String(body.description).trim();
  if (body.image !== undefined || body.imageUrl !== undefined) {
    venue.image = String(body.image ?? body.imageUrl ?? "");
  }

  if (body.features !== undefined || body.amenities !== undefined) {
    venue.features = pickFeaturesFromBody(body);
  }
  if (body.housekeeping !== undefined) {
    venue.housekeeping = normalizeStringArray(body.housekeeping, "housekeeping");
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
  listCatalog,
  getById,
  create,
  update,
  remove,
  toPublicEventVenue,
};
