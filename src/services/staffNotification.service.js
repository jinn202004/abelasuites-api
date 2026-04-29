const mongoose = require("mongoose");
const StaffNotification = require("../models/StaffNotification");

function userHasRead(doc, userId) {
  const uid = String(userId);
  const arr = doc.readByUserIds || [];
  return arr.some((id) => String(id) === uid);
}

/**
 * Idempotent: one row per (bookingId, type) so guest retries do not spam.
 */
async function createGuestSubmitted(bookingDoc, body) {
  const bookingId = bookingDoc._id;
  const name = String(body.customerName || "").trim() || "Guest";
  const bt = body.type === "event" ? "event" : "room";
  const message =
    bt === "event"
      ? `${name} submitted an event booking — needs your confirmation.`
      : `${name} submitted a room reservation — needs your confirmation.`;

  await StaffNotification.findOneAndUpdate(
    { bookingId, type: "booking_review" },
    {
      $setOnInsert: {
        bookingId,
        type: "booking_review",
        message,
        readByUserIds: [],
      },
    },
    { upsert: true, new: true }
  );
}

async function listForUser(userId) {
  const rows = await StaffNotification.find({})
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const notifications = rows.map((r) => ({
    id: String(r._id),
    bookingId: r.bookingId != null ? String(r.bookingId) : "",
    type: r.type || "",
    message: r.message || "",
    read: userHasRead(r, userId),
    createdAt: r.createdAt,
  }));
  const unreadCount = notifications.filter((n) => !n.read).length;
  return { notifications, unreadCount };
}

async function markAllRead(userId) {
  const oid = new mongoose.Types.ObjectId(String(userId));
  await StaffNotification.updateMany({}, { $addToSet: { readByUserIds: oid } });
}

async function markRead(userId, notificationId) {
  if (!mongoose.isValidObjectId(notificationId)) {
    const err = new Error("Invalid notification id");
    err.status = 400;
    throw err;
  }
  const uid = new mongoose.Types.ObjectId(String(userId));
  const nid = new mongoose.Types.ObjectId(String(notificationId));
  const updated = await StaffNotification.findByIdAndUpdate(
    nid,
    { $addToSet: { readByUserIds: uid } },
    { new: true }
  ).lean();
  if (!updated) {
    const err = new Error("Notification not found");
    err.status = 404;
    throw err;
  }
  return {
    id: String(updated._id),
    bookingId: updated.bookingId != null ? String(updated.bookingId) : "",
    type: updated.type || "",
    message: updated.message || "",
    read: userHasRead(updated, userId),
    createdAt: updated.createdAt,
  };
}

/**
 * Front desk / admin: housekeeping marked a room or venue ready after cleaning.
 * Resets read state so staff see it as new.
 */
async function createHousekeepingCleaningCompleted(bookingId, message) {
  if (!mongoose.isValidObjectId(bookingId)) return;
  const bid = new mongoose.Types.ObjectId(String(bookingId));
  const msg = String(message || "").trim() || "Housekeeping finished cleaning — venue or room is ready.";
  await StaffNotification.findOneAndUpdate(
    { bookingId: bid, type: "housekeeping_cleaning_completed" },
    {
      $set: {
        bookingId: bid,
        type: "housekeeping_cleaning_completed",
        message: msg,
        readByUserIds: [],
      },
    },
    { upsert: true, new: true }
  );
}

module.exports = {
  createGuestSubmitted,
  createHousekeepingCleaningCompleted,
  listForUser,
  markRead,
  markAllRead,
};
