const mongoose = require("mongoose");

const menuCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

menuCategorySchema.index({ sortOrder: 1, name: 1 });

const MenuCategory = mongoose.model("MenuCategory", menuCategorySchema);

module.exports = { MenuCategory };
