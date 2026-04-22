const mongoose = require("mongoose");

const NOTIFICATION_TYPES = ["cleaning_task_new"];

const housekeepingNotificationSchema = new mongoose.Schema(
  {
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HousekeepingTask",
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
    readByUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

housekeepingNotificationSchema.index({ taskId: 1, type: 1 }, { unique: true });
housekeepingNotificationSchema.index({ createdAt: -1 });

const HousekeepingNotification = mongoose.model("HousekeepingNotification", housekeepingNotificationSchema);

HousekeepingNotification.NOTIFICATION_TYPES = NOTIFICATION_TYPES;

module.exports = HousekeepingNotification;
