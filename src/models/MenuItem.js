const mongoose = require("mongoose");

const AVAILABILITY = ["available", "unavailable"];

const menuItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MenuCategory",
      index: true,
    },
    category: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    imageUrl: {
      type: String,
      default: "",
    },
    availability: {
      type: String,
      enum: AVAILABILITY,
      default: "available",
      index: true,
    },
    status: {
      type: String,
      enum: AVAILABILITY,
      default: "available",
    },
    dietaryTags: {
      type: [String],
      default: [],
    },
    spiceLevel: {
      type: Number,
      min: 0,
      max: 3,
      default: 0,
    },
  },
  { timestamps: true }
);

menuItemSchema.index({ categoryId: 1, name: 1 });

const MenuItem = mongoose.model("MenuItem", menuItemSchema);

module.exports = { MenuItem, AVAILABILITY };
