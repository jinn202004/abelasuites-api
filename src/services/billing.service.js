const mongoose = require("mongoose");
const Billing = require("../models/Billing");
const Booking = require("../models/Booking");
const Guest = require("../models/Guest");
const { toBillingGuestShape, findGuestByUserId } = require("./guest.service");

/** May list billing ledgers and open guest billing detail (read). */
const BILLING_READER_ROLES = new Set(["admin", "frontdesk", "cashier"]);

/** May apply `PUT /api/billing/:id/payment` (admin override + cashier). */
const BILLING_PAYMENT_ROLES = new Set(["admin", "cashier"]);

function parseMoneyAmount(v) {
  if (v == null || v === "") return NaN;
  const n = Number(String(v).replace(/[₱,\s]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

function roundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function isBillingReader(role) {
  return BILLING_READER_ROLES.has(role);
}

function canUpdateBillingPayment(role) {
  return BILLING_PAYMENT_ROLES.has(role);
}

function resolveGuestObjectId(bookingDoc) {
  const g = bookingDoc.guestId;
  if (g && typeof g === "object" && g._id) return g._id;
  if (mongoose.isValidObjectId(g)) return new mongoose.Types.ObjectId(String(g));
  return null;
}

function deriveBookingTotal(bookingDoc) {
  const total = parseMoneyAmount(bookingDoc.totalAmount);
  if (Number.isFinite(total) && total > 0) return roundMoney(total);
  if (bookingDoc.type === "event") {
    const vp = parseMoneyAmount(bookingDoc.venuePrice);
    if (Number.isFinite(vp) && vp > 0) return roundMoney(vp);
  }
  return 0;
}

function bookingRoomOrVenueLabel(bookingDoc) {
  if (bookingDoc.type === "event") {
    return (
      String(bookingDoc.venueName || "").trim() ||
      String(bookingDoc.eventTitle || "").trim() ||
      "Event"
    );
  }
  const num = String(bookingDoc.roomNumber || "").trim();
  const title = String(bookingDoc.roomTitle || "").trim();
  if (num && title) return `${title} (${num})`;
  if (num) return `Room ${num}`;
  if (title) return title;
  const rid = String(bookingDoc.roomId || "").trim();
  return rid || "Room";
}

function balanceFrom(total, paid) {
  return roundMoney(Math.max(0, (Number(total) || 0) - (Number(paid) || 0)));
}

function toBillingPayload(billingDoc, guestDoc, bookingDoc) {
  const g = guestDoc || {};
  const b = bookingDoc || {};
  const bill = billingDoc;
  const totalAmount = Number(bill.totalAmount) || 0;
  const amountPaid = Number(bill.amountPaid) || 0;
  const balance = balanceFrom(totalAmount, amountPaid);
  return {
    id: String(bill._id),
    guest: toBillingGuestShape(g, b),
    booking: {
      id: String(b._id),
      type: b.type,
      room: bookingRoomOrVenueLabel(b),
      roomId: String(b.roomId || "").trim(),
      roomNumber: String(b.roomNumber || "").trim(),
      roomTitle: String(b.roomTitle || "").trim(),
      venueName: String(b.venueName || "").trim(),
      eventTitle: String(b.eventTitle || "").trim(),
      status: b.status ?? "pending",
      checkIn: b.checkIn ?? "",
      checkOut: b.checkOut ?? "",
      eventDate: b.eventDate ?? "",
    },
    billing: {
      totalAmount,
      amountPaid,
      balance,
      paymentStatus: bill.paymentStatus,
      createdAt: bill.createdAt,
      updatedAt: bill.updatedAt,
    },
  };
}

async function loadBookingLean(bookingId) {
  if (!mongoose.isValidObjectId(bookingId)) return null;
  return Booking.findById(bookingId).populate({ path: "guestId", model: "Guest" }).lean();
}

async function loadGuestLean(guestId) {
  if (!guestId || !mongoose.isValidObjectId(guestId)) return null;
  return Guest.findById(guestId).lean();
}

/**
 * Guest may view billing if their user account owns the Guest profile or owns the booking.
 */
function guestActorMatches(actor, guestDoc, bookingDoc) {
  if (!actor?.id) return false;
  const uid = String(actor.id);
  if (bookingDoc && String(bookingDoc.userId) === uid) return true;
  if (guestDoc && guestDoc.userId && String(guestDoc.userId) === uid) return true;
  return false;
}

function assertCanViewBilling(actor, guestDoc, bookingDoc) {
  if (isBillingReader(actor.role)) return;
  if (guestActorMatches(actor, guestDoc, bookingDoc)) return;
  const err = new Error("Forbidden");
  err.status = 403;
  throw err;
}

async function ensureBillingForBooking(bookingDoc) {
  if (!bookingDoc?._id) return null;
  const existing = await Billing.findOne({ bookingId: bookingDoc._id });
  if (existing) return existing;

  const guestId = resolveGuestObjectId(bookingDoc);
  if (!guestId) return null;

  const safeTotal = roundMoney(deriveBookingTotal(bookingDoc));
  let paid = roundMoney(parseMoneyAmount(bookingDoc.paymentAmount) || 0);
  if (!Number.isFinite(paid) || paid < 0) paid = 0;
  if (safeTotal <= 0) paid = 0;
  else paid = Math.min(paid, safeTotal);
  const safePaid = paid;

  try {
    return await Billing.create({
      guestId,
      bookingId: bookingDoc._id,
      totalAmount: safeTotal,
      amountPaid: safePaid,
    });
  } catch (err) {
    if (err && err.code === 11000) {
      return Billing.findOne({ bookingId: bookingDoc._id });
    }
    throw err;
  }
}

/**
 * Keeps Billing in sync when a booking is updated (e.g. guest payment fields on the booking).
 */
async function syncBillingFromBooking(bookingId) {
  const booking = await loadBookingLean(bookingId);
  if (!booking) return null;
  let bill = await Billing.findOne({ bookingId: booking._id });
  if (!bill) {
    bill = await ensureBillingForBooking(booking);
    return bill;
  }

  const derivedTotal = deriveBookingTotal(booking);
  const paidFromBooking = roundMoney(parseMoneyAmount(booking.paymentAmount) || 0);
  if (derivedTotal > 0) bill.totalAmount = derivedTotal;
  bill.amountPaid = Math.min(paidFromBooking, bill.totalAmount);
  await bill.save();
  return bill;
}

async function persistBookingPaymentString(bookingId, amountPaidNum) {
  if (!mongoose.isValidObjectId(bookingId)) return;
  const paid = roundMoney(amountPaidNum);
  await Booking.updateOne({ _id: bookingId }, { $set: { paymentAmount: String(paid) } });
}

async function getBillingBundleByBillingId(billingId) {
  if (!mongoose.isValidObjectId(billingId)) return null;
  const bill = await Billing.findById(billingId).lean();
  if (!bill) return null;
  const [booking, guest] = await Promise.all([
    loadBookingLean(bill.bookingId),
    loadGuestLean(bill.guestId),
  ]);
  return { bill, booking, guest };
}

async function getGuestBillingDetails(billingId, actor) {
  const bundle = await getBillingBundleByBillingId(billingId);
  if (!bundle) {
    const err = new Error("Billing record not found");
    err.status = 404;
    throw err;
  }
  const { bill, booking, guest } = bundle;
  if (!booking) {
    const err = new Error("Billing record not found");
    err.status = 404;
    throw err;
  }
  assertCanViewBilling(actor, guest, booking);
  return toBillingPayload(bill, guest, booking);
}

async function getAllBillingRecords(actor) {
  if (!isBillingReader(actor.role)) {
    const err = new Error("Forbidden");
    err.status = 403;
    throw err;
  }
  const rows = await Billing.find({}).sort({ createdAt: -1 }).lean();
  const out = [];
  for (const bill of rows) {
    const [booking, guest] = await Promise.all([
      loadBookingLean(bill.bookingId),
      loadGuestLean(bill.guestId),
    ]);
    if (!booking) continue;
    out.push(toBillingPayload(bill, guest, booking));
  }
  return out;
}

async function getMyBillingRecords(actor) {
  const guestProfile = await findGuestByUserId(actor.id);
  const guestOid = guestProfile?._id;

  const bookingQuery = { userId: new mongoose.Types.ObjectId(String(actor.id)) };
  const bookings = await Booking.find(bookingQuery).lean();
  const idsFromBookings = bookings.map((b) => b._id);

  const or = [{ bookingId: { $in: idsFromBookings } }];
  if (guestOid) or.push({ guestId: guestOid });

  const bills = await Billing.find({ $or: or }).sort({ createdAt: -1 }).lean();
  const seen = new Set();
  const out = [];
  for (const bill of bills) {
    const key = String(bill._id);
    if (seen.has(key)) continue;
    seen.add(key);
    const [booking, guest] = await Promise.all([
      loadBookingLean(bill.bookingId),
      loadGuestLean(bill.guestId),
    ]);
    if (!booking) continue;
    if (!guestActorMatches(actor, guest, booking)) continue;
    out.push(toBillingPayload(bill, guest, booking));
  }
  return out;
}

function validateAmountPaid(body) {
  if (!body || body.amountPaid === undefined) {
    const err = new Error("amountPaid is required");
    err.status = 400;
    throw err;
  }
  const raw = body.amountPaid;
  const n = typeof raw === "string" ? parseMoneyAmount(raw) : Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    const err = new Error("amountPaid must be a non-negative number");
    err.status = 400;
    throw err;
  }
  return roundMoney(n);
}

async function updatePayment(billingId, body, actor) {
  if (!canUpdateBillingPayment(actor.role)) {
    const err = new Error("Forbidden");
    err.status = 403;
    throw err;
  }
  if (!mongoose.isValidObjectId(billingId)) {
    const err = new Error("Invalid billing id");
    err.status = 400;
    throw err;
  }
  const amountPaid = validateAmountPaid(body);
  const bill = await Billing.findById(billingId);
  if (!bill) {
    const err = new Error("Billing record not found");
    err.status = 404;
    throw err;
  }
  const total = Number(bill.totalAmount) || 0;
  if (amountPaid > total + 1e-6) {
    const err = new Error("amountPaid cannot exceed totalAmount");
    err.status = 400;
    throw err;
  }
  bill.amountPaid = amountPaid;
  await bill.save();
  await persistBookingPaymentString(bill.bookingId, amountPaid);

  const bundle = await getBillingBundleByBillingId(bill._id);
  return toBillingPayload(bundle.bill, bundle.guest, bundle.booking);
}

module.exports = {
  ensureBillingForBooking,
  syncBillingFromBooking,
  getGuestBillingDetails,
  getAllBillingRecords,
  getMyBillingRecords,
  updatePayment,
  parseMoneyAmount,
  deriveBookingTotal,
  toBillingPayload,
};
