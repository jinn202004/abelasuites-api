const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const Guest = require("../models/Guest");
const guestNotificationService = require("./guestNotification.service");
const {
  toPublicBooking,
  findBookingsWithPopulateOrRaw,
  findOneBookingWithPopulateOrRaw,
} = require("./booking.service");
const housekeepingService = require("./housekeeping.service");

async function notifyGuestOfOutcome(fresh, outcome) {
  try {
    await guestNotificationService.createForBookingOutcome(fresh, outcome);
  } catch (err) {
    console.warn("[bookingApproval] guest notification:", err.message);
  }
}

const HISTORY_STATUSES = ["approved", "rejected", "declined"];

function assertValidId(bookingId) {
  if (!mongoose.isValidObjectId(bookingId)) {
    const err = new Error("Invalid booking id");
    err.status = 400;
    throw err;
  }
}

function isPendingStatus(status) {
  return String(status ?? "")
    .trim()
    .toLowerCase() === "pending";
}

function assertPending(booking) {
  if (!booking) {
    const err = new Error("Booking not found");
    err.status = 404;
    throw err;
  }
  if (!isPendingStatus(booking.status)) {
    const err = new Error("Only pending bookings can be approved or rejected");
    err.status = 409;
    throw err;
  }
}

/**
 * Fix missing/invalid `guestId` (e.g. "" in DB) by linking the Guest profile for this booking email
 * so staff see the same ID photo and contact info as the guest record.
 * @param {import("mongoose").Document} bookingDoc
 */
async function ensureBookingGuestLinked(bookingDoc) {
  if (!bookingDoc) return;
  const raw = bookingDoc.guestId;
  const idStr =
    raw != null && raw !== ""
      ? String(typeof raw === "object" && raw._id != null ? raw._id : raw)
      : "";
  if (idStr && mongoose.isValidObjectId(idStr)) return;

  const email = String(bookingDoc.email || "")
    .toLowerCase()
    .trim();
  if (email) {
    const g = await Guest.findOne({ email }).select("_id").lean();
    if (g && g._id) {
      bookingDoc.set("guestId", g._id);
      return;
    }
  }
  bookingDoc.set("guestId", null);
}

/**
 * Same resolution for raw MongoDB booking docs (when Mongoose findById fails).
 * @returns {import("mongoose").Types.ObjectId | null | undefined} `undefined` = leave guestId unchanged
 */
async function guestIdPatchForRawBooking(raw) {
  if (!raw) return undefined;
  const gid = raw.guestId;
  const idStr =
    gid != null && gid !== ""
      ? String(typeof gid === "object" && gid._id != null ? gid._id : gid)
      : "";
  if (idStr && mongoose.isValidObjectId(idStr)) return undefined;

  const email = String(raw.email || "")
    .toLowerCase()
    .trim();
  if (email) {
    const g = await Guest.findOne({ email }).select("_id").lean();
    if (g && g._id) return g._id;
  }
  return null;
}

async function getPendingBookingsWithGuest() {
  const rows = await findBookingsWithPopulateOrRaw({ status: "pending" }, { createdAt: -1 });
  return rows.map((r) => toPublicBooking(r, { includeIdPhotoData: true }));
}

async function getBookingHistoryWithGuest() {
  const rows = await findBookingsWithPopulateOrRaw(
    { status: { $in: HISTORY_STATUSES } },
    { approvedAt: -1, updatedAt: -1 }
  );
  return rows.map((r) => toPublicBooking(r, { includeIdPhotoData: true }));
}

async function approveBooking(bookingId, approverUserId) {
  assertValidId(bookingId);
  let booking = null;
  try {
    booking = await Booking.findById(bookingId);
  } catch {
    booking = null;
  }
  if (!booking) {
    const raw = await mongoose.connection
      .collection("bookings")
      .findOne({ _id: new mongoose.Types.ObjectId(bookingId) });
    assertPending(raw);
    const gidPatch = await guestIdPatchForRawBooking(raw);
    const $set = {
      status: "approved",
      approvedBy: new mongoose.Types.ObjectId(String(approverUserId)),
      approvedAt: new Date(),
    };
    if (gidPatch !== undefined) {
      $set.guestId = gidPatch;
    }
    await mongoose.connection.collection("bookings").updateOne({ _id: raw._id }, { $set });
    const fresh = await findOneBookingWithPopulateOrRaw(bookingId);
    await notifyGuestOfOutcome(fresh, "approved");
    try {
      await housekeepingService.triggerAfterBookingApproved(fresh);
    } catch (err) {
      console.warn("[bookingApproval] housekeeping:", err.message);
    }
    return toPublicBooking(fresh, { includeIdPhotoData: true });
  }

  assertPending(booking);

  await ensureBookingGuestLinked(booking);
  booking.status = "approved";
  booking.approvedBy = new mongoose.Types.ObjectId(String(approverUserId));
  booking.approvedAt = new Date();
  await booking.save();

  const fresh = await findOneBookingWithPopulateOrRaw(booking._id);
  await notifyGuestOfOutcome(fresh, "approved");
  try {
    await housekeepingService.triggerAfterBookingApproved(fresh);
  } catch (err) {
    console.warn("[bookingApproval] housekeeping:", err.message);
  }
  return toPublicBooking(fresh, { includeIdPhotoData: true });
}

async function rejectBooking(bookingId, approverUserId, declineReason) {
  assertValidId(bookingId);
  let booking = null;
  try {
    booking = await Booking.findById(bookingId);
  } catch {
    booking = null;
  }
  if (!booking) {
    const raw = await mongoose.connection
      .collection("bookings")
      .findOne({ _id: new mongoose.Types.ObjectId(bookingId) });
    assertPending(raw);
    const gidPatch = await guestIdPatchForRawBooking(raw);
    const $set = {
      status: "rejected",
      approvedBy: new mongoose.Types.ObjectId(String(approverUserId)),
      approvedAt: new Date(),
    };
    if (gidPatch !== undefined) {
      $set.guestId = gidPatch;
    }
    if (declineReason !== undefined && declineReason !== null) {
      $set.declineReason = String(declineReason).trim();
    }
    await mongoose.connection.collection("bookings").updateOne({ _id: raw._id }, { $set });
    const fresh = await findOneBookingWithPopulateOrRaw(bookingId);
    await notifyGuestOfOutcome(fresh, "rejected");
    return toPublicBooking(fresh, { includeIdPhotoData: true });
  }

  assertPending(booking);

  await ensureBookingGuestLinked(booking);
  booking.status = "rejected";
  booking.approvedBy = new mongoose.Types.ObjectId(String(approverUserId));
  booking.approvedAt = new Date();
  if (declineReason !== undefined && declineReason !== null) {
    booking.declineReason = String(declineReason).trim();
  }
  await booking.save();

  const fresh = await findOneBookingWithPopulateOrRaw(booking._id);
  await notifyGuestOfOutcome(fresh, "rejected");
  return toPublicBooking(fresh, { includeIdPhotoData: true });
}

module.exports = {
  getPendingBookingsWithGuest,
  getBookingHistoryWithGuest,
  approveBooking,
  rejectBooking,
};
