const mongoose = require("mongoose");

const PAYMENT_STATUSES = ["paid", "partial", "unpaid"];

const billingSchema = new mongoose.Schema(
  {
    guestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Guest",
      required: true,
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      unique: true,
      index: true,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    amountPaid: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "unpaid",
    },
  },
  { timestamps: true }
);

function computePaymentStatus(total, paid) {
  const t = Number(total) || 0;
  const p = Number(paid) || 0;
  const balance = t - p;
  if (t <= 0 && p <= 0) return "unpaid";
  if (balance <= 1e-6) return "paid";
  if (p > 1e-6) return "partial";
  return "unpaid";
}

billingSchema.pre("validate", function (next) {
  const t = Number(this.totalAmount) || 0;
  const p = Number(this.amountPaid) || 0;
  if (p > t + 1e-6) {
    this.invalidate("amountPaid", "amountPaid cannot exceed totalAmount");
  }
  this.paymentStatus = computePaymentStatus(t, p);
  next();
});

const Billing = mongoose.model("Billing", billingSchema);

Billing.PAYMENT_STATUSES = PAYMENT_STATUSES;
Billing.computePaymentStatus = computePaymentStatus;

module.exports = Billing;
