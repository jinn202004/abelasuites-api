const mongoose = require("mongoose");

const BOOKING_TYPES = ["room", "event"];

const BOOKING_STATUSES = [
  "pending",
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

    // Room reservation (see fe db.json `reservations`)
    roomId: { type: String, trim: true, default: "" },
    roomTitle: { type: String, trim: true, default: "" },
    checkIn: { type: String, trim: true, default: "" },
    checkOut: { type: String, trim: true, default: "" },
    additionalGuests: { type: Number, min: 0, default: 0 },
    guestId: { type: String, trim: true, default: "" },
    guestIdPhotoName: { type: String, default: "" },
    guestIdPhotoData: { type: String, default: "" },

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
    paymentAmount: { type: String, trim: true, default: "" },
    paymentMethod: { type: String, trim: true, default: "" },
    transactionId: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

bookingSchema.index({ userId: 1, createdAt: -1 });
bookingSchema.index({ type: 1, status: 1 });

const Booking = mongoose.model("Booking", bookingSchema);

Booking.BOOKING_TYPES = BOOKING_TYPES;
Booking.BOOKING_STATUSES = BOOKING_STATUSES;

module.exports = Booking;
