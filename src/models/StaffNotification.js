const mongoose = require("mongoose");

const NOTIFICATION_TYPES = [
  "booking_review",
  "guest_booking_submitted",
  "housekeeping_cleaning_completed",
];

const staffNotificationSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },
    message: { type: String, trim: true, default: "" },
    readByUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

staffNotificationSchema.index({ bookingId: 1, type: 1 }, { unique: true });
staffNotificationSchema.index({ createdAt: -1 });

const StaffNotification = mongoose.model("StaffNotification", staffNotificationSchema);

StaffNotification.NOTIFICATION_TYPES = NOTIFICATION_TYPES;

module.exports = StaffNotification;
