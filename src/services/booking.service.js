const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const Guest = require("../models/Guest");
const User = require("../models/User");
const { findOrCreateGuestFromBookingBody, toPublicGuest } = require("./guest.service");
const staffNotificationService = require("./staffNotification.service");

const STAFF_ROLES = new Set(["admin", "cashier", "frontdesk", "housekeeping"]);

function isStaff(role) {
  return STAFF_ROLES.has(role);
}

function assertCanAccess(actor, booking) {
  if (!booking) {
    const err = new Error("Booking not found");
    err.status = 404;
    throw err;
  }
  if (isStaff(actor.role)) return;
  if (String(booking.userId) === String(actor.id)) return;
  const err = new Error("Forbidden");
  err.status = 403;
  throw err;
}

const DEFAULT_POPULATE = [
  { path: "guestId", model: "Guest" },
  { path: "approvedBy", select: "email firstName lastName role" },
];

/**
 * Include `guest.validIdPhotoData` for anyone authorized on the booking.
 * Guests only receive their own rows (`actorMatchQuery`); staff receive all.
 */
function guestOptsForActor(_actor) {
  return { includeIdPhotoData: true };
}

function actorMatchQuery(actor) {
  if (isStaff(actor.role)) return {};
  return { userId: new mongoose.Types.ObjectId(String(actor.id)) };
}

/**
 * Loads Guest + approvedBy for raw MongoDB booking docs (legacy `guestId` string values, etc.).
 */
async function hydrateRawBookings(docs) {
  const out = [];
  for (const doc of docs) {
    const o = { ...doc };
    const gid = doc.guestId;

    if (gid != null && mongoose.isValidObjectId(gid)) {
      const gDoc = await Guest.findById(gid).lean();
      o.guestId = gDoc || null;
    } else if (typeof gid === "string" && gid.trim() && !mongoose.isValidObjectId(gid)) {
      o.guestId = null;
      o._legacyGuestIdString = gid.trim();
    } else {
      o.guestId = null;
    }

    const aid = doc.approvedBy;
    if (aid != null && mongoose.isValidObjectId(aid)) {
      o.approvedBy = await User.findById(aid).select("email firstName lastName role").lean();
    }

    out.push(o);
  }
  return out;
}

async function findBookingsWithPopulateOrRaw(filter, sort) {
  try {
    return await Booking.find(filter).populate(DEFAULT_POPULATE).sort(sort).lean();
  } catch (err) {
    console.warn("[bookings] Mongoose find/populate failed, using raw collection:", err.message);
    const coll = mongoose.connection.collection("bookings");
    const raw = await coll.find(filter).sort(sort).toArray();
    return hydrateRawBookings(raw);
  }
}

async function findOneBookingWithPopulateOrRaw(bookingId) {
  if (!mongoose.isValidObjectId(bookingId)) return null;
  let doc = null;
  try {
    doc = await Booking.findById(bookingId).populate(DEFAULT_POPULATE).lean();
  } catch (err) {
    console.warn("[bookings] findById failed, using raw collection:", err.message);
  }
  if (doc) return doc;

  /** Some legacy rows load via native collection only; approve + housekeeping need this row. */
  const coll = mongoose.connection.collection("bookings");
  const _id = new mongoose.Types.ObjectId(String(bookingId));
  const raw = await coll.findOne({ _id });
  if (!raw) return null;
  const [h] = await hydrateRawBookings([raw]);
  return h;
}

/** Ensures JSON clients always get a string id (avoids duplicate React keys / wrong row lookups). */
function bookingIdToString(raw) {
  if (raw == null) return "";
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "object" && raw.$oid) return String(raw.$oid).trim();
  try {
    return String(raw).trim();
  } catch {
    return "";
  }
}

/**
 * Maps a booking document (lean or plain) to API shape with nested `guest`.
 */
function toPublicBooking(doc, options = {}) {
  if (!doc) return null;
  const o = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const includeIdPhoto = options.includeIdPhotoData === true;
  const publicId = bookingIdToString(o._id);

  let guest = null;
  if (o.guestId && typeof o.guestId === "object" && o.guestId._id) {
    guest = toPublicGuest(o.guestId, { includeIdPhotoData: includeIdPhoto });
  } else if (o._legacyGuestIdString) {
    guest = {
      id: null,
      userId: null,
      displayName: o.customerName ?? "",
      email: o.email ?? "",
      phone: o.contactNumber ?? "",
      address: o.address ?? "",
      validIdNumber: String(o._legacyGuestIdString),
      validIdPhotoName: o.guestIdPhotoName ?? "",
      ...(includeIdPhoto ? { validIdPhotoData: o.guestIdPhotoData ?? "" } : {}),
    };
  } else if (!o.guestId && (o.customerName || o.email)) {
    guest = {
      id: null,
      userId: null,
      displayName: o.customerName ?? "",
      email: o.email ?? "",
      phone: o.contactNumber ?? "",
      address: o.address ?? "",
      validIdNumber: "",
      validIdPhotoName: "",
      ...(includeIdPhoto ? { validIdPhotoData: "" } : {}),
    };
  }

  const guestFk =
    o.guestId && typeof o.guestId === "object" && o.guestId._id
      ? o.guestId._id
      : o.guestId && mongoose.isValidObjectId(o.guestId)
        ? o.guestId
        : null;

  return {
    id: publicId,
    type: o.type,
    userId: o.userId,
    guestId: guestFk,
    guest,
    customerName: o.customerName ?? "",
    email: o.email ?? "",
    contactNumber: o.contactNumber ?? "",
    address: o.address ?? "",
    status: o.status ?? "pending",
    additionalRequests: o.additionalRequests ?? "",
    declineReason: o.declineReason ?? "",
    roomId: o.roomId ?? "",
    roomNumber: o.roomNumber ?? "",
    roomTitle: o.roomTitle ?? "",
    checkIn: o.checkIn ?? "",
    checkOut: o.checkOut ?? "",
    additionalGuests: o.additionalGuests ?? 0,
    eventVenueId: o.eventVenueId ?? "",
    venueName: o.venueName ?? "",
    venuePrice: o.venuePrice ?? "",
    totalAmount: o.totalAmount ?? "",
    eventTitle: o.eventTitle ?? "",
    eventDate: o.eventDate ?? "",
    eventEndDate: o.eventEndDate ?? "",
    expectedPax: o.expectedPax ?? 1,
    timeSlot: o.timeSlot ?? "",
    paymentAmount: o.paymentAmount ?? "",
    paymentMethod: o.paymentMethod ?? "",
    transactionId: o.transactionId ?? "",
    approvedBy:
      o.approvedBy && typeof o.approvedBy === "object" && o.approvedBy._id
        ? {
            id: o.approvedBy._id,
            email: o.approvedBy.email ?? "",
            firstName: o.approvedBy.firstName ?? "",
            lastName: o.approvedBy.lastName ?? "",
            role: o.approvedBy.role ?? "",
          }
        : o.approvedBy ?? null,
    approvedAt: o.approvedAt ?? null,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

function validateCreate(body) {
  const { type } = body;
  if (type !== "room" && type !== "event") {
    const err = new Error('type must be "room" or "event"');
    err.status = 400;
    throw err;
  }
  if (!body.customerName || !String(body.customerName).trim()) {
    const err = new Error("customerName is required");
    err.status = 400;
    throw err;
  }
  if (!body.email || !String(body.email).trim()) {
    const err = new Error("email is required");
    err.status = 400;
    throw err;
  }

  if (type === "room") {
    if (!body.roomId || !String(body.roomId).trim()) {
      const err = new Error("roomId is required for room bookings");
      err.status = 400;
      throw err;
    }
    if (!body.checkIn || !String(body.checkIn).trim()) {
      const err = new Error("checkIn is required for room bookings");
      err.status = 400;
      throw err;
    }
    if (!body.checkOut || !String(body.checkOut).trim()) {
      const err = new Error("checkOut is required for room bookings");
      err.status = 400;
      throw err;
    }
  } else {
    if (!body.eventVenueId || !String(body.eventVenueId).trim()) {
      const err = new Error("eventVenueId is required for event bookings");
      err.status = 400;
      throw err;
    }
    if (!body.eventDate || !String(body.eventDate).trim()) {
      const err = new Error("eventDate is required for event bookings");
      err.status = 400;
      throw err;
    }
    if (!body.eventTitle || !String(body.eventTitle).trim()) {
      const err = new Error("eventTitle is required for event bookings");
      err.status = 400;
      throw err;
    }
  }
}

async function list(actor) {
  const q = actorMatchQuery(actor);
  const rows = await findBookingsWithPopulateOrRaw(q, { createdAt: -1 });
  const opts = { includeIdPhotoData: guestOptsForActor(actor).includeIdPhotoData };
  return rows.map((r) => toPublicBooking(r, opts));
}

async function getById(bookingId, actor) {
  const doc = await findOneBookingWithPopulateOrRaw(bookingId);
  if (!doc) return null;
  assertCanAccess(actor, doc);
  return toPublicBooking(doc, { includeIdPhotoData: true });
}

async function create(body, actor) {
  validateCreate(body);

  let status = body.status !== undefined ? String(body.status) : "pending";
  if (!Booking.BOOKING_STATUSES.includes(status)) {
    const err = new Error("Invalid status");
    err.status = 400;
    throw err;
  }
  if (!isStaff(actor.role)) {
    status = "pending";
  }

  const guest = await findOrCreateGuestFromBookingBody(actor, body);

  const doc = await Booking.create({
    type: body.type,
    userId: actor.id,
    guestId: guest._id,
    customerName: String(body.customerName).trim(),
    email: String(body.email).toLowerCase().trim(),
    contactNumber: body.contactNumber !== undefined ? String(body.contactNumber).trim() : "",
    address: body.address !== undefined ? String(body.address).trim() : "",
    status,
    additionalRequests:
      body.additionalRequests !== undefined ? String(body.additionalRequests).trim() : "",
    declineReason: body.declineReason !== undefined ? String(body.declineReason).trim() : "",
    roomId: body.roomId !== undefined ? String(body.roomId).trim() : "",
    roomTitle: body.roomTitle !== undefined ? String(body.roomTitle).trim() : "",
    checkIn: body.checkIn !== undefined ? String(body.checkIn).trim() : "",
    checkOut: body.checkOut !== undefined ? String(body.checkOut).trim() : "",
    additionalGuests: (() => {
      const n = Number(body.additionalGuests);
      return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
    })(),
    eventVenueId: body.eventVenueId !== undefined ? String(body.eventVenueId).trim() : "",
    venueName: body.venueName !== undefined ? String(body.venueName).trim() : "",
    venuePrice: body.venuePrice !== undefined ? String(body.venuePrice).trim() : "",
    totalAmount: body.totalAmount !== undefined ? String(body.totalAmount).trim() : "",
    eventTitle: body.eventTitle !== undefined ? String(body.eventTitle).trim() : "",
    eventDate: body.eventDate !== undefined ? String(body.eventDate).trim() : "",
    eventEndDate: body.eventEndDate !== undefined ? String(body.eventEndDate).trim() : "",
    expectedPax: (() => {
      const n = Number(body.expectedPax);
      return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
    })(),
    timeSlot: body.timeSlot !== undefined ? String(body.timeSlot).trim() : "",
    paymentAmount: body.paymentAmount !== undefined ? String(body.paymentAmount).trim() : "",
    paymentMethod: body.paymentMethod !== undefined ? String(body.paymentMethod).trim() : "",
    transactionId: body.transactionId !== undefined ? String(body.transactionId).trim() : "",
  });

  if (!isStaff(actor.role)) {
    try {
      await staffNotificationService.createGuestSubmitted(doc, body);
    } catch (err) {
      console.warn("[bookings] staff notification:", err.message);
    }
  }

  const fresh = await findOneBookingWithPopulateOrRaw(doc._id);
  return toPublicBooking(fresh, { includeIdPhotoData: true });
}

async function update(bookingId, body, actor) {
  if (!mongoose.isValidObjectId(bookingId)) {
    const err = new Error("Invalid booking id");
    err.status = 400;
    throw err;
  }
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const err = new Error("Booking not found");
    err.status = 404;
    throw err;
  }
  assertCanAccess(actor, booking);

  const assign = [
    "customerName",
    "email",
    "contactNumber",
    "address",
    "status",
    "additionalRequests",
    "declineReason",
    "roomId",
    "roomNumber",
    "roomTitle",
    "checkIn",
    "checkOut",
    "eventVenueId",
    "venueName",
    "venuePrice",
    "totalAmount",
    "eventTitle",
    "eventDate",
    "eventEndDate",
    "timeSlot",
    "paymentAmount",
    "paymentMethod",
    "transactionId",
  ];

  for (const key of assign) {
    if (body[key] !== undefined) {
      if (key === "email") {
        booking.email = String(body.email).toLowerCase().trim();
      } else {
        booking[key] = body[key];
      }
    }
  }
  if (body.additionalGuests !== undefined) {
    booking.additionalGuests = Number(body.additionalGuests);
  }
  if (body.expectedPax !== undefined) {
    booking.expectedPax = Number(body.expectedPax);
  }

  if (body.status !== undefined) {
    if (!Booking.BOOKING_STATUSES.includes(body.status)) {
      const err = new Error("Invalid status");
      err.status = 400;
      throw err;
    }
    if (!isStaff(actor.role) && body.status !== "cancelled") {
      const err = new Error("Guests may only set status to cancelled");
      err.status = 403;
      throw err;
    }
  }

  if (body.type !== undefined && body.type !== booking.type) {
    const err = new Error("Cannot change booking type");
    err.status = 400;
    throw err;
  }

  await booking.save();
  const fresh = await findOneBookingWithPopulateOrRaw(booking._id);
  return toPublicBooking(fresh, { includeIdPhotoData: true });
}

async function remove(bookingId, actor) {
  if (!mongoose.isValidObjectId(bookingId)) {
    const err = new Error("Invalid booking id");
    err.status = 400;
    throw err;
  }
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const err = new Error("Booking not found");
    err.status = 404;
    throw err;
  }
  assertCanAccess(actor, booking);
  const lean = await findOneBookingWithPopulateOrRaw(booking._id);
  await Booking.deleteOne({ _id: booking._id });
  return toPublicBooking(lean, { includeIdPhotoData: false });
}

module.exports = {
  toPublicBooking,
  findBookingsWithPopulateOrRaw,
  findOneBookingWithPopulateOrRaw,
  hydrateRawBookings,
  list,
  getById,
  create,
  update,
  remove,
};
