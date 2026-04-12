const mongoose = require("mongoose");

/**
 * Matches legacy json-server `eventVenues` (name, capacity, price, location, amenities…)
 * and admin UI (eventNum, package, type, limit, features, housekeeping…).
 */
const eventVenueSchema = new mongoose.Schema(
  {
    eventNum: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    package: {
      type: String,
      trim: true,
      default: "",
    },
    type: {
      type: String,
      trim: true,
      default: "Event",
    },
    /** Display text e.g. "20–30 Guests" (admin `limit`) */
    limit: {
      type: String,
      trim: true,
      default: "",
    },
    /** Numeric cap when known (legacy `capacity`) */
    capacity: {
      type: Number,
      min: 1,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    location: {
      type: String,
      trim: true,
      default: "",
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    /** Same role as legacy `amenities` */
    features: {
      type: [String],
      default: [],
    },
    housekeeping: {
      type: [String],
      default: [],
    },
    image: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

const EventVenue = mongoose.model("EventVenue", eventVenueSchema);

module.exports = EventVenue;
