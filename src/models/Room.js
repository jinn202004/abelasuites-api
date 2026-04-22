const mongoose = require("mongoose");

/** Operational / turnover state for housekeeping workflows. */
const ROOM_STATUSES = ["available", "occupied", "needs_cleaning", "cleaning_in_progress", "ready"];

const roomSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    roomNumber: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    package: {
      type: String,
      trim: true,
      default: "",
    },
    image: {
      type: String,
      default: "",
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    guests: {
      type: Number,
      required: true,
      min: 1,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    features: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ROOM_STATUSES,
      default: "available",
      index: true,
    },
  },
  { timestamps: true }
);

const Room = mongoose.model("Room", roomSchema);

Room.ROOM_STATUSES = ROOM_STATUSES;

module.exports = Room;
