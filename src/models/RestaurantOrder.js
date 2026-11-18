const mongoose = require("mongoose");

const ORDER_STATUSES = ["pending", "accepted", "preparing", "ready", "completed", "cancelled"];
const ORDER_SOURCES = ["guest", "pos"];
const PAYMENT_METHODS = ["cash", "gcash", ""];

const orderItemSchema = new mongoose.Schema(
  {
    menuItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MenuItem",
      required: true,
    },
    menuItemName: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    specialInstructions: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const restaurantOrderSchema = new mongoose.Schema(
  {
    guestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Guest",
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    source: {
      type: String,
      enum: ORDER_SOURCES,
      default: "pos",
      index: true,
    },
    items: {
      type: [orderItemSchema],
      validate: {
        validator(v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: "Order must include at least one item",
      },
    },
    subtotal: { type: Number, min: 0, default: 0 },
    serviceCharge: { type: Number, min: 0, default: 0 },
    taxAmount: { type: Number, min: 0, default: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, min: 0, default: 0 },
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
      default: "",
    },
    transactionId: { type: String, trim: true, default: "" },
    paymentDate: { type: String, trim: true, default: "" },
    paymentProofData: { type: String, default: "" },
    paymentProofName: { type: String, trim: true, default: "" },
    /** Snapshot for cashier (guest portal / active booking at order time). */
    roomNumber: { type: String, trim: true, default: "" },
    guestPhone: { type: String, trim: true, default: "" },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
    },
    status: {
      type: String,
      enum: ORDER_STATUSES,
      default: "pending",
      index: true,
    },
    orderDate: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

restaurantOrderSchema.index({ createdAt: -1 });

const RestaurantOrder = mongoose.model("RestaurantOrder", restaurantOrderSchema);

module.exports = {
  RestaurantOrder,
  ORDER_STATUSES,
  ORDER_SOURCES,
  PAYMENT_METHODS,
};
