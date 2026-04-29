const mongoose = require("mongoose");
const GuestNotification = require("../models/GuestNotification");
const Booking = require("../models/Booking");

function bookingLabel(doc) {
  if (!doc || typeof doc !== "object") return "your booking";
  if (doc.type === "event") {
    const t = doc.eventTitle || doc.venueName || "";
    return t ? String(t).trim().slice(0, 120) : "your event";
  }
  const t = doc.roomTitle || doc.roomId || "";
  return t ? String(t).trim().slice(0, 120) : "your room";
}

function buildMessage(doc, outcome) {
  const kind = doc?.type === "event" ? "event booking" : "room reservation";
  const label = bookingLabel(doc);
  const verb = outcome === "approved" ? "approved" : "rejected";
  let msg = `Your ${kind} (${label}) was ${verb}.`;
  if (outcome === "rejected" && doc?.declineReason && String(doc.declineReason).trim()) {
    msg += ` Reason: ${String(doc.declineReason).trim().slice(0, 300)}`;
  }
  return msg;
}

function resolveObjectId(v) {
  if (v == null) return null;
  if (typeof v === "object" && v._id) return v._id;
  if (mongoose.isValidObjectId(v)) return v;
  return null;
}

function extractUserId(doc) {
  if (!doc) return null;
  const fromBooking = resolveObjectId(doc.userId);
  if (fromBooking) return fromBooking;
  const g = doc.guestId;
  if (g && typeof g === "object" && g.userId != null) {
    return resolveObjectId(g.userId);
  }
  return null;
}

function extractBookingId(doc) {
  if (!doc) return null;
  const id = doc._id;
  if (id && typeof id === "object" && id.toString) return id;
  if (mongoose.isValidObjectId(id)) return id;
  return null;
}

/**
 * Persist a guest-visible notification after staff approves or rejects a booking.
 * @param {object} bookingLean — populated or lean booking doc
 * @param {'approved'|'rejected'} outcome
 */
async function createForBookingOutcome(bookingLean, outcome) {
  const userId = extractUserId(bookingLean);
  const bookingId = extractBookingId(bookingLean);
  if (!userId || !bookingId) return null;

  const type = outcome === "approved" ? "booking_approved" : "booking_rejected";
  const message = buildMessage(bookingLean, outcome);

  const doc = await GuestNotification.create({
    userId,
    bookingId,
    type,
    message,
    read: false,
  });
  return doc;
}

function toPublic(doc) {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(o._id),
    bookingId: o.bookingId ? String(o.bookingId) : null,
    type: o.type,
    message: o.message || "",
    read: !!o.read,
    createdAt: o.createdAt ? o.createdAt.toISOString() : null,
  };
}

/** Snapshot of the linked booking for the guest notification panel (full context). */
function bookingSummaryPublic(b) {
  if (!b || typeof b !== "object") return null;
  return {
    id: b._id != null ? String(b._id) : "",
    type: b.type || "",
    status: b.status || "",
    customerName: String(b.customerName || "").trim(),
    email: String(b.email || "").trim(),
    contactNumber: String(b.contactNumber || "").trim(),
    address: String(b.address || "").trim(),
    roomId: String(b.roomId || "").trim(),
    roomNumber: String(b.roomNumber || "").trim(),
    roomTitle: String(b.roomTitle || "").trim(),
    checkIn: String(b.checkIn || "").trim(),
    checkOut: String(b.checkOut || "").trim(),
    eventVenueId: String(b.eventVenueId || "").trim(),
    venueName: String(b.venueName || "").trim(),
    venuePrice: String(b.venuePrice || "").trim(),
    eventTitle: String(b.eventTitle || "").trim(),
    eventDate: String(b.eventDate || "").trim(),
    eventEndDate: String(b.eventEndDate || "").trim(),
    timeSlot: String(b.timeSlot || "").trim(),
    expectedPax: b.expectedPax != null ? Number(b.expectedPax) : null,
    declineReason: String(b.declineReason || "").trim(),
    totalAmount: String(b.totalAmount || "").trim(),
    paymentAmount: String(b.paymentAmount || "").trim(),
    paymentMethod: String(b.paymentMethod || "").trim(),
    transactionId: String(b.transactionId || "").trim(),
    additionalRequests: String(b.additionalRequests || "").trim(),
  };
}

async function attachBookingsToNotificationRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const ids = [];
  for (const r of rows) {
    const bid = r.bookingId;
    if (bid != null && mongoose.isValidObjectId(bid)) {
      ids.push(new mongoose.Types.ObjectId(String(bid)));
    }
  }
  if (ids.length === 0) {
    return rows.map((r) => ({ ...toPublic(r), booking: null }));
  }
  const bookings = await Booking.find({ _id: { $in: ids } }).lean();
  const byId = new Map(bookings.map((b) => [String(b._id), b]));
  return rows.map((r) => {
    const pub = toPublic(r);
    const key = r.bookingId != null ? String(r.bookingId) : "";
    const b = key && byId.has(key) ? byId.get(key) : null;
    return { ...pub, booking: bookingSummaryPublic(b) };
  });
}

async function listForUser(userId, { limit = 50 } = {}) {
  const uid = new mongoose.Types.ObjectId(String(userId));
  const rows = await GuestNotification.find({ userId: uid })
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 50, 100))
    .lean();
  const notifications = await attachBookingsToNotificationRows(rows);
  const unreadCount = notifications.filter((n) => !n.read).length;
  return { notifications, unreadCount };
}

async function markRead(userId, notificationId) {
  if (!mongoose.isValidObjectId(notificationId)) {
    const err = new Error("Invalid notification id");
    err.status = 400;
    throw err;
  }
  const uid = new mongoose.Types.ObjectId(String(userId));
  const nid = new mongoose.Types.ObjectId(String(notificationId));
  const updated = await GuestNotification.findOneAndUpdate(
    { _id: nid, userId: uid },
    { $set: { read: true } },
    { new: true }
  ).lean();
  if (!updated) {
    const err = new Error("Notification not found");
    err.status = 404;
    throw err;
  }
  const [enriched] = await attachBookingsToNotificationRows([updated]);
  return enriched || toPublic(updated);
}

async function markAllRead(userId) {
  const uid = new mongoose.Types.ObjectId(String(userId));
  await GuestNotification.updateMany({ userId: uid, read: false }, { $set: { read: true } });
  return { ok: true };
}

module.exports = {
  createForBookingOutcome,
  listForUser,
  markRead,
  markAllRead,
};
