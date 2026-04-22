const mongoose = require("mongoose");
const GuestNotification = require("../models/GuestNotification");

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

async function listForUser(userId, { limit = 50 } = {}) {
  const uid = new mongoose.Types.ObjectId(String(userId));
  const rows = await GuestNotification.find({ userId: uid })
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 50, 100))
    .lean();
  const notifications = rows.map((r) => toPublic(r));
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
  return toPublic(updated);
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
