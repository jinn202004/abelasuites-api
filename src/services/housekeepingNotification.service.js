const mongoose = require("mongoose");
const HousekeepingNotification = require("../models/HousekeepingNotification");

function userHasRead(doc, userId) {
  const uid = String(userId);
  const arr = doc.readByUserIds || [];
  return arr.some((id) => String(id) === uid);
}

/**
 * Idempotent: one row per (taskId, type) — only inserts on first create.
 */
async function createCleaningTaskNew(taskId, bookingId, message) {
  const tid = mongoose.isValidObjectId(taskId) ? new mongoose.Types.ObjectId(String(taskId)) : null;
  const bid = mongoose.isValidObjectId(bookingId) ? new mongoose.Types.ObjectId(String(bookingId)) : null;
  if (!tid || !bid) return;

  await HousekeepingNotification.findOneAndUpdate(
    { taskId: tid, type: "cleaning_task_new" },
    {
      $setOnInsert: {
        taskId: tid,
        bookingId: bid,
        type: "cleaning_task_new",
        message: String(message || "").trim() || "New cleaning task assigned.",
        readByUserIds: [],
      },
    },
    { upsert: true, new: true }
  );
}

async function listForUser(userId) {
  const rows = await HousekeepingNotification.find({})
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const notifications = rows.map((r) => ({
    id: String(r._id),
    taskId: r.taskId != null ? String(r.taskId) : "",
    bookingId: r.bookingId != null ? String(r.bookingId) : "",
    message: r.message || "",
    read: userHasRead(r, userId),
    createdAt: r.createdAt,
  }));
  const unreadCount = notifications.filter((n) => !n.read).length;
  return { notifications, unreadCount };
}

async function markAllRead(userId) {
  const oid = new mongoose.Types.ObjectId(String(userId));
  await HousekeepingNotification.updateMany({}, { $addToSet: { readByUserIds: oid } });
}

module.exports = {
  createCleaningTaskNew,
  listForUser,
  markAllRead,
};
