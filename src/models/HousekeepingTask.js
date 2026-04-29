const mongoose = require("mongoose");

const TASK_TYPES = ["cleaning_request"];

const TASK_STATUSES = ["pending", "in_progress", "completed"];

const housekeepingTaskSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: TASK_TYPES,
      default: "cleaning_request",
      required: true,
    },
    status: {
      type: String,
      enum: TASK_STATUSES,
      default: "pending",
      index: true,
    },
    /** Source booking that triggered this cleaning request (approve flow). */
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      unique: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: ["room", "event"],
      required: true,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      default: null,
      index: true,
    },
    eventVenueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EventVenue",
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

housekeepingTaskSchema.index({ createdAt: -1 });
housekeepingTaskSchema.index({ status: 1, updatedAt: -1 });

const HousekeepingTask = mongoose.model("HousekeepingTask", housekeepingTaskSchema);

HousekeepingTask.TASK_TYPES = TASK_TYPES;
HousekeepingTask.TASK_STATUSES = TASK_STATUSES;

module.exports = HousekeepingTask;
