const mongoose = require("mongoose");
const Review = require("../models/Review");
const Booking = require("../models/Booking");
const Guest = require("../models/Guest");
const { findGuestByUserId } = require("./guest.service");
const { AUTO_APPROVE_REVIEWS } = require("../config");

function oid(id) {
  if (id == null) return null;
  const s = String(id).trim();
  return mongoose.isValidObjectId(s) ? new mongoose.Types.ObjectId(s) : null;
}

function guestDisplayName(gDoc) {
  if (!gDoc) return "";
  return String(gDoc.displayName || "").trim();
}

/**
 * Resolve Guest _id for the actor and ensure they own the booking.
 * @param {{ id: string }} actor — req.user
 * @param {object} booking — lean booking
 */
async function resolveGuestForBooking(actor, booking) {
  if (!actor?.id || !booking) return null;
  const uid = String(actor.id);
  if (String(booking.userId) !== uid) {
    const err = new Error("You can only review your own bookings");
    err.status = 403;
    throw err;
  }

  let guestId = booking.guestId;
  if (guestId && mongoose.isValidObjectId(guestId)) {
    const g = await Guest.findById(guestId).lean();
    if (g) return g._id;
  }
  if (guestId && typeof guestId === "object" && guestId._id) {
    return guestId._id;
  }

  const g = await findGuestByUserId(uid);
  if (!g || !g._id) {
    const err = new Error("Guest profile required to submit a review. Complete a booking with your profile.");
    err.status = 400;
    throw err;
  }
  return g._id;
}

function parseRating(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 5) return NaN;
  return n;
}

function parseComment(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (s.length > 2000) return null;
  return s;
}

function toPublicReview(doc) {
  if (!doc) return null;
  const o = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    id: String(o._id),
    guestId: String(o.guestId),
    bookingId: String(o.bookingId),
    rating: o.rating,
    comment: o.comment,
    isApproved: Boolean(o.isApproved),
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

/**
 * @param {{ id: string, role: string }} actor
 * @param {{ bookingId: string, rating: number, comment: string }} body
 */
async function createReview(actor, body) {
  const bookingId = oid(body?.bookingId);
  if (!bookingId) {
    const err = new Error("Invalid booking id");
    err.status = 400;
    throw err;
  }

  const rating = parseRating(body?.rating);
  if (Number.isNaN(rating)) {
    const err = new Error("rating must be an integer from 1 to 5");
    err.status = 400;
    throw err;
  }

  const comment = parseComment(body?.comment);
  if (!comment) {
    const err = new Error("comment is required (max 2000 characters)");
    err.status = 400;
    throw err;
  }

  const booking = await Booking.findById(bookingId).lean();
  if (!booking) {
    const err = new Error("Booking not found");
    err.status = 404;
    throw err;
  }

  const st = String(booking.status || "").toLowerCase();
  if (st !== "completed") {
    const err = new Error("You can only review a completed stay");
    err.status = 409;
    throw err;
  }

  const guestObjectId = await resolveGuestForBooking(actor, booking);

  try {
    const doc = await Review.create({
      guestId: guestObjectId,
      bookingId,
      rating,
      comment,
      isApproved: AUTO_APPROVE_REVIEWS === true,
    });
    return toPublicReview(doc);
  } catch (e) {
    if (e && e.code === 11000) {
      const err = new Error("A review for this booking already exists");
      err.status = 409;
      throw err;
    }
    throw e;
  }
}

/** Guest: reviews submitted under their profile */
async function listMine(actor) {
  const g = await findGuestByUserId(actor.id);
  if (!g?._id) return [];
  const rows = await Review.find({ guestId: g._id })
    .select("bookingId isApproved rating createdAt")
    .sort({ createdAt: -1 })
    .lean();
  return rows.map((r) => ({
    id: String(r._id),
    bookingId: String(r.bookingId),
    isApproved: Boolean(r.isApproved),
    rating: r.rating,
    createdAt: r.createdAt,
  }));
}

/** Staff: all reviews for moderation */
async function listAllForStaff() {
  const rows = await Review.find({})
    .populate({ path: "guestId", select: "displayName email" })
    .populate({ path: "bookingId", select: "customerName type status checkIn checkOut" })
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();

  return rows.map((r) => {
    const guest = r.guestId && typeof r.guestId === "object" ? r.guestId : null;
    const booking = r.bookingId && typeof r.bookingId === "object" ? r.bookingId : null;
    return {
      id: String(r._id),
      guestId: guest ? String(guest._id) : String(r.guestId),
      guestName: guestDisplayName(guest) || String(booking?.customerName || "").trim() || "Guest",
      bookingId: booking ? String(booking._id) : String(r.bookingId),
      bookingStatus: booking?.status ?? "",
      rating: r.rating,
      comment: r.comment,
      isApproved: Boolean(r.isApproved),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  });
}

async function approveReview(reviewId) {
  const id = oid(reviewId);
  if (!id) {
    const err = new Error("Invalid review id");
    err.status = 400;
    throw err;
  }
  const doc = await Review.findByIdAndUpdate(id, { isApproved: true }, { new: true }).lean();
  if (!doc) {
    const err = new Error("Review not found");
    err.status = 404;
    throw err;
  }
  return toPublicReview(doc);
}

module.exports = {
  createReview,
  listMine,
  listAllForStaff,
  approveReview,
  toPublicReview,
};
