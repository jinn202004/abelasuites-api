const mongoose = require("mongoose");

/**
 * Hotel guest profile. One guest can have many bookings (Booking.guestId → Guest).
 * Optionally linked to a registered User (userId) when the guest has an account.
 */
const guestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    displayName: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    validIdNumber: { type: String, trim: true, default: "" },
    validIdPhotoName: { type: String, default: "" },
    validIdPhotoData: { type: String, default: "" },
  },
  { timestamps: true }
);

guestSchema.index({ email: 1 });

const Guest = mongoose.model("Guest", guestSchema);

module.exports = Guest;
