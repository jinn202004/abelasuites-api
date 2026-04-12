const mongoose = require("mongoose");
const Booking = require("../models/Booking");

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

function toPublicBooking(doc) {
  if (!doc) return null;
  const o = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    id: o._id,
    type: o.type,
    userId: o.userId,
    customerName: o.customerName ?? "",
    email: o.email ?? "",
    contactNumber: o.contactNumber ?? "",
    address: o.address ?? "",
    status: o.status ?? "pending",
    additionalRequests: o.additionalRequests ?? "",
    declineReason: o.declineReason ?? "",
    roomId: o.roomId ?? "",
    roomTitle: o.roomTitle ?? "",
    checkIn: o.checkIn ?? "",
    checkOut: o.checkOut ?? "",
    additionalGuests: o.additionalGuests ?? 0,
    guestId: o.guestId ?? "",
    guestIdPhotoName: o.guestIdPhotoName ?? "",
    guestIdPhotoData: o.guestIdPhotoData ?? "",
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
  const q = isStaff(actor.role) ? {} : { userId: actor.id };
  const rows = await Booking.find(q).sort({ createdAt: -1 }).lean();
  return rows.map((r) => toPublicBooking(r));
}

async function getById(bookingId, actor) {
  if (!mongoose.isValidObjectId(bookingId)) return null;
  const doc = await Booking.findById(bookingId).lean();
  if (!doc) return null;
  assertCanAccess(actor, doc);
  return toPublicBooking(doc);
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

  const doc = await Booking.create({
    type: body.type,
    userId: actor.id,
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
    guestId: body.guestId !== undefined ? String(body.guestId).trim() : "",
    guestIdPhotoName: body.guestIdPhotoName !== undefined ? String(body.guestIdPhotoName) : "",
    guestIdPhotoData: body.guestIdPhotoData !== undefined ? String(body.guestIdPhotoData) : "",
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

  return toPublicBooking(doc);
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
    "roomTitle",
    "checkIn",
    "checkOut",
    "guestId",
    "guestIdPhotoName",
    "guestIdPhotoData",
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
  const fresh = await Booking.findById(booking._id).lean();
  return toPublicBooking(fresh);
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
  await Booking.deleteOne({ _id: booking._id });
  return toPublicBooking(booking);
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
};
