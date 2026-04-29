const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const Billing = require("../models/Billing");
const Room = require("../models/Room");
const EventVenue = require("../models/EventVenue");
const HousekeepingTask = require("../models/HousekeepingTask");
const bookingService = require("./booking.service");
const billingService = require("./billing.service");

function toObjectIdOrNull(v) {
  if (v == null || v === "") return null;
  if (!mongoose.isValidObjectId(v)) return null;
  return new mongoose.Types.ObjectId(String(v));
}

function toMoney(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function roundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function normStatus(s) {
  return String(s || "")
    .trim()
    .toLowerCase();
}

function dateKeyLocal(d) {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Normalize booking date strings to YYYY-MM-DD (local) for “today” comparisons. */
function dateKeyFromField(val) {
  if (val == null || val === "") return "";
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return dateKeyLocal(new Date(t));
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return dateKeyLocal(d);
  return "";
}

function lineTotalFromPublicBooking(b) {
  const total = billingService.parseMoneyAmount(b.totalAmount);
  if (Number.isFinite(total) && total > 0) return roundMoney(total);
  if (normStatus(b.type) === "event") {
    const vp = billingService.parseMoneyAmount(b.venuePrice);
    if (Number.isFinite(vp) && vp > 0) return roundMoney(vp);
  }
  return 0;
}

/**
 * Dashboard cards: same booking + billing ledger rules as `/api/billing` and `/api/bookings`.
 * @param {{ id: string, email?: string, role: string }} actor
 */
async function getDashboardSummaryMetrics(actor) {
  const [bookings, billingRows] = await Promise.all([
    bookingService.list(actor),
    billingService.getAllBillingRecords(actor),
  ]);

  const billByBookingId = new Map();
  for (const row of billingRows) {
    const bid = row.booking && row.booking.id ? String(row.booking.id) : "";
    if (bid) billByBookingId.set(bid, row.billing);
  }

  const today = dateKeyLocal(new Date());
  let reservationsToday = 0;
  let checkOutsToday = 0;

  for (const b of bookings) {
    const st = normStatus(b.status);
    if (st === "cancelled" || st === "rejected" || st === "declined") continue;

    if (normStatus(b.type) === "event") {
      const start = dateKeyFromField(b.eventDate);
      if (start === today) reservationsToday += 1;
      const end = dateKeyFromField(b.eventEndDate) || start;
      if (end === today) checkOutsToday += 1;
    } else {
      if (dateKeyFromField(b.checkIn) === today) reservationsToday += 1;
      const cout = dateKeyFromField(b.checkOut);
      if (
        cout === today &&
        (st === "approved" || st === "occupied" || st === "completed" || st === "checked-out")
      ) {
        checkOutsToday += 1;
      }
    }
  }

  let totalRevenue = 0;
  let outstandingBalances = 0;
  for (const b of bookings) {
    const st = normStatus(b.status);
    if (st === "cancelled" || st === "rejected" || st === "declined") continue;
    const bid = String(b.id);
    const bill = billByBookingId.get(bid);
    if (bill) {
      totalRevenue += roundMoney(Number(bill.totalAmount) || 0);
      outstandingBalances += roundMoney(Number(bill.balance) || 0);
    } else {
      const line = lineTotalFromPublicBooking(b);
      const paid = billingService.parseMoneyAmount(b.paymentAmount) || 0;
      const safePaid = Number.isFinite(paid) && paid > 0 ? paid : 0;
      totalRevenue += line;
      outstandingBalances += roundMoney(Math.max(0, line - safePaid));
    }
  }

  return {
    reservationsToday,
    checkOutsToday,
    totalRevenue,
    outstandingBalances,
  };
}

async function loadBookingWithGuest(bookingId) {
  return Booking.findById(bookingId).populate({ path: "guestId", model: "Guest" }).lean();
}

function guestShape(booking) {
  const g = booking && booking.guestId && typeof booking.guestId === "object" ? booking.guestId : null;
  return {
    id: g && g._id ? String(g._id) : null,
    name: g && g.displayName ? String(g.displayName) : String(booking.customerName || ""),
    email: g && g.email ? String(g.email) : String(booking.email || ""),
    contact: g && g.phone ? String(g.phone) : String(booking.contactNumber || ""),
  };
}

function bookingShape(booking, roomOrEventName) {
  return {
    id: String(booking._id),
    type: booking.type || "",
    status: booking.status || "",
    roomOrEvent: roomOrEventName,
    roomId: String(booking.roomId || ""),
    eventVenueId: String(booking.eventVenueId || ""),
    createdAt: booking.createdAt || null,
    approvedAt: booking.approvedAt || null,
  };
}

function billingShape(bill) {
  if (!bill) {
    return {
      id: null,
      totalAmount: 0,
      amountPaid: 0,
      balance: 0,
      paymentStatus: "unpaid",
    };
  }
  const totalAmount = toMoney(bill.totalAmount);
  const amountPaid = toMoney(bill.amountPaid);
  const balance = Math.max(0, totalAmount - amountPaid);
  return {
    id: String(bill._id),
    totalAmount,
    amountPaid,
    balance,
    paymentStatus: bill.paymentStatus || "unpaid",
  };
}

function roomShape(targetType, roomDoc, eventDoc) {
  if (targetType === "event") {
    return {
      targetType: "event",
      id: eventDoc && eventDoc._id ? String(eventDoc._id) : null,
      name: eventDoc ? String(eventDoc.name || eventDoc.package || "") : "",
      status: eventDoc ? String(eventDoc.status || "") : "available",
      eventNum: eventDoc ? String(eventDoc.eventNum || "") : "",
    };
  }
  return {
    targetType: "room",
    id: roomDoc && roomDoc._id ? String(roomDoc._id) : null,
    name: roomDoc ? String(roomDoc.title || roomDoc.package || "") : "",
    status: roomDoc ? String(roomDoc.status || "") : "available",
    roomNumber: roomDoc ? String(roomDoc.roomNumber || "") : "",
  };
}

function housekeepingShape(task, assetStatus, targetType) {
  return {
    targetType,
    roomOrEventStatus: String(assetStatus || "available"),
    taskStatus: task ? String(task.status || "pending") : "no_task",
    taskId: task && task._id ? String(task._id) : null,
    updatedAt: task ? task.updatedAt || null : null,
  };
}

async function getFrontdeskBookingDetails(bookingId) {
  if (!mongoose.isValidObjectId(bookingId)) {
    const err = new Error("Invalid booking id");
    err.status = 400;
    throw err;
  }

  const booking = await loadBookingWithGuest(bookingId);
  if (!booking) {
    const err = new Error("Booking not found");
    err.status = 404;
    throw err;
  }

  const isEvent = String(booking.type || "").toLowerCase() === "event";
  const roomOid = !isEvent ? toObjectIdOrNull(booking.roomId) : null;
  const eventOid = isEvent ? toObjectIdOrNull(booking.eventVenueId) : null;

  const [bill, task, roomDoc, eventDoc] = await Promise.all([
    Billing.findOne({ bookingId: booking._id }).lean(),
    HousekeepingTask.findOne({ bookingId: booking._id }).sort({ createdAt: -1 }).lean(),
    roomOid ? Room.findById(roomOid).lean() : null,
    eventOid ? EventVenue.findById(eventOid).lean() : null,
  ]);

  const roomOrEventName = isEvent
    ? String(
        booking.venueName ||
          (eventDoc && (eventDoc.name || eventDoc.package)) ||
          booking.eventTitle ||
          "Event booking"
      )
    : String(
        booking.roomTitle ||
          (roomDoc && (roomDoc.title || roomDoc.package || roomDoc.roomNumber)) ||
          booking.roomNumber ||
          "Room reservation"
      );

  const roomData = roomShape(isEvent ? "event" : "room", roomDoc, eventDoc);

  return {
    guest: guestShape(booking),
    booking: bookingShape(booking, roomOrEventName),
    billing: billingShape(bill),
    room: roomData,
    housekeeping: housekeepingShape(task, roomData.status, roomData.targetType),
  };
}

module.exports = {
  getFrontdeskBookingDetails,
  getDashboardSummaryMetrics,
};
