const mongoose = require("mongoose");

const BOOKING_TYPES = ["room", "event"];

const BOOKING_STATUSES = [
  "pending",
  "approved",
  "occupied",
  "rejected",
  "confirmed",
  "declined",
  "cancelled",
  "completed",
];

const bookingSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: BOOKING_TYPES,
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    customerName: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    contactNumber: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: BOOKING_STATUSES,
      default: "pending",
    },
    additionalRequests: { type: String, trim: true, default: "" },
    declineReason: { type: String, trim: true, default: "" },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedAt: { type: Date, default: null },

    // Room reservation (see fe db.json `reservations`)
    roomId: { type: String, trim: true, default: "" },
    /** Human-readable room number from catalog (e.g. "101"); kept in sync with guest UI */
    roomNumber: { type: String, trim: true, default: "" },
    roomTitle: { type: String, trim: true, default: "" },
    checkIn: { type: String, trim: true, default: "" },
    checkOut: { type: String, trim: true, default: "" },
    additionalGuests: { type: Number, min: 0, default: 0 },
    /** FK → Guest (hotel guest profile); see `scripts/migrate-booking-guest-refs.js` for legacy data */
    guestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Guest",
      default: null,
      index: true,
    },

    // Event booking (see fe db.json `eventBookings`)
    eventVenueId: { type: String, trim: true, default: "" },
    venueName: { type: String, trim: true, default: "" },
    venuePrice: { type: String, trim: true, default: "" },
    totalAmount: { type: String, trim: true, default: "" },
    eventTitle: { type: String, trim: true, default: "" },
    eventDate: { type: String, trim: true, default: "" },
    eventEndDate: { type: String, trim: true, default: "" },
    expectedPax: { type: Number, min: 1, default: 1 },
    timeSlot: { type: String, trim: true, default: "" },
    /** Wall-clock HH:MM for same-day event overlap checks (guest + front desk calendars). */
    startTime: { type: String, trim: true, default: "" },
    endTime: { type: String, trim: true, default: "" },
    paymentAmount: { type: String, trim: true, default: "" },
    paymentMethod: { type: String, trim: true, default: "" },
    transactionId: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

bookingSchema.index({ userId: 1, createdAt: -1 });
bookingSchema.index({ type: 1, status: 1 });
bookingSchema.index({ guestId: 1, createdAt: -1 });

/** Empty string is not a valid ObjectId; normalize before validate/save (avoids CastError on approve/reject). */
bookingSchema.pre("validate", function (next) {
  const v = this.guestId;
  if (v === "" || v === undefined) {
    this.set("guestId", null);
  } else if (typeof v === "string") {
    const t = v.trim();
    if (t === "" || !mongoose.isValidObjectId(t)) {
      this.set("guestId", null);
    }
  }
  next();
});

const Booking = mongoose.model("Booking", bookingSchema);

Booking.BOOKING_TYPES = BOOKING_TYPES;
Booking.BOOKING_STATUSES = BOOKING_STATUSES;

module.exports = Booking;
