/**
 * Creates Billing documents for existing bookings that do not have one yet.
 *
 * Run from `be/abela-be`:
 *   npm run backfill-billings
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const { connectDatabase } = require("../src/config/database");
const Booking = require("../src/models/Booking");
const Billing = require("../src/models/Billing");
const billingService = require("../src/services/billing.service");

async function main() {
  await connectDatabase();
  const bookings = await Booking.find({})
    .populate({ path: "guestId", model: "Guest" })
    .lean();

  let created = 0;
  let skipped = 0;
  for (const b of bookings) {
    const existing = await Billing.findOne({ bookingId: b._id }).lean();
    if (existing) {
      skipped += 1;
      continue;
    }
    const row = await billingService.ensureBillingForBooking(b);
    if (row) created += 1;
  }

  console.log(
    `Bookings scanned: ${bookings.length}. New billing rows: ${created}. Already had billing: ${skipped}.`,
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
