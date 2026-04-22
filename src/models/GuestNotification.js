const mongoose = require("mongoose");

const NOTIFICATION_TYPES = ["booking_approved", "booking_rejected"];

const guestNotificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
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
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

guestNotificationSchema.index({ userId: 1, createdAt: -1 });

const GuestNotification = mongoose.model("GuestNotification", guestNotificationSchema);

GuestNotification.NOTIFICATION_TYPES = NOTIFICATION_TYPES;

module.exports = GuestNotification;
